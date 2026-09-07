/* Read-only dashboard projections; campaign/session persistence stays in app.js. */
(() => {
  const tabs = [...document.querySelectorAll('[data-view]')];
  const screen = document.getElementById('recordsScreen');
  const content = document.getElementById('recordsContent');
  const search = document.getElementById('campaignSearch');
  let currentView = 'games';
  const byRecent = (a, b) => sessionSortValue(b.session) - sessionSortValue(a.session);
  const sessions = () => state.data.campaigns.flatMap(campaign => campaign.sessions.map(session => ({ campaign, session }))).sort(byRecent);
  function button(title, detail, action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dashboard-link';
    const strong = document.createElement('strong'); strong.textContent = title;
    const span = document.createElement('span'); span.textContent = detail;
    b.append(strong, span); b.addEventListener('click', action); return b;
  }
  function list(target, values, fallback, make) {
    const el = document.getElementById(target); el.replaceChildren();
    if (!values.length) { const li = document.createElement('li'); li.className = 'muted'; li.textContent = fallback; el.append(li); }
    values.forEach(value => { const li = document.createElement('li'); li.append(make(value)); el.append(li); });
  }
  function selectCampaign(campaign) { currentView = 'games'; activate(); openCampaign(campaign.id); }
  function activate() {
    tabs.forEach(tab => { const active = tab.dataset.view === currentView; tab.classList.toggle('is-active', active); if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); });
    screen.classList.toggle('is-hidden', currentView === 'games');
    if (currentView !== 'games') { els.homeScreen.classList.add('is-hidden'); els.workspace.classList.add('is-hidden'); }
  }
  function refreshDashboard() {
    list('recentSessions', sessions().slice(0, 3), 'Здесь появятся записи ваших игровых дней.', ({campaign, session}) => button(session.title, `${campaign.name} · ${formatDate(session.date) || 'Без даты'}`, () => { selectCampaign(campaign); openSessionReader(session); }));
    const notes = state.data.campaigns.filter(c => c.quickNotes.trim());
    list('recentNotes', notes.slice(0, 3), 'Сохраните напоминание внутри кампании.', campaign => button(campaign.name, campaign.quickNotes.length > 95 ? campaign.quickNotes.slice(0, 95) + '…' : campaign.quickNotes, () => { selectCampaign(campaign); els.quickNotes.focus(); }));
    const recent = state.data.campaigns.find(c => c.id === state.data.lastCampaignId) || state.data.campaigns[0];
    document.getElementById('continueCopy').textContent = recent ? recent.name : 'Здесь будет ваша последняя кампания.';
    document.getElementById('continueCampaign').textContent = recent ? 'К кампании →' : 'Создать игру';
    document.getElementById('continueCampaign').onclick = () => recent ? selectCampaign(recent) : openCampaignModal();
    document.getElementById('nextReminder').textContent = notes[0]?.quickNotes || 'Напоминания из ваших кампаний будут под рукой.';
    applySearch();
  }
  function applySearch() {
    const query = search.value.trim().toLocaleLowerCase('ru'); let visible = 0;
    document.querySelectorAll('.campaign-card').forEach(card => { const show = card.textContent.toLocaleLowerCase('ru').includes(query); card.hidden = !show; if (show) visible++; });
    document.getElementById('searchEmpty').classList.toggle('is-hidden', !query || visible > 0 || state.data.campaigns.length === 0);
  }
  function records(view) {
    flushCampaignTextSave(); currentView = view; activate(); content.replaceChildren();
    document.getElementById('recordsTitle').textContent = {sessions:'Игровые сессии',notes:'Заметки к играм',more:'Моя записная книжка'}[view];
    if (view === 'sessions') {
      sessions().forEach(({campaign, session}) => { const item = button(session.title, `${campaign.name} · ${formatDate(session.date) || 'Без даты'}`, () => { selectCampaign(campaign); openSessionReader(session); }); item.classList.add('paper-panel'); content.append(item); });
    } else if (view === 'notes') {
      state.data.campaigns.filter(c => c.quickNotes.trim() || textFromHtml(c.journal).trim()).forEach(campaign => {
        const article = document.createElement('article'); article.className = 'paper-panel notes-entry';
        const h = document.createElement('h3'); h.textContent = campaign.name;
        const p = document.createElement('p'); p.textContent = campaign.quickNotes || textFromHtml(campaign.journal);
        const edit = button('Открыть кампанию →', '', () => selectCampaign(campaign)); article.append(h, p, edit); content.append(article);
      });
    } else {
      content.className = 'more-actions';
      [['Синхронизация','Подключить облако','cloudButton'],['Экспорт','Скачать резервную копию','exportButton'],['Импорт','Восстановить из файла','importInput']].forEach(([title, detail, id]) => { const action = button(title,detail,()=>document.getElementById(id).click()); action.classList.add('paper-panel');content.append(action); });
    }
    if(view !== 'more') content.className = 'all-records';
    if (!content.children.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = view === 'sessions' ? 'Добавьте игровой день внутри кампании. Здесь соберутся все сессии.' : 'Заметки и напоминания из ваших кампаний появятся здесь.'; content.append(p); }
  }
  tabs.forEach(tab => tab.addEventListener('click', () => { if(tab.dataset.view === 'games') { currentView = 'games'; activate(); backToGames(); } else records(tab.dataset.view); }));
  document.getElementById('newCampaignButton').addEventListener('click', () => { if (currentView !== 'games') { currentView = 'games'; activate(); backToGames(); } }, {capture:true});
  search.addEventListener('input', () => { if (currentView !== 'games' || state.currentCampaignId) {currentView = 'games';activate();backToGames();} applySearch(); });
  new MutationObserver(() => { refreshDashboard(); if (currentView !== 'games') activate(); }).observe(els.campaignsStrip, {childList:true});
  refreshDashboard();
})();
