// tests/adapters.test.js —— 各平台 adapter 夹具回归
import { describe, it, expect } from 'vitest';
import '../adapters/registry.js';
import '../adapters/deepseek.js';
import '../adapters/chatgpt.js';
import '../adapters/kimi.js';
import '../adapters/claude.js';
import '../adapters/gemini.js';
import { defineAdapterSuite } from './helpers.js';

defineAdapterSuite({
  adapterId: 'deepseek',
  hostname: 'chat.deepseek.com',
  fixture: 'deepseek.html',
  minAnswers: 2,
  fragments: ['量子计算发展史', '容错阈值'],
  questionFragment: '量子计算',
});

defineAdapterSuite({
  adapterId: 'chatgpt',
  hostname: 'chatgpt.com',
  fixture: 'chatgpt.html',
  minAnswers: 3,
  fragments: ['版心', '拉宽'],
  questionFragment: '代码块的宽度',
});

defineAdapterSuite({
  adapterId: 'kimi',
  hostname: 'www.kimi.com',
  fixture: 'kimi.html',
  minAnswers: 2,
  fragments: ['Blue Topaz', 'callout'],
  questionFragment: 'important',
});

describe('盲写 adapter 注册与域名匹配（无夹具，真站验收时校准）', () => {
  it('claude / gemini 均已注册且匹配本域', () => {
    expect(ChatDeck.getAdapterForHost('claude.ai')?.id).toBe('claude');
    expect(ChatDeck.getAdapterForHost('gemini.google.com')?.id).toBe('gemini');
  });
  it('互不串域', () => {
    expect(ChatDeck.getAdapterForHost('chatgpt.com')?.id).toBe('chatgpt');
    expect(ChatDeck.getAdapterForHost('chat.deepseek.com')?.id).toBe('deepseek');
    expect(ChatDeck.getAdapterForHost('www.kimi.com')?.id).toBe('kimi');
    expect(ChatDeck.getAdapterForHost('example.org')).toBeNull();
  });
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
