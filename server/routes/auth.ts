import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../prisma/client.js";
import { hashPassword, comparePassword, generateToken } from "../utils/auth.js";
import { AuthenticatedRequest, authenticateToken, requireAuth } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(6, "Wachtwoord moet minimaal 6 tekens bevatten"),
  name: z.string().min(2, "Naam is verplicht"),
  phone: z.string().optional(),
  profile: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  avatarUrl: z.string().optional()
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
        isEmailVerified: autoVerify,
        verificationToken: autoVerify ? null : verificationToken,
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

    // Try finding admin first
    const admin = await prisma.admin.findUnique({
      where: { email: validated.email.toLowerCase() }
    });

    if (admin) {
      const isMatch = await comparePassword(validated.password, admin.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: "Ongeldige inloggegevens" });
      }

      const token = generateToken({
        id: admin.id,
        email: admin.email,
        role: admin.role
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
      where: { email: validated.email.toLowerCase() }
    });

    if (customer) {
      const isMatch = await comparePassword(validated.password, customer.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: "Ongeldige inloggegevens" });
      }

      if (!customer.isEmailVerified) {
        return res.status(403).json({
          error: "E-mailadres is nog niet geverifieerd. Controleer uw inbox voor de verificatielink.",
          unverified: true
        });
      }

      const token = generateToken({
        id: customer.id,
        email: customer.email,
        role: "customer"
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
          role: "customer"
        }
      });
    }

    return res.status(400).json({ error: "Ongeldige inloggegevens" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Inloggen mislukt" });
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
          role: admin.role
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
        role: "customer"
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Profiel bijwerken mislukt" });
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
      where: { verificationToken: token }
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

  try {
    const customer = await prisma.customer.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Always return success to prevent email enumeration
    if (!customer) {
      return res.json({ success: true, message: "Als dit e-mailadres bekend is, ontvangt u een resetlink." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: resetExpiry }
    });

    const appUrl = process.env.APP_URL || `${req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${req.get("host") || "localhost:3000"}`;
    await emailService.sendPasswordResetEmail(customer.email, customer.name, resetToken, appUrl);

    return res.json({ success: true, message: "Als dit e-mailadres bekend is, ontvangt u een resetlink." });
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
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Wachtwoord moet minimaal 6 tekens bevatten." });
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() }
      }
    });

    if (!customer) {
      return res.status(400).json({ error: "Resetlink is ongeldig of verlopen. Vraag een nieuwe aan." });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null }
    });

    return res.json({ success: true, message: "Wachtwoord succesvol gewijzigd. U kunt nu inloggen." });
  } catch (error) {
    console.error("Reset password error:", error);
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
      data: { verificationToken: newToken, verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) }
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

