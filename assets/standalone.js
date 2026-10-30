/* ============================================================
   FT Compass · 模块页独立打开支持
   ------------------------------------------------------------
   模块页平时跑在外壳的 iframe 里，头顶的模块名由外壳顶栏提供，
   所以 ≤860px 时模块自己的 <header> 会被压成只留按钮的动作条。

   直接访问 modules/xxx.html（或在新标签打开）时没有外壳，
   标题就会被一并隐藏。这个脚本用 self === top 判断，给 <html>
   加 ft-standalone，让 responsive.css 只在外壳内收纳顶栏；
   同时在 header 最前面插入「← 工作台」，给它们一条回首页的路。

   必须在 head 里同步执行（早于首次绘制），否则会闪一下。
   ============================================================ */
(function () {
  'use strict';
  window.FT = window.FT || {};

  /* ------------------------------------------------------------
     FT.today(offset)：本地时区的 YYYY-MM-DD
     ------------------------------------------------------------
     不能用 toISOString().slice(0,10)：那是 UTC，北京时间 0:00–8:00
     会被算成前一天（单号、跟进日期、到期日都会错一天）。
     offset 为天数偏移，可为负；FT.today(-3) = 三天前。
     ------------------------------------------------------------ */
  if (!window.FT.today) {
    window.FT.today = function (offset) {
      var d = new Date();
      if (offset) d.setDate(d.getDate() + Number(offset));
      var m = String(d.getMonth() + 1);
      var day = String(d.getDate());
      if (m.length < 2) m = '0' + m;
      if (day.length < 2) day = '0' + day;
      return d.getFullYear() + '-' + m + '-' + day;
    };
  }

  /* ------------------------------------------------------------
     FT.go(view)：模块之间跳转的统一入口
     ------------------------------------------------------------
     在外壳 iframe 里跑时交给 parent.go()，让侧栏高亮、顶栏标题、
     iframe 缓存版本一起更新；直接打开模块（self === top）时按
     站点根目录算出目标地址，退化成普通跳转，不会跳到 modules/modules/。
     view 用相对站点根的路径，例如 'modules/leads.html'。
     ------------------------------------------------------------ */
  if (!window.FT.go) {
    window.FT.go = function (view) {
      if (!view) return;
      if (window.self !== window.top) {
        try {
          if (typeof window.parent.go === 'function') { window.parent.go(view); return; }
        } catch (e) { /* 跨域时退回 postMessage */ }
        try {
          window.parent.postMessage({ type: 'ft:navigate', view: String(view) }, window.location.origin);
          return;
        } catch (e) { /* 再退回本页跳转 */ }
      }
      var root = window.location.pathname.replace(/\/modules\/[^/]*$/, '/');
      window.location.href = root + String(view).replace(/^\.?\//, '');
    };
  }

  try {
    if (window.self !== window.top) return;
    /* 首页（外壳）也加载本脚本，只为拿 FT.today；独立打开补丁只对模块页生效 */
    if (!/\/modules\/[^/]*$/.test(window.location.pathname)) return;
    document.documentElement.classList.add('ft-standalone');

    function inject() {
      var h = document.querySelector('body > header');
      if (!h || h.querySelector('.ft-back')) return;
      var a = document.createElement('a');
      a.className = 'ft-back';
      a.href = '../index.html';
      a.title = '返回 FT Compass 工作台';
      a.textContent = '← 工作台';
      h.insertBefore(a, h.firstChild);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  } catch (e) { /* 独立打开失败也不能影响模块本身 */ }
})();
