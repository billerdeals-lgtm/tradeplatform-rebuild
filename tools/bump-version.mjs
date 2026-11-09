#!/usr/bin/env node
/* ============================================================
   全站缓存戳统一入口
   ------------------------------------------------------------
   过去 ?v=1 / ?v=6 / ?v=11 各写各的，改一个文件忘了 bump 就出现
   「首页更新了、模块还在跑旧缓存」。现在所有 src/href 的资源
   查询参数统一成同一个发布戳，MODULE_V 也用它（iframe 强刷）。

   用法：
     node tools/bump-version.mjs              # 自动用今天日期 + a
     node tools/bump-version.mjs 20261109a    # 指定发布戳
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function today() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

/** 同一天重复执行时自动往后排字母：20261109a → 20261109b */
function nextStamp(current) {
  const day = today();
  if (current && current.startsWith(day) && /^[a-z]$/.test(current.slice(8))) {
    const code = current.charCodeAt(8);
    if (code < 122) return day + String.fromCharCode(code + 1);
  }
  return day + 'a';
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const htmlFiles = walk(root, []);
const home = path.join(root, 'index.html');
const homeSrc = fs.readFileSync(home, 'utf8');
const current = (homeSrc.match(/MODULE_V\s*=\s*'([^']+)'/) || [])[1] || '';
const release = process.argv[2] || nextStamp(current);

if (!/^\d{8}[a-z]?$/.test(release)) {
  console.error('发布戳格式应为 YYYYMMDD 或 YYYYMMDDx，例如 20261109a');
  process.exit(1);
}

let files = 0, refs = 0, moduleV = 0;
for (const file of htmlFiles) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before.replace(/((?:src|href)="[^"]*?[?&])v=[^"&]+/g, (m, prefix) => {
    refs++;
    return prefix + 'v=' + release;
  });
  if (/MODULE_V\s*=\s*'[^']*'/.test(after)) {
    after = after.replace(/(MODULE_V\s*=\s*')[^']+(')/g, '$1' + release + '$2');
    moduleV++;
  }
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    files++;
  }
}

console.log(`发布戳 ${release}：更新 ${files} 个 HTML、${refs} 处资源引用、${moduleV} 处 MODULE_V。`);
