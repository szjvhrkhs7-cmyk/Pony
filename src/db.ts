import { ChronicleRecord, MediaRecord, createRecord, mergeRecords, migrateLegacy } from './model.js';

const STORES = ['records', 'drafts', 'media', 'queue', 'meta'] as const;
type StoreName = typeof STORES[number];

export class ChronicleDB {
  readonly device: string;
  constructor(private readonly db: IDBDatabase) {
    this.device = localStorage.getItem('seeker-chronicles:device-id') || crypto.randomUUID();
    localStorage.setItem('seeker-chronicles:device-id', this.device);
  }

  get<T>(store: StoreName, id: IDBValidKey): Promise<T | undefined> {
    return this.read<T>(store, 'get', id);
  }

  all<T>(store: StoreName): Promise<T[]> {
    return this.read<T[]>(store, 'getAll');
  }

  private read<T>(store: StoreName, method: 'get' | 'getAll', id?: IDBValidKey): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = method === 'get' ? objectStore.get(id!) : objectStore.getAll();
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  transaction(stores: StoreName[], action: (tx: IDBTransaction) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, 'readwrite');
      try { action(tx); } catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Сохранение прервано'));
    });
  }

  put<T>(store: StoreName, value: T): Promise<void> {
    return this.transaction([store], tx => { tx.objectStore(store).put(value); });
  }

  delete(store: StoreName, id: IDBValidKey): Promise<void> {
    return this.transaction([store], tx => { tx.objectStore(store).delete(id); });
  }

  async change(type: ChronicleRecord['type'], id: string, fields: Record<string, unknown>, media: MediaRecord | null = null, draftId: string | null = null): Promise<ChronicleRecord> {
    let saved!: ChronicleRecord;
    await this.transaction(['records', 'media', 'drafts'], tx => {
      const records = tx.objectStore('records');
      const request = records.get(id);
      request.onsuccess = () => {
        const old = request.result as ChronicleRecord | undefined;
        saved = createRecord(type, {
          ...old,
          ...fields,
          id,
          version: (old?.version || 0) + 1,
          updated_at: new Date().toISOString(),
          device_id: this.device
        }, this.device);
        records.put(saved);
        if (media) tx.objectStore('media').put(media);
        if (draftId) tx.objectStore('drafts').delete(draftId);
      };
    });
    return saved;
  }

  async importRecords(incoming: ChronicleRecord[], media: MediaRecord[] = []): Promise<void> {
    const merged = mergeRecords(await this.all<ChronicleRecord>('records'), incoming);
    await this.transaction(['records','media'], tx => {
      for (const item of merged) tx.objectStore('records').put(item);
      for (const item of media) tx.objectStore('media').put(item);
    });
  }
}

export function openStore(scope = 'guest'): Promise<ChronicleDB> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`seeker-notebook-3:${scope}`, 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(new ChronicleDB(request.result));
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Закройте другую вкладку журнала и повторите.'));
  });
}

export async function migrateLocal(db: ChronicleDB): Promise<void> {
  if (await db.get('meta', 'legacy-imported')) return;
  const raw = localStorage.getItem('seeker-chronicles:v2');
  if (raw) {
    const records = migrateLegacy(JSON.parse(raw));
    if (records.length) await db.importRecords(records);
  }
  await db.put('meta', { id: 'legacy-imported', at: new Date().toISOString() });
}

export async function prepareImage(file: File): Promise<MediaRecord> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Выберите JPEG, PNG, WebP или GIF.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Размер изображения должен быть меньше 20 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const convert = async (max: number): Promise<Blob> => {
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось обработать изображение')), 'image/jpeg', .86));
    };
    return {
      id: crypto.randomUUID(), blob: await convert(1600), thumbnail: await convert(480),
      mime: 'image/jpeg', width: image.naturalWidth, height: image.naturalHeight, upload_state: 'pending'
    };
  } finally { URL.revokeObjectURL(url); }
}
