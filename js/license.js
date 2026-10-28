/* ============================================================
   FT Compass · License v1.0
   试用（15 天 / 30 次）+ 离线 ECDSA 激活码
   - 公钥内置，私钥只在本地 tools/gen-key.mjs 生成、永不进仓库
   - 四重冗余存储（IndexedDB + 2×localStorage + cookie），取极值合并
   - 锁屏由父窗口渲染，iframe 内自动委托
   规格：docs/superpowers/specs/2026-10-20-license-design.md
   ============================================================ */
(function (global) {
  'use strict';

  var APP_MAJOR = '1';
  var TRIAL_DAYS = 15;
  var TRIAL_USES = 30;

  /* 购买链接：填你的发卡台/微店地址，留空则提示联系卖家 */
  var BUY_URL = '';

  /* tools/gen-key.mjs 生成的公钥（SPKI DER base64） */
  var PUBKEY_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE4e/RyCWhmYz2nA8Vq09VdIs9Te88dq6pna64CRucbh8Gf5VR8NXXPb1p/LCFNGfqZlnu6WAVD40ApbK5S4G3pg==';

  var DAY = 86400000;
  var DB_NAME = 'ft_license';
  var STORE = 'kv';
  var K_TRIAL_LS = ['_9f3a2c', '_b71c4e'];
  var K_LIC_LS = '_c5d8e1';
  var K_TRIAL_CK = '_ftc9';
  var XOR_KEY = 'FT-Compass-2026';

  var _trial = null;
  var _lic = null;
  var _status = null;
  var _readyPromise = null;
  var _pubKey = null;
  var _listeners = [];
  var _lockReason = null;
  var _lastRaw = null;

  /* ---------------- 编码工具 ---------------- */
  function utf8Encode(s) { return new TextEncoder().encode(s); }
  function utf8Decode(b) { return new TextDecoder().decode(b); }

  function bytesToB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function xorBytes(bytes) {
    var k = utf8Encode(XOR_KEY);
    var out = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k[i % k.length];
    return out;
  }
  /* 观感混淆：不是加密，只是让键值看起来像乱码（规格 5.3 已说明） */
  function seal(obj) {
    try { return bytesToB64url(xorBytes(utf8Encode(JSON.stringify(obj)))); }
    catch (e) { return ''; }
  }
  function unseal(str) {
    try { return JSON.parse(utf8Decode(xorBytes(b64urlToBytes(str)))); }
    catch (e) { return null; }
  }

  /* ---------------- 基础存储 ---------------- */
  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} }

  function setCookie(name, val) {
    try {
      document.cookie = name + '=' + val + ';path=/;max-age=' + (2 * 365 * 86400) + ';SameSite=Lax';
    } catch (e) {}
  }
  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  var _dbPromise = null;
  function db() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve) {
      if (!global.indexedDB) return resolve(null);
      var req;
      try { req = global.indexedDB.open(DB_NAME, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        try { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); } catch (e) {}
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return _dbPromise;
  }
  function idbGet(k) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (resolve) {
        try {
          var tx = d.transaction(STORE, 'readonly');
          var rq = tx.objectStore(STORE).get(k);
          rq.onsuccess = function () { resolve(rq.result == null ? null : rq.result); };
          rq.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function idbSet(k, v) {
    return db().then(function (d) {
      if (!d) return;
      return new Promise(function (resolve) {
        try {
          var tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(v, k);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) { resolve(); }
      });
    });
  }

  /* ---------------- 试用状态 ---------------- */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function validTrial(t) {
    return !!t && typeof t === 'object'
      && isNum(t.firstSeen) && isNum(t.lastSeen) && isNum(t.uses)
      && t.firstSeen > 0 && t.firstSeen <= Date.now() + DAY
      && t.uses >= 0 && t.uses <= 10000;
  }

  function readTrialRaw() {
    var raws = [];
    K_TRIAL_LS.forEach(function (k) { var v = lsGet(k); if (v) raws.push(v); });
    var c = getCookie(K_TRIAL_CK);
    if (c) raws.push(c);
    return idbGet('state').then(function (v) {
      if (v) raws.push(v);
      return raws;
    });
  }

  function mergeTrial(list) {
    if (!list.length) return null;
    var now = Date.now();
    var out = { v: 1, firstSeen: Infinity, lastSeen: 0, uses: 0, tampered: false };
    list.forEach(function (t) {
      out.firstSeen = Math.min(out.firstSeen, t.firstSeen);
      out.lastSeen = Math.max(out.lastSeen, t.lastSeen);
      out.uses = Math.max(out.uses, t.uses);
      out.tampered = out.tampered || !!t.tampered;
    });
    if (!isFinite(out.firstSeen) || out.firstSeen <= 0) out.firstSeen = now;
    if (!out.lastSeen) out.lastSeen = now;
    return out;
  }

  function persistTrial() {
    if (!_trial) return;
    var raw = seal(_trial);
    if (!raw) return;
    /* 值没变就不写，避免父子窗口 storage 事件互相触发 */
    if (raw === _lastRaw) return;
    _lastRaw = raw;
    K_TRIAL_LS.forEach(function (k) { lsSet(k, raw); });
    setCookie(K_TRIAL_CK, raw);
    idbSet('state', raw);
  }

  /* ---------------- 激活码 ---------------- */
  function hasCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.subtle.verify);
  }

  function importPub() {
    if (_pubKey) return Promise.resolve(_pubKey);
    return global.crypto.subtle.importKey(
      'spki',
      b64urlToBytes(PUBKEY_B64),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    ).then(function (k) { _pubKey = k; return k; });
  }

  function verifyCode(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (code.indexOf('FT1.') !== 0) {
      return Promise.resolve({ ok: false, code: 'FORMAT', msg: '激活码格式不正确，请完整粘贴' });
    }
    var parts = code.split('.');
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      return Promise.resolve({ ok: false, code: 'FORMAT', msg: '激活码格式不正确，请完整粘贴' });
    }
    var pj;
    try { pj = JSON.parse(utf8Decode(b64urlToBytes(parts[1]))); }
    catch (e) { return Promise.resolve({ ok: false, code: 'FORMAT', msg: '激活码内容无法解析' }); }
    if (!pj || pj.v !== 1 || !pj.id || !pj.co) {
      return Promise.resolve({ ok: false, code: 'FORMAT', msg: '激活码内容不完整' });
    }
    /* 永久买断：允许旧版本（ver ≤ 当前大版本）的码继续使用，只有更高版本的码才拒绝 */
    var codeMajor = parseInt(pj.ver, 10);
    var appMajor = parseInt(APP_MAJOR, 10);
    if (!isFinite(codeMajor) || codeMajor > appMajor) {
      return Promise.resolve({ ok: false, code: 'VERSION', msg: '此激活码适用于 ' + pj.ver + '.x 版本，请升级软件' });
    }
    if (!hasCrypto()) {
      return Promise.resolve({ ok: false, code: 'CRYPTO', msg: '当前环境不支持离线验签，请通过 https 网址打开' });
    }
    return importPub()
      .then(function (key) {
        return global.crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          b64urlToBytes(parts[2]),
          utf8Encode(parts[1])
        );
      })
      .then(function (ok) {
        if (!ok) return { ok: false, code: 'SIGNATURE', msg: '激活码无效，请核对后重试' };
        return { ok: true, payload: pj, code: code };
      })
      .catch(function (e) {
        return { ok: false, code: 'SIGNATURE', msg: '激活码校验失败：' + ((e && e.message) || e) };
      });
  }

  function readLicense() {
    return Promise.all([
      idbGet('license'),
      Promise.resolve(lsGet(K_LIC_LS))
    ]).then(function (arr) {
      for (var i = 0; i < arr.length; i++) {
        if (!arr[i]) continue;
        var o = unseal(arr[i]);
        if (o && o.code) return o;
      }
      return null;
    });
  }

  function persistLicense() {
    if (!_lic) return;
    var raw = seal(_lic);
    if (!raw) return;
    lsSet(K_LIC_LS, raw);
    idbSet('license', raw);
  }

  /* ---------------- 状态 ---------------- */
  function computeStatus() {
    var now = Date.now();
    if (_lic && _lic.payload) {
      return {
        state: 'pro', pro: true,
        company: _lic.payload.co, id: _lic.payload.id,
        daysLeft: 0, usesLeft: 0,
        used: _trial ? _trial.uses : 0,
        limit: { days: TRIAL_DAYS, uses: TRIAL_USES },
        tampered: !!(_trial && _trial.tampered)
      };
    }
    var t = _trial || { firstSeen: now, lastSeen: now, uses: 0 };
    var daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((now - t.firstSeen) / DAY));
    var usesLeft = Math.max(0, TRIAL_USES - t.uses);
    return {
      state: (daysLeft <= 0 || usesLeft <= 0) ? 'trial_over' : 'trial',
      pro: false, company: '', id: '',
      daysLeft: daysLeft, usesLeft: usesLeft, used: t.uses,
      limit: { days: TRIAL_DAYS, uses: TRIAL_USES },
      tampered: !!t.tampered
    };
  }

  function emit() {
    _listeners.slice().forEach(function (fn) {
      try { fn(_status); } catch (e) {}
    });
  }

  function init() {
    return loadState(true, true);
  }

  /** autoLock：试用结束时是否弹锁屏；writeBack：是否把合并结果落盘 */
  function loadState(autoLock, writeBack) {
    return readLicense()
      .then(function (lic) {
        _lic = lic;
        if (!lic) return null;
        return verifyCode(lic.code).then(function (r) {
          if (r.ok) { _lic.payload = r.payload; return true; }
          _lic = null;
          return false;
        });
      })
      .then(function () { return readTrialRaw(); })
      .then(function (raws) {
        var list = raws.map(unseal).filter(validTrial);
        _trial = mergeTrial(list);
        var now = Date.now();
        if (!_trial) {
          _trial = { v: 1, firstSeen: now, lastSeen: now, uses: 0, tampered: false };
        } else if (now < _trial.lastSeen - DAY) {
          _trial.tampered = true;
        }
        if (writeBack) {
          if (!_trial.lastSeen) _trial.lastSeen = now;
          _trial.lastSeen = Math.max(now, _trial.lastSeen);
          persistTrial();
        }
        _status = computeStatus();
        if (autoLock && _status.state === 'trial_over') {
          var reason = _status.usesLeft <= 0 ? 'uses' : 'expired';
          whenReady(function () { showLock(reason); });
        }
        renderBadge();
        emit();
        return _status;
      });
  }

  function ready() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = init();
    return _readyPromise;
  }

  function refresh() {
    _readyPromise = null;
    return ready();
  }

  /* 跨 iframe 同步：别的文档改了 localStorage → 本窗口只更新徽章，不写回、不弹锁屏 */
  function reloadSoft() {
    return loadState(false, false);
  }

  try {
    global.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      var keys = K_TRIAL_LS.concat([K_LIC_LS]);
      if (keys.indexOf(e.key) < 0) return;
      reloadSoft();
    });
  } catch (e) {}

  /* ---------------- 对外接口 ---------------- */
  function status() {
    return _status || computeStatus();
  }

  function consume(kind) {
    return ready().then(function () {
      var s = _status;
      if (s.pro) return true;
      if (s.usesLeft <= 0) { showLock('uses'); return false; }
      if (s.daysLeft <= 0) { showLock('expired'); return false; }
      _trial.uses += 1;
      _trial.lastSeen = Date.now();
      persistTrial();
      _status = computeStatus();
      renderBadge();
      emit();
      return true;
    });
  }

  function refund(kind) {
    return ready().then(function () {
      if (_status.pro || !_trial || _trial.uses <= 0) return;
      _trial.uses -= 1;
      persistTrial();
      _status = computeStatus();
      renderBadge();
      emit();
    });
  }

  function activate(code) {
    return verifyCode(code).then(function (r) {
      if (!r.ok) return r;
      _lic = { code: r.code, payload: r.payload, activatedAt: Date.now() };
      persistLicense();
      _status = computeStatus();
      renderBadge();
      emit();
      return { ok: true, msg: '激活成功' };
    });
  }

  function guard() {
    var s = status();
    if (s.pro) return true;
    if (s.state === 'trial_over') {
      showLock(s.usesLeft <= 0 ? 'uses' : 'expired');
      return false;
    }
    return true;
  }

  function watermark() {
    var s = _status || (_trial ? computeStatus() : null);
    if (!s) return '';
    if (s.pro) return 'Licensed to ' + s.company + ' · ' + s.id + ' · Not for redistribution';
    if (s.state === 'trial_over') return 'FT Compass Trial Expired · Not for client delivery';
    return 'FT Compass Trial · Not for client delivery · ' + s.daysLeft + ' days left';
  }

  function backupCode() {
    return (_lic && _lic.payload && _lic.code) ? _lic.code : '';
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    _listeners.push(fn);
    if (_status) { try { fn(_status); } catch (e) {} }
  }

  /* ---------------- 徽章 ---------------- */
  function renderBadge() {
    if (!_status) return;
    var el = null;
    try { el = document.getElementById('licBadge'); } catch (e) {}
    if (!el) return;
    var s = _status;
    el.style.cursor = 'pointer';
    if (s.pro) {
      el.textContent = '✅ 已授权';
      el.style.color = '#7ee2b8';
      el.title = '已授权 · ' + (s.company || '') + ' · 点击查看授权信息';
    } else if (s.state === 'trial_over') {
      el.textContent = '⛔ 试用已结束';
      el.style.color = '#ffb4a2';
      el.title = '试用已结束，点击激活';
    } else {
      el.textContent = '试用 · ' + s.daysLeft + ' 天';
      el.style.color = 'rgba(255,255,255,.85)';
      el.title = '试用 · 剩 ' + s.daysLeft + ' 天 / ' + s.usesLeft + ' 次 · 点击激活或查看';
    }
    el.onclick = function () { showLock('manual'); };
  }

  /* ---------------- 锁屏 ---------------- */
  var CSS = ''
    + '#licLock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(15,23,42,.58);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;'
    + 'transition:opacity .2s ease;padding:16px}'
    + '#licLock.lic-out{opacity:0}'
    + '.lic-card{width:min(100%,470px);background:#fff;color:#1f2933;border-radius:16px;'
    + 'box-shadow:0 24px 60px rgba(0,0,0,.32);padding:26px 26px 20px;box-sizing:border-box}'
    + '.lic-h{font-size:19px;font-weight:700;margin:0 0 6px}'
    + '.lic-sub{font-size:13px;color:#7b8794;margin:0 0 18px;line-height:1.5}'
    + '.lic-stats{display:flex;gap:10px;margin-bottom:18px}'
    + '.lic-stat{flex:1;background:#f5f7fa;border-radius:10px;padding:12px;text-align:center}'
    + '.lic-stat b{display:block;font-size:22px;color:#0b6e4f;line-height:1.2}'
    + '.lic-stat span{font-size:11px;color:#7b8794}'
    + '.lic-ta{width:100%;height:76px;box-sizing:border-box;border:1px solid #d9e2ec;border-radius:10px;'
    + 'padding:10px 12px;font-size:12px;font-family:ui-monospace,Consolas,monospace;resize:none;outline:none;'
    + 'letter-spacing:.2px;color:#334e68}'
    + '.lic-ta:focus{border-color:#0b6e4f;box-shadow:0 0 0 3px rgba(11,110,79,.12)}'
    + '.lic-err{min-height:18px;font-size:12px;color:#d64545;margin:6px 0 2px}'
    + '.lic-row{display:flex;gap:10px;margin-top:6px}'
    + '.lic-btn{flex:1;border-radius:10px;padding:11px 14px;font-size:14px;cursor:pointer;border:0;font-weight:600}'
    + '.lic-btn.primary{background:#0b6e4f;color:#fff}'
    + '.lic-btn.primary:hover{background:#095c42}'
    + '.lic-btn.primary:disabled{opacity:.6;cursor:default}'
    + '.lic-btn.ghost{background:#eef2f6;color:#334e68}'
    + '.lic-btn.ghost:hover{background:#e3eaf1}'
    + '.lic-note{font-size:11px;color:#9aa5b1;margin:14px 0 0;line-height:1.6;text-align:center}'
    + '.lic-close{position:absolute;top:14px;right:16px;border:0;background:transparent;font-size:18px;'
    + 'color:#9aa5b1;cursor:pointer;line-height:1}'
    + '.lic-info{background:#f5f7fa;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.9;margin-bottom:16px}'
    + '.lic-info b{color:#0b6e4f}'
    + '.lic-toast{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);background:#1f2933;color:#fff;'
    + 'padding:10px 18px;border-radius:999px;font-size:13px;z-index:2147483001;opacity:0;transition:opacity .2s}'
    + '.lic-toast.on{opacity:1}';

  function injectCSS() {
    if (document.getElementById('lic-style')) return;
    var st = document.createElement('style');
    st.id = 'lic-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showLock(reason) {
    /* 跨域 iframe 里访问 top.License 会抛 SecurityError，必须整段兜住 */
    try {
      if (global.top && global.top !== global && global.top.License && global.top.License.showLock) {
        global.top.License.showLock(reason);
        return;
      }
    } catch (e) { /* 落回本窗口渲染 */ }
    _lockReason = reason || 'manual';
    whenReady(function () { renderLock(_lockReason); });
  }

  function renderLock(reason) {
    injectCSS();
    var s = _status || computeStatus();
    var el = document.getElementById('licLock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'licLock';
      document.body.appendChild(el);
    }
    el.classList.remove('lic-out');

    var pro = s.pro;
    var title, sub;
    if (pro) {
      title = '已授权';
      sub = '感谢支持，所有功能已解锁。';
    } else if (reason === 'uses') {
      title = '试用次数已用完';
      sub = '你已完整体验了 ' + s.limit.uses + ' 次客户挖掘。激活后可无限使用。';
    } else if (reason === 'expired') {
      title = '试用期已结束';
      sub = s.limit.days + ' 天体验期已到期。你的本地数据都还在，激活后即可继续。';
    } else {
      title = '激活 FT Compass';
      sub = '粘贴你购买后收到的激活码，本机离线校验，立即解锁。';
    }

    var stats = pro ? '' :
      '<div class="lic-stats">'
      + '<div class="lic-stat"><b>' + s.daysLeft + '</b><span>剩余天数</span></div>'
      + '<div class="lic-stat"><b>' + s.usesLeft + '</b><span>剩余次数</span></div>'
      + '</div>';

    var body;
    if (pro) {
      body = '<div class="lic-info">'
        + '授权公司：<b>' + esc(s.company) + '</b><br>'
        + '授权编号：' + esc(s.id) + '<br>'
        + '授权类型：永久买断 · 不绑定设备'
        + '</div>'
        + '<div class="lic-row"><button class="lic-btn primary" id="licBtnBackup">导出授权备份</button></div>'
        + '<p class="lic-note">换电脑或清理浏览器后，粘贴备份里的激活码即可恢复。</p>';
    } else {
      body = stats
        + '<textarea class="lic-ta" id="licInput" placeholder="FT1.xxxxx…  把完整激活码粘贴到这里" spellcheck="false"></textarea>'
        + '<div class="lic-err" id="licErr"></div>'
        + '<div class="lic-row">'
        + '<button class="lic-btn primary" id="licBtnAct">激活</button>'
        + '<button class="lic-btn ghost" id="licBtnBuy">我已购买 →</button>'
        + '</div>'
        + '<p class="lic-note">激活只在本机校验签名，不会上传你的任何数据。<br>'
        + '换电脑可直接用同一个激活码，不绑定设备。</p>';
    }

    el.innerHTML = '<div class="lic-card" style="position:relative">'
      + (reason === 'manual' ? '<button class="lic-close" id="licBtnClose" title="关闭">✕</button>' : '')
      + '<h3 class="lic-h">' + title + '</h3>'
      + '<p class="lic-sub">' + sub + '</p>'
      + body
      + '</div>';

    if (pro) {
      var b = document.getElementById('licBtnBackup');
      if (b) b.onclick = downloadBackup;
    } else {
      var act = document.getElementById('licBtnAct');
      if (act) act.onclick = doActivate;
      var buy = document.getElementById('licBtnBuy');
      if (buy) buy.onclick = function () {
        if (BUY_URL) global.open(BUY_URL, '_blank');
        else toast('请联系卖家购买激活码');
      };
      var inp = document.getElementById('licInput');
      if (inp) {
        inp.onkeydown = function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doActivate(); }
        };
        setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
      }
    }
    var close = document.getElementById('licBtnClose');
    if (close) close.onclick = hideLock;
  }

  function doActivate() {
    var inp = document.getElementById('licInput');
    var err = document.getElementById('licErr');
    var btn = document.getElementById('licBtnAct');
    var code = inp ? inp.value : '';
    if (!String(code).trim()) { if (err) err.textContent = '请先粘贴激活码'; return; }
    if (btn) { btn.disabled = true; btn.textContent = '校验中…'; }
    activate(code).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = '激活'; }
      if (!r.ok) { if (err) err.textContent = r.msg; return; }
      hideLock();
      toast('激活成功，感谢支持！');
    });
  }

  function hideLock() {
    var el = document.getElementById('licLock');
    if (!el) return;
    el.classList.add('lic-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }

  function dialogOpen() {
    return !!document.getElementById('licLock');
  }

  function downloadBackup() {
    var code = backupCode();
    if (!code) return;
    var p = (_lic && _lic.payload) || {};
    var txt = 'FT Compass 授权备份\n'
      + '========================\n'
      + '公司：' + (p.co || '') + '\n'
      + '编号：' + (p.id || '') + '\n'
      + '签发：' + (p.iat ? new Date(p.iat * 1000).toLocaleDateString() : '') + '\n'
      + '类型：永久买断（不绑定设备）\n\n'
      + '换电脑或清理浏览器后，把下面这行完整粘贴到「激活」输入框即可恢复：\n\n'
      + code + '\n';
    var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'FTCompass_授权备份_' + (p.id || 'license') + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function toast(msg) {
    injectCSS();
    var t = document.createElement('div');
    t.className = 'lic-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('on'); }, 20);
    setTimeout(function () {
      t.classList.remove('on');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 2400);
  }

  /* ---------------- 导出 ---------------- */
  global.License = {
    version: APP_MAJOR,
    TRIAL_DAYS: TRIAL_DAYS,
    TRIAL_USES: TRIAL_USES,
    ready: ready,
    refresh: refresh,
    status: status,
    consume: consume,
    refund: refund,
    activate: activate,
    guard: guard,
    showLock: showLock,
    hideLock: hideLock,
    dialogOpen: dialogOpen,
    watermark: watermark,
    backupCode: backupCode,
    downloadBackup: downloadBackup,
    onChange: onChange,
    toast: toast
  };
})(window);
