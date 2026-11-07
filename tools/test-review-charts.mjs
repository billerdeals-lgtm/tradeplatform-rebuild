/* 复盘图表纯函数回归：node tools/test-review-charts.mjs
   从 review.html 抽出「图表」脚本块，在 vm 里只测不依赖 DOM 的计算：
   快照兼容、日期去重、来源分组、月度报价/赢单率、金额格式。 */
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../modules/review.html', import.meta.url), 'utf8');
const start = src.indexOf('/* ---------- 图表：纯内联 SVG，零依赖 ---------- */');
const end = src.indexOf('/* ---------- AI 复盘');
if (start < 0 || end < 0 || end <= start) {
  console.error('找不到 review.html 的图表脚本块');
  process.exit(1);
}

let data = {};
const sandbox = {
  DataStore: { list: (name) => data[name] || [] },
  window: { innerWidth: 390 },
  document: { getElementById: () => null },
  esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  $: () => null
};
vm.createContext(sandbox);
vm.runInContext(
  src.slice(start, end) + '\nthis.API = { reviewPoint, parseNum, fmtShort, niceMax, sourceLabel, sourceRows, reviewPoints, monthRows };',
  sandbox
);
const A = sandbox.API;

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}

/* 1. 复盘快照：中文 key / 英文 key / 完成率字符串 */
const cn = A.reviewPoint({ period: '2026-11-07', stats: { '线索总数': 34, '触达次数': 31, '完成率': '71%', '各阶段金额': { '成交': 33000 } } });
eq('中文快照线索数', cn.leads, 34);
eq('中文快照触达', cn.touch, 31);
eq('中文快照完成率', cn.rate, 71);
eq('中文快照成交额', cn.won, 33000);
const en = A.reviewPoint({ period: '2026-10-31', stats: { leads: 12, touch: 8, todoRate: 50, wonAmt: 9000 } });
eq('英文快照线索数', en.leads, 12);
eq('英文快照触达', en.touch, 8);
eq('英文快照完成率', en.rate, 50);
eq('英文快照成交额', en.won, 9000);
const legacy = A.reviewPoint({ period: '2026-09-30', stats: { '线索总数': 5, '各阶段金额': { '成交': 1200 } } });
eq('旧快照缺触达补 0', legacy.touch, 0);
eq('旧快照成交额兜底', legacy.won, 1200);

/* 2. 趋势：同日去重、按日期升序、最多 12 点 */
data = { reviews: [
  { period: '2026-10-01', stats: { '线索总数': 1 } },
  { period: '2026-10-01', stats: { '线索总数': 2 } },
  { period: '2026-09-01', stats: { '线索总数': 3 } }
] };
let pts = A.reviewPoints();
eq('同日只保留一条', pts.length, 2);
eq('趋势按日期升序', pts[0].date, '2026-09-01');
eq('同日保留最新快照', pts[1].leads, 2);
data = { reviews: Array.from({ length: 14 }, (_, i) => ({ period: '2026-01-' + String(i + 1).padStart(2, '0'), stats: { '线索总数': i } })) };
eq('趋势最多 12 点', A.reviewPoints().length, 12);

/* 3. 来源效果：分组、兜底、排序、合并其他 */
data = { leads: [
  { source: 'multi_source', stage: '成交' }, { source: 'multi_source', stage: '报价' },
  { source: 'csv', stage: '成交' }, { stage: '待开发' }, { source: 'expo', stage: '成交' }
] };
let rows = A.sourceRows();
eq('来源按线索数降序', rows[0].label, '多渠道');
eq('来源成交数', rows[0].won, 1);
eq('缺失 source 归为手动', rows.filter((r) => r.label === '手动')[0].leads, 1);
eq('source 原样保留未知值', rows.filter((r) => r.label === 'expo')[0].won, 1);
data = { leads: Array.from({ length: 9 }, (_, i) => ({ source: 's' + i, stage: i === 0 ? '成交' : '待开发' })) };
rows = A.sourceRows();
eq('来源最多 7 行（6+其他）', rows.length, 7);
eq('第 7 行是其他', rows[6].label, '其他');

/* 4. 月度报价：近 6 个月、排除草稿、已接受金额、已决赢单率分母 */
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
function mk(offset, status, total) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 15);
  return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-15', status, total };
}
data = { quotes: [ mk(0, 'accepted', 1000), mk(0, 'draft', 9999), mk(0, 'rejected', 500), mk(-1, 'accepted', 2000), mk(-9, 'accepted', 7777) ] };
const months = A.monthRows();
eq('月度固定 6 格', months.length, 6);
const cur = months[months.length - 1];
eq('草稿不计报价总额', cur.total, 1500);
eq('已接受金额', cur.acceptedAmt, 1000);
eq('已决报价数', cur.decided, 2);
eq('已接受数', cur.accepted, 1);
eq('超出 6 个月不统计', months.reduce((s, m) => s + m.total, 0), 3500);

/* 5. 数字与标签 */
eq('2.4k', A.fmtShort(2400), '2.4k');
eq('18.6k', A.fmtShort(18600), '18.6k');
eq('1.2M', A.fmtShort(1200000), '1.2M');
eq('niceMax 2400', A.niceMax(2400), 2500);
eq('niceMax 18600', A.niceMax(18600), 20000);
eq('parseNum 货币', A.parseNum('$1,234.50'), 1234.5);
eq('来源标签 multi_source', A.sourceLabel('multi_source'), '多渠道');
eq('来源标签 csv', A.sourceLabel('csv'), 'CSV 导入');
eq('来源标签 manual', A.sourceLabel('manual'), '手动');
eq('来源标签缺失', A.sourceLabel(''), '手动');
eq('来源标签未知值', A.sourceLabel('expo'), 'expo');

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
