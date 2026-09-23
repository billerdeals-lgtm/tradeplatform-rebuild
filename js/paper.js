/* ============================================================
   FT Compass · Paper v1.0
   5 套纸面模板 + 横竖方向（HUIDI feature 4）
   - PAPER_STYLES / PAPER_ORIENTS
   - 注入共享 CSS（tpl-* / orient-*）
   - 偏好存 DataStore cfg：paperStyle / paperOrient
   ============================================================ */
(function (global) {
  'use strict';

  var PAPER_STYLES = [
    { id: 'classic', name: '经典商务' },
    { id: 'minimal', name: '极简外贸' },
    { id: 'formal',  name: '正式合同' },
    { id: 'brand',   name: '品牌展示' },
    { id: 'customs', name: '清关实用' }
  ];

  var PAPER_ORIENTS = [
    { id: 'portrait',  name: '竖版 A4' },
    { id: 'landscape', name: '横版 A4' }
  ];

  /* 共享模板 CSS：挂在 .paper 下，不依赖页面 */
  var CSS = ''
    + '.paper{position:relative}'
    + /* 竖/横方向 */
    '.paper.orient-portrait{min-height:500px}'
    + '.paper.orient-landscape{aspect-ratio:297/210;min-height:0;overflow:auto;padding:32px 40px}'

    + /* 1 经典商务（默认，米色表头） */
    '.paper.tpl-classic th{background:#f5f3ee;font-size:12px}'
    + '.paper.tpl-classic th,.paper.tpl-classic td{border-color:#cfc9b8;padding:7px 10px}'
    + '.paper.tpl-classic h2{font-size:18px;letter-spacing:.02em}'

    + /* 2 极简外贸：无底表头、细线、更紧凑 */
    + '.paper.tpl-minimal th{background:transparent;border-top:none;border-left:none;border-right:none;border-bottom:2px solid #1f2933;font-weight:600;font-size:11.5px;color:#52606d;text-transform:uppercase;letter-spacing:.06em;padding:6px 8px}'
    + '.paper.tpl-minimal td{border-color:#e4e0d4;border-left:none;border-right:none;padding:6px 8px}'
    + '.paper.tpl-minimal h2{font-weight:600;font-size:17px}'
    + '.paper.tpl-minimal .notes,.paper.tpl-minimal .sig{font-size:12px;color:#52606d}'

    + /* 3 正式合同：居中标题、双线、衬线感 */
    + '.paper.tpl-formal h2{font-size:20px;letter-spacing:.08em;text-transform:uppercase;border-bottom:3px double #1f2933;padding-bottom:8px;margin-bottom:4px}'
    + '.paper.tpl-formal th{background:#e8e4d9;font-size:12px;font-weight:700;border-color:#8c8577}'
    + '.paper.tpl-formal td{border-color:#8c8577;padding:8px 10px}'
    + '.paper.tpl-formal .party,.paper.tpl-formal .parties{border-top:1px solid #1f2933;border-bottom:1px solid #1f2933;padding:10px 0;margin:14px 0}'
    + '.paper.tpl-formal .sig{border-top:1px solid #1f2933;padding-top:12px}'

    + /* 4 品牌展示：品牌色顶条 + 品牌色表头（brandColor 由 JS 写入 --paper-brand） */
    + '.paper.tpl-brand{border-top:6px solid var(--paper-brand,#0b6e4f)}'
    + '.paper.tpl-brand h2{color:var(--paper-brand,#0b6e4f);font-size:19px}'
    + '.paper.tpl-brand th{background:var(--paper-brand,#0b6e4f);color:#fff;font-size:12px;border-color:var(--paper-brand,#0b6e4f)}'
    + '.paper.tpl-brand td{border-color:color-mix(in srgb,var(--paper-brand,#0b6e4f) 35%,#cfc9b8)}'
    + '.paper.tpl-brand tfoot tr td,.paper.tpl-brand .total-row td{background:color-mix(in srgb,var(--paper-brand,#0b6e4f) 12%,#fff);font-weight:700}'
    + '.paper.tpl-brand .br-top-name{color:var(--paper-brand,#0b6e4f)}'

    + /* 5 清关实用：高密度、大写标签、斑马纹 */
    + '.paper.tpl-customs{padding:28px 36px}'
    + '.paper.tpl-customs h2{font-size:15px;text-transform:uppercase;letter-spacing:.1em}'
    + '.paper.tpl-customs table{font-size:12px}'
    + '.paper.tpl-customs th{background:#1f2933;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:5px 7px;border-color:#1f2933}'
    + '.paper.tpl-customs td{padding:4px 7px;border-color:#9aa5b1}'
    + '.paper.tpl-customs tbody tr:nth-child(even) td{background:#f3f1ea}'
    + '.paper.tpl-customs .notes{font-size:12px;line-height:1.6}'

    + /* 横版打印适配 */
    + '@media print{'
    + 'body>*:not(main){visibility:hidden}'
    + '.paper.orient-landscape{width:297mm;height:210mm;aspect-ratio:auto;border:0;box-shadow:none;padding:16mm 18mm;overflow:visible}'
    + '.paper.orient-portrait{width:210mm;min-height:297mm;border:0;box-shadow:none}'
    + '}';

  function injectCSS() {
    if (document.getElementById('paper-style')) return;
    var st = document.createElement('style');
    st.id = 'paper-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function cfg() {
    try { return DataStore.getCfg() || {}; } catch (e) { return {}; }
  }

  function getStyle() {
    var id = cfg().paperStyle || 'classic';
    return PAPER_STYLES.some(function (s) { return s.id === id; }) ? id : 'classic';
  }

  function getOrient() {
    var id = cfg().paperOrient || 'portrait';
    return PAPER_ORIENTS.some(function (o) { return o.id === id; }) ? id : 'portrait';
  }

  function setStyle(id) {
    try { DataStore.setCfg({ paperStyle: id }); } catch (e) {}
    return id;
  }

  function setOrient(id) {
    try { DataStore.setCfg({ paperOrient: id }); } catch (e) {}
    return id;
  }

  /** 应用模板+方向+品牌色到 .paper 元素 */
  function apply(el) {
    if (!el) return;
    injectCSS();
    PAPER_STYLES.forEach(function (s) { el.classList.remove('tpl-' + s.id); });
    PAPER_ORIENTS.forEach(function (o) { el.classList.remove('orient-' + o.id); });
    el.classList.add('tpl-' + getStyle());
    el.classList.add('orient-' + getOrient());
    var color = '#0b6e4f';
    try { color = (Brand.get() && Brand.get().brandColor) || color; } catch (e) {}
    el.style.setProperty('--paper-brand', color);
  }

  /** 工具条 HTML（select 模板 + select 方向），onchange 调本页钩子 */
  function toolbarHTML() {
    var st = getStyle(), or = getOrient();
    var opts = PAPER_STYLES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === st ? ' selected' : '') + '>' + s.name + '</option>';
    }).join('');
    var oopts = PAPER_ORIENTS.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === or ? ' selected' : '') + '>' + o.name + '</option>';
    }).join('');
    return '<select id="paperStyle" onchange="onPaperStyle()" title="纸面模板" style="padding:4px 6px;border:1px solid var(--border-strong,#cfc9b8);border-radius:4px;font-size:12px">'
      + opts + '</select>'
      + '<select id="paperOrient" onchange="onPaperOrient()" title="横/竖版" style="padding:4px 6px;border:1px solid var(--border-strong,#cfc9b8);border-radius:4px;font-size:12px">'
      + oopts + '</select>';
  }

  injectCSS();

  global.Paper = {
    PAPER_STYLES: PAPER_STYLES,
    PAPER_ORIENTS: PAPER_ORIENTS,
    getStyle: getStyle,
    getOrient: getOrient,
    setStyle: setStyle,
    setOrient: setOrient,
    apply: apply,
    toolbarHTML: toolbarHTML
  };
})(window);
