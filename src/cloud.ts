import { ChronicleDB, openStore } from './db.js';
import { ChronicleRecord, MediaRecord, equal, mergeRecords, migrateLegacy } from './model.js';

const CONFIG = {
  url: 'https://cbhcfvbdeuntrjbhbdpq.supabase.co',
  key: 'sb_publishable_KEfQWQNIMDusafNtee9VMQ_9Tsfq89C',
  table: 'player_notebook_state',
  bucket: 'player-notebook-covers'
};

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
  user: { id: string; email?: string };
};

type MetaValue<T> = { id: string; value: T };

export class CloudService {
  session: Session | null = null;
  enabled = false;
  private running = false;
  private timer?: number;
  private lastError = '';
  private db: ChronicleDB;

  constructor(
    private readonly guest: ChronicleDB,
    private readonly onSwitch: (db: ChronicleDB) => Promise<void>,
    private readonly onStatus: (message: string) => void,
    private readonly onData: () => Promise<void>
  ) { this.db = guest; }

  async init(): Promise<void> {
    this.session = (await this.guest.get<MetaValue<Session>>('meta', 'auth'))?.value || null;
    const active = (await this.guest.get<MetaValue<string>>('meta', 'active-account'))?.value;
    if (this.session && active === this.session.user.id) await this.useAccount(false);
    addEventListener('online', () => this.schedule(0));
    addEventListener('offline', () => this.status());
    window.setInterval(() => this.schedule(0), 30000);
    this.status();
    this.schedule();
  }

  status(text?: string): void {
    this.onStatus(text || (!navigator.onLine
      ? 'Работаем без сети · изменения сохранены на устройстве'
      : this.enabled ? '✓ Сохранено' : '○ Только на устройстве'));
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown; raw?: BodyInit; auth?: boolean; headers?: Record<string,string>; blob?: boolean } = {}): Promise<T> {
    const { method = 'GET', body, raw, auth = true, headers = {}, blob = false } = options;
    const requestHeaders: Record<string,string> = { apikey: CONFIG.key, ...headers };
    if (auth && this.session) requestHeaders.Authorization = `Bearer ${this.session.access_token}`;
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetch(CONFIG.url + path, {
      method, headers: requestHeaders,
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.msg || detail.message || detail.error_description || `Ошибка ${response.status}`);
    }
    if (blob) return await response.blob() as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private async remember(value: Session): Promise<void> {
    this.session = { ...value, expires_at: value.expires_at || Math.floor(Date.now()/1000) + (value.expires_in || 3600) };
    await this.guest.put('meta', { id: 'auth', value: this.session });
  }

  async login(email: string, password: string, register = false): Promise<boolean> {
    const value = await this.request<Session>(register ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false, body: { email, password }
    });
    if (!value?.access_token) return false;
    await this.remember(value);
    return true;
  }

  private async fresh(): Promise<void> {
    if (!this.session) throw new Error('Войдите в аккаунт');
    if (this.session.expires_at * 1000 < Date.now() + 60000) {
      const value = await this.request<Session>('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: this.session.refresh_token }
      });
      await this.remember(value);
    }
  }

  async useAccount(importGuest: boolean): Promise<void> {
    if (!this.session) throw new Error('Сначала войдите в аккаунт');
    const next = await openStore(this.session.user.id);
    if (importGuest) {
      await next.importRecords(await this.guest.all<ChronicleRecord>('records'), await this.guest.all<MediaRecord>('media'));
    }
    this.db = next;
    this.enabled = true;
    await this.guest.put('meta', { id: 'active-account', value: this.session.user.id });
    await this.onSwitch(next);
    this.schedule(0);
  }

  async logout(): Promise<void> {
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

  schedule(delay = 900): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.enabled && navigator.onLine) this.timer = window.setTimeout(() => void this.sync(), delay);
    else this.status();
  }

  async sync(): Promise<void> {
    if (this.running || !this.enabled || !navigator.onLine || !this.session) return;
    this.running = true;
    this.status('↻ Синхронизация…');
    try {
      await this.fresh();
      const uid = this.session!.user.id;
      const local = await this.db.all<ChronicleRecord>('records');
      const rows = await this.request<Array<{data: unknown; client_updated_at: number}>>(`/rest/v1/${CONFIG.table}?user_id=eq.${uid}&select=data,client_updated_at&limit=1`);
      const row = rows?.[0];
      const remote = row ? migrateLegacy(row.data) : [];
      const merged = mergeRecords(local, remote);

      const mediaIds = [...new Set(merged.flatMap(record =>
        [record.image_id, record.wallpaper_id].filter(Boolean).map(value => String(value))
      ))];
      for (const imageId of mediaIds) {
        let media = await this.db.get<MediaRecord>('media', imageId);
        const path = `${uid}/${imageId}.jpg`;
        if (media && media.upload_state !== 'uploaded') {
          await this.request(`/storage/v1/object/${CONFIG.bucket}/${path}`, {
            method: 'POST', raw: media.blob, headers: { 'Content-Type': media.mime || 'image/jpeg', 'x-upsert': 'true' }
          });
          media = { ...media, upload_state: 'uploaded', storage_key: path };
          await this.db.put('media', media);
        } else if (!media) {
          try {
            const blob = await this.request<Blob>(`/storage/v1/object/authenticated/${CONFIG.bucket}/${path}`, { blob: true });
            media = { id: imageId, blob, thumbnail: blob, mime: blob.type || 'image/jpeg', upload_state: 'uploaded', storage_key: path };
            await this.db.put('media', media);
          } catch { }
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
          method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
        });
      }
      await this.db.importRecords(merged);
      this.lastError = '';
      await this.onData();
      this.status('✓ Сохранено');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Ошибка синхронизации';
      this.status('! Не удалось синхронизировать · данные сохранены локально');
    } finally { this.running = false; }
  }

  get error(): string { return this.lastError; }
}