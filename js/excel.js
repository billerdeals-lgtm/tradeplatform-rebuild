/* ============================================================
   FT Compass · Excel 导出 v1.0
   纯字符串生成 Excel 2003 SpreadsheetML（.xls），
   无第三方依赖，Excel / WPS / LibreOffice 均可打开。
   - 客户版：单 sheet，接近正式单据，可改数量
   - 数据版：多 sheet，给采购/财务/仓库
   ============================================================ */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cell(v) {
    if (typeof v === 'number' && isFinite(v)) {
      return '<Cell><Data ss:Type="Number">' + v + '</Data></Cell>';
    }
    return '<Cell><Data ss:Type="String">' + esc(v) + '</Data></Cell>';
  }

  function row(vals, opts) {
    opts = opts || {};
    var style = opts.style ? ' ss:StyleID="' + opts.style + '"' : '';
    return '<Row' + style + '>' + vals.map(function (v) {
      if (v && typeof v === 'object' && 'v' in v) {
        var st = v.style ? ' ss:StyleID="' + v.style + '"' : '';
        var n = typeof v.v === 'number' && isFinite(v.v);
        return '<Cell' + st + '><Data ss:Type="' + (n ? 'Number' : 'String') + '">' + esc(v.v) + '</Data></Cell>';
      }
      return cell(v);
    }).join('') + '</Row>';
  }

  function blankRow(h) {
    return '<Row ss:Height="' + (h || 8) + '"></Row>';
  }

  /** 组装 workbook XML；sheets: [{name, xmlRows, cols?}] */
  function workbookXML(sheets, opts) {
    opts = opts || {};
    var defaultW = opts.colWidth || 90;
    var body = sheets.map(function (s) {
      var cols = '';
      var n = s.cols || 8;
      for (var i = 1; i <= n; i++) {
        cols += '<Column ss:Width="' + (s.colWidth || defaultW) + '"/>';
      }
      return '<Worksheet ss:Name="' + esc(s.name) + '"><Table>'
        + cols + s.rows.join('') + '</Table></Worksheet>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>'
      + '<?mso-application progid="Excel.Sheet"?>'
      + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
      + ' xmlns:o="urn:schemas-microsoft-com:office:office"'
      + ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
      + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
      + '<Styles>'
      + '<Style ss:ID="Default" ss:Name="Normal">'
      + '<Alignment ss:Vertical="Center"/>'
      + '<Font ss:FontName="Calibri" ss:Size="11"/>'
      + '</Style>'
      + '<Style ss:ID="h1"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#084c38"/></Style>'
      + '<Style ss:ID="h2"><Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1"/></Style>'
      + '<Style ss:ID="lbl"><Font ss:Bold="1" ss:Color="#52606d"/></Style>'
      + '<Style ss:ID="th"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
      + '<Interior ss:Color="' + (opts.theme || '#0b6e4f') + '" ss:Pattern="Solid"/>'
      + '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'
      + '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>'
      + '<Style ss:ID="td"><Borders>'
      + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>'
      + '<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/>'
      + '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>'
      + '<Style ss:ID="total"><Font ss:Bold="1"/><Interior ss:Color="#dff2ea" ss:Pattern="Solid"/>'
      + '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
      + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>'
      + '<Style ss:ID="note"><Font ss:Color="#52606d" ss:Size="10"/></Style>'
      + '</Styles>'
      + body
      + '</Workbook>';
  }

  function download(filename, xml) {
    var blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function brandBlock(brand) {
    var rows = [];
    if (brand && (brand.logo || brand.sellerFull || brand.brandName)) {
      rows.push(row([{ v: brand.sellerFull || brand.brandName || '', style: 'h1' }]));
      if (brand.addr) rows.push(row([brand.addr]));
      if (brand.phone || brand.email || brand.website) {
        rows.push(row([['', brand.phone, brand.email, brand.website].filter(Boolean).join('  |  ')]));
      }
      if (brand.taxNo) rows.push(row(['Tax/VAT: ' + brand.taxNo]));
      rows.push(blankRow(6));
    }
    return rows;
  }

  var ExcelExport = {
    workbookXML: workbookXML,
    download: download,
    brandBlock: brandBlock,
    row: row,
    blankRow: blankRow,

    /**
     * 报价单「客户版」：单 sheet，近正式单据，客户可改 Qty
     * q: {no,date,leadName,leadCountry,payment,validity,portFrom,portTo,delivery,note,items[],currency,total}
     */
    quoteClient: function (q, brand) {
      var cur = q.currency || 'USD';
      var rows = brandBlock(brand);
      rows.push(row([{ v: 'QUOTATION 报价单', style: 'h1' }]));
      rows.push(blankRow(4));
      rows.push(row([{ v: 'Quotation No.', style: 'lbl' }, q.no || '', { v: 'Date', style: 'lbl' }, q.date || '']));
      rows.push(row([{ v: 'To (Customer)', style: 'lbl' }, q.leadName || '', { v: 'Country', style: 'lbl' }, q.leadCountry || '']));
      rows.push(blankRow(4));
      rows.push(row(['#', 'Product', 'Spec', 'Qty', 'Unit', 'Unit Price (' + cur + ')', 'Amount (' + cur + ')'], { style: 'th' }));
      (q.items || []).forEach(function (it, i) {
        rows.push(row([
          i + 1, it.name || '', it.spec || '',
          { v: Number(it.qty) || 0 }, it.unit || 'pcs',
          { v: Number(it.unitPrice) || 0 },
          { v: Number(it.amount) || 0 }
        ], { style: 'td' }));
        // 数量列用 num 样式更佳：简化处理，整行 td
      });
      rows.push(row(['', '', '', '', '', { v: 'TOTAL', style: 'total' }, { v: Number(q.total) || 0, style: 'total' }]));
      rows.push(blankRow(8));
      if (q.payment) rows.push(row(['Payment:', q.payment]));
      if (q.portFrom) rows.push(row(['Port of Loading:', q.portFrom]));
      if (q.portTo) rows.push(row(['Port of Discharge:', q.portTo]));
      if (q.delivery) rows.push(row(['Delivery:', q.delivery]));
      if (q.validity) rows.push(row(['Validity:', q.validity]));
      if (q.note) rows.push(row(['Note:', q.note]));
      rows.push(blankRow(12));
      rows.push(row([{ v: 'Seller / 卖方', style: 'h2' }, '', { v: 'Buyer / 买方', style: 'h2' }]));
      rows.push(row(['Signature & Stamp:', '', 'Signature:']));
      return download('Quotation_' + (q.no || 'draft') + '_客户版.xls',
        workbookXML([{ name: 'Quotation', rows: rows, cols: 7, colWidth: 95 }], { theme: brand && brand.brandColor }));
    },

    /**
     * 报价单「数据版」：多 sheet（报价头 / 明细 / 商品主数据 / 客户）
     */
    quoteData: function (q, brand, products) {
      var cur = q.currency || 'USD';

      // Sheet1 报价头
      var head = brandBlock(brand);
      head.push(row([{ v: '字段 Field', style: 'th' }, { v: '值 Value', style: 'th' }]));
      [
        ['Quote No', q.no || ''], ['Date', q.date || ''], ['Currency', cur],
        ['Customer', q.leadName || ''], ['Country', q.leadCountry || ''],
        ['Payment', q.payment || ''], ['Validity', q.validity || ''],
        ['Port of Loading', q.portFrom || ''], ['Port of Discharge', q.portTo || ''],
        ['Delivery', q.delivery || ''], ['Total', Number(q.total) || 0],
        ['Status', q.status || ''], ['Note', q.note || '']
      ].forEach(function (r) {
        head.push(row(r, { style: 'td' }));
      });

      // Sheet2 明细
      var det = [row(['Line', 'SKU', 'Product', 'Spec', 'Qty', 'Unit', 'UnitPrice', 'Amount', 'Currency'], { style: 'th' })];
      (q.items || []).forEach(function (it, i) {
        det.push(row([
          i + 1, it.sku || '', it.name || '', it.spec || '',
          { v: Number(it.qty) || 0 }, it.unit || 'pcs',
          { v: Number(it.unitPrice) || 0 }, { v: Number(it.amount) || 0 }, cur
        ], { style: 'td' }));
      });
      det.push(row(['', '', '', '', '', '', { v: 'TOTAL', style: 'total' }, { v: Number(q.total) || 0, style: 'total' }, cur]));

      // Sheet3 商品主数据（相关 SKU）
      var names = (q.items || []).map(function (i) { return i.name; });
      var skus = (q.items || []).map(function (i) { return i.sku; });
      var rel = (products || []).filter(function (p) {
        return names.indexOf(p.name) >= 0 || (p.sku && skus.indexOf(p.sku) >= 0);
      });
      if (!rel.length) rel = products || [];
      var prods = [row(['SKU', 'Name', 'Category', 'Spec', 'Unit', 'Price', 'Currency', 'MOQ', 'HS Code',
        'Qty/Ctn', 'N.W.', 'G.W.', 'CBM', 'Meas'], { style: 'th' })];
      rel.slice(0, 200).forEach(function (p) {
        prods.push(row([
          p.sku || '', p.name || '', p.category || '', p.spec || '', p.unit || 'pcs',
          { v: Number(p.price) || 0 }, p.currency || cur, { v: Number(p.moq) || 0 }, p.hsCode || '',
          { v: Number(p.perCtn) || 0 }, { v: Number(p.nw) || 0 }, { v: Number(p.gw) || 0 },
          { v: Number(p.cbm) || 0 }, p.meas || ''
        ], { style: 'td' }));
      });

      // Sheet4 客户
      var cust = [row(['Field', 'Value'], { style: 'th' })];
      [
        ['Name', q.leadName || ''], ['Country', q.leadCountry || ''],
        ['Email', q.leadEmail || ''], ['WhatsApp', q.leadWa || ''],
        ['Website', q.leadSite || '']
      ].forEach(function (r) { cust.push(row(r, { style: 'td' })); });

      return download('Quote_' + (q.no || 'draft') + '_数据版.xls', workbookXML([
        { name: '报价头', rows: head, cols: 4, colWidth: 110 },
        { name: '明细Items', rows: det, cols: 9, colWidth: 90 },
        { name: '商品主数据', rows: prods, cols: 14, colWidth: 80 },
        { name: '客户Customer', rows: cust, cols: 2, colWidth: 140 }
      ], { theme: brand && brand.brandColor }));
    },

    /**
     * 单证「客户版」：当前 values + 单证标题
     */
    docClient: function (def, values, brand) {
      var rows = brandBlock(brand);
      rows.push(row([{ v: def.title, style: 'h1' }]));
      rows.push(blankRow(4));
      rows.push(row([{ v: 'No.', style: 'lbl' }, values.no || '', { v: 'Date', style: 'lbl' }, values.date || '']));
      rows.push(row([{ v: 'Seller', style: 'lbl' }, brand && brand.sellerFull || values.seller || '',
        { v: 'Buyer', style: 'lbl' }, values.buyer || '']));
      rows.push(row([{ v: 'Seller Addr', style: 'lbl' }, brand && brand.addr || values.sellerAddr || '',
        { v: 'Buyer Addr', style: 'lbl' }, values.buyerAddr || '']));
      rows.push(blankRow(4));
      rows.push(row(['Description', 'Qty', 'Unit Price', 'Amount'], { style: 'th' }));
      rows.push(row([
        values.product || '',
        (values.qty || '') + ' ' + (values.unit || ''),
        (values.currency || '') + ' ' + (values.price || ''),
        (values.currency || '') + ' ' + (values.total || '')
      ], { style: 'td' }));
      rows.push(blankRow(8));
      ['payment', 'portFrom', 'portTo', 'delivery', 'bank', 'remark'].forEach(function (k) {
        if (values[k]) rows.push(row([k + ':', values[k]], { style: 'note' }));
      });
      rows.push(blankRow(12));
      rows.push(row([{ v: 'Seller Signature/Stamp', style: 'h2' }, '', { v: 'Buyer Signature', style: 'h2' }]));
      return download((def.id || 'doc') + '_' + (values.no || 'draft') + '_客户版.xls',
        workbookXML([{ name: 'Document', rows: rows, cols: 4, colWidth: 120 }], { theme: brand && brand.brandColor }));
    },

    /**
     * 商品库导出（数据版全量）
     */
    products: function (list, brand) {
      var rows = [row(['SKU', 'Name', 'Category', 'Spec', 'Unit', 'Price', 'Currency', 'MOQ', 'HS Code',
        'Supplier', 'Qty/Ctn', 'N.W.', 'G.W.', 'CBM', 'Meas', 'Mark', 'Notes'], { style: 'th' })];
      (list || []).forEach(function (p) {
        rows.push(row([
          p.sku || '', p.name || '', p.category || '', p.spec || '', p.unit || 'pcs',
          { v: Number(p.price) || 0 }, p.currency || 'USD', { v: Number(p.moq) || 0 },
          p.hsCode || '', p.supplier || '', { v: Number(p.perCtn) || 0 },
          { v: Number(p.nw) || 0 }, { v: Number(p.gw) || 0 }, { v: Number(p.cbm) || 0 },
          p.meas || '', p.mark || '', p.notes || ''
        ], { style: 'td' }));
      });
      return download('Products_商品库_数据版.xls',
        workbookXML([{ name: 'Products', rows: rows, cols: 17, colWidth: 75 }], { theme: brand && brand.brandColor }));
    }
  };

  global.ExcelExport = ExcelExport;
})(window);
