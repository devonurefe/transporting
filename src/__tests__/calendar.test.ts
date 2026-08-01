/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit-tests voor de iCal-feed regelvouwing (RFC 5545, <=75 octets). Moet
 * UTF-8-byte-bewust zijn en nooit een surrogate pair (bv. een emoji)
 * doormidden knippen — anders levert een geëxporteerde .ics-regel U+FFFD op
 * zodra deze als UTF-8-bytes wordt verstuurd.
 */
import { describe, it, expect } from "vitest";

process.env.JWT_SECRET ||= "unit-test-secret";

const { foldLine } = await import("../../server/routes/calendar.js");

describe("foldLine", () => {
  it("laat korte regels ongewijzigd", () => {
    expect(foldLine("SUMMARY:Korte regel")).toBe("SUMMARY:Korte regel");
  });

  it("elke gevouwen regel blijft binnen 75 octets (UTF-8)", () => {
    const line = "SUMMARY:" + "é".repeat(80); // 2 UTF-8 bytes per é
    const folded = foldLine(line).split("\r\n");
    for (const part of folded) {
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("splitst nooit een surrogate pair (emoji) over een vouwgrens", () => {
    // Kies een lengte die het 🔒-teken exact op de 73e/74e byte-grens duwt.
    const prefix = "x".repeat(72);
    const line = `SUMMARY:${prefix}🔒 Geblokkeerd`;
    const folded = foldLine(line).split("\r\n").map((p) => p.replace(/^ /, ""));
    const rejoined = folded.join("");
    expect(rejoined).not.toContain("�");
    expect(rejoined).toContain("🔒");
  });

  it("regel zonder vouwing blijft geldig gejoined (round-trip)", () => {
    const line = "SUMMARY:🔒 Geblokkeerd — Dingli 6m";
    expect(foldLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});
