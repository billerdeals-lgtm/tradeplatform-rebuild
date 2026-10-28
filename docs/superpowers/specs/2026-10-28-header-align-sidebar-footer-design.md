# 顶栏对齐、侧栏底部重排、模块页独立打开（2026-10-28）

## 背景

三处视觉/可用性问题：

1. 侧栏底部把「授权状态 + 数据本机存储 + 今日 AI 调用 + 三个操作按钮」压成 4 层 11px 小字，信息密度过高
2. 桌面端模块 `header` 66px、侧栏 logo 区 66~67px，高度靠内容算出，出现 1px 发丝缝；且 `leads.html` 的 header 是 62px，模块之间也不统一
3. 手机端直接访问 `modules/xxx.html`（不经外壳）时，上一版「压缩模块头为动作条」的规则把 `h1` 也藏了，页面没有标题

## 决策

### 1. 顶栏统一 60px

`assets/responsive.css` 新增桌面段：

```css
@media screen and (min-width: 861px) {
  header { min-height: 60px !important; padding-top: 8px !important; padding-bottom: 8px !important; box-sizing: border-box; }
}
```

同时 `index.html` 的 `.logo` 改为 `height:60px; padding:0 16px; box-sizing:border-box`。

选择 60px 而非维持 66px：两侧都偏厚，收窄后视觉更轻，且显式高度不依赖字体度量，彻底消除 1px 缝。`min-height` 而非 `height`：内容超长（窄桌面下 docs 标题 + 两个按钮换行）时允许自然增高，宁可变高也不裁切。

### 2. 侧栏底部两层

```
[试用 · 15 天]            [AI 剩 5]     ← .footchip，11px，带边框与背景，可点击
[🔑 授权]  [⬇ 备份]  [⬆ 恢复]          ← .footacts，11.5px，flex 三等分
```

- 左 chip = 授权状态，点击打开授权弹窗；右 chip = 试用 AI 剩余，点击打开 AI 设置
- 「数据 100% 本机存储」移入左 chip 的 `title`（首页空态卡已有「数据只保存你自己的浏览器里」）
- 「今日 AI 已用 N 次」移入右 chip 的 `title`
- `.navfoot` 的 `font-size:11px; opacity:.6` 移除——整块半透明正是「糊成一片」的观感来源；chip 与按钮各自带层次
- `licBadge` 文案压缩：`试用 · 15 天` / `✅ 已授权` / `⛔ 试用已结束`，完整信息进 `title`，去掉虚线下划线

### 3. 模块页独立打开

新增 `assets/standalone.js`，14 个模块在 `responsive.css` 之前同步引入：

- `window.self === window.top`（不在外壳 iframe 内）时给 `<html>` 加 `ft-standalone`
- `DOMContentLoaded` 后在 `body > header` 前插入 `<a class="ft-back" href="../index.html">← 工作台</a>`

`responsive.css` 的移动端收纳规则全部加 `html:not(.ft-standalone)` 前缀：

- 有外壳（iframe）→ 维持上一版的单层顶栏，模块头只留按钮
- 独立打开 → 标题、logo、返回链接都保留，并单独收紧尺寸（28px logo / 15px 标题 / 允许换行）

## 涉及文件

- `assets/responsive.css`：60px 桌面规则、`ft-standalone` 作用域、`.ft-back`
- `assets/standalone.js`：新增
- `index.html`：`.logo` 高度、`.navfoot` 结构与样式、AI chip 文案、`MODULE_V=20261028d`
- `js/license.js`：徽章文案压缩（引用加 `?v=2`，此前无版本号会被缓存）
- 14 个模块：引入 `standalone.js`、`responsive.css?v=6`

## 验证

- `node --check`：`standalone.js`、`license.js`、`index.html` 与 14 个模块内联脚本全通过
- CSS 花括号平衡；6 条收纳选择器已全部加作用域前缀；无残留未作用域规则
- 线上：`responsive.css?v=6` 含 60px 规则与 `ft-standalone` 段；`standalone.js` 200；`license.js?v=2` 为新文案；quotes/leads/docs 均引入 `standalone.js` 且 css 为 v6
- 回归：license 31/31、AI 名称校验 15/15、单证 i18n 2951/2951、AI 试用额度沙箱全过

## 风险

- 60px 是 `min-height`。若某模块在 861~1000px 内标题与按钮换行，该模块会高几像素，那一档宽度会重新出现轻微不齐（不影响功能，正常桌面宽度不触发）
- `standalone.js` 必须在 head 同步加载；若改成 `defer`，独立打开时会先闪一下无标题的顶栏
- 直接打开模块时返回链接固定指向 `../index.html`，模块目录结构不能变
