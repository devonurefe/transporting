import { describe, it, expect } from "vitest";
import { calculateItemSubtotal, buildTierDisplay } from "../utils/pricing";
import { Machine, CampaignRule } from "../types";

// Reference weekdays (UTC): 2026-06-08 = Monday, 2026-06-12 = Friday, 2026-06-13 = Saturday
const MON = "2026-06-08";
const FRI = "2026-06-12";
const SAT = "2026-06-13";

const noRules: CampaignRule[] = [];

// The exact "TOTAAL TE BETALEN" / "Prijsopbouw bekijken" panel (BookingPriceSummary.tsx)
// renders whatever buildTierDisplay() returns:
//   - isFlatRate + tierLabel  -> one row "1× {tierLabel}" priced at the real subtotal
//   - weeklyBreakdown         -> "N× Werkweektarief (5 dgn)" + "M extra dagen", which
//                                must independently SUM to the real subtotal
// This helper reproduces that arithmetic so a test failure here means a customer
// would literally see numbers on screen that don't add up — the exact bug reported
// against the Nifty 170 booking card.
function displayedTotal(machine: Machine, days: number, startDate?: string | Date): number {
  const display = buildTierDisplay(machine, days, startDate);
  if (display.weeklyBreakdown) {
    const wb = display.weeklyBreakdown;
    return wb.weeks * wb.pricePerWeek + (wb.remainderCost ?? wb.remainder * wb.dailyRate);
  }
  // isFlatRate (or no tier at all — percentage-fallback machines render the plain
  // "N dagen × €X" row in BookingPriceSummary, which is rawSubtotal-based, not
  // covered by buildTierDisplay; those machines never set a tierLabel here).
  return NaN;
}

// Real MB Hoogwerkers price-list products (prisma/seed.ts) — deliberately spans a
// range of weekly/monthly ratios so the monthly-price cap kicks in at different day
// counts (day 7, 8, 14, 15 …) or never at all (no monthlyPrice).
const PRODUCTS: Record<string, Machine> = {
  "Nifty 120":            { id: "n120",  category: "aanhanger",   pricePerDay: 95,  oneDayPrice: 50, twoDayPrice: 190, weekendPrice: 150, weeklyPrice: 335, monthlyPrice: 490 } as Machine,
  "Nifty 170":            { id: "n170",  category: "aanhanger",   pricePerDay: 120, oneDayPrice: 60, twoDayPrice: 240, weekendPrice: 195, weeklyPrice: 430, monthlyPrice: 590 } as Machine,
  "Hinowa Goldlift":      { id: "hgl",   category: "rups",        pricePerDay: 200, twoDayPrice: 360, weekendPrice: 290, weeklyPrice: 750, monthlyPrice: 1100 } as Machine,
  "Hinowa Lightlift":     { id: "hll",   category: "rups",        pricePerDay: 250, twoDayPrice: 450, weekendPrice: 360, weeklyPrice: 920, monthlyPrice: 1350 } as Machine,
  "Optimum 8":            { id: "opt8",  category: "schaarlift",  pricePerDay: 65,  weekendPrice: 99,  weeklyPrice: 159, monthlyPrice: 420 } as Machine,
  "Compact 10N":          { id: "c10n",  category: "schaarlift",  pricePerDay: 89,  weekendPrice: 129, weeklyPrice: 215, monthlyPrice: 580 } as Machine,
  "Dingli JCPT 0607":     { id: "djcpt", category: "schaarlift",  pricePerDay: 49,  weekendPrice: 75,  weeklyPrice: 120, monthlyPrice: 340 } as Machine,
  "Star 10 Mastlift":     { id: "star10",category: "mastlift",    pricePerDay: 95,  weekendPrice: 145, weeklyPrice: 260, monthlyPrice: 690 } as Machine,
  "Skyjack SJ16":         { id: "sj16",  category: "mastlift",    pricePerDay: 55,  weekendPrice: 85,  weeklyPrice: 140, monthlyPrice: 390 } as Machine,
  "Bravi Leonardo HD":    { id: "bravi", category: "mastlift",    pricePerDay: 45,  weekendPrice: 69,  weeklyPrice: 110, monthlyPrice: 320 } as Machine,
  "Ladderlift 18m (geen maandprijs)": { id: "ladder18", category: "ladderlift", pricePerDay: 89, twoDayPrice: 160, weekendPrice: 129, weeklyPrice: 290 } as Machine,
  "Pecolift":             { id: "peco",  category: "laag",        pricePerDay: 39,  weekendPrice: 59,  weeklyPrice: 99,  monthlyPrice: 290 } as Machine,
};

describe("buildTierDisplay — the on-screen breakdown always sums to the real charge", () => {
  const dayCounts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 20, 26, 27];

  for (const [name, machine] of Object.entries(PRODUCTS)) {
    for (const days of dayCounts) {
      it(`${name} — ${days} dagen (start ma): displayed breakdown === real subtotal`, () => {
        const real = calculateItemSubtotal(machine, days, "Particulier", noRules, MON);
        const display = buildTierDisplay(machine, days, MON);
        if (display.isFlatRate) {
          // Flat tier — BookingPriceSummary renders "1× tierLabel" priced at the
          // real subtotal directly, so there is nothing to cross-check beyond
          // "a label exists" (asserted implicitly: no weeklyBreakdown either).
          expect(display.tierLabel).not.toBeNull();
          expect(display.weeklyBreakdown).toBeNull();
        } else if (display.weeklyBreakdown) {
          expect(displayedTotal(machine, days, MON)).toBe(real);
        }
        // else: percentage-fallback rendering (no flat tiers at all) — not this
        // product set, but if it ever happens there's simply no tier claim to check.
      });
    }
  }
});

describe("buildTierDisplay — weekend (Sat+Sun) shows the real weekend tier, not a generic label", () => {
  it("Nifty 120, 2 days starting Saturday → 'Weekendtarief (za+zo)' flat, priced at weekendPrice", () => {
    const machine = PRODUCTS["Nifty 120"];
    const display = buildTierDisplay(machine, 2, SAT);
    expect(display.tierLabel).toBe("Weekendtarief (za+zo)");
    expect(display.isFlatRate).toBe(true);
    expect(calculateItemSubtotal(machine, 2, "Particulier", noRules, SAT)).toBe(machine.weekendPrice);
  });

  it("Nifty 120, 2 days starting Monday (weekday) → '2-Daags Tarief (ma-vr)', NOT the weekend label", () => {
    const machine = PRODUCTS["Nifty 120"];
    const display = buildTierDisplay(machine, 2, MON);
    expect(display.tierLabel).toBe("2-Daags Tarief (ma-vr)");
    expect(calculateItemSubtotal(machine, 2, "Particulier", noRules, MON)).toBe(machine.twoDayPrice);
  });

  it("machine with no twoDayPrice, 2 weekday days → no flat tier at all (falls through to day-rate)", () => {
    const machine = { ...PRODUCTS["Optimum 8"] } as Machine; // Optimum 8 has no twoDayPrice
    const display = buildTierDisplay(machine, 2, MON);
    expect(display.tierLabel).toBeNull();
    expect(display.isFlatRate).toBe(false);
    expect(display.weeklyBreakdown).toBeNull();
  });
});

describe("buildTierDisplay — 3, 4, 5 dagen tonen 'Werkweektarief' geprijsd op de volledige weeklyPrice", () => {
  for (const [name, machine] of Object.entries(PRODUCTS)) {
    for (const days of [3, 4, 5]) {
      it(`${name} — ${days} dagen → Werkweektarief === weeklyPrice (€${machine.weeklyPrice})`, () => {
        const display = buildTierDisplay(machine, days, MON);
        expect(display.tierLabel).toBe("Werkweektarief");
        expect(display.isFlatRate).toBe(true);
        expect(calculateItemSubtotal(machine, days, "Particulier", noRules, MON)).toBe(machine.weeklyPrice);
      });
    }
  }
});

describe("buildTierDisplay — 6-27 dagen: dagunit = weeklyPrice/5, vermenigvuldigd met aantal dagen", () => {
  it("Nifty 120 (weekly €335 → dagunit €67), 8 dagen: pro-rata 8×67=536 > monthly €490 → gecapt op €490", () => {
    const machine = PRODUCTS["Nifty 120"];
    const dailyUnit = Math.round(machine.weeklyPrice! / 5);
    expect(dailyUnit).toBe(67);
    const uncapped = Math.round(8 * dailyUnit);
    expect(uncapped).toBe(536);
    // Real charge is capped at monthlyPrice — this is the "nooit duurder dan een
    // maand"-regel en die blijft ongewijzigd (in tierPrice(), niet aangeraakt).
    expect(calculateItemSubtotal(machine, 8, "Particulier", noRules, MON)).toBe(490);
    // The screen must show the SAME capped number, as one flat "Maandtarief
    // (voordeliger)" line — not the uncapped 536 breakdown (the original bug).
    const display = buildTierDisplay(machine, 8, MON);
    expect(display.isFlatRate).toBe(true);
    expect(display.tierLabel).toBe("Maandtarief (voordeliger)");
    expect(display.weeklyBreakdown).toBeNull();
  });

  it("Nifty 120, 7 dagen: pro-rata 7×67=469 <= monthly €490 → NIET gecapt, echte breakdown", () => {
    const machine = PRODUCTS["Nifty 120"];
    const real = calculateItemSubtotal(machine, 7, "Particulier", noRules, MON);
    expect(real).toBe(469); // round(7 * 335/5)
    const display = buildTierDisplay(machine, 7, MON);
    expect(display.isFlatRate).toBe(false);
    expect(display.weeklyBreakdown).not.toBeNull();
    expect(displayedTotal(machine, 7, MON)).toBe(real);
  });

  it("Compact 10N (weekly €215 → dagunit €43), 14 dagen: pro-rata 14×43=602 > monthly €580 → gecapt op €580", () => {
    const machine = PRODUCTS["Compact 10N"];
    const dailyUnit = Math.round(machine.weeklyPrice! / 5);
    expect(dailyUnit).toBe(43);
    expect(Math.round(14 * dailyUnit)).toBe(602);
    expect(calculateItemSubtotal(machine, 14, "Particulier", noRules, MON)).toBe(580);
    const display = buildTierDisplay(machine, 14, MON);
    expect(display.isFlatRate).toBe(true);
    expect(display.tierLabel).toBe("Maandtarief (voordeliger)");
  });

  it("Compact 10N, 13 dagen: pro-rata 13×43=559 <= monthly €580 → NIET gecapt, echte breakdown klopt", () => {
    const machine = PRODUCTS["Compact 10N"];
    const real = calculateItemSubtotal(machine, 13, "Particulier", noRules, MON);
    expect(real).toBe(559); // round(13 * 215/5)
    const display = buildTierDisplay(machine, 13, MON);
    expect(display.isFlatRate).toBe(false);
    expect(display.weeklyBreakdown).toEqual({ weeks: 1, pricePerWeek: 215, remainder: 8, dailyRate: 43, remainderCost: 559 - 215 });
    expect(displayedTotal(machine, 13, MON)).toBe(real);
  });

  it("Ladderlift 18m (geen monthlyPrice) — 20 dagen: NOOIT gecapt, altijd de pure pro-rata breakdown", () => {
    const machine = PRODUCTS["Ladderlift 18m (geen maandprijs)"];
    const real = calculateItemSubtotal(machine, 20, "Particulier", noRules, MON);
    expect(real).toBe(Math.round(20 * (290 / 5))); // = 1160, nooit gecapt want monthlyPrice is null
    const display = buildTierDisplay(machine, 20, MON);
    expect(display.isFlatRate).toBe(false);
    expect(display.weeklyBreakdown).not.toBeNull();
    expect(displayedTotal(machine, 20, MON)).toBe(real);
  });

  it("28 dagen → 'Maandtarief' vlak tarief, geprijsd op monthlyPrice", () => {
    const machine = PRODUCTS["Nifty 170"];
    const display = buildTierDisplay(machine, 28, MON);
    expect(display.tierLabel).toBe("Maandtarief");
    expect(display.isFlatRate).toBe(true);
    expect(calculateItemSubtotal(machine, 28, "Particulier", noRules, MON)).toBe(machine.monthlyPrice);
  });
});

describe("buildTierDisplay — startDate does not change the 6-27 day linear rate (only the 2-day weekend tier cares)", () => {
  it("same 10-day breakdown regardless of Monday vs Friday start", () => {
    const machine = PRODUCTS["Nifty 170"];
    const onMon = buildTierDisplay(machine, 10, MON);
    const onFri = buildTierDisplay(machine, 10, FRI);
    expect(onMon).toEqual(onFri);
  });
});
