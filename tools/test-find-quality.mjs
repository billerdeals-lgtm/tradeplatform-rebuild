#!/usr/bin/env node
/* ============================================================
   FT Compass · 找客户数据质量测试
   用法：node tools/test-find-quality.mjs
   覆盖：国家推断、邮箱过滤、目录页/未解析 Markdown 清洗、Zauba 导入标记
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const ctx = {
  console,
  AbortSignal: globalThis.AbortSignal,
  URL,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  JSON
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/sources.js'), 'utf8'), ctx, { filename: 'sources.js' });
const S = ctx.Sources;

let pass = 0, fail = 0;
function ok(name, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + ' got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
}

/* 1. 国家：只认完整后缀与明确写法 */
ok('co.ke → Kenya', S.countryFromDomain('https://acme.co.ke/about'), 'Kenya');
ok('子域 co.ke → Kenya', S.countryFromDomain('https://shop.acme.co.ke'), 'Kenya');
ok('co.uk → UK', S.countryFromDomain('https://acme.co.uk'), 'United Kingdom');
ok('com.br → Brazil', S.countryFromDomain('https://acme.com.br'), 'Brazil');
ok('裸 .co → Colombia', S.countryFromDomain('https://acme.co'), 'Colombia');
ok('com 不猜国家', S.countryFromDomain('https://acme.com'), '');
ok('URL 无协议也能识别', S.countryFromDomain('acme.co.ke/path?x=1'), 'Kenya');

ok('Country: Kenya', S.detectCountryExplicit('About us\nCountry: Kenya\nPhone: +254...'), 'Kenya');
ok('国家：肯尼亚', S.detectCountryExplicit('国家：肯尼亚'), 'Kenya');
ok('based in Vietnam', S.detectCountryExplicit('We are based in Vietnam and import solar panels.'), 'Vietnam');
ok('地址末尾国家', S.detectCountryExplicit('Address: 123 Main St, Nairobi, Kenya 00100'), 'Kenya');
ok('U.S.A. 规范化', S.normalizeCountry('U.S.A.'), 'USA');
ok('裸国家词不推断', S.detectCountry('Kenya is a country in East Africa. We import solar panels.'), '');
ok('城市名不推断', S.detectCountry('Our office is in Lima and Bogota.'), '');
ok('不存在的国家不硬猜', S.detectCountryExplicit('Country: Narnia'), '');
ok('旧接口 fallback 会规范化', S.detectCountry('', 'kenya'), 'Kenya');

/* 2. 邮箱过滤 */
function emails(text) { return S.extractContacts(text).emails; }
ok('DDG 代理错址被挡', emails('error-lite@duckduckgo.com sales@acme.co.ke'), ['sales@acme.co.ke']);
ok('noreply/abuse 被挡', emails('noreply@acme.com abuse@acme.com info@acme.com'), ['info@acme.com']);
ok('占位域被挡', emails('hello@example.com buyer@example.org real@acme.com'), ['real@acme.com']);
ok('gmail 保留', emails('buyer@gmail.com'), ['buyer@gmail.com']);
ok('伪图片邮箱被挡', emails('logo@2x.png real@acme.com'), ['real@acme.com']);
ok('连续点被挡', emails('bad@acme..com real@acme.com'), ['real@acme.com']);
ok('isJunkEmail 直接判断', [S.isJunkEmail('error-lite@duckduckgo.com'), S.isJunkEmail('sales@acme.co.ke')], [true, false]);

/* 3. 结果清洗 */
ok('Privacy Policy 被过滤', S.isJunkName('Privacy Policy'), true);
ok('带站点后缀的 Cookie Policy', S.isJunkName('Cookie Policy | Europages'), true);
ok('Terms and Conditions', S.isJunkName('Terms and Conditions'), true);
ok('About Us', S.isJunkName('About Us'), true);
ok('Sitemap', S.isJunkName('Sitemap'), true);
ok('General Conditions of Use', S.isJunkName('General Conditions of Use'), true);
ok('Conditions of Use', S.isJunkName('Conditions of Use'), true);
ok('未解析 Markdown', S.isJunkName('[Acme Ltd](https://acme.com)'), true);
ok('Markdown 残留', S.isJunkName('**Acme Ltd**'), true);
ok('正常公司名保留', S.isJunkName('Acme Solar Trading Ltd.'), false);
ok('Cookie Co. 不误杀', S.isJunkName('Cookie Co.'), false);
ok('普通竖线公司名保留', S.isJunkName('Acme | Distributor'), false);
ok('Europages 图片 CDN 不作为官网', S.isBlocked('d18yn9dcojt05d.cloudfront.net'), true);
ok('Europages 图片 CDN（visable）也不作为官网', S.isBlocked('media.visable.com'), true);
ok('普通公司域名不被 CDN 规则误伤', S.isBlocked('acme-solar.com'), false);

/* 4. Zauba 行补导入标记 */
const zauba = S.parseZauba('| [Acme Imports LLC](https://www.zauba.com/acme-import-report-123) | 100 |\n' +
  '| [Login to view](https://www.zauba.com/login) | - |\n', 'solar panel');
ok('Zauba 解析出一条', zauba.length, 1);
ok('Zauba 国家固定 USA', zauba[0].country, 'USA');
ok('Zauba 带 _inquiry 以便显示导入按钮', zauba[0]._inquiry, true);

/* 5. go4World 国家规范化 */
const g4 = S.parseGo4World('Buyer From\nKenya\nProduct Name : Solar Panel\nQuantity Required : 500\n', 'solar panel');
ok('go4World 肯尼亚规范化', g4.length && g4[0].country, 'Kenya');
const g4b = S.parseGo4World('Buyer From\nCalifornia, United States\nProduct Name : Solar Panel\nQuantity Required : 500\n', 'solar panel');
ok('go4World 州名收敛为国家', g4b.length && g4b[0].country, 'USA');
ok('Azerbaijan 能规范化', S.normalizeCountry('Azerbaijan'), 'Azerbaijan');

/* 6. DDG 风控挑战页：必须报抓取失败，不能当成「确实 0 家」 */
const CHALLENGE = 'Unfortunately, bots use DuckDuckGo too. '
  + '<div class="anomaly-modal"><form class="challenge-form"></form></div>'
  + 'x'.repeat(200);
const DDG_OK = '[Acme Solar - panel distributor](https://acme-solar.com/catalog)\n'
  + 'Solar panel distributor catalog and company profile. '.repeat(4);
let challengeMode = true;
ctx.fetch = async function () {
  const text = challengeMode ? CHALLENGE : DDG_OK;
  return { ok: true, status: 200, text: async function () { return text; } };
};
let ddgErr = null;
try {
  await S.run('ddg', { product: 'solar panel', queries: [{ q: 'solar panel distributor' }] });
} catch (e) { ddgErr = e; }
ok('DDG 挑战页判为抓取失败（带 FETCH_FAILED）', ddgErr && ddgErr.code, 'FETCH_FAILED');
challengeMode = false;
const ddgOk = await S.run('ddg', { product: 'solar panel', queries: [{ q: 'solar panel distributor' }] });
ok('DDG 正常结果仍能解析', ddgOk.length && ddgOk[0].website, 'https://acme-solar.com');

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
