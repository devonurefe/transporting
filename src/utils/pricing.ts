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
// `startDate` ("YYYY-MM-DD") enables real-weekend detection for the 2/3-day tiers.
// Mirrored by the server validation in server/routes/orders.ts — any change
// here must be applied there too, or orders fail with "Totaalbedrag klopt niet".
export function calculateItemSubtotal(machine: Machine, days: number, profile: string, rules: CampaignRule[], startDate?: string | Date): number {
  // 1-day actie flat rate
  if (days === 1 && machine.oneDayPrice) return machine.oneDayPrice;

  // 2-day: weekend (Sat+Sun) → weekendPrice; weekday → twoDayPrice
  if (days === 2) {
    if (isStrictWeekend(startDate, days) && machine.weekendPrice) return machine.weekendPrice;
    if (machine.twoDayPrice) return machine.twoDayPrice;
  }

  // weeklyPrice applies from 3 days up

  // 3–5 days: flat weekly rate
  if ((days === 3 || days === 4 || days === 5) && machine.weeklyPrice) return machine.weeklyPrice;

  // 6–27 days: linear rate derived from weeklyPrice (weeklyPrice/5 per day — always ≤ pricePerDay)
  if (days >= 6 && days < 28 && machine.weeklyPrice) {
    return Math.round(days * (machine.weeklyPrice / 5));
  }

  // Monthly flat rate: 28+ days
  if (days >= 28 && machine.monthlyPrice) {
    const fullMonths = Math.floor(days / 28);
    const remainder = days % 28;
    let remainderCost: number;
    if (remainder >= 3 && machine.weeklyPrice) {
      remainderCost = Math.round(remainder * (machine.weeklyPrice / 5));
    } else {
      remainderCost = remainder * machine.pricePerDay;
    }
    return fullMonths * machine.monthlyPrice + remainderCost;
  }

  // Fallback: pricePerDay × days with percentage discount
  const rawSubtotal = machine.pricePerDay * days;
  const discountPercent = evaluateDiscountPercent(machine, days, profile, rules);
  let discountAmount = rawSubtotal * (discountPercent / 100);
  if (machine.campaignDiscountAmount) {
    discountAmount += machine.campaignDiscountAmount;
  }
  return Math.max(0, rawSubtotal - discountAmount);
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
  const weekly = m.weeklyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.weeklyPrice / (5 * m.pricePerDay)) * 100)
    : (m.weeklyDiscountPercent ?? 0);
  const monthly = m.monthlyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.monthlyPrice / (28 * m.pricePerDay)) * 100)
    : (m.monthlyDiscountPercent ?? 0);
  return { weekly: Math.max(0, weekly), monthly: Math.max(0, monthly) };
}
