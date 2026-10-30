/* 定价公式回归测试：node tools/test-pricing.mjs
   覆盖 2026-10-30 深度测试里的三类错误：
   ① FOB 不含海运费/保险费，CIF 只加一次；
   ② 毛利率按售价（÷ (1 − 毛利率)），不是成本加成；
   ③ 佣金只计一次，含佣价就是 FOB。 */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/pricing.js', import.meta.url), 'utf8');
const ctx = { window: undefined };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const priceQuote = ctx.FT && ctx.FT.priceQuote;
if (typeof priceQuote !== 'function') {
  console.error('FAIL js/pricing.js 未暴露 FT.priceQuote');
  process.exit(1);
}

let pass = 0, fail = 0;
function eq(name, actual, expected, digits = 2) {
  const ok = typeof expected === 'number'
    ? Math.abs(actual - expected) < Math.pow(10, -digits) / 2
    : actual === expected;
  if (ok) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：期望 ' + expected + '，实际 ' + actual);
}
function approx(name, actual, expected, tol = 0.01) {
  if (Math.abs(actual - expected) <= tol) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：期望 ' + expected + ' ±' + tol + '，实际 ' + actual);
}

/* 用户实测数字：成本 ¥100，毛利率 0，海运费 ¥725（=100 USD），汇率 7.25 */
const base = { cost: 100, rate: 7.25, qty: 1000 };
const a = priceQuote(Object.assign({}, base, { marginPct: 0, ocean: 725 }));
eq('FOB 不含海运 (100/7.25)', a.fob, 13.7931, 4);
eq('CIF 只加一次海运', a.cif, 113.7931, 4);
eq('FOB 与运费无关', priceQuote(Object.assign({}, base, { marginPct: 0 })).fob, a.fob, 4);

/* 毛利率 30% → 100 / 0.7 / 7.25 = 19.70 */
const b = priceQuote(Object.assign({}, base, { marginPct: 30 }));
eq('30% 毛利率 FOB', b.fob, 19.7044, 4);
eq('实际毛利率回到 30%', b.actualMargin, 30, 6);
approx('成本加成 42.9%', b.markup, 42.857, 0.01);
eq('单件利润 = 售价 × 30%', b.profit, b.fob * 0.3, 2);

/* 佣金 5%：FOB 含佣一次，不能再除一次 */
const c = priceQuote(Object.assign({}, base, { marginPct: 30, commPct: 5 }));
const noComm = priceQuote(Object.assign({}, base, { marginPct: 30 }));
approx('佣金把 FOB 抬高 /0.95', c.fob, noComm.fob / 0.95, 0.01);
approx('佣金金额', c.commission, c.fob * 0.05, 0.01);
eq('扣佣后实收 = 不含佣 FOB', c.netCNY / 7.25, noComm.fob, 4);
eq('扣佣后毛利率仍为 30%', c.actualMargin, 30, 6);
eq('总利润 = 单件利润 × 数量', c.totalProfit, c.profit * 1000, 2);

/* 边界 */
eq('毛利率 100% 被拒绝', priceQuote(Object.assign({}, base, { marginPct: 100 })).ok, false);
eq('佣金 100% 被拒绝', priceQuote(Object.assign({}, base, { marginPct: 30, commPct: 100 })).ok, false);
eq('成本为 0 被拒绝', priceQuote(Object.assign({}, base, { cost: 0, marginPct: 30 })).ok, false);
eq('汇率为 0 被拒绝', priceQuote(Object.assign({}, base, { rate: 0 })).ok, false);

/* 报关/港杂属于 FOB 基准，海运/保险不属于 */
const d = priceQuote(Object.assign({}, base, { marginPct: 0, customs: 10, portFee: 5 }));
eq('报关+港杂进入 FOB 基准', d.fob, 115 / 7.25, 4);
eq('报关+港杂不进入 CIF 加价', d.cif, 115 / 7.25, 4);

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
