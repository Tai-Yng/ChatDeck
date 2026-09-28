// adapters/chatgpt.js —— chatgpt.com 适配
// 2026-09-28 夹具（登录态保存页）探明：消息锚点 data-message-author-role 仍稳定；
// 正文容器为 .markdown（带 hash 前缀类 .prose）；用户消息为气泡结构（contents 类）。
// 生成中检测以停止按钮为准（.result-streaming 已弃用，仅作兜底）。
(function () {
  ChatDeck.registerAdapter({
    id: 'chatgpt',
    label: 'ChatGPT',
    match: host => host === 'chatgpt.com' || host === 'chat.openai.com',

    shouldActivate: doc => !!doc.querySelector(
      '[data-message-author-role], #prompt-textarea, form [contenteditable="true"]'),

    selectors: {
      answer: '[data-message-author-role="assistant"]',
      question: '[data-message-author-role="user"]',
      content: '.markdown',
    },

    isGenerating() {
      return !!document.querySelector(
        'button[aria-label*="stop" i], button[aria-label*="停止"], ' +
        '[data-testid="stop-button"], .result-streaming');
    },

    isNewChat() { return location.pathname === '/'; },

    // 常规会话为全量渲染；如遇长会话虚拟化再补滚动容器钩子
    getScrollContainer() { return null; },

    // 富渲染只克隆正文 markdown
    renderSource(answerEl) {
      return (answerEl && answerEl.querySelector('.markdown')) || answerEl;
    },
  });
})();
