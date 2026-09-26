// tests/capture.test.js —— 语义测试直接调 scan()/fullRescan()，不依赖 MutationObserver 触发时机
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../adapters/registry.js';
import '../core/capture.js';

function makeAdapter(overrides = {}) {
  return {
    id: 'fake', label: 'Fake', match: () => true,
    selectors: { answer: '.ans', question: '.q', content: '.ans' },
    ...overrides,
  };
}
function setDom(html) { document.body.innerHTML = html; }

beforeEach(() => { vi.useFakeTimers(); setDom(''); });

describe('ChatDeckCapture', () => {
  it('全量回溯：按文档序建立多条历史', () => {
    setDom(`<div class="q">Q1</div><div class="ans">A1</div><div class="q">Q2</div><div class="ans">A2</div>`);
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    c.fullRescan();
    expect(c.responses.length).toBe(2);
    expect(c.responses[0].answer).toBe('A1');
    expect(c.responses[1].question).toBe('Q2');
  });
  it('新节点 → 追加；同节点变异 → 替换（重生成语义，Review Focus #5）', () => {
    setDom(`<div class="q">Q1</div><div class="ans" id="a1">A1</div>`);
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    c.start();
    expect(c.responses.length).toBe(1);
    document.getElementById('a1').textContent = '完全新内容完全不同长文本加长';
    c.scan();
    expect(c.responses.length).toBe(1);            // 替换不追加
    expect(c.responses[0].answer).toContain('完全新内容');
    const div = document.createElement('div'); div.className = 'ans'; div.textContent = 'A2';
    document.body.appendChild(div);
    c.scan();
    expect(c.responses.length).toBe(2);            // 新节点追加
  });
  it('流式更新：isGenerating 时 800ms 节流', () => {
    setDom(`<div class="q">问题</div><div class="ans" id="s">答案甲</div>`);
    const c = new ChatDeckCapture(makeAdapter({ isGenerating: () => true }), { onUpdate: vi.fn() });
    c.start();
    const el = document.getElementById('s');
    el.textContent = '答案甲补充'; c.scan();
    expect(c.responses[0].answer).toBe('答案甲补充');   // 第一次立即更新
    el.textContent = '答案甲补充再改'; vi.setSystemTime(Date.now() + 300); c.scan();
    expect(c.responses[0].answer).not.toContain('再改'); // 800ms 内跳过
    vi.setSystemTime(Date.now() + 900); c.scan();
    expect(c.responses[0].answer).toContain('再改');     // 超过节流窗口更新
  });
  it('isNewChat 触发清空重建', () => {
    setDom(`<div class="q">Q1</div><div class="ans" id="a1">A1</div>`);
    let fresh = false;
    const c = new ChatDeckCapture(makeAdapter({ isNewChat: () => fresh }), { onUpdate: vi.fn() });
    c.start();
    expect(c.responses.length).toBe(1);
    fresh = true;
    document.getElementById('a1').textContent = 'A1 更新';
    c.scan();
    expect(c.responses.length).toBe(1); // 清空重建后仍 1 条
  });
  it('空闲重扫：漏捕节点被 3s 兜底补上', () => {
    setDom(`<div class="ans">A1</div>`);
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    c.start();
    expect(c.responses.length).toBe(1);
    setDom(`<div class="ans">A1</div><div class="ans">A2</div>`); // 未触发 mutation 的场景模拟
    vi.advanceTimersByTime(3100);
    expect(c.responses.length).toBe(2);
  });
  it('200 节点回溯分批完成、不抛错（Review Focus #2）', () => {
    setDom(Array.from({ length: 200 }, (_, i) => `<div class="ans">A${i}</div>`).join(''));
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    c.fullRescan();
    vi.advanceTimersByTime(5000);
    expect(c.responses.length).toBe(200);
  });
});
