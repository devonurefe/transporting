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

// Strict weekend: a 2-day rental on Sat+Sun (start = Saturday), or a 3-day rental
// on Fri+Sat+Sun (start = Friday). getUTCDay(): 0=Sun, 5=Fri, 6=Sat. Dates are
// "YYYY-MM-DD" → parsed as UTC midnight, so getUTCDay() is timezone-safe.
// Mirrored by server/routes/orders.ts — keep identical.
export function isStrictWeekend(startDate: string | Date | undefined, days: number): boolean {
  if (!startDate) return false; // no date → not a weekend (safe default)
  const dow = new Date(startDate).getUTCDay();
  if (days === 2) return dow === 6; // Saturday → Sat+Sun
  if (days === 3) return dow === 5; // Friday → Fri+Sat+Sun
  return false;
}

export function evaluateDiscountPercent(machine: Machine, days: number, profile: string, rules: CampaignRule[]): number {
  let highestDiscount = 0;

  // 1. Weekly/Monthly volume discounts
  if (days >= 30 && machine.monthlyDiscountPercent) {
    highestDiscount = Math.max(highestDiscount, machine.monthlyDiscountPercent);
  } else if (days >= 7 && machine.weeklyDiscountPercent) {
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

  // 3-day weekend (Fri+Sat+Sun) gets weekendPrice; otherwise weeklyPrice applies from 3 days up
  if (days === 3 && isStrictWeekend(startDate, days) && machine.weekendPrice) return machine.weekendPrice;

  // 3 or 4 days: if weeklyPrice is set, charge the flat weekly rate (same as 5 days)
  if ((days === 3 || days === 4) && machine.weeklyPrice) return machine.weeklyPrice;

  // Weekly flat rate: 5–27 days
  if (days >= 5 && days < 28 && machine.weeklyPrice) {
    const fullWeeks = Math.floor(days / 5);
    const remainder = days % 5;
    return fullWeeks * machine.weeklyPrice + remainder * machine.pricePerDay;
  }

  // Monthly flat rate: 28+ days
  if (days >= 28 && machine.monthlyPrice) {
    const fullMonths = Math.floor(days / 28);
    const remainder = days % 28;
    let remainderCost: number;
    if (remainder >= 5 && machine.weeklyPrice) {
      remainderCost = Math.floor(remainder / 5) * machine.weeklyPrice + (remainder % 5) * machine.pricePerDay;
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
