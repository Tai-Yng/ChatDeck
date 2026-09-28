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
          // 命名空间级事件回调为 (changes, areaName)；按所属 area 过滤。
          // 三级兜底：chrome.storage.onChanged → area.changed（测试假对象）→ 空事件源（绝不抛错）
          const listener = (changes, changedArea) => {
            if (areaName && changedArea && changedArea !== areaName) return;
            cb(changes);
          };
          const ns = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged)
            || area.changed
            || { addListener() {}, removeListener() {} };
          ns.addListener(listener);
          return () => ns.removeListener(listener);
        },
      };
    },
  };
})();
