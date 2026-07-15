import type { Request } from "express";
import { prisma } from "../../prisma/client.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

// Max serialized meta size — voorkomt dat grote request-bodies (base64-afbeeldingen
// uit Machine PUT's) in de audittabel belanden. Log veldnamen, nooit hele bodies.
const META_MAX_CHARS = 2000;

const AUDIT_RETENTION_DAYS = 180;

export interface AuditRowInput {
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  // Override wanneer req.user ontbreekt (bv. mislukte login op bekend e-mailadres)
  actor?: { id?: string; email?: string; role?: string };
}

export interface AuditRow {
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | undefined;
  ip: string | null;
}

// Pure rij-bouwer, apart geëxporteerd zodat vitest hem zonder Prisma kan testen.
export function buildAuditRow(
  user: { id?: string; email?: string; role?: string } | undefined,
  ip: string | undefined,
  input: AuditRowInput
): AuditRow {
  const actor = input.actor ?? user;
  let meta = input.meta;
  if (meta !== undefined) {
    try {
      if (JSON.stringify(meta).length > META_MAX_CHARS) meta = { truncated: true };
    } catch {
      meta = { truncated: true };
    }
  }
  return {
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? "anonymous",
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    meta,
    ip: ip ?? null
  };
}

// Fire-and-forget: een auditfout mag nooit het business-request laten falen.
export function audit(req: AuthenticatedRequest | Request, action: string, opts: Omit<AuditRowInput, "action"> = {}): void {
  const row = buildAuditRow((req as AuthenticatedRequest).user, req.ip, { action, ...opts });
  prisma.auditLog
    .create({ data: { ...row, meta: row.meta as object | undefined } })
    .catch((err) => console.error("[Audit] Schrijven mislukt (genegeerd):", err));
}

// Dagelijks aangeroepen vanuit de reminder-cron in server.ts.
export async function pruneAuditLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) console.log(`[Audit] ${count} logregels ouder dan ${AUDIT_RETENTION_DAYS} dagen opgeruimd`);
  } catch (err) {
    console.error("[Audit] Opruimen mislukt:", err);
  }
}
