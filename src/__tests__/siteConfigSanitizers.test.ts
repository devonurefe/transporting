/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit-tests voor de AdminContent-sanitizers (server/utils/sanitizeContent.ts):
 * caps, malformed-drop, icon-whitelist, fee-clamping en de data:image-guard.
 */
import { describe, it, expect } from "vitest";

process.env.JWT_SECRET ||= "unit-test-secret";
const {
  sanitizeFaqItems,
  sanitizeUspItems,
  sanitizeOpeningHours,
  sanitizeTransportFees,
  sanitizeGlobalAddons,
  sanitizeLegalContent,
  USP_ICONS
} = await import("../../server/utils/sanitizeContent.js");

describe("sanitizeFaqItems", () => {
  it("laat geldige items door en dropt lege q/a", () => {
    const result = sanitizeFaqItems([{ q: "Vraag?", a: "Antwoord." }, { q: "", a: "leeg-q" }, { q: "leeg-a", a: "" }]);
    expect(result).toEqual([{ q: "Vraag?", a: "Antwoord." }]);
  });
  it("capt op 40 items", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    expect(sanitizeFaqItems(many)).toHaveLength(40);
  });
  it("capt q op 200 en a op 2000 tekens", () => {
    const [item] = sanitizeFaqItems([{ q: "x".repeat(300), a: "y".repeat(3000) }])!;
    expect(item.q).toHaveLength(200);
    expect(item.a).toHaveLength(2000);
  });
  it("geeft null terug voor niet-array input", () => {
    expect(sanitizeFaqItems("niet-een-array")).toBeNull();
    expect(sanitizeFaqItems(null)).toBeNull();
  });
  it("weert data:image in tekstvelden", () => {
    const result = sanitizeFaqItems([{ q: "data:image/png;base64,abc", a: "normaal antwoord" }]);
    expect(result).toEqual([]); // q wordt leeg → item gedropt
  });
});

describe("sanitizeUspItems", () => {
  it("valt terug op 'shield' voor een onbekend icoon", () => {
    const [item] = sanitizeUspItems([{ icon: "rocket", title: "T", text: "Body" }])!;
    expect(item.icon).toBe("shield");
  });
  it("accepteert elk icoon uit de whitelist", () => {
    for (const icon of USP_ICONS) {
      const [item] = sanitizeUspItems([{ icon, title: "T", text: "Body" }])!;
      expect(item.icon).toBe(icon);
    }
  });
  it("capt op 8 items en dropt lege titel/tekst", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ icon: "shield", title: `T${i}`, text: `Body${i}` }));
    expect(sanitizeUspItems(many)).toHaveLength(8);
    expect(sanitizeUspItems([{ icon: "shield", title: "", text: "Body" }])).toEqual([]);
  });
});

describe("sanitizeOpeningHours", () => {
  it("accepteert een gedeeltelijk object", () => {
    expect(sanitizeOpeningHours({ monFri: "Ma-Vr 08-17" })).toEqual({ monFri: "Ma-Vr 08-17", sat: "", sun: "" });
  });
  it("geeft null terug wanneer alle velden leeg zijn", () => {
    expect(sanitizeOpeningHours({ monFri: "", sat: "", sun: "" })).toBeNull();
    expect(sanitizeOpeningHours(null)).toBeNull();
  });
  it("capt elk veld op 60 tekens", () => {
    const result = sanitizeOpeningHours({ monFri: "x".repeat(100) })!;
    expect(result.monFri).toHaveLength(60);
  });
});

describe("sanitizeTransportFees", () => {
  it("accepteert geldige tarieven binnen [0,1000]", () => {
    expect(sanitizeTransportFees({ deliveryFee: 150, trailerPerDay: 25 })).toEqual({ deliveryFee: 150, trailerPerDay: 25 });
  });
  it("weigert het hele object bij één ongeldig veld (geen halve prijs-spiegel)", () => {
    expect(sanitizeTransportFees({ deliveryFee: 150, trailerPerDay: -5 })).toBeNull();
    expect(sanitizeTransportFees({ deliveryFee: 5000, trailerPerDay: 25 })).toBeNull();
    expect(sanitizeTransportFees({ deliveryFee: 150 })).toBeNull(); // trailerPerDay ontbreekt
  });
  it("rondt af op 2 decimalen", () => {
    expect(sanitizeTransportFees({ deliveryFee: 150.999, trailerPerDay: 25 })!.deliveryFee).toBe(151);
  });
});

describe("sanitizeGlobalAddons", () => {
  it("accepteert geldige add-ons en valt terug op de default-naam", () => {
    const result = sanitizeGlobalAddons({ safety: { pricePerWeek: 20 }, rijplaten: { name: "Platen", pricePerWeek: 7 } })!;
    expect(result.safety).toEqual({ name: "Veiligheidsset Pro", pricePerWeek: 20 });
    expect(result.rijplaten).toEqual({ name: "Platen", pricePerWeek: 7 });
  });
  it("geeft null terug wanneer een van beide prijzen ontbreekt/ongeldig is", () => {
    expect(sanitizeGlobalAddons({ safety: { pricePerWeek: 20 } })).toBeNull();
    expect(sanitizeGlobalAddons({ safety: { pricePerWeek: -1 }, rijplaten: { pricePerWeek: 6 } })).toBeNull();
  });
});

describe("sanitizeLegalContent", () => {
  it("capt op 60.000 tekens", () => {
    expect(sanitizeLegalContent("x".repeat(70_000))).toHaveLength(60_000);
  });
  it("verwijdert data:image-payloads uit markdown", () => {
    const result = sanitizeLegalContent("Tekst met data:image/png;base64,AAAA erin en verder normale tekst.")!;
    expect(result).not.toContain("data:image");
  });
  it("geeft null terug voor niet-string input", () => {
    expect(sanitizeLegalContent(null)).toBeNull();
    expect(sanitizeLegalContent(123)).toBeNull();
  });
});
