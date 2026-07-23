// Operational availability blocking — distinct from booking-overlap availability
// (src/utils/availability.ts). A machine is operationally blocked when it's
// permanently retired, or has an unresolved DamageReport, or an open (not yet
// completed) MaintenanceEvent. Blocked machines cannot be booked regardless of
// stockQuantity/date overlap — see docs/admin-platform-audit-2026-07.md §9.
import { prisma } from "../../prisma/client.js";

export async function isMachineOperationallyBlocked(machineId: string): Promise<boolean> {
  const [machine, openDamage, openMaintenance] = await Promise.all([
    prisma.machine.findUnique({ where: { id: machineId }, select: { isRetired: true } }),
    prisma.damageReport.findFirst({ where: { machineId, resolvedAt: null }, select: { id: true } }),
    prisma.maintenanceEvent.findFirst({ where: { machineId, completedDate: null }, select: { id: true } })
  ]);
  return Boolean(machine?.isRetired) || Boolean(openDamage) || Boolean(openMaintenance);
}

// Bulk variant for list endpoints (public machine catalog, admin machine list) —
// one query per source instead of N+1 per machine.
export async function getOperationallyBlockedMachineIds(): Promise<Set<string>> {
  const [retired, openDamage, openMaintenance] = await Promise.all([
    prisma.machine.findMany({ where: { isRetired: true }, select: { id: true } }),
    prisma.damageReport.findMany({ where: { resolvedAt: null }, select: { machineId: true } }),
    prisma.maintenanceEvent.findMany({ where: { completedDate: null }, select: { machineId: true } })
  ]);
  const ids = new Set<string>();
  for (const m of retired) ids.add(m.id);
  for (const d of openDamage) ids.add(d.machineId);
  for (const m of openMaintenance) ids.add(m.machineId);
  return ids;
}
