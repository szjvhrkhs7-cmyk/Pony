import { openStore } from "./db.mjs";
import { mergeRecords, migrateLegacy, equal } from "./model.mjs";
// Existing project's public client configuration. RLS provides authorization.
const CONFIG = {
  url: "https://cbhcfvbdeuntrjbhbdpq.supabase.co",
  key: "sb_publishable_KEfQWQNIMDusafNtee9VMQ_9Tsfq89C",
  table: "player_notebook_state",
  bucket: "player-notebook-covers",
};
export class Cloud {
  constructor(guest, onSwitch, onStatus, onData) {
    this.guest = guest;
    this.db = guest;
    this.onSwitch = onSwitch;
    this.onStatus = onStatus;
    this.onData = onData;
    this.session = null;
    this.running = false;
    this.enabled = false;
  }
  async init() {
    this.session = (await this.guest.get("meta", "auth"))?.value || null;
    if (
      this.session &&
      (await this.guest.get("meta", "active-account"))?.value ===
        this.session.user.id
    ) {
      await this.useAccount(false);
    }
    window.addEventListener("online", () => this.schedule(0));
    window.addEventListener("offline", () => this.status());
    setInterval(() => this.schedule(0), 30000);
    this.status();
    this.schedule();
  }
  status(text) {
    this.onStatus(
      text ||
        (!navigator.onLine
          ? "Работаем без сети. Изменения сохраняются на устройстве."
          : this.enabled
            ? "✓ Сохранено"
            : "○ Только на устройстве"),
    );
  }
  async request(
    path,
    { method = "GET", body, raw, auth = true, headers = {}, blob = false } = {},
  ) {
    const h = { apikey: CONFIG.key, ...headers };
    if (auth && this.session)
      h.Authorization = `Bearer ${this.session.access_token}`;
    if (body !== undefined) h["Content-Type"] = "application/json";
    const response = await fetch(CONFIG.url + path, {
      method,
      headers: h,
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(
        detail.msg ||
          detail.message ||
          detail.error_description ||
          `Ошибка ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    if (blob) return response.blob();
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async remember(value) {
    this.session = {
      ...value,
      expires_at:
        value.expires_at ||
        Math.floor(Date.now() / 1000) + (value.expires_in || 3600),
    };
    await this.guest.put("meta", { id: "auth", value: this.session });
  }
  async login(email, password, register = false) {
    const value = await this.request(
      register ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password",
      { method: "POST", auth: false, body: { email, password } },
    );
    if (!value.access_token) return false;
    await this.remember(value);
    return true;
  }
  async fresh() {
    if (!this.session) throw new Error("Войдите в аккаунт");
    if (this.session.expires_at * 1000 < Date.now() + 60000) {
      // Keep account data available offline even if refreshing the token fails.
      await this.remember(
        await this.request("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          auth: false,
          body: { refresh_token: this.session.refresh_token },
        }),
      );
    }
  }
  async useAccount(importGuest) {
    if (this.running) throw new Error("Дождитесь завершения синхронизации.");
    const next = await openStore(this.session.user.id);
    if (importGuest) {
      await next.importRecords(
        await this.guest.all("records"),
        await this.guest.all("media"),
      );
      for (const draft of await this.guest.all("drafts"))
        if (!(await next.get("drafts", draft.id)))
          await next.put("drafts", draft);
    }
    this.db = next;
    this.enabled = true;
    await this.guest.put("meta", {
      id: "active-account",
      value: this.session.user.id,
    });
    await this.onSwitch(next);
    this.schedule(0);
  }
  async logout() {
    if (this.running) throw new Error("Дождитесь завершения синхронизации.");
    clearTimeout(this.timer);
    if (navigator.onLine)
      await this.request("/auth/v1/logout", { method: "POST" }).catch(() => {});
    await this.guest.delete("meta", "auth");
    await this.guest.delete("meta", "active-account");
    this.session = null;
    this.enabled = false;
    this.db = this.guest;
    await this.onSwitch(this.guest);
    this.status();
  }
  schedule(delay = 900) {
    clearTimeout(this.timer);
    if (this.enabled && navigator.onLine)
      this.timer = setTimeout(() => this.sync(), delay);
    else this.status();
  }
  async sync() {
    if (this.running || !this.enabled || !navigator.onLine) return;
    this.running = true;
    this.status("↻ Синхронизация…");
    const db = this.db;
    let sent = [];
    const run = async () => {
      await this.fresh();
      const uid = this.session.user.id;
      for (let attempt = 0; attempt < 3; attempt++) {
        sent = await db.all("queue");
        const local = await db.all("records");
        const base = (await db.get("meta", "sync-base"))?.records || [];
        const rows = await this.request(
          `/rest/v1/${CONFIG.table}?user_id=eq.${uid}&select=data,client_updated_at&limit=1`,
        );
        const row = rows?.[0];
        const remote = row ? migrateLegacy(row.data) : [];
        const merged = mergeRecords(local, remote, base);
        for (const r of merged.filter((r) => r.image_id)) {
          let m = await db.get("media", r.image_id);
          const path = `${uid}/${r.image_id}.jpg`;
          if (m && m.upload_state !== "uploaded") {
            await this.request(`/storage/v1/object/${CONFIG.bucket}/${path}`, {
              method: "POST",
              raw: m.blob,
              headers: {
                "Content-Type": m.mime || m.blob.type,
                "x-upsert": "true",
              },
            });
            await db.put("media", {
              ...m,
              upload_state: "uploaded",
              storage_key: path,
            });
          } else if (!m) {
            let mediaPath = path;
            try {
              let blob;
              try {
                blob = await this.request(
                  `/storage/v1/object/authenticated/${CONFIG.bucket}/${mediaPath}`,
                  { blob: true },
                );
              } catch (error) {
                if (!r.legacy_image_id || ![400, 404].includes(error.status))
                  throw error;
                mediaPath = `${uid}/${r.legacy_image_id}.jpg`;
                blob = await this.request(
                  `/storage/v1/object/authenticated/${CONFIG.bucket}/${mediaPath}`,
                  { blob: true },
                );
              }
              m = {
                id: r.image_id,
                blob,
                thumbnail: blob,
                mime: blob.type,
                upload_state: "uploaded",
                storage_key: mediaPath,
              };
              await db.put("media", m);
            } catch (error) {
              if (!(r.legacy_image_id && [400, 404].includes(error.status)))
                throw error;
            }
          }
        }
        if (!row || !equal(merged, remote)) {
          const stamp = Math.max(
            Date.now(),
            Number(row?.client_updated_at || 0) + 1,
          );
          const data = {
            ...(row?.data || {}),
            format: "seeker-notebook-3",
            records: merged,
          };
          const body = {
            user_id: uid,
            data,
            client_updated_at: stamp,
            device_id: db.device,
          };
          const result = row
            ? await this.request(
                `/rest/v1/${CONFIG.table}?user_id=eq.${uid}&client_updated_at=eq.${row.client_updated_at}`,
                {
                  method: "PATCH",
                  body,
                  headers: { Prefer: "return=representation" },
                },
              )
            : await this.request(
                `/rest/v1/${CONFIG.table}?on_conflict=user_id`,
                {
                  method: "POST",
                  body,
                  headers: {
                    Prefer:
                      "resolution=ignore-duplicates,return=representation",
                  },
                },
              );
          if (!result?.length) continue; // Another device changed the row: reread and merge.
        }
        await db.acceptSync(merged, sent, local);
        this.lastError = "";
        await this.onData();
        const remaining = await db.all("queue");
        this.status(
          remaining.length
            ? "↻ Есть изменения для синхронизации"
            : "✓ Сохранено",
        );
        if (remaining.length) this.schedule();
        return;
      }
      throw new Error(
        "Другое устройство изменяет журнал. Повторим синхронизацию.",
      );
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(
          `seeker-sync:${this.session.user.id}`,
          run,
        );
      else await run();
    } catch (error) {
      for (const q of sent) {
        const current = await db.get("queue", q.id);
        if (current)
          await db.put("queue", {
            ...current,
            retry_count: current.retry_count + 1,
          });
      }
      this.lastError = error.message;
      this.status(
        "! Не удалось синхронизировать. Данные сохранены на устройстве.",
      );
    } finally {
      this.running = false;
    }
  }
}
