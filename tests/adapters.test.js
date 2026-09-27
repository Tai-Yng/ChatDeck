// tests/adapters.test.js —— 各平台 adapter 夹具回归
import { describe, it, expect } from 'vitest';
import '../adapters/registry.js';
import '../adapters/deepseek.js';
import { defineAdapterSuite } from './helpers.js';

defineAdapterSuite({
  adapterId: 'deepseek',
  hostname: 'chat.deepseek.com',
  fixture: 'deepseek.html',
  minAnswers: 2,
  fragments: ['量子计算发展史', '容错阈值'],
  questionFragment: '量子计算',
});

describe('deepseek renderSource（富渲染收窄到正文 markdown）', () => {
  it('返回 .ds-markdown 而非整条 ds-message', async () => {
    const { readFileSync } = await import('node:fs');
    const { JSDOM } = await import('jsdom');
    const html = readFileSync('tests/fixtures/deepseek.html', 'utf8');
    const dom = new JSDOM(html, { url: 'https://chat.deepseek.com/a/chat/fixture' });
    globalThis.document = dom.window.document;
    const adapter = ChatDeck.getAdapterForHost('chat.deepseek.com');
    const ans = document.querySelectorAll(adapter.selectors.answer);
    const src = adapter.renderSource(ans[ans.length - 1]);
    expect(src.classList.contains('ds-markdown')).toBe(true);
  });
});
