// core/manager.js —— 悬浮窗：拖拽/缩放/位置记忆/导航/主题；零平台分支
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;

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
          <button class="chatdeck-btn chatdeck-prev" aria-label="上一条">←</button>
          <button class="chatdeck-btn chatdeck-next" aria-label="下一条">→</button>
        </div>
        <div class="chatdeck-resize" aria-label="缩放"></div>`;
      document.documentElement.appendChild(this.root);

      this.root.querySelector('.chatdeck-close').onclick = () => this.hide();
      this.root.querySelector('.chatdeck-prev').onclick = () => this.prev();
      this.root.querySelector('.chatdeck-next').onclick = () => this.next();
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
      this.root.querySelector('.chatdeck-count').textContent = `${n ? this.capture.currentIndex + 1 : 0} / ${n}`;
      if (this.capture.currentIndex >= n) this.capture.currentIndex = n - 1;
      const cur = this.capture.responses[this.capture.currentIndex];
      const qEl = this.root.querySelector('.chatdeck-question');
      const cEl = this.root.querySelector('.chatdeck-content');
      if (!cur) { qEl.textContent = ''; cEl.textContent = '尚无捕获的问答，发送一条消息试试。'; return; }
      qEl.textContent = cur.question || '（未定位到问题）';
      cEl.textContent = cur.answer;
      this.root.querySelector('.chatdeck-prev').disabled = this.capture.currentIndex <= 0;
      this.root.querySelector('.chatdeck-next').disabled = this.capture.currentIndex >= n - 1;
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
