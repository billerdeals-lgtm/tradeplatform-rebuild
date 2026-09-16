# Agnes 2.5 Flash 接入指南（tradeplatform 自研版）

## 交付物

| 文件 | 说明 |
|---|---|
| `tradeplatform-rebuild/agnes-ai.js` | 即插即用 AI 模块（零依赖、原生 JS，可进单文件版也可进组件化版） |
| `tradeplatform-rebuild/agnes-ai-demo.html` | 联调测试台：设置面板 + 连通自检 + 3 个功能实测 |

## 接入三步

1. **面板填配置**：打开控制台，在「配置」区填入你的接口地址（OpenAI 兼容格式，`/v1` 结尾）和密钥——**默认留空，由你填写**，保存到本机 localStorage。
2. **模型名**：默认 `agnes-2.5-flash`；如服务商叫法不同（例如 `gemini-2.5-flash`），面板直接改。
3. **点「测试连通」**：收到 `pong` 即全通。「通用调试」任意 prompt 直发可用后，业务代码里直接调 `AgnesAI.*` 即可。

## 视觉规范（与原版彻底区分）

- 自研品牌图标：**翡翠绿圆角方 + 白色罗盘环 + 琥珀罗盘指针**（原版是深蓝底地球+橙色闪电，已避开）
- 主色 `#0b6e4f`（翡翠绿）、点缀 `#ffc53d`（琥珀）、米白底 `#faf9f5`
- 测试台 favicon 已内嵌同款 SVG，重建主应用沿用此图标体系，不照抄原版 CSS

## 模块能力（6 个业务功能，全部对接蓝图数据模型）

| 函数 | 用途 | 对应模块 |
|---|---|---|
| `AgnesAI.scoreLead(lead)` | 线索评分 0-100 + 下一步动作 + 建议渠道（JSON） | 找客户 |
| `AgnesAI.genOutreach(lead, scene, me)` | 个性化开发信/跟进邮件（英文正文+中文要点） | 触达建联 |
| `AgnesAI.genReply(lead, customerWords)` | 粘贴客户原话 → 回复草稿（先共情再推进） | 全模块通用 |
| `AgnesAI.genObjection(lead, objection)` | 异议判断 + 应对话术 + 底线建议 | 报价成交 |
| `AgnesAI.genReviewInsight(stats)` | 周/月数据 → 三发现+三动作+一砍掉 | 复盘增长 |
| `AgnesAI.genHolidayGreet(lead, festival)` | 节日 WhatsApp 问候（轻推进业务） | 复购转介 |

底层通用：`AgnesAI.chat(messages, opts)` / `AgnesAI.ask(prompt, opts)`。

## 内置的护栏

- **每日调用上限**（默认 100 次，设置面板可调），超出自动拦截
- 调用计数按天存在 localStorage，设置面板可见当日用量
- 超时 30s 默认，可按次覆盖 `{timeout: 60000}`
- JSON 模式（`{json:true}`）用于评分类结构化输出，失败自动降级为纯文本
- 温度按场景预设：评分 0.3（稳）、开发信 0.8（活）、节日问候 0.9

## 与原版的差异（这就是"改进点"）

原版平台的「AI 评分」「AI 洞察」全是写死的规则假 AI；接入后变成真推理，且：
- 评分能吸收备注里的软信息（"展会名片"vs"等 PI"权重完全不同）
- 开发信不再是模板换变量，而是按客户产品/市场/阶段真生成
- 新增了原版完全没有的「客户回复智能草稿」和「异议处理」两个高频场景

## 安全说明

- **代码中不含任何 API 密钥**：`agnes-ai.js` 的默认配置为空，首次使用在页面右上 ⚙ AI 设置面板填入网关地址 / 密钥 / 模型名，保存在浏览器 localStorage，仅存本机
- 本仓库为纯静态前端，无后端、无数据上传；业务数据 100% 存于访问者自己的浏览器
- ⚠️ 请勿把真实密钥提交到本仓库（.env、代码、文档都不要）
