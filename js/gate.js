/* ============================================================
   FT Compass · Gate v1.0
   HUIDI Feature 6 + 7：
   - Formal Output Gate：打印/导出前必填校验 + Issue Navigator
   - CONFIDENTIAL：内部字段白名单，客户版纸面/Excel/打印永不带出
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Feature 7：CONFIDENTIAL 内部字段 ---------- */
  var CONFIDENTIAL_KEYS = [
    'internalNote',    // 内部备注
    'internalCost',    // 核算成本
    'internalMargin',  // 内部毛利率
    'factoryNote',     // 工厂执行备注
    'supplierNote',    // 供应商内部备注
    'costPrice',       // 成本价
    'aiCheck'          // AI 校验结果（内部）
  ];

  var CONFIDENTIAL_LABELS = {
    internalNote: '内部备注 Internal Note',
    internalCost: '核算成本 Cost (internal)',
    internalMargin: '内部毛利率 Margin (internal)',
    factoryNote: '工厂执行 Factory Note',
    supplierNote: '供应商备注 Supplier Note',
    costPrice: '成本价 Cost Price',
    aiCheck: 'AI 校验 AI Check'
  };

  function isConfidential(k) {
    return CONFIDENTIAL_KEYS.indexOf(k) >= 0;
  }

  /** 剔除内部字段 → 客户版输出用 */
  function strip(values) {
    var out = {};
    Object.keys(values || {}).forEach(function (k) {
      if (!isConfidential(k)) out[k] = values[k];
    });
    return out;
  }

  /** 仅取内部字段 → 内部视图/数据版用 */
  function pick(values) {
    var out = {};
    CONFIDENTIAL_KEYS.forEach(function (k) {
      if (values && Object.prototype.hasOwnProperty.call(values, k)) out[k] = values[k];
    });
    return out;
  }

  function hasAny(values) {
    return CONFIDENTIAL_KEYS.some(function (k) {
      var v = values && values[k];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  }

  function countFilled(values) {
    var n = 0;
    CONFIDENTIAL_KEYS.forEach(function (k) {
      var v = values && values[k];
      if (k === 'aiCheck') return; // 结构对象不计“填写”
      if (v !== undefined && v !== null && String(v).trim() !== '') n++;
    });
    return n;
  }

  /* ---------- Feature 6：Formal Output Gate ---------- */

  /** 单证校验：返回 issues [{k, msg, severity:'error'|'warn'}] */
  function checkDoc(def, values) {
    var issues = [];
    function err(k, msg) { issues.push({ k: k, msg: msg, severity: 'error' }); }
    function warn(k, msg) { issues.push({ k: k, msg: msg, severity: 'warn' }); }
    values = values || {};
    def = def || {};

    if (!String(values.no || '').trim()) err('no', '缺少单号 No.');
    if (!String(values.date || '').trim()) warn('date', '缺少日期 Date');
    if (!String(values.buyer || '').trim()) err('buyer', '缺少买方 Buyer');

    if (def.table !== false) {
      if (!String(values.product || '').trim()) err('product', '缺少品名 Product');
      if (!String(values.qty || '').trim()) warn('qty', '缺少数量 Qty');
      if (!String(values.price || '').trim()) warn('price', '缺少单价 Unit Price');
      if (!String(values.total || '').trim()) err('total', '缺少总金额 Total');
    }

    var q = parseFloat(values.qty);
    var p = parseFloat(values.price);
    var t = parseFloat(values.total);
    if (q > 0 && p > 0 && t > 0) {
      var expect = q * p;
      var tol = Math.max(0.01, Math.abs(t) * 0.005);
      if (Math.abs(expect - t) > tol) {
        warn('total', '总金额与 数量×单价 不一致（' + fmtNum(expect) + ' ≠ ' + fmtNum(t) + '）');
      }
    }
    return issues;
  }

  /** 报价校验 */
  function checkQuote(q) {
    var issues = [];
    function err(k, msg) { issues.push({ k: k, msg: msg, severity: 'error' }); }
    function warn(k, msg) { issues.push({ k: k, msg: msg, severity: 'warn' }); }
    q = q || {};

    if (!String(q.no || '').trim()) err('q_no', '缺少报价单号');
    if (!String(q.date || '').trim()) warn('q_date', '缺少日期');

    var items = q.items || [];
    if (!items.length) {
      err('itemsBody', '没有报价明细行');
    } else {
      items.forEach(function (it, i) {
        var no = i + 1;
        if (!String(it.name || '').trim()) err('itemsBody', '第 ' + no + ' 行缺品名');
        if (!(parseFloat(it.qty) > 0)) err('itemsBody', '第 ' + no + ' 行数量须 > 0');
        if (!(parseFloat(it.unitPrice) > 0)) err('itemsBody', '第 ' + no + ' 行单价须 > 0');
      });
      if (!(parseFloat(q.total) > 0)) err('totalCell', '合计金额须 > 0');
    }

    if (!String(q.leadName || '').trim() && !String(q.leadId || '').trim()) {
      warn('q_lead', '未关联客户/线索（建议补全）');
    }
    return issues;
  }

  function errorsOf(issues) {
    return (issues || []).filter(function (i) { return i.severity === 'error'; });
  }

  function warnsOf(issues) {
    return (issues || []).filter(function (i) { return i.severity === 'warn'; });
  }

  function passed(issues) {
    return errorsOf(issues).length === 0;
  }

  function fmtNum(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** Issue Navigator HTML：错误→阻断样式；warn→提醒；点击定位字段 */
  function navigatorHTML(issues) {
    issues = issues || [];
    if (!issues.length) {
      return '<div class="gate-nav gate-ok" style="margin-top:8px;padding:8px 10px;border:1px solid #86efac;border-radius:6px;background:#f0fdf4;font-size:12.5px;color:#166534">✅ 输出校验通过，可打印 / 导出</div>';
    }
    var errs = errorsOf(issues);
    var warns = warnsOf(issues);
    var head = errs.length
      ? '<b style="color:#991b1b">⛔ 输出校验未通过：' + errs.length + ' 个阻断项 / 共 ' + issues.length + ' 项</b>'
      : '<b style="color:#b45309">⚠️ 输出校验：' + warns.length + ' 个提醒项（不阻断）</b>';
    var list = issues.map(function (it) {
      var dot = it.severity === 'error' ? '🟥' : '🟨';
      var k = esc(it.k || '');
      return '<div class="gate-issue" data-gk="' + k + '" onclick="Gate.jump(\'' + k + '\')"'
        + ' style="cursor:pointer;padding:3px 0;font-size:12.5px;line-height:1.5">'
        + dot + ' ' + esc(it.msg)
        + ' <span style="color:#9aa5b1">→ 定位</span></div>';
    }).join('');
    var border = errs.length ? '#fca5a5' : '#fcd34d';
    var bg = errs.length ? '#fef2f2' : '#fffbeb';
    return '<div class="gate-nav" style="margin-top:8px;padding:8px 10px;border:1px solid ' + border
      + ';border-radius:6px;background:' + bg + '">' + head + list + '</div>';
  }

  /** 跳转到问题字段（data-k / id 双匹配） */
  function jump(k) {
    if (!k) return;
    var el = null;
    try {
      el = document.querySelector('[data-k="' + k + '"]')
        || document.getElementById(k)
        || document.querySelector('[data-gk-target="' + k + '"]');
    } catch (e) {}
    if (el) {
      try { el.focus({ preventScroll: true }); } catch (e2) { try { el.focus(); } catch (e3) {} }
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e4) { el.scrollIntoView(); }
    }
  }

  /**
   * 闸门：有 error 返回 false（并弹清单）；仅 warn 放行并提示。
   * 返回 {ok, issues, errs, warns}
   */
  function enforce(issues) {
    issues = issues || [];
    var errs = errorsOf(issues);
    var warns = warnsOf(issues);
    if (errs.length) {
      var msg = '输出校验未通过，先修复以下 ' + errs.length + ' 项：\n\n'
        + errs.map(function (e, i) { return (i + 1) + '. ' + e.msg; }).join('\n');
      if (warns.length) msg += '\n\n（另有 ' + warns.length + ' 项提醒，可稍后处理）';
      msg += '\n\n返回编辑器修复后重试。';
      alert(msg);
      return { ok: false, issues: issues, errs: errs, warns: warns };
    }
    return { ok: true, issues: issues, errs: errs, warns: warns };
  }

  global.Confidential = {
    KEYS: CONFIDENTIAL_KEYS,
    LABELS: CONFIDENTIAL_LABELS,
    is: isConfidential,
    strip: strip,
    pick: pick,
    hasAny: hasAny,
    countFilled: countFilled
  };

  global.Gate = {
    checkDoc: checkDoc,
    checkQuote: checkQuote,
    errorsOf: errorsOf,
    warnsOf: warnsOf,
    passed: passed,
    navigatorHTML: navigatorHTML,
    jump: jump,
    enforce: enforce
  };
})(window);
