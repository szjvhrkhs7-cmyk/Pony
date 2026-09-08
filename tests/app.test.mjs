import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import "fake-indexeddb/auto";
import { openStore } from "../notebook/db.mjs";
const html = await fs.readFile(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const { document, window } = parseHTML(html);
globalThis.document = document;
globalThis.window = window;
globalThis.location = { hash: "#parties" };
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: false },
  configurable: true,
});
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
const intervals = [];
const original = globalThis.setInterval;
globalThis.setInterval = (...args) => {
  const id = original(...args);
  id.unref();
  intervals.push(id);
  return id;
};
const dialog = document.querySelector("dialog");
dialog.showModal = () => (dialog.open = true);
dialog.close = () => (dialog.open = false);
window.scrollTo = () => {};
const db = await openStore();
await db.change("party", "party-1", {
  title: "Пепельные земли",
  description: "Full description",
  players_count: 5,
  status: "В процессе",
});
await db.change("section", "party-1:history", {
  parent_id: "party-1",
  kind: "history",
  title: "История",
  content:
    "<p>First paragraph</p><p><b>Second paragraph</b></p><ul><li>Bullet</li></ul>",
});
await db.change("character", "hero", {
  name: "Фангорн",
  race: "Эльф",
  class: "Воин",
  strength: 16,
  dexterity: 8,
  constitution: 10,
  intelligence: 13,
  wisdom: 12,
  charisma: 14,
});
const app = await import("../notebook/app.mjs");
await app.ready;
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
test("two navigation entries; cards end the parties screen", () => {
  assert.equal(document.querySelectorAll("nav a").length, 2);
  assert.equal(document.querySelectorAll(".party-card").length, 1);
  assert.match(document.querySelector("#page").textContent, /Мои партии/);
  assert.ok(!document.querySelector("[contenteditable]"));
  assert.ok(
    !/Последняя запись|Последние сессии/.test(
      document.querySelector("#page").textContent,
    ),
  );
});
test("party opens full reading content without editor", async () => {
  location.hash = "#party/party-1";
  window.dispatchEvent(new window.Event("hashchange"));
  await tick();
  assert.match(document.querySelector("#page").textContent, /First paragraph/);
  assert.match(document.querySelector("#page").textContent, /Second paragraph/);
  assert.equal(document.querySelectorAll(".reading b").length, 1);
  assert.equal(document.querySelectorAll(".reading li").length, 1);
  assert.equal(document.querySelectorAll("[contenteditable]").length, 0);
});
test("character shows six safe computed values in reading mode", async () => {
  location.hash = "#character";
  window.dispatchEvent(new window.Event("hashchange"));
  await tick();
  assert.equal(document.querySelectorAll(".ability").length, 6);
  assert.equal(document.querySelector(".ability em").textContent, "+3");
  assert.equal(document.querySelectorAll(".ability em")[1].textContent, "−1");
  assert.equal(document.querySelectorAll(".ability em")[2].textContent, "+0");
  assert.equal(
    document.querySelectorAll("input,textarea,[contenteditable]").length,
    0,
  );
});
test("only selected section becomes an inline editor; cancel restores reading", async () => {
  document.execCommand = () => true;
  document
    .querySelector('[data-action="edit-section"]')
    .dispatchEvent(new window.Event("click", { bubbles: true }));
  await tick();
  assert.equal(document.querySelectorAll("[contenteditable]").length, 1);
  assert.equal(document.querySelectorAll("[data-command]").length, 3);
  document
    .querySelector('[data-action="cancel-section"]')
    .dispatchEvent(new window.Event("click", { bubbles: true }));
  await tick();
  assert.equal(document.querySelectorAll("[contenteditable]").length, 0);
});
test("all shell files referenced by service worker exist", async () => {
  const source = await fs.readFile(
    new URL("../service-worker.js", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    await fs.readFile(
      new URL("../manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  for (const icon of manifest.icons)
    await fs.access(new URL("../" + icon.src, import.meta.url));
  for (const path of source.matchAll(
    /'\.\/([^']+\.(?:mjs|css|webmanifest|webp|svg|png|html))'/g,
  ))
    await fs.access(new URL("../" + path[1], import.meta.url));
  for (const w of [400, 500, 600, 700])
    await fs.access(
      new URL(`../assets/fonts/garamond-${w}.ttf`, import.meta.url),
    );
});

test('typing persists a draft and Save commits formatted paragraphs', async () => {
  document.execCommand = () => true;
  document.querySelector('[data-action="edit-section"]').dispatchEvent(new window.Event('click', {bubbles: true}));
  await tick();
  const editor = document.querySelector('[contenteditable]');
  editor.innerHTML = '<p>Первая строка</p><p><b>Вторая строка</b></p><ul><li>Меч</li></ul>';
  editor.dispatchEvent(new window.Event('input', {bubbles: true}));
  await tick();
  assert.match((await db.get('drafts', 'hero:history')).content, /Вторая строка/);
  document.querySelector('[data-action="save-section"]').dispatchEvent(new window.Event('click', {bubbles: true}));
  await tick();
  assert.equal(document.querySelectorAll('[contenteditable]').length, 0);
  assert.equal(await db.get('drafts', 'hero:history'), undefined);
  assert.match((await db.get('records', 'hero:history')).content, /<b>Вторая строка<\/b>/);
});
