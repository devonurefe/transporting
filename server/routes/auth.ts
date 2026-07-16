import { Router, Request, Response } from "express";
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

// Account-lockout leeft in de DB (Admin/Customer.failedLoginCount + lockedUntil)
// en overleeft dus restarts. Alleen voor ONBEKENDE e-mailadressen — waar geen
// rij bestaat om op te tellen — blijft een kleine in-memory throttle nodig.
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

const unknownEmailAttempts = new Map<string, { count: number; lockedUntil: number }>();

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
  const entry = unknownEmailAttempts.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
  unknownEmailAttempts.set(email, entry);
}

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
authRouter.post("/register", async (req: AuthenticatedRequest, res: Response) => {
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
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const host = req.get("host") || "localhost:3000";
      const origin = `${protocol}://${host}`;

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
authRouter.post("/login", async (req: AuthenticatedRequest, res: Response) => {
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
authRouter.post("/login/2fa", async (req: AuthenticatedRequest, res: Response) => {
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
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "E-mailadres is verplicht." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const SUCCESS_MSG = { success: true, message: "Als dit e-mailadres bekend is, ontvangt u een resetlink." };

  try {
    const appUrl = process.env.APP_URL || `${req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${req.get("host") || "localhost:3000"}`;
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
authRouter.post("/reset-password", async (req: Request, res: Response) => {
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
authRouter.post("/resend-verification", async (req: Request, res: Response) => {
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

    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

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

// GET /api/auth/customers — admin-only: list all registered customers
authRouter.get("/customers", authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        profile: true,
        marketingConsent: true,
        isEmailVerified: true,
        createdAt: true,
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ customers });
  } catch (error) {
    console.error("Get customers error:", error);
    return res.status(500).json({ error: "Klanten ophalen mislukt." });
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

