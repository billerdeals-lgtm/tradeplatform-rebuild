/* 单证多 SKU 明细纯函数回归：node tools/test-doc-items.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../js/doc-items.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const D = ctx.DocItems;

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

/* 1. 行金额：数量×单价优先，缺项回退已存 amount */
eq('行金额数量乘单价', D.lineAmount({ qty: 3, price: 2.5 }), 7.5);
eq('行金额回退 amount', D.lineAmount({ qty: '', price: '', amount: '12.50' }), 12.5);
eq('行金额全空为 0', D.lineAmount({}), 0);
eq('金额两位小数', D.money(7.005), '7.01');

/* 2. 旧单行数据升级成一行明细 */
const legacy = { product: 'LED Panel', qty: '100', unit: 'pcs', price: '3.10', total: '310.00' };
const up = D.fromValues(legacy);
eq('旧单证升级行数', up.length, 1);
eq('旧单证升级品名', up[0].name, 'LED Panel');
eq('旧单证升级数量', up[0].qty, 100);
eq('旧单证升级金额', up[0].amount, 310);
eq('空 values 无明细', D.fromValues({}).length, 0);

/* 3. 同步回写：首行兼容字段 + 合计 */
const v = {};
D.sync(v, [
  { name: 'A', qty: '2', unit: 'pcs', price: '10' },
  { name: 'B', qty: '3', unit: 'ctn', price: '5.5' }
]);
eq('首行回写品名', v.product, 'A');
eq('首行回写数量', v.qty, '2');
eq('首行回写单价', v.price, '10');
eq('合计金额', v.total, '36.50');
eq('明细保留两行', v.items.length, 2);

/* 4. 空行压缩；keepBlank 时保留 */
const v2 = {};
D.sync(v2, [{ name: 'A', qty: 1, price: 1 }, {}, { name: 'B', qty: 2, price: 2 }]);
eq('保存时空行被压掉', v2.items.length, 2);
eq('合计跳过空行', v2.total, '5.00');
const rows3 = [{}, { name: 'A', qty: 1, price: 1 }];
const v3 = {};
D.sync(v3, rows3, { keepBlank: true });
eq('编辑器保留空行', v3.items.length, 2);
eq('首行回写跳过空行', v3.product, 'A');

/* 5. 商品匹配：id 优先 / 名称唯一 / 同名用 SKU */
const products = [
  { id: 'p1', name: 'Lamp', sku: 'L-1', image: 'data:image/png;base64,AAA' },
  { id: 'p2', name: 'Panel', sku: 'P-1', image: 'https://x.test/a.png' },
  { id: 'p3', name: 'Panel', sku: 'P-2' }
];
eq('按 id 匹配', D.productFor({ productId: 'p1' }, products).id, 'p1');
eq('按唯一名称匹配', D.productFor({ name: 'lamp' }, products).id, 'p1');
eq('同名多款不猜', D.productFor({ name: 'Panel' }, products), null);
eq('同名用 SKU 消歧', D.productFor({ name: 'Panel', sku: 'P-2' }, products).id, 'p3');
eq('找不到返回 null', D.productFor({ name: 'Nope' }, products), null);
eq('解析 productId', D.resolveProductId({ name: 'Panel', sku: 'P-1' }, products), 'p2');

/* 6. 图片：沿用 FT.imgSrc 的白名单，没图返回空 */
const imgSrc = (v) => (/^https?:/.test(String(v || '')) ? String(v) : '');
eq('图片按商品读取', D.imageFor({ productId: 'p2' }, products, imgSrc), 'https://x.test/a.png');
eq('商品无图返回空', D.imageFor({ productId: 'p3' }, products, imgSrc), '');
eq('无法匹配返回空', D.imageFor({ name: 'Nope' }, products, imgSrc), '');

/* 7. 报价明细 → 单证明细 */
const qItems = [
  { name: 'Lamp', sku: 'L-1', spec: '5W', qty: 10, unit: 'pcs', unitPrice: 2, amount: 20 },
  { name: 'Panel', sku: 'P-1', spec: '60x60', qty: 4, unit: 'pcs', unitPrice: 9 }
];
const conv = D.fromQuoteItems(qItems, products);
eq('报价明细行数', conv.length, 2);
eq('报价明细补 productId', conv[0].productId, 'p1');
eq('报价明细 unitPrice 映射', conv[1].price, 9);
eq('报价明细缺 amount 自动算', conv[1].amount, 36);
eq('报价明细保留规格', conv[0].spec, '5W');

/* 8. 新建单据的图片默认值 */
ok('auto 下 PI 开', D.defaultShowImages('pi', 'auto') === true);
ok('auto 下 CI 关', D.defaultShowImages('ci', 'auto') === false);
ok('auto 下 PL 关', D.defaultShowImages('pl', 'auto') === false);
ok('on 全部开', D.defaultShowImages('ci', 'on') === true);
ok('off 全部关', D.defaultShowImages('pi', 'off') === false);
ok('未知模式按 auto', D.defaultShowImages('pi', 'x') === true);

/* 9. 非法/空数据不炸 */
eq('null 明细安全', D.fromValues(null).length, 0);
eq('null 合计为 0', D.sum(null), 0);
ok('空行判定', D.isBlankRow({ name: '', qty: '', price: '' }) === true);
ok('有 amount 不算空行', D.isBlankRow({ amount: 5 }) === false);

console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
