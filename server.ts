import express from "express";
import path from "path";
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
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: ["https://huurgo.nl", "https://www.huurgo.nl"], credentials: true }
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

app.use(express.json({ limit: "10mb" })); // Enable larger base64 payloads for image uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(authenticateToken);

// Mount Modular API routers
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Global Error Handler Middleware
app.use(errorHandler);

// SEO: robots.txt
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://huurgo.nl/sitemap.xml\n"
  );
});

// SEO: sitemap.xml
app.get("/sitemap.xml", (_req, res) => {
  const urls = [
    { loc: "https://huurgo.nl/", priority: "1.0", changefreq: "weekly" },
    { loc: "https://huurgo.nl/catalog", priority: "0.9", changefreq: "daily" },
    { loc: "https://huurgo.nl/booking", priority: "0.8", changefreq: "weekly" },
    { loc: "https://huurgo.nl/catalog?category=schaarlift", priority: "0.85", changefreq: "daily" },
    { loc: "https://huurgo.nl/catalog?category=spin", priority: "0.85", changefreq: "daily" },
    { loc: "https://huurgo.nl/catalog?category=aanhanger", priority: "0.80", changefreq: "daily" },
    { loc: "https://huurgo.nl/catalog?category=mastlift", priority: "0.80", changefreq: "daily" },
    { loc: "https://huurgo.nl/catalog?category=ladderlift", priority: "0.80", changefreq: "daily" },
    { loc: "https://huurgo.nl/catalog?category=ecolift", priority: "0.75", changefreq: "weekly" },
    { loc: "https://huurgo.nl/catalog?category=kamersteiger", priority: "0.75", changefreq: "weekly" },
  ];
  const urlset = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    )
    .join("\n");
  res
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>`);
});

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
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 HuurGo Server Running on http://localhost:${PORT}`);
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
