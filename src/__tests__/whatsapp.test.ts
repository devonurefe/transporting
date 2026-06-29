import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl } from "../utils/whatsapp";
import { CartItem, Machine } from "../types";

const nifty = { id: "nifty-120-1", name: "Nifty 120", category: "aanhanger", pricePerDay: 95, weeklyPrice: 335 } as Machine;

// Fri 2026-06-12 → Mon 2026-06-15 = 4 calendar days, 2 weekend days, 2 working days.
const friToMon: CartItem = { id: "c1", machine: nifty, startDate: "2026-06-12", endDate: "2026-06-15" };

function decode(url: string): string {
  return decodeURIComponent(url.split("text=")[1] ?? "");
}

describe("buildWhatsAppUrl — weekend declaration", () => {
  it("'nee' lists the working/weekend day breakdown per machine", () => {
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup", undefined, undefined, undefined, undefined, "nee"));
    expect(text).toContain("NIET in het weekend");
    expect(text).toContain("2 werkdagen berekend");
    expect(text).toContain("2 weekenddagen niet gerekend");
  });

  it("'ja' states the full werkweektarief and no breakdown", () => {
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup", undefined, undefined, undefined, undefined, "ja"));
    expect(text).toContain("Werkt in het weekend");
    expect(text).not.toContain("niet gerekend");
  });

  it("no weekend answer → no weekend declaration block", () => {
    const text = decode(buildWhatsAppUrl([friToMon], "self_pickup"));
    expect(text).not.toContain("WEEKEND VERKLARING");
  });
});
