/* ============================================================
   StageAnalytics · 线索阶段停留分析
   ------------------------------------------------------------
   stageLog 由 DataStore.update / 线索编辑在「换阶段」时写入：
     { stage: '报价', from: '已联系', at: '2026-11-08T03:21:00.000Z' }
   这里把「创建时间 + 每次换阶段」还原成一条阶段时间轴，回答两个问题：
   - 这个客户在当前阶段停了多久？（客户 360 时间线）
   - 每个阶段平均停留几天？（复盘销售周期）

   口径：
   - 已完成区段 = 进入某阶段 → 离开该阶段，参与「平均停留」计算
   - 在途区段 = 当前仍在的阶段，单独统计，避免把老客户算进平均值
   - 只有一条「创建」而没有换阶段时，只产生在途区段
   ============================================================ */
(function (global) {
  'use strict';

  var DAY = 86400000;
  var STAGE_ORDER = ['待开发', '已联系', '试样', '报价', '成交'];

  function ts(v) {
    if (v == null || v === '') return 0;
    if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim();
    if (!s) return 0;
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.getTime();
    /* 兼容只有日期的写法，按本地时区当天 00:00 处理 */
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      var d2 = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(d2.getTime()) ? 0 : d2.getTime();
    }
    return 0;
  }

  function toDays(ms) {
    if (!(ms > 0)) return 0;
    return Math.round(ms / DAY * 10) / 10;
  }

  function logOf(lead) {
    var log = lead && Array.isArray(lead.stageLog) ? lead.stageLog.slice() : [];
    return log.filter(function (e) { return e && e.stage && ts(e.at); })
      .sort(function (a, b) { return ts(a.at) - ts(b.at); });
  }

  /**
   * 把一个线索还原成阶段区段（按时间正序）。
   * @returns {Array<{stage,from,start,end,days,closed}>}
   */
  function segments(lead, now) {
    if (!lead) return [];
    now = ts(now) || Date.now();
    var log = logOf(lead);
    var created = ts(lead.createdAt) || (log.length ? ts(log[0].at) : 0);
    var out = [];

    if (log.length) {
      var first = log[0];
      var firstAt = ts(first.at);
      /* 第一段：创建 → 第一次换阶段。from 缺失时无法判断阶段，跳过。 */
      if (first.from && created && firstAt >= created) {
        out.push({ stage: first.from, from: '', start: created, end: firstAt, closed: true });
      }
      for (var i = 0; i < log.length; i++) {
        var s = ts(log[i].at);
        var e = i + 1 < log.length ? ts(log[i + 1].at) : now;
        if (e < s) e = s;
        out.push({
          stage: log[i].stage,
          from: log[i].from || (out.length ? out[out.length - 1].stage : ''),
          start: s,
          end: e,
          closed: i + 1 < log.length
        });
      }
    } else if (created) {
      out.push({ stage: lead.stage || '待开发', from: '', start: created, end: now, closed: false });
    }

    out.forEach(function (x) {
      x.days = toDays(x.end - x.start);
      x.startISO = new Date(x.start).toISOString();
      x.endISO = new Date(x.end).toISOString();
    });
    return out;
  }

  /** 当前阶段已停留天数（没有创建时间返回 null） */
  function currentDays(lead, now) {
    var segs = segments(lead, now);
    if (!segs.length) return null;
    var last = segs[segs.length - 1];
    return last.closed ? 0 : last.days;
  }

  /** 阶段流转事件（客户 360 时间线用），不含「创建」那一段 */
  function transitions(lead, now) {
    if (!lead) return [];
    now = ts(now) || Date.now();
    var log = logOf(lead);
    return log.map(function (e, i) {
      var start = ts(e.at);
      var end = i + 1 < log.length ? ts(log[i + 1].at) : now;
      if (end < start) end = start;
      return {
        stage: e.stage,
        from: e.from || '',
        at: new Date(start).toISOString(),
        days: toDays(end - start),
        ongoing: i === log.length - 1
      };
    });
  }

  function stageRank(stage) {
    var i = STAGE_ORDER.indexOf(stage);
    return i < 0 ? STAGE_ORDER.length : i;
  }

  /**
   * 各阶段平均停留。
   * @returns {{rows:Array, transitions:number, leadsWithLog:number, leads:number}}
   *   rows: [{stage, avgClosed, closedCount, avgOngoing, ongoingCount, maxOngoing}]
   */
  function stats(leads, now) {
    now = ts(now) || Date.now();
    var map = {};
    var transitions = 0, leadsWithLog = 0, totalLeads = 0;

    (leads || []).forEach(function (lead) {
      if (!lead) return;
      totalLeads++;
      var log = logOf(lead);
      if (log.length) leadsWithLog++;
      transitions += log.length;
      segments(lead, now).forEach(function (seg) {
        if (!seg.stage) return;
        var r = map[seg.stage];
        if (!r) {
          r = map[seg.stage] = {
            stage: seg.stage,
            closedSum: 0, closedCount: 0,
            ongoingSum: 0, ongoingCount: 0, maxOngoing: 0
          };
        }
        if (seg.closed) {
          r.closedSum += seg.days;
          r.closedCount++;
        } else {
          r.ongoingSum += seg.days;
          r.ongoingCount++;
          if (seg.days > r.maxOngoing) r.maxOngoing = seg.days;
        }
      });
    });

    var rows = Object.keys(map).map(function (k) {
      var r = map[k];
      return {
        stage: r.stage,
        avgClosed: r.closedCount ? Math.round(r.closedSum / r.closedCount * 10) / 10 : null,
        closedCount: r.closedCount,
        avgOngoing: r.ongoingCount ? Math.round(r.ongoingSum / r.ongoingCount * 10) / 10 : null,
        ongoingCount: r.ongoingCount,
        maxOngoing: r.maxOngoing
      };
    }).sort(function (a, b) {
      return stageRank(a.stage) - stageRank(b.stage) || a.stage.localeCompare(b.stage, 'zh');
    });

    return {
      rows: rows,
      transitions: transitions,
      leadsWithLog: leadsWithLog,
      leads: totalLeads
    };
  }

  /** 停留天数显示：0.5 天以下显示 <1，整 1 位小数 */
  function fmtDays(d) {
    if (d == null || !isFinite(d)) return '—';
    if (d < 1) return '<1';
    if (d >= 100) return String(Math.round(d));
    return String(Math.round(d * 10) / 10);
  }

  global.StageAnalytics = {
    DAY: DAY,
    STAGE_ORDER: STAGE_ORDER,
    ts: ts,
    segments: segments,
    transitions: transitions,
    currentDays: currentDays,
    stats: stats,
    fmtDays: fmtDays
  };
})(typeof window !== 'undefined' ? window : this);
