// adapters/deepseek.js —— chat.deepseek.com 适配
// 2026-09 探查结论：消息容器为语义类 .ds-message，正文为其直接子元素 .ds-markdown；
// 思考块内容嵌于 .ds-think-content 内的 .ds-markdown（非直接子元素），提取时天然排除。
// 消息列表为虚拟列表（data-virtual-list-item-key），视野外消息不在 DOM 中。
(function () {
  ChatDeck.registerAdapter({
    id: 'deepseek',
    label: 'DeepSeek',
    match: host => host === 'chat.deepseek.com',

    shouldActivate: doc => !!doc.querySelector('.ds-virtual-list, .ds-message'),

    selectors: {
      answer: '.ds-message:has(> .ds-markdown)',
      question: '.ds-message:not(:has(.ds-markdown))',
      content: '.ds-markdown',
    },

    // 生成中：输入区圆形按钮处于可点状态（无 disabled 标记）。
    // 空闲+空输入时按钮带 ds-button--disabled；生成中按钮被换成停止控件（无该标记）。
    // 用户在输入框打字时同样无该标记（误报），但此场景无 DOM 变化不触发扫描，且生成结束时自愈。
    isGenerating() {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find(b => {
        const c = typeof b.className === 'string' ? b.className : '';
        if (!c.includes('ds-button--circle')) return false;
        const r = b.getBoundingClientRect();
        return r.y > 400 && r.width > 0;
      });
      if (!btn) return false;
      return !(typeof btn.className === 'string' && btn.className.includes('ds-button--disabled'));
    },

    // 新对话页 URL 为 /，会话页为 /a/chat/s/<id>
    isNewChat() { return location.pathname === '/'; },

    // 只取正文 markdown（直接子元素），排除思考块
    extractContent(answerEl) {
      const md = answerEl && answerEl.querySelector(':scope > .ds-markdown');
      return ChatDeck.DefaultAdapter.extractContent.call(this, md || answerEl);
    },
  });
})();
