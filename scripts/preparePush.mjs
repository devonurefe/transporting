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
}

// Back-fill hardcoded specs into DB for all known machines (only when specs is still null).
// Admin can override via AdminMachines panel; this just pre-populates on first deploy.
const MACHINE_SPECS = {
  "nifty-120": [
    { label: "Platformhoogte",    value: "10,2 m" },
    { label: "Platformafmeting",  value: "76 × 163 cm" },
    { label: "Draagvermogen",     value: "200 kg (2 pers.)" },
    { label: "Transportbreedte",  value: "159 cm" },
    { label: "Transportlengte",   value: "468 cm" },
    { label: "Transporthoogte",   value: "180 cm" },
    { label: "Kogelgewicht",      value: "ca. 75 kg" },
    { label: "Rijbewijs",         value: "Categorie B vereist" },
    { label: "Opsteltijd",        value: "± 5 min" },
    { label: "Stroomopname",      value: "230 V / accu" },
  ],
  "nifty-170": [
    { label: "Platformhoogte",      value: "15,1 m" },
    { label: "Platformafmeting",    value: "76 × 163 cm" },
    { label: "Draagvermogen",       value: "200 kg (2 pers.)" },
    { label: "Transportbreedte",    value: "179 cm" },
    { label: "Transporthoogte",     value: "ca. 190 cm" },
    { label: "Rijbewijs",           value: "Categorie B vereist" },
    { label: "Opsteltijd",          value: "± 10 min" },
    { label: "Aandrijving rijden",  value: "Diesel + elektrisch" },
  ],
  "hinowa-15-70": [
    { label: "Platformhoogte",          value: "13,4 m" },
    { label: "Platformafmeting",        value: "70 × 120 cm" },
    { label: "Draagvermogen",           value: "200 kg (2 pers.)" },
    { label: "Rupsbreedte",             value: "79 cm (59 cm ingetrokken)" },
    { label: "Min. poortbreedte",       value: "60 cm" },
    { label: "Max. helling (rijden)",   value: "25°" },
    { label: "Stabilisatoren",          value: "4× automatisch" },
    { label: "Rijden in geheven stand", value: "Niet toegestaan" },
  ],
  "hinowa-17-75": [
    { label: "Platformhoogte",          value: "15,06 m" },
    { label: "Platformafmeting",        value: "70 × 120 cm" },
    { label: "Draagvermogen",           value: "200 kg (2 pers.)" },
    { label: "Rupsbreedte",             value: "89 cm" },
    { label: "Min. poortbreedte",       value: "90 cm" },
    { label: "Max. helling (rijden)",   value: "20°" },
    { label: "Stabilisatoren",          value: "4× automatisch" },
    { label: "Rijden in geheven stand", value: "Niet toegestaan" },
  ],
  "optimum-8": [
    { label: "Platformhoogte",     value: "5,76 m" },
    { label: "Platformafmeting",   value: "136 × 69 cm (uitschuif: 256 × 69 cm)" },
    { label: "Draagvermogen",      value: "230 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "76 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Max. helling",       value: "25 %" },
  ],
  "compact-8": [
    { label: "Platformhoogte",     value: "6,17 m" },
    { label: "Platformafmeting",   value: "165 × 76 cm (uitschuif: 265 × 76 cm)" },
    { label: "Draagvermogen",      value: "230 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "82 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Max. helling",       value: "25 %" },
  ],
  "compact-10n": [
    { label: "Platformhoogte",     value: "7,96 m" },
    { label: "Platformafmeting",   value: "126 × 81 cm (uitschuif: 251 × 81 cm)" },
    { label: "Draagvermogen",      value: "450 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "81 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "81 cm breed" },
  ],
  "compact-10n-1": [
    { label: "Platformhoogte",     value: "7,96 m" },
    { label: "Platformafmeting",   value: "126 × 81 cm (uitschuif: 251 × 81 cm)" },
    { label: "Draagvermogen",      value: "450 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "81 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "81 cm breed" },
  ],
  "compact-10n-2": [
    { label: "Platformhoogte",     value: "7,96 m" },
    { label: "Platformafmeting",   value: "126 × 81 cm (uitschuif: 251 × 81 cm)" },
    { label: "Draagvermogen",      value: "450 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "81 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "81 cm breed" },
  ],
  "dingli-6m": [
    { label: "Platformhoogte",     value: "4,0 m" },
    { label: "Platformafmeting",   value: "74 × 60 cm" },
    { label: "Draagvermogen",      value: "230 kg" },
    { label: "Machinebreedte",     value: "74 cm" },
    { label: "Accu",               value: "2 × 12 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "74 cm breed" },
  ],
  "altrex-rs44": [
    { label: "Platformhoogte",   value: "2,0 m" },
    { label: "Platformafmeting", value: "ca. 135 × 60 cm" },
    { label: "Draagvermogen",    value: "200 kg" },
    { label: "Machinebreedte",   value: "75 cm" },
    { label: "Materiaal",        value: "Aluminium" },
    { label: "Wielen",           value: "4× met vergrendeling" },
    { label: "Montagetijd",      value: "± 5 min" },
    { label: "Norm",             value: "NEN-EN 1004" },
  ],
  "star-10": [
    { label: "Platformhoogte",     value: "8,0 m" },
    { label: "Platformafmeting",   value: "80 × 120 cm" },
    { label: "Draagvermogen",      value: "230 kg (1 pers.)" },
    { label: "Machinebreedte",     value: "78 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Draairadius",        value: "0 cm (zero-radius)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "skyjack-sj16": [
    { label: "Platformhoogte",     value: "4,6 m" },
    { label: "Platformafmeting",   value: "74 × 76 cm" },
    { label: "Draagvermogen",      value: "136 kg (1 pers.)" },
    { label: "Machinebreedte",     value: "74 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Draairadius",        value: "0 cm (zero-radius)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "bravi-mini-hd": [
    { label: "Platformhoogte",     value: "2,9 m" },
    { label: "Platformafmeting",   value: "70 × 70 cm" },
    { label: "Draagvermogen",      value: "200 kg" },
    { label: "Machinebreedte",     value: "69 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Min. deuropening",   value: "69 cm breed" },
    { label: "Liftvriendelijk",    value: "Ja (smal profiel)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "jlg-1230es": [
    { label: "Platformhoogte",     value: "3,65 m (12 ft)" },
    { label: "Platformafmeting",   value: "76 × 68 cm" },
    { label: "Draagvermogen",      value: "227 kg" },
    { label: "Machinebreedte",     value: "76 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Rijden geheven",     value: "Niet toegestaan" },
  ],
  "ladderlift-18": [
    { label: "Max. belasting",    value: "200 kg (goederen)" },
    { label: "Bandenbreedte",     value: "ca. 40 cm" },
    { label: "Transportsnelheid", value: "ca. 0,4 m/s" },
    { label: "Stroomvereiste",    value: "230 V / 16 A" },
    { label: "Personentransport", value: "Niet toegestaan" },
    { label: "Opsteltijd",        value: "± 15 min" },
    { label: "Bereik (etages)",   value: "t/m ca. 5e verdieping" },
  ],
  "ladderlift-21": [
    { label: "Max. belasting",    value: "250 kg (goederen)" },
    { label: "Bandenbreedte",     value: "ca. 40 cm" },
    { label: "Transportsnelheid", value: "ca. 0,5 m/s" },
    { label: "Stroomvereiste",    value: "230 V / 16 A" },
    { label: "Personentransport", value: "Niet toegestaan" },
    { label: "Opsteltijd",        value: "± 20 min" },
    { label: "Bereik (etages)",   value: "t/m ca. 7e verdieping" },
  ],
  "ecolift": [
    { label: "Platformhoogte",   value: "2,2 m" },
    { label: "Platformafmeting", value: "65 × 65 cm" },
    { label: "Draagvermogen",    value: "150 kg (incl. persoon)" },
    { label: "Machinebreedte",   value: "69 cm" },
    { label: "Bediening",        value: "Handmatig (zwengel)" },
    { label: "Energiebron",      value: "Geen (geen accu / stroom)" },
    { label: "Min. deuropening", value: "70 cm breed" },
    { label: "Norm",             value: "CE gecertificeerd" },
  ],
};

try {
  let backfilled = 0;
  for (const [id, specs] of Object.entries(MACHINE_SPECS)) {
    const result = await prisma.machine.updateMany({ where: { id, specs: null }, data: { specs } });
    backfilled += result.count;
  }
  if (backfilled > 0) console.log(`[preparePush] Back-filled specs for ${backfilled} machines`);
} catch (err) {
  console.warn("[preparePush] Skipped specs backfill:", err?.message ?? err);
} finally {
  await prisma.$disconnect();
}

