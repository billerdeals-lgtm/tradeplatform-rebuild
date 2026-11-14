#!/usr/bin/env node
/* ============================================================
   FT Compass · 签发激活码
   用法：
     node tools/sign-license.mjs --company "XX贸易有限公司" [--id FT-A7F3] [--ver 1]
   - 私钥读取自 %USERPROFILE%\.ftcompass\private.pem（永不进仓库）
   - 输出单行激活码 + 追加台账 licenses.csv
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dir = path.join(os.homedir(), '.ftcompass');
const keyPath = path.join(dir, 'private.pem');
const ledger = path.join(dir, 'licenses.csv');

if (!fs.existsSync(keyPath)) {
  console.error('找不到私钥：' + keyPath);
  console.error('请先运行：node tools/gen-key.mjs');
  process.exit(1);
}

/* 公司名输入：默认走命令行参数。命令行编码不确定时（Git Bash / cmd / 旧版 PowerShell
   会把中文按 GBK 字节交给 Node），改用 --company-file 传一个 UTF-8 文本，彻底绕开编码。 */
function readCompany() {
  const file = arg('company-file', '');
  if (file) {
    if (file === '-') {
      const raw = fs.readFileSync(0, 'utf8');
      return raw.replace(/^\uFEFF/, '').split(/\r?\n/)[0];
    }
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) {
      console.error('找不到公司名文件：' + p);
      process.exit(1);
    }
    return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[0];
  }
  return arg('company', '');
}

const company = String(readCompany() || '').trim();
if (!company) {
  console.error('缺少公司名。用法：node tools/sign-license.mjs --company "XX贸易有限公司"');
  console.error('  或：node tools/sign-license.mjs --company-file company.txt（文件为 UTF-8）');
  console.error('  或：echo 公司名 | node tools/sign-license.mjs --company-file -');
  process.exit(1);
}
if (company.length > 60) {
  console.error('公司名过长（≤60 字）');
  process.exit(1);
}

/* 编码自检：中文一旦在命令行环节被按 GBK 字节解读，就会变成 U+FFFD（显示为 �）。
   这种名字签进激活码后客户页眉永远是乱码，且不可逆，必须在落盘前拦住。 */
if (/\uFFFD/.test(company) || /锟斤拷|烫烫烫|屯屯屯/.test(company)) {
  console.error('公司名编码损坏：' + company);
  console.error('  原因：中文没有以 UTF-8 传进来（常见于 cmd / 旧版控制台 / GBK 脚本调用）。');
  console.error('  处理：把公司名存成 UTF-8 文本，然后用 --company-file 指定；或从 UTF-8 的 .mjs 里调用。');
  process.exit(1);
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomId() {
  const b = crypto.randomBytes(4);
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return 'FT-' + s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const id = String(arg('id', '') || '').trim() || randomId();
const ver = String(arg('ver', '1') || '1').trim();
const iat = Math.floor(Date.now() / 1000);

const payload = { v: 1, id: id, co: company, iat: iat, ver: ver };
const payloadSeg = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));

const priv = crypto.createPrivateKey(fs.readFileSync(keyPath));
const sig = crypto.sign('sha256', Buffer.from(payloadSeg, 'ascii'), {
  key: priv,
  dsaEncoding: 'ieee-p1363'   // 必须是 raw r||s，与浏览器 WebCrypto 一致
});

if (sig.length !== 64) {
  console.error('内部错误：签名长度 ' + sig.length + '，应为 64');
  process.exit(1);
}

const code = 'FT1.' + payloadSeg + '.' + b64url(sig);

// 台账：时间,公司,编号,版本,激活码（存整行码，客户丢码时直接回发）
const LEAD_HEADER = ['时间', '公司', '编号', '版本', '激活码'];
function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

function ensureLedger() {
  if (!fs.existsSync(ledger)) {
    fs.writeFileSync(ledger, '\uFEFF' + LEAD_HEADER.join(',') + '\n', 'utf8');
    return;
  }
  const raw = fs.readFileSync(ledger, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);
  if ((lines[0] || '').includes('激活码')) return;
  /* 旧版 4 列台账：补表头与空列，历史记录原样保留 */
  const rows = lines.slice(1).filter(l => l.trim()).map(l => l.replace(/\s+$/, '') + ',""');
  fs.writeFileSync(ledger, '\uFEFF' + LEAD_HEADER.join(',') + '\n' + rows.join('\n') + (rows.length ? '\n' : ''), 'utf8');
  console.log('ℹ 台账已升级为 5 列（新增「激活码」，历史行留空）');
}

const line = [new Date(iat * 1000).toISOString(), company, id, ver, code].map(q).join(',') + '\n';

/* 台账可能正被 Excel/WPS 打开（EBUSY）。绝不能因此吞掉激活码：
   写不进去也照常把码打印出来，最后单独提示。 */
let ledgerErr = null;
try {
  ensureLedger();
  fs.appendFileSync(ledger, line, 'utf8');
  /* 回读自检：确认落盘的中文和内存里的一致，避免再出现「码是对的、台账是乱码」 */
  const back = fs.readFileSync(ledger, 'utf8').trimEnd().split(/\r?\n/).pop() || '';
  if (!back.includes(company)) {
    throw new Error('台账回读校验失败：写入的公司名与预期不一致');
  }
} catch (e) {
  ledgerErr = e;
}

console.log('✅ 已签发');
console.log('公司：' + company);
console.log('编号：' + id);
console.log('版本：' + ver);
console.log('长度：' + code.length + ' 字符');
console.log('');
console.log('激活码（整行复制发给客户）：');
console.log('');
console.log(code);
console.log('');
console.log('台账：' + ledger);
if (ledgerErr) {
  console.error('');
  console.error('⚠️ 台账写入失败（文件可能正被 Excel / WPS 打开）：' + ledgerErr.message);
  console.error('   激活码已正常生成，请关闭表格后重新签发一次，或把上面的码手动补进台账。');
}
