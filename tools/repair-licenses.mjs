#!/usr/bin/env node
/* ============================================================
   FT Compass · 修复签发台账里的乱码公司名
   用法：
     node tools/repair-licenses.mjs            预览（不改文件）
     node tools/repair-licenses.mjs --write    备份后写回
     node tools/repair-licenses.mjs --file 路径.csv [--write]

   原理：台账每行的激活码里签着原始公司名（payload.co），
   解码激活码就能把被编码损坏的「公司」列还原，不靠猜。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const write = !!arg('write', false);
const ledgerArg = arg('file', '');
const ledger = typeof ledgerArg === 'string' && ledgerArg
  ? path.resolve(process.cwd(), ledgerArg)
  : path.join(os.homedir(), '.ftcompass', 'licenses.csv');

const HEADER = ['时间', '公司', '编号', '版本', '激活码'];

function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

function decodePayload(code) {
  const seg = String(code || '').trim().split('.')[1];
  if (!seg) return null;
  try {
    const json = Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const o = JSON.parse(json);
    return o && typeof o.co === 'string' ? o : null;
  } catch (e) {
    return null;
  }
}

const broken = (s) => /\uFFFD|锟斤拷|烫烫烫|屯屯屯/.test(String(s || ''));

if (!fs.existsSync(ledger)) {
  console.error('找不到台账：' + ledger);
  process.exit(1);
}

const raw = fs.readFileSync(ledger, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/);
const header = lines[0] || '';
const body = lines.slice(1).filter((l) => l.trim());

let fixedCompany = 0, fixedTime = 0, fixedId = 0, skipped = 0, clean = 0;
const report = [];
const out = [];

for (const line of body) {
  const f = splitCsv(line);
  while (f.length < 5) f.push('');
  const [time, company, id, ver, code] = f;
  const p = decodePayload(code);

  if (!p) {
    skipped++;
    out.push(line);
    continue;
  }

  const next = [time, company, id, ver, code];
  const changes = [];

  if (broken(company) || !String(company).trim()) {
    next[1] = p.co;
    if (next[1] !== company) changes.push('公司：' + JSON.stringify(company) + ' → ' + JSON.stringify(p.co));
    fixedCompany++;
  } else if (String(company).trim() !== p.co) {
    report.push('提示：公司名与激活码不一致（保持原样）' + JSON.stringify(company) + ' ↔ ' + JSON.stringify(p.co) + ' [' + (p.id || '') + ']');
  }

  const expectTime = p.iat ? new Date(p.iat * 1000).toISOString() : '';
  if (expectTime && String(time).trim() !== expectTime) {
    report.push('提示：时间与激活码不一致（保持原样）' + JSON.stringify(time) + ' ↔ ' + expectTime + ' [' + (p.id || '') + ']');
  }

  const expectId = String(p.id || '');
  if (expectId && String(id).trim() !== expectId) {
    next[2] = expectId;
    changes.push('编号：' + JSON.stringify(id) + ' → ' + JSON.stringify(expectId));
    fixedId++;
  }

  const expectVer = String(p.ver || '');
  if (expectVer && String(ver).trim() !== expectVer) {
    next[3] = expectVer;
    changes.push('版本：' + JSON.stringify(ver) + ' → ' + JSON.stringify(expectVer));
  }

  if (changes.length) {
    report.push('修复 ' + (expectTime || '') + ' [' + expectId + ']：' + changes.join('；'));
  } else {
    clean++;
  }
  out.push(next.map(q).join(','));
}

console.log('台账：' + ledger);
console.log('数据行：' + body.length + '（可解码激活码并修复 ' + (fixedCompany + fixedId) + ' 处，无需改动 ' + clean + ' 行，缺激活码 ' + skipped + ' 行）');
report.forEach((r) => console.log('  ' + r));

if (!fixedCompany && !fixedId) {
  console.log('没有需要修复的公司名。');
  process.exit(0);
}

if (!write) {
  console.log('\n以上为预览，未改文件。确认后加 --write 写回（会自动备份）。');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const bak = ledger + '.bak-' + stamp;
try {
  fs.copyFileSync(ledger, bak);
} catch (e) {
  console.error('备份失败，已中止：' + e.message);
  process.exit(1);
}

/* 原文件可能正被 WPS 打开，写回失败时不能破坏原文件：退化为写一份修复副本 */
const text = '\uFEFF' + (header || HEADER.join(',')) + '\n' + out.join('\n') + '\n';
try {
  fs.writeFileSync(ledger, text, 'utf8');
} catch (e) {
  const alt = path.join(path.dirname(ledger), 'licenses.fixed.csv');
  try {
    fs.writeFileSync(alt, text, 'utf8');
  } catch (e2) {
    console.error('写回失败（文件可能正被 WPS / Excel 占用）：' + e.message);
    console.error('备份仍在：' + bak);
    process.exit(1);
  }
  console.error('原台账被占用，无法覆盖：' + e.message);
  console.error('已生成修复版副本：' + alt);
  console.error('把 WPS 里的 licenses.csv 关掉（不要保存它），再运行一次 --write 即可原地修复；');
  console.error('或者直接用副本覆盖原文件。');
  process.exit(2);
}

console.log('\n已写回：' + ledger);
console.log('备份：' + bak);
