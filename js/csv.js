/* ============================================================
   FT Compass · CSV v1.0
   客户名单导入/导出的唯一真源（无第三方依赖）：
   - RFC4180 解析：引号、转义引号、字段内换行、CRLF
   - 分隔符自动识别：逗号 / 分号 / Tab
   - 编码识别：UTF-8(BOM) / UTF-16 / UTF-8 / GB18030
   - 表头别名映射：中英文常见叫法
   - 行级清洗：金额、日期、电话、阶段、去重键
   - 导出防公式注入（= + - @ 开头加制表符）
   ============================================================ */
(function (global) {
  'use strict';

  var STAGES = ['待开发', '已联系', '试样', '报价', '成交'];
  var STAGE_ALIAS = {
    '待开发': '待开发', '新线索': '待开发', '未联系': '待开发', 'new': '待开发', 'lead': '待开发',
    '已联系': '已联系', '联系中': '已联系', 'contacted': '已联系', 'contacting': '已联系',
    '试样': '试样', '打样': '试样', '样品': '试样', 'sample': '试样', 'sampling': '试样',
    '报价': '报价', '已报价': '报价', 'quoted': '报价', 'quote': '报价', 'quotation': '报价',
    '成交': '成交', '已成交': '成交', 'won': '成交', 'closed': '成交', 'deal': '成交'
  };

  /* 表头别名：顺序有意义，先匹配到的字段先占位 */
  var ALIASES = {
    name: ['name', 'company', 'companyname', 'customername', 'customer', 'buyer', 'client',
      'nameofcompany', 'accountname', 'organization', 'organisation', 'firm',
      '客户', '客户名', '客户名称', '公司', '公司名', '公司名称', '企业', '企业名称', '买家', '买方',
      /* 外部表格（阿里国际站/展会名录/海关数据）常见的公司名列叫法 */
      '公司英文名', '公司中文名', '英文名', '中文名', '客户公司', '公司全称', '企业名', '企业全称',
      '单位名称', '商户名称', '客户公司名', '公司简称', 'buyercompany', 'companyenglishname'],
    country: ['country', 'nation', '国家', '国家地区', '所在国家', '地区'],
    market: ['market', 'region', '市场', '区域', '目标市场'],
    stage: ['stage', 'status', '阶段', '状态', '进度', '客户阶段'],
    wa: ['wa', 'whatsapp', 'phone', 'tel', 'telephone', 'mobile', 'contact', 'contactno',
      '电话', '手机', '手机号', '联系电话', '联系方式', 'whatsapp号', 'whatsapp号码'],
    email: ['email', 'mail', 'e-mail', 'emailaddress', '邮箱', '电子邮箱', '邮件', '电子邮件'],
    product: ['product', 'products', 'item', 'interestedproduct', '主营产品', '产品', '采购产品',
      '感兴趣产品', '意向产品'],
    amount: ['amount', 'value', 'estimatedamount', 'estimatedvalue', 'budget', '预估金额', '金额',
      '预估', '预估美元', '预估usd', '预估金额usd', '订单金额', '预计金额', '预算'],
    last: ['last', 'lastcontact', 'lastcontacted', 'lastfollowup', '最后联系', '最近联系',
      '最后跟进', '最近跟进', '最后沟通'],
    note: ['note', 'notes', 'remark', 'remarks', 'comment', '备注', '说明', '描述'],
    nextAction: ['nextaction', 'next', 'nextstep', 'todo', '下一步', '下一步动作', '跟进动作', '待办'],
    score: ['score', 'aiscore', 'rating', 'ai评分', '评分', '意向分', '意向评分']
  };

  function normHeader(s) {
    return String(s == null ? '' : s).toLowerCase()
      /* 先去掉括号里的单位说明：预估金额(USD) → 预估金额 */
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/[\s_\-()（）\[\]【】:：./\\|]+/g, '')
      .replace(/["'`]/g, '');
  }

  /* ---------- 编码 ---------- */
  function decode(buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 (BOM)' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE' };
    }
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
    } catch (e) {
      try {
        return { text: new TextDecoder('gb18030').decode(bytes), encoding: 'GBK/GB18030' };
      } catch (e2) {
        return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'UTF-8（含替换字符）' };
      }
    }
  }

  /* ---------- XLSX（无第三方依赖） ----------
     Excel 的 .xlsx 本质是 zip + XML。这里只读取第一个工作表：
     - zip 中央目录定位条目，stored / deflate-raw 两种压缩方式
     - sharedStrings.xml 共享字符串 + inlineStr + 数字/布尔
     - 旧浏览器没有 DecompressionStream 时给出明确提示，不静默失败 */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function zipEntries(bytes) {
    var eocd = -1;
    var min = Math.max(0, bytes.length - 22 - 65535);
    for (var i = bytes.length - 22; i >= min; i--) {
      if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 .xlsx 文件（缺少 ZIP 目录）');
    var count = u16(bytes, eocd + 10);
    var p = u32(bytes, eocd + 16);
    var entries = {};
    for (var n = 0; n < count; n++) {
      if (u32(bytes, p) !== 0x02014b50) break;
      var nameLen = u16(bytes, p + 28);
      var extraLen = u16(bytes, p + 30);
      var commentLen = u16(bytes, p + 32);
      var name = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries[name] = {
        method: u16(bytes, p + 10),
        size: u32(bytes, p + 20),
        offset: u32(bytes, p + 42)
      };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持直接读取 .xlsx，请在 Excel/WPS 中另存为 CSV 后再导入');
    }
    var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function zipText(bytes, entries, name) {
    var e = entries[name];
    if (!e) return '';
    var nlen = u16(bytes, e.offset + 26);
    var elen = u16(bytes, e.offset + 28);
    var start = e.offset + 30 + nlen + elen;
    var raw = bytes.subarray(start, start + e.size);
    var out = e.method === 0 ? raw : await inflateRaw(raw);
    return new TextDecoder('utf-8').decode(out);
  }

  function xmlUnescape(s) {
    return String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, k) {
      var key = k.toLowerCase();
      if (key === 'amp') return '&';
      if (key === 'lt') return '<';
      if (key === 'gt') return '>';
      if (key === 'quot') return '"';
      if (key === 'apos') return "'";
      var code = key.charAt(0) === '#' ? (key.charAt(1) === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)) : NaN;
      try { return isFinite(code) ? String.fromCodePoint(code) : m; } catch (e) { return m; }
    });
  }
  function xmlText(inner) {
    return xmlUnescape(String(inner || '').replace(/<[^>]*>/g, '')).trim();
  }
  function xmlAll(inner, tag) {
    var re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'g');
    var out = [], m;
    while ((m = re.exec(inner))) out.push(m[1]);
    return out;
  }
  function xmlAttr(attrs, key) {
    var m = new RegExp('\\b' + key + '\\s*=\\s*"([^"]*)"', 'i').exec(attrs || '');
    return m ? xmlUnescape(m[1]) : '';
  }
  function colIndex(ref) {
    var m = /^([A-Z]+)/i.exec(String(ref || ''));
    if (!m) return -1;
    var s = m[1].toUpperCase(), n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  /** 读取 .xlsx → 二维数组（第一行是表头），无第三方依赖 */
  async function readXlsx(input, maxRows) {
    var limit = maxRows && maxRows > 0 ? maxRows : 200000;
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
      throw new Error('不是有效的 .xlsx 文件（ZIP 头不正确）');
    }
    var entries = zipEntries(bytes);
    var sheetName = '';
    /* 优先按 workbook 的第一张表取路径，而不是假定 sheet1.xml */
    try {
      var wbXml = await zipText(bytes, entries, 'xl/workbook.xml');
      var relsXml = await zipText(bytes, entries, 'xl/_rels/workbook.xml.rels');
      var sheetTag = (/<sheet\b[^>]*>/i.exec(wbXml) || [])[0] || '';
      var rid = xmlAttr(sheetTag, 'r:id') || xmlAttr(sheetTag, 'id');
      if (rid) {
        var relRe = /<Relationship\b[^>]*\/?>/gi, relM;
        while ((relM = relRe.exec(relsXml))) {
          if (xmlAttr(relM[0], 'Id') === rid) {
            var target = xmlAttr(relM[0], 'Target').replace(/^\.?\//, '');
            if (target && !/^xl\//i.test(target)) target = 'xl/' + target;
            if (entries[target]) sheetName = target;
            break;
          }
        }
      }
    } catch (e) { /* 解析 workbook 失败时退回扫描 worksheets */ }
    if (!sheetName) {
      Object.keys(entries).forEach(function (n) {
        if (!sheetName && /^xl\/worksheets\/sheet\d+\.xml$/i.test(n)) sheetName = n;
      });
    }
    if (!sheetName) throw new Error('这个 .xlsx 里没有找到工作表');
    var sharedXml = await zipText(bytes, entries, 'xl/sharedStrings.xml');
    var sheetXml = await zipText(bytes, entries, sheetName);

    var shared = xmlAll(sharedXml, 'si').map(function (si) {
      return xmlAll(si, 't').map(xmlText).join('');
    });

    var rows = [];
    var rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g, rm;
    while ((rm = rowRe.exec(sheetXml))) {
      if (rows.length >= limit) break;
      var row = [], next = 0;
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
      while ((cm = cellRe.exec(rm[1]))) {
        var attrs = cm[1] || '';
        var inner = cm[2] || '';
        var type = xmlAttr(attrs, 't');
        var ref = xmlAttr(attrs, 'r');
        var idx = ref ? colIndex(ref) : next;
        if (idx < 0) idx = next;
        next = idx + 1;
        var vRaw = xmlAll(inner, 'v')[0];
        var v = vRaw == null ? '' : xmlText(vRaw);
        var val = '';
        if (type === 's') {
          var si = parseInt(v, 10);
          val = isFinite(si) && shared[si] != null ? shared[si] : '';
        } else if (type === 'inlineStr') {
          val = xmlAll(inner, 't').map(xmlText).join('');
        } else if (type === 'b') {
          val = v === '1' ? 'TRUE' : (v === '0' ? 'FALSE' : '');
        } else if (type === 'str' || type === 'e') {
          val = v;
        } else {
          val = v;
        }
        while (row.length < idx) row.push('');
        row[idx] = val;
      }
      while (row.length && String(row[row.length - 1]).trim() === '') row.pop();
      if (row.some(function (c) { return String(c).trim() !== ''; })) rows.push(row);
    }
    return rows;
  }

  /* ---------- 分隔符 ---------- */
  function detectDelimiter(text) {
    var sample = String(text || '').split(/\n/).slice(0, 8).join('\n');
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQ = false;
    for (var i = 0; i < sample.length; i++) {
      var ch = sample.charAt(i);
      if (ch === '"') {
        if (inQ && sample.charAt(i + 1) === '"') { i++; continue; }
        inQ = !inQ;
      } else if (!inQ && counts[ch] != null) {
        counts[ch]++;
      }
    }
    var best = ',', n = counts[','];
    [';', '\t'].forEach(function (d) { if (counts[d] > n) { best = d; n = counts[d]; } });
    return best;
  }

  /* ---------- 解析 ---------- */
  function parse(text, delimiter) {
    var src = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var d = delimiter || detectDelimiter(src);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < src.length; i++) {
      var ch = src.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (src.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQ = false;
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"' && field.trim() === '') { field = ''; inQ = true; continue; }
      if (ch === d) { row.push(field); field = ''; continue; }
      if (ch === '\n') {
        row.push(field); rows.push(row);
        row = []; field = '';
        continue;
      }
      field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (c) { return String(c).trim() !== ''; });
    });
  }

  /* ---------- 表头映射 ---------- */
  function detectMapping(header) {
    var map = {};
    var usedCols = {};
    (header || []).forEach(function (h, idx) {
      var n = normHeader(h);
      if (!n) return;
      Object.keys(ALIASES).forEach(function (field) {
        if (map[field] != null || usedCols[idx]) return;
        if (ALIASES[field].some(function (a) { return normHeader(a) === n; })) {
          map[field] = idx;
          usedCols[idx] = true;
        }
      });
    });
    return map;
  }

  /* 客户 Excel 常见「第 1 行大标题、第 2 行才是表头」：
     扫描前 N 行，取识别字段最多的一行作为表头。 */
  function findHeaderRow(rows, maxScan) {
    var best = 0, bestCount = 0;
    var n = Math.min((rows || []).length, maxScan || 10);
    for (var i = 0; i < n; i++) {
      var m = detectMapping(rows[i]);
      var c = Object.keys(m).length;
      if (c > bestCount) { bestCount = c; best = i; }
    }
    return { index: best, mapping: detectMapping(rows[best] || []), count: bestCount };
  }

  /* ---------- 值清洗 ---------- */
  function text(v) { return String(v == null ? '' : v).replace(/\u00a0/g, ' ').trim(); }

  function amount(v) {
    var raw = text(v);
    if (!raw) return 0;
    var s = raw.replace(/[^\d.,\-]/g, '');
    if (!s || s === '-' || s === '.' || s === ',') return 0;
    var lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      /* 1.234,56（欧陆）与 1,234.56（英美）都按“最后出现的符号是小数点”处理 */
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma >= 0) {
      var parts = s.split(',');
      s = (parts.length === 2 && parts[1].length <= 2) ? parts[0] + '.' + parts[1] : s.replace(/,/g, '');
    }
    var n = Number(s);
    return isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
  }

  function score(v) {
    var s = text(v);
    if (!s) return null;
    var n = parseFloat(s.replace(/[^\d.\-]/g, ''));
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function date(v) {
    var s = text(v);
    if (!s) return '';
    var m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    m = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(s);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    /* Excel 日期单元格在 .xlsx 里是 1900 起的序列号（20000~80000 覆盖 1954~2119） */
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      var serial = Number(s);
      if (serial >= 20000 && serial <= 80000) {
        var ed = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
        return ed.getUTCFullYear() + '-' + pad2(ed.getUTCMonth() + 1) + '-' + pad2(ed.getUTCDate());
      }
    }
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return '';
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function phone(v) {
    var s = text(v);
    if (!s) return '';
    /* Excel 常见的 ="..." 包装与前置单引号 */
    var wrapped = /^="([\s\S]*)"$/.exec(s);
    if (wrapped) s = wrapped[1].trim();
    s = s.replace(/^'+/, '');
    /* Excel 常把长号码变成 2.01012E+10：尽量还原，超出安全位数则保留原文 */
    if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) {
      var n = Number(s);
      if (isFinite(n) && n > 0) {
        var digits = n.toFixed(0);
        if (digits.length <= 15) return digits;
      }
      return s;
    }
    return s;
  }

  function stage(v) {
    var s = text(v);
    if (!s) return '待开发';
    if (STAGES.indexOf(s) >= 0) return s;
    var k = s.toLowerCase();
    if (STAGE_ALIAS[k]) return STAGE_ALIAS[k];
    /* 子串匹配只用于中文别名：英文 key 容易误伤（如 renewed 含 new） */
    for (var cn in STAGE_ALIAS) {
      if (STAGE_ALIAS.hasOwnProperty(cn) && /[\u4e00-\u9fa5]/.test(cn) && s.indexOf(cn) >= 0) return STAGE_ALIAS[cn];
    }
    return '待开发';
  }

  function dedupeKey(l) {
    var email = text(l && l.email).toLowerCase();
    if (email) return 'e:' + email;
    var wa = text(l && l.wa).replace(/[^\d]/g, '');
    if (wa.length >= 6) return 'w:' + wa;
    var name = text(l && l.name).toLowerCase().replace(/\s+/g, ' ');
    var country = text(l && l.country).toLowerCase();
    return name ? 'n:' + name + '|' + country : '';
  }

  /* 把二维表转成线索记录；返回 {records, errors, invalid, duplicateInFile} */
  function toLeads(rows, mapping, opts) {
    opts = opts || {};
    var map = mapping || {};
    if (map.name == null) {
      return { records: [], errors: [{ row: 0, msg: '没有找到「客户名/公司名」列' }], invalid: 0, duplicateInFile: 0 };
    }
    var out = [], errors = [], invalid = 0, dup = 0, seen = {}, headerRow = opts.headerRow || 0;
    (rows || []).forEach(function (r, i) {
      var rowNo = i + 2 + headerRow; // 表头占第 1 行
      function cell(field) { return map[field] == null ? '' : (r[map[field]] == null ? '' : r[map[field]]); }
      var rec = {
        name: text(cell('name')),
        country: text(cell('country')),
        market: text(cell('market')),
        stage: stage(cell('stage')),
        wa: phone(cell('wa')),
        email: text(cell('email')).toLowerCase(),
        product: text(cell('product')),
        amount: amount(cell('amount')),
        last: date(cell('last')),
        note: text(cell('note')),
        nextAction: text(cell('nextAction')),
        score: score(cell('score'))
      };
      if (!rec.name) { invalid++; if (errors.length < 8) errors.push({ row: rowNo, msg: '客户名为空，已跳过' }); return; }
      if (rec.name.length > 120) rec.name = rec.name.slice(0, 120);
      /* 文件内重复只统计、不丢弃：用户可能选择「全部导入」 */
      var key = dedupeKey(rec);
      if (key) {
        if (seen[key]) dup++;
        else seen[key] = true;
      }
      out.push(rec);
    });
    return { records: out, errors: errors, invalid: invalid, duplicateInFile: dup };
  }

  /* ---------- 导出 ---------- */
  /* 防 CSV 公式注入：= + - @ 开头加制表符，Excel 不会当公式执行，再导入时 trim 掉 */
  function guard(v) {
    var s = String(v == null ? '' : v);
    /* 公式注入：Excel 会把以 = + - @ 开头的单元格当公式；前置制表符可阻断。
       允许有前导空白，避免 “  =cmd” 绕过。 */
    if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = '\t' + s;
    return s;
  }
  function cell(v) {
    return '"' + guard(v).replace(/"/g, '""') + '"';
  }
  function row(values) {
    return (values || []).map(cell).join(',');
  }
  function build(rows) {
    return '\ufeff' + (rows || []).map(row).join('\r\n');
  }
  function template() {
    return build([
      ['客户名', '国家', '市场', '阶段', 'WhatsApp', '邮箱', '产品', '预估USD', '最后联系', '备注', 'AI评分', 'AI下一步'],
      ['Example Importer Ltd', 'Egypt', '中东', '待开发', '+20101234567', 'buyer@example.com', 'prayer pillow', '2400', '2026-11-01', '展会名片（示例行，导入前请删除）', '', '']
    ]);
  }

  global.FTCsv = {
    STAGES: STAGES,
    decode: decode,
    readXlsx: readXlsx,
    detectDelimiter: detectDelimiter,
    parse: parse,
    detectMapping: detectMapping,
    findHeaderRow: findHeaderRow,
    toLeads: toLeads,
    dedupeKey: dedupeKey,
    amount: amount,
    score: score,
    date: date,
    phone: phone,
    stage: stage,
    template: template,
    build: build,
    cell: cell,
    row: row
  };
})(window);
