/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API-integratietests (supertest tegen de echte Express-app).
 *
 * Vereist een bereikbare PostgreSQL: draait alleen als DATABASE_URL gezet is
 * (CI levert een postgres-service + `prisma db push`; lokaal `npm test` zonder
 * DATABASE_URL slaat dit blok over zodat de unit-tests infravrij blijven).
 *
 * Dekt de beveiligingskritische serverpaden die voorheen ongetest waren:
 * de order-prijsspiegel, geldigheidschecks en autorisatie.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Moet vóór het importeren van de server gezet zijn.
process.env.VITEST = "true";
process.env.JWT_SECRET ||= "integration-test-secret";

const HAS_DB = !!process.env.DATABASE_URL;

// Datumhelpers (UTC, YYYY-MM-DD) — consistent met de server-prijslogica.
const isoDay = (offsetDays: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

const TEST_MACHINE_ID = "itest-machine";
const PRICE_PER_DAY = 100;
const BLOCKED_EMAIL = "itest.geblokkeerd@example.com";
const LOCKED_OUT_EMAIL = "itest.tijdelijk-vergrendeld@example.com";

// Basispayload voor een geldige order (1 dag, self_pickup, geen add-ons).
// serverTotal = 100 (subtotaal) + 0 (transport) + 21 (21% btw) = 121.
const validOrder = () => ({
  machineId: TEST_MACHINE_ID,
  machineName: "Integration Test Lift",
  machinePrice: PRICE_PER_DAY,
  customerName: "Test Klant",
  customerEmail: "test.klant@example.com",
  customerProfile: "Particulier",
  startDate: isoDay(1),
  endDate: isoDay(1),
  deliveryType: "self_pickup",
  transportCost: 0,
  driverCost: 0,
  totalAmount: 121,
});

describe.skipIf(!HAS_DB)("API integration", () => {
  let app: Express;
  let prisma: any;

  beforeAll(async () => {
    ({ prisma } = await import("../../prisma/client.js"));
    ({ app } = await import("../../server.ts"));

    // Seed één machine waartegen de prijsspiegel kan valideren.
    await prisma.machine.upsert({
      where: { id: TEST_MACHINE_ID },
      update: { pricePerDay: PRICE_PER_DAY, isActive: true, pickupOnly: false, weeklyOnly: false },
      create: {
        id: TEST_MACHINE_ID,
        name: "Integration Test Lift",
        category: "schaarlift",
        categoryLabel: "Schaarlift",
        height: 8,
        reach: 3,
        weight: 1000,
        pricePerDay: PRICE_PER_DAY,
        powerType: "Elektrisch",
        imageUrl: "",
        imageAlt: "test",
        description: "Test machine",
        suitableFor: [],
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    // Ruim testorders + de testmachine op zodat herhaalde runs schoon blijven.
    await prisma.order.deleteMany({ where: { machineId: TEST_MACHINE_ID } }).catch(() => {});
    await prisma.machine.deleteMany({ where: { id: TEST_MACHINE_ID } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { email: { in: [BLOCKED_EMAIL, LOCKED_OUT_EMAIL] } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("GET /api/health → 200 met databasestatus", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body?.status).toBeTruthy();
  });

  it("GET /api/orders zonder token → 401", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("POST /api/machines zonder admintoken → geweigerd", async () => {
    const res = await request(app).post("/api/machines").send({ name: "x" });
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/orders/availability zonder machineId → 400", async () => {
    const res = await request(app).get("/api/orders/availability");
    expect(res.status).toBe(400);
  });

  it("POST /api/orders met ontbrekende velden → 400", async () => {
    const res = await request(app).post("/api/orders").send({});
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/Onvolledige bestelgegevens/i);
  });

  it("POST /api/orders met startdatum in het verleden → 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validOrder(), startDate: isoDay(-2), endDate: isoDay(-2) });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/verleden/i);
  });

  it("POST /api/orders met gemanipuleerd totaalbedrag → 400 'Totaalbedrag klopt niet'", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validOrder(), totalAmount: 9999 });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/Totaalbedrag klopt niet/i);
  });

  it("POST /api/orders met correcte prijs → order aangemaakt", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("idempotency-key", `itest-${Date.now()}`)
      .send(validOrder());
    expect([200, 201]).toContain(res.status);
    expect(res.body?.id).toBeTruthy();
    // De server bewaart zijn eigen berekende totaal (nooit de clientwaarde).
    expect(Number(res.body?.totalAmount)).toBeCloseTo(121, 2);
  });

  it("POST /api/orders met rijplaten × aantal → prijs = aantal × €6 × week", async () => {
    // 1 dag → addonWeeks = 1. 4 platen × €6 × 1 = €24 add-on.
    // serverTotal = (100 subtotaal + 24 add-on) × 1.21 = 150,04.
    // Eigen datum (dag 2) nodig: dag 1 is al geboekt door de "correcte prijs"
    // test hierboven op dezelfde TEST_MACHINE_ID, anders botst dit met de
    // server's eigen dubbele-boeking-check (409 CONFLICT_ORDER).
    const res = await request(app)
      .post("/api/orders")
      .set("idempotency-key", `itest-rij-${Date.now()}`)
      .send({
        ...validOrder(),
        startDate: isoDay(2),
        endDate: isoDay(2),
        totalAmount: 150.04,
        addons: [{ id: "rijplaten", name: "Rijplaten", price: 24, billing: "weekly", quantity: 4 }],
      });
    expect([200, 201]).toContain(res.status);
    expect(Number(res.body?.totalAmount)).toBeCloseTo(150.04, 2);
    // De server herbouwt naam + prijs uit het gevalideerde aantal.
    const rij = (res.body?.addons ?? []).find((a: any) => a.id === "rijplaten");
    expect(rij?.price).toBeCloseTo(24, 2);
    expect(rij?.name).toMatch(/4 stuks/);
  });

  it("POST /api/orders met ongeldig rijplaten-aantal → 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        ...validOrder(),
        totalAmount: 150.04,
        addons: [{ id: "rijplaten", name: "Rijplaten", price: 24, billing: "weekly", quantity: 0 }],
      });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/aantal rijplaten/i);
  });

  it("POST /api/orders aanhanger → transportkosten = trailerPerDay × gekozen dagen", async () => {
    // 1-daagse verhuur, klant houdt de aanhanger 1 dag: transport = €25 × 1.
    // serverTotal = (100 subtotaal + 25 transport) × 1.21 = 151,25.
    const res = await request(app)
      .post("/api/orders")
      .set("idempotency-key", `itest-trl-${Date.now()}`)
      // Eigen IP zodat deze test niet in de order-rate-limit (6/uur/IP) van de
      // overige POST-tests in dit bestand loopt.
      .set("X-Forwarded-For", "10.9.0.11")
      .send({
        ...validOrder(),
        startDate: isoDay(6),
        endDate: isoDay(6),
        deliveryType: "trailer_rental",
        deliveryAddress: "Teststraat 1, 2381 AB Zoeterwoude",
        trailerDays: 1,
        transportCost: 25,
        totalAmount: 151.25,
      });
    expect([200, 201]).toContain(res.status);
    expect(Number(res.body?.transportCost)).toBeCloseTo(25, 2);
    expect(res.body?.trailerDays).toBe(1);
  });

  it("POST /api/orders aanhanger met 0 dagen → 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("X-Forwarded-For", "10.9.0.12")
      .send({
        ...validOrder(),
        startDate: isoDay(7),
        endDate: isoDay(7),
        deliveryType: "trailer_rental",
        deliveryAddress: "Teststraat 1, 2381 AB Zoeterwoude",
        trailerDays: 0,
        transportCost: 0,
        totalAmount: 121,
      });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/aanhangerdagen/i);
  });

  it("POST /api/orders aanhanger met meer dagen dan de huurperiode → 400", async () => {
    // 1-daagse verhuur maar 2 aanhangerdagen gevraagd → boven het maximum.
    const res = await request(app)
      .post("/api/orders")
      .set("X-Forwarded-For", "10.9.0.13")
      .send({
        ...validOrder(),
        startDate: isoDay(8),
        endDate: isoDay(8),
        deliveryType: "trailer_rental",
        deliveryAddress: "Teststraat 1, 2381 AB Zoeterwoude",
        trailerDays: 2,
        transportCost: 50,
        totalAmount: 181.5,
      });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/aanhangerdagen/i);
  });

  it("Twee gelijktijdige boekingen op dezelfde machine/datum → precies één 201, de ander 409 (geen dubbele boeking)", async () => {
    // Eigen datum (dag 20) zodat dit niet botst met de andere tests op TEST_MACHINE_ID.
    const day = isoDay(20);
    const base = { ...validOrder(), startDate: day, endDate: day };
    const [resA, resB] = await Promise.all([
      request(app)
        .post("/api/orders")
        .set("X-Forwarded-For", "10.9.0.30")
        .send({ ...base, customerName: "Klant A", customerEmail: "concurrent.a@example.com" }),
      request(app)
        .post("/api/orders")
        .set("X-Forwarded-For", "10.9.0.31")
        .send({ ...base, customerName: "Klant B", customerEmail: "concurrent.b@example.com" }),
    ]);

    // De SERIALIZABLE-transactie + retry in assertMachineAvailableInTx (orders.ts)
    // mag maar één van de twee laten winnen — nooit allebei 201, nooit allebei falen.
    const statuses = [resA.status, resB.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);

    const winner = resA.status === 201 ? resA : resB;
    const loser = resA.status === 201 ? resB : resA;
    expect(winner.body?.id).toBeTruthy();
    expect(loser.body?.error).toMatch(/al gereserveerd/i);
  });

  // De "Blokkeer"-knop in AdminCustomers.tsx zet Customer.lockedUntil op jaar
  // 2999, wat tot nu toe alleen /api/auth/login raakte — deze publieke,
  // ongeauthenticeerde route checkte het e-mailadres nergens tegen die tabel.
  // Een geblokkeerde klant kon dus gewoon als gast met hetzelfde adres
  // doorboeken; de rode "Geblokkeerd"-badge in het adminpaneel deed niets.
  it("POST /api/orders met e-mailadres van een geblokkeerde klant → 403", async () => {
    await prisma.customer.create({
      data: {
        email: BLOCKED_EMAIL,
        passwordHash: "unused-in-this-test",
        name: "Geblokkeerde Klant",
        lockedUntil: new Date("2999-12-31T00:00:00.000Z")
      }
    });

    const day = isoDay(21);
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validOrder(), startDate: day, endDate: day, customerEmail: BLOCKED_EMAIL });

    expect(res.status).toBe(403);
    // De melding bevestigt niet expliciet dat het om een blokkade gaat.
    expect(res.body?.error).not.toMatch(/blok|block/i);
  });

  // Onderscheidt een echte admin-blokkade (2999) van een tijdelijke
  // mislukte-inlogpoging-lockout (hooguit 15 minuten): die laatste mag een
  // gastboeking nooit tegenhouden.
  it("POST /api/orders met e-mailadres van een kortstondig vergrendeld account → gewoon 201", async () => {
    await prisma.customer.create({
      data: {
        email: LOCKED_OUT_EMAIL,
        passwordHash: "unused-in-this-test",
        name: "Even Vergrendeld",
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000) // 10 min, ruim onder de drempel
      }
    });

    const day = isoDay(22);
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validOrder(), startDate: day, endDate: day, customerEmail: LOCKED_OUT_EMAIL });

    expect(res.status).toBe(201);
  });
});
