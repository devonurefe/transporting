import { Router } from "express";
import { machinesRouter } from "./machines.js";
import { ordersRouter } from "./orders.js";
import { blockedDatesRouter } from "./blockedDates.js";
import { siteConfigRouter } from "./siteConfig.js";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";

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
      error: "Database connection failed"
    });
  }
});

// Mount modular sub-routers
apiRouter.use("/machines", machinesRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/blocked-dates", blockedDatesRouter);
apiRouter.use("/", siteConfigRouter);

import path from "path";

// POST /api/upload - Stores image as base64 data URL in the database (no disk writes = persistent across Render deploys)
const MAX_UPLOAD_SIZE_BYTES = 3 * 1024 * 1024; // 3MB limit for DB storage
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml"
};

apiRouter.post("/upload", requireAdmin as any, async (req, res) => {
  const { fileName, base64Data } = req.body;
  if (!fileName || !base64Data) {
    return res.status(400).json({ error: "fileName and base64Data parameters are required" });
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

    // Return as data URL — stored directly in the DB, survives server restarts/redeploys
    const mimeType = EXT_TO_MIME[ext] ?? "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Content}`;
    console.log(`[Upload] Image stored as data URL (${(byteLength / 1024).toFixed(1)}KB, type: ${mimeType})`);

    res.json({ success: true, url: dataUrl });
  } catch (error: any) {
    console.error("Error processing uploaded image:", error);
    res.status(500).json({ error: "Failed to process uploaded image: " + error.message });
  }
});
