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

  // Regression: the breakdown used to print only subtotal + BTW against a total
  // that also included transport, so the arithmetic the customer could see was
  // visibly wrong (268 + 87,78 shown against 505,78 — the €150 delivery fee had
  // silently vanished). Delivery is the default option, so most real orders hit
  // this. The old test only ever passed transport: 0, which never exposed it.
  it("itemises transport so the price breakdown actually adds up", () => {
    // 268 hire + 150 delivery = 418 excl. BTW; 21% = 87,78; total 505,78.
    const totals = { days: 4, subtotal: 268, transport: 150, vat: 87.78, total: 505.78 };
    const text = decode(buildWhatsAppUrl([friToMon], "delivery_by_us", "Jan Jansen", "jan@example.nl", "0612345678", totals));

    expect(text).toContain("Transportkosten");
    // Every euro the customer is charged must be visible as a line item:
    // hire + transport + BTW must reconcile to the stated total.
    const money = (label: string): number => {
      const line = text.split("\n").find(l => l.includes(label));
      if (!line) throw new Error(`Regel ontbreekt in bericht: ${label}`);
      // euro() renders Dutch formatting, e.g. "€ 1.234,56"
      const raw = line.split(":").pop()!.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
      return Number(raw);
    };
    const shownTotal = money("Totaal incl. BTW");
    const reconciled = money("Huurprijs") + money("Transportkosten") + money("BTW 21%");
    expect(reconciled).toBeCloseTo(shownTotal, 2);
  });

  it("omits the transport line when there is nothing to charge for it", () => {
    const totals = { days: 4, subtotal: 268, transport: 0, vat: 56.28, total: 324.28 };
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup", "Jan Jansen", "jan@example.nl", "0612345678", totals));
    expect(text).not.toContain("Transportkosten");
  });
});
