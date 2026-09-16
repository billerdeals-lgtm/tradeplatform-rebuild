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
  var localAdapter = {
    read: function (key) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    write: function (key, value) {
      localStorage.setItem(key, JSON.stringify(value));
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
    searches:'ftc_searches_v1', // 找客户搜索历史
    cfg:     'ftc_cfg_v1'       // 全局配置（AI 设置等）
  };

  /* ---------- AI 一等字段白名单 ----------
     这些字段由 AI 产出，但按普通业务字段持久化/排序/导出 */
  var AI_FIELDS = {
    leads: ['score', 'scoreReason', 'nextAction', 'nextChannel', 'aiScoredAt'],
    todos: ['aiPriority', 'aiReason', 'aiGenerated'],
    quotes: ['aiFlag'],
    docs: ['aiCheck']
  };

  /* ---------- DataStore 接口 ---------- */
  var DataStore = {
    KEYS: KEYS,
    AI_FIELDS: AI_FIELDS,
    _adapter: localAdapter,

    /** 切换适配器（将来接 Supabase：传实现 read/write/remove 的对象即可） */
    useAdapter: function (adapter) { this._adapter = adapter; },

    /** 读取整个集合（数组），无数据返回 [] */
    list: function (name) {
      var v = this._adapter.read(KEYS[name]);
      return Array.isArray(v) ? v : [];
    },

    /** 覆写整个集合 */
    saveAll: function (name, arr) {
      this._adapter.write(KEYS[name], arr || []);
    },

    /** 新增一条（自动补 id/createdAt），返回新记录 */
    add: function (name, item) {
      var arr = this.list(name);
      item.id = item.id || (name.slice(0, 3) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      item.createdAt = item.createdAt || new Date().toISOString();
      arr.push(item);
      this.saveAll(name, arr);
      return item;
    },

    /** 按 id 更新（合并字段），返回更新后的记录；不存在返回 null */
    update: function (name, id, patch) {
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

    /** 全量导出（含 AI 字段）→ 供 CSV/JSON 导出 */
    exportAll: function () {
      var out = {}, self = this;
      Object.keys(KEYS).forEach(function (n) {
        if (n !== 'cfg') out[n] = self.list(n);
      });
      return out;
    },

    /** 配置读写（AI 设置等） */
    getCfg: function () { return this._adapter.read(KEYS.cfg) || {}; },
    setCfg: function (obj) { this._adapter.write(KEYS.cfg, Object.assign(this.getCfg(), obj)); }
  };

  global.DataStore = DataStore;
})(window);
