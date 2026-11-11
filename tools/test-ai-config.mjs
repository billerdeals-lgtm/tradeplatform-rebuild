#!/usr/bin/env node
/* ============================================================
   FT Compass · AI 接口地址与 CSP 一致性测试
   用法：node tools/test-ai-config.mjs
   验证：
   - 历史自定义接口地址被强制回退到内置 Agnes 域名
   - 设置面板地址框只读，并写明「仅内置服务 / 改网关需改 CSP」
   - 保存时忽略地址框，永远写入内置地址
   - 自定义密钥 / 模型 / 每日上限仍然保留
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const LS_KEY = 'agnes_ai_cfg';

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

const store = {
  [LS_KEY]: JSON.stringify({
    base: 'https://my-gateway.example/v1',
    key: 'user-key',
    model: 'my-model',
    dailyLimit: 7
  })
};
const elements = {
  ag_base: { value: 'https://my-gateway.example/v1' },
  ag_key: { value: 'user-key' },
  ag_model: { value: 'my-model' },
  ag_limit: { value: '7' }
};

const ctx = {
  console,
  JSON,
  Math,
  Date,
  setTimeout,
  clearTimeout,
  btoa,
  atob,
  TextEncoder,
  TextDecoder,
  URL,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  },
  document: {
    cookie: '',
    getElementById: (id) => elements[id] || null
  },
  alert: () => {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'agnes-ai.js'), 'utf8'), ctx, { filename: 'agnes-ai.js' });

const builtin = 'https://apihub.agnes-ai.com/v1';

/* 1. 读配置时强制回退内置地址 */
const cfg = ctx.AgnesAI.loadCfg();
check('历史自定义接口地址被强制回退到内置服务', cfg.base === builtin, cfg.base);
check('自定义密钥仍然保留', cfg.key === 'user-key', cfg.key);
check('自定义模型仍然保留', cfg.model === 'my-model', cfg.model);
check('每日上限仍然保留', cfg.dailyLimit === 7, String(cfg.dailyLimit));

/* 2. 设置面板：只读 + 明确说明 */
const html = ctx.AgnesAI.settingsHTML();
check('接口地址输入框只读', /id="ag_base"[^>]*readonly/.test(html));
check('地址框显示内置地址', html.includes('value="' + builtin + '"'));
check('说明写明仅内置服务', /接口地址固定为内置服务/.test(html));
check('说明写明改网关需同步改 CSP', /同步修改各页 CSP/.test(html));
check('不再承诺可直接切换其它服务', !/修改下方内容并保存即可/.test(html));
check('不再出现自建网关占位符', !/你的网关\/v1/.test(html));

/* 3. 保存时忽略地址框，永远写入内置地址 */
ctx.AgnesAI.saveFromPanel();
const saved = JSON.parse(store[LS_KEY]);
check('保存的接口地址固定为内置服务', saved.base === builtin, saved.base);
check('保存仍写入用户密钥', saved.key === 'user-key', saved.key);

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
