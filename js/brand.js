/* ============================================================
   FT Compass · Brand v1.0
   品牌资料（借鉴 HUIDI「一次建档、处处复用」）：
   Logo / 电子签名 / 公司公章 + 工商银行税号信息，
   存 profile 集合 id='my' 的 brand 字段，单证/报价共用。
   ============================================================ */
(function (global) {
  'use strict';

  /* 共享样式：弹窗 + 纸面签章（任意页面引入即生效） */
  var CSS = ''
    + 'dialog.br-dlg{border:1px solid #e4e0d4;border-radius:14px;box-shadow:0 8px 24px rgba(31,41,51,.16);padding:0;max-width:640px;width:94%}'
    + 'dialog.br-dlg::backdrop{background:rgba(31,41,51,.45)}'
    + '.br-h{background:#084c38;color:#fff;padding:16px;display:flex;justify-content:space-between;gap:12px}'
    + '.br-h h3{margin:0 0 4px;font-size:16px}'
    + '.br-h p{margin:0;font-size:12px;opacity:.75;line-height:1.5}'
    + '.br-h .iconbtn{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 10px;cursor:pointer;height:fit-content}'
    + '.br-b{padding:16px;max-height:64vh;overflow:auto}'
    + '.br-shots{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}'
    + '.br-slot{display:flex;flex-direction:column;gap:6px}'
    + '.br-view{height:96px;border:1.5px dashed #cfc9b8;border-radius:6px;background:#f3f1ea;display:flex;align-items:center;justify-content:center;overflow:hidden}'
    + '.br-view img{max-width:92%;max-height:88px;object-fit:contain}'
    + '.br-view span{font-size:12px;color:#9aa5b1}'
    + '.br-pick{padding:7px 0;border:1px solid #cfc9b8;border-radius:6px;background:#fff;cursor:pointer;font-size:13px}'
    + '.br-pick:hover{border-color:#0b6e4f;color:#0b6e4f}'
    + '.br-hint{font-size:11px;color:#9aa5b1;line-height:1.45}'
    + '.br-name{font-size:11px;color:#17936c}'
    + '.br-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '.br-dr{margin-bottom:12px}'
    + '.br-dr label{display:block;font-size:12px;color:#52606d;margin-bottom:4px}'
    + '.br-dr input,.br-dr textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfc9b8;border-radius:6px;font-size:14px;font-family:inherit}'
    + '.br-f{display:flex;gap:12px;justify-content:flex-end;padding:0 16px 16px}'
    + '.br-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;border-bottom:1px dashed #cfc9b8;padding-bottom:6px}'
    + '.br-top-logo{max-height:44px;max-width:170px;object-fit:contain}'
    + '.br-top-name{font-size:13px;font-weight:600;color:#52606d}'
    + '.br-stamps{position:relative;height:92px;min-width:190px;margin-bottom:4px}'
    + '.br-stamp{position:absolute;object-fit:contain;pointer-events:none}'
    + '.br-stamp-sign{left:2px;bottom:16px;max-height:60px;max-width:140px;transform:rotate(-4deg)}'
    + '.br-stamp-seal{left:66px;bottom:4px;width:88px;height:88px;transform:rotate(-8deg);opacity:.92}'
    + '.sig-sell{position:relative}';
  if (!document.getElementById('brand-style')) {
    var st = document.createElement('style');
    st.id = 'brand-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var DEFAULTS = {
    logo: '',        // dataURL · 单证顶部
    sign: '',        // dataURL · 电子签名（建议透明 PNG）
    seal: '',        // dataURL · 公司公章（建议透明 PNG）
    brandName: '',
    sellerFull: '',
    contact: '',
    email: '',
    phone: '',
    website: '',
    addr: '',
    taxNo: '',
    currency: 'USD',
    bankAcctName: '',
    bankName: '',
    bankAcct: '',
    bankSwift: '',
    bankAddr: ''
  };

  function rec() {
    try { return (DataStore.list('profile') || [])[0] || null; }
    catch (e) { return null; }
  }

  var Brand = {
    DEFAULTS: DEFAULTS,

    /** 读品牌资料（永远返回完整对象） */
    get: function () {
      var r = rec();
      var b = (r && r.brand) || {};
      var out = {};
      Object.keys(DEFAULTS).forEach(function (k) { out[k] = b[k] != null ? b[k] : DEFAULTS[k]; });
      return out;
    },

    /** 写品牌资料（合并进 profile/my） */
    save: function (patch) {
      var r = rec();
      var b = {};
      Object.keys(DEFAULTS).forEach(function (k) { b[k] = DEFAULTS[k]; });
      if (r && r.brand) Object.keys(r.brand).forEach(function (k) { b[k] = r.brand[k]; });
      Object.keys(patch || {}).forEach(function (k) { if (k in DEFAULTS) b[k] = patch[k]; });
      if (r) {
        DataStore.update('profile', r.id, { brand: b });
      } else {
        DataStore.add('profile', { id: 'my', brand: b });
      }
      return b;
    },

    /** 银行信息多行文本（PI/合同自动带入） */
    bankText: function () {
      var b = Brand.get();
      var lines = [];
      if (b.bankAcctName) lines.push('A/C Name: ' + b.bankAcctName);
      if (b.bankName) lines.push('Bank: ' + b.bankName);
      if (b.bankAcct) lines.push('A/C No.: ' + b.bankAcct);
      if (b.bankSwift) lines.push('SWIFT: ' + b.bankSwift);
      if (b.bankAddr) lines.push(b.bankAddr);
      return lines.join(' / ');
    },

    hasSeal: function () { var b = Brand.get(); return !!(b.sign || b.seal); },

    /** 压缩上传图为 dataURL：png=true 保透明（签名/公章），否则 JPEG */
    compress: function (file, maxDim, png) {
      return new Promise(function (resolve, reject) {
        if (!file || !/^image\//.test(file.type)) { reject(new Error('请选择图片文件')); return; }
        var fr = new FileReader();
        fr.onerror = function () { reject(new Error('读取文件失败')); };
        fr.onload = function (e) {
          var img = new Image();
          img.onerror = function () { reject(new Error('图片解码失败')); };
          img.onload = function () {
            var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            var ctx = cv.getContext('2d');
            if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
            ctx.drawImage(img, 0, 0, w, h);
            var url = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.82);
            // PNG 仍过大时降级 JPEG（公章底色非透明时可接受）
            if (png && url.length > 700000) url = cv.toDataURL('image/jpeg', 0.85);
            resolve(url);
          };
          img.src = e.target.result;
        };
        fr.readAsDataURL(file);
      });
    },

    /** 品牌资料弹窗 HTML（与 HUIDI 编辑品牌资料对齐） */
    dialogHTML: function (id) {
      id = id || 'dlgBrand';
      var F = [
        ['brandName', '品牌名称'], ['sellerFull', '卖方公司全称'],
        ['contact', '联系人'], ['email', '邮箱'],
        ['phone', '电话 / WhatsApp'], ['website', '网站'],
        ['taxNo', '税号 / VAT / EORI'], ['currency', '默认币种'],
        ['bankAcctName', '收款人 / 账户名'], ['bankName', '开户行'],
        ['bankAcct', '银行账号'], ['bankSwift', 'SWIFT']
      ];
      var fhtml = F.map(function (f) {
        return '<div class="br-dr"><label>' + f[1] + '</label><input data-bk="' + f[0] + '"></div>';
      }).join('');
      return '<dialog id="' + id + '" class="br-dlg">'
        + '<div class="br-h"><div><h3>编辑品牌资料</h3>'
        + '<p>把卖方公司、Logo、收款资料、签名和公章保存一次，后面的报价、PI、合同、CI、装箱单都可以继续复用。</p></div>'
        + '<button class="iconbtn" onclick="document.getElementById(\'' + id + '\').close()">✕</button></div>'
        + '<div class="br-b">'
        + '<div class="br-shots">'
        + Brand._slotHTML('logo', '公司 / 品牌 Logo', '会带到单证顶部和 PDF 品牌区域。', 480, false)
        + Brand._slotHTML('sign', '电子签名', '建议透明 PNG；会带到编辑器签章区。', 400, true)
        + Brand._slotHTML('seal', '公司公章', '建议透明 PNG；会带到编辑器签章区。', 400, true)
        + '</div>'
        + '<div class="br-two">' + fhtml + '</div>'
        + '<div class="br-dr"><label>公司地址</label><textarea data-bk="addr" rows="2"></textarea></div>'
        + '<div class="br-dr"><label>银行地址 / 付款备注</label><textarea data-bk="bankAddr" rows="2"></textarea></div>'
        + '</div>'
        + '<div class="br-f"><button class="ft-btn-primary" onclick="document.getElementById(\'' + id + '\').close()">取消</button>'
        + '<button class="ft-btn-primary" data-br-save>保存品牌资料</button></div>'
        + '</dialog>';
    },

    _slotHTML: function (key, title, hint, maxDim, png) {
      return '<div class="br-slot" data-slot="' + key + '" data-max="' + maxDim + '" data-png="' + (png ? 1 : 0) + '">'
        + '<div class="br-view" data-view></div>'
        + '<button type="button" class="br-pick">选择图片</button>'
        + '<div class="br-hint">' + hint + '</div>'
        + '<div class="br-name" data-name></div>'
        + '<input type="file" accept="image/*" hidden>'
        + '</div>';
    },

    /**
     * 初始化弹窗：填充数据 + 绑定上传/保存
     * onChange(b) 保存成功后回调（用于联动刷新预览）
     */
    initDialog: function (dlgId, onChange) {
      var dlg = document.getElementById(dlgId);
      if (!dlg || dlg.dataset.brReady) return dlg;
      dlg.dataset.brReady = '1';

      function paint() {
        var b = Brand.get();
        dlg.querySelectorAll('[data-bk]').forEach(function (el) {
          el.value = b[el.dataset.bk] || '';
        });
        dlg.querySelectorAll('[data-slot]').forEach(function (slot) {
          var k = slot.dataset.slot;
          var view = slot.querySelector('[data-view]');
          var name = slot.querySelector('[data-name]');
          if (b[k]) {
            view.innerHTML = '<img src="' + b[k] + '" alt="' + k + '">';
            name.textContent = '✓ 已设置';
          } else {
            view.innerHTML = '<span>未设置</span>';
            name.textContent = '';
          }
        });
      }
      dlg._brPaint = paint;

      dlg.querySelectorAll('[data-slot]').forEach(function (slot) {
        var input = slot.querySelector('input[type=file]');
        slot.querySelector('.br-pick').addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
          var f = input.files && input.files[0];
          if (!f) return;
          var png = slot.dataset.png === '1';
          var max = parseInt(slot.dataset.max, 10) || 400;
          Brand.compress(f, max, png).then(function (url) {
            var patch = {};
            patch[slot.dataset.slot] = url;
            Brand.save(patch);
            paint();
            if (onChange) onChange(Brand.get(), slot.dataset.slot);
          }).catch(function (err) { alert(err.message); });
          input.value = '';
        });
      });

      var saveBtn = dlg.querySelector('[data-br-save]');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        var patch = {};
        dlg.querySelectorAll('[data-bk]').forEach(function (el) {
          patch[el.dataset.bk] = el.value.trim();
        });
        try {
          Brand.save(patch);
        } catch (e) {
          alert('保存失败（可能是图片过大，localStorage 空间不足）：' + e.message);
          return;
        }
        dlg.close();
        if (onChange) onChange(Brand.get());
      });

      paint();
      return dlg;
    },

    /** 打开弹窗（自动初始化） */
    open: function (dlgId, onChange) {
      var dlg = Brand.initDialog(dlgId, onChange);
      if (dlg) dlg.showModal();
    },

    /* ---------- 单证纸面渲染片段 ---------- */

    /** 顶部 Logo 条（带品牌名） */
    headerHTML: function () {
      var b = Brand.get();
      if (!b.logo && !b.brandName) return '';
      return '<div class="br-top">'
        + (b.logo ? '<img class="br-top-logo" src="' + b.logo + '" alt="">' : '')
        + (b.brandName ? '<div class="br-top-name">' + escHtml(b.brandName) + '</div>' : '')
        + '</div>';
    },

    /** 签章区：电子签名 + 公司公章（叠加在 Seller 签名线上方） */
    signHTML: function () {
      var b = Brand.get();
      if (!b.sign && !b.seal) return '';
      return '<div class="br-stamps">'
        + (b.sign ? '<img class="br-stamp br-stamp-sign" src="' + b.sign + '" alt="sign">' : '')
        + (b.seal ? '<img class="br-stamp br-stamp-seal" src="' + b.seal + '" alt="seal">' : '')
        + '</div>';
    },

    /** 卖方信息块：手填优先，品牌兜底；两者皆空返回 '' */
    sellerHTML: function (fallbackName, fallbackAddr) {
      var b = Brand.get();
      var name = fallbackName || b.sellerFull || '';
      var addr = fallbackAddr || b.addr || '';
      if (!name && !b.taxNo) return '';
      return (name ? escHtml(name) + '<br>' : '')
        + (addr ? escHtml(addr) + '<br>' : '')
        + (b.taxNo ? '<span style="font-size:11px;color:#666">Tax/VAT: ' + escHtml(b.taxNo) + '</span>' : '');
    }
  };

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  global.Brand = Brand;
})(window);
