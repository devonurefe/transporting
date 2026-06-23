/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { computeDiscounts, countWeekendDays } from "../utils/pricing";
import { Machine } from "../types";

// Reference weekdays (UTC): 2026-06-08 = Mon, 06-12 = Fri, 06-13 = Sat, 06-14 = Sun
describe("countWeekendDays", () => {
  it("returns 0 for a Mon–Fri work week", () => {
    expect(countWeekendDays("2026-06-08", "2026-06-12")).toBe(0);
  });
  it("counts a single Saturday", () => {
    expect(countWeekendDays("2026-06-13", "2026-06-13")).toBe(1);
  });
  it("counts Sat + Sun in a Mon–Sun span", () => {
    expect(countWeekendDays("2026-06-08", "2026-06-14")).toBe(2);
  });
  it("counts both weekends across two weeks", () => {
    expect(countWeekendDays("2026-06-08", "2026-06-21")).toBe(4);
  });
});

describe("computeDiscounts", () => {
  it("suppresses badges for weekly-only products", () => {
    const m = { weeklyOnly: true, pricePerDay: 100, weeklyPrice: 300, monthlyPrice: 1000 } as Machine;
    expect(computeDiscounts(m)).toEqual({ weekly: 0, monthly: 0 });
  });

  it("derives week/month % from flat rates", () => {
    // pricePerDay 95, weeklyPrice 335 -> 1 - 335/475 = 29%; monthlyPrice 490 -> 1 - 490/2660 = 82%
    const m = { pricePerDay: 95, weeklyPrice: 335, monthlyPrice: 490 } as Machine;
    expect(computeDiscounts(m)).toEqual({ weekly: 29, monthly: 82 });
  });

  it("falls back to stored percentages when no flat rates", () => {
    const m = { pricePerDay: 100, weeklyDiscountPercent: 10, monthlyDiscountPercent: 20 } as Machine;
    expect(computeDiscounts(m)).toEqual({ weekly: 10, monthly: 20 });
  });

  it("never returns a negative badge (flat rate above list price)", () => {
    const m = { pricePerDay: 100, weeklyPrice: 600, monthlyPrice: 3500 } as Machine;
    expect(computeDiscounts(m)).toEqual({ weekly: 0, monthly: 0 });
  });
});
