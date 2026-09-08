const ABILITIES = [
  ["strength", "СИЛ", "◆"],
  ["dexterity", "ЛОВ", "➶"],
  ["constitution", "ТЕЛ", "♥"],
  ["intelligence", "ИНТ", "✣"],
  ["wisdom", "МДР", "◉"],
  ["charisma", "ХАР", "✦"],
];

const FIELD_META = {
  name: ["Имя", "●"],
  race: ["Раса", "❧"],
  class: ["Класс", "⚔"],
  background: ["Предыстория", "▤"],
};

const page = document.querySelector("#page");
const dialog = document.querySelector("#dialog");
let scheduled = false;

function signed(value) {
  const number = Math.floor((Number(value || 10) - 10) / 2);
  return number >= 0 ? `+${number}` : `−${Math.abs(number)}`;
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enhancePage();
    enhanceDialog();
  });
}

function enhancePage() {
  if (!page) return;
  const hash = decodeURIComponent(location.hash.slice(1) || "parties");
  const view = hash === "character" ? "character" : hash.startsWith("party/") ? "party-detail" : "parties";
  page.dataset.view = view;

  if (!page.querySelector(".page-map-ornament") && (view === "parties" || view === "character")) {
    const ornament = document.createElement("div");
    ornament.className = "page-map-ornament";
    ornament.setAttribute("aria-hidden", "true");
    page.prepend(ornament);
  }

  page.querySelectorAll(".ability").forEach((card, index) => {
    if (card.dataset.enhancedAbility) return;
    card.dataset.enhancedAbility = "true";
    const meta = ABILITIES[index];
    if (!meta) return;
    card.dataset.ability = meta[0];
    const symbol = document.createElement("span");
    symbol.className = "ability-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = meta[2];
    card.prepend(symbol);
  });
}

function replaceLeadingLabelText(label, caption, icon) {
  if (label.querySelector(":scope > .field-caption")) return;
  for (const node of [...label.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.textContent = "";
      break;
    }
  }
  const row = document.createElement("span");
  row.className = "field-caption";
  row.innerHTML = `<span class="field-icon" aria-hidden="true">${icon}</span><span>${caption}</span>`;
  label.prepend(row);
}

function enhanceCharacterForm(form) {
  if (form.dataset.characterEnhanced) return;
  form.dataset.characterEnhanced = "true";
  dialog.classList.add("character-dialog");

  if (!dialog.querySelector(".dialog-crest")) {
    const crest = document.createElement("div");
    crest.className = "dialog-crest";
    crest.setAttribute("aria-hidden", "true");
    crest.innerHTML = '<img src="./assets/d20.svg" alt="">';
    dialog.prepend(crest);
  }

  const header = dialog.querySelector(".dialog-header");
  if (header && !dialog.querySelector(".dialog-subtitle")) {
    const subtitle = document.createElement("p");
    subtitle.className = "dialog-subtitle";
    subtitle.textContent = "Большие истории начинаются с маленьких решений";
    header.after(subtitle);
  }

  for (const [name, [caption, icon]] of Object.entries(FIELD_META)) {
    const input = form.elements.namedItem(name);
    const label = input?.closest("label.field");
    if (!input || !label) continue;
    label.dataset.field = name;
    replaceLeadingLabelText(label, caption, icon);
    if (name === "name") input.placeholder = "Введите имя персонажа…";
    if (name === "race") input.placeholder = "Укажите расу…";
    if (name === "class") input.placeholder = "Укажите класс…";
    if (name === "background") input.placeholder = "Укажите предысторию…";
  }

  const abilities = form.querySelector(".form-abilities");
  if (abilities && !abilities.previousElementSibling?.classList.contains("form-section-title")) {
    const heading = document.createElement("div");
    heading.className = "form-section-title full";
    heading.innerHTML = "<span>Характеристики</span>";
    abilities.before(heading);
  }

  ABILITIES.forEach(([key, labelText, icon]) => {
    const input = form.elements.namedItem(key);
    const label = input?.closest("label.field");
    if (!input || !label || label.classList.contains("ability-input")) return;
    label.classList.add("ability-input");
    label.dataset.ability = key;
    for (const node of [...label.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
    }
    const symbol = document.createElement("span");
    symbol.className = "ability-input-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = icon;
    const name = document.createElement("span");
    name.className = "ability-input-name";
    name.textContent = labelText;
    const modifier = document.createElement("span");
    modifier.className = "ability-input-modifier";
    modifier.textContent = signed(input.value);
    label.insertBefore(symbol, input);
    label.insertBefore(name, input);
    label.append(modifier);
    input.setAttribute("inputmode", "numeric");
    input.addEventListener("input", () => (modifier.textContent = signed(input.value)));
  });

  const upload = form.querySelector('input[type="file"][name="image"]');
  const uploadLabel = upload?.closest("label.field");
  if (upload && uploadLabel && !uploadLabel.classList.contains("upload-field")) {
    uploadLabel.classList.add("upload-field", "full");
    for (const node of [...uploadLabel.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = "";
    }
    const title = document.createElement("div");
    title.className = "form-section-title upload-title";
    title.innerHTML = "<span>Портрет</span>";
    uploadLabel.before(title);
    upload.classList.add("native-file-input");
    const card = document.createElement("div");
    card.className = "upload-card";
    card.innerHTML = `
      <span class="portrait-placeholder" aria-hidden="true"><span class="portrait-silhouette">♟</span><span class="portrait-plus">+</span></span>
      <span class="upload-copy"><strong>Загрузите портрет персонажа</strong><span>Выберите изображение, которое отразит характер вашего героя.</span><span class="upload-button">▧&nbsp;&nbsp;Выбрать файл</span><small class="upload-filename">JPG, PNG, WEBP или GIF · до 20 МБ</small></span>`;
    uploadLabel.insertBefore(card, upload);
    upload.addEventListener("change", () => {
      const filename = card.querySelector(".upload-filename");
      filename.textContent = upload.files?.[0]?.name || "JPG, PNG, WEBP или GIF · до 20 МБ";
      card.classList.toggle("has-file", Boolean(upload.files?.length));
    });
  }
}

function enhanceGenericDialog(form) {
  if (form.dataset.genericEnhanced) return;
  form.dataset.genericEnhanced = "true";
  const hasParty = form.elements.namedItem("players_count");
  const hasSession = form.elements.namedItem("location");
  dialog.classList.toggle("party-dialog", Boolean(hasParty));
  dialog.classList.toggle("session-dialog", Boolean(hasSession));

  const upload = form.querySelector('input[type="file"][name="image"]');
  const uploadLabel = upload?.closest("label.field");
  if (upload && uploadLabel && !uploadLabel.classList.contains("compact-upload")) {
    uploadLabel.classList.add("compact-upload", "full");
    upload.classList.add("styled-file-input");
  }
}

function enhanceDialog() {
  if (!dialog) return;
  if (!dialog.open) {
    dialog.classList.remove("character-dialog", "party-dialog", "session-dialog");
    return;
  }
  const form = dialog.querySelector("#record-form");
  if (!form) return;
  const isCharacter = Boolean(form.elements.namedItem("strength") && form.elements.namedItem("charisma"));
  if (isCharacter) enhanceCharacterForm(form);
  else enhanceGenericDialog(form);
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleEnhance);
document.addEventListener("change", scheduleEnhance, true);
document.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
scheduleEnhance();
