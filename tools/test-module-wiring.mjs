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
const review = read('modules/review.html');
const maillog = read('modules/maillog.html');
const datastore = read('js/datastore.js');
const quoteValidity = read('js/quote-validity.js');
const leadDedupe = read('js/lead-dedupe.js');
const license = read('js/license.js');
const tplData = read('js/templates_data.js');
const home = read('index.html');

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
ok('解除关联覆盖 todos/quotes/comps/outreach/docs', /\['todos', 'quotes', 'comps', 'outreach', 'docs'\]/.test(leads));
ok('解除关联只清 leadId', /x\.leadId = ''/.test(leads));

/* 7. 单证闭环：切换同类型不再重复新建，leadId 随单保存 */
ok('单证切换先查找同客户已存单', /var saved = findSavedForCurrentCustomer\(id\)/.test(docs));
ok('单证保存写入 leadId', /leadId: currentLeadId \|\| ''/.test(docs));
ok('从线索带入记录 leadId', /currentLeadId = l\.id/.test(docs));
ok('打开已存单恢复 leadId', /currentLeadId = d\.leadId/.test(docs));
ok('单证夹显示客户关联标记', /leadMark = d\.leadId/.test(docs));
ok('换客户导入不覆盖原单', /换客户后另存新单/.test(docs) && /editingSavedId = null;/.test(docs.slice(docs.indexOf('function doImport'), docs.indexOf('/* ---------- 初始化'))));

/* 8. 旧报价的已删线索不被静默清空 */
ok('打开旧报价补「线索已删除」选项', /线索已删除/.test(quotes) && /appendChild\(orphanOpt\)/.test(quotes));
ok('保存报价保留原 leadName', /prev && prev\.leadId === lid/.test(quotes));

/* 9. 跟进闭环：最后联系可编辑，发送才算已发送 */
ok('线索编辑含最后联系字段', /id="e_last"/.test(leads) && /getElementById\('e_last'\)\.value/.test(leads));
ok('保存线索写入最后联系', /last: v\('e_last'\)/.test(leads));
ok('AI 生成先落草稿', /status: 'draft'/.test(leads) && /S\.lastDraftId = rec\.id/.test(leads));
ok('发送后回写最后联系', /l\.last = iso\(0\)/.test(leads));
ok('发送后草稿转已发送', /function markSent/.test(leads) && /status: 'sent'/.test(leads));
ok('发送被拦截时不记已发送', /浏览器拦截了新窗口/.test(leads) && /markSent\(channel, body\)/.test(leads));
ok('线索页定义 toast（发送提示不能抛 ReferenceError）', /function toast\(msg\)\{ if \(window\.FT && FT\.toast\) FT\.toast\(msg\); \}/.test(leads));
ok('复盘只统计已发送触达', /outreach\.filter\(function\(o\)\{ return DataStore\.outreachSent\(o\); \}\)/.test(review));
ok('发送记录有草稿/已发送标签', /tag-draft/.test(maillog) && /tag-sent/.test(maillog));
ok('发送记录可按状态筛选', /id="fStatus"/.test(maillog) && /s === 'draft'/.test(maillog));
ok('发送记录导出含状态列', /\['时间', '客户', '类型', '状态', '内容'\]/.test(maillog));
ok('待办/话术/节日都写草稿状态', /status:'draft'/.test(todos) && /status:'draft'/.test(templates) && /status:'draft'/.test(holidays));
ok('节日已问候只认已发送', /DataStore\.outreachSent\(o\)/.test(holidays.slice(holidays.indexOf('function greeted'), holidays.indexOf('function markGreetSent'))));
ok('客户 360 触达只统计已发送', /sentOutreach = outreach\.filter/.test(c360) && /sentOutreach\.length/.test(c360));
ok('客户 360 草稿与已发送分开展示', /sent\?'已发送':'草稿'/.test(c360));
ok('DataStore 提供统一已发送判定', /outreachSent: function/.test(datastore));

/* 10. 数据安全：损坏不静默、写入锁定、备份保留原文 */
ok('DataStore 区分空数据与损坏', /safe\.__corrupt = true/.test(datastore));
ok('损坏集合锁定 saveAll', /saveAll: function[\s\S]{0,120}isCorrupt\(name\)[\s\S]{0,80}throw corruptLockError/.test(datastore));
ok('DataStore 提供原文读取与恢复', /readRaw: function/.test(datastore) && /recover: function/.test(datastore));
ok('备份保留损坏原文', /data\._corrupt\[name\]/.test(read('index.html')));
ok('恢复前自动备份当前数据', /backupAll\(true, '恢复备份'\)/.test(read('index.html')));
ok('备份逾期检测读取原始数据', /DataStore\.readRaw\(name\)/.test(read('index.html')));

/* 11. 核心业务闭环（方案 A）：线索→报价→PI→跟进 */
ok('线索卡有报价入口', /goQuote\(\\'' \+ jsArg\(l\.id\)/.test(leads) && /function goQuote\(id\)/.test(leads));
ok('线索报价跳到报价页并带 lead 参数', /modules\/quotes\.html\?lead=/.test(leads));
ok('报价页有转 PI 入口', /onclick="toPI\(\)"/.test(quotes) && /function toPI\(\)/.test(quotes));
ok('报价标题不覆盖预览/品牌按钮', /id="editorTitleText"/.test(quotes) && !/\$\('editorTitle'\)\.textContent/.test(quotes));
ok('报价转 PI 前先校验明细并保存', /function toPI\(\) \{[\s\S]{0,220}getItems\(\)\.length[\s\S]{0,220}saveQuote\(\)/.test(quotes));
ok('报价转 PI 跳到单证页并带 quote 参数', /modules\/docs\.html\?quote=/.test(quotes));
ok('单证页识别 quote 参数', /params\.get\('quote'\)/.test(docs) && /function openFromQuote\(qid\)/.test(docs));
ok('单证页识别 lead 参数', /params\.get\('lead'\)/.test(docs) && /function importLeadById\(id\)/.test(docs));
ok('同一报价按 quoteId 去重', /d\.docId === 'pi' && d\.quoteId === qid/.test(docs));
ok('单证保存 quoteId/quoteNo', /quoteId: currentQuoteId \|\| ''/.test(docs) && /quoteNo: currentQuoteNo \|\| ''/.test(docs));
ok('单证夹显示来源报价', /💰 ' \+ esc\(d\.quoteNo\)/.test(docs));
ok('换客户时解除报价关联', /currentLeadId !== l\.id\)\{ currentQuoteId = ''; currentQuoteNo = ''; \}/.test(docs));
ok('客户 360 有单证入口', /modules\/docs\.html\?lead=/.test(c360) && /📄 单证/.test(c360));
ok('AI 触达默认勾选 3 天提醒', /id="t_remind" checked/.test(leads));
ok('发送后自动建跟进待办且去重', /aiGenerated: 'outreach_sent'/.test(leads) && /已有未完成待办，未重复创建/.test(leads));

/* 12. 移动端布局回归：viewport、3+2 按钮、3×2 统计、漏斗等分、标签页换行 */
const products = read('modules/products.html');
const responsive = read('assets/responsive.css');
const compact = squash(responsive);
ok('线索页有 viewport（独立打开不缩成 980px）', /<meta name="viewport" content="width=device-width, initial-scale=1.0">/.test(leads));
ok('线索卡按钮包进 .acts 容器', /\+\s*'<div class="acts">'/.test(leads) && /\+\s*'<\/div>'\s*\+\s*'<\/div><div class="meta">'/.test(leads));
ok('线索卡按钮 3+2 等宽', /\.lead\.acts\{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/.test(compact) && /nth-child\(4\)/.test(compact) && /nth-child\(5\)/.test(compact));
ok('商品库 3 张统计卡一行', /<div class="stats s3">/.test(products));
ok('客户 360 统计 3×2', /\.stats-bar\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(compact));
ok('客户 360 标签页 4 列换行不裁切', /\.tabs\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(compact) && /overflow:visible/.test(compact));
ok('复盘漏斗 5 阶段等分', /\.funnel\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(compact));
ok('报价标题移动端分行不竖排', /#editorTitle>#editorTitleText\{flex:11100%;\}/.test(compact) && /#editorTitle\.preview-togglebutton\{white-space:nowrap;\}/.test(compact));
ok('发送记录删除按钮触控尺寸', /class="log-del"/.test(maillog) && /\.log-del\{[^}]*min-height:28px/.test(squash(maillog)));
ok('发送记录导出按钮使用统一按钮样式', /<button class="iconbtn" onclick="exportCsv\(\)">/.test(maillog));
ok('待办工具条移动端 2 列 + 导入整行', /class="toolbar toolbar-todos"/.test(todos) && /\.toolbar-todos\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(compact));

/* 13. 复盘图表：趋势 / 转化率 / 来源 / 月度报价（纯内联 SVG） */
const rv = read('modules/review.html');
const rvc = squash(rv);
ok('复盘页有 3 个图表容器', /id="trendChart"/.test(rv) && /id="sourceChart"/.test(rv) && /id="monthChart"/.test(rv));
ok('漏斗阶段转化率有容器与计算', /id="convRow"/.test(rv) && /st\.byStage\[cur\]\*100\/st\.byStage\[prev\]/.test(rvc));
ok('趋势兼容中英文 stats key', /'线索总数','leads'/.test(rvc) && /'成交额','wonAmt'/.test(rvc) && /'各阶段金额'/.test(rvc));
ok('趋势按日期去重且最多 12 点', /byDate\[p\.date\]=p/.test(rvc) && /slice\(-12\)/.test(rvc));
ok('来源分组映射', /multi_source/.test(rv) && /CSV 导入/.test(rv) && /source\|\|'manual'/.test(rvc));
ok('月度报价排除草稿并按已决算赢单率', /q\.status==='draft'/.test(rvc) && /q\.status==='accepted'\|\|q\.status==='rejected'\|\|q\.status==='expired'/.test(rvc));
ok('历史复盘读中文快照', /varp=reviewPoint\(r\)/.test(rvc) && /成交 \$/.test(rv));
ok('图表无第三方依赖', !/chart\.js|cdn\.jsdelivr|unpkg\.com|cdnjs/i.test(rv));
ok('CSV 导入标记来源', /rec\.source = 'csv'/.test(leads));
ok('手动新增标记来源', /obj\.source = 'manual'/.test(leads));
ok('模块缓存版本已升级到 20261108b', /MODULE_V = '20261108b'/.test(home));
ok('响应式样式版本已升级', /responsive\.css\?v=11/.test(home) && /responsive\.css\?v=11/.test(leads) && /responsive\.css\?v=11/.test(quotes));

/* 14. 报价有效期日期化 + 渲染时自动过期 + 首页问候 + 阶段日志 */
ok('报价有效期改为 date 字段', /id="q_validity" type="date"/.test(quotes));
ok('有效期默认值改为 30 天后日期', /FT\.today\(30\)/.test(quotes) && !/\$\('q_validity'\)\.value = '30 days'/.test(quotes));
ok('报价保存 validUntil 与兼容 validity', /validUntil: v\('q_validity'\), validity: v\('q_validity'\)/.test(quotes));
ok('有效期 helper 兼容旧 30 days', /day\|days\|天/.test(quoteValidity));
ok('自动过期只作用于已发送', /st === 'sent' \|\| st === 'expired'/.test(quoteValidity) && /isExpired\(q\)/.test(quoteValidity));
ok('报价列表按生效状态渲染', /QuoteValidity\.effectiveStatus\(item\)/.test(quotes) && /st-' \+ esc\(est\)/.test(quotes));
ok('报价筛选按生效状态匹配', /QuoteValidity\.effectiveStatus\(item\) !== st/.test(quotes));
ok('首页报价徽标使用生效状态', /QuoteValidity\.effectiveStatus\(q\)/.test(home) && /hQuotes/.test(home));
ok('首页问候按小时切换', /id="greet"/.test(home) && /function greetingText/.test(home) && /早上好.*下午好.*晚上好/.test(home));
ok('首页和报价页都加载有效期 helper', /quote-validity\.js\?v=1/.test(home) && /quote-validity\.js\?v=1/.test(quotes));
ok('DataStore.update 换阶段追 stageLog', /patch\.stage && patch\.stage !== prevStage/.test(datastore) && /stageLog\.push/.test(datastore));
ok('线索编辑换阶段追 stageLog', /prevStage/.test(leads) && /l\.stageLog\.push/.test(leads));
ok('单证读取 validUntil 兜底', /values\.valid = q\.validUntil \|\| q\.validity/.test(docs));
ok('datastore 缓存版本已升级', /datastore\.js\?v=6/.test(home) && /datastore\.js\?v=6/.test(quotes) && /datastore\.js\?v=6/.test(leads));

/* 15. 手工线索模糊查重 + 购买链路 */
ok('线索页加载查重 helper', /lead-dedupe\.js\?v=1/.test(leads));
ok('保存线索前调用模糊查重并排除自己', /LeadDedupe\.find\(S\.leads, obj, S\.editId\)/.test(leads));
ok('查重命中可跳过或强行保存', /疑似已有类似客户/.test(leads) && /点「取消」返回修改/.test(leads) && /if \(!confirm\([\s\S]{0,260}\)\) return;/.test(leads));
ok('查重按名称和域名匹配', /名称完全相同/.test(leadDedupe) && /网站\/邮箱域名相同/.test(leadDedupe));
ok('公共邮箱不参与域名匹配', /GENERIC_DOMAINS/.test(leadDedupe) && /gmail\.com/.test(leadDedupe));
ok('购买入口有微信/邮箱占位', /BUY_WECHAT/.test(license) && /BUY_EMAIL/.test(license) && /buy@ftcompass\.com/.test(license));
ok('我已购买有可用转化路径', /mailto:/.test(license) && /global\.location\.href = BUY_URL/.test(license));
ok('激活弹窗展示联系方式', /buyContactText\(\)/.test(license) && /lic-buy/.test(license));
ok('license 缓存版本已升级', /license\.js\?v=4/.test(home) && /license\.js\?v=4/.test(quotes));

/* 16. 话术库补缺 + 占位符说明 + 默认按热度 */
ok('话术数据缓存版本已升级', /templates_data\.js\?v=2/.test(templates));
ok('话术库默认按使用热度排序', /<option value="hot" selected>按使用热度<\/option>/.test(templates));
ok('占位符说明从全部话术自动收集', /var PH = \(function\(\)/.test(templates) && /function renderPlaceholders/.test(templates));
ok('页首占位符说明包含 {展会}', /PH_TOP/.test(templates) && /\{展会\}/.test(tplData));
ok('话术数据无 &amp; 双重转义', !/&amp;/.test(tplData));
ok('新增 4 类话术', ['跟进序列 / Follow-up', '涨价通知 / Price update', '转介绍 / Referral', '合规通知 / Compliance'].every(c => tplData.includes(c)));
ok('话术库标题显示 23 类 85 封', /23 类 · 85 封/.test(templates) && /23 类 85 封/.test(tplData));

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
