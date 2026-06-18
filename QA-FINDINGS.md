# QA Findings — Uçtan Uca Akış Testi (2026-06)

Kullanıcının ekrandan gözlemleyip paylaştığı 24 maddelik liste kodda doğrulandı
ve onaylanan hatalar düzeltildi. Ayrıca tüm sipariş yaşam döngüsü, yerel bir
PostgreSQL + dev server üzerinde HTTP ile uçtan uca sürülerek test edildi.

## Test ortamı
- Yerel PostgreSQL 16 cluster (docker daemon yok → `initdb` ile doğrudan).
- `prisma db push` + `prisma db seed` + `npm run dev` (port 3000), RESEND boş → mock e-posta.
- `npm run test`: **198/198 geçti**. `npm run lint`: değişiklikler **yeni tip hatası eklemedi**
  (mevcut baseline'da olan `t()` 3-arg ve `DeliveryType` uyarıları hariç — bunlar önceden vardı).

## Uçtan uca akış smoke (canlı HTTP) — hepsi PASS
| Senaryo | Sonuç |
|---|---|
| Müşteri register → login → token | ✅ |
| Admin login | ✅ |
| Manipüle edilmiş `totalAmount` reddi ("Totaalbedrag klopt niet") | ✅ |
| Geçmiş `startDate` reddi | ✅ |
| Geçerli sipariş oluşturma (oneDayPrice ile €60,50) | ✅ |
| Ödeme yapılmadan onay engeli ("Betaling moet eerst...gemarkeerd") | ✅ |
| Ödeme paid → onay → Onderweg → Voltooid | ✅ |
| Terminal durumdan geçersiz geçiş reddi | ✅ |
| Müşteri cancel (In behandeling → Geannuleerd) | ✅ |
| iCal feed (`/api/calendar/<token>/huurgo.ics`) | ✅ |
| Reminder endpoint (timing-safe secret) | ✅ |
| Mock e-posta akışları (confirmation, admin alert, status update, cancel) loglandı | ✅ |

## 24 madde — durum ve uygulanan düzeltme
| # | Sorun | Durum | Düzeltme |
|---|-------|-------|----------|
| 1 | "Huurperiode" ↔ tarife metni üst üste binme | Düzeltildi | `BookingPriceSummary` SummaryRow: `items-start`, label `shrink-0`, value `min-w-0 break-words` |
| 2 | Subtotaal/BTW font-renk tutarsızlığı | Düzeltildi | Row renkleri harmonize (slate-700/500) |
| 3 | "Voordeeltarief toegepast" göstergesi yok | Eklendi | Flat/haftalık tarifte gerçek tasarruf varsa yeşil rozet |
| 4 | "Weekenddagen N gratis inbegrepen" gramer | Düzeltildi | Tekil/çoğul + ifade sadeleşti (madde 7 ile) |
| 5 | "Bezorging door ons" | Yeniden adlandırıldı | "Transportkosten" (hardcoded + `languageStore`) |
| 6 | "Kompakte" (Almanca) | Düzeltildi | "Compacte" — `seed.ts` + `server.ts` idempotent migration (canlı DB de) ✓ doğrulandı |
| 7 | "Nee, niet werken" → hâlâ "gratis inbegrepen" | Düzeltildi (kritik) | `weekendWorkAnswer` `sums`'a eklendi; satır sadece "nee"de "Gratis (geen gebruik)" |
| 8/18 | Sepet değiştir native `confirm()` yerel-dil butonları | Düzeltildi | App.tsx'te Hollandaca özel modal ("Vervangen"/"Annuleren") |
| 9 | Römork tasarruf ipucu yok | Eklendi | BookingStep1 "Wij bezorgen" altına amber tip |
| 10 | Kampanya kartı metin kesilmesi | İyileştirildi | Başlığa `break-words` |
| 11a | "door heel Nederland" | Düzeltildi | "in heel Nederland" — `seed.ts`, `Footer.tsx`, `siteConfig` auto-heal ✓ doğrulandı |
| 11b | "1 dag actie" | Düzeltildi | "Dagactie" (Catalog/Home/DetailModal) |
| 12 | Euro boşluk tutarsızlığı | Düzeltildi | Tüm fiyatlar "€ " (boşluklu) — paylaşımlı stile yöneltildi |
| 13/14 | "zzp" | Düzeltildi | "ZZP'ers" (`languageStore`, `Footer`) |
| 15 | "Huur Nu" ev ikonu | Düzeltildi | `ShoppingBag` → `ShoppingCart` |
| 16a | Popup açıklamada "(Unit N)" | Düzeltildi | Açıklama render'ında regex strip (canlı DB için de) |
| 16b | Specs tablosu alt kesilme | Düzeltildi | Scroll konteynerine `pb-4` |
| 16c | "Elektrisch" yeşil | Düzeltildi | Nötr siyah (`text-slate-900`) |
| 16d | Birim sütunları sağa hizasız | Düzeltildi | Değer span'lerine `text-right` |
| 16e | Kart altı "+N meer" | Kaldırıldı | Overflow rozeti silindi |
| 20 | "Beweeg om te pauzeren" | Düzeltildi | "Tik om te pauzeren" |
| 21 | Review kartı tarihi sıkışık | Düzeltildi | Kart `p-5`, satır `gap-3 pt-1.5` |
| 22/23 | Mobil kategori barı scroll ipucu | Eklendi | Sağ gradient-fade + chevron (mobilde) |
| 24 | Kampanya bölümü otomatik kaymıyor | Eklendi | Mobil yatay liste auto-advance (hover/touch'ta durur) |

## Notlar / bilinçli kararlar
- DB'de saklı metinler (`Kompakte`, hero subtitle, `(Unit N)`) için seed'i değiştirmek
  canlıyı düzeltmez (seed `update:{}`). Bu yüzden: idempotent startup migration,
  `CORRECT_SUBTITLE` auto-heal, ve görüntüleme-anı strip kullanıldı — üçü de canlıda doğrulandı.
- Varsayılan kararlar: ikon `ShoppingCart`, etiket "Transportkosten", tek tutarlı "€ " formatı.

## Kapsam dışı / ayrı izlenecek
- Mevcut baseline tip hataları (`HomeSection` `t()` 3-arg, `BookingSection` `DeliveryType`)
  bu çalışmada eklenmedi; ayrı bir temizlik gerektirir.
- Kalıntı Gemini/AI artefaktları (`@google/genai` bağımlılığı, `GEMINI_API_KEY` config'leri,
  `menuAdvisorLabel`) — kullanıcıyla kapsam netleştiriliyor.
