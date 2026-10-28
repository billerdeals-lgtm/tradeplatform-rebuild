# AI 密钥处理与试用 AI 额度（2026-10-28）

## 背景

`agnes-ai.js` 第 25 行曾把 Agnes API Key 明文硬编码在客户端，且在公开仓库的提交 `621f8b8` 中。任何访问站点或克隆仓库的人都能取走这把 key 并消耗额度。

用户选择 **方案 B：仅客户端混淆**（不引入服务端代理），并把试用 AI 调用次数定为 **5 次**。

## 决策

### 1. 密钥：混淆而非加密

- `DEFAULTS.key` 改为空字符串，表示「使用内置密钥」；用户填写则优先用自己的。
- 内置密钥以 `KEY_ENC` 存放：`XOR(KEY_MASK)` → base64 → 切成 3 段字符串数组，运行时由 `defaultKey()` 拼接还原，结果缓存。
- 源码中不再出现 `sk-` 字面量。
- 新增 `tools/encode-key.mjs`：
  - `node tools/encode-key.mjs "sk-xxx"` 输出可粘贴的 `KEY_ENC` 行
  - `--check` 校验现有分片能否还原

**明确记录：这不是安全措施。** 浏览器请求头 `Authorization: Bearer <key>` 在 DevTools Network 面板明文可见，抓包比读源码更简单。真正的保护只有服务端代理（Cloudflare Worker + secret + CORS 白名单 + 按激活码/IP 限流），本轮未做。

**遗留动作**：这把 key 已泄露，必须在 Agnes 控制台吊销并重新生成；换新后重新编码替换 `KEY_ENC`。必要时清理 git 历史。

### 2. 试用 AI 额度：5 次

- `AI_TRIAL_LIMIT = 5`，与试用挖掘 30 次、试用 15 天、每日 100 次相互独立。
- 拦截点在 `agnesChat`：非激活用户且非 `opts.skipTrial` 时，`aiTrialLeft() <= 0` 抛错「试用 AI 次数已用完（共 5 次）。激活后不限次数。」
- 计数仅在**接口成功返回**后 +1（超时、401、空返回都不扣次数）。
- `ping()`（设置面板「测试连通」）带 `skipTrial: true`，不占额度。
- 试用计数存三处冗余：localStorage `_a7f1d2`、`_e3b9c4` 与 cookie `_ftai`，值均为 `base64url(XOR(JSON))`，读取时取三者最大值。目的只是挡住「清掉一个 key 就重置」，不是防篡改——客户端额度本质上可绕过。

### 3. 激活状态识别

AI 配额要在 14 个模块里生效，但只有 5 个模块加载 `js/license.js`。因此 `isPro()` 分两级：

1. `window.License.status().pro`（已初始化时最权威）
2. 兜底：直接解 `localStorage._c5d8e1`，格式与 `license.js` 的 `seal()` 一致（`base64url(XOR(JSON))`），存在 `payload.co` 与 `payload.id` 即视为已激活

损坏或伪造的记录解不出来 → 退回试用态，不会误判为已激活。

### 4. UI 暴露

- 首页底部：`今日 AI 已用 N 次 · 试用 AI 剩 M 次`（已激活时省略后半段）
- 设置面板：`今日已调用 N 次 · 试用 AI 剩余 M / 5 次` 或 `已激活，AI 不限次数`

导出新增 `AgnesAI.aiTrialLeft()` 与 `AgnesAI.aiTrialLimit`。

## 涉及文件

- `agnes-ai.js`：`KEY_ENC`/`defaultKey()`、试用额度与冗余计数、`isPro()` 兜底、设置面板文案
- `tools/encode-key.mjs`：编码工具
- `index.html`：`aiCnt` 显示试用剩余、`MODULE_V=20261028b`、`agnes-ai.js?v=7`
- 11 个模块：`agnes-ai.js?v=7`

## 验证

沙箱测试（`vm` + 伪造 localStorage/cookie/fetch）覆盖：

- 源码无 `sk-` 字面量，`KEY_ENC` 三段可在运行时还原出可用 key（断言实际发出的 `Authorization` 头）
- 5 次用满后第 6 次被拦；`ping` 不占额度
- 清掉 1 个、2 个 localStorage 键仍保持 0（cookie 兜底）
- `License.status().pro` 与「仅有本地授权记录」两种情况都识别为不限次
- 损坏的授权记录退回试用

既有回归：license 31/31、AI 名称校验 15/15、单证 i18n 2951/2951。

## 风险

- 混淆只能防「顺手搜索源码」，抓包即可获得 key；额度也可通过清空三处存储重置
- 更换 key 后旧编码失效，必须重新跑 `tools/encode-key.mjs`
- git 历史中仍存在旧 key，公开仓库可回滚查看；吊销旧 key 才是有意义的处置
