#!/usr/bin/env node
/* ============================================================
   FT Compass · 授权离线自测
   用法：node tools/test-license.mjs
   依赖本地私钥 %USERPROFILE%\.ftcompass\private.pem
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const keyPath = path.join(os.homedir(), '.ftcompass', 'private.pem');

if (!fs.existsSync(keyPath)) {
  console.error('找不到私钥，跳过：' + keyPath);
  process.exit(1);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/* ---------- 浏览器环境桩 ---------- */
const mem = new Map();
globalThis.window = {
  crypto: webcrypto,
  localStorage: {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: k => mem.delete(k)
  },
  open() {},
  top: null
};
globalThis.window.top = globalThis.window;
globalThis.document = {
  cookie: '',
  readyState: 'complete',
  head: { appendChild() {} },
  body: { appendChild() {} },
  getElementById() { return null; },
  createElement() {
    return {
      style: {}, classList: { add() {}, remove() {} },
      appendChild() {}, remove() {}, setAttribute() {}, focus() {}
    };
  },
  addEventListener() {}
};
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');

const src = fs.readFileSync(path.join(root, 'js', 'license.js'), 'utf8');
vm.runInThisContext(src, { filename: 'js/license.js' });
const L = globalThis.window.License;

/* ---------- 签发 ---------- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const priv = crypto.createPrivateKey(fs.readFileSync(keyPath));

function sign(payload) {
  const seg = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto.sign('sha256', Buffer.from(seg, 'ascii'), { key: priv, dsaEncoding: 'ieee-p1363' });
  return 'FT1.' + seg + '.' + b64url(sig);
}

const company = '测试贸易有限公司';
const base = { v: 1, id: 'FT-TEST', co: company, iat: Math.floor(Date.now() / 1000), ver: '1' };
const code = sign(base);

console.log('\n[1] 格式');
const parts = code.split('.');
check('前缀 FT1.', code.startsWith('FT1.'));
check('三段式', parts.length === 3);
check('签名为 64 字节 raw r||s', Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64').length === 64);
check('激活码长度在 180-400 之间', code.length > 180 && code.length < 400, String(code.length));

console.log('\n[2] 正常激活');
const r1 = await L.activate(code);
check('activate 成功', r1.ok === true, JSON.stringify(r1));
check('状态为 pro', L.status().state === 'pro');
check('公司名正确', L.status().company === company);
check('编号正确', L.status().id === 'FT-TEST');
check('水印含公司名', L.watermark().includes(company), L.watermark());
check('水印含编号', L.watermark().includes('FT-TEST'));
check('备份码一致', L.backupCode() === code);
check('试用期不再拦截', await L.consume('find') === true);

console.log('\n[3] 带换行/空格的粘贴');
const messy = code.replace(/\./g, '.\n  ');
const r2 = await L.activate(messy);
check('自动去除空白后仍可激活', r2.ok === true, JSON.stringify(r2));

console.log('\n[4] 篡改 payload');
const payloadSeg = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const tampered = { ...payloadSeg, co: '黑客公司' };
const seg2 = b64url(Buffer.from(JSON.stringify(tampered), 'utf8'));
const r3 = await L.activate('FT1.' + seg2 + '.' + parts[2]);
check('改公司名 → SIGNATURE', r3.ok === false && r3.code === 'SIGNATURE', JSON.stringify(r3));

console.log('\n[5] 篡改签名');
const sigRaw = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
sigRaw[0] = sigRaw[0] ^ 0xFF;
const r4 = await L.activate('FT1.' + parts[1] + '.' + b64url(sigRaw));
check('改签名 → SIGNATURE', r4.ok === false && r4.code === 'SIGNATURE', JSON.stringify(r4));

console.log('\n[6] 版本不匹配');
const r5 = await L.activate(sign({ ...base, ver: '2', id: 'FT-V2' }));
check('ver=2 → VERSION', r5.ok === false && r5.code === 'VERSION', JSON.stringify(r5));

console.log('\n[7] 格式错误');
const r6 = await L.activate('这不是激活码');
check('乱码 → FORMAT', r6.ok === false && r6.code === 'FORMAT');
const r7 = await L.activate('FT1.abc');
check('段数不足 → FORMAT', r7.ok === false && r7.code === 'FORMAT');
const r8 = await L.activate('FT1.!!!.???');
check('非法 base64 → FORMAT', r8.ok === false && r8.code === 'FORMAT', JSON.stringify(r8));

console.log('\n[8] 试用期状态（新环境）');
mem.clear();
globalThis.document.cookie = '';
const L2Src = fs.readFileSync(path.join(root, 'js', 'license.js'), 'utf8');
// 重新加载模块以获得干净状态
delete globalThis.window.License;
vm.runInThisContext(L2Src, { filename: 'js/license.js' });
const L2 = globalThis.window.License;
const s = await L2.ready();
check('初始为 trial', s.state === 'trial', s.state);
check('初始剩 15 天', s.daysLeft === 15, String(s.daysLeft));
check('初始剩 30 次', s.usesLeft === 30, String(s.usesLeft));

const ok1 = await L2.consume('find');
const s2 = L2.status();
check('扣次成功', ok1 === true);
check('次数 -1', s2.usesLeft === 29, String(s2.usesLeft));
await L2.refund('find');
check('返还后回到 30', L2.status().usesLeft === 30, String(L2.status().usesLeft));

let allowed = 0;
for (let i = 0; i < 35; i++) { if (await L2.consume('find')) allowed++; }
check('最多放行 30 次', allowed === 30, String(allowed));
check('用尽后状态 trial_over', L2.status().state === 'trial_over', L2.status().state);
check('用尽后水印为试用版', L2.watermark().includes('试用'), L2.watermark());

console.log('\n---------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
