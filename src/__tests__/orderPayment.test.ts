/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Betaald" was een vlag zonder bedrag. Bewerkt een beheerder een order ná de
 * betaling — een klant belt om te verlengen — dan herberekent
 * PATCH /api/orders/:id het totaal, blijft paymentStatus op "paid" staan en gaat
 * er géén nieuwe betaallink uit (die wordt voor een betaalde order bewust
 * overgeslagen, anders kan de klant twee keer betalen). Een huur die van €100
 * naar €150 ging, stond daardoor in het adminpaneel als volledig betaald.
 *
 * Order.paidAmount legt vast wat er werkelijk binnenkwam; deze helpers maken het
 * verschil zichtbaar in plaats van het te laten verdwijnen.
 */
import { describe, it, expect } from "vitest";
import { outstandingBalance, isPartiallyPaid, overpaidAmount, paymentBadgeLabel } from "../utils/orderPayment";

describe("Openstaand restbedrag na een bewerking", () => {
  it("verlenging na betaling laat het verschil openstaan", () => {
    const order = { paymentStatus: "paid", totalAmount: 150, paidAmount: 100 };
    expect(outstandingBalance(order)).toBe(50);
    expect(isPartiallyPaid(order)).toBe(true);
    expect(paymentBadgeLabel(order)).toBe("Deels betaald");
  });

  it("een volledig betaalde order heeft niets openstaan", () => {
    const order = { paymentStatus: "paid", totalAmount: 150, paidAmount: 150 };
    expect(outstandingBalance(order)).toBe(0);
    expect(isPartiallyPaid(order)).toBe(false);
    expect(paymentBadgeLabel(order)).toBe("Betaald");
  });

  it("centenverschil telt niet als openstaand", () => {
    const order = { paymentStatus: "paid", totalAmount: 150.005, paidAmount: 150 };
    expect(outstandingBalance(order)).toBe(0);
    expect(paymentBadgeLabel(order)).toBe("Betaald");
  });

  it("een onbetaalde order heeft geen restbedrag — daar gaat de gewone flow over", () => {
    expect(outstandingBalance({ paymentStatus: "awaiting", totalAmount: 150, paidAmount: null })).toBe(0);
    expect(paymentBadgeLabel({ paymentStatus: "awaiting", totalAmount: 150 })).toBe("In Afwachting");
  });

  it("legacy-order zonder paidAmount geldt als volledig betaald", () => {
    // Anders zou elke afgeronde huur van vóór dit veld ineens als deels betaald
    // in beeld komen — een berg valse meldingen.
    const order = { paymentStatus: "paid", totalAmount: 150, paidAmount: null };
    expect(outstandingBalance(order)).toBe(0);
    expect(paymentBadgeLabel(order)).toBe("Betaald");
  });
});

describe("Te veel ontvangen", () => {
  it("inkorten na betaling levert een teveel op", () => {
    const order = { paymentStatus: "paid", totalAmount: 80, paidAmount: 100 };
    expect(overpaidAmount(order)).toBe(20);
    expect(outstandingBalance(order)).toBe(0);
    expect(paymentBadgeLabel(order)).toBe("Te veel betaald");
  });

  it("teruggestort blijft teruggestort", () => {
    expect(paymentBadgeLabel({ paymentStatus: "refunded", totalAmount: 100, paidAmount: 100 })).toBe("Teruggestort");
    expect(overpaidAmount({ paymentStatus: "refunded", totalAmount: 80, paidAmount: 100 })).toBe(0);
  });
});
