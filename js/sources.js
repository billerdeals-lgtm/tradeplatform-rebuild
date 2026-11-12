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

  /* ---------- 0. 取消信号 ---------- */
  /* 试用 AI 额度耗尽等致命错误会调用 cancel()；之后新的抓页/搜索立即抛 ABORT，
     避免界面已经显示「AI 失败」却继续跑多源搜索、抓页面和合并。 */
  var _cancelReason = '';
  function cancel(reason) { _cancelReason = String(reason || '已取消'); }
  function resetCancel() { _cancelReason = ''; }
  function isCancelled() { return !!_cancelReason; }
  function cancelError() {
    var e = new Error(_cancelReason || '已取消');
    e.code = 'ABORT';
    e.cancelled = true;
    return e;
  }
  function throwIfCancelled() { if (_cancelReason) throw cancelError(); }

  /* ---------- 1. 代理层 ---------- */
  /* jina 免费额度有限（约 20 次/分钟），用闸门把并发压到 4，避免被限流成 0 结果 */
  var JINA_MAX = 4, jinaActive = 0, jinaQueue = [];
  /* 并发限制还不够：一轮挖掘会有搜索 + 20 个官网 + 联系页，很容易在同一分钟
     超过免费额度（表现为 401/429）。再加一个滑动窗口，超限就等下一分钟。 */
  var JINA_WINDOW = 60000, JINA_LIMIT = 16, jinaStamps = [];
  function jinaSlot() {
    return new Promise(function (resolve) {
      function tryAcquire() {
        if (jinaActive < JINA_MAX) { jinaActive++; resolve(); }
        else jinaQueue.push(tryAcquire);
      }
      tryAcquire();
    });
  }
  function jinaRateSlot() {
    return new Promise(function (resolve) {
      function check() {
        if (isCancelled()) return resolve();
        var now = Date.now();
        while (jinaStamps.length && now - jinaStamps[0] > JINA_WINDOW) jinaStamps.shift();
        if (jinaStamps.length < JINA_LIMIT) { jinaStamps.push(now); return resolve(); }
        setTimeout(check, 700);
      }
      check();
    });
  }
  function jinaRelease() {
    jinaActive = Math.max(0, jinaActive - 1);
    var next = jinaQueue.shift();
    if (next) next();
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* AbortSignal.timeout 在旧版 Safari / Android WebView 不存在；
     直接调用会让所有抓取同步抛错，表现为「一条都挖不到」。 */
  function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return { signal: AbortSignal.timeout(ms), done: function () {} };
    }
    if (typeof AbortController === 'undefined') return { signal: undefined, done: function () {} };
    var ctrl = new AbortController();
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms);
    return { signal: ctrl.signal, done: function () { clearTimeout(timer); } };
  }
  async function fetchWithTimeout(url, ms) {
    var t = timeoutSignal(ms);
    try {
      return await fetch(url, { signal: t.signal });
    } catch (e) {
      if (e && e.name === 'AbortError' && !isCancelled()) {
        var err = new Error('请求超时（' + Math.round(ms / 1000) + ' 秒）');
        err.timeout = true;
        throw err;
      }
      throw e;
    } finally {
      t.done();
    }
  }

  async function jinaOnce(url, timeout) {
    throwIfCancelled();
    var r = await fetchWithTimeout('https://r.jina.ai/' + url, timeout || 25000);
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
    throwIfCancelled();
    await jinaSlot();
    try {
      throwIfCancelled();
      await jinaRateSlot();
      throwIfCancelled();
      try {
        return await jinaOnce(url, timeout);
      } catch (e) {
        if (e && e.cancelled) throw e;
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
    throwIfCancelled();
    var r = await fetchWithTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      timeout || 25000);
    if (!r.ok) throw new Error('allorigins HTTP ' + r.status);
    var t = await r.text();
    if (!t || t.length < 120) throw new Error('allorigins 内容过短');
    return { text: t, html: true };
  }
  /** 依次尝试多个代理，返回 {text, html} */
  async function fetchRaw(url, timeout) {
    throwIfCancelled();
    var errs = [];
    try { return await fetchJina(url, timeout); }
    catch (e) { if (e && e.cancelled) throw e; errs.push('jina:' + e.message); }
    throwIfCancelled();
    try { return await fetchAllOrigins(url, timeout); }
    catch (e) { if (e && e.cancelled) throw e; errs.push('allorigins:' + e.message); }
    throwIfCancelled();
    throw new Error(errs.join(' | '));
  }

  /* ---------- 2. 工具 ---------- */
  function domainOf(u) {
    try { return new URL(u, 'https://x/').hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  /* 可注册域名：shop.acme.co.ke → acme.co.ke，mail.acme.com → acme.com。
     合并同源结果、判断企业邮箱归属都要用这一层，不能拿完整 host 当键。 */
  var MULTI_SUFFIX = /^(?:co|com|net|org|gov|edu|ac|or|ne|go|gob|mil|sch|nom|id|web|firm|gen|ind|per|plc|ltd|me|nhs|police)\.[a-z]{2}$/;
  function registrableDomain(u) {
    var h = hostLoose(u);
    if (!h || h.indexOf('.') < 0) return h || '';
    var p = h.split('.');
    if (p.length <= 2) return h;
    var last2 = p.slice(-2).join('.');
    if (MULTI_SUFFIX.test(last2)) return p.slice(-3).join('.');
    return last2;
  }

  function nameFromDomain(d) {
    /* 用可注册域名的核心词，避免 shop.xxx.co.ke 被拼成 "Shop"，
       也避免把 -uk 这类后缀当成公司名的一部分 */
    var reg = registrableDomain(d) || String(d || '');
    var core = String(reg || '').replace(/^www\./, '').split('.')[0] || '';
    core = core.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return core.trim();
  }
  function nameFromLinkedinUrl(u) {
    var m = String(u || '').match(/linkedin\.com\/company\/([^\/?#]+)/i);
    if (!m) return '';
    return decodeURIComponent(m[1]).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  }

  /* ---------- 2.1 AI 公司名核验（防止模型编造公司） ---------- */
  var NAME_STOP = /^(the|and|of|for|group|company|co|corp|corporation|inc|llc|ltd|limited|gmbh|mbh|ag|sa|sas|srl|spa|bv|nv|plc|pte|pty|oy|ab|as|trading|trade|import|imports|export|exports|distribution|distributor|distributors|international|global|holding|holdings|enterprise|enterprises|industry|industries|solution|solutions|service|services|supply|supplies|partner|partners|brother|brothers|sons)$/i;

  function nameTokens(name) {
    return String(name || '').toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff]+/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length >= 3 && !NAME_STOP.test(w); });
  }

  /**
   * 公司名与「域名 / 官网标题」是否匹配。
   * 目的：模型给出的公司名必须在它声称的官网上找得到，否则视为编造。
   */
  function aiNameMatches(name, domain, title) {
    var toks = nameTokens(name);
    var core = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
    var t = String(title || '').toLowerCase().replace(/\s+/g, ' ');
    if (!toks.length) return core.length >= 4;
    var joined = toks.join('');
    if (core.length >= 4) {
      if (core === joined) return true;
      if (joined.length >= 4 && core.indexOf(joined) >= 0) return true;
      if (core.length >= 5 && joined.indexOf(core) >= 0) return true;
      for (var i = 0; i < toks.length; i++) {
        if (toks[i].length >= 5 && core.indexOf(toks[i]) >= 0) return true;
      }
    }
    if (!t) return false;
    if (joined.length >= 6 && t.replace(/[^a-z0-9]+/g, ' ').indexOf(toks.join(' ')) >= 0) return true;
    var hits = 0;
    for (var j = 0; j < toks.length; j++) if (t.indexOf(toks[j]) >= 0) hits++;
    if (toks.length === 1) {
      return toks[0].length >= 4 && t.split(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff]+/).indexOf(toks[0]) >= 0;
    }
    return hits >= 2;
  }

  function pageTitle(text) {
    var s = String(text || '');
    var m = s.match(/<title[^>]*>([\s\S]{0,240}?)<\/title>/i);
    if (m) return stripTags(m[1]).trim();
    m = s.match(/^\s*Title:\s*(.{2,200})$/im);
    if (m) return m[1].trim();
    var first = s.split('\n').map(function (x) { return x.trim(); }).filter(Boolean)[0] || '';
    return stripTags(first).slice(0, 160);
  }

  /* ---------- 2.2 公司名清洗（标题优先） ----------
     目录/搜索结果里的公司名常是域名拼的：shop.xxx.co.ke → "Shop"。
     抓到官网后用首页标题里的品牌名替换，但必须能和域名对得上，
     避免把 "How to choose a solar panel supplier" 这类文章标题当公司名。 */
  var TITLE_NAV = /^(?:home|home ?page|welcome|index|official (?:site|website)|shop|store|products?|catalog(?:ue)?|blog|news|contact(?: us)?|about(?: us)?|login|sign in)$/i;
  var TITLE_PROMO = /\b(?:for sale|free shipping|best price|lowest price|buy online|shop online|online store|price list|how to|guide|review|vs\.?)\b|^(?:buy|shop|order|get|find|best|cheap|top|discount)\b/i;
  var TITLE_DESCRIPTIVE = /\b(?:company|supplier|manufacturer|exporter|distributor|wholesaler|dealer|shop|store)\s+in\s+[a-z]/i;
  var TITLE_LEGAL = /\b(?:co|company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|plc|gmbh|ag|sa|sas|sarl|srl|spa|bv|nv|pte|pvt|holdings?|group|industries|industrial|enterprises?)\b\.?$/i;
  function companyNameFromTitle(title, domain) {
    var s = stripTags(String(title || '')).replace(/\s+/g, ' ').trim();
    if (!s || s.length > 160) return '';
    var host = hostLoose(domain);
    var core = String(host || '').replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
    var parts = s.split(/\s*[|·•]\s*|\s+[–—]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var best = '', bestScore = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/^[-–—]\s*|\s*[-–—]$/g, '').trim();
      if (!p || p.length < 3 || p.length > 70) continue;
      if (!/[A-Za-z\u00c0-\u024f\u0400-\u04ff\u4e00-\u9fff]/.test(p)) continue;
      if (TITLE_NAV.test(p) || TITLE_DESCRIPTIVE.test(p) || isJunkName(p)) continue;
      var score = 0;
      var words = p.split(/\s+/).length;
      if (words >= 2 && words <= 4) score += 2;
      else if (words > 7) score -= 4;
      if (TITLE_LEGAL.test(p)) score += 3;
      if (TITLE_PROMO.test(p)) score -= 5;
      if (/[.!?]$/.test(p)) score -= 2;
      var toks = nameTokens(p);
      var joined = toks.join('');
      if (core && joined) {
        if (joined === core) score += 12;
        else if (joined.length >= 4 && core.indexOf(joined) >= 0) score += 8;
        else if (core.length >= 5 && joined.indexOf(core) >= 0) score += 7;
        else if (core.length >= 4 && toks.indexOf(core) >= 0) score += 6;
        else {
          for (var j = 0; j < toks.length; j++) {
            if (toks[j].length >= 5 && core.indexOf(toks[j]) >= 0) { score += 2; break; }
          }
        }
      }
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 4 ? best : '';
  }

  /* 名字里直接带 manufacturer / supplier / exporter 的基本是同行。
     页面同时有经销商/进口商信号时由调用方保留。 */
  var SELLER_NAME_RE = /\b(?:manufacturer|factory|supplier|exporter|oem|odm)\b/i;
  function isSellerName(name) {
    return SELLER_NAME_RE.test(String(name || ''));
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
    'tradeatlas', '52wmb', 'tradesparq', 'b2bmit', 'ecplaza',
    'enfsolar.com', 'ensun.io', 'energysage.com', 'solarreviews.com', 'globalspec.com',
    /* CDN / 图床：Europages 等目录页最容易把第一张图片的域名当成公司官网 */
    'cloudfront.net', 'cloudinary.com', 'imgix.net', 'akamaized.net',
    'wixstatic.com', 'amazonaws.com', 'azureedge.net', 'fastly.net',
    'jsdelivr.net', 'unpkg.com', 'bootstrapcdn.com', 'fontawesome.com',
    'gravatar.com', 'wp.com', 'visable.com'
  ];
  function isBlocked(d) {
    if (!d) return true;
    d = String(d).toLowerCase().replace(/^www\./, '');
    if (d === 'x.com' || d === 'twitter.com') return true;
    /* 聚合/目录站的域名核心词：propertyfinder.ae、yellowpages-uae.com 这类
       不是公司官网，命中后直接排除，不进入候选池。 */
    var core = d.split('.')[0];
    if (/(?:yellowpages|whitepages|directory|directories|finder|marketplace|companylist|businesslist|listing|b2bportal)/i.test(core)) return true;
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

  /* 目录站常把「Privacy Policy / Cookie Policy / 未解析 Markdown」当公司名。
     这里做统一清洗，Europages 和最终合并结果都会用。 */
  var JUNK_NAME = /^(?:privacy|cookie|cookies|terms|legal|imprint|sitemap|newsletter|subscribe|login|log ?in|sign ?in|sign ?up|register|home|homepage|search|menu|language|currency|cart|checkout|account|my account|help|faq|support|careers|jobs|press|news|blog|events|partners|products|services|categories|brands|companies|suppliers|buyers|request a quote|get a quote|catalog|download|downloads|follow us|share|next|previous|more|view all|read more|show more|about us|contact us)$/i;
  function isJunkName(v) {
    var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    if (s.length < 2 || s.length > 90) return true;
    if (/\](?:\(|\[)|https?:\/\/|www\.|\*\*|__|<\/?[a-z]|^\s*[#|]/.test(s)) return true;
    if (/\|/.test(s) && s.split('|').length > 2) return true;
    var core = s.replace(/\s*[|·\-–—]\s*(?:Europages|DuckDuckGo|Bing|LinkedIn|Zauba|go4WorldBusiness|ExportersIndia|ThomasNet)\s*$/i, '').trim();
    if (JUNK_NAME.test(core)) return true;
    if (/\b(?:privacy policy|cookie policy|cookie settings|terms (?:and|&) conditions|terms of (?:use|service)|general conditions|(?:general )?(?:conditions|terms) of (?:use|service|sale)|legal notice|all rights reserved|copyright)\b/i.test(core)) return true;
    return false;
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
  /* 明显不是业务邮箱的串：代理错址、占位域、noreply 类角色地址 */
  var EMAIL_BAD_DOMAIN = [
    'duckduckgo.com', 'bing.com', 'google.com', 'sentry.io', 'sentry-next.wixpress.com',
    'wixpress.com', 'example.com', 'example.org', 'example.net', 'test.com',
    'domain.com', 'yourdomain.com', 'your-domain.com', 'localhost'
  ];
  var EMAIL_BAD_LOCAL = /^(?:error(?:s)?|noreply|no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]?daemon|postmaster|abuse|sentry)(?:[+._-].*)?$/i;
  function isJunkEmail(e) {
    var s = String(e == null ? '' : e).trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return true;
    if (s.length > 254 || s.indexOf('..') >= 0) return true;
    var at = s.lastIndexOf('@');
    var local = s.slice(0, at), domain = s.slice(at + 1);
    if (!local || !domain || local.length > 64 || local.charAt(0) === '.' || local.charAt(local.length - 1) === '.') return true;
    if (EMAIL_BAD_LOCAL.test(local)) return true;
    if (/\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?|ttf|eot)$/i.test(domain)) return true;
    for (var i = 0; i < EMAIL_BAD_DOMAIN.length; i++) {
      var d = EMAIL_BAD_DOMAIN[i];
      if (domain === d || domain.slice(-(d.length + 1)) === '.' + d) return true;
    }
    return false;
  }
  function extractContacts(t, domain) {
    var c = { emails: [], phones: [], was: [] };
    if (!t) return c;
    var found = [];
    (t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).forEach(function (e) {
      var low = e.toLowerCase();
      if (!isJunkEmail(low) && found.indexOf(low) < 0) found.push(low);
    });
    /* 同一页先按「岗位 + 是否本公司域名」排序，再取前 3 个：
       webmaster / 建站商邮箱不能排在 sales / info 前面。 */
    c.emails = rankEmails(found, domain).slice(0, 3);
    var m;
    var wr = /(?:wa\.me\/|whatsapp:\/\/send\?phone=|api\.whatsapp\.com\/send\?phone=)(\+?\d[\d\s]{6,16})/gi;
    while ((m = wr.exec(t)) && c.was.length < 2) { var d = m[1].replace(/\D/g, ''); if (d.length >= 8) c.was.push(d); }
    /* tel: 链接是最干净的号码来源，优先于正文里的松散数字 */
    var tr = /href\s*=\s*["']tel:([+0-9()\s.\-]{7,24})["']/gi;
    while ((m = tr.exec(t)) && c.phones.length < 2) {
      var rawTel = m[1].replace(/\s+/g, ' ').trim();
      var telDigits = rawTel.replace(/\D/g, '');
      if (telDigits.length >= 8 && telDigits.length <= 15 && c.phones.indexOf(rawTel) < 0) c.phones.push(rawTel);
    }
    var pr = /\+\d{1,3}[\s().-]?\(?\d{1,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g;
    while ((m = pr.exec(t)) && c.phones.length < 3) { var d3 = m[0].replace(/\D/g, ''); if (d3.length >= 9 && c.was.indexOf(d3) < 0 && c.phones.indexOf(m[0].trim()) < 0) c.phones.push(m[0].trim()); }
    return c;
  }

  /* ---------- 4.1 邮箱排序与共享邮箱清理 ---------- */
  var FREE_MAIL = {
    'gmail.com': 1, 'googlemail.com': 1, 'yahoo.com': 1, 'yahoo.co.uk': 1, 'hotmail.com': 1,
    'outlook.com': 1, 'live.com': 1, 'icloud.com': 1, 'me.com': 1, 'aol.com': 1,
    'protonmail.com': 1, 'proton.me': 1, 'gmx.com': 1, 'gmx.de': 1, 'mail.com': 1,
    'web.de': 1, 't-online.de': 1, 'yandex.com': 1, 'yandex.ru': 1, 'mail.ru': 1,
    'qq.com': 1, 'foxmail.com': 1, '163.com': 1, '126.com': 1, 'sina.com': 1,
    'sohu.com': 1, 'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1,
    'uol.com.br': 1, 'terra.com.br': 1, 'libero.it': 1, 'laposte.net': 1,
    'orange.fr': 1, 'free.fr': 1, 'wanadoo.fr': 1
  };
  function isFreeMail(host) {
    host = String(host || '').toLowerCase();
    return !!(FREE_MAIL[host] || FREE_MAIL[registrableDomain(host)]);
  }
  var EMAIL_ROLE_GOOD = [
    /^(?:purchase|purchasing|procurement|buying|buyer|import|imports|sourcing|order|orders)(?:[._+-]|$)/i,
    /^(?:sales|export|exports|exporting|international|global|business|commercial|bd)(?:[._+-]|$)/i,
    /^(?:info|contact|enquir|inquir|hello|office|mail|general|admin|service)(?:[._+-]|$)/i
  ];
  var EMAIL_ROLE_BAD = /^(?:webmaster|hostmaster|postmaster|noreply|no[-_.]?reply|it|dev|developer|design|designer|marketing|pr|jobs|career|hr|support|helpdesk|legal)(?:[._+-]|$)/i;
  /** 越大越可能是「能联系上采购方」的邮箱 */
  function emailRank(e, domain) {
    var s = String(e || '').toLowerCase();
    var at = s.lastIndexOf('@');
    if (at < 1) return -1;
    var local = s.slice(0, at), host = s.slice(at + 1);
    var score = 20;
    if (EMAIL_ROLE_BAD.test(local)) score -= 15;
    for (var i = 0; i < EMAIL_ROLE_GOOD.length; i++) {
      if (EMAIL_ROLE_GOOD[i].test(local)) { score += 30 - i * 6; break; }
    }
    var own = registrableDomain(domain);
    var hd = registrableDomain(host);
    if (own && hd) {
      if (own === hd) score += 40;
      else if (isFreeMail(hd)) score += 5;
      /* 域名对不上的企业邮箱多半是建站商/模板/关联公司，降权但仍保留候选 */
      else score -= 25;
    }
    return score;
  }
  function rankEmails(list, domain) {
    var arr = (list || []).slice();
    var order = {};
    arr.forEach(function (e, i) { if (!(e in order)) order[e] = i; });
    arr.sort(function (a, b) {
      var d = emailRank(b, domain) - emailRank(a, domain);
      return d || (order[a] - order[b]);
    });
    return arr;
  }
  /**
   * 同一邮箱域出现在多家不同公司的页面上，基本是建站商/模板/集团代收，
   * 不能当成每家公司的联系方式。threshold 默认 3，返回清理条数。
   */
  function dropSharedEmails(list, threshold) {
    threshold = threshold || 3;
    var owners = {}, removed = 0;
    (list || []).forEach(function (c) {
      if (!c || !c.email) return;
      var at = String(c.email).lastIndexOf('@');
      if (at < 0) return;
      var hd = registrableDomain(String(c.email).slice(at + 1));
      var own = registrableDomain(c.website || '');
      if (!hd || isFreeMail(hd) || (own && own === hd)) return;
      owners[hd] = owners[hd] || {};
      owners[hd][own || ('n:' + normCompanyName(c.name))] = 1;
    });
    (list || []).forEach(function (c) {
      if (!c || !c.email) return;
      var at = String(c.email).lastIndexOf('@');
      if (at < 0) return;
      var hd = registrableDomain(String(c.email).slice(at + 1));
      var own = registrableDomain(c.website || '');
      if (!hd || isFreeMail(hd) || (own && own === hd)) return;
      if (owners[hd] && Object.keys(owners[hd]).length >= threshold) {
        c.email = '';
        c._emailDropped = hd;
        removed++;
      }
    });
    return removed;
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

  /* 经销商/进口商页面天然会有购物车、现货、单价；这些弱信号不能单独判死。
     只有「自称工厂/供应商」这类强信号才直接剔除。 */
  var BUYER_SIGNAL_RE = /\b(?:authorized\s+|leading\s+|independent\s+|official\s+)?(?:distributor|importer|wholesaler|dealer|reseller|stockist|retailer)\b|\bwe (?:import|distribute|stock|supply to|sell to|buy|purchase|source)\b|\bprocurement|purchasing|sourcing|buyer\b/i;
  var INQUIRY_STRONG_RE = /\bRFQ\b|request for quotation|request a quote|looking for (?:a )?supplier|suppliers? wanted|tender|procurement notice|purchase order|how much (?:does|do|is)|minimum order quantity|\bMOQ\b/i;
  var INQUIRY_PRICE_RE = /\bprice\b|quotation|\bquote\b|price ?list|pricelist|per unit|per piece|per ton|per kg/i;
  /* 「我们自己的报价单/购物车」是卖家行为，不是采购询盘 */
  var SELLER_PRICING_RE = /our price ?list|download (?:our )?price|price list (?:pdf|download)|product price|add to cart|buy now|shop now/i;

  /** 返回 {skip, reason, score(0/5/6/7), isPriceInquiry}；strongOnly 只判强信号 */
  function ruleCheck(text, strongOnly) {
    var s = String(text || '');
    var buyer = BUYER_SIGNAL_RE.test(s);
    for (var i = 0; i < SKIP_RULES.length; i++) {
      if (strongOnly && !SKIP_RULES[i].strong) continue;
      if (SKIP_RULES[i].re.test(s)) {
        if (!SKIP_RULES[i].strong && buyer) continue;
        return { skip: true, reason: SKIP_RULES[i].why, score: 0, isPriceInquiry: false };
      }
    }
    var inquiry = INQUIRY_STRONG_RE.test(s) || (INQUIRY_PRICE_RE.test(s) && !SELLER_PRICING_RE.test(s));
    if (inquiry) {
      return { skip: false, reason: '价格/采购询问', score: 7, isPriceInquiry: true };
    }
    if (buyer) return { skip: false, reason: '买家信号', score: 6, isPriceInquiry: false };
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

  /* ---------- 5.7 国家识别（只认可靠信号） ----------
     以前用城市名和裸国家词匹配，`.co` 还会命中 `.co.ke`，把肯尼亚
     公司标成哥伦比亚。现在只保留两类证据：
     1) 官网的完整 ccTLD 后缀（co.ke / co.uk / com.br …）；
     2) 页面里明确的 Country: / 国家： / based in 等写法。
     拿不到就返回空，由界面显示「未知」，不猜。 */
  var COUNTRY_NAMES = {
    'peru': 'Peru', 'chile': 'Chile', 'colombia': 'Colombia', 'mexico': 'Mexico',
    'brazil': 'Brazil', 'argentina': 'Argentina', 'ecuador': 'Ecuador',
    'indonesia': 'Indonesia', 'vietnam': 'Vietnam', 'thailand': 'Thailand',
    'malaysia': 'Malaysia', 'philippines': 'Philippines', 'india': 'India',
    'pakistan': 'Pakistan', 'bangladesh': 'Bangladesh', 'sri lanka': 'Sri Lanka',
    'uae': 'UAE', 'saudi arabia': 'Saudi Arabia', 'turkey': 'Turkey',
    'egypt': 'Egypt', 'nigeria': 'Nigeria', 'ghana': 'Ghana', 'kenya': 'Kenya',
    'south africa': 'South Africa', 'morocco': 'Morocco', 'poland': 'Poland',
    'germany': 'Germany', 'france': 'France', 'italy': 'Italy', 'spain': 'Spain',
    'netherlands': 'Netherlands', 'belgium': 'Belgium', 'united kingdom': 'United Kingdom',
    'usa': 'USA', 'canada': 'Canada', 'australia': 'Australia', 'japan': 'Japan',
    'south korea': 'South Korea', 'china': 'China', 'hong kong': 'Hong Kong',
    'taiwan': 'Taiwan', 'singapore': 'Singapore', 'new zealand': 'New Zealand',
    'ireland': 'Ireland', 'portugal': 'Portugal', 'sweden': 'Sweden',
    'norway': 'Norway', 'denmark': 'Denmark', 'finland': 'Finland',
    'switzerland': 'Switzerland', 'austria': 'Austria', 'czech republic': 'Czech Republic',
    'greece': 'Greece', 'israel': 'Israel', 'russia': 'Russia', 'ukraine': 'Ukraine',
    'romania': 'Romania', 'hungary': 'Hungary', 'bulgaria': 'Bulgaria',
    'croatia': 'Croatia', 'serbia': 'Serbia', 'slovakia': 'Slovakia',
    'slovenia': 'Slovenia', 'lithuania': 'Lithuania', 'latvia': 'Latvia',
    'estonia': 'Estonia', 'azerbaijan': 'Azerbaijan', 'georgia': 'Georgia',
    'armenia': 'Armenia', 'kazakhstan': 'Kazakhstan', 'uzbekistan': 'Uzbekistan',
    'qatar': 'Qatar', 'kuwait': 'Kuwait', 'bahrain': 'Bahrain', 'oman': 'Oman',
    'jordan': 'Jordan', 'lebanon': 'Lebanon', 'iraq': 'Iraq', 'iran': 'Iran',
    'cambodia': 'Cambodia', 'myanmar': 'Myanmar', 'nepal': 'Nepal',
    'tunisia': 'Tunisia', 'algeria': 'Algeria', 'ethiopia': 'Ethiopia',
    'tanzania': 'Tanzania', 'uganda': 'Uganda', 'zambia': 'Zambia',
    'zimbabwe': 'Zimbabwe', 'mozambique': 'Mozambique', 'angola': 'Angola',
    'cameroon': 'Cameroon', 'ivory coast': 'Ivory Coast', 'senegal': 'Senegal'
  };
  var COUNTRY_ALIASES = {
    'us': 'USA', 'u.s.': 'USA', 'u.s.a': 'USA', 'u.s.a.': 'USA',
    'u s': 'USA', 'u s a': 'USA', 'u k': 'United Kingdom', 'u a e': 'UAE',
    'united states': 'USA', 'united states of america': 'USA', 'america': 'USA',
    'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'great britain': 'United Kingdom',
    'england': 'United Kingdom', 'scotland': 'United Kingdom', 'wales': 'United Kingdom',
    'uae': 'UAE', 'u.a.e.': 'UAE', 'united arab emirates': 'UAE',
    'south korea': 'South Korea', 'korea': 'South Korea', 'republic of korea': 'South Korea',
    'viet nam': 'Vietnam', 'turkiye': 'Turkey', 'türkiye': 'Turkey',
    'russian federation': 'Russia', 'czechia': 'Czech Republic', 'ksa': 'Saudi Arabia',
    'hongkong': 'Hong Kong',
    '肯尼亚': 'Kenya', '哥伦比亚': 'Colombia', '秘鲁': 'Peru', '智利': 'Chile',
    '墨西哥': 'Mexico', '巴西': 'Brazil', '阿根廷': 'Argentina', '厄瓜多尔': 'Ecuador',
    '印度尼西亚': 'Indonesia', '越南': 'Vietnam', '泰国': 'Thailand', '马来西亚': 'Malaysia',
    '菲律宾': 'Philippines', '印度': 'India', '巴基斯坦': 'Pakistan', '孟加拉国': 'Bangladesh',
    '斯里兰卡': 'Sri Lanka', '阿联酋': 'UAE', '沙特阿拉伯': 'Saudi Arabia',
    '土耳其': 'Turkey', '埃及': 'Egypt', '尼日利亚': 'Nigeria', '加纳': 'Ghana',
    '南非': 'South Africa', '摩洛哥': 'Morocco', '波兰': 'Poland', '德国': 'Germany',
    '法国': 'France', '意大利': 'Italy', '西班牙': 'Spain', '荷兰': 'Netherlands',
    '比利时': 'Belgium', '英国': 'United Kingdom', '美国': 'USA', '加拿大': 'Canada',
    '澳大利亚': 'Australia', '日本': 'Japan', '韩国': 'South Korea', '中国': 'China'
  };
  /* 完整后缀 → 国家。必须按最长后缀匹配，避免 .co 抢走 .co.ke。 */
  var CC_TLD = {
    'pe': 'Peru', 'cl': 'Chile', 'co': 'Colombia', 'com.co': 'Colombia',
    'mx': 'Mexico', 'com.mx': 'Mexico', 'br': 'Brazil', 'com.br': 'Brazil',
    'ar': 'Argentina', 'com.ar': 'Argentina', 'ec': 'Ecuador', 'com.ec': 'Ecuador',
    'id': 'Indonesia', 'co.id': 'Indonesia', 'vn': 'Vietnam',
    'th': 'Thailand', 'co.th': 'Thailand', 'my': 'Malaysia', 'com.my': 'Malaysia',
    'ph': 'Philippines', 'com.ph': 'Philippines', 'in': 'India', 'co.in': 'India',
    'pk': 'Pakistan', 'com.pk': 'Pakistan', 'bd': 'Bangladesh', 'com.bd': 'Bangladesh',
    'lk': 'Sri Lanka', 'ae': 'UAE', 'sa': 'Saudi Arabia', 'com.sa': 'Saudi Arabia',
    'tr': 'Turkey', 'com.tr': 'Turkey', 'eg': 'Egypt', 'com.eg': 'Egypt',
    'ng': 'Nigeria', 'com.ng': 'Nigeria', 'gh': 'Ghana', 'com.gh': 'Ghana',
    'ke': 'Kenya', 'co.ke': 'Kenya', 'za': 'South Africa', 'co.za': 'South Africa',
    'ma': 'Morocco', 'pl': 'Poland', 'de': 'Germany', 'fr': 'France', 'it': 'Italy',
    'es': 'Spain', 'nl': 'Netherlands', 'be': 'Belgium',
    'uk': 'United Kingdom', 'co.uk': 'United Kingdom', 'org.uk': 'United Kingdom',
    'me.uk': 'United Kingdom', 'ltd.uk': 'United Kingdom', 'plc.uk': 'United Kingdom',
    'us': 'USA', 'ca': 'Canada', 'au': 'Australia', 'com.au': 'Australia',
    'net.au': 'Australia', 'org.au': 'Australia', 'jp': 'Japan', 'co.jp': 'Japan',
    'kr': 'South Korea', 'co.kr': 'South Korea', 'cn': 'China', 'com.cn': 'China',
    'hk': 'Hong Kong', 'com.hk': 'Hong Kong', 'tw': 'Taiwan', 'com.tw': 'Taiwan',
    'sg': 'Singapore', 'com.sg': 'Singapore', 'nz': 'New Zealand', 'co.nz': 'New Zealand',
    'ie': 'Ireland', 'pt': 'Portugal', 'se': 'Sweden', 'no': 'Norway', 'dk': 'Denmark',
    'fi': 'Finland', 'ch': 'Switzerland', 'at': 'Austria', 'cz': 'Czech Republic',
    'gr': 'Greece', 'il': 'Israel', 'ru': 'Russia', 'ua': 'Ukraine', 'ro': 'Romania',
    'hu': 'Hungary', 'bg': 'Bulgaria', 'hr': 'Croatia', 'rs': 'Serbia',
    'sk': 'Slovakia', 'si': 'Slovenia', 'lt': 'Lithuania', 'lv': 'Latvia', 'ee': 'Estonia',
    'az': 'Azerbaijan', 'ge': 'Georgia', 'am': 'Armenia', 'kz': 'Kazakhstan',
    'uz': 'Uzbekistan', 'qa': 'Qatar', 'kw': 'Kuwait', 'bh': 'Bahrain', 'om': 'Oman',
    'jo': 'Jordan', 'lb': 'Lebanon', 'iq': 'Iraq', 'ir': 'Iran', 'kh': 'Cambodia',
    'mm': 'Myanmar', 'np': 'Nepal', 'tn': 'Tunisia', 'dz': 'Algeria', 'et': 'Ethiopia',
    'tz': 'Tanzania', 'ug': 'Uganda', 'zm': 'Zambia', 'zw': 'Zimbabwe', 'mz': 'Mozambique',
    'ao': 'Angola', 'cm': 'Cameroon', 'ci': 'Ivory Coast', 'sn': 'Senegal'
  };

  function normalizeCountry(v) {
    var s = String(v == null ? '' : v).toLowerCase()
      .replace(/[._/]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (COUNTRY_NAMES[s]) return COUNTRY_NAMES[s];
    if (COUNTRY_ALIASES[s]) return COUNTRY_ALIASES[s];
    return '';
  }

  function hostLoose(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    try { return new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s).hostname.toLowerCase().replace(/^www\./, ''); }
    catch (e) {
      return s.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/^www\./, '');
    }
  }

  /** 只按完整后缀识别；example.co.ke 命中 co.ke，不会命中 co。 */
  function countryFromDomain(u) {
    var h = hostLoose(u);
    if (!h || h.indexOf('.') < 0) return '';
    var parts = h.split('.');
    for (var n = Math.min(3, parts.length - 1); n >= 1; n--) {
      var suffix = parts.slice(-n).join('.');
      if (CC_TLD[suffix]) return CC_TLD[suffix];
    }
    return '';
  }

  function countryInPhrase(phrase) {
    var p = String(phrase || '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
    if (!p) return '';
    var direct = normalizeCountry(p);
    if (direct) return direct;
    var parts = p.split(/\s*[,，|/]\s*/);
    for (var i = parts.length - 1; i >= 0; i--) {
      var x = parts[i].replace(/\s+\d[\d\s-]*$/, '').trim();
      var c = normalizeCountry(x);
      if (c) return c;
    }
    /* 明确上下文里允许国家名后面跟其它说明，如 “Vietnam and import solar panels” */
    var padded = ' ' + p.toLowerCase().replace(/[._]/g, ' ') + ' ';
    var keys = Object.keys(COUNTRY_NAMES).concat(Object.keys(COUNTRY_ALIASES))
      .filter(function (k) { return k.length >= 3; })
      .sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < keys.length; j++) {
      var k2 = keys[j];
      if (padded.indexOf(' ' + k2 + ' ') >= 0) {
        return COUNTRY_NAMES[k2] || COUNTRY_ALIASES[k2] || '';
      }
    }
    return '';
  }

  /** 明确写法才认：Country: Kenya / 国家：肯尼亚 / based in Vietnam */
  function detectCountryExplicit(text) {
    var s = String(text || '');
    if (!s) return '';
    var res = [
      /(?:country|国家\/地区|国家|country\/region)\s*[:：]\s*([A-Za-z\u00c0-\u024f\u4e00-\u9fff .'\-]{2,50})/i,
      /(?:based|located|headquartered|hq)\s+in\s+([A-Za-z\u00c0-\u024f\u4e00-\u9fff .'\-]{2,50})/i,
      /(?:address|地址)\s*[:：][^\n]{0,100}/i
    ];
    for (var i = 0; i < res.length; i++) {
      var m = s.match(res[i]);
      if (!m) continue;
      var c = countryInPhrase(m[1]);
      if (c) return c;
      if (i === 2) {
        /* 地址行没有捕获组：取整行末尾的国家 */
        var line = m[0].replace(/^(?:address|地址)\s*[:：]\s*/i, '');
        var parts = line.split(/\s*[,，]\s*/);
        for (var j = parts.length - 1; j >= 0; j--) {
          var c2 = normalizeCountry(parts[j].replace(/\s+\d[\d\s-]*$/, '').trim());
          if (c2) return c2;
        }
      }
    }
    return '';
  }

  /** 兼容旧调用：不再做城市/裸国家词推断 */
  function detectCountry(text, fallback) {
    return detectCountryExplicit(text) || normalizeCountry(fallback) || '';
  }

  /* ---------- 5.7.1 国家证据分级 ----------
     不再是「有就填、没有就空」，而是按证据强度取最可靠的一层：
     官网 ccTLD > JSON-LD addressCountry > Country:/based in > 页脚地址 > 国际电话区号。
     返回的 source 会显示在界面上，用户能知道这个国家是怎么来的。 */
  var COUNTRY_RANK = { domain: 5, jsonld: 4, explicit: 3, footer: 2, phone: 1, source: 5 };
  var ISO_EXTRA = { 'gb': 'United Kingdom', 'uk': 'United Kingdom' };
  /* 国际电话区号（+1 北美无法区分美/加，故意不收录） */
  var PHONE_CC = {
    '20': 'Egypt', '27': 'South Africa', '31': 'Netherlands', '32': 'Belgium',
    '33': 'France', '34': 'Spain', '36': 'Hungary', '39': 'Italy', '40': 'Romania',
    '44': 'United Kingdom', '45': 'Denmark', '46': 'Sweden', '47': 'Norway',
    '48': 'Poland', '49': 'Germany', '51': 'Peru', '52': 'Mexico', '54': 'Argentina',
    '55': 'Brazil', '56': 'Chile', '57': 'Colombia', '60': 'Malaysia', '61': 'Australia',
    '62': 'Indonesia', '63': 'Philippines', '64': 'New Zealand', '65': 'Singapore',
    '66': 'Thailand', '81': 'Japan', '82': 'South Korea', '84': 'Vietnam',
    '86': 'China', '90': 'Turkey', '91': 'India', '92': 'Pakistan', '94': 'Sri Lanka',
    '212': 'Morocco', '234': 'Nigeria', '254': 'Kenya', '255': 'Tanzania', '256': 'Uganda',
    '351': 'Portugal', '353': 'Ireland', '358': 'Finland', '359': 'Bulgaria',
    '380': 'Ukraine', '385': 'Croatia', '386': 'Slovenia', '421': 'Slovakia',
    '593': 'Ecuador', '880': 'Bangladesh', '966': 'Saudi Arabia', '971': 'UAE',
    '974': 'Qatar', '965': 'Kuwait', '968': 'Oman', '973': 'Bahrain',
    '994': 'Azerbaijan', '995': 'Georgia', '998': 'Uzbekistan'
  };

  function countryFromJsonLd(text) {
    var s = String(text || '');
    var re = /"addressCountry"\s*:\s*"([A-Za-z\u00c0-\u024f ]{2,40})"/gi, m;
    while ((m = re.exec(s))) {
      var raw = m[1].replace(/\s+/g, ' ').trim();
      if (/^[A-Za-z]{2}$/.test(raw)) {
        var code = raw.toLowerCase();
        if (ISO_EXTRA[code]) return ISO_EXTRA[code];
        if (CC_TLD[code]) return CC_TLD[code];
        continue;
      }
      var c = normalizeCountry(raw);
      if (c) return c;
    }
    return '';
  }

  function countryFromPhone(text) {
    var s = String(text || '');
    var cands = [], m;
    var re = /(?:tel:|phone|tel\.?|call|whatsapp|mobile)[^\n]{0,48}?(\+\d{1,3})/gi;
    while ((m = re.exec(s)) && cands.length < 10) cands.push(m[1]);
    var re2 = /href\s*=\s*["']tel:(\+\d{1,3})/gi;
    while ((m = re2.exec(s)) && cands.length < 16) cands.push(m[1]);
    for (var i = 0; i < cands.length; i++) {
      var digits = cands[i].replace(/\D/g, '');
      for (var n = Math.min(3, digits.length); n >= 1; n--) {
        var hit = PHONE_CC[digits.slice(0, n)];
        if (hit) return hit;
      }
    }
    /* 兜底：正文里所有国际号码按区号投票，至少 2 票或只有一个候选区号才采用 */
    var all = s.match(/\+\d{1,3}/g) || [];
    if (!all.length) return '';
    var votes = {};
    all.forEach(function (x) {
      var d = x.replace(/\D/g, '');
      for (var n2 = Math.min(3, d.length); n2 >= 1; n2--) {
        var cc2 = PHONE_CC[d.slice(0, n2)];
        if (cc2) { votes[cc2] = (votes[cc2] || 0) + 1; break; }
      }
    });
    var keys = Object.keys(votes);
    if (!keys.length) return '';
    keys.sort(function (a, b) { return votes[b] - votes[a]; });
    if (keys.length > 1 && votes[keys[0]] === votes[keys[1]]) return '';
    if (votes[keys[0]] >= 2 || keys.length === 1) return keys[0];
    return '';
  }

  var ADDRESS_HINT = /\b(?:address|head ?office|headquarters|registered office|office|factory|warehouse|plant)\b|地址|总部/i;
  var STREET_HINT = /\b(?:P\.?O\.? ?Box|Street|Road|Avenue|Suite|Floor|Industrial Area|District|Building)\b/i;
  function countryFromFooter(text) {
    var lines = String(text || '').split(/\n+/);
    for (var i = 0; i < lines.length && i < 500; i++) {
      var line = lines[i].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line || line.length > 240) continue;
      if (!ADDRESS_HINT.test(line) && !STREET_HINT.test(line)) continue;
      var parts = line.split(/\s*[,，]\s*/);
      for (var j = parts.length - 1; j >= 0 && j >= parts.length - 4; j--) {
        var c = normalizeCountry(parts[j].replace(/[.;].*$/, '').replace(/\s+\d[\d\s-]*$/, '').trim());
        if (c) return c;
      }
      var tail = line.split(/\s+/).slice(-4).join(' ');
      var c2 = countryInPhrase(tail);
      if (c2) return c2;
    }
    return '';
  }

  /**
   * @param {string} website 公司官网
   * @param {string} text 已抓到的页面正文
   * @param {boolean} allowPage 目录详情页正文混有多家公司，false 时只用官网后缀
   */
  function countryEvidence(website, text, allowPage) {
    var d = countryFromDomain(website);
    if (d) return { country: d, source: 'domain' };
    if (!allowPage || !text) return { country: '', source: '' };
    var j = countryFromJsonLd(text);
    if (j) return { country: j, source: 'jsonld' };
    var e = detectCountryExplicit(text);
    if (e) return { country: e, source: 'explicit' };
    var f = countryFromFooter(text);
    if (f) return { country: f, source: 'footer' };
    var p = countryFromPhone(text);
    if (p) return { country: p, source: 'phone' };
    return { country: '', source: '' };
  }

  /* ---------- 5.7.2 目标市场匹配 ---------- */
  var REGION_SETS = {
    'Southeast Asia': ['Indonesia', 'Vietnam', 'Philippines', 'Malaysia', 'Thailand', 'Singapore', 'Cambodia', 'Myanmar', 'Laos', 'Brunei'],
    'Middle East': ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Iraq', 'Iran', 'Israel', 'Turkey', 'Egypt'],
    'Africa': ['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Ethiopia', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe', 'Mozambique', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal'],
    'Europe': ['Poland', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'United Kingdom', 'Ireland', 'Portugal', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Czech Republic', 'Greece', 'Romania', 'Hungary', 'Bulgaria', 'Croatia', 'Serbia', 'Slovakia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Turkey', 'Russia', 'Ukraine'],
    'Latin America': ['Mexico', 'Peru', 'Chile', 'Colombia', 'Brazil', 'Argentina', 'Ecuador'],
    'USA': ['USA']
  };
  /** true=属于该市场，false=明确不属于，null=无法判断（保留结果） */
  function inRegion(country, region) {
    if (!region || region === '全球' || !country) return null;
    var set = REGION_SETS[region];
    if (!set) return null;
    return set.indexOf(country) >= 0;
  }

  /* ---------- 5.7.3 联系页发现 ---------- */
  var CONTACT_HINT = /contact|kontakt|contacto|contactez|contatt|iletisim|li[êe]n h[êe]|联系/i;
  function contactUrlFromLinks(links, website) {
    var own = registrableDomain(website);
    for (var i = 0; i < (links || []).length; i++) {
      var l = links[i] || {};
      var d = registrableDomain(l.url);
      if (!own || d !== own) continue;
      var path = '';
      try { path = new URL(l.url).pathname; } catch (e) { path = l.url; }
      if (!CONTACT_HINT.test(path) && !CONTACT_HINT.test(l.label || '')) continue;
      if (/\.(?:pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?)$/i.test(path)) continue;
      return String(l.url).split('#')[0];
    }
    return '';
  }

  /* ---------- 5.7.4 合并去重（域名 + 名称） ----------
     只按完整 host 当键会漏掉 shop.acme.com / acme.com、
     acme.com / acme.co.uk、领英记录 / 官网记录这三类重复。 */
  var LEGAL_WORDS = /\b(?:co|company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|plc|gmbh|ag|sa|sas|sarl|srl|spa|bv|nv|pte|pvt|trading|trade|import|imports|export|exports|group|holding|holdings|enterprise|enterprises|international|intl|industries|industrial)\b/g;
  var CN_LEGAL = /(有限责任公司|股份有限公司|有限公司|进出口|贸易|商贸|实业|集团|控股|科技|股份|公司)/g;
  function normCompanyName(v) {
    var s = String(v == null ? '' : v).toLowerCase();
    if (!s) return '';
    s = s.replace(CN_LEGAL, ' ').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ');
    s = s.replace(LEGAL_WORDS, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  function fillMissing(target, c) {
    ['email', 'phone', 'website', 'country', 'desc', 'linkedin', 'profileUrl', 'type', 'why', 'approach'].forEach(function (k) {
      if (!target[k] && c[k]) target[k] = c[k];
    });
    if (!target._text && c._text) target._text = c._text;
    if (!target._verified && c._verified) target._verified = true;
    if (!target._aiVerified && c._aiVerified) target._aiVerified = true;
    if (!target._aiSearch && c._aiSearch) target._aiSearch = true;
    if (!target._contactUrl && c._contactUrl) target._contactUrl = c._contactUrl;
    if (!target._inquiry && c._inquiry) target._inquiry = true;
    /* 名称：优先保留不是域名拼出来的那个 */
    if (!target._nameFromDomain && target.name) { /* keep */ }
    else if (c.name && !c._nameFromDomain) { target.name = c.name; target._nameFromDomain = false; }
    if (c._countrySrc && (COUNTRY_RANK[c._countrySrc] || 0) > (COUNTRY_RANK[target._countrySrc] || 0)) {
      target._countrySrc = c._countrySrc;
    }
    if (c.source && target._sources.indexOf(c.source) < 0) target._sources.push(c.source);
    (c._sources || []).forEach(function (s) {
      if (target._sources.indexOf(s) < 0) target._sources.push(s);
    });
  }

  function domainCore(u) {
    var r = registrableDomain(u || '');
    return r ? r.split('.')[0] : '';
  }

  function mergeCandidates(list) {
    var out = [], byDomain = {}, byName = {};
    function register(rec) {
      var d = registrableDomain(rec.website || '');
      if (d) byDomain[d] = rec;
      var n = normCompanyName(rec.name);
      if (n && n.length >= 4) {
        byName[n] = byName[n] || [];
        if (byName[n].indexOf(rec) < 0) byName[n].push(rec);
      }
    }
    (list || []).forEach(function (c) {
      if (!c || !c.name) return;
      var d = registrableDomain(c.website || '');
      var n = normCompanyName(c.name);
      var rec = d ? byDomain[d] : null;
      /* 同名合并：必须同国（或一方未知），且域名核心词一致（或一方没有官网）。
         这样 acme.com 能并上 acme.co.ke，但不会把 acmesolar.com 和 acme.co.ke 并掉。 */
      if (!rec && n) {
        var cands = byName[n] || [];
        for (var i = 0; i < cands.length; i++) {
          var x = cands[i];
          if (x.country && c.country && x.country !== c.country) continue;
          var xc = domainCore(x.website), cc = domainCore(c.website);
          if (xc && cc && xc !== cc) continue;
          rec = x; break;
        }
      }
      if (rec) {
        fillMissing(rec, c);
        register(rec);
        return;
      }
      c._sources = (c._sources || []).slice();
      if (c.source && c._sources.indexOf(c.source) < 0) c._sources.push(c.source);
      if (!c._sources.length) c._sources.push('目录');
      out.push(c);
      register(c);
    });
    return out;
  }

  /* ---------- 5.8 抓页 / 二次补全 ---------- */
  async function pageInfo(url, timeout) {
    throwIfCancelled();
    var body = await fetchRaw(url, timeout || 15000);
    return {
      text: body.text || '',
      html: !!body.html,
      links: extractLinks(body, url),
      contacts: extractContacts(body.text || '', domainOf(url))
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
    throwIfCancelled();
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
    /* 搜索结果片段不作为国家证据，避免把代理站/其他国家的片段算到这家公司头上 */
    return { emails: c.emails, phones: c.phones, was: c.was, country: '' };
  }

  /* ---------- 5.9 AI 批量买家意向评分 ---------- */
  async function aiScoreBatch(prod, market, leads) {
    throwIfCancelled();
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
    var txt = await AgnesAI.ask(prompt, { json: true, temperature: 0.1, maxTokens: Math.min(4200, 900 + leads.length * 90), timeout: 60000 });
    var res = AgnesAI.parseLoose(txt);
    return (res && res.leads) || [];
  }

  /* ---------- 6. 连接器 ---------- */
  var SITE_EXCLUDE = ['alibaba.com', 'made-in-china.com', 'aliexpress.com', 'amazon.com', 'ebay.com',
    'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'indiamart.com',
    'tradekey.com', 'globalsources.com', 'ec21.com', 'linkedin.com']
    .map(function (d) { return '-site:' + d; }).join(' ');
  var SITE_EXCLUDE_NO_LI = SITE_EXCLUDE.replace('-site:linkedin.com', '').trim();

  /** DDG / 搜索页风控挑战：HTTP 可能是 200/202，但正文没有结果。
   *  必须显式识别，否则会被当成「确实 0 家」，把网络风控误导成关键词问题。 */
  function looksChallenge(body) {
    var t = String((body && body.text) || '');
    return /anomaly-modal|Unfortunately, bots use DuckDuckGo|challenge-form|bots use DuckDuckGo too/i.test(t);
  }

  /** DDG 搜索 → 链接列表（html 失败自动回退 lite） */
  async function searchLinks(q, allowLinkedin) {
    var ex = allowLinkedin ? SITE_EXCLUDE_NO_LI : SITE_EXCLUDE;
    var full = (q + ' ' + ex).trim();
    var errors = [];
    try {
      var body = await fetchRaw('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(full), 22000);
      if (looksChallenge(body)) throw new Error('DuckDuckGo 风控挑战页');
      var links = extractLinks(body, 'https://html.duckduckgo.com/');
      if (links.length) return links;
      errors.push('html 0 结果');
    } catch (e) {
      if (e && e.cancelled) throw e;
      errors.push(e.message);
    }
    try {
      var body2 = await fetchRaw('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(full), 20000);
      if (looksChallenge(body2)) throw new Error('DuckDuckGo 风控挑战页');
      return extractLinks(body2, 'https://lite.duckduckgo.com/');
    } catch (e2) {
      if (e2 && e2.cancelled) throw e2;
      errors.push(e2.message);
      var err = new Error(errors.join(' | '));
      err.code = 'FETCH_FAILED';
      throw err;
    }
  }
  /** 并发执行，保持分组；同时返回成功/失败数，供来源层区分「没结果」与「抓不到」 */
  function settleGroups(list) {
    return Promise.allSettled(list).then(function (rs) {
      if (isCancelled()) return { groups: list.map(function () { return []; }), ok: 0, fail: 0, errors: [] };
      var groups = [], errors = [];
      rs.forEach(function (r) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          groups.push(r.value);
        } else {
          groups.push([]);
          errors.push((r.reason && r.reason.message) || '抓取失败');
        }
      });
      return { groups: groups, ok: rs.length - errors.length, fail: errors.length, errors: errors };
    });
  }
  /** 所有子请求都失败时抛错，让 find.html 归因为网络/限流，而不是关键词问题 */
  function fetchFailedError(label, res) {
    var e = new Error(label + '抓取失败：' + ((res && res.errors) || []).slice(0, 2).join(' | '));
    e.code = 'FETCH_FAILED';
    return e;
  }

  async function srcDdg(ctx) {
    throwIfCancelled();
    var qs = (ctx.queries || []).slice(0, 5);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var res = await settleGroups(qs.map(function (o) { return searchLinks(o.q, false); }));
    if (res.fail >= qs.length) throw fetchFailedError('DuckDuckGo ', res);
    var groups = res.groups;
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        var d = domainOf(l.url);
        if (!d || isBlocked(d) || seen[d]) return;
        seen[d] = 1;
        out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'DuckDuckGo', _nameFromDomain: true });
      });
    });
    return out.slice(0, 40);
  }

  async function srcLinkedin(ctx) {
    throwIfCancelled();
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '"' }];
    var groups = (await settleGroups(qs.map(function (o) {
      return searchLinks('site:linkedin.com/company ' + o.q, true);
    }))).groups;
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
    throwIfCancelled();
    var qs = (ctx.queries || []).slice(0, 2);
    if (!qs.length) qs = [{ q: '"' + ctx.product + '" ' + (ctx.type || 'distributor') }];
    var res = await settleGroups(qs.map(function (o) {
      var url = 'https://www.bing.com/search?q=' + encodeURIComponent((o.q + ' ' + SITE_EXCLUDE).trim()) + '&count=30';
      return fetchRaw(url, 25000).then(function (body) { return extractLinks(body, 'https://www.bing.com/'); });
    }));
    if (res.fail >= qs.length) throw fetchFailedError('Bing ', res);
    var groups = res.groups;
    var out = [], seen = {};
    groups.forEach(function (links) {
      links.forEach(function (l) {
        var d = domainOf(l.url);
        if (!d || isBlocked(d) || seen[d]) return;
        seen[d] = 1;
        out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: 'Bing', _nameFromDomain: true });
      });
    });
    return out.slice(0, 30);
  }

  async function srcEuropages(ctx) {
    throwIfCancelled();
    /* 官方分页：/companies/pg-2/<product>.html —— 每页约 20 家，取前 3 页 */
    var enc = encodeURIComponent(ctx.product);
    var pages = [
      'https://www.europages.co.uk/companies/' + enc + '.html',
      'https://www.europages.co.uk/companies/pg-2/' + enc + '.html',
      'https://www.europages.co.uk/companies/pg-3/' + enc + '.html'
    ];
    var bodies = await Promise.allSettled(pages.map(function (u) { return fetchRaw(u, 25000); }));
    throwIfCancelled();
    if (bodies.length && bodies.every(function (r) { return r.status !== 'fulfilled' || !r.value; })) {
      var first = bodies[0] && bodies[0].reason;
      var err = new Error('Europages 抓取失败：' + ((first && first.message) || '全部页面不可达'));
      err.code = 'FETCH_FAILED';
      throw err;
    }
    var out = [], seen = {};
    function add(name, link) {
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (isJunkName(name)) return;
      if (/^(view|portfolio|all )/i.test(name)) return;
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
      var rawCountry = (nl > 0 ? chunk.slice(0, nl) : chunk).replace(/[*_]/g, '').trim();
      if (!rawCountry || rawCountry.length > 40) continue;
      /* 这是目录明确给出的 "Buyer From"，属于可信字段；
         "California, United States" 这类要收敛成 USA，而不是整段州名 */
      var country = countryInPhrase(rawCountry) || normalizeCountry(rawCountry) || rawCountry;
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
        _countrySrc: 'source',
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
        _countrySrc: 'source',
        desc: '美国进口商（Zauba 海关记录）· ' + (fallbackProduct || ''),
        type: 'importer',
        _inquiry: true,
        source: 'Zauba'
      });
    }
    return out;
  }

  async function srcGo4World(ctx) {
    throwIfCancelled();
    var url = 'https://www.go4worldbusiness.com/find?searchText=' + encodeURIComponent(ctx.product) + '&type=buyers';
    var body = await fetchRaw(url, 20000);
    return parseGo4World(body.text, ctx.product);
  }

  async function srcZauba(ctx) {
    throwIfCancelled();
    var slug = String(ctx.product).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var listUrl = 'https://www.zauba.com/import-' + slug + '-hs-code.html';
    var body = await fetchRaw(listUrl, 20000);
    var txt = body.text || '';
    var m = txt.match(/\]\((https?:\/\/www\.zauba\.com\/[^)\s]*?-importers)\)/i);
    if (m) {
      try {
        var b2 = await fetchRaw(m[1], 20000);
        return parseZauba(b2.text, ctx.product);
      } catch (e) { if (e && e.cancelled) throw e; /* 用列表页兜底 */ }
    }
    throwIfCancelled();
    return parseZauba(txt, ctx.product);
  }

  async function srcDirectory(ctx, cfg) {
    throwIfCancelled();
    var body = await fetchRaw(cfg.url(ctx), 25000);
    var base = cfg.base;
    var baseHost = domainOf(base);
    var links = extractLinks(body, base);
    var out = [], seen = {};
    links.forEach(function (l) {
      var d = domainOf(l.url);
      if (!d || isBlocked(d) || d === baseHost || seen[d]) return;
      seen[d] = 1;
      out.push({ name: nameFromDomain(d), website: 'https://' + d, desc: l.label || '', source: cfg.name, _nameFromDomain: true });
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

  /** 核验模型点名的公司：官网可达 + 标题/域名与公司名匹配，否则视为编造 */
  async function verifyAiCompany(c) {
    var website = String(c.website || '').trim();
    if (!website) return false;
    if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
    var d = domainOf(website);
    if (!d || isBlocked(d)) return false;
    var info = await pageInfo('https://' + d, 10000);
    var text = String(info.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 120) return false;
    var title = pageTitle(info.text);
    if (!aiNameMatches(c.name, d, title)) {
      var core = nameTokens(c.name).join(' ');
      if (!core || text.toLowerCase().indexOf(core) < 0) return false;
    }
    c.website = 'https://' + d;
    c._text = info.text;
    c._aiVerified = true;
    if (!c.desc) c.desc = text.slice(0, 160);
    /* 模型给的国家可能是猜的：只保留官网后缀或页面明确证据 */
    var ev = countryEvidence(c.website, text, true);
    c.country = ev.country;
    c._countrySrc = ev.source;
    var ct = info.contacts || { emails: [], phones: [], was: [] };
    if (ct.emails.length && !c.email) c.email = ct.emails[0];
    if (!c.phone) {
      if (ct.was.length) c.phone = '+' + ct.was[0];
      else if (ct.phones.length) c.phone = ct.phones[0];
    }
    return true;
  }

  /**
   * AI 来源：搜索规划 + 真实网络核验。
   * - 模型给的搜索词走真实 DuckDuckGo；
   * - 模型点名的公司必须官网可访问且名称匹配；
   * - 两条路径产出的候选都标记 _aiVerified，未标记的由 pipeline 兜底丢弃。
   */
  async function srcAi(ctx) {
    throwIfCancelled();
    if (typeof AgnesAI === 'undefined') throw new Error('AI 模块未加载');
    var res = await AgnesAI.findBuyers(ctx.product, ctx.region || '全球', ctx.type, ['web', 'linkedin', 'facebook']);
    throwIfCancelled();
    var cs = (res && res.companies) || [];
    var aq = (res && res.queries) || [];
    var stats = { suggested: cs.length, verified: 0, dropped: 0, fromSearch: 0, queries: 0 };
    var out = [], seen = {};

    /* 1) 模型点名的公司：逐家抓官网核验（最多 6 家，2 并发） */
    var cands = cs.filter(function (c) {
      return c && c.name && c.website;
    }).slice(0, 6);
    for (var i = 0; i < cands.length; i += 2) {
      await Promise.all(cands.slice(i, i + 2).map(async function (c) {
        try {
          if (!(await verifyAiCompany(c))) { stats.dropped++; return; }
          stats.verified++;
          var d = domainOf(c.website);
          if (!d || seen[d]) return;
          seen[d] = 1;
          out.push({
            name: c.name,
            country: c.country || '',
            website: c.website,
            email: c.email || '',
            phone: c.phone || '',
            linkedin: c.linkedin || '',
            desc: c.why || c.desc || '',
            source: 'AI',
            _aiVerified: true,
            _text: c._text
          });
        } catch (e) { stats.dropped++; }
      }));
    }
    /* 没有官网、或超出核验上限的模型候选，一律视为未验证 */
    stats.dropped += Math.max(0, cs.length - cands.length);

    /* 2) 模型规划的本地化搜索词：走真实搜索，结果本身就是真实域名 */
    var qs = aq.filter(Boolean).slice(0, 4);
    stats.queries = qs.length;
    if (qs.length) {
      var groups = (await settleGroups(qs.map(function (q) { return searchLinks(q, false); }))).groups;
      groups.forEach(function (links) {
        links.forEach(function (l) {
          var d = domainOf(l.url);
          if (!d || isBlocked(d) || seen[d]) return;
          seen[d] = 1;
          stats.fromSearch++;
          out.push({
            name: nameFromDomain(d),
            website: 'https://' + d,
            desc: l.label || '',
            source: 'AI',
            _aiVerified: true,   /* 已入池（真实搜索结果或官网核验通过），供 pipeline 兜底 */
            _aiSearch: true,     /* 搜索路径来的，界面不显示「已核验」 */
            _nameFromDomain: true
          });
        });
      });
    }

    if (global.Sources) global.Sources.lastAiStats = stats;
    return out.slice(0, 30);
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
    { id: 'ai',             name: 'AI 挖掘',        desc: 'AI 规划搜索词 + 官网核验', def: true }
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
    throwIfCancelled();
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
    registrableDomain: registrableDomain,
    nameFromDomain: nameFromDomain,
    companyNameFromTitle: companyNameFromTitle,
    pageTitle: pageTitle,
    isBlocked: isBlocked,
    isSellerName: isSellerName,
    aiNameMatches: aiNameMatches,
    buildQueries: buildQueries,
    ruleCheck: ruleCheck,
    compositeScore: compositeScore,
    tierOf: tierOf,
    detectCountry: detectCountry,
    detectCountryExplicit: detectCountryExplicit,
    countryFromDomain: countryFromDomain,
    countryEvidence: countryEvidence,
    countryFromJsonLd: countryFromJsonLd,
    countryFromPhone: countryFromPhone,
    countryFromFooter: countryFromFooter,
    inRegion: inRegion,
    normalizeCountry: normalizeCountry,
    isJunkName: isJunkName,
    isJunkEmail: isJunkEmail,
    isFreeMail: isFreeMail,
    rankEmails: rankEmails,
    emailRank: emailRank,
    dropSharedEmails: dropSharedEmails,
    contactUrlFromLinks: contactUrlFromLinks,
    mergeCandidates: mergeCandidates,
    normCompanyName: normCompanyName,
    pageInfo: pageInfo,
    pickWebsite: pickWebsite,
    enrichContacts: enrichContacts,
    aiScoreBatch: aiScoreBatch,
    parseGo4World: parseGo4World,
    parseZauba: parseZauba,
    cancel: cancel,
    resetCancel: resetCancel,
    isCancelled: isCancelled,
    cancelError: cancelError
  };
})(window);
