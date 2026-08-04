import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../prisma/client.js";
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from "otplib";
import QRCode from "qrcode";
import { hashPassword, comparePassword, generateToken, generatePreAuthToken, verifyToken, hashToken, invalidateAuthCache } from "../utils/auth.js";
import { AuthenticatedRequest, authenticateToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";
import { audit } from "../utils/audit.js";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";

// TOTP-verificatie met 30s klokdrift-tolerantie (vorige/volgende window).
// otplib gooit op misvormde tokens — dat is gewoon "ongeldige code".
function totpVerify(secret: string, code: string): boolean {
  try {
    return totpVerifySync({ secret, token: code.replace(/\s/g, ""), epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}

export const authRouter = Router();

// Strict brute-force guard — ONLY for unauthenticated, credential-guessable
// endpoints (login, 2FA code, registration, password reset/verification
// requests). Previously this limiter was mounted on the whole `/api/auth`
// prefix in server.ts, which meant it also throttled every already-
// authenticated admin action nested under this router — GET /customers,
// its pagination/"Meer laden", the per-customer order-history drill-down,
// editing/blocking a customer, /me, /profile — none of which are a
// brute-force surface (they all require a valid JWT via requireAuth/
// requireAdmin already). A shop owner doing perfectly normal customer
// management (a page of customers + a couple of drill-downs + one edit)
// could exceed 10 requests in 15 minutes and get 429'd out of their own
// admin panel. Scoping the limiter to just the routes below fixes that
// without weakening the actual brute-force protection.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Te veel inlogpogingen. Probeer het over 15 minuten opnieuw." }
});

// Addons zijn een JSON-string-kolom — spiegelt safeParseAddons in orders.ts
// (apart gehouden i.p.v. geïmporteerd om de twee routers ontkoppeld te houden).
function safeParseOrderAddons(raw: string | null): unknown[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Account-lockout leeft in de DB (Admin/Customer.failedLoginCount + lockedUntil)
// en overleeft dus restarts. Alleen voor ONBEKENDE e-mailadressen — waar geen
// rij bestaat om op te tellen — blijft een kleine in-memory throttle nodig.
// Base URL for links we email out. APP_URL is authoritative; the request's own
// Host header is only a dev-time fallback.
//
// Never derive an emailed link from the Host header alone: that header is
// attacker-controlled, so a forged Host would make us send a genuine,
// huurgo-branded email containing a VALID token pointing at the attacker's
// domain — handing them the recipient's verification/reset token if clicked.
// (forgot-password already did this correctly; the two verification paths did not.)
function emailLinkOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${protocol}://${req.get("host") || "localhost:3000"}`;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

const unknownEmailAttempts = new Map<string, { count: number; lockedUntil: number; lastAttempt: number }>();

function checkUnknownEmailThrottle(email: string): boolean {
  const entry = unknownEmailAttempts.get(email);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    unknownEmailAttempts.delete(email); // lock expired — reset
  }
  return false;
}

function recordUnknownEmailAttempt(email: string): void {
  const entry = unknownEmailAttempts.get(email) ?? { count: 0, lockedUntil: 0, lastAttempt: 0 };
  entry.count += 1;
  entry.lastAttempt = Date.now();
  if (entry.count >= MAX_LOGIN_ATTEMPTS) entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
  unknownEmailAttempts.set(email, entry);
}

// checkUnknownEmailThrottle only evicts an entry once it actually got locked out
// and that lock expired — an attacker who tries a fresh random e-mail on every
// request (count never reaches MAX_LOGIN_ATTEMPTS) leaves a permanent entry
// behind, growing this map without bound for as long as the process runs. Sweep
// anything idle for longer than the lockout window: by then its throttle history
// is stale anyway, so dropping it changes no observable behaviour. Same pattern
// as the idempotency-key cache in server/routes/orders.ts.
setInterval(() => {
  const cutoff = Date.now() - LOGIN_LOCK_MS;
  for (const [email, entry] of unknownEmailAttempts) {
    if (entry.lastAttempt < cutoff) unknownEmailAttempts.delete(email);
  }
}, 10 * 60 * 1000);

const LOCKED_MSG = (lockedUntil: Date) => {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
  return `Te veel mislukte pogingen. Probeer het over ${minutes} ${minutes === 1 ? "minuut" : "minuten"} opnieuw.`;
};

export const PASSWORD_POLICY = z
  .string()
  .min(10, "Wachtwoord moet minimaal 10 tekens bevatten")
  .regex(/[a-zA-Z]/, "Wachtwoord moet minimaal één letter bevatten")
  .regex(/[0-9]/, "Wachtwoord moet minimaal één cijfer bevatten");

const registerSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: PASSWORD_POLICY,
  name: z.string().min(2, "Naam is verplicht"),
  phone: z.string().optional(),
  profile: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  avatarUrl: z.string().optional(),
  marketingConsent: z.boolean().optional()
});

const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht")
});

// REGISTER Customer
authRouter.post("/register", authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    
    // Check if email already exists in Customer
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: validated.email }
    });
    
    // Check if email already exists in Admin
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: validated.email }
    });

    if (existingCustomer || existingAdmin) {
      return res.status(400).json({ error: "E-mailadres is al in gebruik" });
    }

    const passwordHash = await hashPassword(validated.password);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Auto-verify when no real email provider is configured (dev / Render free tier)
    const hasEmailProvider = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "MY_RESEND_API_KEY";
    const autoVerify = !hasEmailProvider;

    const customer = await prisma.customer.create({
      data: {
        email: validated.email.toLowerCase(),
        passwordHash,
        name: validated.name,
        phone: validated.phone || null,
        profile: validated.profile || "Particulier",
        companyName: validated.companyName || null,
        address: validated.address || null,
        avatarUrl: validated.avatarUrl || null,
        marketingConsent: validated.marketingConsent ?? false,
        isEmailVerified: autoVerify,
        verificationToken: autoVerify ? null : hashToken(verificationToken),
        verificationExpiry: autoVerify ? null : new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    if (!autoVerify) {
      const origin = emailLinkOrigin(req);

      try {
        await emailService.sendVerificationEmail(
          { name: customer.name, email: customer.email },
          verificationToken,
          origin
        );
      } catch (emailErr) {
        console.error("Verification email failed (non-critical):", emailErr);
      }
    }

    res.status(201).json({
      success: true,
      message: autoVerify
        ? "Registratie succesvol! U kunt nu direct inloggen."
        : "Registratie succesvol! Controleer uw e-mail om uw account te verifiëren.",
      email: customer.email,
      autoVerified: autoVerify
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registratie tijdelijk niet mogelijk. Wacht even en probeer het opnieuw." });
  }
});

// LOGIN (Admin or Customer)
authRouter.post("/login", authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    const emailKey = validated.email.toLowerCase();
    const now = new Date();

    // Try finding admin first
    const admin = await prisma.admin.findUnique({
      where: { email: emailKey }
    });

    if (admin) {
      const adminActor = { id: admin.id, email: admin.email, role: "admin" };

      if (admin.lockedUntil && admin.lockedUntil > now) {
        return res.status(429).json({ error: LOCKED_MSG(admin.lockedUntil) });
      }

      const isMatch = await comparePassword(validated.password, admin.passwordHash);
      if (!isMatch || !admin.isActive) {
        // Gedeactiveerd account krijgt hetzelfde generieke antwoord (geen enumeratie)
        const newCount = admin.failedLoginCount + 1;
        const locks = isMatch ? false : newCount >= MAX_LOGIN_ATTEMPTS;
        if (!isMatch) {
          await prisma.admin.update({
            where: { id: admin.id },
            data: {
              failedLoginCount: newCount,
              lockedUntil: locks ? new Date(Date.now() + LOGIN_LOCK_MS) : admin.lockedUntil
            }
          });
        }
        audit(req, locks ? "login.locked" : "login.failed", { actor: adminActor, meta: !admin.isActive && isMatch ? { reason: "inactive" } : undefined });
        return res.status(400).json({ error: "Ongeldige inloggegevens" });
      }

      // Wachtwoord klopt maar 2FA staat aan → nog GEEN sessietoken; de client
      // moet eerst de TOTP-code aanleveren op /login/2fa met dit pre-auth token.
      if (admin.twoFactorEnabled) {
        return res.json({ requires2fa: true, preAuthToken: generatePreAuthToken(admin.id) });
      }

      await prisma.admin.update({
        where: { id: admin.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }
      });
      audit(req, "login.success", { actor: adminActor });
      const token = generateToken({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        v: admin.tokenVersion
      });

      return res.json({
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      });
    }

    // Try finding customer
    const customer = await prisma.customer.findUnique({
      where: { email: emailKey }
    });

    if (customer) {
      if (customer.lockedUntil && customer.lockedUntil > now) {
        return res.status(429).json({ error: LOCKED_MSG(customer.lockedUntil) });
      }

      const isMatch = await comparePassword(validated.password, customer.passwordHash);
      if (!isMatch) {
        const newCount = customer.failedLoginCount + 1;
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            failedLoginCount: newCount,
            lockedUntil: newCount >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS) : customer.lockedUntil
          }
        });
        return res.status(400).json({ error: "Ongeldige inloggegevens" });
      }

      if (!customer.isEmailVerified) {
        return res.status(403).json({
          error: "E-mailadres is nog niet geverifieerd. Controleer uw inbox voor de verificatielink.",
          unverified: true
        });
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: { failedLoginCount: 0, lockedUntil: null }
      });
      const token = generateToken({
        id: customer.id,
        email: customer.email,
        role: "customer",
        v: customer.tokenVersion
      });

      return res.json({
        token,
        user: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          profile: customer.profile,
          companyName: customer.companyName,
          address: customer.address,
          avatarUrl: customer.avatarUrl,
          emailOptIn: customer.emailOptIn,
          role: "customer"
        }
      });
    }

    // Onbekend e-mailadres: geen DB-rij om op te tellen → in-memory throttle
    if (checkUnknownEmailThrottle(emailKey)) {
      return res.status(429).json({ error: "Te veel mislukte pogingen. Probeer het na 15 minuten opnieuw." });
    }
    recordUnknownEmailAttempt(emailKey);
    return res.status(400).json({ error: "Ongeldige inloggegevens" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Inloggen mislukt" });
  }
});

// POST /api/auth/login/2fa — tweede stap van de adminlogin (TOTP-code)
authRouter.post("/login/2fa", authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { preAuthToken, code } = req.body;
    if (!preAuthToken || typeof preAuthToken !== "string" || !code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is verplicht" });
    }

    const payload = verifyToken(preAuthToken);
    if (!payload || payload.stage !== "2fa" || !payload.id) {
      return res.status(401).json({ error: "Sessie verlopen, log opnieuw in" });
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
    if (!admin || !admin.isActive || !admin.twoFactorEnabled || !admin.totpSecret) {
      return res.status(401).json({ error: "Sessie verlopen, log opnieuw in" });
    }
    const adminActor = { id: admin.id, email: admin.email, role: "admin" };

    const now = new Date();
    if (admin.lockedUntil && admin.lockedUntil > now) {
      return res.status(429).json({ error: LOCKED_MSG(admin.lockedUntil) });
    }

    const secret = decryptSecret(admin.totpSecret);
    const codeOk = !!secret && totpVerify(secret, code);
    if (!codeOk) {
      const newCount = admin.failedLoginCount + 1;
      const locks = newCount >= MAX_LOGIN_ATTEMPTS;
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: locks ? new Date(Date.now() + LOGIN_LOCK_MS) : admin.lockedUntil
        }
      });
      audit(req, locks ? "login.locked" : "login.2fa_failed", { actor: adminActor });
      return res.status(400).json({ error: "Ongeldige verificatiecode" });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }
    });
    audit(req, "login.success", { actor: adminActor, meta: { via: "2fa" } });

    const token = generateToken({ id: admin.id, email: admin.email, role: admin.role, v: admin.tokenVersion });
    return res.json({
      token,
      user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    });
  } catch (error) {
    console.error("2FA login error:", error);
    return res.status(500).json({ error: "Inloggen mislukt" });
  }
});

// ── Tweestapsverificatie (self-service, alleen admins) ─────────────────────
// setup → QR scannen → enable {code} bevestigt. Disable vereist wachtwoord + code
// en trekt lopende sessies in. Herstel zonder telefoon: een andere beheerder
// reset 2FA via het Beheerders-paneel (POST /api/admin/users/:id/reset-2fa).

authRouter.post("/2fa/setup", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id } });
    if (!admin) return res.status(404).json({ error: "Gebruiker niet gevonden" });
    if (admin.twoFactorEnabled) {
      return res.status(400).json({ error: "Tweestapsverificatie is al ingeschakeld." });
    }

    const secret = totpGenerateSecret();
    await prisma.admin.update({
      where: { id: admin.id },
      data: { totpSecret: encryptSecret(secret), twoFactorEnabled: false }
    });

    const otpauthUrl = totpGenerateURI({ issuer: "HuurGo Admin", label: admin.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
    return res.json({ otpauthUrl, qrDataUrl });
  } catch (error) {
    console.error("2FA setup error:", error);
    return res.status(500).json({ error: "2FA instellen mislukt" });
  }
});

authRouter.post("/2fa/enable", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is verplicht" });
    }
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id } });
    if (!admin || !admin.totpSecret) {
      return res.status(400).json({ error: "Start eerst de 2FA-setup." });
    }

    const secret = decryptSecret(admin.totpSecret);
    if (!secret || !totpVerify(secret, code)) {
      return res.status(400).json({ error: "Ongeldige verificatiecode" });
    }

    await prisma.admin.update({ where: { id: admin.id }, data: { twoFactorEnabled: true } });
    audit(req, "2fa.enabled");
    return res.json({ success: true, message: "Tweestapsverificatie is ingeschakeld." });
  } catch (error) {
    console.error("2FA enable error:", error);
    return res.status(500).json({ error: "2FA inschakelen mislukt" });
  }
});

authRouter.post("/2fa/disable", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, code } = req.body;
    if (!password || typeof password !== "string" || !code || typeof code !== "string") {
      return res.status(400).json({ error: "Wachtwoord en code zijn verplicht" });
    }
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id } });
    if (!admin || !admin.twoFactorEnabled || !admin.totpSecret) {
      return res.status(400).json({ error: "Tweestapsverificatie is niet ingeschakeld." });
    }

    const secret = decryptSecret(admin.totpSecret);
    const passwordOk = await comparePassword(password, admin.passwordHash);
    const codeOk = !!secret && totpVerify(secret, code);
    if (!passwordOk || !codeOk) {
      return res.status(400).json({ error: "Wachtwoord of code is onjuist" });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { twoFactorEnabled: false, totpSecret: null, tokenVersion: { increment: 1 } }
    });
    invalidateAuthCache(admin.id);
    audit(req, "2fa.disabled");
    return res.json({ success: true, message: "Tweestapsverificatie is uitgeschakeld. Log opnieuw in." });
  } catch (error) {
    console.error("2FA disable error:", error);
    return res.status(500).json({ error: "2FA uitschakelen mislukt" });
  }
});

// GET ME
authRouter.get("/me", authenticateToken, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPayload = req.user!;
    
    if (userPayload.role === "admin") {
      const admin = await prisma.admin.findUnique({
        where: { id: userPayload.id }
      });
      if (!admin) {
        return res.status(404).json({ error: "Gebruiker niet gevonden" });
      }
      return res.json({
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          twoFactorEnabled: admin.twoFactorEnabled
        }
      });
    } else {
      const customer = await prisma.customer.findUnique({
        where: { id: userPayload.id }
      });
      if (!customer) {
        return res.status(404).json({ error: "Gebruiker niet gevonden" });
      }
      return res.json({
        user: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          profile: customer.profile,
          companyName: customer.companyName,
          address: customer.address,
          avatarUrl: customer.avatarUrl,
          emailOptIn: customer.emailOptIn,
          role: "customer"
        }
      });
    }
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Kon gebruikersgegevens niet ophalen" });
  }
});

// PUT /api/auth/profile
authRouter.put("/profile", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, profile, companyName, address, avatarUrl } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Naam is verplicht" });
  }
  if (avatarUrl && avatarUrl.trim()) {
    try {
      const parsed = new URL(avatarUrl.trim());
      if (parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Avatar URL moet een geldige https:// link zijn." });
      }
    } catch {
      return res.status(400).json({ error: "Avatar URL is ongeldig." });
    }
  }

  try {
    const updatedCustomer = await prisma.customer.update({
      where: { id: req.user!.id },
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        profile: profile || "Particulier",
        companyName: companyName ? companyName.trim() : null,
        address: address ? address.trim() : null,
        avatarUrl: avatarUrl ? avatarUrl.trim() : null
      }
    });

    res.json({
      success: true,
      user: {
        id: updatedCustomer.id,
        email: updatedCustomer.email,
        name: updatedCustomer.name,
        phone: updatedCustomer.phone,
        profile: updatedCustomer.profile,
        companyName: updatedCustomer.companyName,
        address: updatedCustomer.address,
        avatarUrl: updatedCustomer.avatarUrl,
        emailOptIn: updatedCustomer.emailOptIn,
        role: "customer"
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Profiel bijwerken mislukt" });
  }
});

// PUT /api/auth/notifications — customer toggles their live-update email preference
authRouter.put("/notifications", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { emailOptIn } = req.body;
  if (typeof emailOptIn !== "boolean") {
    return res.status(400).json({ error: "emailOptIn moet true of false zijn" });
  }

  try {
    const updatedCustomer = await prisma.customer.update({
      where: { id: req.user!.id },
      data: { emailOptIn }
    });

    res.json({ success: true, emailOptIn: updatedCustomer.emailOptIn });
  } catch (error) {
    console.error("Notification preference update error:", error);
    res.status(500).json({ error: "Voorkeuren bijwerken mislukt" });
  }
});

// GET /api/auth/me/export — GDPR-dataportabiliteit (art. 20): één download met
// alles wat we over de ingelogde gebruiker vasthouden. Combineert bestaande,
// losse endpoints (/me, /orders) tot één bundel zodat een verzoek niet meer
// handmatig door een beheerder hoeft te worden samengesteld. Wachtwoordhash en
// reset-/verificatietokens worden nooit meegenomen (expliciete select, geen
// spread van de rauwe rij).
authRouter.get("/me/export", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filename = `huurgo-gegevens-${req.user!.id}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (req.user!.role === "admin") {
      const admin = await prisma.admin.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, name: true, role: true, createdAt: true, lastLoginAt: true, twoFactorEnabled: true }
      });
      if (!admin) return res.status(404).json({ error: "Gebruiker niet gevonden" });
      return res.json({ exportedAt: new Date().toISOString(), profile: admin });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, name: true, phone: true, profile: true, companyName: true,
        address: true, avatarUrl: true, isEmailVerified: true, marketingConsent: true,
        emailOptIn: true, createdAt: true
      }
    });
    if (!customer) return res.status(404).json({ error: "Gebruiker niet gevonden" });

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" }
    });
    const orderIds = orders.map(o => o.id);
    const ratings = orderIds.length > 0
      ? await prisma.orderRating.findMany({ where: { orderId: { in: orderIds } } })
      : [];

    return res.json({
      exportedAt: new Date().toISOString(),
      profile: customer,
      orders: orders.map(o => ({
        ...o,
        startDate: o.startDate.toISOString().split("T")[0],
        endDate: o.endDate.toISOString().split("T")[0],
        addons: safeParseOrderAddons(o.addons)
      })),
      ratings
    });
  } catch (error) {
    console.error("Data export error:", error);
    return res.status(500).json({ error: "Gegevens exporteren mislukt" });
  }
});

// GET /api/auth/verify?token=XYZ
authRouter.get("/verify", async (req: Request, res: Response) => {
  const token = req.query.token;

  if (!token || typeof token !== "string") {
    return res.redirect("/?verified=false&error=" + encodeURIComponent("Ongeldige verificatietoken."));
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { verificationToken: hashToken(token) }
    });

    if (!customer || (customer.verificationExpiry && customer.verificationExpiry < new Date())) {
      return res.redirect("/?verified=false&error=" + encodeURIComponent("De verificatielink is ongeldig of verlopen. Vraag een nieuwe aan."));
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationExpiry: null
      }
    });

    return res.redirect("/?verified=true&email=" + encodeURIComponent(customer.email));
  } catch (error) {
    console.error("Verification error:", error);
    return res.redirect("/?verified=false&error=" + encodeURIComponent("Er is een interne fout opgetreden bij het verifiëren."));
  }
});

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "E-mailadres is verplicht." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const SUCCESS_MSG = { success: true, message: "Als dit e-mailadres bekend is, ontvangt u een resetlink." };

  try {
    const appUrl = emailLinkOrigin(req);
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Always query both tables before responding to prevent timing-based email enumeration.
    // An attacker observing response latency cannot distinguish admin from customer accounts.
    const [admin, customer] = await Promise.all([
      prisma.admin.findUnique({ where: { email: normalizedEmail } }),
      prisma.customer.findUnique({ where: { email: normalizedEmail } })
    ]);

    if (admin) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordResetToken: hashToken(resetToken), passwordResetExpiry: resetExpiry }
      });
      audit(req, "password.reset_requested", { actor: { id: admin.id, email: admin.email, role: "admin" } });
      await emailService.sendPasswordResetEmail(admin.email, admin.name, resetToken, appUrl);
      return res.json(SUCCESS_MSG);
    }

    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordResetToken: hashToken(resetToken), passwordResetExpiry: resetExpiry }
      });
      await emailService.sendPasswordResetEmail(customer.email, customer.name, resetToken, appUrl);
    }

    return res.json(SUCCESS_MSG);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Wachtwoord reset mislukt." });
  }
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || typeof token !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Token en nieuw wachtwoord zijn verplicht." });
  }
  const pwResult = PASSWORD_POLICY.safeParse(newPassword);
  if (!pwResult.success) {
    return res.status(400).json({ error: pwResult.error.issues[0].message });
  }

  try {
    const now = new Date();

    const tokenHash = hashToken(token);

    // Check admin reset token first
    const admin = await prisma.admin.findFirst({
      where: { passwordResetToken: tokenHash, passwordResetExpiry: { gt: now } }
    });
    if (admin) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          passwordResetToken: null,
          passwordResetExpiry: null,
          failedLoginCount: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 } // bestaande sessies ongeldig na reset
        }
      });
      invalidateAuthCache(admin.id);
      audit(req, "password.reset_completed", { actor: { id: admin.id, email: admin.email, role: "admin" } });
      return res.json({ success: true, message: "Wachtwoord succesvol gewijzigd. U kunt nu inloggen." });
    }

    // Check customer reset token
    const customer = await prisma.customer.findFirst({
      where: { passwordResetToken: tokenHash, passwordResetExpiry: { gt: now } }
    });
    if (!customer) {
      return res.status(400).json({ error: "Resetlink is ongeldig of verlopen. Vraag een nieuwe aan." });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetExpiry: null,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 }
      }
    });
    invalidateAuthCache(customer.id);
    audit(req, "password.reset_completed", { actor: { id: customer.id, email: customer.email, role: "customer" } });

    return res.json({ success: true, message: "Wachtwoord succesvol gewijzigd. U kunt nu inloggen." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Wachtwoord wijzigen mislukt." });
  }
});

// POST /api/auth/change-password — logged-in admin or customer changes own password
authRouter.post("/change-password", authenticateToken, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Huidig en nieuw wachtwoord zijn verplicht." });
  }
  const newPwResult = PASSWORD_POLICY.safeParse(newPassword);
  if (!newPwResult.success) {
    return res.status(400).json({ error: newPwResult.error.issues[0].message });
  }

  try {
    if (req.user!.role === "admin") {
      const admin = await prisma.admin.findUnique({ where: { id: req.user!.id } });
      if (!admin || !(await comparePassword(currentPassword, admin.passwordHash))) {
        return res.status(400).json({ error: "Huidig wachtwoord is onjuist." });
      }
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } }
      });
    } else {
      const customer = await prisma.customer.findUnique({ where: { id: req.user!.id } });
      if (!customer || !(await comparePassword(currentPassword, customer.passwordHash))) {
        return res.status(400).json({ error: "Huidig wachtwoord is onjuist." });
      }
      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } }
      });
    }
    invalidateAuthCache(req.user!.id);
    audit(req, "password.changed");
    return res.json({ success: true, message: "Wachtwoord succesvol gewijzigd." });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Wachtwoord wijzigen mislukt." });
  }
});

// POST /api/auth/resend-verification
authRouter.post("/resend-verification", authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "E-mailadres is verplicht." });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!customer || customer.isEmailVerified) {
      // Return generic success to avoid leaking whether the address exists
      return res.json({
        success: true,
        message: "Als dit e-mailadres bij ons bekend is en nog niet geverifieerd, ontvangt u een nieuwe verificatiemail."
      });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    await prisma.customer.update({
      where: { id: customer.id },
      data: { verificationToken: hashToken(newToken), verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    });

    const origin = emailLinkOrigin(req);

    await emailService.sendVerificationEmail(
      { name: customer.name, email: customer.email },
      newToken,
      origin
    );

    return res.json({
      success: true,
      message: "Verificatie-e-mail opnieuw verzonden. Controleer uw inbox."
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({ error: "Kan verificatiemail niet verzenden." });
  }
});

// GET /api/auth/customers — admin-only: paginated list of registered customers
// (mirrors the orders.ts pagination shape — X-Total-Pages/X-Total-Count headers)
authRouter.get("/customers", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          profile: true,
          marketingConsent: true,
          isEmailVerified: true,
          lockedUntil: true,
          createdAt: true,
          _count: { select: { orders: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.customer.count()
    ]);

    // Lifetime value (CLAUDE.md documents this panel as showing it, but it was
    // never actually computed — the list only ever rendered the order count).
    // One extra groupBy for the whole page instead of an aggregate per customer
    // row, same cancelled-orders exclusion as the dashboard's revenue KPI
    // (GET /api/orders/stats) so the two numbers stay consistent.
    const customerIds = customers.map(c => c.id);
    const spendByCustomer = customerIds.length > 0
      ? await prisma.order.groupBy({
          by: ["customerId"],
          where: { customerId: { in: customerIds }, status: { not: "Geannuleerd" } },
          _sum: { totalAmount: true }
        })
      : [];
    const spendMap = new Map(spendByCustomer.map(s => [s.customerId, s._sum.totalAmount ?? 0]));
    const customersWithSpend = customers.map(c => ({ ...c, lifetimeValue: spendMap.get(c.id) ?? 0 }));

    res.setHeader("X-Total-Pages", String(Math.ceil(totalCount / limit)));
    res.setHeader("X-Total-Count", String(totalCount));
    return res.json({ customers: customersWithSpend, totalCount, page, totalPages: Math.ceil(totalCount / limit) });
  } catch (error) {
    console.error("Get customers error:", error);
    return res.status(500).json({ error: "Klanten ophalen mislukt." });
  }
});

// GET /api/auth/customers/:id/orders — admin-only: one customer's order history.
authRouter.get("/customers/:id/orders", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return res.json(orders.map(o => ({
      ...o,
      startDate: o.startDate.toISOString().split("T")[0],
      endDate: o.endDate.toISOString().split("T")[0]
    })));
  } catch (error) {
    console.error("Get customer orders error:", error);
    return res.status(500).json({ error: "Bestellingen ophalen mislukt." });
  }
});

// PATCH /api/auth/customers/:id — admin-only: edit a customer's profile fields.
authRouter.patch("/customers/:id", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const body = req.body ?? {};
  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Klant niet gevonden." });

    const data: Record<string, unknown> = {};
    const changed: string[] = [];
    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (!v || v.length > 200) return res.status(400).json({ error: "Ongeldige naam." });
      data.name = v; changed.push("name");
    }
    if (body.email !== undefined) {
      const v = String(body.email).trim().toLowerCase();
      if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)) return res.status(400).json({ error: "Ongeldig e-mailadres." });
      if (v !== existing.email) {
        const clash = await prisma.customer.findFirst({ where: { email: { equals: v, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
        if (clash) return res.status(409).json({ error: "Er bestaat al een klant met dit e-mailadres." });
      }
      data.email = v; changed.push("email");
    }
    if (body.phone !== undefined) {
      const raw = String(body.phone).trim();
      if (raw) {
        const clean = raw.replace(/[\s\-().+]/g, "");
        if (!/^\d{7,15}$/.test(clean)) return res.status(400).json({ error: "Ongeldig telefoonnummer." });
      }
      data.phone = raw || null; changed.push("phone");
    }
    if (body.companyName !== undefined) {
      const v = String(body.companyName).trim();
      if (v.length > 200) return res.status(400).json({ error: "Bedrijfsnaam is te lang." });
      data.companyName = v || null; changed.push("companyName");
    }
    if (body.profile !== undefined) {
      data.profile = String(body.profile).slice(0, 100) || null; changed.push("profile");
    }
    if (changed.length === 0) return res.status(400).json({ error: "Geen wijzigingen opgegeven." });

    const updated = await prisma.customer.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, phone: true, companyName: true, profile: true, marketingConsent: true, isEmailVerified: true, createdAt: true, _count: { select: { orders: true } } }
    });
    audit(req, "customer.updated", { entity: "Customer", entityId: id, meta: { fields: changed } });
    return res.json({ customer: updated });
  } catch (error) {
    console.error("Update customer error:", error);
    return res.status(500).json({ error: "Klant bijwerken mislukt." });
  }
});

// POST /api/auth/customers/:id/block — admin-only: block a customer account
// (sets lockedUntil far in the future and revokes live sessions). Reversible.
authRouter.post("/customers/:id/block", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const block = req.body?.blocked !== false; // default true; pass { blocked: false } to unblock
  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Klant niet gevonden." });
    await prisma.customer.update({
      where: { id },
      data: block
        ? { lockedUntil: new Date("2999-12-31T00:00:00Z"), tokenVersion: { increment: 1 } }
        : { lockedUntil: null, failedLoginCount: 0 }
    });
    audit(req, block ? "customer.blocked" : "customer.unblocked", { entity: "Customer", entityId: id });
    return res.json({ success: true, blocked: block });
  } catch (error) {
    console.error("Block customer error:", error);
    return res.status(500).json({ error: "Klant blokkeren mislukt." });
  }
});

// DELETE /api/auth/customers/:id — admin-only: GDPR erase. Orders are kept (legal
// retention / BTW) but detached from the account: customerId → null so the order
// history survives without the personal account. The customer row is deleted.
authRouter.delete("/customers/:id", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Klant niet gevonden." });
    // De orders blijven bestaan (bewaarplicht voor facturen) maar raken hun
    // klantkoppeling kwijt. Hun e-mailadres staat nog wél op de orderregel, dus
    // zonder de eerste update zou een klant die "geen e-mail" had aangevinkt na
    // verwijdering weer post krijgen: de opt-in-check leest het Customer-record,
    // en een order zónder customerId telt bewust als gast — en gasten krijgen mail.
    // De voorkeur verhuist daarom naar de order voordat de klant verdwijnt.
    await prisma.$transaction([
      ...(existing.emailOptIn === false
        ? [prisma.order.updateMany({ where: { customerId: id }, data: { emailOptOut: true } })]
        : []),
      prisma.order.updateMany({ where: { customerId: id }, data: { customerId: null } }),
      prisma.customer.delete({ where: { id } })
    ]);
    audit(req, "customer.deleted", { entity: "Customer", entityId: id, meta: { email: existing.email } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete customer error:", error);
    return res.status(500).json({ error: "Klant verwijderen mislukt." });
  }
});

// POST /api/auth/campaigns/email — admin-only: send bulk campaign emails via Resend
authRouter.post("/campaigns/email", authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerIds, subject, body, sendOnlyMarketing } = req.body;
    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return res.status(400).json({ error: "Onderwerp is verplicht" });
    }
    if (!body || typeof body !== "string" || body.trim().length < 10) {
      return res.status(400).json({ error: "Berichttekst is verplicht" });
    }

    // Build filter
    const where: Record<string, unknown> = {};
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      where.id = { in: customerIds.map(String) };
    }
    if (sendOnlyMarketing) {
      where.marketingConsent = true;
    }
    where.isEmailVerified = true;

    const targets = await prisma.customer.findMany({
      where,
      select: { id: true, name: true, email: true }
    });

    if (targets.length === 0) {
      return res.json({ sent: 0, failed: 0 });
    }

    // Rate-cap: max 200 recipients per campaign call
    const capped = targets.slice(0, 200);

    let sent = 0;
    let failed = 0;
    for (const customer of capped) {
      const personalBody = body.replace(/\{naam\}/g, customer.name);
      const ok = await emailService.sendCampaignEmail(customer, subject.trim(), personalBody);
      if (ok) sent++; else failed++;
    }

    console.log(`[Campaign] Admin sent campaign "${subject.slice(0, 40)}" → ${sent} sent, ${failed} failed`);
    return res.json({ sent, failed });
  } catch (error) {
    console.error("Campaign email error:", error);
    return res.status(500).json({ error: "Campagne versturen mislukt" });
  }
});

