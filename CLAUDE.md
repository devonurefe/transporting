# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**HuurGo** — full-stack Dutch-language rental marketplace for aerial lifts, scissor lifts, spider platforms and ladder lifts. Operated by MB Hoogwerkers B.V. (Zoeterwoude). Features a real-time availability calendar, multi-step checkout with WhatsApp payment flow, PDF invoice generation, and a comprehensive admin console.

**Live URL:** hoogwerkerhub.onrender.com  
**Deploy:** push to `main` → Render auto-deploys (build: `npm run build && node scripts/preparePush.mjs && npx prisma db push`, start: `node dist/server.js`)

### Branching & PR workflow

`main` is the deployed/production branch — Render auto-deploys every push to it,
so **never push directly to `main`**. Instead:

- **One PR per feature.** Create a dedicated branch per change (e.g.
  `claude/<short-feature-name>`), branched off the latest `origin/main`.
- Keep each PR scoped to a single feature/fix so changes can be reviewed,
  reverted, or revisited feature by feature.
- Run `npm run lint` and `npm run test` before opening the PR.
- Open the PR against `main` and merge it once approved; Render deploys on merge.
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
- Production (Render): managed PostgreSQL connection string.
- Use `prisma db push` (not `migrate`) during development.
- Schema models: `Machine`, `Category`, `BlockedDate`, `Order`, `Customer`, `Admin`, `SiteConfig`, `Notification`, `InvoiceCounter`, `OrderRating`.
- Indexes on `Order`: `[machineId]`, `[customerId]`, `[status]`, `[machineId, startDate, endDate, status]`, `[createdAt]`. On `BlockedDate`: `[machineId, date]`.

---

## Pricing System — CRITICAL

Machines have two pricing mechanisms. **Flat rates take priority over percentage discounts.**

### Flat-rate fields (primary)
| Field | When applied |
|-------|-------------|
| `weekendPrice` | Exactly 2 or 3 rental days |
| `weeklyPrice` | 5–27 days (pro-rata: `floor(days/5) × weeklyPrice + remainder × pricePerDay`) |
| `monthlyPrice` | 28+ days (pro-rata: `floor(days/28) × monthlyPrice + remainder`) |

### Percentage fields (fallback, only if no flat rate)
`weeklyDiscountPercent`, `monthlyDiscountPercent`, `campaignDiscountPercent`, `campaignDiscountAmount`

### Where this logic lives
- **Frontend**: `BookingSection.tsx` → `calculateItemSubtotal()` (lines ~89-125)
- **Backend validation**: `server/routes/orders.ts` → flat-rate block (lines ~200-234) — **must mirror frontend exactly** or orders fail with "Totaalbedrag klopt niet"
- **Catalog display**: `CatalogSection.tsx` → `computeDiscounts(m)` helper — derives week/maand % from flat rates for badge display

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

Nine lazy-loaded panels inside `src/components/admin/`:

| Panel | File | Purpose |
|-------|------|---------|
| Dashboard | `AdminDashboard.tsx` | KPI cards, revenue chart, fleet composition |
| Orders | `AdminOrders.tsx` | Order list, status changes, invoice print, borgsom buttons |
| Machines | `AdminMachines.tsx` | Edit existing machines — prices, images, flat rates, gallery |
| Add Machine | `AdminAddMachine.tsx` | Add new machine — includes Weekend/Werkweek/4W price inputs |
| Calendar | `AdminCalendar.tsx` | Block/unblock dates per machine with reason dropdown |
| Logs | `AdminLogs.tsx` | System activity log |
| Diagnostics | `AdminDiagnostics.tsx` | System health (cosmetic metrics, 4s interval) |
| Customizer | `AdminCustomizer.tsx` | Site config (hero text, labels) |
| Accounting | `AdminAccounting.tsx` | Exact Online integration log |

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
