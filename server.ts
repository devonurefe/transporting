import express from "express";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import compression from "compression";
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

// Attach a unique request ID to every response for log correlation and support debugging
app.use((_req, res, next) => {
  res.setHeader("X-Request-ID", randomBytes(8).toString("hex"));
  next();
});

const isProd = process.env.NODE_ENV === "production";
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.clarity.ms", "https://*.clarity.ms"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
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
// Gzip/deflate responses. Nginx also gzips in prod, but compressing at the app
// layer guarantees it for direct :3000 access and dev, and shrinks the JSON API
// payloads (machines/site-config) that carry base64 image + text data.
app.use(compression());
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

// The iCal feed leaks customer PII (name/phone/address) to anyone holding the
// token, so it gets a tighter limit than the general /api/ allowance.
const calendarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: "Te veel verzoeken van dit IP. Probeer het later opnieuw." }
});
app.use("/api/calendar", calendarLimiter);

// These endpoints carry base64 image payloads — must be registered before the global 256kb parser
app.use("/api/upload",      express.json({ limit: "10mb" }));
app.use("/api/machines",    express.json({ limit: "10mb" })); // PUT with base64 imageUrl
app.use("/api/site-config", express.json({ limit: "10mb" })); // may store base64 hero image
app.use(express.json({ limit: "256kb" })); // Default for all other API routes
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(authenticateToken);

// Mount Modular API routers
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Global Error Handler Middleware
app.use(errorHandler);

// Resolve a stored image URL to an HTTP response: decode base64 data: URLs to
// real binary (cacheable, ~25% smaller than base64 text), redirect file/http
// paths, and fall back to the OG image. Shared by the main + gallery proxies.
function serveStoredImage(res: express.Response, url: string | null | undefined) {
  if (!url) return res.redirect(DEFAULT_OG_IMAGE);
  if (url.startsWith("data:image/")) {
    const commaIdx = url.indexOf(",");
    if (commaIdx < 0) return res.redirect(DEFAULT_OG_IMAGE);
    const mimeMatch = url.slice(0, commaIdx).match(/data:([^;]+);base64/);
    if (!mimeMatch) return res.redirect(DEFAULT_OG_IMAGE);
    const buf = Buffer.from(url.slice(commaIdx + 1), "base64");
    res.setHeader("Content-Type", mimeMatch[1]);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(buf);
  }
  if (url.startsWith("/")) return res.redirect(url);
  if (/^https?:\/\//.test(url)) return res.redirect(url);
  return res.redirect(DEFAULT_OG_IMAGE);
}

// Serve machine main image by ID — needed so base64-stored photos can appear
// in og:image meta tags (social crawlers require a real URL, not a data: URI),
// and so the public catalog can load images as binary instead of inline base64.
app.get("/machine-image/:id", async (req, res) => {
  try {
    const m = await prisma.machine.findUnique({ where: { id: req.params.id }, select: { imageUrl: true } });
    return serveStoredImage(res, m?.imageUrl);
  } catch {
    return res.redirect(DEFAULT_OG_IMAGE);
  }
});

// Serve a machine gallery (additionalImages) photo by index, so the public
// catalog/detail modal loads gallery images as binary instead of inline base64.
app.get("/machine-image/:id/gallery/:idx", async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) return res.redirect(DEFAULT_OG_IMAGE);
    const m = await prisma.machine.findUnique({ where: { id: req.params.id }, select: { additionalImages: true } });
    const gallery = Array.isArray(m?.additionalImages) ? (m!.additionalImages as unknown[]) : [];
    const url = typeof gallery[idx] === "string" ? (gallery[idx] as string) : null;
    return serveStoredImage(res, url);
  } catch {
    return res.redirect(DEFAULT_OG_IMAGE);
  }
});

// Serve the admin-configured hero image (SiteConfig.heroImageUrl) as binary, so
// the public site-config feed stays small and the LCP hero loads as a cacheable
// image instead of a ~500 KB base64 string embedded in the JSON.
app.get("/site-hero-image", async (_req, res) => {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: "default" }, select: { heroImageUrl: true } });
    return serveStoredImage(res, cfg?.heroImageUrl);
  } catch {
    return res.redirect(DEFAULT_OG_IMAGE);
  }
});

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
const DEFAULT_OG_IMAGE = `${SEO_BASE}/og-image.png`;

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type RouteMeta = { title: string; description: string; canonical: string; ogImage: string; noindex?: boolean; jsonLd?: string; heroPreload?: string };

function absoluteImage(url: string | null | undefined, machineId?: string): string {
  if (!url) return DEFAULT_OG_IMAGE;
  if (url.startsWith("data:image/") && machineId) return `${SEO_BASE}/machine-image/${encodeURIComponent(machineId)}`;
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
    const ogImage = absoluteImage(m.imageUrl, id);
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
  if (meta.heroPreload) {
    // Preload the actual LCP hero (admin /site-hero-image or the default WebP) at
    // HTML parse — removes the site-config-fetch -> render -> image-fetch chain.
    out = out.replace("</head>", `    <link rel="preload" as="image" fetchpriority="high" href="${escapeHtml(meta.heroPreload)}" />\n  </head>`);
  }
  return out;
}

// The homepage LCP is the hero image. Resolve which URL will actually render so we
// can preload it — mirrors the /site-hero-image substitution in siteConfig.ts and
// the fallback in HomeSection.tsx. Cheap single-column read; falls back on error.
async function heroPreloadUrl(): Promise<string> {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: "default" }, select: { heroImageUrl: true } });
    const h = cfg?.heroImageUrl;
    if (!h) return "/hero-huurgo-v2.webp";
    if (h.startsWith("data:image/")) return "/site-hero-image";
    return h; // external URL or local /path already efficient
  } catch {
    return "/hero-huurgo-v2.webp";
  }
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
  const meta = staticMeta(pathname);
  if (pathname === "/") {
    meta.heroPreload = await heroPreloadUrl();
  }
  return meta;
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
    app.use(express.static(distPath, {
      maxAge: "30d",
      index: false,
      // Root static (hero image, og-image, favicons, fonts) can cache for weeks.
      // The service worker must always revalidate so clients pick up new deploys.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("sw.js") || filePath.endsWith("service-worker.js")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    }));
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
    
    // JWT Secret Check — moet de dev-fallback in server/utils/auth.ts spiegelen
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === "dev-only-huurgo-jwt-secret-do-not-use-in-prod") {
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

  // Returns ms until the next 07:00 Amsterdam time (handles CET/CEST DST automatically)
  const msUntilAmsterdam7am = (): number => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(now);
    const getNum = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    const secondsSinceTarget = (getNum("hour") - 7) * 3600 + getNum("minute") * 60 + getNum("second");
    return (secondsSinceTarget <= 0 ? -secondsSinceTarget : 86400 - secondsSinceTarget) * 1000;
  };

  const amsterdamHour = (): number =>
    Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false
    }).format(new Date()));

  // In-memory mutex: prevents two concurrent sendBatch calls (e.g. scheduled + catch-up overlap)
  let reminderRunning = false;

  const sendBatch = async () => {
    if (reminderRunning) { console.log("[Reminders] Already running — skipping concurrent call."); return; }
    reminderRunning = true;
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
    } finally {
      reminderRunning = false;
    }
  };

  const fireReminders = async () => {
    await sendBatch();
    // Schedule next run at the next 07:00 Amsterdam time
    setTimeout(fireReminders, msUntilAmsterdam7am() + 60_000); // +60s buffer past the hour
  };

  const msUntil7am = msUntilAmsterdam7am();
  setTimeout(fireReminders, msUntil7am);
  console.log(`[Reminders] Scheduler armed — first run in ${Math.round(msUntil7am / 60000)} minutes (07:00 Amsterdam)`);

  // Catch-up: if the server (re)started after 07:00 Amsterdam and today's batch wasn't sent yet
  if (amsterdamHour() >= 7) {
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

    // Altrex RS44: ensure weeklyOnly=false and minRentalDays=2. Unconditional check so that
    // any wrong value (weeklyOnly=true, minRentalDays=null/7/anything≠2) gets corrected.
    const rs44 = await prisma.machine.findUnique({ where: { id: "altrex-rs44" } });
    if (rs44) {
      const needsFix = (rs44 as any).weeklyOnly === true || (rs44 as any).minRentalDays !== 2;
      if (needsFix) {
        const data: Record<string, unknown> = { minRentalDays: 2 };
        if ((rs44 as any).weeklyOnly === true) {
          data.weeklyOnly = false;
          data.twoDayPrice = 15;
          data.oneDayPrice = null;
        }
        await prisma.machine.update({ where: { id: "altrex-rs44" }, data });
        console.log(`[Migration] RS44: fixed (weeklyOnly=${(rs44 as any).weeklyOnly}, minRentalDays=${(rs44 as any).minRentalDays} → 2).`);
      }
    }

    // One-time: set showInWeeklyOffers — only the 3 featured machines get true,
    // all others get false. Admin can override per machine afterwards.
    const WEEKLY_OFFERS_MIGRATION = "migration-weekly-offers-2026-06";
    const weeklyOffersDone = await prisma.invoiceCounter.findUnique({ where: { id: WEEKLY_OFFERS_MIGRATION } });
    if (!weeklyOffersDone) {
      const featuredIds = ["nifty-170", "nifty-120-1", "nifty-120-2", "nifty-120-3", "compact-10n-1", "compact-10n-2"];
      await prisma.machine.updateMany({ where: { id: { in: featuredIds } }, data: { showInWeeklyOffers: true } });
      await prisma.machine.updateMany({ where: { id: { notIn: featuredIds } }, data: { showInWeeklyOffers: false } });
      await prisma.invoiceCounter.create({ data: { id: WEEKLY_OFFERS_MIGRATION, lastNumber: 1 } });
      console.log("[Migration] Weekaanbiedingen: 3 featured machines set, rest cleared.");
    }

    // Corrective: v1 migration set 6 machines (all unit variants); reduce to exactly
    // 1 Nifty 170, 1 Nifty 120 (unit 1), and 1 Compact 10N (unit 1).
    const WEEKLY_OFFERS_V2 = "migration-weekly-offers-v2-2026-07";
    const v2Done = await prisma.invoiceCounter.findUnique({ where: { id: WEEKLY_OFFERS_V2 } });
    if (!v2Done) {
      const exactThree = ["nifty-170", "nifty-120-1", "compact-10n-1"];
      await prisma.machine.updateMany({ where: { id: { in: exactThree } }, data: { showInWeeklyOffers: true } });
      await prisma.machine.updateMany({ where: { id: { notIn: exactThree } }, data: { showInWeeklyOffers: false } });
      await prisma.invoiceCounter.create({ data: { id: WEEKLY_OFFERS_V2, lastNumber: 1 } });
      console.log("[Migration] Weekaanbiedingen v2: exactly 3 machines set (nifty-170, nifty-120-1, compact-10n-1).");
    }

    // Seed de echte Google-reviews (van het bedrijfsprofiel, door de eigenaar
    // aangeleverd) éénmalig in de bestaande SiteConfig — alleen als er nog geen
    // reviews staan, zodat een latere admin-bewerking nooit wordt overschreven.
    const GOOGLE_REVIEWS_SEED = "migration-google-reviews-2026-07";
    const grDone = await prisma.invoiceCounter.findUnique({ where: { id: GOOGLE_REVIEWS_SEED } });
    if (!grDone) {
      const REAL_GOOGLE_REVIEWS = [
        { author: "Márton 'Martin' Nagy", rating: 5, text: "De enige plek in Nederland waar je hoogwerkers kunt huren voor een redelijke prijs zonder al te veel gedoe.", date: "3 weken geleden" },
        { author: "Fatih Soy", rating: 5, text: "Nou deze mensen hebben mij meerdere keren uit de nood geholpen, zeer vriendelijk maar los van vriendelijkheid super flexibel. Super bedankt.", date: "een maand geleden" },
        { author: "Arno van Zaanen", rating: 5, text: "Super vriendelijk, erg behulpzaam, ruime selectie, snelle service en stuk goedkoper dan andere verhuurders. Gespecialiseerd in hoogwerkers.", date: "een week geleden" },
        { author: "Uzair Guman", rating: 5, text: "Mustafa is een zeer behulpzame en vriendelijke ondernemer!", date: "een week geleden" },
        { author: "Elías", rating: 5, text: "Hele vriendelijke gasten. Mooie prijzen, aanrader!", date: "2 weken geleden" },
        { author: "Robbert Plarina", rating: 5, text: "Fijne service en uitleg. Scherpe tarieven. Je huurt een hoogwerker bijna voor de prijs van een xl ladder. Materiaal prima in orde.", date: "een maand geleden" },
        { author: "Alikagan Telek", rating: 5, text: "Topbedrijf met nette en goed onderhouden machines. Alles werkte perfect en de service was snel en betrouwbaar. Aanrader!", date: "een maand geleden" },
        { author: "Dichter Robert", rating: 5, text: "Snel leveren en vriendelijke medewerker.", date: "een maand geleden" },
        { author: "", rating: 5, text: "Top service, zeker een aanrader.", date: "2 weken geleden" },
      ];
      const cfg = await prisma.siteConfig.findUnique({ where: { id: "default" } });
      const existing = (cfg as any)?.googleReviews;
      const hasReviews = Array.isArray(existing) && existing.length > 0;
      // SiteConfig bestaat altijd (autoSeed draaide hiervoor). Alleen aanvullen
      // als er nog geen reviews staan, zodat admin-bewerkingen blijven staan.
      if (cfg && !hasReviews) {
        await prisma.siteConfig.update({
          where: { id: "default" },
          data: {
            googleReviews: REAL_GOOGLE_REVIEWS,
            // Zet de aggregaatscore alleen als die nog niet is ingevoerd.
            ...((cfg as any).googleRating == null ? { googleRating: 5.0 } : {}),
            ...((cfg as any).googleReviewCount == null ? { googleReviewCount: 66 } : {}),
          } as any,
        });
        console.log("[Migration] Seeded 9 echte Google-reviews in SiteConfig.");
      }
      await prisma.invoiceCounter.create({ data: { id: GOOGLE_REVIEWS_SEED, lastNumber: 1 } });
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

// Export the configured Express app so integration tests (supertest) can drive
// the /api routes without opening a port. All routers/middleware are registered
// at module load above; startServer() only adds SPA/static serving + listen.
export { app };

// Skip the auto-seed/migrate/listen bootstrap when imported under Vitest — tests
// manage their own database and never need the HTTP listener.
if (!process.env.VITEST) {
  autoSeedIfEmpty().then(() => applyDataMigrations()).then(() => startServer()).catch(err => {
    console.error("Failed to start server:", err);
  });
}
