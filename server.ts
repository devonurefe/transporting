import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { apiRouter } from "./server/routes/api.js";
import { authRouter } from "./server/routes/auth.js";
import { prisma } from "./prisma/client.js";
import { emailService } from "./server/services/emailService.js";
import { authenticateToken } from "./server/middleware/auth.js";
import { requestLogger } from "./server/middleware/logger.js";
import { errorHandler } from "./server/middleware/errorHandler.js";
import { validateEnvironment } from "./server/utils/env.js";
import { SERVICE_CITIES, getCityBySlug } from "./src/data/serviceCities.js";
import { FAQ_ITEMS } from "./src/data/faq.js";

dotenv.config();
validateEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);

const isProd = process.env.NODE_ENV === "production";
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.clarity.ms", "https://*.clarity.ms"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
// Environment-aware CORS: restrict origins in production
// APP_URL env var drives the allowed origin (e.g. "https://mybooking.nl")
const prodOrigins = (() => {
  const raw = (process.env.APP_URL || "https://huurgo.nl").replace(/\/$/, "");
  const domain = raw.replace(/^https?:\/\/(www\.)?/, "");
  return [`https://${domain}`, `https://www.${domain}`];
})();
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: prodOrigins, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));

// Request logger for observability
app.use(requestLogger);

// Rate limiting: max 300 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Te veel verzoeken van dit IP. Probeer het later opnieuw." }
});
app.use("/api/", limiter);

// Stricter rate limit for Auth endpoints (10 requests per 15 minutes to protect against brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Te veel inlogpogingen. Probeer het over 15 minuten opnieuw." }
});
app.use("/api/auth", authLimiter);

app.use(express.json({ limit: "256kb" })); // Default for all API routes
// Image upload endpoints override with a higher limit in their handler via a per-route middleware
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(authenticateToken);

// Mount Modular API routers
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Global Error Handler Middleware
app.use(errorHandler);

// SEO: robots.txt
app.get("/robots.txt", (_req, res) => {
  const base = (process.env.APP_URL || "https://huurgo.nl").replace(/\/$/, "");
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`
  );
});

// SEO: sitemap.xml — static routes + one indexable URL per active machine
app.get("/sitemap.xml", async (_req, res) => {
  const base = (process.env.APP_URL || "https://huurgo.nl").replace(/\/$/, "");
  const lastmod = new Date().toISOString().split("T")[0];
  const urls: { loc: string; priority: string; changefreq: string }[] = [
    { loc: `${base}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${base}/catalog`, priority: "0.9", changefreq: "daily" },
    { loc: `${base}/booking`, priority: "0.8", changefreq: "weekly" },
    { loc: `${base}/veelgestelde-vragen`, priority: "0.7", changefreq: "monthly" },
    { loc: `${base}/catalog?category=schaarlift`, priority: "0.85", changefreq: "daily" },
    { loc: `${base}/catalog?category=spin`, priority: "0.85", changefreq: "daily" },
    { loc: `${base}/catalog?category=aanhanger`, priority: "0.80", changefreq: "daily" },
    { loc: `${base}/catalog?category=mastlift`, priority: "0.80", changefreq: "daily" },
    { loc: `${base}/catalog?category=ladderlift`, priority: "0.80", changefreq: "daily" },
    { loc: `${base}/catalog?category=ecolift`, priority: "0.75", changefreq: "weekly" },
    { loc: `${base}/catalog?category=kamersteiger`, priority: "0.75", changefreq: "weekly" },
  ];
  // Local-SEO city landing pages
  for (const c of SERVICE_CITIES) {
    urls.push({ loc: `${base}/hoogwerker-huren/${c.slug}`, priority: "0.8", changefreq: "monthly" });
  }
  try {
    const machines = await prisma.machine.findMany({ where: { isActive: true }, select: { id: true } });
    for (const m of machines) {
      urls.push({ loc: `${base}/hoogwerker/${encodeURIComponent(m.id)}`, priority: "0.7", changefreq: "weekly" });
    }
  } catch (e) {
    console.error("Sitemap machine fetch failed:", e);
  }
  const urlset = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    )
    .join("\n");
  res
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>`);
});

// ── SEO meta injection (prod) ───────────────────────────────────────────────
// The app is a client-rendered SPA, so the static index.html ships generic
// homepage meta. Social scrapers (WhatsApp/Facebook/LinkedIn) don't run JS and
// Google indexes faster with correct server HTML, so we inject per-route meta
// (and a Product JSON-LD for machine pages) into the served HTML.
const SEO_BASE = (process.env.APP_URL || "https://huurgo.nl").replace(/\/$/, "");
const DEFAULT_OG_IMAGE = `${SEO_BASE}/og-image.jpg`;

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type RouteMeta = { title: string; description: string; canonical: string; ogImage: string; noindex?: boolean; jsonLd?: string };

function absoluteImage(url: string | null | undefined): string {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) return `${SEO_BASE}${url}`;
  return DEFAULT_OG_IMAGE;
}

function staticMeta(pathname: string): RouteMeta {
  const url = `${SEO_BASE}${pathname === "/" ? "/" : pathname}`;
  const map: Record<string, { title: string; description: string; noindex?: boolean }> = {
    "/": { title: "huurgo — Hoogwerkers Huren | Snel & Eenvoudig", description: "Snel en eenvoudig hoogwerkers huren bij huurgo. Speciaal voor ZZP'ers en particulieren. Zonder borg, direct online geregeld." },
    "/catalog": { title: "Catalogus — Hoogwerkers & Schaarliften Huren | huurgo", description: "Bekijk ons aanbod hoogwerkers, schaarliften, spinhoogwerkers, mastliften en ladderliften. Direct online reserveren, zonder borg." },
    "/booking": { title: "Online Reserveren — Snel & Eenvoudig | huurgo", description: "Reserveer uw hoogwerker in 3 stappen. Kies uw data, ontvang direct de prijs en bevestig via WhatsApp met iDEAL betaallink." },
    "/veelgestelde-vragen": { title: "Veelgestelde vragen — Hoogwerker huren | huurgo", description: "Antwoorden op veelgestelde vragen over hoogwerker huren: kosten, bezorging, borg, certificaten en betaling. Persoonlijk advies via WhatsApp." },
    "/orders": { title: "Mijn Reserveringen | huurgo", description: "Beheer uw huurcontracten, volg de status en download facturen.", noindex: true },
    "/admin": { title: "Beheer | huurgo", description: "Beheeromgeving.", noindex: true },
  };
  const e = map[pathname] ?? map["/"];
  const meta: RouteMeta = { title: e.title, description: e.description, canonical: url, ogImage: DEFAULT_OG_IMAGE, noindex: e.noindex };
  if (pathname === "/veelgestelde-vragen") {
    meta.jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": { "@type": "Answer", "text": item.a },
      })),
    });
  }
  return meta;
}

function cityMeta(slug: string): RouteMeta | null {
  const city = getCityBySlug(slug);
  if (!city) return null;
  const url = `${SEO_BASE}/hoogwerker-huren/${city.slug}`;
  const title = `Hoogwerker huren in ${city.name} | huurgo`;
  const description = city.intro.replace(/\s+/g, " ").trim().slice(0, 160);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "Hoogwerker verhuur",
    "name": `Hoogwerker huren in ${city.name}`,
    "description": description,
    "areaServed": { "@type": "City", "name": city.name },
    "provider": {
      "@type": "LocalBusiness",
      "name": "huurgo — MB Hoogwerkers B.V.",
      "telephone": "+31715428114",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Produktieweg 20",
        "postalCode": "2382 PB",
        "addressLocality": "Zoeterwoude",
        "addressCountry": "NL",
      },
      "url": SEO_BASE,
    },
    "url": url,
  });
  return { title, description, canonical: url, ogImage: DEFAULT_OG_IMAGE, jsonLd };
}

async function machineMeta(id: string): Promise<RouteMeta | null> {
  try {
    const m: any = await prisma.machine.findUnique({ where: { id } });
    if (!m || m.isActive === false) return null;
    const url = `${SEO_BASE}/hoogwerker/${encodeURIComponent(id)}`;
    const priceTxt = m.pricePerDay ? ` — v.a. €${Math.round(m.pricePerDay)} p/dag` : "";
    const title = `${m.name} huren${priceTxt} | huurgo`;
    const description = (m.description ? String(m.description).replace(/\s+/g, " ").trim().slice(0, 155)
      : `${m.name} huren bij huurgo. Werkhoogte ${m.height}m. Direct online reserveren, zonder borg, snel geleverd in Zuid-Holland.`);
    const ogImage = absoluteImage(m.imageUrl);
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": m.name,
      "description": description,
      "image": ogImage,
      "category": m.categoryLabel || m.category,
      "brand": { "@type": "Brand", "name": "huurgo" },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "EUR",
        "price": String(Math.round(m.pricePerDay || 0)),
        "availability": "https://schema.org/InStock",
        "url": url,
        "priceValidUntil": new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().split("T")[0],
      },
    });
    return { title, description, canonical: url, ogImage, jsonLd };
  } catch (e) {
    console.error("machineMeta failed:", e);
    return null;
  }
}

function injectMeta(html: string, meta: RouteMeta): string {
  let out = html;
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const c = escapeHtml(meta.canonical);
  const img = escapeHtml(meta.ogImage);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`);
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`);
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`);
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${c}$2`);
  out = out.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${img}$2`);
  out = out.replace(/(<meta property="twitter:title" content=")[^"]*(")/, `$1${t}$2`);
  out = out.replace(/(<meta property="twitter:description" content=")[^"]*(")/, `$1${d}$2`);
  out = out.replace(/(<meta property="twitter:image" content=")[^"]*(")/, `$1${img}$2`);
  out = out.replace(/(<meta property="twitter:url" content=")[^"]*(")/, `$1${c}$2`);
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${c}$2`);
  if (meta.noindex) {
    out = out.replace(/(<meta name="robots" content=")[^"]*(")/, `$1noindex, nofollow$2`);
  }
  if (meta.jsonLd) {
    out = out.replace("</head>", `    <script type="application/ld+json">${meta.jsonLd}</script>\n  </head>`);
  }
  return out;
}

async function metaForRequest(pathname: string): Promise<RouteMeta> {
  const machineMatch = pathname.match(/^\/hoogwerker\/([^/]+)\/?$/);
  if (machineMatch) {
    const meta = await machineMeta(decodeURIComponent(machineMatch[1]));
    if (meta) return meta;
    return { title: "Niet gevonden | huurgo", description: "Deze machine is niet gevonden.", canonical: `${SEO_BASE}${pathname}`, ogImage: DEFAULT_OG_IMAGE, noindex: true };
  }
  const cityMatch = pathname.match(/^\/hoogwerker-huren\/([^/]+)\/?$/);
  if (cityMatch) {
    const meta = cityMeta(decodeURIComponent(cityMatch[1]));
    if (meta) return meta;
    return { title: "Plaats niet gevonden | huurgo", description: "Wij bezorgen in heel Zuid-Holland.", canonical: `${SEO_BASE}${pathname}`, ogImage: DEFAULT_OG_IMAGE, noindex: true };
  }
  return staticMeta(pathname);
}

// Configure Vite integration for SPA fallback
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production build from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    // Vite hashes asset filenames, so /assets can be cached forever;
    // index.html must always revalidate to pick up new deploys
    app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "1y", immutable: true }));
    app.use("/images", express.static(path.join(distPath, "images"), { maxAge: "7d" }));
    app.use(express.static(distPath, { maxAge: "1h", index: false }));
    const indexPath = path.join(distPath, "index.html");
    let INDEX_HTML = "";
    try { INDEX_HTML = fs.readFileSync(indexPath, "utf-8"); } catch { /* fall back to sendFile */ }
    app.get("*", async (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      if (!INDEX_HTML) return res.sendFile(indexPath);
      try {
        const meta = await metaForRequest(req.path);
        res.type("html").send(injectMeta(INDEX_HTML, meta));
      } catch (e) {
        console.error("Meta injection failed:", e);
        res.type("html").send(INDEX_HTML);
      }
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 huurgo Server Running on http://localhost:${PORT}`);
    console.log(`📦 Serving full-stack React SPA`);
    console.log(`======================================================`);

    // Diagnostics checks
    console.log(`\n🩺 [DIAGNOSTICS] Auditing environment parameters...`);
    
    // JWT Secret Check
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === "dev-only-huurgo-jwt-secret") {
      console.log(`⚠️  [JWT_SECRET]: USING DEVELOPMENT DEFAULT KEY. Please set a secure key in production.`);
    } else {
      console.log(`✅ [JWT_SECRET]: Configured securely.`);
    }

    // Resend API Key Check
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || resendKey === "MY_RESEND_API_KEY" || resendKey === "") {
      console.log(`⚠️  [RESEND_API_KEY]: UNCONFIGURED. Transactional emails will log in mock simulation mode.`);
    } else {
      console.log(`✅ [RESEND_API_KEY]: Configured successfully.`);
    }

    console.log(`======================================================\n`);

    // Daily rental reminder scheduler — fires at 07:00 server time each day
    scheduleDailyReminders();
  });

  // Graceful shutdown: let in-flight requests finish before Render recycles the instance
  const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received — closing server gracefully...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => {
      console.error("Forced shutdown after 30s timeout");
      process.exit(1);
    }, 30_000).unref();
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

function scheduleDailyReminders() {
  // Last-sent date persisted in InvoiceCounter (lastNumber = YYYYMMDD): a restart
  // around 07:00 neither skips that day's reminders nor sends them twice
  const REMINDER_MARKER = "daily-reminders-last";
  const todayStamp = () => Number(new Date().toISOString().split("T")[0].replace(/-/g, ""));

  const sendBatch = async () => {
    try {
      const stamp = todayStamp();
      const marker = await prisma.invoiceCounter.findUnique({ where: { id: REMINDER_MARKER } });
      if (marker?.lastNumber === stamp) {
        console.log("[Reminders] Already sent today — skipping.");
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        const tomorrowStart = new Date(tomorrowStr + "T00:00:00.000Z");
        const tomorrowEnd = new Date(tomorrowStr + "T23:59:59.999Z");

        const orders = await prisma.order.findMany({
          where: {
            startDate: { gte: tomorrowStart, lte: tomorrowEnd },
            status: { in: ["Goedgekeurd", "Onderweg"] }
          }
        });

        let sent = 0;
        for (const order of orders) {
          const ok = await emailService.sendRentalReminder({
            ...order,
            startDate: order.startDate.toISOString().split("T")[0],
            endDate: order.endDate.toISOString().split("T")[0],
            customerPhone: order.customerPhone || ""
          });
          if (ok) sent++;
        }

        await prisma.invoiceCounter.upsert({
          where: { id: REMINDER_MARKER },
          create: { id: REMINDER_MARKER, lastNumber: stamp },
          update: { lastNumber: stamp }
        });

        if (orders.length > 0) {
          console.log(`[Reminders] Sent ${sent}/${orders.length} reminders for ${tomorrowStr}`);
        }
      }
    } catch (err) {
      console.error("[Reminders] Failed to send daily reminders:", err);
    }
  };

  const fireReminders = async () => {
    await sendBatch();
    // Schedule next run in 24 hours
    setTimeout(fireReminders, 24 * 60 * 60 * 1000);
  };

  // First fire: calculate ms until 07:00 today/tomorrow
  const now = new Date();
  const next7am = new Date(now);
  next7am.setUTCHours(7, 0, 0, 0);  // 07:00 UTC = 08:00 Amsterdam (winter) / 09:00 (summer)
  if (next7am <= now) next7am.setUTCDate(next7am.getUTCDate() + 1);
  const msUntil7am = next7am.getTime() - now.getTime();

  setTimeout(fireReminders, msUntil7am);
  console.log(`[Reminders] Scheduler armed — first run in ${Math.round(msUntil7am / 60000)} minutes`);

  // Catch-up: if the server (re)started after 07:00 and today's batch wasn't
  // sent yet (deploy/restart during the window), send it now
  if (now.getUTCHours() >= 7) {
    prisma.invoiceCounter.findUnique({ where: { id: REMINDER_MARKER } }).then(marker => {
      if (marker?.lastNumber !== todayStamp()) {
        console.log("[Reminders] Missed 07:00 run detected — sending catch-up batch...");
        sendBatch();
      }
    }).catch(() => {});
  }
}

async function autoSeedIfEmpty() {
  try {
    const machineCount = await prisma.machine.count();
    if (machineCount > 0) return; // DB already has data

    console.log("[AutoSeed] Database appears empty — running initial seed...");
    const { execSync } = await import("child_process");
    execSync("npx prisma db seed", { stdio: "inherit" });
    console.log("[AutoSeed] Initial seed complete.");
  } catch (err) {
    console.warn("[AutoSeed] Could not auto-seed:", err instanceof Error ? err.message : err);
  }
}

async function applyDataMigrations() {
  try {
    const ecoliftMachine = await prisma.machine.findUnique({ where: { id: "ecolift" } });
    if (ecoliftMachine && ecoliftMachine.name === "JLG Ecolift Low-Level Access") {
      await prisma.machine.update({
        where: { id: "ecolift" },
        data: {
          name: "Pecolift Low-Level Access",
          categoryLabel: "Pecolift",
          imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
          imageAlt: "Pecolift handmatig lage toegangsplatform",
        }
      });
      console.log("[Migration] Renamed Ecolift → Pecolift.");
    }
    const ecoliftCat = await prisma.category.findUnique({ where: { id: "ecolift" } });
    if (ecoliftCat && ecoliftCat.label === "Ecolift") {
      await prisma.category.update({
        where: { id: "ecolift" },
        data: { label: "Pecolift", listLabel: "Pecolift" }
      });
      console.log("[Migration] Updated ecolift category label → Pecolift.");
    }

    // Fix German spelling "Kompakte" → Dutch "Compacte" on the 6m scissor lift.
    // Idempotent: each updateMany only matches the old (stale) values.
    const catLabelFix = await prisma.category.updateMany({
      where: { id: "schaarlift-6m", label: "Kompakte Schaarlift (6m)" },
      data: { label: "Compacte Schaarlift (6m)" }
    });
    await prisma.category.updateMany({
      where: { id: "schaarlift-6m", desc: { startsWith: "Kompakte" } },
      data: { desc: "Compacte elektrische schaarlift voor snel en veilig werken op 6 meter. Past door standaard binnendeuren." }
    });
    const machLabelFix = await prisma.machine.updateMany({
      where: { categoryLabel: "Kompakte Schaarlift (6m)" },
      data: { categoryLabel: "Compacte Schaarlift (6m)" }
    });
    if (catLabelFix.count > 0 || machLabelFix.count > 0) {
      console.log("[Migration] Corrected 'Kompakte' → 'Compacte' on 6m scissor lift.");
    }

    // One-time: assign official fleet photos to all machines (marker row in
    // InvoiceCounter so admin image changes are never overwritten afterwards)
    const FLEET_PHOTOS_MIGRATION = "migration-fleet-photos-2026-06";
    const photosDone = await prisma.invoiceCounter.findUnique({ where: { id: FLEET_PHOTOS_MIGRATION } });
    if (!photosDone) {
      const fleetMachineIds = [
        "nifty-120-1", "nifty-120-2", "nifty-120-3", "nifty-170",
        "hinowa-15-70", "hinowa-17-75",
        "optimum-8-1", "optimum-8-2", "compact-8-1", "compact-8-2",
        "compact-10n-1", "compact-10n-2", "dingli-6m",
        "altrex-rs44", "star-10", "skyjack-sj16", "bravi-mini-hd", "jlg-1230es",
        "ladderlift-18", "ladderlift-21-1", "ladderlift-21-2", "ecolift",
      ];
      for (const machineId of fleetMachineIds) {
        await prisma.machine.updateMany({
          where: { id: machineId },
          data: { imageUrl: `/images/machines/${machineId}.webp` }
        });
      }
      await prisma.invoiceCounter.create({ data: { id: FLEET_PHOTOS_MIGRATION, lastNumber: 1 } });
      console.log("[Migration] Official fleet photos assigned to all machines.");
    }

    // Seed the reminder marker on first deploy of the idempotent scheduler so the
    // catch-up logic doesn't re-send a batch the old code already sent at 07:00
    const reminderMarker = await prisma.invoiceCounter.findUnique({ where: { id: "daily-reminders-last" } });
    if (!reminderMarker) {
      const stamp = Number(new Date().toISOString().split("T")[0].replace(/-/g, ""));
      await prisma.invoiceCounter.create({ data: { id: "daily-reminders-last", lastNumber: stamp } });
    }

    // Restore missing fleet photos: only update machines whose imageUrl is empty
    // (admin-set non-empty imageUrls are never touched)
    const FLEET_RESTORE = "migration-fleet-photos-restore-2026-06";
    const restoreDone = await prisma.invoiceCounter.findUnique({ where: { id: FLEET_RESTORE } });
    if (!restoreDone) {
      const knownImages: Record<string, string> = {
        "nifty-120-1": "/images/machines/nifty-120-1.webp",
        "nifty-120-2": "/images/machines/nifty-120-2.webp",
        "nifty-120-3": "/images/machines/nifty-120-3.webp",
        "nifty-170":   "/images/machines/nifty-170.webp",
        "hinowa-15-70": "/images/machines/hinowa-15-70.webp",
        "hinowa-17-75": "/images/machines/hinowa-17-75.webp",
        "optimum-8-1": "/images/machines/optimum-8-1.webp",
        "optimum-8-2": "/images/machines/optimum-8-2.webp",
        "compact-8-1": "/images/machines/compact-8-1.webp",
        "compact-8-2": "/images/machines/compact-8-2.webp",
        "compact-10n-1": "/images/machines/compact-10n-1.webp",
        "compact-10n-2": "/images/machines/compact-10n-2.webp",
        "dingli-6m":   "/images/machines/dingli-6m.webp",
        "altrex-rs44": "/images/machines/altrex-rs44.webp",
        "star-10":     "/images/machines/star-10.webp",
        "skyjack-sj16": "/images/machines/skyjack-sj16.webp",
        "bravi-mini-hd": "/images/machines/bravi-mini-hd.webp",
        "jlg-1230es":  "/images/machines/jlg-1230es.webp",
        "ladderlift-18": "/images/machines/ladderlift-18.webp",
        "ladderlift-21-1": "/images/machines/ladderlift-21-1.webp",
        "ladderlift-21-2": "/images/machines/ladderlift-21-2.webp",
        "ecolift":     "/images/machines/ecolift.webp",
      };
      let restored = 0;
      for (const [id, url] of Object.entries(knownImages)) {
        const r = await prisma.machine.updateMany({ where: { id, imageUrl: "" }, data: { imageUrl: url } });
        restored += r.count;
      }
      await prisma.invoiceCounter.create({ data: { id: FLEET_RESTORE, lastNumber: restored } });
      if (restored > 0) console.log(`[Migration] Restored ${restored} empty machine image URLs.`);
    }

    // One-time fix: stale heroSubtitle from old AI-advisor era — idempotent, runs once per deploy
    const staleSubtitleConfig = await prisma.siteConfig.findFirst({
      where: {
        OR: [
          { heroSubtitle: { contains: "AI-assistent" } },
          { heroSubtitle: { contains: "AI assistant" } },
          { heroSubtitle: { contains: "MB Hoogwerkers" } },
          { heroSubtitle: { contains: "door heel Nederland" } },
        ]
      }
    });
    if (staleSubtitleConfig) {
      const CORRECT_SUBTITLE = "HuurGo verhuurt gecertificeerde hoogwerkers, schaarliften, mastliften en ladderliften aan ZZP'ers, aannemers en particulieren in heel Nederland. Meer dan 50 BMWT-gecertificeerde machines, direct beschikbaar.";
      await prisma.siteConfig.update({ where: { id: "default" }, data: { heroSubtitle: CORRECT_SUBTITLE } });
      console.log("[Migration] Fixed stale heroSubtitle.");
    }

    // Loud warning if the admin account still uses the old seeded default password
    const seededAdmin = await prisma.admin.findUnique({ where: { email: "admin@huurgo.nl" } });
    if (seededAdmin) {
      const bcrypt = (await import("bcryptjs")).default;
      if (await bcrypt.compare("admin123", seededAdmin.passwordHash)) {
        console.error("🚨 [SECURITY] Admin account admin@huurgo.nl still uses the default password 'admin123'!");
        console.error("🚨 [SECURITY] Change it immediately via the admin panel (Wachtwoord wijzigen).");
      }
    }
  } catch (err) {
    console.warn("[Migration] Could not apply data migrations:", err instanceof Error ? err.message : err);
  }
}

autoSeedIfEmpty().then(() => applyDataMigrations()).then(() => startServer()).catch(err => {
  console.error("Failed to start server:", err);
});
