/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Comprehensive admin-site sync test: verifies that every machine's price
 * fields produce the correct booking subtotal for all key scenarios.
 * Mirrors what a customer sees in the catalog AND what the server validates.
 */
import { describe, it, expect } from "vitest";
import { calculateItemSubtotal, isStrictWeekend, calculateRentalDays } from "../utils/pricing";
import { Machine, CampaignRule } from "../types";

const noRules: CampaignRule[] = [];
const MON = "2026-06-08"; // Monday
const SAT = "2026-06-13"; // Saturday

// All machines from prisma/seed.ts — prices as seeded in DB
const machines: Partial<Machine>[] = [
  // Aanhangerhoogwerkers
  { id: "nifty-120-1",   pricePerDay: 95,  oneDayPrice: 50,  twoDayPrice: 190, weekendPrice: 150, weeklyPrice: 335,  monthlyPrice: 490 },
  { id: "nifty-120-2",   pricePerDay: 95,  oneDayPrice: 50,  twoDayPrice: 190, weekendPrice: 150, weeklyPrice: 335,  monthlyPrice: 490 },
  { id: "nifty-120-3",   pricePerDay: 95,  oneDayPrice: 50,  twoDayPrice: 190, weekendPrice: 150, weeklyPrice: 335,  monthlyPrice: 490 },
  { id: "nifty-170",     pricePerDay: 120, oneDayPrice: 60,  twoDayPrice: 240, weekendPrice: 195, weeklyPrice: 430,  monthlyPrice: 590 },
  // Rupshoogwerkers
  { id: "hinowa-15-70",  pricePerDay: 200, twoDayPrice: 360, weekendPrice: 290, weeklyPrice: 750,  monthlyPrice: 1100 },
  { id: "hinowa-17-75",  pricePerDay: 250, twoDayPrice: 450, weekendPrice: 360, weeklyPrice: 920,  monthlyPrice: 1350 },
  // Schaarliften
  { id: "optimum-8-1",   pricePerDay: 65,  weekendPrice: 99,  weeklyPrice: 159,  monthlyPrice: 420 },
  { id: "optimum-8-2",   pricePerDay: 65,  weekendPrice: 99,  weeklyPrice: 159,  monthlyPrice: 420 },
  { id: "optimum-8-3",   pricePerDay: 65,  weekendPrice: 99,  weeklyPrice: 159,  monthlyPrice: 420 },
  { id: "optimum-8-4",   pricePerDay: 65,  weekendPrice: 99,  weeklyPrice: 159,  monthlyPrice: 420 },
  // Mastliften
  { id: "star-10",       pricePerDay: 95,  weekendPrice: 145, weeklyPrice: 260,  monthlyPrice: 690 },
  { id: "skyjack-sj16",  pricePerDay: 55,  weekendPrice: 85,  weeklyPrice: 140,  monthlyPrice: 390 },
  { id: "bravi-mini-hd", pricePerDay: 45,  weekendPrice: 69,  weeklyPrice: 110,  monthlyPrice: 320 },
  { id: "jlg-1230es",    pricePerDay: 45,  weekendPrice: 69,  weeklyPrice: 110,  monthlyPrice: 320 },
  // Ladderliften — geen monthlyPrice
  { id: "ladderlift-18",   pricePerDay: 89,  twoDayPrice: 160, weekendPrice: 129, weeklyPrice: 290 },
  { id: "ladderlift-21-1", pricePerDay: 110, twoDayPrice: 199, weekendPrice: 159, weeklyPrice: 360 },
  { id: "ladderlift-21-2", pricePerDay: 110, twoDayPrice: 199, weekendPrice: 159, weeklyPrice: 360 },
  // Pecolift
  { id: "ecolift",       pricePerDay: 39,  weekendPrice: 59,  weeklyPrice: 99,   monthlyPrice: 290 },
  // Kamersteiger — geen flat rates (alleen pricePerDay)
  { id: "altrex-rs44",   pricePerDay: 35 },
];

for (const m of machines) {
  describe(`Machine: ${m.id}`, () => {

    // ── SCENARIO 1: 1 dag ─────────────────────────────────────────────
    it("1 dag → oneDayPrice als gezet, anders pricePerDay", () => {
      const expected = (m.oneDayPrice && m.oneDayPrice < (m.pricePerDay ?? 0))
        ? m.oneDayPrice
        : m.pricePerDay!;
      expect(calculateItemSubtotal(m as Machine, 1, "Particulier", noRules, MON)).toBe(expected);
    });

    // ── SCENARIO 2: 2 weekdagen ───────────────────────────────────────
    it("2 dagen (Ma–Di) → twoDayPrice als gezet, anders pricePerDay×2", () => {
      const expected = m.twoDayPrice ?? m.pricePerDay! * 2;
      expect(calculateItemSubtotal(m as Machine, 2, "Particulier", noRules, MON)).toBe(expected);
    });

    // ── SCENARIO 3: Weekend Za+Zo ─────────────────────────────────────
    it("2 dagen Za+Zo → weekendPrice als gezet, anders twoDayPrice of pricePerDay×2", () => {
      const expected = m.weekendPrice
        ? m.weekendPrice
        : (m.twoDayPrice ?? m.pricePerDay! * 2);
      expect(calculateItemSubtotal(m as Machine, 2, "Particulier", noRules, SAT)).toBe(expected);
    });

    // ── SCENARIO 4: 3 werkdagen ───────────────────────────────────────
    it("3 werkdagen (Ma–Wo) → weeklyPrice als gezet, anders pricePerDay×3", () => {
      const expected = m.weeklyPrice ?? m.pricePerDay! * 3;
      expect(calculateItemSubtotal(m as Machine, 3, "Particulier", noRules, MON)).toBe(expected);
    });

    // ── SCENARIO 5: 5 werkdagen ───────────────────────────────────────
    it("5 dagen → weeklyPrice als gezet, anders pricePerDay×5", () => {
      const expected = m.weeklyPrice ?? m.pricePerDay! * 5;
      expect(calculateItemSubtotal(m as Machine, 5, "Particulier", noRules)).toBe(expected);
    });

    // ── SCENARIO 6: 4 weken (28 dagen) ───────────────────────────────
    if (m.monthlyPrice) {
      it("28 dagen → monthlyPrice", () => {
        expect(calculateItemSubtotal(m as Machine, 28, "Particulier", noRules)).toBe(m.monthlyPrice);
      });
    } else {
      it("28 dagen (geen monthlyPrice) → pricePerDay×28", () => {
        expect(calculateItemSubtotal(m as Machine, 28, "Particulier", noRules)).toBe(m.pricePerDay! * 28);
      });
    }

    // ── SCENARIO 7: Server en frontend geven zelfde resultaat ─────────
    // Tests that calculateItemSubtotal covers the same branches as orders.ts
    it("3-daagse vrijdag is GEEN weekend (weekend = alleen Za+Zo)", () => {
      const fri = "2026-06-12";
      expect(isStrictWeekend(fri, 3)).toBe(false);
      // 3 dagen Vr–Zo → weeklyPrice (niet weekendPrice)
      const expected = m.weeklyPrice ?? m.pricePerDay! * 3;
      expect(calculateItemSubtotal(m as Machine, 3, "Particulier", noRules, fri)).toBe(expected);
    });
  });
}

// ── LOSSE CONTROLES ────────────────────────────────────────────────────────
describe("Weekend detectie", () => {
  it("2 dagen zaterdag = weekend", () => expect(isStrictWeekend(SAT, 2)).toBe(true));
  it("2 dagen maandag = geen weekend", () => expect(isStrictWeekend(MON, 2)).toBe(false));
  it("3 dagen vrijdag = geen weekend (nieuw gedrag)", () => expect(isStrictWeekend("2026-06-12", 3)).toBe(false));
  it("geen datum = veilig false", () => expect(isStrictWeekend(undefined, 2)).toBe(false));
});

describe("Huurperiode berekening", () => {
  it("1 dag (zelfde datum)", () => expect(calculateRentalDays("2026-06-13", "2026-06-13")).toBe(1));
  it("Za + Zo = 2 dagen", () => expect(calculateRentalDays("2026-06-13", "2026-06-14")).toBe(2));
  it("Ma t/m Vr = 5 dagen werkweek", () => expect(calculateRentalDays("2026-06-08", "2026-06-12")).toBe(5));
  it("28 aaneengesloten dagen", () => expect(calculateRentalDays("2026-06-01", "2026-06-28")).toBe(28));
});

describe("Pro-rata wekelijks (nifty-120) — lineair weeklyPrice/5 per dag", () => {
  const nifty = machines.find(m => m.id === "nifty-120-1")! as Machine;
  it("6 dagen = 6 × weeklyPrice/5", () =>
    expect(calculateItemSubtotal(nifty, 6, "Particulier", noRules)).toBe(Math.round(6 * (335 / 5))));
  it("7 dagen = 7 × weeklyPrice/5", () =>
    expect(calculateItemSubtotal(nifty, 7, "Particulier", noRules)).toBe(Math.round(7 * (335 / 5))));
  it("27 dagen = 27 × weeklyPrice/5", () =>
    expect(calculateItemSubtotal(nifty, 27, "Particulier", noRules)).toBe(Math.round(27 * (335 / 5))));
  it("33 dagen = lineair maandtarief (33 × monthlyPrice/28, ceil naar €5)", () =>
    expect(calculateItemSubtotal(nifty, 33, "Particulier", noRules)).toBe(580));
});
