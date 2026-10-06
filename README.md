# Kişisel CFO — telefon uygulaması (PWA)

Borçlarınızı, nakit akışınızı ve "ek parayı nereye yatırmalıyım?" kararını hesaplayan, **tamamen telefonda çalışan** bir web uygulaması.

- Veriler **yalnızca telefonunuzun tarayıcısında** saklanır. Sunucuya, GitHub'a veya başka bir yere gönderilmez.
- GitHub'a yüklenen yalnızca uygulamanın **kodudur**. Sizin rakamlarınız orada bulunmaz.
- İnternet olmadan da çalışır (ilk açılıştan sonra).
- İsteğe bağlı PIN: veriler telefonda AES-256 ile şifrelenir.
- Kart numarasının tamamı, CVV, şifre veya IBAN'ın tamamı istenmez.

## Kurulum: GitHub Pages (yaklaşık 10 dakika, bir kez)

1. **GitHub hesabı açın:** https://github.com/signup (hesabınız varsa giriş yapın).
2. **Yeni depo (repository) oluşturun:** sağ üstteki **+** → **New repository**.
   - Repository name: `cfo` (istediğiniz bir ad olabilir)
   - **Public** seçin. Ücretsiz GitHub Pages için depo herkese açık olmalıdır. Depoda yalnızca kod olacak, verileriniz olmayacak.
   - **Create repository**'ye basın.
3. **Dosyaları yükleyin:** açılan sayfada **uploading an existing file** bağlantısına tıklayın.
   - Zip'i bilgisayarınızda açın.
   - `kisisel-cfo` klasörünün **içindeki tüm dosyaları** seçip sürükleyip bırakın (alt klasör yok; 16 dosya).
   - Alttaki **Commit changes**'e basın.
   - `index.html` deponun ana dizininde olmalıdır, bir alt klasörde değil.
4. **Pages'i açın:**
   - **Settings** → soldan **Pages**'e gidin.
   - *Source*: **Deploy from a branch**. *Branch*: **main**, klasör **/ (root)**.
   - **Save**'e basın.
5. 1–2 dakika bekleyin. Sayfanın üstünde adres görünür: `https://KULLANICIADINIZ.github.io/cfo/`
6. **Telefona kurun:**
   - **iPhone:** adresi **Safari** ile açın → Paylaş düğmesi → **Ana Ekrana Ekle**.
   - **Android:** adresi **Chrome** ile açın → ⋮ menü → **Uygulamayı yükle** (veya *Ana ekrana ekle*).
7. Uygulamayı **ana ekrandaki simgeden** açın ve kullanın.

> iPhone'da önemli: ana ekrana eklenen uygulamanın verileri, Safari'deki sekmeden ayrıdır. Verileri hep ana ekran simgesinden girin.

## Güvenli kullanım

- **Diğer → Yedek ve güvenlik → PIN belirle:** veriler şifrelenir. Uygulama arka planda 1 dakika kalınca kilitlenir.
- **Ayda bir yedek alın** (Yedek dosyası oluştur). Dosyayı iCloud Drive, Google Drive ya da e-postanıza kaydedin.
  - PIN açıksa yedek dosyası da şifrelidir.
  - Telefon değişirse: yeni telefonda uygulamayı kurun → **Geri yükle**.
- Tarayıcı verilerini temizlemek veya uygulamayı silmek, telefondaki verileri de siler. Bu yüzden yedek önemlidir.

## Güncelleme

Yeni sürüm geldiğinde değişen dosyaları aynı depoya yeniden yükleyin (**Add file → Upload files**). Verileriniz telefonda kalır, etkilenmez.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html`, `app.css`, `app.js` | Arayüz |
| `engine.js` | Hesap motoru (Excel v2 ile birebir aynı formüller) |
| `store.js` | Telefonda saklama, PIN şifreleme, yedek |
| `charts.js` | Grafikler |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | Çevrimdışı çalışma ve ana ekran simgesi |
| `xlsx.mini.min.js` | Excel'e aktarma (SheetJS, Apache-2.0 lisansı) |

Bu uygulama bir hesap aracıdır, finansal danışmanlık değildir. Önemli kararlardan önce güncel tutarları bankanızdan teyit edin.
