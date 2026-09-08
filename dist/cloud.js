import { openStore } from './db.js';
import { equal, mergeRecords, migrateLegacy } from './model.js';

const CONFIG = {
  url: 'https://cbhcfvbdeuntrjbhbdpq.supabase.co',
  key: 'sb_publishable_KEfQWQNIMDusafNtee9VMQ_9Tsfq89C',
  table: 'player_notebook_state',
  bucket: 'player-notebook-covers'
};

export class CloudService {
  session = null;
  enabled = false;
  running = false;
  timer;
  lastError = '';
  db;

  constructor(guest, onSwitch, onStatus, onData) {
    this.guest = guest;
    this.onSwitch = onSwitch;
    this.onStatus = onStatus;
    this.onData = onData;
    this.db = guest;
  }

  async init() {
    this.session = (await this.guest.get('meta', 'auth'))?.value || null;
    const active = (await this.guest.get('meta', 'active-account'))?.value;
    if (this.session && active === this.session.user.id) await this.useAccount(false);
    addEventListener('online', () => this.schedule(0));
    addEventListener('offline', () => this.status());
    window.setInterval(() => this.schedule(0), 30000);
    this.status();
    this.schedule();
  }

  status(text) {
    this.onStatus(text || (!navigator.onLine
      ? 'Работаем без сети · изменения сохранены на устройстве'
      : this.enabled ? '✓ Сохранено' : '○ Только на устройстве'));
  }

  async request(path, options = {}) {
    const { method = 'GET', body, raw, auth = true, headers = {}, blob = false } = options;
    const requestHeaders = { apikey: CONFIG.key, ...headers };
    if (auth && this.session) requestHeaders.Authorization = `Bearer ${this.session.access_token}`;
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetch(CONFIG.url + path, {
      method,
      headers: requestHeaders,
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.msg || detail.message || detail.error_description || `Ошибка ${response.status}`);
    }
    if (blob) return response.blob();
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async remember(value) {
    this.session = {
      ...value,
      expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600)
    };
    await this.guest.put('meta', { id: 'auth', value: this.session });
  }

  async login(email, password, register = false) {
    const value = await this.request(
      register ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password',
      { method: 'POST', auth: false, body: { email, password } }
    );
    if (!value?.access_token) return false;
    await this.remember(value);
    return true;
  }

  async fresh() {
    if (!this.session) throw new Error('Войдите в аккаунт');
    if (this.session.expires_at * 1000 < Date.now() + 60000) {
      const value = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        auth: false,
        body: { refresh_token: this.session.refresh_token }
      });
      await this.remember(value);
    }
  }

  async useAccount(importGuest) {
    if (!this.session) throw new Error('Сначала войдите в аккаунт');
    const next = await openStore(this.session.user.id);
    if (importGuest) {
      await next.importRecords(await this.guest.all('records'), await this.guest.all('media'));
    }
    this.db = next;
    this.enabled = true;
    await this.guest.put('meta', { id: 'active-account', value: this.session.user.id });
    await this.onSwitch(next);
    this.schedule(0);
  }

  async logout() {
    if (this.timer) clearTimeout(this.timer);
    if (navigator.onLine && this.session) await this.request('/auth/v1/logout', { method: 'POST' }).catch(() => undefined);
    await this.guest.delete('meta', 'auth');
    await this.guest.delete('meta', 'active-account');
    this.session = null;
    this.enabled = false;
    this.db = this.guest;
    await this.onSwitch(this.guest);
    this.status();
  }

  schedule(delay = 900) {
    if (this.timer) clearTimeout(this.timer);
    if (this.enabled && navigator.onLine) this.timer = window.setTimeout(() => void this.sync(), delay);
    else this.status();
  }

  async sync() {
    if (this.running || !this.enabled || !navigator.onLine || !this.session) return;
    this.running = true;
    this.status('↻ Синхронизация…');
    try {
      await this.fresh();
      const uid = this.session.user.id;
      const local = await this.db.all('records');
      const rows = await this.request(`/rest/v1/${CONFIG.table}?user_id=eq.${uid}&select=data,client_updated_at&limit=1`);
      const row = rows?.[0];
      const remote = row ? migrateLegacy(row.data) : [];
      const merged = mergeRecords(local, remote);

      for (const record of merged.filter(item => item.image_id)) {
        const imageId = String(record.image_id);
        let media = await this.db.get('media', imageId);
        const path = `${uid}/${imageId}.jpg`;
        if (media && media.upload_state !== 'uploaded') {
          await this.request(`/storage/v1/object/${CONFIG.bucket}/${path}`, {
            method: 'POST',
            raw: media.blob,
            headers: { 'Content-Type': media.mime || 'image/jpeg', 'x-upsert': 'true' }
          });
          media = { ...media, upload_state: 'uploaded', storage_key: path };
          await this.db.put('media', media);
        } else if (!media) {
          try {
            const downloaded = await this.request(`/storage/v1/object/authenticated/${CONFIG.bucket}/${path}`, { blob: true });
            media = { id: imageId, blob: downloaded, thumbnail: downloaded, mime: downloaded.type || 'image/jpeg', upload_state: 'uploaded', storage_key: path };
            await this.db.put('media', media);
          } catch {}
        }
      }

      if (!row || !equal(merged, remote)) {
        const body = {
          user_id: uid,
          data: { format: 'seeker-notebook-3', records: merged },
          client_updated_at: Date.now(),
          device_id: this.db.device
        };
        await this.request(`/rest/v1/${CONFIG.table}?on_conflict=user_id`, {
          method: 'POST',
          body,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
        });
      }

      await this.db.importRecords(merged);
      this.lastError = '';
      await this.onData();
      this.status('✓ Сохранено');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Ошибка синхронизации';
      this.status('! Не удалось синхронизировать · данные сохранены локально');
    } finally {
      this.running = false;
    }
  }

  get error() { return this.lastError; }
}
