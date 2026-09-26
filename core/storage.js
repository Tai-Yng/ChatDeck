// core/storage.js —— chrome.storage 封装：Promise 化 get/set + 变更订阅
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.ChatDeckStorage = {
    create(area) {
      return {
        async get(key, defaultValue) {
          const res = await area.get([key]);
          return key in res ? res[key] : defaultValue;
        },
        async set(obj) { await area.set(obj); },
        onChange(cb) {
          const listener = changes => cb(changes);
          area.changed.addListener(listener);
          return () => area.changed.removeListener(listener);
        },
      };
    },
  };
})();
