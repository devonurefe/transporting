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
      scriptSrc: ["'self'"],
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
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
}

function scheduleDailyReminders() {
  const fireReminders = async () => {
    try {
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

      if (orders.length > 0) {
        console.log(`[Reminders] Sent ${sent}/${orders.length} reminders for ${tomorrowStr}`);
      }
    } catch (err) {
      console.error("[Reminders] Failed to send daily reminders:", err);
    }

    // Schedule next run in 24 hours
    setTimeout(fireReminders, 24 * 60 * 60 * 1000);
  };

  // First fire: calculate ms until 07:00 today/tomorrow
  const now = new Date();
  const next7am = new Date(now);
  next7am.setHours(7, 0, 0, 0);
  if (next7am <= now) next7am.setDate(next7am.getDate() + 1);
  const msUntil7am = next7am.getTime() - now.getTime();

  setTimeout(fireReminders, msUntil7am);
  console.log(`[Reminders] Scheduler armed — first run in ${Math.round(msUntil7am / 60000)} minutes`);
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
  } catch (err) {
    console.warn("[Migration] Could not apply data migrations:", err instanceof Error ? err.message : err);
  }
}

autoSeedIfEmpty().then(() => applyDataMigrations()).then(() => startServer()).catch(err => {
  console.error("Failed to start server:", err);
});
