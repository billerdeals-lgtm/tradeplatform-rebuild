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
  try {
    if (window.self !== window.top) return;
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
