import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const repo = 'C:/Users/Mystery/Desktop/tradeplatform-rebuild/tradeplatform-rebuild';
const sandbox = path.join(os.tmpdir(), 'ftc-ledger-test-' + Date.now());
const profile = path.join(sandbox, '.ftcompass');
fs.mkdirSync(profile, { recursive: true });
fs.copyFileSync(path.join(os.homedir(), '.ftcompass', 'private.pem'), path.join(profile, 'private.pem'));

const companyFile = path.join(sandbox, 'company.txt');
fs.writeFileSync(companyFile, '\uFEFF河北林灵贸易有限公司\n', 'utf8');

const env = { ...process.env, USERPROFILE: sandbox, HOME: sandbox };
const sign = path.join(repo, 'tools/sign-license.mjs');

function run(args, input) {
  try {
    const out = execFileSync(process.execPath, [sign, ...args], { encoding: 'utf8', env, input, stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status || 1, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

let pass = 0, fail = 0;
const ok = (n, v, extra) => { if (v) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (extra ? ' :: ' + extra : '')); } };

/* 1. --company-file 干净中文 */
const r1 = run(['--company-file', companyFile, '--id', 'FT-FILE']);
const code1 = (r1.out.match(/FT1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [''])[0];
ok('--company-file 能签发', r1.code === 0 && !!code1, r1.out.slice(0, 200));
const ledger = path.join(profile, 'licenses.csv');
const text1 = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8') : '';
ok('台账写入中文无替换字符', text1.includes('河北林灵贸易有限公司') && !text1.includes('\uFFFD'), text1);
ok('台账写入 BOM', text1.charCodeAt(0) === 0xFEFF);
const seg = code1.split('.')[1] || '';
const payload = JSON.parse(Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
ok('激活码 payload 公司名正确', payload.co === '河北林灵贸易有限公司', payload.co);

/* 2. 编码坏掉的公司名必须拒签 */
const badFile = path.join(sandbox, 'bad.txt');
fs.writeFileSync(badFile, '演示\uFFFD\uFFFD贸易有限公司\n', 'utf8');
const before = fs.readFileSync(ledger, 'utf8');
const r2 = run(['--company-file', badFile, '--id', 'FT-BAD']);
ok('含 U+FFFD 的公司名被拒签', r2.code !== 0 && /编码损坏/.test(r2.out), r2.out.slice(0, 200));
ok('拒签时不写台账', fs.readFileSync(ledger, 'utf8') === before);

/* 3. repair 工具能按激活码还原乱码行 */
const repair = path.join(repo, 'tools/repair-licenses.mjs');
try {
  execFileSync(process.execPath, [repair, '--write'], { cwd: repo, env, encoding: 'utf8' });
} catch (e) { /* 预览模式无修复时不报错 */ }
const damaged = '\uFEFF' + '时间,公司,编号,版本,激活码\n'
  + [new Date(payload.iat * 1000).toISOString(), '河北\uFFFD\uFFFD贸易有限公司', 'FT-FILE', '1', code1].map(v => '"' + v + '"').join(',') + '\n';
fs.writeFileSync(ledger, damaged, 'utf8');
const out3 = execFileSync(process.execPath, [repair, '--write'], { cwd: repo, env, encoding: 'utf8' });
const fixedText = fs.readFileSync(ledger, 'utf8');
ok('repair 从激活码还原公司名', fixedText.includes('河北林灵贸易有限公司') && !fixedText.includes('\uFFFD'), out3);
ok('repair 生成备份', fs.readdirSync(profile).some(f => f.startsWith('licenses.csv.bak-')));

fs.rmSync(sandbox, { recursive: true, force: true });
console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
