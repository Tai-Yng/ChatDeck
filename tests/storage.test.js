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
});
