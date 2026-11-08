#!/usr/bin/env node
/* ============================================================
   FT Compass · CSV 导入/导出回归测试
   用法：node tools/test-csv.mjs
   覆盖：
   - RFC4180：引号、转义引号、字段内换行、CRLF、尾随空行
   - 分隔符识别：逗号 / 分号 / Tab
   - 编码：UTF-8 BOM / UTF-16LE / GB18030
   - 表头别名映射（中英文）
   - 金额（1,234.56 / 1.234,56）、日期、电话、阶段、评分清洗
   - 去重键优先级、文件内重复只统计不丢弃
   - 导出防公式注入（= + - @ 及前导空白）
   - 模板可被自身解析器重新导入
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.error('FAIL: ' + label + (detail ? ' — ' + detail : '')); }
}

const src = fs.readFileSync(path.join(root, 'js/csv.js'), 'utf8');
const sandbox = { window: {}, TextDecoder, TextEncoder, console, Blob, Response, DecompressionStream };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'js/csv.js' });
const C = sandbox.window.FTCsv;

check('FTCsv 已导出', !!C);

/* ---------- 1. 基础解析 ---------- */
{
  const rows = C.parse('a,b,c\r\n1,2,3\r\n');
  check('基础解析行数', rows.length === 2, JSON.stringify(rows));
  check('基础解析列', rows[0].join('|') === 'a|b|c');
  check('CRLF 清理', rows[1].join('|') === '1|2|3');
}
{
  const text = 'name,note\n"Acme, Inc.","line1\nline2"\n"He said ""hi""",ok\n';
  const rows = C.parse(text);
  check('引号内逗号', rows[1][0] === 'Acme, Inc.', JSON.stringify(rows[1]));
  check('引号内换行', rows[1][1] === 'line1\nline2', JSON.stringify(rows[1][1]));
  check('双引号转义', rows[2][0] === 'He said "hi"', JSON.stringify(rows[2][0]));
}
{
  check('分号识别', C.detectDelimiter('a;b;c\n1;2;3') === ';');
  check('Tab 识别', C.detectDelimiter('a\tb\tc\n1\t2\t3') === '\t');
  check('引号内分隔符不计入', C.detectDelimiter('a,b\n"x;y;z",2') === ',');
}

/* ---------- 2. 编码 ---------- */
{
  const utf8 = new TextEncoder().encode('客户名,国家\nAcme,USA');
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8]);
  const d1 = C.decode(bom);
  check('UTF-8 BOM 识别', d1.encoding === 'UTF-8 (BOM)' && d1.text.indexOf('客户名') === 0, d1.encoding);

  const u16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('客户名,国家', 'utf16le')]);
  const d2 = C.decode(new Uint8Array(u16));
  check('UTF-16LE 识别', d2.encoding === 'UTF-16LE' && d2.text.indexOf('客户名') === 0, d2.encoding);
}
{
  /* “客户,国家” 的 GBK 字节 */
  const gbk = new Uint8Array([0xBF, 0xCD, 0xBB, 0xA7, 0x2C, 0xB9, 0xFA, 0xBC, 0xD2]);
  const d = C.decode(gbk);
  check('GBK/GB18030 回退', d.encoding === 'GBK/GB18030' && d.text === '客户,国家', d.encoding + ':' + d.text);
}

/* ---------- 3. 表头映射 ---------- */
{
  const m = C.detectMapping(['客户名称', '国家', 'WhatsApp 号码', 'E-mail', '预估金额(USD)', '备注']);
  check('映射-客户名', m.name === 0, JSON.stringify(m));
  check('映射-国家', m.country === 1);
  check('映射-电话', m.wa === 2);
  check('映射-邮箱', m.email === 3);
  check('映射-金额', m.amount === 4);
  check('映射-备注', m.note === 5);
}
{
  const m = C.detectMapping(['Company Name', 'Country', 'Contact', 'Email Address', 'Estimated Value']);
  check('映射-英文', m.name === 0 && m.country === 1 && m.wa === 2 && m.email === 3 && m.amount === 4, JSON.stringify(m));
  const dup = C.detectMapping(['Country', 'Country']);
  check('映射-同名列不重复占用', dup.country === 0 && Object.keys(dup).length === 1, JSON.stringify(dup));
}
{
  const rows = [
    ['2026 年客户名单（大标题）'],
    [],
    ['客户名称', '国家', '邮箱', '预估金额'],
    ['Acme', 'USA', 'a@b.com', '100']
  ];
  const h = C.findHeaderRow(rows);
  check('表头行-跳过标题行', h.index === 2 && h.mapping.name === 0, JSON.stringify(h));
  const r = C.toLeads(rows.slice(h.index + 1), h.mapping, { headerRow: h.index });
  check('表头行-数据正确', r.records.length === 1 && r.records[0].name === 'Acme');
}
{
  /* 外部表格（阿里/展会名录/海关数据）常见列名 */
  const cases = [
    ['公司英文名', '联系人', '电话', '邮箱', '国家'],
    ['企业全称', '联系人', '手机', '邮箱', '国家'],
    ['Account Name', 'Country', 'Email'],
    ['Organization', 'Nation', 'E-mail']
  ];
  cases.forEach(function (h) {
    const m = C.detectMapping(h);
    check('外部列名-客户名可识别: ' + h[0], m.name === 0, JSON.stringify(m));
  });
  const r = C.toLeads([['ACME IMPORTS LTD', 'Bob', '+1 555 0100', 'bob@acme.com', 'USA']],
    C.detectMapping(cases[0]));
  check('外部列名-导入记录正确', r.records.length === 1 && r.records[0].name === 'ACME IMPORTS LTD'
    && r.records[0].email === 'bob@acme.com' && r.records[0].country === 'USA', JSON.stringify(r.records));
}
{
  /* 完全对不上的表头：必须返回明确错误，让 UI 提示用户手选列 */
  const m = C.detectMapping(['字段一', '字段二', '字段三']);
  check('未知表头-识别不到客户名', m.name == null, JSON.stringify(m));
  const r = C.toLeads([['x', 'y', 'z']], m);
  check('未知表头-返回可读错误', r.records.length === 0 && /客户名|公司名/.test(r.errors[0].msg), JSON.stringify(r.errors));
}

/* ---------- 4. 行清洗 ---------- */
{
  check('金额-英美', C.amount('1,234.56') === 1234.56, String(C.amount('1,234.56')));
  check('金额-欧陆', C.amount('1.234,56') === 1234.56, String(C.amount('1.234,56')));
  check('金额-货币符号', C.amount('$ 2,400') === 2400, String(C.amount('$ 2,400')));
  check('金额-空值', C.amount('') === 0 && C.amount('abc') === 0);
  check('日期-斜杠', C.date('2026/1/9') === '2026-01-09', C.date('2026/1/9'));
  check('日期-中文', C.date('2026年11月3日') === '2026-11-03', C.date('2026年11月3日'));
  check('日期-无效', C.date('not a date') === '', C.date('not a date'));
  check('电话-科学计数', C.phone('2.01012E+10') === '20101200000', C.phone('2.01012E+10'));
  check('电话-保留前导加号', C.phone('+20 101 234 5678') === '+20 101 234 5678');
  check('阶段-中文别名', C.stage('已报价') === '报价');
  check('阶段-英文别名', C.stage('Won') === '成交');
  check('阶段-renewed 不误判', C.stage('renewed') === '待开发', C.stage('renewed'));
  check('评分-截断', C.score('120') === 100 && C.score('-5') === 0 && C.score('') === null);
}

/* ---------- 5. toLeads ---------- */
{
  const rows = [
    ['客户名', '国家', '阶段', 'WhatsApp', '邮箱', '预估USD', '最后联系', 'AI评分'],
    ['Acme', 'USA', '已联系', '+1 555 0100', 'BUYER@ACME.COM', '1,200.50', '2026/1/9', '88'],
    ['', 'USA', '', '', '', '', '', ''],
    ['Acme', 'USA', '已联系', '', 'buyer@acme.com', '10', '', ''],
    ['Beta', 'Egypt', '新线索', '', '', '', '', '120']
  ];
  const r = C.toLeads(rows.slice(1), C.detectMapping(rows[0]));
  check('有效行数（含文件内重复）', r.records.length === 3, String(r.records.length));
  check('空客户名计数', r.invalid === 1, String(r.invalid));
  check('文件内重复只统计', r.duplicateInFile === 1, String(r.duplicateInFile));
  check('邮箱小写', r.records[0].email === 'buyer@acme.com');
  check('金额清洗', r.records[0].amount === 1200.5, String(r.records[0].amount));
  check('日期清洗', r.records[0].last === '2026-01-09');
  check('评分清洗', r.records[0].score === 88 && r.records[2].score === 100);
  check('阶段清洗', r.records[2].stage === '待开发', r.records[2].stage);
}
{
  const r = C.toLeads([['+1 555', 'USA']], C.detectMapping(['Phone', 'Country']));
  check('缺少客户名列时报错', r.errors.length === 1 && r.records.length === 0, JSON.stringify(r.errors));
}

/* ---------- 6. 去重键 ---------- */
{
  check('去重键-邮箱优先', C.dedupeKey({ email: 'A@B.com', wa: '123456', name: 'X' }) === 'e:a@b.com');
  check('去重键-电话次之', C.dedupeKey({ wa: '+20 101-234', name: 'X' }) === 'w:20101234');
  check('去重键-名称兜底', C.dedupeKey({ name: 'Acme  Inc', country: 'USA' }) === 'n:acme inc|usa');
  check('去重键-无信息为空', C.dedupeKey({ name: '' }) === '');
}

/* ---------- 7. 导出与公式注入 ---------- */
{
  check('公式-= 前缀制表符', C.cell('=cmd|calc') === '"\t=cmd|calc"', C.cell('=cmd|calc'));
  check('公式-+ 前缀制表符', C.cell('+1+1')[1] === '\t', C.cell('+1+1'));
  check('公式-- 前缀制表符', C.cell('-1+1')[1] === '\t', C.cell('-1+1'));
  check('公式-@ 前缀制表符', C.cell('@SUM(A1)')[1] === '\t', C.cell('@SUM(A1)'));
  check('公式-前导空白绕过', C.cell('  =cmd')[1] === '\t', C.cell('  =cmd'));
  check('普通文本不加前缀', C.cell('Acme, Inc.') === '"Acme, Inc."', C.cell('Acme, Inc.'));
  check('引号双写', C.cell('He said "hi"') === '"He said ""hi"""', C.cell('He said "hi"'));
  const built = C.build([['a', 'b'], ['1', '=x']]);
  check('BOM 开头', built.charCodeAt(0) === 0xFEFF);
  check('CRLF 行分隔', built.indexOf('\r\n') > 0);
}
{
  const t = C.template();
  const rows = C.parse(t);
  check('模板表头可解析', rows.length >= 2 && rows[0][0] === '客户名', JSON.stringify(rows[0]));
  check('模板示例行可被映射', C.detectMapping(rows[0]).name === 0);
}

/* ---------- 8. 导出→再导入往返 ---------- */
{
  const leads = [
    { name: '=Acme', country: 'USA', market: '欧美', stage: '报价', wa: '+1 555', email: 'a@b.com', product: 'LED', amount: 2400, last: '2026-11-01', score: 70, nextAction: 'follow up', note: 'note, with comma' },
    { name: 'Beta', country: 'Egypt', market: '中东', stage: '待开发', wa: '', email: '', product: 'pillow', amount: 0, last: '', score: null, nextAction: '', note: 'line1\nline2' }
  ];
  const rows = [['客户名', '国家', '市场', '阶段', 'WhatsApp', '邮箱', '产品', '预估USD', '最后联系', 'AI评分', 'AI下一步', '备注']];
  leads.forEach(l => rows.push([l.name, l.country, l.market, l.stage, l.wa, l.email, l.product, l.amount, l.last, l.score, l.nextAction, l.note]));
  const text = C.build(rows);
  const back = C.parse(text);
  check('往返行数', back.length === 3, String(back.length));
  check('往返公式名还原', back[1][0].trim() === '=Acme', JSON.stringify(back[1][0]));
  check('往返备注换行', back[2][11] === 'line1\nline2', JSON.stringify(back[2][11]));
  const r = C.toLeads(back.slice(1), C.detectMapping(back[0]));
  check('往返导入条数', r.records.length === 2, String(r.records.length));
  check('往返金额', r.records[0].amount === 2400);
  check('往返评分空值', r.records[1].score === null);
}

/* ---------- 9. XLSX（zip + XML） ---------- */
function makeZip(files, deflate) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    let data = enc.encode(content);
    let method = 0;
    if (deflate) { data = zlib.deflateRawSync(Buffer.from(data)); method = 8; }
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

const sharedStrings = '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<si><t>客户名</t></si><si><t>国家</t></si><si><t>最后联系</t></si>'
  + '<si><t>Acme &amp; Co</t></si><si><t>USA</t></si></sst>';
const sheet = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
  + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>备注</t></is></c></row>'
  + '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>46000</v></c><c r="D2" t="inlineStr"><is><t>ok</t></is></c></row>'
  + '</sheetData></worksheet>';

for (const deflate of [false, true]) {
  const zip = makeZip({
    'xl/sharedStrings.xml': sharedStrings,
    'xl/worksheets/sheet1.xml': sheet
  }, deflate);
  const rows = await C.readXlsx(zip);
  const label = deflate ? 'deflate' : 'stored';
  check('XLSX-' + label + ' 行数', rows.length === 2, JSON.stringify(rows));
  check('XLSX-' + label + ' 共享字符串+实体', rows[0][0] === '客户名' && rows[1][0] === 'Acme & Co', JSON.stringify(rows));
  check('XLSX-' + label + ' inlineStr', rows[0][3] === '备注' && rows[1][3] === 'ok');
  check('XLSX-' + label + ' 数字日期序列', rows[1][2] === '46000', rows[1][2]);
  const r = C.toLeads(rows.slice(1), C.detectMapping(rows[0]));
  check('XLSX-' + label + ' 日期序列转换', r.records[0].last === '2025-12-09', r.records[0].last);
}
{
  let msg = '';
  try { await C.readXlsx(new Uint8Array([1, 2, 3])); } catch (e) { msg = e.message; }
  check('XLSX-非 zip 有中文错误', /不是有效的 \.xlsx/.test(msg), msg);
}

{
  const zip = makeZip({
    'xl/workbook.xml': '<?xml version="1.0"?><workbook><sheets><sheet name="客户" sheetId="1" r:id="rId2"/><sheet name="其他" sheetId="2" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    'xl/sharedStrings.xml': sharedStrings,
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet><sheetData><row><c t="inlineStr"><is><t>错误表</t></is></c></row></sheetData></worksheet>',
    'xl/worksheets/sheet2.xml': sheet
  }, false);
  const rows = await C.readXlsx(zip);
  check('XLSX-按 workbook 第一张表选择', rows.length === 2 && rows[0][0] === '客户名', JSON.stringify(rows[0]));
}

/* ---------- 9.5 备份迁移：来源 / 官网 / 创建时间 ---------- */
{
  const rows = [
    ['客户名', '国家', '来源', '官网', '创建时间'],
    ['Acme Ltd', 'Egypt', 'manual', 'https://acme.com', '2026-01-02T03:04:05.000Z']
  ];
  const m = C.detectMapping(rows[0]);
  check('映射识别 来源', m.source === 2, String(m.source));
  check('映射识别 官网', m.website === 3, String(m.website));
  check('映射识别 创建时间', m.createdAt === 4, String(m.createdAt));
  const r = C.toLeads(rows.slice(1), m).records[0];
  check('导入保留来源', r.source === 'manual', r.source);
  check('导入保留官网', r.website === 'https://acme.com', r.website);
  check('导入保留创建时间', r.createdAt === '2026-01-02T03:04:05.000Z', r.createdAt);
  check('导出模板含官网列', C.template().includes('官网'));
}
{
  const rows = C.parse(C.build([['客户名', '创建时间'], ['X', 'not-a-date']]));
  const r = C.toLeads(rows.slice(1), C.detectMapping(rows[0])).records[0];
  check('非法创建时间清空而不是瞎猜', r.createdAt === '', r.createdAt);
}

/* ---------- 10. 异常输入不崩溃 ---------- */
{
  check('空字符串', C.parse('').length === 0);
  check('仅表头', C.parse('a,b\n').length === 1);
  check('未闭合引号', C.parse('a,b\n"x,y').length === 2, JSON.stringify(C.parse('a,b\n"x,y')));
  check('toLeads 空输入', C.toLeads([], {}).records.length === 0);
}

console.log('\nCSV tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
