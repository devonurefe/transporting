# HuurGo — Kapsamlı Proje Değerlendirmesi (Temmuz 2026)

Bu rapor, kod tabanının README'den bağımsız olarak uçtan uca taranmasıyla hazırlandı:
müşteri arayüzü, admin paneli, backend, veritabanı, güvenlik, performans, testler ve
deploy hattı. Bulguların bir kısmı bu değerlendirmeyle birlikte aynı dalda düzeltildi
("Bu turda düzeltildi" bölümü); geri kalanı önceliklendirilmiş yol haritasında.

---

## 1. Yönetici özeti

Proje genel olarak **beklenenden sağlam**: sipariş oluşturma hattı (Serializable
transaction + sunucu tarafı fiyat doğrulama + idempotency), upload güvenliği ve
tasarım sistemi profesyonel seviyede. Zayıf noktalar üç kümede toplanıyor:

1. **Süreç/altyapı**: CI'da test kapısı yoktu (düzeltildi), `prisma db push` dört ayrı
   yerde çalışıyordu (tekilleştirildi), migration geçmişi hâlâ yok.
2. **Kod organizasyonu**: 1000+ satırlık 6 dosya, fiyat hesabının 3 kopyası,
   AdminAddMachine ≈ AdminMachines form kopyası (~800 satır).
3. **Cilalama**: gereksiz rota animasyonu (düzeltildi), native `alert()`'ler
   (düzeltildi), sahte "4.9" rating fallback'i (düzeltildi), EN modunda yarı
   Hollandaca arayüz (yol haritasında).

### Alan bazlı karne

| Alan | Not | Özet |
|---|---|---|
| Sipariş/booking backend'i | **A** | Serializable tx + retry, fiyat aynası, idempotency-key, geçmiş tarih reddi |
| Güvenlik | **B+** | Helmet/CSP, timing-safe secret'lar, magic-byte upload, bcrypt 12; kayıt endpoint'inde e-posta enumeration, in-memory rate limit (tek instance için doğru) |
| Tasarım sistemi / UI | **B+** | Outfit/Inter/JetBrains Mono, turuncu-zümrüt palet, reduced-motion, skip-link; tutarlı ve modern |
| Müşteri akışı (UX) | **B** | PDOK adres arama, hafta sonu sorusu, sepet kalıcılığı iyi; step sayacı kafa karıştırıcı (aşağıda) |
| Admin paneli | **B-** | İşlevsel ve mobil uyumlu; ama form kopyası, çoğu panelde loading/error state yok, tablo sıralama yok |
| Kod organizasyonu | **C+** | 6 dosya 1000+ satır; fiyat mantığı 3 yerde; i18n yarım |
| Test | **C** | 232 birim testi (fiyatlandırma çok iyi) ama **sıfır** API/entegrasyon/komponent testi |
| Deploy/CI | **C → B** | Test kapısı yoktu (eklendi); şifreli SSH sahibin kararıyla korunuyor; migration framework yok |
| Performans | **B** | Kod bölme, indeksler, gzip iyi; base64 görseller DB'de → `/api/machines` payload riski |

---

## 2. Bu turda düzeltilenler (bu dalda, commit commit)

1. **Catalog → Booking'deki gereksiz animasyon** *(bildirilen sorun)* —
   `App.tsx`'te tüm rotalar `AnimatePresence mode="wait"` içinde 0.3s fade
   çiftiyle sarılıydı: önce eski sayfa tamamen sönüyor, lazy Booking chunk'ı
   ön-ısıtılmadığı için araya spinner giriyor, sonra yeni sayfa 0.3s'de
   beliriyordu (~0.6s+ salt dekoratif gecikme). Rota geçişleri artık anlık;
   Booking chunk'ı da Catalog/FAQ gibi boşta ön-yükleniyor.
2. **Admin Orders filtre bug'ı (fonksiyonel)** — Filtreler yalnızca ilk 100
   siparişte arıyordu ve filtre aktifken "Meer laden" gizleniyordu; eski
   siparişler bulunamıyordu. Filtre aktifken artık kalan sayfalar otomatik
   yükleniyor (`loadAllOrders`, 50 sayfa güvenlik sınırı) ve ilerleme gösteriliyor.
3. **CI kalite kapısı** — `deploy.yml`'e `test` job'ı eklendi (npm ci → prisma
   generate → `npm run lint` → `npm run test`); build/deploy artık buna bağlı ve
   PR'larda da koşuyor. *(SSH yöntemi sahibin kararıyla değiştirilmedi.)*
4. **`prisma db push` tekilleştirme** — Dockerfile CMD, `npm start`, deploy adımı
   ve autoSeed olmak üzere dört yerde koşuyordu; artık yalnızca konteyner
   açılışındaki `npm run start` içinde. Ek kazanç: eski CMD'deki `npx prisma db seed`,
   prod imajında bulunmayan `tsx`'e bağımlıydı (kırılgandı) — kaldırıldı, boş DB'yi
   `autoSeedIfEmpty` dolduruyor.
5. **Demo veri prod'a gitmiyor** — `seed.ts` demo müşteri/siparişleri artık yalnızca
   prod dışında (veya `SEED_DEMO_DATA=true` ile) basıyor; doğrulandı: prod modunda
   0 sipariş/0 müşteri, 22 makine. Bayat `delivery_with_driver` değeri geçerli
   `delivery_by_us` yapıldı; seed bcrypt rounds 10→12.
6. **Admin `alert()` → toast** — 32 blokleyici native `alert()` çağrısı (Machines,
   AddMachine, Calendar, Customizer, Customers, Orders, admin login) yeni
   `AdminToast` sistemine taşındı (otomatik kaybolan, temaya uygun, NL/EN/TR).
7. **Admin nav tekilleştirme + sahte widget** — Üç kez kopyalanmış 11 sekmelik nav
   tanımı tek `coreTabs`/`advancedTabs` dizisine indirildi. Statik
   "ONLINE/SECURE/100%" gösteren sahte "BMWT Status" kutusu kaldırıldı.
8. **Sahte rating kaldırıldı** — Footer, gerçek veri yokken uydurma "4.9 ★★★★★"
   gösteriyordu; artık yalnızca gerçek ortalama/yorum sayısı gösteriliyor.
9. **Erişilebilirlik** — BookingStep1'deki tıklanabilir `<div>` teslimat kartları
   gerçek `<button>` (iç içe buton gereken kart `role="button"` + klavye) +
   `aria-pressed` oldu.
10. **Küçük ama gerçek hatalar** — `server.ts`'teki JWT dev-default teşhisi yanlış
    string'le karşılaştırdığı için hiç tetiklenmiyordu (düzeltildi); WhatsApp
    alternatif-tarih mesajı `utils/whatsapp.ts`'e taşındı (tek numara kaynağı, 🦾
    imzası); `AdminSubTab` tipi paylaşıldı, bayat union'lar ve `as any` cast'ler
    temizlendi; props'lardaki rezerve `key?: string` alanları silindi;
    AdminMachines ham `localStorage` yerine `getAdminAuthHeaders` kullanıyor.
11. **Temizlik** — Ölü indigo CSS sistemi (`btn-primary`, `gradient-text` vb. —
    kullanılmadığı grep ile doğrulandı), `data/*.json` (Prisma öncesi kalıntı),
    `scripts/preparePush.mjs` (hiçbir yerden çağrılmıyor), `metadata.json`
    (AI-Studio scaffold'u) silindi; `.env.example`'daki yanıltıcı SQLite satırı
    PostgreSQL yapıldı; `console.warn/log` dev-only (`utils/log.ts`), README
    gerçek pipeline'la eşitlendi.

**Doğrulama:** `npm run lint` temiz, 232/232 test geçiyor, prod build başarılı;
lokal PostgreSQL 16 ile canlı smoke: `/api/health` healthy, katalog/SPA servis
ediliyor, prod-mod seed demo veri basmıyor.

---

## 3. Güçlü yanlar (korunması gerekenler)

- **Sipariş transaction'ı** (`server/routes/orders.ts`): Serializable izolasyon +
  P2034 retry/backoff, fiyatın sunucuda yeniden hesaplanıp 0.01 toleransla
  karşılaştırılması, `rentalDays` yeniden hesabı, geçmiş tarih reddi,
  idempotency-key desteği. Çifte rezervasyona karşı gerçek koruma.
- **Upload güvenliği** (`server/routes/api.ts`): uzantı allowlist'i, SVG bilinçli
  yasak, 3MB sınır, magic-byte doğrulaması.
- **Timing-safe secret karşılaştırmaları** (reminder + iCal feed), e-posta
  enumeration'a karşı eşitlenmiş forgot-password yanıtları.
- **Tasarım sistemi**: `index.css` @theme token'ları (Outfit display / Inter body /
  JetBrains Mono fiyatlar), belgelenmiş turuncu-zümrüt-kehribar palet, kapsamlı
  `prefers-reduced-motion` bloğu, skip-link, `:focus-visible` halkası. Modern ve tutarlı.
- **Booking UX detayları**: PDOK postcode araması (8s timeout + elle giriş fallback +
  >20 km WhatsApp yönlendirmesi), haftalık tarifede takvimden ÖNCE sorulan hafta
  sonu sorusu, sepetin localStorage kalıcılığı, çoklu makine siparişinde kısmi
  başarısızlık yönetimi.
- **SEO/analitik disiplini**: JSON-LD yalnızca gerçek rating varken aggregateRating
  basıyor; Clarity cookie onayından sonra lazy yükleniyor (GDPR'a uygun).
- **Deploy hijyeni**: portlar 127.0.0.1'e bağlı (yalnız nginx dışarıda), non-root
  konteyner, `${VAR:?}` fail-fast env kontrolleri, TLS 1.2/1.3 + güçlü cipher'lar.

---

## 4. Yol haritası (öncelik sırasıyla, her biri ayrı PR)

### P0 — Veri bütünlüğü / süreç
1. **`prisma migrate` adaptasyonu** — Hâlâ migration geçmişi yok; her açılışta
   `db push` şemayı sessizce değiştirebiliyor. Canlı DB'den baseline alınıp
   `prisma migrate deploy`'a geçilmeli. (DB yedeği + bakım penceresi gerekir.)
2. **Para alanları `Float` → `Decimal`, status/deliveryType → enum**
   (`prisma/schema.prisma`) — Fatura kesen bir uygulamada float yuvarlama riski;
   kod `Math.round(x*100)/100` ile telafi ediyor ama tip düzeyinde çözülmeli.
   1. madde tamamlanmadan yapılmamalı (aynı bakım penceresi).

### P1 — Mimari borç
3. **Fiyat hesabını tek kaynağa indirme** — `BookingSection.tsx`
   `calculationSummary()` (~270 satır) fiyat modelini iki dal halinde yeniden
   yazıyor; `handleCreateBooking` üçüncü kez hesaplıyor; `server/routes/orders.ts`
   aynası ~150 satır inline. Tier etiketi/gün sayımı/KDV `utils/pricing.ts`'ten
   dönmeli; sunucu aynası için paylaşılabilir saf modül düşünülmeli.
4. **Ortak `<MachineForm>`** — `AdminAddMachine.tsx` (905) ile `AdminMachines.tsx`
   edit modalı (~730 satır) neredeyse birebir kopya; ortak bileşen ~800 satır siler.
5. **Dev dosyaları bölme** — `MyOrdersSection.tsx` 1332 (auth kartı + siparişler +
   profil tek dosyada), `App.tsx` 1143, `BookingSection.tsx` 1082.
6. **API/entegrasyon testleri** — Sipariş transaction'ı, fiyat aynası, upload
   doğrulaması ve auth middleware'i otomatik testsiz (yalnızca elle smoke edilmiş).
   Supertest ile rota testleri en yüksek getirili yatırım.

### P2 — UX / ürün
7. **EN dili tamamlanması** — Dil EN'e çevrilince Catalog, MyOrders, Booking hata
   mesajları ve Home'un büyük kısmı Hollandaca kalıyor (hardcoded). Ya kalan
   string'ler `languageStore`'a taşınmalı ya da EN seçeneği kaldırılmalı.
8. **Booking step modeli** — Gösterge "Stap X van 2" derken `step === 4` başarı
   ekranı; 3 atlanıyor. Kullanıcıya görünmese de kırılgan; step enum'u sadeleşmeli.
9. **Admin panellerine loading/error state** — Machines/Orders/Planning/Dashboard
   boş render oluyor; yalnızca Customers düzgün `loading/error` uyguluyor. Tablolara
   sıralama da eklenmeli.
10. **Footer'daki 9 sabit yorum** — Review ticker'daki yorumlar hardcoded; gerçek
    `OrderRating` verisinden beslenmeli veya "örnek" olduğu belirtilmeli.
11. **Ana sayfa fiyat tutarsızlıkları** — `HomeSection` "€65/dag", `appStore`
    "v.a. €80/dag", override "€49/dag" (canlı fiyat gelince ezildiği için kozmetik
    ama yanıltıcı).

### P3 — Performans / temizlik
12. **Base64 görseller** — Upload akışı görselleri base64 olarak DB'ye yazıyor;
    `GET /api/machines` varsayılan olarak tüm tabloyu döndürdüğü için katalog
    payload'ı MB'larca şişebilir. Görselleri diske/objeye alıp URL saklamak veya
    liste endpoint'inde görsel alanlarını inceltmek gerekir.
13. **`applyDataMigrations`** (`server.ts`, ~180 satır) — `InvoiceCounter`
    tablosunu migration-marker olarak kullanan elle yazılmış blok; `prisma migrate`
    adaptasyonuyla birlikte emekli edilmeli.
14. **Kayıt endpoint'i enumeration** — `auth.ts` register "E-mailadres is al in
    gebruik" dönüyor (forgot-password'daki eşitlenmiş yanıt disiplini burada yok).
15. **Admin polling gözden geçirme** — Dashboard 60s'de bir siparişleri,
    Diagnostics 15s'de bir `/api/health`'i çekiyor; sekme değişiminde
    `AnimatePresence` panelleri unmount ettiği için fetch'ler yeniden koşuyor.
    Hafif bir TTL/cache düşünülebilir.

### Bilinçli olarak yapılmayanlar
- **SSH anahtarlı deploy'a geçiş** — sahibin kararıyla atlandı; mevcut
  `sshpass`+parola akışı korundu (README buna göre güncellendi).
- Şema tip değişiklikleri ve büyük refactor'lar — yukarıda P0/P1'de, ayrı PR'lar
  olarak planlandı (canlı DB riski ve inceleme kolaylığı için).

---

*Rapor: Claude Code proje incelemesi, 2 Temmuz 2026. Bulgular dosya/satır
düzeyinde koddan doğrulanmıştır; "Bu turda düzeltilenler" bölümündeki her madde
bu dalın commit geçmişinde ayrı ayrı izlenebilir.*
