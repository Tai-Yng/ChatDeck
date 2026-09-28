// adapters/gemini.js —— gemini.google.com 适配
// ⚠ 盲写假设（2026-09-28，用户暂不用 Gemini，未做真实 DOM 校验）。
// 锚点参考：Gemini Web 的自定义元素 <model-response>/<user-query>、
// .model-response-text 排版类。class 大量混淆，data-* 更可靠。
// 真站失效时以实时调结果修正（注意部分组件可能带 shadow root）。
(function () {
  ChatDeck.registerAdapter({
    id: 'gemini',
    label: 'Gemini',
    match: host => host === 'gemini.google.com',

    shouldActivate: doc => !!doc.querySelector(
      'model-response, user-query, chat-window, [class*="conversation-container"]'),

    selectors: {
      answer: 'model-response, .model-response, [class*="model-response"]',
      question: 'user-query, .user-query, [class*="user-query"]',
      content: '.model-response-text, .markdown, [class*="response-text"]',
    },

    isGenerating() {
      return !!document.querySelector(
        'button[aria-label*="Stop"], button[aria-label*="停止"], button[aria-label*="stop" i]');
    },

    isNewChat() { return false; },

    getScrollContainer() { return null; },

    renderSource(answerEl) {
      const inner = answerEl && (answerEl.querySelector('.model-response-text, .markdown')
        || answerEl.querySelector('[class*="response-text"]'));
      return inner || answerEl;
    },
  });
})();
