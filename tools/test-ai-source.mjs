#!/usr/bin/env node
/* ============================================================
   FT Compass · AI 来源核验测试
   用法：node tools/test-ai-source.mjs
   用假的模型响应 + 假的官网页面，验证：
   - 官网可达且名称匹配的公司保留
   - 名称不匹配 / 无官网的公司丢弃
   - 模型给的搜索词走真实搜索（这里是 stub），结果保留
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const REAL_PAGE = 'Title: Real Co International\n\nURL Source: https://realco.com\n\n' +
  'Real Co International is a distributor of scented candles and home fragrance. ' +
  'We import 40 containers per year and supply 300 retail stores across Russia. '.repeat(3);

const FAKE_PAGE = 'Title: Totally Different Inc\n\nURL Source: https://totallydifferent.com\n\n' +
  'We sell industrial pumps and valves to factories. '.repeat(6);

const DDG_MD = '[Buyer One - candles wholesale](https://buyer-one.ru/catalog)\n' +
  '[Alibaba candles](https://www.alibaba.com/product/1)\n\n' +
  'DuckDuckGo search results for candles importer Russia. '.repeat(4);

let fetchCalls = 0;
function fakeFetch(url) {
  fetchCalls++;
  let body = null;
  if (url.includes('r.jina.ai/https://realco.com')) body = REAL_PAGE;
  else if (url.includes('r.jina.ai/https://totallydifferent.com')) body = FAKE_PAGE;
  else if (url.includes('duckduckgo.com')) body = DDG_MD;
  if (body == null) return Promise.reject(new Error('404 ' + url));
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body)
  });
}

const ctx = {
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
ctx.window = ctx;
ctx.AgnesAI = {
  findBuyers: async () => ({
    queries: ['candles importer Russia', 'оптовые свечи Россия'],
    companies: [
      { name: 'Real Co International', country: 'Russia', website: 'https://realco.com', why: 'distributor' },
      { name: 'Fake Corp', country: 'Russia', website: 'https://totallydifferent.com', why: 'invented' },
      { name: 'No Site Ltd', country: 'Russia', why: 'no domain' }
    ]
  })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/sources.js'), 'utf8'), ctx, { filename: 'sources.js' });

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

const out = await ctx.Sources.run('ai', { product: 'candles', region: 'Russia', type: 'importer' });
const names = out.map(x => x.name);
const stats = ctx.Sources.lastAiStats;

check('保留官网核验通过的公司', names.includes('Real Co International'), JSON.stringify(names));
check('丢弃官网名称不匹配的公司', !names.includes('Fake Corp'), JSON.stringify(names));
check('丢弃没有官网的公司', !names.includes('No Site Ltd'), JSON.stringify(names));
check('保留真实搜索发现的域名', out.some(x => (x.website || '').includes('buyer-one.ru')), JSON.stringify(names));
check('屏蔽 B2B 平台结果', !out.some(x => (x.website || '').includes('alibaba.com')), JSON.stringify(names));
check('所有 AI 候选都有核验标记', out.every(x => x._aiVerified === true), JSON.stringify(out.map(x => [x.name, x._aiVerified])));
check('统计：建议 3 家', stats && stats.suggested === 3, JSON.stringify(stats));
check('统计：官网通过 1 家', stats && stats.verified === 1, JSON.stringify(stats));
check('统计：丢弃 2 家', stats && stats.dropped === 2, JSON.stringify(stats));
check('统计：搜索新增 1 家', stats && stats.fromSearch === 1, JSON.stringify(stats));
check('确实发起了网络请求', fetchCalls > 0, String(fetchCalls));

console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
