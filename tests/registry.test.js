import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../adapters/registry.js';

const base = { id: 'x', label: 'X', match: h => h === 'x.com', selectors: { answer: 'a', question: 'q', content: 'c' } };

describe('ChatDeck registry', () => {
  beforeEach(() => ChatDeck.resetRegistry());

  it('注册与按 host 匹配（注册序优先）', () => {
    ChatDeck.registerAdapter(base);
    ChatDeck.registerAdapter({ ...base, id: 'y', match: h => h.endsWith('.com') });
    expect(ChatDeck.getAdapterForHost('x.com').id).toBe('x');
    expect(ChatDeck.getAdapterForHost('other.com').id).toBe('y');
    expect(ChatDeck.getAdapterForHost('nothing.org')).toBeNull();
  });
  it('重复 id 与缺字段抛错', () => {
    ChatDeck.registerAdapter(base);
    expect(() => ChatDeck.registerAdapter(base)).toThrow();
    expect(() => ChatDeck.registerAdapter({ ...base, id: 'z', selectors: undefined })).toThrow();
  });
  it('DefaultAdapter.extractContent 剥离脚本与按钮、保留块级文本', () => {
    document.body.innerHTML = `<div id="ans"><p>第一段</p><script>evil()</script><button>复制</button><pre>code()</pre></div>`;
    const out = ChatDeck.DefaultAdapter.extractContent.call({}, document.getElementById('ans'));
    expect(out).toContain('第一段');
    expect(out).toContain('code()');
    expect(out).not.toContain('evil');
    expect(out).not.toContain('复制');
  });
  it('DefaultAdapter.findQuestion 在共同容器内向前找最近问题', () => {
    document.body.innerHTML = `<div class="wrap"><div class="q">问题一</div><div class="a">答一</div></div>
      <div class="wrap"><div class="q">问题二</div><div class="a" id="a2">答二</div></div>`;
    const q = ChatDeck.DefaultAdapter.findQuestion.call(
      { selectors: { question: '.q' } }, document.getElementById('a2'));
    expect(q.textContent).toBe('问题二');
  });
  it('Logger 默认静默、debug 为真时输出', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    ChatDeck.log('hi');
    expect(spy).not.toHaveBeenCalled();
    ChatDeck.debug = true; ChatDeck.log('hi');
    expect(spy).toHaveBeenCalled();
  });
});
