/* Örnek veri — yalnızca deneme amaçlı; "Örnek veriyi yükle" ile gelir. Gerçek kişi/kurum verisi değildir. */
(function (root) {
  function sample() {
    const g = '2026-10-01';
    return {
      version: 1,
      settings: {},
      accounts: [
        { id: 'a1', bank: 'Ziraat Bankası', ad: 'Maaş', tur: 'Vadesiz', para: 'TRY', bakiye: 18500, son4: '' },
        { id: 'a2', bank: 'Garanti BBVA', ad: 'Vadesiz', tur: 'Vadesiz', para: 'TRY', bakiye: 0, son4: '' },
        { id: 'a3', bank: 'Akbank', ad: 'Vadeli', tur: 'Vadeli', para: 'TRY', bakiye: 40000, son4: '' },
      ],
      cards: [
        { id: 'c1', bank: 'Garanti BBVA', name: 'Bonus Platinum', son4: '', limit: 60000, donem: 24000, toplam: 52000, asgari: 9600,
          ekstre: '2026-09-28', sonOdeme: '2026-10-08', gecikmis: 0, akdi: 0.0325, gecFaiz: 0.0355, nakitFaiz: 0.0325, nakitBorc: 5000,
          taksitSayisi: 6, kalanTaksit: 4, aylikTaksit: 2000, tamOder: false, odenen: 0, guncelleme: g },
        { id: 'c2', bank: 'Akbank', name: 'Axess', son4: '', limit: 40000, donem: 9000, toplam: 14000, asgari: 1800,
          ekstre: '2026-10-05', sonOdeme: '2026-10-15', gecikmis: 0, akdi: 0.0325, gecFaiz: 0.0355, nakitFaiz: null, nakitBorc: 0,
          taksitSayisi: null, kalanTaksit: null, aylikTaksit: null, tamOder: true, odenen: 0, guncelleme: g },
        { id: 'c3', bank: 'Yapı Kredi', name: 'World', son4: '', limit: 25000, donem: 23500, toplam: 23500, asgari: 4700,
          ekstre: '2026-09-22', sonOdeme: '2026-10-02', gecikmis: 1500, akdi: 0.0325, gecFaiz: 0.0355, nakitFaiz: null, nakitBorc: 0,
          taksitSayisi: null, kalanTaksit: null, aylikTaksit: null, tamOder: false, odenen: 0, guncelleme: g },
      ],
      loans: [
        { id: 'l1', bank: 'Garanti BBVA', name: 'İş İhtiyaç', tur: 'İhtiyaç Kredisi', cekilen: 120000, toplamVade: 36, kalanVade: 18,
          anapara: 83000, taksit: 6845, faiz: 0.0349, taksitGunu: 15, otomatik: false, sonOdenen: '2026-09-15', erkenTeklif: null, guncelleme: g },
        { id: 'l2', bank: 'Halkbank', name: 'Taşıt', tur: 'Taşıt Kredisi', cekilen: 300000, toplamVade: 48, kalanVade: 28,
          anapara: 190000, taksit: 10584, faiz: 0.0259, taksitGunu: 20, otomatik: true, sonOdenen: null, erkenTeklif: null, guncelleme: g },
      ],
      kmh: [
        { id: 'k1', bank: 'Garanti BBVA', hesap: 'Vadesiz', limit: 30000, kullanilan: 22000, faiz: 0.0425, vergi: 0.30, gun: 15, kapatma: null, guncelleme: g },
      ],
      others: [
        { id: 'o1', ad: 'Kardeşe borç', alacakli: 'Kardeş', tur: 'Aile/Arkadaş', tutar: 20000, odenen: 5000, sonOdeme: '2027-03-30', aylik: 2500, faiz: 0, oncelik: 'Orta', buAyOdendi: false, guncelleme: g },
        { id: 'o2', ad: 'Vergi borcu', alacakli: 'Vergi Dairesi', tur: 'Vergi', tutar: 4800, odenen: 0, sonOdeme: '2026-10-31', aylik: null, faiz: 0, oncelik: 'Yüksek', buAyOdendi: false, guncelleme: g },
      ],
      assets: [
        { id: 'v1', kategori: 'Nakit', ad: 'Cüzdan / ev', birim: 'TL', miktar: 3000, manuel: null },
        { id: 'v2', kategori: 'Döviz', ad: 'Dolar', birim: 'USD', miktar: 500, manuel: null },
        { id: 'v3', kategori: 'Araç', ad: 'Otomobil', birim: null, miktar: null, manuel: 600000 },
      ],
      plan: {
        items: [
          { id: 'p1', ad: 'Maaş', tip: 'Gelir', tutar: 110000 },
          { id: 'p2', ad: 'Kira', tip: 'Zorunlu', tutar: 25000 }, { id: 'p3', ad: 'Faturalar', tip: 'Zorunlu', tutar: 3200 },
          { id: 'p4', ad: 'Market', tip: 'Zorunlu', tutar: 12000 }, { id: 'p5', ad: 'Ulaşım', tip: 'Zorunlu', tutar: 3000 },
          { id: 'p6', ad: 'Çocuk', tip: 'Zorunlu', tutar: 3000 }, { id: 'p7', ad: 'Sağlık', tip: 'Zorunlu', tutar: 1500 },
          { id: 'p8', ad: 'Sigorta', tip: 'Zorunlu', tutar: 1500 }, { id: 'p9', ad: 'İletişim', tip: 'Zorunlu', tutar: 800 },
          { id: 'p10', ad: 'Abonelikler', tip: 'Değişken', tutar: 650 }, { id: 'p11', ad: 'Giyim', tip: 'Değişken', tutar: 1500 },
          { id: 'p12', ad: 'Restoran / Eğlence', tip: 'Değişken', tutar: 2500 }, { id: 'p13', ad: 'Diğer', tip: 'Değişken', tutar: 1000 },
        ],
      },
      txs: [
        { id: 't1', tarih: '2026-10-01', aciklama: 'Ekim maaşı', kategori: 'Maaş', gelir: 110000, gider: null, yontem: 'Banka', hesap: 'Ziraat Maaş' },
        { id: 't2', tarih: '2026-10-02', aciklama: 'Kira', kategori: 'Kira', gelir: null, gider: 25000, yontem: 'Havale/EFT', hesap: 'Ziraat Maaş' },
        { id: 't3', tarih: '2026-10-03', aciklama: 'Market', kategori: 'Market', gelir: null, gider: 2350, yontem: 'Kredi Kartı', hesap: 'Akbank Axess' },
      ],
      history: {
        '2026-07': { borc: 440000, varlik: 652000, faiz: 14500, kilit: true },
        '2026-08': { borc: 428500, varlik: 655500, faiz: 14100, kilit: true },
        '2026-09': { borc: 415200, varlik: 658000, faiz: 13800, kilit: true },
      },
      karar: { tutar: 20000 },
      senaryo: { ek: 10000, tip: 'Aylık' },
      stres: {},
      meta: {},
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = sample;
  root.CFO_SAMPLE = sample;
})(typeof globalThis !== 'undefined' ? globalThis : this);
