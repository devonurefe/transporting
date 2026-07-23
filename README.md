# HuurGo — Premium Aerial Lift Rental Platform

**HuurGo** is a full-featured, high-performance Dutch-language marketplace for renting aerial lifts, scissor lifts, spider platforms, and ladder lifts. Operating since 2024, the platform serves ZZP contractors and enterprises across the Netherlands with real-time availability calendars, multi-step checkout workflows, WhatsApp integration, and a comprehensive admin console. Deployed to production on TransIP VPS Amsterdam infrastructure running PostgreSQL + Docker Compose.

**Live URL:** [huurgo.nl](https://huurgo.nl)  
**Operator:** MB Hoogwerkers B.V. (KvK 72839102 | BTW NL82039401B01)

---

## 📋 Table of Contents

- [Overview & Features](#-overview--features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Deployment (VPS + Docker)](#-deployment-vps--docker-compose)
- [Admin Console](#-admin-console)
- [Pricing System](#-pricing-system)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Routes](#-api-routes)
- [Security & Performance](#-security--performance)

---

## ✨ Overview & Features

### Customer-Facing Features

**Catalog & Search**
- Browse 40+ rental units across 6 categories (spider platforms, scissor lifts, ladder lifts, boom lifts, mini cranes, etc.)
- Real-time availability calendar with 1000-day lookahead
- Machine detail pages with high-res image gallery, specifications, and pricing tiers
- Filter by availability, price, and machine type

**Booking Flow (Multi-Step)**
1. **Step 1:** Add machines to cart, select rental dates, check real-time availability
   - If unavailable, WhatsApp button for alternative date inquiry
2. **Step 2:** Choose delivery method (self-pickup, trailer rental, or full delivery) and add optional equipment
   - Inline login card preserves checkout progress
   - Transport costs: delivery €150 flat, trailer €25/day, self-pickup free
3. **Step 3:** Enter customer details, perform PDOK address lookup (fallback manual entry), accept terms
4. **Success Page:** Order confirmation, WhatsApp button to finalize payment

**Smart Pricing**
- **Flat-rate priority:** Weekend prices (2–3 days), weekly rates (5–27 days), monthly rates (28+ days)
- **Percentage fallback:** Weekly/monthly discounts only apply if flat rates not specified
- **Dynamic badges:** Catalog displays computed week/month discount percentages
- **Multi-machine carts:** Per-item pricing + shared transport costs

**Invoice & Print**
- HTML-based invoice generation supporting multi-machine orders
- Print-optimized layout with full itemization, taxes, transport, and addons
- Responsive invoice template for all devices

**WhatsApp Integration**
- Central contact number (env: `VITE_WHATSAPP_NUMBER`)
- Pre-built message templates for inquiries, booking confirmations, and payment requests
- Emoji sign-off: 🦾 (not 🙏)

**Authentication**
- JWT-based admin login
- Customer order lookup (email-based)
- Rate limiting: 10 attempts per 15 minutes on auth endpoints

---

### Admin Console (11 Lazy-Loaded Panels)

**Dashboard**
- Key performance indicators: total revenue (YTD/MTD), available machines, active orders
- Revenue trend chart (30-day moving average)
- Fleet composition by category with color-coded bars

**Orders Management**
- Filterable order table (status: In behandeling / Goedgekeurd / Pickup / Geleverd / Afgehandeld)
- Order details modal: full breakdown (machines, addons, transport, taxes), invoice print, customer contact
- Status change tracking, payment confirmation flow
- Borgsom (security deposit) refund buttons with confirmation dialogs
- Stale booking flag (>48h unpaid) warns planners of blocked calendar slots

**Machines Management**
- Edit existing machines: prices (per-day, weekend, weekly, monthly), categories, stock
- Image upload (X-button to clear) + gallery management
- Flat-rate fields (`weekendPrice`, `weeklyPrice`, `monthlyPrice`) for priority pricing
- Discount percentage fields (fallback only, auto-calculated from flat rates on frontend)
- Machine description (capped at 2000 chars), SEO slug, availability toggle

**Add Machine**
- Form pre-fills with sensible defaults
- SKU, category, pricing, images, stock level
- Flat-rate pricing inputs separated from percentage discounts

**Calendar**
- Date picker per machine with block/unblock actions
- Reason dropdown for blocked dates (Onderhoud, Geplande verkoop, Feestdag, etc.)
- Visual indicators: green (available), red (booked/blocked)

**Customers**
- Customer list with lifetime order count, total spend, last order
- Customer detail cards: full order history, contact info, dispute/feedback log

**Planning**
- Detailed order-to-delivery timeline view
- Filter by date range and machine
- Compact view for planner WhatsApp coordination

**Customizer**
- Hero section text (main headline, subheader, CTA)
- Button labels (checkout, inquiry, etc.)
- Footer company info (phone, email, address)
- Site-wide branding strings (all Dutch, i18n-ready)

**Diagnostics**
- System health metrics: database connection, response times, API availability
- Cosmetic counters (4s refresh interval)
- Environment variable verification

**Logs**
- System activity feed: logins, bookings, fleet changes, status updates

**Accounting**
- Revenue reporting with date/status filters and CSV export

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 6, React Router v7, TailwindCSS v4, Lucide React, Framer Motion (motion/react) |
| **Backend** | Node.js 20 (Alpine), Express 4.21, TypeScript, tsx (dev), esbuild (prod bundling) |
| **Database** | PostgreSQL 16 (production and local dev via Docker), Prisma ORM v6 — PostgreSQL only, no SQLite |
| **Security** | Helmet (HSTS, CSP, frameguard), express-rate-limit, bcryptjs, JWT |
| **Email** | Resend API with exponential backoff + mock fallback |
| **Deployment** | Docker (multi-stage build), Docker Compose v3.8, Nginx (Alpine), Let's Encrypt Certbot, TransIP VPS |
| **State Management** | Zustand (3 stores: app, auth, language) |
| **Validation** | Zod v4 |
| **Testing** | Vitest (single-run mode), no ESLint (TypeScript only) |

---

## 🏗️ Architecture

### Monorepo Structure

Single `package.json` for frontend + backend, unified TypeScript configuration, shared types.

```
transporting/
├── server.ts                    # Express entry point (dev + prod)
├── src/                         # React SPA + shared utilities
│   ├── main.tsx                 # React DOM root
│   ├── App.tsx                  # Route definitions, orchestration
│   ├── components/              # Main pages (CatalogSection, BookingSection, AdminSection, ...)
│   │   ├── admin/               # 11 lazy-loaded admin panels + shared admin widgets
│   │   └── booking/             # Booking step components + price summary + calendar
│   ├── store/                   # Zustand stores (appStore, authStore, languageStore)
│   ├── utils/
│   │   ├── availability.ts      # Availability engine (O(1) lookup with Map<string,string>)
│   │   ├── pricing.ts           # Tiered pricing (mirrored in server/routes/orders.ts)
│   │   ├── invoice.ts           # HTML invoice generation & print
│   │   ├── whatsapp.ts          # WA message builders
│   │   └── ...
│   └── __tests__/               # Vitest unit tests (pricing, availability, image, ...)
│
├── server/                      # Express backend
│   ├── routes/
│   │   ├── auth.ts              # Register/login, verification, password reset, admin customer list
│   │   ├── machines.ts          # Machine CRUD (admin)
│   │   ├── orders.ts            # Order create/list/status + ratings + export + reminders
│   │   ├── blockedDates.ts      # Calendar blocks
│   │   ├── siteConfig.ts        # Site config, categories, campaign rules
│   │   ├── calendar.ts          # iCal feed for calendar subscriptions
│   │   └── api.ts               # File uploads, health check
│   ├── middleware/auth.ts       # JWT validation, requireAdmin guard
│   ├── services/emailService.ts # Transactional email with retries
│   └── utils/auth.ts            # bcryptjs, JWT helpers
│
├── prisma/
│   ├── schema.prisma            # PostgreSQL schema (declarative — applied via `prisma db push`)
│   ├── client.ts                # Shared PrismaClient instance
│   └── seed.ts                  # Database seeding (40+ machines)
│
├── dist/                        # Built output (prod)
├── .github/workflows/deploy.yml # CI (lint + test gate) → Docker build → VPS deploy
├── package.json                 # Unified dependencies + scripts
├── vite.config.ts               # SPA build config
├── tsconfig.json                # TypeScript settings (strict mode, ES2022)
├── Dockerfile                   # Multi-stage prod image
├── docker-compose.yml           # Production stack (app + postgres + nginx + certbot)
├── nginx.conf                   # Reverse proxy + SSL/TLS config
└── CLAUDE.md                    # Developer guide (this repo)
```

### Entry Points

- **Development:** `npm run dev` → spawns `tsx watch server.ts`
  - Vite HMR middleware attached at runtime
  - Frontend served from Vite dev server, backend proxies API
- **Production:** `npm run build && npm run start`
  - Vite outputs SPA to `dist/`
  - esbuild bundles `server.ts` to `dist/server.js` (single Node process)
  - Prisma client generated once during build

---

## 🐳 Deployment (VPS + Docker Compose)

### Infrastructure Overview

**Host:** TransIP VPS Amsterdam  
**OS:** Ubuntu Server (Debian-based)  
**Runtime:** Docker + Docker Compose v2+  
**Reverse Proxy:** Nginx (Alpine, non-root)  
**SSL:** Let's Encrypt (auto-renewal with certbot)  
**Database:** PostgreSQL 16 (Alpine) in Docker

### Docker Stack

#### Service: `postgres`
- Image: `postgres:16-alpine`
- Volume: `postgres_data` (persistent)
- Env: `POSTGRES_PASSWORD` (must be set via `.env`)
- Healthcheck: `pg_isready` (5s interval, 5s timeout, 5 retries)
- Port: `127.0.0.1:5432` (localhost-only, no external access)

#### Service: `app`
- Image: `ghcr.io/devonurefe/transporting:latest` (built from Dockerfile)
- Depends on: `postgres` (healthy)
- Env variables:
  - `NODE_ENV=production`
  - `JWT_SECRET` (required)
  - `RESEND_API_KEY` (optional, email mock fallback if absent)
  - `DATABASE_URL` (required, must include `?connection_limit=10&pool_timeout=20`)
  - `ADMIN_EMAIL`, `EMAIL_FROM`, `APP_URL`, `REMINDER_SECRET`, `CALENDAR_FEED_TOKEN`
- Volume: `./uploads:/app/uploads` (⚠️ run `chown -R 1000:1000 uploads` once on host)
- Port: `127.0.0.1:3000` (localhost-only, accessed via Nginx)
- User: `node` (UID 1000, non-root)
- Startup CMD: `npm run start` (runs `prisma db push` once; an empty database is auto-seeded by the server)

#### Service: `nginx`
- Image: `nginx:alpine`
- Volumes:
  - `nginx.conf` (reverse proxy config)
  - Let's Encrypt certs (mounted at `/etc/letsencrypt`)
  - ACME challenge dir (mounted at `/var/www/certbot`)
- Ports: `80:80` (HTTP redirects to HTTPS), `443:443` (HTTPS)
- Features:
  - HTTP → HTTPS 301 redirect
  - Gzip compression (6 level, 256-byte minimum)
  - Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options
  - Upstream proxy to `app:3000` (container-to-container)
  - `client_max_body_size 10m` (for base64 image payloads)
  - TLS 1.2/1.3, modern cipher suite, 1-day session timeout

#### Service: `certbot`
- Image: `certbot/certbot`
- Renewal loop: `certbot renew` every 12 hours
- Volumes: shared Let's Encrypt paths with Nginx

### CI/CD (GitHub Actions)

Pushes to `main` trigger `.github/workflows/deploy.yml`:

1. **test** — `npm ci`, `prisma generate`, `npm run lint`, `npm run test` (also runs on PRs)
2. **build** — Docker image → `ghcr.io/devonurefe/transporting:latest` (only after tests pass, push to `main` only)
3. **deploy** — SSH to the VPS (password-based via `sshpass`, retried 3×): `git pull`, `docker compose pull app`, recreate app container (schema push happens at container start via `npm run start`)

Required repository secrets:

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Server address |
| `VPS_PASSWORD` | SSH password for the deploy user (`root`) |

### Deployment Checklist

1. **Pre-deployment (host VPS)**
   ```bash
   # Ensure Docker & Docker Compose are installed
   docker --version && docker-compose --version
   
   # Create project directory
   mkdir -p ~/huurgo && cd ~/huurgo
   
   # Create uploads folder with correct permissions
   mkdir -p uploads && chown -R 1000:1000 uploads
   
   # Create certbot folders
   mkdir -p certbot/{conf,www}
   ```

2. **Clone & configure**
   ```bash
   # Clone the repository
   git clone https://github.com/devonurefe/transporting.git .
   
   # Copy docker-compose.yml, nginx.conf, Dockerfile
   # Create .env file with production secrets
   cat > .env << 'EOF'
   POSTGRES_PASSWORD=<STRONG_DB_PASSWORD>
   JWT_SECRET=<STRONG_JWT_SECRET>
   RESEND_API_KEY=<OPTIONAL_EMAIL_KEY>
   EMAIL_FROM=noreply@huurgo.nl
   ADMIN_EMAIL=info@mbhoogwerkers.com
   DATABASE_URL=postgresql://huurgo:<STRONG_DB_PASSWORD>@postgres:5432/huurgo?connection_limit=10&pool_timeout=20
   APP_URL=https://huurgo.nl
   REMINDER_SECRET=<CRON_SECRET>
   CALENDAR_FEED_TOKEN=<CALENDAR_TOKEN>
   EOF
   ```

3. **Initial SSL setup (one-time)**
   ```bash
   # Generate self-signed cert for bootstrap
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout certbot/conf/live/huurgo.nl/privkey.pem \
     -out certbot/conf/live/huurgo.nl/fullchain.pem
   
   # Start services
   docker compose up -d
   
   # Certbot runs in background, renews every 12h
   # After first renewal, monitor: docker logs huurgo-certbot
   ```

4. **Start stack**
   ```bash
   docker compose up -d --build
   
   # Verify services
   docker compose ps
   docker logs huurgo-app
   docker logs huurgo-db
   docker logs huurgo-proxy
   ```

5. **Post-deployment checks**
   - Visit `https://huurgo.nl` → verify SSL certificate (Let's Encrypt)
   - Check Nginx logs: `docker logs huurgo-proxy`
   - Verify database connectivity: `docker compose exec app npx prisma db push`
   - Test email flow: Create order → check Resend dashboard or server logs

### Backups & Disaster Recovery

`scripts/backup.sh` runs nightly (cron installed by `scripts/vps-setup.sh`,
03:00 server time) and:

1. Dumps Postgres via `pg_dump`, gzipped, to `backups/db-<timestamp>.sql.gz`
2. Tarballs `uploads/` to `backups/uploads-<timestamp>.tar.gz`
3. Copies both offsite if `RCLONE_REMOTE` is set in `.env` (e.g.
   `b2:huurgo-backups` on Backblaze B2) — **this step is what actually
   protects against losing the VPS itself**; without it, backups just sit on
   the same disk they're meant to protect against
4. Deletes daily backups older than `BACKUP_RETENTION_DAYS` (default 14);
   keeps the 1st-of-month backup for 180 days in `backups/monthly/`
5. Pings `BACKUP_HEARTBEAT_URL` (optional, healthchecks.io-style) on
   success/failure so a broken backup job surfaces instead of failing silently

**One-time offsite setup** (see the full walkthrough in `scripts/backup.sh`'s
header comment):
```bash
curl https://rclone.org/install.sh | sudo bash
rclone config                 # set up your storage provider as remote "b2"
echo 'RCLONE_REMOTE="b2:huurgo-backups"' >> .env
bash scripts/backup.sh        # run once manually, confirm the file lands in the bucket
```

**Restore:**
```bash
gunzip -c backups/db-2026-07-23_0300.sql.gz | docker compose exec -T postgres psql -U huurgo huurgo
```
Test this against a scratch environment periodically — an untested backup is
a hypothesis, not a disaster recovery plan.

### Auto-Scaling & Optimization

| Concern | Strategy |
|---------|----------|
| **Database Pooling** | Prisma pool: `connection_limit=10`, `pool_timeout=20` (prevents "too many connections") |
| **File Uploads** | Mounted volume on host → consider S3 migration for multi-container deployments |
| **Email Retries** | Resend with 3x exponential backoff (1s, 2s, 4s); mock fallback if key absent |
| **Rate Limiting** | 300 req/min global on `/api/*`, 10 auth attempts per 15 min |
| **Nginx Tuning** | Gzip enabled, keepalive 65s, worker connections 1024, security headers |
| **Cron Jobs** | Daily reminder email (07:00 CET, via `REMINDER_SECRET` endpoint) — also sends a payment reminder to orders still unpaid 24h+ after booking |

### Troubleshooting Deployment

| Issue | Diagnosis |
|-------|-----------|
| Postgres won't start | Check `POSTGRES_PASSWORD` in `.env`, verify volume not corrupted: `docker compose down -v && docker compose up -d` |
| App can't connect to DB | Verify `DATABASE_URL` format, ensure `postgres` service is healthy: `docker compose logs postgres` |
| SSL certificate not renewing | Check certbot logs: `docker logs huurgo-certbot`, verify Let's Encrypt volumes mounted |
| Upload failures (EACCES) | Run on host: `chown -R 1000:1000 uploads` |
| High memory usage | Check Prisma pool: `connection_limit=10`, reduce Nginx worker processes, restart app |

---

## 💼 Admin Console

### Dashboard (`AdminDashboard.tsx`)

**Metrics Overview**
- Year-to-date revenue (top-right KPI)
- Month-to-date revenue
- Available machines count
- Active orders (in progress)

**Charts**
- 30-day revenue trend with hover details
- Fleet composition by category (stacked bar)
- Daily average rental price

**Navigation**
- Tabs to Orders, Machines, Calendar, Customers, etc.
- Role-based visibility (admin-only)

### Orders (`AdminOrders.tsx`)

**Order List**
- Filterable table: machine, customer, dates, price, status
- Status badge colors: 
  - `In behandeling` (yellow) — awaiting payment confirmation
  - `Goedgekeurd` (green) — payment confirmed, ready for pickup/delivery
  - `Pickup` (blue) — customer collecting rental
  - `Geleverd` (indigo) — delivered to customer
  - `Afgehandeld` (gray) — rental completed, returned

**Order Details Modal**
- Full itemization: machines, per-machine costs, addons (driver fee, taxi, etc.)
- Transport breakdown (delivery, trailer, pickup free)
- Taxes and totals
- Customer contact info + delivery address
- **Invoice Print:** Click to open new window with formatted invoice, calls `print()` after 900ms
- **Status Actions:** Dropdown to change status, triggers backend validation
- **Borgsom Refund:** Button to refund security deposit (email sent to customer)

**Stale Booking Flag**
- Orders >48 hours in `In behandeling` status trigger warning banner
- Helps planners identify blocked calendar slots awaiting payment

### Machines (`AdminMachines.tsx`)

**Machine List**
- Searchable table of all 40+ units
- Columns: SKU, category, pricing (per-day, week, month), stock, availability toggle

**Edit Machine Modal**
- **Basic Info:** SKU, title, category, description (2000 char max), stock level
- **Pricing**
  - Per-day price (pricePerDay)
  - Weekend price (2–3 days, optional)
  - Weekly price (5–27 days, optional)
  - Monthly price (28+ days, optional)
  - Discount percentages (fallback only, auto-calculated)
- **Images**
  - Main image URL (with X-button to clear) → file upload
  - Gallery images (additional photos in detail view)
  - Fallback: `/placeholder-machine.webp` if URL empty or broken
- **Availability:** Toggle to show/hide from catalog

### Add Machine (`AdminAddMachine.tsx`)

**Form**
- Same fields as edit, pre-filled with defaults
- Pricing inputs separated: per-day, weekend (2–3 days), werkweek (5–27 days), 4-week (28+ days)
- Image upload on create
- Category dropdown (6 options: spider, scissor, boom, ladder, mini-crane, transport)

### Calendar (`AdminCalendar.tsx`)

**Date Picker**
- Machine selector (dropdown)
- Month/year navigation
- Grid view (7 columns for days)
- **Color codes:** Green (available), Red (booked or blocked), Yellow (partial)

**Block/Unblock Actions**
- Click a date → open dialog
- **If available:** "Block this date?" dropdown with reason
  - Onderhoud (maintenance)
  - Geplande verkoop (planned sale)
  - Feestdag (holiday)
  - Custom text
- **If blocked:** Show reason, button to unblock

**Bulk Operations** (Future)
- Currently single-date at a time; could extend to date ranges

### Customers (`AdminCustomers.tsx`)

**Customer List**
- Email, name, phone, total spent, order count, last rental date
- Click to expand detail card

**Customer Details**
- Lifetime order history (sortable by date/amount)
- Contact info (email, phone, address)
- Notes / feedback history (optional)

### Planning (`AdminPlanning.tsx`)

**Timeline View**
- Horizontal order cards with machine, dates, delivery address
- Filter by date range, machine, status
- Color-coded by status
- Compact for WhatsApp coordination with delivery partner

### Customizer (`AdminCustomizer.tsx`)

**Editable Site Config**
- Hero section: headline, subheader, CTA button text
- Navigation labels: "Huur", "Login", "Admin", etc.
- Footer: phone, email, address, company info (KvK, BTW)
- Email templates: subject lines, pre-built message templates
- Terms & conditions text (Markdown-editable)

**Save & Publish**
- Changes instantly reflected on frontend
- No cache invalidation needed (SPA pulls config on load)

### Diagnostics (`AdminDiagnostics.tsx`)

**Health Checks**
- Database connection: ✅ online / ❌ offline
- API response time (average)
- Email service status (Resend API check)
- Node.js uptime, memory usage
- Prisma client version

**Environment Variable Summary**
- Shows which env vars are set (masks secrets)
- Helpful for debugging deployment issues

---

## 💰 Pricing System

### Logic & Priority

Machines have **two pricing mechanisms**. Flat rates take priority; percentage discounts are fallback.

#### Flat-Rate Fields (Primary)

| Field | When Applied | Calculation |
|-------|--------------|-------------|
| `weekendPrice` | Exactly 2 or 3 rental days | Fixed price, no per-day multiplier |
| `weeklyPrice` | 5–27 days | `floor(days/5) × weeklyPrice + remainder × pricePerDay` |
| `monthlyPrice` | 28+ days | `floor(days/28) × monthlyPrice + remainder × pricePerDay` |
| Fallback | All other durations | Use `pricePerDay × days` |

#### Percentage Fields (Secondary)

Only used if **no flat rate** applies:
- `weeklyDiscountPercent`: Applied to 5–27 day rentals
- `monthlyDiscountPercent`: Applied to 28+ day rentals
- `campaignDiscountPercent`: Promotional discount
- `campaignDiscountAmount`: Fixed $ discount

#### Where Logic Lives

**Frontend (`BookingSection.tsx` ~lines 89–125)**
```typescript
function calculateItemSubtotal(machine, days) {
  if (days >= 2 && days <= 3 && machine.weekendPrice)
    return machine.weekendPrice;
  if (days >= 5 && days <= 27 && machine.weeklyPrice) {
    const weeks = Math.floor(days / 5);
    const remainder = days % 5;
    return weeks * machine.weeklyPrice + remainder * machine.pricePerDay;
  }
  if (days >= 28 && machine.monthlyPrice) {
    const months = Math.floor(days / 28);
    const remainder = days % 28;
    return months * machine.monthlyPrice + remainder * machine.pricePerDay;
  }
  return machine.pricePerDay * days; // Fallback
}
```

**Backend Validation (`server/routes/orders.ts` ~lines 200–234)**
- Must mirror frontend exactly or orders fail with "Totaalbedrag klopt niet"
- Serializable transaction to prevent double-booking race conditions

**Catalog Display (`CatalogSection.tsx`)**
```typescript
function computeDiscounts(machine) {
  // Derive week % from flat rates
  const weeklyFromFlat = machine.weeklyPrice 
    ? Math.round((1 - machine.weeklyPrice / (5 * machine.pricePerDay)) * 100) 
    : 0;
  const monthlyFromFlat = machine.monthlyPrice 
    ? Math.round((1 - machine.monthlyPrice / (28 * machine.pricePerDay)) * 100) 
    : 0;
  return {
    weekly: Math.max(0, weeklyFromFlat), // No negative badges
    monthly: Math.max(0, monthlyFromFlat)
  };
}
```

### Transport Costs

- **Self-pickup:** €0
- **Trailer rental:** €25/day
- **Full delivery:** €150 flat

Calculated per-item and summed at checkout (Step 2).

---

## 🚀 Development Setup

### Prerequisites

- **Node.js** v18+ (v20 Alpine in Docker)
- **npm** v9+
- **PostgreSQL** 16 (required — run locally via `docker compose up postgres`)

### Quick Start

```bash
# Clone & install
git clone https://github.com/devonurefe/transporting.git
cd transporting
npm install

# Configure environment
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://huurgo:password@localhost:5432/huurgo
#   JWT_SECRET=your-secret-here
#   VITE_WHATSAPP_NUMBER=31611691692

# Initialize database
npx prisma db push
npx prisma db seed

# Start dev server (hybrid Vite + Express)
npm run dev
# Opens http://localhost:3000
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Hybrid dev server (Vite SPA + Express backend) |
| `npm run build` | Build SPA (Vite) + server bundle (esbuild) → `dist/` |
| `npm run start` | Run production build (requires `dist/`) |
| `npm run clean` | Delete `dist/` folder |
| `npm run lint` | TypeScript type-check only (`tsc --noEmit`), no ESLint |
| `npm run test` | Run Vitest (single-run mode) |
| `npx vitest run src/__tests__/*.test.ts` | Run specific test file |
| `npx prisma db push` | Apply schema changes to database |
| `npx prisma db seed` | Seed initial data (40+ machines, categories) |
| `npx prisma studio` | GUI database browser (port 5555) |
| `npx prisma generate` | Regenerate Prisma client |

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection (PostgreSQL only) | `postgresql://huurgo:huurgo_dev_pass@localhost:5432/huurgo` |
| `JWT_SECRET` | JWT signing key | `super-secret-key-min-32-chars` |
| `RESEND_API_KEY` | Email service API key (optional) | `re_xxxx` |
| `EMAIL_FROM` | Sender email | `noreply@huurgo.nl` |
| `ADMIN_EMAIL` | Alert recipient | `info@mbhoogwerkers.com` |
| `VITE_WHATSAPP_NUMBER` | Customer contact number (no +) | `31611691692` |
| `VITE_CLARITY_ID` | Microsoft Clarity project ID (optional) | `xxxx` |
| `APP_URL` | Production base URL (for email links) | `https://huurgo.nl` |
| `REMINDER_SECRET` | Cron endpoint secret | `secret-token` |
| `CALENDAR_FEED_TOKEN` | iCal feed token | `feed-token-here` |

---

## 📁 Project Structure

```
src/
├── App.tsx                      # Route definitions (/, /booking, /admin, /orders)
├── main.tsx                     # React DOM root
├── components/
│   ├── HomeSection.tsx          # Landing page
│   ├── CatalogSection.tsx       # Browse machines, add to cart, compute % discounts
│   ├── BookingSection.tsx       # Multi-step checkout orchestration
│   ├── MyOrdersSection.tsx      # Customer order tracking
│   ├── AdminSection.tsx         # Admin panel router
│   ├── Header.tsx / Footer.tsx  # Navigation, company info
│   ├── MachineDetailModal.tsx   # Machine detail popup / MachineDetailPage.tsx (deep-link page)
│   ├── booking/
│   │   ├── BookingStep1.tsx     # Dates, delivery type, addons, weekend question
│   │   ├── BookingStep2.tsx     # Customer details + PDOK address lookup
│   │   ├── BookingSuccess.tsx   # Confirmation + WhatsApp payment link
│   │   ├── BookingPriceSummary.tsx
│   │   └── DateRangeCalendar.tsx
│   └── admin/
│       ├── AdminDashboard.tsx   # KPIs, revenue chart, fleet composition
│       ├── AdminOrders.tsx      # Order list, details, status changes
│       ├── AdminMachines.tsx    # Edit machine prices, images, categories
│       ├── AdminAddMachine.tsx  # Create new machine
│       ├── AdminCalendar.tsx    # Block/unblock dates, reason dropdown
│       ├── AdminCustomers.tsx   # Customer list, lifetime value
│       ├── AdminPlanning.tsx    # Timeline for delivery coordination
│       ├── AdminCustomizer.tsx  # Site config (hero text, labels, footer)
│       ├── AdminDiagnostics.tsx # System health checks
│       ├── AdminLogs.tsx        # System activity feed
│       ├── AdminAccounting.tsx  # Revenue reporting + CSV export
│       └── AdminStatusBadge.tsx # Status color helper
├── store/
│   ├── appStore.ts              # Zustand: machines, orders, cart, blockedDates
│   ├── authStore.ts             # JWT token, login state
│   └── languageStore.ts         # i18n (NL/EN public, +TR in admin)
├── utils/
│   ├── availability.ts          # Booking engine (O(1) date lookup, buffer days)
│   ├── pricing.ts               # Tiered pricing (mirrored server-side)
│   ├── invoice.ts               # HTML invoice + print (supports Order | Order[])
│   ├── whatsapp.ts              # WA message builders (inquiry, confirmation, payment)
│   └── ...
└── __tests__/                   # pricing, availability, whatsapp, image, auth tests

server/
├── routes/
│   ├── auth.ts                  # Register, login, verification, password reset
│   ├── machines.ts              # Machine CRUD (admin)
│   ├── orders.ts                # Order create/list/status, ratings, export, reminders
│   ├── blockedDates.ts          # GET / (list), POST / (block/unblock)
│   ├── siteConfig.ts            # Site config, categories, campaign rules
│   ├── calendar.ts              # iCal feed + admin subscribe URL
│   └── api.ts                   # POST /upload (images), GET /health
├── middleware/auth.ts           # JWT validation, requireAdmin guard
├── services/emailService.ts     # Resend with 3x retry, mock fallback
└── utils/auth.ts                # bcryptjs hashing, JWT signing

prisma/
├── schema.prisma                # PostgreSQL ORM schema (applied via `prisma db push`)
├── client.ts                    # Shared PrismaClient instance
└── seed.ts                      # Database seeding (40+ machines, admin account)
```

---

## 🗄️ Database Schema

### Core Models

#### `Machine`
```prisma
model Machine {
  id                        String
  sku                       String (unique)
  title                     String
  description               String (capped at 2000 chars)
  category                  Category (relation)
  pricePerDay               Decimal
  weekendPrice              Decimal? (2–3 days)
  weeklyPrice               Decimal? (5–27 days, pro-rata)
  monthlyPrice              Decimal? (28+ days, pro-rata)
  weeklyDiscountPercent     Int? (fallback)
  monthlyDiscountPercent    Int? (fallback)
  campaignDiscountPercent   Int?
  campaignDiscountAmount    Decimal?
  imageUrl                  String (empty string = placeholder)
  additionalImages          String[] (JSON array)
  stock                     Int (available units)
  isActive                  Boolean
  blockedDates              BlockedDate[]
  orders                    Order[]
  createdAt                 DateTime
  updatedAt                 DateTime
}

model Category {
  id                        String
  name                      String (Spider, Scissor, Boom, etc.)
  description               String?
  machines                  Machine[]
  createdAt                 DateTime
}
```

#### `Order`
```prisma
model Order {
  id                        String (format: HWH-XXXXXXXX, crypto random)
  customerId                String (relation)
  customer                  Customer
  machineId                 String (primary rental item)
  machine                    Machine
  additionalMachines        String[] (JSON array of machine IDs)
  startDate                 DateTime
  endDate                   DateTime
  rentalDays                Int (calculated)
  deliveryType              Enum (SELF_PICKUP | TRAILER | DELIVERY)
  deliveryAddress           String (full address from PDOK)
  pricePerDay               Decimal (snapshot from machine)
  totalPrice                Decimal (validated on backend)
  status                    Enum (IN_BEHANDELING | GOEDGEKEURD | PICKUP | GELEVERD | AFGEHANDELD)
  addons                    OrderAddon[]
  invoiceUrl                String? (PDF path if applicable)
  notes                     String? (admin notes)
  createdAt                 DateTime
  updatedAt                 DateTime
  
  // Indexes for performance
  @@index([machineId])
  @@index([customerId])
  @@index([status])
  @@index([machineId, startDate, endDate, status])
  @@index([createdAt])
}

model OrderAddon {
  id                        String
  orderId                   String
  order                     Order (relation)
  name                      String (Driver Fee, Taxi, etc.)
  price                     Decimal
  quantity                  Int
  createdAt                 DateTime
}
```

#### `BlockedDate`
```prisma
model BlockedDate {
  id                        String
  machineId                 String
  machine                   Machine (relation)
  date                      DateTime (single day)
  reason                    String (Onderhoud, Feestdag, etc.)
  createdBy                 String (admin email)
  createdAt                 DateTime
  
  @@index([machineId, date])
}
```

#### `Customer`
```prisma
model Customer {
  id                        String
  email                     String (unique)
  firstName                 String
  lastName                  String
  phone                     String
  company                   String?
  address                   String
  postalCode                String
  city                      String
  country                   String
  orders                    Order[]
  createdAt                 DateTime
  updatedAt                 DateTime
}
```

#### `Admin`
```prisma
model Admin {
  id                        String
  email                     String (unique)
  password                  String (bcryptjs hash)
  role                      Enum (ADMIN | SUPER_ADMIN)
  lastLogin                 DateTime?
  createdAt                 DateTime
  updatedAt                 DateTime
}
```

#### `SiteConfig`
```prisma
model SiteConfig {
  id                        String (singleton, always "singleton")
  heroHeadline              String
  heroSubheader             String
  heroCtaText               String
  footerPhone               String
  footerEmail               String
  footerAddress             String
  companyName               String
  companyKvk                String
  companyBTW                String
  updatedAt                 DateTime
}
```

#### Additional Models
- `Notification`: User alerts (email sent, order status change)
- `InvoiceCounter`: Invoice numbering sequence (for PDF exports)
- `OrderRating`: Customer feedback (future feature)

---

## 🔌 API Routes

### Authentication (`/api/auth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/register` | POST | — | Customer registration (email verification sent) |
| `/api/auth/login` | POST | — | Customer/admin login (email + password) |
| `/api/auth/me` | GET | JWT | Current user profile |
| `/api/auth/profile` | PUT | JWT | Update own profile |
| `/api/auth/verify` | GET | Token | Email verification link |
| `/api/auth/resend-verification` | POST | — | Resend verification email |
| `/api/auth/forgot-password` | POST | — | Password reset email |
| `/api/auth/reset-password` | POST | Token | Set new password via reset token |
| `/api/auth/change-password` | POST | JWT | Change password (revokes old tokens) |
| `/api/auth/customers` | GET | JWT (admin) | Customer list with order stats |
| `/api/auth/campaigns/email` | POST | JWT (admin) | Bulk campaign email (max 200 recipients) |

### Machines (`/api/machines`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/machines` | GET | — | List machines (catalog, paginated) |
| `/api/machines` | POST | JWT (admin) | Create machine |
| `/api/machines/:id` | PUT | JWT (admin) | Update machine (prices, images, etc.) |
| `/api/machines/:id/toggle-active` | PATCH | JWT (admin) | Show/hide machine in catalog |
| `/api/machines/:id` | DELETE | JWT (admin) | Delete machine |

### Orders (`/api/orders`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/orders` | POST | — | Create order (server re-validates all prices; idempotency-key support) |
| `/api/orders` | GET | JWT | List orders (admin: all, customer: own) |
| `/api/orders/availability` | GET | — | Availability check for a machine + date range |
| `/api/orders/:id/status` | PUT | JWT (admin) | Change order status (validated transitions) |
| `/api/orders/:id/payment` | PUT | JWT (admin) | Mark payment received |
| `/api/orders/:id/cancel` | PUT | JWT | Customer cancels own pending order |
| `/api/orders/:id/rating` | POST/GET | JWT | Rate a completed order / fetch own rating |
| `/api/orders/:id/rating/guest` | POST | Token | Guest rating via emailed link |
| `/api/orders/ratings/summary` | GET | — | Aggregate rating for the storefront |
| `/api/orders/ratings/by-machine` | GET | — | Ratings per machine |
| `/api/orders/export` | GET | JWT (admin) | CSV export (accounting) |
| `/api/orders/send-reminders` | POST | `REMINDER_SECRET` | Trigger rental + payment reminder emails (cron) |

### Blocked Dates (`/api/blocked-dates`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/blocked-dates` | GET | — | All blocked dates (used by availability engine) |
| `/api/blocked-dates` | POST | JWT (admin) | Block / unblock dates for a machine |

### Site Config & Categories

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/site-config` | GET | — | Fetch site customizer settings |
| `/api/site-config` | POST | JWT (admin) | Update hero text, labels, footer (whitelisted fields) |
| `/api/categories` | GET / POST | — / JWT (admin) | Category list / update |
| `/api/campaign-rules` | GET / POST | — / JWT (admin) | Campaign discount rules |

### Calendar

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/calendar/:token/huurgo.ics` | GET | `CALENDAR_FEED_TOKEN` | iCal feed (Google/iPhone calendar subscribe) |
| `/api/calendar/subscribe-url` | GET | JWT (admin) | Full subscribe URL for the admin panel |

### General

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/upload` | POST | JWT (admin) | Upload machine image (max 3 MB, magic-byte validated, no SVG) |
| `/api/health` | GET | — | Health check (database connection, uptime) |

### Error Responses

Errors return a Dutch-language message in a consistent shape:
```json
{ "error": "Machine niet gevonden" }
```
Validation errors may include extra fields (e.g. `conflictingDates` on a 409 booking conflict).

---

## 🔐 Security & Performance

### Security Measures

**Authentication & Authorization**
- JWT-based session tokens (HS256, signed with `JWT_SECRET`)
- `requireAdmin` middleware guard on sensitive endpoints
- Password hashing: bcryptjs (10 salt rounds)
- No pre-filled credentials on login form (prevents leak)

**Rate Limiting**
- Global: 300 requests/minute on `/api/*`
- Auth: 10 attempts per 15 minutes on `/api/auth/login`
- Prevents brute-force and DoS attacks

**Helmet Security Headers**
- HSTS: `max-age=31536000; includeSubDomains; preload`
- CSP: `default-src 'self'`, img-src allows data/blob/https, connect-src allows API
- X-Frame-Options: SAMEORIGIN (no clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer-when-downgrade

**CORS**
- Production: `huurgo.nl`, `www.huurgo.nl` only
- Development: `localhost:3000` + `localhost:5173` (Vite)

**Database**
- Serializable transactions on order creation (prevents double-booking)
- Indexed queries on frequent filters (machineId, status, dates)
- Parameterized queries via Prisma (prevents SQL injection)

**Data Privacy**
- Database reachable only from localhost/Docker network (port bound to `127.0.0.1`)
- Admin passwords stored as bcrypt hashes, never logged or exposed
- Invoices stored with order records, not in filesystem
- iCal feed omits customer phone numbers; gated by secret token + tight rate limit

### Performance Optimizations

**Frontend**
- Vite SPA with code-splitting (lazy-loaded admin panels)
- React.lazy() + Suspense for dynamic admin components
- Availability engine: O(1) lookup with `Map<string,string>` for blocked dates
- 1000-day availability lookahead (optimized, no nested loops)

**Backend**
- Express middleware: logging, error handling, CORS
- Prisma connection pooling: `connection_limit=10`, `pool_timeout=20`
- Indexed queries on Order (machineId, status, dates) and BlockedDate
- Email service: async, 3x retry with exponential backoff

**Caching**
- SPA assets: content-hashed chunks (Vite) — safe for long browser caching
- Site config cached client-side in sessionStorage; cart persisted in localStorage
- iCal feed: `Cache-Control: public, max-age=300`

**Nginx**
- Gzip compression (6 level, min 256 bytes)
- Keepalive 65s (connection reuse)
- `client_max_body_size 10m` (base64 images)
- Proxy buffering, timeouts (60s)

### Monitoring & Logging

**Server Logs**
- Structured JSON logs via logger middleware
- All API requests logged (method, path, status, response time)
- Errors logged with full stack trace

**Admin Diagnostics**
- Database connectivity check
- API response time metrics
- Email service status
- Node uptime and memory usage

**Email Notifications**
- Order confirmation (customer)
- Status update notifications (customer)
- Borgsom refund receipt (customer)
- Daily reminder email (07:00 CET)
- Admin alerts on critical errors

---

## 🧪 Testing

### Unit Tests (`npm run test`)

Located in `src/__tests__/` (Vitest):

| File | Covers |
|------|--------|
| `pricing.test.ts` + `pricing-scenarios.test.ts` + `pricing-helpers.test.ts` | Tiered pricing, discounts, VAT, weekend logic, real-world scenarios |
| `availability.test.ts` | Overlaps, blocked dates, buffer days |
| `whatsapp.test.ts` | Message templates |
| `image.test.ts` | Client-side image resize/compression |
| `authVerification.test.ts` | Hashing + verification tokens |

Coverage is focused on calculation logic; there are no component or API integration tests yet.

### Type Checking (`npm run lint`)

- `tsc --noEmit`: Full TypeScript strict mode check
- No ESLint (TypeScript configuration only)

### Continuous Integration

`.github/workflows/deploy.yml` runs `npm run lint` + `npm run test` on every PR and
push to `main`. On `main`, a Docker image is built and pushed to GHCR only after the
test job passes, then deployed to the VPS over key-based SSH.

### Manual Testing

**Before pushing to production:**
1. Run `npm run lint && npm run test`
2. Test booking flow end-to-end (select machine, dates, checkout, payment)
3. Test admin panel (create order, update status, print invoice)
4. Test email flows (order confirmation, status update)
5. Test availability calendar (book 2 machines, verify no overlap)
6. Test pricing calculations (weekend, weekly, monthly rates)

---

## 📊 Recent Changes & Improvements

**Pricing System** (2026-06)
- Flat-rate fields (`weekendPrice`, `weeklyPrice`, `monthlyPrice`) now priority
- Backend pricing validation mirrors frontend exactly
- Seed safety: machine upsert uses `update: {}` (never overwrites admin data)

**Admin UX**
- Lazy-loaded admin panels (9 components with React.lazy)
- Inline login card on Step 2 (preserves checkout progress)
- Calendar date input grid fixed (xs: → grid-cols-2)
- Image URL: X button to clear, no Unsplash fallback

**Security Hardening**
- Helmet security headers (HSTS, CSP, frameguard)
- Serializable transactions on order creation
- Crypto order IDs: `HWH-${random_hex}`
- Email retry with exponential backoff
- Database indexes on frequent queries
- Optional Microsoft Clarity via `VITE_CLARITY_ID`

**Performance**
- 1000-day availability window (from 100-day limit)
- Gzip compression on Nginx
- Code-splitting for admin lazy-load
- Prisma connection pooling with bounds

---

## 🤝 Contributing

### Branching Model

- `main`: Stable production branch (never push directly)
- Feature branches: `claude/<feature-name>` (off `main`)
- PR workflow: one PR per feature, test before merge

### Pre-Push Checklist

```bash
npm run lint       # TypeScript type-check
npm run test       # Unit tests
npm run build      # Verify build succeeds
```

### Commit Messages

- Descriptive, past tense: "Add flat-rate pricing", "Fix availability calculation"
- Link to issues if applicable: "Fixes #123"

---

## 📞 Support & Contact

**Company:** MB Hoogwerkers B.V. (Zoeterwoude)  
**KvK:** 72839102 | **BTW:** NL82039401B01  
**WhatsApp:** [+31 6 11 69 16 92](https://wa.me/31611691692)  
**Email:** [info@mbhoogwerkers.com](mailto:info@mbhoogwerkers.com)  
**Website:** [huurgo.nl](https://huurgo.nl)

---

## 📜 License

Proprietary — MB Hoogwerkers B.V. All rights reserved.

---

**Last Updated:** July 2026  
**Maintainer:** Claude Code (Anthropic)
