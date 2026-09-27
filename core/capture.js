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

    // 内容指纹：流式输出向前追加，前缀稳定，故取前 150 字符为同一性键
    keyOf(text) {
      return (text || '').replace(/\s+/g, ' ').trim().slice(0, 150);
    }

    fullRescan() {
      const els = this.answerEls();
      if (!els.length) return;
      const batch = [];
      const absorb = () => {
        const chunk = els.splice(0, 10);           // 分批，防长会话阻塞（Review Focus #2）
        chunk.forEach(el => {
          const e = this.buildEntry(el);
          if (this.valid(e)) batch.push(e);
        });
        if (els.length) setTimeout(absorb, 0);
        else this.mergeBatch(batch);
      };
      absorb();
    }

    // 合并式回溯：虚拟列表平台（如 DeepSeek）任意时刻只有视口内消息在 DOM，
    // 回溯必须按内容指纹累积合并，而非整组替换；滚动/自动行走逐步补全历史。
    mergeBatch(batch) {
      if (!batch.length) return;
      const R = this.responses;
      if (!R.length) {
        batch.forEach((e, i) => { R.push(e); if (e.node) this.nodeMap.set(e.node, i); });
        this.emit();
        return;
      }
      // 同一 DOM 节点文本已变（如重新生成后重挂载）→ 原位替换，退出本批
      batch = batch.filter(e => {
        if (e.node && this.nodeMap.has(e.node)) {
          const i = this.nodeMap.get(e.node);
          R[i] = { ...R[i], ...e };
          return false;
        }
        return true;
      });
      if (!batch.length) { this.emit(); return; }

      // 问题相同且旧节点已卸载（虚拟列表重挂载，如重新生成）→ 原位替换，避免重复条目
      const questionIndex = new Map();
      R.forEach((r, i) => {
        const k = this.keyOf(r.question);
        if (k && !questionIndex.has(k)) questionIndex.set(k, i);
      });
      batch = batch.filter(e => {
        const k = this.keyOf(e.question);
        if (!k || !questionIndex.has(k)) return true;
        const i = questionIndex.get(k);
        if (R[i].node && document.contains(R[i].node)) return true; // 旧条目仍在 DOM → 是两条独立消息
        R[i] = { ...R[i], ...e };
        return false;
      });
      if (!batch.length) { this.emit(); return; }

      const keyIndex = new Map();
      R.forEach((r, i) => { const k = this.keyOf(r.answer); if (!keyIndex.has(k)) keyIndex.set(k, i); });
      const anchors = new Map(); // batch 序号 → R 序号
      batch.forEach((e, bi) => {
        const k = this.keyOf(e.answer);
        if (keyIndex.has(k) && !anchors.has(bi)) anchors.set(bi, keyIndex.get(k));
      });

      const ops = []; // {at, items[]}
      let lastAnchorRi = -1;
      let pending = [];
      batch.forEach((e, bi) => {
        if (anchors.has(bi)) {
          if (pending.length) { ops.push({ at: lastAnchorRi + 1, items: pending }); pending = []; }
          lastAnchorRi = anchors.get(bi);
        } else pending.push(e);
      });
      if (pending.length) {
        if (lastAnchorRi >= 0) ops.push({ at: lastAnchorRi + 1, items: pending });
        else {
          // 无锚点：按 DOM 先后判向——批在 R 末尾之后则追加，否则视为更早的历史前插
          const firstNode = batch[0].node, lastRNode = R[R.length - 1].node;
          const comparable = firstNode && lastRNode &&
            document.contains(firstNode) && document.contains(lastRNode);
          if (comparable && (lastRNode.compareDocumentPosition(firstNode) & Node.DOCUMENT_POSITION_FOLLOWING))
            ops.push({ at: R.length, items: pending });
          else ops.push({ at: 0, items: pending });
        }
      }
      // 从后往前插避免索引位移；随后按最终顺序重建节点映射
      ops.sort((a, b) => b.at - a.at).forEach(op => R.splice(op.at, 0, ...op.items));
      this.nodeMap = new WeakMap();
      R.forEach((r, i) => { if (r.node) this.nodeMap.set(r.node, i); });
      this.emit();
    }

    // 虚拟列表平台的自动上滚行走：切换会话后从底部逐步滚到顶，
    // 每步触发一次合并回溯，收齐全部历史后恢复原滚动位置。平台无虚拟列表（钩子返回 null）则跳过。
    async _walkHistory() {
      if (this._walking) return;
      const host = this.safeCall('getScrollContainer');
      if (!host || typeof host.scrollTop !== 'number') return;
      this._walking = true;
      try {
        const origTop = host.scrollTop;
        const dwell = 220, maxSteps = 60;
        for (let step = 0; step < maxSteps; step++) {
          host.scrollTop = Math.max(0, host.scrollTop - host.clientHeight * 0.8);
          await new Promise(r => setTimeout(r, dwell));
          this.fullRescan();
          if (host.scrollTop <= 0) {
            await new Promise(r => setTimeout(r, dwell));
            this.fullRescan();
            break;
          }
        }
        host.scrollTop = origTop;
      } catch (e) { ChatDeck.warn('历史行走中断', e); }
      finally { this._walking = false; }
    }

    scan() {
      if (location.href !== this.lastHref) {
        this.lastHref = location.href;
        this.responses = []; this.nodeMap = new WeakMap(); this.currentIndex = -1;
        this.fullRescan();
        this._walkHistory();          // 切换会话：可见区先上屏，随后自动行走补全全部历史
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
