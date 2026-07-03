import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl } from "../utils/whatsapp";
import { CartItem, Machine } from "../types";

const nifty = { id: "nifty-120-1", name: "Nifty 120", category: "aanhanger", pricePerDay: 95, weeklyPrice: 335 } as Machine;

// Fri 2026-06-12 → Mon 2026-06-15 = 4 calendar days, 2 weekend days, 2 working days.
const friToMon: CartItem = { id: "c1", machine: nifty, startDate: "2026-06-12", endDate: "2026-06-15" };

function decode(url: string): string {
  return decodeURIComponent(url.split("text=")[1] ?? "");
}

describe("buildWhatsAppUrl", () => {
  it("builds a rental request with machine, period and transport, without a weekend declaration block", () => {
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup"));
    expect(text).toContain("Nifty 120");
    expect(text).toContain("2026-06-12");
    expect(text).not.toContain("WEEKEND VERKLARING");
  });

  it("includes contact details and a price overview when provided", () => {
    const totals = { days: 4, subtotal: 268, transport: 0, vat: 56.28, total: 324.28 };
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup", "Jan Jansen", "jan@example.nl", "0612345678", totals));
    expect(text).toContain("Jan Jansen");
    expect(text).toContain("PRIJSOVERZICHT");
  });
});
