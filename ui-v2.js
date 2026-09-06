(() => {
  'use strict';

  const DATA_KEY = 'seeker-chronicles:v2';
  const DB_NAME = 'seeker-chronicles-media-v2';
  const DB_VERSION = 1;
  const STORE = 'session-covers';
  const urls = new Map();
  let decorateTimer = null;

  function readData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      return parsed && Array.isArray(parsed.campaigns) ? parsed : { campaigns: [] };
    } catch {
      return { campaigns: [] };
    }
  }

  function sessionSortValue(session) {
    if (session?.date) {
      const value = new Date(`${session.date}T12:00:00`).getTime();
      if (!Number.isNaN(value)) return value;
    }
    return Number(session?.createdAt || 0);
  }

  function latestSession(campaign) {
    return [...(campaign?.sessions || [])].sort((a, b) => sessionSortValue(b) - sessionSortValue(a))[0] || null;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getCover(id) {
    if (!id) return null;
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  function clearUrls() {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }

  async function decorateCampaigns() {
    const strip = document.getElementById('campaignsStrip');
    if (!strip) return;

    clearUrls();
    const data = readData();
    const cards = [...strip.querySelectorAll('.campaign-card')];

    cards.forEach((card, index) => {
      const campaign = data.campaigns[index];
      if (!campaign) return;

      card.dataset.campaignId = campaign.id;
      let thumb = card.querySelector('.campaign-thumb');
      if (!thumb) {
        thumb = document.createElement('span');
        thumb.className = 'campaign-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        card.prepend(thumb);
      }

      const count = campaign.sessions?.length || 0;
      const countLabel = card.querySelector('span:not(.campaign-thumb)');
      if (countLabel) countLabel.textContent = `${count} ${plural(count, 'день', 'дня', 'дней')}`;

      const recent = latestSession(campaign);
      if (!recent) return;
      getCover(recent.id).then((blob) => {
        if (!blob || !thumb.isConnected) return;
        const url = URL.createObjectURL(blob);
        urls.set(campaign.id, url);
        thumb.style.backgroundImage = `linear-gradient(rgba(28,7,11,.08),rgba(28,7,11,.2)),url("${url}")`;
      }).catch(() => {});
    });
  }

  function plural(value, one, few, many) {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateCampaigns, 60);
  }

  function boot() {
    const title = document.querySelector('.topbar h1');
    if (title) title.textContent = 'Мои игры';

    const strip = document.getElementById('campaignsStrip');
    if (strip) new MutationObserver(scheduleDecorate).observe(strip, { childList: true });

    window.addEventListener('storage', scheduleDecorate);
    scheduleDecorate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('beforeunload', clearUrls);
})();
