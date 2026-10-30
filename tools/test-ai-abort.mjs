#!/usr/bin/env node
/* ============================================================
   FT Compass · AI 额度耗尽中止测试
   用法：node tools/test-ai-abort.mjs
   验证：
   - AgnesAI.quotaError / isQuotaError 能识别「试用 AI 次数已用完」
   - Sources.cancel() 之后不再发起任何网络请求（fetch 调用数为 0）
   - 取消错误带 code=cancelled，find.html 会走「已停止」而不是普通失败
   - find.html 在扣试用次数之前预检 AI 额度
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

/* ---------- 1. agnes-ai：额度判定 ---------- */
const MASK = 'FT-Compass-2026';
function seal(n) {
  const bytes = new TextEncoder().encode(JSON.stringify({ n }));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ^ MASK.charCodeAt(i % MASK.length));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeAiContext(used) {
  const store = {};
  if (used != null) {
    store['_a7f1d2'] = seal(used);
    store['_e3b9c4'] = seal(used);
  }
  const ctx = {
    console,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    URL,
    setTimeout,
    clearTimeout,
    Math,
    Date,
    JSON,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    document: { cookie: '' }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'agnes-ai.js'), 'utf8'), ctx, { filename: 'agnes-ai.js' });
  return ctx;
}

const aiFull = makeAiContext(5);
const msgFull = aiFull.AgnesAI.quotaError();
check('AI 额度用尽时给出可读原因', /试用 AI 次数已用完/.test(msgFull), msgFull);
check('识别额度用尽错误', aiFull.AgnesAI.isQuotaError(new Error(msgFull)), msgFull);
check('识别今日上限错误', aiFull.AgnesAI.isQuotaError(new Error('今日 AI 调用已达上限 100 次，明天再来（可在设置中调整）')));
check('不把普通网络错误当额度错误', !aiFull.AgnesAI.isQuotaError(new Error('jina HTTP 429')));

const aiFresh = makeAiContext(0);
check('还有额度时不拦截', aiFresh.AgnesAI.quotaError() === '', aiFresh.AgnesAI.quotaError());
check('AI 剩余次数计算正确', aiFresh.AgnesAI.aiTrialLeft() === 5, String(aiFresh.AgnesAI.aiTrialLeft()));

/* ---------- 2. sources：取消后不再发请求 ---------- */
let fetchCalls = 0;
const PAGE = 'Title: Buyer Co International\n\nURL Source: https://buyer.example\n\n' +
  'Buyer Co International is an importer of scented candles. '.repeat(5);
function fakeFetch() {
  fetchCalls++;
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(PAGE) });
}

const srcCtx = {
  console,
  fetch: fakeFetch,
  AbortSignal: globalThis.AbortSignal,
  URL,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  JSON
};
srcCtx.window = srcCtx;
srcCtx.AgnesAI = {
  findBuyers: async () => { throw new Error('试用 AI 次数已用完（共 5 次）。激活后不限次数。'); },
  ask: async () => { throw new Error('试用 AI 次数已用完（共 5 次）。激活后不限次数。'); },
  parseLoose: () => null
};
vm.createContext(srcCtx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/sources.js'), 'utf8'), srcCtx, { filename: 'sources.js' });
const Sources = srcCtx.Sources;

check('导出取消接口', typeof Sources.cancel === 'function' && typeof Sources.isCancelled === 'function');

Sources.cancel('试用 AI 次数已用完');
const before = fetchCalls;
let abortErr = null;
try {
  await Sources.fetchRaw('https://buyer.example', 1000);
} catch (e) { abortErr = e; }
check('取消后 fetchRaw 立即抛错', !!abortErr, String(abortErr));
check('错误带 cancelled 标记', !!(abortErr && abortErr.cancelled && abortErr.code === 'ABORT'), JSON.stringify(abortErr && { code: abortErr.code, cancelled: abortErr.cancelled }));
check('取消后没有发起网络请求', fetchCalls === before, `${before} -> ${fetchCalls}`);

let runErr = null;
try {
  await Sources.run('ddg', { product: 'candles', queries: [{ q: 'candles importer' }] });
} catch (e) { runErr = e; }
check('取消后 run() 也立即中止', !!(runErr && runErr.cancelled));
check('取消后仍无网络请求', fetchCalls === before, `${before} -> ${fetchCalls}`);

Sources.resetCancel();
check('重置后恢复可用', Sources.isCancelled() === false);
const body = await Sources.fetchRaw('https://buyer.example', 1000);
check('重置后能正常抓页', !!(body && body.text && body.text.length > 100));
check('重置后确实发了请求', fetchCalls > before, String(fetchCalls));

/* AI 源遇到额度错误会抛出，由 find.html 调用 cancel() */
Sources.resetCancel();
let aiErr = null;
try {
  await Sources.run('ai', { product: 'candles', region: 'Russia', type: 'importer' });
} catch (e) { aiErr = e; }
check('AI 源透传额度错误', !!(aiErr && /试用 AI 次数已用完/.test(aiErr.message)), String(aiErr));
check('额度错误可被 isQuotaError 识别', aiFull.AgnesAI.isQuotaError(aiErr));

/* ---------- 3. find.html 静态检查 ---------- */
const find = fs.readFileSync(path.join(root, 'modules/find.html'), 'utf8');
check('find 引入 sources v5', /js\/sources\.js\?v=5/.test(find));
check('find 引入 agnes-ai v9', /agnes-ai\.js\?v=9/.test(find));
check('启动前预检 AI 额度', /function aiQuotaMsg\(\)/.test(find) && /function stopForQuota\(/.test(find));
const preIdx = find.indexOf('var qm=aiQuotaMsg()');
const consumeIdx = find.indexOf("License.consume('find')");
check('预检在扣试用次数之前', preIdx >= 0 && consumeIdx > preIdx, `${preIdx} / ${consumeIdx}`);
check('额度错误会取消整条流水线', /Sources\.cancel\(e\.message\)/.test(find));
check('每个阶段检查取消状态', (find.match(/ensureLive\(\)/g) || []).length >= 3);
check('取消走「已停止」分支', /if\(e&&e\.cancelled\)\{/.test(find));

console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
