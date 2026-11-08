/* 报价有效期纯函数回归：node tools/test-quote-validity.mjs
   覆盖：日期字段、旧 "30 days" 兼容、自动过期、各状态边界。 */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/quote-validity.js', import.meta.url), 'utf8');
const window = {};
const ctx = { window, console };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const Q = window.QuoteValidity;

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}
function isoOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/* 1. 日期工具 */
eq('todayISO 是本地日期', Q.todayISO(), isoOffset(0));
eq('addDays 跨月', Q.addDays('2026-01-31', 1), '2026-02-01');
eq('addDays 负数', Q.addDays('2026-03-01', -1), '2026-02-28');
eq('parseISO 合法', !!Q.parseISO('2026-11-07'), true);
eq('parseISO 非法', Q.parseISO('30 days'), null);

/* 2. validUntil：新字段优先，旧文本兼容 */
eq('validUntil 直接读取', Q.validUntil({ validUntil: '2026-12-31' }), '2026-12-31');
eq('旧 30 days 按报价日期换算', Q.validUntil({ date: '2026-01-01', validity: '30 days' }), '2026-01-31');
eq('旧 30天 中文写法', Q.validUntil({ date: '2026-01-01', validity: '30天' }), '2026-01-31');
eq('旧 validity 是日期', Q.validUntil({ validity: '2026-12-31' }), '2026-12-31');
eq('日期夹在文本里也能读', Q.validUntil({ validity: 'Valid until 2026-12-31' }), '2026-12-31');
eq('validUntil 夹在文本里也能读', Q.validUntil({ validUntil: '有效期至 2026-12-31' }), '2026-12-31');
eq('旧 30 days 无日期不瞎猜', Q.validUntil({ validity: '30 days' }), '');
eq('无有效期', Q.validUntil({}), '');

/* 3. isExpired：昨天过期，今天/明天不过期 */
eq('昨天已过期', Q.isExpired({ validUntil: isoOffset(-1) }), true);
eq('今天不过期', Q.isExpired({ validUntil: isoOffset(0) }), false);
eq('明天不过期', Q.isExpired({ validUntil: isoOffset(1) }), false);
eq('无日期不过期', Q.isExpired({}), false);

/* 4. effectiveStatus：只自动过期「已发送」 */
eq('已发送 + 过期 → 已过期', Q.effectiveStatus({ status: 'sent', validUntil: isoOffset(-1) }), 'expired');
eq('已发送 + 未过期 → 已发送', Q.effectiveStatus({ status: 'sent', validUntil: isoOffset(1) }), 'sent');
eq('草稿不自动过期', Q.effectiveStatus({ status: 'draft', validUntil: isoOffset(-1) }), 'draft');
eq('已接受不自动过期', Q.effectiveStatus({ status: 'accepted', validUntil: isoOffset(-1) }), 'accepted');
eq('已拒绝不自动过期', Q.effectiveStatus({ status: 'rejected', validUntil: isoOffset(-1) }), 'rejected');
eq('手动已过期保持', Q.effectiveStatus({ status: 'expired', validUntil: isoOffset(1) }), 'expired');
eq('已发送无日期保持', Q.effectiveStatus({ status: 'sent' }), 'sent');

/* 5. 旧数据整条链路："30 days" + 很久以前 → 自动过期 */
eq('旧数据自动过期', Q.effectiveStatus({ status: 'sent', date: '2026-01-01', validity: '30 days' }), 'expired');

/* 6. 文档/导出文本回退 */
eq('validityText 新字段', Q.validityText({ validUntil: '2026-12-31' }), '2026-12-31');
eq('validityText 旧文本', Q.validityText({ validity: '30 days' }), '30 days');

/* 7. 临期视角：7 天内到期 */
eq('今天到期 daysLeft 0', Q.daysLeft({ validUntil: isoOffset(0) }), 0);
eq('3 天后到期 daysLeft 3', Q.daysLeft({ validUntil: isoOffset(3) }), 3);
eq('已过期 daysLeft 负数', Q.daysLeft({ validUntil: isoOffset(-2) }), -2);
eq('没日期 daysLeft null', Q.daysLeft({}), null);
eq('已发送 + 3 天 → 临期', Q.isExpiringSoon({ status: 'sent', validUntil: isoOffset(3) }, 7), true);
eq('草稿 + 3 天 → 也算临期', Q.isExpiringSoon({ status: 'draft', validUntil: isoOffset(3) }, 7), true);
eq('8 天后 → 不算临期', Q.isExpiringSoon({ status: 'sent', validUntil: isoOffset(8) }, 7), false);
eq('已过期 → 不算临期', Q.isExpiringSoon({ status: 'sent', validUntil: isoOffset(-1) }, 7), false);
eq('已接受 → 不算临期', Q.isExpiringSoon({ status: 'accepted', validUntil: isoOffset(1) }, 7), false);
eq('已拒绝 → 不算临期', Q.isExpiringSoon({ status: 'rejected', validUntil: isoOffset(1) }, 7), false);
eq('默认窗口 7 天', Q.isExpiringSoon({ status: 'sent', validUntil: isoOffset(7) }), true);
eq('旧 30 days 也参与临期', Q.isExpiringSoon({ status: 'sent', date: isoOffset(-28), validity: '30 days' }, 7), true);

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
