/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Markers van eenmalige datamigraties stonden in InvoiceCounter — de tabel met
 * de wettelijk verplichte, doorlopende factuurreeks. Ze wonen nu in AppMarker.
 *
 * Het risico zit niet in de verhuizing zelf maar in het verliezen van een
 * marker: dan draait een eenmalige migratie opnieuw, en
 * migration-nifty-hinowa-prices-2026-07 zet daarbij prijzen terug die de
 * beheerder daarna met de hand heeft aangepast. Daarom leest hasMarker beide
 * locaties, en verwijdert migrateLegacyMarkers een oude rij pas nadat de nieuwe
 * aantoonbaar bestaat. Dat is wat hier wordt vastgezet.
 *
 * Vereist een bereikbare PostgreSQL (DATABASE_URL); zonder database wordt het
 * blok overgeslagen zodat `npm test` infravrij blijft — CI draait het wél.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env.VITEST = "true";
process.env.JWT_SECRET ||= "marker-test-secret";

const HAS_DB = !!process.env.DATABASE_URL;

const LEGACY_ID = "itest-marker-legacy";
const FRESH_ID = "itest-marker-fresh";
const COUNTER_ID = "default";

describe.skipIf(!HAS_DB)("AppMarker — verhuizing uit de factuurteller", () => {
  let prisma: any;
  let markers: typeof import("../../server/utils/appMarker.js");

  beforeAll(async () => {
    prisma = (await import("../../prisma/client.js")).prisma;
    markers = await import("../../server/utils/appMarker.js");
    await prisma.appMarker.deleteMany({ where: { id: { in: [LEGACY_ID, FRESH_ID] } } }).catch(() => {});
    await prisma.invoiceCounter.deleteMany({ where: { id: { in: [LEGACY_ID, FRESH_ID] } } }).catch(() => {});
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.appMarker.deleteMany({ where: { id: { in: [LEGACY_ID, FRESH_ID] } } }).catch(() => {});
    await prisma.invoiceCounter.deleteMany({ where: { id: { in: [LEGACY_ID, FRESH_ID] } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("een marker die nog op de oude plek staat, telt gewoon als gezet", async () => {
    // Dit is de kern: zolang de oude rij bestaat mag een migratie NOOIT opnieuw draaien.
    await prisma.invoiceCounter.create({ data: { id: LEGACY_ID, lastNumber: 20260803 } });
    expect(await markers.hasMarker(LEGACY_ID)).toBe(true);
    expect(await markers.getMarkerValue(LEGACY_ID)).toBe(20260803);
  });

  it("verhuizen zet de marker over met behoud van de waarde en ruimt de oude rij op", async () => {
    await markers.migrateLegacyMarkers();

    const moved = await prisma.appMarker.findUnique({ where: { id: LEGACY_ID } });
    expect(moved?.value).toBe(20260803);
    // Oude rij weg → de factuurtabel is weer alleen van de facturen.
    expect(await prisma.invoiceCounter.findUnique({ where: { id: LEGACY_ID } })).toBeNull();
    // En de marker geldt onverminderd, dus de migratie blijft overgeslagen.
    expect(await markers.hasMarker(LEGACY_ID)).toBe(true);
  });

  it("de factuurteller zelf wordt nooit verhuisd of verwijderd", async () => {
    await prisma.invoiceCounter.upsert({
      where: { id: COUNTER_ID },
      create: { id: COUNTER_ID, lastNumber: 42 },
      update: {}
    });
    const before = await prisma.invoiceCounter.findUnique({ where: { id: COUNTER_ID } });

    await markers.migrateLegacyMarkers();

    const after = await prisma.invoiceCounter.findUnique({ where: { id: COUNTER_ID } });
    expect(after).not.toBeNull();
    expect(after.lastNumber).toBe(before.lastNumber);
    expect(await prisma.appMarker.findUnique({ where: { id: COUNTER_ID } })).toBeNull();
  });

  it("verhuizen is idempotent en overschrijft een al verhuisde marker niet", async () => {
    await markers.setMarker(FRESH_ID, 7);
    // Een oude rij met een andere waarde mag de nieuwe niet terugzetten.
    await prisma.invoiceCounter.create({ data: { id: FRESH_ID, lastNumber: 999 } });

    await markers.migrateLegacyMarkers();
    await markers.migrateLegacyMarkers();

    expect(await markers.getMarkerValue(FRESH_ID)).toBe(7);
    expect(await prisma.invoiceCounter.findUnique({ where: { id: FRESH_ID } })).toBeNull();
  });

  it("een onbekende marker is niet gezet", async () => {
    expect(await markers.hasMarker("itest-marker-bestaat-niet")).toBe(false);
    expect(await markers.getMarkerValue("itest-marker-bestaat-niet")).toBeNull();
  });
});
