#!/usr/bin/env node
/* ============================================================
   FT Compass · 发卡向导（给不想记命令的人）
   用法：
     node tools/sign-wizard.mjs              交互输入公司名
     node tools/sign-wizard.mjs --id FT-ABCD 指定编号（默认自动）
     node tools/sign-wizard.mjs --no-clip    不自动复制到剪贴板
   逻辑：问公司名 → 调 sign-license.mjs 签发 → 自动把激活码放进剪贴板。
   中文路径：公司名用 readline 读进来，再以参数数组交给子进程
   （CreateProcessW 走宽字符），不经过命令行 argv，不会被转码搞坏。
   ============================================================ */
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const signer = path.join(here, 'sign-license.mjs');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function ask(text) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(v);
    };
    rl.question(text, (answer) => finish(String(answer || '').trim()));
    /* 管道输入结束得比回车快时，question 不会再回调：用 close 兜底 */
    rl.on('close', () => finish(''));
  });
}

const company = await ask('客户公司全称（营业执照上的名字）：');
if (!company) {
  console.error('没有输入公司名，已取消。用法：node tools/sign-wizard.mjs --company "公司名"');
  process.exit(1);
}

const id = arg('id', '');
let out = '';
try {
  out = execFileSync(process.execPath, [signer, '--company', company, ...(id ? ['--id', id] : [])], { encoding: 'utf8' });
} catch (e) {
  process.stdout.write(String(e.stdout || ''));
  process.stderr.write(String(e.stderr || ''));
  process.exit(e.status || 1);
}
process.stdout.write(out);

const code = (out.match(/FT1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [''])[0];
if (code && !process.argv.includes('--no-clip')) {
  const r = process.platform === 'win32'
    ? spawnSync('clip', { input: code })
    : { status: 1 };
  console.log(r.status === 0
    ? '✅ 整行激活码已复制到剪贴板，直接粘贴发给客户即可。'
    : '（剪贴板不可用，请手动复制上面那行 FT1.…）');
}
