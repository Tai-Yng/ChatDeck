// core/capture.js —— 统一捕获管线：零平台分支，一切经 adapter
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    // 字符 bigram 相似度：对中文等无空格文本比按词分词更稳
    const grams = s => {
      const t = s.replace(/\s+/g, '');
      const out = [];
      for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
      return out;
    };
    const A = grams(a), B = grams(b);
    if (!A.length || !B.length) return 0;
    const set = new Set(A);
    let hit = 0;
    B.forEach(x => { if (set.has(x)) hit++; });
    return hit / Math.max(A.length, B.length);
  }

  class ChatDeckCapture {
    constructor(adapter, opts = {}) {
      this.adapter = adapter;
      this.o = {
        onUpdate: () => {},
        scanIntervalMs: 3000, debounceMs: 500, streamThrottleMs: 800,
        similarityThreshold: 0.9, ...opts,
      };
      this.responses = [];
      this.currentIndex = -1;
      this.nodeMap = new WeakMap();   // answer 元素 → 条目索引
      this.lastHref = null;
      this._deb = null; this._idle = null; this._obs = null; this._streamAt = 0;
    }

    safeCall(fn, ...args) {
      try {
        const r = this.adapter[fn]
          ? this.adapter[fn].apply(this.adapter, args)
          : ChatDeck.DefaultAdapter[fn].apply(this.adapter, args);
        return r;
      } catch (e) {
        ChatDeck.warn(`adapter.${fn} 失败，降级默认实现`, e);
        try { return ChatDeck.DefaultAdapter[fn].apply(this.adapter, args); }
        catch { return fn === 'extractContent' ? '' : null; }
      }
    }

    answerEls() { return Array.from(document.querySelectorAll(this.adapter.selectors.answer)); }

    buildEntry(el) {
      const questionEl = this.safeCall('findQuestion', el);
      return {
        question: questionEl ? questionEl.textContent.replace(/\s+/g, ' ').trim() : '',
        answer: this.safeCall('extractContent', el),
        capturedAt: Date.now(),
        node: el,
      };
    }

    valid(entry) {
      return entry.answer && entry.answer.length > 1 &&
        !/^(…|\.\.\.| )$/.test(entry.answer);
    }

    fullRescan() {
      const els = this.answerEls();
      if (!els.length) return;
      const fresh = [];
      const absorb = () => {
        const chunk = els.splice(0, 10);           // 分批，防长会话阻塞（Review Focus #2）
        chunk.forEach(el => {
          const e = this.buildEntry(el);
          if (this.valid(e)) { this.nodeMap.set(el, fresh.length); fresh.push(e); }
        });
        if (els.length) setTimeout(absorb, 0);
        else { this.responses = fresh; this.emit(); }
      };
      absorb();
    }

    scan() {
      if (location.href !== this.lastHref) {
        this.lastHref = location.href;
        this.responses = []; this.nodeMap = new WeakMap(); this.currentIndex = -1;
        this.fullRescan();
        return;
      }
      if (this.safeCall('isNewChat') && this.responses.length) {
        this.responses = []; this.nodeMap = new WeakMap(); this.currentIndex = -1;
      }
      const els = this.answerEls();
      if (!els.length) return;
      const latest = els.at(-1);
      const known = this.nodeMap.get(latest);
      if (known !== undefined) {
        const entry = this.buildEntry(latest);
        if (!this.valid(entry)) return;
        if (this.safeCall('isGenerating') && Date.now() - this._streamAt < this.o.streamThrottleMs) return;
        this._streamAt = Date.now();
        this.replace(known, entry);
        return;
      }
      // 新节点：与末条做相似度裁决（流式更新 vs 真新条目）
      const entry = this.buildEntry(latest);
      if (!this.valid(entry)) return;
      const last = this.responses.at(-1);
      if (last && similarity(last.answer, entry.answer) > this.o.similarityThreshold) {
        this.replace(this.responses.length - 1, { ...entry, node: last.node });
        return;
      }
      this.nodeMap.set(latest, this.responses.length);
      this.responses.push(entry);
      this.emit();
    }

    replace(i, entry) {
      this.responses[i] = { ...this.responses[i], ...entry };
      this.emit();
    }

    emit() { try { this.o.onUpdate(); } catch (e) { ChatDeck.warn('onUpdate 异常', e); } }

    start() {
      this._obs = new MutationObserver(() => {
        clearTimeout(this._deb);
        this._deb = setTimeout(() => this.scan(), this.o.debounceMs);
      });
      this._obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      this._idle = setInterval(() => {
        if (location.href !== this.lastHref) { this.scan(); return; }   // SPA 路由变化兜底
        this.fullRescan();                                              // 空闲重扫补漏
      }, this.o.scanIntervalMs);
      this.scan();
    }

    stop() {
      this._obs?.disconnect(); clearInterval(this._idle); clearTimeout(this._deb);
    }
    destroy() { this.stop(); this.responses = []; }
  }

  g.ChatDeckCapture = ChatDeckCapture;
  g.ChatDeck._similarity = similarity; // 测试可见
})();
