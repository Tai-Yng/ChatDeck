// popup/popup.js —— 状态显示 + 启用/诊断开关
const statusEl = document.getElementById('status');
const toggleEl = document.getElementById('toggle');
const debugEl = document.getElementById('debug');

const SUPPORTED = /^(https:\/\/(chat\.deepseek\.com|chatgpt\.com|chat\.openai\.com|kimi\.com|www\.kimi\.com|kimi\.moonshot\.cn|claude\.ai|gemini\.google\.com))\//;

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!SUPPORTED.test(tab.url || '')) {
    statusEl.textContent = '本页不支持';
    toggleEl.disabled = true;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, resp => {
    if (chrome.runtime.lastError || !resp || !resp.active) {
      statusEl.textContent = '未激活——刷新页面试试';
      return;
    }
    statusEl.textContent = `${resp.platform} · 已捕获 ${resp.count} 条`;
  });

  toggleEl.checked = (await chrome.storage.sync.get('enabled')).enabled !== false;
  toggleEl.onchange = () => chrome.storage.sync.set({ enabled: toggleEl.checked });
  debugEl.checked = !!(await chrome.storage.sync.get('debug')).debug;
  debugEl.onchange = () => chrome.storage.sync.set({ debug: debugEl.checked });
})();
