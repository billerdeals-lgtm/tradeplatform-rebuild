#!/usr/bin/env node
/* ============================================================
   FT Compass · AI 公司名核验测试
   用法：node tools/test-ai-verify.mjs
   目的：确保「模型点名的公司」必须在官网域名/标题中找到对应名称，
         降低 AI 编造公司的概率。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const ctx = {
  console,
  fetch: function () { throw new Error('no network in test'); },
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
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/sources.js'), 'utf8'), ctx, { filename: 'sources.js' });

const match = ctx.Sources.aiNameMatches;
if (typeof match !== 'function') {
  console.error('FAIL: Sources.aiNameMatches 未导出');
  process.exit(1);
}

const cases = [
  // [公司名, 域名, 页面标题, 期望]
  ['Acme Trading LLC', 'acmetrading.com', 'Acme Trading - Home', true],
  ['Acme Trading LLC', 'acme.com', '', true],
  ['Acme Trading LLC', 'totallydifferent.com', 'Totally Different Inc', false],
  ['Global Tech Ltd', 'globaltech.io', '', true],
  ['ООО «Балтийский Торг»', 'baltictorg.ru', 'Балтийский Торг — оптовая торговля', true],
  ['ООО «Балтийский Торг»', 'unrelated.ru', 'Мебельный магазин', false],
  ['Shenzhen Foo Technology Co Ltd', 'footech.cn', 'Foo Technology Co., Ltd', true],
  ['Shenzhen Foo Technology Co Ltd', 'unrelated.cn', 'Другой сайт', false],
  ['ABC', 'x.com', '', false],
  ['Nordic Home ApS', 'nordichome.dk', 'Nordic Home', true],
  ['Nordic Home ApS', 'nordichome.dk', '', true]
];

let pass = 0, fail = 0;
for (const [name, domain, title, want] of cases) {
  const got = match(name, domain, title);
  if (got === want) pass++;
  else {
    fail++;
    console.error(`FAIL: ${name} @ ${domain} / "${title}" => ${got}, want ${want}`);
  }
}

/* 提示词检查：必须明确“不确定就不要列公司” */
const aiSrc = fs.readFileSync(path.join(root, 'agnes-ai.js'), 'utf8');
const promptChecks = [
  ['禁止编造', aiSrc.includes('不要编造')],
  ['不确定就不列', aiSrc.includes('不确定就不要列')],
  ['要求官方域名', aiSrc.includes('官方域名')],
  ['输出搜索词', aiSrc.includes('"queries"')]
];
for (const [label, ok] of promptChecks) {
  if (ok) pass++;
  else { fail++; console.error('FAIL: 提示词缺少「' + label + '」'); }
}

console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
