/* ============================================================
   FT Compass · 键盘可达性兜底
   ------------------------------------------------------------
   页面里有一批「div 当按钮」的控件（列表项、标签页、可展开卡片）。
   它们的祖先结构里带 div，直接换成 <button> 会破坏排版，所以统一用
   role="button" / role="tab" + tabindex="0" 标记，由这里补上键盘行为：

   - Enter / Space 触发点击
   - 带 aria-expanded 的，点击时同步展开状态（屏幕阅读器能读出开合）

   真正需要 focus 环的样式在 assets/responsive.css 的 :focus-visible。
   ============================================================ */
(function () {
  'use strict';

  function isFakeButton(el) {
    if (!el || el.nodeType !== 1) return false;
    var role = el.getAttribute('role');
    if (role !== 'button' && role !== 'tab') return false;
    var tag = el.tagName;
    return tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target;
    if (!isFakeButton(el)) return;
    e.preventDefault();          // Space 默认会滚动页面
    el.click();
  });

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[role="button"][aria-expanded]') : null;
    if (!el) return;
    el.setAttribute('aria-expanded', el.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  }, true);

  /* 标签栏：左右方向键在 role="tab" 之间移动并切换（Home / End 到首尾） */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    var el = e.target;
    if (!el || el.nodeType !== 1 || el.getAttribute('role') !== 'tab') return;
    var list = el.closest ? el.closest('[role="tablist"]') : null;
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(el);
    if (i < 0) return;
    var next = e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
})();
