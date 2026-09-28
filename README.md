<div align="center">

# ChatDeck

**Floating navigator for your AI chat history**
**悬浮翻阅你的 AI 聊天历史，无需回滚页面**

Chrome 扩展 · Manifest V3 · 零构建

</div>

---

## ✨ 特性

- **问答自动捕获** —— 实时捕获 AI 聊天页的问答对，流式输出期间条目即时更新
- **悬浮窗导航** —— `←`/`→` 在全部问答间翻阅，计数显示，边界禁用
- **一键收齐历史** —— 对虚拟列表渲染的长会话（如 DeepSeek），自动滚动收集全部历史后恢复你的位置
- **富文本渲染** —— 标题层级、代码块、表格、列表、引用、图片（默认居中），mermaid 代码块直接渲染成图（库内置，运行时零网络请求）
- **一键复制** —— 当前回答全文复制到剪贴板
- **深浅主题** —— 自动跟随宿主页面配色，全套双主题排版
- **关闭不丢** —— 点 × 收起后右下角悬浮球一键唤回；`Alt+Shift+C` 快捷键随时切换；popup 总开关实时生效

## 🌐 支持平台

| 平台 | 站点 | 状态 |
|------|------|------|
| DeepSeek | chat.deepseek.com | ✅ 已验证 |
| ChatGPT | chatgpt.com | ✅ 已验证 |
| Kimi | kimi.com（含 www） | ✅ 已验证 |
| Claude | claude.ai | 🧪 已适配，欢迎反馈 |
| Gemini | gemini.google.com | 🧪 已适配，欢迎反馈 |

## 📦 安装

```bash
git clone https://github.com/Tai-Yng/ChatDeck.git
```

1. 打开 `chrome://extensions/`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择 ChatDeck 文件夹
3. 打开任意支持的 AI 平台即可使用 —— **无需任何构建步骤**

> ⚠️ 安装或更新扩展后，**已打开的聊天页需要刷新一次**才会生效。

## 🔒 隐私

一切均在你的浏览器本地运行：**无网络请求、无数据收集、无遥测**。mermaid 渲染库随扩展内置，不加载任何远程资源。控制台默认零输出。

## ⚠️ 已知限制

- AI 平台前端改版可能导致适配失效（欢迎提交 issue 附上平台与现象）
- Claude / Gemini 适配未经广泛验证
- 超长会话点击「⇡ 收齐历史」时页面会自动滚动数秒

## 🛠 开发

```bash
npm ci        # 安装测试依赖（扩展本体零依赖）
npm test      # vitest + jsdom：适配器夹具回归 + 单元测试
```

架构：manifest 按序注入 `adapters/registry.js` → 各平台 adapter → `core/`。每个 adapter 把平台 DOM 方言翻译成统一接口（选择器 + 行为钩子），核心零平台分支。**新增平台 = 新增一个 adapter 文件 + manifest 两行。**

选择器回归：`tests/fixtures/` 存有各平台真实页面快照（已做隐私净化），改动选择器先过夹具。

## 📄 License

[MIT](LICENSE)
