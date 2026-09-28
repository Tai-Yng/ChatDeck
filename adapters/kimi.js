// adapters/kimi.js —— kimi.com 适配
// 2026-09-28 夹具（登录态保存页）探明：消息容器 .chat-content-item，
// 用户/助手以修饰类 chat-content-item-user / -assistant 区分。
// 思考块在 .thinking-container 内（.markdown-container.toolcall-content-text），
// 回答是不带 toolcall 修饰的 .markdown-container。侧栏已从夹具剥离。
(function () {
  ChatDeck.registerAdapter({
    id: 'kimi',
    label: 'Kimi',
    match: host => host === 'kimi.com' || host === 'www.kimi.com' || host === 'kimi.moonshot.cn',

    shouldActivate: doc => !!doc.querySelector('.chat-content-item, .segment-user, [contenteditable="true"]'),

    selectors: {
      answer: '.chat-content-item-assistant',
      question: '.chat-content-item-user',
      content: '.markdown-container:not(.toolcall-content-text)',
    },

    // 生成中：发送按钮切换为停止（保存页无此状态，选择器为假设，真站验收修正）
    isGenerating() {
      return !!document.querySelector(
        'button[aria-label*="停止"], button[aria-label*="Stop" i], [class*="stop-button"]');
    },

    isNewChat() { return location.pathname === '/'; },

    getScrollContainer() { return null; },

    // 富渲染取最后一个回答块（Kimi 主回答在最后；多块文本的更早块为已知取舍）
    renderSource(answerEl) {
      const blocks = answerEl
        ? answerEl.querySelectorAll('.markdown-container:not(.toolcall-content-text)')
        : [];
      return blocks[blocks.length - 1] || answerEl;
    },

    // 文本提取拼接全部回答块（排除思考块）
    extractContent(answerEl) {
      const blocks = answerEl
        ? answerEl.querySelectorAll('.markdown-container:not(.toolcall-content-text)')
        : [];
      if (!blocks.length) return ChatDeck.DefaultAdapter.extractContent.call(this, answerEl);
      return [...blocks].map(el => ChatDeck.DefaultAdapter.extractContent.call(this, el)).join('\n\n');
    },
  });
})();
