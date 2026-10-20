/* ============================================================
   单证正文多语言自测
   - 20 张单证 × 7 个语种（zh/es/fr/de/pt/ru/ar）
   - 校验：条目数一致、占位符一一对应、占位符都在字段表里
   ============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const sandbox = {};
vm.createContext(sandbox);
for (const f of ['js/docs_data.js', 'js/docs_i18n.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}

const { DOCS_DEF, SHARED_FIELDS, DOC_NOTES } = sandbox;
const LANGS = ['zh', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('  x ' + name + (detail ? ' — ' + detail : ''));
}

const phRe = /\{\{([^}]*)\}\}/g;
function phs(s) {
  const out = [];
  let m;
  while ((m = phRe.exec(s))) out.push(m[1]);
  return out.sort().join(',');
}
function rawPhs(s) {
  return (String(s).match(/\{\{[^}]*\}\}/g) || []).map(x => x.slice(2, -2));
}

const ids = DOCS_DEF.map(d => d.id);
check('DOC_NOTES 覆盖全部 ' + ids.length + ' 张单证', ids.every(id => DOC_NOTES[id]),
  ids.filter(id => !DOC_NOTES[id]).join(','));

DOCS_DEF.forEach(def => {
  const pack = DOC_NOTES[def.id] || {};
  const keys = new Set(
    SHARED_FIELDS.map(f => f.k).concat((def.rows || []).map(r => r[0]))
  );
  LANGS.forEach(lang => {
    const arr = pack[lang];
    check(def.id + '/' + lang + ' 存在', Array.isArray(arr) && arr.length > 0);
    if (!Array.isArray(arr)) return;
    check(def.id + '/' + lang + ' 条数=' + def.notes.length, arr.length === def.notes.length,
      'got ' + arr.length);
    for (let i = 0; i < def.notes.length; i++) {
      check(def.id + '/' + lang + ' #' + (i + 1) + ' 占位符一致',
        phs(arr[i]) === phs(def.notes[i]),
        phs(arr[i]) + ' != ' + phs(def.notes[i]));
      const bad = rawPhs(arr[i]).filter(k => !keys.has(k));
      check(def.id + '/' + lang + ' #' + (i + 1) + ' 占位符已定义',
        bad.length === 0, bad.join(','));
    }
  });
});

/* 英文原文本身也不能有非法占位符（例如 {{vessel||B/L}} 不会被替换） */
DOCS_DEF.forEach(def => {
  const keys = new Set(
    SHARED_FIELDS.map(f => f.k).concat((def.rows || []).map(r => r[0]))
  );
  def.notes.forEach((n, i) => {
    const bad = rawPhs(n).filter(k => !/^\w+$/.test(k) || !keys.has(k));
    check('en/' + def.id + ' #' + (i + 1) + ' 占位符合法', bad.length === 0, bad.join(','));
  });
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
