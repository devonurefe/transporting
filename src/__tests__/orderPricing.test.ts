import { describe, it, expect } from "vitest";
import { computeOrderSubtotal, computeTransport, computeAddonsTotal, computeVatAndTotal, computeRentalDays } from "../../server/utils/orderPricing";
import { DEFAULT_TRANSPORT_FEES, DEFAULT_GLOBAL_ADDONS } from "../../server/utils/fees";
import { calculateItemSubtotal } from "../utils/pricing";
import { Machine, CampaignRule } from "../types";

// The server-side computeOrderSubtotal MUST mirror the frontend
// calculateItemSubtotal exactly, or orders fail with "Totaalbedrag klopt niet".
// This cross-checks them over a matrix so any drift is caught without a DB.

const noRules: CampaignRule[] = [];

// Representative machines covering every pricing path.
const machines: Record<string, any> = {
  // New Nifty 120 (weekend rules on, 1-day campaign)
  nifty120: {
    id: "nifty-120-1", category: "aanhanger", pricePerDay: 120, oneDayPrice: 60,
    twoDayPrice: 205, threeDayPrice: 275, fourDayPrice: 295, weeklyPrice: 315,
    extraDayPrice: 74, weekendPrice: 185, monthlyPrice: 850, sundayBlockFee: 70,
    weekendRulesEnabled: true,
  },
  // New Hinowa 17.75 (weekend rules on, no 1-day campaign)
  hinowa1775: {
    id: "hinowa-17-75", category: "spin", pricePerDay: 275,
    twoDayPrice: 475, threeDayPrice: 625, fourDayPrice: 675, weeklyPrice: 725,
    extraDayPrice: 170, weekendPrice: 425, monthlyPrice: 1950, sundayBlockFee: 150,
    weekendRulesEnabled: true,
  },
  // Legacy machine (no weekend rules)
  legacy: {
    id: "legacy-1", category: "schaarlift", pricePerDay: 95, oneDayPrice: 50,
    twoDayPrice: 190, weekendPrice: 150, weeklyPrice: 335, monthlyPrice: 490,
  },
  // Weekly-only kamersteiger
  kamersteiger: {
    id: "altrex-rs44", category: "kamersteiger", pricePerDay: 19,
    twoDayPrice: 15, weeklyPrice: 19, weeklyOnly: false, minRentalDays: 2,
  },
  // Percentage-fallback machine (no flat rates)
  basic: {
    id: "basic-1", category: "schaarlift", pricePerDay: 100,
    weeklyDiscountPercent: 10, monthlyDiscountPercent: 20,
  },
};

// A spread of start days (Mon..Sun) and day counts hitting every tier boundary.
const startDates = [
  "2026-06-08", // Monday
  "2026-06-11", // Thursday
  "2026-06-12", // Friday
  "2026-06-13", // Saturday
  "2026-06-14", // Sunday
];
const dayCounts = [1, 2, 3, 4, 5, 6, 7, 8, 12, 27, 28, 30, 31, 33, 56];

describe("computeOrderSubtotal mirrors frontend calculateItemSubtotal", () => {
  for (const [name, machine] of Object.entries(machines)) {
    for (const sd of startDates) {
      for (const days of dayCounts) {
        it(`${name} · ${sd} · ${days}d → server === client`, () => {
          const client = calculateItemSubtotal(machine as Machine, days, "Particulier", noRules, sd);
          const server = computeOrderSubtotal(machine, days, new Date(sd), noRules, "Particulier");
          expect(server).toBe(client);
        });
      }
    }
  }
});

describe("computeOrderSubtotal with campaign rules", () => {
  const rules: CampaignRule[] = [
    { id: "r1", name: "10% globaal", scope: "global", scopeValue: "", discountPercent: 10, isActive: true },
  ] as CampaignRule[];
  for (const sd of ["2026-06-08", "2026-06-13"]) {
    for (const days of [1, 2, 3, 5, 30]) {
      it(`nifty120 campaign · ${sd} · ${days}d → server === client`, () => {
        const client = calculateItemSubtotal(machines.nifty120 as Machine, days, "Particulier", rules, sd);
        const server = computeOrderSubtotal(machines.nifty120, days, new Date(sd), rules, "Particulier");
        expect(server).toBe(client);
      });
    }
  }
});

describe("computeRentalDays", () => {
  it("inclusive day count (10th–12th = 3 days)", () => {
    expect(computeRentalDays(new Date("2026-06-10"), new Date("2026-06-12"))).toBe(3);
  });
  it("same day = 1 day", () => {
    expect(computeRentalDays(new Date("2026-06-10"), new Date("2026-06-10"))).toBe(1);
  });
});

describe("computeTransport", () => {
  const fees = { ...DEFAULT_TRANSPORT_FEES, addons: DEFAULT_GLOBAL_ADDONS } as any;
  it("self pickup = 0", () => expect(computeTransport("self_pickup", 5, fees)).toBe(0));
  it("delivery = flat delivery fee", () => expect(computeTransport("delivery_by_us", 5, fees)).toBe(150));
  it("trailer = perDay × days", () => expect(computeTransport("trailer_rental", 4, fees)).toBe(100));
});

describe("computeAddonsTotal", () => {
  const fees = { ...DEFAULT_TRANSPORT_FEES, addons: DEFAULT_GLOBAL_ADDONS } as any;
  it("safety add-on = pricePerWeek × started weeks", () => {
    const r = computeAddonsTotal(machines.legacy, 8, [{ id: "safety" }], fees);
    expect(r).toEqual({ total: 15 * 2 }); // 8 days → 2 weeks
  });
  it("rijplaten quantity-based", () => {
    const r = computeAddonsTotal(machines.legacy, 5, [{ id: "rijplaten", quantity: 3 }], fees);
    expect(r).toEqual({ total: 6 * 1 * 3 });
  });
  it("rejects invalid rijplaten quantity", () => {
    const r = computeAddonsTotal(machines.legacy, 5, [{ id: "rijplaten", quantity: 0 }], fees);
    expect(r).toEqual({ error: "Ongeldig aantal rijplaten" });
  });
  it("rejects rijplaten on excluded category (aanhanger)", () => {
    const r = computeAddonsTotal(machines.nifty120, 5, [{ id: "rijplaten", quantity: 1 }], fees);
    expect(r).toEqual({ error: "Ongeldige toevoeging in bestelling" });
  });
  it("rejects unknown add-on id", () => {
    const r = computeAddonsTotal(machines.legacy, 5, [{ id: "nonsense" }], fees);
    expect(r).toEqual({ error: "Ongeldige toevoeging in bestelling" });
  });
});

describe("computeVatAndTotal", () => {
  it("21% VAT on the sum, 2 decimals", () => {
    const { vat, total } = computeVatAndTotal(100, 150, 0, 15);
    expect(vat).toBeCloseTo(55.65, 2);
    expect(total).toBeCloseTo(320.65, 2);
  });
});
