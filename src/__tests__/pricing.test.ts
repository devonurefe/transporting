import { describe, it, expect } from "vitest";
import { calculateItemSubtotal, calculateRentalDays, evaluateDiscountPercent, isStrictWeekend, billableWeeks } from "../utils/pricing";
import { Machine, CampaignRule } from "../types";

// Reference weekdays (UTC): 2026-06-08 = Monday, 2026-06-12 = Friday, 2026-06-13 = Saturday
const MON = "2026-06-08";
const FRI = "2026-06-12";
const SAT = "2026-06-13";

// Nifty 120 — the real price card from the MB Hoogwerkers price list
const nifty120 = {
  id: "nifty-120-1",
  category: "aanhanger",
  pricePerDay: 95,
  oneDayPrice: 50,
  twoDayPrice: 190,
  weekendPrice: 150,
  weeklyPrice: 335,
  monthlyPrice: 490,
} as Machine;

// Machine without any flat rates — percentage fallback path
const basicMachine = {
  id: "basic-1",
  category: "schaarlift",
  pricePerDay: 100,
  weeklyDiscountPercent: 10,
  monthlyDiscountPercent: 20,
} as Machine;

const noRules: CampaignRule[] = [];

describe("calculateRentalDays", () => {
  it("counts inclusive days (10th–12th = 3 days)", () => {
    expect(calculateRentalDays("2026-06-10", "2026-06-12")).toBe(3);
  });
  it("same start and end date = 1 day", () => {
    expect(calculateRentalDays("2026-06-10", "2026-06-10")).toBe(1);
  });
  it("full week span", () => {
    expect(calculateRentalDays("2026-06-01", "2026-06-05")).toBe(5);
  });
});

describe("isStrictWeekend", () => {
  it("2 days starting Saturday = weekend", () => {
    expect(isStrictWeekend(SAT, 2)).toBe(true);
  });
  it("2 days starting Monday = not weekend", () => {
    expect(isStrictWeekend(MON, 2)).toBe(false);
  });
  it("3 days starting Friday = not weekend (weekend is Sat+Sun only)", () => {
    expect(isStrictWeekend(FRI, 3)).toBe(false);
  });
  it("3 days starting Monday = not weekend", () => {
    expect(isStrictWeekend(MON, 3)).toBe(false);
  });
  it("no date = not weekend (safe default)", () => {
    expect(isStrictWeekend(undefined, 2)).toBe(false);
  });
  it("1 day is never weekend", () => {
    expect(isStrictWeekend(SAT, 1)).toBe(false);
  });
});

describe("calculateItemSubtotal — flat rates", () => {
  it("1 day uses oneDayPrice actie", () => {
    expect(calculateItemSubtotal(nifty120, 1, "Particulier", noRules, MON)).toBe(50);
  });

  it("2 weekday days (Mon-Tue) use twoDayPrice, not weekendPrice", () => {
    expect(calculateItemSubtotal(nifty120, 2, "Particulier", noRules, MON)).toBe(190);
  });

  it("2 weekend days (Sat-Sun) use weekendPrice over twoDayPrice", () => {
    expect(calculateItemSubtotal(nifty120, 2, "Particulier", noRules, SAT)).toBe(150);
  });

  it("2 weekend days fall back to weekendPrice when no twoDayPrice", () => {
    const m = { ...nifty120, twoDayPrice: undefined } as Machine;
    expect(calculateItemSubtotal(m, 2, "Particulier", noRules, SAT)).toBe(150);
  });

  it("2 weekday days with no twoDayPrice → pricePerDay × 2", () => {
    const m = { ...nifty120, twoDayPrice: undefined } as Machine;
    expect(calculateItemSubtotal(m, 2, "Particulier", noRules, MON)).toBe(2 * 95);
  });

  it("3 days starting Friday → weeklyPrice (weekend is Sat+Sun only)", () => {
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules, FRI)).toBe(335);
  });

  it("3 weekday days (Mon-Wed) use weeklyPrice when available", () => {
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules, MON)).toBe(335);
  });

  it("4 days uses weeklyPrice when available", () => {
    expect(calculateItemSubtotal(nifty120, 4, "Particulier", noRules, MON)).toBe(335);
  });

  it("5 days uses weeklyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 5, "Particulier", noRules)).toBe(335);
  });

  it("6 days first linear rate day (round(6 * weeklyPrice/5))", () => {
    expect(calculateItemSubtotal(nifty120, 6, "Particulier", noRules)).toBe(Math.round(6 * 335 / 5));
  });

  it("7 days linear rate (round(7 * weeklyPrice/5))", () => {
    expect(calculateItemSubtotal(nifty120, 7, "Particulier", noRules)).toBe(Math.round(7 * 335 / 5));
  });

  it("8 days pro-rata is capped at the monthly price (Fix B)", () => {
    // round(8 * 335/5) = 536 > monthlyPrice 490 → capped at 490
    expect(calculateItemSubtotal(nifty120, 8, "Particulier", noRules)).toBe(490);
  });

  it("27 days pro-rata capped at the monthly price (Fix B)", () => {
    expect(calculateItemSubtotal(nifty120, 27, "Particulier", noRules)).toBe(490);
  });

  it("28 days uses monthlyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 28, "Particulier", noRules)).toBe(490);
  });

  it("31 days = 1 month + 3-day linear remainder (round(3 * weeklyPrice/5))", () => {
    expect(calculateItemSubtotal(nifty120, 31, "Particulier", noRules)).toBe(490 + Math.round(3 * 335 / 5));
  });

  it("33 days = 1 month + 5-day linear remainder (round(5 * weeklyPrice/5) = weeklyPrice)", () => {
    expect(calculateItemSubtotal(nifty120, 33, "Particulier", noRules)).toBe(490 + 335);
  });

  it("34 days = 1 month + 6-day linear remainder (round(6 * weeklyPrice/5))", () => {
    expect(calculateItemSubtotal(nifty120, 34, "Particulier", noRules)).toBe(490 + Math.round(6 * 335 / 5));
  });

  it("30 days = 1 month + 2 days at day rate", () => {
    expect(calculateItemSubtotal(nifty120, 30, "Particulier", noRules)).toBe(490 + 2 * 95);
  });

  it("56 days = 2 months", () => {
    expect(calculateItemSubtotal(nifty120, 56, "Particulier", noRules)).toBe(2 * 490);
  });
});

describe("calculateItemSubtotal — weekend 'niet werken' (tier on working days)", () => {
  // FRI = Friday. When the customer won't work the weekend, Sat+Sun drop out and the
  // normal tier table is applied to the remaining working days (owner's price sketch).
  it("5 days Fri→Tue, 'ja' (works weekend) → full werkweektarief", () => {
    expect(calculateItemSubtotal(nifty120, 5, "Particulier", noRules, FRI, "ja")).toBe(335);
  });

  it("5 days Fri→Tue, no answer → full werkweektarief (unchanged behaviour)", () => {
    expect(calculateItemSubtotal(nifty120, 5, "Particulier", noRules, FRI)).toBe(335);
  });

  it("4 days Fri→Mon, 'nee' → 2 working days → twoDayPrice", () => {
    expect(calculateItemSubtotal(nifty120, 4, "Particulier", noRules, FRI, "nee")).toBe(190);
  });

  it("5 days Fri→Tue, 'nee' → 3 working days → weeklyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 5, "Particulier", noRules, FRI, "nee")).toBe(335);
  });

  it("6 days Fri→Wed, 'nee' → 4 working days → weeklyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 6, "Particulier", noRules, FRI, "nee")).toBe(335);
  });

  it("7 days Fri→Thu, 'nee' → 5 working days → weeklyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 7, "Particulier", noRules, FRI, "nee")).toBe(335);
  });

  it("3 days Fri→Sun, 'nee' → 1 working day → oneDayPrice", () => {
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules, FRI, "nee")).toBe(50);
  });

  it("8 days Fri→Fri, 'nee' → 6 working days → pro-rata ladder (round(6 × weeklyPrice/5))", () => {
    expect(calculateItemSubtotal(nifty120, 8, "Particulier", noRules, FRI, "nee")).toBe(Math.round(6 * 335 / 5));
  });

  it("3 weekday days Mon→Wed, 'nee' → no weekend days, full werkweektarief", () => {
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules, MON, "nee")).toBe(335);
  });

  it("monthly 28+ days, 'nee' → discount does NOT apply (monthlyPrice unchanged)", () => {
    expect(calculateItemSubtotal(nifty120, 28, "Particulier", noRules, FRI, "nee")).toBe(490);
  });

  it("strict Sat+Sun 2-day, 'nee' → weekendPrice unchanged (not weekly basis)", () => {
    expect(calculateItemSubtotal(nifty120, 2, "Particulier", noRules, SAT, "nee")).toBe(150);
  });

  // optimum8 has no oneDayPrice/twoDayPrice → the 1- and 2-working-day tiers fall back
  // to pricePerDay × workingDays.
  const optimum8 = { id: "optimum-8", category: "schaarlift", pricePerDay: 65, weekendPrice: 99, weeklyPrice: 159, monthlyPrice: 420 } as Machine;
  it("3 days Fri→Sun, 'nee', 1 working day → pricePerDay (no oneDayPrice)", () => {
    expect(calculateItemSubtotal(optimum8, 3, "Particulier", noRules, FRI, "nee")).toBe(65);
  });
  it("4 days Fri→Mon, 'nee', 2 working days → pricePerDay × 2 (no twoDayPrice)", () => {
    expect(calculateItemSubtotal(optimum8, 4, "Particulier", noRules, FRI, "nee")).toBe(130);
  });
  it("5 days Fri→Tue, 'nee', 3 working days → weeklyPrice", () => {
    expect(calculateItemSubtotal(optimum8, 5, "Particulier", noRules, FRI, "nee")).toBe(159);
  });
});

describe("calculateItemSubtotal — percentage fallback", () => {
  it("3 days, no flat rates, no discount tier → plain day rate", () => {
    expect(calculateItemSubtotal(basicMachine, 3, "Particulier", noRules)).toBe(300);
  });

  it("7+ days applies weeklyDiscountPercent", () => {
    expect(calculateItemSubtotal(basicMachine, 10, "Particulier", noRules)).toBe(1000 * 0.9);
  });

  it("30+ days applies monthlyDiscountPercent", () => {
    expect(calculateItemSubtotal(basicMachine, 30, "Particulier", noRules)).toBe(3000 * 0.8);
  });

  it("campaignDiscountAmount is subtracted and result never negative", () => {
    const m = { ...basicMachine, campaignDiscountAmount: 5000 } as Machine;
    expect(calculateItemSubtotal(m, 3, "Particulier", noRules)).toBe(0);
  });
});

describe("evaluateDiscountPercent — campaign rules", () => {
  const rules: CampaignRule[] = [
    { id: "r1", name: "Schilder actie", scope: "role", scopeValue: "Schilder", discountPercent: 15, isActive: true },
    { id: "r2", name: "Inactief", scope: "global", scopeValue: "", discountPercent: 50, isActive: false },
  ] as CampaignRule[];

  it("role rule applies only to matching profile", () => {
    expect(evaluateDiscountPercent(basicMachine, 3, "Schilder", rules)).toBe(15);
    expect(evaluateDiscountPercent(basicMachine, 3, "Particulier", rules)).toBe(0);
  });

  it("inactive rules are ignored", () => {
    expect(evaluateDiscountPercent(basicMachine, 3, "Particulier", rules)).toBe(0);
  });

  it("highest discount wins between volume tier and rule", () => {
    expect(evaluateDiscountPercent(basicMachine, 10, "Schilder", rules)).toBe(15);
    expect(evaluateDiscountPercent(basicMachine, 30, "Schilder", rules)).toBe(20);
  });
});

// Altrex Kamersteiger — weekly-only loss leader (€19/week, min 1 week, per-started-week)
const kamersteiger = {
  id: "altrex-rs44",
  category: "kamersteiger",
  pricePerDay: 19,
  weeklyPrice: 19,
  weeklyOnly: true,
  minRentalDays: 7,
} as Machine;

describe("billableWeeks", () => {
  it("1–7 days = 1 week (minimum)", () => {
    expect(billableWeeks(1, 7)).toBe(1);
    expect(billableWeeks(7, 7)).toBe(1);
  });
  it("8–14 days = 2 weeks", () => {
    expect(billableWeeks(8, 7)).toBe(2);
    expect(billableWeeks(14, 7)).toBe(2);
  });
  it("15 days = 3 weeks", () => {
    expect(billableWeeks(15, 7)).toBe(3);
  });
  it("defaults to a 1-week minimum when minRentalDays omitted", () => {
    expect(billableWeeks(3)).toBe(1);
  });
});

describe("calculateItemSubtotal — weekly-only product", () => {
  it("1 day still bills a full week (€19)", () => {
    expect(calculateItemSubtotal(kamersteiger, 1, "Particulier", noRules, MON)).toBe(19);
  });
  it("7 days = 1 week (€19)", () => {
    expect(calculateItemSubtotal(kamersteiger, 7, "Particulier", noRules, MON)).toBe(19);
  });
  it("10 days = 2 started weeks (€38)", () => {
    expect(calculateItemSubtotal(kamersteiger, 10, "Particulier", noRules, MON)).toBe(38);
  });
  it("weekly-only takes priority over weekend/2-day tiers", () => {
    const m = { ...kamersteiger, weekendPrice: 999, twoDayPrice: 999 } as Machine;
    expect(calculateItemSubtotal(m, 2, "Particulier", noRules, SAT)).toBe(19);
  });
});
