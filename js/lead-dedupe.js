/* ============================================================
   LeadDedupe · 手工录入线索的模糊查重
   ------------------------------------------------------------
   CSV 导入用的是精确键（邮箱 / WhatsApp / 名称+国家），手工录入
   没有这一步，容易把同一个客户录两遍。这里按「名称 + 域名」做
   宽匹配，只在保存前提示，不阻断：
   - 名称：忽略大小写、标点、公司后缀（Ltd / GmbH / 有限公司…）
   - 名称：完全相同 / 包含 / 编辑距离相近
   - 域名：网站域名或企业邮箱域名相同；gmail/qq/163 等公共邮箱跳过
   - 邮箱完全相同（额外兜底）
   命中后由调用方 confirm：取消 = 返回修改，确定 = 强行保存。
   ============================================================ */
(function (global) {
  'use strict';

  /* 公共邮箱域名：同一个 gmail 不代表同一个客户，不能当域名命中 */
  var GENERIC_DOMAINS = {
    'gmail.com': 1, 'googlemail.com': 1,
    'yahoo.com': 1, 'yahoo.co.uk': 1, 'yahoo.fr': 1, 'yahoo.de': 1, 'yahoo.co.jp': 1,
    'hotmail.com': 1, 'hotmail.fr': 1, 'hotmail.co.uk': 1, 'hotmail.de': 1,
    'outlook.com': 1, 'outlook.fr': 1, 'live.com': 1, 'live.cn': 1, 'msn.com': 1,
    'icloud.com': 1, 'me.com': 1, 'aol.com': 1, 'protonmail.com': 1, 'proton.me': 1,
    'gmx.com': 1, 'gmx.de': 1, 'mail.com': 1, 'web.de': 1, 't-online.de': 1,
    'yandex.ru': 1, 'yandex.com': 1, 'mail.ru': 1, 'bk.ru': 1, 'list.ru': 1, 'inbox.ru': 1,
    'qq.com': 1, 'foxmail.com': 1, '163.com': 1, '126.com': 1, 'yeah.net': 1,
    'sina.com': 1, 'sina.cn': 1, 'sohu.com': 1, 'aliyun.com': 1, '139.com': 1,
    'orange.fr': 1, 'wanadoo.fr': 1, 'free.fr': 1, 'laposte.net': 1,
    'libero.it': 1, 'virgilio.it': 1, 'tin.it': 1,
    'terra.com.br': 1, 'uol.com.br': 1, 'bol.com.br': 1, 'ig.com.br': 1,
    'rediffmail.com': 1, 'sbcglobal.net': 1, 'comcast.net': 1, 'verizon.net': 1
  };

  /* 公司后缀：归一化时去掉，避免 "Acme Ltd." 和 "Acme" 被当成两家 */
  var LEGAL_WORDS = /\b(?:co|company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|plc|gmbh|ag|sa|sas|sarl|srl|spa|bv|nv|pte|pvt|trading|trade|import|imports|export|exports|group|holding|holdings|enterprise|enterprises|international|intl|industries|industrial)\b/g;
  var CN_LEGAL = /(有限责任公司|股份有限公司|有限公司|进出口|贸易|商贸|实业|集团|控股|科技|股份|公司)/g;

  function text(v) { return v == null ? '' : String(v); }

  /* 只做字符级归一化，不删公司后缀 */
  function baseName(v) {
    var s = text(v).toLowerCase().trim();
    if (!s) return '';
    s = s.replace(/\u00a0/g, ' ');
    s = s.replace(CN_LEGAL, ' ');
    s = s.replace(/&/g, ' and ');
    s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }

  /* 名称归一化：大小写 / 标点 / & / 中英文公司后缀 */
  function normName(v) {
    var base = baseName(v);
    if (!base) return '';
    var stripped = base.replace(LEGAL_WORDS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^and\s+/, '')
      .replace(/\s+and$/, '')
      .trim();
    return stripped || base;
  }

  function domainFromUrl(v) {
    var s = text(v).trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
    s = s.split(/[\/?#]/)[0].replace(/:\d+$/, '');
    var at = s.lastIndexOf('@');
    if (at >= 0) s = s.slice(at + 1);
    s = s.replace(/^\.+|\.+$/g, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return '';
    return s;
  }

  /* 取可注册域名：mail.acme.com / acme.com.cn → acme.com / acme.com.cn */
  function registrable(d) {
    var p = text(d).toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (p.length <= 2) return p.join('.');
    var last2 = p.slice(-2).join('.');
    if (/^(?:co|com|net|org|gov|edu|ac|or|ne|go|gob|mil|sch)\.[a-z]{2}$/.test(last2)) {
      return p.slice(-3).join('.');
    }
    return last2;
  }

  function emailDomain(v) {
    var s = text(v).trim().toLowerCase();
    var at = s.lastIndexOf('@');
    if (at < 0) return '';
    var d = domainFromUrl(s.slice(at + 1));
    if (!d || GENERIC_DOMAINS[d] || GENERIC_DOMAINS[registrable(d)]) return '';
    return d;
  }

  /* 线索域名：优先网站，其次企业邮箱 */
  function leadDomain(l) {
    l = l || {};
    var d = domainFromUrl(l.website || l.site || l.domain || l.url || '');
    if (d && !GENERIC_DOMAINS[d] && !GENERIC_DOMAINS[registrable(d)]) return d;
    return emailDomain(l.email);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j, tmp;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  /* 短名必须是完整词/完整中文片段，避免 "global" 命中 "global tech" 里的片段 */
  function containsName(longer, shorter) {
    if (!longer || !shorter) return false;
    if (/[\u4e00-\u9fa5]/.test(shorter)) return longer.indexOf(shorter) >= 0;
    return (' ' + longer + ' ').indexOf(' ' + shorter + ' ') >= 0;
  }

  /* 名称相似度：0 = 不像，100 = 完全一致 */
  function nameScore(a, b) {
    a = normName(a);
    b = normName(b);
    if (!a || !b) return 0;
    if (a === b) return 100;
    var min = Math.min(a.length, b.length);
    if (min >= 4 && (containsName(a, b) || containsName(b, a))) return 84;
    if (min < 6) return 0;
    var sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    if (sim >= 0.92) return 88;
    if (sim >= 0.84) return 76;
    if (sim >= 0.76 && min >= 10) return 66;
    return 0;
  }

  function scorePair(lead, candidate) {
    var reasons = [], score = 0;
    var ns = nameScore(lead.name, candidate.name);
    if (ns >= 100) {
      reasons.push('名称完全相同');
      score = Math.max(score, 100);
    } else if (ns >= 84) {
      reasons.push('名称高度相似');
      score = Math.max(score, 88);
    } else if (ns >= 64) {
      reasons.push('名称相似');
      score = Math.max(score, 70);
    }

    var ld = leadDomain(lead);
    var cd = leadDomain(candidate);
    if (ld && cd && registrable(ld) === registrable(cd)) {
      reasons.push('网站/邮箱域名相同（' + registrable(cd) + '）');
      score = Math.max(score, 95);
    }

    var le = text(lead.email).trim().toLowerCase();
    var ce = text(candidate.email).trim().toLowerCase();
    if (le && ce && le === ce) {
      reasons.push('邮箱相同');
      score = Math.max(score, 95);
    }

    return { score: score, reasons: reasons };
  }

  /**
   * 查重入口。
   * @param {Array} leads 现有线索
   * @param {Object} candidate 待保存的线索（至少 name）
   * @param {string} [excludeId] 编辑时排除自己
   * @returns {Array<{lead, score, reasons}>} 按可信度从高到低
   */
  function find(leads, candidate, excludeId) {
    if (!candidate) return [];
    var out = [];
    (leads || []).forEach(function (l) {
      if (!l) return;
      if (excludeId && l.id === excludeId) return;
      var r = scorePair(l, candidate);
      if (r.reasons.length) out.push({ lead: l, score: r.score, reasons: r.reasons });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  global.LeadDedupe = {
    normName: normName,
    domainFromUrl: domainFromUrl,
    registrable: registrable,
    emailDomain: emailDomain,
    leadDomain: leadDomain,
    nameScore: nameScore,
    find: find
  };
})(typeof window !== 'undefined' ? window : this);
