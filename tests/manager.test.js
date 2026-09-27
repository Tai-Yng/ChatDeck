import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../adapters/registry.js';
import '../core/storage.js';
import '../core/manager.js';

function fakeStore() {
  const data = { enabled: true, windowPos: { x: 20, y: 20 }, windowSize: { width: 400, height: 500 } };
  return {
    get: async (k, d) => (k in data ? data[k] : d),
    set: async o => Object.assign(data, o),
    onChange: () => () => {},
  };
}
function fakeCapture() {
  return {
    o: {},
    responses: [
      { question: '什么是 RDMA？', answer: '远程直接内存访问…', node: null, capturedAt: 0 },
      { question: 'Q2', answer: 'A2', node: null, capturedAt: 0 },
    ],
    currentIndex: 0,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  // manager 将窗口挂载在 documentElement 上，需一并清理防止跨测试泄漏
  document.querySelectorAll('.chatdeck-root').forEach(n => n.remove());
});

describe('ChatDeckManager', () => {
  it('init 创建窗口并渲染第 0 条', async () => {
    const m = new ChatDeckManager(fakeCapture(), fakeStore(), { label: 'Fake' });
    await m.init();
    expect(document.querySelector('.chatdeck-root')).toBeTruthy();
    expect(document.querySelector('.chatdeck-question').textContent).toContain('RDMA');
    expect(document.querySelector('.chatdeck-content').textContent).toContain('远程直接内存访问');
    expect(document.querySelector('.chatdeck-count').textContent).toContain('1 / 2');
  });
  it('next/prev 边界禁用', async () => {
    const m = new ChatDeckManager(fakeCapture(), fakeStore(), { label: 'Fake' });
    await m.init(); m.next();
    expect(m.capture.currentIndex).toBe(1);
    m.next();
    expect(m.capture.currentIndex).toBe(1);   // 已到边界
    m.prev();
    expect(m.capture.currentIndex).toBe(0);
  });
  it('拖拽移动窗口（jsdom 无 PointerEvent 构造器，用 MouseEvent 触发 pointer 类型监听）', async () => {
    const m = new ChatDeckManager(fakeCapture(), fakeStore(), { label: 'Fake' });
    await m.init();
    const header = document.querySelector('.chatdeck-header');
    const fire = (t, type, x, y) => t.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    fire(header, 'pointerdown', 100, 100);
    fire(document, 'pointermove', 150, 130);
    fire(document, 'pointerup', 150, 130);
    expect(m.root.style.left).toBe('70px');   // 20 + 50
    expect(m.root.style.top).toBe('50px');    // 20 + 30
  });
  it('主题双源检测：宿主 html.dark 优先于 matchMedia（Review Focus #4）', async () => {
    document.documentElement.classList.add('dark');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }); // 系统亮色
    const m = new ChatDeckManager(fakeCapture(), fakeStore(), { label: 'Fake' });
    await m.init();
    expect(m.root.classList.contains('chatdeck-dark')).toBe(true);
  });
  it('捕获后 currentIndex=-1 → 自动展示最新一条（真站回归：窗口不再空白）', async () => {
    const cap = fakeCapture();
    cap.currentIndex = -1;                       // capture.scan() 首轮回溯后的真实状态
    const m = new ChatDeckManager(cap, fakeStore(), { label: 'Fake' });
    await m.init();
    expect(document.querySelector('.chatdeck-content').textContent).toContain('A2');
    expect(document.querySelector('.chatdeck-count').textContent).toContain('2 / 2');
  });
  it('富渲染：克隆消毒保留结构、剥 script/button、mermaid 优雅降级', async () => {
    document.body.innerHTML = `<div id="src"><h2>标题甲</h2><p>段落文字</p><script>window.evil=1</script><button>复制</button><img src="https://x.test/a.png"><pre><code class="language-mermaid">graph TD; A-->B</code></pre></div>`;
    const cap = fakeCapture();
    cap.currentIndex = 0;
    cap.responses = [{ question: 'Q', answer: '', node: document.getElementById('src'), capturedAt: 0 }];
    const m = new ChatDeckManager(cap, fakeStore(), { label: 'Fake' });
    await m.init();
    const c = document.querySelector('.chatdeck-content');
    expect(c.querySelector('h2').textContent).toBe('标题甲');
    expect(c.querySelector('img')).toBeTruthy();
    expect(c.querySelector('script')).toBeNull();          // 消毒：脚本剥离
    expect(c.querySelector('button')).toBeNull();          // 消毒：按钮剥离
    expect(c.querySelector('code.language-mermaid')).toBeTruthy(); // jsdom 无 chrome → 库不加载，代码块保留
  });
  it('复制按钮把当前回答写入剪贴板并给出反馈', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const cap = fakeCapture(); cap.currentIndex = -1;   // 默认选中最新一条
    const m = new ChatDeckManager(cap, fakeStore(), { label: 'Fake' });
    await m.init();
    const btn = document.querySelector('.chatdeck-copy');
    expect(btn).toBeTruthy();
    await m._copyCurrent();
    expect(writeText).toHaveBeenCalledWith('A2');
    expect(btn.textContent).toBe('✓ 已复制');
  });
  it('剪贴板 API 失败时降级 execCommand', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    const cap = fakeCapture(); cap.currentIndex = 0;
    const m = new ChatDeckManager(cap, fakeStore(), { label: 'Fake' });
    await m.init();
    await expect(m._writeClipboard('内容')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    delete document.execCommand;
  });
  it('toggle 显隐', async () => {
    const m = new ChatDeckManager(fakeCapture(), fakeStore(), { label: 'Fake' });
    await m.init(); m.hide();
    expect(m.root.style.display).toBe('none');
    m.toggle();
    expect(m.root.style.display).toBe('block');
  });
});

describe('styles.css 命名空间（Review Focus #1）', () => {
  it('每条规则的选择器都以 .chatdeck 开头', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync('styles.css', 'utf8');
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const sels = noComments.split('}').map(s => s.split('{')[0].trim()).filter(Boolean);
    expect(sels.length).toBeGreaterThan(5);
    sels.forEach(s => expect(s.split(',')[0].trim().startsWith('.chatdeck'), `违规选择器: ${s}`).toBe(true));
  });
  it('图片默认居中（用户 LX.15 同款要求）', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync('styles.css', 'utf8');
    expect(css.includes('.chatdeck-content img {')).toBe(true);
  });
});
