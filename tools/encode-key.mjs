#!/usr/bin/env node
/* ============================================================
   FT Compass · 内置密钥编码
   用法：
     node tools/encode-key.mjs "sk-xxxx"            # 生成编码串
     node tools/encode-key.mjs --check "sk-xxxx"    # 校验现有编码能否还原

   说明：这只是混淆，不是加密。浏览器在发请求时仍会把密钥明文放进
   Authorization 头，抓包即可获得。真正的保护只有服务端代理。
   ============================================================ */
import crypto from 'node:crypto';

const MASK = 'FT-Compass-2026';
const PARTS = 3;

function encode(key) {
  const bytes = Buffer.from(key, 'utf8');
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ MASK.charCodeAt(i % MASK.length);
  const b64 = out.toString('base64');
  const size = Math.ceil(b64.length / PARTS);
  const parts = [];
  for (let i = 0; i < b64.length; i += size) parts.push(b64.slice(i, i + size));
  return parts;
}

function decode(parts) {
  const b64 = parts.join('');
  const buf = Buffer.from(b64, 'base64');
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i] ^ MASK.charCodeAt(i % MASK.length));
  return s;
}

const args = process.argv.slice(2);
const check = args[0] === '--check';
const key = check ? args[1] : args[0];

if (!key) {
  console.error('用法：node tools/encode-key.mjs "sk-xxxx"');
  process.exit(1);
}

if (check) {
  const parts = JSON.parse(args[2] || '[]');
  const back = decode(parts);
  console.log('还原一致：' + (back === key ? 'PASS' : 'FAIL'));
  console.log('长度：' + back.length);
  process.exit(back === key ? 0 : 1);
}

const parts = encode(key);
console.log('// 把下面这一行替换 agnes-ai.js 里的 KEY_ENC');
console.log('var KEY_ENC = ' + JSON.stringify(parts) + ';');
console.log('');
console.log('自检：');
const back = decode(parts);
console.log('  长度 ' + back.length + '，还原一致：' + (back === key ? 'PASS' : 'FAIL'));
console.log('  指纹 ' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 12) + '（只用于比对，不泄露密钥）');
