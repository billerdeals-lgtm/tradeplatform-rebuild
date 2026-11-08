/* ============================================================
   报价有效期：日期字段 + 渲染时自动判过期
   ------------------------------------------------------------
   报价页、首页工作台共用同一套判断，避免两个页面显示不一致。
   - 新数据：validUntil = YYYY-MM-DD（唯一事实来源）
   - 旧数据：validity 可能是 "30 days" / "30天" / 日期字符串，
     这里按报价日期换算成 validUntil，升级后自动兼容。
   - 自动过期只作用于「已发送」；草稿尚未生效，已接受/已拒绝是终态。
   ============================================================ */
(function (global) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISO(new Date()); }

  function parseISO(s) {
    var m = String(s == null ? '' : s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  function isoMatch(s) {
    var m = String(s == null ? '' : s).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function addDays(iso, n) {
    var d = parseISO(iso);
    if (!d) return '';
    d.setDate(d.getDate() + Number(n || 0));
    return toISO(d);
  }

  /* 兼容旧报价：validUntil 优先；否则从 validity 文本推算 */
  function validUntil(q) {
    q = q || {};
    var direct = isoMatch(q.validUntil);
    if (direct) return direct;
    var raw = String(q.validity || '').trim();
    if (!raw) return '';
    var dated = isoMatch(raw);
    if (dated) return dated;
    var m = raw.match(/(\d+)\s*(?:day|days|天)/i);
    if (!m) return '';
    var base = q.date || isoMatch(q.createdAt);
    return base ? addDays(base, +m[1]) : '';
  }

  function isExpired(q) {
    var until = validUntil(q);
    return !!until && todayISO() > until;
  }

  /* 渲染用状态：已发送且过有效期 → 已过期。
     草稿不自动过期；已接受/已拒绝是终态；手动设为已过期则保持。 */
  function effectiveStatus(q) {
    var st = (q && q.status) || 'draft';
    if ((st === 'sent' || st === 'expired') && isExpired(q)) return 'expired';
    return st;
  }

  function validityText(q) {
    var until = validUntil(q);
    if (until) return until;
    return String((q && q.validity) || '').trim();
  }

  /* 距离有效期还有几天：0 = 今天最后一天，负数 = 已过期，null = 没设日期 */
  function daysLeft(q, fromISO) {
    var until = validUntil(q);
    if (!until) return null;
    var end = parseISO(until);
    var base = parseISO(fromISO || todayISO());
    if (!end || !base) return null;
    return Math.round((end.getTime() - base.getTime()) / 86400000);
  }

  /* 临期：未成交/未拒绝、还没过期、且在 N 天内到期（默认 7 天）。
     草稿也算：报价还没发出去，但价格窗口一样会关。 */
  function isExpiringSoon(q, days) {
    var st = effectiveStatus(q);
    if (st === 'accepted' || st === 'rejected' || st === 'expired') return false;
    var left = daysLeft(q);
    var limit = days == null ? 7 : Number(days);
    return left != null && left >= 0 && left <= limit;
  }

  global.QuoteValidity = {
    todayISO: todayISO,
    parseISO: parseISO,
    addDays: addDays,
    validUntil: validUntil,
    isExpired: isExpired,
    effectiveStatus: effectiveStatus,
    validityText: validityText,
    daysLeft: daysLeft,
    isExpiringSoon: isExpiringSoon
  };
})(typeof window !== 'undefined' ? window : this);
