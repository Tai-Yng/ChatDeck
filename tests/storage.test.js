import { describe, it, expect } from 'vitest';
import '../core/storage.js';

function fakeArea() {
  const data = {}; const listeners = new Set();
  return {
    data,
    get: async keys => { const out = {}; (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (k in data) out[k] = data[k]; }); return out; },
    set: async obj => { Object.assign(data, obj); listeners.forEach(cb => cb(obj)); },
    changed: { addListener: cb => listeners.add(cb), removeListener: cb => listeners.delete(cb) },
  };
}

describe('ChatDeckStorage', () => {
  it('get 返回默认值、set 写入后再读生效', async () => {
    const area = fakeArea(); const store = ChatDeckStorage.create(area);
    expect(await store.get('enabled', true)).toBe(true);
    await store.set({ enabled: false });
    expect(await store.get('enabled', true)).toBe(false);
  });
  it('onChange 触发且退订后不再触发', async () => {
    const area = fakeArea(); const store = ChatDeckStorage.create(area);
    const seen = []; const off = store.onChange(v => seen.push(v));
    await store.set({ enabled: false }); off(); await store.set({ enabled: true });
    expect(seen.length).toBe(1);
  });
  it('真实 Chrome 形态：订阅命名空间级 chrome.storage.onChanged 并按 area 过滤', async () => {
    const nsListeners = new Set();
    globalThis.chrome = { storage: { onChanged: {
      addListener: cb => nsListeners.add(cb),
      removeListener: cb => nsListeners.delete(cb),
    } } };
    const area = fakeArea();                       // 假对象的 area.changed 应被命名空间级覆盖
    const store = ChatDeckStorage.create(area, 'sync');
    const seen = [];
    const off = store.onChange(v => seen.push(v));
    expect(nsListeners.size).toBe(1);
    const fire = [...nsListeners][0];
    fire({ enabled: { newValue: false } }, 'local');   // 其它 area → 过滤
    fire({ enabled: { newValue: true } }, 'sync');     // sync → 通过
    expect(seen.length).toBe(1);
    off();
    expect(nsListeners.size).toBe(0);
    delete globalThis.chrome;
  });
});
