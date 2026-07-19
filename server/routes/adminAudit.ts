import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin } from "../middleware/auth.js";

export const adminAuditRouter = Router();

// Filtergroepen voor het AdminLogs-paneel: één chip dekt meerdere action-prefixen.
const GROUP_PREFIXES: Record<string, string[]> = {
  auth: ["login.", "password.", "admin.", "2fa."],
  orders: ["order."],
  machines: ["machine.", "blockeddate."],
  customers: ["customer."],
  settings: ["siteconfig.", "campaignrules.", "categories.", "advisorconfig.", "blog."]
};

export function clampPagination(pageRaw: unknown, limitRaw: unknown): { page: number; limit: number } {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 50));
  return { page, limit };
}

// GET /api/admin/audit-logs — gepagineerde audittrail voor het Logs-paneel
adminAuditRouter.get("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);

    const where: Record<string, unknown> = {};
    const group = typeof req.query.group === "string" ? req.query.group : "";
    if (group && GROUP_PREFIXES[group]) {
      where.OR = GROUP_PREFIXES[group].map((p) => ({ action: { startsWith: p } }));
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q) {
      where.actorEmail = { contains: q, mode: "insensitive" };
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return res.json({ logs, totalCount, page, totalPages: Math.ceil(totalCount / limit) });
  } catch (error) {
    console.error("Audit logs fetch error:", error);
    return res.status(500).json({ error: "Logboek ophalen mislukt" });
  }
});
