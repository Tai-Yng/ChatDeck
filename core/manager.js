// core/manager.js —— 悬浮窗：拖拽/缩放/位置记忆/导航/主题；零平台分支
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;

  // 克隆消毒：剥掉一切可执行/交互元素与事件属性
  const SANITIZE_REMOVE = 'script,iframe,object,embed,form,style,link,meta,noscript,button,input,select,textarea,[role="button"]';

  class ChatDeckManager {
    constructor(capture, store, adapter) {
      this.capture = capture; this.store = store; this.adapter = adapter;
      this.visible = true; this._saveT = null;
    }

    async init() {
      const enabled = await this.store.get('enabled', true);
      this.pos = await this.store.get('windowPos', { x: 20, y: 20 });
      this.size = await this.store.get('windowSize', { width: 500, height: 650 });
      this._build();
      this._applyTheme();
      if (!enabled) this.hide();
      if (this.capture.o) this.capture.o.onUpdate = () => this.sync();
      this.sync();
    }

    _build() {
      this.root = document.createElement('div');
      this.root.className = 'chatdeck-root';
      this.root.style.cssText = `left:${this.pos.x}px;top:${this.pos.y}px;width:${this.size.width}px;height:${this.size.height}px;`;
      this.root.innerHTML = `
        <div class="chatdeck-header">
          <span class="chatdeck-title">ChatDeck · ${this.adapter.label}</span>
          <span class="chatdeck-count">0 / 0</span>
          <button class="chatdeck-btn chatdeck-close" aria-label="关闭">×</button>
        </div>
        <div class="chatdeck-body">
          <div class="chatdeck-question"></div>
          <div class="chatdeck-content"></div>
        </div>
        <div class="chatdeck-footer">
          <button class="chatdeck-btn chatdeck-copy" aria-label="复制本条回答">⧉ 复制</button>
          <span class="chatdeck-footer-spacer"></span>
          <button class="chatdeck-btn chatdeck-prev" aria-label="上一条">←</button>
          <button class="chatdeck-btn chatdeck-next" aria-label="下一条">→</button>
        </div>
        <div class="chatdeck-resize" aria-label="缩放"></div>`;
      document.documentElement.appendChild(this.root);

      this.root.querySelector('.chatdeck-close').onclick = () => this.hide();
      this.root.querySelector('.chatdeck-prev').onclick = () => this.prev();
      this.root.querySelector('.chatdeck-next').onclick = () => this.next();
      this.root.querySelector('.chatdeck-copy').onclick = () => this._copyCurrent();
      this._enableDrag();
      this._enableResize();
    }

    _enableDrag() {
      const header = this.root.querySelector('.chatdeck-header');
      header.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const sx = e.clientX - this.pos.x, sy = e.clientY - this.pos.y;
        const move = ev => {
          this.pos = { x: ev.clientX - sx, y: ev.clientY - sy };
          this.root.style.left = this.pos.x + 'px';
          this.root.style.top = this.pos.y + 'px';
        };
        const up = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          this._persist();
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }

    _enableResize() {
      const h = this.root.querySelector('.chatdeck-resize');
      h.addEventListener('pointerdown', e => {
        e.stopPropagation();
        const sw = this.size.width - e.clientX, sh = this.size.height - e.clientY;
        const move = ev => {
          this.size = { width: Math.max(320, ev.clientX + sw), height: Math.max(240, ev.clientY + sh) };
          this.root.style.width = this.size.width + 'px';
          this.root.style.height = this.size.height + 'px';
        };
        const up = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          this._persist();
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }

    _persist() {
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => {
        this.store.set({ windowPos: this.pos, windowSize: this.size });
        ChatDeck.log('窗口位置已保存', this.pos, this.size);
      }, 300);
    }

    _applyTheme() {
      const hostDark = document.documentElement.classList.contains('dark') ||
        (document.body && document.body.classList.contains('dark'));
      const hostLight = document.documentElement.classList.contains('light');
      const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (hostDark || (!hostLight && sysDark)) this.root.classList.add('chatdeck-dark');
    }

    sync() {
      const n = this.capture.responses.length;
      if (this.capture.currentIndex >= n) this.capture.currentIndex = n - 1;
      if (n && this.capture.currentIndex < 0) this.capture.currentIndex = n - 1; // 初始/重置后默认展示最新一条
      this.root.querySelector('.chatdeck-count').textContent = `${n ? this.capture.currentIndex + 1 : 0} / ${n}`;
      this._renderCurrent();
      this.root.querySelector('.chatdeck-prev').disabled = this.capture.currentIndex <= 0;
      this.root.querySelector('.chatdeck-next').disabled = this.capture.currentIndex >= n - 1;
    }

    _renderCurrent() {
      const cur = this.capture.responses[this.capture.currentIndex];
      const qEl = this.root.querySelector('.chatdeck-question');
      const cEl = this.root.querySelector('.chatdeck-content');
      cEl.classList.remove('chatdeck-content--plain');
      if (!cur) { qEl.textContent = ''; cEl.textContent = '尚无捕获的问答，发送一条消息试试。'; return; }
      qEl.textContent = cur.question || '（未定位到问题）';
      // 富渲染：克隆 adapter 指定的渲染源（默认整条回答），消毒后放入窗口。
      // 同文档克隆保留宿主 CSS 排版（含深色），自有 CSS 只做归一化补充。
      let src = cur.node;
      try {
        if (this.adapter.renderSource) src = this.adapter.renderSource.call(this.adapter, cur.node) || cur.node;
      } catch (e) { ChatDeck.warn('renderSource 失败，回退整条回答', e); }
      if (src && src.nodeType === 1 && document.contains(src)) {
        const clone = src.cloneNode(true);
        clone.querySelectorAll(SANITIZE_REMOVE).forEach(n => n.remove());
        clone.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes).forEach(a => {
            const name = a.name.toLowerCase();
            if (name.startsWith('on')) el.removeAttribute(a.name);
            else if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
          });
        });
        cEl.replaceChildren(clone);
        this._renderMermaid(cEl);
      } else {
        cEl.textContent = cur.answer;
        cEl.classList.add('chatdeck-content--plain');
      }
    }

    // mermaid：仅当渲染内容含 mermaid 代码块时才首次加载 vendor 库（IIFE 版，隔离世界内求值）
    _ensureMermaid() {
      if (!this._mermaidPromise) {
        this._mermaidPromise = new Promise(resolve => {
          try {
            if (!(g.chrome && chrome.runtime && chrome.runtime.getURL)) return resolve(null);
            import(chrome.runtime.getURL('vendor/mermaid.min.js'))
              .then(() => resolve(g.mermaid || null))
              .catch(e => { ChatDeck.warn('mermaid 加载失败', e); resolve(null); });
          } catch (e) { ChatDeck.warn('mermaid 加载异常', e); resolve(null); }
        });
      }
      return this._mermaidPromise;
    }

    async _copyCurrent() {
      const cur = this.capture.responses[this.capture.currentIndex];
      if (!cur || !cur.answer) return;
      const ok = await this._writeClipboard(cur.answer);
      const btn = this.root.querySelector('.chatdeck-copy');
      if (!btn) return;
      btn.textContent = ok ? '✓ 已复制' : '✗ 失败';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = '⧉ 复制'; btn.disabled = false; }, 1200);
    }

    async _writeClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.documentElement.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch { return false; }
      }
    }

    async _renderMermaid(cEl) {
      const blocks = cEl.querySelectorAll('code[class*="language-mermaid"], code[class*="lang-mermaid"]');
      if (!blocks.length) return;
      const mermaid = await this._ensureMermaid();
      if (!mermaid) return;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: this.root.classList.contains('chatdeck-dark') ? 'dark' : 'default',
          securityLevel: 'strict',
        });
      } catch (e) { ChatDeck.warn('mermaid init 失败', e); return; }
      let i = 0;
      for (const code of blocks) {
        const src = code.textContent;
        const pre = code.closest('pre') || code;
        const holder = document.createElement('div');
        holder.className = 'chatdeck-mermaid';
        pre.replaceWith(holder);
        try {
          const { svg } = await mermaid.render(`chatdeck-mermaid-${Date.now()}-${i++}`, src);
          holder.innerHTML = svg;
        } catch (e) { ChatDeck.warn('mermaid 渲染失败', e); holder.replaceWith(pre); }
      }
    }

    goTo(i) {
      const n = this.capture.responses.length;
      if (i < 0 || i >= n) return;
      this.capture.currentIndex = i; this.sync();
    }
    next() { this.goTo(this.capture.currentIndex + 1); }
    prev() { this.goTo(this.capture.currentIndex - 1); }

    show() { this.visible = true; this.root.style.display = 'block'; }
    hide() { this.visible = false; this.root.style.display = 'none'; }
    toggle() { this.visible ? this.hide() : this.show(); }

    destroy() { if (this.root) this.root.remove(); clearTimeout(this._saveT); }
  }

  g.ChatDeckManager = ChatDeckManager;
})();
