# 单证多 SKU 明细与商品图片设计

日期：2026-11-10
状态：已确认，待实现
范围：单证中心 PI / SC / CI / PL，报价转 PI，profile 默认值

## 目标

- PI 支持多个 SKU 拼一单，纸面按行渲染，不再只取报价第一项。
- PI / SC / CI / PL 共享同一份明细；派生时原样继承，可继续编辑。
- 单据记录只存 `productId`，图片渲染时从商品库实时读取，不复制 base64。
- 每张单据可单独控制是否显示商品图片；CI/PL 默认关闭。
- 打印前等待图片 decode，避免偶发空白图。

## 数据模型

`values.items` 为数组，每行：

```js
{ productId, name, sku, spec, qty, unit, price, amount }
```

- `values.showImages`：单据级布尔值。
- 旧单证没有 `items` 时，从 `values.product/qty/unit/price/total` 生成一行。
- 每次明细变化后同步首行回 `values.product/qty/unit/price`，`values.total` 为各行 amount 合计，保证 Gate、Excel 和旧逻辑可读。
- 草稿、备份沿用现有 `values` 序列化，不新增存储键。
- 图片只通过 `productId` 关联商品库；商品删除或没有图片时该行显示 📦。

## 编辑界面

- `js/docs_data.js` 给 `pi`、`sc`、`ci`、`pl` 标记 `items: true`。
- 这四类单证的表单用明细表替换 `product/qty/unit/price/total` 单行字段，币种仍在单据级。
- 明细列：缩略图、品名、SKU、规格、数量、单位、单价、金额、删除。
- 商品库选择器追加一行或填入第一个空行，并写入 `productId`。
- 明细区提供「纸面显示商品图片」开关。
- 390px 下明细表横向滚动，不撑破页面。

## 默认值

- `DocItems.defaultShowImages(docId, mode)`：
  - `auto`：PI 开，其余（含 CI/PL）关。
  - `on`：全部开。
  - `off`：全部关。
- profile 新增 `docImagesDefault`（`auto | on | off`），保存在 `DataStore.cfg`。
- 只决定新建单据的初始值；已保存单据使用自身 `values.showImages`，单张仍可切换。

## 纸面与打印

- 有图时列宽：图片 16%、DESC 34%、数量 14%、单价 18%、金额 18%。
- 整单至少一行有图才出图片列；缺图行显示 📦。
- 图片固定 `18mm × 18mm`、`object-fit: contain`。
- 多行时增加合计行；单行保持现有布局。
- `printPaper()` 先过 Gate，再等待 `document.images` decode，最多 1.5 秒，然后 `window.print()`。
- 打印样式：图片 `background:none`、行 `break-inside:avoid`、表头 `display:table-header-group`。
- 不做图片拖拽缩放。

## 报价与派生

- quotes.html 的商品选择写入 `productId`，明细草稿同步保存。
- 旧报价没有 `productId` 时，按「名称完全一致且唯一」匹配商品；同名多款不补图，显示 📦。
- `openFromQuote()` 带入全部 `q.items`，不再只取第一项。
- PI → SC → CI → PL 派生时继承 `values.items`。
- PL 的箱数、毛净重、体积仍是单据级字段。

## Gate 与 Excel

- Gate 在 `items` 存在时逐行校验品名、数量、单价，并核对合计；错误定位到明细区。
- 客户版 Excel 多行输出文字明细和合计；不加图片。

## 测试

- `tools/test-doc-items.mjs`：旧数据升级、合计同步、默认开关、唯一名称匹配、图片地址校验、空行处理。
- `tools/test-module-wiring.mjs`：脚本加载、`items:true`、打印 decode、break-inside、quotes `productId`、profile 默认项。
- 浏览器验收：3 SKU PI 三行三图、关闭开关无图片列、派生单保留明细、坏图显示 📦、390/768 无横向溢出、打印不报错。
