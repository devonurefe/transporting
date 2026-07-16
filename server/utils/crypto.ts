import crypto from "crypto";

// AES-256-GCM voor TOTP-secrets in de database: een DB-dump of backup-lek mag
// nooit gelijkstaan aan een volledige 2FA-bypass. De sleutel wordt afgeleid van
// JWT_SECRET (geen extra env-variabele nodig); het formaat is "iv:tag:cipher"
// in base64. Zonder JWT_SECRET (alleen dev) geldt dezelfde dev-fallback als in auth.ts.
const KEY = crypto
  .createHash("sha256")
  .update((process.env.JWT_SECRET || "dev-only-huurgo-jwt-secret-do-not-use-in-prod") + "|totp")
  .digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = stored.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // corrupt/vervalst → behandel als geen secret
  }
}
