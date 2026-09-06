(() => {
  'use strict';

  const DATA_KEY = 'seeker-chronicles:v2';
  let bypassNextCardOpen = false;
  let sourceButton = null;

  document.addEventListener('DOMContentLoaded', ensureReader);
  document.addEventListener('click', interceptSessionOpen, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeReader();
  });

  function ensureReader() {
    if (document.getElementById('sessionReadModal')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'sessionReadBackdrop';
    backdrop.className = 'session-read-backdrop is-hidden';

    const modal = document.createElement('section');
    modal.id = 'sessionReadModal';
    modal.className = 'session-read-modal is-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sessionReadTitle');
    modal.innerHTML = `
      <button class="session-read-close" id="sessionReadClose" type="button" aria-label="Закрыть">×</button>
      <div class="session-read-heading">
        <p class="eyebrow">Игровой день</p>
        <h2 id="sessionReadTitle"></h2>
      </div>
      <article class="session-read-content" id="sessionReadContent"></article>
      <div class="session-read-actions">
        <button class="button button-primary" id="sessionReadEdit" type="button">✎ Редактировать</button>
      </div>
    `;

    document.body.append(backdrop, modal);
    backdrop.addEventListener('click', closeReader);
    modal.querySelector('#sessionReadClose').addEventListener('click', closeReader);
    modal.querySelector('#sessionReadEdit').addEventListener('click', editCurrentSession);
  }

  function interceptSessionOpen(event) {
    const button = event.target.closest('.session-cover, .session-card-open');
    if (!button) return;

    if (bypassNextCardOpen) {
      bypassNextCardOpen = false;
      return;
    }

    const card = button.closest('.session-card');
    if (!card) return;

    const session = resolveSessionForCard(card);
    if (!session) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    sourceButton = button;
    openReader(session);
  }

  function resolveSessionForCard(card) {
    const data = readData();
    if (!data) return null;

    const campaign = data.campaigns.find((item) => item.id === data.lastCampaignId) || data.campaigns[0];
    if (!campaign || !Array.isArray(campaign.sessions)) return null;

    const cards = Array.from(document.querySelectorAll('#sessionsGrid .session-card'));
    const index = cards.indexOf(card);
    const sorted = [...campaign.sessions].sort((a, b) => sessionSortValue(b) - sessionSortValue(a));
    if (index >= 0 && sorted[index]) return sorted[index];

    const title = card.querySelector('h4')?.textContent?.trim();
    return campaign.sessions.find((item) => item.title === title) || null;
  }

  function openReader(session) {
    ensureReader();
    const modal = document.getElementById('sessionReadModal');
    const backdrop = document.getElementById('sessionReadBackdrop');
    const title = document.getElementById('sessionReadTitle');
    const content = document.getElementById('sessionReadContent');

    title.textContent = session.title || 'Игровой день';
    const safe = sanitizeHtml(session.notes || '');
    content.innerHTML = safe || '<p class="session-read-empty">В этом дне пока нет текста.</p>';

    backdrop.classList.remove('is-hidden');
    modal.classList.remove('is-hidden');
    document.body.dataset.sessionReaderOpen = 'true';
    document.body.style.overflow = 'hidden';
  }

  function closeReader() {
    const modal = document.getElementById('sessionReadModal');
    const backdrop = document.getElementById('sessionReadBackdrop');
    if (!modal || modal.classList.contains('is-hidden')) return;

    modal.classList.add('is-hidden');
    backdrop?.classList.add('is-hidden');
    delete document.body.dataset.sessionReaderOpen;
    document.body.style.overflow = '';
    sourceButton = null;
  }

  function editCurrentSession() {
    const button = sourceButton;
    if (!button || !button.isConnected) return;

    const modal = document.getElementById('sessionReadModal');
    const backdrop = document.getElementById('sessionReadBackdrop');
    modal?.classList.add('is-hidden');
    backdrop?.classList.add('is-hidden');
    delete document.body.dataset.sessionReaderOpen;
    document.body.style.overflow = '';

    bypassNextCardOpen = true;
    button.click();
    sourceButton = null;
  }

  function readData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      return parsed && Array.isArray(parsed.campaigns) ? parsed : null;
    } catch {
      return null;
    }
  }

  function sessionSortValue(session) {
    if (session?.date) {
      const value = new Date(`${session.date}T12:00:00`).getTime();
      if (!Number.isNaN(value)) return value;
    }
    return Number(session?.createdAt || 0);
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
        if (node.tagName === 'A' && attribute.name === 'href') continue;
        node.removeAttribute(attribute.name);
      }

      if (node.tagName === 'A') {
        const safeUrl = normalizeUrl(node.getAttribute('href') || '');
        if (!safeUrl) {
          node.replaceWith(...node.childNodes);
        } else {
          node.setAttribute('href', safeUrl);
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
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }
})();
