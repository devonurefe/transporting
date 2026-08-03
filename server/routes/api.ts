import { Router, json as expressJson } from "express";
import rateLimit from "express-rate-limit";
import { machinesRouter } from "./machines.js";
import { ordersRouter } from "./orders.js";
import { blockedDatesRouter } from "./blockedDates.js";
import { maintenanceRouter } from "./maintenance.js";
import { damageReportsRouter } from "./damageReports.js";
import { siteConfigRouter } from "./siteConfig.js";
import { calendarRouter } from "./calendar.js";
import { blogPostsRouter } from "./blog.js";
import { adminAuditRouter } from "./adminAudit.js";
import { adminUsersRouter } from "./admins.js";
import { webhooksRouter } from "./webhooks.js";
import { prisma } from "../../prisma/client.js";
import { requireAdmin, AuthenticatedRequest } from "../middleware/auth.js";
import { emailService, getEmailDiagnostics } from "../services/emailService.js";
import { getSecurityStatus } from "../utils/security.js";

const uploadBodyParser = expressJson({ limit: "10mb" });

export const apiRouter = Router();

// GET /api/health - Health check endpoint
apiRouter.get("/health", async (req, res) => {
  try {
    // Ping database to verify connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Databaseverbinding mislukt"
    });
  }
});

// GET /api/admin/email-status — admin-only diagnostic: is Resend actually
// configured, or silently running in mock mode (every mock-mode send logs to
// the server console and returns success to the caller, so from inside the
// app nothing looks wrong — this is the only place that surfaces the truth
// without SSH-ing into the server to read the boot-time diagnostic log).
// Booleans/safe fields only — never the API key itself.
apiRouter.get("/admin/email-status", requireAdmin as any, (req, res) => {
  res.json(getEmailDiagnostics());
});

// GET /api/admin/security-status — admin-only: controleert of het geseede
// admin-account nog het wachtwoord uit de repo gebruikt. Deze check draaide al
// bij het opstarten, maar schreef alleen een console.error; op een onbemande VPS
// leest niemand die. Hier kan het adminpaneel er een banner van maken. Levert
// alleen booleans — nooit hashes of wachtwoorden.
apiRouter.get("/admin/security-status", requireAdmin as any, async (_req, res) => {
  res.json(await getSecurityStatus());
});

// POST /api/admin/test-email — sends a real email through the exact same
// Resend client as every transactional email. Defaults to the CALLING
// admin's own address (looked up fresh from the DB), but accepts an
// optional `to` override in the body so an admin can point a test straight
// at a mailbox they can actually check right now (e.g. their own Gmail) —
// the login/account address (often on a custom domain like admin@huurgo.nl)
// may not be a real, checked mailbox even when Resend reports success,
// since a successful send only proves Resend accepted and attempted
// delivery, not that the receiving domain's mail routing works. Still
// admin-only + rate-limited, same abuse posture as the bulk campaign-email
// endpoint (auth.ts POST /campaigns/email), which already accepts arbitrary
// recipient addresses under the same guard.
const testEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Te veel testmails. Probeer het over een uur opnieuw." },
  standardHeaders: true,
  legacyHeaders: false,
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
apiRouter.post("/admin/test-email", testEmailLimiter, requireAdmin as any, async (req: AuthenticatedRequest, res) => {
  try {
    const requestedTo = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    if (requestedTo && !EMAIL_RE.test(requestedTo)) {
      return res.status(400).json({ error: "Ongeldig e-mailadres" });
    }
    let sendTo = requestedTo;
    if (!sendTo) {
      const admin = await prisma.admin.findUnique({ where: { id: req.user!.id }, select: { email: true } });
      if (!admin) return res.status(404).json({ error: "Beheerder niet gevonden" });
      sendTo = admin.email;
    }
    const result = await emailService.sendTestEmail(sendTo);
    res.json({ ...result, sentTo: sendTo });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({ error: "Testmail versturen mislukt" });
  }
});

// Mount modular sub-routers
apiRouter.use("/machines", machinesRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/blocked-dates", blockedDatesRouter);
apiRouter.use("/maintenance", maintenanceRouter);
apiRouter.use("/damage-reports", damageReportsRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/blog-posts", blogPostsRouter);
apiRouter.use("/admin/audit-logs", adminAuditRouter);
apiRouter.use("/admin/users", adminUsersRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use("/", siteConfigRouter);

import path from "path";

// POST /api/upload - Stores image as base64 data URL in the database (no disk writes = persistent across Render deploys)
const MAX_UPLOAD_SIZE_BYTES = 3 * 1024 * 1024; // 3MB limit for DB storage
// SVG deliberately excluded — it can carry scripts (stored XSS when rendered)
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif"
};

// Magic bytes per format — the decoded content must match the claimed extension
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  ".jpg": buf => buf[0] === 0xff && buf[1] === 0xd8,
  ".jpeg": buf => buf[0] === 0xff && buf[1] === 0xd8,
  ".png": buf => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  ".webp": buf => buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP",
  ".gif": buf => buf.toString("ascii", 0, 3) === "GIF",
};

apiRouter.post("/upload", uploadBodyParser, requireAdmin as any, async (req, res) => {
  const { fileName, base64Data } = req.body;
  if (!fileName || !base64Data) {
    return res.status(400).json({ error: "fileName en base64Data zijn verplicht" });
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: `Niet-ondersteund bestandstype. Toegestaan: ${ALLOWED_EXTENSIONS.join(", ")}` });
  }

  try {
    // Strip existing data URL prefix if present, then measure raw size
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const byteLength = Math.ceil(base64Content.length * 0.75); // approximate decoded size

    if (byteLength > MAX_UPLOAD_SIZE_BYTES) {
      return res.status(400).json({ error: `Bestand te groot. Maximum grootte: ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB` });
    }

    const header = Buffer.from(base64Content.slice(0, 24), "base64");
    if (header.length < 12 || !MAGIC_BYTES[ext]?.(header)) {
      return res.status(400).json({ error: "Bestandsinhoud komt niet overeen met het bestandstype" });
    }

    // Return as data URL — stored directly in the DB, survives server restarts/redeploys
    const mimeType = EXT_TO_MIME[ext] ?? "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Content}`;
    console.log(`[Upload] Image stored as data URL (${(byteLength / 1024).toFixed(1)}KB, type: ${mimeType})`);

    res.json({ success: true, url: dataUrl });
  } catch (error: any) {
    console.error("Error processing uploaded image:", error);
    res.status(500).json({ error: "Afbeelding kon niet worden verwerkt" });
  }
});

// POST /api/upload-pdf - Stores a machine datasheet PDF as base64 data URL in the
// DB, same "no disk writes" reasoning as /api/upload. Body-size limit for this
// path is registered separately in server.ts (app.use("/api/upload-pdf", ...)).
// 5MB (decoded) — datasheets are typically a few hundred KB to ~2MB. Kept well
// under the /api/machines JSON body limit (see server.ts) since the base64-encoded
// datasheetUrl travels inside the full machine payload alongside imageUrl/additionalImages.
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

apiRouter.post("/upload-pdf", requireAdmin as any, async (req, res) => {
  const { fileName, base64Data } = req.body;
  if (!fileName || !base64Data) {
    return res.status(400).json({ error: "fileName en base64Data zijn verplicht" });
  }

  const ext = path.extname(fileName).toLowerCase();
  if (ext !== ".pdf") {
    return res.status(400).json({ error: "Alleen PDF-bestanden zijn toegestaan." });
  }

  try {
    const base64Content = base64Data.replace(/^data:application\/pdf;base64,/, "");
    const byteLength = Math.ceil(base64Content.length * 0.75); // approximate decoded size

    if (byteLength > MAX_PDF_SIZE_BYTES) {
      return res.status(400).json({ error: `Bestand te groot. Maximum grootte: ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB` });
    }

    const header = Buffer.from(base64Content.slice(0, 12), "base64");
    if (header.length < 5 || header.toString("ascii", 0, 5) !== "%PDF-") {
      return res.status(400).json({ error: "Bestandsinhoud komt niet overeen met het bestandstype (geen geldige PDF)." });
    }

    const dataUrl = `data:application/pdf;base64,${base64Content}`;
    console.log(`[Upload] PDF stored as data URL (${(byteLength / 1024).toFixed(1)}KB)`);

    res.json({ success: true, url: dataUrl });
  } catch (error: any) {
    console.error("Error processing uploaded PDF:", error);
    res.status(500).json({ error: "PDF kon niet worden verwerkt" });
  }
});
