# 键盘可达性与焦点可见性（2026-10-28）

## 背景

上一轮盘点出的基线：`aria-*` 1 个、`role=` 0、`tabindex=` 0、内联 `onclick` 181 个、其中 `<div onclick>` 18 个。

关键判断：181 个 onclick 里有 159 个挂在原生 `<button>` 上，键盘本来可用。真正挡住键盘的只有：

- 首页 15 个导航项 + 4 张统计卡（`div` + `onclick`）
- customer360 的线索卡片 1 个 + 标签页 7 个
- docs / quotes 的商品选择行（各 1 / 2 个）
- maillog 可展开日志行、todos 可展开正文（各 1 个）

合计 37 个元素。本轮范围选择「先补键盘与焦点」，不做完整 WCAG AA（表单 label 关联、图片 alt、颜色对比度、表格 scope 留待下一轮）。

## 决策

### 1. 能换真按钮的就换，不能换的补语义

导航项与统计卡结构简单（单行），直接 `div` → `<button type="button">`：

- `.navitem` 加 `button.navitem` 复位（`width:100%; background:none; border:0; font-family:inherit; text-align:left; line-height:inherit`）
- `.stat` 加 `button.stat`（`width:100%; font:inherit; color:inherit`）
- `go()` 同步 `aria-current="page"`，替代只靠 `.on` 表示当前位置

其余 13 个是列表行 / 标签页 / 可展开卡片，内部含块级子元素，换成 `<button>` 会破坏布局，因此保留 `div` 并补 `role="button"`（标签页用 `role="tab"`）+ `tabindex="0"`。

### 2. 键盘行为统一放在 `assets/a11y.js`

- Enter / Space / Spacebar → `el.click()`（Space 先 `preventDefault`，否则页面滚动）
- 带 `aria-expanded` 的假按钮，点击时（捕获阶段）翻转开合状态，屏幕阅读器能读出展开/收起
- `role="tab"` 支持 ←/→/Home/End 在 `[role="tablist"]` 内移动并切换

页面内没有 `role="button"` 的场景就不需要引入该脚本，所以只有 5 个模块加载它（customer360 / docs / quotes / maillog / todos），引用带 `?v=1` 便于后续缓存失效。

### 3. 标签页的完整语义

`role="tab"` 光有 `aria-selected` 不够，还要能对应到面板：

- 每个标签 `id="tab-<name>"` + `aria-controls="tc-<name>"`
- 每个面板 `role="tabpanel"` + `aria-labelledby="tab-<name>"`
- `switchTab()` 同时维护 `.on` 与 `aria-selected`

### 4. 焦点可见性

`assets/responsive.css` 顶层加：

```css
:focus-visible { outline: 3px solid #ffc53d; outline-offset: 2px; }
header :focus-visible, nav :focus-visible, .mbar :focus-visible { outline-color: #ffd76e; outline-offset: 3px; }
```

用 `:focus-visible` 而不是 `:focus`：鼠标点击不留框。琥珀色在浅色卡片（#fff 底）与深绿（#084c38）上都够对比，深色底再提亮一档。

### 5. 跳转链接与抽屉状态

- `<body>` 首个子元素加 `.skip`「跳到主要内容」→ `#content`；`#content` 加 `tabindex="-1"` 才能接住焦点。平时 `left:-9999px`，聚焦时回到 `left:0`
- 汉堡按钮补 `aria-expanded` / `aria-controls="appnav"`，`toggleNav()` / `closeNav()` 同步状态并切换 `aria-label`（打开菜单 / 关闭菜单）
- 遮罩 `#mcover` 只是装饰性点击区，标 `aria-hidden="true"`

### 6. 弹窗名称

17 个 `<dialog>` 全部补可访问名称：

- 标题文案固定 → `aria-label`（如「单证夹」「AI 设置」「导出 Excel」）
- 标题会随新建/编辑变化（`#dlgTitle` / `#ce_title` / `#gTitle` / `#aiTitle`）→ `aria-labelledby` 指向该标题元素

## 涉及文件

- `assets/a11y.js`：新增
- `assets/responsive.css`：`:focus-visible` 规则；`v=8`
- `index.html`：导航 15 + 统计卡 4 改 `<button>`、`aria-current`、skip link、汉堡 aria、遮罩 aria-hidden、`MODULE_V=20261028f`
- `modules/customer360.html`：citem 与 7 个标签页语义、`switchTab` 同步 `aria-selected`、`selectLead(id, el)` 显式传元素（键盘触发时 `window.event` 不可靠）
- `modules/docs.html` / `quotes.html` / `maillog.html` / `todos.html`：假按钮语义 + 引入 `a11y.js`
- 全部 14 个模块：`responsive.css?v=8`

## 验证

- `node --check`：`index.html` 与 14 个模块内联脚本、`a11y.js`、`standalone.js`、`license.js` 全通过
- CSS 花括号平衡 0
- 计数：`aria-*` 58（原 1）、`role=` 21（原 0）、`tabindex=` 14（原 0）、`<button>` 179（原 159）
- 残留 `div[onclick]` 14 个，其中 13 个已带 `role` + `tabindex`，1 个是 `aria-hidden` 的遮罩
- 回归：license 31/31、AI 名称校验 15/15、单证 i18n 2951/2951、AI 试用额度沙箱全过

## 风险与已知缺口

- 假按钮用 `role="button"` 而非原生 `<button>`，不享受浏览器自带的 Enter/Space 行为，全靠 `a11y.js`；该脚本必须先于用户操作加载（目前同步引入，在 `</head>` 前）
- 仍缺：表单 `label` 与输入框的 `for`/`id` 关联、图片 `alt`、表格 `scope`、对比度审计、错误提示 `role="alert"`、Tab 面板的 `aria-hidden` 切换。这些属于完整 WCAG AA，未在本轮范围
- `#content` 获得焦点时会出现整块琥珀色描边；这是跳转后的位置反馈，若观感太强可改为 `#content:focus-visible { outline: none }`
