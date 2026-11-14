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
const paper = read('js/paper.js');
const signTool = read('tools/sign-license.mjs');
const repairTool = read('tools/repair-licenses.mjs');
const tplData = read('js/templates_data.js');
const find = read('modules/find.html');
const stageAnalytics = read('js/stage-analytics.js');
const csvjs = read('js/csv.js');
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
ok('模块缓存版本是统一发布戳', /MODULE_V = '\d{8}[a-z]?'/.test(home));
ok('响应式样式已统一发布戳', /responsive\.css\?v=/.test(home) && /responsive\.css\?v=/.test(leads) && /responsive\.css\?v=/.test(quotes));

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
ok('首页和报价页都加载有效期 helper', /quote-validity\.js\?v=/.test(home) && /quote-validity\.js\?v=/.test(quotes));
ok('DataStore.update 换阶段追 stageLog', /patch\.stage && patch\.stage !== prevStage/.test(datastore) && /stageLog\.push/.test(datastore));
ok('线索编辑换阶段追 stageLog', /prevStage/.test(leads) && /l\.stageLog\.push/.test(leads));
ok('单证读取 validUntil 兜底', /values\.valid = q\.validUntil \|\| q\.validity/.test(docs));
ok('datastore 已统一发布戳', /datastore\.js\?v=/.test(home) && /datastore\.js\?v=/.test(quotes) && /datastore\.js\?v=/.test(leads));

/* 15. 手工线索模糊查重 + 购买链路 */
ok('线索页加载查重 helper', /lead-dedupe\.js\?v=/.test(leads));
ok('保存线索前调用模糊查重并排除自己', /LeadDedupe\.find\(S\.leads, obj, S\.editId\)/.test(leads));
ok('查重命中可跳过或强行保存', /疑似已有类似客户/.test(leads) && /点「取消」返回修改/.test(leads) && /if \(!confirm\([\s\S]{0,260}\)\) return;/.test(leads));
ok('查重按名称和域名匹配', /名称完全相同/.test(leadDedupe) && /网站\/邮箱域名相同/.test(leadDedupe));
ok('公共邮箱不参与域名匹配', /GENERIC_DOMAINS/.test(leadDedupe) && /gmail\.com/.test(leadDedupe));
ok('购买入口有 QQ/邮箱', /BUY_QQ/.test(license) && /BUY_EMAIL/.test(license) && /2279201868@qq\.com/.test(license));
ok('我已购买有可用转化路径', /mailto:/.test(license) && /global\.location\.href = BUY_URL/.test(license));
ok('激活弹窗展示联系方式', /buyContactText\(\)/.test(license) && /lic-buy/.test(license));
ok('页眉有授权公司抬头容器', /id="topCompany"/.test(home) && /id="topCompanyName"/.test(home) && /class="top-company"/.test(home));
ok('抬头不再写「授权给」', !/授权给/.test(home));
ok('公司抬头只对已授权显示', /function paintLicCompany\(\)/.test(home) && /s\.pro&&s\.company/.test(home) && /chip\.hidden=true/.test(home));
ok('激活后立即刷新公司抬头', /License\.onChange\(function\(\)\{ paintLicCompany\(\);/.test(home));
ok('已激活客户单证不加授权水印', /if \(s\.pro\) return '';/.test(license) && /已激活客户不加纸面\/导出水印/.test(license));
ok('激活码必须规范 base64url（末位无效位也判无效）', /isCanonicalB64url/.test(license) && /bytesToB64url\(b64urlToBytes\(s\)\) === s/.test(license) && /sigBytes\.length !== 64/.test(license));
ok('无水印时纸面不渲染空页脚', /\.paper:not\(\[data-wm\]\)::after\{display:none\}/.test(paper));
ok('签发工具拦截编码损坏的公司名', /编码损坏/.test(signTool) && /uFFFD/.test(signTool));
ok('签发工具支持 UTF-8 文件传公司名', /--company-file/.test(signTool) && /readFileSync\(p, 'utf8'\)/.test(signTool));
ok('签发后台账回读自检', /台账回读校验失败/.test(signTool));
ok('台账乱码可从激活码还原', /payload\.co|o\.co/.test(repairTool) && /\.bak-/.test(repairTool) && /decodePayload/.test(repairTool));
ok('license 已统一发布戳', /license\.js\?v=/.test(home) && /license\.js\?v=/.test(quotes));

/* 16. 话术库补缺 + 占位符说明 + 默认按热度 */
ok('话术数据已统一发布戳', /templates_data\.js\?v=/.test(templates));
ok('话术库默认按使用热度排序', /<option value="hot" selected>按使用热度<\/option>/.test(templates));
ok('占位符说明从全部话术自动收集', /var PH = \(function\(\)/.test(templates) && /function renderPlaceholders/.test(templates));
ok('页首占位符说明包含 {展会}', /PH_TOP/.test(templates) && /\{展会\}/.test(tplData));
ok('话术数据无 &amp; 双重转义', !/&amp;/.test(tplData));
ok('新增 4 类话术', ['跟进序列 / Follow-up', '涨价通知 / Price update', '转介绍 / Referral', '合规通知 / Compliance'].every(c => tplData.includes(c)));
ok('话术库标题显示 23 类 85 封', /23 类 · 85 封/.test(templates) && /23 类 85 封/.test(tplData));

/* 17. 转线索查重 + 阶段停留 + 临期报价 + CSV 备份迁移 */
ok('找客户加载模糊查重 helper', /lead-dedupe\.js\?v=/.test(find));
ok('单条转线索前查重并可强行保存', /var dups=findDupes\(obj\)/.test(find) && /疑似已有类似客户/.test(find) && /点「取消」返回修改/.test(find));
ok('批量转线索先预演再确认', /var sim=DataStore\.list\('leads'\)\.slice\(\)/.test(find) && /批量导入发现/.test(find) && /跳过这些/.test(find));
ok('批量导入跳过疑似重复计入 dupIds', /S\.dupIds\[x\.r\._id\]/.test(find));
ok('搜索结果标出已在线索库', /S\.dupIds\[c\._id\]/.test(find) && /已在线索库/.test(find));
ok('搜索历史最多 40 条', /hist\.length>40/.test(find) && /slice\(-40\)/.test(find));

ok('客户 360 加载阶段分析', /stage-analytics\.js\?v=/.test(c360));
ok('客户 360 时间线展示阶段流转与停留', /StageAnalytics\.transitions\(l\)/.test(c360) && /进入「/.test(c360) && /已停留/.test(c360));
ok('复盘加载阶段分析并渲染平均停留', /stage-analytics\.js\?v=/.test(review) && /id="stageDwell"/.test(review) && /function renderDwell/.test(review));
ok('阶段停留只统计已完成区段', /closedCount/.test(stageAnalytics) && /ongoingCount/.test(stageAnalytics) && /closed: true/.test(stageAnalytics));
ok('阶段分析兼容缺失 from/createdAt', /first\.from && created/.test(stageAnalytics));
ok('阶段停留有纯函数测试', fs.existsSync(new URL('../tools/test-stage-analytics.mjs', import.meta.url)));

ok('转化率 chips 标注为存量快照', /不是同一批客户随时间的转化率/.test(review));
ok('复盘图表可导出 PNG', /function exportChartPng/.test(review) && /toBlob/.test(review) && /XMLSerializer/.test(review));
ok('复盘三个图表都有 PNG 按钮', (review.match(/class="chart-dl"/g) || []).length === 3);
ok('复盘打印样式隐藏按钮', /@media print/.test(review) && /window\.print\(\)/.test(review));

ok('报价筛选有 7 天内到期', /<option value="expiring">7 天内到期<\/option>/.test(quotes));
ok('临期筛选使用 isExpiringSoon', /QuoteValidity\.isExpiringSoon\(item, 7\)/.test(quotes));
ok('报价列表有临期徽标', /class="qi-exp"/.test(quotes) && /今天到期/.test(quotes));
ok('首页报价卡有临期徽标', /QuoteValidity\.isExpiringSoon\(q, 7\)/.test(home) && /'剩 ' \+ left \+ ' 天'/.test(home));
ok('有效期 helper 提供 daysLeft/临期判断', /function daysLeft/.test(quoteValidity) && /function isExpiringSoon/.test(quoteValidity));

ok('CSV 导出补齐来源/阶段摘要/创建时间', /'来源'/.test(leads) && /阶段变更摘要/.test(leads) && /最近报价有效期/.test(leads));
ok('CSV 导出 18 列结构', /'客户名', '国家', '市场', '阶段', 'WhatsApp', '邮箱', '官网', '产品'/.test(leads));
ok('CSV 导入保留来源/官网/创建时间', /rec\.createdAt = r\.createdAt \|\| new Date\(\)\.toISOString\(\)/.test(leads) && /website:'官网'/.test(leads) && /source:'来源'/.test(leads));
ok('csv.js 识别官网/来源/创建时间', /website: \['website'/.test(csvjs) && /source: \['source'/.test(csvjs) && /createdAt: \['createdat'/.test(csvjs));
ok('csv.js 保留 ISO 创建时间', /function stamp/.test(csvjs) && /createdAt: stamp\(cell\('createdAt'\)\)/.test(csvjs));

/* 18. 外壳：CSP / 深链 / 模块保活 / 多标签 / 容量仪表 / 统一版本戳 */
const moduleNames = ['calculator','comps','customer360','docs','find','holidays','leads','maillog','products','profile','quotes','review','templates','todos'];
const moduleHtml = moduleNames.map(n => read('modules/' + n + '.html'));
const agnes = read('agnes-ai.js');

ok('首页有 CSP meta', /http-equiv="Content-Security-Policy"/.test(home) && /object-src 'none'/.test(home) && /base-uri 'self'/.test(home));
ok('14 个模块都有 CSP meta', moduleHtml.every(s => s.includes('http-equiv="Content-Security-Policy"')));
ok('CSP 允许同源 frame 与内联脚本', /frame-src 'self'/.test(home) && /script-src 'self' 'unsafe-inline'/.test(home));
ok('深链写入 hash 并监听 hashchange', /location\.hash = target/.test(home) && /addEventListener\('hashchange'/.test(home) && /function viewFromHash/.test(home));
ok('深链只允许 modules/*.html', /VIEW_RE = \/\^modules/.test(home));
ok('启动时按 hash 恢复模块', /var bootView = viewFromHash\(\)/.test(home) && /go\(bootView, \{ fromHash: true \}\)/.test(home));
ok('iframe LRU 最多 3 个', /LRU_MAX = 3/.test(home) && /function getFrame/.test(home) && /function touchView/.test(home));
ok('保活容器与显示切换', /id="views"/.test(home) && /classList\.toggle\('on'/.test(home));
ok('#frame 始终指向当前模块', /f\.id = 'frame'/.test(home) && /removeAttribute\('id'\)/.test(home));
ok('提供重载当前模块入口', /function reloadView/.test(home) && /onclick="reloadView\(\)"/.test(home));
ok('多标签 storage 监听', /addEventListener\('storage'/.test(home) && /id="syncBar"/.test(home));
ok('多标签提示不自动覆盖', /数据已在其他窗口修改/.test(home) && /function hideSyncBar/.test(home));
ok('首页容量仪表', /id="quotaCard"/.test(home) && /function renderQuota/.test(home) && /QUOTA_LIMIT/.test(home));
ok('容量 70/85 双阈值', /pct >= 85/.test(home) && /pct >= 70/.test(home));
ok('版本戳脚本存在', fs.existsSync(new URL('../tools/bump-version.mjs', import.meta.url)));
ok('AI 密钥明文风险已提示', /localStorage（明文）/.test(agnes) && /同机/.test(agnes));

const release = (home.match(/MODULE_V = '([^']+)'/) || [])[1] || '';
ok('发布戳格式合法', /^\d{8}[a-z]?$/.test(release), release);
const refs = [];
[home, ...moduleHtml].forEach(s => {
  const re = /(?:src|href)="[^"]*?[?&]v=([^"&]+)/g;
  let m;
  while ((m = re.exec(s))) refs.push(m[1]);
});
ok('全站资源戳已统一', refs.length > 20 && refs.every(v => v === release), release + ' / ' + refs.length + ' refs');

/* 19. XSS 加固：客户数据 / 抓取结果 / AI 输出 / 备份恢复字段 */
const profile = read('modules/profile.html');
const calculator = read('modules/calculator.html');
const brandjs = read('js/brand.js');
const standalone = read('assets/standalone.js');
const agnesDemo = read('agnes-ai-demo.html');

ok('standalone 提供 esc/imgSrc/safeUrl/jsArg', /FT\.esc = function/.test(standalone) && /FT\.imgSrc = function/.test(standalone) && /FT\.safeUrl = function/.test(standalone) && /FT\.jsArg = function/.test(standalone));
ok('jsArg 转义双引号与尖括号', /\\\\u0022/.test(standalone) && /\\\\u003c/.test(standalone));
ok('imgSrc 只放行 data:image 与 http(s)', /data:image\\\/\(\?:png/.test(standalone) && /\^https\?:\\\/\\\//.test(standalone));
ok('客户 360 竞品国家已转义', /esc\(c\.country \|\| ''\)/.test(c360));
ok('客户 360 竞品 id 用 jsArg', squash(c360).includes("openCompEdit(\\''+FT.jsArg(c.id)") && squash(c360).includes("delComp(\\''+FT.jsArg(c.id)"));
ok('报价线索产品名已转义', /' \/ ' \+ esc\(l\.product\)/.test(quotes));
ok('报价商品图走 FT.imgSrc', /FT\.imgSrc\(p\.image\)/.test(quotes) && /FT\.esc\(img\)/.test(quotes));
ok('报价币种白名单', /CUR_SYM\[item\.currency\] \? item\.currency : 'USD'/.test(quotes) && /CUR_SYM\[cur\] \|\| '\$'/.test(quotes));
ok('报价状态文案已转义', /esc\(stLabel\)/.test(quotes) && squash(quotes).includes("loadQuote(\\''+FT.jsArg(item.id)"));
ok('单证商品图走 FT.imgSrc', /FT\.imgSrc\(p\.image\)/.test(docs) && squash(docs).includes("pickProduct(\\''+FT.jsArg(p.id)"));
ok('发送记录日期已转义、id 用 jsArg', /esc\(fmtDate\(o\.createdAt\)\)/.test(maillog) && squash(maillog).includes("del(\\''+FT.jsArg(o.id)"));
ok('发送记录客户下拉 id 已转义', /<option value="' \+ esc\(l\.id\) \+ '">/.test(maillog));
ok('待办 AI 优先级已转义', /esc\(t\.aiPriority\)/.test(todos));
ok('待办回调 id 全部走 jsArg', !/onclick="[^"]*\\''\+t\.id\+/.test(todos) && !/toggleDone\('\\''\+t\.id/.test(todos) && /FT\.jsArg\(t\.id\)/.test(todos) && /FT\.jsArg\(lead\.id\)/.test(todos));
ok('品牌图片走 safeImg + 属性转义', /escHtml\(safeImg\(/g.test(brandjs) && (brandjs.match(/escHtml\(safeImg\(/g) || []).length >= 4);
ok('品牌 escHtml 转义单引号', /\[&<>"'\]/.test(brandjs));
ok('商品库图片走 FT.imgSrc', /FT\.imgSrc\(p\.image\)/.test(products) && /FT\.imgSrc\(imgData\)/.test(products));
ok('商品库 id 用 jsArg', squash(products).includes("openEdit(\\''+FT.jsArg(p.id)") && squash(products).includes("toQuote(\\''+FT.jsArg(p.id)"));
ok('档案 Logo 走 FT.imgSrc', /FT\.imgSrc\(b\.logo\)/.test(profile) && /FT\.esc\(logoSrc\)/.test(profile));
ok('计算器历史记录已转义', /FT\.esc\(item\.product \|\| '—'\)/.test(calculator) && /FT\.esc\(item\.result \|\| '—'\)/.test(calculator));
ok('找客户外链走 FT.safeUrl', /FT\.safeUrl\(r\.website\|\|r\.linkedin\|\|''\)/.test(find) && /rel="noopener"/.test(find));
ok('AI 测试回复用 textContent', /el\.textContent = r\.ok/.test(agnesDemo) && !/el\.innerHTML = r\.ok/.test(agnesDemo));

/* 20. 找客户数据质量：国家、邮箱、目录清洗、Zauba 导入 */
const sources = read('js/sources.js');
ok('国家只按完整后缀识别', /function countryFromDomain/.test(sources) && /parts\.slice\(-n\)\.join\('\.'\)/.test(sources) && /'co\.ke': 'Kenya'/.test(sources));
ok('不再用城市/裸国家词推断', !/COUNTRY_MAP/.test(sources) && /function detectCountryExplicit/.test(sources) && /裸国家词/.test(sources));
ok('AI 国家字段不再直接采用', !/a\.country&&!c\.country/.test(find) && /AI 的国家字段不作为证据/.test(find));
ok('找不到国家显示未知', /esc\(r\.country\|\|'未知'\)/.test(find));
ok('抓页后按国家证据分级识别', /Sources\.countryEvidence\(c\.website/.test(find) && /Sources\.countryEvidence\(r\.website/.test(find) && /function countryEvidence/.test(sources));
ok('目录详情页正文不作为国家证据', /!c\.profileUrl\)/.test(find) && /!r\.profileUrl\)/.test(find) && /if \(!allowPage \|\| !text\)/.test(sources));
ok('CDN 图床不当作公司官网', /cloudfront\.net/.test(sources) && /function isBlocked/.test(sources));
ok('邮箱过滤器存在并被提取流程调用', /function isJunkEmail/.test(sources) && /isJunkEmail\(low\)/.test(sources) && /duckduckgo\.com/.test(sources));
ok('结果清洗存在并用于合并结果', /function isJunkName/.test(sources) && /Sources\.isJunkName\(c\.name\)/.test(find) && /isJunkName\(name\)/.test(sources));
ok('Zauba 解析结果带 _inquiry', /_inquiry: true,\s*source: 'Zauba'/.test(sources) && /parseZauba/.test(sources));
ok('数据质量单测存在', fs.existsSync(new URL('../tools/test-find-quality.mjs', import.meta.url)));

/* 21. CSP 收紧 + LRU 淘汰前 flush 草稿 */
const indexHtml = read('index.html');
ok('外壳 CSP 只放行自身与 AI 端点', /connect-src 'self' https:\/\/apihub\.agnes-ai\.com;/.test(indexHtml));
ok('find CSP 只额外放行两个抓取代理', /connect-src 'self' https:\/\/apihub\.agnes-ai\.com https:\/\/r\.jina\.ai https:\/\/api\.allorigins\.win;/.test(find));
ok('所有页面都不再使用 connect-src *', [indexHtml, find, docs, leads, quotes, c360, profilesSafe()].every(function(s){ return !/connect-src \*/.test(s); }));
function profilesSafe(){ return read('modules/profile.html'); }
ok('DataStore 增加草稿集合', /drafts:\s*'ftc_drafts_v1'/.test(datastore) && /saveDraft: function/.test(datastore) && /getDraft: function/.test(datastore) && /clearDraft: function/.test(datastore));
ok('草稿不进备份 exportAll', /n === 'cfg' \|\| n === 'drafts'/.test(datastore));
ok('FT 提供 onFlush/flushNow 并监听 ft:flush', /FT\.onFlush = function/.test(standalone) && /FT\.flushNow = function/.test(standalone) && /type === 'ft:flush'/.test(standalone));
ok('外壳淘汰前先 flushFrame 再 removeChild', /flushFrame\(f\);\s*if \(f && f\.parentNode\) f\.parentNode\.removeChild\(f\)/.test(indexHtml));
ok('外壳 flush 同时用 postMessage 与同源直调', /postMessage\(\{ type: 'ft:flush' \}, location\.origin\)/.test(indexHtml) && /FT\.flushNow === 'function'/.test(indexHtml));
ok('reloadView 先 flush 再换 src', /flushFrame\(f\);\s*f\.src = moduleSrc\(currentView\)/.test(indexHtml));
ok('find 筛选条件可恢复', /FIND_DRAFT = 'find:filters'/.test(find) && /restoreFindDraft\(\)/.test(find) && /FT\.onFlush/.test(find));
ok('线索编辑弹窗可恢复', /LEAD_DRAFT = 'leads:edit'/.test(leads) && /restoreLeadDraft\(\)/.test(leads) && /FT\.onFlush/.test(leads));
ok('报价编辑器可恢复', /QUOTE_DRAFT = 'quotes:edit'/.test(quotes) && /restoreQuoteDraft\(\)/.test(quotes) && /FT\.onFlush/.test(quotes));
ok('单证表单可恢复', /DOC_DRAFT = 'docs:edit'/.test(docs) && /restoreDocDraft\(\)/.test(docs) && /FT\.onFlush/.test(docs));
ok('客户 360 备注可恢复', /customer360:note:/.test(c360) && /FT\.onFlush/.test(c360));

/* 22. 单证多 SKU 明细 + 商品图片 */
const docItems = read('js/doc-items.js');
const docsData = read('js/docs_data.js');
const gatejs = read('js/gate.js');
const exceljs = read('js/excel.js');
const paperjs = read('js/paper.js');

ok('单证页加载 doc-items.js', /doc-items\.js\?v=/.test(docs));
ok('PI/SC/CI/PL 标记 items:true', ['pi', 'sc', 'ci', 'pl']
  .every(id => new RegExp("id:'" + id + "'[^\\n]*items:true").test(docsData)));
ok('明细编辑器与保存同步', /function itemsEditorHTML/.test(docs) && /function syncItemsToValues/.test(docs)
  && /DocItems\.sync\(values, readItemRows\(\)/.test(docs));
ok('保存前压缩空行并落图片开关', /syncItemsToValues\(\);\s*\/\/ 保存前压缩空行/.test(docs)
  && /values\.showImages = showImagesOn\(\)/.test(docs));
ok('多 SKU 纸面按行循环', /rows\.map\(function\(r, i\)/.test(docs) && /paperRowsHTML/.test(docs));
ok('整单无图不出图片列', /showImagesOn\(\) && imgs\.some\(Boolean\)/.test(docs));
ok('缺图行显示 📦', /item-img-ph/.test(docs) && /📦/.test(docs));
ok('打印前等待图片 decode', /img\.decode\(\)/.test(docs) && /Promise\.race\(\[decoded, timeout\]\)/.test(docs)
  && /setTimeout\(resolve, 1500\)/.test(docs));
ok('打印样式图片 18mm 且无灰底', /item-img\{width:18mm!important;height:18mm!important/.test(paperjs)
  && /item-img\{[^}]*background:none!important/.test(paperjs));
ok('打印样式行不跨页/表头重复', /break-inside:avoid!important/.test(paperjs) && /display:table-header-group!important/.test(paperjs));
ok('Gate 逐行校验明细并核对合计', /def\.items && rows\.length/.test(gatejs)
  && /明细第 ' \+ no \+ ' 行缺品名/.test(gatejs) && /总金额与明细合计不一致/.test(gatejs));
ok('Excel 客户版多行输出且不加图', /Array\.isArray\(pub\.items\)/.test(exceljs) && /I\('q\.total', 'TOTAL'\)/.test(exceljs));
ok('报价明细写入 productId', /tr\.getAttribute\('data-pid'\)/.test(quotes)
  && /setAttribute\('data-pid', p\.id\)/.test(quotes) && /productId: tr\.getAttribute\('data-pid'\)/.test(quotes));
ok('报价转 PI 带入全部明细', /DocItems\.fromQuoteItems\(rawItems, itemProducts\(\)\)/.test(docs)
  && /DocItems\.sync\(values, rows\)/.test(docs));
ok('profile 提供图片默认设置并写 cfg', /id="p_docImagesDefault"/.test(profile)
  && /docImagesDefault/.test(profile) && /DataStore\.setCfg\(\{ docImagesDefault/.test(profile));
ok('单据默认开关读 profile 配置', /docImagesDefault \|\| 'auto'/.test(docs) && /DocItems\.defaultShowImages/.test(docs));
ok('明细逻辑有纯函数测试', fs.existsSync(new URL('../tools/test-doc-items.mjs', import.meta.url)));
ok('图片只按 productId 渲染，不复制 base64', /imageFor,/.test(docItems) && /function imageFor/.test(docItems)
  && !/values\.image\s*=/.test(docs));

/* 23. AI 接口地址与 CSP 一致 + 找客户失败归因 */
ok('AI 设置接口地址只读', /id="ag_base"[^>]*readonly/.test(agnes));
ok('AI 设置说明写明仅内置服务与 CSP', /接口地址固定为内置服务/.test(agnes) && /同步修改各页 CSP/.test(agnes));
ok('AI 设置不再承诺可切换其它服务', !/修改下方内容并保存即可/.test(agnes) && !/你的网关\/v1/.test(agnes));
ok('loadCfg 强制回退内置接口地址', /cfg\.base = DEFAULTS\.base;/.test(agnes));
ok('保存面板忽略自定义接口地址', /base: DEFAULTS\.base,/.test(agnes));
ok('AI 配置回退有单测', fs.existsSync(new URL('../tools/test-ai-config.mjs', import.meta.url)));
ok('DDG 风控挑战页显式识别', /function looksChallenge/.test(sources) && /anomaly-modal/.test(sources));
ok('html/lite 都失败时抛 FETCH_FAILED', /err\.code = 'FETCH_FAILED'/.test(sources));
ok('来源层全部子请求失败时抛 FETCH_FAILED', /function fetchFailedError/.test(sources) && /res\.fail >= qs\.length/.test(sources));
ok('Europages 全部页面失败不伪装成 0 家', /bodies\.every/.test(sources));
ok('找客户统计来源成功/失败', /srcOk=0,srcFail=0/.test(find) && /srcFail\+\+/.test(find));
ok('抓取通道全挂时提示网络/限流', /抓取通道全部失败，多为网络或限流/.test(find));
ok('来源连通但无结果才提示换关键词', /来源已连通但未找到公司/.test(find));
ok('不再把通道故障误归因为关键词/来源', !/所有来源均未找到公司/.test(find));

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
