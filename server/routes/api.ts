import { Router, json as expressJson } from "express";
import { machinesRouter } from "./machines.js";
import { ordersRouter } from "./orders.js";
import { blockedDatesRouter } from "./blockedDates.js";
import { siteConfigRouter } from "./siteConfig.js";
import { calendarRouter } from "./calendar.js";
import { blogPostsRouter } from "./blog.js";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";

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

// Mount modular sub-routers
apiRouter.use("/machines", machinesRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/blocked-dates", blockedDatesRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/blog-posts", blogPostsRouter);
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
