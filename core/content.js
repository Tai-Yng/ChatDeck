// core/content.js —— 入口：匹配 adapter → shouldActivate → enabled → 装配并启动
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;
  let instance = null;

  // SPA 平台内容挂载晚于 document_end 注入：shouldActivate 首查可能为假，
  // 在宽限期内轮询，挂载完成即激活（DeepSeek 实测挂载耗时数秒）
  function waitActivated(adapter, doc, { intervalMs = 800, timeoutMs = 25000 } = {}) {
    if (!adapter.shouldActivate || adapter.shouldActivate.call(adapter, doc)) return Promise.resolve(true);
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        let ok = false;
        try { ok = adapter.shouldActivate.call(adapter, doc); } catch (e) { ChatDeck.warn('shouldActivate 异常', e); }
        if (ok) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > timeoutMs) { clearInterval(timer); resolve(false); }
      }, intervalMs);
    });
  }

  async function boot(opts = {}) {
    const doc = opts.doc || document;
    const hostname = opts.hostname || location.hostname;
    const area = opts.storageArea || (g.chrome && chrome.storage.sync);
    if (!area) return null;

    const adapter = ChatDeck.getAdapterForHost(hostname);
    if (!adapter) return null;
    if (!(await waitActivated(adapter, doc))) return null;

    const store = ChatDeckStorage.create(area);
    if (!(await store.get('enabled', true))) return null;

    const capture = new ChatDeckCapture(adapter);
    const manager = new ChatDeckManager(capture, store, adapter);
    await manager.init();
    capture.start();
    instance = { adapter, capture, manager, store };
    await watchSettings(store, () => instance);   // 订阅随 boot 装配，测试可达
    return instance;
  }

  function handleMessage(msg, sendResponse) {
    if (!instance) { sendResponse && sendResponse({ active: false }); return; }
    switch (msg && msg.action) {
      case 'getStatus':
        sendResponse({ active: true, platform: instance.adapter.label,
          count: instance.capture.responses.length, index: instance.capture.currentIndex });
        break;
      case 'toggle':
        instance.manager.toggle();
        sendResponse({ active: true, visible: instance.manager.visible });
        break;
      default:
        sendResponse && sendResponse({ active: true });
    }
  }

  // 设置订阅：debug 开关生效 + popup「启用」实时显隐窗口
  async function watchSettings(store, getInstance) {
    ChatDeck.debug = !!(await store.get('debug', false));
    store.onChange(changes => {
      if (!changes) return;
      if ('debug' in changes) {
        const v = changes.debug;
        ChatDeck.debug = typeof v === 'object' && v !== null ? !!v.newValue : !!v;
      }
      if ('enabled' in changes) {
        const v = changes.enabled;
        const on = typeof v === 'object' && v !== null ? !!v.newValue : !!v;
        const inst = getInstance();
        if (inst) inst.manager.setEnabled(on);
      }
    });
  }

  g.chrome?.runtime?.onMessage?.addListener((msg, _s, sendResponse) => handleMessage(msg, sendResponse));
  g.ChatDeckBoot = { boot, handleMessage };

  boot().catch(e => ChatDeck.warn('boot 失败', e));
})();
