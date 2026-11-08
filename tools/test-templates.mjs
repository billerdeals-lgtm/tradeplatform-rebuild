/* 话术库数据完整性测试：node tools/test-templates.mjs
   纯数据文件，重点锁住条数、编号、分类、占位符和新增缺口。 */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/templates_data.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const T = ctx.TEMPLATES;

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + (extra ? '：' + extra : ''));
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}

/* 1. 条数与编号连续 */
eq('话术总数 85', T.length, 85);
eq('编号从 0 到 84', [T[0].n, T[T.length - 1].n], [0, 84]);
ok('编号不重复且连续', T.every((t, i) => t.n === i));

/* 2. 分类：原 19 类 + 新增 4 类 */
const cats = {};
T.forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + 1; });
eq('分类总数 23', Object.keys(cats).length, 23);
eq('跟进序列 3 封', cats['跟进序列 / Follow-up'], 3);
eq('涨价通知 3 封', cats['涨价通知 / Price update'], 3);
eq('转介绍 1 封', cats['转介绍 / Referral'], 1);
eq('合规通知 2 封', cats['合规通知 / Compliance'], 2);

/* 3. 字段完整、结构可用 */
let bad = [];
T.forEach(t => {
  if (!t.title || !t.cat || !t.en || !t.cn) bad.push(t.n + ' 空字段');
  if (!/^Subject:/.test(t.en)) bad.push(t.n + ' 缺 Subject');
  if (!/\n\nBest,\n/.test(t.en)) bad.push(t.n + ' 缺落款');
  if (!t.en.includes('{公司}')) bad.push(t.n + ' 缺 {公司}');
  const open = (t.en.match(/\{/g) || []).length;
  const close = (t.en.match(/\}/g) || []).length;
  if (open !== close) bad.push(t.n + ' 花括号不配对');
});
eq('每封都有标题/分类/中英正文/Subject/落款/公司占位符', bad, []);
eq('标题不重复', new Set(T.map(t => t.title)).size, T.length);

/* 4. 占位符自动收集：{展会} 必须在，且新增占位符可见 */
const ph = {};
T.forEach(t => {
  (t.en + '\n' + t.cn).replace(/\{([^{}]+)\}/g, (_, g) => {
    g = String(g).trim();
    if (g) ph[g] = (ph[g] || 0) + 1;
  });
});
['展会', '展位', '推荐人', '涨幅', '原材料', '起运港', '目的港', 'HS编码', '认证'].forEach(name => {
  ok('占位符包含 {' + name + '}', !!ph[name]);
});

/* 5. 新增缺口的关键词 */
ok('新增 D3/D7/D21 跟进序列', ['D3 顶帖', 'D7 换角度', 'D21 分手信'].every(s => T.some(t => t.title.includes(s))));
ok('涨价覆盖汇率/原材料/运费', ['汇率', '原材料', '运费'].every(s => T.some(t => t.cat === '涨价通知 / Price update' && t.title.includes(s))));
ok('新增转介绍请求', T.some(t => t.cat === '转介绍 / Referral' && /referral|转介绍/i.test(t.title + t.en)));
ok('新增关税/HS 与认证变动', T.some(t => t.title.includes('HS')) && T.some(t => t.title.includes('认证要求变动')));

/* 6. 历史 &amp; 双重转义已清理 */
ok('数据里没有 &amp; 字面量', !/&amp;/.test(code));

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
