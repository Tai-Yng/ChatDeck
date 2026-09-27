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
  it('合并回溯：分批出现的消息累积而非替换（虚拟列表场景）', () => {
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    setDom(`<div class="ans">消息四的完整内容</div><div class="ans">消息五的完整内容</div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    expect(c.responses.map(r => r.answer)).toEqual(['消息四的完整内容', '消息五的完整内容']);
    setDom(`<div class="ans">消息二的完整内容</div><div class="ans">消息三的完整内容</div><div class="ans">消息四的完整内容</div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    expect(c.responses.map(r => r.answer)).toEqual(['消息二的完整内容', '消息三的完整内容', '消息四的完整内容', '消息五的完整内容']);
    setDom(`<div class="ans">消息一的完整内容</div><div class="ans">消息二的完整内容</div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    expect(c.responses.map(r => r.answer)).toEqual(['消息一的完整内容', '消息二的完整内容', '消息三的完整内容', '消息四的完整内容', '消息五的完整内容']);
  });
  it('合并回溯：末尾新消息追加在正确位置', () => {
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    setDom(`<div class="ans">消息一的完整内容</div><div class="ans">消息二的完整内容</div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    setDom(`<div class="ans">消息二的完整内容</div><div class="ans">消息三的完整内容</div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    expect(c.responses.map(r => r.answer)).toEqual(['消息一的完整内容', '消息二的完整内容', '消息三的完整内容']);
  });
  it('合并回溯：同问题+旧节点已卸载 → 原位替换（重新生成重挂载）', () => {
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    setDom(`<div><div class="q">问题甲</div><div class="ans" id="n1">消息一的完整内容</div></div><div><div class="q">问题乙</div><div class="ans">消息二的完整内容</div></div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    setDom(`<div><div class="q">问题甲</div><div class="ans" id="n1">重新生成的全新内容完全不同</div></div><div><div class="q">问题乙</div><div class="ans">消息二的完整内容</div></div>`);
    c.fullRescan(); vi.advanceTimersByTime(50);
    expect(c.responses.length).toBe(2);
    expect(c.responses[0].answer).toContain('重新生成');
    expect(c.responses[1].answer).toBe('消息二的完整内容');
  });
  it('自动行走：滚动容器存在时收齐历史并恢复滚动位置', async () => {
    vi.useFakeTimers();
    const host = { scrollTop: 100, clientHeight: 100, scrollHeight: 300 };
    const c = new ChatDeckCapture(makeAdapter({ getScrollContainer: () => host }), { onUpdate: vi.fn() });
    const p = c._walkHistory();
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(host.scrollTop).toBe(100);   // 走完恢复原位
    vi.useRealTimers();
  });
  it('200 节点回溯分批完成、不抛错（Review Focus #2）', () => {
    setDom(Array.from({ length: 200 }, (_, i) => `<div class="ans">A${i}</div>`).join(''));
    const c = new ChatDeckCapture(makeAdapter(), { onUpdate: vi.fn() });
    c.fullRescan();
    vi.advanceTimersByTime(5000);
    expect(c.responses.length).toBe(200);
  });
});
