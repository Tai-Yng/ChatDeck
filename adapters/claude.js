// adapters/claude.js —— claude.ai 适配
// ⚠ 盲写假设（2026-09-28，用户暂不用 Claude，未做真实 DOM 校验）。
// 锚点参考：claude.ai 长期存在的 data-testid 体系与 .font-claude-message/.font-user-message
// 排版类、流式期间容器上的 data-is-streaming 属性。真站失效时以实时调结果修正。
(function () {
  ChatDeck.registerAdapter({
    id: 'claude',
    label: 'Claude',
    match: host => host === 'claude.ai',

    shouldActivate: doc => !!doc.querySelector(
      '.font-user-message, [data-testid="user-message"], [contenteditable="true"]'),

    selectors: {
      answer: '.font-claude-message, [data-testid="assistant-message"], [data-message-author="assistant"]',
      question: '.font-user-message, [data-testid="user-message"], [data-user-message-bubble="true"]',
      content: '.prose, .font-claude-message',
    },

    // 生成中：容器 data-is-streaming="true" 或停止按钮出现
    isGenerating() {
      return !!document.querySelector(
        '[data-is-streaming="true"], button[aria-label*="stop" i], button[aria-label*="停止"]');
    },

    isNewChat() { return location.pathname === '/new'; },

    getScrollContainer() { return null; },

    renderSource(answerEl) {
      return (answerEl && answerEl.querySelector('.prose')) || answerEl;
    },

    // 研究模式长回答：去除重复的阶段标题行
    extractContent(answerEl) {
      const base = ChatDeck.DefaultAdapter.extractContent.call(this, answerEl);
      const seen = new Set();
      return base.split('\n').filter(line => {
        const isStep = /^(Research|Step|步骤)\b/i.test(line.trim()) && line.length < 80;
        if (!isStep) return true;
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      }).join('\n');
    },
  });
})();
