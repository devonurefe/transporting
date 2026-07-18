/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Boeken E2E — per categorie één machine, meerdere datumscenario's.
 *
 * Bewijst dat de klant op ELKE plek hetzelfde bedrag ziet:
 *  1. Catalogus-tarieventabel (buildPricingTierRows) == boekingsengine
 *     (calculateItemSubtotal) voor het overeenkomstige dagaantal/startdag.
 *  2. Laatste boekingsstap (frontend-subtotaal + transport + 21% btw, exact
 *     zoals BookingSection.tsx het bouwt) wordt door de server-prijsspiegel
 *     in server/routes/orders.ts geaccepteerd (201, geen "Totaalbedrag klopt
 *     niet") — de spiegel is dus niet gedrift.
 *  3. Admin (GET /api/orders + de opgeslagen order-rij) toont exact dezelfde
 *     subtotaal/btw/totaalbedragen als de klant in stap 3 zag.
 *  4. Kalender: dubbele boeking → 409 met conflictdatums, geblokkeerde datum
 *     → 409, en de frontend-beschikbaarheidscheck (checkAvailability) komt tot
 *     hetzelfde oordeel als de server.
 *
 * Vereist een bereikbare PostgreSQL (DATABASE_URL) mét geseede machines;
 * zonder DATABASE_URL wordt het blok overgeslagen zodat `npm test` infravrij
 * blijft. Is de database leeg (CI), dan worden categorieën zonder machine
 * gerapporteerd als overgeslagen i.p.v. gefaald.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  calculateItemSubtotal,
  buildPricingTierRows,
  buildTierDisplay,
  billableWeeks,
  getTransportFees,
  getGlobalAddons,
} from "../utils/pricing";
import { checkAvailability } from "../utils/availability";
import type { Machine, CampaignRule } from "../types";

// Moet vóór het importeren van de server gezet zijn.
process.env.VITEST = "true";
process.env.JWT_SECRET ||= "e2e-test-secret";

const HAS_DB = !!process.env.DATABASE_URL;

const TEST_EMAIL = "e2e.categorie.test@example.com";
const PROFILE = "Particulier";

// Alle categorieën uit prisma/seed.ts — per categorie testen we de eerste
// actieve machine tegen het volledige scenario-raster.
const CATEGORY_IDS = [
  "aanhanger",
  "spin",
  "schaarlift",
  "schaarlift-smal",
  "schaarlift-6m",
  "mastlift",
  "kamersteiger",
  "ladderlift",
  "ecolift",
] as const;

// ── Datumhelpers (UTC, YYYY-MM-DD — consistent met de getUTCDay()-prijslogica)
const iso = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
// Eerste maandag minstens `minDaysAhead` dagen vooruit — deterministische
// weekdagen voor de weekend-/blokkadescenario's, altijd in de toekomst.
function nextMonday(minDaysAhead: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

interface Scenario {
  label: string;
  start: Date;
  days: number;
}

// Het scenario-raster: alle prijspaden (dagactie, 2/3/4-daags, werkweek,
// extra dagen, maand, weekendpakket, zondagblokkade, vr+za+zo zonder blokkade).
function scenariosFor(m: Machine, mon: Date): Scenario[] {
  const fri = addDays(mon, 4);
  const sat = addDays(mon, 5);
  const sun = addDays(mon, 6);
  const minDays = m.minRentalDays ?? 1;
  const s: Scenario[] = [];
  if (minDays <= 1) s.push({ label: "1 dag (ma)", start: mon, days: 1 });
  s.push({ label: "2 dagen (ma-di)", start: mon, days: 2 });
  s.push({ label: "3 dagen (ma-wo)", start: mon, days: 3 });
  s.push({ label: "4 dagen (ma-do)", start: mon, days: 4 });
  s.push({ label: "5 dagen werkweek (ma-vr)", start: mon, days: 5 });
  s.push({ label: "8 dagen (ma-ma)", start: mon, days: 8 });
  s.push({ label: "28 dagen (4 weken)", start: mon, days: 28 });
  if (minDays <= 1) {
    s.push({ label: "alleen zaterdag", start: sat, days: 1 });
    s.push({ label: "alleen zondag", start: sun, days: 1 });
  }
  s.push({ label: "za+zo (weekend)", start: sat, days: 2 });
  s.push({ label: "vr+za (zondagblokkade)", start: fri, days: 2 });
  s.push({ label: "vr+za+zo (geen blokkade)", start: fri, days: 3 });
  return s;
}

describe.skipIf(!HAS_DB)("Boeken E2E — per categorie prijs- en kalendertest", () => {
  let app: Express;
  let prisma: any;
  let campaignRules: CampaignRule[] = [];
  let siteConfig: any = null;
  let adminToken = "";
  let machineByCategory = new Map<string, Machine>();
  const baseMonday = nextMonday(10);
  const createdOrderIds: string[] = [];

  // De order-limiter staat op 6 orders/uur per IP; trust proxy = 1, dus een
  // uniek X-Forwarded-For per request geeft elke testorder zijn eigen bucket.
  let ipCounter = 0;
  const nextIp = () => {
    ipCounter++;
    return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  };

  // Boek exact zoals BookingSection.tsx stap 3 het doet: frontend-subtotaal
  // via calculateItemSubtotal, btw = round((subtotaal+transport+addons)*21)/100.
  async function placeOrder(
    m: Machine,
    sc: Scenario,
    opts: { deliveryType?: string; addons?: any[]; addonsTotal?: number; keep?: boolean } = {}
  ) {
    const deliveryType = opts.deliveryType ?? "self_pickup";
    const fees = getTransportFees(siteConfig);
    const transport =
      deliveryType === "delivery_by_us" ? fees.deliveryFee
      : deliveryType === "trailer_rental" ? fees.trailerPerDay * sc.days
      : 0;
    const subtotal = calculateItemSubtotal(m, sc.days, PROFILE, campaignRules, iso(sc.start));
    const addonsTotal = opts.addonsTotal ?? 0;
    const vat = Math.round((subtotal + transport + addonsTotal) * 21) / 100;
    const total = parseFloat((subtotal + transport + addonsTotal + vat).toFixed(2));

    const res = await request(app)
      .post("/api/orders")
      .set("X-Forwarded-For", nextIp())
      .send({
        machineId: m.id,
        machineName: m.name,
        machinePrice: m.pricePerDay,
        startDate: iso(sc.start),
        endDate: iso(addDays(sc.start, sc.days - 1)),
        rentalDays: sc.days,
        deliveryType,
        deliveryAddress: deliveryType === "self_pickup" ? undefined : "Teststraat 1, 2381 AB Zoeterwoude",
        customerName: "E2E Categorie Test",
        customerEmail: TEST_EMAIL,
        customerPhone: "0611848899",
        customerProfile: PROFILE,
        subtotal,
        transportCost: transport,
        driverCost: 0,
        vatAmount: vat,
        totalAmount: total,
        addons: opts.addons ?? [],
      });

    if (res.status === 201) {
      createdOrderIds.push(res.body.id);
      if (!opts.keep) {
        // Direct opruimen zodat het volgende scenario op dezelfde machine
        // geen kunstmatig kalenderconflict raakt.
        await prisma.order.delete({ where: { id: res.body.id } }).catch(() => {});
      }
    }
    return { res, expected: { subtotal, transport, vat, total, addonsTotal } };
  }

  beforeAll(async () => {
    ({ prisma } = await import("../../prisma/client.js"));
    ({ app } = await import("../../server.ts"));

    // Exclude ephemeral fixtures other integration test files create in the
    // same shared CI database (e.g. api.integration.test.ts's "itest-machine",
    // category "schaarlift") — Vitest runs test files in parallel, so this
    // suite's beforeAll can otherwise grab a fixture machine right before its
    // own afterAll deletes it, turning every order placed against it into a
    // flaky 404 "Machine niet gevonden" instead of the intended real seeded
    // machine for that category.
    const machines = await prisma.machine.findMany({
      where: { isActive: true, deletedAt: null, id: { not: { startsWith: "itest-" } } },
      orderBy: { id: "asc" },
    });
    for (const m of machines) {
      if (!machineByCategory.has(m.category)) machineByCategory.set(m.category, m as Machine);
    }

    siteConfig = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    campaignRules = Array.isArray(siteConfig?.campaignRules) ? siteConfig.campaignRules : [];

    // Admin-token direct via generateToken (zelfde util als de loginroute),
    // zodat de test niet afhangt van een bekend admin-wachtwoord.
    const admin = await prisma.admin.findFirst({ where: { isActive: true } });
    if (admin) {
      const { generateToken } = await import("../../server/utils/auth.js");
      adminToken = generateToken({ id: admin.id, email: admin.email, role: "admin", v: admin.tokenVersion ?? 0 });
    }
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.order.deleteMany({ where: { customerEmail: TEST_EMAIL } }).catch(() => {});
    await prisma.blockedDate.deleteMany({ where: { id: { startsWith: "e2e-test-" } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  // ────────────────────────────────────────────────────────────────────────
  // 1+2+3. Per categorie: boek elk scenario en verifieer dat de server het
  // frontend-bedrag accepteert én exact dezelfde bedragen opslaat (= wat de
  // admin en de factuur tonen).
  // ────────────────────────────────────────────────────────────────────────
  it.each(CATEGORY_IDS)(
    "categorie %s — alle datumscenario's: frontendprijs == serverprijs == opgeslagen order",
    async (categoryId) => {
      const m = machineByCategory.get(categoryId);
      if (!m) {
        console.warn(`[E2E] categorie ${categoryId}: geen actieve machine in DB — overgeslagen`);
        return;
      }

      for (const sc of scenariosFor(m, baseMonday)) {
        const { res, expected } = await placeOrder(m, sc);
        const ctx = `${m.name} [${m.id}] — ${sc.label}`;

        // De server-prijsspiegel accepteert het frontend-totaal (geen drift).
        expect(res.status, `${ctx}: ${JSON.stringify(res.body)}`).toBe(201);
        // Opgeslagen bedragen (= wat AdminOrders/factuur tonen) == stap-3 bedragen.
        expect(res.body.subtotal, `${ctx}: opgeslagen subtotaal`).toBeCloseTo(expected.subtotal, 2);
        expect(res.body.vatAmount, `${ctx}: opgeslagen btw`).toBeCloseTo(expected.vat, 2);
        expect(res.body.totalAmount, `${ctx}: opgeslagen totaal`).toBeCloseTo(expected.total, 2);
        expect(res.body.rentalDays, `${ctx}: dagen`).toBe(sc.days);
        expect(res.body.machinePrice, `${ctx}: dagtarief`).toBeCloseTo(m.pricePerDay, 2);
      }
    },
    120_000
  );

  // ────────────────────────────────────────────────────────────────────────
  // 1. Catalogus: elke rij in de klantzichtbare tarieventabel moet exact het
  // bedrag zijn dat de boekingsengine voor die selectie rekent.
  // ────────────────────────────────────────────────────────────────────────
  it.each(CATEGORY_IDS)("categorie %s — catalogus-tarieventabel == boekingsengine", (categoryId) => {
    const m = machineByCategory.get(categoryId);
    if (!m) return;

    const mon = baseMonday;
    const fri = addDays(mon, 4);
    const sat = addDays(mon, 5);
    const sun = addDays(mon, 6);
    const calc = (days: number, start: Date) =>
      calculateItemSubtotal(m, days, PROFILE, campaignRules, iso(start));

    for (const row of buildPricingTierRows(m)) {
      const ctx = `${m.name} [${m.id}] — rij "${row.period}"`;
      switch (row.period) {
        case "Dagactie":
        case "1 dag":
          expect(calc(1, mon), ctx).toBeCloseTo(row.price, 2);
          break;
        case "2 dagen":
        case "2 dagen (doordeweeks)":
        case "2 dagen (min.)":
          expect(calc(2, mon), ctx).toBeCloseTo(row.price, 2);
          break;
        case "Vrijdag + Zaterdag":
          expect(calc(2, fri), ctx).toBeCloseTo(row.price, 2);
          // Eigenaarsconventie: vr+za (2-daags + blokkade) == 3-daagse prijs.
          if (m.threeDayPrice) expect(row.price, `${ctx}: == 3-daags`).toBeCloseTo(m.threeDayPrice, 2);
          break;
        case "3 dagen":
          expect(calc(3, mon), ctx).toBeCloseTo(row.price, 2);
          break;
        case "4 dagen":
          expect(calc(4, mon), ctx).toBeCloseTo(row.price, 2);
          break;
        case "5 dagen (werkweek)":
          expect(calc(5, mon), ctx).toBeCloseTo(row.price, 2);
          break;
        case "Extra dag": {
          // Advies-rij: dag 6 kost werkweek + extra (de engine rondt het
          // totaal af, dus max ±0,50 verschil bij een fractioneel extratarief).
          // Start op woensdag: een 6-daagse huur ma-za zou op zaterdag eindigen
          // en terecht de zondagblokkade erbij krijgen — wo-ma niet.
          const day6 = calc(6, addDays(mon, 2));
          const viaRow = (m.weeklyPrice ?? 0) + row.price;
          const capped = m.monthlyPrice ? Math.min(viaRow, m.monthlyPrice) : viaRow;
          expect(Math.abs(day6 - capped), `${ctx}: dag-6 prijs`).toBeLessThanOrEqual(0.5);
          break;
        }
        case "Weekend":
          if (m.weekendRulesEnabled) {
            // Weekendpakket: losse za, losse zo én za+zo → allemaal de flat rate.
            expect(calc(1, sat), `${ctx}: losse za`).toBeCloseTo(row.price, 2);
            expect(calc(1, sun), `${ctx}: losse zo`).toBeCloseTo(row.price, 2);
            expect(calc(2, sat), `${ctx}: za+zo`).toBeCloseTo(row.price, 2);
          } else {
            // Legacy: strikt za+zo 2-daags weekendtarief.
            expect(calc(2, sat), `${ctx}: za+zo`).toBeCloseTo(row.price, 2);
          }
          break;
        case "4 weken (28 dagen)":
          expect(calc(28, mon), ctx).toBeCloseTo(row.price, 2);
          break;
      }
    }

    // Prijsopbouw-accordeon (stap 1) moet optellen tot het geboekte bedrag.
    const disp = buildTierDisplay(m, 8, iso(mon));
    if (disp.weeklyBreakdown) {
      const sum =
        disp.weeklyBreakdown.weeks * disp.weeklyBreakdown.pricePerWeek +
        (disp.weeklyBreakdown.remainderCost ?? 0);
      expect(sum, `${m.name}: prijsopbouw 8 dagen`).toBeCloseTo(calc(8, mon), 2);
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Transport- en add-on-spiegel (bezorging, aanhanger/dag, Veiligheidsset,
  // Rijplaten × aantal) — één representatieve machine.
  // ────────────────────────────────────────────────────────────────────────
  it("transportkosten (bezorging + aanhanger) spiegelen exact", async () => {
    const m = [...machineByCategory.values()].find((x) => !x.pickupOnly);
    if (!m) return;
    const sc: Scenario = { label: "3 dagen bezorgd", start: baseMonday, days: 3 };

    const del = await placeOrder(m, sc, { deliveryType: "delivery_by_us" });
    expect(del.res.status, JSON.stringify(del.res.body)).toBe(201);
    expect(del.res.body.transportCost).toBeCloseTo(getTransportFees(siteConfig).deliveryFee, 2);
    expect(del.res.body.totalAmount).toBeCloseTo(del.expected.total, 2);

    const trl = await placeOrder(m, sc, { deliveryType: "trailer_rental" });
    expect(trl.res.status, JSON.stringify(trl.res.body)).toBe(201);
    expect(trl.res.body.transportCost).toBeCloseTo(getTransportFees(siteConfig).trailerPerDay * 3, 2);
    expect(trl.res.body.totalAmount).toBeCloseTo(trl.expected.total, 2);
  }, 30_000);

  it("globale add-ons (Veiligheidsset + Rijplaten ×3) spiegelen exact", async () => {
    const m = machineByCategory.get("schaarlift");
    if (!m) return;
    const sc: Scenario = { label: "5 dagen + add-ons", start: baseMonday, days: 5 };
    const addons = getGlobalAddons(siteConfig);
    const weeks = billableWeeks(sc.days, m.minRentalDays);
    const addonsTotal = addons.safety.pricePerWeek * weeks + addons.rijplaten.pricePerWeek * weeks * 3;

    const { res, expected } = await placeOrder(m, sc, {
      addons: [{ id: "safety" }, { id: "rijplaten", quantity: 3 }],
      addonsTotal,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.totalAmount).toBeCloseTo(expected.total, 2);
    const stored = res.body.addons as Array<{ id: string; price: number }>;
    expect(stored.find((a) => a.id === "safety")?.price).toBeCloseTo(addons.safety.pricePerWeek * weeks, 2);
    expect(stored.find((a) => a.id === "rijplaten")?.price).toBeCloseTo(addons.rijplaten.pricePerWeek * weeks * 3, 2);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────────────
  // 4. Kalender: overlap → 409, aansluitende periode → OK, geblokkeerde datum
  // → 409; frontend-checkAvailability oordeelt identiek; admin ziet de order.
  // ────────────────────────────────────────────────────────────────────────
  it("kalender: dubbele boeking geweigerd, frontend & admin consistent", async () => {
    const m = machineByCategory.get("mastlift") ?? [...machineByCategory.values()][0];
    if (!m) return;
    // Eigen datumvenster, ver van de scenario-datums.
    const winStart = addDays(baseMonday, 35);

    // Order A: 3 dagen — blijft staan voor de conflictchecks.
    const scA: Scenario = { label: "kalender order A", start: winStart, days: 3 };
    const a = await placeOrder(m, scA, { keep: true });
    expect(a.res.status, JSON.stringify(a.res.body)).toBe(201);
    const orderAId = a.res.body.id;

    // Beschikbaarheidsfeed toont de geboekte periode.
    const avail = await request(app)
      .get(`/api/orders/availability?machineId=${m.id}`)
      .set("X-Forwarded-For", nextIp());
    expect(avail.status).toBe(200);
    const feedRow = avail.body.find((o: any) => o.id === orderAId);
    expect(feedRow, "order A in beschikbaarheidsfeed").toBeTruthy();
    expect(feedRow.startDate).toBe(iso(winStart));
    expect(feedRow.endDate).toBe(iso(addDays(winStart, 2)));

    // Frontend-kalendercheck: overlap → niet beschikbaar; erna → wel.
    const feOverlap = checkAvailability(m.id, iso(addDays(winStart, 1)), iso(addDays(winStart, 4)), avail.body, []);
    expect(feOverlap.available, "frontend: overlap gedetecteerd").toBe(false);
    expect(feOverlap.overlap).toBe(true);
    const bufferDays = (m as any).bufferDays ?? 0;
    const feFree = checkAvailability(
      m.id,
      iso(addDays(winStart, 3 + bufferDays)),
      iso(addDays(winStart, 4 + bufferDays)),
      avail.body,
      [],
      undefined,
      bufferDays
    );
    expect(feFree.available, "frontend: aansluitende periode vrij").toBe(true);

    // Server: overlappende boeking → 409 met de conflictdatums.
    const b = await placeOrder(m, { label: "overlap", start: addDays(winStart, 1), days: 3 });
    expect(b.res.status, "server: overlap geweigerd").toBe(409);
    expect(b.res.body.conflictingDates?.[0]?.start).toBe(iso(winStart));

    // Server: aansluitende periode (na eventuele bufferdagen) → geaccepteerd.
    const c = await placeOrder(m, { label: "aansluitend", start: addDays(winStart, 3 + bufferDays), days: 2 });
    expect(c.res.status, `server: aansluitend vrij — ${JSON.stringify(c.res.body)}`).toBe(201);

    // Admin ziet order A met exact de stap-3 bedragen.
    if (adminToken) {
      const adminRes = await request(app)
        .get("/api/orders?limit=100")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Forwarded-For", nextIp());
      expect(adminRes.status).toBe(200);
      const adminRow = adminRes.body.find((o: any) => o.id === orderAId);
      expect(adminRow, "order A zichtbaar in admin").toBeTruthy();
      expect(adminRow.subtotal).toBeCloseTo(a.expected.subtotal, 2);
      expect(adminRow.vatAmount).toBeCloseTo(a.expected.vat, 2);
      expect(adminRow.totalAmount).toBeCloseTo(a.expected.total, 2);
    }

    // Geblokkeerde datum: admin blokkeert een dag → boeking eroverheen → 409,
    // en de frontend-check oordeelt identiek.
    const blockDate = addDays(winStart, 14);
    await prisma.blockedDate.create({
      data: { id: "e2e-test-block-1", machineId: m.id, date: blockDate, reason: "Onderhoud (e2e-test)" },
    });
    const d = await placeOrder(m, { label: "over geblokkeerde datum", start: addDays(blockDate, -1), days: 3 });
    expect(d.res.status, "server: geblokkeerde datum geweigerd").toBe(409);
    expect(d.res.body.blockedDates?.[0]?.date).toBe(iso(blockDate));
    const feBlocked = checkAvailability(
      m.id,
      iso(addDays(blockDate, -1)),
      iso(addDays(blockDate, 1)),
      [],
      [{ machineId: m.id, date: iso(blockDate), reason: "Onderhoud (e2e-test)" }]
    );
    expect(feBlocked.available).toBe(false);
    expect(feBlocked.blocked).toBe(true);

    // Opruimen: order A + aansluitende order + blokkade.
    await prisma.order.deleteMany({ where: { customerEmail: TEST_EMAIL } });
    await prisma.blockedDate.delete({ where: { id: "e2e-test-block-1" } });
  }, 60_000);
});
