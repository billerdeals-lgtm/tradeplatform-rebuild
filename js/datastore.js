/* ============================================================
   FT Compass · DataStore v1.0
   统一数据适配层：localStorage 默认实现，接口对齐蓝图数据模型。
   后续平移 Supabase 只需替换 adapter，业务代码零改动。

   AI 配合要求（见 docs/AI接入矩阵.md）：AI 结果是一等字段
   （score/scoreReason/nextAction 等），随记录持久化，可排序可导出。
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 内建存储适配器（localStorage） ---------- */
  function corruptError(key, raw, cause) {
    var err = new Error('本地数据解析失败（' + key + '）');
    err.name = 'CorruptDataError';
    err.code = 'CORRUPT';
    err.key = key;
    err.raw = raw;
    err.cause = cause;
    return err;
  }
  var localAdapter = {
    read: function (key) {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        /* 不能静默返回 null：否则下一次保存会把损坏原文覆盖成空集合。
           交给上层隔离原始字符串并锁定该集合的写入。 */
        throw corruptError(key, raw, e);
      }
    },
    write: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* localStorage 约 5MB；写满时不能只抛英文 QuotaExceededError，
           否则用户看到的是「保存没反应」或数据静默丢失。 */
        if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
          var err = new Error('本地存储空间已满（浏览器上限约 5MB）。请先「完整备份」，再删除不用的商品图片、单证或历史记录后重试。');
          err.name = 'QuotaExceededError';
          err.code = 'QUOTA';
          throw err;
        }
        throw e;
      }
    },
    remove: function (key) {
      localStorage.removeItem(key);
    }
  };

  /* 键名集中管理（对齐蓝图 PERSIST_KEYS，平移 Supabase 时按此映射表名） */
  var KEYS = {
    leads:   'ftc_leads_v1',    // 线索（含 AI 一等字段）
    todos:   'ftc_todos_v1',    // 待办（含 AI 优先级字段）
    outreach:'ftc_outreach_v1', // 触达历史
    quotes:  'ftc_quotes_v1',   // 报价记录
    docs:    'ftc_docs_v1',     // 单证
    reviews: 'ftc_reviews_v1',  // 复盘
    comps:   'ftc_comps_v1',    // 竞品
    profile: 'ftc_profile_v1',  // 我的资料（公司/署名/卖点，AI 个性化数据源）
    products:'ftc_products_v1', // 商品库（一次建档，报价/单证复用）
    searches:'ftc_searches_v1', // 找客户搜索历史
    calculations:'ftc_calculations_v1', // 利润计算器历史
    cfg:     'ftc_cfg_v1'       // 全局配置（AI 设置等）
  };

  /* 迁移：早期计算器调用 DataStore.add('calculations') 时 KEYS 还没有这个键，
     历史被写进了 localStorage 里字面量叫 "undefined" 的键。
     新键不存在就整体搬过去；已存在则按 id 合并，避免丢记录。 */
  try {
    var legacyCalcs = localAdapter.read('undefined');
    if (Array.isArray(legacyCalcs) && legacyCalcs.length) {
      var currentCalcs = localAdapter.read(KEYS.calculations);
      var merged = Array.isArray(currentCalcs) ? currentCalcs.slice() : [];
      var seenIds = {};
      merged.forEach(function (x) { if (x && x.id) seenIds[x.id] = true; });
      legacyCalcs.forEach(function (x) {
        if (!x) return;
        if (x.id && seenIds[x.id]) return;
        if (x.id) seenIds[x.id] = true;
        merged.push(x);
      });
      localAdapter.write(KEYS.calculations, merged);
      localAdapter.remove('undefined');
    }
  } catch (e) { /* 迁移失败不能阻塞应用启动 */ }

  /* ---------- AI 一等字段白名单 ----------
     这些字段由 AI 产出，但按普通业务字段持久化/排序/导出 */
  var AI_FIELDS = {
    leads: ['score', 'scoreReason', 'nextAction', 'nextChannel', 'aiScoredAt'],
    todos: ['aiPriority', 'aiReason', 'aiGenerated'],
    quotes: ['aiFlag'],
    docs: ['aiCheck']
  };

  /* ---------- 损坏数据隔离 ----------
     目标：解析失败时既不静默当空集合，也不让应用白屏。
     做法：保留原始字符串、锁定该集合写入、页面底部常驻提示，
     用户可先下载原文，再明确选择隔离后继续。 */
  var NAME_LABEL = {
    leads:'线索', todos:'待办', outreach:'触达', quotes:'报价', docs:'单证',
    reviews:'复盘', comps:'竞品', profile:'资料', products:'商品',
    searches:'搜索历史', calculations:'计算历史', cfg:'配置'
  };
  var corrupt = {};
  var bannerScheduled = false;
  var warnedCorrupt = {};

  function corruptEntries() {
    return Object.keys(corrupt).map(function (k) { return corrupt[k]; });
  }
  function isCorrupt(name) {
    var key = KEYS[name];
    return !!(key && corrupt[key]);
  }
  function warnCorrupt(name) {
    if (warnedCorrupt[name]) return;
    warnedCorrupt[name] = true;
    var msg = '本地数据「' + (NAME_LABEL[name] || name) + '」损坏，已锁定写入。请先下载原始数据，再隔离损坏数据。';
    try {
      if (global.FT && typeof global.FT.toast === 'function') { global.FT.toast(msg); return; }
    } catch (e) {}
    if (typeof alert === 'function') alert(msg);
  }
  function corruptLockError(name) {
    var label = NAME_LABEL[name] || name;
    warnCorrupt(name);
    var err = new Error('本地数据「' + label + '」无法解析，已锁定写入以保护原始内容。请点击页面底部的「下载原始数据」，确认后再隔离损坏数据。');
    err.name = 'CorruptDataError';
    err.code = 'CORRUPT_LOCK';
    err.collection = name;
    return err;
  }
  function markCorrupt(name, raw) {
    var key = KEYS[name];
    if (!key || corrupt[key]) return;
    var item = { name: name, key: key, at: new Date().toISOString(), raw: String(raw == null ? '' : raw) };
    corrupt[key] = item;
    /* 原始字符串单独留一份，避免用户还没下载就刷新页面而丢失证据 */
    try { localStorage.setItem(key + '__corrupt', JSON.stringify({ at: item.at, raw: item.raw })); } catch (e) {}
    try { global.__ftcCorrupt = DataStore.corruptions(); } catch (e) {}
    scheduleCorruptBanner();
  }
  function downloadCorrupt() {
    if (typeof document === 'undefined') return;
    var payload = { app: 'FT Compass', exportedAt: new Date().toISOString(), collections: {} };
    corruptEntries().forEach(function (c) {
      payload.collections[c.name] = { at: c.at, raw: c.raw };
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }));
    a.download = 'ftcompass_corrupt_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function quarantineCorrupt() {
    var list = corruptEntries();
    if (!list.length) return;
    if (typeof confirm === 'function' && !confirm('将先下载 ' + list.length + ' 类损坏数据的原始内容，然后清空它们以便继续使用。\n\n其他正常数据不受影响。继续？')) return;
    downloadCorrupt();
    list.forEach(function (c) { DataStore.recover(c.name); });
    if (typeof alert === 'function') alert('损坏数据已隔离，原始内容已下载。页面将刷新。');
    setTimeout(function () { try { location.reload(); } catch (e) {} }, 1200);
  }
  function renderCorruptBanner() {
    if (typeof document === 'undefined' || !document.body) return;
    var list = corruptEntries();
    var bar = document.getElementById('ftcCorruptBar');
    if (!list.length) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ftcCorruptBar';
      bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#7f1d1d;color:#fff;padding:10px 14px;font:13px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 -2px 14px rgba(0,0,0,.28)';
      document.body.appendChild(bar);
    }
    var names = list.map(function (c) { return NAME_LABEL[c.name] || c.name; }).join('、');
    bar.innerHTML = '<b>⚠ 本地数据损坏</b>'
      + '<span style="flex:1;min-width:12em">' + names + ' 无法解析。原始内容已保留，相关写入已锁定，不会被空数据覆盖。</span>'
      + '<button type="button" id="ftcCorruptDl" style="border:1px solid #fff8;background:#fff;color:#7f1d1d;border-radius:7px;padding:5px 12px;font:inherit;cursor:pointer">⬇ 下载原始数据</button>'
      + '<button type="button" id="ftcCorruptFix" style="border:0;background:#fecaca;color:#7f1d1d;border-radius:7px;padding:5px 12px;font:inherit;cursor:pointer">隔离并继续</button>';
    document.getElementById('ftcCorruptDl').onclick = downloadCorrupt;
    document.getElementById('ftcCorruptFix').onclick = quarantineCorrupt;
  }
  function scheduleCorruptBanner() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      if (!bannerScheduled) {
        bannerScheduled = true;
        document.addEventListener('DOMContentLoaded', function () { renderCorruptBanner(); });
      }
    } else {
      renderCorruptBanner();
    }
  }

  /* ---------- DataStore 接口 ---------- */
  var DataStore = {
    KEYS: KEYS,
    AI_FIELDS: AI_FIELDS,
    _adapter: localAdapter,

    /** 切换适配器（将来接 Supabase：传实现 read/write/remove 的对象即可） */
    useAdapter: function (adapter) { this._adapter = adapter; },

    /** 内部读取：区分「没有数据」和「数据损坏」 */
    _read: function (name) {
      var key = KEYS[name];
      if (!key) return { ok: true, value: null };
      var value;
      try {
        value = this._adapter.read(key);
      } catch (e) {
        if (e && e.code === 'CORRUPT') {
          markCorrupt(name, e.raw);
          return { ok: false, name: name, raw: e.raw, error: e };
        }
        throw e;
      }
      if (value !== null && value !== undefined) {
        var bad = (name === 'cfg')
          ? (typeof value !== 'object' || Array.isArray(value))
          : !Array.isArray(value);
        if (bad) {
          var raw = JSON.stringify(value);
          markCorrupt(name, raw);
          return { ok: false, name: name, raw: raw, error: corruptError(key, raw) };
        }
      }
      return { ok: true, value: value };
    },

    /** 读取整个集合（数组）。
        数据损坏时返回带 __corrupt 标记的空数组：页面仍能打开，
        但 saveAll/add/update/remove 会拒绝写入，避免覆盖原文。 */
    list: function (name) {
      var r = this._read(name);
      if (!r.ok) {
        var safe = [];
        safe.__corrupt = true;
        safe.__collection = name;
        return safe;
      }
      return Array.isArray(r.value) ? r.value : [];
    },

    /** 覆写整个集合 */
    saveAll: function (name, arr) {
      if (isCorrupt(name)) throw corruptLockError(name);
      /* 写前再读一次：防止调用方没先 list，直接把损坏的原文覆盖掉 */
      var check = this._read(name);
      if (!check.ok) throw corruptLockError(name);
      this._adapter.write(KEYS[name], arr || []);
    },

    /** 新增一条（自动补 id/createdAt），返回新记录 */
    add: function (name, item) {
      if (isCorrupt(name)) throw corruptLockError(name);
      var arr = this.list(name);
      item.id = item.id || (name.slice(0, 3) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      item.createdAt = item.createdAt || new Date().toISOString();
      arr.push(item);
      this.saveAll(name, arr);
      return item;
    },

    /** 按 id 更新（合并字段），返回更新后的记录；不存在返回 null */
    update: function (name, id, patch) {
      if (isCorrupt(name)) throw corruptLockError(name);
      var arr = this.list(name);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
          Object.keys(patch).forEach(function (k) { arr[i][k] = patch[k]; });
          arr[i].updatedAt = new Date().toISOString();
          this.saveAll(name, arr);
          return arr[i];
        }
      }
      return null;
    },

    /** 按 id 删除，返回是否删到 */
    remove: function (name, id) {
      if (isCorrupt(name)) throw corruptLockError(name);
      var arr = this.list(name);
      var next = arr.filter(function (x) { return x.id !== id; });
      if (next.length === arr.length) return false;
      this.saveAll(name, next);
      return true;
    },

    /** 按 id 取单条 */
    get: function (name, id) {
      return this.list(name).find(function (x) { return x.id === id; }) || null;
    },

    /** 写 AI 结果：白名单校验 + 时间戳，返回是否成功 */
    saveAIResult: function (name, id, aiPatch) {
      var allow = AI_FIELDS[name];
      if (!allow) return false;
      var clean = {};
      allow.forEach(function (k) { if (k in aiPatch) clean[k] = aiPatch[k]; });
      clean.aiUpdatedAt = new Date().toISOString();
      return !!this.update(name, id, clean);
    },

    /** 触达记录是否已真正发送：
        新记录看 status；旧记录没有 status，按类型兼容（AI 生成类视为草稿，
        人工补录的邮件/WhatsApp/电话视为已发送），避免升级后统计突然归零。 */
    outreachSent: function (o) {
      if (!o) return false;
      if (o.status === 'sent') return true;
      if (o.status === 'draft') return false;
      return ['ai_rewrite', 'ai_followup', 'ai_objection', 'objection', 'holiday'].indexOf(o.type) < 0;
    },

    /** 当前损坏集列表（给备份/诊断/UI 用） */
    corruptions: function () {
      return corruptEntries().map(function (c) {
        return { name: c.name, key: c.key, at: c.at, raw: c.raw };
      });
    },
    isCorrupt: function (name) { return isCorrupt(name); },

    /** 读取原始字符串（备份专用）：解析失败时也会返回 raw，而不是 null */
    readRaw: function (name) {
      var key = KEYS[name];
      if (!key) return { ok: false, name: name, key: key, raw: null, error: new Error('未知集合') };
      var raw;
      try { raw = localStorage.getItem(key); }
      catch (e) { return { ok: false, name: name, key: key, raw: null, error: e }; }
      if (raw === null || raw === undefined || raw === '') {
        return { ok: true, name: name, key: key, raw: raw, value: null };
      }
      try {
        return { ok: true, name: name, key: key, raw: raw, value: JSON.parse(raw) };
      } catch (e) {
        markCorrupt(name, raw);
        return { ok: false, name: name, key: key, raw: raw, error: e };
      }
    },

    /** 隔离一个损坏集合：移除主键，允许后续写入；原文留在 key__corrupt */
    recover: function (name) {
      var key = KEYS[name];
      var c = key && corrupt[key];
      if (!c) return null;
      try { localStorage.removeItem(key); } catch (e) {}
      try { localStorage.setItem(key + '__corrupt', JSON.stringify({ at: c.at, raw: c.raw })); } catch (e) {}
      delete corrupt[key];
      try { global.__ftcCorrupt = DataStore.corruptions(); } catch (e) {}
      renderCorruptBanner();
      return c.raw;
    },

    /** 全量导出（含 AI 字段）→ 供 CSV/JSON 导出。
        损坏集合不会伪装成空数组，而是原样放进 _corrupt，备份时也不丢原文。 */
    exportAll: function () {
      var out = {}, bad = null, self = this;
      Object.keys(KEYS).forEach(function (n) {
        if (n === 'cfg') return;
        var r = self._read(n);
        if (!r.ok) {
          bad = bad || {};
          var c = corrupt[KEYS[n]];
          bad[n] = { at: c ? c.at : new Date().toISOString(), raw: r.raw };
          return;
        }
        out[n] = Array.isArray(r.value) ? r.value : [];
      });
      if (bad) out._corrupt = bad;
      return out;
    },

    /** 配置读写（AI 设置等） */
    getCfg: function () {
      var r = this._read('cfg');
      if (!r.ok) return {};
      return (r.value && typeof r.value === 'object' && !Array.isArray(r.value)) ? r.value : {};
    },
    setCfg: function (obj) {
      if (isCorrupt('cfg')) throw corruptLockError('cfg');
      this._adapter.write(KEYS.cfg, Object.assign(this.getCfg(), obj));
    }
  };

  global.DataStore = DataStore;
})(window);
