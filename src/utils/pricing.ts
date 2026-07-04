/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Machine, CampaignRule } from "../types";

// Inclusive rental days: 10th–12th = 3 days. The server recomputes this with
// the same formula in server/routes/orders.ts — keep them identical.
export function calculateRentalDays(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
}

// Number of started weeks billed for a weekly-only product, honouring its
// minimum rental length (default 1 week). 1–7 days = 1 week, 8–14 = 2 weeks, …
// Mirrored by the server validation in server/routes/orders.ts — keep identical.
export function billableWeeks(days: number, minRentalDays?: number): number {
  const min = minRentalDays && minRentalDays > 0 ? minRentalDays : 7;
  const billDays = Math.max(days, min);
  return Math.max(1, Math.ceil(billDays / 7));
}

// Price for one product-specific cross-sell add-on over the rental period.
// Default basis is per started week (pricePerWeek × billableWeeks). The optional
// flat pricePerDay / pricePerTwoDay only apply to short, non-weekly-only rentals
// of exactly 1 or 2 days when the admin has set a positive value. Backwards
// compatible: with no short prices set the result equals pricePerWeek × weeks.
// Mirrored EXACTLY by server/routes/orders.ts — keep identical.
export function addonPriceForRental(
  addon: { pricePerWeek: number; pricePerDay?: number | null; pricePerTwoDay?: number | null },
  days: number,
  machine: { weeklyOnly?: boolean; minRentalDays?: number }
): number {
  if (!machine.weeklyOnly) {
    if (days === 1 && addon.pricePerDay != null && addon.pricePerDay > 0) return addon.pricePerDay;
    if (days === 2 && addon.pricePerTwoDay != null && addon.pricePerTwoDay > 0) return addon.pricePerTwoDay;
  }
  return (addon.pricePerWeek || 0) * billableWeeks(days, machine.minRentalDays);
}

// Strict weekend: a 2-day rental on Sat+Sun (start = Saturday).
// getUTCDay(): 0=Sun, 6=Sat. Dates are "YYYY-MM-DD" → parsed as UTC midnight,
// so getUTCDay() is timezone-safe.
// Mirrored by server/routes/orders.ts — keep identical.
export function isStrictWeekend(startDate: string | Date | undefined, days: number): boolean {
  if (!startDate) return false; // no date → not a weekend (safe default)
  const dow = new Date(startDate).getUTCDay();
  if (days === 2) return dow === 6; // Saturday → Sat+Sun
  return false;
}

// Last (inclusive) calendar day of a rental range: the customer's final work day.
// getUTCDay(): 0=Sun, 6=Sat.
function rangeEndDow(startDate: string | Date, days: number): number {
  const end = new Date(startDate);
  end.setUTCDate(end.getUTCDate() + (days - 1));
  return end.getUTCDay();
}

// Weekend rules (depot closed Sat+Sun). Only apply to machines with
// weekendRulesEnabled — scaffolding and campaign products (Nifty 120/170) opt out.
//
// A "weekend package" (weekendPrice, e.g. €69) is the fixed flat rate for a rental
// that stays entirely within the closed weekend: single Saturday, single Sunday,
// or Sat+Sun together. It does NOT apply to a Friday start (Fri+Sat, Fri+Sat+Sun,
// etc.) or to any longer rental that starts on Sat/Sun but extends past the
// weekend — those are always priced by the normal day-count tier instead.
// Mirrored by server/routes/orders.ts — keep identical.
export function isWeekendPackage(machine: Machine, startDate: string | Date | undefined, days: number): boolean {
  if (!machine.weekendRulesEnabled || !machine.weekendPrice || !startDate) return false;
  const startDow = new Date(startDate).getUTCDay();
  const endDow = rangeEndDow(startDate, days);
  if (days === 1 && (startDow === 6 || startDow === 0)) return true; // single Sat or single Sun
  if (days === 2 && startDow === 6 && endDow === 0) return true;     // Sat + Sun
  return false;
}

// Forced Sunday block: when a weekday rental's last work day is Saturday, the
// depot is closed Sunday so the machine is unavoidably held until Monday 08:00 —
// a flat sundayBlockFee (e.g. €20) is added. Never applies to weekend packages.
// Mirrored by server/routes/orders.ts — keep identical.
export function hasSundayBlock(machine: Machine, startDate: string | Date | undefined, days: number): boolean {
  if (!machine.weekendRulesEnabled || !machine.sundayBlockFee || !startDate) return false;
  if (isWeekendPackage(machine, startDate, days)) return false;
  return rangeEndDow(startDate, days) === 6; // last work day is Saturday
}

export function evaluateDiscountPercent(machine: Machine, days: number, profile: string, rules: CampaignRule[]): number {
  let highestDiscount = 0;

  // 1. Weekly/Monthly volume discounts
  if (days >= 28 && machine.monthlyDiscountPercent) {
    highestDiscount = Math.max(highestDiscount, machine.monthlyDiscountPercent);
  } else if (days >= 6 && machine.weeklyDiscountPercent) {
    highestDiscount = Math.max(highestDiscount, machine.weeklyDiscountPercent);
  }

  // 2. Active custom campaign rules
  const activeRules = rules.filter(r => r.isActive);
  for (const rule of activeRules) {
    let matches = false;
    if (rule.scope === "global") {
      matches = true;
    } else if (rule.scope === "category") {
      matches = machine.category.toLowerCase() === rule.scopeValue.toLowerCase();
    } else if (rule.scope === "product") {
      matches = machine.id === rule.scopeValue;
    } else if (rule.scope === "role") {
      matches = profile.toLowerCase() === rule.scopeValue.toLowerCase();
    }

    if (matches) {
      highestDiscount = Math.max(highestDiscount, rule.discountPercent);
    }
  }

  // 3. Fallback to default machine campaignDiscountPercent
  if (machine.campaignDiscountPercent) {
    highestDiscount = Math.max(highestDiscount, machine.campaignDiscountPercent);
  }

  return highestDiscount;
}

// Calculate item subtotal using flat-rate prices when available,
// otherwise fall back to pricePerDay × days × (1 - discountPercent/100).
// `startDate` ("YYYY-MM-DD") enables real-weekend detection for the 2-day tier,
// the weekend package, and the automatic Sunday block (weekendRulesEnabled).
// Mirrored by the server validation in server/routes/orders.ts — any change
// here must be applied there too, or orders fail with "Totaalbedrag klopt niet".
export function calculateItemSubtotal(machine: Machine, days: number, profile: string, rules: CampaignRule[], startDate?: string | Date): number {
  // Apply campaign discounts on top of a flat-rate base price.
  // Volume discounts are already embedded in flat rates — only campaign rules
  // and campaignDiscountPercent are applied here to avoid double-counting.
  const withCampaign = (base: number): number => {
    let pct = 0;
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const matches = rule.scope === "global"
        || (rule.scope === "category" && machine.category.toLowerCase() === rule.scopeValue.toLowerCase())
        || (rule.scope === "product" && machine.id === rule.scopeValue)
        || (rule.scope === "role" && profile.toLowerCase() === rule.scopeValue.toLowerCase());
      if (matches) pct = Math.max(pct, rule.discountPercent);
    }
    if (machine.campaignDiscountPercent) pct = Math.max(pct, machine.campaignDiscountPercent);
    let disc = base * (pct / 100);
    if (machine.campaignDiscountAmount) disc += machine.campaignDiscountAmount;
    return Math.max(0, base - disc);
  };

  // Weekly-only billing (e.g. Altrex Kamersteiger): minimum 1 week, charged per
  // started week. Takes priority over every daily/2-day/monthly tier below.
  if (machine.weeklyOnly && machine.weeklyPrice) {
    return withCampaign(billableWeeks(days, machine.minRentalDays) * machine.weeklyPrice);
  }

  // Weekend package (depot closed Sat+Sun): flat weekend price, no Sunday block.
  if (machine.weekendRulesEnabled && machine.weekendPrice && isWeekendPackage(machine, startDate, days)) {
    return withCampaign(machine.weekendPrice);
  }

  // Base subtotal: standard flat-rate tier, else pricePerDay × days with discounts.
  let base: number;
  const tier = tierPrice(machine, days, startDate);
  if (tier !== null) {
    base = withCampaign(tier);
  } else {
    const rawSubtotal = machine.pricePerDay * days;
    const discountPercent = evaluateDiscountPercent(machine, days, profile, rules);
    let discountAmount = rawSubtotal * (discountPercent / 100);
    if (machine.campaignDiscountAmount) {
      discountAmount += machine.campaignDiscountAmount;
    }
    base = Math.max(0, rawSubtotal - discountAmount);
  }

  // Forced Sunday block: last work day is Saturday → machine held over the closed
  // Sunday, returned Monday 08:00, flat sundayBlockFee added on top of the tier.
  if (hasSundayBlock(machine, startDate, days)) {
    base += machine.sundayBlockFee ?? 0;
  }

  return base;
}

// Flat-rate price for an effective day count `n`, or null when no flat tier applies
// (the caller then falls back to pricePerDay × days with percentage discounts).
// `startDate` enables strict-weekend detection for the 2-day tier; omit it to force
// the weekday 2-day price (used by the weekend "niet werken" path).
// Mirrored by server/routes/orders.ts — any change here must be applied there too.
function tierPrice(machine: Machine, n: number, startDate?: string | Date): number | null {
  // 1-day actie flat rate
  if (n === 1 && machine.oneDayPrice) return machine.oneDayPrice;

  // 2-day: weekday → twoDayPrice. The legacy strict-weekend (Sat+Sun) → weekendPrice
  // only applies to machines without weekendRulesEnabled; enabled machines route a
  // Sat+Sun selection through the weekend package in calculateItemSubtotal instead.
  if (n === 2) {
    if (!machine.weekendRulesEnabled && isStrictWeekend(startDate, n) && machine.weekendPrice) return machine.weekendPrice;
    if (machine.twoDayPrice) return machine.twoDayPrice;
  }

  // 3 / 4 days: per-day flat rate when set, else fall back to the flat weekly rate.
  if (n === 3 && machine.threeDayPrice) return machine.threeDayPrice;
  if (n === 4 && machine.fourDayPrice) return machine.fourDayPrice;

  // 3–5 days: flat weekly rate (also the fallback for 3/4 when no per-day rate set)
  if ((n === 3 || n === 4 || n === 5) && machine.weeklyPrice) return machine.weeklyPrice;

  // 6–27 days: linear rate derived from weeklyPrice, capped at the monthly price
  // (a sub-month rental must never cost more than a full month).
  if (n >= 6 && n < 28 && machine.weeklyPrice) {
    let base = Math.round(n * (machine.weeklyPrice / 5));
    if (machine.monthlyPrice) base = Math.min(base, machine.monthlyPrice);
    return base;
  }

  // Monthly flat rate: 28+ days. The pro-rata remainder is likewise capped at the
  // monthly price so e.g. "1 maand + 25 dagen" never exceeds two months.
  if (n >= 28 && machine.monthlyPrice) {
    const fullMonths = Math.floor(n / 28);
    const remainder = n % 28;
    let remainderCost: number;
    if (remainder >= 3 && machine.weeklyPrice) {
      remainderCost = Math.round(remainder * (machine.weeklyPrice / 5));
    } else {
      remainderCost = remainder * machine.pricePerDay;
    }
    remainderCost = Math.min(remainderCost, machine.monthlyPrice);
    return fullMonths * machine.monthlyPrice + remainderCost;
  }

  return null;
}

export interface WeeklyBreakdown {
  weeks: number;
  pricePerWeek: number;
  remainder: number;
  dailyRate: number;
  remainderCost?: number;
}

export interface TierDisplay {
  tierLabel: string | null;
  isFlatRate: boolean;
  weeklyBreakdown: WeeklyBreakdown | null;
}

// Customer-facing tier label / pro-rata breakdown for the price summary UI —
// e.g. "4× Werkweektarief (5 dgn)" + "2 extra dagen" in the "Prijsopbouw
// bekijken" accordion. Mirrors tierPrice() branch-for-branch (including its
// monthlyPrice cap for 6–27 days) so the numbers shown always sum to exactly
// what calculateItemSubtotal() actually charges — the two must never drift
// apart, hence they're kept side by side and exercised together in
// pricing-display.test.ts.
export function buildTierDisplay(machine: Machine, days: number, startDate?: string | Date): TierDisplay {
  if (machine.weeklyOnly && machine.weeklyPrice) {
    const weeks = billableWeeks(days, machine.minRentalDays);
    return { tierLabel: weeks === 1 ? "Weektarief" : `Weektarief × ${weeks} weken`, isFlatRate: true, weeklyBreakdown: null };
  }

  // Weekend package (single Sat, single Sun, or Sat+Sun) — mirrors the priority
  // order in calculateItemSubtotal(), which checks this before oneDayPrice/tierPrice.
  if (machine.weekendRulesEnabled && machine.weekendPrice && isWeekendPackage(machine, startDate, days)) {
    return { tierLabel: "Weekendpakket", isFlatRate: true, weeklyBreakdown: null };
  }

  if (days === 1 && machine.oneDayPrice) {
    return { tierLabel: "1-Dag Actie", isFlatRate: true, weeklyBreakdown: null };
  }

  if (days === 2 && !machine.weekendRulesEnabled && isStrictWeekend(startDate, 2) && machine.weekendPrice) {
    return { tierLabel: "Weekendtarief (za+zo)", isFlatRate: true, weeklyBreakdown: null };
  }
  if (days === 2 && machine.twoDayPrice) {
    return { tierLabel: "2-Daags Tarief (ma-vr)", isFlatRate: true, weeklyBreakdown: null };
  }

  if (days === 3 && (machine.threeDayPrice || machine.weeklyPrice)) {
    return { tierLabel: machine.threeDayPrice ? "3-Daags Tarief" : "Werkweektarief", isFlatRate: true, weeklyBreakdown: null };
  }
  if (days === 4 && (machine.fourDayPrice || machine.weeklyPrice)) {
    return { tierLabel: machine.fourDayPrice ? "4-Daags Tarief" : "Werkweektarief", isFlatRate: true, weeklyBreakdown: null };
  }
  if (days === 5 && machine.weeklyPrice) {
    return { tierLabel: "Werkweektarief", isFlatRate: true, weeklyBreakdown: null };
  }

  if (days >= 6 && days <= 27 && machine.weeklyPrice) {
    const weeks = Math.floor(days / 5);
    const remainder = days % 5;
    const dailyRate = Math.round(machine.weeklyPrice / 5);
    const wkBase = Math.round(days * (machine.weeklyPrice / 5));
    if (machine.monthlyPrice && wkBase > machine.monthlyPrice) {
      // Pro-rata weekly rate would exceed the monthly price — tierPrice() caps the
      // actual charge at monthlyPrice, so a weeks/remainder breakdown would no
      // longer sum to what's charged. Show one flat line instead.
      return { tierLabel: "Maandtarief (voordeliger)", isFlatRate: true, weeklyBreakdown: null };
    }
    // remainderCost derived from wkBase (not remainder × dailyRate) so
    // weeks × pricePerWeek + remainderCost always sums to exactly wkBase,
    // regardless of rounding when weeklyPrice isn't a multiple of 5.
    return {
      tierLabel: null,
      isFlatRate: false,
      weeklyBreakdown: { weeks, pricePerWeek: machine.weeklyPrice, remainder, dailyRate, remainderCost: wkBase - weeks * machine.weeklyPrice }
    };
  }

  if (days >= 28 && machine.monthlyPrice) {
    return { tierLabel: "Maandtarief", isFlatRate: true, weeklyBreakdown: null };
  }

  return { tierLabel: null, isFlatRate: false, weeklyBreakdown: null };
}

// Day count to SHOW the customer. The customer always selects their working days
// directly (the forced Sunday, when a rental ends on Saturday, is never part of
// the selection — it is charged as the flat sundayBlockFee instead), so the
// displayed count equals the selected calendar span.
export function displayRentalDays(machine: Machine, startDate: string | Date | undefined, days: number): number {
  return days;
}

// Counts Saturday + Sunday days within a rental range (both ends inclusive).
// Used to detect weekend-spanning rentals for "Gratis weekendopslag" badge.
export function countWeekendDays(startDate: string | Date, endDate: string | Date): number {
  const cur = new Date(startDate);
  const end = new Date(endDate);
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  let count = 0;
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow === 0 || dow === 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// Derives discount percentages for badge display from flat-rate fields.
// Used by CatalogSection cards and MachineDetailModal.
export function computeDiscounts(m: Machine): { weekly: number; monthly: number } {
  // Weekly-only products price per week, not per day — derived day-discount
  // badges would be meaningless, so suppress them.
  if (m.weeklyOnly) return { weekly: 0, monthly: 0 };
  const weekly = m.weeklyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.weeklyPrice / (5 * m.pricePerDay)) * 100)
    : (m.weeklyDiscountPercent ?? 0);
  const monthly = m.monthlyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.monthlyPrice / (28 * m.pricePerDay)) * 100)
    : (m.monthlyDiscountPercent ?? 0);
  return { weekly: Math.max(0, weekly), monthly: Math.max(0, monthly) };
}
