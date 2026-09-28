import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../adapters/registry.js';
import '../core/storage.js';
import '../core/capture.js';
import '../core/manager.js';
import '../core/content.js';

ChatDeck.registerAdapter({
  id: 'fake', label: 'Fake', match: h => h === 'fake.test',
  selectors: { answer: '.ans', question: '.q', content: '.ans' },
});

function fakeArea() {
  const data = { enabled: true };
  const listeners = new Set();
  return {
    get: async key => (key in data ? { [key]: data[key] } : {}),
    set: async o => Object.assign(data, o),
    changed: { addListener: cb => listeners.add(cb), removeListener: cb => listeners.delete(cb) },
    fire: changes => listeners.forEach(cb => cb(changes)),
    raw: data,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.querySelectorAll('.chatdeck-root').forEach(n => n.remove());
  // 测试会改写模块级共享 adapter 的 shouldActivate，用后恢复
  const a = ChatDeck.getAdapterForHost('fake.test');
  if (a) delete a.shouldActivate;
});

describe('ChatDeckBoot', () => {
  it('不支持的域名 → null，不注入', async () => {
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'other.com' });
    expect(r).toBeNull();
  });
  it('enabled=false → 不注入', async () => {
    const area = fakeArea(); area.raw.enabled = false;
    expect(await ChatDeckBoot.boot({ doc: document, storageArea: area, hostname: 'fake.test' })).toBeNull();
  });
  it('shouldActivate 立即为真 → 注入且 getStatus 可用', async () => {
    document.body.innerHTML = `<div class="q">Q</div><div class="ans">A 内容</div>`;
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'fake.test' });
    expect(r.manager.root).toBeTruthy();
    const status = await new Promise(res => ChatDeckBoot.handleMessage({ action: 'getStatus' }, res));
    expect(status.platform).toBe('Fake');
    expect(status.count).toBe(1);
  });
  it('popup 启用开关实时生效：false 隐藏窗口，true 恢复', async () => {
    const area = fakeArea();
    document.body.innerHTML = `<div class="q">Q</div><div class="ans">A 内容</div>`;
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: area, hostname: 'fake.test' });
    expect(r.manager.root.style.display).not.toBe('none');
    area.fire({ enabled: { newValue: false } });
    expect(r.manager.root.style.display).toBe('none');
    area.fire({ enabled: { newValue: true } });
    expect(r.manager.root.style.display).toBe('block');
  });
  it('SPA 挂载竞态：shouldActivate 延迟为真 → 宽限期内轮询后激活', async () => {
    vi.useFakeTimers();
    let mounted = false;
    ChatDeck.getAdapterForHost('fake.test').shouldActivate = () => mounted;
    const pending = ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'fake.test' });
    let settled = null;
    pending.then(v => { settled = v; });
    await vi.advanceTimersByTimeAsync(2000);
    expect(settled).toBeNull();          // 挂载前保持等待
    document.body.innerHTML = `<div class="ans">A</div>`;
    mounted = true;
    await vi.advanceTimersByTimeAsync(1000);
    const r = await pending;
    expect(r && r.manager.root).toBeTruthy();   // 挂载后激活
    vi.useRealTimers();
  });
  it('shouldActivate 宽限期超时 → 放弃注入', async () => {
    vi.useFakeTimers();
    ChatDeck.getAdapterForHost('fake.test').shouldActivate = () => false;
    const pending = ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'fake.test' });
    await vi.advanceTimersByTimeAsync(26000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });
});
