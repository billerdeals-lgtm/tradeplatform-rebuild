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

  /* ---------- 6. 连接器 ---------- */
  async function srcDdg(ctx) {
    var q = '"' + ctx.product + '" (' + (ctx.type || 'distributor') + ' OR wholesaler OR importer OR buyer) ' + (ctx.region || '');
    var body = await fetchRaw('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q.trim()), 25000);
    var links = extractLinks(body, 'https://html.duckduckgo.com/');
    var out = [], seen = {};
    links.forEach(function (l) {
      var d = domainOf(l.url);
      if (!d || isBlocked(d) || seen[d]) return;
      seen[d] = 1;
      out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'DuckDuckGo' });
    });
    return out.slice(0, 25);
  }

  async function srcLinkedin(ctx) {
    var q = 'site:linkedin.com/company "' + ctx.product + '" ' + (ctx.region || '');
    var body = await fetchRaw('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q.trim()), 25000);
    var links = extractLinks(body, 'https://html.duckduckgo.com/');
    var out = [], seen = {};
    links.forEach(function (l) {
      if (!/linkedin\.com\/company\//i.test(l.url)) return;
      var clean = l.url.split('?')[0].replace(/\/$/, '');
      if (seen[clean]) return; seen[clean] = 1;
      var name = String(l.label || '').replace(/\s*[|\-–—]\s*LinkedIn.*$/i, '').replace(/\s*\|\s*LinkedIn$/i, '').trim();
      if (!name || looksLikeNav(name)) name = nameFromLinkedinUrl(clean);
      out.push({ name: name, linkedin: clean, source: 'LinkedIn' });
    });
    return out.slice(0, 25);
  }

  async function srcBing(ctx) {
    var q = '"' + ctx.product + '" ' + (ctx.type || 'distributor') + ' ' + (ctx.region || '');
    var body = await fetchRaw('https://www.bing.com/search?q=' + encodeURIComponent(q.trim()) + '&count=30', 25000);
    var links = extractLinks(body, 'https://www.bing.com/');
    var out = [], seen = {};
    links.forEach(function (l) {
      var d = domainOf(l.url);
      if (!d || isBlocked(d) || seen[d]) return;
      seen[d] = 1;
      out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'Bing' });
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
    isBlocked: isBlocked
  };
})(window);
