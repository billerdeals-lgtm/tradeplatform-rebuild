/* ============================================================
   FT Compass · 报价定价公式（单一真源）
   ------------------------------------------------------------
   口径（2026-10-30 修正）：
   · FOB 只含货值 + 国内费用 + 报关/港杂，不含海运费、保险费；
   · 毛利率按售价：FOB = 出口成本 ÷ (1 − 佣金%) ÷ (1 − 毛利率%)；
     毛利率 30% 对应成本加成 42.9%，不是 ×1.3；
   · 佣金已计入 FOB，含佣价就是 FOB，不能再除一次 (1 − 佣金)；
   · CIF = FOB +（海运费 + 保险费）÷ 汇率，运保只出现一次；
   · 利润按「扣佣后卖家实收 − 出口成本」计算，运保是代收代付。
   由 tools/test-pricing.mjs 做回归测试，避免再次算错报价。
   ============================================================ */
(function (root) {
  'use strict';

  function priceQuote(o) {
    o = o || {};
    var cost = +o.cost || 0;
    var localShip = +o.localShip || 0;
    var packing = +o.packing || 0;
    var inspect = +o.inspect || 0;
    var other = +o.other || 0;
    var ocean = +o.ocean || 0;
    var insurance = +o.insurance || 0;
    var customs = +o.customs || 0;
    var portFee = +o.portFee || 0;
    var marginPct = +o.marginPct || 0;
    var commPct = +o.commPct || 0;
    var rate = +o.rate;
    var qty = +o.qty || 1;

    var unitCost = cost + localShip + packing + inspect + other;
    var costExFreight = unitCost + customs + portFee;
    var freightCNY = ocean + insurance;

    if (!isFinite(rate) || rate <= 0) return { ok: false, error: '汇率必须大于 0', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };
    if (marginPct < 0) return { ok: false, error: '毛利率不能为负数（当前 ' + marginPct + '%）', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };
    if (marginPct >= 100) return { ok: false, error: '毛利率必须小于 100%（当前 ' + marginPct + '%）', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };
    if (commPct < 0) return { ok: false, error: '佣金率不能为负数（当前 ' + commPct + '%）', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };
    if (commPct >= 100) return { ok: false, error: '佣金率必须小于 100%（当前 ' + commPct + '%）', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };
    if (costExFreight <= 0) return { ok: false, error: '请先填写采购成本（出口成本需大于 0）', unitCost: unitCost, costExFreight: costExFreight, freightCNY: freightCNY, qty: qty };

    var fobCNY = costExFreight / ((1 - commPct / 100) * (1 - marginPct / 100));
    var fob = fobCNY / rate;
    var cif = fob + freightCNY / rate;
    var commission = fob * commPct / 100;
    var netCNY = fobCNY * (1 - commPct / 100);
    var profitCNY = netCNY - costExFreight;

    return {
      ok: true,
      unitCost: unitCost,
      costExFreight: costExFreight,
      freightCNY: freightCNY,
      fobCNY: fobCNY,
      fob: fob,
      cif: cif,
      commission: commission,
      netCNY: netCNY,
      profitCNY: profitCNY,
      profit: profitCNY / rate,
      totalProfit: profitCNY / rate * qty,
      actualMargin: netCNY > 0 ? (profitCNY / netCNY * 100) : 0,
      markup: marginPct / (100 - marginPct) * 100,
      marginPct: marginPct,
      commPct: commPct,
      rate: rate,
      qty: qty
    };
  }

  root.FT = root.FT || {};
  root.FT.priceQuote = priceQuote;
  if (typeof module !== 'undefined' && module.exports) module.exports = priceQuote;
})(typeof window !== 'undefined' ? window : globalThis);
