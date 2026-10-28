/* ============================================================
   FT Compass · 全站可达性兜底
   ------------------------------------------------------------
   1) 键盘可达性
      页面里有一批「div 当按钮」的控件（列表项、标签页、可展开卡片）。
      它们的祖先结构里带 div，直接换成 <button> 会破坏排版，所以统一用
      role="button" / role="tab" + tabindex="0" 标记，由这里补上键盘行为：
        - Enter / Space 触发点击
        - 带 aria-expanded 的，点击时同步展开状态
        - role="tab" 支持 ←/→/Home/End

   2) 提示条（toast）
      全站 27 处原生 alert() 是同步阻塞弹窗：样式不可控、移动端挡屏、
      连续报错要连点好几次。这里接管 window.alert，改成右下角提示条，
      每条带 role="alert"（屏幕阅读器会立即播报），6 秒自动消失，
      Esc 或 ✕ 可关闭。接管失败时退回原生 alert，绝不会静默吞掉消息。

   真正需要 focus 环的样式在 assets/responsive.css 的 :focus-visible。
   ============================================================ */
(function () {
  'use strict';

  var nativeAlert = window.alert;

  /* ---------------- 1. 键盘可达性 ---------------- */

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

  /* ---------------- 2. 提示条 ---------------- */

  var TOAST_MS = 6000;

  function container() {
    var box = document.querySelector('.ft-toasts');
    if (box) return box;
    if (!document.body) return null;
    box = document.createElement('div');
    box.className = 'ft-toasts';
    document.body.appendChild(box);
    return box;
  }

  function dismiss(el) {
    if (!el || el.dataset.closing === '1') return;
    el.dataset.closing = '1';
    el.classList.add('is-out');
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }

  function showToast(message) {
    var box = container();
    if (!box) return false;

    var el = document.createElement('div');
    el.className = 'ft-toast';
    el.setAttribute('role', 'alert');

    var text = document.createElement('div');
    text.className = 'ft-toast-text';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ft-toast-x';
    close.setAttribute('aria-label', '关闭提示');
    close.textContent = '✕';
    close.addEventListener('click', function () { dismiss(el); });

    el.appendChild(text);
    el.appendChild(close);
    box.appendChild(el);

    // 先插入空壳、下一拍再写文字：live region 必须已经存在于 DOM 中，
    // 屏幕阅读器才会把这次变化当成「新消息」播报（而不是静默插入）。
    window.setTimeout(function () {
      text.textContent = String(message == null ? '' : message);
    }, 0);

    // 只保留最近 4 条，避免连续报错时糊满屏幕
    var all = box.querySelectorAll('.ft-toast');
    for (var i = 0; i < all.length - 4; i++) dismiss(all[i]);

    window.setTimeout(function () { dismiss(el); }, TOAST_MS);
    return true;
  }

  window.alert = function (message) {
    try {
      if (showToast(message)) return;
    } catch (e) { /* 落到原生弹窗 */ }
    if (typeof nativeAlert === 'function') nativeAlert.call(window, message);
  };

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var box = document.querySelector('.ft-toasts');
    if (!box) return;
    var list = box.querySelectorAll('.ft-toast');
    if (!list.length) return;
    dismiss(list[list.length - 1]);
  });

  // 对外暴露，模块里需要主动播报时可直接调用（不必弹窗）
  window.FT = window.FT || {};
  if (!window.FT.toast) window.FT.toast = showToast;
})();
