import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin } from "../middleware/auth.js";
import { hashPassword, invalidateAuthCache } from "../utils/auth.js";
import { audit } from "../utils/audit.js";
import { PASSWORD_POLICY } from "./auth.js";

// Beheerdersbeheer: alle admins zijn gelijkwaardig (één rol "admin" — geen
// hiërarchie nodig voor een winkel met ≤3 beheerders). Wachtwoordhashes en
// TOTP-secrets verlaten deze router nooit.
export const adminUsersRouter = Router();

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true
} as const;

// Pure guard, apart geëxporteerd voor unit-tests: jezelf of de laatste actieve
// beheerder deactiveren zou iedereen buitensluiten.
export function canDisable(targetId: string, selfId: string, targetIsActive: boolean, activeCount: number): { ok: boolean; error?: string } {
  if (targetId === selfId) return { ok: false, error: "U kunt uw eigen account niet deactiveren." };
  if (targetIsActive && activeCount <= 1) return { ok: false, error: "De laatste actieve beheerder kan niet worden gedeactiveerd." };
  return { ok: true };
}

// GET /api/admin/users — lijst van beheerders
adminUsersRouter.get("/", requireAdmin as any, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({ select: ADMIN_SELECT, orderBy: { createdAt: "asc" } });
    return res.json({ admins });
  } catch (error) {
    console.error("List admins error:", error);
    return res.status(500).json({ error: "Beheerders ophalen mislukt" });
  }
});

const createAdminSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  name: z.string().min(2, "Naam is verplicht"),
  password: PASSWORD_POLICY
});

// POST /api/admin/users — nieuwe beheerder
adminUsersRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = createAdminSchema.parse(req.body);
    const email = validated.email.toLowerCase();

    // E-mail moet uniek zijn over Admin én Customer (zelfde regel als /register)
    const [existingAdmin, existingCustomer] = await Promise.all([
      prisma.admin.findUnique({ where: { email } }),
      prisma.customer.findUnique({ where: { email } })
    ]);
    if (existingAdmin || existingCustomer) {
      return res.status(400).json({ error: "E-mailadres is al in gebruik" });
    }

    const admin = await prisma.admin.create({
      data: { email, name: validated.name.trim(), passwordHash: await hashPassword(validated.password) },
      select: ADMIN_SELECT
    });
    audit(req, "admin.created", { entity: "Admin", entityId: admin.id, meta: { email } });
    return res.status(201).json({ admin });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Create admin error:", error);
    return res.status(500).json({ error: "Beheerder aanmaken mislukt" });
  }
});

// PUT /api/admin/users/:id — alleen naam wijzigen
adminUsersRouter.put("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Naam is verplicht" });
  }
  try {
    const admin = await prisma.admin.update({
      where: { id: req.params.id },
      data: { name: name.trim().slice(0, 100) },
      select: ADMIN_SELECT
    });
    return res.json({ admin });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Beheerder niet gevonden" });
    console.error("Update admin error:", error);
    return res.status(500).json({ error: "Beheerder bijwerken mislukt" });
  }
});

// POST /api/admin/users/:id/disable
adminUsersRouter.post("/:id/disable", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const target = await prisma.admin.findUnique({ where: { id: req.params.id }, select: { id: true, isActive: true } });
    if (!target) return res.status(404).json({ error: "Beheerder niet gevonden" });

    const activeCount = await prisma.admin.count({ where: { isActive: true } });
    const guard = canDisable(target.id, req.user!.id, target.isActive, activeCount);
    if (!guard.ok) return res.status(400).json({ error: guard.error });

    // tokenVersion-bump + cache-invalidatie → lopende sessies vallen direct weg
    const admin = await prisma.admin.update({
      where: { id: target.id },
      data: { isActive: false, tokenVersion: { increment: 1 } },
      select: ADMIN_SELECT
    });
    invalidateAuthCache(target.id);
    audit(req, "admin.disabled", { entity: "Admin", entityId: target.id });
    return res.json({ admin });
  } catch (error) {
    console.error("Disable admin error:", error);
    return res.status(500).json({ error: "Beheerder deactiveren mislukt" });
  }
});

// POST /api/admin/users/:id/enable
adminUsersRouter.post("/:id/enable", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = await prisma.admin.update({
      where: { id: req.params.id },
      data: { isActive: true, failedLoginCount: 0, lockedUntil: null },
      select: ADMIN_SELECT
    });
    invalidateAuthCache(req.params.id);
    audit(req, "admin.enabled", { entity: "Admin", entityId: req.params.id });
    return res.json({ admin });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Beheerder niet gevonden" });
    console.error("Enable admin error:", error);
    return res.status(500).json({ error: "Beheerder activeren mislukt" });
  }
});

// POST /api/admin/users/:id/reset-password — eigenaar zet direct een nieuw wachtwoord
// (geen invite-mailmachinerie nodig voor een door de eigenaar beheerde winkel)
adminUsersRouter.post("/:id/reset-password", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const pwResult = PASSWORD_POLICY.safeParse(req.body?.newPassword);
  if (!pwResult.success) {
    return res.status(400).json({ error: pwResult.error.issues[0].message });
  }
  try {
    await prisma.admin.update({
      where: { id: req.params.id },
      data: {
        passwordHash: await hashPassword(pwResult.data),
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 }
      }
    });
    invalidateAuthCache(req.params.id);
    audit(req, "admin.password_reset", { entity: "Admin", entityId: req.params.id });
    return res.json({ success: true, message: "Wachtwoord is gereset." });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Beheerder niet gevonden" });
    console.error("Reset admin password error:", error);
    return res.status(500).json({ error: "Wachtwoord resetten mislukt" });
  }
});

// POST /api/admin/users/:id/reset-2fa — herstelroute wanneer een telefoon kwijt is
adminUsersRouter.post("/:id/reset-2fa", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.admin.update({
      where: { id: req.params.id },
      data: { twoFactorEnabled: false, totpSecret: null, tokenVersion: { increment: 1 } }
    });
    invalidateAuthCache(req.params.id);
    audit(req, "admin.2fa_reset", { entity: "Admin", entityId: req.params.id });
    return res.json({ success: true, message: "Tweestapsverificatie is gereset." });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Beheerder niet gevonden" });
    console.error("Reset admin 2FA error:", error);
    return res.status(500).json({ error: "2FA resetten mislukt" });
  }
});
