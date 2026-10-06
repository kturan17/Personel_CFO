/* Kişisel CFO — mobil arayüz */
(function () {
  'use strict';
  const E = window.CFO, Store = window.CFOStore, Ch = window.CFOCharts;
  const { fmtTL, fmtNum, fmtPct, fmtDate, isNum, blank, N } = E;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const SHORT_AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  let DATA = null, R = null;
  const ui = { view: 'panel', sub: '', confirmDel: null };

  // ------------------------------------------------------------ sabit listeler
  const BANKS = ['Akbank', 'Albaraka Türk', 'Alternatif Bank', 'Anadolubank', 'Burgan Bank', 'CEPTETEB', 'DenizBank', 'Emlak Katılım', 'Enpara.com', 'Fibabanka',
    'Garanti BBVA', 'Halkbank', 'HSBC', 'ICBC Turkey', 'ING', 'İş Bankası', 'Kuveyt Türk', 'Odeabank', 'QNB', 'Şekerbank', 'TEB', 'Türkiye Finans',
    'Vakıf Katılım', 'VakıfBank', 'Yapı Kredi', 'Ziraat Bankası', 'Ziraat Katılım', 'Diğer'];
  const CATS = Object.keys(E.CAT_TYPES);

  // ------------------------------------------------------------ form tanımları
  const SEC = s => ({ sec: s });
  const FIELDS = {
    cards: [
      SEC('Kart'),
      { k: 'bank', l: 'Banka', t: 'bank', req: 1, full: 1 },
      { k: 'name', l: 'Kart adı', t: 'text', ph: 'ör. Bonus, World' },
      { k: 'son4', l: 'Son 4 hane', t: 'last4', ph: 'isteğe bağlı' },
      { k: 'tamOder', l: 'Her ay ekstrenin tamamını öderim', t: 'bool', full: 1, help: 'Açıksa bu karta faiz hesaplanmaz ve borç kapatma planına alınmaz.' },
      SEC('Ekstre bilgileri'),
      { k: 'limit', l: 'Kart limiti', t: 'money' },
      { k: 'donem', l: 'Dönem borcu', t: 'money', help: 'Ekstre tutarı' },
      { k: 'asgari', l: 'Asgari ödeme', t: 'money' },
      { k: 'gecikmis', l: 'Gecikmiş tutar', t: 'money', help: 'Ekstrede varsa' },
      { k: 'ekstre', l: 'Ekstre kesim tarihi', t: 'date' },
      { k: 'sonOdeme', l: 'Son ödeme tarihi', t: 'date' },
      { k: 'odenen', l: 'Bu dönem ödenen', t: 'money' },
      { k: 'toplam', l: 'Toplam güncel borç', t: 'money', help: 'Taksitler ve yeni harcamalar dahil' },
      SEC('Aylık faiz oranları (ekstrede yazar)'),
      { k: 'akdi', l: 'Akdi faiz', t: 'pct' },
      { k: 'gecFaiz', l: 'Gecikme faizi', t: 'pct' },
      { k: 'nakitFaiz', l: 'Nakit avans faizi', t: 'pct' },
      { k: 'nakitBorc', l: 'Nakit avans borcu', t: 'money' },
      SEC('Taksitli alışverişler'),
      { k: 'taksitSayisi', l: 'Toplam taksit', t: 'int' },
      { k: 'kalanTaksit', l: 'Kalan taksit', t: 'int' },
      { k: 'aylikTaksit', l: 'Aylık taksit tutarı', t: 'money', full: 1 },
    ],
    loans: [
      SEC('Kredi'),
      { k: 'bank', l: 'Banka', t: 'bank', req: 1, full: 1 },
      { k: 'name', l: 'Kredi adı', t: 'text', ph: 'ör. İhtiyaç' },
      { k: 'tur', l: 'Kredi türü', t: 'select', opts: ['İhtiyaç Kredisi', 'Taşıt Kredisi', 'Konut Kredisi', 'Ticari Kredi', 'Diğer'] },
      SEC('Güncel durum'),
      { k: 'anapara', l: 'Kalan anapara', t: 'money', req: 1, help: 'Bankacılık uygulamasında yazan' },
      { k: 'taksit', l: 'Aylık taksit', t: 'money', req: 1 },
      { k: 'kalanVade', l: 'Kalan taksit sayısı', t: 'int', req: 1 },
      { k: 'faiz', l: 'Aylık faiz (sözleşme)', t: 'pct' },
      { k: 'taksitGunu', l: 'Taksit günü (1–31)', t: 'int', min: 1, max: 31 },
      { k: 'sonOdenen', l: 'Son ödenen taksit tarihi', t: 'date' },
      { k: 'otomatik', l: 'Otomatik ödeme talimatı var', t: 'bool', full: 1 },
      SEC('İsteğe bağlı'),
      { k: 'cekilen', l: 'Çekilen tutar', t: 'money' },
      { k: 'toplamVade', l: 'Toplam vade (ay)', t: 'int' },
      { k: 'erkenTeklif', l: 'Bankanın erken kapama teklifi', t: 'money', full: 1, help: 'Bankadan aldığınız kapama tutarı (biliniyorsa). Tahmin yazmayın.' },
    ],
    kmh: [
      SEC('Kredili Mevduat Hesabı / Ek Hesap'),
      { k: 'bank', l: 'Banka', t: 'bank', req: 1, full: 1 },
      { k: 'hesap', l: 'Hesap adı', t: 'text', ph: 'ör. Vadesiz', help: 'Banka hesaplarındaki adıyla aynı yazın' },
      { k: 'limit', l: 'KMH limiti', t: 'money' },
      { k: 'kullanilan', l: 'Kullanılan tutar', t: 'money', req: 1 },
      { k: 'faiz', l: 'Aylık faiz', t: 'pct' },
      { k: 'vergi', l: 'KKDF + BSMV', t: 'pct', help: 'Boşsa %30' },
      { k: 'gun', l: 'Kaç gün kullanılacak', t: 'int', help: 'İsteğe bağlı maliyet hesabı' },
      { k: 'kapatma', l: 'Kapatma hedef tarihi', t: 'date' },
    ],
    others: [
      SEC('Diğer borç'),
      { k: 'ad', l: 'Borç adı', t: 'text', req: 1, ph: 'ör. Kardeşe borç' },
      { k: 'alacakli', l: 'Alacaklı', t: 'text' },
      { k: 'tur', l: 'Tür', t: 'select', opts: ['Aile/Arkadaş', 'Senet', 'Vergi', 'SGK', 'İcra', 'Kira', 'Diğer'] },
      { k: 'oncelik', l: 'Öncelik', t: 'select', opts: ['Yüksek', 'Orta', 'Düşük'] },
      { k: 'tutar', l: 'Toplam borç', t: 'money', req: 1 },
      { k: 'odenen', l: 'Ödenen', t: 'money' },
      { k: 'sonOdeme', l: 'Son ödeme / vade', t: 'date' },
      { k: 'aylik', l: 'Aylık ödeme', t: 'money', help: 'Taksitliyse' },
      { k: 'faiz', l: 'Aylık faiz', t: 'pct', help: 'Faizsizse 0' },
      { k: 'buAyOdendi', l: 'Bu ayın ödemesi yapıldı', t: 'bool', full: 1 },
    ],
    accounts: [
      SEC('Banka hesabı'),
      { k: 'bank', l: 'Banka', t: 'bank', req: 1, full: 1 },
      { k: 'ad', l: 'Hesap adı', t: 'text', req: 1, ph: 'ör. Maaş' },
      { k: 'tur', l: 'Hesap türü', t: 'select', opts: ['Vadesiz', 'Vadeli', 'Birikim', 'Döviz', 'Diğer'] },
      { k: 'para', l: 'Para birimi', t: 'select', opts: ['TRY', 'USD', 'EUR', 'GBP', 'XAU (gram altın)'] },
      { k: 'bakiye', l: 'Bakiye', t: 'money', req: 1, help: 'KMH kullanımını buraya eksi yazmayın; KMH ayrı girilir.' },
      { k: 'son4', l: 'IBAN son 4 hane', t: 'last4', ph: 'isteğe bağlı', full: 1, help: 'IBAN\'ın tamamını girmeyin.' },
    ],
    assets: [
      SEC('Varlık'),
      { k: 'kategori', l: 'Kategori', t: 'select', opts: ['Nakit', 'Altın', 'Döviz', 'Yatırım', 'Araç', 'Gayrimenkul', 'Diğer'], req: 1 },
      { k: 'ad', l: 'Açıklama', t: 'text' },
      { k: 'birim', l: 'Birim', t: 'select', opts: ['', 'TL', 'USD', 'EUR', 'GBP', 'Gram Altın'] },
      { k: 'miktar', l: 'Miktar', t: 'num' },
      { k: 'manuel', l: 'Ya da TL değeri', t: 'money', full: 1, help: 'Araç, ev gibi varlıklar için kendi belirlediğiniz değer' },
    ],
    txs: [
      { k: 'tarih', l: 'Tarih', t: 'date', req: 1 },
      { k: 'kategori', l: 'Kategori', t: 'select', opts: CATS, req: 1 },
      { k: 'tutar', l: 'Tutar', t: 'money', req: 1, full: 1 },
      { k: 'aciklama', l: 'Açıklama', t: 'text', full: 1 },
      { k: 'yontem', l: 'Ödeme yöntemi', t: 'select', opts: ['Banka Kartı', 'Kredi Kartı', 'Nakit', 'Havale/EFT', 'Otomatik Ödeme', 'Diğer'] },
      { k: 'hesap', l: 'Hesap / kart', t: 'text' },
    ],
    planItems: [
      { k: 'ad', l: 'Kalem', t: 'text', req: 1, full: 1 },
      { k: 'tip', l: 'Tür', t: 'select', opts: ['Gelir', 'Zorunlu', 'Değişken'], req: 1 },
      { k: 'tutar', l: 'Aylık tutar', t: 'money', req: 1 },
    ],
    history: [
      { k: 'ay', l: 'Ay', t: 'month', req: 1, full: 1 },
      { k: 'borc', l: 'Toplam borç', t: 'money', req: 1 },
      { k: 'varlik', l: 'Toplam varlık', t: 'money' },
      { k: 'faiz', l: 'Aylık faiz yükü', t: 'money', full: 1 },
    ],
    settings: [
      SEC('Görünüm'),
      { k: 'tema', l: 'Tema', t: 'select', opts: ['Otomatik', 'Açık', 'Koyu'], full: 1 },
      SEC('Plan ve rezerv'),
      { k: 'gelirGuvence', l: 'Gelirim', t: 'select', opts: [['guvenli', 'Çok güvenli (kamu vb.) → 2 ay rezerv'], ['normal', 'Normal maaş → 3 ay'], ['degisken', 'Değişken / serbest → 6 ay']], full: 1 },
      { k: 'rezervManuel', l: 'Rezerv hedefi (ay) — elle', t: 'num', help: 'Boşsa yukarıdaki seçim' },
      { k: 'rezervOrani', l: 'Artanın rezerve ayrılan payı', t: 'pct', help: 'Varsayılan %20' },
      { k: 'dengePay', l: 'DENGE modunda rezerv payı', t: 'pct', help: 'Varsayılan %50' },
      { k: 'strateji', l: 'Borç kapatma stratejisi', t: 'select', opts: [['A', 'A — En yüksek faiz önce (önerilen)'], ['B', 'B — En küçük borç önce (snowball)']] },
      SEC('Mevduat (ek para yatırımla kıyas)'),
      { k: 'mevduatFaiz', l: 'Aylık brüt mevduat faizi', t: 'pct' },
      { k: 'stopaj', l: 'Stopaj', t: 'pct' },
      SEC('Kurlar (TL)'),
      { k: 'kur.USD', l: 'USD', t: 'num' }, { k: 'kur.EUR', l: 'EUR', t: 'num' },
      { k: 'kur.GBP', l: 'GBP', t: 'num' }, { k: 'kur.XAU', l: 'Gram altın', t: 'num' },
      SEC('Yasal tavanlar (TCMB — değişirse güncelleyin)'),
      { k: 'akdi1', l: 'Kart akdi tavan (≤30 B)', t: 'pct' }, { k: 'akdi2', l: 'Kart akdi tavan (30–180 B)', t: 'pct' },
      { k: 'akdi3', l: 'Kart akdi tavan (>180 B)', t: 'pct' }, { k: 'gecFark', l: 'Gecikme farkı', t: 'pct' },
      { k: 'nakitMax', l: 'Nakit avans / KMH tavanı', t: 'pct' }, { k: 'vergi', l: 'KKDF + BSMV', t: 'pct' },
      { k: 'kartKad1', l: 'Kademe 1 sınırı', t: 'money' }, { k: 'kartKad2', l: 'Kademe 2 sınırı', t: 'money' },
      { k: 'asgEsik', l: 'Asgari oran limit eşiği', t: 'money' }, { k: 'asgTaban', l: 'Asgari ödeme tabanı', t: 'money' },
      { k: 'asgDusuk', l: 'Asgari oran (düşük limit)', t: 'pct' }, { k: 'asgYuksek', l: 'Asgari oran (yüksek limit)', t: 'pct' },
      { k: 'tavanTarih', l: 'Tavanların geçerlilik tarihi', t: 'date', full: 1 },
    ],
  };
  const PCT_MAX = { akdi: .1, gecFaiz: .1, nakitFaiz: .1, faiz: .1, mevduatFaiz: .1 };

  // ------------------------------------------------------------ sayı biçim/çözümleme
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).trim().replace(/[\s₺%]/g, '').replace(/TL$/i, '');
    if (s === '') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const v = Number(s);
    return isFinite(v) ? v : NaN;
  }
  const showNum = (v, d) => blank(v) ? '' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: d == null ? 2 : d }).format(v);
  const showPct = v => blank(v) ? '' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(Math.round(v * 1e6) / 1e4);
  const getPath = (o, k) => k.split('.').reduce((a, p) => a == null ? undefined : a[p], o);
  const setPath = (o, k, v) => { const ps = k.split('.'); let t = o; ps.slice(0, -1).forEach(p => { if (t[p] == null || typeof t[p] !== 'object') t[p] = {}; t = t[p]; }); t[ps[ps.length - 1]] = v; };

  function renderForm(fields, obj) {
    let html = '<div class="formgrid">';
    fields.forEach(f => {
      if (f.sec) { html += `<div class="fsec full">${esc(f.sec)}</div>`; return; }
      const v = getPath(obj, f.k), id = 'f_' + f.k.replace('.', '_');
      const cls = 'f' + (f.full || f.t === 'bool' ? ' full' : '');
      let inp = '';
      if (f.t === 'bool') {
        html += `<div class="${cls}"><label class="sw" for="${id}"><span>${esc(f.l)}</span><input type="checkbox" id="${id}" data-k="${f.k}" data-t="bool" ${v ? 'checked' : ''}></label>${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
        return;
      }
      if (f.t === 'select') {
        inp = `<select id="${id}" data-k="${f.k}" data-t="select">` + (f.req ? '' : '<option value="">—</option>') + f.opts.filter(o => o !== '').map(o => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('') + '</select>';
      } else if (f.t === 'date') inp = `<input type="date" id="${id}" data-k="${f.k}" data-t="date" value="${esc(v || '')}">`;
      else if (f.t === 'month') inp = `<input type="text" inputmode="numeric" placeholder="YYYY-AA (ör. 2026-07)" id="${id}" data-k="${f.k}" data-t="month" value="${esc(v || '')}">`;
      else if (f.t === 'bank') inp = `<input type="text" list="banklist" autocomplete="off" id="${id}" data-k="${f.k}" data-t="text" value="${esc(v || '')}" placeholder="Seçin veya yazın">`;
      else if (f.t === 'money') inp = `<div class="suf"><input type="text" inputmode="decimal" id="${id}" data-k="${f.k}" data-t="money" value="${esc(showNum(v))}" placeholder="${esc(f.ph || '')}"><span>₺</span></div>`;
      else if (f.t === 'pct') inp = `<div class="suf"><input type="text" inputmode="decimal" id="${id}" data-k="${f.k}" data-t="pct" value="${esc(showPct(v))}" placeholder="${esc(f.ph || 'ör. 3,25')}"><span>%</span></div>`;
      else if (f.t === 'int' || f.t === 'num') inp = `<input type="text" inputmode="${f.t === 'int' ? 'numeric' : 'decimal'}" id="${id}" data-k="${f.k}" data-t="${f.t}" value="${esc(showNum(v, 4))}" placeholder="${esc(f.ph || '')}">`;
      else if (f.t === 'last4') inp = `<input type="text" inputmode="numeric" maxlength="4" id="${id}" data-k="${f.k}" data-t="last4" value="${esc(v || '')}" placeholder="${esc(f.ph || '')}">`;
      else inp = `<input type="text" id="${id}" data-k="${f.k}" data-t="text" value="${esc(v || '')}" placeholder="${esc(f.ph || '')}" autocomplete="off">`;
      html += `<div class="${cls}" data-wrap="${f.k}"><label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>${inp}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}<div class="err" hidden></div></div>`;
    });
    return html + '</div>';
  }
  function readForm(fields, root, base) {
    const out = JSON.parse(JSON.stringify(base || {})); let ok = true;
    fields.forEach(f => {
      if (f.sec) return;
      const el = root.querySelector(`[data-k="${f.k}"]`); if (!el) return;
      const wrap = el.closest('.f'), err = wrap && wrap.querySelector('.err');
      let v, msg = '';
      const raw = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (f.t === 'bool') v = !!raw;
      else if (['money', 'num', 'int'].indexOf(f.t) >= 0) {
        v = parseNum(raw);
        if (Number.isNaN(v)) msg = 'Sayı girin (ör. 12.500 veya 12500,50)';
        else if (v != null && v < 0) msg = 'Negatif olamaz';
        else if (f.t === 'int' && v != null && Math.floor(v) !== v) msg = 'Tam sayı girin';
        else if (v != null && f.min != null && v < f.min) msg = `En az ${f.min}`;
        else if (v != null && f.max != null && v > f.max) msg = `En çok ${f.max}`;
      } else if (f.t === 'pct') {
        v = parseNum(raw);
        if (Number.isNaN(v)) msg = 'Oran girin (ör. 3,25)';
        else if (v != null) {
          v = Math.round(v * 1e4) / 1e6;
          if (v < 0) msg = 'Negatif olamaz';
          else if ((PCT_MAX[f.k] && v > PCT_MAX[f.k]) || v > 1) msg = 'Aylık oran girin (ör. 3,25). Yıllık oranı girmeyin.';
        }
      } else if (f.t === 'last4') { v = raw || null; if (v && !/^\d{4}$/.test(v)) msg = 'Yalnızca son 4 rakam'; }
      else if (f.t === 'month') { v = raw || null; if (v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) msg = 'YYYY-AA biçiminde (ör. 2026-07)'; }
      else { v = raw === '' ? null : raw; if (v && /\d[\d\s-]{11,}\d/.test(v)) msg = 'Kart veya IBAN numarası girmeyin'; }
      if (!msg && f.req && (v == null || v === '')) msg = 'Zorunlu alan';
      if (err) { err.hidden = !msg; err.textContent = msg; wrap.classList.toggle('bad', !!msg); }
      if (msg) ok = false;
      setPath(out, f.k, v);
    });
    if (!ok) { const b = root.querySelector('.f.bad'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return ok ? out : null;
  }

  // ------------------------------------------------------------ veri
  function emptyData() {
    return { version: 1, settings: {}, accounts: [], cards: [], loans: [], kmh: [], others: [], assets: [], plan: { items: [] }, txs: [],
      history: {}, karar: { tutar: null }, senaryo: { ek: 10000, tip: 'Aylık' }, stres: {}, meta: { created: todayStr() } };
  }
  function normalize(d) {
    const e = emptyData();
    Object.keys(e).forEach(k => { if (d[k] == null) d[k] = e[k]; });
    if (!d.plan.items) d.plan.items = [];
    ['accounts', 'cards', 'loans', 'kmh', 'others', 'assets', 'txs'].forEach(k => d[k].forEach(x => { if (!x.id) x.id = uid(); }));
    d.plan.items.forEach(x => { if (!x.id) x.id = uid(); });
    return d;
  }
  const arr = col => col === 'planItems' ? DATA.plan.items : DATA[col];
  async function commit(msg) {
    R = E.compute(DATA);
    const h = DATA.history[R.curKey];
    if (!(h && h.kilit)) DATA.history[R.curKey] = Object.assign({}, R.snapshot, { oto: true });
    try { await Store.save(DATA); } catch (e) { toast('⚠ ' + e.message); }
    render();
    if (msg) toast(msg);
  }
  function applyTheme() {
    const t = DATA && DATA.settings && DATA.settings.tema;
    const want = t === 'Açık' ? 'light' : t === 'Koyu' ? 'dark' : null, root = document.documentElement;
    if (want) { root.dataset.theme = want; root.dataset.cfoTheme = '1'; }
    else if (root.dataset.cfoTheme) { delete root.dataset.theme; delete root.dataset.cfoTheme; }
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f4f5f7';
  }

  // ------------------------------------------------------------ küçük bileşenler
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }
  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  };
  function chipCls(s) {
    s = String(s || ''); const c = s.slice(0, 2);
    if (/^(🔴|⛔)/.test(s)) return 'crit'; if (/^🟠/.test(s)) return 'serious'; if (/^(🟡|⚠)/.test(s)) return 'warn'; if (/^(🟢|✅|✓)/.test(s)) return 'good'; return c ? '' : '';
  }
  const chip = s => s ? `<span class="chip ${chipCls(s)}">${esc(s)}</span>` : '';
  function rel(serial) {
    if (serial == null) return '';
    const d = serial - R.today;
    return d === 0 ? 'bugün' : d === 1 ? 'yarın' : d > 0 ? `${d} gün kaldı` : `${-d} gün geçti`;
  }
  const kv = (k, v) => `<div class="k">${esc(k)}</div><div class="v">${v}</div>`;
  const pctTxt = (x, d) => isNum(x) ? '%' + fmtPct(x, d) : (x == null ? '—' : esc(x));
  const tl = x => isNum(x) ? fmtTL(x) : (x == null ? '—' : esc(x));
  const shortMonth = serial => { const d = new Date(serial * 86400000); return SHORT_AY[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2); };
  const monthName = k => E.ayKeyAdi(k);

  // ------------------------------------------------------------ yönlendirme
  function parseHash() {
    const h = (location.hash || '#/panel').slice(2).split('/');
    ui.view = h[0] || 'panel'; ui.sub = h[1] || '';
  }
  function go(view, sub) { location.hash = '#/' + view + (sub ? '/' + sub : ''); }
  window.addEventListener('hashchange', () => { parseHash(); render(); window.scrollTo(0, 0); });

  function render() {
    if (!DATA) return;
    if (!R) R = E.compute(DATA);
    applyTheme();
    const main = $('#main');
    const v = ui.view;
    let html = '';
    if (v === 'borclar') html = viewBorclar();
    else if (v === 'karar') html = viewKarar();
    else if (v === 'diger') html = viewDiger();
    else html = viewPanel();
    main.innerHTML = html;
    $$('nav.bottom a[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === (v === 'panel' ? 'panel' : v)));
    afterRender();
  }

  // ------------------------------------------------------------ PANEL
  function isEmpty() { return !['cards', 'loans', 'kmh', 'others', 'accounts', 'assets'].some(k => DATA[k].length) && !DATA.plan.items.length; }
  function viewPanel() {
    const T = R.T, k = R.karar;
    let h = `<header class="top"><div><h1>Kişisel CFO</h1><div class="sub">${fmtDate(R.today)} · tüm veriler bu cihazda</div></div>
      <button class="iconbtn" data-act="lock" title="Kilitle" aria-label="Kilitle" ${Store.hasPin() ? '' : 'hidden'}>${ICON.lock}</button></header>`;
    if (isEmpty()) {
      return h + `<div class="card"><h3>Hoş geldiniz 👋</h3>
        <p class="small">Bu uygulama borçlarınızı, nakit akışınızı ve “ek parayı nereye yatırmalıyım?” sorusunu hesaplar. Girdiğiniz her şey <b>yalnızca bu telefonda</b> saklanır; internete gönderilmez.</p>
        <p class="small">Başlamak için sırasıyla: <b>1)</b> Aylık plan (gelir ve giderler) <b>2)</b> Kredi kartları <b>3)</b> Krediler, KMH ve diğer borçlar <b>4)</b> Banka hesapları ve nakit.</p>
        <p class="small muted">Kart numarasının tamamını, CVV'yi veya şifreleri asla girmeyin — uygulama bunları istemez.</p>
        <div class="btns"><button class="btn" data-go="diger/plan">Aylık plandan başla</button></div>
        <div class="btns"><button class="btn sec" data-act="loadSample">Örnek veriyle dene</button></div></div>`;
    }
    if (window.CFO_DEMO) h += `<div class="note" style="margin:0 0 12px">Önizleme: rakamlar örnek veridir. Değişiklik yapabilirsiniz ama sayfa kapanınca kaydedilmez.</div>`;
    const st = R.durumBaslik;
    h += `<div class="status ${chipCls(st)}">${esc(st)}</div>`;
    h += backupBanner();
    const bd = R.borcDegisim;
    h += `<div class="kpis">
      ${kpi('Toplam borç', fmtTL(T.borc), bd == null ? 'Geçen ay kaydı yok' : (bd <= 0 ? '▼ ' : '▲ ') + fmtTL(Math.abs(bd)) + ' geçen aya göre')}
      ${kpi('30 gün içinde ödenecek', fmtTL(T.t30Asgari), 'en az · tamamı ' + fmtTL(T.t30Tam))}
      ${kpi('Aylık faiz yükü', fmtTL(T.aylikFaiz), 'yılda ~' + fmtTL(T.aylikFaiz * 12))}
      ${kpi('Nakit', fmtTL(T.nakit), T.kmhBos > 0 ? 'KMH boş limit ' + fmtTL(T.kmhBos) : 'banka + elde')}
      ${kpi('Nakit ne kadar yeter?', k.dayanma == null ? '—' : fmtNum(k.dayanma, 1) + ' ay', 'hedef ' + k.rezAy + ' ay')}
      ${kpi('Net varlık', fmtTL(T.netVarlik), 'likit ' + fmtTL(T.likitNet))}
      ${T.borc > 0 ? kpi('Borçsuz olma tarihi', esc(R.gate(R.freeDate(R.sims.R.free))), R.uygulanabilir ? `toplam faiz ~${fmtTL(R.sims.R.interest)} · ayda ${fmtTL(R.plan.ek)} ek ödemeyle` : esc(R.planUyari), 'wide') : ''}
    </div>`;
    h += `<div class="card"><h3>CFO özeti</h3><ul class="cfo">${R.cfo.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <div class="btns"><button class="btn sec" data-go="karar/karar">Ek param var: nereye?</button></div></div>`;
    // yaklaşan
    const up = R.events.filter(e => e.date != null && e.date <= R.today + 30 && e.durum.indexOf('ÖDENDİ') < 0).slice(0, 6);
    h += `<div class="card"><div class="row"><h3>Yaklaşan ödemeler</h3><a class="small" href="#/diger/takvim">Tümü</a></div>
      <div class="list">${up.length ? up.map(evRow).join('') : '<div class="empty">30 gün içinde ödeme görünmüyor.</div>'}</div></div>`;
    // grafikler
    if (T.borc > 0) {
      h += `<div class="card"><div class="ctitle">Borç ne zaman biter?</div><div class="csub">Kalan borç (faiz dahil), aylık</div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Plan: ayda ${fmtTL(R.plan.ek)} ek</span><span><i style="background:var(--s2)"></i>Yalnızca asgari / taksit</span></div>
        <div id="ch-proj"></div>${R.uygulanabilir ? '' : `<div class="note">${esc(R.planUyari)}</div>`}</div>`;
      h += `<div class="card"><div class="ctitle">Borçların dağılımı</div><div class="csub">Güncel bakiye</div><div id="ch-dist"></div></div>`;
    }
    if (R.histRows.length >= 2) h += `<div class="card"><div class="ctitle">Aylara göre borç ve varlık</div><div class="csub">Her ay uygulamayı açtığınızda otomatik kaydedilir</div>
      <div class="legend"><span><i style="background:var(--s1)"></i>Toplam borç</span><span><i style="background:var(--s3)"></i>Toplam varlık</span></div><div id="ch-hist"></div></div>`;
    return h;
  }
  function kpi(l, v, d, cls) { return `<div class="kpi ${cls || ''}"><div class="l">${esc(l)}</div><div class="v">${v}</div><div class="d">${esc(d || '')}</div></div>`; }
  function backupBanner() {
    if (window.CFO_DEMO) return '';
    const lb = DATA.meta.lastBackup;
    const days = lb ? R.today - E.toSerial(lb) : null;
    if (days != null && days <= 14) return '';
    return `<div class="card" style="background:var(--warn-bg);border-color:transparent"><div class="row"><div class="grow small"><b>${days == null ? 'Henüz yedek alınmadı.' : days + ' gündür yedek alınmadı.'}</b><br>Telefon değişirse veya tarayıcı verisi silinirse veriler kaybolur.</div>
      <button class="btn" data-act="backup" style="flex:none">Yedekle</button></div></div>`;
  }
  function evRow(e) {
    const d = e.date == null ? null : new Date(e.date * 86400000);
    return `<div class="item tap" data-open="${e.p.src}:${e.p.ref.id}"><div class="datebox">${d ? `<div class="d1">${d.getUTCDate()}</div><div class="d2">${SHORT_AY[d.getUTCMonth()]}</div>` : '<div class="d1">?</div>'}</div>
      <div class="grow"><div class="b ellipsis">${esc(e.p.ad)}</div><div class="tiny muted ellipsis">${esc(e.p.banka)} · ${esc(e.not || e.p.tur)}</div></div>
      <div class="right"><div class="b num">${fmtTL(e.tutar)}</div>${e.asgari && Math.abs(e.asgari - e.tutar) > 1 ? `<div class="tiny muted">en az ${fmtTL(e.asgari)}</div>` : ''}<div class="tiny">${chip(e.durum)}</div></div></div>`;
  }

  // ------------------------------------------------------------ BORÇLAR
  const TABS = [['cards', 'Kartlar'], ['loans', 'Krediler'], ['kmh', 'KMH'], ['others', 'Diğer']];
  function viewBorclar() {
    const tab = TABS.some(t => t[0] === ui.sub) ? ui.sub : 'cards';
    const T = R.T;
    const tot = { cards: T.kart, loans: T.kredi, kmh: T.kmh, others: T.diger }[tab];
    let h = `<header class="top"><div><h1>Borçlar</h1><div class="sub">Toplam ${fmtTL(T.borc)}</div></div></header>`;
    h += `<div class="seg">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-go="borclar/${k}">${l} <span class="muted">${DATA[k].length || ''}</span></button>`).join('')}</div>`;
    h += `<div class="row" style="margin-bottom:10px"><div class="small muted">${{ cards: 'Kart borcu', loans: 'Kalan anapara', kmh: 'Kullanılan KMH', others: 'Kalan' }[tab]}: <b class="num" style="color:var(--ink)">${fmtTL(tot)}</b></div>
      <button class="btn" data-add="${tab}" style="min-height:38px;padding:8px 14px">+ Ekle</button></div>`;
    const items = R[tab === 'others' ? 'others' : tab];
    if (!items.length) h += `<div class="card empty">Henüz kayıt yok.<br><br><button class="btn" data-add="${tab}">+ ${{ cards: 'Kredi kartı', loans: 'Kredi', kmh: 'KMH', others: 'Borç' }[tab]} ekle</button></div>`;
    items.forEach(x => { h += ({ cards: cardItem, loans: loanItem, kmh: kmhItem, others: otherItem })[tab](x); });
    return h;
  }
  const poolOf = (src, id) => R.pool.find(p => p.src === src && p.ref.id === id);
  function prioChips(p) { return p && p.N ? chip(p.risk) + `<span class="chip">Öncelik #${p.siraSkor}</span>` : ''; }
  function cardItem(c) {
    const p = poolOf('card', c.id), H = c._H;
    return `<div class="card tap" data-open="card:${c.id}"><div class="row top"><div class="grow"><div class="b">${esc(c.name || 'Kredi kartı')}</div><div class="small muted">${esc(c.bank || '')}${c.son4 ? ' · •••• ' + esc(c.son4) : ''}${c._tr ? ' · tamamını öderim' : ''}</div></div>
      <div class="right"><div class="b num">${tl(c.toplam)}</div><div class="tiny muted">toplam borç</div></div></div>
      ${isNum(H) ? `<div class="bar ${H >= .9 ? 'crit' : H >= .7 ? 'warn' : ''}"><i style="width:${Math.min(100, H * 100)}%"></i></div><div class="tiny muted" style="margin-top:3px">Limit kullanımı %${Math.round(H * 100)} · kullanılabilir ${tl(c._kullanilabilir)}</div>` : ''}
      <div class="grid2">${kv('Dönem borcu', tl(c.donem))}${kv('Kalan asgari', tl(c._kalanAsg))}${kv('Son ödeme', c.sonOdeme ? fmtDate(c.sonOdeme) + ` <span class="muted">(${rel(E.toSerial(c.sonOdeme))})</span>` : '—')}${kv('Asgari ödersen faiz', tl(c._faizAsgari))}</div>
      <div class="chips">${chip(c._odemeDurum)}${prioChips(p)}${c._oranKontrol.charAt(0) === '⚠' ? chip(c._oranKontrol) : ''}${c._asgKontrol.charAt(0) === '⚠' ? chip(c._asgKontrol) : ''}${c._taze.charAt(0) === '⚠' ? chip(c._taze) : ''}</div></div>`;
  }
  function loanItem(l) {
    const p = poolOf('loan', l.id);
    return `<div class="card tap" data-open="loan:${l.id}"><div class="row top"><div class="grow"><div class="b">${esc(l.name || l.tur || 'Kredi')}</div><div class="small muted">${esc(l.bank || '')} · ${esc(l.tur || '')}</div></div>
      <div class="right"><div class="b num">${tl(l.anapara)}</div><div class="tiny muted">kalan anapara</div></div></div>
      <div class="grid2">${kv('Aylık taksit', tl(l.taksit))}${kv('Kalan taksit', blank(l.kalanVade) ? '—' : l.kalanVade + ' ay')}${kv('Sonraki taksit', l._P != null ? fmtDate(l._P) + ` <span class="muted">(${rel(l._P)})</span>` : '—')}${kv('Gerçek aylık maliyet', pctTxt(l._ef))}${kv('Kalan toplam faiz', tl(l._kalanFaiz))}${kv('Bu taksitte faiz', tl(l._faizPay))}</div>
      <div class="chips">${chip(l._durum)}${prioChips(p)}${l._taze.charAt(0) === '⚠' ? chip(l._taze) : ''}</div></div>`;
  }
  function kmhItem(k) {
    const p = poolOf('kmh', k.id), O = k._kullanim;
    return `<div class="card tap" data-open="kmh:${k.id}"><div class="row top"><div class="grow"><div class="b">${esc(k.hesap || 'KMH')}</div><div class="small muted">${esc(k.bank || '')} · KMH / Ek hesap</div></div>
      <div class="right"><div class="b num">${tl(k.kullanilan)}</div><div class="tiny muted">kullanılan</div></div></div>
      ${isNum(O) ? `<div class="bar ${O >= .9 ? 'crit' : O >= .5 ? 'warn' : ''}"><i style="width:${Math.min(100, O * 100)}%"></i></div><div class="tiny muted" style="margin-top:3px">Limit ${tl(k.limit)} · boş ${tl(k._bos)}</div>` : ''}
      <div class="grid2">${kv('Aylık maliyet', tl(k._aylik))}${kv('Günlük maliyet', tl(k._gunlukMaliyet))}${kv('Yıllık maliyet', tl(k._yillik))}${kv('Vergi dahil aylık', pctTxt(k._ef))}</div>
      <div class="chips">${chip(k._durum)}${prioChips(p)}${k._oranKontrol.charAt(0) === '⚠' ? chip(k._oranKontrol) : ''}${k._eslesme.charAt(0) === '⚠' ? chip(k._eslesme) : ''}</div></div>`;
  }
  function otherItem(o) {
    const p = poolOf('other', o.id);
    return `<div class="card tap" data-open="other:${o.id}"><div class="row top"><div class="grow"><div class="b">${esc(o.ad || 'Borç')}</div><div class="small muted">${esc(o.alacakli || '')}${o.tur ? ' · ' + esc(o.tur) : ''}</div></div>
      <div class="right"><div class="b num">${tl(o._kalan)}</div><div class="tiny muted">kalan</div></div></div>
      <div class="grid2">${kv('Aylık ödeme', tl(o.aylik))}${kv('Son ödeme', o.sonOdeme ? fmtDate(o.sonOdeme) + ` <span class="muted">(${rel(E.toSerial(o.sonOdeme))})</span>` : '—')}${kv('Ödenen', tl(o.odenen))}${kv('Faiz', pctTxt(o.faiz))}</div>
      <div class="chips">${o._uyari ? chip(o._uyari) : ''}${o.buAyOdendi ? chip('✅ Bu ay ödendi') : ''}${prioChips(p)}</div></div>`;
  }

  // ------------------------------------------------------------ KARAR
  const KTABS = [['karar', 'Ek para'], ['oncelik', 'Öncelik'], ['neolur', 'Ne olur?'], ['strateji', 'Strateji'], ['stres', 'Stres']];
  function viewKarar() {
    const tab = KTABS.some(t => t[0] === ui.sub) ? ui.sub : 'karar';
    let h = `<header class="top"><div><h1>Karar</h1><div class="sub">Mod: <b>${esc(R.karar.mod)}</b></div></div></header>`;
    h += `<div class="seg">${KTABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-go="karar/${k}">${l}</button>`).join('')}</div>`;
    if (R.T.borc <= 0 && tab !== 'stres') return h + '<div class="card empty">Borç kaydı yok. Önce Borçlar sekmesinden borçlarınızı ekleyin.</div>';
    return h + ({ karar: kKarar, oncelik: kOncelik, neolur: kNeOlur, strateji: kStrateji, stres: kStres })[tab]();
  }
  function kKarar() {
    const k = R.karar;
    let h = `<div class="card"><div class="f"><label for="kararTutar">Elimde ek para var</label><div class="suf"><input class="inp" type="text" inputmode="decimal" id="kararTutar" value="${esc(showNum(DATA.karar.tutar))}" placeholder="ör. 20.000"><span>₺</span></div>
      <div class="help">İkramiye, prim, satış geliri… Uygulama bu parayı nereye koymanız gerektiğini hesaplar.</div></div>
      <div class="chips" style="margin-top:0">${chip({ 'KRİZ': '🔴 KRİZ', 'KORUMA': '🟠 KORUMA', 'DENGE': '🟡 DENGE', 'ATAK': '🟢 ATAK', 'BORÇSUZ': '🟢 BORÇSUZ', 'VERİ EKSİK': '⚠ VERİ EKSİK' }[k.mod])}</div>
      <p class="small">${esc(k.modAciklama)}</p></div>`;
    if (k.tutar > 0) {
      h += `<div class="card" style="border-left:4px solid var(--accent)"><div class="b" style="font-size:16px">${esc(k.metin)}</div>${k.metin2 ? `<p class="small" style="margin-bottom:0">${esc(k.metin2)}</p>` : ''}</div>`;
      const rows = [];
      if (k.k1 > 0) rows.push(['1', 'Gecikmiş ödemeler', '', k.k1, '']);
      if (k.k2 > 0) rows.push(['2', '30 gün içindeki asgari ödemeler için kenara', '', k.k2, '']);
      k.dagitim.filter(d => d.tutar > 0).forEach(d => rows.push([String(rows.length + 1), d.p.ad + (d.kapanir ? ' ✓ kapanır' : ''), '%' + fmtPct(d.p.AP), d.tutar, fmtTL(d.tasarruf)]));
      if (k.rezervde > 0.5) rows.push(['', 'Nakit rezervinde kalsın', '', k.rezervde, '']);
      h += `<div class="card"><h3>Dağılım</h3><div class="tablewrap"><table class="t"><thead><tr><th>#</th><th>Nereye</th><th class="r">Aylık faiz</th><th class="r">Tutar</th><th class="r">Aylık kazanç</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="r">${r[2]}</td><td class="r b">${fmtTL(r[3])}</td><td class="r">${r[4]}</td></tr>`).join('')}</tbody></table></div>
        <div class="note">Aylık faiz: vergiler (KKDF+BSMV) dahil, o borca yatırılan her liranın aylık maliyeti. ${k.mevNet != null ? `Bu orandan düşük faizli borçlar (net mevduat %${fmtPct(k.mevNet)}) ek ödeme listesine alınmaz.` : ''}</div></div>`;
    }
    h += `<div class="card"><h3>Rezerv durumu</h3><div class="grid2">${kv('Aylık zorunlu çıkış', fmtTL(k.zorCikis))}${kv('Nakit', fmtTL(R.T.nakit))}${kv('Nakit yeter', k.dayanma == null ? '—' : fmtNum(k.dayanma, 1) + ' ay')}${kv('Hedef rezerv', fmtTL(k.rezHedef) + ` <span class="muted">(${k.rezAy} ay)</span>`)}${kv('Rezerv açığı', fmtTL(k.rezAcik))}</div></div>`;
    return h;
  }
  function kOncelik() {
    const list = R.act.slice().sort((a, b) => a.siraSkor - b.siraSkor);
    return `<p class="small muted">Her borç faiz, aylık maliyet, son ödemeye yakınlık, gecikme, limit kullanımı, tutar ve nakit etkisine göre 0–100 puanlanır.</p>` + list.map(p => `
      <div class="card tap" data-open="${p.src}:${p.ref.id}"><div class="row top"><div class="grow"><div class="b">#${p.siraSkor} ${esc(p.ad)}</div><div class="small muted">${esc(p.banka)} · ${esc(p.tur)}</div></div>
      <div class="right"><div class="b num">${fmtNum(p.skor, 1)}</div><div class="tiny muted">puan</div></div></div>
      <div class="small" style="margin-top:6px"><b>${esc(p.aksiyon)}</b></div>${p.sebep ? `<div class="small muted">${esc(p.sebep)}</div>` : ''}
      <div class="chips">${chip(p.risk)}<span class="chip">${fmtTL(p.F)}</span>${p.AP > 0 ? `<span class="chip">aylık %${fmtPct(p.AP)}</span>` : ''}${p.eksik ? chip('⚠ Eksik: ' + p.eksik.replace(/; $/, '')) : ''}</div></div>`).join('');
  }
  function simRow(name, s, base) {
    const fark = base ? base.interest - s.interest : null;
    return `<tr><td>${esc(name)}</td><td class="r">${esc(R.gate(R.freeDate(s.free)))}</td><td class="r">${R.uygulanabilir ? fmtTL(s.interest) : '—'}</td><td class="r">${fark != null && R.uygulanabilir ? fmtTL(fark) : ''}</td></tr>`;
  }
  function kNeOlur() {
    const s = R.sims, ek = R.plan.ek;
    let h = `<div class="card"><div class="formgrid"><div class="f"><label for="senEk">Her ay fazladan ödesem</label><div class="suf"><input class="inp" type="text" inputmode="decimal" id="senEk" value="${esc(showNum(DATA.senaryo.ek))}"><span>₺</span></div></div>
      <div class="f"><label for="senTip">Sıklık</label><select class="inp" id="senTip">${['Aylık', 'Tek Seferlik'].map(o => `<option ${DATA.senaryo.tip === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
      <div class="help">Planınızdaki ${fmtTL(ek)} ek ödemenin <b>üstüne</b> eklenir.</div></div>`;
    if (!R.uygulanabilir) h += `<div class="card status crit">${esc(R.planUyari)}</div>`;
    h += `<div class="card"><div class="ctitle">Senaryolara göre borçsuz olma</div><div class="csub">“Tasarruf”: yalnızca asgari/taksit ödemeye göre daha az ödenen faiz</div>
      <div class="tablewrap"><table class="t"><thead><tr><th>Senaryo</th><th class="r">Borçsuz</th><th class="r">Toplam faiz</th><th class="r">Tasarruf</th></tr></thead><tbody>
      ${simRow('Yalnızca asgari / taksit', s.noExtra)}
      ${simRow(`Mevcut plan (+${fmtTL(ek)})`, s.R, s.noExtra)}
      ${DATA.senaryo.ek ? simRow(`Plan + ${fmtTL(DATA.senaryo.ek)} ${DATA.senaryo.tip === 'Aylık' ? '/ay' : 'bir kez'}`, s.custom, s.noExtra) : ''}
      ${[['+10.000 ₺', s.s10], ['+20.000 ₺', s.s20], ['+30.000 ₺', s.s30], ['+50.000 ₺', s.s50]].map(([n, x]) => simRow(`Plan ${n}${DATA.senaryo.tip === 'Aylık' ? '/ay' : ' bir kez'}`, x, s.noExtra)).join('')}
      </tbody></table></div>
      <div class="note">⚠ Gerçek hayat: kart asgarisi her ay borçla birlikte düşer (en az ${fmtTL(R.S.asgTaban)}). Yalnızca o asgariyi öderseniz borçsuz olma: <b>${esc(R.freeText(s.realMin.free))}</b>, toplam faiz ~<b>${fmtTL(s.realMin.interest)}</b>.</div></div>`;
    h += `<div class="card"><div class="ctitle">Kalan borç</div><div class="legend"><span><i style="background:var(--s1)"></i>Senaryonuz</span><span><i style="background:var(--s2)"></i>Mevcut plan</span><span><i style="background:var(--s3)"></i>Yalnızca asgari / taksit</span></div><div id="ch-scen"></div></div>`;
    return h;
  }
  function kStrateji() {
    const A = R.sims.A, B = R.sims.B, rec = R.Rec;
    const box = (k, nm, s, desc) => `<div class="card" style="${rec === k ? 'border:2px solid var(--accent)' : ''}"><div class="row"><div class="b">${nm}</div>${rec === k ? '<span class="chip good">Seçili</span>' : `<button class="btn sec" style="min-height:34px;padding:6px 12px" data-act="strat" data-v="${k}">Bunu seç</button>`}</div>
      <div class="small muted">${desc}</div><div class="grid2">${kv('Toplam faiz', R.uygulanabilir ? fmtTL(s.interest) : '—')}${kv('Borçsuz', esc(R.gate(R.freeDate(s.free))))}${kv('İlk ek ödeme', esc(s.target))}${kv('İlk kapanan', isNum(s.first) ? s.first + '. ay' : esc(s.first))}</div></div>`;
    let h = box('A', 'A — En pahalı borç önce', A, 'Ek para en yüksek aylık faizli borca gider. Matematiksel olarak en az faizi öder.')
      + box('B', 'B — En küçük borç önce (snowball)', B, 'Ek para en küçük borca gider; borçlar daha çabuk “kapanır”, motivasyon verir.');
    h += `<div class="note">${R.snowBedel > 0 ? `Snowball'un ek maliyeti: <b>${fmtTL(R.snowBedel)}</b> daha fazla faiz.` : 'Bu veride iki strateji aynı sonucu veriyor.'}</div>`;
    const rows = R.sims.R.rows.filter(r => r.E > 0);
    h += `<h2>Seçili planda kapanma sırası</h2><div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>Borç</th><th class="r">Bakiye</th><th class="r">Aylık faiz</th><th class="r">Kapanır</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.p.ad)}</td><td class="r">${fmtTL(r.E)}</td><td class="r">%${fmtPct(r.F)}</td><td class="r">${esc(R.gate(isNum(r.payoff) ? E.ayAdi(E.edate(R.ayBasi, r.payoff - 1)) : '10 yıldan uzun'))}</td></tr>`).join('')}
      </tbody></table></div><div class="note">Ayda ${fmtTL(R.plan.min)} asgari/taksit + ${fmtTL(R.plan.ek)} ek ödeme varsayılır. Kapanan borcun taksiti bir sonrakine aktarılır. Yeni harcama yapılmadığı varsayılır; tam ödenen kartlar dahil değildir.</div></div>`;
    return h;
  }
  function kStres() {
    let h = `<div class="card"><h3>Dayanıklılık</h3><p class="small" style="margin:0">${esc(R.dayaniklilik)}</p></div>`;
    R.stres.forEach(s => {
      let det = '';
      if (s.tip === 'gelir') det = kv('Yeni gelir', fmtTL(s.gelir)) + kv('Aylık fark', fmtTL(s.fark)) + kv('Nakit yeter', s.ay === 'Sınırsız' ? 'Sınırsız' : isNum(s.ay) ? fmtNum(s.ay, 1) + ' ay' : '—') + kv('KMH ile', s.kmhAy === 'Sınırsız' ? 'Sınırsız' : isNum(s.kmhAy) ? fmtNum(s.kmhAy, 1) + ' ay' : '—') + kv('3 ay sonra nakit', fmtTL(s.nakit3));
      else if (s.tip === 'gider') det = kv('Gider', fmtTL(s.sok)) + kv('Sonra nakit', fmtTL(s.nakit3)) + kv('Nakit yeter', isNum(s.ay) ? fmtNum(s.ay, 1) + ' ay' : '—') + kv('KMH ile', isNum(s.kmhAy) ? fmtNum(s.kmhAy, 1) + ' ay' : '—');
      else if (s.tip === 'faiz') det = kv('Faiz artışı', '+' + fmtPct(s.sok) + ' puan') + kv('Ek aylık faiz', fmtTL(s.artis)) + kv('Plandan kalan', fmtTL(s.fark));
      else det = kv('Limit düşüşü', '%' + fmtPct(s.sok, 0)) + kv('Yeni kart kullanımı', '%' + fmtPct(s.yeniOran, 0)) + kv('Limit aşımı', fmtTL(s.asim)) + kv('KMH boş limit', fmtTL(s.kmhBos2));
      h += `<div class="card"><div class="row"><div class="b">${esc(s.ad)}</div>${chip(s.sonuc)}</div><div class="grid2">${det}</div></div>`;
    });
    return h;
  }

  // ------------------------------------------------------------ DİĞER
  const PAGES = [
    ['plan', 'Aylık plan', 'Gelir, zorunlu ve değişken giderler'],
    ['hesaplar', 'Hesaplar ve varlıklar', 'Banka bakiyeleri, nakit, döviz, altın, araç'],
    ['takvim', 'Ödeme takvimi', '90 günlük ödeme listesi'],
    ['hareketler', 'Gelir-gider hareketleri', 'Harcama ve gelir kaydı'],
    ['gecmis', 'Geçmiş ve aylık rapor', 'Borç geçmişi, aylık nakit akışı'],
    ['ayarlar', 'Ayarlar', 'Tema, kurlar, rezerv, yasal tavanlar'],
    ['yedek', 'Yedek ve güvenlik', 'Yedekle, geri yükle, PIN, Excel'],
    ['kilavuz', 'Kılavuz', 'Nasıl kullanılır, terimler'],
  ];
  function viewDiger() {
    const pg = PAGES.find(p => p[0] === ui.sub);
    if (!pg) {
      return `<header class="top"><div><h1>Diğer</h1></div></header><div class="card" style="padding:4px 16px"><div class="list">` +
        PAGES.map(([k, t, d]) => `<div class="item tap" data-go="diger/${k}"><div class="grow"><div class="b">${t}</div><div class="small muted">${d}</div></div><span class="muted">${ICON.chev}</span></div>`).join('') + '</div></div>';
    }
    const head = `<header class="top"><button class="iconbtn" data-go="diger" aria-label="Geri">${ICON.back}</button><div class="grow" style="padding-left:6px"><h1 style="font-size:19px">${pg[1]}</h1></div></header>`;
    return head + ({ plan: pPlan, hesaplar: pHesaplar, takvim: pTakvim, hareketler: pHareketler, gecmis: pGecmis, ayarlar: pAyarlar, yedek: pYedek, kilavuz: pKilavuz })[pg[0]]();
  }
  function pPlan() {
    const p = R.plan;
    let h = `<div class="card"><div class="grid2">${kv('Aylık gelir', fmtTL(p.gelir))}${kv('Zorunlu giderler', '−' + fmtTL(p.zorunlu))}${kv('Değişken giderler', '−' + fmtTL(p.degisken))}${kv('Asgari ödeme + taksitler', '−' + fmtTL(p.min))}
      <div class="k b" style="color:var(--ink)">Ay sonunda kalan</div><div class="v b" style="color:${p.kalan < 0 ? 'var(--crit)' : 'var(--ink)'}">${fmtTL(p.kalan)}</div>
      ${kv('→ Borca ek ödeme', fmtTL(p.ek))}${kv('→ Rezerve (%' + fmtPct(R.S.rezervOrani, 0) + ')', fmtTL(Math.max(0, p.kalan - p.ek)))}</div>
      ${p.kalan < 0 ? '<div class="note">⛔ Gelir giderleri ve asgari ödemeleri karşılamıyor.</div>' : ''}<div class="note">Asgari ödeme + taksitler borç kayıtlarınızdan otomatik gelir.</div></div>`;
    ['Gelir', 'Zorunlu', 'Değişken'].forEach(tip => {
      const items = DATA.plan.items.filter(i => i.tip === tip);
      h += `<div class="row" style="margin:18px 0 8px"><h2 style="margin:0">${tip === 'Gelir' ? 'Gelirler' : tip + ' giderler'}</h2><button class="btn sec" style="min-height:34px;padding:6px 12px" data-add="planItems" data-tip="${tip}">+ Ekle</button></div>
        <div class="card" style="padding:4px 16px"><div class="list">${items.length ? items.map(i => `<div class="item tap" data-edit="planItems:${i.id}"><div class="grow">${esc(i.ad)}</div><div class="b num">${tl(i.tutar)}</div></div>`).join('') : '<div class="empty small">Kalem yok</div>'}</div></div>`;
    });
    if (!DATA.plan.items.length) h += `<div class="btns"><button class="btn sec block" data-act="planTemplate">Hazır kalemleri ekle (tutarları siz girersiniz)</button></div>`;
    return h;
  }
  function pHesaplar() {
    const T = R.T;
    let h = `<div class="kpis">${kpi('Banka bakiyesi', fmtTL(T.bankaBakiye), '')}${kpi('Likit varlık', fmtTL(T.likitVarlik), 'nakit, döviz, altın, yatırım')}${kpi('Toplam varlık', fmtTL(T.varlik), '')}</div>`;
    if (T.eksikVarlik) h += `<div class="note" style="margin-bottom:12px">⚠ ${T.eksikVarlik} kayıtta kur eksik: <a href="#/diger/ayarlar">Ayarlar → Kurlar</a>.</div>`;
    h += `<div class="row" style="margin:6px 0 8px"><h2 style="margin:0">Banka hesapları</h2><button class="btn sec" style="min-height:34px;padding:6px 12px" data-add="accounts">+ Ekle</button></div><div class="card" style="padding:4px 16px"><div class="list">`;
    h += R.accounts.length ? R.accounts.map(a => `<div class="item tap" data-edit="accounts:${a.id}"><div class="grow"><div class="b ellipsis">${esc(a.bank)} · ${esc(a.ad)}</div><div class="tiny muted">${esc(a.tur || '')}${a.para && a.para !== 'TRY' ? ' · ' + esc(a.para) : ''}${a.son4 ? ' · IBAN …' + esc(a.son4) : ''}${a._kmhLimit ? ' · KMH boş ' + fmtTL(a._kmhLimit - a._kmhKul) : ''}</div></div><div class="right"><div class="b num">${tl(a.tl)}</div>${a.para && a.para !== 'TRY' ? `<div class="tiny muted">${showNum(a.bakiye)} ${esc(a.para)}</div>` : ''}</div></div>`).join('') : '<div class="empty small">Hesap yok</div>';
    h += `</div></div><div class="row" style="margin:18px 0 8px"><h2 style="margin:0">Nakit ve diğer varlıklar</h2><button class="btn sec" style="min-height:34px;padding:6px 12px" data-add="assets">+ Ekle</button></div><div class="card" style="padding:4px 16px"><div class="list">`;
    h += R.assets.length ? R.assets.map(a => `<div class="item tap" data-edit="assets:${a.id}"><div class="grow"><div class="b ellipsis">${esc(a.ad || a.kategori)}</div><div class="tiny muted">${esc(a.kategori)}${!blank(a.miktar) ? ' · ' + showNum(a.miktar) + ' ' + esc(a.birim || '') : ''}</div></div><div class="b num">${tl(a.tl)}</div></div>`).join('') : '<div class="empty small">Varlık yok</div>';
    return h + '</div></div>';
  }
  function pTakvim() {
    if (!R.events.length) return '<div class="card empty">Ödeme yok.</div>';
    let h = '', last = '';
    R.events.forEach(e => {
      const m = e.date == null ? 'Tarihsiz' : E.ayAdi(e.date);
      if (m !== last) { if (last) h += '</div></div>'; h += `<h2>${esc(m)}</h2><div class="card" style="padding:4px 16px"><div class="list">`; last = m; }
      h += evRow(e);
    });
    return h + '</div></div><div class="note">Kart taksitleri yalnızca bilinen taksitlerdir; yeni harcamalar ve sonraki ekstreler dahil değildir.</div>';
  }
  function pHareketler() {
    const months = Array.from(new Set(R.txs.map(t => t._ay).filter(Boolean).concat([R.curKey]))).sort().reverse();
    const sel = ui.txMonth && months.indexOf(ui.txMonth) >= 0 ? ui.txMonth : months[0];
    const list = R.txs.filter(t => t._ay === sel).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
    const rp = R.raporAy(sel);
    let h = `<div class="row" style="margin-bottom:10px"><select class="inp" id="txMonth" style="max-width:200px">${months.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select>
      <button class="btn" data-add="txs" style="min-height:40px;padding:8px 14px">+ Ekle</button></div>`;
    h += `<div class="card"><div class="grid2">${kv('Gelir', fmtTL(rp.gelir))}${kv('Harcama', fmtTL(rp.gider))}${kv('Faiz / masraf', fmtTL(rp.faiz))}${kv('Borç ödemeleri', fmtTL(rp.borcOdeme))}${kv('Kartla harcanan', fmtTL(rp.kart))}<div class="k b" style="color:var(--ink)">Net nakit akışı</div><div class="v b">${fmtTL(rp.net)}</div></div>
      <div class="note">Borç ödemeleri gider sayılmaz (borcu azaltır). Kartla yapılan harcama, kart borcu ödendiğinde nakitten çıkar; çift sayılmaz.</div></div>`;
    h += `<div class="card" style="padding:4px 16px"><div class="list">` + (list.length ? list.map(t => {
      const inc = N(t.gelir) > 0;
      return `<div class="item tap" data-edit="txs:${t.id}"><div class="datebox"><div class="d1">${t.tarih ? +t.tarih.slice(8, 10) : '?'}</div><div class="d2">${t.tarih ? SHORT_AY[+t.tarih.slice(5, 7) - 1] : ''}</div></div>
        <div class="grow"><div class="b ellipsis">${esc(t.aciklama || t.kategori)}</div><div class="tiny muted ellipsis">${esc(t.kategori)} · ${esc(t._tip)}${t.yontem ? ' · ' + esc(t.yontem) : ''}</div></div>
        <div class="b num" style="color:${inc ? 'var(--good)' : 'var(--ink)'}">${inc ? '+' : '−'}${fmtTL(inc ? t.gelir : t.gider)}</div></div>`;
    }).join('') : '<div class="empty small">Bu ay kayıt yok</div>') + '</div></div>';
    return h;
  }
  function pGecmis() {
    const rows = R.histRows.slice().reverse();
    let h = R.histRows.length >= 2 ? `<div class="card"><div class="legend"><span><i style="background:var(--s1)"></i>Toplam borç</span><span><i style="background:var(--s3)"></i>Toplam varlık</span></div><div id="ch-hist"></div></div>` : '';
    h += `<div class="row" style="margin:6px 0 8px"><h2 style="margin:0">Aylık kayıtlar</h2><button class="btn sec" style="min-height:34px;padding:6px 12px" data-add="history">+ Geçmiş ay</button></div>`;
    h += `<div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>Ay</th><th class="r">Borç</th><th class="r">Değişim</th><th class="r">Net varlık</th><th class="r">Faiz</th></tr></thead><tbody>
      ${rows.map(r => `<tr ${r.ay === R.curKey ? '' : `data-edit="history:${r.ay}" style="cursor:pointer"`}><td>${monthName(r.ay)}${r.ay === R.curKey ? ' <span class="chip">canlı</span>' : ''}</td><td class="r">${tl(r.borc)}</td><td class="r" style="color:${r.degisim < 0 ? 'var(--good)' : r.degisim > 0 ? 'var(--crit)' : 'inherit'}">${r.degisim == null ? '—' : (r.degisim > 0 ? '+' : '') + fmtTL(r.degisim)}</td><td class="r">${tl(r.net)}</td><td class="r">${tl(r.faiz)}</td></tr>`).join('')}
      </tbody></table></div><div class="note">İçinde bulunulan ay her açılışta güncellenir; ay bitince o ayın son hali kalıcı olur. Geçmiş ayları elle ekleyebilir veya düzeltebilirsiniz.</div></div>`;
    h += `<h2>Aylık nakit akışı (hareketlerden)</h2><div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>Ay</th><th class="r">Gelir</th><th class="r">Harcama</th><th class="r">Faiz</th><th class="r">Net</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${monthName(r.ay)}</td><td class="r">${r.adet ? fmtTL(r.gelir) : '—'}</td><td class="r">${r.adet ? fmtTL(r.gider) : '—'}</td><td class="r">${r.adet ? fmtTL(r.faiz) : '—'}</td><td class="r">${r.adet ? fmtTL(r.net) : '—'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return h;
  }
  function settingsObj() {
    const s = Object.assign({}, R.S); s.kur = Object.assign({}, R.S.kur);
    s.tema = (DATA.settings.tema) || 'Otomatik';
    return s;
  }
  function pAyarlar() {
    return `<div class="card" id="setForm">${renderForm(FIELDS.settings, settingsObj())}<div class="btns"><button class="btn" data-act="saveSettings">Kaydet</button></div>
      <div class="note">Yasal tavanlar TCMB kararlarıyla değişir; uygulama tahmin yapmaz. Değişiklikte buradan güncelleyin. Varsayılanlar ${fmtDate(E.DEFAULT_SETTINGS.tavanTarih)} itibarıyla girilmiştir.</div></div>`;
  }
  function pYedek() {
    const lb = DATA.meta.lastBackup;
    return `<div class="card"><h3>Yedekle</h3><p class="small">Tüm verileriniz tek bir dosyaya kaydedilir. ${Store.hasPin() ? '<b>PIN açık olduğu için yedek dosyası da PIN ile şifrelenir.</b>' : 'PIN açmazsanız yedek dosyası şifresizdir; güvenli bir yerde saklayın.'}</p>
        <p class="small muted">Son yedek: ${lb ? fmtDate(lb) : 'hiç'}</p><div class="btns"><button class="btn" data-act="backup">Yedek dosyası oluştur</button></div></div>
      <div class="card"><h3>Geri yükle</h3><p class="small">Bir yedek dosyasını seçin. Bu cihazdaki mevcut verilerin <b>yerine</b> geçer.</p>
        <input type="file" id="restoreFile" accept=".json,application/json" hidden><div class="btns"><button class="btn sec" data-act="restore">Yedek dosyası seç</button></div></div>
      <div class="card"><h3>PIN kilidi</h3><p class="small">${Store.hasPin() ? '✅ PIN açık. Veriler telefonda AES-256 ile şifreli duruyor; uygulama arka plana alınınca 1 dakika sonra kilitlenir.' : 'PIN açarsanız veriler telefonda şifreli saklanır ve uygulama her açılışta PIN ister.'}</p>
        <p class="small muted">PIN'i unutursanız veriler açılamaz; yalnızca silip yedekten dönebilirsiniz.</p>
        <div class="btns"><button class="btn sec" data-act="setPin">${Store.hasPin() ? 'PIN değiştir' : 'PIN belirle'}</button>${Store.hasPin() ? '<button class="btn danger" data-act="removePin">PIN kaldır</button>' : ''}</div></div>
      <div class="card"><h3>Excel'e aktar</h3><p class="small">Tüm tablolar ve hesaplanan sonuçlar tek bir .xlsx dosyasına aktarılır.</p><div class="btns"><button class="btn sec" data-act="excel">Excel dosyası oluştur</button></div></div>
      <div class="card"><h3>Depolama</h3><p class="small" id="storeInfo">Kontrol ediliyor…</p></div>
      <div class="card"><h3>Örnek veri / sıfırla</h3><p class="small">Örnek veri yüklemek veya tümünü silmek mevcut verilerinizi siler.</p>
        <div class="btns"><button class="btn sec" data-act="loadSample">Örnek veriyi yükle</button><button class="btn danger" data-act="wipe">Tümünü sil</button></div></div>`;
  }
  function pKilavuz() {
    const sec = (t, b) => `<div class="card"><h3>${t}</h3><div class="small">${b}</div></div>`;
    return sec('Gizlilik', 'Uygulama internet sunucusuna hiçbir veri göndermez; her şey bu telefonun tarayıcı deposunda kalır. Kart numarasının tamamı, CVV, şifre veya IBAN’ın tamamı istenmez — girmeyin. Yalnızca son 4 hane tutulabilir.')
      + sec('Her ay ne yapmalıyım?', '<b>1.</b> Ekstre gelince: <b>+ → Yeni ekstre</b> ile dönem borcu, asgari ve son ödeme tarihini girin.<br><b>2.</b> Ödeme yapınca: <b>+ → Ödeme yaptım</b>.<br><b>3.</b> Kredi taksiti çekilince: <b>+ → Taksit ödendi</b>.<br><b>4.</b> Ek para gelince: <b>Karar → Ek para</b>.<br><b>5.</b> Ayda bir yedek alın.')
      + sec('Marjinal faiz nedir?', 'Bir borca yatırdığınız her ek liranın size aylık kazandırdığı faiz. Kartta akdi faiz × 1,30 (KKDF %15 + BSMV %15). Kredide kalan taksitlerden hesaplanan gerçek oran. Ek para önce bu oranı en yüksek borca gider.')
      + sec('Karar modları', '<b>KRİZ:</b> gelir zorunlu giderleri + asgari ödemeleri karşılamıyor.<br><b>KORUMA:</b> nakit 1 aydan az; ek para yalnızca tekrar kullanılabilir borca (KMH, devreden kart).<br><b>DENGE:</b> rezerv eksik; ek paranın yarısı rezerve.<br><b>ATAK:</b> rezerv tamam; ek paranın tamamı en pahalı borca.')
      + sec('Hesaplar neye dayanıyor?', 'Kart faizi yalnızca ödenmeyen kısma işler; asgarinin ödenmeyen kısmına gecikme faizi uygulanır. Tamamını ödediğiniz kartlara faiz hesaplanmaz. Simülasyon yeni harcama yapılmadığını ve faiz oranlarının sabit kaldığını varsayar. Erken kapama tutarı için bankanın teklifini girin; uygulama tahmin etmez.')
      + sec('Uyarı', 'Bu uygulama bir hesap aracıdır; finansal danışmanlık değildir. Önemli kararlardan önce bankanızdan güncel tutarları teyit edin.');
  }

  // ------------------------------------------------------------ grafikler
  function afterRender() {
    const H = $('#ch-hist');
    if (H) {
      const rows = R.histRows.slice(-24);
      Ch.line(H, { labels: rows.map(r => monthName(r.ay)), short: (l, i) => { const k = rows[i].ay; return SHORT_AY[+k.slice(5) - 1] + ' ' + k.slice(2, 4); }, fmt: x => fmtTL(x), aria: 'Aylara göre borç ve varlık',
        series: [{ name: 'Borç', color: 'var(--s1)', values: rows.map(r => isNum(r.borc) ? r.borc : null) }, { name: 'Varlık', color: 'var(--s3)', values: rows.map(r => isNum(r.varlik) ? r.varlik : null) }] });
    }
    const P = $('#ch-proj');
    if (P) {
      const s = R.sims, start = s.R.rows.reduce((t, r) => t + r.E, 0);
      const free = isNum(s.R.free) ? s.R.free : 120;
      const n = Math.min(120, Math.max(12, free + 2));
      const lab = [], a = [start], b = [start];
      for (let i = 0; i <= n; i++) lab.push(E.ayAdi(E.edate(R.ayBasi, i - 1)).replace(/^(\S+) (\d+)$/, '$1 $2'));
      for (let i = 0; i < n; i++) { a.push(s.R.tot[i]); b.push(s.noExtra.tot[i]); }
      lab[0] = 'Bugün';
      Ch.line(P, { labels: lab, short: (l, i) => i === 0 ? 'Bugün' : shortMonth(E.edate(R.ayBasi, i - 1)), fmt: x => fmtTL(x), aria: 'Borç projeksiyonu',
        series: [{ name: 'Plan', color: 'var(--s1)', values: a }, { name: 'Yalnızca asgari', color: 'var(--s2)', values: b }] });
    }
    const S2 = $('#ch-scen');
    if (S2) {
      const s = R.sims, start = s.R.rows.reduce((t, r) => t + r.E, 0);
      const fr = [s.custom.free, s.R.free].map(x => isNum(x) ? x : 120);
      const n = Math.min(120, Math.max(12, Math.max(...fr) + 2));
      const lab = ['Bugün'], c = [start], a = [start], b = [start];
      for (let i = 1; i <= n; i++) { lab.push(E.ayAdi(E.edate(R.ayBasi, i - 1))); c.push(s.custom.tot[i - 1]); a.push(s.R.tot[i - 1]); b.push(s.noExtra.tot[i - 1]); }
      Ch.line(S2, { labels: lab, short: (l, i) => i === 0 ? 'Bugün' : shortMonth(E.edate(R.ayBasi, i - 1)), fmt: x => fmtTL(x), aria: 'Senaryo karşılaştırması',
        series: [{ name: 'Senaryonuz', color: 'var(--s1)', values: c }, { name: 'Mevcut plan', color: 'var(--s2)', values: a }, { name: 'Yalnızca asgari', color: 'var(--s3)', values: b }] });
    }
    const D = $('#ch-dist');
    if (D) {
      const items = R.act.slice().sort((x, y) => y.F - x.F);
      const top = items.slice(0, 7).map(p => ({ label: p.ad, value: p.F, sub: p.tur + (p.AP > 0 ? ' · aylık %' + fmtPct(p.AP) : '') }));
      const rest = items.slice(7).reduce((t, p) => t + p.F, 0);
      if (rest > 0) top.push({ label: 'Diğer', value: rest, sub: (items.length - 7) + ' borç' });
      Ch.barsH(D, { items: top, fmt: x => fmtTL(x), aria: 'Borç dağılımı' });
    }
    const si = $('#storeInfo');
    if (si) Promise.all([Store.persist(), Store.usage()]).then(([p, u]) => {
      si.innerHTML = (p ? '✅ Kalıcı depolama izni verildi: tarayıcı yer açmak için verilerinizi silmez.' : '⚠ Tarayıcı kalıcı depolama izni vermedi. Uygulamayı ana ekrana ekleyin ve düzenli yedek alın.')
        + (u && u.usage != null ? `<br><span class="muted">Kullanılan alan: ${fmtNum(u.usage / 1024, 0)} KB</span>` : '');
    });
  }

  // ------------------------------------------------------------ sayfa (sheet)
  function openSheet(title, body, onMount) {
    const sh = $('#sheet');
    sh.innerHTML = `<div class="backdrop" data-act="closeSheet"></div><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh"><h3>${esc(title)}</h3><button class="iconbtn" data-act="closeSheet" aria-label="Kapat">${ICON.x}</button></div><div class="sb">${body}</div></div>`;
    sh.classList.add('open'); document.body.style.overflow = 'hidden';
    if (onMount) onMount($('.sb', sh));
  }
  function closeSheet() { const sh = $('#sheet'); sh.classList.remove('open'); sh.innerHTML = ''; document.body.style.overflow = ''; ui.confirmDel = null; }

  const COL_TITLE = { cards: 'Kredi kartı', loans: 'Kredi', kmh: 'KMH / Ek hesap', others: 'Diğer borç', accounts: 'Banka hesabı', assets: 'Varlık', txs: 'Hareket', planItems: 'Plan kalemi', history: 'Geçmiş ay' };
  const SRC_COL = { card: 'cards', loan: 'loans', kmh: 'kmh', other: 'others' };

  function detailBox(col, id) {
    const map = { cards: 'card', loans: 'loan', kmh: 'kmh', others: 'other' };
    if (!map[col] || !id) return '';
    const p = poolOf(map[col], id);
    let x = '';
    if (col === 'cards') { const c = R.cards.find(c => c.id === id); x = kv('Asgari ödersen bu ay faiz', tl(c._faizAsgari)) + kv('Girilen ödemeyle faiz', tl(c._faizGirilen)) + kv('Marjinal faiz (aylık)', pctTxt(c._marj)) + kv('Yasal asgari kontrol', esc(c._asgKontrol || '—')) + kv('TCMB tavanı', esc(c._oranKontrol || '—')); }
    if (col === 'loans') { const l = R.loans.find(l => l.id === id); x = kv('Gerçek aylık oran', pctTxt(l._ef)) + kv('Kalan toplam ödeme', tl(l._toplamKalan)) + kv('Kalan toplam faiz', tl(l._kalanFaiz)) + kv('Bu taksitte faiz / anapara', tl(l._faizPay) + ' / ' + tl(l._anaparaPay)) + (l._kacinilan != null ? kv('Erken kapamayla kaçınılan', tl(l._kacinilan)) : '') + (l._tazminat != null ? kv('Konut erken ödeme tazminatı (yasal üst sınır)', tl(l._tazminat)) : ''); }
    if (col === 'kmh') { const k = R.kmh.find(k => k.id === id); x = kv('Aylık maliyet', tl(k._aylik)) + kv('Günlük maliyet', tl(k._gunlukMaliyet)) + (k._gunBazli != null ? kv(k.gun + ' gün maliyeti', tl(k._gunBazli)) : '') + kv('Eşleşme', esc(k._eslesme)); }
    if (col === 'others') { const o = R.others.find(o => o.id === id); x = kv('Kalan', tl(o._kalan)) + kv('30 gün içinde', tl(o._due30)) + (o._uyari ? `<div class="k" style="grid-column:span 2">${esc(o._uyari)}</div>` : ''); }
    if (p && p.N) x += kv('Öncelik puanı', fmtNum(p.skor, 1) + ' (#' + p.siraSkor + ')') + kv('Öneri', esc(p.aksiyon));
    return `<div class="card"><div class="grid2" style="margin-top:0">${x}</div>${p && p.sebep ? `<div class="note">Neden: ${esc(p.sebep)}</div>` : ''}</div>`;
  }
  function openEdit(col, id, preset) {
    let obj;
    if (col === 'history') obj = id ? Object.assign({ ay: id }, DATA.history[id]) : {};
    else obj = id ? arr(col).find(x => x.id === id) : Object.assign({}, preset || {});
    if (!obj) return;
    if (col === 'txs' && obj) { obj = Object.assign({}, obj); if (id) obj.tutar = N(obj.gelir) > 0 ? obj.gelir : obj.gider; else if (!obj.tarih) obj.tarih = todayStr(); }
    if (!id && col === 'kmh' && obj.vergi == null) obj.vergi = 0.30;
    const body = detailBox(col, id) + `<div id="editForm">${renderForm(FIELDS[col], obj)}</div>
      <div class="btns"><button class="btn" data-act="saveEdit" data-col="${col}" data-id="${esc(id || '')}">Kaydet</button></div>
      ${id ? `<div class="btns"><button class="btn danger" data-act="del" data-col="${col}" data-id="${esc(id)}">Sil</button></div>` : ''}
      ${['cards', 'loans', 'kmh', 'others'].indexOf(col) >= 0 ? '<p class="tiny muted">Bilmediğiniz alanları boş bırakın; uygulama tahmin etmez, eksik olarak işaretler.</p>' : ''}`;
    openSheet((id ? '' : 'Yeni ') + COL_TITLE[col].toLowerCase().replace(/^./, c => c.toUpperCase()), body);
  }
  async function saveEdit(col, id) {
    const root = $('#editForm');
    let base = col === 'history' ? (id ? Object.assign({ ay: id }, DATA.history[id]) : {}) : (id ? arr(col).find(x => x.id === id) : {});
    const v = readForm(FIELDS[col], root, base);
    if (!v) return;
    if (col === 'history') {
      if (v.ay >= R.curKey) { toast('İçinde bulunulan ay otomatik kaydedilir; geçmiş bir ay girin.'); return; }
      if (id && id !== v.ay) delete DATA.history[id];
      DATA.history[v.ay] = { borc: v.borc, varlik: v.varlik, faiz: v.faiz, kilit: true };
      closeSheet(); return commit('Kaydedildi');
    }
    if (col === 'txs') {
      const tip = E.CAT_TYPES[v.kategori];
      v.gelir = tip === 'Gelir' ? v.tutar : null; v.gider = tip === 'Gelir' ? null : v.tutar; delete v.tutar;
    }
    if (col === 'cards' && N(v.kalanTaksit) > N(v.taksitSayisi) && !blank(v.taksitSayisi)) { toast('Kalan taksit toplam taksitten fazla olamaz'); return; }
    if (col === 'others' && N(v.odenen) > N(v.tutar)) { toast('Ödenen, toplam borçtan fazla olamaz'); return; }
    if (['cards', 'loans', 'kmh', 'others', 'accounts'].indexOf(col) >= 0) v.guncelleme = todayStr();
    if (id) { const i = arr(col).findIndex(x => x.id === id); arr(col)[i] = v; }
    else { v.id = uid(); arr(col).push(v); }
    closeSheet(); await commit('Kaydedildi');
  }
  async function del(col, id, btn) {
    if (ui.confirmDel !== col + id) { ui.confirmDel = col + id; btn.textContent = 'Emin misiniz? Silmek için tekrar dokunun'; return; }
    if (col === 'history') delete DATA.history[id];
    else { const a = arr(col), i = a.findIndex(x => x.id === id); if (i >= 0) a.splice(i, 1); }
    closeSheet(); await commit('Silindi');
  }

  // ------------------------------------------------------------ hızlı işlemler
  function quickMenu() {
    const it = (act, t, d) => `<div class="item tap" data-act="${act}"><div class="grow"><div class="b">${t}</div><div class="small muted">${d}</div></div><span class="muted">${ICON.chev}</span></div>`;
    openSheet('Hızlı işlem', `<div class="card" style="padding:4px 16px"><div class="list">
      ${it('qPay', 'Ödeme yaptım', 'Karta, KMH\'ye veya diğer borca ödeme')}
      ${it('qStatement', 'Yeni ekstre geldi', 'Kartın yeni dönem bilgileri')}
      ${it('qInstall', 'Kredi taksiti ödendi', 'Kalan taksit ve anaparayı güncelle')}
      ${it('qTx', 'Harcama / gelir ekle', 'Gelir-gider hareketi')}
      ${it('qBalance', 'Banka bakiyesi güncelle', 'Hesap bakiyelerini hızlıca düzelt')}</div></div>
      <div class="small muted">Yeni borç eklemek için: Borçlar → + Ekle</div>`);
  }
  const debtOptions = (filter) => [
    ...R.cards.filter(c => filter !== 'card-only' || true).map(c => ['card:' + c.id, `💳 ${c.bank || ''} ${c.name || ''} — ${tl(c.toplam)}`]),
    ...(filter === 'card-only' ? [] : R.kmh.map(k => ['kmh:' + k.id, `🏦 ${k.bank || ''} ${k.hesap || ''} KMH — ${tl(k.kullanilan)}`])),
    ...(filter === 'card-only' ? [] : R.others.filter(o => N(o._kalan) > 0).map(o => ['other:' + o.id, `📄 ${o.ad || ''} — ${tl(o._kalan)}`])),
  ];
  function qPay() {
    const opts = debtOptions();
    if (!opts.length) { toast('Önce bir kart, KMH veya borç ekleyin'); return; }
    openSheet('Ödeme yaptım', `<div id="qf"><div class="f"><label>Neye ödeme yaptınız?</label><select id="qDebt">${opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></div>
      <div class="f"><label>Tutar</label><div class="suf"><input type="text" inputmode="decimal" id="qAmt" placeholder="0"><span>₺</span></div><div class="help" id="qHint"></div></div>
      <div class="f"><label class="sw"><span>Hareketlere de kaydet</span><input type="checkbox" id="qLog" checked></label></div>
      <div class="btns"><button class="btn" data-act="qPaySave">Kaydet</button></div></div>`, () => { const s = $('#qDebt'); const upd = () => { $('#qHint').textContent = payHint(s.value); }; s.addEventListener('change', upd); upd(); });
  }
  function payHint(v) {
    const [src, id] = v.split(':');
    if (src === 'card') { const c = R.cards.find(c => c.id === id); return `Kalan asgari ${tl(c._kalanAsg)} · dönem borcunun kalanı ${tl(Math.max(0, N(c.donem) + N(c.gecikmis) - N(c.odenen)))}`; }
    if (src === 'kmh') { const k = R.kmh.find(k => k.id === id); return `Kullanılan ${tl(k.kullanilan)}`; }
    const o = R.others.find(o => o.id === id); return `Kalan ${tl(o._kalan)}`;
  }
  async function qPaySave() {
    const [src, id] = $('#qDebt').value.split(':'), amt = parseNum($('#qAmt').value);
    if (!(amt > 0)) { toast('Tutar girin'); return; }
    let cat = 'Diğer Borç Ödemesi', name = '';
    if (src === 'card') { const c = DATA.cards.find(c => c.id === id); c.odenen = N(c.odenen) + amt; if (!blank(c.toplam)) c.toplam = Math.max(0, c.toplam - amt); c.guncelleme = todayStr(); cat = 'Kredi Kartı Ödemesi'; name = (c.bank || '') + ' ' + (c.name || ''); }
    else if (src === 'kmh') { const k = DATA.kmh.find(k => k.id === id); k.kullanilan = Math.max(0, N(k.kullanilan) - amt); k.guncelleme = todayStr(); cat = 'KMH Ödemesi'; name = (k.bank || '') + ' KMH'; }
    else { const o = DATA.others.find(o => o.id === id); o.odenen = Math.min(N(o.tutar), N(o.odenen) + amt); if (N(o.aylik) > 0) o.buAyOdendi = true; o.guncelleme = todayStr(); name = o.ad || ''; }
    if ($('#qLog').checked) DATA.txs.push({ id: uid(), tarih: todayStr(), aciklama: name.trim() + ' ödemesi', kategori: cat, gelir: null, gider: amt, yontem: 'Banka Kartı', hesap: '' });
    closeSheet(); await commit('Ödeme kaydedildi');
  }
  function qStatement() {
    if (!R.cards.length) { toast('Önce bir kredi kartı ekleyin'); return; }
    openSheet('Yeni ekstre', `<div class="f"><label>Kart</label><select id="qCard">${R.cards.map(c => `<option value="${c.id}">${esc((c.bank || '') + ' ' + (c.name || ''))}</option>`).join('')}</select></div><div id="qStForm"></div>
      <div class="btns"><button class="btn" data-act="qStSave">Kaydet</button></div><p class="tiny muted">Ekstredeki değerleri girin. "Bu dönem ödenen" sıfırlanır.</p>`, () => {
      const s = $('#qCard'); const upd = () => { const c = DATA.cards.find(c => c.id === s.value); $('#qStForm').innerHTML = renderForm(ST_FIELDS, Object.assign({}, c, { donem: null, asgari: null, ekstre: null, sonOdeme: null, gecikmis: null })); };
      s.addEventListener('change', upd); upd();
    });
  }
  const ST_FIELDS = [
    { k: 'donem', l: 'Dönem borcu', t: 'money', req: 1 }, { k: 'asgari', l: 'Asgari ödeme', t: 'money', req: 1 },
    { k: 'ekstre', l: 'Ekstre tarihi', t: 'date' }, { k: 'sonOdeme', l: 'Son ödeme tarihi', t: 'date', req: 1 },
    { k: 'gecikmis', l: 'Gecikmiş tutar', t: 'money' }, { k: 'toplam', l: 'Toplam güncel borç', t: 'money' },
    { k: 'akdi', l: 'Akdi faiz', t: 'pct' }, { k: 'kalanTaksit', l: 'Kalan taksit', t: 'int' },
  ];
  async function qStSave() {
    const id = $('#qCard').value, c = DATA.cards.find(c => c.id === id);
    const v = readForm(ST_FIELDS, $('#qStForm'), c); if (!v) return;
    Object.assign(c, v, { odenen: 0, guncelleme: todayStr() });
    closeSheet(); await commit('Ekstre kaydedildi');
  }
  function qInstall() {
    const ls = R.loans.filter(l => N(l.anapara) > 0);
    if (!ls.length) { toast('Aktif kredi yok'); return; }
    openSheet('Kredi taksiti ödendi', `<div class="f"><label>Kredi</label><select id="qLoan">${ls.map(l => `<option value="${l.id}">${esc((l.bank || '') + ' ' + (l.name || l.tur || ''))}</option>`).join('')}</select></div><div id="qLnForm"></div>
      <div class="f"><label class="sw"><span>Hareketlere de kaydet</span><input type="checkbox" id="qLog" checked></label></div>
      <div class="btns"><button class="btn" data-act="qLnSave">Kaydet</button></div>`, () => {
      const s = $('#qLoan'); const upd = () => {
        const l = R.loans.find(l => l.id === s.value);
        const yeni = isNum(l._anaparaPay) ? Math.max(0, Math.round((N(l.anapara) - l._anaparaPay) * 100) / 100) : null;
        $('#qLnForm').innerHTML = renderForm(LN_FIELDS, { tarih: l._P != null ? E.fromSerial(l._P) : todayStr(), taksit: l.taksit, kalanVade: Math.max(0, N(l.kalanVade) - 1), anapara: yeni })
          + `<div class="note">Yeni kalan anapara, taksitin faiz/anapara ayrımıyla hesaplandı (${tl(l._faizPay)} faiz + ${tl(l._anaparaPay)} anapara). Bankanızın gösterdiği tutar farklıysa onu yazın.</div>`;
      }; s.addEventListener('change', upd); upd();
    });
  }
  const LN_FIELDS = [{ k: 'tarih', l: 'Ödeme tarihi', t: 'date', req: 1 }, { k: 'taksit', l: 'Ödenen taksit', t: 'money', req: 1 }, { k: 'kalanVade', l: 'Kalan taksit sayısı', t: 'int', req: 1 }, { k: 'anapara', l: 'Yeni kalan anapara', t: 'money', req: 1 }];
  async function qLnSave() {
    const id = $('#qLoan').value, l = DATA.loans.find(l => l.id === id);
    const v = readForm(LN_FIELDS, $('#qLnForm'), {}); if (!v) return;
    l.sonOdenen = v.tarih; l.kalanVade = v.kalanVade; l.anapara = v.anapara; l.guncelleme = todayStr();
    if ($('#qLog').checked) DATA.txs.push({ id: uid(), tarih: v.tarih, aciklama: ((l.bank || '') + ' ' + (l.name || '')).trim() + ' taksiti', kategori: 'Kredi Taksiti', gelir: null, gider: v.taksit, yontem: l.otomatik ? 'Otomatik Ödeme' : 'Banka Kartı', hesap: '' });
    closeSheet(); await commit('Taksit kaydedildi');
  }
  function qBalance() {
    if (!DATA.accounts.length) { closeSheet(); openEdit('accounts', null); return; }
    openSheet('Banka bakiyeleri', `<div id="qBal">${DATA.accounts.map(a => `<div class="f"><label>${esc(a.bank)} · ${esc(a.ad)}${a.para && a.para !== 'TRY' ? ' (' + esc(a.para) + ')' : ''}</label><div class="suf"><input type="text" inputmode="decimal" data-acc="${a.id}" value="${esc(showNum(a.bakiye))}"><span>${a.para && a.para !== 'TRY' ? '' : '₺'}</span></div></div>`).join('')}</div>
      <div class="btns"><button class="btn" data-act="qBalSave">Kaydet</button></div>`);
  }
  async function qBalSave() {
    let bad = false;
    $$('#qBal [data-acc]').forEach(i => { const v = parseNum(i.value); if (v == null || Number.isNaN(v) || v < 0) { bad = true; i.closest('.f').classList.add('bad'); } });
    if (bad) { toast('Geçerli, eksi olmayan tutarlar girin'); return; }
    $$('#qBal [data-acc]').forEach(i => { const a = DATA.accounts.find(a => a.id === i.dataset.acc); a.bakiye = parseNum(i.value); a.guncelleme = todayStr(); });
    closeSheet(); await commit('Bakiyeler güncellendi');
  }

  // ------------------------------------------------------------ yedek / PIN / excel
  async function shareOrDownload(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  }
  async function doBackup() {
    if (window.CFO_DEMO) { toast('Önizlemede kapalı — telefona kurduğunuz uygulamada çalışır'); return; }
    const blob = await Store.backupBlob(DATA);
    const ok = await shareOrDownload(blob, `kisisel-cfo-yedek-${todayStr()}.json`);
    if (ok) { DATA.meta.lastBackup = todayStr(); await commit('Yedek oluşturuldu'); }
  }
  function askPin(title, confirm) {
    return new Promise(resolve => {
      openSheet(title, `<div class="f"><label for="pin1">PIN (4–8 rakam)</label><input type="password" inputmode="numeric" id="pin1" autocomplete="off" maxlength="8"></div>
        ${confirm ? '<div class="f"><label for="pin2">PIN tekrar</label><input type="password" inputmode="numeric" id="pin2" autocomplete="off" maxlength="8"></div>' : ''}
        <div class="f"><div class="err" id="pinErr" hidden></div></div><div class="btns"><button class="btn" id="pinOk">Tamam</button></div>`, sb => {
        $('#pin1').focus();
        let done = false;
        const fin = v => { if (done) return; done = true; resolve(v); };
        $('#pinOk').onclick = () => {
          const a = $('#pin1').value, b = confirm ? $('#pin2').value : a, err = $('#pinErr');
          if (!/^\d{4,8}$/.test(a)) { err.hidden = false; err.textContent = 'PIN 4–8 rakam olmalı'; return; }
          if (a !== b) { err.hidden = false; err.textContent = 'PIN\'ler aynı değil'; return; }
          fin(a); closeSheet();
        };
        $$('[data-act=closeSheet]').forEach(x => x.addEventListener('click', () => fin(null), { once: true }));
      });
    });
  }
  async function restore(file) {
    try {
      const text = await file.text();
      const d = await Store.parseBackup(text, () => askPin('Yedeğin PIN\'i', false));
      DATA = normalize(d); R = null;
      await commit('Yedek geri yüklendi');
    } catch (e) { toast('⚠ Geri yüklenemedi: ' + (e.name === 'OperationError' ? 'PIN yanlış' : e.message)); }
  }
  function loadScript(src) { return new Promise((res, rej) => { if (window.XLSX) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Dosya yüklenemedi')); document.head.appendChild(s); }); }
  async function exportExcel() {
    if (window.CFO_DEMO) { toast('Önizlemede kapalı — telefona kurduğunuz uygulamada çalışır'); return; }
    try { await loadScript('xlsx.mini.min.js'); } catch (e) { toast('⚠ Excel modülü yüklenemedi'); return; }
    const X = window.XLSX, wb = X.utils.book_new();
    const pc = v => isNum(v) ? Math.round(v * 1e6) / 1e4 : (v == null ? '' : v);
    const nv = v => isNum(v) ? Math.round(v * 100) / 100 : (v == null ? '' : v);
    const add = (name, head, rows) => { const ws = X.utils.aoa_to_sheet([head, ...rows]); ws['!cols'] = head.map(h => ({ wch: Math.max(10, Math.min(36, String(h).length + 2)) })); X.utils.book_append_sheet(wb, ws, name); };
    const T = R.T;
    add('Özet', ['Gösterge', 'Değer'], [['Rapor tarihi', fmtDate(R.today)], ['Durum', R.durumBaslik], ['Toplam borç', nv(T.borc)], ['30 gün içinde asgari', nv(T.t30Asgari)], ['30 gün içinde tamamı', nv(T.t30Tam)],
      ['Aylık faiz yükü', nv(T.aylikFaiz)], ['Nakit', nv(T.nakit)], ['Toplam varlık', nv(T.varlik)], ['Net varlık', nv(T.netVarlik)], ['Karar modu', R.karar.mod],
      ['Borçsuz (plan)', R.gate(R.freeDate(R.sims.R.free))], ['Toplam faiz (plan)', nv(R.sims.R.interest)], [], ['CFO önerileri', ''], ...R.cfo.map(s => [s, ''])]);
    add('Kredi Kartları', ['Banka', 'Kart', 'Son 4', 'Limit', 'Dönem borcu', 'Toplam borç', 'Asgari', 'Gecikmiş', 'Ekstre', 'Son ödeme', 'Akdi %', 'Gecikme %', 'Nakit av. %', 'Nakit av. borcu', 'Kalan taksit', 'Aylık taksit', 'Tamamını öder', 'Bu dönem ödenen', 'Durum', 'Faiz (asgari ödenirse)', 'Marjinal %'],
      R.cards.map(c => [c.bank, c.name, c.son4, nv(c.limit), nv(c.donem), nv(c.toplam), nv(c.asgari), nv(c.gecikmis), c.ekstre, c.sonOdeme, pc(c.akdi), pc(c.gecFaiz), pc(c.nakitFaiz), nv(c.nakitBorc), c.kalanTaksit, nv(c.aylikTaksit), c._tr ? 'Evet' : 'Hayır', nv(c.odenen), c._odemeDurum, nv(c._faizAsgari), pc(c._marj)]));
    add('Krediler', ['Banka', 'Kredi', 'Tür', 'Kalan anapara', 'Taksit', 'Kalan vade', 'Aylık faiz %', 'Taksit günü', 'Otomatik', 'Son ödenen', 'Sonraki taksit', 'Gerçek aylık oran %', 'Kalan toplam faiz', 'Erken kapama teklifi', 'Durum'],
      R.loans.map(l => [l.bank, l.name, l.tur, nv(l.anapara), nv(l.taksit), l.kalanVade, pc(l.faiz), l.taksitGunu, l.otomatik ? 'Evet' : 'Hayır', l.sonOdenen, l._P != null ? E.fromSerial(l._P) : '', pc(l._ef), nv(l._kalanFaiz), nv(l.erkenTeklif), l._durum]));
    add('KMH', ['Banka', 'Hesap', 'Limit', 'Kullanılan', 'Aylık faiz %', 'Vergi %', 'Aylık maliyet', 'Durum'], R.kmh.map(k => [k.bank, k.hesap, nv(k.limit), nv(k.kullanilan), pc(k.faiz), pc(k.vergi), nv(k._aylik), k._durum]));
    add('Diğer Borçlar', ['Borç', 'Alacaklı', 'Tür', 'Toplam', 'Ödenen', 'Kalan', 'Son ödeme', 'Aylık', 'Faiz %', 'Öncelik', 'Uyarı'], R.others.map(o => [o.ad, o.alacakli, o.tur, nv(o.tutar), nv(o.odenen), nv(o._kalan), o.sonOdeme, nv(o.aylik), pc(o.faiz), o.oncelik, o._uyari]));
    add('Banka Hesapları', ['Banka', 'Hesap', 'Tür', 'Para', 'Bakiye', 'TL karşılığı', 'IBAN son 4'], R.accounts.map(a => [a.bank, a.ad, a.tur, a.para, nv(a.bakiye), nv(a.tl), a.son4]));
    add('Varlıklar', ['Kategori', 'Açıklama', 'Birim', 'Miktar', 'TL değeri'], R.assets.map(a => [a.kategori, a.ad, a.birim, nv(a.miktar), nv(a.tl)]));
    add('Aylık Plan', ['Kalem', 'Tür', 'Tutar'], DATA.plan.items.map(i => [i.ad, i.tip, nv(i.tutar)]).concat([[], ['Ay sonunda kalan', '', nv(R.plan.kalan)], ['Borca ek ödeme', '', nv(R.plan.ek)]]));
    add('Öncelik', ['Sıra', 'Borç', 'Banka', 'Tür', 'Bakiye', 'Marjinal aylık %', 'Puan', 'Risk', 'Öneri', 'Neden'], R.act.slice().sort((a, b) => a.siraSkor - b.siraSkor).map(p => [p.siraSkor, p.ad, p.banka, p.tur, nv(p.F), pc(p.AP), p.skor, p.risk, p.aksiyon, p.sebep]));
    add('Ödeme Takvimi', ['Tarih', 'Borç', 'Banka', 'Tutar', 'En az', 'Durum', 'Not'], R.events.map(e => [e.date != null ? E.fromSerial(e.date) : '', e.p.ad, e.p.banka, nv(e.tutar), nv(e.asgari), e.durum, e.not]));
    add('Hareketler', ['Tarih', 'Açıklama', 'Kategori', 'Tür', 'Gelir', 'Gider', 'Yöntem', 'Hesap'], R.txs.slice().sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '')).map(t => [t.tarih, t.aciklama, t.kategori, t._tip, nv(t.gelir), nv(t.gider), t.yontem, t.hesap]));
    add('Borç Geçmişi', ['Ay', 'Toplam borç', 'Değişim', 'Toplam varlık', 'Net varlık', 'Aylık faiz'], R.histRows.map(h => [h.ay, nv(h.borc), nv(h.degisim), nv(h.varlik), nv(h.net), nv(h.faiz)]));
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    await shareOrDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `kisisel-cfo-${todayStr()}.xlsx`);
  }

  // ------------------------------------------------------------ olaylar
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-act],[data-go],[data-open],[data-edit],[data-add]');
    if (!t) return;
    if (t.dataset.go) { e.preventDefault(); closeSheet(); go(...t.dataset.go.split('/')); return; }
    if (t.dataset.open) { const [src, id] = t.dataset.open.split(':'); openEdit(SRC_COL[src], id); return; }
    if (t.dataset.edit) { const [col, id] = t.dataset.edit.split(':'); openEdit(col, id); return; }
    if (t.dataset.add) { openEdit(t.dataset.add, null, t.dataset.tip ? { tip: t.dataset.tip } : null); return; }
    const a = t.dataset.act;
    if (t.tagName === 'A') e.preventDefault();
    if (a === 'closeSheet') return closeSheet();
    if (a === 'saveEdit') return saveEdit(t.dataset.col, t.dataset.id || null);
    if (a === 'del') return del(t.dataset.col, t.dataset.id, t);
    if (a === 'quick') return quickMenu();
    if (a === 'qPay') return qPay(); if (a === 'qPaySave') return qPaySave();
    if (a === 'qStatement') return qStatement(); if (a === 'qStSave') return qStSave();
    if (a === 'qInstall') return qInstall(); if (a === 'qLnSave') return qLnSave();
    if (a === 'qTx') { closeSheet(); return openEdit('txs', null); }
    if (a === 'qBalance') return qBalance(); if (a === 'qBalSave') return qBalSave();
    if (a === 'strat') { DATA.settings.strateji = t.dataset.v; return commit('Strateji değişti'); }
    if (a === 'saveSettings') {
      const v = readForm(FIELDS.settings, $('#setForm'), {}); if (!v) return;
      const s = DATA.settings;
      FIELDS.settings.forEach(f => { if (f.sec) return; const val = getPath(v, f.k); if (val == null || val === '') { if (f.k.indexOf('.') > 0) setPath(s, f.k, null); else delete s[f.k]; } else setPath(s, f.k, val); });
      return commit('Ayarlar kaydedildi');
    }
    if (a === 'planTemplate') {
      [['Maaş', 'Gelir'], ['Kira', 'Zorunlu'], ['Faturalar', 'Zorunlu'], ['Market', 'Zorunlu'], ['Ulaşım', 'Zorunlu'], ['İletişim', 'Zorunlu'], ['Restoran / Eğlence', 'Değişken'], ['Giyim', 'Değişken']]
        .forEach(([ad, tip]) => DATA.plan.items.push({ id: uid(), ad, tip, tutar: null }));
      return commit('Kalemler eklendi; tutarları girin');
    }
    if (a === 'backup') return doBackup();
    if (window.CFO_DEMO && (a === 'restore' || a === 'setPin')) { toast('Önizlemede kapalı — telefona kurduğunuz uygulamada çalışır'); return; }
    if (a === 'restore') { const f = $('#restoreFile'); f.value = ''; f.onchange = () => f.files[0] && restore(f.files[0]); f.click(); return; }
    if (a === 'setPin') { const p = await askPin(Store.hasPin() ? 'Yeni PIN' : 'PIN belirle', true); if (p) { await Store.setPin(p, DATA); toast('PIN açıldı — veriler şifrelendi'); render(); } return; }
    if (a === 'removePin') { if (ui.confirmDel !== 'pin') { ui.confirmDel = 'pin'; t.textContent = 'Emin misiniz? Tekrar dokunun'; return; } ui.confirmDel = null; await Store.setPin(null, DATA); toast('PIN kaldırıldı'); return render(); }
    if (a === 'excel') return exportExcel();
    if (a === 'lock') return lockNow();
    if (a === 'loadSample' || a === 'wipe') {
      if (!isEmpty() && ui.confirmDel !== a) { ui.confirmDel = a; t.textContent = 'Mevcut veriler silinecek. Emin misiniz?'; return; }
      ui.confirmDel = null;
      DATA = a === 'wipe' ? emptyData() : normalize(window.CFO_SAMPLE());
      if (a === 'loadSample') { DATA.meta.sample = true; }
      R = null; await commit(a === 'wipe' ? 'Tüm veriler silindi' : 'Örnek veri yüklendi'); go('panel'); return;
    }
  });
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'kararTutar') { const v = parseNum(e.target.value); DATA.karar.tutar = Number.isNaN(v) ? null : v; commit(); }
    if (id === 'senEk') { const v = parseNum(e.target.value); DATA.senaryo.ek = Number.isNaN(v) || v == null ? 0 : v; commit(); }
    if (id === 'senTip') { DATA.senaryo.tip = e.target.value; commit(); }
    if (id === 'txMonth') { ui.txMonth = e.target.value; render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet').classList.contains('open')) closeSheet(); if (e.key === 'Enter' && e.target.id === 'kararTutar') e.target.blur(); });

  // ------------------------------------------------------------ kilit
  let hiddenAt = null;
  function lockNow() { if (Store.lock()) { DATA = null; R = null; closeSheet(); $('#main').innerHTML = ''; showLock(); } }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Store.hasPin() && Date.now() - hiddenAt > 60000) lockNow();
  });
  function showLock() {
    const L = $('#lock'); L.classList.add('open');
    L.innerHTML = `<div class="box"><img class="logo" src="icon-192.png" alt=""><h2 style="margin:0 0 4px">Kişisel CFO</h2><p class="small muted">PIN'inizi girin</p>
      <input class="inp" type="password" inputmode="numeric" id="lockPin" maxlength="8" autocomplete="off" aria-label="PIN">
      <div class="err small" id="lockErr" style="color:var(--crit);min-height:20px;margin-top:6px"></div>
      <div class="btns"><button class="btn block" id="lockOk">Aç</button></div>
      <p class="tiny muted" style="margin-top:22px">PIN'i unuttuysanız: <a href="#" id="lockWipe">verileri sil ve yeniden başla</a></p></div>`;
    const inp = $('#lockPin'); setTimeout(() => inp.focus(), 50);
    const tryOpen = async () => {
      $('#lockOk').disabled = true;
      try { DATA = normalize(await Store.unlock(inp.value)); L.classList.remove('open'); L.innerHTML = ''; R = null; await commit(); }
      catch (e) { $('#lockErr').textContent = 'PIN yanlış'; inp.value = ''; inp.focus(); }
      $('#lockOk') && ($('#lockOk').disabled = false);
    };
    $('#lockOk').onclick = tryOpen; inp.onkeydown = e => { if (e.key === 'Enter') tryOpen(); };
    let w = 0; $('#lockWipe').onclick = e => { e.preventDefault(); if (++w < 2) { e.target.textContent = 'Tüm veriler silinecek — emin misiniz? Tekrar dokunun'; return; } Store.wipe(); L.classList.remove('open'); start(); };
  }

  // ------------------------------------------------------------ başlat
  async function start() {
    parseHash();
    if (Store.isEncrypted()) { showLock(); return; }
    try { DATA = normalize(Store.loadPlain() || (window.CFO_DEMO ? window.CFO_SAMPLE() : emptyData())); } catch (e) { DATA = emptyData(); toast('⚠ Kayıtlı veri okunamadı'); }
    await commit();
    Store.persist();
  }
  document.getElementById('banklist').innerHTML = BANKS.map(b => `<option value="${esc(b)}">`).join('');
  let rT, lastW = window.innerWidth;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (window.innerWidth !== lastW && DATA) { lastW = window.innerWidth; afterRender(); } }, 200); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  window.CFOApp = { get data() { return DATA; }, get result() { return R; } };
  start();
})();
