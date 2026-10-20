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
  /* jina 免费额度有限（约 20 次/分钟），用闸门把并发压到 4，避免被限流成 0 结果 */
  var JINA_MAX = 4, jinaActive = 0, jinaQueue = [];
  function jinaSlot() {
    return new Promise(function (resolve) {
      function tryAcquire() {
        if (jinaActive < JINA_MAX) { jinaActive++; resolve(); }
        else jinaQueue.push(tryAcquire);
      }
      tryAcquire();
    });
  }
  function jinaRelease() {
    jinaActive = Math.max(0, jinaActive - 1);
    var next = jinaQueue.shift();
    if (next) next();
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function jinaOnce(url, timeout) {
    var r = await fetch('https://r.jina.ai/' + url, { signal: AbortSignal.timeout(timeout || 25000) });
    if (!r.ok) {
      var err = new Error('jina HTTP ' + r.status);
      err.status = r.status;
      throw err;
    }
    var t = await r.text();
    if (!t || t.length < 120) throw new Error('jina 内容过短');
    return { text: t, html: false };
  }
  async function fetchJina(url, timeout) {
    await jinaSlot();
    try {
      try {
        return await jinaOnce(url, timeout);
      } catch (e) {
        /* 429/403/5xx 多为瞬时限流，退避后重试一次 */
        var retryable = !e.status || e.status === 429 || e.status === 403 || e.status >= 500;
        if (!retryable) throw e;
        await sleep(1200 + Math.random() * 900);
        return await jinaOnce(url, timeout);
      }
    } finally {
      jinaRelease();
    }
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

  /* 黑名单：搜索站/社交/聚合/维基/电商/同类型目录站，不作为“公司官网” */
  var BLOCK = [
    'google.', 'gstatic', 'googleusercontent', 'doubleclick', 'googleadservices',
    'duckduckgo.com', 'bing.com', 'msn.com', 'microsoft.com', 'yahoo.com',
    'yandex.', 'baidu.', 'sogou.', 'goo.gl', 'bit.ly',
    'youtube.', 'youtu.be', 'facebook.', 'instagram.', 'twitter.', 'tiktok.', 'douyin',
    'pinterest.', 'wikipedia.', 'wikimedia.', 'reddit.', 'quora.', 'medium.',
    'blogspot.', 'wordpress.', 'wixsite.', 'weebly.', 'shopify.', 'tumblr.', 'vk.com',
    'amazon.', 'ebay.', 'alibaba.', 'aliexpress.', 'alibabacloud',
    'linkedin.', 'glassdoor.', 'indeed.', 'crunchbase.', 'bloomberg.', 'reuters.',
    'forbes.', 'statista.', 'zoominfo', 'dnb.',
    'kompass.', 'europages.', 'yellowpages.', 'thomasnet.', 'exportersindia.',
    'go4worldbusiness.', 'made-in-china.', 'tradeindia', 'indiamart', 'globalsources',
    'ec21.', 'tradekey', 'exportpages', 'b2bmap', 'wlw.',
    'zauba.com', 'importyeti.com', 'hotfrog.', 'cylex.', 'tuugo.',
    'faire.com', 'qogita.com', 'supplyleader.com', 'merkandi.',
    'trademo.com', 'exporthub.com', 'tradewheel.com', 'tradeford.',
    'volza.com', 'importgenius', 'panjiva', 'seair.co', 'exportgenius',
    'tradeatlas', '52wmb', 'tradesparq', 'b2bmit', 'ecplaza'
  ];
  function isBlocked(d) {
    if (!d) return true;
    d = String(d).toLowerCase().replace(/^www\./, '');
    if (d === 'x.com' || d === 'twitter.com') return true;
    for (var i = 0; i < BLOCK.length; i++) {
      if (d.indexOf(BLOCK[i]) >= 0) return true;
    }
    return false;
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

  /* 市场 → 重点国家（“全球”或大区时做国家级查询，召回高得多） */
  var REGION_COUNTRIES = {
    'Latin America': ['Mexico', 'Peru', 'Chile', 'Colombia', 'Brazil', 'Argentina', 'Ecuador'],
    'Southeast Asia': ['Indonesia', 'Vietnam', 'Philippines', 'Malaysia', 'Thailand'],
    'Middle East': ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Egypt', 'Turkey'],
    'Africa': ['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Egypt', 'Morocco'],
    'Europe': ['Poland', 'Germany', 'Turkey', 'Spain', 'Italy', 'Netherlands'],
    'USA': ['USA']
  };
  var GLOBAL_COUNTRIES = ['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'UAE', 'Saudi Arabia',
    'Egypt', 'Peru', 'Chile', 'Mexico', 'Colombia', 'Brazil', 'Indonesia', 'Vietnam',
    'Philippines', 'Turkey', 'Poland', 'USA'];

  var BUYER_KINDS = ['importer', 'distributor', 'wholesaler', 'buyer', 'dealer', 'trader', 'agent'];

  /**
   * 生成混合关键词：国家 × 买家角色（前半）+ 询盘式模板（后半）
   * seed 用于「换一批」时轮换国家，避免每次同样结果
   */
  function buildQueries(prod, region, type, limit, seed) {
    var p = String(prod || '').trim();
    var r = String(region || '').trim();
    var t = String(type || 'distributor').trim();
    if (!p) return [];
    limit = limit || 12;
    var out = [], seen = {};
    function push(q, lang) {
      q = String(q || '').replace(/\s+/g, ' ').trim();
      if (!q || seen[q]) return;
      seen[q] = 1;
      out.push({ q: q, lang: lang || 'en' });
    }

    /* 1) 国家级买家查询（核心召回） */
    var markets = REGION_COUNTRIES[r] || GLOBAL_COUNTRIES;
    var off = Math.abs(parseInt(seed, 10) || 0) % markets.length;
    var countryQs = [];
    for (var i = 0; i < markets.length && countryQs.length < 10; i++) {
      var c = markets[(off + i) % markets.length];
      var kind = (i === 0 ? t : BUYER_KINDS[(off + i) % BUYER_KINDS.length]);
      countryQs.push({ q: '"' + p + '" ' + kind + ' ' + c, lang: 'en' });
    }

    /* 2) 询盘式多语言模板 */
    var langs = REGION_LANG[r] || REGION_LANG[''];
    var intentQs = [];
    var maxRound = 6;
    for (var round = 0; round < maxRound; round++) {
      for (var li = 0; li < langs.length; li++) {
        var tpl = (INTENT_TEMPLATES[langs[li]] || [])[round];
        if (!tpl) continue;
        intentQs.push({
          q: tpl.replace(/\{p\}/g, p).replace(/\{t\}/g, t).replace(/\{r\}/g, r),
          lang: langs[li]
        });
      }
    }

    /* 3) 交替合并：2 条国家 + 1 条询盘，保证前几条都是高召回查询 */
    var ci = 0, ii = 0;
    while (out.length < limit && (ci < countryQs.length || ii < intentQs.length)) {
      if (ci < countryQs.length) push(countryQs[ci].q, countryQs[ci].lang), ci++;
      if (ci < countryQs.length && out.length < limit) push(countryQs[ci].q, countryQs[ci].lang), ci++;
      if (ii < intentQs.length && out.length < limit) push(intentQs[ii].q, intentQs[ii].lang), ii++;
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
    var txt = await AgnesAI.ask(prompt, { json: true, temperature: 0.1, maxTokens: 2200, timeout: 60000 });
    var res = AgnesAI.parseLoose(txt);
    return (res && res.leads) || [];
  }

  /* ---------- 6. 连接器 ---------- */
  var SITE_EXCLUDE = ['alibaba.com', 'made-in-china.com', 'aliexpress.com', 'amazon.com', 'ebay.com',
    'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'indiamart.com',
    'tradekey.com', 'globalsources.com', 'ec21.com', 'linkedin.com']
    .map(function (d) { return '-site:' + d; }).join(' ');
  var SITE_EXCLUDE_NO_LI = SITE_EXCLUDE.replace('-site:linkedin.com', '').trim();

  /** DDG 搜索 → 链接列表（html 失败自动回退 lite） */
  async function searchLinks(q, allowLinkedin) {
    var ex = allowLinkedin ? SITE_EXCLUDE_NO_LI : SITE_EXCLUDE;
    var full = (q + ' ' + ex).trim();
    try {
      var body = await fetchRaw('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(full), 22000);
      var links = extractLinks(body, 'https://html.duckduckgo.com/');
      if (links.length) return links;
    } catch (e) { /* 回退 lite */ }
    var body2 = await fetchRaw('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(full), 20000);
    return extractLinks(body2, 'https://lite.duckduckgo.com/');
  }
  /** 并发执行，返回“每组一个数组”（保持分组，便于逐个解析） */
  function settleGroups(list) {
    return Promise.allSettled(list).then(function (rs) {
      return rs.map(function (r) {
        return (r.status === 'fulfilled' && Array.isArray(r.value)) ? r.value : [];
      });
    });
  }

  async function srcDdg(ctx) {
    var qs = (ctx.queries || []).slice(0, 4);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var groups = await settleGroups(qs.map(function (o) { return searchLinks(o.q, false); }));
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        var d = domainOf(l.url);
        if (!d || isBlocked(d) || seen[d]) return;
        seen[d] = 1;
        out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'DuckDuckGo' });
      });
    });
    return out.slice(0, 40);
  }

  async function srcLinkedin(ctx) {
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '"' }];
    var groups = await settleGroups(qs.map(function (o) {
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
    return out.slice(0, 30);
  }

  async function srcBing(ctx) {
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var groups = await settleGroups(qs.map(function (o) {
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
    return out.slice(0, 30);
  }

  async function srcEuropages(ctx) {
    /* 官方分页：/companies/pg-2/<product>.html —— 每页约 20 家，取前 3 页 */
    var enc = encodeURIComponent(ctx.product);
    var pages = [
      'https://www.europages.co.uk/companies/' + enc + '.html',
      'https://www.europages.co.uk/companies/pg-2/' + enc + '.html',
      'https://www.europages.co.uk/companies/pg-3/' + enc + '.html'
    ];
    var bodies = await Promise.allSettled(pages.map(function (u) { return fetchRaw(u, 25000); }));
    var out = [], seen = {};
    function add(name, link) {
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (!name || name.length < 2 || name.length > 90) return;
      if (/^(view|portfolio|next|previous|more|contact|home|all )/i.test(name)) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ name: name, profileUrl: link, source: 'Europages' });
    }
    bodies.forEach(function (r) {
      if (r.status !== 'fulfilled' || !r.value) return;
      var body = r.value;
      var text = body.text || '';
      /* 1) markdown 链接：[Company](.../en/company/slug-id) */
      extractLinks(body, 'https://www.europages.co.uk/').forEach(function (l) {
        if (!/europages\.co\.uk\/(?:[a-z]{2}\/)?company\//i.test(l.url)) return;
        if (/\/products\//i.test(l.url)) return;
        add(l.label, l.url);
      });
      /* 2) 兜底：老式企业页 .../COMPANY-NAME/00000005257978-001.html */
      var re2 = /\[([^\]]{2,90})\]\((https?:\/\/www\.europages\.co\.uk\/[^)\s]+\/000000\d+-\d+\.html)\)/gi, m2;
      while ((m2 = re2.exec(text))) add(m2[1], m2[2]);
    });
    return out.slice(0, 60);
  }

  /* go4worldbusiness：把“买家询盘”段落解析成线索（含国家/联系人） */
  var GENERIC_TOKENS = /^(powder|product|products|machine|machines|equipment|material|materials|chemical|chemicals|supply|supplier|price|quality|grade|plastic|metal|paper|glass|liquid|goods|item|items|part|parts|agent|trade)$/i;
  function parseGo4World(text, fallbackProduct) {
    var out = [], seen = {};
    /* 相关性词：产品名里长度≥5 且非通用词，命中任一即保留（过滤掉同页的无关询盘） */
    var keys = String(fallbackProduct || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
      return w.length >= 5 && !GENERIC_TOKENS.test(w);
    });
    var parts = String(text || '').split(/Buyer From\s+/i);
    for (var i = 1; i < parts.length; i++) {
      var chunk = parts[i];
      var nl = chunk.indexOf('\n');
      var country = (nl > 0 ? chunk.slice(0, nl) : chunk).replace(/[*_]/g, '').trim();
      if (!country || country.length > 40) continue;
      if (keys.length) {
        var low = chunk.toLowerCase();
        var hit = false;
        for (var k = 0; k < keys.length; k++) { if (low.indexOf(keys[k]) >= 0) { hit = true; break; } }
        if (!hit) continue;
      }
      var product = (chunk.match(/Product Name\s*:\s*([^\n]{2,90})/i) || [])[1] || fallbackProduct || '';
      var contact = (chunk.match(/Contact\s*:\s*([^\n]{2,60})/i) || [])[1] || '';
      var qty = (chunk.match(/Quantity Required\s*:\s*([^\n]{1,50})/i) || [])[1] || '';
      var name = String(product).trim() + ' 采购询盘 · ' + country + (contact ? ' (' + contact.trim() + ')' : '');
      name = name.replace(/\s+/g, ' ').trim();
      if (seen[name]) continue;
      seen[name] = 1;
      out.push({
        name: name,
        country: country,
        desc: '买家询盘' + (qty ? '：' + qty.trim() : '') + (contact ? ' · 联系人 ' + contact.trim() : ''),
        contact: contact.trim(),
        type: 'importer',
        _inquiry: true,
        source: 'go4World'
      });
    }
    return out;
  }

  /* zauba：美国海关进口商（表格里前几条公开，其余需登录） */
  function parseZauba(text, fallbackProduct) {
    var out = [], seen = {};
    var re = /^\|\s*\[([^\]]{2,90})\]\((https?:\/\/www\.zauba\.com\/[^)]*-report-[^)]+)\)\s*\|/gm, m;
    while ((m = re.exec(String(text || '')))) {
      var nm = stripTags(m[1]).trim();
      if (!nm || /login to view/i.test(nm) || seen[nm]) continue;
      seen[nm] = 1;
      out.push({
        name: nm,
        country: 'USA',
        desc: '美国进口商（Zauba 海关记录）· ' + (fallbackProduct || ''),
        type: 'importer',
        source: 'Zauba'
      });
    }
    return out;
  }

  async function srcGo4World(ctx) {
    var url = 'https://www.go4worldbusiness.com/find?searchText=' + encodeURIComponent(ctx.product) + '&type=buyers';
    var body = await fetchRaw(url, 20000);
    return parseGo4World(body.text, ctx.product);
  }

  async function srcZauba(ctx) {
    var slug = String(ctx.product).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var listUrl = 'https://www.zauba.com/import-' + slug + '-hs-code.html';
    var body = await fetchRaw(listUrl, 20000);
    var txt = body.text || '';
    var m = txt.match(/\]\((https?:\/\/www\.zauba\.com\/[^)\s]*?-importers)\)/i);
    if (m) {
      try {
        var b2 = await fetchRaw(m[1], 20000);
        return parseZauba(b2.text, ctx.product);
      } catch (e) { /* 用列表页兜底 */ }
    }
    return parseZauba(txt, ctx.product);
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
    { id: 'ddg',            name: 'DuckDuckGo',     desc: '全网搜索（按国家扩词）',   def: true },
    { id: 'linkedin',       name: '领英(反查)',     desc: 'site:linkedin.com/company', def: true },
    { id: 'europages',      name: 'Europages',      desc: '欧洲 B2B 企业目录',        def: true },
    { id: 'go4world',       name: 'go4World',       desc: '买家询盘（含国家/联系人）', def: true },
    { id: 'zauba',          name: 'Zauba',          desc: '美国海关进口商',           def: true },
    { id: 'exportersindia', name: 'ExportersIndia', desc: '供应商目录（多为同行）',   def: false },
    { id: 'thomasnet',      name: 'ThomasNet',      desc: '北美工业目录（多为同行）', def: false },
    { id: 'bing',           name: 'Bing',           desc: '备用全网搜索',             def: false },
    { id: 'ai',             name: 'AI 挖掘',        desc: 'Agnes 训练数据',           def: true }
  ];

  var DIRECTORY = {
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
    if (id === 'go4world') return srcGo4World(ctx);
    if (id === 'zauba') return srcZauba(ctx);
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
    aiScoreBatch: aiScoreBatch,
    parseGo4World: parseGo4World,
    parseZauba: parseZauba
  };
})(window);
