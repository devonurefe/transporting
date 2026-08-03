/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Wil de ontvanger van deze order e-mail?" moet in élke flow hetzelfde
 * antwoord geven — statuswijziging, annulering, betaalherinnering, dagelijkse
 * huurherinnering en het vrijgeven van onbetaalde aanvragen lopen allemaal via
 * deze helpers.
 *
 * De reden dat de order zelf een emailOptOut draagt: het verwijderen van een
 * klant laat de orders staan (bewaarplicht voor facturen) maar zet customerId
 * op null, terwijl customerEmail op de orderregel blijft. Een order zonder
 * customerId telt bewust als gast, en gasten krijgen mail — dus juist iemand
 * die "geen e-mail" had aangevinkt, kreeg na verwijdering weer post. Dat is de
 * regressie die deze test vastzet.
 */
import { describe, it, expect } from "vitest";

process.env.JWT_SECRET ||= "unit-test-secret";
const { wantsEmailFromBatch } = await import("../../server/utils/emailOptIn.js");

describe("wantsEmailFromBatch", () => {
  const optedIn = new Map([["c1", true]]);
  const optedOut = new Map([["c2", false]]);

  it("een gast zonder klantaccount krijgt mail", () => {
    expect(wantsEmailFromBatch(new Map(), { customerId: null })).toBe(true);
  });

  it("een klant die mail wil, krijgt mail", () => {
    expect(wantsEmailFromBatch(optedIn, { customerId: "c1" })).toBe(true);
  });

  it("een klant die mail heeft uitgezet, krijgt geen mail", () => {
    expect(wantsEmailFromBatch(optedOut, { customerId: "c2" })).toBe(false);
  });

  it("een ontbrekend klantrecord telt als 'wil mail'", () => {
    expect(wantsEmailFromBatch(new Map(), { customerId: "onbekend" })).toBe(true);
  });

  it("een verwijderde klant die mail had uitgezet, krijgt nog steeds geen mail", () => {
    // Precies de situatie na het verwijderen: customerId is null (dus zou als
    // gast gelden), maar de voorkeur staat nu op de order.
    expect(wantsEmailFromBatch(new Map(), { customerId: null, emailOptOut: true })).toBe(false);
  });

  it("emailOptOut op de order wint ook van een klant die wél opt-in staat", () => {
    expect(wantsEmailFromBatch(optedIn, { customerId: "c1", emailOptOut: true })).toBe(false);
  });

  it("emailOptOut false/null verandert niets aan het normale gedrag", () => {
    expect(wantsEmailFromBatch(optedOut, { customerId: "c2", emailOptOut: false })).toBe(false);
    expect(wantsEmailFromBatch(optedIn, { customerId: "c1", emailOptOut: null })).toBe(true);
    expect(wantsEmailFromBatch(new Map(), { customerId: null, emailOptOut: false })).toBe(true);
  });
});
