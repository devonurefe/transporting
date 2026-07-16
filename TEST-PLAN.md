# HuurGo — Kalıcı Test Planı

Yeniden çalıştırılabilir, sürüm-bağımsız test planı. Her release öncesi en az
**Bölüm A (smoke)** koşulmalı; UI/fiyat değişikliklerinde ilgili bölüm eklenir.
Son tam koşu: 2026-07 (`QA-DESIGN-REVIEW-2026-07.md`).

## Ortam kurulumu

```bash
# 1) PostgreSQL (Docker varsa)
docker compose up -d postgres
export DATABASE_URL=postgresql://huurgo:huurgo_dev_pass@localhost:5432/huurgo
# (Docker yoksa: initdb -U huurgo → pg_ctl start → createdb huurgo)

# 2) Şema + veri + sunucu
npx prisma db push && npx prisma db seed   # seed admin şifresini konsoldan not al!
npm run dev                                 # http://localhost:3000

# 3) Statik kapılar — HER ZAMAN
npm run lint && npm run test && npm run build
```

> **Rate limit notu:** otomasyon 300/dk global ve **6/saat sipariş** limitine
> takılır. Test IP'sini ayrıştırmak için isteklere farklı `X-Forwarded-For`
> ver (dev'de `trust proxy 1` bunu okur) veya sunucuyu yeniden başlat
> (limiter in-memory).

---

## A. Smoke (release-öncesi zorunlu, ~15 dk)

| # | Adım | Beklenen |
|---|------|----------|
| A1 | `npm run lint && npm run test` | 0 tip hatası; tüm testler yeşil (DB'liyken integration dahil) |
| A2 | `/` aç (mobil 375px + desktop) | Hero anında görünür; konsolda hata yok; yatay scroll yok |
| A3 | Çerez bandı → Accepteren | Band kapanır, bir daha gelmez |
| A4 | Katalogda ara: "schaar" | URL `?q=schaar`; kartlar filtrelenir |
| A5 | Bir makine kartı → detay modalı | Specs tablosu tam; Escape/X kapatır |
| A6 | "Huur Nu" → `/booking` | Sepette 1 ürün; takvim açılır |
| A7 | Hafta içi 2 gün seç + Zelf ophalen → Doorgaan | Fiyat özeti: doğru tarife + BTW %21 |
| A8 | Gast Verder → ad/e-posta/telefon → Aanvraag versturen | Başarı ekranı: HWH-…, "NOG NIET BEVESTIGD", WhatsApp CTA; **"Totaalbedrag klopt niet" ASLA görünmemeli** |
| A9 | `/admin` → login → Huurcontracten | Yeni sipariş listede "In behandeling" |
| A10 | Ödeme işaretlemeden Goedkeuren | Hollandaca engel mesajı |
| A11 | Betaald işaretle → Goedkeuren → Onderweg → Voltooid | Her geçiş başarılı; rozetler güncellenir |
| A12 | `curl -s localhost:3000/api/machines \| grep data:image` | **Boş** (public feed'e base64 sızmamalı) |

## B. Fiyatlandırma senaryo matrisi

**B1 — Standart tarifeler** (herhangi bir makine): 1 gün (`oneDayPrice`/gün
fiyatı), 2 hafta-içi günü (`twoDayPrice`), 5 gün (`weeklyPrice`), 6–27 gün
(pro-rata `round(days × weekly/5)`, `monthlyPrice` tavanlı), 28+ gün (aylık).
Her seferinde ekrandaki toplam = sunucu kabulü (sipariş 201 dönmeli).

**B2 — Weekend kuralları** (`weekendRulesEnabled` makine, ör. Bravi Leonardo;
2026-07 doğrulanmış değerler):

| Senaryo | Örnek | Beklenen |
|---|---|---|
| Tek Cumartesi | Cmt–Cmt | `weekendPrice` flat (€69) |
| Cmt+Paz | Cmt–Paz | `weekendPrice` flat (€69) |
| Cum+Cmt (son iş günü Cmt) | Cum–Cmt | 2-gün tarifesi **+ `sundayBlockFee`** (€80+€20) |
| Pzt–Cmt 6 gün | Pzt–Cmt | pro-rata **+ fee** (€168+€20) |
| Cum+Cmt+Paz (Paz bilinçli son gün) | Cum–Paz | 3-gün tarifesi, **fee YOK** |
| Cmt başlangıç + hafta içine uzayan | Cmt–Çar | Normal gün-sayısı tarifesi, paket YOK |

**B3 — Manipülasyon reddi** (API): `totalAmount` ±1 oynat → 400
"Totaalbedrag klopt niet"; geçmiş `startDate` → 400; `rentalDays` ile tarih
uyuşmazlığı → 400.

## C. Sayfa-bazlı kontroller (UI değişikliklerinde)

- **Ana sayfa:** VAT toggle (excl↔incl, ×1.21); kampanya carousel mobilde
  otomatik akar, dokunınca durur; review ticker akar (hover'da durur, hint
  yalnız desktop'ta); footer linkleri; WhatsApp FAB: `aria-label` +
  `aria-expanded` mevcut, panel 4 şablon linki `wa.me/31611848899?...`,
  scrim'e tıklayınca kapanır.
- **Katalog:** kategori chip'leri `?cat=` yazar; indirim rozetleri
  `computeDiscounts` ile tutarlı (negatif rozet asla); "Dagactie" rozeti;
  kart görselleri `?w=480` benzeri whitelist genişliği ister.
- **Booking:** takvimde geçmiş günler gri+disabled; dolu günler rose+nokta;
  aylar arası gezinme; teslimat kartları `aria-pressed`; bezorging'de adres +
  zaman dilimi zorunlu; >20 km → WhatsApp yönlendirme; sepet localStorage'da
  kalıcı (sayfa yenile → durur).
- **Orders:** kayıt → login → sipariş listesi; müşteri kendi siparişini
  iptal edebilir (In behandeling'den); başkasının siparişi 404.
- **Admin:** 12 sekme/panel tek tek açılır (konsol temiz); Kalender'de gün
  blokla/aç; Machine Beheer'de fiyat düzenle → katalogda yansır; görsel URL
  X'le temizlenince placeholder (Unsplash fallback YASAK).
- **404:** `/olmayan-yol` → tasarımlı sayfa, çıplak beyaz sayfa değil.

## D. Erişilebilirlik + tasarım

- **axe-core** (Playwright ile `/`, `/catalog`, `/booking`, `/orders`):
  hedef **0 yeni ihlal**. Bilinen/kabul edilen: turuncu CTA beyaz metni (Y-1
  kararına bağlı), logo "go" (logotype muafiyeti).
- **Kontrast altın kuralı** (CLAUDE.md): ≤14px metin açık zeminde asla
  `text-slate-400` olamaz (min `slate-500`); yeni `emerald/orange/rose`
  vurgu metinleri 14px'te `-700/-600` tonunda.
- **Reduced-motion:** `prefers-reduced-motion: reduce` emülasyonuyla ana
  sayfada çalışan animasyon sayısı **0** olmalı.
- **Klavye:** Tab ile skip-link görünür; modallar Escape ile kapanır;
  focus-visible halkası kaybolmamış.
- **Font sistemi:** başlık Outfit, gövde Inter, fiyat/kod JetBrains Mono;
  Google Fonts CDN'i `index.html`/`index.css`'e ASLA geri gelmemeli
  (self-host woff2).
- **Ekran görüntüsü otomasyonu notu:** fullPage screenshot'ta `whileInView`
  bölümleri boş görünür — hata değil; önce sayfayı programatik kaydır.

## E. Performans korkulukları (CLAUDE.md invariant'ları)

```bash
curl -s localhost:3000/api/machines | wc -c                      # ham ~26KB civarı
curl -s -H "Accept-Encoding: gzip" -o /dev/null -w "%{size_download}\n" \
  localhost:3000/api/machines                                    # gzip < 10KB
curl -sI localhost:3000/sw.js | grep -i cache                    # no-cache
# Prod modda (NODE_ENV=production node dist/server.js):
curl -sI localhost:PORT/ | grep -iE "strict-transport|security-policy|x-frame"
curl -s  localhost:PORT/ | grep -o '<link rel="preload" as="image"[^>]*'  # hero preload
```

Lighthouse mobil hedefi: Performance ≥ 75 (lab ±5–10 oynar; tek koşuya bakma),
CLS = 0 kalmalı.

## F. Güvenlik hızlı kontrolleri

- Admin endpoint'leri token'sız → 401/403 (`/api/orders/export`, `PUT
  /api/machines/:id`…).
- Admin şifre değişikliği sonrası **eski token reddedilmeli** (revocation —
  hem `requireAuth` hem `requireAdmin`).
- Auth limiter: 11. hızlı login denemesi 429.
- Upload: SVG reddedilir; magic-byte uyuşmazlığı reddedilir; 3MB üstü reddedilir.
- `.ics` feed: yanlış token → 404/403; `CALENDAR_FEED_TOKEN` boşsa kapalı.

## G. Bilinen açık maddeler (test ederken şaşırma)

`QA-DESIGN-REVIEW-2026-07.md` §4: turuncu CTA kontrastı (Y-1), register
enumeration (Y-2), sipariş limiter'ının 400'leri sayması (O-1), 429'da sessiz
boş içerik (O-2), invoice penceresi Google Fonts (D-1), seed demo verisinde
eski fiyat kalemleri (D-2), admin'de EN marka dili (D-3).
