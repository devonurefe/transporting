/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit-tests voor de beveiligingskern van Fase "admin security":
 * tokenVersion-claims in de JWT, sha256-tokenhashing en het wachtwoordbeleid.
 * Geen database nodig — alleen pure helpers.
 */
import { describe, it, expect } from "vitest";

process.env.JWT_SECRET ||= "unit-test-secret";

const { generateToken, verifyToken, hashToken } = await import("../../server/utils/auth.js");
const { PASSWORD_POLICY } = await import("../../server/routes/auth.js");

describe("JWT tokenVersion & expiry", () => {
  it("neemt de tokenVersion op als claim `v` (default 0)", () => {
    const withV = verifyToken(generateToken({ id: "u1", email: "a@b.nl", role: "admin", v: 3 }));
    expect(withV.v).toBe(3);

    const withoutV = verifyToken(generateToken({ id: "u1", email: "a@b.nl", role: "customer" }));
    expect(withoutV.v).toBe(0);
  });

  it("geeft admins 12 uur en klanten 7 dagen geldigheid", () => {
    const admin = verifyToken(generateToken({ id: "u1", email: "a@b.nl", role: "admin" }));
    const customer = verifyToken(generateToken({ id: "u2", email: "c@d.nl", role: "customer" }));
    const adminTtl = admin.exp - admin.iat;
    const customerTtl = customer.exp - customer.iat;
    expect(adminTtl).toBe(12 * 60 * 60);
    expect(customerTtl).toBe(7 * 24 * 60 * 60);
  });

  it("verwerpt tokens met een fout secret", () => {
    expect(verifyToken("not.a.token")).toBeNull();
  });
});

describe("hashToken (reset-/verificatietokens)", () => {
  it("levert een deterministische sha256-hex van 64 tekens", () => {
    const a = hashToken("abc123");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc123")).toBe(a);
    expect(hashToken("abc124")).not.toBe(a);
  });

  it("is nooit gelijk aan het ruwe token (DB bevat nooit het bruikbare token)", () => {
    const raw = "e".repeat(64);
    expect(hashToken(raw)).not.toBe(raw);
  });
});

describe("PASSWORD_POLICY", () => {
  const cases: Array<[string, boolean]> = [
    ["kort1a", false],            // te kort (< 10)
    ["negentekens1", true],       // 12 tekens, letter + cijfer
    ["alleenletterslang", false], // geen cijfer
    ["1234567890", false],        // geen letter
    ["wachtwoord123", true],
    ["a1a1a1a1a1", true],         // precies 10
    ["a1a1a1a1a", false],         // 9 tekens
  ];

  for (const [pw, ok] of cases) {
    it(`${ok ? "accepteert" : "verwerpt"} "${pw}"`, () => {
      expect(PASSWORD_POLICY.safeParse(pw).success).toBe(ok);
    });
  }
});
