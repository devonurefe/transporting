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
    const res = await request(app)
      .post("/api/orders")
      .set("idempotency-key", `itest-rij-${Date.now()}`)
      .send({
        ...validOrder(),
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
});
