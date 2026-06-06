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

    const customer = await prisma.customer.create({
      data: {
        email: validated.email,
        passwordHash,
        name: validated.name,
        phone: validated.phone || null,
        profile: validated.profile || "Particulier",
        companyName: validated.companyName || null,
        address: validated.address || null,
        avatarUrl: validated.avatarUrl || null,
        isEmailVerified: false,
        verificationToken
      }
    });

    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    await emailService.sendVerificationEmail(
      { name: customer.name, email: customer.email },
      verificationToken,
      origin
    );

    res.status(201).json({
      success: true,
      message: "Registratie succesvol! Controleer uw e-mail om uw account te verifiëren.",
      email: customer.email
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registratie mislukt" });
  }
});

// LOGIN (Admin or Customer)
authRouter.post("/login", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);

    // Try finding admin first
    const admin = await prisma.admin.findUnique({
      where: { email: validated.email }
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
      where: { email: validated.email }
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

    if (!customer) {
      return res.redirect("/?verified=false&error=" + encodeURIComponent("De verificatielink is ongeldig of verlopen."));
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isEmailVerified: true,
        verificationToken: null
      }
    });

    return res.redirect("/?verified=true&email=" + encodeURIComponent(customer.email));
  } catch (error) {
    console.error("Verification error:", error);
    return res.redirect("/?verified=false&error=" + encodeURIComponent("Er is een interne fout opgetreden bij het verifiëren."));
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
      where: { email: email.trim() }
    });

    if (!customer) {
      return res.status(404).json({ error: "Gebruiker niet gevonden met dit e-mailadres." });
    }

    if (customer.isEmailVerified) {
      return res.status(400).json({ error: "E-mailadres is al geverifieerd." });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    await prisma.customer.update({
      where: { id: customer.id },
      data: { verificationToken: newToken }
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

// GET /api/auth/mock-profiles
authRouter.get("/mock-profiles", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access denied in production" });
  }
  try {
    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone || "",
      companyName: c.companyName || undefined,
      profileType: c.profile || "Particulier",
      pastRentalsCount: c._count.orders,
      avatarUrl: c.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop"
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching mock profiles:", error);
    res.status(500).json({ error: "Kon testprofielen niet ophalen" });
  }
});
