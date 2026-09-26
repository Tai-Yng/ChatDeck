// background.js —— 安装默认值 + popup 消息路由 + 工具栏标题
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install')
    chrome.storage.sync.set({
      enabled: true,
      windowPos: { x: 20, y: 20 },
      windowSize: { width: 500, height: 650 },
      debug: false,
    });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'toggleExtension') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' },
        resp => sendResponse(resp || { active: false }));
      else sendResponse({ active: false });
    });
    return true;
  }
  sendResponse({ ok: false });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const hit = /^(https:\/\/(chat\.deepseek\.com|chatgpt\.com|chat\.openai\.com|kimi\.com|kimi\.moonshot\.cn|claude\.ai|gemini\.google\.com))\//.test(tab.url);
    chrome.action.setTitle({ tabId, title: hit ? 'ChatDeck — 本页可用' : 'ChatDeck — 本页不可用' });
  }
});
