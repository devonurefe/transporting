# HuurGo — Complete Frontend Audit

**Scope:** Public-facing website (storefront) of huurgo.nl — a Dutch-language aerial-lift / access-equipment rental marketplace operated by MB Hoogwerkers B.V. (Zoeterwoude, Zuid-Holland).
**Method:** Full source read of `src/` (React SPA) + `server.ts` (SEO/meta/image proxies). Admin console excluded except where it affects public data.
**Date:** 2026-07-22
**Note:** This is an assessment only. Nothing has been changed. Every finding cites concrete code evidence.

---

## PHASE 1 — COMPLETE DISCOVERY (site map)

| Area | Finding | Evidence |
|---|---|---|
| **Framework** | React 19 SPA, Vite 6, TypeScript strict, Tailwind v4 (no config file, `@theme` in CSS). Full-stack single-package: Express serves the built SPA + `/api`. | `package.json`, `vite.config.ts`, `src/index.css` |
| **Routing** | React Router v7, `<BrowserRouter>` client-side. Routes: `/` (home), `/catalog`, `/hoogwerker/:id` (machine detail), `/hoogwerker-huren/:stad` (city landing), `/veelgestelde-vragen`, `/over-ons`, `/privacy`, `/voorwaarden`, `/kenniscentrum` + `/kenniscentrum/:slug`, `/adviestool`, `/booking`, `/orders` (customer portal), `/admin`, `*` (404). | `src/App.tsx:815-900` |
| **Page hierarchy** | Flat. No nested layouts; `Header` + `<Routes>` + conditional `Footer`. Tabs derived from `location.pathname`. | `App.tsx:82,810-913` |
| **Component architecture** | ~55 components. All top-level sections + admin panels are `React.lazy()` + `Suspense`. Shared header sub-components (`HuurGoLogo`, `HuurGoText`, `BrandedText`, `CardBrandWatermark`) exported from `Header.tsx`. | `App.tsx:54-66` |
| **Design system** | Token comments in `src/index.css` (`--brand-primary` orange-500, success emerald/teal, neutral slate, warning amber). Enforced by convention, **not** by Tailwind config — colors are raw utility classes throughout. | `index.css:65-83` |
| **CSS architecture** | Single `index.css`: `@import "tailwindcss"`, `@theme` fonts, `@layer base` resets/focus, hand-written keyframes (kenburns, ctaSheen, floatY, review-ticker, skeleton). `prefers-reduced-motion` fully honored. | `index.css` |
| **UI libraries** | `lucide-react` (icons), `motion` (animations, imported as `motion/react` not framer-motion), `zustand` (state). No component library (no shadcn/Radix). | `package.json` |
| **State management** | Three Zustand stores: `appStore` (machines, orders, cart, blocked dates, siteConfig, campaignRules, vatDisplay), `authStore` (JWT + user), `languageStore` (NL/EN public, +TR admin). Cart + campaign rules + VAT display persisted to `localStorage`. | `store/*.ts` |
| **API communication** | Plain `fetch` throughout, no client (no React Query/SWR). Auth via `Authorization: Bearer` from `localStorage` (`hwh_token` / `hwh_admin_token`). Public vs admin data split by `hwh_admin_mode` flag + `?full=1`. | `appStore.ts:172-260`, `App.tsx:489-493` |
| **Auth (frontend)** | `authStore.checkAuth()` on mount; admin vs customer role branching in `App.tsx:292-326`. 2FA two-step handled in auth flow. Tokens in `localStorage` (deliberate, documented in CLAUDE.md). | `App.tsx:265-339` |
| **SEO** | Hybrid: static `index.html` meta + **server-side per-route meta injection** (`metaForRequest`/`injectMeta` in `server.ts`) for crawlers/social + **client-side** `useEffect` title/canonical/robots in `App.tsx:180-225` and `utils/seo.ts`. JSON-LD: LocalBusiness+RentalService, FAQPage, Product (machine pages), BreadcrumbList. Dynamic `robots.txt` + `sitemap.xml`. | `server.ts:254-638`, `App.tsx:703-779` |
| **Image handling** | Admin uploads stored as base64 in Postgres. Public API swaps base64 → binary proxy URLs (`/machine-image/:id`, `/site-hero-image`) that **sharp-resize to WebP** with `?w=` whitelist + 30-day cache. Placeholder fallback everywhere. | `server.ts:147-248`, CLAUDE.md |
| **Responsive** | Mobile-first Tailwind. Desktop top-nav + **mobile bottom tab bar** (`Header.tsx:444-481`) with safe-area insets. No `xs:` breakpoint (Tailwind v4 default). | `Header.tsx` |
| **Form architecture** | Uncontrolled-ish controlled inputs, state lifted to `BookingSection`. Manual validation (regex email/phone/postcode) in `handleNextStep`. No form library. PDOK postcode autocomplete via public API. | `BookingSection.tsx:670-724`, `BookingStep2.tsx` |
| **Booking flow** | 2 explicit steps (Logistiek → Gegevens) + success page. Cart-based, multi-machine. | `BookingSection.tsx` |
| **Product filtering** | Category tabs + text search (id/category/name/description/suitableFor). `useDeferredValue` for search. URL-synced (`?cat=&q=`). | `CatalogSection.tsx:176-288` |
| **Search** | Client-side substring filter only. No search page, no autocomplete/suggestions, no fuzzy matching. | `CatalogSection.tsx:262-268` |
| **Availability calendar** | Client-side, capacity-aware (multi-unit stock), `O(1)` blocked-date `Map`. Per-machine `DateRangeCalendar` bottom-sheet. Fetches `/api/orders/availability` per unit. | `DateRangeCalendar.tsx`, `utils/availability.ts` |
| **Checkout/reservation** | No online payment. Order POST → success page → **WhatsApp** deep link for iDEAL/Tikkie payment link (manual admin flow). Idempotency-Key header. | `App.tsx:642-671`, `BookingSuccess.tsx` |
| **WhatsApp integrations** | Central `utils/whatsapp.ts` builders. Floating FAB with 4 templates (App.tsx:1057-1136), hero secondary CTA, availability fallback, transport-inquiry, order-status, payment-link, advice. | `App.tsx`, `whatsapp.ts` |
| **Analytics** | Microsoft Clarity only, gated behind `VITE_CLARITY_ID` + cookie consent. No GA4, no conversion tracking, no event tracking. `App.tsx` `handleAddSystemLog` is client-only ephemeral (not sent anywhere). | `utils/analytics.ts`, `App.tsx:342-366` |
| **Error states** | `ErrorBoundary` around admin only. Global app/auth errors → toast (`App.tsx:432-444`). Booking errors inline. Catalog empty state. 404 page. Chunk-load auto-reload. | `App.tsx`, `ErrorBoundary.tsx` |
| **Loading states** | `LoadingSpinner` Suspense fallback. Catalog card skeleton shimmer. Calendar prefetches occupancy. Machine-detail "Laden…". | `App.tsx:69-76`, `CatalogSection.tsx:60-84` |
| **Empty states** | Cart empty (BookingStep1), catalog no-results, no-notifications. Reviews/deals sections hidden when no real data. | multiple |
| **UNKNOWN** | Kenniscentrum article rendering depth, MyOrdersSection auth UX, AboutSection content, exact i18n coverage of EN strings (many `t()` calls pass NL-only single arg). Not fully read. | — |

**Public site map:**
```
/                          Home (hero, deals carousel, categories, advies strip, how-it-works, why, FAQ×3, coffee corner, gallery)
/catalog                   Product grid + filters + search + VAT toggle + pricing/detail modals
/hoogwerker/:id            Crawlable machine detail page
/hoogwerker-huren/:stad    10 city landing pages (Leiden, Den Haag, Alphen, Zoetermeer, Leiderdorp, Voorschoten, Katwijk, Delft, Gouda, Wassenaar)
/adviestool                Machine-chooser wizard (modal-driven)
/veelgestelde-vragen       FAQ
/kenniscentrum[/:slug]     Knowledge center / blog
/over-ons                  About
/booking                   2-step reservation flow → WhatsApp
/orders                    Customer portal (login/register/order history) [noindex]
/privacy, /voorwaarden     Legal (admin-editable)
/admin                     Admin console [noindex]
```

---

## PHASE 2 — INFORMATION ARCHITECTURE

The IA is **strong for a small rental business** and well beyond typical competitors. It has real product-detail URLs, local-SEO city pages, an advice tool, a knowledge center, and admin-editable content. The core weaknesses are conceptual clarity (category-vs-product, pricing tiers) and the fact that the *whole business model quietly routes conversion into WhatsApp* rather than completing online.

**Component-by-component:**

1. **Homepage** — Dense but coherent. Hero → trust → deals → categories → advies → how-it-works → why → FAQ. Good. Risk: the hero headline is decorative/translatable text (`heroBannerLine1/2`) and the *actual* value prop headline sits in a second white block below the fold on mobile (`HomeSection.tsx:745-760`).
2. **Product listing (`/catalog`)** — One card **per model** (units deduped), 3-col desktop. Good density. Filters are category + free text only; **no spec filters** (height, indoor/outdoor, power).
3. **Category pages** — There are *no dedicated category pages*. `/catalog?cat=schaarlift` is a filtered view of the same grid. The homepage category cards and sitemap reference `?category=` but the app reads `?cat=` (see Critical Problems — this is a real mismatch).
4. **Product detail (`/hoogwerker/:id`)** — Exists, crawlable, has Product JSON-LD, spec chips, tier table, description, modal. Solid. But it duplicates `MachineDetailModal` and the modal is what's used from catalog — the standalone page is mostly an SEO artifact.
5. **Booking flow** — 2 steps, clear stepper. Good.
6. **Availability** — Per-machine calendar inside the booking cart. Not surfaced *before* adding to cart (catalog only shows "Vrij 12 jul" / "Vol geboekt" badge). Adequate.
7. **Advice tool (`/adviestool`)** — Present, landing page + wizard modal. Good differentiator.
8. **FAQ** — Homepage shows 3; full page separate. Admin-editable. Good.
9. **Knowledge center (`/kenniscentrum`)** — Present with blog articles + sitemap entries. Good for SEO.
10. **Contact** — No dedicated `/contact` page. Contact is a **modal** (`ContactModal`) triggered from footer + WhatsApp FAB. Weak for SEO ("huurgo contact" has no landing page) and for trust.
11. **About (`/over-ons`)** — Present.
12. **Location info** — 10 city landing pages (excellent) + footer address + Google Maps links. Strong.
13. **Delivery info** — Explained inside booking step 1 and FAQ, but **no standalone delivery/tarieven page**. Transport pricing (€150 / €25/dag / gratis) only fully visible mid-booking.
14. **Customer account** — `/orders` portal with login/register. Present but `noindex`; not part of the marketing funnel.

**Answers to the IA questions:**

- **5-second comprehension?** *Mostly yes.* Logo "huurgo" + hero photo of lifts + Dutch tagline. But the strongest signal ("Hoogwerker huren v.a. €49/dag, geen borg") lives in `<title>`/meta and the *second* section, not the visual hero H2. **Partial.**
- **Find the correct machine quickly?** *Yes if they know the category; no if they don't and skip the advies tool.* No spec filtering means a user who needs "10m, indoor, electric" must eyeball every card.
- **Category vs product clear?** *Weak.* Homepage cards say "Schaarliften 6-8-10" (a family), catalog collapses units into one card, and there's no category landing page — the mental model blurs.
- **Rental process understandable?** *Yes* — the "Hoe werkt huren?" 4-step section + 2-step stepper are clear.
- **Delivery vs pickup clear?** *Yes, but only inside booking.* Three options with prices are explicit in Step 1. Not discoverable before committing to a machine.
- **Pricing understandable?** ⚠️ **This is the biggest IA weakness.** The pricing model is genuinely complex (1-day actie, 2/3/4-day flat, weekend package, Sunday-block surcharge, weekly pro-rata, monthly, campaign %, per-role VAT). It's technically *correct and mirrored* but cognitively heavy. A customer sees a "vanaf" day price on the card and must open a modal to understand tiers.
- **VAT clearly communicated?** *Yes* — global excl/incl toggle, defaults to excl. for guests (attractive), incl. for particulier profiles. Every price carries a `vatLabel`. Good.
- **Booking CTA visible?** *Yes* — orange "Huur Nu"/"Boeken" everywhere, orange pill in nav, cart badge.
- **Users forced to think too much?** *At the pricing-tier level, yes.* Elsewhere, no.
- **Unnecessary steps?** The guest/login choice screen (`BookingStep2` gate) adds friction; most rental customers are one-off guests and shouldn't have to choose an account model before typing their name.

---

## PHASE 3 — HOMEPAGE CONVERSION AUDIT

| # | Section | Purpose | Effectiveness | Risk | Classification |
|---|---|---|---|---|---|
| 1 | **Hero banner (photo + wordmark + H2)** `HomeSection.tsx:597-725` | Brand + emotional hook, LCP element | Strong visual, correct LCP handling, no fade. But H2 is decorative italic (`heroBannerLine1/2`) not a value prop. | Value prop buried; 240px tall on mobile crops trust icons | **IMPROVE** |
| 2 | **Main headline (second block H1)** `746-752` | The real SEO H1 + value prop | Good copy but visually secondary, below hero | Two competing "headlines" (hero H2 vs this H1) dilute focus | **MERGE** into hero |
| 3 | **Subheadline** `753-760` | Reassurance | Fine | — | KEEP |
| 4 | **Primary CTA "Bekijk alle machines"** `770-776` | Drive to catalog | Good, orange, shimmer | Sends to catalog, not to a booking/quote — one extra hop | KEEP |
| 5 | **Secondary CTA WhatsApp** `777-785` | Escape hatch for undecided | Good | — | KEEP |
| 6 | **Trust badges** `789-796` (`TrustBadges`) | Social proof | Real data only (Google score hidden if unset), TÜV, delivery | Google pill vanishes if admin never enters a score → weaker proof | IMPROVE |
| 7 | **Deals carousel** `DealsCarousel` | Merchandising, urgency | Very polished (auto-scroll, drag, wheel). | Heavy custom JS (~250 lines) for a marketing strip; only shows `showInWeeklyOffers` machines | KEEP |
| 8 | **Category cards** `816-904` | Primary navigation | Strong: live "vanaf" price, discount badge, photo | `onSearch("", cat.id)` maps categories — schaarlift special-cased. Works, but no dedicated category page behind it | IMPROVE |
| 9 | **Brands strip** `906-918` | Authority (Haulotte, JLG…) | Nice, low-cost trust | Text-only wordmarks | KEEP |
| 10 | **Advies strip** `927-931` (`AdviesStrip`) | Help undecided | Good placement (right after categories) | — | KEEP |
| 11 | **How-it-works** `934` | Process clarity | Clear 4 steps | — | KEEP |
| 12 | **Why HuurGo band** `937` (`WhyHuurGoBand`) | Trust/USP | Moved from footer, good | — | KEEP |
| 13 | **FAQ ×3** `940-992` | Objection handling | Good; links to full page | — | KEEP |
| 14 | **Coffee Corner** `995` | Local/human touch, admin-gated | Hidden until enabled | Niche; fine as optional | KEEP |
| 15 | **Photo gallery** `998` | Real-world proof, admin-gated | Hidden until enabled | — | KEEP |
| 16 | **Footer + Google reviews ticker** `Footer.tsx` | Trust + links + local SEO cities | Excellent (real reviews only, 10 city links, KvK/BTW) | Reviews section vanishes entirely if admin enters nothing | IMPROVE |

**Special-attention items:**
- **"No deposit" ("geen borg")** — communicated in meta, FAQ, machine detail, city pages. Strong. But **not** a hero-level badge — it's arguably the #1 differentiator for particulieren and deserves a hero pill.
- **Google reviews / rating** — correctly *never fabricated* (only shown when `siteConfig.googleRating`/`googleReviews` set). Risk: if the owner hasn't populated it, the site shows **zero** external social proof above the fold.
- **TÜV/BMWT certifications** — present as pills (footer, trust badges, "BMWT-verhuuromslag" text in BookingStep2). Good, could be more prominent.
- **Delivery info** — only in FAQ + booking. No hero/section-level "Bezorging €150 all-in of gratis afhalen" band.
- **Coffee Corner** — unusual but harmless; local warmth.

---

## PHASE 4 — USER JOURNEY ANALYSIS

**A. "I know exactly which machine I need."**
- Entry: Google → `/hoogwerker/:id` or `/catalog`. Ideal: card → Huur Nu → dates → WhatsApp. Current: works well. Friction: from a machine detail *page* the primary path is still "add to cart → booking calendar," and the calendar starts empty (good) but the whole flow funnels to WhatsApp, never a completed online order. **Opportunity:** let a returning pro re-book a previous machine in one click from `/orders`.

**B. "I need a machine but don't know which type."**
- Entry: home. Ideal: Advies tool. Current: `AdviesStrip` appears after category cards + `/adviestool` exists. Good. Friction: the advice tool is a modal wizard — its results aren't a shareable URL, and it's not the *first* thing an undecided user sees (categories come first, which assume knowledge). **Opportunity:** surface "Niet zeker welke machine? → Keuzehulp" in the hero.

**C. "I need a machine urgently tomorrow."**
- Entry: home/catalog. Current: catalog badge shows "Vrij 12 jul" or availability this week; calendar shows live occupancy. **Friction:** no "beschikbaar vandaag/morgen" filter or same-day-delivery promise on the card; urgency users must open each calendar. WhatsApp FAB is the fast path. **Opportunity:** an "Direct beschikbaar" filter chip + explicit same/next-day delivery copy.

**D. "I want to compare two machines."**
- Entry: catalog. **Current: no comparison feature at all.** User must open two detail modals sequentially and remember specs. **Friction: high.** **Opportunity:** a compare tray (2–3 machines, spec table) — high value given height/reach/weight/power are the decision axes.

**E. "I want the total price incl. delivery and VAT."**
- Current: only fully answerable *inside* the booking flow after picking dates + delivery. The card shows a day rate; the pricing modal shows tiers excl./incl. VAT but **not** delivery. **Friction:** the all-in number appears late. **Opportunity:** a mini "prijs incl. bezorging & btw" estimate on the detail page.

**F. "I want to rent for multiple days."**
- Current: excellent — the calendar live-previews tier price, weekend package, Sunday block, minimum period. This is the best-handled journey.

**G. "Private customer, never rented access equipment."**
- Current: "geen borg," "voor particulieren," advies tool, safety-set add-on, licence FAQ (rijbewijs B/BE). Good reassurance. **Friction:** the profession dropdown in Step 2 leads with trade professions; "Particulier" is 8th of 9 (`BookingStep2.tsx:61-71`) — a private renter has to hunt. Also "BMWT-verhuuromslag" jargon (`BookingStep2.tsx:215`) will confuse a novice. **Opportunity:** put Particulier first; drop jargon.

**H. "Professional contractor who rents frequently."**
- Current: PO-number field, per-role VAT default (excl.), account portal, profession profiles. Good. **Friction:** no saved addresses/machines, no "quick reorder," no account-level pricing. **Opportunity:** pro dashboard with reorder + saved sites.

---

## PHASE 5 — PRODUCT DISCOVERY

**Current mechanisms:** category tabs, free-text search, VAT toggle, per-model cards, pricing modal, detail modal + detail page, availability badge, ratings (real bookings only).

**Gaps:**
- **No spec filters** (height range, indoor/outdoor, electric/diesel, width/doorway, weight/ground pressure). These are *the* rental decision variables and they're all in the data (`Machine.height/reach/weight/powerType` + `machineSpecs`).
- **No sorting control** (grid is hard-sorted height↑ then price↑ — user can't sort by price or availability).
- **No comparison.**
- **Search is substring-only** — a typo or synonym ("hoogwerker 10 meter", "personenlift") yields nothing.
- **Deposit** is correctly "geen borg" everywhere (no deposit field needed).

**Essential info before a confident rental** (what the card/PDP must answer):
Working height, platform height, reach/outreach, machine width (doorway fit), weight/ground pressure, power source, indoor/outdoor suitability, day/week price, delivery options + cost, availability for my dates.

**Recommended product card structure:**
```
[ photo + availability badge (Beschikbaar / Vrij 14 jul) + discount badge ]
Model name              ★4.8 (12)
Werkhoogte 10m · Breedte 0.99m · Elektrisch · Binnen/buiten
vanaf €49/dag   ·   €195/week          [excl. btw]
[ Alle tarieven ▸ ]     [ Specificaties ] [ Huur Nu 🛒 ]
```
Add width + indoor/outdoor + a week price to the current card (they're missing and they're primary decision drivers).

**Recommended product detail page structure:**
1. Breadcrumb (Home › Categorie › Model) — currently only in JSON-LD, render it visibly.
2. Gallery (multiple images — `additionalImages` exists but PDP shows only the main image).
3. Title + rating + availability-for-dates mini-calendar.
4. Full tier table **including delivery estimate** + VAT toggle.
5. Spec table (all `machineSpecs`), grouped: Afmetingen / Prestaties / Aandrijving.
6. "Geschikt voor" use-cases + "Niet geschikt voor."
7. Sticky mobile "Huur Nu" bar.
8. Related machines in same category + compare.
9. City/SEO copy block + internal links.

---

## PHASE 6 — BOOKING FLOW AUDIT

**Flow:** Cart (machine + per-item dates) → Step 1 Logistiek (delivery type, time slot, trailer days, add-ons) → Step 2 Gegevens (guest/login gate, contact, profession, PO, address lookup) → submit → per-item POST → Success → WhatsApp.

**Strengths:**
- Real-time availability with auto-assign to sibling unit (`BookingSection.tsx:281-300`).
- Idempotency-Key prevents duplicate orders on retry.
- Client price mirrors server exactly (tested).
- PDOK postcode → street autofill + >20 km "prijs op aanvraag" gate.
- Inline validation with red field highlights gated on `attempted`.
- Partial-success handling for multi-item carts (`763-...`).
- Weekend/Sunday-block live preview in calendar.

**Abandonment / risk points:**
- ⚠️ **Guest/login choice screen** (`BookingStep2.tsx:136-204`) — an interstitial *before* the form. Most renters are one-off guests; forcing a decision mid-checkout is classic friction.
- ⚠️ **No terms/voorwaarden acceptance checkbox** anywhere in the flow. The order is placed and "Aanvraag versturen via WhatsApp" with no explicit T&C/privacy consent tick. Legal + trust risk (links exist in footer but aren't in checkout).
- ⚠️ **No cancellation policy shown at checkout** — the 48h-free-cancellation rule is only in the homepage FAQ, not on the booking confirm.
- ⚠️ **Payment happens off-site in WhatsApp** — the funnel's terminal step leaves the site. No online payment means measurable drop-off between "order placed" and "paid" that the site can't see or recover (no abandoned-cart email trigger visible).
- **Price-misunderstanding risk:** the day-rate on the card ≠ what many multi-day/weekend rentals actually cost. Mitigated by the calendar preview, but the *first* number a user anchors on is the day rate.
- **Business-rule opacity:** Sunday-block surcharge and weekend package are explained in amber hint text, but a first-timer may not grasp "retour maandag 08:00 + €30 blokkade."
- **Errors:** email/phone/postcode validation is solid; the phone regex accepts 7–15 digits (lenient, fine). Address is required only for delivery. Good.

**Mobile weakness in booking:**
- The desktop sticky price summary (`lg:col-span-4`) is hidden on mobile; mobile gets an inline `BookingPriceSummary` before the CTA — acceptable but the running total isn't sticky while scrolling a long Step 1.
- Profession dropdown is a custom listbox (good), but the whole Step 1 is long on mobile (delivery + trailer-days + time slot + add-ons + summary + CTA).

**Confirmation / email / admin notification:** order confirmation email + admin alert are server-side (`emailService.ts`, per CLAUDE.md). Success page offers PDF invoice, WhatsApp CTA, and optional account registration (nice upsell).

---

## PHASE 7 — MOBILE UX (assume 70% mobile)

**Good:**
- Bottom tab bar with safe-area insets, fixed height to avoid iOS toolbar jitter (`Header.tsx:435-481`).
- 44px calendar day cells on mobile (`DateRangeCalendar` `h-11 sm:h-9`).
- Inputs forced to 16px on mobile to stop iOS auto-zoom (`index.css:214-218`).
- WhatsApp FAB with safe-area-aware bottom offset, backdrop dismiss.
- Bottom-sheet modals (calendar, pricing) `items-end sm:items-center`.
- `touch-action: manipulation`, overscroll containment for carousels.
- Deals carousel: native touch scroll, custom mouse-drag desktop only.

**Weak:**
- **No sticky "Huur Nu" bar** on the machine detail page/modal for mobile — the CTA scrolls away.
- **No sticky booking total** on mobile during Step 1.
- Hero is only 240px on mobile and the desktop trust-feature row is hidden `<sm`; the compact 3-icon row is fine but the value prop H1 is a full screen-scroll below the hero photo.
- Category tab strip in catalog scrolls horizontally with a chevron affordance — works, but chevron is small.
- Text density: lots of `text-[10px]`/`text-[11px]` micro-copy (badges, hints). Legible but dense; borderline for older tradespeople.
- **WhatsApp FAB + bottom nav + cart badge** compete for the same bottom-right zone; FAB sits above the nav via calc offset — okay but busy.

**Mobile-first recommendations:**
1. Sticky bottom "Huur Nu · vanaf €X" bar on PDP and a sticky total on booking Step 1.
2. Raise the value-prop H1 into/above the hero photo so the first mobile screen states what + price + no-deposit.
3. Add an "Beschikbaar deze week" quick filter chip at the top of catalog.
4. Slightly increase base micro-copy from 10–11px to 12px where it's body text (not badges).

---

## PHASE 8 — ACCESSIBILITY (WCAG 2.1 AA)

| Severity | Issue | Evidence |
|---|---|---|
| **High** | **Contrast:** heavy use of `text-slate-400` / `text-slate-500` on white for body-ish text (footer links `text-slate-400` on `slate-950` is OK, but `text-slate-400` on white in several hints fails 4.5:1). CLAUDE.md notes this bit them twice already; still present in places (e.g. success-page secondary actions `text-slate-400`, `BookingSuccess.tsx:214-238`). | `BookingSuccess.tsx`, various `text-slate-400` |
| **High** | **Clickable `<div>`s used as buttons** without role/keyboard: add-on cards (`BookingStep1.tsx:598,633,766`), guest/login cards (`BookingStep2.tsx:149,168`), header brand (`Header.tsx:178`), avatar (`Header.tsx:399`), calendar thumbnails. Not keyboard-focusable/operable. | multiple `<div onClick>` |
| **Medium** | **Icon-only controls** mostly have `aria-label` (good), but the category scroll chevron and some close buttons rely on title only. | `CatalogSection.tsx:344` (has aria-label ✓) |
| **Medium** | **Heading hierarchy:** multiple `<h2>`/`<h1>` semantics are inconsistent — homepage hero uses `<h2>` then a later `<h1>`; catalog uses `<h1>`; some section titles are `<h2>` with `<h3>` cards. A page should have exactly one `<h1>` and ordered nesting. | `HomeSection.tsx:667,745` |
| **Medium** | **No terms/consent** = also an a11y/legal gap in forms. | booking flow |
| **Low** | **Focus management** in modals: calendar traps Tab well (`DateRangeCalendar.tsx:144-162`) and `useModalA11y` exists; but not all modals (pricing preview, contact) confirmed to trap focus / restore on close. | partial |
| **Low** | **`alt` text:** decorative hero `alt=""` ✓; product images use `imageAlt`/name ✓; category card uses `cat.label` ✓. Generally good. | good |
| **Low** | **Motion:** `prefers-reduced-motion` fully honored ✓. Excellent. | `index.css:344-365` |
| **Good** | Skip-link to `#main-content` ✓; focus-visible ring ✓; `aria-pressed`/`aria-expanded` on toggles ✓; calendar day `aria-label` with state ✓. | `App.tsx:785-790`, `index.css:143-159` |

**Priorities:** (1) convert clickable `<div>`s to `<button>` with keyboard support (High), (2) sweep `text-slate-400` on light backgrounds → `text-slate-500/600` (High), (3) enforce single `<h1>` + ordered headings per route (Medium).

---

## PHASE 9 — SEO

**Strong foundation** — better than most SMB rental sites:
- Server-side per-route meta injection for crawlers/social (`server.ts:519-638`) — titles, descriptions, canonicals, OG, `noindex` for `/orders` `/admin`.
- Dynamic `robots.txt` (disallows `/admin`, `/api/`) + `sitemap.xml` (static routes, machines, cities, blog posts).
- Rich JSON-LD: LocalBusiness+RentalService+Organization (with real `aggregateRating` only when reviews exist — avoids spam penalty), FAQPage, Product (per machine), BreadcrumbList.
- 10 city landing pages with genuinely distinct copy (anti-thin-content).
- Crawlable machine detail pages + knowledge center.
- Self-hosted fonts, WebP images, good CWV posture.

**Problems / gaps:**
- ⚠️ **Category URL mismatch:** sitemap emits `?category=schaarlift` (`server.ts:273-279`) and homepage cards use `cat.id`, but the app only reads **`?cat=`** and `?q=` (`App.tsx:86-88,125-128`). So every `?category=` URL in the sitemap lands on the *unfiltered* catalog → duplicate-content / wasted crawl budget / poor landing relevance. **Fix: align the param (`cat`) or make the app read both.**
- ⚠️ **No canonical category pages.** Category filters are query-string views of `/catalog`; Google sees near-duplicate content. The high-value keywords ("schaarlift huren," "rupshoogwerker huren") deserve real indexable pages with unique H1/copy.
- **Client-side title flrecker:** `App.tsx` overwrites title in `useEffect` for static routes; server injects too. Mostly aligned but two sources can drift.
- **No `/contact`, `/bezorging`/`/tarieven` landing pages** — misses "huurgo contact / bezorgkosten / hoogwerker huren prijzen" intents.
- **Internal linking** is decent (footer cities, breadcrumb JSON-LD) but catalog cards link to PDP only via the title; category cards don't deep-link to a canonical category page (none exist).
- **`hreflang`:** site is NL-primary with an EN toggle but there are no `hreflang` tags or `/en` URLs — the EN experience isn't indexable/separable.
- **OG image is 1.7 MB PNG** (`public/og-image.png`) — heavy for scrapers; a ~200 KB JPG/WebP would be better (`og-image.jpg` exists at 827 KB, still large).

**Recommended SEO page structure (per intent):**
| Keyword | Recommended URL | H1 |
|---|---|---|
| Hoogwerker huren | `/hoogwerker-huren` (or `/`) | Hoogwerker huren — v.a. €49/dag, zonder borg |
| Schaarlift huren | `/schaarlift-huren` (real category page) | Schaarlift huren (6/8/10m) |
| Mastlift huren | `/mastlift-huren` | Mastlift huren |
| Rupshoogwerker huren | `/rupshoogwerker-huren` | Rupshoogwerker / spinhoogwerker huren |
| Ladderlift huren | `/ladderlift-huren` | Ladderlift / verhuislift huren |
| Aanhangerhoogwerker huren | `/aanhangerhoogwerker-huren` | Aanhangerhoogwerker huren |
| Pecolift huren | `/pecolift-huren` | Pecolift huren |
| Kamersteiger huren | `/kamersteiger-huren` | Kamersteiger huren |

Give each a unique intro, the filtered machine grid, tier explanation, FAQ subset, and city internal links. Redirect/whitelist `?cat=` filters to these canonicals.

---

## PHASE 10 — PERFORMANCE

**Already well-optimized** (documented 2026-07 Lighthouse overhaul: mobile 58→81, desktop 97, CLS 0.51→0):
- gzip compression, code-split vendors (`manualChunks`), lazy routes, `useDeferredValue` search.
- Self-hosted variable fonts + preload, no Google Fonts render-block.
- LCP hero preloaded server-side per-request with correct `imagesrcset`, no fade.
- sharp WebP image proxy with `?w=` whitelist + 30-day cache; `/assets` 1-year immutable.
- Skeleton shimmer = zero CLS on cards; lazy-chunk warming deferred to `window.load`.
- Service worker (`sw.js`) `no-cache` for updates.

**Remaining highest-impact opportunities:**
1. **`og-image.png` = 1.7 MB** and `og-image.jpg` = 827 KB in `public/` — not LCP but wasteful; ship a ~150–250 KB WebP/JPG.
2. **No SSR/SSG for content** — the SPA is client-rendered; crawlers get injected meta but content (machine grid, city copy) still requires JS. For a marketing site, pre-rendering `/`, category pages, city pages, PDPs (e.g. via a static snapshot) would improve LCP/TTI and SEO robustness. Currently `metaForRequest` gives meta but not body HTML.
3. **API waterfalls on booking:** `BookingSection` fires `/api/blocked-dates` + N× `/api/orders/availability` (one per cart machine) + the calendar *also* fetches occupancy per unit. Some duplication between `BookingSection` and `DateRangeCalendar` (both hit `/api/orders/availability`). Consolidate to one fetch/cache.
4. **DealsCarousel** runs a permanent `requestAnimationFrame` loop — fine, but it's ~250 lines of JS on the LCP page; ensure it's not blocking and consider CSS-only auto-scroll.
5. **`/api/orders/ratings/*`** fetched on home + catalog mount — cache/share.
6. Confirm images use width-appropriate `?w=` everywhere (catalog card requests, detail modal) — mostly done, audit the PDP main image (`MachineDetailPage.tsx:95` uses raw `imageUrl` without `?w=`).

---

## PHASE 11 — DESIGN SYSTEM

**Tokens (documented, not enforced):** orange-500 primary, emerald/teal success/price, slate neutral, amber warning/admin. `--font-sans` Inter, `--font-display` Outfit, `--font-mono` JetBrains Mono.

**Inconsistencies found:**
- **Radius drift:** `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full` all used heavily and somewhat interchangeably (cards `2xl`, modals `2xl`/`3xl`, buttons `xl`/`2xl`/`lg`). No radius scale token.
- **Button variants are ad-hoc** — primary orange appears as `rounded-xl`, `rounded-2xl`, with/without `cta-shine`, py-3/py-3.5/py-4. No `<Button>` component; every button re-declares ~10 utility classes. High duplication + drift risk.
- **Font sizes:** very heavy use of arbitrary `text-[10px]/[11px]/[9px]/[10.5px]` micro-sizes — outside the Tailwind type scale, hard to keep consistent, borderline a11y.
- **Success/price color:** sometimes `emerald-700`, sometimes `teal-700`, sometimes `emerald-600` for the "same" semantic (price). Token says `--brand-price: #0f766e` (teal-700) but code mostly uses emerald.
- **Badges:** discount badges use different gradients (`from-red-600 to-orange-600`, `from-rose-600 to-red-500`, `from-indigo-600 to-violet-600`, `from-amber-500 to-orange-500`) across cards — visually inconsistent taxonomy.
- **Shadows:** `shadow-sm/md/lg/xl` + custom `shadow-orange-500/25`, `shadow-[0_-4px_12px...]` — no elevation scale.
- **Inputs:** consistent enough (rounded-xl, slate border, focus ring) but focus states vary (`focus:border-slate-400` vs `focus-within:ring-2 ring-orange-400/20`).
- **Empty/error/loading states** are individually well-done but each hand-rolled (no shared `<EmptyState>`/`<Spinner>`/`<Alert>`).

**Recommended token system:**
```
radius:   sm 8 · md 12 (xl) · lg 16 (2xl) · xl 24 (3xl) · full   → pick ONE per surface type
color:    primary=orange-500/600 · price=teal-700 (pick one, apply everywhere) ·
          success=emerald-600 · warn=amber-500 · danger=rose-600 · neutral=slate-*
type:     xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 (retire [10px]/[9px] for body)
elevation: e0 none · e1 shadow-sm · e2 shadow-md · e3 shadow-lg (map, don't freestyle)
badge:    one gradient per meaning — deal(rose→red) · tier(indigo→violet) · campaign(amber→orange)
```
Then extract `<Button variant>`, `<Badge>`, `<Card>`, `<Alert>`, `<EmptyState>`, `<Spinner>` primitives to kill the ~10-class-per-button duplication.

---

# FINAL REPORT

## 1. Executive Summary
HuurGo is a **well-built, unusually complete** rental storefront for a small operator: real product URLs, per-machine availability, local-SEO city pages, an advice tool, a knowledge center, admin-editable content, honest (never-fabricated) social proof, and a genuinely strong performance/CWV baseline. The engineering quality is high — pricing is mirrored client/server, images are proxied+resized, motion respects `prefers-reduced-motion`, and the codebase is heavily commented.

The gap is **conversion clarity and funnel completion**, not capability. The whole funnel terminates in WhatsApp with no online payment, no terms acceptance, and a guest/login interstitial mid-checkout. Product discovery lacks spec filters, sorting, and comparison — despite having all the data. The pricing model is correct but cognitively heavy. And there are a few concrete SEO/URL bugs (`?category=` vs `?cat=`) and accessibility issues (clickable `<div>`s, low-contrast micro-text) worth fixing.

## 2. Current Strengths
- Strong technical SEO (server meta injection, JSON-LD, sitemap, 10 unique city pages).
- Excellent performance foundation (self-hosted fonts, WebP proxy, code-split, CLS 0, LCP-aware hero).
- Honest trust signals (ratings only when real).
- Sophisticated, correct, well-tested pricing + availability engine with live calendar preview.
- Clean 2-step booking with idempotency, auto-unit-assignment, partial-success handling.
- Mobile bottom-nav, safe-area handling, 16px inputs, reduced-motion support, skip link.

## 3. Critical Problems (P0)
1. **`?category=` sitemap URLs don't filter the catalog** (app reads `?cat=`). Every category URL Google crawls lands unfiltered. — `server.ts:273-279` vs `App.tsx:86-88`.
2. **No terms/privacy acceptance in checkout** — legal exposure; order sent to WhatsApp with no consent tick.
3. **Clickable `<div>`s as buttons** (add-on cards, guest/login cards, header) — keyboard/screen-reader inaccessible. — `BookingStep1.tsx:598,633`, `BookingStep2.tsx:149,168`.
4. **Low-contrast text** (`text-slate-400` on white) fails WCAG AA in places the CLAUDE.md already flagged twice.

## 4. Quick Wins (P1, low effort)
- Fix `?cat=`/`?category=` param mismatch (align both).
- Put **"Particulier" first** in the profession dropdown; remove "BMWT-verhuuromslag" jargon.
- Add a **"geen borg"** pill + **week price** to product cards and hero.
- Compress `og-image` to <250 KB WebP/JPG.
- Add `?w=` to the PDP main image (`MachineDetailPage.tsx:95`).
- Sweep `text-slate-400`→`text-slate-500/600` on light backgrounds.
- Add a terms/privacy checkbox to Step 2 + show the 48h cancellation line at confirm.
- Enforce single `<h1>` per route.

## 5. Medium-term Improvements (P2)
- Real, canonical **category pages** (`/schaarlift-huren`, etc.) with unique copy.
- **Spec filters** (height range, indoor/outdoor, power) + **sort** control.
- **Machine comparison** tray.
- **Sticky mobile "Huur Nu"/total** bars (PDP + booking).
- Consolidate duplicate availability fetches (BookingSection + calendar).
- Extract a design-system primitive layer (`Button/Badge/Card/Alert/EmptyState`).
- Remove or de-emphasize the guest/login interstitial (default to guest, offer login inline).

## 6. Major Architectural Recommendations
- **Pre-render / SSG marketing routes** (`/`, category pages, city pages, PDPs) so body content (not just meta) is server-delivered — biggest combined SEO + LCP + robustness win.
- **Add an online payment step** (iDEAL via Mollie/Stripe) as an *option* alongside WhatsApp, so the funnel can complete on-site and abandonment is measurable/recoverable.
- **Introduce a data-fetching layer** (React Query/SWR) to dedupe machine/order/availability/ratings fetches and cache.
- **Add real analytics + conversion events** (GA4 or PostHog behind consent) — currently only Clarity; there's no funnel measurement.

## 7. Homepage Recommended Structure
1. Hero: value-prop H1 ("Hoogwerker huren v.a. €49/dag — zonder borg") **on** the photo, + no-deposit/TÜV/Google pills, primary CTA to catalog, secondary WhatsApp, tertiary "Niet zeker? Keuzehulp."
2. Deals carousel (keep).
3. Category cards → link to **canonical category pages** (keep live price/badge).
4. Advies strip (keep).
5. Delivery/pricing reassurance band (new: €150 all-in / gratis afhalen / geen borg).
6. How-it-works (keep).
7. Why HuurGo + real Google reviews (keep; ensure owner populates score).
8. FAQ ×3 (keep). 9. Coffee corner / gallery (optional).

## 8. Product Discovery Recommendations
Add spec filters + sort + compare; add width & indoor/outdoor & week price to cards; render visible breadcrumbs; PDP gallery from `additionalImages`; "related in category"; make search tolerant (synonyms/height tokens). See Phase 5 card/PDP blueprints.

## 9. Booking Flow Recommendations
Default to guest checkout (login inline, not a gate); add T&C + cancellation at confirm; sticky mobile total; add optional online iDEAL; keep the excellent calendar preview; surface the all-in (incl. delivery + VAT) number earlier.

## 10. Mobile Recommendations
Sticky "Huur Nu"/total bars; raise value-prop into hero; "Beschikbaar deze week" chip; bump body micro-copy to 12px; declutter the bottom-right FAB/nav/badge zone.

## 11. SEO Recommendations
Fix the category param bug; build 8 canonical category pages; add `/contact`, `/bezorgkosten`/`/tarieven` pages; add `hreflang` + `/en` if EN is a real market (else drop the toggle from indexable scope); shrink OG image; pre-render content. Keep the strong JSON-LD/city-page/sitemap work.

## 12. Accessibility Recommendations
P0: clickable `<div>`→`<button>` + contrast sweep. P1: single `<h1>`, focus-trap all modals, consent in forms. Keep the excellent reduced-motion + skip-link + focus-ring work.

## 13. Performance Recommendations
Pre-render marketing routes (biggest win); compress OG image; dedupe availability/ratings fetches; PDP image `?w=`; keep everything else (it's already good).

## 14. Design System Recommendations
Adopt the radius/color/type/elevation/badge token scale in Phase 11; extract `Button/Badge/Card/Alert/EmptyState/Spinner` primitives; pick one price color (teal-700 per token, or standardize on emerald) and one badge gradient per meaning; retire sub-12px body text.

## 15. Prioritized Roadmap

**P0 — Critical (do first)**
| Item | Why | Evidence | Complexity |
|---|---|---|---|
| Fix `?category=`→`?cat=` catalog filtering | Broken category landing from sitemap/cards; wasted crawl + poor UX | `server.ts:273-279`, `App.tsx:86-88` | Low |
| Terms/privacy consent + cancellation at checkout | Legal exposure; trust | `BookingStep2.tsx` | Low |
| Clickable `<div>`→`<button>` (keyboard/SR) | WCAG operability | `BookingStep1/2.tsx`, `Header.tsx` | Low–Med |
| Contrast sweep `text-slate-400`→500/600 | WCAG AA; already regressed twice | multiple | Low |

**P1 — High impact**
| Item | Why | Complexity |
|---|---|---|
| Guest-first checkout (remove interstitial) | Reduce funnel friction | Low |
| Value-prop + no-deposit in hero; week price on cards | 5-sec comprehension + price clarity | Low |
| Spec filters + sort in catalog | Core discovery gap; data already exists | Med |
| Sticky mobile Huur Nu / total | 70% mobile conversion | Low–Med |
| Canonical category pages (8) | High-value keywords | Med |
| Compress OG image; PDP `?w=` | Perf/social | Low |

**P2 — Medium impact**
| Item | Why | Complexity |
|---|---|---|
| Machine comparison | Journey D unsupported | Med |
| Optional online iDEAL payment | Complete + measure funnel | Med–High |
| Pre-render marketing routes (SSG) | SEO + LCP + robustness | High |
| Design-system primitives + tokens | Consistency, velocity | Med |
| Dedupe availability/ratings fetches; add data layer | Perf/maintainability | Med |
| Real analytics + conversion events | Currently blind to funnel | Med |

**P3 — Nice to have**
| Item | Why | Complexity |
|---|---|---|
| Pro dashboard (reorder, saved sites/addresses) | Journey H retention | Med |
| `/contact`, `/tarieven`, `/bezorgkosten` pages | Long-tail intents | Low |
| `hreflang`/`/en` or drop EN from index | i18n correctness | Med |
| Shareable advies-tool result URL | Journey B | Low |
| Search synonym/height tolerance | Discovery robustness | Low |

---
*End of audit. No code was modified.*
