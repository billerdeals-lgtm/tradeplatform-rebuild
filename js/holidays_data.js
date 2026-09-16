/* ============================================================
   FT Compass · 节假日数据 v1.0（自研数据集，独立维护）
   覆盖 2026Q4-2027 用户重点市场：中东/东南亚/欧美/非洲
   伊斯兰历日期为天文推算，标注 approx:"约"（±1 天）
   提示 trade:true = 影响备货/发货的节点（斋月/春节/开斋节）
   ============================================================ */
var COUNTRY_CODE = {
  'Egypt':'EG','egypt':'EG','Saudi Arabia':'SA','saudi':'SA','UAE':'AE','United Arab Emirates':'AE','uae':'AE','Dubai':'AE',
  'Qatar':'QA','Kuwait':'KW','Oman':'OM','Jordan':'JO','Iraq':'IQ','Turkey':'TR','Israel':'IL',
  'Philippines':'PH','philippines':'PH','Indonesia':'ID','indonesia':'ID','Thailand':'TH','thailand':'TH',
  'Malaysia':'MY','malaysia':'MY','Vietnam':'VN','vietnam':'VN','Singapore':'SG','Cambodia':'KH','Myanmar':'MM','Laos':'LA',
  'USA':'US','US':'US','United States':'US','America':'US','Canada':'CA','UK':'GB','United Kingdom':'GB','England':'GB',
  'Germany':'DE','France':'FR','Spain':'ES','Italy':'IT','Netherlands':'NL','Poland':'PL','Russia':'RU',
  'India':'IN','IN':'IN','Pakistan':'PK','Bangladesh':'BD','Nigeria':'NG','Kenya':'KE','South Africa':'ZA',
  'Ghana':'GH','Tanzania':'TZ','Algeria':'DZ','Morocco':'MA','Mexico':'MX','Brazil':'BR','Chile':'CL',
  'Australia':'AU','New Zealand':'NZ','Japan':'JP','South Korea':'KR','Korea':'KR','China':'CN','Taiwan, China':'TW'
};
/* 市场（线索 market 字段）覆盖：国家码 → 市场名 */
var MARKET_OF_CODE = {
  EG:'中东',SA:'中东',AE:'中东',QA:'中东',KW:'中东',OM:'中东',JO:'中东',IQ:'中东',TR:'中东',IL:'中东',
  PH:'东南亚',ID:'东南亚',TH:'东南亚',MY:'东南亚',VN:'东南亚',SG:'东南亚',KH:'东南亚',MM:'东南亚',LA:'东南亚',
  US:'欧美',CA:'欧美',GB:'欧美',DE:'欧美',FR:'欧美',ES:'欧美',IT:'欧美',NL:'欧美',PL:'欧美',RU:'欧美',AU:'欧美',NZ:'欧美',
  IN:'其他',PK:'其他',BD:'其他',NG:'非洲',KE:'非洲',ZA:'非洲',GH:'非洲',TZ:'非洲',DZ:'非洲',MA:'非洲',
  MX:'其他',BR:'其他',CL:'其他',JP:'其他',KR:'其他',CN:'其他',TW:'其他'
};

var HOLIDAYS = [
  /* ---- 2026Q4 ---- */
  {y:2026,m:11,d:1, name:'万圣节/诸圣节', en:"All Saints' Day", countries:['PH','DE','ES','IT','PL','MX'], note:'菲律宾客户多信天主教，适合问候'},
  {y:2026,m:11,d:8, name:'排灯节', en:'Diwali', countries:['IN','PK','BD'], note:'印度/南亚客户年度最重要的节日'},
  {y:2026,m:11,d:26,name:'感恩节', en:'Thanksgiving Day', countries:['US'], note:'黑五网一采购季，物流高压期'},
  {y:2026,m:11,d:27,name:'黑色星期五', en:'Black Friday', countries:['US','GB','DE','FR','ES','IT','NL','PL','CA','AU'], note:'欧美零售旺季峰值，B2B 客户也在冲量'},
  {y:2026,m:12,d:25,name:'圣诞节', en:'Christmas Day', countries:['US','GB','DE','FR','ES','IT','NL','PL','CA','AU','PH','MX','BR','NG','KE','ZA'], note:'欧美工厂多休假至元旦，提前对账收尾'},
  /* ---- 2027 ---- */
  {y:2027,m:1,d:1,  name:'元旦', en:"New Year's Day", countries:'ALL', note:'全年首个问候窗口，适合送年度合作展望'},
  {y:2027,m:2,d:6,  name:'农历春节', en:'Chinese New Year', countries:['CN'], trade:true, note:'⚠️ 国内工厂停工约 2-3 周（2 月上旬-下旬），催客户 1 月底前下单/付尾款'},
  {y:2027,m:2,d:8,  name:'斋月开始', en:'Ramadan begins', approx:'约', countries:['EG','SA','AE','QA','KW','OM','JO','IQ','TR','PK','BD','MY','ID','DZ','MA'], trade:true, note:'⚠️ 中东/印尼/马来客户白天效率低，重大谈判避开；节前 6-8 周是备货冲刺窗口'},
  {y:2027,m:2,d:14, name:'情人节', en:"Valentine's Day", countries:['US','GB','DE','FR','ES','IT','CA','AU','PH'], note:'礼品/包装品类选品参考'},
  {y:2027,m:3,d:10, name:'开斋节', en:'Eid al-Fitr', approx:'约', countries:['EG','SA','AE','QA','KW','OM','JO','IQ','TR','PK','BD','MY','ID','DZ','MA'], trade:true, note:'⚠️ 伊斯兰年度最大节日，休假约 3-7 天；提前 2 周发问候+确认节后订单'},
  {y:2027,m:3,d:26, name:'耶稣受难日', en:'Good Friday', countries:['PH','DE','ES','IT','NL','CA','AU','GB']},
  {y:2027,m:3,d:28, name:'复活节', en:'Easter Sunday', countries:['US','GB','DE','FR','ES','IT','NL','PL','CA','AU']},
  {y:2027,m:4,d:9,  name:'勇士日', en:'Araw ng Kagitingan', countries:['PH']},
  {y:2027,m:4,d:13, name:'宋干节(泼水节)', en:'Songkran', countries:['TH'], note:'泰国新年，全国休假约一周'},
  {y:2027,m:5,d:1,  name:'劳动节', en:'Labour Day', countries:'ALL'},
  {y:2027,m:5,d:17, name:'宰牲节', en:'Eid al-Adha', approx:'约', countries:['EG','SA','AE','QA','KW','OM','JO','IQ','TR','PK','BD','MY','ID','DZ','MA'], trade:true, note:'伊斯兰第二大节日，休假约 4 天'},
  {y:2027,m:6,d:12, name:'独立日', en:'Independence Day', countries:['PH']},
  {y:2027,m:7,d:4,  name:'美国独立日', en:'Independence Day', countries:['US']},
  {y:2027,m:8,d:8,  name:'东盟日', en:'ASEAN Day', countries:['PH','ID','TH','MY','VN','SG','KH','MM','LA']},
  {y:2027,m:11,d:1, name:'诸圣节', en:"All Saints' Day", countries:['PH','DE','ES','IT','PL','MX']},
  {y:2027,m:11,d:25,name:'感恩节', en:'Thanksgiving Day', countries:['US']},
  {y:2027,m:11,d:26,name:'黑色星期五', en:'Black Friday', countries:['US','GB','DE','FR','ES','IT','NL','PL','CA','AU']},
  {y:2027,m:12,d:25,name:'圣诞节', en:'Christmas Day', countries:['US','GB','DE','FR','ES','IT','NL','PL','CA','AU','PH','MX','BR','NG','KE','ZA']}
];
