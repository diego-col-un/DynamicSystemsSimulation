(function (global) {
  const STORAGE_KEY = 'dynamicSystemsRuns';

  function getRuns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function saveRun(record) {
    const list = getRuns();
    list.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 25)));
    return record;
  }

  function clearRuns() {
    localStorage.removeItem(STORAGE_KEY);
  }

  global.DynamicSystemsStore = {
    getRuns,
    saveRun,
    clearRuns
  };
}(window));
