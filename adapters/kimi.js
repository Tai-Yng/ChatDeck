// adapters/kimi.js —— kimi.com 适配
// 2026-09-28 夹具（登录态保存页）探明：消息容器 .chat-content-item，
// 用户/助手以修饰类 chat-content-item-user / -assistant 区分；
// 助手正文 .markdown-container（另有 .markdown 嵌套）。侧栏已从夹具剥离。
(function () {
  ChatDeck.registerAdapter({
    id: 'kimi',
    label: 'Kimi',
    match: host => host === 'kimi.com' || host === 'www.kimi.com' || host === 'kimi.moonshot.cn',

    shouldActivate: doc => !!doc.querySelector('.chat-content-item, .segment-user, [contenteditable="true"]'),

    selectors: {
      answer: '.chat-content-item-assistant',
      question: '.chat-content-item-user',
      content: '.markdown-container',
    },

    // 生成中：发送按钮切换为停止（保存页无此状态，选择器为假设，真站验收修正）
    isGenerating() {
      return !!document.querySelector(
        'button[aria-label*="停止"], button[aria-label*="Stop" i], [class*="stop-button"]');
    },

    isNewChat() { return location.pathname === '/'; },

    getScrollContainer() { return null; },

    renderSource(answerEl) {
      return (answerEl && answerEl.querySelector('.markdown-container')) || answerEl;
    },
  });
})();
