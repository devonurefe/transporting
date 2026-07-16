# HuurGo — Kapsamlı QA / Tasarım / Güvenlik / Performans Denetimi (Temmuz 2026)

Bu rapor, sitenin **canlı tarayıcı testleri** (Playwright + Chromium: 3 viewport ×
10 sayfa, uçtan uca sipariş akışları, axe-core WCAG taraması, reduced-motion
emülasyonu), **API/sözleşme testleri** (fiyat aynası senaryoları, sipariş yaşam
döngüsü) ve **kod denetimi** (güvenlik, performans korkulukları, tasarım
tutarlılığı) ile hazırlandı. Önceki iki denetimi (`QA-FINDINGS.md` 2026-06,
`PROJE-DEGERLENDIRME-2026-07.md`) tekrarlamaz; onların üzerine koyar.

**Test ortamı:** lokal PostgreSQL 16 (initdb), `prisma db push + seed`, dev
server :3000, prod build :3100 (header/preload doğrulaması). Tarih: 15–16 Temmuz 2026.

---

## 1. Yönetici özeti

Site **fonksiyonel olarak sağlam durumda**: üç ana akış (ana sayfa → katalog →
kiralama) 3 viewport'ta da hatasız; sipariş oluşturma, fiyat doğrulama, hafta
sonu kuralları, durum makinesi ve çifte-rezervasyon engeli canlıda birebir
doğrulandı. `npm run lint` temiz, **485/485 test** geçiyor, prod build sorunsuz.

Bu turun ana bulgusu **erişilebilirlik kontrast regresyonuydu**: axe-core,
müşteri yüzünde 40+ WCAG AA kontrast ihlali buldu (CLAUDE.md'nin iki kez
uyardığı `text-slate-400`-açık-zemin kalıbı geri sızmış). Düzeltilebilir
olanların **tamamı bu dalda düzeltildi** (bölüm 3); geriye yalnızca bilinçli
marka kararı gerektiren turuncu CTA'lar kaldı (Y-1).

### Alan karnesi (bu tur)

| Alan | Not | Özet |
|---|---|---|
| Ana akışlar (home/katalog/booking) | **A** | 3 viewport × 10 sayfa: 0 konsol hatası, 0 yatay taşma, 2 uçtan uca sipariş + 5 fiyat senaryosu PASS |
| Fiyatlandırma doğruluğu | **A** | Weekend paket / Sunday-block / pro-rata: istemci = CLAUDE.md kuralları = sunucu aynası (5/5) |
| Backend süreç bütünlüğü | **A** | Ödeme guard'ı, durum makinesi, terminal koruması, geçmiş tarih reddi, idempotency — hepsi doğrulandı |
| Performans korkulukları | **A-** | Base64 sızıntısı yok, gzip 3.7KB katalog, hero preload prod'da doğru, sw.js no-cache; tek not: invoice penceresi Google Fonts CDN |
| Erişilebilirlik | **C → B+** | 40+ kontrast ihlali (düzeltildi), FAB'da aria-label yoktu (düzeltildi); kalan: turuncu CTA (Y-1). Reduced-motion kusursuz (0 animasyon) |
| Güvenlik | **B+** | Header'lar/CSP/HSTS prod'da tam; e-posta+fatura escape'leri sağlam; requireAdmin revocation açığı kapatıldı; kalan: register enumeration (Y-2), dev-CORS env kapısı (Y-3) |
| Tasarım tutarlılığı | **B+** | Font sistemi (Outfit/Inter/JetBrains Mono) ve € formatı tutarlı; admin'de EN marka dili (O-5), demo seed eski fiyat modeli (O-4) |

---

## 2. Doğrulanan güçlü yönler (canlıda test edildi)

- **Uçtan uca sipariş akışı**: katalog araması (`?q=` URL senkronu ✓) → detay
  modalı → "Huur Nu" → takvim (geçmiş günler kapalı, dolu günler kırmızı) →
  teslimat seçimi → misafir checkout → sipariş (HWH-…) + başarı ekranı
  (kopyala butonu, Pro-forma PDF, WhatsApp CTA). İki ayrı koşuda hatasız;
  "Totaalbedrag klopt niet" hiç görülmedi.
- **Hafta sonu fiyat kuralları — 5/5 senaryo PASS** (Bravi Leonardo,
  `weekendRulesEnabled`): tek Cmt → €69 paket; Cmt+Paz → €69 paket; Cum+Cmt →
  2-gün tarifesi €80 + €20 Sunday-block; Pzt–Cmt 6 gün → pro-rata €168 + €20;
  Cum+Cmt+Paz → 3-gün tarifesi, fee YOK. İstemci hesabı (`pricing.ts`) =
  CLAUDE.md kural tablosu = sunucu aynası (5 sipariş de 201 döndü).
- **Sipariş yaşam döngüsü**: ödenmemişken Goedkeuren → doğru Hollandaca hata;
  betaald → Goedgekeurd → Onderweg → Voltooid ✓; terminal durumdan geri geçiş
  → reddedildi ✓.
- **Çifte rezervasyon engeli görünür**: onaylanan siparişin günleri sonraki
  ziyarette takvimde otomatik seçilemez oldu (28–29 Tem testi).
- **Admin paneli 11/11**: Dashboard, Huurcontracten, Machine Beheer, Kalender,
  Planning, Klanten, Machine Toevoegen, Kenniscentrum, Beheer Storefront,
  Omzet & Export, Systeemdiagnose, Bezoekers & Activiteit — hepsi açıldı,
  0 konsol hatası. Bestelling-beheren modalı (contact + maliyet dökümü +
  durum aksiyonları) çalışıyor.
- **Layout sağlamlığı**: 10 sayfa × 3 viewport (375/768/1440) — hiçbir sayfada
  yatay taşma yok, konsol/pageerror yok.
- **Reduced-motion**: `prefers-reduced-motion: reduce` altında ana sayfada
  **0 çalışan animasyon** — `index.css` bloğu kusursuz.
- **Performans korkulukları** (CLAUDE.md): public `/api/machines`'te base64 yok
  (26KB ham / **3.7KB gzip**); `?w=` proxy'leri çalışıyor; self-host fontlar +
  preload ✓; prod'da hero `<link rel="preload" as="image" fetchpriority="high"
  imagesrcset…>` enjeksiyonu ✓; `sw.js` no-cache ✓; `/assets` 1y ✓.
- **Prod güvenlik header'ları** (:3100 doğrulaması): CSP (script-src self +
  clarity, frame-src none, object-src none), HSTS 1y, X-Frame-Options DENY,
  nosniff, Referrer-Policy ✓.
- **XSS yüzeyi**: e-posta şablonları (`esc()`) ve fatura penceresi
  (`escapeHtml`) müşteri girdilerini tutarlı escape ediyor; React UI zaten
  otomatik escape.
- **Seed güvenliği**: `ADMIN_DEFAULT_PASSWORD` yokken rastgele admin şifresi
  üretiliyor (tahmin edilebilir `admin123` değil) — önceki rapordaki endişe
  giderilmiş.
- **VAT toggle** doğru çalışıyor (€50 → €60,50); fiyat özeti BTW hesabı
  ekranla birebir.

**Ekran görüntüsü artefaktı (hata değil):** fullPage screenshot'larda ana
sayfada iki büyük "boş" bölge görünür (Hoe werkt huren?, Waarom HuurGo,
koffie bölümleri). Bunlar `whileInView` scroll animasyonlarıdır; gerçek
kullanıcı kaydırdığında tetiklenir (canlı scroll testiyle doğrulandı,
opacity 1 oluyor). Otomasyon yazan herkes bunu bilsin diye not edildi.

---

## 3. Bu turda düzeltilenler (bu dalda, commit commit)

| Commit | Düzeltme |
|---|---|
| `e3d4199` | **WCAG AA kontrast** — axe-core'un bulduğu 40+ ihlal: katalog kartları ("per dag excl. btw" 10px, rating sayısı, fiyat-popup satırları), booking adım göstergesi ("Stap X van 2", pasif/aktif adım etiketleri), BookingStep1 yardım metinleri + teslimat alt etiketleri + saat dilimleri + "Optioneel", fiyat vurguları `emerald-600→700`, "Verplicht" `rose-500→600`, BookingStep2 sektör metni, MyOrders pasif login sekmesi, katalog kart adı hover'ı `orange-600→700`. Kalıp: `text-slate-400`→`text-slate-500` (yalnız açık zemin + ≤14px metin; ikonlara ve koyu zeminlere dokunulmadı). |
| `17398c8` | **WhatsApp FAB erişilebilirliği** — ikon-only butonda `aria-label` yoktu (screen reader "button" diyordu); açık/kapalı durumlu `aria-label` + `aria-expanded` eklendi; panel başlığı/alt metin kontrastı düzeltildi. **"Zweef om te pauzeren"** ipucu yalnız hover'ı olan cihazlarda gösteriliyor (`hidden sm:block`) — dokunmatikte duraklatma jesti yok (CSS `:hover`-only). |
| `8d6e966` | **Güvenlik: `requireAdmin` token-revocation** — `requireAuth` şifre değişikliği öncesi token'ları reddediyordu ama admin endpoint'lerinin kullandığı `requireAdmin` etmiyordu: admin şifre değiştirse bile eski/çalınmış admin token'ı 7 güne kadar geçerli kalıyordu. Aynı `isTokenRevoked` kontrolü eklendi. |

**Doğrulama:** düzeltmeler sonrası `npm run lint` temiz, **485/485 test**,
axe yeniden taraması: katalog 21→0, booking 16→0 düzeltilebilir ihlal
(kalan yalnız Y-1 ve logo muafiyeti), uçtan uca booking akışı yeniden koşuldu
(HWH-9E184A23 ✓).

---

## 4. Açık tespitler (önem sırasıyla)

### Yüksek

- **Y-1 · Turuncu CTA kontrastı (tüm site):** Header'daki "Boeken" butonu ve
  `/orders` "Beveiligd Inloggen" — beyaz 12–14px metin `bg-orange-500`
  üzerinde, oran **2.88** (gereken 4.5). Sitenin en görünür butonu ve her
  sayfada. Marka rengi kararı olduğu için dokunulmadı. Seçenekler:
  (a) buton zeminini `orange-700`'e koyulaştır (≈5.3 ✓, görünür değişim),
  (b) metni ≥18.66px bold yap (büyük-metin eşiği 3:1'e düşer, mevcut zeminle
  yine sınırda), (c) `orange-600` zemin + koyu metin. Öneri: (a) yalnız bu
  iki buton için.
- **Y-2 · Register e-posta enumeration (P2-14, hâlâ açık):** `POST
  /api/auth/register` ikinci denemede "E-mailadres is al in gebruik" dönüyor —
  forgot-password'daki eşitlenmiş yanıt disiplini burada yok; kayıtlı
  e-postalar dışarıdan taranabilir. (Auth limiter 10/15dk taramayı
  yavaşlatıyor ama engellemiyor.)

### Orta

- **O-1 · Sipariş limiter'ı başarısız denemeleri de sayıyor:** 6/saat
  `orderCreationLimiter`, 400 dönen doğrulama hataları dahil her POST'u
  sayıyor. Formu birkaç kez yanlış dolduran meşru müşteri "Te veel
  boekingspogingen" ile 1 saat kilitlenebilir. `skipFailedRequests: true`
  (veya en azından 4xx'leri sayma) düşünülmeli. (Testte bizzat yaşandı.)
- **O-2 · 429 durumunda sessiz boş içerik:** Global limit (300/dk) aşıldığında
  katalog/ana sayfa veri çekemiyor ve kullanıcıya hata göstermeden boş
  bölümler kalıyor. Nadir ama teşhisi zor; basit bir "Er ging iets mis,
  probeer opnieuw" durumu eklenebilir.
- **O-3 · Dev CORS + CSP yalnız `NODE_ENV`e bağlı:** `NODE_ENV=production`
  set edilmezse CORS `origin:true`+credentials açılıyor, CSP/HSTS kapanıyor.
  Docker/CI hattında env set ediliyor; yine de `server.ts` açılışında
  "NODE_ENV != production" için görünür bir uyarı logu ucuz bir sigorta olur.

### Düşük / bilgi

- **D-1 · Invoice penceresi Google Fonts CDN kullanıyor** (`invoice.ts:183`):
  ana sayfayı etkilemez (ayrı pencere), ama çevrimdışı/engellenen CDN'de
  fatura sistem fontuyla basılır. İstenirse self-host fontlara bağlanabilir.
- **D-2 · Seed demo siparişleri eski fiyat modeli içeriyor:** "BMWT
  Chauffeurskosten €150" gibi kalemler (uygulamada driver cost artık hep 0).
  Yalnız dev/demo ortamı; prod'a gitmiyor (2026-07 düzeltmesi). Kafa
  karışıklığını önlemek için seed güncellenebilir.
- **D-3 · Admin panelinde İngilizce marka dili:** "HubAdmin Portal",
  "HubAdmin Command Center", "Secure Admin Control • Active Connection" —
  müşteri yüzü tamamen NL iken admin karışık. Kozmetik.
- **D-4 · € format konvansiyonu değişmiş:** Haziran raporu "€ " (boşluklu)
  standardını yazıyordu; bugün tüm UI tutarlı biçimde bitişik ("€18,15").
  Tutarlı olduğu için sorun değil — sadece eski rapor/CLAUDE notlarıyla
  çelişki; dokümantasyon güncellenmeli.
- **D-5 · Logo "go" kontrastı axe'te görünüyor:** logotype'lar WCAG
  muafiyetidir; aksiyon gerekmez (bilinçli olarak düzeltilmedi).

### Önceki raporun yol haritası (durum değişmedi, hâlâ geçerli)

`prisma migrate` adaptasyonu (P0), para alanları Float→Decimal (P0), fiyat
hesabının tek kaynağa indirilmesi (P1), ortak `<MachineForm>` (P1), dev dosya
bölme (P1), EN dilinin tamamlanması veya kaldırılması (P2), admin
loading/error state'leri (P2), base64 görsellerin diske taşınması (P3).
Ayrıntılar: `PROJE-DEGERLENDIRME-2026-07.md` §4.

---

## 5. Test kanıtları

- Statik: `npm run lint` ✓ · `npm run test` 485/485 ✓ (DB'li entegrasyon
  dahil) · `npm run build` ✓ (vendor chunk'lar yerinde: react-vendor 230KB,
  motion 128KB, icons 43KB ayrı).
- Tarayıcı: 30 sayfa-yüklemesi (10 rota × 3 viewport) + etkileşimli akışlar;
  ekran görüntüleri oturum scratchpad'inde üretildi (repo'ya eklenmedi).
- Siparişler: HWH-F71F09E5 (Altrex, tam yaşam döngüsü Voltooid'e kadar),
  HWH-CFB49552/0D56D4C1/01CD0E48/D098A45F/B83CCED5 (5 weekend senaryosu),
  HWH-9E184A23 (düzeltme-sonrası regresyon koşusu).
- Yeniden çalıştırma talimatları: `TEST-PLAN.md`.
