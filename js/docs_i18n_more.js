/* ============================================================
   FT Compass · 单证正文多语言 v1.1（第二批）
   覆盖：it / nl / pl / tr / vi / id / th / ja / ko
   合并进 js/docs_i18n.js 的 DOC_NOTES，加载顺序：docs_i18n.js → 本文件
   ============================================================ */
(function (global) {
  'use strict';

  var MORE = {

    quotation: {
      it: [
        "Base di prezzo: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Pagamento: {{payment}}",
        "Consegna: {{delivery}}",
        "Validità: {{valid}}"
      ],
      nl: [
        "Prijsbasis: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Betaling: {{payment}}",
        "Levering: {{delivery}}",
        "Geldigheid: {{valid}}"
      ],
      pl: [
        "Podstawa ceny: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Płatność: {{payment}}",
        "Dostawa: {{delivery}}",
        "Ważność: {{valid}}"
      ],
      tr: [
        "Fiyat esası: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Ödeme: {{payment}}",
        "Teslimat: {{delivery}}",
        "Geçerlilik: {{valid}}"
      ],
      vi: [
        "Cơ sở giá: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Thanh toán: {{payment}}",
        "Giao hàng: {{delivery}}",
        "Hiệu lực: {{valid}}"
      ],
      id: [
        "Dasar harga: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "Pembayaran: {{payment}}",
        "Pengiriman: {{delivery}}",
        "Masa berlaku: {{valid}}"
      ],
      th: [
        "เกณฑ์ราคา: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "การชำระเงิน: {{payment}}",
        "การจัดส่ง: {{delivery}}",
        "อายุใบเสนอราคา: {{valid}}"
      ],
      ja: [
        "価格条件：{{currency}} {{price}}/{{unit}}、FOB {{portFrom}}",
        "支払条件：{{payment}}",
        "納期：{{delivery}}",
        "有効期限：{{valid}}"
      ],
      ko: [
        "가격 조건: {{currency}} {{price}}/{{unit}}, FOB {{portFrom}}",
        "결제 조건: {{payment}}",
        "납기: {{delivery}}",
        "유효 기간: {{valid}}"
      ]
    },

    sc: {
      it: [
        "Il presente contratto è stipulato tra {{seller}} (Venditore) e {{buyer}} (Acquirente).",
        "Qualità: {{quality}}",
        "Pagamento: {{payment}}",
        "Consegna: {{delivery}} da {{portFrom}} a {{portTo}}",
        "Reclami: {{claim}}"
      ],
      nl: [
        "Deze overeenkomst wordt gesloten tussen {{seller}} (Verkoper) en {{buyer}} (Koper).",
        "Kwaliteit: {{quality}}",
        "Betaling: {{payment}}",
        "Levering: {{delivery}} van {{portFrom}} naar {{portTo}}",
        "Claims: {{claim}}"
      ],
      pl: [
        "Niniejsza umowa zostaje zawarta między {{seller}} (Sprzedający) a {{buyer}} (Kupujący).",
        "Jakość: {{quality}}",
        "Płatność: {{payment}}",
        "Dostawa: {{delivery}} z {{portFrom}} do {{portTo}}",
        "Reklamacje: {{claim}}"
      ],
      tr: [
        "İşbu sözleşme {{seller}} (Satıcı) ile {{buyer}} (Alıcı) arasında akdedilmiştir.",
        "Kalite: {{quality}}",
        "Ödeme: {{payment}}",
        "Teslimat: {{portFrom}} limanından {{portTo}} limanına {{delivery}}",
        "Talepler: {{claim}}"
      ],
      vi: [
        "Hợp đồng này được ký kết giữa {{seller}} (Bên bán) và {{buyer}} (Bên mua).",
        "Chất lượng: {{quality}}",
        "Thanh toán: {{payment}}",
        "Giao hàng: {{delivery}} từ {{portFrom}} đến {{portTo}}",
        "Khiếu nại: {{claim}}"
      ],
      id: [
        "Kontrak ini dibuat antara {{seller}} (Penjual) dan {{buyer}} (Pembeli).",
        "Kualitas: {{quality}}",
        "Pembayaran: {{payment}}",
        "Pengiriman: {{delivery}} dari {{portFrom}} ke {{portTo}}",
        "Klaim: {{claim}}"
      ],
      th: [
        "สัญญาฉบับนี้ทำขึ้นระหว่าง {{seller}} (ผู้ขาย) และ {{buyer}} (ผู้ซื้อ)",
        "คุณภาพ: {{quality}}",
        "การชำระเงิน: {{payment}}",
        "การจัดส่ง: {{delivery}} จาก {{portFrom}} ถึง {{portTo}}",
        "การเรียกร้อง: {{claim}}"
      ],
      ja: [
        "本契約は {{seller}}（売主）と {{buyer}}（買主）との間で締結する。",
        "品質：{{quality}}",
        "支払：{{payment}}",
        "納期：{{delivery}}（{{portFrom}} から {{portTo}} まで）",
        "クレーム：{{claim}}"
      ],
      ko: [
        "본 계약은 {{seller}}(매도인)와 {{buyer}}(매수인) 간에 체결됩니다.",
        "품질: {{quality}}",
        "결제: {{payment}}",
        "납기: {{delivery}} ({{portFrom}}에서 {{portTo}}까지)",
        "클레임: {{claim}}"
      ]
    },

    pi: {
      it: [
        "Fattura proforma n. {{no}} del {{date}}",
        "Pagamento: {{payment}}",
        "Consegna: {{delivery}}",
        "La presente fattura proforma è valida per {{valid}} e soggetta a conferma finale."
      ],
      nl: [
        "Proforma-factuur nr. {{no}} van {{date}}",
        "Betaling: {{payment}}",
        "Levering: {{delivery}}",
        "Deze proformafactuur is {{valid}} geldig en onder voorbehoud van definitieve bevestiging."
      ],
      pl: [
        "Faktura proforma nr {{no}} z dnia {{date}}",
        "Płatność: {{payment}}",
        "Dostawa: {{delivery}}",
        "Niniejsza faktura proforma jest ważna przez {{valid}} i podlega ostatecznemu potwierdzeniu."
      ],
      tr: [
        "{{date}} tarihli {{no}} numaralı proforma fatura",
        "Ödeme: {{payment}}",
        "Teslimat: {{delivery}}",
        "Bu proforma fatura {{valid}} süreyle geçerlidir ve nihai onaya tabidir."
      ],
      vi: [
        "Hóa đơn chiếu lệ số {{no}} ngày {{date}}",
        "Thanh toán: {{payment}}",
        "Giao hàng: {{delivery}}",
        "Hóa đơn chiếu lệ này có hiệu lực {{valid}} và phụ thuộc vào xác nhận cuối cùng."
      ],
      id: [
        "Faktur proforma No. {{no}} tanggal {{date}}",
        "Pembayaran: {{payment}}",
        "Pengiriman: {{delivery}}",
        "Faktur proforma ini berlaku selama {{valid}} dan tunduk pada konfirmasi akhir."
      ],
      th: [
        "ใบแจ้งหนี้ชั่วคราวเลขที่ {{no}} ลงวันที่ {{date}}",
        "การชำระเงิน: {{payment}}",
        "การจัดส่ง: {{delivery}}",
        "ใบแจ้งหนี้ชั่วคราวนี้มีอายุ {{valid}} และขึ้นอยู่กับการยืนยันขั้นสุดท้าย"
      ],
      ja: [
        "形式請求書（プロフォーマ）番号 {{no}}、日付 {{date}}",
        "支払：{{payment}}",
        "納期：{{delivery}}",
        "本プロフォーマは {{valid}} 有効であり、最終確認を条件とする。"
      ],
      ko: [
        "견적송장(프로포마) 번호 {{no}}, 날짜 {{date}}",
        "결제: {{payment}}",
        "납기: {{delivery}}",
        "본 프로포마 인보이스는 {{valid}} 동안 유효하며 최종 확인을 조건으로 합니다."
      ]
    },

    oc: {
      it: [
        "Con la presente confermiamo l'ordine secondo il PO dell'acquirente {{poNo}}.",
        "Prodotto e quantità come da tabella sottostante.",
        "Pagamento: {{payment}}",
        "Consegna: {{delivery}}"
      ],
      nl: [
        "Hierbij bevestigen wij de bestelling conform de inkooporder van de koper {{poNo}}.",
        "Product en hoeveelheid volgens onderstaande tabel.",
        "Betaling: {{payment}}",
        "Levering: {{delivery}}"
      ],
      pl: [
        "Niniejszym potwierdzamy zamówienie zgodnie z zamówieniem kupującego nr {{poNo}}.",
        "Produkt i ilość zgodnie z poniższą tabelą.",
        "Płatność: {{payment}}",
        "Dostawa: {{delivery}}"
      ],
      tr: [
        "Alıcının {{poNo}} numaralı siparişine istinaden siparişi işbu belgeyle teyit ederiz.",
        "Ürün ve miktar aşağıdaki tabloya göredir.",
        "Ödeme: {{payment}}",
        "Teslimat: {{delivery}}"
      ],
      vi: [
        "Chúng tôi xác nhận đơn hàng theo PO số {{poNo}} của người mua.",
        "Sản phẩm và số lượng theo bảng dưới đây.",
        "Thanh toán: {{payment}}",
        "Giao hàng: {{delivery}}"
      ],
      id: [
        "Dengan ini kami mengonfirmasi pesanan sesuai PO Pembeli No. {{poNo}}.",
        "Produk dan jumlah sesuai tabel di bawah.",
        "Pembayaran: {{payment}}",
        "Pengiriman: {{delivery}}"
      ],
      th: [
        "ขอยืนยันคำสั่งซื้อตามใบสั่งซื้อของผู้ซื้อเลขที่ {{poNo}}",
        "สินค้าและจำนวนตามตารางด้านล่าง",
        "การชำระเงิน: {{payment}}",
        "การจัดส่ง: {{delivery}}"
      ],
      ja: [
        "買主発注書 {{poNo}} に基づく注文をここに確認する。",
        "製品および数量は下表のとおり。",
        "支払：{{payment}}",
        "納期：{{delivery}}"
      ],
      ko: [
        "구매자 발주서 {{poNo}}에 따른 주문을 이에 확인합니다.",
        "제품 및 수량은 아래 표와 같습니다.",
        "결제: {{payment}}",
        "납기: {{delivery}}"
      ]
    },

    si: {
      it: [
        "Costo campione: {{sampleFee}} ({{deduct}})",
        "Corriere: {{courier}}",
        "Consegna stimata: 5-7 giorni lavorativi dopo il pagamento."
      ],
      nl: [
        "Monsterkosten: {{sampleFee}} ({{deduct}})",
        "Koerier: {{courier}}",
        "Verwachte levering: 5-7 werkdagen na betaling."
      ],
      pl: [
        "Opłata za próbkę: {{sampleFee}} ({{deduct}})",
        "Kurier: {{courier}}",
        "Przewidywana dostawa: 5–7 dni roboczych po płatności."
      ],
      tr: [
        "Numune ücreti: {{sampleFee}} ({{deduct}})",
        "Kurye: {{courier}}",
        "Tahmini teslimat: ödemeden sonra 5-7 iş günü."
      ],
      vi: [
        "Phí mẫu: {{sampleFee}} ({{deduct}})",
        "Đơn vị vận chuyển: {{courier}}",
        "Dự kiến giao: 5-7 ngày làm việc sau khi thanh toán."
      ],
      id: [
        "Biaya sampel: {{sampleFee}} ({{deduct}})",
        "Kurir: {{courier}}",
        "Perkiraan pengiriman: 5-7 hari kerja setelah pembayaran."
      ],
      th: [
        "ค่าตัวอย่าง: {{sampleFee}} ({{deduct}})",
        "บริษัทขนส่ง: {{courier}}",
        "กำหนดส่งโดยประมาณ: 5-7 วันทำการหลังชำระเงิน"
      ],
      ja: [
        "サンプル代：{{sampleFee}}（{{deduct}}）",
        "配送業者：{{courier}}",
        "お届け目安：入金後 5〜7 営業日"
      ],
      ko: [
        "샘플 비용: {{sampleFee}} ({{deduct}})",
        "택배사: {{courier}}",
        "예상 배송: 결제 후 5~7영업일"
      ]
    },

    ci: {
      it: [
        "Fattura di {{product}}",
        "Codice HS: {{hsCode}}",
        "Spedizione da {{portFrom}} a {{portTo}}",
        "Pagamento: {{payment}}"
      ],
      nl: [
        "Factuur van {{product}}",
        "HS-code: {{hsCode}}",
        "Verzending van {{portFrom}} naar {{portTo}}",
        "Betaling: {{payment}}"
      ],
      pl: [
        "Faktura na {{product}}",
        "Kod HS: {{hsCode}}",
        "Wysyłka z {{portFrom}} do {{portTo}}",
        "Płatność: {{payment}}"
      ],
      tr: [
        "{{product}} faturası",
        "HS Kodu: {{hsCode}}",
        "{{portFrom}} limanından {{portTo}} limanına sevkiyat",
        "Ödeme: {{payment}}"
      ],
      vi: [
        "Hóa đơn {{product}}",
        "Mã HS: {{hsCode}}",
        "Vận chuyển từ {{portFrom}} đến {{portTo}}",
        "Thanh toán: {{payment}}"
      ],
      id: [
        "Faktur {{product}}",
        "Kode HS: {{hsCode}}",
        "Pengiriman dari {{portFrom}} ke {{portTo}}",
        "Pembayaran: {{payment}}"
      ],
      th: [
        "ใบแจ้งหนี้สินค้า {{product}}",
        "รหัส HS: {{hsCode}}",
        "การขนส่งจาก {{portFrom}} ถึง {{portTo}}",
        "การชำระเงิน: {{payment}}"
      ],
      ja: [
        "{{product}} の請求書",
        "HS コード：{{hsCode}}",
        "{{portFrom}} から {{portTo}} への出荷",
        "支払：{{payment}}"
      ],
      ko: [
        "{{product}} 인보이스",
        "HS 코드: {{hsCode}}",
        "{{portFrom}}에서 {{portTo}}까지 운송",
        "결제: {{payment}}"
      ]
    },

    pl: {
      it: [
        "{{ctns}} cartoni di {{product}}",
        "Peso lordo: {{gw}} kg  Peso netto: {{nw}} kg  Volume: {{meas}} CBM",
        "Marchio di spedizione: {{mark}}"
      ],
      nl: [
        "{{ctns}} dozen van {{product}}",
        "Brutogewicht: {{gw}} kg  Nettogewicht: {{nw}} kg  Volume: {{meas}} CBM",
        "Verzendmerk: {{mark}}"
      ],
      pl: [
        "{{ctns}} kartonów {{product}}",
        "Waga brutto: {{gw}} kg  Waga netto: {{nw}} kg  Objętość: {{meas}} CBM",
        "Znak wysyłkowy: {{mark}}"
      ],
      tr: [
        "{{ctns}} koli {{product}}",
        "Brüt ağırlık: {{gw}} kg  Net ağırlık: {{nw}} kg  Hacim: {{meas}} CBM",
        "Sevkiyat işareti: {{mark}}"
      ],
      vi: [
        "{{ctns}} thùng {{product}}",
        "Trọng lượng cả bì: {{gw}} kg  Trọng lượng tịnh: {{nw}} kg  Thể tích: {{meas}} CBM",
        "Nhãn hiệu vận chuyển: {{mark}}"
      ],
      id: [
        "{{ctns}} karton {{product}}",
        "Berat kotor: {{gw}} kg  Berat bersih: {{nw}} kg  Volume: {{meas}} CBM",
        "Tanda pengiriman: {{mark}}"
      ],
      th: [
        "{{product}} จำนวน {{ctns}} กล่อง",
        "น้ำหนักรวม: {{gw}} กก.  น้ำหนักสุทธิ: {{nw}} กก.  ปริมาตร: {{meas}} CBM",
        "เครื่องหมายการขนส่ง: {{mark}}"
      ],
      ja: [
        "{{product}} {{ctns}} カートン",
        "総重量：{{gw}} kg　正味重量：{{nw}} kg　容積：{{meas}} CBM",
        "荷印：{{mark}}"
      ],
      ko: [
        "{{product}} {{ctns}}카톤",
        "총중량: {{gw}} kg  순중량: {{nw}} kg  용적: {{meas}} CBM",
        "화인(Shipping Mark): {{mark}}"
      ]
    },

    sa: {
      it: [
        "Gentile {{buyer}}, vi informiamo che la merce è stata spedita.",
        "Nave: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "N. B/L: {{blNo}}",
        "I documenti saranno inviati dopo il ricevimento del pagamento integrale."
      ],
      nl: [
        "Beste {{buyer}}, wij informeren u dat de goederen zijn verscheept.",
        "Schip: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "B/L-nr.: {{blNo}}",
        "De documenten worden na ontvangst van de volledige betaling verzonden."
      ],
      pl: [
        "Szanowni {{buyer}}, informujemy, że towar został wysłany.",
        "Statek: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "Nr B/L: {{blNo}}",
        "Dokumenty zostaną przesłane po otrzymaniu pełnej płatności."
      ],
      tr: [
        "Sayın {{buyer}}, malların sevk edildiğini bildiririz.",
        "Gemi: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "B/L No.: {{blNo}}",
        "Belgeler tam ödeme alındıktan sonra gönderilecektir."
      ],
      vi: [
        "Kính gửi {{buyer}}, chúng tôi xin thông báo hàng hóa đã được gửi đi.",
        "Tàu: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "Số B/L: {{blNo}}",
        "Chứng từ sẽ được gửi sau khi nhận đủ thanh toán."
      ],
      id: [
        "Yth. {{buyer}}, kami informasikan bahwa barang telah dikirim.",
        "Kapal: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "No. B/L: {{blNo}}",
        "Dokumen akan dikirim setelah pembayaran penuh diterima."
      ],
      th: [
        "เรียน {{buyer}} ขอแจ้งว่าสินค้าได้ถูกจัดส่งแล้ว",
        "เรือ: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "เลขที่ B/L: {{blNo}}",
        "เอกสารจะถูกส่งหลังจากได้รับชำระเงินเต็มจำนวน"
      ],
      ja: [
        "{{buyer}} 様、商品を出荷いたしましたのでご連絡申し上げます。",
        "船名：{{vessel}}　ETD：{{etd}}　ETA：{{eta}}",
        "B/L No.：{{blNo}}",
        "全額入金後に書類を送付いたします。"
      ],
      ko: [
        "{{buyer}} 귀하, 상품이 선적되었음을 알려드립니다.",
        "선박: {{vessel}}  ETD: {{etd}}  ETA: {{eta}}",
        "B/L 번호: {{blNo}}",
        "전액 결제 수령 후 서류를 발송합니다."
      ]
    },

    bli: {
      it: [
        "Destinatario: {{consignee}}",
        "Parte da notificare: {{notify}}",
        "Porto di carico: {{portFrom}}  Porto di scarico: {{portTo}}",
        "Nolo: {{freight}}"
      ],
      nl: [
        "Geadresseerde: {{consignee}}",
        "Te notificeren partij: {{notify}}",
        "Laadhaven: {{portFrom}}  Loshaven: {{portTo}}",
        "Vracht: {{freight}}"
      ],
      pl: [
        "Odbiorca: {{consignee}}",
        "Strona do powiadomienia: {{notify}}",
        "Port załadunku: {{portFrom}}  Port wyładunku: {{portTo}}",
        "Fracht: {{freight}}"
      ],
      tr: [
        "Alıcı: {{consignee}}",
        "Bildirilecek taraf: {{notify}}",
        "Yükleme limanı: {{portFrom}}  Tahliye limanı: {{portTo}}",
        "Navlun: {{freight}}"
      ],
      vi: [
        "Người nhận hàng: {{consignee}}",
        "Bên được thông báo: {{notify}}",
        "Cảng xếp hàng: {{portFrom}}  Cảng dỡ hàng: {{portTo}}",
        "Cước vận chuyển: {{freight}}"
      ],
      id: [
        "Penerima: {{consignee}}",
        "Pihak yang diberitahu: {{notify}}",
        "Pelabuhan muat: {{portFrom}}  Pelabuhan bongkar: {{portTo}}",
        "Freight: {{freight}}"
      ],
      th: [
        "ผู้รับสินค้า: {{consignee}}",
        "ผู้ที่ต้องแจ้ง: {{notify}}",
        "ท่าเรือต้นทาง: {{portFrom}}  ท่าเรือปลายทาง: {{portTo}}",
        "ค่าขนส่ง: {{freight}}"
      ],
      ja: [
        "荷受人：{{consignee}}",
        "通知先：{{notify}}",
        "積出港：{{portFrom}}　仕向港：{{portTo}}",
        "運賃：{{freight}}"
      ],
      ko: [
        "수하인: {{consignee}}",
        "통지처: {{notify}}",
        "선적항: {{portFrom}}  도착항: {{portTo}}",
        "운임: {{freight}}"
      ]
    },

    co: {
      it: [
        "Tipo di certificato: {{coType}}",
        "Esportatore: {{seller}}",
        "Destinatario: {{buyer}}",
        "Merce: {{product}}, {{qty}} {{unit}}",
        "Luogo di origine: Cina"
      ],
      nl: [
        "Certificaattype: {{coType}}",
        "Exporteur: {{seller}}",
        "Geadresseerde: {{buyer}}",
        "Goederen: {{product}}, {{qty}} {{unit}}",
        "Land van oorsprong: China"
      ],
      pl: [
        "Rodzaj certyfikatu: {{coType}}",
        "Eksporter: {{seller}}",
        "Odbiorca: {{buyer}}",
        "Towar: {{product}}, {{qty}} {{unit}}",
        "Kraj pochodzenia: Chiny"
      ],
      tr: [
        "Belge türü: {{coType}}",
        "İhracatçı: {{seller}}",
        "Alıcı: {{buyer}}",
        "Eşya: {{product}}, {{qty}} {{unit}}",
        "Menşe ülke: Çin"
      ],
      vi: [
        "Loại chứng từ: {{coType}}",
        "Nhà xuất khẩu: {{seller}}",
        "Người nhận hàng: {{buyer}}",
        "Hàng hóa: {{product}}, {{qty}} {{unit}}",
        "Xuất xứ: Trung Quốc"
      ],
      id: [
        "Jenis sertifikat: {{coType}}",
        "Eksportir: {{seller}}",
        "Penerima: {{buyer}}",
        "Barang: {{product}}, {{qty}} {{unit}}",
        "Negara asal: Tiongkok"
      ],
      th: [
        "ประเภทหนังสือรับรอง: {{coType}}",
        "ผู้ส่งออก: {{seller}}",
        "ผู้รับสินค้า: {{buyer}}",
        "สินค้า: {{product}}, {{qty}} {{unit}}",
        "แหล่งกำเนิด: จีน"
      ],
      ja: [
        "証明書の種類：{{coType}}",
        "輸出者：{{seller}}",
        "荷受人：{{buyer}}",
        "商品：{{product}}、{{qty}} {{unit}}",
        "原産地：中国"
      ],
      ko: [
        "증명서 종류: {{coType}}",
        "수출자: {{seller}}",
        "수하인: {{buyer}}",
        "상품: {{product}}, {{qty}} {{unit}}",
        "원산지: 중국"
      ]
    },

    ins: {
      it: [
        "Importo assicurato: {{insAmount}}",
        "Copertura: {{coverage}}",
        "Trasporto: da {{portFrom}} a {{portTo}} secondo B/L"
      ],
      nl: [
        "Verzekerd bedrag: {{insAmount}}",
        "Dekking: {{coverage}}",
        "Transport: van {{portFrom}} naar {{portTo}} volgens B/L"
      ],
      pl: [
        "Suma ubezpieczenia: {{insAmount}}",
        "Zakres: {{coverage}}",
        "Transport: z {{portFrom}} do {{portTo}} zgodnie z B/L"
      ],
      tr: [
        "Sigorta bedeli: {{insAmount}}",
        "Teminat: {{coverage}}",
        "Taşıma: {{portFrom}} - {{portTo}}, B/L'ye göre"
      ],
      vi: [
        "Số tiền bảo hiểm: {{insAmount}}",
        "Phạm vi bảo hiểm: {{coverage}}",
        "Vận chuyển: từ {{portFrom}} đến {{portTo}} theo B/L"
      ],
      id: [
        "Nilai pertanggungan: {{insAmount}}",
        "Cakupan: {{coverage}}",
        "Pengiriman: dari {{portFrom}} ke {{portTo}} sesuai B/L"
      ],
      th: [
        "จำนวนเงินเอาประกัน: {{insAmount}}",
        "ความคุ้มครอง: {{coverage}}",
        "การขนส่ง: จาก {{portFrom}} ถึง {{portTo}} ตาม B/L"
      ],
      ja: [
        "保険金額：{{insAmount}}",
        "担保範囲：{{coverage}}",
        "輸送：{{portFrom}} から {{portTo}} まで（B/L による）"
      ],
      ko: [
        "보험 금액: {{insAmount}}",
        "보상 범위: {{coverage}}",
        "운송: {{portFrom}}에서 {{portTo}}까지 (B/L 기준)"
      ]
    },

    lccheck: {
      it: [
        "N. L/C: {{lcNo}}  Importo: {{lcAmount}}",
        "Ultima spedizione: {{latestShip}}  Scadenza: {{expiry}}",
        "Elenco: □ Fattura commerciale  □ Packing list  □ B/L  □ CO  □ Assicurazione"
      ],
      nl: [
        "L/C-nr.: {{lcNo}}  Bedrag: {{lcAmount}}",
        "Laatste verscheping: {{latestShip}}  Vervaldatum: {{expiry}}",
        "Checklist: □ Handelsfactuur  □ Paklijst  □ B/L  □ CO  □ Verzekering"
      ],
      pl: [
        "Nr L/C: {{lcNo}}  Kwota: {{lcAmount}}",
        "Ostatnia wysyłka: {{latestShip}}  Termin ważności: {{expiry}}",
        "Lista: □ Faktura handlowa  □ Lista pakowa  □ B/L  □ CO  □ Ubezpieczenie"
      ],
      tr: [
        "L/C No.: {{lcNo}}  Tutar: {{lcAmount}}",
        "Son sevkiyat: {{latestShip}}  Geçerlilik sonu: {{expiry}}",
        "Liste: □ Ticari fatura  □ Çeki listesi  □ B/L  □ CO  □ Sigorta"
      ],
      vi: [
        "Số L/C: {{lcNo}}  Số tiền: {{lcAmount}}",
        "Lô hàng cuối: {{latestShip}}  Hết hạn: {{expiry}}",
        "Danh mục: □ Hóa đơn thương mại  □ Phiếu đóng gói  □ B/L  □ CO  □ Bảo hiểm"
      ],
      id: [
        "No. L/C: {{lcNo}}  Jumlah: {{lcAmount}}",
        "Pengiriman terakhir: {{latestShip}}  Jatuh tempo: {{expiry}}",
        "Daftar: □ Faktur komersial  □ Daftar kemasan  □ B/L  □ CO  □ Asuransi"
      ],
      th: [
        "เลขที่ L/C: {{lcNo}}  จำนวนเงิน: {{lcAmount}}",
        "การจัดส่งครั้งสุดท้าย: {{latestShip}}  วันหมดอายุ: {{expiry}}",
        "รายการ: □ ใบแจ้งหนี้การค้า  □ ใบรายการบรรจุ  □ B/L  □ CO  □ ประกันภัย"
      ],
      ja: [
        "L/C No.：{{lcNo}}　金額：{{lcAmount}}",
        "最終船積日：{{latestShip}}　有効期限：{{expiry}}",
        "チェックリスト：□ 商業請求書　□ パッキングリスト　□ B/L　□ CO　□ 保険"
      ],
      ko: [
        "L/C 번호: {{lcNo}}  금액: {{lcAmount}}",
        "최종 선적일: {{latestShip}}  만기일: {{expiry}}",
        "체크리스트: □ 상업송장  □ 포장명세서  □ B/L  □ CO  □ 보험"
      ]
    },

    tt: {
      it: [
        "Ricevuto {{paidAmount}} il {{paidDate}} (distinta {{bankSlip}})",
        "Saldo: {{balance}}",
        "A fronte della fattura {{no}}, totale {{currency}} {{total}}"
      ],
      nl: [
        "Ontvangen {{paidAmount}} op {{paidDate}} (stuk {{bankSlip}})",
        "Restbedrag: {{balance}}",
        "Tegen factuur {{no}}, totaal {{currency}} {{total}}"
      ],
      pl: [
        "Otrzymano {{paidAmount}} w dniu {{paidDate}} (dowód {{bankSlip}})",
        "Saldo: {{balance}}",
        "Do faktury {{no}}, razem {{currency}} {{total}}"
      ],
      tr: [
        "{{paidDate}} tarihinde {{paidAmount}} alındı (dekont {{bankSlip}})",
        "Bakiye: {{balance}}",
        "{{no}} numaralı fatura karşılığı, toplam {{currency}} {{total}}"
      ],
      vi: [
        "Đã nhận {{paidAmount}} ngày {{paidDate}} (ủy nhiệm chi {{bankSlip}})",
        "Số dư: {{balance}}",
        "Theo hóa đơn {{no}}, tổng {{currency}} {{total}}"
      ],
      id: [
        "Diterima {{paidAmount}} pada {{paidDate}} (bukti {{bankSlip}})",
        "Sisa: {{balance}}",
        "Untuk faktur {{no}}, total {{currency}} {{total}}"
      ],
      th: [
        "ได้รับ {{paidAmount}} เมื่อ {{paidDate}} (สลิป {{bankSlip}})",
        "ยอดคงเหลือ: {{balance}}",
        "ตามใบแจ้งหนี้ {{no}} รวม {{currency}} {{total}}"
      ],
      ja: [
        "{{paidDate}} に入金 {{paidAmount}}（振込明細 {{bankSlip}}）",
        "残高：{{balance}}",
        "請求書 {{no}} 分、合計 {{currency}} {{total}}"
      ],
      ko: [
        "{{paidDate}}에 {{paidAmount}} 입금 확인 (송금명세 {{bankSlip}})",
        "잔액: {{balance}}",
        "인보이스 {{no}} 건, 합계 {{currency}} {{total}}"
      ]
    },

    coll: {
      it: [
        "Gentile {{buyer}}, secondo la fattura {{no}}, il pagamento di {{currency}} {{total}} era dovuto entro il {{dueDate}}.",
        "Il ritardo è ora di {{overdueDays}} giorni. Vi preghiamo di provvedere immediatamente; in caso contrario, {{nextAction}}."
      ],
      nl: [
        "Beste {{buyer}}, volgens factuur {{no}} was de betaling van {{currency}} {{total}} verschuldigd op {{dueDate}}.",
        "De achterstand bedraagt nu {{overdueDays}} dagen. Wij verzoeken u dringend om betaling; anders {{nextAction}}."
      ],
      pl: [
        "Szanowni {{buyer}}, zgodnie z fakturą {{no}} płatność {{currency}} {{total}} była należna do {{dueDate}}.",
        "Opóźnienie wynosi obecnie {{overdueDays}} dni. Prosimy o natychmiastową zapłatę; w przeciwnym razie {{nextAction}}."
      ],
      tr: [
        "Sayın {{buyer}}, {{no}} numaralı faturaya göre {{currency}} {{total}} tutarındaki ödeme {{dueDate}} tarihinde yapılacaktı.",
        "Gecikme {{overdueDays}} güne ulaştı. Lütfen derhal ödeme yapın; aksi halde {{nextAction}}."
      ],
      vi: [
        "Kính gửi {{buyer}}, theo hóa đơn {{no}}, khoản thanh toán {{currency}} {{total}} đến hạn vào {{dueDate}}.",
        "Đã quá hạn {{overdueDays}} ngày. Đề nghị quý công ty thanh toán ngay; nếu không, {{nextAction}}."
      ],
      id: [
        "Yth. {{buyer}}, sesuai faktur {{no}}, pembayaran {{currency}} {{total}} jatuh tempo pada {{dueDate}}.",
        "Keterlambatan kini {{overdueDays}} hari. Mohon segera melakukan pembayaran; jika tidak, {{nextAction}}."
      ],
      th: [
        "เรียน {{buyer}} ตามใบแจ้งหนี้ {{no}} ยอดชำระ {{currency}} {{total}} ครบกำหนดวันที่ {{dueDate}}",
        "ขณะนี้เกินกำหนด {{overdueDays}} วัน กรุณาชำระเงินโดยทันที มิฉะนั้น {{nextAction}}"
      ],
      ja: [
        "{{buyer}} 様、請求書 {{no}} に基づく {{currency}} {{total}} のお支払期限は {{dueDate}} でした。",
        "現在 {{overdueDays}} 日間延滞しております。直ちにお支払いください。ご入金がない場合、{{nextAction}}。"
      ],
      ko: [
        "{{buyer}} 귀하, 인보이스 {{no}}에 따른 {{currency}} {{total}} 결제 기한은 {{dueDate}}이었습니다.",
        "현재 {{overdueDays}}일 연체되었습니다. 즉시 결제해 주시기 바라며, 미결제 시 {{nextAction}}."
      ]
    },

    ir: {
      it: [
        "Data ispezione: {{insDate}}  Ispettore: {{inspector}}",
        "Campionatura: AQL 2.5",
        "Esito: {{result}}",
        "Difetti: {{defects}}"
      ],
      nl: [
        "Inspectiedatum: {{insDate}}  Inspecteur: {{inspector}}",
        "Steekproef: AQL 2.5",
        "Resultaat: {{result}}",
        "Gebreken: {{defects}}"
      ],
      pl: [
        "Data kontroli: {{insDate}}  Kontroler: {{inspector}}",
        "Próba: AQL 2.5",
        "Wynik: {{result}}",
        "Wady: {{defects}}"
      ],
      tr: [
        "Denetim tarihi: {{insDate}}  Denetçi: {{inspector}}",
        "Numune: AQL 2.5",
        "Sonuç: {{result}}",
        "Kusurlar: {{defects}}"
      ],
      vi: [
        "Ngày kiểm hàng: {{insDate}}  Người kiểm: {{inspector}}",
        "Lấy mẫu: AQL 2.5",
        "Kết quả: {{result}}",
        "Lỗi: {{defects}}"
      ],
      id: [
        "Tanggal inspeksi: {{insDate}}  Inspektur: {{inspector}}",
        "Sampel: AQL 2.5",
        "Hasil: {{result}}",
        "Cacat: {{defects}}"
      ],
      th: [
        "วันที่ตรวจสอบ: {{insDate}}  ผู้ตรวจ: {{inspector}}",
        "การสุ่มตัวอย่าง: AQL 2.5",
        "ผลการตรวจ: {{result}}",
        "ข้อบกพร่อง: {{defects}}"
      ],
      ja: [
        "検査日：{{insDate}}　検査員：{{inspector}}",
        "抜取検査：AQL 2.5",
        "結果：{{result}}",
        "不良内容：{{defects}}"
      ],
      ko: [
        "검사일: {{insDate}}  검사원: {{inspector}}",
        "샘플링: AQL 2.5",
        "결과: {{result}}",
        "결함: {{defects}}"
      ]
    },

    po: {
      it: [
        "Produrre {{product}}, quantità {{qty}} {{unit}}",
        "Materiale: {{material}}",
        "Completamento previsto: {{pDate}}. Consegna: {{delivery}}"
      ],
      nl: [
        "Produceer {{product}}, hoeveelheid {{qty}} {{unit}}",
        "Materiaal: {{material}}",
        "Geplande afronding: {{pDate}}. Levering: {{delivery}}"
      ],
      pl: [
        "Wyprodukować {{product}}, ilość {{qty}} {{unit}}",
        "Materiał: {{material}}",
        "Planowane zakończenie: {{pDate}}. Dostawa: {{delivery}}"
      ],
      tr: [
        "{{product}} üretilecek, miktar {{qty}} {{unit}}",
        "Malzeme: {{material}}",
        "Planlanan tamamlanma: {{pDate}}. Teslimat: {{delivery}}"
      ],
      vi: [
        "Sản xuất {{product}}, số lượng {{qty}} {{unit}}",
        "Vật liệu: {{material}}",
        "Dự kiến hoàn thành: {{pDate}}. Giao hàng: {{delivery}}"
      ],
      id: [
        "Produksi {{product}}, jumlah {{qty}} {{unit}}",
        "Bahan: {{material}}",
        "Target selesai: {{pDate}}. Pengiriman: {{delivery}}"
      ],
      th: [
        "ผลิต {{product}} จำนวน {{qty}} {{unit}}",
        "วัสดุ: {{material}}",
        "กำหนดเสร็จ: {{pDate}}  การจัดส่ง: {{delivery}}"
      ],
      ja: [
        "{{product}} を {{qty}} {{unit}} 生産",
        "材質：{{material}}",
        "完成予定：{{pDate}}　納期：{{delivery}}"
      ],
      ko: [
        "{{product}} 생산, 수량 {{qty}} {{unit}}",
        "자재: {{material}}",
        "완료 예정일: {{pDate}}. 납기: {{delivery}}"
      ]
    },

    as: {
      it: [
        "Problema: {{issue}} (Quantità: {{qty}})",
        "Soluzione: {{solution}}",
        "Stato: {{closed}}"
      ],
      nl: [
        "Probleem: {{issue}} (Aantal: {{qty}})",
        "Oplossing: {{solution}}",
        "Status: {{closed}}"
      ],
      pl: [
        "Problem: {{issue}} (Ilość: {{qty}})",
        "Rozwiązanie: {{solution}}",
        "Status: {{closed}}"
      ],
      tr: [
        "Sorun: {{issue}} (Miktar: {{qty}})",
        "Çözüm: {{solution}}",
        "Durum: {{closed}}"
      ],
      vi: [
        "Vấn đề: {{issue}} (Số lượng: {{qty}})",
        "Giải pháp: {{solution}}",
        "Trạng thái: {{closed}}"
      ],
      id: [
        "Masalah: {{issue}} (Jumlah: {{qty}})",
        "Solusi: {{solution}}",
        "Status: {{closed}}"
      ],
      th: [
        "ปัญหา: {{issue}} (จำนวน: {{qty}})",
        "แนวทางแก้ไข: {{solution}}",
        "สถานะ: {{closed}}"
      ],
      ja: [
        "問題：{{issue}}（数量：{{qty}}）",
        "対応策：{{solution}}",
        "ステータス：{{closed}}"
      ],
      ko: [
        "문제: {{issue}} (수량: {{qty}})",
        "해결 방안: {{solution}}",
        "상태: {{closed}}"
      ]
    },

    nda: {
      it: [
        "Entrambe le parti si impegnano a mantenere {{scope}} strettamente riservato.",
        "Durata: {{term}}. Regolato dalle leggi della Repubblica Popolare Cinese."
      ],
      nl: [
        "Beide partijen verplichten zich {{scope}} strikt vertrouwelijk te houden.",
        "Duur: {{term}}. Beheerst door de wetten van de Volksrepubliek China."
      ],
      pl: [
        "Obie strony zobowiązują się zachować {{scope}} w ścisłej tajemnicy.",
        "Okres: {{term}}. Podlega prawu Chińskiej Republiki Ludowej."
      ],
      tr: [
        "Taraflar {{scope}} konusunu kesinlikle gizli tutmayı kabul eder.",
        "Süre: {{term}}. Çin Halk Cumhuriyeti kanunlarına tabidir."
      ],
      vi: [
        "Hai bên cam kết giữ bí mật tuyệt đối {{scope}}.",
        "Thời hạn: {{term}}. Điều chỉnh bởi pháp luật Cộng hòa Nhân dân Trung Hoa."
      ],
      id: [
        "Kedua pihak sepakat menjaga {{scope}} secara rahasia.",
        "Jangka waktu: {{term}}. Diatur oleh hukum Republik Rakyat Tiongkok."
      ],
      th: [
        "คู่สัญญาทั้งสองฝ่ายตกลงรักษา {{scope}} เป็นความลับอย่างเคร่งครัด",
        "ระยะเวลา: {{term}} อยู่ภายใต้กฎหมายแห่งสาธารณรัฐประชาชนจีน"
      ],
      ja: [
        "両当事者は {{scope}} を厳格に秘密保持することに合意する。",
        "期間：{{term}}。中華人民共和国法に準拠する。"
      ],
      ko: [
        "양 당사자는 {{scope}}를 엄격히 비밀로 유지하기로 합의합니다.",
        "기간: {{term}}. 중화인민공화국 법률의 적용을 받습니다."
      ]
    },

    ca: {
      it: [
        "Agente: {{agent}}",
        "Commissione: {{rate}} del valore della fattura",
        "Liquidazione: {{settle}}"
      ],
      nl: [
        "Agent: {{agent}}",
        "Commissie: {{rate}} van de factuurwaarde",
        "Afrekening: {{settle}}"
      ],
      pl: [
        "Agent: {{agent}}",
        "Prowizja: {{rate}} wartości faktury",
        "Rozliczenie: {{settle}}"
      ],
      tr: [
        "Aracı: {{agent}}",
        "Komisyon: fatura bedelinin {{rate}}",
        "Ödeme: {{settle}}"
      ],
      vi: [
        "Đại lý: {{agent}}",
        "Hoa hồng: {{rate}} giá trị hóa đơn",
        "Thanh toán: {{settle}}"
      ],
      id: [
        "Agen: {{agent}}",
        "Komisi: {{rate}} dari nilai faktur",
        "Penyelesaian: {{settle}}"
      ],
      th: [
        "ตัวแทน: {{agent}}",
        "ค่าคอมมิชชัน: {{rate}} ของมูลค่าใบแจ้งหนี้",
        "การชำระบัญชี: {{settle}}"
      ],
      ja: [
        "代理店：{{agent}}",
        "手数料：請求額の {{rate}}",
        "精算：{{settle}}"
      ],
      ko: [
        "대리인: {{agent}}",
        "수수료: 인보이스 금액의 {{rate}}",
        "정산: {{settle}}"
      ]
    },

    mou: {
      it: [
        "Tra {{seller}} e {{buyer}}",
        "Obiettivo annuale: {{target}}",
        "Politica dei prezzi: {{pricePolicy}}",
        "Revisione: {{review}}"
      ],
      nl: [
        "Tussen {{seller}} en {{buyer}}",
        "Jaardoel: {{target}}",
        "Prijsbeleid: {{pricePolicy}}",
        "Evaluatie: {{review}}"
      ],
      pl: [
        "Między {{seller}} a {{buyer}}",
        "Cel roczny: {{target}}",
        "Polityka cenowa: {{pricePolicy}}",
        "Przegląd: {{review}}"
      ],
      tr: [
        "{{seller}} ile {{buyer}} arasında",
        "Yıllık hedef: {{target}}",
        "Fiyat politikası: {{pricePolicy}}",
        "Gözden geçirme: {{review}}"
      ],
      vi: [
        "Giữa {{seller}} và {{buyer}}",
        "Mục tiêu năm: {{target}}",
        "Chính sách giá: {{pricePolicy}}",
        "Đánh giá: {{review}}"
      ],
      id: [
        "Antara {{seller}} dan {{buyer}}",
        "Target tahunan: {{target}}",
        "Kebijakan harga: {{pricePolicy}}",
        "Tinjauan: {{review}}"
      ],
      th: [
        "ระหว่าง {{seller}} และ {{buyer}}",
        "เป้าหมายรายปี: {{target}}",
        "นโยบายราคา: {{pricePolicy}}",
        "การทบทวน: {{review}}"
      ],
      ja: [
        "{{seller}} と {{buyer}} との間",
        "年間目標：{{target}}",
        "価格方針：{{pricePolicy}}",
        "見直し：{{review}}"
      ],
      ko: [
        "{{seller}}와 {{buyer}} 간",
        "연간 목표: {{target}}",
        "가격 정책: {{pricePolicy}}",
        "검토: {{review}}"
      ]
    }

  };

  var base = global.DOC_NOTES = global.DOC_NOTES || {};
  Object.keys(MORE).forEach(function (id) {
    base[id] = base[id] || {};
    Object.keys(MORE[id]).forEach(function (lang) {
      base[id][lang] = MORE[id][lang];
    });
  });

})(window);
