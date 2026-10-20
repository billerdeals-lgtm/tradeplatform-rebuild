/* ============================================================
   FT Compass · Sources v1.0
   多源客户挖掘连接器（纯静态站，无后端）
   - 统一代理层：r.jina.ai（markdown）→ allorigins（HTML）回退
   - 连接器注册表 Sources.META（UI 用）+ Sources.run(id, ctx)
   - 统一链接解析 / 联系方式提取 / 域名工具
   现实约束：领英/Apollo 无法直连，改用搜索引擎反查；目录站尽力而为。
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 1. 代理层 ---------- */
  async function fetchJina(url, timeout) {
    var r = await fetch('https://r.jina.ai/' + url, { signal: AbortSignal.timeout(timeout || 25000) });
    if (!r.ok) throw new Error('jina HTTP ' + r.status);
    var t = await r.text();
    if (!t || t.length < 120) throw new Error('jina 内容过短');
    return { text: t, html: false };
  }
  async function fetchAllOrigins(url, timeout) {
    var r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      { signal: AbortSignal.timeout(timeout || 25000) });
    if (!r.ok) throw new Error('allorigins HTTP ' + r.status);
    var t = await r.text();
    if (!t || t.length < 120) throw new Error('allorigins 内容过短');
    return { text: t, html: true };
  }
  /** 依次尝试多个代理，返回 {text, html} */
  async function fetchRaw(url, timeout) {
    var errs = [];
    try { return await fetchJina(url, timeout); } catch (e) { errs.push('jina:' + e.message); }
    try { return await fetchAllOrigins(url, timeout); } catch (e) { errs.push('allorigins:' + e.message); }
    throw new Error(errs.join(' | '));
  }

  /* ---------- 2. 工具 ---------- */
  function domainOf(u) {
    try { return new URL(u, 'https://x/').hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  function nameFromDomain(d) {
    var core = String(d || '').replace(/^www\./, '').split('.')[0] || '';
    core = core.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return core.trim();
  }
  function nameFromLinkedinUrl(u) {
    var m = String(u || '').match(/linkedin\.com\/company\/([^\/?#]+)/i);
    if (!m) return '';
    return decodeURIComponent(m[1]).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  }

  /* 黑名单：搜索站/社交/聚合/维基/电商等，不作为“公司官网” */
  var BLOCK = [
    'duckduckgo.com', 'bing.com', 'google.', 'goo.gl', 'youtube.com', 'youtu.be',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'pinterest.com',
    'wikipedia.org', 'wikimedia.org', 'reddit.com', 'quora.com', 'medium.com',
    'amazon.', 'ebay.', 'alibaba.com', 'aliexpress.', 'alibabacloud',
    'linkedin.com', 'tiktok.com', 'douyin', 'slot', 'blogspot.', 'wordpress.com',
    'wixsite.com', 'weebly.com', 'shopify.com', 'gstatic.com', 'googleusercontent',
    'glassdoor.', 'indeed.', 'crunchbase.com', 'bloomberg.com', 'reuters.com',
    'forbes.com', 'statista.com', 'zoominfo', 'dnb.com', 'kompass.com',
    'europages.', 'yellowpages.', 'thomasnet.com', 'exportersindia.com',
    'go4worldbusiness.com', 'made-in-china.com', 'tradeindia', 'indiamart',
    'globalsources', 'ec21.', 'tradekey', 'exportpages', 'b2bmap', 'wlw.',
    'googleadservices', 'doubleclick', 'microsoft.com', 'msn.com', 'yahoo.com',
    'yandex.', 'baidu.com', 'sogou', 'pinterest.co', 'tumblr.', 'vk.com'
  ];
  function isBlocked(d) {
    if (!d) return true;
    d = d.toLowerCase();
    return BLOCK.some(function (b) { return d.indexOf(b) >= 0; });
  }
  function looksLikeNav(s) {
    if (!s) return true;
    var t = s.toLowerCase();
    if (s.length < 3 || s.length > 70) return true;
    return /\b(log ?in|sign ?in|sign ?up|register|menu|home|about|contact|privacy|cookie|terms|search|next|previous|more|read more|show more|add to cart|categories|products|services|countries|regions|follow us|share|newsletter|download|sitemap|copyright|all rights)\b/.test(t);
  }

  /* ---------- 3. 链接解析（markdown / html 统一） ---------- */
  function stripTags(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function b64urlDecode(s) {
    try {
      s = String(s).replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return atob(s);
    } catch (e) { return ''; }
  }
  /** 还原被搜索站包装的真实 URL（DDG uddg / Bing ck/a u=） */
  function realUrl(u) {
    try {
      var x = new URL(u);
      if (/duckduckgo\.com$/i.test(x.hostname)) {
        var q = x.searchParams.get('uddg');
        if (q) return decodeURIComponent(q);
      }
      if (/bing\.com$/i.test(x.hostname)) {
        var p = x.searchParams.get('u');
        if (p && p.slice(0, 2) === 'a1') { var d = b64urlDecode(p.slice(2)); if (d) return d; }
      }
    } catch (e) {}
    return u;
  }
  function extractLinks(body, baseUrl) {
    var out = [], seen = {};
    var text = body.text || '';
    function push(href, label) {
      if (!href) return;
      if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return;
      var abs;
      try { abs = new URL(href, baseUrl).href; } catch (e) { return; }
      abs = realUrl(abs).split('#')[0];
      if (!/^https?:/i.test(abs)) return;
      if (seen[abs]) return;
      seen[abs] = 1;
      out.push({ url: abs, label: label || '' });
    }
    if (body.html) {
      var re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, m;
      while ((m = re.exec(text))) push(m[1], stripTags(m[2]));
    } else {
      var re2 = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, m2;
      while ((m2 = re2.exec(text))) push(m2[2], m2[1].trim());
    }
    return out;
  }

  /* ---------- 4. 联系方式提取（复用原 find 逻辑） ---------- */
  function extractContacts(t) {
    var c = { emails: [], phones: [], was: [] };
    if (!t) return c;
    var bad = /\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?)\b/i;
    (t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).forEach(function (e) {
      if (!bad.test(e) && c.emails.indexOf(e.toLowerCase()) < 0 && c.emails.length < 3) c.emails.push(e.toLowerCase());
    });
    var m;
    var wr = /(?:wa\.me\/|whatsapp:\/\/send\?phone=|api\.whatsapp\.com\/send\?phone=)(\+?\d[\d\s]{6,16})/gi;
    while ((m = wr.exec(t)) && c.was.length < 2) { var d = m[1].replace(/\D/g, ''); if (d.length >= 8) c.was.push(d); }
    var pr = /\+\d{1,3}[\s().-]?\(?\d{1,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g;
    while ((m = pr.exec(t)) && c.phones.length < 2) { var d3 = m[0].replace(/\D/g, ''); if (d3.length >= 9 && c.was.indexOf(d3) < 0) c.phones.push(m[0].trim()); }
    return c;
  }

  /* ---------- 5. 各省略行提取（目录标题法） ---------- */
  function headingNames(text) {
    var out = [], re = /^#{2,4}\s+([^\n]{3,70})$/gm, m;
    while ((m = re.exec(text))) {
      var nm = m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
      if (nm && !looksLikeNav(nm)) out.push(nm);
    }
    return out;
  }

  /* ---------- 5.5 询盘式关键词矩阵（借鉴 b2b-buyer-discovery） ---------- */
  var INTENT_TEMPLATES = {
    en: [
      '"{p}" {t} {r}',
      '"{p}" importer OR buyer {r}',
      '"{p}" "request for quotation" OR RFQ {r}',
      '"{p}" tender OR procurement {r}',
      '"{p}" "looking for supplier" OR "supplier wanted" {r}',
      '"{p}" purchase order {r}',
      '"{p}" distributor OR dealer OR wholesaler {r}'
    ],
    es: [
      'cotizacion "{p}" {r}',
      '"{p}" importador OR mayorista {r}',
      'solicitud presupuesto "{p}"',
      'necesitamos proveedor "{p}"',
      'licitacion "{p}" {r}'
    ],
    pt: [
      'cotacao "{p}" importador {r}',
      '"{p}" atacadista OR distribuidor {r}'
    ],
    de: [
      'Angebot "{p}" Großhändler {r}',
      '"{p}" Lieferant gesucht {r}'
    ],
    fr: [
      'devis "{p}" grossiste {r}',
      '"{p}" fournisseur recherche {r}'
    ],
    it: ['preventivo "{p}" grossista {r}'],
    id: ['"{p}" distributor OR grosir {r}'],
    vi: ['"{p}" nhà phân phối {r}']
  };

  var REGION_LANG = {
    'Latin America': ['es', 'en', 'pt'],
    'Europe': ['en', 'de', 'fr', 'es', 'it'],
    'Southeast Asia': ['en', 'id', 'vi'],
    'Middle East': ['en'],
    'Africa': ['en', 'fr'],
    'USA': ['en'],
    '': ['en', 'es', 'pt']
  };

  /** 生成询盘式关键词（多语言轮转，带市场词） */
  function buildQueries(prod, region, type, limit) {
    var p = String(prod || '').trim();
    var r = String(region || '').trim();
    var t = String(type || 'distributor').trim();
    if (!p) return [];
    var langs = REGION_LANG[r] || REGION_LANG[''];
    var lists = langs.map(function (lang) {
      return (INTENT_TEMPLATES[lang] || []).map(function (tpl) {
        return tpl.replace(/\{p\}/g, p).replace(/\{t\}/g, t).replace(/\{r\}/g, r).replace(/\s+/g, ' ').trim();
      });
    });
    var out = [], seen = {}, round = 0, more = true;
    while (more && out.length < (limit || 12)) {
      more = false;
      for (var i = 0; i < lists.length; i++) {
        var q = lists[i][round];
        if (!q) continue;
        more = true;
        if (seen[q]) continue;
        seen[q] = 1;
        out.push({ q: q, lang: langs[i] });
        if (out.length >= (limit || 12)) break;
      }
      round++;
      if (round > 20) break;
    }
    return out;
  }

  /* ---------- 5.6 规则引擎（11 条供应商过滤 + 价格询盘识别） ---------- */
  var SKIP_RULES = [
    { re: /we are (a )?(manufacturer|factory|supplier|producer)/i, why: '制造商页面', strong: true },
    { re: /alibaba\.com|made-in-china\.com|global\s*sources|indiamart\.com/i, why: '供应商平台', strong: true },
    { re: /FOB price|CIF price|factory direct|ex.?works|EXW price/i, why: '工厂报价页', strong: true },
    { re: /出售|转让|低价卖|急售|厂家直销/, why: '中文出售广告', strong: true },
    { re: /\bjual\b|\bdijual\b/i, why: '印尼语出售', strong: true },
    { re: /#(?:stonecrushersupplier|crushersupplier|suppliers?|wholesale)/i, why: '卖家标签', strong: true },
    { re: /our (factory|company|products?|machines?|plant) (offer|provide|supply|manufacture|export)/i, why: '供应商推广', strong: false },
    { re: /in stock|available (now|for immediate delivery|to ship)/i, why: '现货销售页', strong: false },
    { re: /add to cart|buy now|product catalog(ue)?/i, why: '电商产品页', strong: false },
    { re: /\$[\d,.]+\s*\/\s*(unit|piece|pcs|ton|mt)\b/i, why: '价格列表页', strong: false }
  ];
  var PRICE_INQUIRY_RE = /\bprice\b|how much|quotation|\bquote\b|price ?list|pricelist|\bMOQ\b|minimum order|per unit|per piece|per ton|per kg|RFQ|request for quotation|tender|procurement/i;

  /** 返回 {skip, reason, score(0/5/7), isPriceInquiry}；strongOnly 只判强信号 */
  function ruleCheck(text, strongOnly) {
    var s = String(text || '');
    for (var i = 0; i < SKIP_RULES.length; i++) {
      if (strongOnly && !SKIP_RULES[i].strong) continue;
      if (SKIP_RULES[i].re.test(s)) {
        return { skip: true, reason: SKIP_RULES[i].why, score: 0, isPriceInquiry: false };
      }
    }
    if (PRICE_INQUIRY_RE.test(s)) {
      return { skip: false, reason: '价格/采购询问', score: 7, isPriceInquiry: true };
    }
    return { skip: false, reason: '', score: 5, isPriceInquiry: false };
  }

  /** 综合分 0-12：AI 0-10 + 价格询盘 +2 */
  function compositeScore(aiScore, isPriceInquiry) {
    var v = Math.round(Number(aiScore) || 0) + (isPriceInquiry ? 2 : 0);
    return Math.max(0, Math.min(12, v));
  }
  function tierOf(score) {
    if (score >= 10) return { key: 'a', label: '极高' };
    if (score >= 7) return { key: 'b', label: '高' };
    if (score >= 4) return { key: 'c', label: '中' };
    return { key: 'd', label: '低' };
  }

  /* ---------- 5.7 国家识别（城市 + 域名后缀） ---------- */
  var COUNTRY_MAP = {
    'Peru': ['peru', 'perú', 'lima', 'arequipa', '.pe'],
    'Chile': ['chile', 'santiago', '.cl'],
    'Colombia': ['colombia', 'bogota', 'bogotá', '.co'],
    'Mexico': ['mexico', 'méxico', 'cdmx', 'monterrey', '.mx'],
    'Brazil': ['brazil', 'brasil', 'sao paulo', 'são paulo', '.br'],
    'Argentina': ['argentina', 'buenos aires', '.ar'],
    'Ecuador': ['ecuador', 'quito', 'guayaquil', '.ec'],
    'Indonesia': ['indonesia', 'jakarta', 'surabaya', '.id'],
    'Vietnam': ['vietnam', 'hanoi', 'ho chi minh', '.vn'],
    'Thailand': ['thailand', 'bangkok', '.th'],
    'Malaysia': ['malaysia', 'kuala lumpur', '.my'],
    'Philippines': ['philippines', 'manila', '.ph'],
    'India': ['india', 'mumbai', 'delhi', 'chennai', '.in'],
    'Pakistan': ['pakistan', 'karachi', 'lahore', '.pk'],
    'Bangladesh': ['bangladesh', 'dhaka', '.bd'],
    'Sri Lanka': ['sri lanka', 'colombo', '.lk'],
    'UAE': ['united arab emirates', 'dubai', 'abu dhabi', '.ae'],
    'Saudi Arabia': ['saudi arabia', 'riyadh', 'jeddah', '.sa'],
    'Turkey': ['turkey', 'türkiye', 'istanbul', '.tr'],
    'Egypt': ['egypt', 'cairo', '.eg'],
    'Nigeria': ['nigeria', 'lagos', 'abuja', '.ng'],
    'Ghana': ['ghana', 'accra', '.gh'],
    'Kenya': ['kenya', 'nairobi', '.ke'],
    'South Africa': ['south africa', 'johannesburg', 'cape town', '.za'],
    'Morocco': ['morocco', 'casablanca', '.ma'],
    'Poland': ['poland', 'warsaw', '.pl'],
    'Germany': ['germany', 'deutschland', 'berlin', 'hamburg', '.de'],
    'France': ['france', 'paris', 'lyon', '.fr'],
    'Italy': ['italy', 'italia', 'milan', 'milano', '.it'],
    'Spain': ['spain', 'españa', 'madrid', 'barcelona', '.es'],
    'Netherlands': ['netherlands', 'amsterdam', 'rotterdam', '.nl'],
    'Belgium': ['belgium', 'brussels', '.be'],
    'United Kingdom': ['united kingdom', 'england', 'london', 'manchester', '.uk'],
    'USA': ['united states', 'u.s.a', 'usa', 'new york', 'houston', 'chicago', '.us'],
    'Canada': ['canada', 'toronto', 'vancouver', '.ca'],
    'Australia': ['australia', 'sydney', 'melbourne', '.au'],
    'Japan': ['japan', 'tokyo', 'osaka', '.jp'],
    'South Korea': ['south korea', 'seoul', '.kr']
  };
  function detectCountry(text, fallback) {
    var s = String(text || '').toLowerCase();
    for (var k in COUNTRY_MAP) {
      if (!COUNTRY_MAP.hasOwnProperty(k)) continue;
      var words = COUNTRY_MAP[k];
      for (var i = 0; i < words.length; i++) {
        if (s.indexOf(words[i]) >= 0) return k;
      }
    }
    return fallback || '';
  }

  /* ---------- 5.8 抓页 / 二次补全 ---------- */
  async function pageInfo(url, timeout) {
    var body = await fetchRaw(url, timeout || 15000);
    return {
      text: body.text || '',
      html: !!body.html,
      links: extractLinks(body, url),
      contacts: extractContacts(body.text || '')
    };
  }

  function pickWebsite(links, skipHost) {
    for (var i = 0; i < links.length; i++) {
      var d = domainOf(links[i].url);
      if (!d || isBlocked(d) || d === skipHost) continue;
      return 'https://' + d;
    }
    return '';
  }

  /** 按公司名二次搜索补全联系方式 */
  async function enrichContacts(name, domain) {
    if (!name) return { emails: [], phones: [], was: [], country: '' };
    var queries = ['"' + name + '" email contact'];
    if (domain) queries.push('site:' + domain + ' contact email');
    var texts = [];
    for (var i = 0; i < queries.length; i++) {
      try {
        var body = await fetchRaw('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(queries[i]), 18000);
        texts.push(body.text || '');
      } catch (e) { /* 忽略单条失败 */ }
    }
    var joined = texts.join(' ');
    var c = extractContacts(joined);
    return { emails: c.emails, phones: c.phones, was: c.was, country: detectCountry(joined, '') };
  }

  /* ---------- 5.9 AI 批量买家意向评分 ---------- */
  async function aiScoreBatch(prod, market, leads) {
    if (!leads || !leads.length) return [];
    if (typeof AgnesAI === 'undefined') throw new Error('AI 模块未加载');
    var rows = leads.map(function (l, i) {
      return (i + 1) + '. 公司：' + (l.name || '') +
        '｜摘要：' + String(l.desc || '').replace(/\s+/g, ' ').slice(0, 160) +
        '｜网址：' + (l.website || l.linkedin || '');
    }).join('\n');
    var prompt = '你是外贸买家意向评分器。我方产品：' + prod + '；目标市场：' + (market || '全球') + '。\n'
      + '判断每条结果是「买家/采购方」还是「同行供应商/制造商/电商平台」。\n'
      + '重要：经销商、进口商、分销商、批发商、代理商都是高价值采购方，不要因为不是终端用户而降分。\n'
      + '评分：0=明确是供应商/工厂/电商平台；5=不确定；7-9=经销商/进口商/批发商/承包商；10=明确询价/招标/采购需求。\n\n'
      + rows + '\n\n'
      + '只输出 JSON：{"leads":[{"i":1,"score":0,"type":"distributor|importer|wholesaler|retailer|contractor|manufacturer|unknown","product":"","country":"","why":"一句话理由","approach":"一句话跟进建议","lang":"en"}]}';
    var txt = await AgnesAI.ask(prompt, { json: true, temperature: 0.1, maxTokens: 2200 });
    var res = AgnesAI.parseLoose(txt);
    return (res && res.leads) || [];
  }

  /* ---------- 6. 连接器 ---------- */
  var SITE_EXCLUDE = ['alibaba.com', 'made-in-china.com', 'aliexpress.com', 'amazon.com', 'ebay.com',
    'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'indiamart.com',
    'tradekey.com', 'globalsources.com', 'ec21.com', 'linkedin.com']
    .map(function (d) { return '-site:' + d; }).join(' ');
  var SITE_EXCLUDE_NO_LI = SITE_EXCLUDE.replace('-site:linkedin.com', '').trim();

  /** DDG 搜索 → 链接列表 */
  async function searchLinks(q, allowLinkedin) {
    var ex = allowLinkedin ? SITE_EXCLUDE_NO_LI : SITE_EXCLUDE;
    var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent((q + ' ' + ex).trim());
    var body = await fetchRaw(url, 22000);
    return extractLinks(body, 'https://html.duckduckgo.com/');
  }
  function settleAll(list) {
    return Promise.allSettled(list).then(function (rs) {
      var out = [];
      rs.forEach(function (r) { if (r.status === 'fulfilled' && r.value) out = out.concat(r.value); });
      return out;
    });
  }

  async function srcDdg(ctx) {
    var qs = (ctx.queries || []).slice(0, 3);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var groups = await settleAll(qs.map(function (o) { return searchLinks(o.q, false); }));
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        var d = domainOf(l.url);
        if (!d || isBlocked(d) || seen[d]) return;
        seen[d] = 1;
        out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'DuckDuckGo' });
      });
    });
    return out.slice(0, 30);
  }

  async function srcLinkedin(ctx) {
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '"' }];
    var groups = await settleAll(qs.map(function (o) {
      return searchLinks('site:linkedin.com/company ' + o.q, true);
    }));
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        if (!/linkedin\.com\/company\//i.test(l.url)) return;
        var clean = l.url.split('?')[0].replace(/\/$/, '');
        if (seen[clean]) return;
        seen[clean] = 1;
        var name = String(l.label || '').replace(/\s*[|\-–—]\s*LinkedIn.*$/i, '').replace(/\s*\|\s*LinkedIn$/i, '').trim();
        if (!name || looksLikeNav(name)) name = nameFromLinkedinUrl(clean);
        out.push({ name: name, linkedin: clean, source: 'LinkedIn' });
      });
    });
    return out.slice(0, 25);
  }

  async function srcBing(ctx) {
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var groups = await settleAll(qs.map(function (o) {
      var url = 'https://www.bing.com/search?q=' + encodeURIComponent((o.q + ' ' + SITE_EXCLUDE).trim()) + '&count=30';
      return fetchRaw(url, 25000).then(function (body) { return extractLinks(body, 'https://www.bing.com/'); });
    }));
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        var d = domainOf(l.url);
        if (!d || isBlocked(d) || seen[d]) return;
        seen[d] = 1;
        out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'Bing' });
      });
    });
    return out.slice(0, 25);
  }

  async function srcEuropages(ctx) {
    var url = 'https://www.europages.co.uk/companies/' + encodeURIComponent(ctx.product) + '.html';
    var body = await fetchRaw(url, 25000);
    var links = extractLinks(body, 'https://www.europages.co.uk/');
    var out = [], seen = {};
    links.forEach(function (l) {
      if (!/europages\.co\.uk\/en\/company\//i.test(l.url)) return;
      var name = String(l.label || '').trim();
      if (!name || name.length < 3 || seen[name]) return;
      seen[name] = 1;
      out.push({ name: name, profileUrl: l.url, source: 'Europages' });
    });
    return out.slice(0, 25);
  }

  async function srcDirectory(ctx, cfg) {
    var body = await fetchRaw(cfg.url(ctx), 25000);
    var base = cfg.base;
    var baseHost = domainOf(base);
    var links = extractLinks(body, base);
    var out = [], seen = {};
    links.forEach(function (l) {
      var d = domainOf(l.url);
      if (!d || isBlocked(d) || d === baseHost || seen[d]) return;
      seen[d] = 1;
      out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: cfg.name });
    });
    if (!body.html) {
      headingNames(body.text).forEach(function (nm) {
        var k = 'n:' + nm.toLowerCase();
        if (seen[k] || out.length >= 30) return;
        seen[k] = 1;
        out.push({ name: nm, desc: '目录条目', source: cfg.name });
      });
    }
    return out.slice(0, 25);
  }

  async function srcAi(ctx) {
    if (typeof AgnesAI === 'undefined') throw new Error('AI 模块未加载');
    var res = await AgnesAI.findBuyers(ctx.product, ctx.region || '全球', ctx.type, ['web', 'linkedin', 'facebook']);
    var cs = (res && res.companies) || [];
    return cs.map(function (c) {
      return {
        name: c.name, country: c.country || '', website: c.website || '', email: c.email || '',
        phone: c.phone || '', linkedin: c.linkedin || '', desc: c.why || (c.products || ''), source: 'AI'
      };
    }).filter(function (c) { return c.name; });
  }

  /* ---------- 7. 注册表 ---------- */
  var META = [
    { id: 'ddg',            name: 'DuckDuckGo',     desc: '全网搜索公司官网',        def: true },
    { id: 'linkedin',       name: '领英(反查)',     desc: 'site:linkedin.com/company', def: true },
    { id: 'europages',      name: 'Europages',      desc: '欧洲 B2B 目录',           def: true },
    { id: 'go4world',       name: 'go4World',       desc: '全球买家目录',            def: true },
    { id: 'exportersindia', name: 'ExportersIndia', desc: '供应商目录',              def: false },
    { id: 'thomasnet',      name: 'ThomasNet',      desc: '北美工业目录',            def: false },
    { id: 'bing',           name: 'Bing',           desc: '备用全网搜索',            def: false },
    { id: 'ai',             name: 'AI 挖掘',        desc: 'Agnes 训练数据',          def: true }
  ];

  var DIRECTORY = {
    go4world: {
      name: 'go4World', base: 'https://www.go4worldbusiness.com/',
      url: function (c) { return 'https://www.go4worldbusiness.com/find?searchText=' + encodeURIComponent(c.product) + '&type=buyers'; }
    },
    exportersindia: {
      name: 'ExportersIndia', base: 'https://www.exportersindia.com/',
      url: function (c) { return 'https://www.exportersindia.com/indian-suppliers/' + encodeURIComponent(String(c.product).replace(/\s+/g, '-').toLowerCase()) + '.htm'; }
    },
    thomasnet: {
      name: 'ThomasNet', base: 'https://www.thomasnet.com/',
      url: function (c) { return 'https://www.thomasnet.com/search?what=' + encodeURIComponent(c.product); }
    }
  };

  async function run(id, ctx) {
    if (id === 'ddg') return srcDdg(ctx);
    if (id === 'linkedin') return srcLinkedin(ctx);
    if (id === 'bing') return srcBing(ctx);
    if (id === 'europages') return srcEuropages(ctx);
    if (id === 'ai') return srcAi(ctx);
    if (DIRECTORY[id]) return srcDirectory(ctx, DIRECTORY[id]);
    throw new Error('未知来源 ' + id);
  }

  function meta(id) {
    var m = META.filter(function (x) { return x.id === id; })[0];
    return m || { id: id, name: id };
  }

  global.Sources = {
    META: META,
    run: run,
    meta: meta,
    fetchRaw: fetchRaw,
    extractLinks: extractLinks,
    extractContacts: extractContacts,
    domainOf: domainOf,
    host: host,
    nameFromDomain: nameFromDomain,
    isBlocked: isBlocked,
    buildQueries: buildQueries,
    ruleCheck: ruleCheck,
    compositeScore: compositeScore,
    tierOf: tierOf,
    detectCountry: detectCountry,
    pageInfo: pageInfo,
    pickWebsite: pickWebsite,
    enrichContacts: enrichContacts,
    aiScoreBatch: aiScoreBatch
  };
})(window);
