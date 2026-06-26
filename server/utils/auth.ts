import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// In-memory token revocation table.
// When a user changes their password, any token issued before that moment is rejected.
// Ephemeral (cleared on restart), but protects active sessions on single-process deploys.
const tokenRevokedAfter = new Map<string, number>(); // userId → epoch ms

export function revokeUserTokens(userId: string): void {
  tokenRevokedAfter.set(userId, Date.now());
}

export function isTokenRevoked(userId: string, iatSeconds: number): boolean {
  const threshold = tokenRevokedAfter.get(userId);
  if (!threshold) return false;
  return iatSeconds * 1000 < threshold;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Server cannot start in production without it.");
  }
  console.warn("[AUTH] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET before deploying.");
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-only-huurgo-jwt-secret-do-not-use-in-prod";

export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
