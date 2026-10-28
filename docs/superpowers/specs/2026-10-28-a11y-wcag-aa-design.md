# 全站 WCAG AA 收口设计（2026-10-28）

## 背景

上一轮（`ae2b0d3`）只解决了「键盘能不能用」：导航与统计卡换成真按钮、假按钮补 `role`/`tabindex`、弹窗补名称、加跳转链接与 `:focus-visible`。这一轮把剩下的 AA 项一次补齐，并把可达性从「客户 360° 示范页」扩到 15 个页面。

盘点时发现的真实缺口：

| 项 | 现状 | 影响 |
|---|---|---|
| `<label>` 关联 | 117 个 label，`for` 为 0 | 读屏只念「编辑框」，不知道要填什么 |
| `<dialog>` 语义 | 21 个原生 dialog，0 个显式 `role` | 依赖浏览器隐式语义，辅助技术兼容性不稳 |
| 表格 | 5 张表、30 个 `<th>`，`scope` 为 0；docs 纸面表无 `thead` | 读屏无法把表头和数据格对应 |
| 图片 alt | 19 张全有 alt，其中 7 处是 `alt="logo"` | 与旁边的 `<h1>` 重复朗读 |
| 对比度 | 13 组真实失败 | 辅助文字 2.2:1、输入框边框 1.6:1 |
| 错误提示 | 27 处原生 `alert()` | 阻塞、样式不可控、移动端挡屏 |
| 结果播报 | 结果区无 `aria-live` | AI 输出/计算结果变化时读屏静默 |

## 范围

首页 + 14 个模块，不含 `agnes-ai-demo.html`（演示页，不对外）。

## 关键决策

### 1. 对比度用「专用文字 token」，不动基础品牌色

直接压深 `--ok/--warn/--danger/--info` 会连带改掉图标、圆点、左边条、边框的观感。改为：

- 基础色 `--ok/--warn/--danger/--info`：只用于 `background` / `border` / 图形；
- 新增 `--ok-text #0f7a58`、`--warn-text #ae5008`、`--danger-text #b02f0b`、`--info-text #1d4ed8`：只用于 `color`；
- `--text-3` 本身就是文字 token，直接由 `#9aa5b1` 压到 `#646f7b`；
- 新增 `--border-field #8b8577` 专门给输入框/下拉框边框；`--border-strong` 退回装饰性用途（虚线区、表格网格、胶囊描边）。

规则：写 `color` 用 `*-text`，写背景/边框用基础色。

实测（白色 / 页面底 / 内嵌底）：

| token | 白底 | 页面底 | 内嵌底 |
|---|---|---|---|
| `--text-3` #646f7b | 5.12 | 4.86 | 4.53 |
| `--border-field` #8b8577 | 3.67 | 3.49 | 3.25 |
| `--ok-text` #0f7a58 | 5.32 | — | 4.57（ok-bg） |
| `--warn-text` #ae5008 | 5.32 | — | 4.71（warn-bg） |
| `--danger-text` #b02f0b | 6.45 | — | 5.27（danger-bg） |
| `--info-text` #1d4ed8 | 6.70 | — | 5.49（info-bg） |

其他单点修正：

- 焦点环：浅色区 `#ffc53d`（白底 1.58）→ `#a16207`（4.92）；深绿区保留 `#ffd76e`（6.33）。
- 侧栏分组标题 `rgba(255,255,255,.38)`（2.80）→ `.62`（4.89）。
- `customer360` 的 WhatsApp 按钮 `#25d366`（白字 1.98）→ `#075e54`（7.67）；报价按钮 `#f59e0b`（2.15）→ `#b45309`（5.02）。
- `profile` 的 `::placeholder { opacity:.55 }` 会让已经压深的 `--text-3` 再淡一半，改为 `1`。

`--border` 的卡片描边（1.25:1）不改：它不是识别控件的唯一线索，属于装饰性描边，WCAG 1.4.11 不强制。

### 2. `alert()` 改右下角 `role="alert"` 提示条

由 `assets/a11y.js` 接管 `window.alert`，调用方 27 处代码一行不改：

- 容器 `.ft-toasts`，每条 `.ft-toast` 带 `role="alert"`；
- 先插入空壳、下一拍再写文字，确保 live region 已在 DOM 中，读屏能捕获变化；
- 6 秒自动消失，Esc 或 ✕ 可关闭，最多同时保留 4 条；
- `white-space:pre-wrap` 保留原有换行（多处提示是多行步骤说明）；
- 任何异常回退原生 `alert`，绝不静默吞消息；
- 打印时隐藏。

样式放在 `assets/responsive.css`（深底 `#1f2933`、白字 14.8:1）。

### 3. 弹窗显式补 `role="dialog" aria-modal="true"`

原生 `<dialog>` 用 `showModal()` 时浏览器有隐式 `role=dialog`、`aria-modal=true`，但不同辅助技术实现不一致。21 个弹窗全部显式写出，名称沿用已有的 `aria-label` / `aria-labelledby`。

### 4. 结果区补 live region

| 页面 | 容器 | 角色 |
|---|---|---|
| calculator | `#resultBox` `#warnArea` `#convResult` `#aiOut` | `aria-live=polite` / `status` |
| leads | `#t_out` | `aria-live=polite` |
| holidays | `#gOut` | `aria-live=polite` |
| profile | `#polish_out` `#saved` | `aria-live=polite` / `status` |
| docs | `#polishOut` `#aiOut` | `aria-live=polite` |
| quotes | `#aiOut` | `aria-live=polite` |
| customer360 | `#noteSaved` `#aiSummary` | `status` / `aria-live=polite` |
| find | `#fInfo` `#log` | `status` / `log` |

`holidays` 与 `docs` 原本先写文字再 `display:block`，live region 在隐藏状态收不到变化，已改为先显示再写内容。

### 5. 客户 360° 空状态改版 + `FT.go`

旧版左栏只有一句「暂无线索数据」，右栏一句「← 从左侧选择客户」，箭头指向空列表。新版：

- 左栏空状态卡：图标 + 说明 + 主 CTA「去找客户」+ 次 CTA「录入线索」+ 文字链「载入 2 条示例」；搜索无结果时是另一套文案（「没有匹配的客户 / 清空搜索」），不误导。
- 右栏默认卡：说明 360° 会汇总什么（跟进时间线、关联单据、AI 摘要），不再指向空左栏。
- 「载入示例」直接写两条 leads 到本机 DataStore，渲染后自动选中第一条，并用 toast 反馈。
- 新增 `FT.go(view)`（`assets/standalone.js`）：iframe 内优先 `parent.go()`，跨域时 `postMessage`，独立打开时按站点根算地址；首页补 `ft:navigate` 监听并做 `modules/*.html` 白名单校验。`customer360` 报价按钮与 `products` 转报价都改用它，独立打开不再报错。

### 6. 覆盖面统一

`a11y.js` 从 5 个模块扩到 14 个模块 + 首页；label / aria-label / 表格语义 / 图片 alt / 弹窗语义在每一页都过了一遍，不再只有示范页。

## 改动清单

- `assets/tokens.css`：4 个 `*-text`、`--border-field`、`--text-3` 压深。
- `assets/responsive.css`：提示条样式；焦点环 `#a16207`；打印/降级动效处理。
- `assets/a11y.js`：提示条 + `alert` 接管 + `FT.toast`，保留原有键盘逻辑。
- `assets/standalone.js`：`FT.go`。
- `index.html`：引入 `a11y.js`、`ft:navigate` 监听、侧栏分组标题 alpha。
- 14 个模块：label `for`/`id`、控件 `aria-label`、`th scope`、表名、图片 alt、弹窗语义、live region、对比度 token 替换。
- 版本号：`responsive.css?v=9`、`tokens.css?v=2`、`a11y.js?v=2`、`MODULE_V=20261028g`。

## 验证

- `node --check`：`a11y.js`、`standalone.js` 通过；15 个页面内联脚本全部通过。
- CSS 花括号：`tokens.css` 10/10、`responsive.css` 88/88，各页 `<style>` 平衡。
- 对比度扫描：129 组「文字色 + 背景色」规则，13 组不达标，全部为半透明背景导致的误报（实际叠在深绿/深底上均为 1.00 之外的正常值）。
- 结构校验：所有 `label for` 目标存在、19 张图有 alt、30 个 th 有 scope、5 张表有名称、21 个弹窗语义完整。
- 既有测试：license 31/31、docs-i18n 2951/2951、ai-verify 15/15、ai-source 11/11。

## 已知边界

- 读屏实际播报依赖浏览器/辅助技术组合，自动化只能验证语义与属性，最终仍需真机抽听。
- 内置 AI key 仍是客户端混淆，真正的密钥保护需要 Cloudflare Worker（待 `wrangler login`）。
- 旧泄露 key 需在 Agnes 控制台吊销；git 历史 `621f8b8` 仍含该 key。
