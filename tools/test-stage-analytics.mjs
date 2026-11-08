/* 阶段停留分析纯函数回归：node tools/test-stage-analytics.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/stage-analytics.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const A = ctx.StageAnalytics;

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}
function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + (extra ? '：' + extra : ''));
}

const NOW = '2026-02-01T00:00:00.000Z';
const lead = (extra) => Object.assign({
  id: 'l1', name: 'Acme', stage: '待开发',
  createdAt: '2026-01-01T00:00:00.000Z',
  stageLog: []
}, extra);

/* 1. 没有换阶段：只有一段在途 */
{
  const segs = A.segments(lead(), NOW);
  eq('单段数', segs.length, 1);
  eq('单段阶段', segs[0].stage, '待开发');
  eq('单段在途', segs[0].closed, false);
  eq('单段天数', segs[0].days, 31);
  eq('当前停留', A.currentDays(lead(), NOW), 31);
}

/* 2. 一次换阶段：初始段已完成 + 当前段在途 */
{
  const l = lead({
    stage: '报价',
    stageLog: [{ stage: '报价', from: '待开发', at: '2026-01-11T00:00:00.000Z' }]
  });
  const segs = A.segments(l, NOW);
  eq('两段', segs.length, 2);
  eq('初始段阶段', segs[0].stage, '待开发');
  eq('初始段已完成', segs[0].closed, true);
  eq('初始段 10 天', segs[0].days, 10);
  eq('当前段阶段', segs[1].stage, '报价');
  eq('当前段 21 天', segs[1].days, 21);
  eq('当前停留 21 天', A.currentDays(l, NOW), 21);

  const tr = A.transitions(l, NOW);
  eq('一个流转事件', tr.length, 1);
  eq('流转来自待开发', tr[0].from, '待开发');
  eq('流转后仍在途', tr[0].ongoing, true);
  eq('流转后停留 21 天', tr[0].days, 21);
}

/* 3. 多次换阶段 + 日志乱序：先按时间排序再算 */
{
  const l = lead({
    stage: '成交',
    stageLog: [
      { stage: '报价', from: '已联系', at: '2026-01-20T00:00:00.000Z' },
      { stage: '已联系', from: '待开发', at: '2026-01-11T00:00:00.000Z' },
      { stage: '成交', from: '报价', at: '2026-01-26T00:00:00.000Z' }
    ]
  });
  const segs = A.segments(l, NOW);
  eq('四段', segs.map(s => s.stage), ['待开发', '已联系', '报价', '成交']);
  eq('待开发 10 天', segs[0].days, 10);
  eq('已联系 9 天', segs[1].days, 9);
  eq('报价 6 天', segs[2].days, 6);
  eq('成交 6 天在途', [segs[3].days, segs[3].closed], [6, false]);
  eq('当前成交阶段停留', A.currentDays(l, NOW), 6);
}

/* 4. 平均停留：只算已完成区段；在途单列 */
{
  const a = lead({
    id: 'a',
    stageLog: [{ stage: '已联系', from: '待开发', at: '2026-01-06T00:00:00.000Z' }]
  });
  const b = lead({
    id: 'b',
    createdAt: '2026-01-01T00:00:00.000Z',
    stageLog: [{ stage: '已联系', from: '待开发', at: '2026-01-11T00:00:00.000Z' }]
  });
  const s = A.stats([a, b], NOW);
  const dev = s.rows.find(r => r.stage === '待开发');
  eq('待开发平均 (5+10)/2', dev.avgClosed, 7.5);
  eq('待开发完成次数', dev.closedCount, 2);
  eq('待开发在途 0', dev.ongoingCount, 0);
  const contacted = s.rows.find(r => r.stage === '已联系');
  eq('已联系无完成样本', contacted.avgClosed, null);
  eq('已联系在途 2 条', contacted.ongoingCount, 2);
  eq('已联系平均在途', contacted.avgOngoing, 23.5);
  eq('流转总数', s.transitions, 2);
  eq('有日志线索数', s.leadsWithLog, 2);
}

/* 5. 缺 from / 缺 createdAt 不瞎猜 */
{
  const l = lead({
    stageLog: [{ stage: '报价', from: '', at: '2026-01-11T00:00:00.000Z' }],
    createdAt: ''
  });
  const segs = A.segments(l, NOW);
  eq('缺 from 只保留当前段', segs.map(s => s.stage), ['报价']);
  eq('缺创建时间也能算当前停留', A.currentDays(l, NOW), 21);
}

/* 6. 非法/未来时间不产生负数 */
{
  const l = lead({
    stageLog: [
      { stage: '已联系', from: '待开发', at: '2026-03-01T00:00:00.000Z' },
      { stage: '报价', from: '已联系', at: '2026-02-01T00:00:00.000Z' }
    ]
  });
  const segs = A.segments(l, NOW);
  ok('区段天数不为负', segs.every(s => s.days >= 0), JSON.stringify(segs.map(s => s.days)));
}

/* 7. 显示格式 */
eq('fmtDays 0.4', A.fmtDays(0.4), '<1');
eq('fmtDays 12.34', A.fmtDays(12.34), '12.3');
eq('fmtDays null', A.fmtDays(null), '—');

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
