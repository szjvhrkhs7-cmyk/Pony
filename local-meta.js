(() => {
  const DATA_KEY = 'seeker-chronicles:v2';
  const DEVICE_KEY = 'seeker-chronicles:device-id';
  let lastSemantic = null;
  let internalWrite = false;

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function semantic(value) {
    if (!value || typeof value !== 'object') return '';
    const clone = structuredClone(value);
    delete clone.clientUpdatedAt;
    delete clone.deviceId;
    return JSON.stringify(clone);
  }

  function inspect() {
    if (internalWrite) return;
    let data;
    try {
      data = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
    } catch {
      return;
    }
    if (!data || !Array.isArray(data.campaigns)) return;

    const currentSemantic = semantic(data);
    if (lastSemantic === null) {
      lastSemantic = currentSemantic;
      if (!data.clientUpdatedAt || !data.deviceId) {
        data.clientUpdatedAt ||= Date.now();
        data.deviceId ||= getDeviceId();
        internalWrite = true;
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        internalWrite = false;
      }
      return;
    }

    if (currentSemantic !== lastSemantic) {
      lastSemantic = currentSemantic;
      data.clientUpdatedAt = Date.now();
      data.deviceId = getDeviceId();
      internalWrite = true;
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      internalWrite = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    inspect();
    setInterval(inspect, 500);
  });
})();
