/* ============================================================
   FT Compass · 单证中心数据 v1.0
   20 张出口常用单证（行业标准格式，独立编写）。
   结构化 schema：共享字段一次填写全单联动，通用渲染器出单。
   共享字段：no/date/seller/sellerAddr/buyer/buyerAddr/product/
   qty/unit/price/currency/total/payment/portFrom/portTo/delivery
   ============================================================ */
var SHARED_FIELDS = [
  {k:'no', label:'单号 No.'},
  {k:'date', label:'日期 Date', type:'date'},
  {k:'seller', label:'卖方 Seller'},
  {k:'sellerAddr', label:'卖方地址 Seller Addr.'},
  {k:'buyer', label:'买方 Buyer'},
  {k:'buyerAddr', label:'买方地址 Buyer Addr.'},
  {k:'product', label:'品名 Product'},
  {k:'qty', label:'数量 Qty'},
  {k:'unit', label:'单位 Unit', ph:'pcs / ctn / kg'},
  {k:'price', label:'单价 Unit Price'},
  {k:'currency', label:'币种 Currency', ph:'USD'},
  {k:'total', label:'总金额 Total Amount'},
  {k:'payment', label:'付款方式 Payment', ph:'30% T/T deposit, 70% before shipment'},
  {k:'portFrom', label:'起运港 Port of Loading', ph:'Ningbo / Shenzhen'},
  {k:'portTo', label:'目的港 Port of Discharge'},
  {k:'delivery', label:'交期 Delivery', ph:'25 days after deposit'}
];

var DOCS_DEF = [
  {id:'quotation', title:'报价单 / Quotation', cat:'成交单据',
   rows:[['valid','报价有效期 Validity','30 days']],
   notes:['Price basis: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}',
          'Payment: {{payment}}','Delivery: {{delivery}}','Validity: {{valid}}']},

  {id:'sc', title:'销售合同 / Sales Contract', cat:'成交单据',
   rows:[['quality','质量标准 Quality','As per confirmed sample'],
         ['claim','索赔条款 Claims','Within 30 days after arrival']],
   notes:['This contract is made between {{seller}} (Seller) and {{buyer}} (Buyer).',
          'Quality: {{quality}}','Payment: {{payment}}','Delivery: {{delivery}} from {{portFrom}} to {{portTo}}',
          'Claims: {{claim}}']},

  {id:'pi', title:'形式发票 / Proforma Invoice', cat:'成交单据',
   rows:[['valid','报价有效期 Validity','15 days'],
         ['bank','收款账户 Bank Info','Bank Name / A/C No. / SWIFT']],
   notes:['Proforma Invoice No. {{no}} dated {{date}}','Payment: {{payment}}',
          'Delivery: {{delivery}}','This PI is valid for {{valid}} and subject to final confirmation.']},

  {id:'oc', title:'订单确认书 / Order Confirmation', cat:'成交单据',
   rows:[['poNo','客户 PO 号 Buyer PO No.',''],
         ['confirmBy','确认人 Confirmed By','']],
   notes:['We hereby confirm the order per Buyer PO {{poNo}}.','Product & qty as per table below.',
          'Payment: {{payment}}','Delivery: {{delivery}}']},

  {id:'si', title:'样品单 / Sample Invoice', cat:'成交单据',
   rows:[['sampleFee','样品费 Sample Fee',''],
         ['courier','快递方式 & 账号 Courier / A/C','FedEx / DHL + account no.'],
         ['deduct','大货抵扣 Deductible','Deductible from bulk order']],
   notes:['Sample fee: {{sampleFee}} ({{deduct}})','Courier: {{courier}}','ETA: 5-7 working days after payment.']},

  {id:'ci', title:'商业发票 / Commercial Invoice', cat:'物流单据',
   rows:[['lcNo','信用证号 L/C No.（如适用）',''],
         ['hsCode','HS 编码 HS Code','']],
   notes:['Invoice of {{product}}','HS Code: {{hsCode}}','Shipment from {{portFrom}} to {{portTo}}',
          'Payment: {{payment}}']},

  {id:'pl', title:'装箱单 / Packing List', cat:'物流单据',
   rows:[['ctns','箱数 Cartons',''],
         ['gw','毛重 G.W. (kg)',''],
         ['nw','净重 N.W. (kg)',''],
         ['meas','体积 Meas. (CBM)',''],
         ['mark','唛头 Shipping Mark','N/M or per customer']],
   notes:['{{ctns}} cartons of {{product}}','G.W.: {{gw}} kg  N.W.: {{nw}} kg  Meas.: {{meas}} CBM',
          'Shipping mark: {{mark}}']},

  {id:'sa', title:'出货通知 / Shipping Advice', cat:'物流单据',
   rows:[['vessel','船名航次 Vessel/Voyage',''],
         ['etd','开船日 ETD',null],['eta','到港日 ETA',null],
         ['blNo','提单号 B/L No.','']],
   notes:['Dear {{buyer}}, please be advised that the goods have been shipped.',
          'Vessel: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}','B/L No.: {{blNo}}',
          'Documents will be sent after full payment received.']},

  {id:'bli', title:'提单补料 / B/L Instruction', cat:'物流单据',
   rows:[['consignee','收货人 Consignee',''],
         ['notify','通知人 Notify Party',''],
         ['desc','货描 Goods Description',''],
         ['freight','运费条款 Freight','Prepaid / Collect']],
   notes:['Consignee: {{consignee}}','Notify Party: {{notify}}',
          'Port of Loading: {{portFrom}}  Port of Discharge: {{portTo}}','Freight: {{freight}}']},

  {id:'co', title:'原产地证申请 / Certificate of Origin', cat:'物流单据',
   rows:[['coType','证书类型 Type','CO / Form E / Form A'],
         ['manufacturer','生产商 Manufacturer','']],
   notes:['Certificate type: {{coType}}','Exporter: {{seller}}','Consignee: {{buyer}}',
          'Goods: {{product}}, {{qty}} {{unit}}','Place of origin: China']},

  {id:'ins', title:'保险投保单 / Insurance Application', cat:'物流单据',
   rows:[['coverage','投保险别 Coverage','All risks + War risk'],
         ['insAmount','投保金额 Insured Amount','110% of invoice value']],
   notes:['Insured amount: {{insAmount}}','Coverage: {{coverage}}',
          'Shipment: {{portFrom}} to {{portTo}} per {{vessel||B/L}}']},

  {id:'lccheck', title:'信用证审单清单 / L/C Document Checklist', cat:'资金结算',
   rows:[['lcNo','信用证号 L/C No.',''],
         ['lcAmount','信用证金额 L/C Amount',''],
         ['latestShip','最迟装运日 Latest Shipment',null],
         ['expiry','交单截止 Expiry Date',null]],
   notes:['L/C No.: {{lcNo}}  Amount: {{lcAmount}}','Latest shipment: {{latestShip}}  Expiry: {{expiry}}',
          'Checklist: □ Commercial Invoice  □ Packing List  □ B/L  □ CO  □ Insurance']},

  {id:'tt', title:'付款水单登记 / T/T Payment Record', cat:'资金结算',
   rows:[['bankSlip','水单编号 Slip No.',''],
         ['paidAmount','到账金额 Received',''],
         ['paidDate','到账日期 Value Date',null],
         ['balance','余款 Balance','']],
   notes:['Received {{paidAmount}} on {{paidDate}} (Slip {{bankSlip}})','Balance: {{balance}}',
          'Against Invoice {{no}}, total {{currency}} {{total}}']},

  {id:'coll', title:'催款函 / Payment Reminder', cat:'商务函件',
   rows:[['dueDate','约定付款日 Due Date',null],
         ['overdueDays','逾期天数 Days Overdue',''],
         ['nextAction','下一步措施 Next Step','Suspension of future shipments']],
   notes:['Dear {{buyer}}, per Invoice {{no}}, payment of {{currency}} {{total}} was due on {{dueDate}}.',
          'It is now {{overdueDays}} days overdue. Kindly arrange payment immediately, otherwise {{nextAction}}.']},

  {id:'ir', title:'验货报告 / Inspection Report', cat:'生产交付',
   rows:[['insDate','验货日期 Inspection Date',null],
         ['inspector','验货人 Inspector',''],
         ['result','验货结果 Result','Passed / Minor defects / Re-work'],
         ['defects','缺陷描述 Defects','']],
   notes:['Inspection date: {{insDate}}  Inspector: {{inspector}}','Sample checked: AQL 2.5',
          'Result: {{result}}','Defects: {{defects}}']},

  {id:'po', title:'生产通知单 / Production Order', cat:'生产交付',
   rows:[['workshop','生产车间/工厂 Workshop',''],
         ['material','物料要求 Material',''],
         ['pDate','计划完成日 Completion',null]],
   notes:['Produce {{product}}, qty {{qty}} {{unit}}','Material: {{material}}',
          'Completion target: {{pDate}}. Delivery: {{delivery}}']},

  {id:'as', title:'售后处理单 / After-sales Report', cat:'生产交付',
   rows:[['issue','问题描述 Issue',''],
         ['qty','涉及数量 Affected Qty',''],
         ['solution','处理方案 Solution','Replacement / Discount / Credit note'],
         ['closed','是否结案 Closed','Yes / No']],
   notes:['Issue: {{issue}} (Qty: {{qty}})','Solution: {{solution}}','Status: {{closed}}']},

  {id:'nda', title:'保密协议 / NDA', cat:'合作协议',
   rows:[['scope','保密范围 Scope','Designs, prices, customer lists'],
         ['term','保密期限 Term','3 years from signing']],
   notes:['Both parties agree to keep {{scope}} strictly confidential.',
          'Term: {{term}}. Governed by laws of P.R. China.']},

  {id:'ca', title:'佣金协议 / Commission Agreement', cat:'合作协议',
   rows:[['agent','代理方 Agent',''],
         ['rate','佣金比例 Rate','%'],
         ['settle','结算方式 Settlement','Monthly against payment received']],
   notes:['Agent: {{agent}}','Commission: {{rate}} of invoice value',
          'Settlement: {{settle}}']},

  {id:'mou', title:'年度合作备忘 / Annual MOU', cat:'合作协议',
   rows:[['target','年度目标 Annual Target',''],
         ['pricePolicy','价格政策 Price Policy',''],
         ['review','复盘节奏 Review','Quarterly business review']],
   notes:['Between {{seller}} and {{buyer}}','Annual target: {{target}}',
          'Price policy: {{pricePolicy}}','Review: {{review}}']}
];
