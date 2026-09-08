import { openStore, migrateLocal } from "./db.mjs";
import {
  ABILITIES,
  modifier,
  signed,
  record,
  mergeRecords,
  migrateLegacy,
  equal,
} from "./model.mjs";
import { Cloud } from "./cloud.mjs";
import { escape as esc, sanitize, plain } from "./text.mjs";
const page = document.querySelector("#page"),
  dialog = document.querySelector("#dialog");
let db,
  cloud,
  records = [],
  drafts = [],
  urls = [],
  renderVersion = 0,
  sort = "new",
  selectedCharacter = null;
const editors = new Map();
const $ = (q, root = document) => root.querySelector(q);
const active = (type, parent) =>
  records.filter(
    (r) =>
      r.type === type && !r.deleted_at && (!parent || r.parent_id === parent),
  );
const byId = (id) => records.find((r) => r.id === id);
const title = (text) =>
  `<header class="page-heading"><h1>${esc(text)}</h1></header>`;
const button = (text, action, id = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
const date = (value) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "";
const score = (c, key) =>
  Math.max(1, Math.min(30, Math.trunc(Number(c[key])) || 10));
const plural = (value, forms) => {
  const n = Math.max(0, Math.trunc(Number(value)) || 0);
  return `${n} ${forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2]}`;
};
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 5000);
}
function fail(error) {
  toast(
    error?.name === "QuotaExceededError"
      ? "Память устройства заполнена. Скачайте копию и освободите место."
      : error.message || "Не удалось сохранить. Текст остаётся в редакторе.",
  );
}
function cover(r, portrait = false) {
  return `<div class="${portrait ? "portrait frame" : "cover-wrap"}" data-media="${esc(r.image_id || "")}"><div class="cover-placeholder"><img src="./assets/d20.svg" alt=""></div>${r.type === "party" ? `<span class="ribbon ${r.status === "На паузе" ? "paused" : ""}">${esc(r.status || "В процессе")}</span>` : ""}</div>`;
}
async function hydrateMedia(version) {
  for (const node of page.querySelectorAll("[data-media]")) {
    const id = node.dataset.media;
    if (!id) continue;
    const media = await db.get("media", id);
    if (version !== renderVersion) return;
    if (!media) continue;
    const url = URL.createObjectURL(media.blob);
    urls.push(url);
    const img = document.createElement("img");
    img.className = "cover";
    img.src = url;
    img.alt = node.classList.contains("portrait")
      ? "Портрет персонажа"
      : "Обложка";
    if (node.classList.contains("portrait")) {
      img.style.height = "100%";
      img.style.aspectRatio = "4/5";
    }
    node.querySelector(".cover-placeholder")?.replaceWith(img);
  }
}
function newParty(first = false) {
  return `<article class="new-party frame"><div class="summon" aria-hidden="true">+</div><h2>${first ? "Первая партия" : "Новая партия"}</h2><p>Создайте новую историю.<br>Соберите отряд и отправляйтесь в приключение.</p>${button(first ? "Создать первую партию" : "Создать партию", "new-party", "", "primary")}</article>`;
}
function partiesPage() {
  const parties = active("party").sort((a, b) =>
    sort === "name"
      ? String(a.title).localeCompare(String(b.title), "ru")
      : b.created_at.localeCompare(a.created_at),
  );
  return `${title("Мои партии")}<p class="intro">Миры, герои и истории, которые мы создаём вместе.</p><div class="page-tools"><label>Порядок <select id="sort"><option value="new" ${sort === "new" ? "selected" : ""}>Сначала новые</option><option value="name" ${sort === "name" ? "selected" : ""}>По названию</option></select></label></div><div class="party-grid">${parties.map((p) => `<article class="party-card frame">${cover(p)}<div class="card-copy"><h2>${esc(p.title)}</h2><div class="meta"><span>♟ ${p.players_count ? plural(p.players_count, ["игрок", "игрока", "игроков"]) : "Отряд не указан"}</span><span>⚔ ${plural(active("session", p.id).length, ["сессия", "сессии", "сессий"])}</span></div><p>${esc(p.description)}</p>${button("Открыть журнал →", "open-party", p.id, "open")}</div></article>`).join("")}${newParty(!parties.length)}</div>`;
}
const sectionKinds = {
  party: [
    ["history", "История"],
    ["events", "Важные события"],
    ["notes", "Заметки"],
    ["companions", "Персонажи партии"],
  ],
  character: [
    ["history", "История"],
    ["events", "Важные события"],
    ["equipment", "Снаряжение"],
  ],
};
function sections(parent) {
  return sectionKinds[parent.type]
    .map(([kind, label]) =>
      sectionView(
        records.find((r) => r.id === `${parent.id}:${kind}`) ||
          record("section", {
            id: `${parent.id}:${kind}`,
            parent_id: parent.id,
            kind,
            title: label,
            content: "",
          }),
      ),
    )
    .join("");
}
function conflictView(r) {
  if (!r.conflicts?.length) return "";
  return r.conflicts
    .map(
      (c, index) =>
        `<div class="conflict"><p><strong>Обнаружены две версии ${c.field === "content" ? "текста" : "записи"}.</strong> Обе сохранены. Выберите нужную.</p><div class="conflict-versions">${["local", "remote"].map((side, i) => `<div><p class="muted">${i ? "Другое устройство" : "Это устройство"} · ${esc(c[`${side}_device`] || "")} ${esc(date(c[`${side}_date`]))}</p><div class="reading">${c.field === "content" ? sanitize(c[side] || "") : plain(c[side] === null ? "Не удалено" : String(c[side]))}</div>${button("Выбрать эту версию", "resolve", `${r.id}|${index}|${side}`)}</div>`).join("")}</div></div>`,
    )
    .join("");
}
function draftNotice(r) {
  const d = drafts.find((d) => d.id === r.id);
  if (!d || d.content === r.content) return "";
  return `<div class="draft-notice"><p>Найден несохранённый черновик.</p>${button("Восстановить", "restore-draft", r.id)}${button("Удалить", "delete-draft", r.id, "quiet")}</div>`;
}
function sectionView(r) {
  return `<section class="section" data-section="${esc(r.id)}"><header class="section-head"><h2>${esc(r.title)}</h2>${button("✎ Править", "edit-section", r.id, "quiet")}</header>${conflictView(r)}${draftNotice(r)}<div class="section-body"><div class="reading">${r.legacy_plain ? plain(r.content) : sanitize(r.content || "")}</div></div></section>`;
}
function partyPage(p) {
  return `<a class="back" href="#parties">← Мои партии</a><div class="detail-cover">${cover(p)}</div><div class="detail-heading"><h1>${esc(p.title)}</h1>${button("✎ Править", "edit-party", p.id, "quiet")}</div><div class="meta"><span>♟ ${plural(p.players_count || 0, ["игрок", "игрока", "игроков"])}</span><span>⚔ ${plural(active("session", p.id).length, ["сессия", "сессии", "сессий"])}</span>${p.start_date ? `<span>Начало: ${esc(date(p.start_date))}</span>` : ""}</div><p class="detail-description">${esc(p.description)}</p>${p.party ? `<p class="detail-description"><strong>Отряд:</strong> ${esc(p.party)}</p>` : ""}${p.goal ? `<p class="detail-description"><strong>Текущая цель:</strong> ${esc(p.goal)}</p>` : ""}${conflictView(p)}${sections(p)}<section class="section"><header class="section-head"><h2>Сессии</h2>${button("＋ Добавить", "new-session", p.id, "quiet")}</header>${
    active("session", p.id)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(
        (s) =>
          `<article class="session-entry"><header class="session-heading"><h3>${esc(s.title)}</h3>${button("✎ Сведения", "edit-session", s.id, "quiet")}</header><div class="meta">${esc(date(s.date))}${s.location ? " · " + esc(s.location) : ""}</div>${s.image_id ? cover(s) : ""}<p class="detail-description">${esc(s.description)}</p>${sectionView({ ...s, title: "Запись сессии" })}</article>`,
      )
      .join("") || '<p class="muted">Здесь будут записи ваших встреч.</p>'
  }</section><div class="delete-note">${button("Удалить партию", "delete", p.id, "quiet")}</div>`;
}
function characterPage() {
  const characters = active("character");
  const c = characters.find((c) => c.id === selectedCharacter) || characters[0];
  if (!c)
    return `${title("Мой персонаж")}<div class="empty-intro"><p class="intro">У каждой истории есть свой герой.</p><article class="new-party frame"><div class="summon" aria-hidden="true">+</div><h2>Новый герой</h2><p>Имя, история и всё, что вы берёте с собой в дорогу.</p>${button("Создать персонажа", "new-character", "", "primary")}</article></div>`;
  return `${title("Мой персонаж")}${characters.length > 1 ? `<div class="character-picker">${characters.map((x) => `<button type="button" data-action="select-character" data-id="${esc(x.id)}" aria-pressed="${x.id === c.id}">${esc(x.name)}</button>`).join("")}</div>` : ""}<div class="character-head">${cover(c, true)}<div><h2>${esc(c.name)}</h2><p>${[c.race, c.class].filter(Boolean).map(esc).join(" · ")}</p><p class="muted">${esc(c.background)}</p>${button("✎ Править", "edit-character", c.id, "quiet")}</div></div>${conflictView(c)}<div class="ability-grid">${ABILITIES.map(([key, label, name]) => `<div class="ability frame" aria-label="${name}: ${score(c, key)}, модификатор ${signed(modifier(score(c, key)))}"><span>${label}</span><strong>${score(c, key)}</strong><em>${signed(modifier(score(c, key)))}</em></div>`).join("")}</div>${sections(c)}<div class="delete-note">${button("Удалить персонажа", "delete", c.id, "quiet")}</div>`;
}
async function render() {
  const version = ++renderVersion;
  records = await db.all("records");
  drafts = await db.all("drafts");
  if (version !== renderVersion) return;
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  let hash = decodeURIComponent(location.hash.slice(1) || "parties");
  const isCharacter = hash === "character";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === (isCharacter ? "character" : "parties"))
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const p = hash.startsWith("party/") ? byId(hash.slice(6)) : null;
  page.innerHTML = isCharacter
    ? characterPage()
    : p && !p.deleted_at
      ? partyPage(p)
      : partiesPage();
  await hydrateMedia(version);
}
function getSection(id) {
  const stored = byId(id);
  if (stored) return stored;
  const split = id.lastIndexOf(":");
  const parent = byId(id.slice(0, split)),
    kind = id.slice(split + 1);
  const label = sectionKinds[parent?.type]?.find((x) => x[0] === kind)?.[1];
  if (!label) throw new Error("Раздел не найден");
  return record("section", {
    id,
    parent_id: parent.id,
    kind,
    title: label,
    content: "",
  });
}
async function beginEdit(id, restore = false) {
  if (editors.has(id)) return;
  const r = getSection(id);
  const node = [...page.querySelectorAll("[data-section]")].find(
    (n) => n.dataset.section === id,
  );
  const body = node.querySelector(".section-body");
  const draft = await db.get("drafts", id);
  if (draft && !restore && draft.content !== r.content) {
    node.querySelector(".draft-notice")?.scrollIntoView({ block: "center" });
    return;
  }
  body.innerHTML = `<div class="toolbar" role="toolbar" aria-label="Форматирование"><button type="button" data-command="bold" aria-label="Жирный"><b>B</b></button><button type="button" data-command="insertUnorderedList" aria-label="Маркированный список">•</button><button type="button" data-command="undo" aria-label="Отменить последнее действие">↶</button></div><div class="editor reading" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(r.title)}" spellcheck="true"></div><p class="muted" data-draft-status></p><div class="editor-actions">${button("Отмена", "cancel-section", id)}${button("Сохранить", "save-section", id, "primary")}</div>`;
  const editor = $(".editor", body);
  editor.innerHTML = restore
    ? sanitize(draft.content)
    : r.legacy_plain
      ? plain(r.content)
      : sanitize(r.content);
  if (!editor.innerHTML) editor.innerHTML = "<p><br></p>";
  const edit = {
    node,
    editor,
    record: structuredClone(restore && draft.base ? draft.base : r),
    pending: Promise.resolve(),
    discarded: false,
  };
  editors.set(id, edit);
  node.querySelector('[data-action="edit-section"]').hidden = true;
  node.querySelector(".draft-notice")?.remove();
  const saveDraft = () => {
    const content = sanitize(editor.innerHTML);
    edit.pending = edit.pending
      .catch(() => {})
      .then(() =>
        db.put("drafts", {
          id,
          content,
          base: edit.record,
          updated_at: new Date().toISOString(),
        }),
      )
      .catch((e) => {
        fail(e);
        throw e;
      });
    edit.pending.catch(() => {});
    clearTimeout(edit.timer);
    edit.timer = setTimeout(() => {
      $("[data-draft-status]", body).textContent =
        "Черновик сохранён на устройстве";
    }, 700);
  };
  editor.addEventListener("input", saveDraft);
  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand(
      "insertHTML",
      false,
      plain(e.clipboardData.getData("text/plain")),
    );
    saveDraft();
  });
  editor.addEventListener("drop", (e) => e.preventDefault());
  editor.addEventListener("keydown", (e) => {
    if (
      (e.metaKey || e.ctrlKey) &&
      ["i", "u", "k"].includes(e.key.toLowerCase())
    )
      e.preventDefault();
  });
  $(".toolbar", body).addEventListener("mousedown", (e) => e.preventDefault());
  $(".toolbar", body).addEventListener("click", (e) => {
    const b = e.target.closest("[data-command]");
    if (!b) return;
    editor.focus();
    document.execCommand(b.dataset.command, false);
    saveDraft();
  });
  editor.focus();
  document.execCommand("defaultParagraphSeparator", false, "p");
}
async function finishEdit(id, save) {
  const edit = editors.get(id);
  if (!edit) return;
  await edit.pending;
  clearTimeout(edit.timer);
  if (save) {
    const current = (await db.get("records", id)) || edit.record;
    const value = {
      ...edit.record,
      content: sanitize(edit.editor.innerHTML),
      legacy_plain: false,
      updated_at: new Date().toISOString(),
      device_id: db.device,
    };
    const merged = mergeRecords([value], [current], [edit.record])[0];
    await db.change(
      current.type,
      id,
      {
        content: merged.content,
        legacy_plain: false,
        conflicts: merged.conflicts || [],
      },
      null,
      id,
    );
    cloud.schedule();
  } else await db.delete("drafts", id);
  editors.delete(id);
  await refreshSection(id);
  toast(save ? "Сохранено" : "Изменения отменены");
}
async function refreshSection(id) {
  records = await db.all("records");
  drafts = await db.all("drafts");
  const node = [...page.querySelectorAll("[data-section]")].find(
    (n) => n.dataset.section === id,
  );
  if (node) node.outerHTML = sectionView(getSection(id));
}
async function leaveEditors() {
  for (const edit of editors.values()) {
    await edit.pending;
    clearTimeout(edit.timer);
  }
  editors.clear();
}
function showDialog(label, html) {
  dialog.innerHTML = `<header class="dialog-header"><h2 id="dialog-title">${esc(label)}</h2>${button("×", "close-dialog", "", "quiet")}</header>${html}`;
  if (!dialog.open) dialog.showModal();
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field ${type === "textarea" ? "full" : ""}">${esc(label)}${type === "textarea" ? `<textarea name="${name}" ${extra}>${esc(value)}</textarea>` : `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</label>`;
}
async function imageFile(file) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type))
    throw new Error("Выберите JPEG, PNG, WebP или GIF.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Размер изображения должен быть меньше 20 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const convert = async (max) => {
      const scale = Math.min(
        1,
        max / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Не удалось обработать изображение")),
          "image/jpeg",
          0.86,
        ),
      );
    };
    return {
      id: crypto.randomUUID(),
      blob: await convert(1600),
      thumbnail: await convert(320),
      mime: "image/jpeg",
      width: img.naturalWidth,
      height: img.naturalHeight,
      upload_state: "pending",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
function editForm(type, id, parent) {
  const r = id ? byId(id) : {};
  const fields =
    type === "party"
      ? `${field("Название", "title", r.title, "text", 'required maxlength="160"')}${field("Количество игроков", "players_count", r.players_count || "", "number", 'min="0" max="100" step="1"')}${field("Описание", "description", r.description, "textarea")}${field("Дата начала", "start_date", r.start_date, "date")}<label class="field">Статус<select name="status">${["В процессе", "На паузе", "Завершена"].map((s) => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>${field("Отряд", "party", r.party, "textarea")}${field("Текущая цель", "goal", r.goal, "textarea")}`
      : type === "character"
        ? `${field("Имя", "name", r.name, "text", 'required maxlength="160"')}${field("Раса", "race", r.race)}${field("Класс", "class", r.class)}${field("Предыстория", "background", r.background)}<div class="form-abilities">${ABILITIES.map(([key, label]) => field(label, key, r[key] ?? 10, "number", 'min="1" max="30" step="1" required')).join("")}</div>`
        : `${field("Название сессии", "title", r.title, "text", 'required maxlength="160"')}${field("Дата", "date", r.date, "date")}${field("Место", "location", r.location)}${field("Описание", "description", r.description, "textarea")}`;
  showDialog(
    id
      ? "Править сведения"
      : type === "party"
        ? "Новая партия"
        : type === "character"
          ? "Создать персонажа"
          : "Новая сессия",
    `<form class="form-grid" id="record-form">${fields}<label class="field full">${type === "character" ? "Портрет" : "Обложка"}<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif"></label>${r.image_id ? '<label class="field full"><span><input style="width:auto;min-height:0" type="checkbox" name="remove_image"> Удалить изображение</span></label>' : ""}<p class="form-error" role="alert"></p><div class="form-actions">${id && type === "session" ? button("Удалить", "delete", id, "danger") : ""}${button("Отмена", "close-dialog")}<button type="submit" class="primary">Сохранить</button></div></form>`,
  );
  $("#record-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      submit = $("[type=submit]", form);
    submit.disabled = true;
    try {
      const data = new FormData(form),
        values = {};
      for (const [key, value] of data)
        if (!["image", "remove_image"].includes(key))
          values[key] = typeof value === "string" ? value.trim() : value;
      if (type === "party")
        values.players_count = Number(values.players_count) || 0;
      if (type === "character")
        for (const [key] of ABILITIES) values[key] = Number(values[key]);
      if (parent) values.parent_id = parent;
      let media = null;
      if (data.get("image")?.size) media = await imageFile(data.get("image"));
      if (media) values.image_id = media.id;
      else if (data.has("remove_image")) values.image_id = null;
      const rid = id || crypto.randomUUID();
      await db.change(type, rid, values, media);
      dialog.close();
      await leaveEditors();
      if (type === "party") location.hash = `party/${rid}`;
      if (type === "character") {
        selectedCharacter = rid;
        location.hash = "character";
      }
      await render();
      cloud.schedule();
      navigator.storage?.persist?.().catch(() => {});
    } catch (error) {
      $(".form-error", form).textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}
async function cloudDialog() {
  const signedIn = cloud.session;
  showDialog(
    "Облачная синхронизация",
    `<div class="cloud-form"><p>${signedIn ? `Аккаунт: ${esc(signedIn.user.email)}` : "Журнал работает без аккаунта. Войдите, чтобы читать и продолжать записи на других устройствах."}</p>${!signedIn ? `<form id="auth-form" class="cloud-form">${field("Email", "email", "", "email", 'required autocomplete="email"')}${field("Пароль", "password", "", "password", 'required minlength="6" autocomplete="current-password"')}<div class="form-actions"><button type="submit" name="mode" value="register">Создать аккаунт</button><button type="submit" name="mode" value="login" class="primary">Войти</button></div></form>` : !cloud.enabled ? `<p>Синхронизировать данные этого устройства с аккаунтом? Локальные и облачные записи будут объединены.</p>${button("Синхронизировать данные устройства", "enable-sync", "", "primary")}${button("Открыть только записи аккаунта", "account-only")}` : `<p>Изменения сначала сохраняются на устройстве. Облако получает их при подключении к сети.</p>${button("Синхронизировать сейчас", "sync-now")}`}${signedIn ? button("Выйти из аккаунта", "logout", "", "quiet") : ""}<p id="cloud-message" class="form-error" role="status">${esc(cloud.lastError || "")}</p></div><div class="backup-tools">${button("Скачать резервную копию", "export")}${button("Импортировать копию", "import")}<input id="import-file" type="file" accept="application/json" hidden></div>`,
  );
  $("#auth-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      values = new FormData(form);
    for (const b of form.querySelectorAll("button")) b.disabled = true;
    try {
      const ok = await cloud.login(
        values.get("email"),
        values.get("password"),
        e.submitter.value === "register",
      );
      if (ok) await cloudDialog();
      else
        $("#cloud-message").textContent =
          "Подтвердите email по ссылке в письме, затем войдите.";
    } catch (error) {
      $("#cloud-message").textContent = error.message.includes(
        "Invalid login credentials",
      )
        ? "Неверный email или пароль."
        : error.message;
    } finally {
      for (const b of form.querySelectorAll("button")) b.disabled = false;
    }
  });
  $("#import-file").addEventListener("change", async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      await importBackup(file);
      dialog.close();
      await render();
      toast("Копия объединена с журналом");
    } catch (error) {
      fail(error);
    }
  });
}
async function exportBackup() {
  await leaveEditors();
  const media = await db.all("media");
  const encoded = [];
  for (const m of media) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(m.blob);
    });
    encoded.push({ ...m, blob: undefined, thumbnail: undefined, data });
  }
  const backup = {
    format: "seeker-notebook-3",
    records: await db.all("records"),
    drafts: await db.all("drafts"),
    media: encoded,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `chronicles-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await render();
}
async function importBackup(file) {
  if (file.size > 150 * 1024 * 1024)
    throw new Error("Файл слишком большой. Максимум 150 МБ.");
  const parsed = JSON.parse(await file.text());
  const data = migrateLegacy(parsed);
  if (data.length > 20000) throw new Error("Слишком много записей");
  for (const r of data) {
    if (
      typeof r.id !== "string" ||
      !["party", "section", "character", "session"].includes(r.type)
    )
      throw new Error("Некорректная запись в копии");
    if (r.content) r.content = sanitize(r.content);
  }
  const media = [];
  const sources = parsed.media || [];
  for (const c of parsed.campaigns || [])
    for (const s of c.sessions || [])
      if (s.coverData)
        sources.push({ id: `legacy-${s.id}`, data: s.coverData });
  for (const m of sources) {
    if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(m.data || ""))
      throw new Error("Некорректное изображение");
    const blob = await (await fetch(m.data)).blob();
    media.push({
      ...m,
      data: undefined,
      blob,
      thumbnail: blob,
      upload_state: "pending",
    });
  }
  await db.importRecords(data, media);
  for (const d of parsed.drafts || [])
    if (
      typeof d.id === "string" &&
      typeof d.content === "string" &&
      !(await db.get("drafts", d.id))
    )
      await db.put("drafts", { ...d, content: sanitize(d.content) });
  cloud.schedule();
}
async function action(name, id) {
  switch (name) {
    case "new-party":
      return editForm("party");
    case "edit-party":
      return editForm("party", id);
    case "open-party":
      location.hash = `party/${id}`;
      return;
    case "new-character":
      return editForm("character");
    case "edit-character":
      return editForm("character", id);
    case "select-character":
      selectedCharacter = id;
      return render();
    case "new-session":
      return editForm("session", null, id);
    case "edit-session":
      return editForm("session", id);
    case "edit-section":
      return beginEdit(id);
    case "restore-draft":
      return beginEdit(id, true);
    case "delete-draft":
      await db.delete("drafts", id);
      return refreshSection(id);
    case "save-section":
      return finishEdit(id, true);
    case "cancel-section":
      return finishEdit(id, false);
    case "close-dialog":
      dialog.close();
      return;
    case "delete": {
      const r = byId(id);
      showDialog(
        "Удалить запись?",
        `<p>«${esc(r.title || r.name)}» будет удалена из журнала. Копия сохранится для синхронизации.</p><div class="form-actions">${button("Отмена", "close-dialog")}${button("Удалить", "confirm-delete", id, "primary")}</div>`,
      );
      return;
    }
    case "confirm-delete": {
      const r = byId(id);
      await db.change(r.type, id, { deleted_at: new Date().toISOString() });
      dialog.close();
      await leaveEditors();
      if (r.type === "party") location.hash = "parties";
      await render();
      cloud.schedule();
      return;
    }
    case "resolve": {
      const [rid, index, side] = id.split("|");
      const r = byId(rid),
        c = r.conflicts[Number(index)];
      await db.change(r.type, rid, {
        [c.field]: c[side],
        conflicts: r.conflicts.filter((_, i) => i !== Number(index)),
      });
      await leaveEditors();
      await render();
      cloud.schedule();
      return;
    }
    case "enable-sync":
    case "account-only":
      await leaveEditors();
      await cloud.useAccount(name === "enable-sync");
      return cloudDialog();
    case "logout":
      await leaveEditors();
      await cloud.logout();
      return cloudDialog();
    case "sync-now":
      await cloud.sync();
      $("#cloud-message").textContent = cloud.lastError || "Сохранено";
      return;
    case "export":
      return exportBackup();
    case "import":
      $("#import-file").click();
      return;
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  b.disabled = true;
  Promise.resolve()
    .then(() => action(b.dataset.action, b.dataset.id))
    .catch(fail)
    .finally(() => (b.disabled = false));
});
document.addEventListener("change", (e) => {
  if (e.target.id === "sort") {
    sort = e.target.value;
    render().catch(fail);
  }
});
window.addEventListener("hashchange", async () => {
  try {
    await leaveEditors();
    await render();
    window.scrollTo(0, 0);
  } catch (error) {
    fail(error);
  }
});
window.addEventListener("beforeunload", (e) => {
  if (editors.size) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("#cloud-status").addEventListener("click", () => cloudDialog().catch(fail));
async function boot() {
  try {
    db = await openStore();
    await migrateLocal(db);
    cloud = new Cloud(
      db,
      async (next) => {
        db = next;
        await render();
      },
      (message) => ($("#cloud-status").textContent = message),
      async () => {
        if (!editors.size && !dialog.open) await render();
      },
    );
    await cloud.init();
    await render();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch(() =>
          toast(
            "Не удалось обновить офлайн-версию. Повторите открытие с сетью.",
          ),
        );
  } catch (error) {
    page.innerHTML = `${title("Журнал не открылся")}<p>${esc(error.message)}</p><p>Данные не удалены. Освободите место или разрешите хранение данных для этого сайта.</p>`;
  }
}
export const ready = boot();
