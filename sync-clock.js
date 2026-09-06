(() => {
  'use strict';

  const DATA_KEY = 'seeker-chronicles:v2';
  let lastContent = '';
  let lastTimestamp = 0;

  function read() {
    try {
      return JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function contentFingerprint(data) {
    if (!data || typeof data !== 'object') return '';
    const copy = structuredClone(data);
    delete copy.clientUpdatedAt;
    delete copy.deviceId;
    return JSON.stringify(copy);
  }

  function initialize() {
    const data = read();
    lastContent = contentFingerprint(data);
    lastTimestamp = Number(data?.clientUpdatedAt || 0);
  }

  function check() {
    const data = read();
    if (!data || !Array.isArray(data.campaigns)) return;

    const currentContent = contentFingerprint(data);
    const incomingTimestamp = Number(data.clientUpdatedAt || 0);
    if (currentContent === lastContent) {
      lastTimestamp = Math.max(lastTimestamp, incomingTimestamp);
      return;
    }

    // Cloud sync writes a new payload together with a newer timestamp.
    // Preserve that timestamp. Normal app edits keep the previous timestamp
    // (or omit it), so those changes get a fresh local-edit timestamp here.
    if (!incomingTimestamp || incomingTimestamp <= lastTimestamp) {
      data.clientUpdatedAt = Date.now();
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      lastTimestamp = data.clientUpdatedAt;
    } else {
      lastTimestamp = incomingTimestamp;
    }

    lastContent = currentContent;
  }

  initialize();
  setInterval(check, 250);
})();
