import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";

export const damageReportsRouter = Router();

// Admin-only throughout — unlike BlockedDate this never needs to be public
// (no calendar consumer needs raw damage descriptions/photos).

// GET /api/damage-reports — all reports, newest first. ?open=1 filters to unresolved.
damageReportsRouter.get("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const openOnly = req.query.open === "1";
    const reports = await prisma.damageReport.findMany({
      where: openOnly ? { resolvedAt: null } : undefined,
      orderBy: { reportedAt: "desc" }
    });
    res.json(reports);
  } catch (error) {
    console.error("Error fetching damage reports:", error);
    res.status(500).json({ error: "Kon schademeldingen niet ophalen" });
  }
});

// POST /api/damage-reports — log damage found outside a rental (no order).
// Damage discovered during a rental goes through POST /api/orders/:id/report-damage
// instead (atomically links the order + moves its status).
damageReportsRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const machineId = String(req.body?.machineId ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!machineId || !description || description.length > 2000) {
    return res.status(400).json({ error: "Machine en omschrijving (max 2000 tekens) zijn verplicht" });
  }
  let repairCost: number | null = null;
  if (req.body?.repairCost !== undefined && req.body?.repairCost !== null && req.body?.repairCost !== "") {
    const v = Number(req.body.repairCost);
    if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig herstelbedrag" });
    repairCost = Math.round(v * 100) / 100;
  }

  try {
    const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { name: true } });
    if (!machine) return res.status(404).json({ error: "Machine niet gevonden" });

    const report = await prisma.damageReport.create({
      data: { machineId, machineName: machine.name, description, repairCost: repairCost ?? undefined }
    });
    audit(req, "damagereport.created", { entity: "DamageReport", entityId: report.id, meta: { machineId } });
    res.status(201).json(report);
  } catch (error) {
    console.error("Error creating damage report:", error);
    res.status(500).json({ error: "Kon schademelding niet aanmaken" });
  }
});

// PATCH /api/damage-reports/:id — edit description/repairCost/photos while still
// open. Once resolvedAt is set the record is a closed historical entry — log a
// new damage report instead of rewriting the old one.
damageReportsRouter.patch("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.damageReport.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Schademelding niet gevonden" });
    if (existing.resolvedAt) return res.status(400).json({ error: "Opgeloste schademelding kan niet meer bewerkt worden" });

    const description = String(req.body?.description ?? "").trim();
    if (!description || description.length > 2000) {
      return res.status(400).json({ error: "Omschrijving (max 2000 tekens) is verplicht" });
    }
    let repairCost = existing.repairCost;
    if (req.body?.repairCost !== undefined && req.body?.repairCost !== null && req.body?.repairCost !== "") {
      const v = Number(req.body.repairCost);
      if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig herstelbedrag" });
      repairCost = Math.round(v * 100) / 100;
    } else if (req.body?.repairCost === "") {
      repairCost = null;
    }

    const updated = await prisma.damageReport.update({ where: { id }, data: { description, repairCost } });
    audit(req, "damagereport.updated", { entity: "DamageReport", entityId: id, meta: { machineId: existing.machineId } });
    res.json(updated);
  } catch (error) {
    console.error("Error updating damage report:", error);
    res.status(500).json({ error: "Kon schademelding niet bijwerken" });
  }
});

// PATCH /api/damage-reports/:id/resolve — marks repaired, unblocking the machine
// (server/utils/machineStatus.ts) unless another open damage/maintenance record remains.
damageReportsRouter.patch("/:id/resolve", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.damageReport.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Schademelding niet gevonden" });
    if (existing.resolvedAt) return res.status(400).json({ error: "Schademelding is al opgelost" });

    let repairCost = existing.repairCost;
    if (req.body?.repairCost !== undefined && req.body?.repairCost !== null && req.body?.repairCost !== "") {
      const v = Number(req.body.repairCost);
      if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig herstelbedrag" });
      repairCost = Math.round(v * 100) / 100;
    }

    const updated = await prisma.damageReport.update({
      where: { id },
      data: { resolvedAt: new Date(), repairCost: repairCost ?? undefined }
    });
    audit(req, "damagereport.resolved", { entity: "DamageReport", entityId: id, meta: { machineId: existing.machineId } });
    res.json(updated);
  } catch (error) {
    console.error("Error resolving damage report:", error);
    res.status(500).json({ error: "Kon schademelding niet afhandelen" });
  }
});
