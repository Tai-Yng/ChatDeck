import { describe, it, expect } from 'vitest';
import manifest from '../manifest.json';

describe('manifest', () => {
  it('版本 0.1.0', () => expect(manifest.version).toBe('0.1.0'));
  it('注入顺序：registry 最先、content.js 最后、五个 adapter 居中', () => {
    const js = manifest.content_scripts[0].js;
    expect(js[0]).toBe('adapters/registry.js');
    expect(js.at(-1)).toBe('core/content.js');
    for (const p of ['deepseek', 'chatgpt', 'claude', 'gemini', 'kimi'])
      expect(js.some(f => f === `adapters/${p}.js`)).toBe(true);
  });
  it('五主域全部具备 host_permissions 与 matches', () => {
    const domains = ['chat.deepseek.com', 'chatgpt.com', 'kimi.com', 'claude.ai', 'gemini.google.com'];
    for (const d of domains) {
      expect(manifest.host_permissions.some(p => p.includes(d))).toBe(true);
      expect(manifest.content_scripts[0].matches.some(m => m.includes(d))).toBe(true);
    }
  });
  it('manifest 引用的每个 js/css/图标文件都存在（防注入空转）', async () => {
    const fs = await import('node:fs');
    const files = [
      ...manifest.content_scripts[0].js,
      ...manifest.content_scripts[0].css,
      ...Object.values(manifest.icons),
      manifest.background.service_worker,
      manifest.action.default_popup,
    ];
    for (const f of files) expect(fs.existsSync(f), `missing: ${f}`).toBe(true);
  });
});
