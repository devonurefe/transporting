# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HuurGo** — a full-stack Dutch-language rental marketplace for aerial lifts, scissor lifts, and spider platforms. Features an AI-guided advisor (Google Gemini), real-time availability calendar, multi-step checkout, invoice generation, and a comprehensive admin console.

## Commands

```bash
# Development
npm run dev          # Hybrid Vite + Express dev server on http://localhost:3000

# Build & Production
npm run build        # Vite SPA + esbuild server bundle → dist/
npm run start        # Run production server (requires build first)
npm run clean        # Remove dist/

# Quality
npm run lint         # TypeScript type-check only (tsc --noEmit), no ESLint
npm run test         # Run all Vitest tests (single run)
npx vitest run src/__tests__/availability.test.ts  # Run a single test file

# Database
npx prisma db push   # Apply schema changes (dev, no migration history)
npx prisma db seed   # Seed initial data (tsx prisma/seed.ts)
npx prisma studio    # GUI to inspect database

# Docker
docker-compose up    # Start app + nginx reverse proxy
```

## Architecture

This is a **single-package full-stack monorepo** — one `package.json` covers both the React frontend and Express backend.

### Entry Points

- **`server.ts`** — The single entry point for both dev and production. In dev it spawns a Vite dev server as Express middleware (HMR included). In production it serves the pre-built `dist/` SPA.
- **`src/main.tsx`** → **`src/App.tsx`** — React SPA entry. Routing is handled by React Router v7 with URL-based tab navigation (`/`, `/booking`, `/admin`, `/orders`).

### Frontend (`src/`)

- **State**: Three Zustand stores — `appStore` (machines, orders, cart), `authStore` (JWT + user), `languageStore` (Dutch i18n strings).
- **Code splitting**: All main sections and all 9 admin panels are `React.lazy()`-loaded via Suspense.
- **Availability logic** (`src/utils/availability.ts`) runs entirely client-side using order data fetched from the API; it supports a 1000-day window.

### Backend (`server/`)

- **Routes** are mounted under `/api/*`: `auth`, `machines`, `orders`, `blockedDates`, `siteConfig`, `gemini`, and a general `api` router for health/uploads.
- **Auth middleware** (`server/middleware/auth.ts`) validates JWTs and gates protected routes.
- **Rate limits**: Global 300 req/min on `/api/`, 10 req/min on `/api/gemini/`, 10 attempts per 15 min on auth endpoints.
- **Email** (`server/services/emailService.ts`) uses Resend; falls back to a mock/log mode if `RESEND_API_KEY` is absent.

### Database (`prisma/`)

- ORM: Prisma 6 with SQLite in development (`DATABASE_URL=file:./dev.db`), PostgreSQL-compatible for production.
- Schema models: `Machine`, `Category`, `BlockedDate`, `Order`, `Customer`, `Admin`, `SiteConfig`, `Notification`.
- Use `prisma db push` (not `migrate`) during development to avoid migration files.

## Key Conventions

- **Language**: The entire UI is Dutch. Error messages from the server are also in Dutch (e.g., rate-limit messages use `"Te veel verzoeken"`).
- **TypeScript**: Strict mode, ES2022 target, path alias `@/*` maps to `src/*`.
- **No ESLint** is configured — `npm run lint` only runs `tsc --noEmit`.
- **No `vitest.config.ts`** — Vitest runs with defaults; test files live in `src/__tests__/`.
- **File naming**: React components in PascalCase, utilities and server files in camelCase.
- **CORS**: In production, only `huurgo.nl` and `www.huurgo.nl` are whitelisted. Do not add origins without updating `server.ts`.

## Environment Variables

Copy `.env.example` to `.env`. Required at runtime:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) or `postgresql://...` |
| `JWT_SECRET` | Secret for signing tokens |
| `GEMINI_API_KEY` | Google Gemini AI advisor (optional; disables AI feature if absent) |
| `RESEND_API_KEY` | Transactional email (optional; uses mock fallback) |
| `VITE_WHATSAPP_NUMBER` | WhatsApp fallback contact (format: `31612345678`, no `+`) |
| `APP_URL` | Production base URL |
