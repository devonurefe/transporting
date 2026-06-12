import { describe, it, expect } from "vitest";
import { calculateItemSubtotal, calculateRentalDays, evaluateDiscountPercent } from "../utils/pricing";
import { Machine, CampaignRule } from "../types";

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

describe("calculateItemSubtotal — flat rates", () => {
  it("1 day uses oneDayPrice actie", () => {
    expect(calculateItemSubtotal(nifty120, 1, "Particulier", noRules)).toBe(50);
  });

  it("2 days uses twoDayPrice over weekendPrice", () => {
    expect(calculateItemSubtotal(nifty120, 2, "Particulier", noRules)).toBe(190);
  });

  it("2 days falls back to weekendPrice when no twoDayPrice", () => {
    const m = { ...nifty120, twoDayPrice: undefined } as Machine;
    expect(calculateItemSubtotal(m, 2, "Particulier", noRules)).toBe(150);
  });

  it("3 days uses weekendPrice", () => {
    expect(calculateItemSubtotal(nifty120, 3, "Particulier", noRules)).toBe(150);
  });

  it("4 days has no flat rate → pricePerDay × 4", () => {
    expect(calculateItemSubtotal(nifty120, 4, "Particulier", noRules)).toBe(4 * 95);
  });

  it("5 days uses weeklyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 5, "Particulier", noRules)).toBe(335);
  });

  it("7 days = 1 week + 2 days pro-rata", () => {
    expect(calculateItemSubtotal(nifty120, 7, "Particulier", noRules)).toBe(335 + 2 * 95);
  });

  it("27 days = 5 weeks + 2 days pro-rata (still weekly tier)", () => {
    expect(calculateItemSubtotal(nifty120, 27, "Particulier", noRules)).toBe(5 * 335 + 2 * 95);
  });

  it("28 days uses monthlyPrice", () => {
    expect(calculateItemSubtotal(nifty120, 28, "Particulier", noRules)).toBe(490);
  });

  it("33 days = 1 month + 5-day week remainder", () => {
    expect(calculateItemSubtotal(nifty120, 33, "Particulier", noRules)).toBe(490 + 335);
  });

  it("30 days = 1 month + 2 days at day rate", () => {
    expect(calculateItemSubtotal(nifty120, 30, "Particulier", noRules)).toBe(490 + 2 * 95);
  });

  it("56 days = 2 months", () => {
    expect(calculateItemSubtotal(nifty120, 56, "Particulier", noRules)).toBe(2 * 490);
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
