/* ============================================================
   FT Compass · 单证正文多语言 v1.0
   只翻「正文条款」（DOCS_DEF[].notes），不翻用户填写的字段值。
   覆盖：zh / es / fr / de / pt / ru / ar
   - 英文原文仍在 js/docs_data.js，其余语种在这里
   - {{占位符}} 必须与英文版一一对应，渲染时由 rep() 替换
   - 未覆盖的语种（ja/ko/it/tr/nl/pl/vi/id/th）自动回退英文
   ============================================================ */
var DOC_NOTES = {

  /* 1. 报价单 */
  quotation: {
    zh: [
      "价格条款：{{currency}} {{price}}/{{unit}}，FOB {{portFrom}}",
      "付款方式：{{payment}}",
      "交期：{{delivery}}",
      "报价有效期：{{valid}}"
    ],
    es: [
      "Base de precio: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
      "Pago: {{payment}}",
      "Entrega: {{delivery}}",
      "Validez: {{valid}}"
    ],
    fr: [
      "Base de prix : {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
      "Paiement : {{payment}}",
      "Livraison : {{delivery}}",
      "Validité : {{valid}}"
    ],
    de: [
      "Preisbasis: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
      "Zahlung: {{payment}}",
      "Lieferung: {{delivery}}",
      "Gültigkeit: {{valid}}"
    ],
    pt: [
      "Base de preço: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
      "Pagamento: {{payment}}",
      "Entrega: {{delivery}}",
      "Validade: {{valid}}"
    ],
    ru: [
      "Базис цены: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
      "Оплата: {{payment}}",
      "Поставка: {{delivery}}",
      "Срок действия: {{valid}}"
    ],
    ar: [
      "أساس السعر: {{currency}} {{price}}/{{unit}}، FOB {{portFrom}}",
      "الدفع: {{payment}}",
      "التسليم: {{delivery}}",
      "صلاحية العرض: {{valid}}"
    ]
  },

  /* 2. 销售合同 */
  sc: {
    zh: [
      "本合同由 {{seller}}（卖方）与 {{buyer}}（买方）签订。",
      "质量：{{quality}}",
      "付款：{{payment}}",
      "交期：{{delivery}}，自 {{portFrom}} 至 {{portTo}}",
      "索赔：{{claim}}"
    ],
    es: [
      "El presente contrato se celebra entre {{seller}} (Vendedor) y {{buyer}} (Comprador).",
      "Calidad: {{quality}}",
      "Pago: {{payment}}",
      "Entrega: {{delivery}} de {{portFrom}} a {{portTo}}",
      "Reclamaciones: {{claim}}"
    ],
    fr: [
      "Le présent contrat est conclu entre {{seller}} (Vendeur) et {{buyer}} (Acheteur).",
      "Qualité : {{quality}}",
      "Paiement : {{payment}}",
      "Livraison : {{delivery}} de {{portFrom}} à {{portTo}}",
      "Réclamations : {{claim}}"
    ],
    de: [
      "Dieser Vertrag wird zwischen {{seller}} (Verkäufer) und {{buyer}} (Käufer) geschlossen.",
      "Qualität: {{quality}}",
      "Zahlung: {{payment}}",
      "Lieferung: {{delivery}} von {{portFrom}} nach {{portTo}}",
      "Reklamationen: {{claim}}"
    ],
    pt: [
      "O presente contrato é celebrado entre {{seller}} (Vendedor) e {{buyer}} (Comprador).",
      "Qualidade: {{quality}}",
      "Pagamento: {{payment}}",
      "Entrega: {{delivery}} de {{portFrom}} para {{portTo}}",
      "Reclamações: {{claim}}"
    ],
    ru: [
      "Настоящий договор заключён между {{seller}} (Продавец) и {{buyer}} (Покупатель).",
      "Качество: {{quality}}",
      "Оплата: {{payment}}",
      "Поставка: {{delivery}} из {{portFrom}} в {{portTo}}",
      "Претензии: {{claim}}"
    ],
    ar: [
      "أُبرم هذا العقد بين {{seller}} (البائع) و{{buyer}} (المشتري).",
      "الجودة: {{quality}}",
      "الدفع: {{payment}}",
      "التسليم: {{delivery}} من {{portFrom}} إلى {{portTo}}",
      "المطالبات: {{claim}}"
    ]
  },

  /* 3. 形式发票 */
  pi: {
    zh: [
      "形式发票编号 {{no}}，日期 {{date}}",
      "付款：{{payment}}",
      "交期：{{delivery}}",
      "本形式发票有效期 {{valid}}，以最终确认为准。"
    ],
    es: [
      "Factura proforma n.º {{no}} de fecha {{date}}",
      "Pago: {{payment}}",
      "Entrega: {{delivery}}",
      "Esta factura proforma es válida por {{valid}} y está sujeta a confirmación final."
    ],
    fr: [
      "Facture proforma n° {{no}} du {{date}}",
      "Paiement : {{payment}}",
      "Livraison : {{delivery}}",
      "La présente facture proforma est valable {{valid}} et sous réserve de confirmation finale."
    ],
    de: [
      "Proforma-Rechnung Nr. {{no}} vom {{date}}",
      "Zahlung: {{payment}}",
      "Lieferung: {{delivery}}",
      "Diese Proforma-Rechnung ist {{valid}} gültig und vorbehaltlich der endgültigen Bestätigung."
    ],
    pt: [
      "Fatura proforma n.º {{no}}, de {{date}}",
      "Pagamento: {{payment}}",
      "Entrega: {{delivery}}",
      "Esta fatura proforma é válida por {{valid}} e sujeita a confirmação final."
    ],
    ru: [
      "Проформа-инвойс № {{no}} от {{date}}",
      "Оплата: {{payment}}",
      "Поставка: {{delivery}}",
      "Настоящий проформа-инвойс действителен {{valid}} и подлежит окончательному подтверждению."
    ],
    ar: [
      "فاتورة أولية رقم {{no}} بتاريخ {{date}}",
      "الدفع: {{payment}}",
      "التسليم: {{delivery}}",
      "هذه الفاتورة الأولية صالحة لمدة {{valid}} وتخضع للتأكيد النهائي."
    ]
  },

  /* 4. 订单确认书 */
  oc: {
    zh: [
      "兹确认按买方订单号 {{poNo}} 下达的订单。",
      "产品与数量见下表。",
      "付款：{{payment}}",
      "交期：{{delivery}}"
    ],
    es: [
      "Por la presente confirmamos el pedido según la orden de compra del comprador {{poNo}}.",
      "Producto y cantidad según la tabla siguiente.",
      "Pago: {{payment}}",
      "Entrega: {{delivery}}"
    ],
    fr: [
      "Nous confirmons par la présente la commande selon le bon de commande de l'acheteur {{poNo}}.",
      "Produit et quantité selon le tableau ci-dessous.",
      "Paiement : {{payment}}",
      "Livraison : {{delivery}}"
    ],
    de: [
      "Hiermit bestätigen wir die Bestellung gemäß Bestellnummer des Käufers {{poNo}}.",
      "Produkt und Menge gemäß nachstehender Tabelle.",
      "Zahlung: {{payment}}",
      "Lieferung: {{delivery}}"
    ],
    pt: [
      "Confirmamos por este meio o pedido conforme a ordem de compra do comprador {{poNo}}.",
      "Produto e quantidade conforme a tabela abaixo.",
      "Pagamento: {{payment}}",
      "Entrega: {{delivery}}"
    ],
    ru: [
      "Настоящим подтверждаем заказ согласно заказу покупателя № {{poNo}}.",
      "Товар и количество — согласно таблице ниже.",
      "Оплата: {{payment}}",
      "Поставка: {{delivery}}"
    ],
    ar: [
      "نؤكد بموجب هذا الطلب وفق أمر الشراء الخاص بالمشتري رقم {{poNo}}.",
      "المنتج والكمية وفقًا للجدول أدناه.",
      "الدفع: {{payment}}",
      "التسليم: {{delivery}}"
    ]
  },

  /* 5. 样品单 */
  si: {
    zh: [
      "样品费：{{sampleFee}}（{{deduct}}）",
      "快递：{{courier}}",
      "预计送达：付款后 5–7 个工作日。"
    ],
    es: [
      "Cargo por muestras: {{sampleFee}} ({{deduct}})",
      "Mensajería: {{courier}}",
      "Entrega estimada: 5-7 días hábiles tras el pago."
    ],
    fr: [
      "Frais d'échantillon : {{sampleFee}} ({{deduct}})",
      "Transporteur : {{courier}}",
      "Délai estimé : 5 à 7 jours ouvrés après paiement."
    ],
    de: [
      "Mustergebühr: {{sampleFee}} ({{deduct}})",
      "Kurier: {{courier}}",
      "Voraussichtliche Zustellung: 5–7 Werktage nach Zahlung."
    ],
    pt: [
      "Taxa de amostra: {{sampleFee}} ({{deduct}})",
      "Transportadora: {{courier}}",
      "Prazo estimado: 5 a 7 dias úteis após o pagamento."
    ],
    ru: [
      "Стоимость образца: {{sampleFee}} ({{deduct}})",
      "Курьер: {{courier}}",
      "Ожидаемая доставка: 5–7 рабочих дней после оплаты."
    ],
    ar: [
      "رسوم العينة: {{sampleFee}} ({{deduct}})",
      "شركة الشحن: {{courier}}",
      "موعد الوصول المتوقع: 5-7 أيام عمل بعد الدفع."
    ]
  },

  /* 6. 商业发票 */
  ci: {
    zh: [
      "{{product}} 的发票",
      "HS 编码：{{hsCode}}",
      "装运：自 {{portFrom}} 至 {{portTo}}",
      "付款：{{payment}}"
    ],
    es: [
      "Factura de {{product}}",
      "Código HS: {{hsCode}}",
      "Envío de {{portFrom}} a {{portTo}}",
      "Pago: {{payment}}"
    ],
    fr: [
      "Facture de {{product}}",
      "Code SH : {{hsCode}}",
      "Expédition de {{portFrom}} à {{portTo}}",
      "Paiement : {{payment}}"
    ],
    de: [
      "Rechnung über {{product}}",
      "HS-Code: {{hsCode}}",
      "Versand von {{portFrom}} nach {{portTo}}",
      "Zahlung: {{payment}}"
    ],
    pt: [
      "Fatura de {{product}}",
      "Código HS: {{hsCode}}",
      "Envio de {{portFrom}} para {{portTo}}",
      "Pagamento: {{payment}}"
    ],
    ru: [
      "Инвойс на {{product}}",
      "Код ТН ВЭД (HS): {{hsCode}}",
      "Отгрузка из {{portFrom}} в {{portTo}}",
      "Оплата: {{payment}}"
    ],
    ar: [
      "فاتورة {{product}}",
      "رمز HS: {{hsCode}}",
      "الشحن من {{portFrom}} إلى {{portTo}}",
      "الدفع: {{payment}}"
    ]
  },

  /* 7. 装箱单 */
  pl: {
    zh: [
      "{{product}} 共 {{ctns}} 箱",
      "毛重：{{gw}} kg　净重：{{nw}} kg　体积：{{meas}} CBM",
      "唛头：{{mark}}"
    ],
    es: [
      "{{ctns}} cajas de {{product}}",
      "Peso bruto: {{gw}} kg  Peso neto: {{nw}} kg  Volumen: {{meas}} CBM",
      "Marca de envío: {{mark}}"
    ],
    fr: [
      "{{ctns}} cartons de {{product}}",
      "Poids brut : {{gw}} kg  Poids net : {{nw}} kg  Volume : {{meas}} CBM",
      "Marque d'expédition : {{mark}}"
    ],
    de: [
      "{{ctns}} Kartons {{product}}",
      "Bruttogewicht: {{gw}} kg  Nettogewicht: {{nw}} kg  Volumen: {{meas}} CBM",
      "Versandmarkierung: {{mark}}"
    ],
    pt: [
      "{{ctns}} caixas de {{product}}",
      "Peso bruto: {{gw}} kg  Peso líquido: {{nw}} kg  Volume: {{meas}} CBM",
      "Marca de embarque: {{mark}}"
    ],
    ru: [
      "{{ctns}} коробок {{product}}",
      "Брутто: {{gw}} кг  Нетто: {{nw}} кг  Объём: {{meas}} CBM",
      "Маркировка: {{mark}}"
    ],
    ar: [
      "{{ctns}} كرتونة من {{product}}",
      "الوزن الإجمالي: {{gw}} كغ  الوزن الصافي: {{nw}} كغ  الحجم: {{meas}} CBM",
      "علامة الشحن: {{mark}}"
    ]
  },

  /* 8. 出货通知 */
  sa: {
    zh: [
      "尊敬的 {{buyer}}：兹通知，货物已装运。",
      "船名航次：{{vessel}}　开船日：{{etd}}　到港日：{{eta}}",
      "提单号：{{blNo}}",
      "全部货款收到后寄送单据。"
    ],
    es: [
      "Estimado {{buyer}}: le informamos que la mercancía ha sido embarcada.",
      "Buque: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
      "N.º de B/L: {{blNo}}",
      "Los documentos se enviarán tras recibir el pago total."
    ],
    fr: [
      "Cher {{buyer}}, nous vous informons que la marchandise a été expédiée.",
      "Navire : {{vessel}}  ETD : {{etd}}  ETA : {{eta}}",
      "N° de B/L : {{blNo}}",
      "Les documents seront envoyés après réception du paiement intégral."
    ],
    de: [
      "Sehr geehrte(r) {{buyer}}, wir informieren Sie, dass die Ware verschifft wurde.",
      "Schiff: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
      "B/L-Nr.: {{blNo}}",
      "Die Dokumente werden nach vollständigem Zahlungseingang versandt."
    ],
    pt: [
      "Prezado(a) {{buyer}}, informamos que a mercadoria foi embarcada.",
      "Navio: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
      "N.º do B/L: {{blNo}}",
      "Os documentos serão enviados após o recebimento do pagamento integral."
    ],
    ru: [
      "Уважаемый(ая) {{buyer}}! Сообщаем, что товар отгружен.",
      "Судно: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
      "№ коносамента (B/L): {{blNo}}",
      "Документы будут направлены после полной оплаты."
    ],
    ar: [
      "عزيزي {{buyer}}، نحيطكم علمًا بأن البضاعة قد تم شحنها.",
      "السفينة: {{vessel}}  تاريخ المغادرة: {{etd}}  تاريخ الوصول: {{eta}}",
      "رقم بوليصة الشحن: {{blNo}}",
      "ستُرسل المستندات بعد استلام كامل المبلغ."
    ]
  },

  /* 9. 提单补料 */
  bli: {
    zh: [
      "收货人：{{consignee}}",
      "通知人：{{notify}}",
      "起运港：{{portFrom}}　目的港：{{portTo}}",
      "运费：{{freight}}"
    ],
    es: [
      "Consignatario: {{consignee}}",
      "Parte notificada: {{notify}}",
      "Puerto de carga: {{portFrom}}  Puerto de descarga: {{portTo}}",
      "Flete: {{freight}}"
    ],
    fr: [
      "Destinataire : {{consignee}}",
      "Partie à notifier : {{notify}}",
      "Port de chargement : {{portFrom}}  Port de déchargement : {{portTo}}",
      "Fret : {{freight}}"
    ],
    de: [
      "Empfänger: {{consignee}}",
      "Zu benachrichtigende Partei: {{notify}}",
      "Verladehafen: {{portFrom}}  Löschhafen: {{portTo}}",
      "Fracht: {{freight}}"
    ],
    pt: [
      "Consignatário: {{consignee}}",
      "Parte a notificar: {{notify}}",
      "Porto de carregamento: {{portFrom}}  Porto de descarga: {{portTo}}",
      "Frete: {{freight}}"
    ],
    ru: [
      "Грузополучатель: {{consignee}}",
      "Уведомляемая сторона: {{notify}}",
      "Порт погрузки: {{portFrom}}  Порт выгрузки: {{portTo}}",
      "Фрахт: {{freight}}"
    ],
    ar: [
      "المرسل إليه: {{consignee}}",
      "الطرف المطلوب إخطاره: {{notify}}",
      "ميناء التحميل: {{portFrom}}  ميناء التفريغ: {{portTo}}",
      "الشحن: {{freight}}"
    ]
  },

  /* 10. 原产地证申请 */
  co: {
    zh: [
      "证书类型：{{coType}}",
      "出口商：{{seller}}",
      "收货人：{{buyer}}",
      "货物：{{product}}，{{qty}} {{unit}}",
      "原产地：中国"
    ],
    es: [
      "Tipo de certificado: {{coType}}",
      "Exportador: {{seller}}",
      "Consignatario: {{buyer}}",
      "Mercancía: {{product}}, {{qty}} {{unit}}",
      "Lugar de origen: China"
    ],
    fr: [
      "Type de certificat : {{coType}}",
      "Exportateur : {{seller}}",
      "Destinataire : {{buyer}}",
      "Marchandise : {{product}}, {{qty}} {{unit}}",
      "Lieu d'origine : Chine"
    ],
    de: [
      "Zertifikatstyp: {{coType}}",
      "Exporteur: {{seller}}",
      "Empfänger: {{buyer}}",
      "Ware: {{product}}, {{qty}} {{unit}}",
      "Ursprungsort: China"
    ],
    pt: [
      "Tipo de certificado: {{coType}}",
      "Exportador: {{seller}}",
      "Consignatário: {{buyer}}",
      "Mercadoria: {{product}}, {{qty}} {{unit}}",
      "Local de origem: China"
    ],
    ru: [
      "Тип сертификата: {{coType}}",
      "Экспортёр: {{seller}}",
      "Грузополучатель: {{buyer}}",
      "Товар: {{product}}, {{qty}} {{unit}}",
      "Страна происхождения: Китай"
    ],
    ar: [
      "نوع الشهادة: {{coType}}",
      "المُصدِّر: {{seller}}",
      "المرسل إليه: {{buyer}}",
      "البضاعة: {{product}}، {{qty}} {{unit}}",
      "مكان المنشأ: الصين"
    ]
  },

  /* 11. 保险投保单 */
  ins: {
    zh: [
      "投保金额：{{insAmount}}",
      "投保险别：{{coverage}}",
      "运输：自 {{portFrom}} 至 {{portTo}}，凭提单"
    ],
    es: [
      "Importe asegurado: {{insAmount}}",
      "Cobertura: {{coverage}}",
      "Transporte: de {{portFrom}} a {{portTo}} según B/L"
    ],
    fr: [
      "Montant assuré : {{insAmount}}",
      "Couverture : {{coverage}}",
      "Transport : de {{portFrom}} à {{portTo}} selon B/L"
    ],
    de: [
      "Versicherungssumme: {{insAmount}}",
      "Deckung: {{coverage}}",
      "Transport: von {{portFrom}} nach {{portTo}} laut B/L"
    ],
    pt: [
      "Valor segurado: {{insAmount}}",
      "Cobertura: {{coverage}}",
      "Transporte: de {{portFrom}} para {{portTo}} conforme B/L"
    ],
    ru: [
      "Застрахованная сумма: {{insAmount}}",
      "Страховое покрытие: {{coverage}}",
      "Перевозка: из {{portFrom}} в {{portTo}} согласно B/L"
    ],
    ar: [
      "المبلغ المؤمَّن: {{insAmount}}",
      "التغطية: {{coverage}}",
      "الشحن: من {{portFrom}} إلى {{portTo}} وفقًا لبوليصة الشحن"
    ]
  },

  /* 12. 信用证审单清单 */
  lccheck: {
    zh: [
      "信用证号：{{lcNo}}　金额：{{lcAmount}}",
      "最迟装运日：{{latestShip}}　交单截止：{{expiry}}",
      "清单：□ 商业发票　□ 装箱单　□ 提单　□ 原产地证　□ 保险单"
    ],
    es: [
      "N.º de L/C: {{lcNo}}  Importe: {{lcAmount}}",
      "Último embarque: {{latestShip}}  Vencimiento: {{expiry}}",
      "Lista: □ Factura comercial  □ Lista de empaque  □ B/L  □ CO  □ Seguro"
    ],
    fr: [
      "N° de L/C : {{lcNo}}  Montant : {{lcAmount}}",
      "Dernière expédition : {{latestShip}}  Échéance : {{expiry}}",
      "Liste : □ Facture commerciale  □ Liste de colisage  □ B/L  □ CO  □ Assurance"
    ],
    de: [
      "L/C-Nr.: {{lcNo}}  Betrag: {{lcAmount}}",
      "Letzte Verschiffung: {{latestShip}}  Verfall: {{expiry}}",
      "Checkliste: □ Handelsrechnung  □ Packliste  □ B/L  □ CO  □ Versicherung"
    ],
    pt: [
      "N.º da L/C: {{lcNo}}  Valor: {{lcAmount}}",
      "Último embarque: {{latestShip}}  Vencimento: {{expiry}}",
      "Lista: □ Fatura comercial  □ Lista de embalagem  □ B/L  □ CO  □ Seguro"
    ],
    ru: [
      "№ аккредитива (L/C): {{lcNo}}  Сумма: {{lcAmount}}",
      "Последняя отгрузка: {{latestShip}}  Срок действия: {{expiry}}",
      "Перечень: □ Коммерческий инвойс  □ Упаковочный лист  □ B/L  □ CO  □ Страховка"
    ],
    ar: [
      "رقم الاعتماد المستندي: {{lcNo}}  المبلغ: {{lcAmount}}",
      "آخر موعد للشحن: {{latestShip}}  تاريخ الانتهاء: {{expiry}}",
      "القائمة: □ فاتورة تجارية  □ قائمة تعبئة  □ بوليصة شحن  □ شهادة منشأ  □ تأمين"
    ]
  },

  /* 13. 付款水单登记 */
  tt: {
    zh: [
      "已于 {{paidDate}} 收到 {{paidAmount}}（水单号 {{bankSlip}}）",
      "余款：{{balance}}",
      "对应发票 {{no}}，总额 {{currency}} {{total}}"
    ],
    es: [
      "Recibido {{paidAmount}} el {{paidDate}} (comprobante {{bankSlip}})",
      "Saldo: {{balance}}",
      "Contra la factura {{no}}, total {{currency}} {{total}}"
    ],
    fr: [
      "Reçu {{paidAmount}} le {{paidDate}} (bordereau {{bankSlip}})",
      "Solde : {{balance}}",
      "Contre la facture {{no}}, total {{currency}} {{total}}"
    ],
    de: [
      "Erhalten: {{paidAmount}} am {{paidDate}} (Beleg {{bankSlip}})",
      "Restbetrag: {{balance}}",
      "Zur Rechnung {{no}}, Gesamtbetrag {{currency}} {{total}}"
    ],
    pt: [
      "Recebido {{paidAmount}} em {{paidDate}} (comprovante {{bankSlip}})",
      "Saldo: {{balance}}",
      "Referente à fatura {{no}}, total {{currency}} {{total}}"
    ],
    ru: [
      "Получено {{paidAmount}} {{paidDate}} (платёжное поручение {{bankSlip}})",
      "Остаток: {{balance}}",
      "По инвойсу {{no}}, всего {{currency}} {{total}}"
    ],
    ar: [
      "تم استلام {{paidAmount}} بتاريخ {{paidDate}} (إيصال رقم {{bankSlip}})",
      "الرصيد: {{balance}}",
      "مقابل الفاتورة {{no}}، الإجمالي {{currency}} {{total}}"
    ]
  },

  /* 14. 催款函 */
  coll: {
    zh: [
      "尊敬的 {{buyer}}：根据发票 {{no}}，{{currency}} {{total}} 的货款应于 {{dueDate}} 前支付。",
      "现已逾期 {{overdueDays}} 天。请立即安排付款，否则我们将{{nextAction}}。"
    ],
    es: [
      "Estimado {{buyer}}: según la factura {{no}}, el pago de {{currency}} {{total}} venció el {{dueDate}}.",
      "Ya han transcurrido {{overdueDays}} días de retraso. Le rogamos efectuar el pago de inmediato; en caso contrario, {{nextAction}}."
    ],
    fr: [
      "Cher {{buyer}}, selon la facture {{no}}, le paiement de {{currency}} {{total}} était dû le {{dueDate}}.",
      "Le retard est désormais de {{overdueDays}} jours. Nous vous prions de régler immédiatement, faute de quoi {{nextAction}}."
    ],
    de: [
      "Sehr geehrte(r) {{buyer}}, laut Rechnung {{no}} war die Zahlung von {{currency}} {{total}} am {{dueDate}} fällig.",
      "Der Rückstand beträgt inzwischen {{overdueDays}} Tage. Bitte veranlassen Sie umgehend die Zahlung, andernfalls {{nextAction}}."
    ],
    pt: [
      "Prezado(a) {{buyer}}, conforme a fatura {{no}}, o pagamento de {{currency}} {{total}} venceu em {{dueDate}}.",
      "Já se passaram {{overdueDays}} dias de atraso. Solicitamos o pagamento imediato; caso contrário, {{nextAction}}."
    ],
    ru: [
      "Уважаемый(ая) {{buyer}}! Согласно инвойсу {{no}} оплата {{currency}} {{total}} должна была быть произведена {{dueDate}}.",
      "Просрочка составляет {{overdueDays}} дней. Просим немедленно оплатить, в противном случае {{nextAction}}."
    ],
    ar: [
      "عزيزي {{buyer}}، وفقًا للفاتورة {{no}}، كان من المقرر سداد مبلغ {{currency}} {{total}} بتاريخ {{dueDate}}.",
      "مضى {{overdueDays}} يومًا على التأخير. نرجو ترتيب السداد فورًا، وإلا {{nextAction}}."
    ]
  },

  /* 15. 验货报告 */
  ir: {
    zh: [
      "验货日期：{{insDate}}　验货人：{{inspector}}",
      "抽检标准：AQL 2.5",
      "结果：{{result}}",
      "缺陷：{{defects}}"
    ],
    es: [
      "Fecha de inspección: {{insDate}}  Inspector: {{inspector}}",
      "Muestreo: AQL 2.5",
      "Resultado: {{result}}",
      "Defectos: {{defects}}"
    ],
    fr: [
      "Date d'inspection : {{insDate}}  Inspecteur : {{inspector}}",
      "Échantillonnage : AQL 2.5",
      "Résultat : {{result}}",
      "Défauts : {{defects}}"
    ],
    de: [
      "Prüfdatum: {{insDate}}  Prüfer: {{inspector}}",
      "Stichprobe: AQL 2.5",
      "Ergebnis: {{result}}",
      "Mängel: {{defects}}"
    ],
    pt: [
      "Data de inspeção: {{insDate}}  Inspetor: {{inspector}}",
      "Amostragem: AQL 2.5",
      "Resultado: {{result}}",
      "Defeitos: {{defects}}"
    ],
    ru: [
      "Дата инспекции: {{insDate}}  Инспектор: {{inspector}}",
      "Выборка: AQL 2.5",
      "Результат: {{result}}",
      "Дефекты: {{defects}}"
    ],
    ar: [
      "تاريخ الفحص: {{insDate}}  الفاحص: {{inspector}}",
      "العينة المفحوصة: AQL 2.5",
      "النتيجة: {{result}}",
      "العيوب: {{defects}}"
    ]
  },

  /* 16. 生产通知单 */
  po: {
    zh: [
      "生产 {{product}}，数量 {{qty}} {{unit}}",
      "物料要求：{{material}}",
      "计划完成日：{{pDate}}；交期：{{delivery}}"
    ],
    es: [
      "Producir {{product}}, cantidad {{qty}} {{unit}}",
      "Material: {{material}}",
      "Finalización prevista: {{pDate}}. Entrega: {{delivery}}"
    ],
    fr: [
      "Produire {{product}}, quantité {{qty}} {{unit}}",
      "Matériau : {{material}}",
      "Achèvement prévu : {{pDate}}. Livraison : {{delivery}}"
    ],
    de: [
      "Produktion von {{product}}, Menge {{qty}} {{unit}}",
      "Material: {{material}}",
      "Geplante Fertigstellung: {{pDate}}. Lieferung: {{delivery}}"
    ],
    pt: [
      "Produzir {{product}}, quantidade {{qty}} {{unit}}",
      "Material: {{material}}",
      "Conclusão prevista: {{pDate}}. Entrega: {{delivery}}"
    ],
    ru: [
      "Произвести {{product}}, количество {{qty}} {{unit}}",
      "Материал: {{material}}",
      "Плановое завершение: {{pDate}}. Поставка: {{delivery}}"
    ],
    ar: [
      "إنتاج {{product}}، الكمية {{qty}} {{unit}}",
      "المادة: {{material}}",
      "موعد الإنجاز المخطط: {{pDate}}. التسليم: {{delivery}}"
    ]
  },

  /* 17. 售后处理单 */
  as: {
    zh: [
      "问题：{{issue}}（数量：{{qty}}）",
      "处理方案：{{solution}}",
      "状态：{{closed}}"
    ],
    es: [
      "Incidencia: {{issue}} (Cantidad: {{qty}})",
      "Solución: {{solution}}",
      "Estado: {{closed}}"
    ],
    fr: [
      "Problème : {{issue}} (Quantité : {{qty}})",
      "Solution : {{solution}}",
      "Statut : {{closed}}"
    ],
    de: [
      "Problem: {{issue}} (Menge: {{qty}})",
      "Lösung: {{solution}}",
      "Status: {{closed}}"
    ],
    pt: [
      "Ocorrência: {{issue}} (Quantidade: {{qty}})",
      "Solução: {{solution}}",
      "Situação: {{closed}}"
    ],
    ru: [
      "Проблема: {{issue}} (Количество: {{qty}})",
      "Решение: {{solution}}",
      "Статус: {{closed}}"
    ],
    ar: [
      "المشكلة: {{issue}} (الكمية: {{qty}})",
      "الحل: {{solution}}",
      "الحالة: {{closed}}"
    ]
  },

  /* 18. 保密协议 */
  nda: {
    zh: [
      "双方同意对 {{scope}} 严格保密。",
      "保密期限：{{term}}。适用中华人民共和国法律。"
    ],
    es: [
      "Ambas partes se comprometen a mantener {{scope}} estrictamente confidencial.",
      "Plazo: {{term}}. Regido por las leyes de la República Popular China."
    ],
    fr: [
      "Les deux parties s'engagent à garder {{scope}} strictement confidentiels.",
      "Durée : {{term}}. Régi par les lois de la République populaire de Chine."
    ],
    de: [
      "Beide Parteien verpflichten sich, {{scope}} streng vertraulich zu behandeln.",
      "Laufzeit: {{term}}. Es gilt das Recht der Volksrepublik China."
    ],
    pt: [
      "Ambas as partes concordam em manter {{scope}} estritamente confidencial.",
      "Prazo: {{term}}. Regido pelas leis da República Popular da China."
    ],
    ru: [
      "Стороны обязуются сохранять {{scope}} в строгой конфиденциальности.",
      "Срок: {{term}}. Применяется право Китайской Народной Республики."
    ],
    ar: [
      "يتفق الطرفان على الحفاظ على {{scope}} بسرية تامة.",
      "المدة: {{term}}. يخضع لأحكام قوانين جمهورية الصين الشعبية."
    ]
  },

  /* 19. 佣金协议 */
  ca: {
    zh: [
      "代理方：{{agent}}",
      "佣金：发票金额的 {{rate}}",
      "结算：{{settle}}"
    ],
    es: [
      "Agente: {{agent}}",
      "Comisión: {{rate}} del valor de la factura",
      "Liquidación: {{settle}}"
    ],
    fr: [
      "Agent : {{agent}}",
      "Commission : {{rate}} de la valeur de la facture",
      "Règlement : {{settle}}"
    ],
    de: [
      "Vertreter: {{agent}}",
      "Provision: {{rate}} des Rechnungswerts",
      "Abrechnung: {{settle}}"
    ],
    pt: [
      "Agente: {{agent}}",
      "Comissão: {{rate}} do valor da fatura",
      "Liquidação: {{settle}}"
    ],
    ru: [
      "Агент: {{agent}}",
      "Комиссия: {{rate}} от суммы инвойса",
      "Расчёты: {{settle}}"
    ],
    ar: [
      "الوكيل: {{agent}}",
      "العمولة: {{rate}} من قيمة الفاتورة",
      "التسوية: {{settle}}"
    ]
  },

  /* 20. 年度合作备忘 */
  mou: {
    zh: [
      "由 {{seller}} 与 {{buyer}} 签订",
      "年度目标：{{target}}",
      "价格政策：{{pricePolicy}}",
      "复盘节奏：{{review}}"
    ],
    es: [
      "Entre {{seller}} y {{buyer}}",
      "Objetivo anual: {{target}}",
      "Política de precios: {{pricePolicy}}",
      "Revisión: {{review}}"
    ],
    fr: [
      "Entre {{seller}} et {{buyer}}",
      "Objectif annuel : {{target}}",
      "Politique de prix : {{pricePolicy}}",
      "Révision : {{review}}"
    ],
    de: [
      "Zwischen {{seller}} und {{buyer}}",
      "Jahresziel: {{target}}",
      "Preispolitik: {{pricePolicy}}",
      "Überprüfung: {{review}}"
    ],
    pt: [
      "Entre {{seller}} e {{buyer}}",
      "Meta anual: {{target}}",
      "Política de preços: {{pricePolicy}}",
      "Revisão: {{review}}"
    ],
    ru: [
      "Между {{seller}} и {{buyer}}",
      "Годовая цель: {{target}}",
      "Ценовая политика: {{pricePolicy}}",
      "Пересмотр: {{review}}"
    ],
    ar: [
      "بين {{seller}} و{{buyer}}",
      "الهدف السنوي: {{target}}",
      "سياسة الأسعار: {{pricePolicy}}",
      "المراجعة: {{review}}"
    ]
  }

};
