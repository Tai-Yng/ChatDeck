// adapters/registry.js —— ChatDeck 全局命名空间；manifest 注入序列的第一个文件
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;

  const CLEAN_SEL = 'script,style,noscript,svg,button,textarea,input,select,[role="button"]';

  function extractContent(answerEl) {
    if (!answerEl) return '';
    const clone = answerEl.cloneNode(true);
    clone.querySelectorAll(CLEAN_SEL).forEach(n => n.remove());
    const blocks = clone.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td,th,tr');
    if (blocks.length) {
      const seen = new Set();
      const parts = [];
      blocks.forEach(b => {
        const t = b.textContent.replace(/\s+/g, ' ').trim();
        if (t && !seen.has(t)) { seen.add(t); parts.push(b.matches('LI') ? '- ' + t : t); }
      });
      return parts.join('\n');
    }
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findQuestion(answerEl) {
    if (!answerEl) return null;
    const sel = this.selectors && this.selectors.question;
    if (!sel) return null;
    let container = answerEl.parentElement;
    for (let i = 0; i < 3 && container; i++) {
      const qs = Array.from(container.querySelectorAll(sel));
      const before = qs.filter(q => answerEl.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_PRECEDING);
      if (before.length) return before.at(-1);
      container = container.parentElement;
    }
    return null;
  }

  const DefaultAdapter = {
    shouldActivate() { return true; },
    isGenerating() { return false; },
    isNewChat() { return false; },
    extractContent,
    findQuestion,
    // 悬浮窗富渲染的克隆来源：默认整条回答元素；平台可收窄（如 DeepSeek 只取正文 markdown）
    renderSource(answerEl) { return answerEl; },
  };

  const adapters = [];
  const ChatDeck = {
    debug: false,
    DefaultAdapter,
    registerAdapter(adapter) {
      if (!adapter || !adapter.id) throw new Error('ChatDeck: adapter 缺少 id');
      if (typeof adapter.match !== 'function') throw new Error(`ChatDeck: adapter ${adapter.id} 缺少 match`);
      if (!adapter.selectors || !adapter.selectors.answer) throw new Error(`ChatDeck: adapter ${adapter.id} 缺少 selectors.answer`);
      if (adapters.some(a => a.id === adapter.id)) throw new Error(`ChatDeck: adapter id 重复 ${adapter.id}`);
      adapters.push(adapter);
    },
    getAdapterForHost(hostname) {
      return adapters.find(a => { try { return a.match(hostname); } catch (e) { return false; } }) || null;
    },
    resetRegistry() { adapters.length = 0; },
    log(...a) { if (ChatDeck.debug) console.log('[ChatDeck]', ...a); },
    warn(...a) { if (ChatDeck.debug) console.warn('[ChatDeck]', ...a); },
    error(...a) { if (ChatDeck.debug) console.error('[ChatDeck]', ...a); },
  };
  g.ChatDeck = ChatDeck;
})();
