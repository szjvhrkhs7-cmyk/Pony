(() => {
  'use strict';

  const DATA_KEY = 'seeker-chronicles:v2';
  let activeSessionId = null;
  let activeTrigger = null;
  let bypassNextOpen = false;

  function readData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      return parsed && Array.isArray(parsed.campaigns) ? parsed : { campaigns: [] };
    } catch {
      return { campaigns: [] };
    }
  }

  function getCurrentCampaign(data) {
    return data.campaigns.find((item) => item.id === data.lastCampaignId) || data.campaigns[0] || null;
  }

  function sortValue(session) {
    if (session?.date) {
      const value = new Date(`${session.date}T12:00:00`).getTime();
      if (!Number.isNaN(value)) return value;
    }
    return Number(session?.createdAt || 0);
  }

  function getSessionForCard(card) {
    const data = readData();
    const campaign = getCurrentCampaign(data);
    if (!campaign) return null;

    const id = card?.dataset?.sessionId;
    if (id) return campaign.sessions?.find((item) => item.id === id) || null;

    const cards = [...document.querySelectorAll('.session-card')];
    const index = cards.indexOf(card);
    if (index < 0) return null;
    const sessions = [...(campaign.sessions || [])].sort((a, b) => sortValue(b) - sortValue(a));
    const session = sessions[index] || null;
    if (session) card.dataset.sessionId = session.id;
    return session;
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    const allowed = new Set(['P','BR','B','STRONG','I','EM','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A']);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      for (const attribute of [...node.attributes]) {
        if (node.tagName === 'A' && ['href','target','rel'].includes(attribute.name)) continue;
        node.removeAttribute(attribute.name);
      }
      if (node.tagName === 'A') {
        try {
          const url = new URL(node.getAttribute('href') || '', location.href);
          if (!['http:','https:'].includes(url.protocol)) throw new Error('unsafe');
          node.href = url.href;
          node.target = '_blank';
          node.rel = 'noopener noreferrer';
        } catch {
          node.replaceWith(...node.childNodes);
        }
      }
    }
    return template.innerHTML;
  }

  function ensureViewer() {
    let viewer = document.getElementById('sessionReader');
    if (viewer) return viewer;

    viewer = document.createElement('section');
    viewer.id = 'sessionReader';
    viewer.className = 'session-reader is-hidden';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.innerHTML = `
      <div class="session-reader-topbar">
        <button class="session-reader-back" type="button" aria-label="Назад">‹</button>
        <strong class="session-reader-heading">Игровой день</strong>
        <span class="session-reader-spacer" aria-hidden="true"></span>
      </div>
      <article class="session-reader-paper">
        <h2 class="session-reader-title"></h2>
        <div class="session-reader-text"></div>
      </article>
      <div class="session-reader-actions">
        <button class="button button-primary session-reader-edit" type="button">✎ Редактировать</button>
      </div>
    `;
    document.body.append(viewer);

    viewer.querySelector('.session-reader-back').addEventListener('click', closeViewer);
    viewer.querySelector('.session-reader-edit').addEventListener('click', editCurrentSession);
    return viewer;
  }

  function openViewer(session, trigger) {
    if (!session) return;
    const viewer = ensureViewer();
    activeSessionId = session.id;
    activeTrigger = trigger;

    viewer.querySelector('.session-reader-title').textContent = session.title || 'Игровой день';
    const text = viewer.querySelector('.session-reader-text');
    const safe = sanitizeHtml(session.notes || '');
    text.innerHTML = safe || '<p class="session-reader-empty">Здесь пока нет текста.</p>';

    viewer.classList.remove('is-hidden');
    document.body.classList.add('session-reader-open');
    viewer.querySelector('.session-reader-back').focus({ preventScroll: true });
  }

  function closeViewer() {
    const viewer = document.getElementById('sessionReader');
    viewer?.classList.add('is-hidden');
    document.body.classList.remove('session-reader-open');
    activeSessionId = null;
    activeTrigger = null;
  }

  function editCurrentSession() {
    const trigger = activeTrigger;
    closeViewer();
    if (!trigger?.isConnected) return;
    bypassNextOpen = true;
    trigger.click();
  }

  function interceptOpen(event) {
    const trigger = event.target.closest('.session-card-open,.session-cover');
    if (!trigger) return;

    if (bypassNextOpen) {
      bypassNextOpen = false;
      return;
    }

    const card = trigger.closest('.session-card');
    const session = getSessionForCard(card);
    if (!session) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openViewer(session, trigger);
  }

  function refreshSessionIds() {
    const data = readData();
    const campaign = getCurrentCampaign(data);
    const cards = [...document.querySelectorAll('.session-card')];
    if (!campaign || !cards.length) return;
    const sessions = [...(campaign.sessions || [])].sort((a, b) => sortValue(b) - sortValue(a));
    cards.forEach((card, index) => {
      if (sessions[index]) card.dataset.sessionId = sessions[index].id;
    });
  }

  document.addEventListener('click', interceptOpen, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById('sessionReader')?.classList.contains('is-hidden')) closeViewer();
  });

  function boot() {
    ensureViewer();
    const grid = document.getElementById('sessionsGrid');
    if (grid) new MutationObserver(refreshSessionIds).observe(grid, { childList: true });
    refreshSessionIds();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
