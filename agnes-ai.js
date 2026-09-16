/* ============================================================
 * agnes-ai.js — tradeplatform 自研版 AI 增强模块（Agnes 2.5 Flash）
 * ============================================================
 * 定位：给重建版外贸平台加真 AI 能力（原版的"AI 评分/AI 洞察"是写死的假 AI）
 *
 * 用法（任意页面引入后）：
 *   <script src="agnes-ai.js"></script>
 *   const res = await AgnesAI.scoreLead({name:'Omar',country:'Egypt',...});
 *   const mail = await AgnesAI.genOutreach(lead, '首封冷开发信');
 *
 * ⚙️ 配置说明（三要素，均有默认值，可在设置面板里改）：
 *   - AGNES_KEY：API 密钥（已按用户要求直接内联为默认值）
 *   - AGNES_BASE：接口地址（默认占位，首次使用前请在设置里确认！）
 *   - AGNES_MODEL：模型名（默认 agnes-2.5-flash，可在设置里改）
 * ============================================================ */

(function (global) {
  'use strict';

  /* ---------- 1. 默认配置（接口地址/密钥留空，由用户在设置面板填写，存 localStorage） ---------- */
  var DEFAULTS = {
    // ⚠️ 由用户在设置面板填写：Agnes 接口地址（OpenAI 兼容格式，填到 /v1 为止）
    base: '',
    // API 密钥：同样面板填写，存 localStorage（用户偏好：不做脱敏/抽离/vault 化）
    key: '',
    // 模型名：默认 agnes 2.5 flash，服务商命名不同可在面板改
    model: 'agnes-2.5-flash',
    // 每日调用上限（防失控烧钱，达到后弹提示）
    dailyLimit: 100
  };

  var LS_KEY = 'agnes_ai_cfg';
  var LS_CNT = 'agnes_ai_cnt'; // {date:'2026-09-15', n:3}

  function loadCfg() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(LS_KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveCfg(cfg) { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); }

  function bumpCount() {
    var today = new Date().toISOString().slice(0, 10);
    var c; try { c = JSON.parse(localStorage.getItem(LS_CNT) || 'null'); } catch (e) { c = null; }
    if (!c || c.date !== today) c = { date: today, n: 0 };
    c.n++;
    localStorage.setItem(LS_CNT, JSON.stringify(c));
    return c.n;
  }
  function todayCount() {
    var today = new Date().toISOString().slice(0, 10);
    var c; try { c = JSON.parse(localStorage.getItem(LS_CNT) || 'null'); } catch (e) { c = null; }
    return (c && c.date === today) ? c.n : 0;
  }

  /* ---------- 2. 核心调用：OpenAI 兼容 chat/completions ---------- */
  /**
   * agnesChat(messages, opts)
   * @param {Array}  messages  [{role:'system'|'user'|'assistant', content:'...'}]
   * @param {Object} opts      {temperature, maxTokens, timeout, json}
   * @returns {Promise<string>} 模型回复文本
   */
  async function agnesChat(messages, opts) {
    opts = opts || {};
    var cfg = loadCfg();
    if (!cfg.base) throw new Error('请先在设置面板填写接口地址（OpenAI 兼容格式，/v1 结尾）');
    if (!cfg.key) throw new Error('请先在设置面板填写 API 密钥');
    if (todayCount() >= cfg.dailyLimit) {
      throw new Error('今日 AI 调用已达上限 ' + cfg.dailyLimit + ' 次，明天再来（可在设置中调整）');
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = opts.timeout || 30000;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout);

    var body = {
      model: cfg.model,
      messages: messages,
      temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
      // 注意：2.5-flash 类推理模型会先消耗 token 做 thinking，
      // max_tokens 给太小会导致正文为空——默认 1024 起步
      max_tokens: opts.maxTokens || 1024
    };
    // json 模式：要求模型只输出 JSON（评分等结构化场景用）
    if (opts.json) body.response_format = { type: 'json_object' };

    try {
      var resp = await fetch(cfg.base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!resp.ok) {
        var t = '';
        try { t = (await resp.text()).slice(0, 200); } catch (e) {}
        throw new Error('Agnes 接口 ' + resp.status + '：' + t + '（401=密钥不对/不完整；404=模型名不对）');
      }
      var data = await resp.json();
      bumpCount();
      // 兼容多种返回形态：OpenAI 标准 content / 旧式 text / 推理模型 reasoning_content
      var ch = data.choices && data.choices[0] ? data.choices[0] : null;
      var msg = ch ? (ch.message || {}) : {};
      var txt = msg.content || msg.text || msg.reasoning_content || ch && ch.text || '';
      if (!txt) {
        // 正文为空时把原始返回暴露出来，方便排查（截断 400 字符）
        throw new Error('Agnes 返回为空。原始返回：' + JSON.stringify(data).slice(0, 400)
          + '（若 finish_reason=length 说明 max_tokens 不够，可加大 opts.maxTokens）');
      }
      return txt.trim();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI 请求超时（' + timeout / 1000 + 's），可重试或在设置调大超时');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 便捷封装：单轮 user 消息 */
  async function ask(prompt, opts) {
    return agnesChat([{ role: 'user', content: prompt }], opts);
  }

  /* ---------- 3. 业务功能：与平台数据模型对接 ---------- */

  // 通用系统提示：外贸 B2B 助手人设
  var SYS_FT = '你是资深外贸 B2B 销售教练，熟悉阿里国际站、Google 开发客户、WhatsApp/邮件触达。'
    + '回答用简体中文，客户名和专有名词保留原文，输出务实可执行，不写空话套话。';

  /** JSON 容错解析：剥离 ```代码围栏 / 提取首个 {...} 块 / 兜底正则抓字段 */
  function parseLoose(txt) {
    if (!txt) return null;
    var s = String(txt).replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {}
      // 仍是坏 JSON：逐字段正则抠（score/next_action 等关键值）
      var out = {};
      var m = s.match(/"score"\s*:\s*([0-9.]+)/);          if (m) out.score = parseFloat(m[1]);
      m = s.match(/"tier"\s*:\s*"([^"]*)"/);               if (m) out.tier = m[1];
      m = s.match(/"reason"\s*:\s*"([^"]*)"/);             if (m) out.reason = m[1];
      m = s.match(/"next_action"\s*:\s*"([^"]*)"/);        if (m) out.next_action = m[1];
      m = s.match(/"channel"\s*:\s*"([^"]*)"/);            if (m) out.channel = m[1];
      if (Object.keys(out).length) return out;
    }
    return null;
  }

  /** 3.1 线索 AI 评分 + 下一步动作（对应蓝图 find 模块） */
  async function scoreLead(lead) {
    var p = '请给这条外贸线索评分并给下一步建议。输出 JSON：{"score":0-100,"tier":"高/中/低","reason":"一句话理由","next_action":"具体下一步（含话术要点）","channel":"建议触达渠道(email/whatsapp/call)"}。\n'
      + '线索信息：客户名=' + (lead.name || '?')
      + '，国家=' + (lead.country || '?')
      + '，市场=' + (lead.market || '?')
      + '，产品=' + (lead.product || '?')
      + '，当前阶段=' + (lead.stage || '?')
      + '，预估金额=' + (lead.amount || 0)
      + '，距最后联系=' + (lead.last || '?')
      + '，备注=' + (lead.note || '无') + '。';
    var txt = await agnesChat([
      { role: 'system', content: SYS_FT },
      { role: 'user', content: p }
    ], { json: true, temperature: 0.3, maxTokens: 400 });
    var r = parseLoose(txt);
    if (r && typeof r.score === 'number') return r;
    return { score: 0, tier: '?', reason: 'AI 返回无法解析', next_action: String(txt).slice(0, 200), channel: '' };
  }

  /** 3.2 个性化开发信/跟进邮件（对应 reach 模块，替换假模板署名） */
  async function genOutreach(lead, scene, myProfile) {
    var p = '写一封外贸' + (scene || '首封冷开发信') + '邮件。\n'
      + '收件客户：' + (lead.name || '?') + '（' + (lead.country || '?') + '，'
      + (lead.market || '') + '市场，主营/关注产品：' + (lead.product || '?') + '，备注：' + (lead.note || '无') + '）\n'
      + '发件人：' + (myProfile && myProfile.name ? myProfile.name : '我')
      + (myProfile && myProfile.company ? '，公司：' + myProfile.company : '')
      + (myProfile && myProfile.selling ? '，优势：' + myProfile.selling : '')
      + (myProfile && myProfile.products ? '，主营产品：' + myProfile.products : '')
      + (myProfile && myProfile.port ? '，起运港：' + myProfile.port : '')
      + (myProfile && myProfile.payment ? '，付款方式：' + myProfile.payment : '') + '\n'
      + '要求：英文正文（150 词内），口语化不像群发；给出 Subject；正文后另起一行用【中文要点】总结这封信想让客户做什么。';
    return agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }], { temperature: 0.8, maxTokens: 600 });
  }

  /** 3.3 客户回复智能草稿（粘贴客户原话 → 生成回复） */
  async function genReply(lead, customerWords) {
    var p = '客户（' + (lead.country || '?') + '，产品：' + (lead.product || '?') + '，阶段：' + (lead.stage || '?') + '）发来消息：\n「'
      + customerWords + '」\n请给出回复草稿：英文正文（120 词内，先回应情绪/问题，再推进下一步），末尾加【中文说明】一句话提示回复策略。';
    return agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }], { temperature: 0.7, maxTokens: 600 });
  }

  /** 3.4 异议处理（对应 deal 模块的"嫌贵/要降价"等） */
  async function genObjection(lead, objection) {
    var p = '客户提出异议：「' + objection + '」（产品：' + (lead.product || '?') + '，市场：' + (lead.market || '?') + '）\n'
      + '给出：1) 异议背后真实顾虑判断（一句话）；2) 三段式应对话术（英文，可直接发）；3) 底线建议（中文）。';
    return agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }], { temperature: 0.6, maxTokens: 600 });
  }

  /** 3.5 复盘洞察（对应 review 模块，输入周/月统计） */
  async function genReviewInsight(stats) {
    var p = '这是本周/月外贸数据：' + JSON.stringify(stats) + '\n'
      + '输出：1) 三个最重要的发现（各一句话）；2) 下周/月三个具体动作（按优先级）；3) 一个最该砍掉的低效动作。用中文，简洁不套话。';
    return agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }], { temperature: 0.5, maxTokens: 700 });
  }

  /** 3.6 节日问候定制（对应 repeat 模块 holidayGreet 联动） */
  async function genHolidayGreet(lead, festival) {
    var p = '客户国家 ' + (lead.country || '?') + ' 即将迎来 ' + festival + '。写一条节日问候：WhatsApp 用（40 词内英文，自然不谄媚，顺带轻推进业务），附中文翻译。';
    return agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }], { temperature: 0.9, maxTokens: 300 });
  }

  /** 3.7 每日开工计划：待办+线索 → 今天先做谁（对应 todos 模块，AI 驱动排序） */
  async function genDailyPlan(todos, leads) {
    var td = (todos || []).slice(0, 20).map(function (t) {
      return { id: t.id, title: t.title, due: t.due || '无', done: !!t.done,
        lead: t.leadName || '', note: t.note || '' };
    });
    var ld = (leads || []).slice(0, 20).map(function (l) {
      return { id: l.id, name: l.name, stage: l.stage || '', amount: l.amount || 0,
        score: l.score == null ? null : l.score, nextAction: l.nextAction || '' };
    });
    var p = '这是我的待办列表和线索列表（含 AI 评分）。请帮我排出今天的工作优先级。\n'
      + '待办：' + JSON.stringify(td) + '\n线索：' + JSON.stringify(ld) + '\n'
      + '输出 JSON：{"plan":[{"id":"<取自输入的 id>","rank":1,"why":"一句话理由(中文)"}],"focus":"今天最重要的一件事(一句话)"}'
      + '。只排未完成项，按“到期紧急度>成交金额>线索评分>阶段推进价值”综合排序，最多 8 条。';
    var txt = await agnesChat([{ role: 'system', content: SYS_FT }, { role: 'user', content: p }],
      { json: true, temperature: 0.3, maxTokens: 700 });
    var r = parseLoose(txt);
    if (r && Array.isArray(r.plan)) return r;
    return { plan: [], focus: 'AI 返回解析失败：' + String(txt).slice(0, 150) };
  }

  /* ---------- 4. 设置面板（可选挂载） ---------- */
  function settingsHTML() {
    var c = loadCfg();
    return '<div style="font:14px/1.6 system-ui;max-width:420px">'
      + '<label>接口地址（/v1 结尾）</label><input id="ag_base" value="' + c.base + '" placeholder="https://你的网关/v1" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:6px">'
      + '<label style="display:block;margin-top:8px">API 密钥</label><input id="ag_key" value="' + c.key + '" placeholder="sk-..." style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:6px">'
      + '<label style="display:block;margin-top:8px">模型名</label><input id="ag_model" value="' + c.model + '" placeholder="agnes-2.5-flash" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:6px">'
      + '<label style="display:block;margin-top:8px">每日上限：<input id="ag_limit" type="number" value="' + c.dailyLimit + '" style="width:80px"></label>'
      + '<div style="margin-top:6px;color:#888;font-size:12px">今日已调用 ' + todayCount() + ' 次</div>'
      + '<button onclick="AgnesAI.saveFromPanel()" style="margin-top:10px;padding:8px 20px;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer">保存</button>'
      + '</div>';
  }
  function saveFromPanel() {
    saveCfg({
      base: document.getElementById('ag_base').value.trim(),
      key: document.getElementById('ag_key').value.trim(),
      model: document.getElementById('ag_model').value.trim(),
      dailyLimit: parseInt(document.getElementById('ag_limit').value, 10) || 100
    });
    alert('Agnes AI 配置已保存');
  }

  /** 连通性自检：设置完先测这个 */
  async function ping() {
    try {
      var r = await ask('请只回复两个字母：pong', { maxTokens: 1024, timeout: 30000 });
      return { ok: true, reply: r };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /* ---------- 5. 导出 ---------- */
  global.AgnesAI = {
    chat: agnesChat,
    ask: ask,
    scoreLead: scoreLead,
    genOutreach: genOutreach,
    genReply: genReply,
    genObjection: genObjection,
    genReviewInsight: genReviewInsight,
    genHolidayGreet: genHolidayGreet,
    genDailyPlan: genDailyPlan,
    settingsHTML: settingsHTML,
    saveFromPanel: saveFromPanel,
    ping: ping,
    todayCount: todayCount,
    loadCfg: loadCfg
  };
})(window);
