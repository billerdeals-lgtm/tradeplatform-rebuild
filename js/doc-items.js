/* ============================================================
   FT Compass · 单据明细（多 SKU）纯逻辑
   ------------------------------------------------------------
   单证记录只存 productId，不复制商品图片。这里负责：
   - 新旧数据结构归一（items / 单行 product+qty+price）
   - 行金额、合计、首行回写 values
   - 商品唯一匹配（id 优先，名称+SKU 兜底）
   - 单据图片默认开关
   所有函数不碰 DOM / DataStore，便于单测。
   ============================================================ */
(function (global) {
  'use strict';

  function str(v) { return String(v == null ? '' : v).trim(); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function money(n) { return round2(n).toFixed(2); }
  function lower(v) { return str(v).toLowerCase(); }

  /** 单行金额：数量×单价优先；缺一项时回退到已保存的 amount */
  function lineAmount(row) {
    row = row || {};
    var q = num(row.qty), p = num(row.price);
    if (q > 0 && p > 0) return round2(q * p);
    if (row.amount != null && str(row.amount) !== '' && isFinite(Number(row.amount))) {
      return round2(Number(row.amount));
    }
    return round2(q * p);
  }

  function normalizeRow(r) {
    r = r || {};
    var qty = str(r.qty) === '' ? '' : num(r.qty);
    var price = str(r.price) === '' ? '' : num(r.price);
    return {
      productId: str(r.productId),
      name: str(r.name || r.product),
      sku: str(r.sku),
      spec: str(r.spec),
      qty: qty,
      unit: str(r.unit) || 'pcs',
      price: price,
      amount: lineAmount({ qty: qty, price: price, amount: r.amount })
    };
  }

  function isBlankRow(r) {
    r = r || {};
    return !str(r.productId) && !str(r.name) && !str(r.sku) && !str(r.spec)
      && !num(r.qty) && !num(r.price) && !num(r.amount);
  }

  function compact(rows) {
    return (rows || []).map(normalizeRow).filter(function (r) { return !isBlankRow(r); });
  }

  function sum(rows) {
    return round2((rows || []).reduce(function (acc, r) {
      return acc + (isBlankRow(r) ? 0 : lineAmount(r));
    }, 0));
  }

  /**
   * 读取明细：
   * - values.items 存在时直接用
   * - 否则把旧的单行字段升级成一行
   * keepBlank=true 用于编辑器，保留用户刚添加的空行
   */
  function fromValues(values, opts) {
    values = values || {};
    var keepBlank = !!(opts && opts.keepBlank);
    var out = [];
    if (Array.isArray(values.items) && values.items.length) {
      out = values.items.map(normalizeRow);
    } else if (str(values.product) || str(values.qty) || str(values.price) || str(values.total)) {
      out = [normalizeRow({
        productId: values.productId,
        name: values.product,
        qty: values.qty,
        unit: values.unit,
        price: values.price,
        amount: values.total
      })];
    }
    return keepBlank ? out : out.filter(function (r) { return !isBlankRow(r); });
  }

  /**
   * 明细回写 values：
   * - 首行同步到 product/qty/unit/price，兼容 Gate / Excel / 旧代码
   * - total 始终等于各行金额合计
   * keepBlank=true 时保留空行（编辑器需要），保存前用 false。
   */
  function sync(values, rows, opts) {
    values = values || {};
    var keepBlank = !!(opts && opts.keepBlank);
    var list = (rows || []).map(normalizeRow);
    if (!keepBlank) list = list.filter(function (r) { return !isBlankRow(r); });
    values.items = list;
    /* 首行回写时跳过空行：编辑器里空行可能排在真实行前面 */
    var first = list.filter(function (r) { return !isBlankRow(r); })[0] || {};
    values.product = first.name || '';
    values.qty = first.qty === '' ? '' : String(first.qty);
    values.unit = first.unit || '';
    values.price = first.price === '' ? '' : String(first.price);
    values.total = list.length ? money(sum(list)) : '';
    return values;
  }

  /** 商品：productId 优先；没有 id 时按名称完全一致 + SKU 唯一匹配 */
  function productFor(row, products) {
    var list = products || [];
    row = row || {};
    var pid = str(row.productId);
    if (pid) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === pid) return list[i];
      }
    }
    var name = lower(row.name);
    if (!name) return null;
    var hits = list.filter(function (p) { return lower(p.name) === name; });
    if (hits.length > 1) {
      var sku = lower(row.sku);
      if (sku) hits = hits.filter(function (p) { return lower(p.sku) === sku; });
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function resolveProductId(item, products) {
    var p = productFor(item || {}, products);
    return p ? String(p.id) : '';
  }

  /** 商品图片：只返回 FT.imgSrc 认可的地址；没图/坏图返回空 */
  function imageFor(row, products, imgSrc) {
    var p = productFor(row, products);
    if (!p || typeof imgSrc !== 'function') return '';
    return imgSrc(p.image) || '';
  }

  /** 报价明细 → 单证明细（补 productId） */
  function fromQuoteItems(items, products) {
    return compact((items || []).map(function (it) {
      return {
        productId: resolveProductId({
          productId: it.productId,
          name: it.name,
          sku: it.sku
        }, products),
        name: it.name,
        sku: it.sku,
        spec: it.spec,
        qty: it.qty,
        unit: it.unit,
        price: it.unitPrice != null ? it.unitPrice : it.price,
        amount: it.amount
      };
    }));
  }

  /**
   * 新建单据的图片开关：
   * auto = 按类型（PI 开，其余关）；on/off = 跟随 profile 全局默认。
   */
  function defaultShowImages(docId, mode) {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return str(docId) === 'pi';
  }

  var api = {
    str: str,
    num: num,
    round2: round2,
    money: money,
    lineAmount: lineAmount,
    normalizeRow: normalizeRow,
    isBlankRow: isBlankRow,
    compact: compact,
    sum: sum,
    fromValues: fromValues,
    sync: sync,
    productFor: productFor,
    resolveProductId: resolveProductId,
    imageFor: imageFor,
    fromQuoteItems: fromQuoteItems,
    defaultShowImages: defaultShowImages
  };

  global.DocItems = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
