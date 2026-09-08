type EditorHistory = { snapshots: string[]; index: number };
type DraftRecord = { id: string; content: string; updated_at: string };

const histories = new WeakMap<HTMLElement, EditorHistory>();
const restored = new WeakSet<HTMLElement>();
let pendingEditorId = '';
let saveTimer = 0;

function activeEditor(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#editor[contenteditable="true"]');
}

function historyFor(editor: HTMLElement): EditorHistory {
  let state = histories.get(editor);
  if (!state) {
    state = { snapshots: [editor.innerHTML], index: 0 };
    histories.set(editor, state);
  }
  return state;
}

function remember(editor: HTMLElement): void {
  const state = historyFor(editor);
  const html = editor.innerHTML;
  if (state.snapshots[state.index] === html) return;
  state.snapshots.splice(state.index + 1);
  state.snapshots.push(html);
  if (state.snapshots.length > 80) state.snapshots.shift();
  state.index = state.snapshots.length - 1;
}

function undo(editor: HTMLElement): void {
  const state = historyFor(editor);
  if (state.index <= 0) return;
  state.index -= 1;
  editor.innerHTML = state.snapshots[state.index];
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'historyUndo' }));
}

function currentRange(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement;
  return container && editor.contains(container) ? range : null;
}

function restoreSelection(range: Range): void {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

function wrapBold(editor: HTMLElement): void {
  const range = currentRange(editor);
  if (!range || range.collapsed) return;
  const strong = document.createElement('strong');
  strong.append(range.extractContents());
  range.insertNode(strong);
  const next = document.createRange();
  next.selectNodeContents(strong);
  restoreSelection(next);
}

function makeList(editor: HTMLElement): void {
  const range = currentRange(editor);
  if (!range) return;

  if (range.collapsed) {
    const node = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    const block = node?.closest('p,div');
    if (!block || !editor.contains(block)) return;
    const list = document.createElement('ul');
    const item = document.createElement('li');
    while (block.firstChild) item.append(block.firstChild);
    list.append(item);
    block.replaceWith(list);
    const next = document.createRange();
    next.selectNodeContents(item);
    next.collapse(false);
    restoreSelection(next);
    return;
  }

  const lines = range.toString().split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return;
  const list = document.createElement('ul');
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  }
  range.deleteContents();
  range.insertNode(list);
  const next = document.createRange();
  next.selectNodeContents(list);
  next.collapse(false);
  restoreSelection(next);
}

function runCommand(editor: HTMLElement, command: string): void {
  if (command === 'bold') wrapBold(editor);
  else if (command === 'insertUnorderedList') makeList(editor);
  else if (command === 'undo') { undo(editor); return; }
  remember(editor);
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'format' }));
}

function openNotebook(scope = 'guest'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`seeker-notebook-3:${scope}`, 1);
    request.onupgradeneeded = () => {
      for (const name of ['records', 'drafts', 'media', 'queue', 'meta']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRecord<T>(db: IDBDatabase, store: string, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function writeRecord(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteRecord(db: IDBDatabase, store: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function currentScope(): Promise<string> {
  const guest = await openNotebook('guest');
  try {
    const meta = await readRecord<{ value?: string }>(guest, 'meta', 'active-account');
    return meta?.value || 'guest';
  } finally {
    guest.close();
  }
}

async function withCurrentNotebook<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openNotebook(await currentScope());
  try { return await run(db); }
  finally { db.close(); }
}

function draftStatus(editor: HTMLElement): HTMLElement {
  const modal = editor.closest('.editor-modal');
  let status = modal?.querySelector<HTMLElement>('[data-editor-draft-state]');
  if (!status) {
    status = document.createElement('p');
    status.className = 'muted-copy';
    status.dataset.editorDraftState = '';
    status.setAttribute('aria-live', 'polite');
    status.style.margin = '8px 0 0';
    status.style.fontSize = '12px';
    editor.insertAdjacentElement('afterend', status);
  }
  return status;
}

async function restoreDraft(editor: HTMLElement): Promise<void> {
  if (restored.has(editor) || !pendingEditorId) return;
  restored.add(editor);
  editor.dataset.recordId = pendingEditorId;
  const draft = await withCurrentNotebook(db => readRecord<DraftRecord>(db, 'drafts', pendingEditorId)).catch(() => undefined);
  if (!draft?.content || draft.content === editor.innerHTML) return;
  editor.innerHTML = draft.content;
  histories.set(editor, { snapshots: [draft.content], index: 0 });
  draftStatus(editor).textContent = 'Восстановлен несохранённый черновик';
}

function scheduleDraft(editor: HTMLElement): void {
  const id = editor.dataset.recordId || pendingEditorId;
  if (!id) return;
  clearTimeout(saveTimer);
  draftStatus(editor).textContent = 'Сохраняем черновик…';
  saveTimer = window.setTimeout(async () => {
    const draft: DraftRecord = { id, content: editor.innerHTML, updated_at: new Date().toISOString() };
    try {
      await withCurrentNotebook(db => writeRecord(db, 'drafts', draft));
      draftStatus(editor).textContent = 'Черновик сохранён на устройстве';
    } catch {
      draftStatus(editor).textContent = 'Не удалось сохранить черновик';
    }
  }, 500);
}

async function discardDraft(editor: HTMLElement): Promise<void> {
  const id = editor.dataset.recordId || pendingEditorId;
  if (!id) return;
  clearTimeout(saveTimer);
  await withCurrentNotebook(db => deleteRecord(db, 'drafts', id)).catch(() => undefined);
}

function insertPlainText(editor: HTMLElement, text: string): void {
  const range = currentRange(editor);
  if (!range) return;
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const lines = text.replace(/\r/g, '').split('\n');
  lines.forEach((line, index) => {
    if (index) fragment.append(document.createElement('br'));
    fragment.append(document.createTextNode(line));
  });
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    const next = document.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    restoreSelection(next);
  }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}

document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const edit = target.closest<HTMLElement>('[data-action="edit-section"]');
  if (edit?.dataset.id) pendingEditorId = edit.dataset.id;

  const cancel = target.closest<HTMLElement>('.editor-modal .form-actions [data-action="close-overlay"]');
  if (cancel) {
    const editor = activeEditor();
    if (editor) void discardDraft(editor);
  }

  const control = target.closest<HTMLButtonElement>('[data-command]');
  if (!control) return;
  const editor = activeEditor();
  if (!editor) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  editor.focus({ preventScroll: true });
  runCommand(editor, control.dataset.command || '');
}, true);

document.addEventListener('focusin', event => {
  const target = event.target;
  if (target instanceof HTMLElement && target.matches('#editor[contenteditable="true"]')) {
    historyFor(target);
    void restoreDraft(target);
  }
});

document.addEventListener('input', event => {
  const target = event.target;
  if (target instanceof HTMLElement && target.matches('#editor[contenteditable="true"]')) {
    remember(target);
    scheduleDraft(target);
  }
}, true);

document.addEventListener('paste', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches('#editor[contenteditable="true"]')) return;
  event.preventDefault();
  insertPlainText(target, event.clipboardData?.getData('text/plain') || '');
}, true);

document.addEventListener('keydown', event => {
  const editor = activeEditor();
  if (!editor || event.target !== editor || !(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  if (key === 'b') {
    event.preventDefault();
    runCommand(editor, 'bold');
  } else if (key === 'z' && !event.shiftKey) {
    event.preventDefault();
    runCommand(editor, 'undo');
  }
}, true);
