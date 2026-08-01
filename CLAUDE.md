# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**HuurGo** — full-stack Dutch-language rental marketplace for aerial lifts, scissor lifts, spider platforms and ladder lifts. Operated by MB Hoogwerkers B.V. (Zoeterwoude). Features a real-time availability calendar, multi-step checkout with WhatsApp payment flow, PDF invoice generation, and a comprehensive admin console.

**Live URL:** huurgo.nl (TransIP VPS, Amsterdam)  
**Deploy:** TransIP VPS — Docker Compose (`docker compose up -d --build`). Nginx reverse proxy + Let's Encrypt SSL. PostgreSQL draait in dezelfde Docker stack.

### Branching & PR workflow

`main` is the stable production branch — **never push directly to `main`**. Instead:

- **One PR per feature.** Create a dedicated branch per change (e.g.
  `claude/<short-feature-name>`), branched off the latest `origin/main`.
- Keep each PR scoped to a single feature/fix so changes can be reviewed,
  reverted, or revisited feature by feature.
- Run `npm run lint` and `npm run test` before opening the PR.
- Open the PR against `main` and merge it once approved; deploy to VPS manually after merge.
- Don't bundle unrelated changes into one PR.

---

## Commands

```bash
# Development
npm run dev          # Hybrid Vite + Express dev server on http://localhost:3000

# Build & Production
npm run build        # prisma generate + Vite SPA + esbuild server bundle → dist/
npm run start        # prisma db push + node dist/server.js
npm run clean        # Remove dist/

# Quality — always run before pushing
npm run lint         # TypeScript type-check only (tsc --noEmit), no ESLint
npm run test         # Run all Vitest tests (single run)
npx vitest run src/__tests__/availability.test.ts  # Run a single test file

# Database
npx prisma db push   # Apply schema changes (no migration history)
npx prisma db seed   # Seed initial data — see SEED SAFETY RULE below
npx prisma studio    # GUI to inspect database
npx prisma generate  # Regenerate client after schema change (no DB needed)
```

---

## Architecture

Single-package full-stack monorepo — one `package.json` for both React frontend and Express backend.

### Entry Points

- **`server.ts`** — single entry for dev + production. Dev: spawns Vite middleware (HMR). Prod: serves pre-built `dist/` SPA.
- **`src/main.tsx`** → **`src/App.tsx`** — React SPA. React Router v7, URL-based tabs: `/` `/booking` `/admin` `/orders`.

### Frontend (`src/`)

- **State**: Three Zustand stores — `appStore` (machines, orders, cart, blocked dates), `authStore` (JWT + user), `languageStore` (i18n NL/EN/TR strings).
- **Code splitting**: All main sections + all admin panels are `React.lazy()` + Suspense.
- **Availability** (`src/utils/availability.ts`): runs client-side using orders + blocked dates from API. Uses `Map<string,string>` for O(1) blocked-date lookup. Supports 1000-day window.
- **Booking flow**: `BookingSection.tsx` → step components `BookingStep1/2/3.tsx` → `BookingSuccess.tsx`. Cart supports multiple machines.
- **Invoice/print**: `src/utils/invoice.ts` — `printInvoice(order)` opens a new window with full HTML invoice and calls `printWindow.print()` after 900 ms (never use opacity:0 trick — causes blank prints).
- **WhatsApp utils**: `src/utils/whatsapp.ts` — all WA message builders. Use 🦾 not 🙏 in sign-offs.

### Backend (`server/`)

- **Routes** under `/api/*`: `auth`, `machines`, `orders`, `blockedDates`, `siteConfig`, `admins`, `adminAudit`, `blog`, `maintenance`, `damageReports`, `calendar` (iCal feed), `webhooks` (Mollie), plus general `api` router (health, uploads).
- **Gemini/AI advisor**: completely removed. No `server/routes/gemini.ts`, no `AdvisorSection.tsx`, no `geminiEnabled` state in App.tsx.
- **Auth** (`server/middleware/auth.ts`): JWT validation, `requireAdmin` guard.
- **Rate limits**: 300 req/min global on `/api/`; 10 attempts/15 min on auth endpoints.
- **Email** (`server/services/emailService.ts`): Resend with `sendWithRetry(payload, retries=3)` exponential backoff. Falls back to mock/log if `RESEND_API_KEY` absent. Flows: order confirmation, status update, verification, daily reminder (cron 07:00), password reset. No deposit/borg is charged anywhere in the app — there is no deposit refund flow.
- **Payments** (`server/services/mollieService.ts`): for orders with `paymentMethod: "link"`, a real single-use Mollie payment link is generated asynchronously right after order creation (`server/routes/orders.ts`, fire-and-forget — never blocks the response) and stored on `Order.mollieCheckoutUrl`/`molliePaymentId` (the payment **link's** own id, `pl_...`). `POST /api/webhooks/mollie` (`server/routes/webhooks.ts`) receives Mollie's status-change callback, **re-fetches the payment link from Mollie's API** (never trusts the webhook body — only its `id` field), and matches it back to our `Order` via `molliePaymentId` directly (confirmed empirically: Mollie's Payment Links webhook posts the link's own `pl_...` id, not the underlying payment's `tr_...` id — the `description` field is only shown on Mollie's own dashboard, never used for matching). On `"paid"`, `Order.paymentStatus` flips automatically — the existing "Goedkeuren" gate (`paymentStatus !== "paid"` blocks approval) needs no change, it already reads that field. Falls back to today's fully-manual flow (placeholder link, manual "Betaling Ontvangen ✓" click) whenever `MOLLIE_API_KEY` is unset. `paymentMethod: "on_location"` orders never call Mollie at all.
- **Security** (`server.ts`): Helmet with HSTS (prod), frameguard deny, noSniff, CSP, referrer policy. Serializable transactions on order creation (prevents double-booking race condition). Crypto order IDs: `HWH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`.

### Database (`prisma/`)

- ORM: Prisma 6, **PostgreSQL** only (no SQLite).
- Local dev: `docker-compose up postgres` → `DATABASE_URL=postgresql://huurgo:huurgo_dev_pass@localhost:5432/huurgo`.
- Production (TransIP VPS): PostgreSQL draait in Docker, `DATABASE_URL` via `.env` op de server.
- Use `prisma db push` (not `migrate`) during development.
- Schema models: `Machine`, `Category`, `BlockedDate`, `Order`, `Customer`, `Admin`, `SiteConfig`, `Notification`, `InvoiceCounter`, `OrderRating`.
- Indexes on `Order`: `[machineId]`, `[customerId]`, `[status]`, `[machineId, startDate, endDate, status]`, `[createdAt]`. On `BlockedDate`: `[machineId, date]`.

---

## Pricing System — CRITICAL

Machines have two pricing mechanisms. **Flat rates take priority over percentage discounts.**

### Flat-rate fields (primary)
| Field | When applied |
|-------|-------------|
| `oneDayPrice` | Exactly 1 day (1-dag actie) |
| `twoDayPrice` | Exactly 2 weekday days |
| `threeDayPrice` / `fourDayPrice` | Exactly 3 / 4 days (fall back to `weeklyPrice` when unset) |
| `weekendPrice` | Weekend package (see weekend rules below): flat rate for a rental that stays entirely within the closed weekend (single Sat, single Sun, or Sat+Sun). Legacy: strict Sat+Sun 2-day rate when `weekendRulesEnabled` is false |
| `weeklyPrice` | 5 days flat; 6–27 days pro-rata `round(days × weeklyPrice/5)`, capped at `monthlyPrice` |
| `monthlyPrice` | 28+ days (`floor(days/28) × monthlyPrice` + capped remainder) |

### Weekend rules (per-machine, `weekendRulesEnabled`) — depot closed Sat+Sun
Enabled per machine. **On** for the vertical-mast and scissor-lift groups: Bravi Leonardo,
JLG 1230, Skyjack SJ12, Skyjack SJ16, Star 10, Dingli 6m, Optimum 8, Compact 8, Compact 10N — and (2026-07)
also for the aanhanger group Nifty 120/170 and the Hinowa spider lifts 15.70/17.75. The Nifty
1-day campaign price (60/70) stays aggressive, but every 2+-day tier and the weekend are formulated
on the normal standard day rate (120/185). **Off** for Ladderlift, Altrex kamersteigers and
Pecolift. Two mechanics on top of the tier table:
- **Weekend package** (`weekendPrice`, flat): triggers ONLY when the entire rental stays within the closed weekend — single Sat, single Sun, or Sat+Sun together (1–2 days, start on Sat or Sun). It never triggers for a Friday start, nor for a longer rental that merely starts on Sat/Sun and extends past the weekend — those always use the normal day-count tier table instead. Helper: `isWeekendPackage(machine, startDate, days)` in `src/utils/pricing.ts`.
- **Automatic Sunday block** (`sundayBlockFee`, flat surcharge): when a rental's **last work day is Saturday** (and it isn't a weekend package), the machine is held over the closed Sunday (return Monday 08:00) → tier price **+ sundayBlockFee** (not discounted). If Sunday itself is the deliberately chosen end day (e.g. Fri+Sat+Sun, or a long Sat-start rental ending later in the week), there is **no surcharge** — it's just the normal tier price for that day count. Interior Sundays in a long rental are counted as normal pro-rata days; only a *trailing forced* Sunday adds the fee. Helper: `hasSundayBlock(machine, startDate, days)`. **Convention: `sundayBlockFee` is set to `(threeDayPrice − twoDayPrice)` per machine, so a Fri+Sat rental (2 work days + forced Sunday block) equals the weekday 3-day tier price exactly** — this is how the owner quotes it (e.g. Dingli "2-daags 95 + blokkade 30 = 125 = 3-daags"). The customer-facing tariff table shows this as an explicit "Vrijdag + Zaterdag (incl. zondagblokkade)" row (`buildPricingTierRows`).
- The old "hafta sonu çalışıyorum/çalışmıyorum" toggle (`weekendWorkAnswer`) is **removed** — weekend handling is now automatic. A later Friday-specific toggle UI was also removed: a Friday start (1 day / Fri+Sat 2 days+block / Fri+Sat+Sun 3 days no block) always uses the normal tier table, never the weekend package.

### Percentage fields (fallback, only if no flat rate)
`weeklyDiscountPercent`, `monthlyDiscountPercent`, `campaignDiscountPercent`, `campaignDiscountAmount`

### Where this logic lives
- **Frontend**: `src/utils/pricing.ts` → `calculateItemSubtotal()` + `tierPrice()` (called from `BookingSection.tsx` / `DateRangeCalendar.tsx`)
- **Backend validation**: `server/routes/orders.ts` → flat-rate block (`tierPrice` + `isWeekendPackage`/`hasSundayBlock` mirror) — **must mirror frontend exactly** or orders fail with "Totaalbedrag klopt niet"
- **Catalog display**: `CatalogSection.tsx` pricing popup + `MachineDetailModal.tsx` (tiered rows + weekend info-icon); `computeDiscounts(m)` derives week/maand % badges from flat rates

### Transport & global add-on fees (admin-editable — a second, smaller price mirror)
Delivery fee, trailer-per-day and the two global add-ons (Veiligheidsset Pro,
Rijplaten) are **not machine fields** — they're admin-editable via `AdminContent`
→ Tarieven (`SiteConfig.transportFees` / `SiteConfig.globalAddons`, both nullable
JSON; `null` = the historical hard-coded default). Same mirror discipline as the
machine pricing above, but resolved through a dedicated pair of functions instead
of being duplicated inline:
- **Frontend**: `getTransportFees()` / `getGlobalAddons()` in `src/utils/pricing.ts`
- **Backend**: `resolveFees()` in `server/utils/fees.ts`, called once per order in
  `server/routes/orders.ts` (reuses the `siteConfig` row already fetched for
  campaign rules — no extra query)

Both sides share identical defaults (`DEFAULT_TRANSPORT_FEES` / `DEFAULT_GLOBAL_ADDONS`,
duplicated as constants on each side — keep values identical) and identical clamps
(fee ∈ [0, 1000], 2-decimal rounding; add-on name ≤60 chars). **If you add a new
fee field, add it to both resolvers with the same default/clamp — never read a raw
`siteConfig.transportFees.x` value directly in a component.** Consumers: `orders.ts`
(authoritative), `BookingSection.tsx`, `BookingStep1.tsx`, `whatsapp.ts`, `invoice.ts`.
Validation stays strict (`> 0.01` rejection, no tolerance band) — see `server/utils/sanitizeContent.ts`
for the admin-input sanitizers (`sanitizeTransportFees`/`sanitizeGlobalAddons`) that
reject the whole object rather than storing a half-valid fee pair.

### Showing discount % on cards
`computeDiscounts(machine)` returns `{ weekly, monthly }` as percentages computed from flat rates:
- `weekly = round((1 - weeklyPrice / (5 × pricePerDay)) × 100)`, capped at 0 (no negative badges)
- `monthly = round((1 - monthlyPrice / (28 × pricePerDay)) × 100)`, capped at 0

---

## Seed Safety Rule — CRITICAL

**`prisma db seed` must never overwrite admin-managed data on existing machines.**

In `prisma/seed.ts`, the machine upsert uses `update: {}` (empty — same pattern as `siteConfig`):

```typescript
await prisma.machine.upsert({
  where: { id: mach.id },
  update: {}, // Never overwrite admin prices, images, discounts
  create: mach
});
// Back-fill new flat-rate fields only when still null (first run after db push)
if (wp !== null) await prisma.machine.updateMany({ where: { id: mach.id, weekendPrice: null }, data: { weekendPrice: wp } });
```

**Never add pricePerDay, imageUrl, or discount fields back into the `update` block.**  
If you add a new schema field that needs seeding, use the conditional `updateMany` pattern above.

---

## Admin Panel

Thirteen lazy-loaded panels inside `src/components/admin/`:

| Panel | File | Purpose |
|-------|------|---------|
| Dashboard | `AdminDashboard.tsx` | KPI cards, revenue chart, fleet composition |
| Orders | `AdminOrders.tsx` | Order list, status changes, invoice print |
| Machines | `AdminMachines.tsx` | Edit existing machines — prices, images, flat rates, gallery (mobile card view + desktop table) |
| Add Machine | `AdminAddMachine.tsx` | Add new machine — includes Weekend/Werkweek/4W price inputs |
| Calendar | `AdminCalendar.tsx` | Block/unblock dates per machine with reason dropdown |
| Planning | `AdminPlanning.tsx` | Daily logistics timeline (departures/returns, addresses) |
| Customers | `AdminCustomers.tsx` | Paginated customer list (50/page, "Meer laden"), order history, lifetime value |
| Logs | `AdminLogs.tsx` | Real audit trail viewer (`GET /api/admin/audit-logs`) — filterable, paginated |
| Diagnostics | `AdminDiagnostics.tsx` | System health (KPIs + live DB latency probe, 15s interval) |
| Customizer | `AdminCustomizer.tsx` | Site config (hero text, labels), campaign rules, categories |
| Content | `AdminContent.tsx` | FAQ, USPs, opening hours, transport/add-on fees, SEO, legal pages (`/privacy`, `/voorwaarden`) — see "Admin-manageable content" below |
| Beheerders | `AdminUsers.tsx` | Own 2FA setup, admin account list, create/disable/reset-password/reset-2FA |
| Accounting | `AdminAccounting.tsx` | Revenue reporting + CSV export |
| Maintenance | `AdminMaintenance.tsx` | Open/close maintenance events + damage reports per machine — sets `operationallyBlocked`, blocks bookings regardless of stock/dates |
| Timeline | `AdminRentalTimeline.tsx` | Gantt-style per-machine rental timeline across a date range |
| Blog | `AdminBlog.tsx` | Kenniscentrum blog post CRUD |

Shared admin widgets (not panels): `AdminStatusBadge.tsx`, `AdminConfirmDialog.tsx`, `AdminAvailabilityWidget.tsx`.

### Admin-manageable content (no developer needed)
`AdminContent.tsx` writes to `SiteConfig` (all fields nullable — `null` means "use
the code fallback", so no seed change is ever required): `faqItems`, `uspItems`,
`openingHours`, `transportFees`, `globalAddons`, `footerDescription`, `seoTitle`/
`seoDescription`, `privacyPolicy`/`termsConditions`. Sanitizers live in
`server/utils/sanitizeContent.ts` (length caps, icon whitelist, fee clamping,
`data:image` stripping — never store base64 in a text field here).

Consumers read `siteConfig.x ?? codeDefault`: `FaqSection.tsx` / `App.tsx` FAQPage
JSON-LD / `server.ts` `metaForRequest` (`resolveFaqItems` in `src/data/faq.ts` is
the single resolver so structured data never diverges from the visible page),
`WhyHuurGoBand.tsx` (USPs), `Footer.tsx` (KvK/BTW/address/opening hours — these
were already-editable `SiteConfig` fields the Footer used to ignore; now wired
correctly), `LegalPage.tsx` (fetches `GET /api/pages/:slug`, kept **out** of the
public `/api/site-config` payload so the cached first-visit JSON stays small).

**Explicitly out of scope** (documented here so it isn't re-proposed): a
full email-template or invoice-template editor — too easy to break; instead
`emailService.ts`'s `getCompanyDetails()` (60s cache) and `invoice.ts` interpolate
company name/address/fees from `SiteConfig` into the existing literal templates.
Also out of scope: the full i18n dictionary (`languageStore.ts`), homepage
`FLEET_BRANDS`/category copy (`HomeSection.tsx`), and per-city SEO copy
(`src/data/serviceCities.ts`) — developer-curated, not owner-editable.

### Image upload in admin
- Main image: URL field with X button (clears to "") + file upload → sets `editImageUrl`
- Empty string `""` is a valid imageUrl — server saves it, card shows `/placeholder-machine.webp`
- Additional images: appear only in **detail popup**, not on catalog card
- **Never add an Unsplash fallback back** to the PUT handler — empty URL must stay empty

### Invoice print
- `printInvoice(order)` in `src/utils/invoice.ts`
- Opens `window.open("", "_blank")`, writes full HTML, calls `printWindow.print()` after 900 ms
- **Do not add `opacity:0` font-loading trick** — it caused blank print pages
- `isProforma` param renders "PRO-FORMA FACTUUR / OFFERTE" instead of the official
  title — admin prints pass `order.status === "In behandeling"` so a not-yet-approved
  request never reads as an official invoice

### Invoice numbering & Exact (UBL) export — CRITICAL
- `Order.invoiceNumber` is assigned **only on approval** (`PUT /:id/status` →
  `"Goedgekeurd"`, via `assignInvoiceNumberInTx` in `server/routes/orders.ts`), not at
  order creation. An order sits at `invoiceNumber: null` while `"In behandeling"`.
  **Never move this back to creation time** — a numbered-but-never-approved or
  cancelled order would burn a gap in the legally required sequential Dutch invoice
  series (`Factuur YYNNNN`, `formatInvoiceNumber`).
- `GET /:id/export/ubl` (Exact e-invoice XML, "Stage 1" — see `server/utils/ublInvoice.ts`)
  and the "Exact'a aktar" button reject `"In behandeling"` and `"Geannuleerd"` orders —
  mirrored client-side via `canExportUbl()` in `AdminOrders.tsx` so the button doesn't
  even render instead of erroring after the fact.
- Cancelling an order never touches `paymentStatus` — a paid-then-cancelled order needs
  a manual "Terugstorting registreren" (real refund isn't wired to Mollie's refund API).
  `needsRefund()` in `AdminOrders.tsx` surfaces this as a persistent violet "Terugstorting
  open" badge (list rows + detail modal) plus a dismissible banner — not just a one-time
  warning in the cancel confirmation, which was too easy to miss.

---

## Admin Security

- **Password hashing**: bcrypt, 12 rounds (`server/utils/auth.ts`). **Password
  policy**: min 10 chars + ≥1 letter + ≥1 digit (`PASSWORD_POLICY` in
  `server/routes/auth.ts`, exported for reuse in `server/routes/admins.ts`).
- **JWT**: admin tokens expire after **12h**, customer tokens after 7d
  (`generateToken` in `server/utils/auth.ts`). Every token carries a `v`
  (tokenVersion) claim; `requireAuth`/`requireAdmin` compare it against the DB
  value via a 60s TTL in-process cache (`isTokenVersionValid` — fails **open** on
  a transient DB error so a brief outage never logs everyone out).
  `change-password` and `password-reset` both bump `tokenVersion` (reset
  previously left old sessions alive — fixed). **Token storage stays
  `localStorage` + `Authorization: Bearer`** (not an httpOnly cookie) — a
  deliberate choice: every one of the ~30 mutation endpoints already uses the
  Bearer pattern, and moving to cookies would need CSRF tokens plus a rework of
  the admin `?full=1` image flow for marginal gain. Compensating controls: the
  short admin expiry, tokenVersion revocation, and 2FA below.
- **Account lockout**: DB-backed (`Admin`/`Customer.failedLoginCount` +
  `lockedUntil`), survives restarts — 5 failed attempts → 15 min lock. Only
  logins against an **unknown** email (no row to increment) still use a small
  in-memory throttle, documented inline in `server/routes/auth.ts`.
- **2FA (TOTP)**: admin-only, self-service via `AdminUsers.tsx` → `/api/auth/2fa/setup|enable|disable`.
  Secrets are AES-256-GCM encrypted at rest (`server/utils/crypto.ts`, key derived
  from `JWT_SECRET` — no new env var). Login becomes two-step when enabled: password
  success returns a 5-minute **pre-auth token** (`stage: "2fa"`, no `role` claim —
  `authenticateToken` never accepts it as a session) instead of a real JWT; the
  client then calls `POST /api/auth/login/2fa` with the TOTP code. **No backup
  codes** — recovery is another admin calling `reset-2fa` on the locked-out account
  (single-admin shops: reset directly via `prisma studio` on the VPS).
- **Admin user management**: `/api/admin/users` (`server/routes/admins.ts`) —
  list/create/rename/disable/enable/reset-password/reset-2fa. All admins share one
  role (`"admin"`) — no role hierarchy. `canDisable()` blocks disabling your own
  account or the last active admin. Disabling bumps `tokenVersion` so a live
  session dies immediately, not just on next token refresh.
- **Audit log**: every admin mutation (login, password change, order status/payment,
  machine CRUD, site-config/campaign/category changes, blocked dates, blog,
  admin-user actions) is written via `audit()` in `server/utils/audit.ts` —
  fire-and-forget, never fails the parent request. **Never log raw request
  bodies** (Machine PUT carries base64 images) — log changed field *names* only,
  capped at 2000 chars (`buildAuditRow`). Viewed in the real-time `AdminLogs.tsx`
  panel via `GET /api/admin/audit-logs` (paginated, action-group + email filters).
  Retention: 180 days, pruned daily by `pruneAuditLogs()` piggybacking on the
  existing 07:00 Amsterdam reminder cron in `server.ts`.
- Reset/verification tokens are stored as **sha256 hashes** (`hashToken` in
  `server/utils/auth.ts`) — the DB never holds a directly usable token, only the
  raw value emailed to the user matches on lookup.

---

## Performance & Accessibility — CRITICAL

huurgo.nl went through a PageSpeed/Lighthouse overhaul (2026-07, PRs #215–#220): mobile
Performance **58 → 81**, Desktop **→ 97**, CLS **0.513 → 0**, LCP **4.3s → ~4.1s mobile /
0.9s desktop**. The mechanisms below are load-bearing — **breaking any of them silently
regresses the score**. Lighthouse mobile lab runs (Slow 4G simulation) naturally swing
±5–10 points between identical-code runs; don't chase single-point fluctuations, but do
protect these invariants:

### Images — resize server-side, never ship raw base64/full-res
- Admin-uploaded images are stored as base64 `data:` URLs in Postgres (`Machine.imageUrl`,
  `Machine.additionalImages`, `SiteConfig.heroImageUrl`) — this is intentional (see Seed
  Safety pattern), **do not migrate to disk storage** without discussion.
- The **public** API (`GET /api/machines`, `GET /api/site-config`) never returns raw base64
  to anonymous clients — `toPublicMachine()` in `server/routes/machines.ts` substitutes
  `data:` URLs with binary-proxy paths (`/machine-image/:id`, `/machine-image/:id/gallery/:idx`,
  `/site-hero-image`). Admins fetch `?full=1` (requires `role: "admin"`) to get raw base64 back
  for editing — `useAppStore.fetchMachines`/`fetchSiteConfig` already do this by checking
  `hwh_admin_mode`. **Never add a new field that leaks base64 to the public feed.**
- Those proxies (`serveStoredImage` in `server.ts`) resize + re-encode to WebP via **sharp**
  (`quality: 78`) when a `defaultWidth` is passed, honoring `?w=` from the whitelist
  `ALLOWED_IMAGE_WIDTHS = [320,480,640,768,1024,1280,1600]`. sharp is loaded via a memoized
  **dynamic import with fallback** (`getSharp()`) — if the native binary is missing, images
  are served unresized rather than crashing the server. Don't switch this to a static
  top-level `import sharp from "sharp"`.
- **When adding a new `<img>` for a machine/hero photo, pass `?w=` matching its actual CSS
  display size** (pick from the whitelist above) — don't rely on a generic default meant for
  a different context. Example: the deals-carousel thumbnail is a fixed 200×200 box and
  requests `?w=480`, not the `/machine-image/:id` route's 800px default (sized for the
  larger detail-modal view).
- `public/placeholder-machine.webp` must stay small (~600×600, ~14 KiB) — it's shown at
  ~470px on catalog cards.

### Fonts — self-hosted, never re-add the Google Fonts CDN link
- Inter/Outfit/JetBrains Mono are self-hosted as variable woff2 (latin + latin-ext) in
  `public/fonts/`, declared via `@font-face` in `src/index.css`, preloaded in `index.html`.
  A render-blocking `<link href="https://fonts.googleapis.com/...">` was the #1 cause of the
  original CLS (0.51) — **do not reintroduce it**. If you need a new weight/family, download
  the woff2 and add an `@font-face` block; don't link to Google's CDN.

### Hero image — preloaded server-side, no fade
- The homepage hero is the LCP element. `metaForRequest`/`injectMeta`/`heroPreloadUrl` in
  `server.ts` inject `<link rel="preload" as="image" fetchpriority="high" imagesrcset ...>`
  into the served `index.html` for `/` **only**, targeting whichever hero actually renders
  (default WebP `srcset` vs `/site-hero-image?w=` variants for an admin-uploaded hero) — this
  removes the site-config-fetch → render → image-fetch waterfall that once pushed LCP to 9s.
  `index.html` itself must NOT hard-code a hero `<link rel="preload">` (it can't know which
  hero is active).
- `HomeSection.tsx`'s hero `<img>` has **no opacity fade-in** — a fade delays measured LCP.
  Keep `fetchPriority="high"` and `decoding="async"` on it.

### Caching
- `/assets` (Vite-hashed): 1 year immutable. `/images`, root static, and all image proxies:
  **30 days minimum** (`max-age=2592000`) — this is what satisfies Lighthouse's "efficient
  cache lifetime" audit; going back to 1h/7d reopens that finding. `sw.js` must stay
  `no-cache` (clients need to pick up new service-worker versions).
- `app.use(compression())` (gzip) must stay registered early in `server.ts` — it's what makes
  the JSON API payloads (which still carry some text/JSON weight) transfer efficiently.

### JS delivery
- `vite.config.ts` has a `manualChunks` vendor split (`react-vendor`, `motion`, `icons`,
  `charts`) — don't remove it without re-checking bundle sizes.
- The lazy-chunk "warm" effect in `App.tsx` (prefetches Catalog/Booking/FAQ chunks) is gated
  on the window **`load`** event before scheduling `requestIdleCallback` — warming earlier
  competes with the LCP hero for bandwidth on slow connections. Don't move it back to firing
  immediately on mount.

### Accessibility — contrast
- Small text (≤14px) on a white/light background needs at least `text-slate-500`
  (`text-slate-400` is ~2.75:1 on white, fails WCAG AA's 4.5:1). This bit us twice: once in
  homepage cards/footer, once in `Header.tsx`'s "Simpel en snel" tagline where the
  light/dark color branches were literally inverted (light bg had the lighter gray). **When
  a component takes a `dark` boolean, verify which literal color pairs with which background
  — don't assume.**

### Deploy — already automated, no manual step needed
- `.github/workflows/deploy.yml` auto-deploys on every merge to `main`: `test` (lint + vitest,
  Postgres service) → `build` (Docker image → ghcr.io) → `deploy` (SSH into the VPS, `git pull`
  + `docker compose up -d --force-recreate` + nginx reload). Despite the "deploy to VPS
  manually" note above (kept for the rare case CI is down), **merging a PR is normally
  sufficient** — no manual `docker compose up -d --build` needed. The `test` job has
  `timeout-minutes: 10` so a CI hang fails fast instead of blocking `build`/`deploy` for 15+
  minutes (this happened once, silently skipping a deploy).

---

## Booking Flow

1. Customer selects machine from catalog → adds to cart
2. `BookingStep1.tsx` — cart review, date selection, availability check
   - If unavailable: warning + WhatsApp button for alternative dates
3. `BookingStep2.tsx` — delivery type (self pickup / trailer / delivery), addons
4. `BookingStep3.tsx` — customer details, address lookup, order submit
5. `BookingSuccess.tsx` — order confirmed, WhatsApp button to request iDEAL link

Payment flow: customer picks "Betaal via link" or "Betaal op locatie" in step 2
(`paymentMethod` on the order). For "link" orders a real Mollie payment link is generated
automatically; the admin's "Betaallink sturen" WhatsApp button sends it (or falls back to a
manual placeholder if `MOLLIE_API_KEY` is unset) → Mollie's webhook confirms payment
automatically (`paymentStatus: "paid"`) → admin sets status "Goedgekeurd". "On location"
orders skip the link step entirely — the customer pays at pickup/delivery.

Transport costs: delivery €150 flat, trailer rental €25/day, self pickup free —
these are the **defaults**; admin-editable via AdminContent → Tarieven (see
"Transport & global add-on fees" under Pricing System above).

---

## WhatsApp

Number from env: `VITE_WHATSAPP_NUMBER` (format `31611691692`, no `+`).  
All builders in `src/utils/whatsapp.ts`. Sign-off emoji: **🦾** (never 🙏).

---

## Key Conventions

- **Language**: entire UI is Dutch. Server errors also in Dutch ("Te veel verzoeken" etc.).
- **TypeScript**: strict mode, ES2022 target, path alias `@/*` → `src/*`.
- **No ESLint** — `npm run lint` = `tsc --noEmit` only.
- **No `vitest.config.ts`** — Vitest defaults, tests in `src/__tests__/`.
- **File naming**: React components PascalCase, utils + server files camelCase.
- **CORS**: production only `huurgo.nl` + `www.huurgo.nl`. Do not add origins without updating `server.ts`.
- **Tailwind**: v4, no custom config. `xs:` breakpoint does NOT exist — use `sm:` minimum.
- **Animations**: `motion/react` (not `framer-motion`). FAB pulse: `animate-ping` on span, 15 s interval via `setInterval`, 900 ms duration.
- **No Gemini/AI**: `AdvisorSection.tsx` and `server/routes/gemini.ts` are deleted. Do not re-add.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql://...` (PostgreSQL only). Append `?connection_limit=10&pool_timeout=20` in production to bound the Prisma pool and avoid "too many connections" under load. |
| `JWT_SECRET` | JWT signing secret |
| `RESEND_API_KEY` | Transactional email (optional — mock fallback if absent) |
| `EMAIL_FROM` | Sender address (e.g. `noreply@huurgo.nl`) |
| `ADMIN_EMAIL` | Admin alert recipient (e.g. `info@mbhoogwerkers.com`) |
| `VITE_WHATSAPP_NUMBER` | WA number without `+` (e.g. `31611691692`) |
| `VITE_CLARITY_ID` | Microsoft Clarity project ID (optional). Empty = no tracking. Requires cookie consent (KVKK/GDPR) before enabling for EU visitors. |
| `APP_URL` | Production base URL (used in email links) |
| `REMINDER_SECRET` | Secret for cron reminder endpoint |
| `CALENDAR_FEED_TOKEN` | Secret gating the read-only iCal feed at `/api/calendar/<token>/huurgo.ics` (blocked dates + bookings, for Google/iPhone calendar subscription). Empty = feature disabled. |
| `MOLLIE_API_KEY` | Mollie API key (`test_...`/`live_...`) for automatic payment links (`server/services/mollieService.ts`). Empty = falls back to the manual `[PLAK HIER DE BETAALLINK]` placeholder in the admin WhatsApp template. |

`GEMINI_API_KEY` is no longer used — Gemini was fully removed.

---

## Recent Changes (2026-07, admin security & content management)

- **Admin security hardening**: real DB-backed audit log (`AuditLog` model,
  `server/utils/audit.ts`, `AdminLogs.tsx` now shows real data instead of the old
  client-side demo feed); login lockout + tokenVersion revocation moved from
  in-memory to the DB (survives restarts); admin JWT expiry shortened 7d→12h;
  reset/verification tokens now sha256-hashed at rest; password policy min
  8→10 chars. **2FA (TOTP)** for admins with AES-256-GCM-encrypted secrets and a
  two-step login (pre-auth token → code); new **Beheerders** panel
  (`AdminUsers.tsx`) for admin account management (create/disable/reset).
  See "Admin Security" above for the full mechanism list.
- **Admin-manageable content**: FAQ, homepage USPs, opening hours, transport/
  add-on fees and SEO/legal-page text moved from hard-coded literals into
  `SiteConfig` (nullable fields, `null` = code fallback — no seed change),
  editable via the new **Content** panel (`AdminContent.tsx`). New `/privacy`
  and `/voorwaarden` routes (previously dead links) render admin-edited
  markdown. Footer now actually reads the already-editable KvK/BTW/address
  fields instead of ignoring them (bug fix). See "Admin-manageable content"
  above for the resolver pattern and what's intentionally still code-only.
- **Mobile/UX**: `AdminMachines.tsx` gained a mobile card view (was a
  horizontally-scrolling table, the one admin list without one); booking
  calendar day cells `h-9`→`h-11 sm:h-9` (44px tap target on mobile); customer
  list paginated (50/page, "Meer laden") — previously fetched unbounded.

## Recent Changes (2026-07, performance)

- **PageSpeed/Lighthouse overhaul** (PRs #215–#220): mobile Performance 58→81, Desktop→97,
  CLS 0.513→0, LCP 4.3s→~4.1s mobile/0.9s desktop. See "Performance & Accessibility — CRITICAL"
  above for the full mechanism list and regression guardrails. Summary: gzip compression;
  public API substitutes base64 images with binary-proxy URLs (admin still gets raw base64 via
  `?full=1`); server-side sharp resize/WebP re-encode on the image proxies (`?w=` whitelist,
  30d cache); self-hosted fonts (was render-blocking Google Fonts CDN); hero preloaded
  server-side per-request with correct `imagesrcset`; hero upload bounds shrunk 2560px/0.92 →
  1600px/0.80; lazy-chunk warming deferred to `window.load`; Vite vendor `manualChunks`;
  low-contrast `text-slate-400`→`text-slate-500` fixes (homepage cards, footer, header
  tagline — the latter had an inverted dark/light color bug); CI `test` job got
  `timeout-minutes: 10` after a silent 15-minute hang skipped a deploy.

## Recent Changes (2026-06)

- **Flat-rate pricing**: `weekendPrice`, `weeklyPrice`, `monthlyPrice` added to Machine schema + booking engine + server validation + admin forms
- **All machine prices updated** in seed to match definitive price list (MB Hoogwerkers)
- **Seed safety**: machine upsert uses `update: {}` — seed never resets admin data
- **Discount % on catalog**: computed from flat rates, not stored percentage fields
- **Print fix**: removed opacity:0 trick; `printWindow.print()` called from parent after 900 ms
- **WhatsApp FAB**: backdrop z-index fix; 15 s pulse animation; indigo "Geschikt voor mij?" button
- **Header**: phone number removed, nav centered (absolute + translate-x), "Klant Login" → "Login"
- **Admin calendar**: date input grid fixed (xs: → grid-cols-2); reason field → preset dropdown
- **Image URL**: X button clears URL; no Unsplash fallback on PUT; placeholder shown correctly
- **Security**: Helmet (HSTS + CSP + frameguard), serializable transactions, crypto order IDs, email retry, DB indexes
- **Audit hardening**: backend rejects past `startDate` on orders; admin Orders flags stale unpaid `In behandeling` bookings (>48h) that block the agenda (warning only, no auto-cancel); `campaign-rules` POST payload validated/sanitized; machine `description` capped at 2000 chars; client image upload emits WebP (JPEG fallback); optional Microsoft Clarity via `VITE_CLARITY_ID` (CSP allows `*.clarity.ms`); recommend `connection_limit`/`pool_timeout` on `DATABASE_URL`
