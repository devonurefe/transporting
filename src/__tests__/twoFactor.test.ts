/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit-tests voor tweestapsverificatie en beheerdersbeheer:
 * TOTP-secret-encryptie, otplib-verificatie, pre-auth-token-isolatie
 * (mag nooit als sessietoken gelden) en de self-lockout-guard.
 */
import { describe, it, expect } from "vitest";
import { generateSecret, generateSync, verifySync } from "otplib";

process.env.JWT_SECRET ||= "unit-test-secret";

const { encryptSecret, decryptSecret } = await import("../../server/utils/crypto.js");
const { generatePreAuthToken, verifyToken } = await import("../../server/utils/auth.js");
const { canDisable } = await import("../../server/routes/admins.js");

describe("TOTP-secret encryptie (AES-256-GCM)", () => {
  it("encrypt/decrypt round-trip", () => {
    const secret = generateSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(stored.split(":")).toHaveLength(3);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it("levert per aanroep een andere ciphertext (random IV)", () => {
    expect(encryptSecret("zelfde")).not.toBe(encryptSecret("zelfde"));
  });

  it("geeft null terug voor corrupte of vervalste input", () => {
    expect(decryptSecret("niet-geldig")).toBeNull();
    expect(decryptSecret("")).toBeNull();
    const valid = encryptSecret("secret");
    const [iv, tag, data] = valid.split(":");
    // Vervalste authenticatietag → GCM-verificatie faalt
    expect(decryptSecret(`${iv}:${Buffer.from("x".repeat(16)).toString("base64")}:${data}`)).toBeNull();
  });
});

describe("otplib verificatie", () => {
  it("accepteert een vers gegenereerde code en verwerpt een foute", () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    expect(verifySync({ secret, token: code, epochTolerance: 30 }).valid).toBe(true);
    // "000000" kan theoretisch de echte code zijn — vergelijk daarom expliciet
    const bogus = code === "000000" ? "111111" : "000000";
    expect(verifySync({ secret, token: bogus, epochTolerance: 30 }).valid).toBe(false);
  });
});

describe("pre-auth token isolatie", () => {
  it("bevat stage='2fa' en GEEN role-claim", () => {
    const payload = verifyToken(generatePreAuthToken("adm-1"));
    expect(payload.stage).toBe("2fa");
    expect(payload.id).toBe("adm-1");
    expect(payload.role).toBeUndefined();
  });

  it("wordt door authenticateToken nooit als sessie geaccepteerd (role-check)", () => {
    // authenticateToken zet req.user alleen bij een niet-lege role-claim —
    // hier valideren we dezelfde voorwaarde tegen het pre-auth payload.
    const payload = verifyToken(generatePreAuthToken("adm-1"));
    const wouldBeAccepted = !!(payload && typeof payload.role === "string" && payload.role.length > 0);
    expect(wouldBeAccepted).toBe(false);
  });

  it("verloopt na 5 minuten", () => {
    const payload = verifyToken(generatePreAuthToken("adm-1"));
    expect(payload.exp - payload.iat).toBe(5 * 60);
  });
});

describe("canDisable (self-lockout guard)", () => {
  it("weigert het eigen account", () => {
    expect(canDisable("a", "a", true, 3).ok).toBe(false);
  });
  it("weigert de laatste actieve beheerder", () => {
    expect(canDisable("b", "a", true, 1).ok).toBe(false);
  });
  it("staat deactiveren toe met meerdere actieve beheerders", () => {
    expect(canDisable("b", "a", true, 2).ok).toBe(true);
  });
  it("een al-gedeactiveerde beheerder telt niet tegen het minimum", () => {
    expect(canDisable("b", "a", false, 1).ok).toBe(true);
  });
});
