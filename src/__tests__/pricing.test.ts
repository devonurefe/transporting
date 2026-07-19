import { describe, it, expect } from "vitest";
import { calculateItemSubtotal, calculateRentalDays, evaluateDiscountPercent, isStrictWeekend, billableWeeks, addonPriceForRental, displayRentalDays } from "../utils/pricing";
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

describe("calculateItemSubtotal — weekend rules (tiered model + Sunday block + package)", () => {
  // Reference weekdays (UTC): THU 2026-06-11, SUN 2026-06-14, TUE2 2026-06-02.
  const THU = "2026-06-11";
  const SUN = "2026-06-14";
  const TUE2 = "2026-06-02"; // +11 days = SAT 2026-06-13
  // Bravi Leonardo tariff (2026-07 weekend-blokkade prijzen). No monthlyPrice → the
  // pro-rata ladder is uncapped. sundayBlockFee 25 = threeDayPrice − twoDayPrice, so a
  // Fri+Sat rental equals the weekday 3-day price €105 (see the invariant block below).
  const bravi = {
    id: "bravi-mini-hd", category: "mastlift", pricePerDay: 45,
    twoDayPrice: 80, threeDayPrice: 105, fourDayPrice: 115, weeklyPrice: 120,
    weekendPrice: 70, sundayBlockFee: 25, weekendRulesEnabled: true,
  } as Machine;

  it("distinct day tiers: 1→€45, 2→€80, 3→€105, 4→€115, 5→€120 (all Mon-start, ends weekday)", () => {
    expect(calculateItemSubtotal(bravi, 1, "Particulier", noRules, MON)).toBe(45);
    expect(calculateItemSubtotal(bravi, 2, "Particulier", noRules, MON)).toBe(80);
    expect(calculateItemSubtotal(bravi, 3, "Particulier", noRules, MON)).toBe(105);
    expect(calculateItemSubtotal(bravi, 4, "Particulier", noRules, MON)).toBe(115);
    expect(calculateItemSubtotal(bravi, 5, "Particulier", noRules, MON)).toBe(120);
  });

  it("Scenario 1: Thu start, 3 working days (Thu+Fri+Sat) → €105 + €25 Sunday block = €130", () => {
    expect(calculateItemSubtotal(bravi, 3, "Particulier", noRules, THU)).toBe(130);
  });

  it("Scenario 2: Fri start, 2 working days (Fri+Sat) → €80 + €25 Sunday block = €105 (= 3-daagse prijs)", () => {
    expect(calculateItemSubtotal(bravi, 2, "Particulier", noRules, FRI)).toBe(105);
  });

  it("12 days ending Saturday → 12 × (120/5) + €25 block = 288 + 25 = €313", () => {
    expect(calculateItemSubtotal(bravi, 12, "Particulier", noRules, TUE2)).toBe(313);
  });

  it("weekend package: single Sat, single Sun, Sat+Sun → flat €70 (no block)", () => {
    expect(calculateItemSubtotal(bravi, 1, "Particulier", noRules, SAT)).toBe(70);
    expect(calculateItemSubtotal(bravi, 1, "Particulier", noRules, SUN)).toBe(70);
    expect(calculateItemSubtotal(bravi, 2, "Particulier", noRules, SAT)).toBe(70);
  });

  it("Fri+Sat+Sun (3 days) is NOT the weekend package — normal 3-day tier, no block", () => {
    // Fri+Sat+Sun (3 days, ends Sunday) → 3-day tier €105, no block (a Friday start never
    // triggers the weekend package, and Sunday as a deliberately-chosen end day is never
    // surcharged — only a *forced* trailing Sunday after a Saturday end is).
    expect(calculateItemSubtotal(bravi, 3, "Particulier", noRules, FRI)).toBe(105);
  });

  it("a long Sat-start rental falls through to normal tiered pricing, not the weekend package", () => {
    // Sat+Sun+Mon+Tue (4 days) extends past the weekend → normal 4-day tier €115.
    expect(calculateItemSubtotal(bravi, 4, "Particulier", noRules, SAT)).toBe(115);
    // Sat+Sun+Mon+Tue+Wed (5 days) → normal 5-day (werkweek) tier €120.
    expect(calculateItemSubtotal(bravi, 5, "Particulier", noRules, SAT)).toBe(120);
  });

  it("no Sunday block when the rental ends on a weekday (Thu+Fri = €80, ends Friday)", () => {
    expect(calculateItemSubtotal(bravi, 2, "Particulier", noRules, THU)).toBe(80);
  });

  it("5-day werkweek Mon→Fri → €120, no block (ends Friday)", () => {
    expect(calculateItemSubtotal(bravi, 5, "Particulier", noRules, MON)).toBe(120);
  });

  it("monthly cap: with monthlyPrice €280, a 12-day ending Saturday caps at 280 + €25 = €305", () => {
    // 12-day pro-rata base = 288 > €280 monthly → capped at 280, then the block is added.
    const braviCapped = { ...bravi, monthlyPrice: 280 } as Machine;
    expect(calculateItemSubtotal(braviCapped, 12, "Particulier", noRules, TUE2)).toBe(305);
  });

  it("legacy machine (no weekendRulesEnabled) is unaffected: Nifty 2-day Sat+Sun → weekendPrice, no block", () => {
    expect(calculateItemSubtotal(nifty120, 2, "Particulier", noRules, SAT)).toBe(150);
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules, THU)).toBe(335); // no block
  });
});

describe("weekend-blokkade uitrol — Vrijdag + Zaterdag = doordeweekse 3-daagse prijs", () => {
  // The 2026-07 rollout applies weekend rules across the mast & scissor group with
  // sundayBlockFee = (threeDayPrice − twoDayPrice). A Fri+Sat rental (2 work days +
  // forced Sunday block, ends Saturday) must therefore equal the weekday 3-day price.
  // Values mirror prisma/seed.ts.
  const machines = [
    { id: "dingli-6m", pricePerDay: 55, twoDayPrice: 95, threeDayPrice: 125, weekendPrice: 85, sundayBlockFee: 30 },
    { id: "optimum-8-1", pricePerDay: 75, twoDayPrice: 130, threeDayPrice: 170, weekendPrice: 115, sundayBlockFee: 40 },
    { id: "compact-10n-1", pricePerDay: 95, twoDayPrice: 165, threeDayPrice: 215, weekendPrice: 145, sundayBlockFee: 50 },
    { id: "bravi-mini-hd", pricePerDay: 45, twoDayPrice: 80, threeDayPrice: 105, weekendPrice: 70, sundayBlockFee: 25 },
    { id: "skyjack-sj16", pricePerDay: 49, twoDayPrice: 90, threeDayPrice: 115, weekendPrice: 75, sundayBlockFee: 25 },
    { id: "star-10", pricePerDay: 130, twoDayPrice: 230, threeDayPrice: 280, weekendPrice: 200, sundayBlockFee: 50 },
  ];

  for (const m of machines) {
    const machine = { ...m, category: "mastlift", weekendRulesEnabled: true } as Machine;

    it(`${m.id}: sundayBlockFee (${m.sundayBlockFee}) === 3-daags − 2-daags`, () => {
      expect(m.sundayBlockFee).toBe(m.threeDayPrice - m.twoDayPrice);
    });

    it(`${m.id}: Fri+Sat (2 dagen, vrijdag-start) === 3-daagse prijs €${m.threeDayPrice}`, () => {
      expect(calculateItemSubtotal(machine, 2, "Particulier", noRules, FRI)).toBe(m.threeDayPrice);
    });

    it(`${m.id}: losse zaterdag → weekendpakket €${m.weekendPrice} (geen blokkade)`, () => {
      expect(calculateItemSubtotal(machine, 1, "Particulier", noRules, SAT)).toBe(m.weekendPrice);
    });
  }
});

describe("2026-07 Nifty + Hinowa prijsupdate — nieuw prijzenblad, weekendregels aan", () => {
  // New price card (MB Hoogwerkers). Nifty 120/170 keep an aggressive 1-day campaign
  // price (60/70) but every 2+-day tier and the weekend are on the normal standard rate.
  // Hinowa 15.70/17.75 have no 1-day campaign (1 day = pricePerDay). All four now use
  // weekend rules: weekend package + automatic Sunday block, with
  // sundayBlockFee = threeDayPrice − twoDayPrice → Fri+Sat = weekday 3-day price.
  // Values mirror prisma/seed.ts.
  const cards = [
    { id: "nifty-120-1", pricePerDay: 120, oneDayPrice: 60, twoDayPrice: 205, threeDayPrice: 275, fourDayPrice: 295, weeklyPrice: 315, weekendPrice: 185, sundayBlockFee: 70, monthlyPrice: 850 },
    { id: "nifty-170", pricePerDay: 185, oneDayPrice: 70, twoDayPrice: 320, threeDayPrice: 420, fourDayPrice: 455, weeklyPrice: 490, weekendPrice: 285, sundayBlockFee: 100, monthlyPrice: 1310 },
    { id: "hinowa-15-70", pricePerDay: 228, twoDayPrice: 395, threeDayPrice: 520, fourDayPrice: 560, weeklyPrice: 600, weekendPrice: 350, sundayBlockFee: 125, monthlyPrice: 1615 },
    { id: "hinowa-17-75", pricePerDay: 275, twoDayPrice: 475, threeDayPrice: 625, fourDayPrice: 675, weeklyPrice: 725, weekendPrice: 425, sundayBlockFee: 150, monthlyPrice: 1950 },
  ] as (Partial<Machine> & { id: string })[];

  for (const c of cards) {
    const machine = { ...c, category: "aanhanger", weekendRulesEnabled: true } as Machine;
    const day1 = c.oneDayPrice ?? c.pricePerDay!;

    it(`${c.id}: dagtieren 1→€${day1}, 2→€${c.twoDayPrice}, 3→€${c.threeDayPrice}, 4→€${c.fourDayPrice}, 5→€${c.weeklyPrice} (ma-start, eindigt doordeweeks)`, () => {
      expect(calculateItemSubtotal(machine, 1, "Particulier", noRules, MON)).toBe(day1);
      expect(calculateItemSubtotal(machine, 2, "Particulier", noRules, MON)).toBe(c.twoDayPrice);
      expect(calculateItemSubtotal(machine, 3, "Particulier", noRules, MON)).toBe(c.threeDayPrice);
      expect(calculateItemSubtotal(machine, 4, "Particulier", noRules, MON)).toBe(c.fourDayPrice);
      expect(calculateItemSubtotal(machine, 5, "Particulier", noRules, MON)).toBe(c.weeklyPrice);
    });

    it(`${c.id}: sundayBlockFee (${c.sundayBlockFee}) === 3-daags − 2-daags`, () => {
      expect(c.sundayBlockFee).toBe(c.threeDayPrice! - c.twoDayPrice!);
    });

    it(`${c.id}: Vr+Za (2 dagen, vrijdag-start) === 3-daagse prijs €${c.threeDayPrice}`, () => {
      expect(calculateItemSubtotal(machine, 2, "Particulier", noRules, FRI)).toBe(c.threeDayPrice);
    });

    it(`${c.id}: losse zaterdag → weekendpakket €${c.weekendPrice} (geen blokkade)`, () => {
      expect(calculateItemSubtotal(machine, 1, "Particulier", noRules, SAT)).toBe(c.weekendPrice);
    });

    it(`${c.id}: 28 dagen → maandtarief €${c.monthlyPrice}`, () => {
      expect(calculateItemSubtotal(machine, 28, "Particulier", noRules, MON)).toBe(c.monthlyPrice);
    });
  }
});

describe("displayRentalDays — shown day count equals the selected span", () => {
  it("returns the calendar day count as-is", () => {
    expect(displayRentalDays(nifty120, FRI, 4)).toBe(4);
    expect(displayRentalDays(nifty120, MON, 3)).toBe(3);
    expect(displayRentalDays(nifty120, FRI, 28)).toBe(28);
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

// Altrex Kamersteiger — min 2 days, 2d=€15, 3–5d=€19 flat, 6+d=€19/5×days pro-rata
const kamersteiger = {
  id: "altrex-rs44",
  category: "kamersteiger",
  pricePerDay: 19,
  twoDayPrice: 15,
  weeklyPrice: 19,
  weeklyOnly: false,
  minRentalDays: 2,
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

describe("calculateItemSubtotal — RS44 kamersteiger (2-day minimum, flat-rate tiers)", () => {
  it("2 days = twoDayPrice (€15)", () => {
    expect(calculateItemSubtotal(kamersteiger, 2, "Particulier", noRules, MON)).toBe(15);
  });
  it("3 days = weeklyPrice flat (€19)", () => {
    expect(calculateItemSubtotal(kamersteiger, 3, "Particulier", noRules, MON)).toBe(19);
  });
  it("5 days = weeklyPrice flat (€19)", () => {
    expect(calculateItemSubtotal(kamersteiger, 5, "Particulier", noRules, MON)).toBe(19);
  });
  it("10 days = pro-rata weeklyPrice (€38 = round(10 × 19/5))", () => {
    expect(calculateItemSubtotal(kamersteiger, 10, "Particulier", noRules, MON)).toBe(38);
  });
  it("1 day (pre-enforcement) falls back to pricePerDay × 1 (€19)", () => {
    // minRentalDays enforcement is at UI/server level; the pricing fn still computes a value
    expect(calculateItemSubtotal(kamersteiger, 1, "Particulier", noRules, MON)).toBe(19);
  });
});

describe("addonPriceForRental — cross-sell accessory pricing tiers", () => {
  const machine = { weeklyOnly: false, minRentalDays: undefined };
  const weeklyOnlyMachine = { weeklyOnly: true, minRentalDays: 7 };

  it("falls back to pricePerWeek × weeks when no short prices are set (unchanged behaviour)", () => {
    const addon = { pricePerWeek: 15 };
    expect(addonPriceForRental(addon, 1, machine)).toBe(15); // 1 day → 1 started week
    expect(addonPriceForRental(addon, 8, machine)).toBe(30); // 8 days → 2 weeks
  });

  it("applies pricePerDay only for an exactly-1-day rental", () => {
    const addon = { pricePerWeek: 19, pricePerDay: 7, pricePerTwoDay: 12 };
    expect(addonPriceForRental(addon, 1, machine)).toBe(7);
  });

  it("applies pricePerTwoDay only for an exactly-2-day rental", () => {
    const addon = { pricePerWeek: 19, pricePerDay: 7, pricePerTwoDay: 12 };
    expect(addonPriceForRental(addon, 2, machine)).toBe(12);
  });

  it("uses the weekly basis for 3+ day rentals even when short prices exist", () => {
    const addon = { pricePerWeek: 19, pricePerDay: 7, pricePerTwoDay: 12 };
    expect(addonPriceForRental(addon, 3, machine)).toBe(19); // 3 days → 1 started week
  });

  it("weekly-only products ignore short prices (always per started week)", () => {
    const addon = { pricePerWeek: 19, pricePerDay: 7, pricePerTwoDay: 12 };
    expect(addonPriceForRental(addon, 2, weeklyOnlyMachine)).toBe(19);
  });

  it("ignores zero/negative short prices and falls back to weekly", () => {
    const addon = { pricePerWeek: 19, pricePerDay: 0, pricePerTwoDay: 0 };
    expect(addonPriceForRental(addon, 1, machine)).toBe(19);
    expect(addonPriceForRental(addon, 2, machine)).toBe(19);
  });
});
