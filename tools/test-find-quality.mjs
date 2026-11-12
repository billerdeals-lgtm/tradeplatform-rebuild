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

/* 7. 规则引擎：买家信号优先，不能把经销商当电商页误杀 */
const rDist = S.ruleCheck('We are an authorized distributor of solar panels in Kenya. Add to cart. Price per unit USD 120.', false);
ok('经销商带购物车/单价不误杀', [rDist.skip, rDist.score], [false, 6]);
const rImp = S.ruleCheck('Acme Imports Ltd is an importer and wholesaler. Download our price list.', false);
ok('进口商自己的报价单不算采购询盘', [rImp.skip, rImp.isPriceInquiry, rImp.score], [false, false, 6]);
const rRfq = S.ruleCheck('We are looking for a supplier of LED lights. Request for quotation.', false);
ok('RFQ 仍判为采购询盘', [rRfq.skip, rRfq.isPriceInquiry, rRfq.score], [false, true, 7]);
const rWant = S.ruleCheck('Supplier wanted for washing powder, monthly order.', false);
ok('求购文案判为询盘', [rWant.skip, rWant.isPriceInquiry], [false, true]);
ok('自称工厂仍剔除', S.ruleCheck('We are a manufacturer and factory. FOB price USD 3 per piece.', false).skip, true);
ok('strongOnly 不看弱规则', S.ruleCheck('Add to cart', true).skip, false);
ok('无买家信号的电商页仍剔除', S.ruleCheck('Add to cart. $12.50 / unit. Product catalog.', false).skip, true);

/* 8. 公司名：域名不再拼出 "Shop"，标题升级必须和域名对得上 */
ok('子域名取可注册域名核心词', S.nameFromDomain('shop.africa-distribution.co.ke'), 'Africa Distribution');
ok('域名尾缀不混进公司名', S.nameFromDomain('ledlights-uk.co.uk'), 'Ledlights Uk');
ok('标题品牌名替换域名名', S.companyNameFromTitle('Acme Solar | Solar Panel Distributor in Kenya', 'acmesolar.com'), 'Acme Solar');
ok('标题升级支持完整 URL', S.companyNameFromTitle('Acme Solar | Solar Panel Distributor', 'https://acme.com'), 'Acme Solar');
ok('标题按分隔符取品牌段', S.companyNameFromTitle('Africa Distribution — Wholesale Supplier', 'africa-distribution.co.ke'), 'Africa Distribution');
ok('文章标题不当公司名', S.companyNameFromTitle('How to choose a solar panel supplier in Kenya | Acme Blog', 'acmesolar.com'), '');
ok('纯导航标题不当公司名', S.companyNameFromTitle('Home | Contact Us | Login', 'acme.com'), '');
ok('标题含域名核心词可保留', S.companyNameFromTitle('Buy Solar Panels Online - Best Price | AcmeSolar', 'acmesolar.com'), 'AcmeSolar');

/* 9. 邮箱：先招采购/销售，再 info；建站商邮箱降权 */
ok('webmaster 不排在 sales 前面', S.extractContacts('webmaster@acme.co.ke sales@acme.co.ke info@acme.co.ke', 'acme.co.ke').emails, ['sales@acme.co.ke', 'info@acme.co.ke', 'webmaster@acme.co.ke']);
ok('本公司域名优先于建站商', S.extractContacts('Built by studio@webagency.com sales@acme.co.ke', 'acme.co.ke').emails[0], 'sales@acme.co.ke');
ok('采购岗位排最前', S.rankEmails(['info@acme.com', 'procurement@acme.com', 'sales@acme.com'], 'acme.com')[0], 'procurement@acme.com');
ok('免费邮箱可用', S.isFreeMail('gmail.com'), true);
ok('免费邮箱不因域名不同被重罚', S.emailRank('buyer@gmail.com', 'acme.com') > S.emailRank('buyer@webagency.com', 'acme.com'), true);
const sharedMail = [
  { name: 'A Ltd', website: 'https://a-ke.com', email: 'info@acme-group.com' },
  { name: 'B Ltd', website: 'https://b-ng.com', email: 'sales@acme-group.com' },
  { name: 'C Ltd', website: 'https://c-gh.com', email: 'contact@acme-group.com' }
];
ok('共享邮箱域清理 3 条', S.dropSharedEmails(sharedMail), 3);
ok('共享邮箱已清空', sharedMail.map(function (x) { return x.email; }), ['', '', '']);
const twoMail = [
  { name: 'A Ltd', website: 'https://a-ke.com', email: 'info@acme-group.com' },
  { name: 'B Ltd', website: 'https://b-ng.com', email: 'sales@acme-group.com' }
];
ok('只有两家共享时不清理', S.dropSharedEmails(twoMail), 0);

/* 10. 合并：子域、同名、多来源 */
const mg = S.mergeCandidates([
  { name: 'Acme Solar', website: 'https://acme.com', source: 'DuckDuckGo' },
  { name: 'Acme Solar Ltd', website: 'https://shop.acme.com', source: 'Bing', email: 'sales@acme.com' },
  { name: 'Acme Solar Limited', linkedin: 'https://linkedin.com/company/acme-solar', source: 'LinkedIn' },
  { name: 'Acme Solar', website: 'https://acme.co.ke', source: 'Europages', country: 'Kenya' }
]);
ok('子域/同名/领英合并为一条', mg.length, 1);
ok('合并保留多来源', mg[0]._sources.slice().sort(), ['Bing', 'DuckDuckGo', 'Europages', 'LinkedIn']);
ok('合并补上联系方式', mg[0].email, 'sales@acme.com');
const mg2 = S.mergeCandidates([
  { name: 'Acme Solar', website: 'https://acmesolar.com' },
  { name: 'Acme Solar', website: 'https://acme.co.ke', country: 'Kenya' }
]);
ok('域名核心词不同不硬合并', mg2.length, 2);
ok('子域按可注册域名归一', S.registrableDomain('https://shop.acme.co.ke/x'), 'acme.co.ke');
ok('多级子域按可注册域名归一', S.registrableDomain('a.b.acme.com'), 'acme.com');

/* 11. 国家证据分级 */
ok('JSON-LD 两字母国家码', S.countryEvidence('acme.com', '<script type="application/ld+json">{"address":{"addressCountry":"KE"}}</script>', true), { country: 'Kenya', source: 'jsonld' });
ok('JSON-LD 国家全名', S.countryEvidence('acme.com', '{"addressCountry":"United Arab Emirates"}', true).country, 'UAE');
ok('电话区号识别', S.countryEvidence('acme.com', 'Call us +254 20 123 4567', true), { country: 'Kenya', source: 'phone' });
ok('页脚地址识别', S.countryEvidence('acme.com', 'Acme Ltd\nHead Office: Plot 12, Industrial Area, Nairobi, Kenya', true), { country: 'Kenya', source: 'footer' });
ok('官网后缀优先于页面文字', S.countryEvidence('acme.co.ke', 'Country: Colombia', true), { country: 'Kenya', source: 'domain' });
ok('目录详情页不读正文', S.countryEvidence('acme.com', 'Country: Kenya', false), { country: '', source: '' });
ok('无证据不乱猜', S.countryEvidence('acme.com', 'We import solar panels to Nairobi and Lima.', true), { country: '', source: '' });
ok('+1 不猜美国/加拿大', S.countryEvidence('acme.com', 'Call +1 202 555 0143', true), { country: '', source: '' });

/* 12. 目标市场 */
ok('肯尼亚属于非洲', S.inRegion('Kenya', 'Africa'), true);
ok('肯尼亚不属于欧洲', S.inRegion('Kenya', 'Europe'), false);
ok('国家未知时保留', S.inRegion('', 'Europe'), null);
ok('美国市场只收美国', S.inRegion('Canada', 'USA'), false);

/* 13. 联系页发现 */
ok('同域联系页', S.contactUrlFromLinks([
  { url: 'https://acme.com/about', label: 'About' },
  { url: 'https://acme.com/contact-us', label: 'Contact us' }
], 'https://acme.com'), 'https://acme.com/contact-us');
ok('不跳到别家网站', S.contactUrlFromLinks([{ url: 'https://other.com/contact', label: 'Contact' }], 'https://acme.com'), '');
ok('不把 PDF 当联系页', S.contactUrlFromLinks([{ url: 'https://acme.com/contact.pdf', label: 'Contact' }], 'https://acme.com'), '');

/* 14. 目录站/同行名字过滤 + 电话区号兜底 */
ok('Yellowpages 域名拦截', S.isBlocked('yellowpages-uae.com'), true);
ok('PropertyFinder 域名拦截', S.isBlocked('propertyfinder.ae'), true);
ok('ENF Solar 目录拦截', S.isBlocked('enfsolar.com'), true);
ok('普通公司域名不误伤', S.isBlocked('acme-solar.com'), false);
ok('名字带 Supplier 判同行', S.isSellerName('US Solar Supplier'), true);
ok('名字带 Distributor 不算同行', S.isSellerName('Acme Solar Distributor'), false);
ok('描述性标题不当公司名', S.companyNameFromTitle('PowerAll Solar Company in Kenya', 'powerall.co.ke'), '');
ok('电话区号多次出现可定国家', S.countryFromPhone('Sales +971 4 368 6393, warehouse +971 50 973 2174') , 'UAE');
ok('两个国家号码打平不猜', S.countryFromPhone('Kenya +254 20 123 4567, UAE +971 4 368 6393'), '');
ok('单次电话区号仍可作为证据', S.countryFromPhone('Call us +254 20 123 4567'), 'Kenya');

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
