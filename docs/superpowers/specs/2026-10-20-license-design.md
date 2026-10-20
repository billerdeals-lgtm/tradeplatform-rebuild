# FT Compass 授权体系设计（试用 + 永久买断激活）

- 状态：已批准（2026-10-20）
- 范围：试用限制、离线激活码、锁屏、导出水印、签发工具
- 不包含：支付对接、发卡台、云端校验、D1
- 约束：纯静态、无后端、离线可激活、大陆网络环境可用

---

## 1. 背景与目标

FT Compass 以 **100 元/家、永久买断** 的方式出售给大陆中小外贸公司。

销售路径：先完整试用 → 觉得好用 → 付费拿激活码 → 本机永久解锁。

设计目标，按优先级：

1. **不增加转化摩擦**：不注册、不联网、不绑设备、不填手机号。
2. **试用期可完整体验**：所有模块都能点，只限制「规模化使用」。
3. **激活可离线完成**：断网、内网、翻墙不稳都不影响。
4. **客服成本≈0**：换电脑只需重贴同一个码，不需要你介入。
5. **防伪造**：没有私钥的人无法生成有效激活码。

## 2. 非目标

- 不阻止「激活码被转发」（100 元价位，技术手段收益低于成本；用水印缓解）。
- 不阻止「清空浏览器数据重置试用」（次数上限本身很低，接受）。
- 不做浏览器指纹、不做设备绑定、不做加密壳、不做代码混淆。
- 不做到期锁死与续费提醒（永久买断）。

## 3. 商业规则

| 项 | 规则 |
|---|---|
| 售价 | 100 元 / 家 |
| 授权期限 | 永久买断，当前大版本内永久可用 |
| 授权粒度 | 一码一公司（激活码内含公司名与授权编号） |
| 设备限制 | 无（同一码可在任意电脑激活） |
| 试用期 | 15 天 **或** 30 次「开始挖掘」，先到为准 |
| 试用期功能 | 全模块可用；导出带试用水印 |
| 付费后 | 水印替换为「授权给 公司名 · 编号」 |

## 4. 架构

```
index.html ──────────────┐
modules/find.html ───────┤  同源
modules/quotes.html ─────┼──► js/license.js ──► IndexedDB（主）/ localStorage / cookie
modules/docs.html ───────┘         │
                                   └──► WebCrypto 验签（公钥内置）
```

- `js/license.js`：单文件、IIFE、零依赖，挂 `window.License`。
- **同源共享**：index 与各 iframe 读到的是同一份 IndexedDB 状态，不存在「父窗已激活、子窗还在试用」。
- **锁屏由父窗口渲染**：iframe 内调用 `License.showLock()` 时，若存在 `window.parent.License` 则委托父窗，避免锁屏被裁在 iframe 里。
- 授权数据**不进入** `datastore.js` 的 `KEYS`，因此不会被 `backupAll/restoreAll` 带走或覆盖（防止「恢复别人的备份 = 获得授权」）。

## 5. 数据模型

### 5.1 试用状态

```js
{
  v: 1,
  firstSeen: 1792493422000,  // 首次访问，毫秒
  lastSeen:  1792493422000,
  uses: 0,                    // 已消耗的「开始挖掘」次数
  tampered: false             // 是否检测到时钟回拨
}
```

常量：

```js
var TRIAL_DAYS = 15;
var TRIAL_USES = 30;
```

派生：

- `daysLeft = max(0, TRIAL_DAYS - floor((now - firstSeen) / 86400000))`
- `usesLeft = max(0, TRIAL_USES - uses)`

### 5.2 激活码

```
FT1.<b64url(payloadJson)>.<b64url(signature)>
```

```js
payload = { "v":1, "id":"FT-A7F3", "co":"XX贸易有限公司", "iat":1792493422, "ver":"1" }
```

| 字段 | 含义 | 校验 |
|---|---|---|
| `v` | 激活码格式版本 | 必须为 `1` |
| `id` | 授权编号（台账用） | 非空字符串 |
| `co` | 公司名（水印用） | 非空，≤ 60 字 |
| `iat` | 签发时间（秒） | 仅记录 |
| `ver` | 适用大版本 | 必须 ≤ 当前 `APP_MAJOR`（永久买断：旧码在新大版本继续有效） |

签名规则（**必须两端一致**）：

- 算法：ECDSA P-256 / SHA-256
- 被签数据：**中间那一段 base64url 字符串本身**（ASCII 字节），不是原始 JSON
  - 目的：避开 JSON 序列化顺序/空白差异导致的验签失败
- 签名格式：**raw r||s（IEEE P1363，64 字节）**，base64url、无 `=` 填充
  - WebCrypto `verify` 原生就是该格式
  - Node 侧必须显式传 `dsaEncoding: 'ieee-p1363'`，否则默认 DER 会验不过
- 公钥：SPKI DER 的 base64，硬编码在 `license.js`

### 5.3 存储与混淆

| 位置 | 键 | 说明 |
|---|---|---|
| IndexedDB `ft_license` / store `kv` | `state`、`license` | 主存储 |
| localStorage | `_9f3a2c` | 冗余副本 1 |
| localStorage | `_b71c4e` | 冗余副本 2 |
| cookie `_ftc9` | — | 冗余副本 3，`path=/`，2 年 |

值格式：`b64url( UTF8(json) XOR 重复密钥 K )`，`K = 'FT-Compass-2026'`。

> 这是**观感混淆，不是安全边界**。规格明确：任何人看源码都能还原。真正的锁是 5.2 的签名。

**合并规则**（读取时）：

- `firstSeen` 取所有合法副本中的**最小值**
- `lastSeen` 取**最大值**
- `uses` 取**最大值**
- `tampered` 取逻辑或

**合法性**：字段为数字、`firstSeen ≤ now + 86400000`、`uses ∈ [0, 10000]`；不合法副本丢弃。

**写回**：每次状态变化同时写全部 4 处；任一处失败不影响其余。

**时钟回拨**：`now < lastSeen - 86400000` 时置 `tampered = true`，把 `lastSeen` 拉回 `now`，其余不变。仅提示，不锁死（避免误伤改时区的正常用户）。

### 5.4 授权状态

```js
{ code: "FT1....", payload: {id, co, iat, ver}, activatedAt: 1792493422000 }
```

同时写入 IndexedDB `kv.license` 与 localStorage `_c5d8e1`（值按 5.3 的规则混淆）。验签失败或 `ver` 高于当前大版本时**不删除**，仅视为未激活，便于用户升级后重新激活。

## 6. 状态机

```
        无有效 license
                │
        ┌───────┴────────┐
        │                │
  daysLeft>0        daysLeft<=0
  && usesLeft>0     或 usesLeft<=0
        │                │
      TRIAL         TRIAL_OVER ──► 锁屏
        │
   激活成功（验签通过）
        │
       PRO  ──► 全解锁，水印换公司名
```

- `PRO` 优先级最高：只要 `license` 验签通过且 `ver` ≤ 当前大版本，忽略试用状态。
- 激活成功时**不重置**试用计数（保留用于统计），但不再读取。
- **试用初始化**：`ready()` 首次运行时，若四处副本都不存在，写入 `firstSeen = now`。
- `TRIAL_OVER` 时弹出**不可关闭**的锁屏遮罩，遮罩覆盖全站，因此导出、打印、找客户全部被拦下（无需在 excel/paper 里单独写拦截逻辑）。
- **试用期内导出不拦截**，只加水印（见第 10 节）。

## 7. 接口契约

```js
License.ready()                  // Promise<Status>，应用启动时 await 一次
License.status()                 // Status
License.activate(code)           // Promise<{ok, code?, msg}>
License.consume('find')          // Promise<boolean>  true=放行且已扣次；false 时内部已弹锁屏
License.refund('find')           // Promise<void>     失败返还 1 次
License.guard()                  // boolean，不通过时内部调用 showLock()
License.showLock(reason)         // reason: 'expired' | 'uses' | 'manual'
License.hideLock()
License.watermark()              // string
License.backupCode()             // string，PRO 时返回激活码，否则 ''
License.onChange(fn)             // 状态变化回调（更新徽章）
```

`Status`：

```js
{
  state: 'pro' | 'trial' | 'trial_over',
  pro: true|false,
  company: 'XX贸易有限公司' | '',
  id: 'FT-A7F3' | '',
  daysLeft: 12,
  usesLeft: 18,
  used: 12,
  limit: { days: 15, uses: 30 },
  tampered: false
}
```

`activate` 失败码：

| code | 提示 |
|---|---|
| `FORMAT` | 激活码格式不正确，请完整粘贴 |
| `SIGNATURE` | 激活码无效，请核对后重试 |
| `VERSION` | 此激活码适用于 1.x 版本 |

## 8. UI 规格

### 8.1 徽章（侧边栏底部，`#licBadge`）

| 状态 | 文案 | 颜色 |
|---|---|---|
| trial | `试用 · 剩 12 天 / 18 次` | 次要文字色 |
| pro | `已授权 · XX贸易有限公司` | 品牌绿 |
| trial_over | `试用已结束 · 点此激活` | 警示色 |

点击：trial/pro 打开激活对话框；trial_over 直接弹锁屏。

### 8.2 锁屏 `#licLock`

- 全屏遮罩，父窗口 `document.body` 末尾插入，`z-index` 高于一切。
- 卡片宽度 460px，复用 `assets/tokens.css` 变量，不新增配色体系。
- 结构：

```
标题（按 reason 变化）
两个数字块：剩余天数 | 剩余次数
<textarea> 粘贴激活码
[ 激活 ]  [ 我已购买 → ]
小字：激活只在本机校验签名，不会上传你的任何数据
（PRO 时）[ 导出授权备份 ]
```

- 快捷键：`Ctrl/Cmd + Enter` 提交。
- 成功：遮罩淡出 200ms，toast「激活成功，感谢支持」，徽章立即更新，**不刷新页面**。
- 失败：输入框下方红字，不清空输入。

### 8.3 激活对话框

与锁屏同一组件，`reason='manual'` 时显示为可关闭的模态框（右上角 ×），其余 reason 不可关闭。

## 9. 集成点

| 文件 | 改动 |
|---|---|
| `index.html` | `<script src="js/license.js"></script>`；`.navfoot` 内加 `#licBadge`；启动后 `License.ready()` 并渲染徽章；锁屏样式 |
| `modules/find.html` | 加 `<script src="../js/license.js"></script>`；`doSearch()` 第一行 `if(!(await License.consume('find')))return;`；catch 分支中若本次零结果则 `License.refund('find')` |
| `modules/quotes.html` | 加 `<script src="../js/license.js"></script>`（供 excel/paper 取水印） |
| `modules/docs.html` | 同上 |
| `js/excel.js` | 导出时首行插入水印行，随后空一行 |
| `js/paper.js` | 打印/PDF 页脚居中插入水印 |
| `js/datastore.js` | **不改** |

计数规则：

- 只在 `doSearch()` 扣，**`doMore()`（换一批）不扣**。
- 扣减为「预扣」：进入流程即扣；若流程在「所有来源均未找到公司」处抛错（本次零结果），在 catch 中返还 1 次，网络问题不由用户买单。
- 导出不扣次数（但试用期带水印，试用结束后由锁屏遮罩统一拦截）。

## 10. 水印文案

| 状态 | Excel | PDF / 打印 |
|---|---|---|
| trial | `FT Compass Trial · Not for client delivery · N days left` | 同左 |
| trial_over | `FT Compass Trial Expired · Not for client delivery` | 同左 |
| pro | `Licensed to {co} · {id} · Not for redistribution` | 同左 |

样式：9pt / 灰色 / 居中；不遮挡正文，不改变既有分页逻辑。

## 11. 签发工具与密钥管理

### 11.1 生成密钥（一次性）

`tools/gen-key.mjs`

- 算法 `ec / prime256v1`
- 私钥写入 `%USERPROFILE%\.ftcompass\private.pem`（PKCS8 PEM，**仓库外**）
- 公钥以 SPKI base64 打印，人工粘贴进 `js/license.js` 的 `PUBKEY_B64`
- 若私钥已存在则拒绝覆盖，除非 `--force`
- 首次运行打印备份提醒

### 11.2 签发激活码

`tools/sign-license.mjs --company "XX贸易有限公司" [--id FT-XXXX] [--ver 1]`

- `--id` 缺省时自动生成 `FT-` + 4 位 base32
- 输出：完整激活码（单行，便于复制）
- 台账：追加到 `%USERPROFILE%\.ftcompass\licenses.csv`（时间,公司,编号,版本,激活码）
  - 存整行激活码，客户丢码时直接回发，不必重签
  - 旧版 4 列台账首次运行会自动升级表头，历史行补空列
  - 台账被 Excel/WPS 占用时只提示、不阻断：激活码照常打印，退出码仍为 0
- 不写数据库、不联网

### 11.3 版本规则

- `APP_MAJOR` 定义在 `license.js`，当前 `"1"`。
- **永久买断**：`activate` 校验 `ver ≤ APP_MAJOR`。将来升到 2.x，老客户 `ver:"1"` 的码继续有效；只有高于当前版本的码才提示“请升级软件”。
- 若某次升级确实要让老码失效（例如换了签名密钥），必须显式改 `APP_MAJOR` 的语义或轮换公钥，并在发布说明里写清。

### 11.4 `.gitignore`

```
.ftcompass/
private.pem
licenses.csv
```

## 12. 安全边界（明确不防什么）

| 风险 | 是否防护 | 说明 |
|---|---|---|
| 伪造激活码 | ✅ | 无私钥无法生成有效签名 |
| 修改本地试用计数 | ⚠️ 部分 | 4 处冗余 + 取极值，删一处无效；四处全删则重置 |
| 清空浏览器数据重置试用 | ❌ | 接受（30 次上限低） |
| 改系统时间延长试用 | ⚠️ 部分 | 只能检测回拨并提示 |
| 激活码转发给同行 | ❌ | 靠公司名水印 + 100 元低价缓解 |
| 源码被 fork 后另卖 | ❌ | 同源公开；竞争壁垒是品牌、更新与服务 |
| 付费用户清缓存丢授权 | ⚠️ | 提供「导出授权备份」，重贴即恢复 |

## 13. 错误处理

| 场景 | 行为 |
|---|---|
| IndexedDB 不可用（隐私模式） | 降级为 localStorage + cookie，功能不变 |
| WebCrypto 不可用（`file://` 打开） | 激活按钮禁用，提示「请通过 https 网址打开」；已有授权仍按本地记录放行 |
| 存储写入失败 | 内存态继续本次会话，toast 提示「存储受限，关闭页面后可能丢失」 |
| 激活码含空格/换行 | 粘贴时统一 `replace(/\s+/g,'')` |
| 公钥未配置（开发态） | `activate` 返回 `FORMAT`，控制台警告 |

## 14. 测试计划

### 14.1 离线单测 `tools/test-license.mjs`

1. 签发 → 验签通过，payload 字段一致
2. 篡改 payload 一个字符 → `SIGNATURE`
3. 篡改签名一个字符 → `SIGNATURE`
4. `ver:"2"`（高于当前）→ `VERSION`；`ver:"0"`（低于当前）→ 放行
5. 缺字段 / 非 `FT1.` 前缀 → `FORMAT`
6. 签名格式为 64 字节 raw（防止误用 DER）

### 14.2 浏览器手测清单

1. 首次打开 → 徽章显示「剩 15 天 / 30 次」
2. 找客户成功一次 → 次数 -1，刷新后仍是
3. 连续 30 次 → 第 31 次弹锁屏（reason=uses）
4. 把所有存储改成 16 天前 → 刷新弹锁屏（reason=expired）
5. 粘贴有效码 → 遮罩消失、徽章变公司名、不刷新
6. 导出 Excel / PDF → 页首（页脚）出现公司名水印
7. 删掉 localStorage 两处 + cookie，仅保留 IndexedDB → 状态不变
8. 清空全部 → 回到 trial；重贴激活码 → 恢复 pro

## 15. 发布步骤

1. 运行 `node tools/gen-key.mjs`，把公钥贴进 `js/license.js`
2. 本地起 http 服务，走一遍 14.2
3. 部署静态站
4. 给自己签一个测试码，线上验证一次
5. **离线备份私钥**（U 盘 + 密码管理器），并在台账记录首单

## 16. 未来演进

- **可选心跳**：Cloudflare Worker 校验 `id` 是否在黑名单（退款/滥用），失败不阻断使用，仅提示。
- **多档位**：payload 增加 `plan`（`lite`/`pro`），水印与模块开关按档位区分。
- **年度大版本**：`APP_MAJOR` 升级，老客户旧码自动继续有效（`ver ≤ APP_MAJOR`）。
- **单文件离线版**：若将来做，需替换 WebCrypto 验签为纯 JS 实现（`file://` 下 `crypto.subtle` 不可用）。

## 17. 验收标准

- [ ] 断网状态下，粘贴有效码可立即解锁
- [ ] 无效码被拒绝，且不影响现有试用状态
- [ ] 试用 15 天 / 30 次两条线都能独立触发锁屏
- [ ] 换一台电脑粘贴同一个码，可直接使用
- [ ] 导出的 Excel 与 PDF 均带正确水印
- [ ] `backupAll` 导出的 JSON 中**不含**任何授权信息
- [ ] 清除浏览器数据后，重新粘贴码即可恢复

## 18. 实现记录（2026-10-20 落地）

已交付文件：

- `js/license.js`：公钥内置（SPKI base64）；四重冗余（IndexedDB `ft_license/kv` + localStorage `_9f3a2c`/`_b71c4e` + cookie `_ftc9`）；`loadState(autoLock, writeBack)` 区分「启动初始化」与「跨窗口软同步」，软同步只更新内存与徽章、不落盘；`persistTrial()` 值未变化时跳过写入。
- `tools/gen-key.mjs`：一次性生成 P-256 密钥对，私钥写入 `%USERPROFILE%\.ftcompass\private.pem`（仓库外，已 gitignore）。
- `tools/sign-license.mjs`：`--company "公司名" [--id FT-XXXX] [--ver 1]`；签名原文是 payload 的 **base64url 段字符串**；Node 端 `dsaEncoding:'ieee-p1363'` 输出 raw `r||s` 64 字节；台账 `licenses.csv` 记 5 列（含整行激活码），旧 4 列台账自动升级；台账被占用时只告警、不吞码。
- `tools/test-license.mjs`：30 项离线自测（格式、签名篡改、payload 篡改、版本高低、带换行粘贴、扣次/返还、30 次上限、水印）。
- `index.html`：侧边栏新增 `#licBadge`（试用剩余 / 已授权公司名，点击打开激活框）；`.navlist` 可收缩滚动，小窗口下备份/恢复按钮不再被挤出。
- `modules/find.html`：`doSearch()` 先 `License.consume('find')`，零结果（`S.all.length===0`）在 catch 中 `License.refund('find')`；`doMore()` 不扣次。
- `modules/quotes.html` / `modules/docs.html` / `modules/products.html`：加载 `license.js` 并在启动时 `License.ready()`（否则首屏导出可能取不到水印文案）。
- `js/excel.js`：每个 sheet 首行插入灰字水印（`ss:StyleID="wm"` + `MergeAcross`）。
- `js/paper.js`：`Paper.apply()` 写入 `data-wm`，CSS `::after` 渲染；打印时改为固定页脚；首屏早于 IndexedDB 就绪时，等 `License.ready()` 后补写。

与设计稿的实现差异：

1. 锁屏统一由 `License.showLock()` 渲染：父窗口负责 DOM，iframe 内自动委托给 `window.top.License`；不再逐模块调用 `guard()`（`guard()` 仍导出备用）。
2. 跨窗口同步改用 `storage` 事件（只更新徽章），子窗口不再主动调用父窗口 `refresh()`，避免两个文档互相写回造成事件回环。
3. `products.html` 也使用 `ExcelExport`，因此一并接入水印。

验收勾选（线上已实测）：

- [x] 断网状态下粘贴有效码立即解锁（本机 WebCrypto 验签，无网络请求）
- [x] 篡改 payload / 篡改签名 / 版本不符 / 乱码均被拒绝，且不影响既有状态
- [x] 30 次用完弹出不可关闭锁屏；第 30 次本身正常执行（不会刚扣完就被挡）
- [x] 零结果自动返还次数（30 → 30），成功结果扣 1 次（30 → 29）
- [x] Excel 与打印预览均带授权水印
- [x] `backupAll` 导出的 JSON 不含任何授权键
- [ ] 换一台电脑粘贴同一个码（无需改动，未做设备绑定；待真机确认）
