/* 跨模块联动回归测试：node tools/test-module-wiring.mjs
   这些不是纯函数，没法用 vm 跑，只能用静态断言锁住字段名和跳转契约，
   防止以后改一个模块又把另一个模块的入口改回「永远不显示」。 */
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const squash = (s) => s.replace(/\s+/g, '');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + (extra ? '：' + extra : ''));
}

const todos = read('modules/todos.html');
const templates = read('modules/templates.html');
const holidays = read('modules/holidays.html');
const quotes = read('modules/quotes.html');
const docs = read('modules/docs.html');
const c360 = read('modules/customer360.html');
const leads = read('modules/leads.html');

/* 1. 线索的 WhatsApp 字段是 wa，不是 whatsapp */
[[todos, '待办'], [templates, '话术库'], [holidays, '节假日']].forEach(function (pair) {
  const src = pair[0], name = pair[1];
  const stripped = src.replace(/lead\s*\.\s*wa\s*\|\|\s*lead\s*\.\s*whatsapp/g, '');
  ok(name + '不再直接读 lead.whatsapp', !/lead\s*\.\s*whatsapp/.test(stripped));
});
ok('待办 WhatsApp 按钮使用 wa 字段', /lead&&\(lead\.wa\|\|lead\.whatsapp\)/.test(squash(todos)));
ok('话术库 WhatsApp 发送使用 wa 字段', /lead\.wa\|\|lead\.whatsapp/.test(squash(templates)));
ok('节假日 WhatsApp 发送使用 wa 字段', /lead\.wa\|\|lead\.whatsapp/.test(squash(holidays)));

/* 2. 报价列表按条目自身币种显示，不能用编辑器当前选择 */
const listBlock = quotes.slice(quotes.indexOf('function renderList'), quotes.indexOf('function newQuote'));
ok('报价列表读取 item.currency', /item\.currency/.test(listBlock));
ok('报价列表不再借用编辑器币种', !/v\('q_currency'\)/.test(listBlock));

/* 3. 客户 360 → 报价：把 leadId 带过去 */
ok('客户 360 报价按钮携带 lead 参数', /quotes\.html\?lead=/.test(c360));
ok('报价页启动时读取 lead 参数', /get\('lead'\)/.test(quotes) || /get\("lead"\)/.test(quotes));

/* 4. 客户 360 的单证匹配读 values.buyer（真实存储结构） */
ok('客户 360 单证匹配 values.buyer', /d\.values\s*&&\s*d\.values\.buyer/.test(c360));
ok('客户 360 单证标题读 docTitle', /docTitle/.test(c360));

/* 5. 单证删除必须经过确认函数，不能内联 remove */
ok('单证删除走 delSaved()', /function delSaved\s*\(/.test(docs) && /onclick="delSaved\(/.test(docs));
ok('单证删除有二次确认', /confirm\(/.test(docs.slice(docs.indexOf('function delSaved'), docs.indexOf('function loadSaved'))));
ok('单证夹不再内联 DataStore.remove', !/onclick="DataStore\.remove\('docs'/.test(docs));

/* 6. 删除线索只解除关联，不删业务记录 */
ok('删除线索调用 unlinkLeadRefs', /unlinkLeadRefs\(id\);/.test(leads));
ok('解除关联覆盖 todos/quotes/comps/outreach', /\['todos', 'quotes', 'comps', 'outreach'\]/.test(leads));
ok('解除关联只清 leadId', /x\.leadId = ''/.test(leads));

/* 7. 旧报价的已删线索不被静默清空 */
ok('打开旧报价补「线索已删除」选项', /线索已删除/.test(quotes) && /appendChild\(orphanOpt\)/.test(quotes));
ok('保存报价保留原 leadName', /prev && prev\.leadId === lid/.test(quotes));

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
