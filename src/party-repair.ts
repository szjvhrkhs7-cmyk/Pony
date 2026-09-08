export {};

type StoredRecord = {
  id: string;
  type: string;
  wallpaper_id?: string | null;
  version?: number;
  updated_at?: string;
  device_id?: string;
  [key: string]: unknown;
};

type StoredMedia = {
  id: string;
  blob: Blob;
  thumbnail?: Blob;
  mime?: string;
  width?: number;
  height?: number;
  upload_state?: string;
};

type MetaValue<T> = { id: string; value?: T };

const DB_PREFIX = 'seeker-notebook-3:';
const GUEST_DB = `${DB_PREFIX}guest`;
const wallpaperJobs = new WeakMap<HTMLFormElement, Promise<StoredMedia | null>>();
let wallpaperUrl: string | null = null;
let previewUrl: string | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openNamedDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function activeDb(): Promise<IDBDatabase> {
  const guest = await openNamedDb(GUEST_DB);
  try {
    if (!guest.objectStoreNames.contains('meta')) return guest;
    const tx = guest.transaction('meta', 'readonly');
    const active = await requestResult<MetaValue<string> | undefined>(tx.objectStore('meta').get('active-account'));
    if (!active?.value) return guest;
    guest.close();
    return await openNamedDb(`${DB_PREFIX}${active.value}`);
  } catch {
    return guest;
  }
}

async function getFromStore<T>(db: IDBDatabase, store: string, id: IDBValidKey): Promise<T | undefined> {
  if (!db.objectStoreNames.contains(store)) return undefined;
  const tx = db.transaction(store, 'readonly');
  return await requestResult<T | undefined>(tx.objectStore(store).get(id));
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Сохранение прервано'));
  });
}

async function waitForParty(db: IDBDatabase, id: string): Promise<StoredRecord | undefined> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const record = await getFromStore<StoredRecord>(db, 'records', id);
    if (record) return record;
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  return undefined;
}

async function imageBlob(file: File, maxSide: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Не удалось подготовить изображение');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось обработать изображение')), 'image/jpeg', quality);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareWallpaper(file: File): Promise<StoredMedia> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Выберите JPEG, PNG, WebP или GIF.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Размер изображения должен быть меньше 20 МБ.');
  const id = crypto.randomUUID();
  return {
    id,
    blob: await imageBlob(file, 1920, .84),
    thumbnail: await imageBlob(file, 640, .80),
    mime: 'image/jpeg',
    upload_state: 'pending'
  };
}

async function currentPartyRecord(form: HTMLFormElement): Promise<StoredRecord | undefined> {
  const id = form.dataset.id;
  if (!id) return undefined;
  const db = await activeDb();
  try { return await getFromStore<StoredRecord>(db, 'records', id); }
  finally { db.close(); }
}

function wallpaperField(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'upload-section full wallpaper-upload-section';
  section.innerHTML = `
    <div class="section-label"><i></i><span>Обои партии</span><i></i></div>
    <div class="wallpaper-upload-card">
      <label class="wallpaper-preview" aria-label="Выбрать обои партии">
        <span class="wallpaper-preview-mark">＋</span>
        <input data-party-wallpaper-input type="file" accept="image/jpeg,image/png,image/webp,image/gif">
      </label>
      <div class="wallpaper-upload-copy">
        <strong>Фон журнала партии</strong>
        <span>Выберите изображение. Оно появится за пергаментом только внутри этой партии.</span>
        <label class="wallpaper-trigger">Выбрать изображение<input data-party-wallpaper-trigger type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        <small class="wallpaper-name">JPG, PNG, WEBP или GIF · до 20 МБ</small>
        <button class="wallpaper-remove" type="button" hidden>Убрать обои</button>
      </div>
    </div>`;
  return section;
}

function setPreview(section: HTMLElement, file: File): void {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  const preview = section.querySelector<HTMLElement>('.wallpaper-preview');
  if (preview) {
    preview.style.backgroundImage = `linear-gradient(rgba(15,26,20,.12),rgba(15,26,20,.12)),url("${previewUrl}")`;
    preview.classList.add('has-preview');
  }
  const name = section.querySelector<HTMLElement>('.wallpaper-name');
  if (name) name.textContent = file.name;
}

async function hydrateWallpaperControl(form: HTMLFormElement, section: HTMLElement): Promise<void> {
  const record = await currentPartyRecord(form);
  if (!record?.wallpaper_id) return;
  const db = await activeDb();
  try {
    const media = await getFromStore<StoredMedia>(db, 'media', String(record.wallpaper_id));
    if (!media?.blob) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(media.thumbnail || media.blob);
    const preview = section.querySelector<HTMLElement>('.wallpaper-preview');
    if (preview) {
      preview.style.backgroundImage = `linear-gradient(rgba(15,26,20,.10),rgba(15,26,20,.10)),url("${previewUrl}")`;
      preview.classList.add('has-preview');
    }
    const name = section.querySelector<HTMLElement>('.wallpaper-name');
    if (name) name.textContent = 'Обои установлены';
    const remove = section.querySelector<HTMLButtonElement>('.wallpaper-remove');
    if (remove) remove.hidden = false;
  } finally { db.close(); }
}

function connectWallpaperForm(form: HTMLFormElement): void {
  if (form.dataset.partyWallpaperReady || form.dataset.type !== 'party') return;
  form.dataset.partyWallpaperReady = 'true';
  if (!form.dataset.id) form.dataset.id = crypto.randomUUID();

  const section = wallpaperField();
  const error = form.querySelector('.form-error');
  if (error) error.before(section); else form.append(section);
  void hydrateWallpaperControl(form, section);

  const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[type=file]'));
  const useFile = (file?: File) => {
    if (!file) return;
    form.dataset.wallpaperRemove = 'false';
    setPreview(section, file);
    const job = prepareWallpaper(file).catch(error => {
      const message = form.querySelector<HTMLElement>('.form-error');
      if (message) message.textContent = error instanceof Error ? error.message : 'Не удалось обработать обои';
      throw error;
    });
    wallpaperJobs.set(form, job);
    const remove = section.querySelector<HTMLButtonElement>('.wallpaper-remove');
    if (remove) remove.hidden = false;
  };
  inputs.forEach(input => input.addEventListener('change', () => useFile(input.files?.[0])));

  section.querySelector<HTMLButtonElement>('.wallpaper-remove')?.addEventListener('click', () => {
    form.dataset.wallpaperRemove = 'true';
    wallpaperJobs.delete(form);
    inputs.forEach(input => { input.value = ''; });
    const preview = section.querySelector<HTMLElement>('.wallpaper-preview');
    if (preview) {
      preview.style.backgroundImage = '';
      preview.classList.remove('has-preview');
    }
    const name = section.querySelector<HTMLElement>('.wallpaper-name');
    if (name) name.textContent = 'Обои будут удалены после сохранения';
  });

  form.addEventListener('submit', () => void persistWallpaper(form));
}

async function persistWallpaper(form: HTMLFormElement): Promise<void> {
  const remove = form.dataset.wallpaperRemove === 'true';
  const job = wallpaperJobs.get(form);
  if (!remove && !job) return;
  const id = form.dataset.id;
  if (!id) return;

  try {
    const media = remove ? null : await job!;
    const db = await activeDb();
    try {
      const record = await waitForParty(db, id);
      if (!record) throw new Error('Партия ещё не сохранена');
      const tx = db.transaction(['records', 'media'], 'readwrite');
      const next: StoredRecord = {
        ...record,
        wallpaper_id: media?.id || null,
        updated_at: new Date().toISOString(),
        version: Number(record.version || 0) + 1
      };
      tx.objectStore('records').put(next);
      if (media) tx.objectStore('media').put(media);
      await waitForTransaction(tx);
    } finally { db.close(); }
    if (location.hash === `#party/${id}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (error) {
    console.error('Party wallpaper save failed', error);
  }
}

function compactPartyDetails(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.detail-page .journal-section[data-section]').forEach(section => {
    const id = section.dataset.section || '';
    if (/:(history|events|notes|companions)$/.test(id)) section.remove();
  });
}

async function applyPartyWallpaper(root: ParentNode = document): Promise<void> {
  const page = root instanceof HTMLElement && root.matches('.detail-page') ? root : root.querySelector<HTMLElement>('.detail-page');
  if (!page) return;
  const match = decodeURIComponent(location.hash).match(/^#party\/(.+)$/);
  if (!match) return;
  const db = await activeDb();
  try {
    const record = await getFromStore<StoredRecord>(db, 'records', match[1]);
    const wallpaperId = record?.wallpaper_id ? String(record.wallpaper_id) : '';
    if (!wallpaperId) {
      page.classList.remove('has-party-wallpaper');
      page.style.removeProperty('--party-wallpaper');
      return;
    }
    const media = await getFromStore<StoredMedia>(db, 'media', wallpaperId);
    if (!media?.blob) return;
    if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
    wallpaperUrl = URL.createObjectURL(media.blob);
    page.style.setProperty('--party-wallpaper', `url("${wallpaperUrl}")`);
    page.classList.add('has-party-wallpaper');
  } finally { db.close(); }
}

function optimizeImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>('.campaign-card img, .session-card img, .detail-banner img').forEach((image, index) => {
    image.decoding = 'async';
    if (!image.closest('.detail-banner') && index > 0) image.loading = 'lazy';
  });
}

function upgrade(root: ParentNode = document): void {
  if (root instanceof HTMLFormElement) connectWallpaperForm(root);
  root.querySelectorAll?.<HTMLFormElement>('#record-form[data-type="party"]').forEach(connectWallpaperForm);
  compactPartyDetails(root);
  optimizeImages(root);
  void applyPartyWallpaper(root);
}

upgrade();
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) if (node instanceof HTMLElement) upgrade(node);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

addEventListener('hashchange', () => {
  compactPartyDetails();
  void applyPartyWallpaper();
});
