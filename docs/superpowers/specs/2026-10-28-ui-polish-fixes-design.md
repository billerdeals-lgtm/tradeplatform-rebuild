# FT Compass · 界面修复批次（2026-10-28）

## 背景

上线后自测发现两类问题：两处 P1 级可用性缺陷（手机端搜索框不可用、空表单默认报红），以及一批打磨层面的不一致。本轮只处理低风险项，可访问性（a11y）改造单独立项。

## 范围

| # | 问题 | 处理 |
|---|---|---|
| 1 | 手机端 `.toolbar` 搜索框被三个按钮挤成 26px | 输入框在 ≤860px 独占一行 |
| 2 | 报价 / 单证空表单即显示「输出校验未通过」 | 校验导航器只在首次点导出/打印后出现 |
| 3 | 利润计算器空表单即显示「利润率极低」 | 首次输入或点计算后才出预警，空态数值显示 `—` |
| 4 | 每日 AI 额度按 UTC 跨日，北京时间 8 点重置 | 改本地日期 |
| 5 | 手机端双层深绿顶栏（外层栏 + iframe 模块头） | 模块头压缩为动作条 |
| 6 | 首页 15 项导航平铺、空态无引导 | 四组分组 + 空数据引导卡 |
| 7 | 演示数据自动写入正式列表、工具栏常驻「俄语演示」 | 取消自动播种，收进空态卡 |
| 8 | 模块标题不统一（`FT Compass · 线索工作台` vs `报价管理`） | 标题只留模块名，品牌名交给侧栏 |

不做：事件委托改造、`aria-*`、`role`/`tabindex`、键盘可达性。另开一轮。

## 设计决策

### 1. 搜索框

`responsive.css` 移动段新增：

```css
.toolbar input:not([type="checkbox"]):not([type="radio"]) { flex: 1 1 100% !important; }
```

放在原 `min-width: 0 !important` 之后。输入框整行，按钮换行；`select` 与原规则不变，避免筛选下拉也被顶成整行。

### 2. 空表单校验

`quotes.html` 与 `docs.html` 的 `refreshGate()` 都写成 `(gateRan || issues.length)`，空表单 issues 天然非空，导致 `gateRan` 失效。

改为只认 `gateRan`：未点导出/打印前只渲染「已隔离内部字段」提示，不渲染红/黄导航器。`runGate(true)` 仍然置位并强制渲染，行为不变。

利润计算器新增 `calcRan`：初始只算数字不渲染 `warnArea`；用户改任一输入或点「计算」后置位。空态下利润率、FOB、CIF 等数值显示 `—`，避免 `0.00` 被误读为真实报价。

### 3. 每日额度日期

`agnes-ai.js` 的 `todayCount()` / 计数写入使用 `toISOString().slice(0,10)`（UTC）。改为本地日期串 `YYYY-MM-DD`（`getFullYear` / `getMonth()+1` / `getDate`，补零）。存储键格式不变，只是键值从 UTC 日期变为本地日期，不影响既有计数读取逻辑。

### 4. 双层顶栏

手机端保留外层顶栏（☰ + 模块名 + 授权状态点），它承担导航与标题。

iframe 内 `<header>` 压缩为动作条：

```css
@media screen and (max-width: 860px) {
  header { justify-content: flex-end !important; padding: 6px 10px !important; min-height: 0 !important; }
  header img, header h1 { display: none !important; }
  header:not(:has(button)) { display: none !important; }
}
```

有按钮的模块（单证、商品、竞品、线索、待办）保留一行右对齐按钮；无按钮的模块整条隐藏。`:has()` 不支持时退化为 12px 高的窄条，可接受。

不采用「隐藏外层顶栏、让模块头当主栏」：☰ 在外层，隐藏后手机端无法打开抽屉。

### 5. 首页导航与空态

导航分四组，带组标题（`PROSPECT / FOLLOW UP / CLOSE / OPERATE` 风格的中文短标签）：

- 开发：找客户、线索 Pipeline、客户 360°、竞品库
- 跟进：待办任务、话术库、发送记录
- 成交：报价管理、商品库、利润计算器、单证中心
- 经营：复盘增长、复购·节假日、我的资料

「工作台」保持在组外顶部。`.navgroup` 为纯展示元素，不参与 `.navitem` 的点击与 `on` 状态逻辑。

空数据（`leads.length === 0`）时，统计卡下方显示引导卡：一句说明 + 「去找客户」「录入线索」两个按钮；有数据时移除。

### 6. 演示数据

- 删除 `leads.html` 首次运行自动写入 2 条示例线索的逻辑
- 删除工具栏常驻的「🇷🇺 俄语演示」按钮
- 线索列表为空时，空态卡提供两个次级入口：「载入 2 条示例」「载入俄语单证演示」，并注明可删除
- 线索页空列表文案改为引导语，不再是空表格

### 7. 标题统一

`leads.html` 的 `<h1>FT Compass · 线索工作台</h1>` 改为 `<h1>线索工作台</h1>`。品牌名只出现在侧栏 logo 与外层顶栏。其余模块标题已短，不动。

## 涉及文件

- `assets/responsive.css`（搜索框、模块头压缩）
- `index.html`（导航分组样式与结构、首页空态、版本号）
- `modules/leads.html`（去自动播种、去演示按钮、空态、标题）
- `modules/quotes.html`、`modules/docs.html`（`gateRan`）
- `modules/calculator.html`（`calcRan`、空态占位）
- `agnes-ai.js`（本地日期）

## 验证

1. `node --check` 校验改动的内联脚本与 `agnes-ai.js`
2. 逐模块核对 `?v=` 与 `MODULE_V` 已升版
3. 线上核对首页、四个改动模块返回 200，资源版本号正确
4. 手机端（≤860px）人工确认：搜索框整行、单层顶栏、首页分组与引导卡

## 风险

- `:has()` 在旧 WebView 不生效 → 退化为窄条，不影响功能
- 演示数据不再自动写入 → 老用户已写入的示例数据不会自动清除，需手动删
- 校验延迟显示 → 用户首次填完就点导出，仍会看到完整清单，行为不变
