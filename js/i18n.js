/* ============================================================
   FT Compass · i18n v1.0
   HUIDI Feature 8：18 种单证语言模式（规范词典）
   - 只翻译固定标题 / 字段标签 / 表头（canonical dictionary）
   - 用户自由文本不机翻
   - 偏好存 DataStore cfg：docLang
   语言：bilingual 中英双语 / zh / en / es / pt / de / fr / it /
        ru / ar / ja / ko / tr / nl / pl / vi / id / th
   ============================================================ */
(function (global) {
  'use strict';

  var LANGS = [
    { id: 'bilingual', name: '中英双语' },
    { id: 'zh', name: '中文' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
    { id: 'pt', name: 'Português' },
    { id: 'de', name: 'Deutsch' },
    { id: 'fr', name: 'Français' },
    { id: 'it', name: 'Italiano' },
    { id: 'ru', name: 'Русский' },
    { id: 'ar', name: 'العربية' },
    { id: 'ja', name: '日本語' },
    { id: 'ko', name: '한국어' },
    { id: 'tr', name: 'Türkçe' },
    { id: 'nl', name: 'Nederlands' },
    { id: 'pl', name: 'Polski' },
    { id: 'vi', name: 'Tiếng Việt' },
    { id: 'id', name: 'Bahasa Indonesia' },
    { id: 'th', name: 'ไทย' }
  ];

  /* English canonical base（缺省回退） */
  var EN = {
    'f.no': 'No.', 'f.date': 'Date', 'f.seller': 'Seller', 'f.sellerAddr': 'Seller Addr.',
    'f.buyer': 'Buyer', 'f.buyerAddr': 'Buyer Addr.', 'f.product': 'Product',
    'f.qty': 'Qty', 'f.unit': 'Unit', 'f.price': 'Unit Price', 'f.currency': 'Currency',
    'f.total': 'Total Amount', 'f.payment': 'Payment', 'f.portFrom': 'Port of Loading',
    'f.portTo': 'Port of Discharge', 'f.delivery': 'Delivery',
    't.desc': 'Description', 't.qty': 'Qty', 't.unitPrice': 'Unit Price', 't.amount': 'Amount',
    'p.seller': 'Seller', 'p.buyer': 'Buyer', 'p.remarks': 'Remarks',
    'p.bank': 'Bank Info', 'p.sellerSign': 'Seller Signature/Stamp', 'p.buyerSign': 'Buyer Signature',
    'q.title': 'QUOTATION', 'q.to': 'To', 'q.from': 'From', 'q.note': 'Note',
    'q.total': 'TOTAL', 'q.spec': 'Spec',
    'doc.quotation': 'Quotation', 'doc.sc': 'Sales Contract',
    'doc.pi': 'Proforma Invoice', 'doc.oc': 'Order Confirmation',
    'doc.si': 'Sample Invoice', 'doc.ci': 'Commercial Invoice',
    'doc.pl': 'Packing List', 'doc.sa': 'Shipping Advice',
    'doc.bli': 'B/L Instruction', 'doc.co': 'Certificate of Origin',
    'doc.ins': 'Insurance Application', 'doc.lccheck': 'L/C Document Checklist',
    'doc.tt': 'T/T Payment Record', 'doc.coll': 'Payment Reminder',
    'doc.ir': 'Inspection Report', 'doc.po': 'Production Order',
    'doc.as': 'After-sales Report', 'doc.nda': 'NDA',
    'doc.ca': 'Commission Agreement', 'doc.mou': 'Annual MOU'
  };

  var ZH = {
    'f.no': '单号', 'f.date': '日期', 'f.seller': '卖方', 'f.sellerAddr': '卖方地址',
    'f.buyer': '买方', 'f.buyerAddr': '买方地址', 'f.product': '品名',
    'f.qty': '数量', 'f.unit': '单位', 'f.price': '单价', 'f.currency': '币种',
    'f.total': '总金额', 'f.payment': '付款方式', 'f.portFrom': '起运港',
    'f.portTo': '目的港', 'f.delivery': '交期',
    't.desc': '品名规格', 't.qty': '数量', 't.unitPrice': '单价', 't.amount': '金额',
    'p.seller': '卖方', 'p.buyer': '买方', 'p.remarks': '备注',
    'p.bank': '收款信息', 'p.sellerSign': '卖方签字/盖章', 'p.buyerSign': '买方签字',
    'q.title': '报价单', 'q.to': '致', 'q.from': '来自', 'q.note': '说明',
    'q.total': '合计', 'q.spec': '规格',
    'doc.quotation': '报价单', 'doc.sc': '销售合同',
    'doc.pi': '形式发票', 'doc.oc': '订单确认书',
    'doc.si': '样品单', 'doc.ci': '商业发票',
    'doc.pl': '装箱单', 'doc.sa': '出货通知',
    'doc.bli': '提单补料', 'doc.co': '原产地证申请',
    'doc.ins': '保险投保单', 'doc.lccheck': '信用证审单清单',
    'doc.tt': '付款水单登记', 'doc.coll': '催款函',
    'doc.ir': '验货报告', 'doc.po': '生产通知单',
    'doc.as': '售后处理单', 'doc.nda': '保密协议',
    'doc.ca': '佣金协议', 'doc.mou': '年度合作备忘'
  };

  var DICT = {
    es: {
      'f.no': 'Nº', 'f.date': 'Fecha', 'f.seller': 'Vendedor', 'f.sellerAddr': 'Dir. vendedor',
      'f.buyer': 'Comprador', 'f.buyerAddr': 'Dir. comprador', 'f.product': 'Producto',
      'f.qty': 'Cantidad', 'f.unit': 'Unidad', 'f.price': 'Precio unit.', 'f.currency': 'Moneda',
      'f.total': 'Importe total', 'f.payment': 'Pago', 'f.portFrom': 'Puerto de carga',
      'f.portTo': 'Puerto de descarga', 'f.delivery': 'Entrega',
      't.desc': 'Descripción', 't.qty': 'Cant.', 't.unitPrice': 'Precio unit.', 't.amount': 'Importe',
      'p.seller': 'Vendedor', 'p.buyer': 'Comprador', 'p.remarks': 'Observaciones',
      'p.bank': 'Datos bancarios', 'p.sellerSign': 'Firma/sello vendedor', 'p.buyerSign': 'Firma comprador',
      'q.title': 'COTIZACIÓN', 'q.to': 'Para', 'q.from': 'De', 'q.note': 'Nota',
      'q.total': 'TOTAL', 'q.spec': 'Especificación',
      'doc.quotation': 'Cotización', 'doc.sc': 'Contrato de compraventa',
      'doc.pi': 'Factura proforma', 'doc.oc': 'Confirmación de pedido',
      'doc.si': 'Factura de muestra', 'doc.ci': 'Factura comercial',
      'doc.pl': 'Lista de empaque', 'doc.sa': 'Aviso de embarque',
      'doc.bli': 'Instrucción de B/L', 'doc.co': 'Certificado de origen',
      'doc.ins': 'Solicitud de seguro', 'doc.lccheck': 'Lista de revisión L/C',
      'doc.tt': 'Registro de pago T/T', 'doc.coll': 'Recordatorio de pago',
      'doc.ir': 'Informe de inspección', 'doc.po': 'Orden de producción',
      'doc.as': 'Informe posventa', 'doc.nda': 'Acuerdo de confidencialidad',
      'doc.ca': 'Acuerdo de comisión', 'doc.mou': 'MOU anual'
    },
    pt: {
      'f.no': 'Nº', 'f.date': 'Data', 'f.seller': 'Vendedor', 'f.sellerAddr': 'End. vendedor',
      'f.buyer': 'Comprador', 'f.buyerAddr': 'End. comprador', 'f.product': 'Produto',
      'f.qty': 'Qtd.', 'f.unit': 'Unidade', 'f.price': 'Preço unit.', 'f.currency': 'Moeda',
      'f.total': 'Valor total', 'f.payment': 'Pagamento', 'f.portFrom': 'Porto de embarque',
      'f.portTo': 'Porto de desembarque', 'f.delivery': 'Entrega',
      't.desc': 'Descrição', 't.qty': 'Qtd.', 't.unitPrice': 'Preço unit.', 't.amount': 'Valor',
      'p.seller': 'Vendedor', 'p.buyer': 'Comprador', 'p.remarks': 'Observações',
      'p.bank': 'Dados bancários', 'p.sellerSign': 'Assinatura/carimbo vendedor', 'p.buyerSign': 'Assinatura comprador',
      'q.title': 'COTAÇÃO', 'q.to': 'Para', 'q.from': 'De', 'q.note': 'Nota',
      'q.total': 'TOTAL', 'q.spec': 'Especificação',
      'doc.quotation': 'Cotação', 'doc.sc': 'Contrato de venda',
      'doc.pi': 'Fatura proforma', 'doc.oc': 'Confirmação de pedido',
      'doc.si': 'Fatura de amostra', 'doc.ci': 'Fatura comercial',
      'doc.pl': 'Lista de embalagem', 'doc.sa': 'Aviso de embarque',
      'doc.bli': 'Instrução de B/L', 'doc.co': 'Certificado de origem',
      'doc.ins': 'Solicitação de seguro', 'doc.lccheck': 'Checklist de L/C',
      'doc.tt': 'Registro de pagamento T/T', 'doc.coll': 'Lembrete de pagamento',
      'doc.ir': 'Relatório de inspeção', 'doc.po': 'Ordem de produção',
      'doc.as': 'Relatório pós-venda', 'doc.nda': 'Acordo de confidencialidade',
      'doc.ca': 'Acordo de comissão', 'doc.mou': 'MOU anual'
    },
    de: {
      'f.no': 'Nr.', 'f.date': 'Datum', 'f.seller': 'Verkäufer', 'f.sellerAddr': 'Verkäufer-Adr.',
      'f.buyer': 'Käufer', 'f.buyerAddr': 'Käufer-Adr.', 'f.product': 'Produkt',
      'f.qty': 'Menge', 'f.unit': 'Einheit', 'f.price': 'Stückpreis', 'f.currency': 'Währung',
      'f.total': 'Gesamtbetrag', 'f.payment': 'Zahlung', 'f.portFrom': 'Ladehafen',
      'f.portTo': 'Löschhafen', 'f.delivery': 'Lieferung',
      't.desc': 'Beschreibung', 't.qty': 'Menge', 't.unitPrice': 'Stückpreis', 't.amount': 'Betrag',
      'p.seller': 'Verkäufer', 'p.buyer': 'Käufer', 'p.remarks': 'Bemerkungen',
      'p.bank': 'Bankdaten', 'p.sellerSign': 'Unterschrift/Siegel Verkäufer', 'p.buyerSign': 'Unterschrift Käufer',
      'q.title': 'ANGEBOT', 'q.to': 'An', 'q.from': 'Von', 'q.note': 'Hinweis',
      'q.total': 'GESAMT', 'q.spec': 'Spezifikation',
      'doc.quotation': 'Angebot', 'doc.sc': 'Verkaufsvertrag',
      'doc.pi': 'Proforma-Rechnung', 'doc.oc': 'Auftragsbestätigung',
      'doc.si': 'Musterrechnung', 'doc.ci': 'Handelsrechnung',
      'doc.pl': 'Packliste', 'doc.sa': 'Versandmitteilung',
      'doc.bli': 'B/L-Anweisung', 'doc.co': 'Ursprungsnachweis',
      'doc.ins': 'Versicherungsantrag', 'doc.lccheck': 'Akreditiv-Checkliste',
      'doc.tt': 'T/T-Zahlungsbeleg', 'doc.coll': 'Zahlungserinnerung',
      'doc.ir': 'Inspektionsbericht', 'doc.po': 'Produktionsauftrag',
      'doc.as': 'After-sales-Bericht', 'doc.nda': 'Geheimhaltungsvereinbarung',
      'doc.ca': 'Provisionsvereinbarung', 'doc.mou': 'Jährliches MOU'
    },
    fr: {
      'f.no': 'N°', 'f.date': 'Date', 'f.seller': 'Vendeur', 'f.sellerAddr': 'Adr. vendeur',
      'f.buyer': 'Acheteur', 'f.buyerAddr': 'Adr. acheteur', 'f.product': 'Produit',
      'f.qty': 'Qté', 'f.unit': 'Unité', 'f.price': 'Prix unit.', 'f.currency': 'Devise',
      'f.total': 'Montant total', 'f.payment': 'Paiement', 'f.portFrom': 'Port de chargement',
      'f.portTo': 'Port de déchargement', 'f.delivery': 'Livraison',
      't.desc': 'Description', 't.qty': 'Qté', 't.unitPrice': 'Prix unit.', 't.amount': 'Montant',
      'p.seller': 'Vendeur', 'p.buyer': 'Acheteur', 'p.remarks': 'Remarques',
      'p.bank': 'Coordonnées bancaires', 'p.sellerSign': 'Signature/cachet vendeur', 'p.buyerSign': 'Signature acheteur',
      'q.title': 'DEVIS', 'q.to': 'À', 'q.from': 'De', 'q.note': 'Note',
      'q.total': 'TOTAL', 'q.spec': 'Spécification',
      'doc.quotation': 'Devis', 'doc.sc': 'Contrat de vente',
      'doc.pi': 'Facture proforma', 'doc.oc': 'Confirmation de commande',
      'doc.si': 'Facture d’échantillon', 'doc.ci': 'Facture commerciale',
      'doc.pl': 'Liste de colisage', 'doc.sa': 'Avis d’expédition',
      'doc.bli': 'Instruction B/L', 'doc.co': 'Certificat d’origine',
      'doc.ins': 'Demande d’assurance', 'doc.lccheck': 'Checklist L/C',
      'doc.tt': 'Reçu de paiement T/T', 'doc.coll': 'Relance de paiement',
      'doc.ir': 'Rapport d’inspection', 'doc.po': 'Ordre de production',
      'doc.as': 'Rapport après-vente', 'doc.nda': 'Accord de confidentialité',
      'doc.ca': 'Accord de commission', 'doc.mou': 'MOU annuel'
    },
    it: {
      'f.no': 'N.', 'f.date': 'Data', 'f.seller': 'Venditore', 'f.sellerAddr': 'Indirizzo venditore',
      'f.buyer': 'Acquirente', 'f.buyerAddr': 'Indirizzo acquirente', 'f.product': 'Prodotto',
      'f.qty': 'Qtà', 'f.unit': 'Unità', 'f.price': 'Prezzo unit.', 'f.currency': 'Valuta',
      'f.total': 'Importo totale', 'f.payment': 'Pagamento', 'f.portFrom': 'Porto di carico',
      'f.portTo': 'Porto di scarico', 'f.delivery': 'Consegna',
      't.desc': 'Descrizione', 't.qty': 'Qtà', 't.unitPrice': 'Prezzo unit.', 't.amount': 'Importo',
      'p.seller': 'Venditore', 'p.buyer': 'Acquirente', 'p.remarks': 'Note',
      'p.bank': 'Dati bancari', 'p.sellerSign': 'Firma/stampillo venditore', 'p.buyerSign': 'Firma acquirente',
      'q.title': 'PREVENTIVO', 'q.to': 'A', 'q.from': 'Da', 'q.note': 'Nota',
      'q.total': 'TOTALE', 'q.spec': 'Specifiche',
      'doc.quotation': 'Preventivo', 'doc.sc': 'Contratto di vendita',
      'doc.pi': 'Fattura proforma', 'doc.oc': 'Conferma d’ordine',
      'doc.si': 'Fattura campione', 'doc.ci': 'Fattura commerciale',
      'doc.pl': 'Lista di imbottigliamento', 'doc.sa': 'Avviso di spedizione',
      'doc.bli': 'Istruzioni B/L', 'doc.co': 'Certificato di origine',
      'doc.ins': 'Richiesta assicurativa', 'doc.lccheck': 'Checklist L/C',
      'doc.tt': 'Registro pagamento T/T', 'doc.coll': 'Sollecito di pagamento',
      'doc.ir': 'Rapporto di ispezione', 'doc.po': 'Ordine di produzione',
      'doc.as': 'Rapporto post-vendita', 'doc.nda': 'Accordo di riservatezza',
      'doc.ca': 'Accordo di commissione', 'doc.mou': 'MOU annuale'
    },
    ru: {
      'f.no': '№', 'f.date': 'Дата', 'f.seller': 'Продавец', 'f.sellerAddr': 'Адрес продавца',
      'f.buyer': 'Покупатель', 'f.buyerAddr': 'Адрес покупателя', 'f.product': 'Товар',
      'f.qty': 'Кол-во', 'f.unit': 'Ед. изм.', 'f.price': 'Цена за ед.', 'f.currency': 'Валюта',
      'f.total': 'Сумма', 'f.payment': 'Оплата', 'f.portFrom': 'Порт погрузки',
      'f.portTo': 'Порт выгрузки', 'f.delivery': 'Срок поставки',
      't.desc': 'Наименование', 't.qty': 'Кол-во', 't.unitPrice': 'Цена', 't.amount': 'Сумма',
      'p.seller': 'Продавец', 'p.buyer': 'Покупатель', 'p.remarks': 'Примечания',
      'p.bank': 'Банковские реквизиты', 'p.sellerSign': 'Подпись/печать продавца', 'p.buyerSign': 'Подпись покупателя',
      'q.title': 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', 'q.to': 'Кому', 'q.from': 'От', 'q.note': 'Примечание',
      'q.total': 'ИТОГО', 'q.spec': 'Характеристики',
      'doc.quotation': 'Предложение', 'doc.sc': 'Договор купли-продажи',
      'doc.pi': 'Проформа-инвойс', 'doc.oc': 'Подтверждение заказа',
      'doc.si': 'Инвойс на образец', 'doc.ci': 'Коммерческий инвойс',
      'doc.pl': 'Упаковочный лист', 'doc.sa': 'Уведомление об отгрузке',
      'doc.bli': 'Инструкция B/L', 'doc.co': 'Сертификат происхождения',
      'doc.ins': 'Заявка на страхование', 'doc.lccheck': 'Чек-лист АК',
      'doc.tt': 'Регистрация платежа T/T', 'doc.coll': 'Напоминание об оплате',
      'doc.ir': 'Отчёт об инспекции', 'doc.po': 'Производственный заказ',
      'doc.as': 'Отчёт послепродажного сервиса', 'doc.nda': 'Соглашение о неразглашении',
      'doc.ca': 'Агентское соглашение', 'doc.mou': 'Годовое MOU'
    },
    ar: {
      'f.no': 'رقم', 'f.date': 'التاريخ', 'f.seller': 'البائع', 'f.sellerAddr': 'عنوان البائع',
      'f.buyer': 'المشتري', 'f.buyerAddr': 'عنوان المشتري', 'f.product': 'الصنف',
      'f.qty': 'الكمية', 'f.unit': 'الوحدة', 'f.price': 'سعر الوحدة', 'f.currency': 'العملة',
      'f.total': 'المبلغ الإجمالي', 'f.payment': 'الدفع', 'f.portFrom': 'ميناء التحميل',
      'f.portTo': 'ميناء التفريغ', 'f.delivery': 'التسليم',
      't.desc': 'الوصف', 't.qty': 'الكمية', 't.unitPrice': 'سعر الوحدة', 't.amount': 'المبلغ',
      'p.seller': 'البائع', 'p.buyer': 'المشتري', 'p.remarks': 'ملاحظات',
      'p.bank': 'بيانات البنك', 'p.sellerSign': 'توقيع/ختم البائع', 'p.buyerSign': 'توقيع المشتري',
      'q.title': 'عرض سعر', 'q.to': 'إلى', 'q.from': 'من', 'q.note': 'ملاحظة',
      'q.total': 'الإجمالي', 'q.spec': 'المواصفات',
      'doc.quotation': 'عرض سعر', 'doc.sc': 'عقد بيع',
      'doc.pi': 'فاتورة أولية', 'doc.oc': 'تأكيد الطلب',
      'doc.si': 'فاتورة عينة', 'doc.ci': 'فاتورة تجارية',
      'doc.pl': 'قائمة التعبئة', 'doc.sa': 'إشعار الشحن',
      'doc.bli': 'تعليمات بوليصة الشحن', 'doc.co': 'شهادة المنشأ',
      'doc.ins': 'طلب تأمين', 'doc.lccheck': 'قائمة مراجعة الاعتماد',
      'doc.tt': 'سجل دفع T/T', 'doc.coll': 'تذكير بالدفع',
      'doc.ir': 'تقرير الفحص', 'doc.po': 'أمر إنتاج',
      'doc.as': 'تقرير ما بعد البيع', 'doc.nda': 'اتفاقية عدم إفصاح',
      'doc.ca': 'اتفاقية عمولة', 'doc.mou': 'مذكرة تفاهم سنوية'
    },
    ja: {
      'f.no': 'No.', 'f.date': '日付', 'f.seller': '売主', 'f.sellerAddr': '売主住所',
      'f.buyer': '買主', 'f.buyerAddr': '買主住所', 'f.product': '品名',
      'f.qty': '数量', 'f.unit': '単位', 'f.price': '単価', 'f.currency': '通貨',
      'f.total': '合計金額', 'f.payment': '支払条件', 'f.portFrom': '積出港',
      'f.portTo': '揚卸港', 'f.delivery': '納期',
      't.desc': '品名・説明', 't.qty': '数量', 't.unitPrice': '単価', 't.amount': '金額',
      'p.seller': '売主', 'p.buyer': '買主', 'p.remarks': '備考',
      'p.bank': '銀行情報', 'p.sellerSign': '売主署名/印', 'p.buyerSign': '買主署名',
      'q.title': '見積書', 'q.to': '宛先', 'q.from': '差出人', 'q.note': '備考',
      'q.total': '合計', 'q.spec': '仕様',
      'doc.quotation': '見積書', 'doc.sc': '売買契約書',
      'doc.pi': 'プロフォーマインボイス', 'doc.oc': '注文確認書',
      'doc.si': 'サンプルインボイス', 'doc.ci': '商業インボイス',
      'doc.pl': 'パッキングリスト', 'doc.sa': '出荷通知',
      'doc.bli': '船積指示書', 'doc.co': '原産地証明書申請',
      'doc.ins': '保険申込書', 'doc.lccheck': 'L/C書類チェックリスト',
      'doc.tt': 'T/T入金記録', 'doc.coll': '督促状',
      'doc.ir': '検査報告書', 'doc.po': '生産指示書',
      'doc.as': 'アフターサービス報告', 'doc.nda': '秘密保持契約',
      'doc.ca': '手数料契約', 'doc.mou': '年間MOU'
    },
    ko: {
      'f.no': '번호', 'f.date': '날짜', 'f.seller': '판매자', 'f.sellerAddr': '판매자 주소',
      'f.buyer': '구매자', 'f.buyerAddr': '구매자 주소', 'f.product': '품명',
      'f.qty': '수량', 'f.unit': '단위', 'f.price': '단가', 'f.currency': '통화',
      'f.total': '총액', 'f.payment': '결제조건', 'f.portFrom': '선적항',
      'f.portTo': '도착항', 'f.delivery': '납기',
      't.desc': '품명/설명', 't.qty': '수량', 't.unitPrice': '단가', 't.amount': '금액',
      'p.seller': '판매자', 'p.buyer': '구매자', 'p.remarks': '비고',
      'p.bank': '은행 정보', 'p.sellerSign': '판매자 서명/도장', 'p.buyerSign': '구매자 서명',
      'q.title': '견적서', 'q.to': '수신', 'q.from': '발신', 'q.note': '비고',
      'q.total': '합계', 'q.spec': '사양',
      'doc.quotation': '견적서', 'doc.sc': '매매계약서',
      'doc.pi': '프로forma 인보이스', 'doc.oc': '주문확인서',
      'doc.si': '샘플 인보이스', 'doc.ci': '상업 인보이스',
      'doc.pl': '포장명세서', 'doc.sa': '선적통지',
      'doc.bli': '선하증권 지시서', 'doc.co': '원산지증명서 신청',
      'doc.ins': '보험 가입신청서', 'doc.lccheck': 'L/C 서류 체크리스트',
      'doc.tt': 'T/T 결제 기록', 'doc.coll': '결제 독촉장',
      'doc.ir': '검사 보고서', 'doc.po': '생산 지시서',
      'doc.as': 'A/S 보고서', 'doc.nda': '비밀유지계약',
      'doc.ca': '수수료 계약', 'doc.mou': '연간 MOU'
    },
    tr: {
      'f.no': 'No', 'f.date': 'Tarih', 'f.seller': 'Satıcı', 'f.sellerAddr': 'Satıcı adresi',
      'f.buyer': 'Alıcı', 'f.buyerAddr': 'Alıcı adresi', 'f.product': 'Ürün',
      'f.qty': 'Miktar', 'f.unit': 'Birim', 'f.price': 'Birim fiyat', 'f.currency': 'Para birimi',
      'f.total': 'Toplam tutar', 'f.payment': 'Ödeme', 'f.portFrom': 'Yükleme limanı',
      'f.portTo': 'Boşaltma limanı', 'f.delivery': 'Teslimat',
      't.desc': 'Açıklama', 't.qty': 'Miktar', 't.unitPrice': 'Birim fiyat', 't.amount': 'Tutar',
      'p.seller': 'Satıcı', 'p.buyer': 'Alıcı', 'p.remarks': 'Notlar',
      'p.bank': 'Banka bilgileri', 'p.sellerSign': 'Satıcı imza/mühür', 'p.buyerSign': 'Alıcı imza',
      'q.title': 'FİYAT TEKLİFİ', 'q.to': 'Sayın', 'q.from': 'Gönderen', 'q.note': 'Not',
      'q.total': 'TOPLAM', 'q.spec': 'Özellik',
      'doc.quotation': 'Teklif', 'doc.sc': 'Satış sözleşmesi',
      'doc.pi': 'Proforma fatura', 'doc.oc': 'Sipariş onayı',
      'doc.si': 'Numune fatura', 'doc.ci': 'Ticari fatura',
      'doc.pl': 'Paket listesi', 'doc.sa': 'Sevkiyat bildirimi',
      'doc.bli': 'Konşimento talimatı', 'doc.co': 'Menşe şahadetnamesi',
      'doc.ins': 'Sigorta başvurusu', 'doc.lccheck': 'Akreditif kontrol listesi',
      'doc.tt': 'T/T ödeme kaydı', 'doc.coll': 'Ödeme hatırlatması',
      'doc.ir': 'İnceleme raporu', 'doc.po': 'Üretim emri',
      'doc.as': 'Satış sonrası rapor', 'doc.nda': 'Gizlilik sözleşmesi',
      'doc.ca': 'Komisyon sözleşmesi', 'doc.mou': 'Yıllık MOU'
    },
    nl: {
      'f.no': 'Nr.', 'f.date': 'Datum', 'f.seller': 'Verkoper', 'f.sellerAddr': 'Adres verkoper',
      'f.buyer': 'Koper', 'f.buyerAddr': 'Adres koper', 'f.product': 'Product',
      'f.qty': 'Aantal', 'f.unit': 'Eenheid', 'f.price': 'Stuksprijs', 'f.currency': 'Valuta',
      'f.total': 'Totaalbedrag', 'f.payment': 'Betaling', 'f.portFrom': 'Laadhaven',
      'f.portTo': 'Loshaven', 'f.delivery': 'Levering',
      't.desc': 'Omschrijving', 't.qty': 'Aantal', 't.unitPrice': 'Stuksprijs', 't.amount': 'Bedrag',
      'p.seller': 'Verkoper', 'p.buyer': 'Koper', 'p.remarks': 'Opmerkingen',
      'p.bank': 'Bankgegevens', 'p.sellerSign': 'Handtekening/stempel verkoper', 'p.buyerSign': 'Handtekening koper',
      'q.title': 'OFFERTE', 'q.to': 'Aan', 'q.from': 'Van', 'q.note': 'Opmerking',
      'q.total': 'TOTAAL', 'q.spec': 'Specificatie',
      'doc.quotation': 'Offerte', 'doc.sc': 'Koopovereenkomst',
      'doc.pi': 'Proformafactuur', 'doc.oc': 'Orderbevestiging',
      'doc.si': 'Monsterfactuur', 'doc.ci': 'Handelsfactuur',
      'doc.pl': 'Paklijst', 'doc.sa': 'Verzendbericht',
      'doc.bli': 'B/L-instructie', 'doc.co': 'Oorsprongsverklaring',
      'doc.ins': 'Verzekeringsaanvraag', 'doc.lccheck': 'L/C-checklist',
      'doc.tt': 'T/T-betaling', 'doc.coll': 'Betalingsherinnering',
      'doc.ir': 'Inspectierapport', 'doc.po': 'Productieorder',
      'doc.as': 'Naverkooprapport', 'doc.nda': 'Geheimhoudingscontract',
      'doc.ca': 'Commissieovereenkomst', 'doc.mou': 'Jaarlijks MOU'
    },
    pl: {
      'f.no': 'Nr', 'f.date': 'Data', 'f.seller': 'Sprzedawca', 'f.sellerAddr': 'Adres sprzedawcy',
      'f.buyer': 'Nabywca', 'f.buyerAddr': 'Adres nabywcy', 'f.product': 'Towar',
      'f.qty': 'Ilość', 'f.unit': 'Jednostka', 'f.price': 'Cena jdr.', 'f.currency': 'Waluta',
      'f.total': 'Kwota całkowita', 'f.payment': 'Płatność', 'f.portFrom': 'Port załadunku',
      'f.portTo': 'Port rozładunku', 'f.delivery': 'Dostawa',
      't.desc': 'Opis', 't.qty': 'Ilość', 't.unitPrice': 'Cena jdr.', 't.amount': 'Kwota',
      'p.seller': 'Sprzedawca', 'p.buyer': 'Nabywca', 'p.remarks': 'Uwagi',
      'p.bank': 'Dane bankowe', 'p.sellerSign': 'Podpis/pieczęć sprzedawcy', 'p.buyerSign': 'Podpis nabywcy',
      'q.title': 'OFERTA', 'q.to': 'Dla', 'q.from': 'Od', 'q.note': 'Uwaga',
      'q.total': 'RAZEM', 'q.spec': 'Specyfikacja',
      'doc.quotation': 'Oferta', 'doc.sc': 'Umowa sprzedaży',
      'doc.pi': 'Faktura pro forma', 'doc.oc': 'Potwierdzenie zamówienia',
      'doc.si': 'Faktura próbki', 'doc.ci': 'Faktura handlowa',
      'doc.pl': 'Lista paczkowa', 'doc.sa': 'Zawiadomienie o wysyłce',
      'doc.bli': 'Instrukcja B/L', 'doc.co': 'Świadectwo pochodzenia',
      'doc.ins': 'Wniosek ubezpieczeniowy', 'doc.lccheck': 'Lista kontrolna L/C',
      'doc.tt': 'Rejestr płatności T/T', 'doc.coll': 'Wezwanie do zapłaty',
      'doc.ir': 'Raport z inspekcji', 'doc.po': 'Zlecenie produkcyjne',
      'doc.as': 'Raport posprzedażowy', 'doc.nda': 'Umowa poufności',
      'doc.ca': 'Umowa prowizyjna', 'doc.mou': 'Roczne MOU'
    },
    vi: {
      'f.no': 'Số', 'f.date': 'Ngày', 'f.seller': 'Bên bán', 'f.sellerAddr': 'Địa chỉ bên bán',
      'f.buyer': 'Bên mua', 'f.buyerAddr': 'Địa chỉ bên mua', 'f.product': 'Tên hàng',
      'f.qty': 'Số lượng', 'f.unit': 'Đơn vị', 'f.price': 'Đơn giá', 'f.currency': 'Tiền tệ',
      'f.total': 'Tổng tiền', 'f.payment': 'Thanh toán', 'f.portFrom': 'Cảng xuất',
      'f.portTo': 'Cảng nhập', 'f.delivery': 'Giao hàng',
      't.desc': 'Mô tả', 't.qty': 'SL', 't.unitPrice': 'Đơn giá', 't.amount': 'Thành tiền',
      'p.seller': 'Bên bán', 'p.buyer': 'Bên mua', 'p.remarks': 'Ghi chú',
      'p.bank': 'Thông tin ngân hàng', 'p.sellerSign': 'Chữ ký/con dấu bên bán', 'p.buyerSign': 'Chữ ký bên mua',
      'q.title': 'BÁO GIÁ', 'q.to': 'Gửi', 'q.from': 'Từ', 'q.note': 'Ghi chú',
      'q.total': 'TỔNG CỘNG', 'q.spec': 'Quy cách',
      'doc.quotation': 'Báo giá', 'doc.sc': 'Hợp đồng mua bán',
      'doc.pi': 'Hóa đơn dạng', 'doc.oc': 'Xác nhận đơn hàng',
      'doc.si': 'Hóa đơn mẫu', 'doc.ci': 'Hóa đơn thương mại',
      'doc.pl': 'Danh sách đóng gói', 'doc.sa': 'Thông báo giao hàng',
      'doc.bli': 'Hướng dẫn vận đơn', 'doc.co': 'Giấy chứng nhận xuất xứ',
      'doc.ins': 'Đơn bảo hiểm', 'doc.lccheck': 'Danh mục kiểm L/C',
      'doc.tt': 'Biên nhận T/T', 'doc.coll': 'Thư nhắc thanh toán',
      'doc.ir': 'Báo cáo kiểm hàng', 'doc.po': 'Lệnh sản xuất',
      'doc.as': 'Báo cáo hậu mãi', 'doc.nda': 'Hợp đồng bảo mật',
      'doc.ca': 'Hợp đồng hoa hồng', 'doc.mou': 'MOU hàng năm'
    },
    id: {
      'f.no': 'No.', 'f.date': 'Tanggal', 'f.seller': 'Penjual', 'f.sellerAddr': 'Alamat penjual',
      'f.buyer': 'Pembeli', 'f.buyerAddr': 'Alamat pembeli', 'f.product': 'Produk',
      'f.qty': 'Qty', 'f.unit': 'Satuan', 'f.price': 'Harga satuan', 'f.currency': 'Mata uang',
      'f.total': 'Jumlah total', 'f.payment': 'Pembayaran', 'f.portFrom': 'Pelabuhan muat',
      'f.portTo': 'Pelabuhan bongkar', 'f.delivery': 'Pengiriman',
      't.desc': 'Deskripsi', 't.qty': 'Qty', 't.unitPrice': 'Harga satuan', 't.amount': 'Jumlah',
      'p.seller': 'Penjual', 'p.buyer': 'Pembeli', 'p.remarks': 'Catatan',
      'p.bank': 'Info bank', 'p.sellerSign': 'Tanda tangan/stempel penjual', 'p.buyerSign': 'Tanda tangan pembeli',
      'q.title': 'PENAWARAN HARGA', 'q.to': 'Kepada', 'q.from': 'Dari', 'q.note': 'Catatan',
      'q.total': 'TOTAL', 'q.spec': 'Spesifikasi',
      'doc.quotation': 'Penawaran harga', 'doc.sc': 'Kontrak penjualan',
      'doc.pi': 'Faktur proforma', 'doc.oc': 'Konfirmasi pesanan',
      'doc.si': 'Faktur sampel', 'doc.ci': 'Faktur komersial',
      'doc.pl': 'Daftar kemasan', 'doc.sa': 'Pemberitahuan pengiriman',
      'doc.bli': 'Instruksi B/L', 'doc.co': 'Sertifikat asal',
      'doc.ins': 'Formulir asuransi', 'doc.lccheck': 'Checklist L/C',
      'doc.tt': 'Catatan pembayaran T/T', 'doc.coll': 'Pengingat pembayaran',
      'doc.ir': 'Laporan inspeksi', 'doc.po': 'Perintah produksi',
      'doc.as': 'Laporan purna jual', 'doc.nda': 'Perjanjian kerahasiaan',
      'doc.ca': 'Perjanjian komisi', 'doc.mou': 'MOU tahunan'
    },
    th: {
      'f.no': 'เลขที่', 'f.date': 'วันที่', 'f.seller': 'ผู้ขาย', 'f.sellerAddr': 'ที่อยู่ผู้ขาย',
      'f.buyer': 'ผู้ซื้อ', 'f.buyerAddr': 'ที่อยู่ผู้ซื้อ', 'f.product': 'สินค้า',
      'f.qty': 'จำนวน', 'f.unit': 'หน่วย', 'f.price': 'ราคาต่อหน่วย', 'f.currency': 'สกุลเงิน',
      'f.total': 'ยอดรวม', 'f.payment': 'การชำระเงิน', 'f.portFrom': 'ท่าเรือต้นทาง',
      'f.portTo': 'ท่าเรือปลายทาง', 'f.delivery': 'การส่งมอบ',
      't.desc': 'รายละเอียด', 't.qty': 'จำนวน', 't.unitPrice': 'ราคาต่อหน่วย', 't.amount': 'จำนวนเงิน',
      'p.seller': 'ผู้ขาย', 'p.buyer': 'ผู้ซื้อ', 'p.remarks': 'หมายเหตุ',
      'p.bank': 'ข้อมูลธนาคาร', 'p.sellerSign': 'ลายเซ็น/ตราประทับผู้ขาย', 'p.buyerSign': 'ลายเซ็นผู้ซื้อ',
      'q.title': 'ใบเสนอราคา', 'q.to': 'ถึง', 'q.from': 'จาก', 'q.note': 'หมายเหตุ',
      'q.total': 'รวมทั้งสิ้น', 'q.spec': 'ข้อมูลจำเพาะ',
      'doc.quotation': 'ใบเสนอราคา', 'doc.sc': 'สัญญาซื้อขาย',
      'doc.pi': 'ใบแจ้งหนี้ proforma', 'doc.oc': 'ใบยืนยันคำสั่งซื้อ',
      'doc.si': 'ใบแจ้งหนี้ตัวอย่าง', 'doc.ci': 'ใบแจ้งหนี้พาณิชย์',
      'doc.pl': 'ใบกำกับการบรรจุ', 'doc.sa': 'แจ้งการจัดส่ง',
      'doc.bli': 'คำสั่ง B/L', 'doc.co': 'ใบรับรองถิ่นกำเนิดสินค้า',
      'doc.ins': 'แบบฟอร์มประกันภัย', 'doc.lccheck': 'เช็คลิสต์ L/C',
      'doc.tt': 'บันทึกชำระเงิน T/T', 'doc.coll': 'แจ้งเตือนชำระเงิน',
      'doc.ir': 'รายงานตรวจสอบ', 'doc.po': 'คำสั่งผลิต',
      'doc.as': 'รายงานหลังการขาย', 'doc.nda': 'ข้อตกลงไม่เปิดเผยข้อมูล',
      'doc.ca': 'ข้อตกลงค่านายหน้า', 'doc.mou': 'MOU ประจำปี'
    }
  };

  function cfgLang() {
    try { return (DataStore.getCfg() || {}).docLang || 'bilingual'; }
    catch (e) { return 'bilingual'; }
  }

  function setLang(id) {
    var ok = LANGS.some(function (l) { return l.id === id; });
    if (!ok) id = 'bilingual';
    try { DataStore.setCfg({ docLang: id }); } catch (e) {}
    return id;
  }

  function isValid(id) {
    return LANGS.some(function (l) { return l.id === id; });
  }

  function lookup(key, lang) {
    if (lang === 'bilingual') {
      var zh = ZH[key];
      var en = EN[key];
      if (zh && en && zh !== en) return zh + ' / ' + en;
      return zh || en || '';
    }
    if (lang === 'zh') return ZH[key] || EN[key] || '';
    if (lang === 'en') return EN[key] || '';
    var d = DICT[lang] || {};
    return d[key] || EN[key] || '';
  }

  /** 通用取词：t(key, lang?) */
  function t(key, lang) {
    return lookup(key, lang || cfgLang());
  }

  /** 字段标签：bilingual 用 schema 原文（中英混排），其余走词典 */
  function fieldLabel(f, lang) {
    lang = lang || cfgLang();
    if (!f) return '';
    if (lang === 'bilingual') return f.label || '';
    var key = 'f.' + f.k;
    var v = lookup(key, lang);
    return v || f.label || '';
  }

  /** 单证标题：bilingual 用 "中 / EN"；zh 取中文段；其余词典或英文段 */
  function docTitle(def, lang) {
    lang = lang || cfgLang();
    if (!def) return '';
    if (lang === 'bilingual') return def.title || '';
    var key = 'doc.' + def.id;
    var parts = String(def.title || '').split(' / ');
    if (lang === 'zh') return ZH[key] || parts[0] || def.title;
    var d = DICT[lang];
    if (d && d[key]) return d[key];
    if (lang === 'en') return EN[key] || parts[1] || parts[0] || def.title;
    return EN[key] || parts[1] || parts[0] || def.title;
  }

  /** 单证 chips 列表用短标题（取第一段逻辑） */
  function docChipTitle(def, lang) {
    lang = lang || cfgLang();
    if (lang === 'bilingual') return String(def.title || '').split(' / ')[0];
    return docTitle(def, lang);
  }

  function optionsHTML(sel) {
    sel = sel || cfgLang();
    return LANGS.map(function (l) {
      return '<option value="' + l.id + '"' + (l.id === sel ? ' selected' : '') + '>' + l.name + '</option>';
    }).join('');
  }

  /** Paper.toolbarHTML 用的语言 select */
  function toolbarSelectHTML() {
    return '<select id="paperLang" onchange="onPaperLang()" title="单证语言"'
      + ' style="padding:4px 6px;border:1px solid var(--border-strong,#cfc9b8);border-radius:4px;font-size:12px">'
      + optionsHTML() + '</select>';
  }

  global.I18N = {
    LANGS: LANGS,
    getLang: cfgLang,
    setLang: setLang,
    isValid: isValid,
    t: t,
    fieldLabel: fieldLabel,
    docTitle: docTitle,
    docChipTitle: docChipTitle,
    optionsHTML: optionsHTML,
    toolbarSelectHTML: toolbarSelectHTML,
    lookup: lookup
  };
})(window);
