/* Kişisel CFO — hesap motoru (Excel v2 modelinin birebir JS karşılığı)
   Saf fonksiyonlar: DOM'a dokunmaz; Node'da test edilebilir. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ yardımcılar
  const blank = v => v === null || v === undefined || v === '';
  const N = v => (blank(v) || isNaN(+v)) ? 0 : +v;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const r2 = x => Math.round(x * 100) / 100;
  const DAY = 86400000;
  const toSerial = s => { if (blank(s)) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY; };
  const fromSerial = n => { const d = new Date(n * DAY); return d.toISOString().slice(0, 10); };
  const ymd = n => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  const dateS = (y, m, d) => Date.UTC(y, m - 1, d) / DAY;  // ay taşması JS Date ile normalize olur (Excel DATE gibi)
  const eomonth = (n, k) => { const [y, m] = ymd(n); return dateS(y, m + k + 1, 0); };
  const edate = (n, k) => { const [y, m, d] = ymd(n); const last = ymd(dateS(y, m + k + 1, 0))[2]; return dateS(y, m + k, Math.min(d, last)); };
  const monthKey = n => { const [y, m] = ymd(n); return y + '-' + String(m).padStart(2, '0'); };

  // Excel RATE(nper, pmt, pv) — Newton
  function RATE(nper, pmt, pv) {
    if (!(nper > 0)) return NaN;
    let r = 0.01;
    for (let i = 0; i < 200; i++) {
      const f = pv * Math.pow(1 + r, nper) + pmt * (Math.pow(1 + r, nper) - 1) / r;
      const df = pv * nper * Math.pow(1 + r, nper - 1) + pmt * (nper * Math.pow(1 + r, nper - 1) * r - (Math.pow(1 + r, nper) - 1)) / (r * r);
      const nr = r - f / df;
      if (!isFinite(nr)) return NaN;
      if (Math.abs(nr - r) < 1e-12) return nr;
      r = nr <= -0.99 ? -0.5 : nr;
    }
    return r;
  }

  const DEFAULT_SETTINGS = {
    raporTarihi: null, vergi: 0.30, asgEsik: 50000, asgDusuk: 0.20, asgYuksek: 0.40,
    kartKad1: 30000, kartKad2: 180000, akdi1: 0.0325, akdi2: 0.0375, akdi3: 0.0425, gecFark: 0.003,
    nakitMax: 0.0425, nakitGecMax: 0.0455, tavanTarih: '2026-09-01',
    gelirGuvence: 'normal', rezervManuel: null, rezervOrani: 0.20, dengePay: 0.50, strateji: 'A',
    mevduatFaiz: null, stopaj: null, asgTaban: 500,
    kur: { USD: null, EUR: null, GBP: null, XAU: null },
    weights: { faiz: 25, maliyet: 20, yakinlik: 10, gecikme: 15, limit: 10, tutar: 10, nakit: 10 },
  };

  const CAT_TYPES = {
    'Maaş': 'Gelir', 'Freelance': 'Gelir', 'İşletme': 'Gelir', 'Ek Gelir': 'Gelir', 'Yatırım Geliri': 'Gelir', 'Diğer Gelir': 'Gelir',
    'Kira': 'Zorunlu', 'Faturalar': 'Zorunlu', 'Market': 'Zorunlu', 'Ulaşım': 'Zorunlu', 'Çocuk': 'Zorunlu', 'Sağlık': 'Zorunlu',
    'Eğitim': 'Zorunlu', 'Sigorta': 'Zorunlu', 'Abonelik': 'Değişken', 'Giyim': 'Değişken', 'Restoran / Eğlence': 'Değişken',
    'Diğer Gider': 'Değişken', 'Faiz / Banka Masrafı': 'Faiz', 'Kredi Kartı Ödemesi': 'Borç Ödemesi', 'Kredi Taksiti': 'Borç Ödemesi',
    'KMH Ödemesi': 'Borç Ödemesi', 'Diğer Borç Ödemesi': 'Borç Ödemesi', 'Transfer (hesaplar arası)': 'Transfer',
    'Kredi Kullanımı / Borç Alma': 'Borç Kullanımı',
  };

  function settingsOf(data) {
    const s = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    s.kur = Object.assign({}, DEFAULT_SETTINGS.kur, (data.settings || {}).kur || {});
    s.weights = Object.assign({}, DEFAULT_SETTINGS.weights, (data.settings || {}).weights || {});
    return s;
  }

  function tazelik(guncelleme, today) {
    if (blank(guncelleme)) return '⚠ Güncelleme tarihi yok';
    const d = today - toSerial(guncelleme);
    return d > 35 ? `⚠ ${d} gündür güncellenmedi` : '✓ Güncel';
  }

  // ------------------------------------------------------------ ana hesap
  function compute(data, opts) {
    opts = opts || {};
    const S = settingsOf(data);
    const today = S.raporTarihi ? toSerial(S.raporTarihi) : (opts.today != null ? opts.today : toSerial(new Date().toISOString().slice(0, 10)));
    const [ty, tm] = ymd(today);
    const ayBasi = dateS(ty, tm, 1), aySonu = eomonth(today, 0);
    const V = S.vergi;

    // ---- banka hesapları
    const kurOf = para => {
      if (blank(para) || para === 'TRY') return 1;
      const k = S.kur[para === 'XAU (gram altın)' ? 'XAU' : para];
      return blank(k) ? null : +k;
    };
    const accounts = (data.accounts || []).map(a => {
      const kur = kurOf(a.para);
      const tl = blank(a.bakiye) ? null : (kur == null ? 'VERİ EKSİK' : N(a.bakiye) * kur);
      return Object.assign({}, a, { tl });
    });
    const bankaBakiye = accounts.reduce((t, a) => t + (isNum(a.tl) ? a.tl : 0), 0);

    // ---- kartlar
    const cards = (data.cards || []).map(c => {
      const E = c.limit, J = c.donem, K = c.toplam, L = c.asgari, O = toSerial(c.sonOdeme), P = N(c.gecikmis);
      const Q = c.akdi, R = c.gecFaiz, Sx = c.nakitFaiz, T = N(c.nakitBorc), W = N(c.kalanTaksit), X = N(c.aylikTaksit), Z = N(c.odenen);
      const tr = !!c.tamOder;
      const U = (blank(c.kalanTaksit) && blank(c.aylikTaksit)) ? 0 : W * X;
      const H = (N(E) === 0 || blank(K)) ? null : K / E;
      const durumLimit = H == null ? '' : H < 0.3 ? '🟢 İYİ' : H < 0.5 ? '🟡 DİKKAT' : H < 0.7 ? '🟠 YÜKSEK' : H < 0.9 ? '🔴 ÇOK YÜKSEK' : '⛔ KRİTİK';
      const odemeDurum = blank(J) ? '' : Z >= N(J) + P - 0.5 ? '✅ TAMAMI ÖDENDİ' : Z >= N(L) + P - 0.5 ? '🟡 ASGARİ/KISMİ ÖDENDİ'
        : (O != null && O < today) ? '🔴 GECİKMİŞ' : Z > 0 ? '🟠 ASGARİNİN ALTINDA' : '⏳ ÖDENMEDİ';
      const due30 = blank(J) ? 0 : ((O == null || O <= today + 30) ? Math.max(0, N(J) + P - Z) : 0);
      const kalanAsg = blank(J) ? 0 : Math.max(0, N(L) + P - Z);
      const carry = Math.max(0, N(J) + P - Z), unp = Math.min(carry, Math.max(0, N(L) + P - Z));
      let faizGirilen = null, faizAsgari = null, marj = null;
      if (!blank(K)) {
        if ((carry - unp > 0 && blank(Q)) || (unp > 0 && blank(R)) || (T > 0 && carry > 0 && blank(Sx))) faizGirilen = 'VERİ EKSİK';
        else faizGirilen = ((carry - unp) * N(Q) + unp * N(R) + (carry > 0 ? T * N(Sx) : 0)) * (1 + V);
        const c2 = Math.max(0, N(J) - N(L));
        if ((c2 > 0 && blank(Q)) || (T > 0 && blank(Sx))) faizAsgari = 'VERİ EKSİK';
        else faizAsgari = (c2 * N(Q) + T * N(Sx)) * (1 + V);
        marj = tr ? 0 : (blank(Q) ? 'VERİ EKSİK' : Q * (1 + V));
      }
      const cap = N(J) < S.kartKad1 ? S.akdi1 : (N(J) <= S.kartKad2 ? S.akdi2 : S.akdi3);
      let oranKontrol = '';
      if (!blank(Q)) {
        oranKontrol = Q > cap + 1e-5 ? `⚠ Akdi faiz TCMB tavanının (%${fmtPct(cap)}) üstünde`
          : (!blank(R) && R > cap + S.gecFark + 1e-5) ? '⚠ Gecikme faizi tavanın üstünde'
            : (!blank(Sx) && Sx > S.nakitMax + 1e-5) ? '⚠ Nakit avans faizi tavanın üstünde' : '✓ Tavan içinde';
      }
      const asgKontrol = (blank(J) || blank(L) || blank(E)) ? '' :
        (L + 1 < J * (E < S.asgEsik ? S.asgDusuk : S.asgYuksek) ? '⚠ Yasal orandan düşük — ekstreyi kontrol et' : '✓ Uyumlu');
      return Object.assign({}, c, {
        _U: U, _H: H, _durumLimit: durumLimit, _odemeDurum: odemeDurum, _due30: due30, _kalanAsg: kalanAsg,
        _sonrakiAy: W > 1 ? X : 0, _faizGirilen: faizGirilen, _faizAsgari: faizAsgari, _marj: marj, _cap: cap,
        _oranKontrol: oranKontrol, _asgKontrol: asgKontrol, _taze: tazelik(c.guncelleme, today), _tr: tr,
        _kullanilabilir: (blank(E) || blank(K)) ? null : E - K,
      });
    });

    // ---- krediler
    const loans = (data.loans || []).map(l => {
      const I = N(l.anapara), J = l.taksit, G = l.kalanVade, M = l.taksitGunu, O = toSerial(l.sonOdenen);
      let P = null;
      if (I > 0 && !blank(M)) {
        const dcur = dateS(ty, tm, Math.min(M, ymd(aySonu)[2]));
        const dnext = dateS(ty, tm + 1, Math.min(M, ymd(eomonth(today, 1))[2]));
        if (l.otomatik) P = dcur >= today ? dcur : dnext;
        else if (O == null) P = dcur;
        else { const [oy, om] = ymd(O); P = dateS(oy, om + 1, Math.min(M, ymd(eomonth(O, 1))[2])); }
      }
      const durum = P == null ? ((I > 0 && blank(M)) ? '⚠ Taksit günü eksik' : '') : l.otomatik ? '🔁 OTOMATİK TALİMAT'
        : P < today ? '🔴 GECİKMİŞ' : P - today <= 7 ? '🟡 YAKLAŞIYOR' : '🟢 PLANLI';
      const due30 = (P == null || I <= 0) ? 0 : (P <= today + 30 ? N(J) : 0);
      const toplamKalan = (blank(J) || blank(G)) ? null : J * G;
      const kalanFaiz = (toplamKalan == null || blank(l.anapara)) ? null : toplamKalan - I;
      let ef = null;
      if (I > 0) {
        if (blank(G) || blank(J)) ef = blank(l.faiz) ? 'VERİ EKSİK' : l.faiz * (1 + (l.tur === 'Konut Kredisi' ? 0 : V));
        else { const r = RATE(+G, -J, I); ef = isFinite(r) ? Math.max(0, r) : 'VERİ EKSİK'; }
      }
      const faizPay = I <= 0 ? null : (isNum(ef) ? Math.min(N(J), I * ef) : 'VERİ EKSİK');
      const tazminat = (l.tur === 'Konut Kredisi' && I > 0) ? I * (N(G) <= 36 ? 0.01 : 0.02) : null;
      return Object.assign({}, l, {
        _P: P, _durum: durum, _due30: due30, _toplamKalan: toplamKalan, _kalanFaiz: kalanFaiz, _ef: ef,
        _faizPay: faizPay, _anaparaPay: isNum(faizPay) ? N(J) - faizPay : null, _tazminat: tazminat,
        _kacinilan: (blank(l.erkenTeklif) || toplamKalan == null) ? null : toplamKalan - l.erkenTeklif,
        _taze: tazelik(l.guncelleme, today),
      });
    });

    // ---- KMH
    const kmh = (data.kmh || []).map(k => {
      const E = N(k.kullanilan), H = k.faiz;
      const ef = blank(H) ? (E > 0 ? 'VERİ EKSİK' : null) : H * (1 + (blank(k.vergi) ? V : k.vergi));
      const ay = isNum(ef) ? E * ef : ef;
      const O = N(k.limit) === 0 ? null : E / k.limit;
      const durum = E === 0 ? '🟢 KULLANILMIYOR' : !isNum(ef) ? '⚠ VERİ EKSİK: faiz' : O >= 0.9 ? '⛔ LİMİT DOLU — PAHALI BORÇ'
        : O >= 0.5 ? '🔴 YÜKSEK KULLANIM — KAPAT' : '🟠 KULLANIMDA — ÖNCELİKLE KAPAT';
      const eslesme = (accounts.some(a => a.bank === k.bank && a.ad === k.hesap)) ? '✓ Eşleşti' : '⚠ Banka hesaplarında aynı banka+hesap adı yok';
      return Object.assign({}, k, {
        _bos: blank(k.limit) ? null : k.limit - E, _gunluk: blank(H) ? null : H / 30, _ef: ef,
        _gunlukMaliyet: isNum(ef) ? E * ef / 30 : ef, _aylik: ay, _yillik: isNum(ay) ? ay * 12 : ay, _kullanim: O, _durum: durum,
        _gunBazli: (blank(k.gun) || !isNum(ef)) ? null : E * ef / 30 * k.gun,
        _oranKontrol: blank(H) ? '' : (H > S.nakitMax + 1e-5 ? `⚠ TCMB KMH tavanının (%${fmtPct(S.nakitMax)}) üstünde` : '✓ Tavan içinde'),
        _eslesme: eslesme, _taze: tazelik(k.guncelleme, today),
      });
    });
    // banka hesaplarına KMH yansıması
    accounts.forEach(a => {
      const ks = kmh.filter(k => k.bank === a.bank && k.hesap === a.ad);
      a._kmhLimit = ks.reduce((t, k) => t + N(k.limit), 0); a._kmhKul = ks.reduce((t, k) => t + N(k.kullanilan), 0);
      a._kullanilabilir = isNum(a.tl) ? a.tl + (a._kmhLimit - a._kmhKul) : a.tl;
    });

    // ---- diğer borçlar
    const others = (data.others || []).map(o => {
      const F = blank(o.tutar) ? null : o.tutar - N(o.odenen), H = toSerial(o.sonOdeme), I = N(o.aylik);
      const due30 = (N(F) <= 0 || o.buAyOdendi) ? 0 : (I > 0 ? Math.min(I, F) : ((H != null && H <= today + 30) ? F : 0));
      let uyari = '';
      if (N(F) > 0 && H != null) {
        const [hy, hm] = ymd(H);
        const mths = Math.max(1, (hy - ty) * 12 + hm - tm + 1);
        uyari = H < today ? '🔴 VADESİ GEÇTİ' : I > 0 ? (I * mths < F - 0.5 ? `⚠ Aylık ödeme yetmiyor: vadede ${fmtTL(F - I * mths)} toplu ödenecek` : '✓ Aylık ödemeyle vadesinde kapanır')
          : `📌 Vadede tek seferde ${fmtTL(F)} ödenecek (${mths}. ay)`;
      }
      return Object.assign({}, o, { _kalan: F, _due30: due30, _uyari: uyari, _taze: tazelik(o.guncelleme, today) });
    });

    // ---- varlıklar
    const assets = (data.assets || []).map(a => {
      let kur = null;
      if (!blank(a.birim)) kur = a.birim === 'TL' ? 1 : (S.kur[a.birim === 'Gram Altın' ? 'XAU' : a.birim]);
      const tl = !blank(a.manuel) ? +a.manuel : blank(a.miktar) ? null : (blank(kur) ? 'VERİ EKSİK' : a.miktar * kur);
      return Object.assign({}, a, { _kur: kur, tl });
    });
    const sumCat = cat => assets.filter(a => a.kategori === cat && isNum(a.tl)).reduce((t, a) => t + a.tl, 0);
    const nakitKat = sumCat('Nakit');
    const likitVarlik = bankaBakiye + nakitKat + sumCat('Altın') + sumCat('Döviz') + sumCat('Yatırım');
    const toplamVarlik = likitVarlik + sumCat('Araç') + sumCat('Gayrimenkul') + sumCat('Diğer');
    const eksikVarlik = assets.filter(a => a.tl === 'VERİ EKSİK').length + accounts.filter(a => a.tl === 'VERİ EKSİK').length;

    // ---- havuz (Motor)
    const pool = [];
    cards.forEach(c => {
      const F = Math.max(0, N(c.toplam)), tr = c._tr;
      pool.push({
        src: 'card', ref: c, kaynak: 'Kredi Kartı', ad: c.name || (c.bank ? c.bank + ' Kartı' : ''), banka: c.bank || '',
        tur: tr ? 'Kredi Kartı (tam ödeme)' : 'Kredi Kartı', F,
        G: F === 0 ? 0 : tr ? 0 : (isNum(c._faizAsgari) ? c._faizAsgari / F : 0),
        Hf: (F > 0 && !tr && (!isNum(c._faizAsgari) || !isNum(c._marj))) ? 1 : 0,
        I: F === 0 ? 0 : tr ? 0 : N(c.asgari) + N(c.gecikmis),
        J: toSerial(c.sonOdeme),
        K: F === 0 ? 0 : ((toSerial(c.sonOdeme) != null && toSerial(c.sonOdeme) < today) ? c._kalanAsg : N(c.gecikmis)),
        Lu: isNum(c._H) ? c._H : 0,
        M: F === 0 ? 0 : tr ? 0 : (N(c.odenen) > 0 ? (isNum(c._faizGirilen) ? c._faizGirilen : 0) : (isNum(c._faizAsgari) ? c._faizAsgari : 0)),
        O: c._odemeDurum.indexOf('TAMAMI') >= 0,
        P30: c._due30, Q30: (c.sonOdeme == null || c.sonOdeme === '' || toSerial(c.sonOdeme) <= today + 30) ? c._kalanAsg : 0,
        AK: F === 0 ? 0 : Math.max(0, N(c.donem) + N(c.gecikmis) - N(c.odenen)),
        AP: F === 0 ? 0 : tr ? 0 : (isNum(c._marj) ? c._marj : 0), rev: (F > 0 && !tr) ? 1 : 0, vadeAy: 0,
        pct: (F === 0 || tr) ? 0 : (N(c.limit) < S.asgEsik ? S.asgDusuk : S.asgYuksek), taze: c._taze, kalanAsg: c._kalanAsg,
        simBal: tr ? 0 : F, f4x: 0,
      });
    });
    loans.forEach(l => {
      const F = Math.max(0, N(l.anapara)), G = (F > 0 && isNum(l._ef)) ? l._ef : 0;
      pool.push({
        src: 'loan', ref: l, kaynak: 'Kredi', ad: l.name || (l.bank ? l.bank + ' Kredisi' : ''), banka: l.bank || '', tur: l.tur || 'Kredi', F, G,
        Hf: (F > 0 && !isNum(l._ef)) ? 1 : 0, I: F > 0 ? N(l.taksit) : 0, J: l._P,
        K: (F > 0 && l._P != null && !l.otomatik && l._P < today) ? N(l.taksit) : 0, Lu: 0, M: F * G, O: false,
        P30: l._due30, Q30: l._due30, AK: F === 0 ? 0 : N(l.taksit), AP: G, rev: 0, vadeAy: 0, pct: 0, taze: l._taze,
        kalanAsg: F > 0 ? N(l.taksit) : 0, simBal: F, f4x: 0,
      });
    });
    kmh.forEach(k => {
      const F = Math.max(0, N(k.kullanilan)), G = (F > 0 && isNum(k._ef)) ? k._ef : 0, I = (F > 0 && isNum(k._aylik)) ? k._aylik : 0;
      pool.push({
        src: 'kmh', ref: k, kaynak: 'KMH', ad: k.hesap ? k.hesap + ' (KMH)' : (k.bank ? k.bank + ' KMH' : ''), banka: k.bank || '', tur: 'KMH / Ek Hesap',
        F, G, Hf: (F > 0 && !isNum(k._ef)) ? 1 : 0, I, J: toSerial(k.kapatma), K: 0, Lu: isNum(k._kullanim) ? k._kullanim : 0, M: F * G, O: false,
        P30: I, Q30: I, AK: I, AP: G, rev: F > 0 ? 1 : 0, vadeAy: 0, pct: 0, taze: k._taze, kalanAsg: I, simBal: F, f4x: 0,
      });
    });
    others.forEach(o => {
      const F = Math.max(0, N(o._kalan)), H = toSerial(o.sonOdeme), Im = N(o.aylik);
      let vadeAy = 0;
      if (F > 0 && H != null) { const [hy, hm] = ymd(H); vadeAy = Math.max(1, (hy - ty) * 12 + hm - tm + 1); }
      pool.push({
        src: 'other', ref: o, kaynak: 'Diğer Borç', ad: o.ad || '', banka: o.alacakli || '', tur: o.tur ? 'Diğer: ' + o.tur : 'Diğer Borç', F,
        G: F > 0 ? N(o.faiz) : 0, Hf: (F > 0 && blank(o.faiz)) ? 1 : 0, I: F === 0 ? 0 : Math.min(Im, F), J: H,
        K: (F > 0 && H != null && H < today && !o.buAyOdendi) ? (Im > 0 ? Math.min(Im, F) : F) : 0, Lu: 0, M: F * (F > 0 ? N(o.faiz) : 0),
        O: !!o.buAyOdendi, P30: o._due30, Q30: o._due30, AK: F === 0 ? 0 : (Im > 0 ? Math.min(Im, F) : F), AP: F > 0 ? N(o.faiz) : 0, rev: 0,
        vadeAy, pct: 0, taze: o._taze, kalanAsg: F === 0 ? 0 : (Im > 0 ? Math.min(Im, F) : F), simBal: F,
        f4x: (o.oncelik === 'Yüksek' || o.tur === 'Vergi' || o.tur === 'Senet') ? 0.4 : (o.oncelik === 'Orta' ? 0.2 : 0),
      });
    });
    pool.forEach((p, i) => {
      p.idx = i + 1; p.N = p.F > 0.005 ? 1 : 0;
      p.R = (p.N === 0 || p.J == null) ? null : p.J - today;
      p.eksik = p.N === 0 ? '' : (p.Hf ? 'faiz oranı; ' : '') + ((p.J == null && p.kaynak !== 'KMH') ? 'son ödeme tarihi; ' : '')
        + ((p.I === 0 && (p.kaynak === 'Kredi Kartı' && !(p.src === 'card' && p.ref._tr) || p.kaynak === 'Kredi')) ? 'asgari/taksit; ' : '')
        + (String(p.taze).charAt(0) === '⚠' ? 'bakiye eski; ' : '');
    });
    const act = pool.filter(p => p.N === 1);
    const mx = k => Math.max(0, ...pool.map(p => p[k]));
    const maxAP = mx('AP'), maxM = mx('M'), maxF = mx('F');
    pool.forEach(p => { p.Z = p.N === 0 ? 0 : Math.min(1, p.I / p.F); });
    const maxZ = mx('Z');
    const W = S.weights, Wt = Math.max(1e-6, W.faiz + W.maliyet + W.yakinlik + W.gecikme + W.limit + W.tutar + W.nakit);
    pool.forEach(p => {
      if (p.N === 0) { Object.assign(p, { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0, skor: null }); return; }
      p.f1 = maxAP > 0 ? p.AP / maxAP : 0;
      p.f2 = maxM > 0 ? p.M / maxM : 0;
      p.f3 = p.R == null ? 0 : p.O ? 0 : p.R <= 0 ? 1 : Math.max(0, 1 - p.R / 30);
      p.f4 = p.K > 0 ? 1 : (p.R != null && p.R <= 3 && !p.O) ? 0.6 : p.f4x;
      p.f5 = Math.min(1, p.Lu);
      p.f6 = maxF > 0 ? 1 - p.F / maxF : 0;
      p.f7 = maxZ > 0 ? p.Z / maxZ : 0;
      p.skor = Math.round(1000 * (p.f1 * W.faiz + p.f2 * W.maliyet + p.f3 * W.yakinlik + p.f4 * W.gecikme + p.f5 * W.limit + p.f6 * W.tutar + p.f7 * W.nakit) / Wt) / 10;
      p.contrib = ['faiz', 'maliyet', 'yakinlik', 'gecikme', 'limit', 'tutar', 'nakit'].map((k, j) => p['f' + (j + 1)] * W[k] / Wt * 100);
    });
    const rankBy = (cmp) => { const s = act.slice().sort(cmp); const m = new Map(); s.forEach((p, i) => m.set(p, i + 1)); return m; };
    const rS = rankBy((a, b) => (b.skor - a.skor) || (a.idx - b.idx));
    const rA = rankBy((a, b) => (b.AP - a.AP) || (a.F - b.F) || (a.idx - b.idx));
    const rB = rankBy((a, b) => (a.F - b.F) || (b.AP - a.AP) || (a.idx - b.idx));
    const Rec = S.strateji === 'B' ? 'B' : 'A';
    act.forEach(p => { p.siraSkor = rS.get(p); p.siraA = rA.get(p); p.siraB = rB.get(p); p.siraR = Rec === 'B' ? p.siraB : p.siraA; });
    act.forEach(p => {
      p.risk = (p.K > 0 || p.skor >= 70) ? '🔴 ACİL' : p.skor >= 50 ? '🟠 YÜKSEK' : p.skor >= 30 ? '🟡 ORTA' : '🟢 DÜŞÜK';
      p.ekAlabilir = p.F * (1 + p.G) - p.I > 0.5;
    });

    // ---- toplamlar
    const sumP = (k, f) => pool.filter(f || (() => true)).reduce((t, p) => t + p[k], 0);
    const T = {
      kart: sumP('F', p => p.kaynak === 'Kredi Kartı'), kredi: sumP('F', p => p.kaynak === 'Kredi'),
      kmh: sumP('F', p => p.kaynak === 'KMH'), diger: sumP('F', p => p.kaynak === 'Diğer Borç'), borc: sumP('F'),
      limit: cards.reduce((t, c) => t + N(c.limit), 0), kullLimit: cards.filter(c => N(c.limit) > 0).reduce((t, c) => t + N(c.toplam), 0),
      t30Tam: sumP('P30'), t30Asgari: sumP('Q30'), aylikMin: sumP('I'), aylikFaiz: sumP('M'), kmhMaliyet: sumP('M', p => p.kaynak === 'KMH'),
      faizEksik: sumP('Hf'), eksikAdet: act.filter(p => p.eksik !== '').length, eskimis: act.filter(p => String(p.taze).charAt(0) === '⚠').length,
      gecikmis: sumP('K'), gecikmisAdet: pool.filter(p => p.K > 0).length,
      t7Gun: act.filter(p => !p.O && p.R != null && p.R >= 0 && p.R <= 7).reduce((t, p) => t + p.AK, 0),
      bankaBakiye, nakitKat, nakit: bankaBakiye + nakitKat, kmhBos: kmh.reduce((t, k) => t + N(k._bos), 0),
      kmhLimit: kmh.reduce((t, k) => t + N(k.limit), 0), revBakiye: sumP('F', p => p.rev === 1),
      likitVarlik, varlik: toplamVarlik, aktifAdet: act.length, eksikVarlik,
    };
    T.kartOran = T.limit > 0 ? T.kullLimit / T.limit : 0;
    T.netVarlik = T.varlik - T.borc; T.likitNet = T.likitVarlik - T.borc;
    T.veriHata = accounts.filter(a => N(a.bakiye) < 0).length + others.filter(o => N(o._kalan) < 0).length
      + loans.filter(l => isNum(l._kalanFaiz) && l._kalanFaiz < 0).length + cards.filter(c => String(c._oranKontrol).charAt(0) === '⚠').length
      + kmh.filter(k => String(k._oranKontrol).charAt(0) === '⚠' || String(k._eslesme).charAt(0) === '⚠').length;
    const byMax = k => { let best = null; act.forEach(p => { if (p[k] > 0 && (!best || p[k] > best[k])) best = p; }); return best; };
    T.maxMarj = byMax('AP'); T.maxMal = byMax('M'); T.maxNakit = byMax('Z');
    const kartH = cards.filter(c => isNum(c._H));
    T.maxKartOran = kartH.length ? Math.max(...kartH.map(c => c._H)) : 0;
    T.maxKartAd = T.maxKartOran ? (pool.find(p => p.src === 'card' && p.ref._H === T.maxKartOran) || {}).ad : '';
    T.top = act.find(p => p.siraSkor === 1) || null;

    // ---- aylık plan
    const items = (data.plan && data.plan.items) || [];
    const sumPlan = tip => items.filter(i => i.tip === tip).reduce((t, i) => t + N(i.tutar), 0);
    const pl = data.plan || {};
    const plan = {};
    plan.gelir = !blank(pl.gelirOverride) ? +pl.gelirOverride : sumPlan('Gelir');
    plan.zorunlu = !blank(pl.zorunluOverride) ? +pl.zorunluOverride : sumPlan('Zorunlu');
    plan.degisken = !blank(pl.degiskenOverride) ? +pl.degiskenOverride : sumPlan('Değişken');
    plan.min = !blank(pl.minOverride) ? +pl.minOverride : T.aylikMin;
    plan.kalan = plan.gelir - plan.zorunlu - plan.degisken - plan.min;
    plan.kapasite = Math.max(0, plan.kalan * (1 - S.rezervOrani));
    plan.ek = Math.max(0, !blank(pl.ekOverride) ? +pl.ekOverride : plan.kapasite);
    plan.butce = plan.min + plan.ek;

    // ---- karar motoru (önce mod; sıralama anahtarı moda bağlı)
    const zorCikis = plan.zorunlu + T.aylikMin;
    const dayanma = zorCikis > 0 ? T.nakit / zorCikis : null;
    const rezAy = !blank(S.rezervManuel) ? +S.rezervManuel : (S.gelirGuvence === 'guvenli' ? 2 : S.gelirGuvence === 'degisken' ? 6 : 3);
    const rezHedef = zorCikis * rezAy;
    const mod = T.borc <= 0 ? 'BORÇSUZ' : plan.gelir <= 0 ? 'VERİ EKSİK' : plan.gelir < plan.zorunlu + T.aylikMin ? 'KRİZ'
      : (N(dayanma) < 1 ? 'KORUMA' : N(dayanma) < rezAy ? 'DENGE' : 'ATAK');
    const mevNet = blank(S.mevduatFaiz) ? null : S.mevduatFaiz * (1 - N(S.stopaj));
    const tutar = N(data.karar && data.karar.tutar);
    const k1 = Math.min(tutar, T.gecikmis);
    const k2 = Math.min(tutar - k1, Math.max(0, T.t30Asgari - T.gecikmis - T.nakit));
    const rem2 = Math.max(0, tutar - k1 - k2);
    const havuz = mod === 'DENGE' ? rem2 * (1 - S.dengePay) : (['KORUMA', 'ATAK', 'KRİZ'].indexOf(mod) >= 0 ? rem2 : 0);
    act.forEach(p => {
      let key = null;
      if (mod === 'KRİZ') key = (p.F <= rem2 && p.I > 0) ? p.I - p.idx / 1e6 : null;
      else if (mod === 'KORUMA' && p.rev === 0) key = null;
      else if (mevNet != null && p.AP <= mevNet) key = null;
      else key = p.AP <= 0 ? null : p.AP - p.idx / 1e9;
      p.kararKey = key;
    });
    const kararList = act.filter(p => p.kararKey != null).sort((a, b) => b.kararKey - a.kararKey);
    let kalanHavuz = havuz; const dagitim = [];
    kararList.forEach((p, i) => {
      const a = Math.max(0, Math.min(p.F, kalanHavuz)); kalanHavuz -= a;
      p.kararSira = i + 1;
      dagitim.push({ p, tutar: a, tasarruf: a * p.AP, kapanir: a >= p.F - 0.5 && a > 0 });
    });
    const dagitilan = dagitim.reduce((t, d) => t + d.tutar, 0);
    const karar = {
      tutar, mod, zorCikis, dayanma, rezAy, rezHedef, rezAcik: Math.max(0, rezHedef - T.nakit), mevNet,
      k1, k2, rem2, havuz, dagitilan, rezervde: rem2 - dagitilan, dagitim,
      tasarruf: dagitim.reduce((t, d) => t + d.tasarruf, 0),
      serbest: dagitim.filter(d => d.kapanir).reduce((t, d) => t + d.p.I, 0),
      top1: kararList[0] || null,
    };
    {
      const parts = [];
      if (k1 > 0) parts.push(`${fmtTL(k1)} gecikmiş ödemelere`);
      if (k2 > 0) parts.push(`${fmtTL(k2)} yaklaşan asgari ödemeler için kenara`);
      dagitim.slice(0, 3).forEach(d => { if (d.tutar > 0) parts.push(`${fmtTL(d.tutar)} ${d.p.ad} borcuna`); });
      const diger = dagitim.slice(3).reduce((t, d) => t + d.tutar, 0);
      if (diger > 0) parts.push(`${fmtTL(diger)} diğer borçlara`);
      if (karar.rezervde > 0.5) parts.push(`${fmtTL(karar.rezervde)} nakit rezervinde kalsın`);
      karar.metin = tutar <= 0 ? 'Elinizdeki ek tutarı yazın.' : mod === 'VERİ EKSİK' ? '⚠ Önce Aylık Plan\'a gelir ve giderlerinizi girin.'
        : `KARAR (${fmtTL(tutar)}): ` + (parts.length ? parts.join('; ') + '.' : 'ek ödeme önerilen borç yok; tutar nakitte kalsın.');
      karar.metin2 = (tutar <= 0 || mod === 'VERİ EKSİK') ? '' : `Tahmini aylık faiz tasarrufu ~${fmtTL(karar.tasarruf)} (yıllık ~${fmtTL(karar.tasarruf * 12)}).`
        + (karar.serbest > 0 ? ` Kapanan borçlardan ayda ${fmtTL(karar.serbest)} serbest kalır.` : '')
        + (mod === 'KORUMA' && T.kmhBos > 0 ? ' KMH\'ye yatırılan para limiti açar; acil durumda yeniden kullanılabilir.' : '');
      karar.modAciklama = {
        'KRİZ': 'Gelir, zorunlu gider + asgari ödemeleri karşılamıyor. Ek para önce tamamen kapatılabilecek ve aylık ödemeyi en çok azaltacak borca; kalanı nakitte kalır. Yapılandırma araştırın.',
        'KORUMA': 'Nakit 1 aylık zorunlu çıkıştan az. Ek para yalnızca yeniden kullanılabilir borca (KMH / devreden kart) gider; krediye erken ödeme yapılmaz.',
        'DENGE': `Rezerv 1 ay ile hedef arasında. Ek paranın %${Math.round(S.dengePay * 100)} kadarı rezerve, kalanı en pahalı borca.`,
        'ATAK': 'Rezerv hedefi tamam. Ek paranın tamamı en yüksek marjinal faizli borca.',
        'BORÇSUZ': 'Borç yok: ek para rezerve veya yatırıma.',
        'VERİ EKSİK': 'Önce Aylık Plan\'a gelir ve giderlerinizi girin.',
      }[mod];
    }

    // ---- simülasyon
    const NM = 120;
    function simulate(rankKey, base, scen, tip, roll, realMin) {
      const rows = act.filter(p => p[rankKey] != null).sort((a, b) => a[rankKey] - b[rankKey]).map(p => ({
        p, E: p.simBal, F: p.G, G: p.I, A: p.vadeAy, J: realMin ? p.pct : 0,
      }));
      const sumMin = rows.reduce((t, r) => t + r.G, 0);
      let Bp = rows.map(r => r.E);
      const tot = [], shortArr = [], hist = rows.map(() => []);
      let interest = 0, x1 = null;
      for (let m = 1; m <= NM; m++) {
        const due = Bp.map((b, i) => b * (1 + rows[i].F));
        const M = due.map((d, i) => {
          const r = rows[i];
          if (r.A > 0 && m >= r.A) return d;
          if (realMin && r.J > 0) return Math.min(d, Math.max(r.J * d, S.asgTaban));
          return Math.min(r.G, d);
        });
        const mintot = M.reduce((t, x) => t + x, 0);
        const budget = roll ? sumMin + base + (tip === 'Tek Seferlik' ? (m === 1 ? scen : 0) : scen) : mintot;
        const free = Math.max(0, budget - mintot);
        shortArr.push(Math.max(0, mintot - budget));
        interest += Bp.reduce((t, b, i) => t + b * rows[i].F, 0);
        let used = 0;
        const X = due.map((d, i) => { const x = Math.min(d - M[i], Math.max(0, free - used)); used += x; return x; });
        if (m === 1) x1 = X;
        Bp = due.map((d, i) => r2(Math.max(0, d - M[i] - X[i])));
        Bp.forEach((b, i) => hist[i].push(b));
        tot.push(Bp.reduce((t, b) => t + b, 0));
      }
      const payoff = rows.map((r, i) => r.E === 0 ? null : (hist[i].filter(b => b > 0).length >= NM ? '120+' : hist[i].filter(b => b > 0).length + 1));
      const sumE = rows.reduce((t, r) => t + r.E, 0);
      const cnt = tot.filter(t => t > 0).length;
      const free = sumE === 0 ? 0 : (cnt >= NM ? '120+' : cnt + 1);
      const Icol = rows.map((r, i) => (r.E > 0 && r.G < r.E * (1 + r.F) - 0.5) ? payoff[i] : null).filter(isNum);
      const Hnum = payoff.filter(isNum);
      const first = sumE === 0 ? 0 : (Icol.length ? Math.min(...Icol) : (Hnum.length ? Math.min(...Hnum) : '120+'));
      const ti = x1 ? x1.findIndex(x => x > 0.005) : -1;
      const short = roll ? Math.max(0, ...shortArr) : 0;
      const shortM = short <= 0.5 ? 0 : shortArr.findIndex(x => x > 0.5) + 1;
      return {
        rows: rows.map((r, i) => ({ p: r.p, E: r.E, F: r.F, G: r.G, payoff: payoff[i] })), interest, free, first,
        target: ti >= 0 ? rows[ti].p.ad : '—', end: tot[NM - 1], budget: sumMin + base, c3: Hnum.filter(x => x <= 3).length,
        short, shortM, tot,
      };
    }
    const senEk = N(data.senaryo && data.senaryo.ek), senTip = (data.senaryo && data.senaryo.tip) || 'Aylık';
    const sims = {
      A: simulate('siraA', plan.ek, 0, 'Aylık', 1, 0),
      B: simulate('siraB', plan.ek, 0, 'Aylık', 1, 0),
      custom: simulate('siraR', plan.ek, senEk, senTip, 1, 0),
      s10: simulate('siraR', plan.ek, 10000, senTip, 1, 0),
      s20: simulate('siraR', plan.ek, 20000, senTip, 1, 0),
      s30: simulate('siraR', plan.ek, 30000, senTip, 1, 0),
      s50: simulate('siraR', plan.ek, 50000, senTip, 1, 0),
      noExtra: simulate('siraR', 0, 0, 'Aylık', 1, 0),
      realMin: simulate('siraR', 0, 0, 'Aylık', 0, 1),
    };
    sims.R = Rec === 'B' ? sims.B : sims.A;
    const recCand = act.filter(p => p.ekAlabilir);
    T.recIdx = recCand.length ? recCand.reduce((a, b) => (a.siraR <= b.siraR ? a : b)) : (act.find(p => p.siraR === 1) || null);
    const snowBedel = sims.B.interest - sims.A.interest;
    const uygulanabilir = T.borc > 0 && plan.gelir > 0 && plan.kalan >= 0 && sims.R.short <= T.nakit;
    const planUyari = T.borc <= 0 ? '' : plan.gelir <= 0 ? 'Aylık plan girilmemiş' : plan.kalan < 0 ? `Plan uygulanamaz: aylık ${fmtTL(-plan.kalan)} açık var`
      : sims.R.short > T.nakit ? `Plan uygulanamaz: vadesi gelen borç için ${sims.R.shortM}. ayda ${fmtTL(sims.R.short)} ek nakit gerekiyor, nakit yetmiyor`
        : sims.R.short > 0.5 ? `Not: ${sims.R.shortM}. ayda vadesi gelen borç için nakit rezervinden ${fmtTL(sims.R.short)} kullanılacak` : '';
    const freeDate = x => isNum(x) ? (x === 0 ? '—' : ayAdi(edate(ayBasi, x - 1))) : '10 yıldan uzun';
    const freeText = x => isNum(x) ? (x === 0 ? 'Borç yok' : x + ' ay') : '120+ ay (10 yıldan uzun)';
    const gate = s => T.borc <= 0 ? 'Borç yok' : !uygulanabilir ? 'Plan uygulanamaz' : s;

    // ---- stres testi
    const st = [];
    const stat = g => !isNum(g) ? '🟢 DAYANIR' : g >= 6 ? '🟢 GÜÇLÜ' : g >= 3 ? '🟡 ORTA' : g >= 1 ? '🟠 ZAYIF' : '🔴 KRİTİK';
    const shocks = (data.stres || {});
    [['A) Gelir düşer', N(shocks.a ?? -0.2)], ['B) Gelir yarıya iner', N(shocks.b ?? -0.5)], ['C) Gelir tamamen kesilir', N(shocks.c ?? -1)], ['Gelir artar', N(shocks.d ?? 0.2)]]
      .forEach(([ad, s]) => {
        const gelir = plan.gelir * (1 + s), fark = gelir - zorCikis;
        const ay = zorCikis === 0 ? null : (fark >= 0 ? 'Sınırsız' : T.nakit / -fark);
        st.push({ ad, sok: s, tip: 'gelir', gelir, cikis: zorCikis, fark, ay, nakit3: T.nakit + 3 * fark,
          kmhAy: zorCikis === 0 ? null : (fark >= 0 ? 'Sınırsız' : (T.nakit + T.kmhBos) / -fark), sonuc: zorCikis === 0 ? 'VERİ EKSİK' : stat(ay) });
      });
    [['D) Beklenmeyen gider', N(shocks.e ?? 25000)], ['E) Büyük beklenmeyen gider', N(shocks.f ?? 50000)]].forEach(([ad, amt]) => {
      const ay = zorCikis === 0 ? null : Math.max(0, T.nakit - amt) / zorCikis;
      st.push({ ad, sok: amt, tip: 'gider', gelir: plan.gelir, cikis: zorCikis, fark: plan.gelir - zorCikis, ay, nakit3: T.nakit - amt,
        kmhAy: zorCikis === 0 ? null : Math.max(0, T.nakit - amt + T.kmhBos) / zorCikis, sonuc: zorCikis === 0 ? 'VERİ EKSİK' : stat(ay) });
    });
    {
      const pt = N(shocks.g ?? 0.01), dF = T.revBakiye * pt * (1 + V);
      st.push({ ad: 'F) Faizler yükselir', sok: pt, tip: 'faiz', gelir: plan.gelir, cikis: zorCikis + dF, fark: plan.kalan - dF,
        ay: zorCikis === 0 ? null : T.nakit / (zorCikis + dF), artis: dF, sonuc: plan.kalan - dF < 0 ? '🔴 Plan bozulur' : plan.kalan - dF < plan.kalan * 0.5 ? '🟠 Belirgin etki' : '🟢 Sınırlı etki' });
      const ld = N(shocks.h ?? 0.3);
      const yeniOran = T.limit > 0 ? T.kullLimit / (T.limit * (1 - ld)) : 0;
      const kmhBos2 = Math.max(0, T.kmhLimit * (1 - ld) - T.kmh);
      const asim = Math.max(0, T.kullLimit - T.limit * (1 - ld)) + Math.max(0, T.kmh - T.kmhLimit * (1 - ld));
      st.push({ ad: 'G) Kart ve KMH limitleri düşer', sok: ld, tip: 'limit', yeniOran, kmhBos2, asim, ay: dayanma,
        kmhAy: zorCikis === 0 ? null : (T.nakit + kmhBos2) / zorCikis, sonuc: asim > 0 ? '🔴 Limit aşımı' : '🟢 Limit içinde' });
    }
    const dayaniklilik = zorCikis === 0 ? '⚠ Dayanıklılık için Aylık Plan\'ı doldurun.'
      : `${stat(dayanma)} — gelir tamamen kesilirse nakit ${fmtNum(dayanma, 1)} ay yeter (KMH tamponuyla ${fmtNum((T.nakit + T.kmhBos) / zorCikis, 1)} ay). Hedef: ${rezAy} ay.`;

    // ---- ödeme takvimi (90 gün)
    const events = [];
    pool.forEach((p, n) => {
      if (p.N === 0) return;
      const j0date = p.src === 'kmh' ? (p.J == null ? aySonu : p.J) : p.J;
      let durum;
      if (p.src === 'loan') durum = j0date == null ? '⚠ TARİH EKSİK' : p.ref.otomatik ? '🔁 OTOMATİK TALİMAT' : j0date < today ? '🔴 GECİKMİŞ' : band(j0date - today);
      else if (p.src === 'kmh') durum = j0date < today ? '🔴 GECİKMİŞ' : '🔁 FAİZ AY SONU';
      else durum = p.O ? '✅ ÖDENDİ' : j0date == null ? '⚠ TARİH EKSİK' : j0date < today ? '🔴 GECİKMİŞ' : band(j0date - today);
      events.push({ p, j: 0, date: j0date, tutar: p.AK, asgari: p.kalanAsg, durum, not: p.src === 'kmh' ? 'Aylık faiz + vergi (ay sonu tahakkuk)' : p.eksik, key: j0date == null ? 90000 + n / 1e4 : j0date + n / 1e4 });
      for (let j = 1; j <= 2; j++) {
        let d = null, amt = 0, not = '';
        if (p.src === 'loan' && p.J != null && N(p.ref.kalanVade) > j) { d = edate(p.J, j); amt = p.I; not = 'Taksit'; }
        else if (p.src === 'card' && p.J != null && N(p.ref.kalanTaksit) > j) { d = edate(p.J, j); amt = N(p.ref.aylikTaksit); not = 'Bilinen kart taksiti (yeni harcamalar hariç)'; }
        else if (p.src === 'kmh') { d = eomonth(aySonu, j); amt = p.M; not = 'KMH faizi (bakiye aynı kalırsa)'; }
        if (d != null && d <= today + 90) events.push({ p, j, date: d, tutar: amt, asgari: amt, durum: band(d - today), not, key: d + n / 1e4 });
      }
    });
    events.sort((a, b) => a.key - b.key);
    function band(x) { return x <= 3 ? '🟠 3 GÜN İÇİNDE' : x <= 7 ? '🟡 7 GÜN İÇİNDE' : x <= 30 ? '🟢 PLANLANMIŞ' : '⚪ İLERİ TARİH'; }

    // ---- hareketler ve aylık rapor
    const txs = (data.txs || []).map(t => Object.assign({}, t, { _tip: CAT_TYPES[t.kategori] || (data.catTypes || {})[t.kategori] || '?', _ay: blank(t.tarih) ? null : monthKey(toSerial(t.tarih)) }));
    const raporAy = key => {
      const ts = txs.filter(t => t._ay === key);
      const s = (tip, f) => ts.filter(t => t._tip === tip && (!f || f(t))).reduce((a, t) => a + N(t.gider), 0);
      const gelir = ts.filter(t => t._tip === 'Gelir').reduce((a, t) => a + N(t.gelir), 0);
      const gider = s('Zorunlu') + s('Değişken'), faiz = s('Faiz'), borcOdeme = s('Borç Ödemesi');
      const kart = s('Zorunlu', t => t.yontem === 'Kredi Kartı') + s('Değişken', t => t.yontem === 'Kredi Kartı');
      const nakitCikis = gider + faiz - kart + borcOdeme;
      return { gelir, gider, faiz, borcOdeme, kart, nakitCikis, net: gelir - nakitCikis, adet: ts.length };
    };

    // ---- geçmiş (otomatik ay kaydı)
    const hist = Object.assign({}, data.history || {});
    const curKey = monthKey(today);
    const histRows = Object.keys(hist).concat(hist[curKey] ? [] : [curKey]).sort().map(k => {
      const h = k === curKey && !(hist[k] && hist[k].kilit) ? { borc: T.borc, varlik: T.varlik, faiz: T.aylikFaiz, oto: true } : hist[k];
      return Object.assign({ ay: k }, h);
    });
    histRows.forEach((h, i) => {
      const prev = histRows[i - 1];
      h.degisim = prev && isNum(prev.borc) ? h.borc - prev.borc : null;
      h.net = isNum(h.varlik) && isNum(h.borc) ? h.varlik - h.borc : null;
      h.netDegisim = prev && isNum(prev.net) && isNum(h.net) ? h.net - prev.net : null;
      Object.assign(h, raporAy(h.ay));
    });
    const prevRec = histRows.filter(h => h.ay < curKey && isNum(h.borc)).pop();
    const borcDegisim = prevRec ? T.borc - prevRec.borc : null;

    // ---- CFO önerileri
    const cfo = [];
    cfo.push(plan.gelir <= 0 ? '⚠ Aylık plan girilmemiş: Plan sayfasına düzenli gelir ve giderlerinizi bir kez girin.'
      : plan.kalan >= 0 ? `✅ Plan: gelir − giderler − asgari ödemeler = ayda ${fmtTL(plan.kalan)} serbest; ${fmtTL(plan.ek)} borca, kalanı rezerve.`
        : `⛔ Aylık ${fmtTL(-plan.kalan)} açık: gelir zorunlu giderleri ve asgari ödemeleri karşılamıyor. Giderleri kısın veya yapılandırma araştırın.`);
    if (T.top) {
      cfo.push(`🎯 Bu ayın en acil işi: ${T.top.ad} (${T.top.banka}) → ${aksiyon(T.top)} · ${T.top.risk}`);
      const s = sebep(T.top); cfo.push(s ? 'Sebep: ' + s + '.' : 'Sebep: faktörlerin toplam etkisi en yüksek.');
    } else cfo.push('Henüz borç kaydı yok. Kart, kredi, KMH ve diğer borçları ekleyin.');
    if (karar.top1) cfo.push(`💡 Ek para önce: ${karar.top1.ad} — marjinal %${fmtPct(karar.top1.AP)}/ay (vergiler dahil), yıllık bileşik %${Math.round((Math.pow(1 + karar.top1.AP, 12) - 1) * 100)}.` + (Rec === 'B' ? ` Snowball tercihinizin bedeli: ${fmtTL(snowBedel)}.` : ''));
    if (T.borc > 0) cfo.push(!uygulanabilir ? '⛔ ' + planUyari + '.' : `🏁 İdeal planla borçsuz: ${freeDate(sims.R.free)} · gerçek asgariyle: ${freeDate(sims.realMin.free)} · aradaki faiz farkı ${fmtTL(sims.realMin.interest - sims.R.interest)}.`);
    if (T.limit > 0) cfo.push(T.maxKartOran >= 0.7 ? `⚠ Limiti tehlikeli kart: ${T.maxKartAd} (%${Math.round(T.maxKartOran * 100)}) — yeni harcama yapma.` : `✅ Kart limit kullanımları makul (en yüksek %${Math.round(T.maxKartOran * 100)}).`);
    cfo.push(T.kmh === 0 ? '✅ KMH kullanımı yok.' : T.kmhMaliyet === 0 ? '⚠ KMH maliyeti için faiz oranı eksik.' : `🔥 KMH ayda ~${fmtTL(T.kmhMaliyet)} (yıllık ~${fmtTL(T.kmhMaliyet * 12)}) maliyet üretiyor. Kapatılınca limit yeniden kullanılabilir: ek para için ilk adaydır.`);
    cfo.push(zorCikis === 0 ? '⚠ Rezerv analizi için aylık plan gerekli.' : `🛟 Gelir kesilirse nakit ${fmtNum(dayanma, 1)} ay yeter (hedef ${rezAy} ay = ${fmtTL(rezHedef)}). Karar modu: ${mod}.`);
    cfo.push(T.gecikmisAdet > 0 ? `🔴 ${T.gecikmisAdet} borçta gecikmiş ödeme (${fmtTL(T.gecikmis)}): önce bunları öde.`
      : T.faizEksik > 0 ? `⚠ ${T.faizEksik} borçta faiz oranı eksik.` : T.eskimis > 0 ? `⚠ ${T.eskimis} borcun bakiyesi 35 günden eski veya tarihsiz: güncelleyin.`
        : T.veriHata > 0 ? `⚠ ${T.veriHata} kayıtta veri hatası (negatif bakiye / TCMB tavanı üstü oran / eşleşmeyen KMH).`
          : T.aktifAdet === 0 ? 'ℹ️ Henüz borç verisi girilmedi.' : '✅ Veriler tam ve güncel.');

    function aksiyon(p) {
      return p.K > 0 ? 'Gecikmiş tutarı HEMEN öde' : p.Hf ? 'Faiz oranını gir (VERİ EKSİK)' : (p.R != null && p.R <= 7 && !p.O) ? 'Son ödeme yakın: en az asgariyi öde'
        : String(p.taze).charAt(0) === '⚠' ? 'Bakiyeyi güncelle' : (karar.top1 && p === karar.top1) ? 'Ek parayı buraya yönlendir'
          : p.kaynak === 'KMH' ? 'Pahalı kısa vadeli borç: kapat' : p.Lu >= 0.9 ? 'Limit dolu: yeni harcama yapma' : p.Lu >= 0.7 ? 'Limit kullanımını düşür' : 'Asgari/taksiti düzenli öde';
    }
    function sebep(p) {
      const s = [];
      if (p.K > 0) s.push(`gecikmiş ödeme (${fmtTL(p.K)})`);
      if (p.AP > 0 && p.AP === maxAP) s.push(`en yüksek marjinal faiz (%${fmtPct(p.AP)})`);
      if (p.M > 0 && p.M === maxM) s.push(`en yüksek aylık faiz maliyeti (${fmtTL(p.M)})`);
      if (p.Lu >= 0.7) s.push(`limit kullanımı %${Math.round(p.Lu * 100)}`);
      if (p.R != null && p.R >= 0 && p.R <= 7 && !p.O) s.push(`son ödemeye ${p.R} gün`);
      if (p.Hf) s.push('faiz oranı EKSİK');
      return s.join('; ');
    }
    act.forEach(p => { p.aksiyon = aksiyon(p); p.sebep = sebep(p); });

    const durumBaslik = (T.borc + T.varlik === 0) ? '⚪ Veri bekleniyor' : T.gecikmisAdet > 0 ? '🔴 DİKKAT: gecikmiş ödeme var'
      : (T.borc > 0 && !uygulanabilir) ? '⛔ Plan uygulanamaz' : N(dayanma) < 1 ? '🟠 Nakit tamponu zayıf' : T.likitNet < 0 ? '🟡 Borç likit varlıktan fazla' : '🟢 Kontrol altında';

    return {
      S, today, todayStr: fromSerial(today), ayBasi, aySonu, curKey, accounts, cards, loans, kmh, others, assets, pool, act, T, plan,
      karar, sims, Rec, snowBedel, uygulanabilir, planUyari, freeDate, freeText, gate, stres: st, dayaniklilik, events,
      txs, histRows, borcDegisim, prevRec, cfo, durumBaslik, raporAy,
      snapshot: { borc: T.borc, varlik: T.varlik, faiz: T.aylikFaiz },
    };
  }

  // ------------------------------------------------------------ biçim
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmtTL(x, dec) { if (!isNum(x)) return x == null ? '—' : String(x); return (dec ? nf2 : nf0).format(Math.round(x * (dec ? 100 : 1)) / (dec ? 100 : 1)).replace(/^-0$/, '0') + ' ₺'; }
  function fmtNum(x, d) { if (!isNum(x)) return x == null ? '—' : String(x); return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(x); }
  function fmtPct(x, d) { if (!isNum(x)) return '—'; return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }).format(x * 100); }
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function ayAdi(serial) { const [y, m] = ymd(serial); return AYLAR[m - 1] + ' ' + y; }
  function ayKeyAdi(key) { const [y, m] = key.split('-').map(Number); return AYLAR[m - 1] + ' ' + y; }
  function fmtDate(s) { if (s == null || s === '') return '—'; const n = typeof s === 'number' ? s : toSerial(s); const [y, m, d] = ymd(n); return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`; }

  const API = { compute, DEFAULT_SETTINGS, CAT_TYPES, RATE, toSerial, fromSerial, edate, eomonth, monthKey, fmtTL, fmtNum, fmtPct, fmtDate, ayAdi, ayKeyAdi, AYLAR, isNum, blank, N };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CFO = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
