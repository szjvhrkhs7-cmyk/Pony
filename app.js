const STORAGE_KEY = 'seeker-chronicles:v2';
const DB_NAME = 'seeker-chronicles-media-v2';
const DB_VERSION = 1;
const IMAGE_STORE = 'session-covers';

const state = {
  data: loadData(),
  currentCampaignId: null,
  editingCampaignId: null,
  editingSessionId: null,
  pendingCoverBlob: null,
  pendingCoverRemoved: false,
  objectUrls: new Map(),
  saveTimer: null
};

const $ = (id) => document.getElementById(id);
const els = {
  campaignsStrip: $('campaignsStrip'),
  workspace: $('workspace'),
  campaignsEmpty: $('campaignsEmpty'),
  campaignTitle: $('campaignTitle'),
  campaignSubtitle: $('campaignSubtitle'),
  campaignMeta: $('campaignMeta'),
  campaignParty: $('campaignParty'),
  campaignGoal: $('campaignGoal'),
  campaignLastSession: $('campaignLastSession'),
  campaignJournal: $('campaignJournal'),
  journalSaveState: $('journalSaveState'),
  quickNotes: $('quickNotes'),
  sessionsGrid: $('sessionsGrid'),
  sessionsEmpty: $('sessionsEmpty'),
  newCampaignButton: $('newCampaignButton'),
  emptyNewCampaignButton: $('emptyNewCampaignButton'),
  editCampaignButton: $('editCampaignButton'),
  deleteCampaignButton: $('deleteCampaignButton'),
  newSessionButton: $('newSessionButton'),
  emptyNewSessionButton: $('emptyNewSessionButton'),
  exportButton: $('exportButton'),
  importInput: $('importInput'),
  modalBackdrop: $('modalBackdrop'),
  campaignModal: $('campaignModal'),
  campaignModalTitle: $('campaignModalTitle'),
  campaignForm: $('campaignForm'),
  campaignNameInput: $('campaignNameInput'),
  campaignSubtitleInput: $('campaignSubtitleInput'),
  campaignPartyInput: $('campaignPartyInput'),
  campaignGoalInput: $('campaignGoalInput'),
  sessionModal: $('sessionModal'),
  sessionModalTitle: $('sessionModalTitle'),
  sessionForm: $('sessionForm'),
  sessionTitleInput: $('sessionTitleInput'),
  sessionDateInput: $('sessionDateInput'),
  sessionLocationInput: $('sessionLocationInput'),
  sessionTeaserInput: $('sessionTeaserInput'),
  sessionNotesEditor: $('sessionNotesEditor'),
  sessionCoverInput: $('sessionCoverInput'),
  coverPreview: $('coverPreview'),
  chooseCoverButton: $('chooseCoverButton'),
  removeCoverButton: $('removeCoverButton'),
  deleteSessionButton: $('deleteSessionButton'),
  toast: $('toast'),
  linkButton: $('linkButton')
};

boot();

function boot() {
  normalizeData();
  state.currentCampaignId = state.data.lastCampaignId || state.data.campaigns[0]?.id || null;
  bindEvents();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.campaigns)) return emptyData();
    return parsed;
  } catch {
    return emptyData();
  }
}

function emptyData() {
  return { version: 2, lastCampaignId: null, campaigns: [] };
}

function normalizeData() {
  state.data.version = 2;
  state.data.campaigns ??= [];

  for (const campaign of state.data.campaigns) {
    campaign.id ||= crypto.randomUUID();
    campaign.name ||= 'Без названия';
    campaign.subtitle ||= '';
    campaign.party ||= '';
    campaign.goal ||= '';
    campaign.journal = sanitizeHtml(campaign.journal || '');
    campaign.quickNotes ||= '';
    campaign.sessions ??= [];

    for (const session of campaign.sessions) {
      session.id ||= crypto.randomUUID();
      session.title ||= 'Игровой день';
      session.date ||= '';
      session.location ||= '';
      session.teaser ||= '';
      session.notes = sanitizeHtml(session.notes || '');
      session.createdAt ||= Date.now();
    }
  }

  if (!state.data.campaigns.some((campaign) => campaign.id === state.data.lastCampaignId)) {
    state.data.lastCampaignId = state.data.campaigns[0]?.id || null;
  }

  saveData();
}

function bindEvents() {
  els.newCampaignButton.addEventListener('click', () => openCampaignModal());
  els.emptyNewCampaignButton.addEventListener('click', () => openCampaignModal());
  els.editCampaignButton.addEventListener('click', () => openCampaignModal(getCurrentCampaign()));
  els.deleteCampaignButton.addEventListener('click', deleteEditingCampaign);
  els.newSessionButton.addEventListener('click', () => openSessionModal());
  els.emptyNewSessionButton.addEventListener('click', () => openSessionModal());
  els.campaignForm.addEventListener('submit', saveCampaignFromForm);
  els.sessionForm.addEventListener('submit', saveSessionFromForm);
  els.deleteSessionButton.addEventListener('click', deleteEditingSession);

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModals);
  });
  els.modalBackdrop.addEventListener('click', closeModals);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModals();
  });

  els.campaignJournal.addEventListener('input', () => scheduleCampaignTextSave('journal'));
  els.quickNotes.addEventListener('input', () => scheduleCampaignTextSave('quickNotes'));
  els.campaignJournal.addEventListener('paste', pastePlainText);
  els.sessionNotesEditor.addEventListener('paste', pastePlainText);

  bindEditorToolbar(document.querySelector('.journal-panel .editor-toolbar'), els.campaignJournal);
  bindEditorToolbar(document.querySelector('.session-toolbar'), els.sessionNotesEditor);
  els.linkButton.addEventListener('click', () => createLink(els.campaignJournal));
  document.querySelector('[data-session-link]').addEventListener('click', () => createLink(els.sessionNotesEditor));

  els.chooseCoverButton.addEventListener('click', () => els.sessionCoverInput.click());
  els.coverPreview.addEventListener('click', () => els.sessionCoverInput.click());
  els.sessionCoverInput.addEventListener('change', () => handleCoverFile(els.sessionCoverInput.files?.[0]));
  els.removeCoverButton.addEventListener('click', removePendingCover);

  ['dragenter', 'dragover'].forEach((type) => {
    els.coverPreview.addEventListener(type, (event) => {
      event.preventDefault();
      els.coverPreview.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    els.coverPreview.addEventListener(type, (event) => {
      event.preventDefault();
      els.coverPreview.classList.remove('is-dragging');
    });
  });
  els.coverPreview.addEventListener('drop', (event) => handleCoverFile(event.dataTransfer?.files?.[0]));

  els.exportButton.addEventListener('click', exportBackup);
  els.importInput.addEventListener('change', importBackup);
}

function bindEditorToolbar(toolbar, editor) {
  toolbar.addEventListener('mousedown', (event) => {
    if (event.target.closest('button')) event.preventDefault();
  });

  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.hasAttribute('data-session-link')) return;

    editor.focus();
    const command = button.dataset.command;
    const block = button.dataset.block;
    if (command) document.execCommand(command, false);
    if (block) document.execCommand('formatBlock', false, block);
    if (editor === els.campaignJournal) scheduleCampaignTextSave('journal');
  });
}

function createLink(editor) {
  const url = window.prompt('Вставьте адрес ссылки (https://...)');
  if (!url) return;
  const safe = normalizeUrl(url);
  if (!safe) {
    showToast('Разрешены только ссылки http:// и https://');
    return;
  }

  editor.focus();
  document.execCommand('createLink', false, safe);
  Array.from(editor.querySelectorAll('a')).forEach((anchor) => {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  });
  if (editor === els.campaignJournal) scheduleCampaignTextSave('journal');
}

function pastePlainText(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
}

function render() {
  renderCampaignStrip();
  const campaign = getCurrentCampaign();
  const hasCampaigns = Boolean(campaign);
  els.workspace.classList.toggle('is-hidden', !hasCampaigns);
  els.campaignsEmpty.classList.toggle('is-hidden', hasCampaigns);

  if (!campaign) return;

  els.campaignTitle.textContent = campaign.name;
  els.campaignSubtitle.textContent = campaign.subtitle || '—';
  els.campaignMeta.textContent = `${campaign.sessions.length} ${plural(campaign.sessions.length, 'запись', 'записи', 'записей')}`;
  els.campaignParty.textContent = campaign.party || '—';
  els.campaignGoal.textContent = campaign.goal || '—';
  els.campaignLastSession.textContent = formatLastSession(campaign.sessions) || '—';
  els.campaignJournal.innerHTML = sanitizeHtml(campaign.journal || '');
  els.quickNotes.value = campaign.quickNotes || '';
  renderSessions(campaign);
}

function renderCampaignStrip() {
  els.campaignsStrip.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (const campaign of state.data.campaigns) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `campaign-card${campaign.id === state.currentCampaignId ? ' is-active' : ''}`;
    const sessionCount = campaign.sessions.length;
    button.innerHTML = `<span>${sessionCount} ${plural(sessionCount, 'день', 'дня', 'дней')}</span><strong></strong><small></small>`;
    button.querySelector('strong').textContent = campaign.name;
    button.querySelector('small').textContent = campaign.subtitle || 'Открыть';
    button.addEventListener('click', () => {
      flushCampaignTextSave();
      state.currentCampaignId = campaign.id;
      state.data.lastCampaignId = campaign.id;
      saveData();
      render();
    });
    fragment.append(button);
  }

  els.campaignsStrip.append(fragment);
}

async function renderSessions(campaign) {
  releaseObjectUrls();
  els.sessionsGrid.replaceChildren();
  const sorted = [...campaign.sessions].sort((a, b) => sessionSortValue(b) - sessionSortValue(a));
  els.sessionsEmpty.classList.toggle('is-hidden', sorted.length > 0);
  if (!sorted.length) return;

  const fragment = document.createDocumentFragment();
  for (const session of sorted) {
    const card = document.createElement('article');
    card.className = 'session-card';
    card.innerHTML = `<button class="session-cover" type="button" aria-label="Открыть запись"></button><div class="session-card-body"><div class="session-card-meta"><span class="session-date"></span><span class="session-location"></span></div><h4></h4><p></p><div class="session-card-footer"><span>Игровой день</span><button class="session-card-open" type="button">Открыть →</button></div></div>`;
    card.querySelector('.session-date').textContent = formatDate(session.date) || '—';
    card.querySelector('.session-location').textContent = session.location || '';
    card.querySelector('h4').textContent = session.title;
    card.querySelector('p').textContent = session.teaser || textFromHtml(session.notes).slice(0, 145) || '—';

    const open = () => openSessionModal(session);
    card.querySelector('.session-cover').addEventListener('click', open);
    card.querySelector('.session-card-open').addEventListener('click', open);
    fragment.append(card);

    getCoverBlob(session.id).then((blob) => {
      if (!blob || !card.isConnected) return;
      const url = URL.createObjectURL(blob);
      state.objectUrls.set(session.id, url);
      card.querySelector('.session-cover').style.backgroundImage = `linear-gradient(transparent 35%, rgba(16,17,13,.25)), url("${url}")`;
    }).catch(() => {});
  }

  els.sessionsGrid.append(fragment);
}

function openCampaignModal(campaign = null) {
  state.editingCampaignId = campaign?.id || null;
  els.campaignModalTitle.textContent = campaign ? 'Редактировать игру' : 'Новая игра';
  els.campaignNameInput.value = campaign?.name || '';
  els.campaignSubtitleInput.value = campaign?.subtitle || '';
  els.campaignPartyInput.value = campaign?.party || '';
  els.campaignGoalInput.value = campaign?.goal || '';
  els.deleteCampaignButton.classList.toggle('is-hidden', !campaign);
  openModal(els.campaignModal);
  queueMicrotask(() => els.campaignNameInput.focus());
}

function saveCampaignFromForm(event) {
  event.preventDefault();
  const name = els.campaignNameInput.value.trim();
  if (!name) return;

  if (state.editingCampaignId) {
    const campaign = state.data.campaigns.find((item) => item.id === state.editingCampaignId);
    if (!campaign) return;
    campaign.name = name;
    campaign.subtitle = els.campaignSubtitleInput.value.trim();
    campaign.party = els.campaignPartyInput.value.trim();
    campaign.goal = els.campaignGoalInput.value.trim();
  } else {
    const id = crypto.randomUUID();
    state.data.campaigns.push({
      id,
      name,
      subtitle: els.campaignSubtitleInput.value.trim(),
      party: els.campaignPartyInput.value.trim(),
      goal: els.campaignGoalInput.value.trim(),
      journal: '',
      quickNotes: '',
      sessions: []
    });
    state.currentCampaignId = id;
    state.data.lastCampaignId = id;
  }

  saveData();
  closeModals();
  render();
  showToast('Игра сохранена');
}

async function deleteEditingCampaign() {
  if (!state.editingCampaignId) return;
  const campaign = state.data.campaigns.find((item) => item.id === state.editingCampaignId);
  if (!campaign) return;

  const confirmed = window.confirm(`Удалить игру «${campaign.name}» со всеми её записями? Это действие нельзя отменить.`);
  if (!confirmed) return;

  for (const session of campaign.sessions) {
    await deleteCoverBlob(session.id).catch(() => {});
  }

  state.data.campaigns = state.data.campaigns.filter((item) => item.id !== campaign.id);
  state.currentCampaignId = state.data.campaigns[0]?.id || null;
  state.data.lastCampaignId = state.currentCampaignId;
  saveData();
  closeModals();
  render();
  showToast('Игра удалена');
}

async function openSessionModal(session = null) {
  state.editingSessionId = session?.id || null;
  state.pendingCoverBlob = null;
  state.pendingCoverRemoved = false;
  els.sessionModalTitle.textContent = session ? 'Редактировать игровой день' : 'Новый игровой день';
  els.sessionTitleInput.value = session?.title || '';
  els.sessionDateInput.value = session?.date || '';
  els.sessionLocationInput.value = session?.location || '';
  els.sessionTeaserInput.value = session?.teaser || '';
  els.sessionNotesEditor.innerHTML = sanitizeHtml(session?.notes || '');
  els.deleteSessionButton.classList.toggle('is-hidden', !session);
  clearCoverPreview();

  if (session) {
    const blob = await getCoverBlob(session.id).catch(() => null);
    if (blob) showCoverPreview(blob);
  }

  openModal(els.sessionModal);
  queueMicrotask(() => els.sessionTitleInput.focus());
}

async function saveSessionFromForm(event) {
  event.preventDefault();
  const campaign = getCurrentCampaign();
  if (!campaign) return;

  const title = els.sessionTitleInput.value.trim();
  if (!title) return;

  let session;
  if (state.editingSessionId) {
    session = campaign.sessions.find((item) => item.id === state.editingSessionId);
    if (!session) return;
  } else {
    session = { id: crypto.randomUUID(), createdAt: Date.now() };
    campaign.sessions.push(session);
  }

  session.title = title;
  session.date = els.sessionDateInput.value;
  session.location = els.sessionLocationInput.value.trim();
  session.teaser = els.sessionTeaserInput.value.trim();
  session.notes = sanitizeHtml(els.sessionNotesEditor.innerHTML);

  try {
    if (state.pendingCoverRemoved) await deleteCoverBlob(session.id);
    if (state.pendingCoverBlob) await putCoverBlob(session.id, state.pendingCoverBlob);
  } catch {
    showToast('Текст сохранён, но обложку сохранить не удалось');
  }

  saveData();
  closeModals();
  render();
  showToast('Игровой день сохранён');
}

async function deleteEditingSession() {
  const campaign = getCurrentCampaign();
  if (!campaign || !state.editingSessionId) return;
  const session = campaign.sessions.find((item) => item.id === state.editingSessionId);
  if (!session) return;

  const confirmed = window.confirm(`Удалить запись «${session.title}»? Это действие нельзя отменить.`);
  if (!confirmed) return;

  campaign.sessions = campaign.sessions.filter((item) => item.id !== session.id);
  await deleteCoverBlob(session.id).catch(() => {});
  saveData();
  closeModals();
  render();
  showToast('Запись удалена');
}

function scheduleCampaignTextSave(field) {
  els.journalSaveState.textContent = 'Сохраняю…';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;
    if (field === 'journal') campaign.journal = sanitizeHtml(els.campaignJournal.innerHTML);
    if (field === 'quickNotes') campaign.quickNotes = els.quickNotes.value;
    saveData();
    els.journalSaveState.textContent = 'Сохранено';
  }, 400);
}

function flushCampaignTextSave() {
  clearTimeout(state.saveTimer);
  const campaign = getCurrentCampaign();
  if (!campaign) return;
  campaign.journal = sanitizeHtml(els.campaignJournal.innerHTML);
  campaign.quickNotes = els.quickNotes.value;
  saveData();
}

function openModal(modal) {
  els.modalBackdrop.classList.remove('is-hidden');
  modal.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
}

function closeModals() {
  els.modalBackdrop.classList.add('is-hidden');
  els.campaignModal.classList.add('is-hidden');
  els.sessionModal.classList.add('is-hidden');
  document.body.style.overflow = '';
  state.editingCampaignId = null;
  state.editingSessionId = null;
  state.pendingCoverBlob = null;
  state.pendingCoverRemoved = false;
}

async function handleCoverFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
    showToast('Нужна картинка JPG, PNG, WEBP или AVIF');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('Картинка слишком большая. Максимум 12 МБ');
    return;
  }

  try {
    state.pendingCoverBlob = await optimizeImage(file);
    state.pendingCoverRemoved = false;
    showCoverPreview(state.pendingCoverBlob);
  } catch {
    showToast('Не удалось обработать картинку');
  }
}

async function optimizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const maxHeight = 1000;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed')),
      'image/jpeg',
      0.84
    );
  });
}

function showCoverPreview(blob) {
  if (els.coverPreview.dataset.objectUrl) URL.revokeObjectURL(els.coverPreview.dataset.objectUrl);
  const url = URL.createObjectURL(blob);
  els.coverPreview.dataset.objectUrl = url;
  els.coverPreview.style.backgroundImage = `linear-gradient(transparent 30%, rgba(8,11,9,.22)), url("${url}")`;
  els.coverPreview.classList.add('has-image');
  els.removeCoverButton.classList.remove('is-hidden');
}

function clearCoverPreview() {
  if (els.coverPreview.dataset.objectUrl) URL.revokeObjectURL(els.coverPreview.dataset.objectUrl);
  delete els.coverPreview.dataset.objectUrl;
  els.coverPreview.style.backgroundImage = '';
  els.coverPreview.classList.remove('has-image');
  els.removeCoverButton.classList.add('is-hidden');
  els.sessionCoverInput.value = '';
}

function removePendingCover() {
  state.pendingCoverBlob = null;
  state.pendingCoverRemoved = true;
  clearCoverPreview();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function getCurrentCampaign() {
  return state.data.campaigns.find((campaign) => campaign.id === state.currentCampaignId) || null;
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowed = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A']);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      continue;
    }

    for (const attribute of [...node.attributes]) {
      if (node.tagName === 'A' && ['href', 'target', 'rel'].includes(attribute.name)) continue;
      node.removeAttribute(attribute.name);
    }

    if (node.tagName === 'A') {
      const safe = normalizeUrl(node.getAttribute('href') || '');
      if (!safe) {
        node.replaceWith(...node.childNodes);
      } else {
        node.setAttribute('href', safe);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  return template.innerHTML;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function textFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html || '');
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatLastSession(sessions) {
  if (!sessions.length) return '';
  const sorted = [...sessions].sort((a, b) => sessionSortValue(b) - sessionSortValue(a));
  return formatDate(sorted[0].date) || sorted[0].title;
}

function sessionSortValue(session) {
  if (session.date) {
    const value = new Date(`${session.date}T12:00:00`).getTime();
    if (!Number.isNaN(value)) return value;
  }
  return session.createdAt || 0;
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove('is-hidden');
  toastTimer = setTimeout(() => els.toast.classList.add('is-hidden'), 2600);
}

function releaseObjectUrls() {
  for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
  state.objectUrls.clear();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putCoverBlob(sessionId, blob) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).put(blob, sessionId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getCoverBlob(sessionId) {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const request = tx.objectStore(IMAGE_STORE).get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

async function deleteCoverBlob(sessionId) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).delete(sessionId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function exportBackup() {
  flushCampaignTextSave();
  const backup = structuredClone(state.data);

  for (const campaign of backup.campaigns) {
    for (const session of campaign.sessions) {
      const blob = await getCoverBlob(session.id).catch(() => null);
      if (blob) session.coverData = await blobToDataUrl(blob);
    }
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `chronicles-backup-${todayIso()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Резервная копия скачана');
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.campaigns)) throw new Error('Wrong format');

    const covers = [];
    for (const campaign of parsed.campaigns) {
      if (!Array.isArray(campaign.sessions)) campaign.sessions = [];
      for (const session of campaign.sessions) {
        if (session.coverData) {
          covers.push([session.id, dataUrlToBlob(session.coverData)]);
          delete session.coverData;
        }
      }
    }

    state.data = parsed;
    normalizeData();
    for (const [id, blob] of covers) await putCoverBlob(id, blob);
    state.currentCampaignId = state.data.lastCampaignId || state.data.campaigns[0]?.id || null;
    saveData();
    render();
    showToast('Резервная копия восстановлена');
  } catch {
    showToast('Не удалось импортировать файл');
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
