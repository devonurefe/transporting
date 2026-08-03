/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Twee prijs-spiegels die eerder stilletjes uit elkaar liepen:
 *
 *  1. Het aantal gefactureerde weken van een GLOBALE add-on (Veiligheidsset,
 *     Rijplaten). De server rekent in computeAddonsTotal met
 *     `max(rentalDays, minRentalDays)`; de client deed dat niet en viel terug op
 *     een vast minimum van 7 dagen. Zolang elke machine een minRentalDays ≤ 7
 *     had gaven beide kanten hetzelfde antwoord, dus niets viel op — maar een
 *     beheerder die in het machineformulier een hogere waarde invult, zorgt
 *     ervoor dat de server élke boeking van die machine mét add-on weigert
 *     ("Totaalbedrag klopt niet"). Deze test dekt juist die waarden af.
 *
 *  2. De btw-afronding. Het prijsoverzicht rekende `totalExcl * 0,21` zónder
 *     afronding, terwijl het verzendpad en de server `Math.round(x * 21) / 100`
 *     gebruiken. Over het bereik €0,01–€20.000 leverde dat bij 17.423 bedragen
 *     een cent verschil op tussen wat de klant op zijn scherm zag en wat er
 *     daadwerkelijk werd afgeschreven — bijvoorbeeld een subtotaal van €101,50:
 *     scherm €122,81, factuur €122,82.
 */
import { describe, it, expect } from "vitest";
import { billableWeeks, computeVatAndTotal } from "../utils/pricing";

process.env.JWT_SECRET ||= "unit-test-secret";
const { computeAddonsTotal, computeVatAndTotal: serverVatAndTotal } = await import("../../server/utils/orderPricing.js");

// Spiegelt globalAddonLine() in src/components/BookingSection.tsx: dát is de
// berekening die de klant op zijn scherm ziet en die meegestuurd wordt.
const clientGlobalAddonPrice = (
  pricePerWeek: number,
  days: number,
  machine: { minRentalDays?: number },
  qty = 1
) => pricePerWeek * billableWeeks(days, machine.minRentalDays) * qty;

const fees = {
  deliveryFee: 150,
  trailerPerDay: 25,
  addons: {
    safety: { name: "Veiligheidsset Pro", pricePerWeek: 15 },
    rijplaten: { name: "Rijplaten", pricePerWeek: 6 }
  }
} as any;

describe("Globale add-on — client/server pariteit over minRentalDays", () => {
  // 14 en 21 zijn de gevallen die vóór de fix uiteenliepen: de client rekende
  // daar 1 week waar de server er 2 respectievelijk 3 rekende.
  const minRentalDaysCases = [undefined, 1, 2, 5, 7, 10, 14, 21];
  const dayCases = [1, 2, 3, 5, 7, 8, 14, 15, 30];

  for (const minRentalDays of minRentalDaysCases) {
    for (const days of dayCases) {
      it(`safety: ${days} dagen, minRentalDays=${String(minRentalDays)}`, () => {
        const machine = { id: "m1", category: "schaarlift", minRentalDays, crossSellAddons: [] };
        const server = computeAddonsTotal(machine, days, [{ id: "safety" }], fees);
        expect("error" in server).toBe(false);
        const client = clientGlobalAddonPrice(fees.addons.safety.pricePerWeek, days, { minRentalDays });
        expect(client).toBe((server as { total: number }).total);
      });
    }
  }

  it("rijplaten met aantal telt aan beide kanten hetzelfde", () => {
    const machine = { id: "m1", category: "schaarlift", minRentalDays: 14, crossSellAddons: [] };
    const server = computeAddonsTotal(machine, 3, [{ id: "rijplaten", quantity: 6 }], fees);
    const client = clientGlobalAddonPrice(fees.addons.rijplaten.pricePerWeek, 3, { minRentalDays: 14 }, 6);
    expect(client).toBe((server as { total: number }).total);
  });
});

describe("Btw — één afronding voor scherm, verzending en server", () => {
  it("client en server geven identieke btw en totalen", () => {
    const cases: Array<[number, number, number, number]> = [
      [101.5, 0, 0, 0],
      [123.45, 150, 0, 15],
      [69, 25, 0, 6],
      [1234.56, 150, 0, 45],
      [0.05, 0, 0, 0],
      [95, 50, 0, 30]
    ];
    for (const [subtotal, transport, driver, addons] of cases) {
      const client = computeVatAndTotal(subtotal, transport, driver, addons);
      const server = serverVatAndTotal(subtotal, transport, driver, addons);
      expect(client).toEqual(server);
    }
  });

  it("btw en totaal zijn op hele centen afgerond", () => {
    // €101,50: de oude, niet-afgeronde schermberekening kwam op een totaal van
    // €122,81 uit terwijl er €122,82 werd afgeschreven.
    const { vat, total } = computeVatAndTotal(101.5, 0, 0, 0);
    expect(vat).toBe(21.32);
    expect(total).toBe(122.82);
  });
});
