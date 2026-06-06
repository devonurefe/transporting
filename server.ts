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

// Helmet with relaxed CSP to ensure local Vite development works
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
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

// Stricter rate limit for AI endpoints (10 requests per minute to control cost)
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Te veel AI-verzoeken. Probeer het over een minuut opnieuw." }
});
app.use("/api/gemini/", geminiLimiter);

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
    console.log(`🤖 Serving full-stack React SPA with Dutch AI Advisor`);
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

    // Gemini API Key Check
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY" || geminiKey === "") {
      console.log(`⚠️  [GEMINI_API_KEY]: UNCONFIGURED. AI Advisor will operate in mock fallback mode.`);
    } else {
      console.log(`✅ [GEMINI_API_KEY]: Configured successfully.`);
    }

    // Resend API Key Check
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || resendKey === "MY_RESEND_API_KEY" || resendKey === "") {
      console.log(`⚠️  [RESEND_API_KEY]: UNCONFIGURED. Transactional emails will log in mock simulation mode.`);
    } else {
      console.log(`✅ [RESEND_API_KEY]: Configured successfully.`);
    }

    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
