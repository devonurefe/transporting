import { Router } from "express";
import { machinesRouter } from "./machines.js";
import { ordersRouter } from "./orders.js";
import { blockedDatesRouter } from "./blockedDates.js";
import { siteConfigRouter } from "./siteConfig.js";
import { geminiRouter } from "./gemini.js";
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
        gemini: (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") ? "configured" : "unconfigured"
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
apiRouter.use("/gemini", geminiRouter);

import fs from "fs";
import path from "path";

// POST /api/upload - Local base64 file uploader (zero third-party dependency)
apiRouter.post("/upload", requireAdmin as any, async (req, res) => {
  const { fileName, base64Data } = req.body;
  if (!fileName || !base64Data) {
    return res.status(400).json({ error: "fileName and base64Data parameters are required" });
  }

  try {
    // Check and create 'uploads' folder in the root directory
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Extract the raw base64 content
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");

    // Clean filename to prevent path traversal
    const safeFileName = Date.now() + "_" + path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = path.join(uploadsDir, safeFileName);

    // Save image to file
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${safeFileName}`;
    console.log(`[Upload] Image saved successfully to ${filePath}`);

    res.json({
      success: true,
      url: relativeUrl
    });
  } catch (error: any) {
    console.error("Error saving uploaded image:", error);
    res.status(500).json({ error: "Failed to save uploaded image: " + error.message });
  }
});
