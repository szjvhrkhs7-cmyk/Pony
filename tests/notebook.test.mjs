import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { parseHTML } from "linkedom";
import {
  record,
  modifier,
  signed,
  mergeRecords,
  migrateLegacy,
} from "../notebook/model.mjs";
import { openStore, migrateLocal } from "../notebook/db.mjs";
import { sanitize } from "../notebook/text.mjs";
import { Cloud } from "../notebook/cloud.mjs";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
const { document, window } = parseHTML(
  "<!doctype html><html><body></body></html>",
);
globalThis.document = document;
globalThis.window = window;
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
const fresh = () => openStore(crypto.randomUUID());
const base = () =>
  record("section", {
    id: "section",
    content: "original",
    updated_at: "2026-09-01T10:00:00Z",
    device_id: "PC",
  });

test("all D&D modifier values, including odd numbers and zero sign", () => {
  for (let n = 1; n <= 30; n++)
    assert.equal(modifier(n), Math.floor((n - 10) / 2));
  assert.equal(signed(modifier(10)), "+0");
  assert.equal(signed(modifier(8)), "−1");
  assert.equal(signed(modifier(16)), "+3");
});
test("disjoint edits merge without losing either field", () => {
  const b = base();
  const l = { ...b, title: "local title" },
    r = { ...b, content: "remote text" };
  const [out] = mergeRecords([l], [r], [b]);
  assert.equal(out.title, "local title");
  assert.equal(out.content, "remote text");
  assert.equal(out.conflicts.length, 0);
});
test("concurrent text edits preserve both complete versions", () => {
  const b = base(),
    l = {
      ...b,
      content: "local full text",
      updated_at: "2026-09-02",
      device_id: "iPhone",
    },
    r = { ...b, content: "remote full text", updated_at: "2026-09-03" };
  const [out] = mergeRecords([l], [r], [b]);
  assert.equal(out.conflicts[0].local, l.content);
  assert.equal(out.conflicts[0].remote, r.content);
  assert.equal(out.conflicts[0].local_device, "iPhone");
});
test("resolved conflict does not reappear on next synchronization", () => {
  const b = base();
  const [conflicted] = mergeRecords(
    [{ ...b, content: "left" }],
    [{ ...b, content: "right" }],
    [b],
  );
  const resolved = { ...conflicted, conflicts: [], content: "left" };
  const [out] = mergeRecords([resolved], [conflicted], [conflicted]);
  assert.deepEqual(out.conflicts, []);
  assert.equal(out.content, "left");
});
test("deleted records stay deleted, concurrent edits retain a choice", () => {
  const b = base(),
    deleted = { ...b, deleted_at: "2026-09-02" };
  assert.equal(mergeRecords([b], [deleted], [b])[0].deleted_at, "2026-09-02");
  const [out] = mergeRecords(
    [{ ...b, content: "unsynced writing" }],
    [deleted],
    [b],
  );
  assert.equal(out.deleted_at, null);
  assert.ok(out.conflicts.some((c) => c.field === "deleted_at"));
  assert.equal(out.content, "unsynced writing");
});
test("legacy migration retains sessions, notes, metadata and stable IDs", () => {
  const old = {
    campaigns: [
      {
        id: "p",
        name: "Campaign",
        party: "Five heroes",
        goal: "Tower",
        journal: "<p>History</p>",
        quickNotes: "a\nb",
        sessions: [
          {
            id: "s",
            title: "Day 1",
            notes: "<p>Full text</p>",
            date: "2026-09-01",
            teaser: "Intro",
            location: "Forest",
          },
        ],
      },
    ],
  };
  const a = migrateLegacy(old),
    b = migrateLegacy(old);
  assert.deepEqual(a, b);
  assert.equal(a.find((x) => x.id === "s").legacy_image_id, "s");
  assert.equal(a.find((x) => x.id === "p:notes").content, "a\nb");
  assert.equal(a.find((x) => x.id === "p").party, "Five heroes");
});
test("IndexedDB commits record, image and queue together; reopening keeps data", async () => {
  const db = await fresh();
  const r = await db.change(
    "party",
    "p",
    { title: "Party" },
    {
      id: "m",
      blob: new Blob(["image"]),
      thumbnail: new Blob(["thumb"]),
      upload_state: "pending",
    },
  );
  assert.equal(r.version, 1);
  assert.equal((await db.all("queue")).length, 2);
  assert.equal((await db.get("media", "m")).blob.size, 5);
  await db.change("party", "p", { description: "text" });
  assert.equal((await db.get("records", "p")).title, "Party");
  assert.equal((await db.get("records", "p")).version, 2);
  const name = db.db.name;
  db.db.close();
  const reopened = await openStore(name.split(":").slice(1).join(":"));
  assert.equal((await reopened.get("records", "p")).description, "text");
  reopened.db.close();
});
test("draft survives reopening; explicit save atomically removes it", async () => {
  const db = await fresh();
  await db.put("drafts", {
    id: "s",
    content: "draft",
    updated_at: new Date().toISOString(),
  });
  assert.equal((await db.get("drafts", "s")).content, "draft");
  await db.change("section", "s", { content: "draft" }, null, "s");
  assert.equal(await db.get("drafts", "s"), undefined);
  assert.equal((await db.get("records", "s")).content, "draft");
  db.db.close();
});
test("edits made while sync is in flight survive acknowledgement", async () => {
  const db = await fresh();
  await db.change("section", "s", { content: "first" });
  const sent = await db.all("queue"),
    snapshot = await db.all("records");
  await db.change("section", "s", { content: "new text while waiting" });
  await db.acceptSync(snapshot, sent, snapshot);
  assert.equal(
    (await db.get("records", "s")).content,
    "new text while waiting",
  );
  assert.equal((await db.all("queue")).length, 1);
  db.db.close();
});
test("two concurrent local edits preserve independent fields", async () => {
  const db = await fresh();
  await db.change("party", "p", { title: "start" });
  await Promise.all([
    db.change("party", "p", { description: "one" }),
    db.change("party", "p", { goal: "two" }),
  ]);
  const p = await db.get("records", "p");
  assert.equal(p.description, "one");
  assert.equal(p.goal, "two");
  db.db.close();
});
test("account stores are isolated", async () => {
  const a = await fresh(),
    b = await fresh();
  await a.change("party", "private", { title: "Private" });
  assert.equal((await b.all("records")).length, 0);
  a.db.close();
  b.db.close();
});
test("HTML sanitation removes active content, keeps paragraphs, bold and bullets", () => {
  const safe = sanitize(
    '<p onclick="evil()">Hello <b>bold</b></p><script>evil()</script><ul><li>one</li></ul><p><br></p><p><br></p><div>next</div><img src=x onerror="evil()">',
  );
  assert.ok(!/script|onclick|onerror|<img|evil/.test(safe));
  assert.match(safe, /<b>bold<\/b>/);
  assert.match(safe, /<ul><li>one<\/li><\/ul>/);
  assert.match(safe, /<p>next<\/p>/);
  assert.ok(!safe.includes("<p><br>"));
});
test("local migration is idempotent and preserves the legacy source", async () => {
  const db = await fresh(),
    raw = JSON.stringify({ campaigns: [{ id: "old", name: "Old" }] });
  localStorage.setItem("seeker-chronicles:v2", raw);
  await migrateLocal(db);
  const count = (await db.all("records")).length;
  await migrateLocal(db);
  assert.equal((await db.all("records")).length, count);
  assert.equal(localStorage.getItem("seeker-chronicles:v2"), raw);
  assert.equal(
    (await db.get("meta", "legacy-backup")).data.campaigns[0].name,
    "Old",
  );
  localStorage.removeItem("seeker-chronicles:v2");
  db.db.close();
});
test("network failure retains queue and increments retries", async () => {
  const db = await fresh();
  await db.change("party", "p", { title: "offline" });
  const status = [];
  const cloud = new Cloud(
    db,
    () => {},
    (x) => status.push(x),
    () => {},
  );
  cloud.enabled = true;
  cloud.session = { user: { id: "user" }, expires_at: 9999999999 };
  cloud.request = async () => {
    throw new Error("network down");
  };
  await cloud.sync();
  assert.equal((await db.all("queue")).length, 1);
  assert.equal((await db.all("queue"))[0].retry_count, 1);
  assert.equal((await db.get("records", "p")).title, "offline");
  assert.match(status.at(-1), /Данные сохранены/);
  db.db.close();
});
test("cloud CAS retries on race and never clears unsent work", async () => {
  const db = await fresh();
  await db.change("party", "p", { title: "local" });
  let patches = 0,
    reads = 0;
  const cloud = new Cloud(
    db,
    () => {},
    () => {},
    () => {},
  );
  cloud.enabled = true;
  cloud.session = { user: { id: "user" }, expires_at: 9999999999 };
  cloud.request = async (path, options) => {
    if (!options) {
      reads++;
      return [
        {
          data: { format: "seeker-notebook-3", records: [] },
          client_updated_at: reads,
        },
      ];
    }
    patches++;
    return patches === 1 ? [] : [options.body];
  };
  await cloud.sync();
  assert.equal(patches, 2);
  assert.equal(reads, 2);
  assert.equal((await db.all("queue")).length, 0);
  assert.equal((await db.get("records", "p")).title, "local");
  db.db.close();
});
