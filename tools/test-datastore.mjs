/* DataStore 回归测试：node tools/test-datastore.mjs
   重点覆盖计算历史键名修复 + 旧 "undefined" 键迁移。 */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/datastore.js', import.meta.url), 'utf8');

function makeStore(initial) {
  const map = new Map(Object.entries(initial || {}));
  const localStorage = {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }
  };
  const window = {};
  const ctx = { window, localStorage, console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { window, map, DataStore: window.DataStore };
}

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + (extra ? '：' + extra : ''));
}

/* 1. KEYS 里有 calculations */
const a = makeStore({});
ok('KEYS.calculations 已注册', a.DataStore.KEYS.calculations === 'ftc_calculations_v1', String(a.DataStore.KEYS.calculations));
a.DataStore.add('calculations', { product: '计算记录', result: '$19.70' });
ok('写入真实键而非 undefined', a.map.has('ftc_calculations_v1') && !a.map.has('undefined'));
ok('list 能读回', a.DataStore.list('calculations').length === 1);

/* 2. 旧 "undefined" 键整段迁移 */
const legacy = [{ id: 'cal_1', product: '旧计算 1', result: '$13.79' }, { id: 'cal_2', product: '旧计算 2', result: '$19.70' }];
const b = makeStore({ undefined: JSON.stringify(legacy) });
ok('旧数据搬入新键', b.DataStore.list('calculations').length === 2);
ok('旧键已删除', !b.map.has('undefined'));
ok('迁移保留字段', b.DataStore.list('calculations')[0].product === '旧计算 1');

/* 3. 新旧同时存在：按 id 合并，不重复 */
const c = makeStore({
  ftc_calculations_v1: JSON.stringify([{ id: 'cal_1', product: '新键同 id' }]),
  undefined: JSON.stringify([{ id: 'cal_1', product: '旧键同 id' }, { id: 'cal_3', product: '旧键新增' }])
});
const merged = c.DataStore.list('calculations');
ok('合并后 2 条', merged.length === 2, String(merged.length));
ok('同 id 保留新键版本', merged.find(x => x.id === 'cal_1').product === '新键同 id');
ok('旧键独有记录被保留', !!merged.find(x => x.id === 'cal_3'));
ok('合并后旧键删除', !c.map.has('undefined'));

/* 4. 旧键内容不是数组时不动它，也不影响启动 */
const d = makeStore({ undefined: JSON.stringify({ foo: 'bar' }) });
ok('非数组旧键不被误删', d.map.has('undefined'));

/* 5. 备份集合包含计算历史 */
ok('exportAll 含 calculations', Array.isArray(d.DataStore.exportAll().calculations));

/* 6. 触达状态：新记录看 status，旧记录按类型兼容 */
const ds = d.DataStore;
ok('status=sent 视为已发送', ds.outreachSent({ type: 'ai_followup', status: 'sent' }) === true);
ok('status=draft 视为草稿', ds.outreachSent({ type: 'mail', status: 'draft' }) === false);
ok('旧 AI 记录视为草稿', ds.outreachSent({ type: 'ai_rewrite' }) === false);
ok('旧人工记录视为已发送', ds.outreachSent({ type: 'mail' }) === true);
ok('空记录不算已发送', ds.outreachSent(null) === false);

/* 7. 损坏数据：不静默当空集合、保留原文、锁定写入 */
const e = makeStore({ ftc_leads_v1: '{bad json' });
const badList = e.DataStore.list('leads');
ok('损坏集合返回带标记的空数组', Array.isArray(badList) && badList.length === 0 && badList.__corrupt === true);
ok('损坏原文自动留底', !!e.map.get('ftc_leads_v1__corrupt'));
ok('损坏集合锁定 saveAll', (() => {
  try { e.DataStore.saveAll('leads', []); return false; }
  catch (err) { return err.code === 'CORRUPT_LOCK'; }
})());
ok('损坏集合锁定 add', (() => {
  try { e.DataStore.add('leads', { name: 'x' }); return false; }
  catch (err) { return err.code === 'CORRUPT_LOCK'; }
})());
ok('备份包含损坏原文', !!e.DataStore.exportAll()._corrupt.leads.raw);
ok('recover 后恢复写入', (() => {
  const raw = e.DataStore.recover('leads');
  e.DataStore.saveAll('leads', [{ id: 'l1' }]);
  return raw === '{bad json' && e.DataStore.list('leads').length === 1 && e.DataStore.corruptions().length === 0;
})());

/* 8. 合法 JSON 但不是数组，也按损坏处理 */
const f = makeStore({ ftc_quotes_v1: '{"a":1}' });
ok('非数组集合视为损坏', f.DataStore.list('quotes').__corrupt === true);
ok('非数组集合不覆盖原值', f.map.get('ftc_quotes_v1') === '{"a":1}');

/* 9. 没先 list 直接 saveAll，也不能覆盖损坏原文 */
const g = makeStore({ ftc_docs_v1: 'not json' });
ok('直接 saveAll 也被锁定', (() => {
  try { g.DataStore.saveAll('docs', []); return false; }
  catch (err) { return err.code === 'CORRUPT_LOCK' && g.map.get('ftc_docs_v1') === 'not json'; }
})());

/* 10. 配置损坏时也不能被默认值悄悄覆盖 */
const h = makeStore({ ftc_cfg_v1: '[1,2]' });
ok('cfg 非对象视为损坏', h.DataStore.getCfg() && h.DataStore.isCorrupt('cfg'));
ok('cfg 损坏锁定 setCfg', (() => {
  try { h.DataStore.setCfg({ key: 'x' }); return false; }
  catch (err) { return err.code === 'CORRUPT_LOCK'; }
})());

/* 11. 线索阶段变更：DataStore.update 自动追 stageLog */
const s = makeStore({ ftc_leads_v1: JSON.stringify([{ id: 'L1', stage: '待开发' }]) });
s.DataStore.update('leads', 'L1', { stage: '已联系' });
let lead = s.DataStore.get('leads', 'L1');
ok('换阶段追加 stageLog', Array.isArray(lead.stageLog) && lead.stageLog.length === 1);
ok('stageLog 记录 from/to/at', lead.stageLog[0].from === '待开发' && lead.stageLog[0].stage === '已联系' && !!lead.stageLog[0].at);
s.DataStore.update('leads', 'L1', { stage: '已联系' });
lead = s.DataStore.get('leads', 'L1');
ok('同阶段不重复追加', lead.stageLog.length === 1);
s.DataStore.update('leads', 'L1', { note: '只改备注' });
lead = s.DataStore.get('leads', 'L1');
ok('只改备注不追加', lead.stageLog.length === 1);
s.DataStore.update('leads', 'L1', { stage: '成交' });
lead = s.DataStore.get('leads', 'L1');
ok('再次换阶段继续追加', lead.stageLog.length === 2 && lead.stageLog[1].from === '已联系');
ok('非线索集合不写 stageLog', (() => {
  const t = makeStore({ ftc_todos_v1: JSON.stringify([{ id: 'T1', stage: 'x' }]) });
  t.DataStore.update('todos', 'T1', { stage: 'y' });
  return !('stageLog' in t.DataStore.get('todos', 'T1'));
})());

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
