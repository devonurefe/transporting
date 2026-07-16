/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prijs-spiegel voor transport-/add-on-tarieven: server/utils/fees.ts
 * (resolveFees) en src/utils/pricing.ts (getTransportFees/getGlobalAddons)
 * moeten voor elke SiteConfig-invoer IDENTIEKE getallen opleveren — anders
 * faalt de ordervalidatie in server/routes/orders.ts met "Ongeldig
 * transportbedrag". Deze test draait beide resolvers naast elkaar.
 */
import { describe, it, expect } from "vitest";
import { getTransportFees, getGlobalAddons, DEFAULT_TRANSPORT_FEES, DEFAULT_GLOBAL_ADDONS } from "../utils/pricing";

process.env.JWT_SECRET ||= "unit-test-secret";
const { resolveFees } = await import("../../server/utils/fees.js");

describe("Transport-/add-on-tarieven — client/server pariteit", () => {
  it("beide kanten gebruiken dezelfde defaults zonder SiteConfig", () => {
    const client = { transport: getTransportFees(null), addons: getGlobalAddons(null) };
    const server = resolveFees(null);
    expect(client.transport).toEqual({ deliveryFee: DEFAULT_TRANSPORT_FEES.deliveryFee, trailerPerDay: DEFAULT_TRANSPORT_FEES.trailerPerDay });
    expect(server.deliveryFee).toBe(client.transport.deliveryFee);
    expect(server.trailerPerDay).toBe(client.transport.trailerPerDay);
    expect(server.addons.safety).toEqual(client.addons.safety);
    expect(server.addons.rijplaten).toEqual(client.addons.rijplaten);
  });

  it("beide kanten passen een geldige admin-override identiek toe", () => {
    const siteConfig = {
      transportFees: { deliveryFee: 175, trailerPerDay: 30 },
      globalAddons: {
        safety: { name: "Veiligheidspakket", pricePerWeek: 20 },
        rijplaten: { name: "Rijplaten XL", pricePerWeek: 8 }
      }
    };
    const client = { transport: getTransportFees(siteConfig), addons: getGlobalAddons(siteConfig) };
    const server = resolveFees(siteConfig);
    expect(server.deliveryFee).toBe(client.transport.deliveryFee);
    expect(server.trailerPerDay).toBe(client.transport.trailerPerDay);
    expect(server.addons.safety).toEqual(client.addons.safety);
    expect(server.addons.rijplaten).toEqual(client.addons.rijplaten);
    expect(client.transport).toEqual({ deliveryFee: 175, trailerPerDay: 30 });
  });

  it("beide kanten vallen terug op de default bij een ongeldig (te hoog) tarief", () => {
    const siteConfig = { transportFees: { deliveryFee: 5000, trailerPerDay: -10 } };
    const client = getTransportFees(siteConfig as any);
    const server = resolveFees(siteConfig as any);
    expect(client).toEqual(DEFAULT_TRANSPORT_FEES);
    expect(server.deliveryFee).toBe(DEFAULT_TRANSPORT_FEES.deliveryFee);
    expect(server.trailerPerDay).toBe(DEFAULT_TRANSPORT_FEES.trailerPerDay);
  });

  it("beide kanten vallen terug op de default add-on-naam bij een lege string", () => {
    const siteConfig = { globalAddons: { safety: { name: "", pricePerWeek: 12 }, rijplaten: { name: "  ", pricePerWeek: 5 } } };
    const client = getGlobalAddons(siteConfig as any);
    const server = resolveFees(siteConfig as any);
    expect(client.safety.name).toBe(DEFAULT_GLOBAL_ADDONS.safety.name);
    expect(client.rijplaten.name).toBe(DEFAULT_GLOBAL_ADDONS.rijplaten.name);
    expect(server.addons.safety.name).toBe(DEFAULT_GLOBAL_ADDONS.safety.name);
    expect(server.addons.rijplaten.name).toBe(DEFAULT_GLOBAL_ADDONS.rijplaten.name);
  });

  it("een order-totaal met overridden tarieven komt overeen tussen client en server", () => {
    const siteConfig = { transportFees: { deliveryFee: 200, trailerPerDay: 40 } };
    const days = 3;
    const clientTrailerCost = getTransportFees(siteConfig).trailerPerDay * days;
    const serverTrailerCost = resolveFees(siteConfig).trailerPerDay * days;
    expect(clientTrailerCost).toBe(serverTrailerCost);
    expect(clientTrailerCost).toBe(120);
  });
});
