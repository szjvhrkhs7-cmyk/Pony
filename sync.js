const CLOUD = {
  url: 'https://cbhcfvbdeuntrjbhbdpq.supabase.co',
  key: 'sb_publishable_KEfQWQNIMDusafNtee9VMQ_9Tsfq89C',
  table: 'player_notebook_state',
  bucket: 'player-notebook-covers'
};

const LOCAL_DATA_KEY = 'seeker-chronicles:v2';
const LOCAL_DB_NAME = 'seeker-chronicles-media-v2';
const LOCAL_DB_VERSION = 1;
const LOCAL_IMAGE_STORE = 'session-covers';
const SESSION_KEY = 'seeker-chronicles:cloud-session';
const DEVICE_KEY = 'seeker-chronicles:device-id';
const SCALE_KEY = 'seeker-chronicles:ui-scale';
const SYNC_DEBOUNCE_MS = 1200;

let session = loadJson(SESSION_KEY, null);
let syncTimer = null;
let syncRunning = false;
let lastObservedLocal = localStorage.getItem(LOCAL_DATA_KEY) || '';
let lastSyncHash = '';
let pollingTimer = null;

const ui = {};

document.addEventListener('DOMContentLoaded', () => {
  bindUi();
  applyStoredScale();
  updateCloudUi();
  startLocalWatcher();
  window.addEventListener('online', () => {
    updateCloudUi('Сеть восстановлена');
    scheduleSync(150);
  });
  window.addEventListener('offline', () => updateCloudUi('Офлайн · данные сохраняются на устройстве'));
  if (session) scheduleSync(400);
});

function bindUi() {
  ui.cloudButton = document.getElementById('cloudButton');
  ui.cloudStatusText = document.getElementById('cloudStatusText');
  ui.cloudModal = document.getElementById('cloudModal');
  ui.cloudBackdrop = document.getElementById('cloudBackdrop');
  ui.cloudClose = document.getElementById('cloudClose');
  ui.cloudEmail = document.getElementById('cloudEmail');
  ui.cloudPassword = document.getElementById('cloudPassword');
  ui.cloudLogin = document.getElementById('cloudLogin');
  ui.cloudRegister = document.getElementById('cloudRegister');
  ui.cloudLogout = document.getElementById('cloudLogout');
  ui.syncNow = document.getElementById('syncNow');
  ui.syncDetails = document.getElementById('syncDetails');
  ui.scaleSelect = document.getElementById('scaleSelect');

  ui.cloudButton?.addEventListener('click', openCloudModal);
  ui.cloudClose?.addEventListener('click', closeCloudModal);
  ui.cloudBackdrop?.addEventListener('click', closeCloudModal);
  ui.cloudLogin?.addEventListener('click', login);
  ui.cloudRegister?.addEventListener('click', register);
  ui.cloudLogout?.addEventListener('click', logout);
  ui.syncNow?.addEventListener('click', () => runSync({ manual: true }));
  ui.scaleSelect?.addEventListener('change', () => setScale(ui.scaleSelect.value));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.cloudModal && !ui.cloudModal.classList.contains('is-hidden')) closeCloudModal();
  });
}

function openCloudModal() {
  ui.cloudBackdrop?.classList.remove('is-hidden');
  ui.cloudModal?.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
  updateCloudUi();
  setTimeout(() => ui.cloudEmail?.focus(), 0);
}

function closeCloudModal() {
  ui.cloudBackdrop?.classList.add('is-hidden');
  ui.cloudModal?.classList.add('is-hidden');
  document.body.style.overflow = '';
}

function applyStoredScale() {
  const saved = localStorage.getItem(SCALE_KEY) || '1';
  setScale(saved, false);
}

function setScale(value, persist = true) {
  const numeric = Math.min(1.2, Math.max(0.8, Number(value) || 1));
  document.documentElement.style.setProperty('--ui-scale', String(numeric));
  if (ui.scaleSelect) ui.scaleSelect.value = String(numeric);
  if (persist) localStorage.setItem(SCALE_KEY, String(numeric));
}

async function login() {
  const email = ui.cloudEmail?.value.trim();
  const password = ui.cloudPassword?.value || '';
  if (!email || !password) return setDetails('Введите e-mail и пароль.');

  setDetails('Выполняю вход…');
  try {
    const response = await cloudFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: { email, password }
    });
    session = normalizeSession(response);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    updateCloudUi('Вход выполнен');
    await runSync({ manual: true, firstLogin: true });
  } catch (error) {
    setDetails(readableError(error, 'Не удалось войти.'));
  }
}

async function register() {
  const email = ui.cloudEmail?.value.trim();
  const password = ui.cloudPassword?.value || '';
  if (!email || password.length < 6) return setDetails('Введите e-mail и пароль не короче 6 символов.');

  setDetails('Создаю аккаунт…');
  try {
    const response = await cloudFetch('/auth/v1/signup', {
      method: 'POST',
      auth: false,
      body: { email, password }
    });

    if (response.access_token) {
      session = normalizeSession(response);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      updateCloudUi('Аккаунт создан');
      await runSync({ manual: true, firstLogin: true });
    } else {
      setDetails('Аккаунт создан. Если в проекте включено подтверждение e-mail, откройте письмо и затем войдите.');
    }
  } catch (error) {
    setDetails(readableError(error, 'Не удалось создать аккаунт.'));
  }
}

async function logout() {
  try {
    if (session?.access_token) await cloudFetch('/auth/v1/logout', { method: 'POST' });
  } catch {}
  session = null;
  localStorage.removeItem(SESSION_KEY);
  lastSyncHash = '';
  updateCloudUi('Облако отключено · локальные данные сохранены');
}

function normalizeSession(value) {
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600),
    user: value.user
  };
}

async function ensureFreshSession() {
  if (!session) return false;
  const expiresSoon = !session.expires_at || session.expires_at * 1000 < Date.now() + 60000;
  if (!expiresSoon) return true;
  if (!session.refresh_token) return false;

  try {
    const response = await cloudFetch('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: { refresh_token: session.refresh_token }
    });
    session = normalizeSession(response);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    updateCloudUi('Сессия истекла · войдите снова');
    return false;
  }
}

function startLocalWatcher() {
  clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    const current = localStorage.getItem(LOCAL_DATA_KEY) || '';
    if (current !== lastObservedLocal) {
      lastObservedLocal = current;
      scheduleSync();
    }
  }, 700);
}

function scheduleSync(delay = SYNC_DEBOUNCE_MS) {
  if (!session || !navigator.onLine) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => runSync(), delay);
}

async function runSync({ manual = false, firstLogin = false } = {}) {
  if (syncRunning) return;
  if (!session) {
    if (manual) setDetails('Сначала войдите в облако.');
    return;
  }
  if (!navigator.onLine) {
    updateCloudUi('Офлайн · изменения остаются на устройстве');
    if (manual) setDetails('Нет сети. Всё продолжает сохраняться локально и синхронизируется после подключения.');
    return;
  }

  syncRunning = true;
  updateCloudUi('Синхронизация…');
  try {
    if (!(await ensureFreshSession())) throw new Error('Нужно войти снова');
    const user = session.user || await getCurrentUser();
    session.user = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    const local = readLocalData();
    const localStamp = Number(local.clientUpdatedAt || 0);
    const cloudRow = await getCloudRow(user.id);
    const cloudStamp = Number(cloudRow?.client_updated_at || 0);

    if (!cloudRow) {
      await pushCloudState(user.id, local);
      await uploadAllLocalCovers(user.id, local);
      lastSyncHash = stableHash(local);
      updateCloudUi('Синхронизировано');
      setDetails('Облачная копия создана. Локальное сохранение остаётся включённым.');
      return;
    }

    if (cloudStamp > localStamp) {
      const cloudData = cloudRow.data && typeof cloudRow.data === 'object' ? cloudRow.data : { version: 2, campaigns: [] };
      await downloadCloudCovers(user.id, cloudData);
      localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(cloudData));
      lastObservedLocal = localStorage.getItem(LOCAL_DATA_KEY) || '';
      updateCloudUi('Получена более новая версия из облака');
      setDetails('На этом устройстве была более старая копия. Загружена последняя облачная версия.');
      setTimeout(() => location.reload(), 350);
      return;
    }

    const currentHash = stableHash(local);
    if (localStamp > cloudStamp || currentHash !== lastSyncHash || firstLogin) {
      await pushCloudState(user.id, local);
      await uploadAllLocalCovers(user.id, local);
      lastSyncHash = currentHash;
    }

    updateCloudUi('Синхронизировано');
    setDetails('Облако и это устройство синхронизированы. При отключении сети работа продолжится локально.');
  } catch (error) {
    updateCloudUi('Ошибка облака · локальная копия сохранена');
    if (manual) setDetails(readableError(error, 'Не удалось синхронизировать. Локальные данные не потеряны.'));
  } finally {
    syncRunning = false;
  }
}

function readLocalData() {
  const value = loadJson(LOCAL_DATA_KEY, { version: 2, lastCampaignId: null, campaigns: [] });
  value.campaigns ||= [];
  if (!value.deviceId) value.deviceId = getDeviceId();
  if (!value.clientUpdatedAt) value.clientUpdatedAt = Date.now();
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(value));
  lastObservedLocal = localStorage.getItem(LOCAL_DATA_KEY) || '';
  return value;
}

async function getCurrentUser() {
  return cloudFetch('/auth/v1/user', { method: 'GET' });
}

async function getCloudRow(userId) {
  const rows = await cloudFetch(`/rest/v1/${CLOUD.table}?select=data,client_updated_at,device_id,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { method: 'GET' });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function pushCloudState(userId, local) {
  const data = structuredClone(local);
  const clientUpdatedAt = Number(data.clientUpdatedAt || Date.now());
  await cloudFetch(`/rest/v1/${CLOUD.table}?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: {
      user_id: userId,
      data,
      client_updated_at: clientUpdatedAt,
      device_id: getDeviceId()
    }
  });
}

async function uploadAllLocalCovers(userId, data) {
  const sessions = allSessions(data);
  for (const item of sessions) {
    const blob = await getLocalCover(item.id).catch(() => null);
    if (!blob) continue;
    const path = `${userId}/${item.id}.jpg`;
    await cloudFetch(`/storage/v1/object/${CLOUD.bucket}/${path}`, {
      method: 'POST',
      rawBody: blob,
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'x-upsert': 'true'
      }
    });
  }
}

async function downloadCloudCovers(userId, data) {
  const sessions = allSessions(data);
  for (const item of sessions) {
    const path = `${userId}/${item.id}.jpg`;
    try {
      const blob = await cloudFetch(`/storage/v1/object/${CLOUD.bucket}/${path}`, { method: 'GET', expectBlob: true });
      if (blob?.size) await putLocalCover(item.id, blob);
    } catch (error) {
      if (!String(error?.message || '').includes('404')) {
        // Missing cover is a normal case; other failures should not block text sync.
      }
    }
  }
}

function allSessions(data) {
  const result = [];
  for (const campaign of data.campaigns || []) {
    for (const sessionItem of campaign.sessions || []) result.push(sessionItem);
  }
  return result;
}

async function cloudFetch(path, options = {}) {
  const headers = {
    apikey: CLOUD.key,
    ...(options.headers || {})
  };

  if (options.auth !== false && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${CLOUD.url}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.rawBody !== undefined ? options.rawBody : options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let detail = '';
    try {
      const json = await response.json();
      detail = json.msg || json.message || json.error_description || json.error || '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`${response.status}${detail ? ` · ${detail}` : ''}`);
  }

  if (options.expectBlob) return response.blob();
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function openLocalDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_IMAGE_STORE)) db.createObjectStore(LOCAL_IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLocalCover(sessionId) {
  const db = await openLocalDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_IMAGE_STORE, 'readonly');
    const request = tx.objectStore(LOCAL_IMAGE_STORE).get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

async function putLocalCover(sessionId, blob) {
  const db = await openLocalDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_IMAGE_STORE, 'readwrite');
    tx.objectStore(LOCAL_IMAGE_STORE).put(blob, sessionId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function updateCloudUi(message = '') {
  if (!ui.cloudStatusText || !ui.cloudButton) return;
  const offline = !navigator.onLine;
  let text = 'Локально';
  let mode = 'local';

  if (session && offline) {
    text = 'Офлайн';
    mode = 'offline';
  } else if (session) {
    text = message || 'Облако';
    mode = text.includes('Ошибка') ? 'error' : text.includes('Синхронизация') ? 'syncing' : 'cloud';
  }

  ui.cloudStatusText.textContent = text;
  ui.cloudButton.dataset.mode = mode;
  ui.cloudLogout?.classList.toggle('is-hidden', !session);
  ui.syncNow?.classList.toggle('is-hidden', !session);
  ui.cloudLogin?.classList.toggle('is-hidden', Boolean(session));
  ui.cloudRegister?.classList.toggle('is-hidden', Boolean(session));
  if (ui.cloudEmail) ui.cloudEmail.disabled = Boolean(session);
  if (ui.cloudPassword) ui.cloudPassword.disabled = Boolean(session);

  if (message) setDetails(message);
  else if (session?.user?.email) setDetails(`Выполнен вход: ${session.user.email}. Локальная копия всегда остаётся на устройстве.`);
  else if (!session) setDetails('Сейчас данные хранятся только на этом устройстве. Войдите или создайте аккаунт, чтобы включить облачную копию.');
}

function setDetails(text) {
  if (ui.syncDetails) ui.syncDetails.textContent = text;
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function stableHash(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

function readableError(error, fallback) {
  const text = String(error?.message || '');
  if (text.includes('Invalid login credentials')) return 'Неверный e-mail или пароль.';
  if (text.includes('Email not confirmed')) return 'Сначала подтвердите e-mail по ссылке из письма.';
  if (text.includes('User already registered')) return 'Такой e-mail уже зарегистрирован. Используйте вход.';
  return text ? `${fallback} ${text}` : fallback;
}
