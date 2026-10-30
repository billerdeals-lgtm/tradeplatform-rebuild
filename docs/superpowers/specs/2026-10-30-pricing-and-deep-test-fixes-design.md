# 2026-10-30 定价公式修正与深度测试问题修复

## 背景

用户对线上版本做深度测试，发现 1 个会产生错误报价的计算 bug、3 个 P1、3 个 P2、2 个 P3。
其中利润计算器的问题会直接算错报价，优先级最高。

## 定价公式（唯一真源：`js/pricing.js`）

旧公式：

```js
totalCost = unitCost + ocean + insurance + customs + portFee;
fobCNY = totalCost / (1 - comm) * (1 + margin);
cif = fob + (ocean + insurance) / rate;
commPrice = fob / (1 - comm);
```

三类错误：

1. **运保重复计算**：FOB 已含海运/保险，CIF 又加一次。
2. **毛利率被当成成本加成**：`×(1+margin)` 是 markup；目标 30% 实际毛利只有 23.1%。
3. **佣金二次除佣**：FOB 已除过 `(1-comm)`，含佣价又除一次。

新口径：

```js
unitCost     = 采购 + 国内运费 + 包装 + 检验 + 其他;
costExFreight = unitCost + 报关 + 港杂;          // FOB 基准，不含运保
fob          = costExFreight / ((1 - comm) * (1 - margin)) / rate;
cif          = fob + (ocean + insurance) / rate;   // 运保只加一次
commission   = fob * comm;                          // 佣金已计入 FOB
netCNY       = fob * rate * (1 - comm);
profit       = (netCNY - costExFreight) / rate;
actualMargin = (netCNY - costExFreight) / netCNY;   // 回到用户填的毛利率
markup       = margin / (1 - margin);
```

验证数字（成本 ¥100，汇率 7.25）：

| 场景 | FOB | CIF |
| --- | --- | --- |
| 毛利率 0，海运 ¥725 | $13.79 | $113.79 |
| 毛利率 30% | $19.70 | $19.70 |
| 毛利率 30%，佣金 5% | $20.74（含佣 $1.04） | $20.74 |

界面同步修改：

- 「目标利润率」→「毛利率（占售价 %）」；
- 结果区「单位总成本（含运费）」→「出口成本（FOB 基准，不含运保）」；
- 「含佣报价」→「佣金（每件，外币）」；
- 成本拆解里同时显示成本加成（markup），公式原样印出。

回归测试：`node tools/test-pricing.mjs`（18 项）。

## 其余修复

| 级别 | 问题 | 处理 |
| --- | --- | --- |
| P1 | `Gate.checkQuote` 没有 AI 核价提示 | `aiEstimated` 时对 `itemsBody` 加 warn，不阻断 |
| P1 | `onLeadPick()` 读不存在的 `#q_product` | 改为查第一行 `.it-name`，仅空值时填入 |
| P1 | 「3 天内待跟进」恒等于总数 | 改为 `last < today-3` 且排除「成交」，标签改「超3天未跟进」 |
| P2 | 客户版纸面印内部血缘行 | 从 `renderPaper` 移除 `⛓ Derived from …`，数据仍保留供内部追溯 |
| P2 | 数量列 42px，4 位数被截断 | 数量列 9%→12%，`.it-qty{min-width:64px}` |
| P2 | 5 处日期用 UTC | 新增 `FT.today(offset)`（`assets/standalone.js`），替换全部 UTC 日期 |
| P2 | `excel.js` 三个版本号 | 统一 `?v=6`；`standalone.js` 统一 `?v=2` |
| P3 | 首页有数据仍下半屏空白 | 新增「今日工作台」：今天该跟进 / 临期待办 / 最近报价，无数据时隐藏 |
| P3 | 429 无重试且抛原始 JSON | 429 退避 1s 重试 1 次；401/403/404/429/5xx 映射成人话 |
| P3 | `backupHasData` 只查 6 类 | 覆盖 leads/todos/outreach/quotes/docs/reviews/comps/profile/products/searches/calculations |
| 实际 bug | 计算历史写进 `localStorage["undefined"]` | `KEYS` 补 `calculations`；启动时把旧键迁移/按 id 合并；备份恢复变为 12 个键 |
| 小问题 | `pricing.js` 的 7.25 回退永远不触发 | 删掉回退；汇率缺失/为 0/非数字统一报「汇率必须大于 0」，避免两层规则矛盾 |

## 日期口径

`FT.today(offset)` 用 `getFullYear/getMonth/getDate` 生成本地 `YYYY-MM-DD`，禁止再用
`toISOString().slice(0,10)`。`offset` 为天数，可为负：`FT.today(-3)` 是三天前。
首页（外壳）也加载 `assets/standalone.js`，只为拿这个函数；独立打开补丁只对
`/modules/` 路径生效，不会给首页插入「← 工作台」。

## 计算历史数据键

`DataStore.KEYS` 之前没有 `calculations`，`DataStore.add('calculations', …)` 实际写进了
字面量键 `localStorage["undefined"]`。修复：

- `KEYS.calculations = 'ftc_calculations_v1'`；
- `js/datastore.js` 启动时读取旧 `"undefined"` 键：新键不存在则整体搬入；已存在则按
  `id` 合并去重后删除旧键；旧键不是数组时不处理；
- 备份 / 恢复 / `exportAll` 按 `KEYS` 遍历，自动变成 12 类；`COLL_LABEL` 增加
  「计算历史」，备份提醒也把计算历史算作业务数据。

回归测试：`node tools/test-datastore.mjs`（12 项）。

## 汇率回退

`pricing.js` 原来在 `rate` 为空时回退 7.25，但调用方 `n('c_rate')` 已把空值转成 0，
回退永远不触发，两层规则矛盾。现在删除回退：`rate` 缺失、为 0 或非数字统一返回
「汇率必须大于 0」。报错比静默按 7.25 计算更安全。


## 测试

- `node tools/test-pricing.mjs`：18/18
- `node tools/test-license.mjs`：31/31
- `node tools/test-docs-i18n.mjs`：2951/2951
- `node tools/test-ai-verify.mjs`：15/15
- `node tools/test-ai-source.mjs`：11/11
- 全量内联脚本 `node --check` 通过；a11y 静态校验通过。
