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

- **Routes** under `/api/*`: `auth`, `machines`, `orders`, `blockedDates`, `siteConfig`, plus general `api` router (health, uploads).
- **Gemini/AI advisor**: completely removed. No `server/routes/gemini.ts`, no `AdvisorSection.tsx`, no `geminiEnabled` state in App.tsx.
- **Auth** (`server/middleware/auth.ts`): JWT validation, `requireAdmin` guard.
- **Rate limits**: 300 req/min global on `/api/`; 10 attempts/15 min on auth endpoints.
- **Email** (`server/services/emailService.ts`): Resend with `sendWithRetry(payload, retries=3)` exponential backoff. Falls back to mock/log if `RESEND_API_KEY` absent. Six email flows: order confirmation, status update, borgsom refund, daily reminder (cron 07:00), password reset.
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
Enabled per machine (pilot: Bravi Leonardo; **off** for scaffolding & campaign products Nifty 120/170). Two mechanics on top of the tier table:
- **Weekend package** (`weekendPrice`, flat): triggers ONLY when the entire rental stays within the closed weekend — single Sat, single Sun, or Sat+Sun together (1–2 days, start on Sat or Sun). It never triggers for a Friday start, nor for a longer rental that merely starts on Sat/Sun and extends past the weekend — those always use the normal day-count tier table instead. Helper: `isWeekendPackage(machine, startDate, days)` in `src/utils/pricing.ts`.
- **Automatic Sunday block** (`sundayBlockFee`, flat surcharge): when a rental's **last work day is Saturday** (and it isn't a weekend package), the machine is held over the closed Sunday (return Monday 08:00) → tier price **+ sundayBlockFee** (not discounted). If Sunday itself is the deliberately chosen end day (e.g. Fri+Sat+Sun, or a long Sat-start rental ending later in the week), there is **no surcharge** — it's just the normal tier price for that day count. Interior Sundays in a long rental are counted as normal pro-rata days; only a *trailing forced* Sunday adds the fee. Helper: `hasSundayBlock(machine, startDate, days)`.
- The old "hafta sonu çalışıyorum/çalışmıyorum" toggle (`weekendWorkAnswer`) is **removed** — weekend handling is now automatic. A later Friday-specific toggle UI was also removed: a Friday start (1 day / Fri+Sat 2 days+block / Fri+Sat+Sun 3 days no block) always uses the normal tier table, never the weekend package.

### Percentage fields (fallback, only if no flat rate)
`weeklyDiscountPercent`, `monthlyDiscountPercent`, `campaignDiscountPercent`, `campaignDiscountAmount`

### Where this logic lives
- **Frontend**: `src/utils/pricing.ts` → `calculateItemSubtotal()` + `tierPrice()` (called from `BookingSection.tsx` / `DateRangeCalendar.tsx`)
- **Backend validation**: `server/routes/orders.ts` → flat-rate block (`tierPrice` + `isWeekendPackage`/`hasSundayBlock` mirror) — **must mirror frontend exactly** or orders fail with "Totaalbedrag klopt niet"
- **Catalog display**: `CatalogSection.tsx` pricing popup + `MachineDetailModal.tsx` (tiered rows + weekend info-icon); `computeDiscounts(m)` derives week/maand % badges from flat rates

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

Eleven lazy-loaded panels inside `src/components/admin/`:

| Panel | File | Purpose |
|-------|------|---------|
| Dashboard | `AdminDashboard.tsx` | KPI cards, revenue chart, fleet composition |
| Orders | `AdminOrders.tsx` | Order list, status changes, invoice print, borgsom buttons |
| Machines | `AdminMachines.tsx` | Edit existing machines — prices, images, flat rates, gallery |
| Add Machine | `AdminAddMachine.tsx` | Add new machine — includes Weekend/Werkweek/4W price inputs |
| Calendar | `AdminCalendar.tsx` | Block/unblock dates per machine with reason dropdown |
| Planning | `AdminPlanning.tsx` | Daily logistics timeline (departures/returns, addresses) |
| Customers | `AdminCustomers.tsx` | Customer list, order history, lifetime value |
| Logs | `AdminLogs.tsx` | System activity log |
| Diagnostics | `AdminDiagnostics.tsx` | System health (KPIs + live DB latency probe, 15s interval) |
| Customizer | `AdminCustomizer.tsx` | Site config (hero text, labels), campaign rules, categories |
| Accounting | `AdminAccounting.tsx` | Revenue reporting + CSV export |

Shared admin widgets (not panels): `AdminStatusBadge.tsx`, `AdminConfirmDialog.tsx`, `AdminAvailabilityWidget.tsx`.

### Image upload in admin
- Main image: URL field with X button (clears to "") + file upload → sets `editImageUrl`
- Empty string `""` is a valid imageUrl — server saves it, card shows `/placeholder-machine.webp`
- Additional images: appear only in **detail popup**, not on catalog card
- **Never add an Unsplash fallback back** to the PUT handler — empty URL must stay empty

### Invoice print
- `printInvoice(order)` in `src/utils/invoice.ts`
- Opens `window.open("", "_blank")`, writes full HTML, calls `printWindow.print()` after 900 ms
- **Do not add `opacity:0` font-loading trick** — it caused blank print pages

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

Payment flow: customer sends WhatsApp → admin sends Tikkie/iDEAL link → payment confirmed → admin sets status "Goedgekeurd".

Transport costs: delivery €150 flat, trailer rental €25/day, self pickup free.

---

## WhatsApp

Number from env: `VITE_WHATSAPP_NUMBER` (format `31611848899`, no `+`).  
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
| `VITE_WHATSAPP_NUMBER` | WA number without `+` (e.g. `31611848899`) |
| `VITE_CLARITY_ID` | Microsoft Clarity project ID (optional). Empty = no tracking. Requires cookie consent (KVKK/GDPR) before enabling for EU visitors. |
| `APP_URL` | Production base URL (used in email links) |
| `REMINDER_SECRET` | Secret for cron reminder endpoint |
| `CALENDAR_FEED_TOKEN` | Secret gating the read-only iCal feed at `/api/calendar/<token>/huurgo.ics` (blocked dates + bookings, for Google/iPhone calendar subscription). Empty = feature disabled. |

`GEMINI_API_KEY` is no longer used — Gemini was fully removed.

---

## Recent Changes (2026-07)

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
