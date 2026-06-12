/**
 * Runs before `prisma db push` on deploy. The schema adds unique constraints
 * on BlockedDate(machineId, date) and Order.invoiceNumber — constraint
 * creation fails if production data contains duplicates, so clean them first.
 * No-op when the database is already clean (or empty on first deploy).
 * Also upserts seed machines that are not auto-seeded on deploy.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  // Keep the oldest row per (machineId, date); duplicate blocks carry no extra info
  const removedBlocks = await prisma.$executeRawUnsafe(`
    DELETE FROM "BlockedDate" a
    USING "BlockedDate" b
    WHERE a.id > b.id AND a."machineId" = b."machineId" AND a."date" = b."date"
  `);
  if (removedBlocks > 0) console.log(`[preparePush] Removed ${removedBlocks} duplicate blocked dates`);

  // Duplicate invoice numbers are invalid for Dutch BTW anyway — suffix later ones
  const fixedInvoices = await prisma.$executeRawUnsafe(`
    UPDATE "Order" o
    SET "invoiceNumber" = o."invoiceNumber" || '-D' || t.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY "invoiceNumber" ORDER BY "createdAt") AS rn
      FROM "Order"
      WHERE "invoiceNumber" IS NOT NULL
    ) t
    WHERE o.id = t.id AND t.rn > 1
  `);
  if (fixedInvoices > 0) console.log(`[preparePush] De-duplicated ${fixedInvoices} invoice numbers`);
} catch (err) {
  // Tables may not exist yet on a fresh database — db push will create them
  console.warn("[preparePush] Skipped cleanup:", err?.message ?? err);
}

// Upsert seed machines that are NOT auto-seeded on Render deploy.
// Uses update:{} so admin-managed prices/images are never overwritten.
const seedMachines = [
  {
    id: "compact-10n-1",
    name: "Haulotte Compact 10N Schaarlift (Smal)",
    category: "schaarlift-smal",
    categoryLabel: "Smal Model Schaarlift (10m)",
    height: 10.0, reach: 0, weight: 2190,
    pricePerDay: 89, powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-10n-1.webp",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Met een breedte van slechts 81cm is deze smalle schaarlift perfect voor nauwe gangpaden in magazijnen en krappe binnenruimtes tot 10 meter.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weekendPrice: 129, weeklyPrice: 215, monthlyPrice: 580,
    weeklyDiscountPercent: null, monthlyDiscountPercent: null,
    campaignText: null, campaignDiscountPercent: null, campaignDiscountAmount: null,
  },
  {
    id: "compact-10n-2",
    name: "Haulotte Compact 10N Schaarlift (Smal) (Unit 2)",
    category: "schaarlift-smal",
    categoryLabel: "Smal Model Schaarlift (10m)",
    height: 10.0, reach: 0, weight: 2190,
    pricePerDay: 89, powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-10n-2.webp",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Smalle schaarlift (Unit 2) met non-marking banden voor compact en geruisloos binnenwerk.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weekendPrice: 129, weeklyPrice: 215, monthlyPrice: 580,
    weeklyDiscountPercent: null, monthlyDiscountPercent: null,
    campaignText: null, campaignDiscountPercent: null, campaignDiscountAmount: null,
  },
  {
    id: "dingli-6m",
    name: "Dingli JCPT 0607 DC Compact Schaarlift",
    category: "schaarlift-6m",
    categoryLabel: "Kompakte Schaarlift (6m)",
    height: 6.0, reach: 0, weight: 695,
    pricePerDay: 49, powerType: "Elektrisch",
    imageUrl: "/images/machines/dingli-6m.webp",
    imageAlt: "Dingli JCPT 0607 DC compact elektrische schaarlift 6 meter",
    description: "Lichtgewicht elektrische schaarlift met 6 meter werkhoogte. Uiterst compact en geschikt voor smalle gangpaden en lage doorgangshoogtes. Ideaal voor onderhoudsklussen in winkels, scholen en kantoren.",
    suitableFor: ["Installateur", "Schilder", "Particulier"],
    weekendPrice: 75, weeklyPrice: 120, monthlyPrice: 340,
    weeklyDiscountPercent: null, monthlyDiscountPercent: null,
    campaignText: null, campaignDiscountPercent: null, campaignDiscountAmount: null,
  },
];

try {
  for (const m of seedMachines) {
    const { id, ...create } = m;
    await prisma.machine.upsert({ where: { id }, update: {}, create: { id, ...create } });
    // Back-fill flat-rate prices only when still null (first run after machine creation)
    if (m.weekendPrice != null)
      await prisma.machine.updateMany({ where: { id, weekendPrice: null }, data: { weekendPrice: m.weekendPrice } });
    if (m.weeklyPrice != null)
      await prisma.machine.updateMany({ where: { id, weeklyPrice: null }, data: { weeklyPrice: m.weeklyPrice } });
    if (m.monthlyPrice != null)
      await prisma.machine.updateMany({ where: { id, monthlyPrice: null }, data: { monthlyPrice: m.monthlyPrice } });
  }
  console.log(`[preparePush] Upserted ${seedMachines.length} seed machines (6m + 10m schaarliften)`);
} catch (err) {
  console.warn("[preparePush] Skipped machine upsert:", err?.message ?? err);
} finally {
  await prisma.$disconnect();
}

