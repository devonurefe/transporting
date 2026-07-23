import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";

export const maintenanceRouter = Router();

// Admin-only — structured replacement for the free-text BlockedDate.reason
// workaround (docs/admin-platform-audit-2026-07.md §9). Reactive, not
// predictive: an admin opens this when maintenance actually starts, not in
// advance — while completedDate is null the machine is operationally blocked
// (server/utils/machineStatus.ts).

// GET /api/maintenance — all events, newest first. ?open=1 filters to ongoing.
maintenanceRouter.get("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const openOnly = req.query.open === "1";
    const events = await prisma.maintenanceEvent.findMany({
      where: openOnly ? { completedDate: null } : undefined,
      orderBy: { scheduledDate: "desc" }
    });
    res.json(events);
  } catch (error) {
    console.error("Error fetching maintenance events:", error);
    res.status(500).json({ error: "Kon onderhoud niet ophalen" });
  }
});

// POST /api/maintenance — opens a maintenance record, blocking the machine immediately.
maintenanceRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const machineId = String(req.body?.machineId ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!machineId || !description || description.length > 2000) {
    return res.status(400).json({ error: "Machine en omschrijving (max 2000 tekens) zijn verplicht" });
  }
  let cost: number | null = null;
  if (req.body?.cost !== undefined && req.body?.cost !== null && req.body?.cost !== "") {
    const v = Number(req.body.cost);
    if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig bedrag" });
    cost = Math.round(v * 100) / 100;
  }

  try {
    const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { name: true } });
    if (!machine) return res.status(404).json({ error: "Machine niet gevonden" });

    const event = await prisma.maintenanceEvent.create({
      data: { machineId, machineName: machine.name, description, cost: cost ?? undefined }
    });
    audit(req, "maintenance.created", { entity: "MaintenanceEvent", entityId: event.id, meta: { machineId } });
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating maintenance event:", error);
    res.status(500).json({ error: "Kon onderhoud niet aanmaken" });
  }
});

// PATCH /api/maintenance/:id/resolve — marks maintenance done, unblocking the
// machine (unless another open damage/maintenance record remains).
maintenanceRouter.patch("/:id/resolve", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.maintenanceEvent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Onderhoud niet gevonden" });
    if (existing.completedDate) return res.status(400).json({ error: "Onderhoud is al afgerond" });

    let cost = existing.cost;
    if (req.body?.cost !== undefined && req.body?.cost !== null && req.body?.cost !== "") {
      const v = Number(req.body.cost);
      if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig bedrag" });
      cost = Math.round(v * 100) / 100;
    }

    const updated = await prisma.maintenanceEvent.update({
      where: { id },
      data: { completedDate: new Date(), cost: cost ?? undefined }
    });
    audit(req, "maintenance.resolved", { entity: "MaintenanceEvent", entityId: id, meta: { machineId: existing.machineId } });
    res.json(updated);
  } catch (error) {
    console.error("Error resolving maintenance event:", error);
    res.status(500).json({ error: "Kon onderhoud niet afronden" });
  }
});
