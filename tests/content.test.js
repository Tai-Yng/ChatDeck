import { describe, it, expect, beforeEach } from 'vitest';
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
  return {
    get: async key => (key in data ? { [key]: data[key] } : {}),
    set: async o => Object.assign(data, o),
    changed: { addListener: () => {}, removeListener: () => {} },
    raw: data,
  };
}

describe('ChatDeckBoot', () => {
beforeEach(() => {
  document.body.innerHTML = '';
  document.querySelectorAll('.chatdeck-root').forEach(n => n.remove());
  // 测试会改写模块级共享 adapter 的 shouldActivate，用后恢复
  const a = ChatDeck.getAdapterForHost('fake.test');
  if (a) delete a.shouldActivate;
});

  it('不支持的域名 → null，不注入', async () => {
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'other.com' });
    expect(r).toBeNull();
  });
  it('shouldActivate 为假 → 不注入（Review Focus：登出态首页）', async () => {
    ChatDeck.getAdapterForHost('fake.test').shouldActivate = () => false;
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: fakeArea(), hostname: 'fake.test' });
    expect(r).toBeNull();
  });
  it('enabled=false → 不注入；enabled=true → 注入且 getStatus 可用', async () => {
    const area = fakeArea(); area.raw.enabled = false;
    expect(await ChatDeckBoot.boot({ doc: document, storageArea: area, hostname: 'fake.test' })).toBeNull();
    area.raw.enabled = true;
    document.body.innerHTML = `<div class="q">Q</div><div class="ans">A 内容</div>`;
    const r = await ChatDeckBoot.boot({ doc: document, storageArea: area, hostname: 'fake.test' });
    expect(r.manager.root).toBeTruthy();
    const status = await new Promise(res => ChatDeckBoot.handleMessage({ action: 'getStatus' }, res));
    expect(status.platform).toBe('Fake');
    expect(status.count).toBe(1);
  });
});
