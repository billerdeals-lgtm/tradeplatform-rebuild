#!/usr/bin/env node
/* ============================================================
   FT Compass · 生成授权签名密钥对（一次性）
   - 私钥写入 %USERPROFILE%\.ftcompass\private.pem（仓库外，勿提交）
   - 公钥打印到控制台，手动贴进 js/license.js 的 PUBKEY_B64
   用法：node tools/gen-key.mjs [--force]
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const dir = path.join(os.homedir(), '.ftcompass');
const keyPath = path.join(dir, 'private.pem');

if (fs.existsSync(keyPath) && !process.argv.includes('--force')) {
  console.error('私钥已存在：' + keyPath);
  console.error('如需轮换密钥，请先备份旧私钥，再加 --force 重新生成。');
  console.error('（注意：换密钥后，旧私钥签发的激活码将无法再签新码，但已发出的码在前端仍可验签通过。）');
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1'
});

fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });

const spki = publicKey.export({ type: 'spki', format: 'der' });
const b64 = Buffer.from(spki).toString('base64');

console.log('✅ 私钥已写入：' + keyPath);
console.log('');
console.log('把下面整行贴进 js/license.js 的 PUBKEY_B64：');
console.log('');
console.log(b64);
console.log('');
console.log('⚠️  立刻把 private.pem 备份到 U 盘或密码管理器。');
console.log('    丢了私钥 = 以后无法再签发新的激活码（已售出的码不受影响）。');
console.log('⚠️  永远不要提交 private.pem、也不要发给任何人。');
