/* 手工线索模糊查重纯函数回归：node tools/test-lead-dedupe.mjs
   覆盖：名称归一化、公司后缀、包含/编辑距离、域名、公共邮箱、排除当前记录。 */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/lead-dedupe.js', import.meta.url), 'utf8');
const window = {};
const ctx = { window, console };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const D = window.LeadDedupe;

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + '：got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}
function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL ' + name + (extra ? '：' + extra : ''));
}

/* 1. 名称归一化 */
eq('大小写/标点/后缀', D.normName('Acme Trading Co., Ltd.'), 'acme');
eq('公司后缀不误删主体', D.normName('Sunrise Electronics Ltd'), 'sunrise electronics');
eq('& 视作 and', D.normName('H&M Import & Export'), 'h and m');
eq('中文后缀', D.normName('宁波华美贸易有限公司'), '宁波华美');
eq('中文进出口', D.normName('宁波华美进出口有限公司'), '宁波华美');
eq('全是后缀时回退原文', D.normName('Trading Co Ltd'), 'trading co ltd');
eq('空值', D.normName(null), '');

/* 2. 名称相似度 */
eq('完全相同', D.nameScore('Acme Ltd', 'Acme'), 100);
eq('后缀词归一后完全相同', D.nameScore('Acme Industries', 'Acme'), 100);
eq('包含关系', D.nameScore('Acme Solutions', 'Acme'), 84);
eq('拼写错误仍算相似', D.nameScore('Shenzhen Sunrise Electronics Co Ltd', 'Shenzen Sunrise Electronic'), 88);
ok('完全无关不命中', D.nameScore('Acme Trading', 'Zenith Foods') === 0);
ok('短名不做编辑距离', D.nameScore('Omar', 'Omarz') === 0);
eq('短名整词包含仍提示', D.nameScore('Omar Hassan', 'Omar'), 84);
eq('中文包含', D.nameScore('宁波华美机械有限公司', '宁波华美'), 84);

/* 3. 域名 */
eq('URL 取域名', D.domainFromUrl('https://www.acme.com/path?x=1'), 'acme.com');
eq('裸域名', D.domainFromUrl('acme.com'), 'acme.com');
eq('端口/协议', D.domainFromUrl('http://acme.com:8080/a'), 'acme.com');
eq('邮箱取域名', D.emailDomain('sales@acme.com'), 'acme.com');
eq('gmail 不算企业域名', D.emailDomain('john@gmail.com'), '');
eq('qq 邮箱不算企业域名', D.emailDomain('123@qq.com'), '');
eq('可注册域名去子域', D.registrable('mail.acme.com'), 'acme.com');
eq('co.uk 保留三段', D.registrable('mail.acme.co.uk'), 'acme.co.uk');
eq('com.cn 保留三段', D.registrable('mail.acme.com.cn'), 'acme.com.cn');
eq('网站优先于邮箱', D.leadDomain({ website: 'https://acme.com', email: 'x@gmail.com' }), 'acme.com');

/* 4. find：名称 / 域名 / 邮箱 */
const leads = [
  { id: 'L1', name: 'Acme Trading Co., Ltd.', country: 'USA', email: 'sales@acme.com' },
  { id: 'L2', name: '宁波华美贸易有限公司', country: '中国', email: 'info@huamei.cn' },
  { id: 'L3', name: 'Zenith Foods', country: 'Spain', email: 'buyer@gmail.com' }
];
let r = D.find(leads, { name: 'Acme' });
eq('名称命中 Acme', r.map(x => x.lead.id), ['L1']);
ok('名称命中带原因', r[0].reasons.indexOf('名称完全相同') >= 0);

r = D.find(leads, { name: 'Newcomer Ltd', email: 'sales@acme.com' });
eq('企业邮箱域名命中', r.map(x => x.lead.id), ['L1']);
ok('域名命中带原因', r[0].reasons.join(' ').indexOf('acme.com') >= 0);

r = D.find(leads, { name: 'Newcomer Ltd', email: 'someone@gmail.com' });
eq('公共邮箱不误报', r.length, 0);

r = D.find(leads, { name: 'Acme Trading', email: 'new@acme.com' }, 'L1');
eq('编辑自己时排除当前记录', r.length, 0);

r = D.find(leads, { name: 'Acme Trading' }, 'L1');
eq('排除后仍能命中别的线索', r.length, 0);

r = D.find(leads, { name: '宁波华美机械' });
eq('中文简称命中全称', r.map(x => x.lead.id), ['L2']);

r = D.find(leads, { name: 'Acme', email: 'sales@acme.com' });
ok('名称+域名合并原因', r[0].reasons.length >= 2, JSON.stringify(r[0].reasons));

/* 5. 排序：域名/邮箱（95）优先于纯名称相似（70-88） */
const mix = [
  { id: 'A', name: 'Acme Solutions', country: 'UAE' },
  { id: 'B', name: 'Totally Different', country: 'USA', email: 'x@acme.com' }
];
r = D.find(mix, { name: 'Acme', email: 'y@acme.com' });
eq('高可信度排前面', r[0].lead.id, 'B');

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
