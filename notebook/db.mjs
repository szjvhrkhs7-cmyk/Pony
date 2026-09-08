import { record, mergeRecords, migrateLegacy } from "./model.mjs";
const STORES = ["records", "drafts", "media", "queue", "meta"];
export function openStore(scope = "guest") {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`seeker-notebook-3:${scope}`, 1);
    req.onupgradeneeded = () => {
      for (const name of STORES)
        req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(new NotebookDB(req.result));
    req.onblocked = () =>
      reject(new Error("Закройте другую вкладку журнала и повторите."));
  });
}
export class NotebookDB {
  constructor(db) {
    this.db = db;
    this.device =
      localStorage.getItem("seeker-chronicles:device-id") ||
      crypto.randomUUID();
    localStorage.setItem("seeker-chronicles:device-id", this.device);
  }
  get(store, id) {
    return this.read(store, "get", id);
  }
  all(store) {
    return this.read(store, "getAll");
  }
  read(store, method, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store);
      const q = tx.objectStore(store)[method](id);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  }
  transaction(stores, action) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, "readwrite");
      try {
        action(tx);
      } catch (e) {
        tx.abort();
        reject(e);
        return;
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Сохранение прервано"));
    });
  }
  put(store, value) {
    return this.transaction([store], (tx) => tx.objectStore(store).put(value));
  }
  delete(store, id) {
    return this.transaction([store], (tx) => tx.objectStore(store).delete(id));
  }
  async change(type, id, fields, media = null, draftId = null) {
    // Read and write in the same transaction: two tabs cannot lose each other's fields.
    let saved;
    await this.transaction(["records", "queue", "media", "drafts"], (tx) => {
      const store = tx.objectStore("records");
      const q = store.get(id);
      q.onsuccess = () => {
        const old = q.result;
        saved = record(type, {
          ...old,
          ...fields,
          id,
          version: (old?.version || 0) + 1,
          updated_at: new Date().toISOString(),
          device_id: this.device,
        });
        store.put(saved);
        tx.objectStore("queue").put({
          id: crypto.randomUUID(),
          entity_type: type,
          entity_id: id,
          operation: fields.deleted_at ? "delete" : old ? "update" : "create",
          payload: saved,
          created_at: saved.updated_at,
          retry_count: 0,
        });
        if (media) {
          tx.objectStore("media").put(media);
          tx.objectStore("queue").put({
            id: crypto.randomUUID(),
            entity_type: "media",
            entity_id: media.id,
            operation: "upload",
            payload: { id: media.id },
            created_at: saved.updated_at,
            retry_count: 0,
          });
        }
        if (draftId) tx.objectStore("drafts").delete(draftId);
      };
    });
    return saved;
  }
  async importRecords(records, media = []) {
    const merged = mergeRecords(await this.all("records"), records);
    await this.transaction(["records", "queue", "media"], (tx) => {
      for (const r of merged) {
        tx.objectStore("records").put(r);
        tx.objectStore("queue").put({
          id: crypto.randomUUID(),
          entity_type: r.type,
          entity_id: r.id,
          operation: r.deleted_at ? "delete" : "update",
          payload: r,
          created_at: new Date().toISOString(),
          retry_count: 0,
        });
      }
      for (const m of media) {
        tx.objectStore("media").put(m);
        tx.objectStore("queue").put({
          id: crypto.randomUUID(),
          entity_type: "media",
          entity_id: m.id,
          operation: "upload",
          payload: { id: m.id },
          created_at: new Date().toISOString(),
          retry_count: 0,
        });
      }
    });
  }
  async acceptSync(records, sentQueue, base) {
    // Preserve edits that happened while the network request was in flight.
    await this.transaction(["records", "queue", "meta"], (tx) => {
      const req = tx.objectStore("records").getAll();
      req.onsuccess = () => {
        for (const r of mergeRecords(req.result, records, base))
          tx.objectStore("records").put(r);
      };
      for (const q of sentQueue) tx.objectStore("queue").delete(q.id);
      tx.objectStore("meta").put({ id: "sync-base", records });
    });
  }
}
export async function migrateLocal(db) {
  if (await db.get("meta", "legacy-imported")) return;
  const raw = localStorage.getItem("seeker-chronicles:v2");
  if (raw) {
    const data = JSON.parse(raw),
      records = migrateLegacy(data),
      media = [];
    const old = await new Promise((resolve, reject) => {
      const q = indexedDB.open("seeker-chronicles-media-v2", 1);
      q.onupgradeneeded = () => {
        q.result.createObjectStore("session-covers");
      };
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    for (const r of records.filter((r) => r.legacy_image_id)) {
      const blob = await new Promise((resolve, reject) => {
        const q = old
          .transaction("session-covers")
          .objectStore("session-covers")
          .get(r.legacy_image_id);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      });
      if (blob)
        media.push({
          id: r.image_id,
          blob,
          thumbnail: blob,
          mime: blob.type,
          upload_state: "pending",
        });
    }
    old.close();
    await db.importRecords(records, media);
    await db.put("meta", { id: "legacy-backup", data });
    // Retain the old source until the new transaction is committed and backed up.
  }
  await db.put("meta", { id: "legacy-imported", at: new Date().toISOString() });
}
