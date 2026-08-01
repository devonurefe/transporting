import { Request, Response, NextFunction } from "express";
import { verifyToken, isTokenVersionValid } from "../utils/auth.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    v?: number;
    iat?: number;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  // Alleen volwaardige sessietokens krijgen req.user. Tokens zonder role-claim
  // (zoals het 2FA pre-auth token) mogen nooit als sessie gelden.
  if (decoded && typeof decoded.role === "string" && decoded.role.length > 0) {
    req.user = decoded;
  }
  next();
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Inloggen vereist" });
  }
  const valid = await isTokenVersionValid(req.user.id, req.user.role, req.user.v ?? 0);
  if (!valid) {
    return res.status(401).json({ error: "Sessie verlopen, log opnieuw in" });
  }
  next();
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Toegang geweigerd. Beheerderstoegang vereist." });
  }
  const valid = await isTokenVersionValid(req.user.id, req.user.role, req.user.v ?? 0);
  if (!valid) {
    return res.status(401).json({ error: "Sessie verlopen, log opnieuw in" });
  }
  next();
}

// For routes that stay reachable without auth (public feeds) but branch to a
// richer/admin-only response when the caller IS an admin — e.g. ?full=1 on
// GET /site-config or GET /machines, ?all=1 on GET /blog. A plain
// `req.user?.role === "admin"` check only verifies the JWT's role claim, not
// tokenVersion, so a just-disabled admin's still-cryptographically-valid
// token (up to 12h left) would keep unlocking the admin branch even though
// every mutating endpoint (via requireAdmin) already revokes them
// immediately. Use this instead wherever that branch exposes non-public data.
export async function isValidAdminSession(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user || req.user.role !== "admin") return false;
  return isTokenVersionValid(req.user.id, req.user.role, req.user.v ?? 0);
}
