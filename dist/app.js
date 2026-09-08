import { migrateLocal, openStore, prepareImage } from './db.js';
import { CloudService } from './cloud.js';
import { ABILITIES, clampScore, escapeHtml as esc, modifier, sanitizeHtml, signed } from './model.js';
const SECTION_KINDS = {
    party: [['history', 'История'], ['events', 'Важные события'], ['notes', 'Заметки'], ['companions', 'Персонажи партии']],
    character: [['history', 'История'], ['events', 'Важные события'], ['equipment', 'Снаряжение']]
};
class ChroniclesApp {
    db;
    cloud;
    records = [];
    mediaUrls = new Map();
    sort = 'new';
    selectedCharacter = null;
    root = document.querySelector('#app');
    overlay = document.querySelector('#overlay');
    toastNode = document.querySelector('#toast');
    cloudStatus = document.querySelector('#cloud-status');
    async boot() {
        this.db = await openStore();
        await migrateLocal(this.db);
        this.cloud = new CloudService(this.db, async (next) => { this.db = next; await this.refresh(); }, message => { this.cloudStatus.textContent = message; }, async () => this.refresh());
        await this.cloud.init();
        await this.refresh();
        addEventListener('hashchange', () => { void this.refresh(); scrollTo(0, 0); });
        document.addEventListener('click', event => void this.onClick(event));
        document.addEventListener('change', event => void this.onChange(event));
        if ('serviceWorker' in navigator)
            navigator.serviceWorker.register('./service-worker.js').catch(() => undefined);
    }
    async refresh() {
        this.records = await this.db.all('records');
        this.releaseMedia();
        const route = decodeURIComponent(location.hash.slice(1) || 'parties');
        if (route === 'character')
            this.renderCharacter();
        else if (route.startsWith('party/'))
            this.renderParty(route.slice(6));
        else
            this.renderParties();
        await this.hydrateMedia();
        this.updateNav(route);
    }
    active(type, parentId) {
        return this.records.filter(record => record.type === type && !record.deleted_at && (!parentId || record.parent_id === parentId));
    }
    byId(id) {
        return this.records.find(record => record.id === id);
    }
    updateNav(route) {
        document.querySelectorAll('[data-nav]').forEach(node => {
            const active = node.dataset.nav === (route === 'character' ? 'character' : 'parties');
            node.toggleAttribute('aria-current', active);
        });
    }
    heading(title, subtitle) {
        return `<header class="page-hero"><div class="page-title-block"><span class="eyebrow">Хроники Искателя</span><h1>${esc(title)}</h1><div class="ornament-line"><i></i><b>◇</b><i></i></div>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div class="map-etching" aria-hidden="true"></div></header>`;
    }
    renderParties() {
        const parties = this.active('party').sort((a, b) => this.sort === 'name'
            ? a.title.localeCompare(b.title, 'ru') : b.created_at.localeCompare(a.created_at));
        this.root.innerHTML = `<main class="parchment-page parties-page">
      ${this.heading('Мои партии', 'Миры, герои и истории, которые мы создаём вместе.')}
      <div class="sort-row"><label>Порядок <select id="sort"><option value="new" ${this.sort === 'new' ? 'selected' : ''}>Сначала новые</option><option value="name" ${this.sort === 'name' ? 'selected' : ''}>По названию</option></select></label></div>
      <section class="campaign-list">
        ${parties.map(p => this.partyCard(p)).join('')}
        ${this.newPartyCard()}
      </section>
    </main>`;
    }
    partyCard(party) {
        const sessions = this.active('session', party.id).length;
        return `<article class="campaign-card ornate-frame">
      <div class="campaign-cover" data-media="${esc(party.image_id || '')}"><img class="fallback-cover" src="./assets/campaign-gothic.svg" alt=""><span class="status-ribbon">${esc(party.status || 'В процессе')}</span></div>
      <div class="campaign-copy"><h2>${esc(party.title)}</h2><div class="campaign-meta"><span>♟♟ ${party.players_count ? `${party.players_count} игроков` : 'Отряд не указан'}</span><span class="meta-separator"></span><span>⚔ ${sessions} ${sessions === 1 ? 'сессия' : sessions >= 2 && sessions <= 4 ? 'сессии' : 'сессий'}</span></div>
      ${party.description ? `<p>${esc(party.description)}</p>` : ''}
      <button class="cta cta-burgundy" data-action="open-party" data-id="${esc(party.id)}">Открыть журнал <span>→</span></button></div>
    </article>`;
    }
    newPartyCard() {
        return `<article class="new-campaign ornate-frame"><div class="compass-plus" aria-hidden="true"><span>+</span></div><div><h2>Новая партия</h2><p>Создайте новую историю.<br>Соберите отряд и отправьтесь в приключение.</p><button class="cta cta-green" data-action="new-party">Создать партию <span>→</span></button></div></article>`;
    }
    sectionRecord(parent, kind, title) {
        return (this.records.find(item => item.id === `${parent.id}:${kind}`) || {
            id: `${parent.id}:${kind}`, type: 'section', parent_id: parent.id, kind, title, content: '',
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 0, device_id: this.db.device, deleted_at: null
        });
    }
    sectionView(section) {
        return `<section class="journal-section" data-section="${esc(section.id)}"><header><h2>${esc(section.title)}</h2><button class="text-action" data-action="edit-section" data-id="${esc(section.id)}">✎ Править</button></header><div class="reading">${section.content ? sanitizeHtml(section.content) : '<p class="empty-copy">Здесь пока нет записей.</p>'}</div></section>`;
    }
    renderParty(id) {
        const party = this.byId(id);
        if (!party || party.deleted_at) {
            location.hash = 'parties';
            return;
        }
        const sections = SECTION_KINDS.party.map(([kind, label]) => this.sectionView(this.sectionRecord(party, kind, label))).join('');
        const sessions = this.active('session', party.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        this.root.innerHTML = `<main class="parchment-page detail-page">
      <a class="back-link" href="#parties">← Мои партии</a>
      <div class="detail-banner" data-media="${esc(party.image_id || '')}"><img class="fallback-cover" src="./assets/campaign-gothic.svg" alt=""></div>
      <header class="detail-title"><div><span class="eyebrow">Журнал кампании</span><h1>${esc(party.title)}</h1></div><button class="text-action" data-action="edit-party" data-id="${esc(party.id)}">✎ Править</button></header>
      <div class="campaign-meta large"><span>♟♟ ${party.players_count ? `${party.players_count} игроков` : 'Отряд не указан'}</span><span>⚔ ${sessions.length} сессий</span>${party.start_date ? `<span>Начало: ${this.formatDate(party.start_date)}</span>` : ''}</div>
      ${party.description ? `<p class="lead-copy">${esc(party.description)}</p>` : ''}
      ${party.party ? `<p class="lead-copy"><strong>Отряд:</strong> ${esc(party.party)}</p>` : ''}
      ${party.goal ? `<p class="lead-copy"><strong>Текущая цель:</strong> ${esc(party.goal)}</p>` : ''}
      ${sections}
      <section class="journal-section"><header><h2>Сессии</h2><button class="text-action" data-action="new-session" data-id="${esc(party.id)}">＋ Добавить</button></header>
        <div class="session-stack">${sessions.length ? sessions.map(s => this.sessionCard(s)).join('') : '<p class="empty-copy">Здесь появятся записи игровых встреч.</p>'}</div>
      </section>
      <div class="danger-row"><button class="danger-link" data-action="delete" data-id="${esc(party.id)}">Удалить партию</button></div>
    </main>`;
    }
    sessionCard(session) {
        return `<article class="session-card"><div class="session-top"><div><span class="eyebrow">${this.formatDate(session.date || '')}${session.location ? ` · ${esc(session.location)}` : ''}</span><h3>${esc(session.title)}</h3></div><button class="text-action" data-action="edit-session" data-id="${esc(session.id)}">✎ Сведения</button></div>${session.image_id ? `<div class="session-image" data-media="${esc(session.image_id)}"></div>` : ''}${session.description ? `<p>${esc(session.description)}</p>` : ''}${this.sectionView({ ...session, title: 'Запись сессии' })}</article>`;
    }
    renderCharacter() {
        const characters = this.active('character');
        const character = characters.find(item => item.id === this.selectedCharacter) || characters[0];
        if (!character) {
            this.root.innerHTML = `<main class="parchment-page character-page">${this.heading('Мой персонаж', 'У каждой истории есть свой герой.')}<article class="new-character ornate-frame"><div class="crest-placeholder">✦</div><h2>Создайте героя</h2><p>Имя, история и всё, что вы берёте с собой в дорогу.</p><button class="cta cta-burgundy" data-action="new-character">Создать персонажа</button></article></main>`;
            return;
        }
        const sections = SECTION_KINDS.character.map(([kind, label]) => this.sectionView(this.sectionRecord(character, kind, label))).join('');
        this.root.innerHTML = `<main class="parchment-page character-page">${this.heading('Мой персонаж')}
      ${characters.length > 1 ? `<div class="character-switcher">${characters.map(c => `<button data-action="select-character" data-id="${esc(c.id)}" aria-pressed="${c.id === character.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
      <section class="character-sheet ornate-frame"><div class="character-portrait" data-media="${esc(character.image_id || '')}"><img class="fallback-portrait" src="./assets/character-silhouette.svg" alt=""></div><div class="character-identity"><span class="eyebrow">Лист персонажа</span><h2>${esc(character.name)}</h2><p>${[character.race, character.class].filter(Boolean).map(esc).join(' · ')}</p><p class="muted-copy">${esc(character.background || '')}</p><button class="text-action" data-action="edit-character" data-id="${esc(character.id)}">✎ Править</button></div></section>
      <div class="section-label"><i></i><span>Характеристики</span><i></i></div>
      <section class="ability-grid">${ABILITIES.map(a => this.abilityCard(character, a.key, a.short, a.full, a.icon)).join('')}</section>
      ${sections}<div class="danger-row"><button class="danger-link" data-action="delete" data-id="${esc(character.id)}">Удалить персонажа</button></div>
    </main>`;
    }
    abilityCard(character, key, short, full, icon) {
        const score = clampScore(character[key]);
        return `<div class="ability-card" aria-label="${full}: ${score}, модификатор ${signed(modifier(score))}"><span class="ability-icon">${icon}</span><span class="ability-name">${short}</span><strong>${score}</strong><em>${signed(modifier(score))}</em></div>`;
    }
    async hydrateMedia() {
        for (const node of document.querySelectorAll('[data-media]')) {
            const id = node.dataset.media;
            if (!id)
                continue;
            const media = await this.db.get('media', id);
            if (!media?.blob)
                continue;
            const url = URL.createObjectURL(media.blob);
            this.mediaUrls.set(id, url);
            const image = new Image();
            image.src = url;
            image.alt = '';
            image.className = node.classList.contains('character-portrait') ? 'real-portrait' : 'real-cover';
            node.querySelector('.fallback-cover,.fallback-portrait')?.remove();
            node.prepend(image);
        }
    }
    releaseMedia() { for (const url of this.mediaUrls.values())
        URL.revokeObjectURL(url); this.mediaUrls.clear(); }
    formatDate(value) { if (!value)
        return ''; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date); }
    async onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button)
            return;
        const action = button.dataset.action;
        const id = button.dataset.id || '';
        if (action === 'open-party') {
            location.hash = `party/${id}`;
            return;
        }
        if (action === 'new-party')
            return this.openRecordDialog('party');
        if (action === 'edit-party')
            return this.openRecordDialog('party', id);
        if (action === 'new-character')
            return this.openRecordDialog('character');
        if (action === 'edit-character')
            return this.openRecordDialog('character', id);
        if (action === 'select-character') {
            this.selectedCharacter = id;
            return this.refresh();
        }
        if (action === 'new-session')
            return this.openRecordDialog('session', undefined, id);
        if (action === 'edit-session')
            return this.openRecordDialog('session', id);
        if (action === 'edit-section')
            return this.openEditor(id);
        if (action === 'close-overlay')
            return this.closeOverlay();
        if (action === 'cloud')
            return this.openCloudDialog();
        if (action === 'delete')
            return this.deleteRecord(id);
    }
    async onChange(event) {
        const target = event.target;
        if (target.id === 'sort') {
            this.sort = target.value;
            await this.refresh();
        }
    }
    showOverlay(content, extraClass = '') {
        this.overlay.className = `overlay is-open ${extraClass}`;
        this.overlay.innerHTML = `<div class="overlay-backdrop" data-action="close-overlay"></div>${content}`;
        document.body.classList.add('modal-open');
    }
    closeOverlay() { this.overlay.className = 'overlay'; this.overlay.innerHTML = ''; document.body.classList.remove('modal-open'); }
    field(label, name, value = '', type = 'text', full = false) {
        return `<label class="form-field ${full ? 'full' : ''}"><span>${esc(label)}</span>${type === 'textarea' ? `<textarea name="${name}">${esc(value)}</textarea>` : `<input name="${name}" type="${type}" value="${esc(value)}">`}</label>`;
    }
    openRecordDialog(type, id, parentId) {
        const record = id ? this.byId(id) : {};
        const title = id ? 'Править сведения' : type === 'party' ? 'Новая партия' : type === 'character' ? 'Создать персонажа' : 'Новая сессия';
        let fields = '';
        if (type === 'party')
            fields = `${this.field('Название', 'title', record.title || '')}${this.field('Количество игроков', 'players_count', record.players_count || '0', 'number')}${this.field('Описание', 'description', record.description || '', 'textarea', true)}${this.field('Дата начала', 'start_date', record.start_date || '', 'date')}<label class="form-field"><span>Статус</span><select name="status">${['В процессе', 'На паузе', 'Завершена'].map(value => `<option ${record.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${this.field('Отряд', 'party', record.party || '', 'textarea', true)}${this.field('Текущая цель', 'goal', record.goal || '', 'textarea', true)}`;
        if (type === 'session')
            fields = `${this.field('Название сессии', 'title', record.title || '')}${this.field('Дата', 'date', record.date || '', 'date')}${this.field('Место', 'location', record.location || '')}${this.field('Описание', 'description', record.description || '', 'textarea', true)}`;
        if (type === 'character')
            fields = `${this.iconField('Имя', 'name', record.name || '', '●', 'Введите имя персонажа…')}${this.iconField('Раса', 'race', record.race || '', '❧', 'Укажите расу…')}${this.iconField('Класс', 'class', record.class || '', '⚔', 'Укажите класс…')}${this.iconField('Предыстория', 'background', record.background || '', '▤', 'Укажите предысторию…')}<div class="section-label full"><i></i><span>Характеристики</span><i></i></div><div class="ability-input-grid full">${ABILITIES.map(a => this.abilityInput(a.key, a.short, a.icon, record[a.key] ?? 10)).join('')}</div>`;
        const formClass = type === 'character' ? 'record-form character-form' : 'record-form';
        this.showOverlay(`<section class="modal-sheet ${type === 'character' ? 'character-modal' : ''}">${type === 'character' ? '<div class="modal-crest"><img src="./assets/dragon-crest.svg" alt=""></div>' : ''}<button class="modal-close" data-action="close-overlay" aria-label="Закрыть">×</button><header class="modal-header"><h2>${title}</h2>${type === 'character' ? '<p>Большие истории начинаются с маленьких решений</p>' : ''}</header><form id="record-form" class="${formClass}" data-type="${type}" data-id="${esc(id || '')}" data-parent="${esc(parentId || record.parent_id || '')}">${fields}${this.uploadField(type === 'character' ? 'Портрет' : 'Обложка', type === 'character')}<p class="form-error full" role="alert"></p><div class="form-actions full"><button type="button" class="button-secondary" data-action="close-overlay">Отмена</button><button type="submit" class="button-primary">Сохранить</button></div></form></section>`, type === 'character' ? 'character-overlay' : '');
        document.querySelector('#record-form').addEventListener('submit', event => void this.saveRecord(event));
        const file = document.querySelector('#record-form input[type=file]');
        file?.addEventListener('change', () => { const name = document.querySelector('.upload-name'); if (name)
            name.textContent = file.files?.[0]?.name || 'JPG, PNG, WEBP или GIF · до 20 МБ'; });
        document.querySelectorAll('.ability-input input').forEach(input => input.addEventListener('input', () => { const badge = input.closest('.ability-input').querySelector('em'); badge.textContent = signed(modifier(clampScore(input.value))); }));
    }
    iconField(label, name, value, icon, placeholder) {
        return `<label class="form-field icon-field"><span><b>${icon}</b>${label}</span><input name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
    }
    abilityInput(key, label, icon, value) {
        const score = clampScore(value);
        return `<label class="ability-input"><span class="ability-icon">${icon}</span><b>${label}</b><input name="${key}" type="number" min="1" max="30" value="${score}"><em>${signed(modifier(score))}</em></label>`;
    }
    uploadField(label, portrait) {
        return `<div class="upload-section full"><div class="section-label"><i></i><span>${label}</span><i></i></div><label class="upload-card ${portrait ? 'portrait-upload' : ''}"><span class="upload-preview"><img src="${portrait ? './assets/character-silhouette.svg' : './assets/campaign-gothic.svg'}" alt=""><b>+</b></span><span class="upload-copy"><strong>${portrait ? 'Загрузите портрет персонажа' : 'Добавьте обложку'}</strong><span>${portrait ? 'Выберите изображение, которое отразит характер вашего героя.' : 'Обложка поможет быстро найти нужную историю.'}</span><span class="upload-trigger">▧ &nbsp; Выбрать файл</span><small class="upload-name">JPG, PNG, WEBP или GIF · до 20 МБ</small></span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label></div>`;
    }
    async saveRecord(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const type = form.dataset.type;
        const id = form.dataset.id || crypto.randomUUID();
        const data = new FormData(form);
        const values = {};
        for (const [key, value] of data.entries())
            if (key !== 'image')
                values[key] = typeof value === 'string' ? value.trim() : value;
        if (type === 'party')
            values.players_count = Number(values.players_count) || 0;
        if (type === 'session' && form.dataset.parent)
            values.parent_id = form.dataset.parent;
        if (type === 'character')
            for (const ability of ABILITIES)
                values[ability.key] = clampScore(values[ability.key]);
        const file = data.get('image');
        const media = file instanceof File && file.size ? await prepareImage(file) : null;
        if (media)
            values.image_id = media.id;
        await this.db.change(type, id, values, media);
        this.closeOverlay();
        if (type === 'party')
            location.hash = `party/${id}`;
        if (type === 'character') {
            this.selectedCharacter = id;
            location.hash = 'character';
        }
        await this.refresh();
        this.cloud.schedule();
        this.toast('Сохранено');
    }
    async openEditor(id) {
        let record = this.byId(id);
        if (!record) {
            const split = id.lastIndexOf(':');
            const parent = this.byId(id.slice(0, split));
            const kind = id.slice(split + 1);
            const label = parent ? SECTION_KINDS[parent.type]?.find(([k]) => k === kind)?.[1] : undefined;
            if (!parent || !label)
                return;
            record = this.sectionRecord(parent, kind, label);
        }
        this.showOverlay(`<section class="modal-sheet editor-modal"><button class="modal-close" data-action="close-overlay">×</button><header class="modal-header"><h2>${esc(record.title || 'Запись')}</h2></header><div class="editor-toolbar"><button data-command="bold"><b>B</b></button><button data-command="insertUnorderedList">•</button><button data-command="undo">↶</button></div><div id="editor" class="rich-editor" contenteditable="true">${sanitizeHtml(record.content || '')}</div><div class="form-actions"><button class="button-secondary" data-action="close-overlay">Отмена</button><button class="button-primary" id="save-editor">Сохранить</button></div></section>`);
        const editor = document.querySelector('#editor');
        document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('mousedown', e => e.preventDefault()));
        document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => { editor.focus(); document.execCommand(button.dataset.command, false); }));
        document.querySelector('#save-editor').addEventListener('click', async () => {
            await this.db.change(record.type, id, { ...record, content: sanitizeHtml(editor.innerHTML), legacy_plain: false }, null, id);
            this.closeOverlay();
            await this.refresh();
            this.cloud.schedule();
            this.toast('Сохранено');
        });
    }
    async deleteRecord(id) {
        const record = this.byId(id);
        if (!record)
            return;
        if (!confirm('Удалить запись? Действие можно отменить только из резервной копии.'))
            return;
        await this.db.change(record.type, id, { deleted_at: new Date().toISOString() });
        if (record.type === 'party')
            location.hash = 'parties';
        await this.refresh();
        this.cloud.schedule();
    }
    openCloudDialog() {
        const signed = this.cloud.session;
        this.showOverlay(`<section class="modal-sheet cloud-modal"><button class="modal-close" data-action="close-overlay">×</button><header class="modal-header"><h2>Облачная синхронизация</h2></header>${signed ? `<p>Аккаунт: ${esc(signed.user.email || '')}</p><div class="cloud-actions">${this.cloud.enabled ? '<button class="button-primary" id="sync-now">Синхронизировать сейчас</button>' : '<button class="button-primary" id="enable-cloud">Синхронизировать данные устройства</button>'}<button class="button-secondary" id="logout">Выйти</button></div>` : `<form id="auth-form" class="record-form">${this.field('Email', 'email', '', 'email', true)}${this.field('Пароль', 'password', '', 'password', true)}<p class="form-error full"></p><div class="form-actions full"><button type="submit" name="mode" value="register" class="button-secondary">Создать аккаунт</button><button type="submit" name="mode" value="login" class="button-primary">Войти</button></div></form>`}<p class="muted-copy">${esc(this.cloud.error)}</p></section>`);
        document.querySelector('#sync-now')?.addEventListener('click', () => void this.cloud.sync());
        document.querySelector('#enable-cloud')?.addEventListener('click', async () => { await this.cloud.useAccount(true); this.closeOverlay(); });
        document.querySelector('#logout')?.addEventListener('click', async () => { await this.cloud.logout(); this.closeOverlay(); });
        document.querySelector('#auth-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const mode = event.submitter;
            try {
                const ok = await this.cloud.login(String(data.get('email')), String(data.get('password')), mode.value === 'register');
                if (ok)
                    this.openCloudDialog();
                else
                    form.querySelector('.form-error').textContent = 'Подтвердите email по ссылке в письме.';
            }
            catch (error) {
                form.querySelector('.form-error').textContent = error instanceof Error ? error.message : 'Ошибка входа';
            }
        });
    }
    toast(message) { this.toastNode.textContent = message; this.toastNode.hidden = false; window.setTimeout(() => this.toastNode.hidden = true, 2600); }
}
new ChroniclesApp().boot().catch(error => {
    const root = document.querySelector('#app');
    if (root)
        root.innerHTML = `<main class="fatal"><h1>Журнал не открылся</h1><p>${esc(error instanceof Error ? error.message : String(error))}</p></main>`;
});
