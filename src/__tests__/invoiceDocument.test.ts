/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Het factuurdocument sprak zichzelf tegen. Bovenaan stond een correct
 * statusvak ("OPENSTAAND"), maar de voettekst meldde onvoorwaardelijk
 * "Betalingswijze: Voldaan via iDEAL / Tikkie betaallink" — óók op een order die
 * nog niets betaald had. Dat kon echt gebeuren: een order met
 * paymentMethod "on_location" mag onbetaald doorgezet worden naar "Goedgekeurd"
 * (server/routes/orders.ts laat die uitzondering expliciet toe), en kreeg dan
 * een officiële factuur met "Voldaan" erop.
 *
 * Daarnaast bepaalde elke aanroeper zelf of iets pro-forma was. Het klantscherm
 * gaf altijd `true` mee, zodat een klant zelfs bij een afgeronde, betaalde huur
 * nooit iets anders dan "PRO-FORMA / OFFERTE" kon downloaden.
 */
import { describe, it, expect } from "vitest";
import { invoiceDocumentState } from "../utils/invoice";

const order = (over: Partial<Parameters<typeof invoiceDocumentState>[0]> = {}) => ({
  id: "HWH-ABCD1234",
  invoiceNumber: null,
  status: "In behandeling",
  paymentStatus: "awaiting",
  paymentMethod: "link",
  ...over
}) as Parameters<typeof invoiceDocumentState>[0];

describe("Pro-forma volgt het factuurnummer, niet de status", () => {
  it("zonder factuurnummer is het een offerte", () => {
    const s = invoiceDocumentState(order());
    expect(s.proforma).toBe(true);
    expect(s.documentTitle).toBe("PRO-FORMA FACTUUR / OFFERTE");
  });

  it("met factuurnummer is het een officiële factuur, ook op het klantscherm", () => {
    const s = invoiceDocumentState(order({ invoiceNumber: "Factuur 260013", status: "Voltooid", paymentStatus: "paid" }));
    expect(s.proforma).toBe(false);
    expect(s.documentTitle).toBe("OFFICIËLE HUUROVEREENKOMST & FACTUUR");
    expect(s.paymentStatusLabel).toBe("BETAALD");
  });
});

describe("De voettekst spreekt het statusvak nooit tegen", () => {
  it("goedgekeurde on-locatie-order die nog niet betaald is claimt geen betaling", () => {
    // Precies het geval dat eerder "Voldaan via iDEAL" opleverde.
    const s = invoiceDocumentState(order({
      invoiceNumber: "Factuur 260013",
      status: "Goedgekeurd",
      paymentStatus: "awaiting",
      paymentMethod: "on_location"
    }));
    expect(s.paymentStatusLabel).toBe("OPENSTAAND");
    expect(s.paymentFooterLine).not.toMatch(/Voldaan/);
    expect(s.paymentFooterLine).toMatch(/Nog te voldoen op locatie/);
  });

  it("onbetaalde link-order vraagt om betaling via de link", () => {
    const s = invoiceDocumentState(order({ invoiceNumber: "Factuur 260014", status: "Goedgekeurd" }));
    expect(s.paymentStatusLabel).toBe("OPENSTAAND");
    expect(s.paymentFooterLine).toMatch(/Nog te voldoen via de toegestuurde iDEAL/);
  });

  it("betaalde on-locatie-order noemt het juiste kanaal", () => {
    const s = invoiceDocumentState(order({
      invoiceNumber: "Factuur 260015",
      status: "Voltooid",
      paymentStatus: "paid",
      paymentMethod: "on_location"
    }));
    expect(s.paymentFooterLine).toBe("Betalingswijze: Voldaan op locatie. Factuurkenmerk: Factuur 260015");
  });

  it("betaalde link-order noemt het juiste kanaal", () => {
    const s = invoiceDocumentState(order({ invoiceNumber: "Factuur 260016", status: "Voltooid", paymentStatus: "paid" }));
    expect(s.paymentFooterLine).toBe("Betalingswijze: Voldaan via iDEAL / Tikkie betaallink. Factuurkenmerk: Factuur 260016");
  });

  it("terugbetaalde order meldt dat, en claimt geen openstaande betaling", () => {
    const s = invoiceDocumentState(order({ invoiceNumber: "Factuur 260017", status: "Geannuleerd", paymentStatus: "refunded" }));
    expect(s.paymentStatusLabel).toBe("GEANNULEERD");
    expect(s.paymentFooterLine).toMatch(/Terugbetaald/);
  });

  it("een offerte belooft nooit dat er al betaald is", () => {
    for (const paymentMethod of ["link", "on_location"] as const) {
      const s = invoiceDocumentState(order({ paymentMethod }));
      expect(s.proforma).toBe(true);
      expect(s.paymentFooterLine).not.toMatch(/Voldaan/);
    }
  });
});
