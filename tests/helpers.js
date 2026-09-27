// tests/helpers.js —— adapter × 夹具 的通用断言套件
// 用法：测试文件先静态 import registry 与目标 adapter（自注册），再调 defineAdapterSuite
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export function defineAdapterSuite({ adapterId, hostname, fixture, minAnswers, fragments, questionFragment }) {
  describe(`adapter: ${adapterId}`, () => {
    let adapter = null;
    let doc = null;
    beforeAll(() => {
      // vitest 恒以仓库根为 cwd（npm test），import.meta.url 在 Windows 下解析异常故不用
      const html = readFileSync(`tests/fixtures/${fixture}`, 'utf8');
      const dom = new JSDOM(html, { url: `https://${hostname}/a/chat/fixture` });
      doc = dom.window.document;
      globalThis.document = doc;
      adapter = ChatDeck.getAdapterForHost(hostname);
    });

    it('被注册且匹配本域', () => {
      expect(adapter).toBeTruthy();
      expect(adapter.id).toBe(adapterId);
    });

    it(`夹具定位 ≥ ${minAnswers} 条回答`, () => {
      const els = doc.querySelectorAll(adapter.selectors.answer);
      expect(els.length).toBeGreaterThanOrEqual(minAnswers);
    });

    it('末条回答可提取且含关键片段', () => {
      const els = doc.querySelectorAll(adapter.selectors.answer);
      const text = ChatDeck.DefaultAdapter.extractContent.call(adapter, els[els.length - 1]);
      for (const f of fragments) expect(text).toContain(f);
    });

    it('问题配对成功', () => {
      const els = doc.querySelectorAll(adapter.selectors.answer);
      const q = ChatDeck.DefaultAdapter.findQuestion.call(adapter, els[els.length - 1]);
      expect(q && q.textContent.includes(questionFragment)).toBe(true);
    });
  });
}
