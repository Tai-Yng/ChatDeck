// core/content.js —— 入口：匹配 adapter → shouldActivate → enabled → 装配并启动
(function () {
  const g = typeof window !== 'undefined' ? window : globalThis;
  let instance = null;

  async function boot(opts = {}) {
    const doc = opts.doc || document;
    const hostname = opts.hostname || location.hostname;
    const area = opts.storageArea || (g.chrome && chrome.storage.sync);
    if (!area) return null;

    const adapter = ChatDeck.getAdapterForHost(hostname);
    if (!adapter) return null;
    if (adapter.shouldActivate && !adapter.shouldActivate.call(adapter, doc)) return null;

    const store = ChatDeckStorage.create(area);
    if (!(await store.get('enabled', true))) return null;

    const capture = new ChatDeckCapture(adapter);
    const manager = new ChatDeckManager(capture, store, adapter);
    await manager.init();
    capture.start();
    instance = { adapter, capture, manager, store };
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

  // debug 开关同步（popup 切换 → storage 变更 → 生效）
  async function watchDebug(store) {
    ChatDeck.debug = !!(await store.get('debug', false));
    store.onChange(changes => {
      if (changes && 'debug' in changes) {
        const v = changes.debug;
        ChatDeck.debug = typeof v === 'object' && v !== null ? !!v.newValue : !!v;
      }
    });
  }

  g.chrome?.runtime?.onMessage?.addListener((msg, _s, sendResponse) => handleMessage(msg, sendResponse));
  g.ChatDeckBoot = { boot, handleMessage };

  (async () => {
    const inst = await boot().catch(e => { ChatDeck.warn('boot 失败', e); return null; });
    if (inst) watchDebug(inst.store);
  })();
})();
