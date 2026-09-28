// core/storage.js —— chrome.storage 封装：Promise 化 get/set + 变更订阅
// 注意：变更事件在命名空间级 chrome.storage.onChanged（回调带 areaName），
// 不存在 chrome.storage.sync.changed；area.changed 仅用于测试假对象。
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.ChatDeckStorage = {
    create(area, areaName) {
      return {
        async get(key, defaultValue) {
          const res = await area.get([key]);
          return key in res ? res[key] : defaultValue;
        },
        async set(obj) { await area.set(obj); },
        onChange(cb) {
          const listener = changes => cb(changes);
          const ns = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) || area.changed;
          ns.addListener(listener);
          return () => ns.removeListener(listener);
        },
      };
    },
  };
})();
