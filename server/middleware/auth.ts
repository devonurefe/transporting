import { Request, Response, NextFunction } from "express";
import { verifyToken, isTokenRevoked } from "../utils/auth.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
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
  if (decoded) {
    req.user = decoded;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Inloggen vereist" });
  }
  if (req.user.id && req.user.iat && isTokenRevoked(req.user.id, req.user.iat)) {
    return res.status(401).json({ error: "Sessie verlopen na wachtwoordwijziging, log opnieuw in" });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Toegang geweigerd. Beheerderstoegang vereist." });
  }
  if (req.user.id && req.user.iat && isTokenRevoked(req.user.id, req.user.iat)) {
    return res.status(401).json({ error: "Sessie verlopen na wachtwoordwijziging, log opnieuw in" });
  }
  next();
}
