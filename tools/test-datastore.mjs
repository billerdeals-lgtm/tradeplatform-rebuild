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

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
