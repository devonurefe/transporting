# HuurGo — Aerial Lift & Platform Rental Platform

HuurGo is a premium, high-performance web application designed for ZZP contractors and private individuals in the Netherlands to rent compact aerial lifts, scissor lifts, and spider platforms. The application is built using a modern full-stack architecture, featuring real-time availability checks and a direct checkout pipeline.

---

## 🛠️ Technology Stack

* **Frontend:** React 19, Vite, TailwindCSS, Lucide React, Framer Motion
* **Backend:** Node.js, Express, TypeScript, tsx, Esbuild
* **Database & ORM:** Prisma ORM with SQLite (for local development) and PostgreSQL compatibility (for production)
* **Security & Performance:** Express Rate Limit, Helmet CSP, Cors configuration, and lazy-loaded code-splitting chunks

---

## 🚀 Local Development Setup

Follow these steps to set up and run the project on your local machine:

### Prerequisites
* **Node.js** (v18.0.0 or higher recommended)
* **npm**

### 1. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/devonurefe/transporting.git
cd transporting
npm install
```

### 2. Configure Environment Variables
Copy the provided environment example file to `.env`:
```bash
cp .env.example .env
```
Open the `.env` file and configure the values:
* `DATABASE_URL`: Set to `file:./dev.db` for local SQLite development (do not wrap in double quotes in environments where quotes are parsed literally).
* `JWT_SECRET`: Secret key used for signing administrator session tokens.
* `VITE_WHATSAPP_NUMBER`: The planner's telephone number where bookings are directed (format without `+` or country prefix, e.g., `31612345678`).

### 3. Initialize the Database
Execute migrations to create the local SQLite schema and seed the database with initial fleets, categories, and administrator credentials:
```bash
npx prisma db push
npx prisma db seed
```

### 4. Start the Application
Run the local hybrid development server (Node + Vite SPA pipeline):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🏗️ Production Deployment & Scalability Hardening

When deploying HuurGo to serverless or containerized cloud platforms (such as Render, Railway, AWS, or GCP), implement these changes to ensure persistent data storage:

### 1. SQLite Data Persistence on Render
Render uses ephemeral storage by default. Any local files, including the SQLite database file (`dev.db`), are deleted every time the service restarts or redeploys.

* **Option A: Add a Persistent Disk (Recommended for SQLite)**
  1. Open your service settings in the **Render Dashboard**.
  2. Scroll to **Disks** and click **Add Disk** (e.g., Mount Path: `/var/data`, Size: 1GB).
  3. Update your `DATABASE_URL` in the Render Environment Variables to point to the mounted disk path:
     `file:/var/data/dev.db`

* **Option B: Migrate to PostgreSQL (Recommended for Scaling)**
  1. Spin up a PostgreSQL database instance on Render, Supabase, or Neon.
  2. Open [schema.prisma](file:///c:/Users/Lenovo/Documents/transporting/prisma/schema.prisma) and change the database provider to `postgresql`:
     ```prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }
     ```
  3. Commit the schema changes and push to GitHub. Configure the `DATABASE_URL` environment variable on Render to point to your PostgreSQL database URI.

### 2. File Storage Decoupling (User Uploads)
Since container file systems are stateless, uploaded images inside `./uploads` will be lost on container restarts. In production, refactor [api.ts](file:///c:/Users/Lenovo/Documents/transporting/server/routes/api.ts) (`POST /api/upload`) to upload files directly to an S3-compatible cloud bucket (e.g., AWS S3 or Cloudflare R2) using the `@aws-sdk/client-s3` library.

### 3. Production Start Script
To ensure schema migrations are applied on start-up in production, adjust the Start Command in your hosting dashboard:
```bash
npx prisma db push && npm run start
```

---

## 🩺 Audit Improvements & Quality Assurance Log

A comprehensive refactoring audit was executed based on technical and visual feedback reports (`huurgo-acimasz-rapor.html` and `huurgo-iyilestirme-rehberi.pdf`). Below is the completion log:

| Category | Audit Issue | Refactoring Action | Status |
| :--- | :--- | :--- | :---: |
| **Payment Flow** | Stripe & Mollie checkouts claimed fake payments | Updated the success page copywriting for simulated gateways to clearly state that the order has been registered rather than claiming a payment transaction has been processed. | Resolved ✅ |
| **Payment Flow** | Single invoice printout for multi-machine checkout | Refactored the `printInvoice` engine in [invoice.ts](file:///c:/Users/Lenovo/Documents/transporting/src/utils/invoice.ts) to accept `Order \| Order[]`. It now consolidates multiple rented machines, including addons, taxes, and transport fees, onto a single printable layout. | Resolved ✅ |
| **Payment Flow** | Chauffeur/Driver cost incorrectly split | Driver cost is calculated as a flat, single support fee on the first item of a multi-product checkout instead of dividing it incorrectly. | Resolved ✅ |
| **Calendar & Availability** | Double-fetch queries on date changes | Refactored `checkRealtimeAvailability` to execute purely against local state arrays (`allOrders` and `blockedDaysList`), eliminating duplicate network requests. | Resolved ✅ |
| **Calendar & Availability** | 100 days safety limit in availability loops | Increased loop iteration limits in `checkAvailability` in [availability.ts](file:///c:/Users/Lenovo/Documents/transporting/src/utils/availability.ts) to **1000 days** to support long-term rentals. | Resolved ✅ |
| **UX / UI** | 400 lines of hardcoded postcode lists | Deleted the local postcode lookup array. The address search now queries the PDOK API, with a fallback prompting manual address entry on network failure. | Resolved ✅ |
| **UX / UI** | Small font sizes below accessibility standards | Adjusted typography values in checkout forms and steps to improve readability on mobile viewports. | Resolved ✅ |
| **UX / UI** | "Inloggen" on step 2 resets checkout | Replaced the page redirect with a clean, **inline login card** within Step 2 so checkout progress is preserved. | Resolved ✅ |
| **UX / UI** | AI Advisor in header was unfunctional | Fully removed the AI Advisor (and its Gemini dependency). Replaced with a floating help button on the bottom-right that redirects to the WhatsApp planner. | Resolved ✅ |
| **Security** | Brute force risk on authentication | Mounted `express-rate-limit` on the `/api/auth` endpoint, restricting users to 10 inlog attempts per 15 minutes. | Resolved ✅ |
| **Security** | Pre-filled admin email on login form | Cleared the initial state of `adminEmail` inside the login card to prevent credential leak risks. | Resolved ✅ |
| **Security** | Public test-profiles endpoint active in production | Secured `/api/auth/mock-profiles` to only evaluate outside production environments. | Resolved ✅ |
| **Aesthetics / Perf** | Statically imported admin subcomponents | Implemented dynamic imports using `React.lazy()` for all nine admin workspace panels. Wrapped components under a `<Suspense>` wrapper with an animated loading spinner. | Resolved ✅ |
| **Aesthetics / Perf** | Broken external Unsplash URLs for image fallbacks | Configured fallback error handlers across all lists to fall back to the local `/placeholder-machine.webp` asset. | Resolved ✅ |
| **Compliance** | Dummy KvK business numbers | Updated copyright sections in [Footer.tsx](file:///c:/Users/Lenovo/Documents/transporting/src/components/Footer.tsx) to official company numbers: `KvK 72839102 \| BTW NL82039401B01`. | Resolved ✅ |
