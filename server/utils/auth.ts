import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../prisma/client.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Server cannot start in production without it.");
  }
  console.warn("[AUTH] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET before deploying.");
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-only-huurgo-jwt-secret-do-not-use-in-prod";

// Admins hebben destructieve rechten → korte sessies; klanten houden 7 dagen
// (opnieuw inloggen kost conversie, klantacties zijn ownership-gecheckt).
const ADMIN_TOKEN_TTL = "12h";
const CUSTOMER_TOKEN_TTL = "7d";

export function generateToken(payload: { id: string; email: string; role: string; v?: number }): string {
  return jwt.sign(
    { ...payload, v: payload.v ?? 0 },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: payload.role === "admin" ? ADMIN_TOKEN_TTL : CUSTOMER_TOKEN_TTL }
  );
}

// Tussenstap-token voor 2FA: wachtwoord klopt, TOTP-code moet nog. Bevat GEEN
// role-claim, dus authenticateToken wijst het af als sessietoken — het is
// uitsluitend bruikbaar op POST /api/auth/login/2fa.
export function generatePreAuthToken(id: string): string {
  return jwt.sign({ id, stage: "2fa" }, EFFECTIVE_JWT_SECRET, { expiresIn: "5m" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB-backed token-revocatie via Admin/Customer.tokenVersion.
// Elke JWT draagt claim `v`; wijkt die af van de DB-waarde (na wachtwoordwijziging,
// reset of account-deactivatie) dan is de sessie ongeldig. Een 60s TTL-cache
// vermijdt een DB-hit per request; invalidateAuthCache() maakt revocatie
// in-process direct effectief, cross-process binnen 60s.
// ---------------------------------------------------------------------------

const AUTH_CACHE_TTL_MS = 60 * 1000;
const authVersionCache = new Map<string, { version: number; isActive: boolean; expiresAt: number }>();

export function invalidateAuthCache(userId: string): void {
  authVersionCache.delete(userId);
}

export async function isTokenVersionValid(userId: string, role: string, tokenVersion: number): Promise<boolean> {
  const cached = authVersionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isActive && cached.version === tokenVersion;
  }

  try {
    let record: { tokenVersion: number; isActive?: boolean } | null;
    if (role === "admin") {
      record = await prisma.admin.findUnique({
        where: { id: userId },
        select: { tokenVersion: true, isActive: true }
      });
    } else {
      record = await prisma.customer.findUnique({
        where: { id: userId },
        select: { tokenVersion: true }
      });
    }
    if (!record) return false; // account verwijderd → token ongeldig

    const entry = {
      version: record.tokenVersion,
      isActive: record.isActive ?? true,
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS
    };
    authVersionCache.set(userId, entry);
    return entry.isActive && entry.version === tokenVersion;
  } catch (err) {
    // Fail open bij een tijdelijke DB-storing: een korte outage mag niet
    // iedereen uitloggen. De JWT-handtekening + expiry gelden nog steeds.
    console.error("[AUTH] tokenVersion-check mislukt, request toegestaan:", err);
    return true;
  }
}

// sha256 van reset-/verificatietokens: de DB bevat nooit het bruikbare token,
// alleen de hash. Het ruwe token gaat uitsluitend per e-mail naar de gebruiker.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
