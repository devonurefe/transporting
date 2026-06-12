/**
 * Runs before `prisma db push` on deploy. The schema adds unique constraints
 * on BlockedDate(machineId, date) and Order.invoiceNumber — constraint
 * creation fails if production data contains duplicates, so clean them first.
 * No-op when the database is already clean (or empty on first deploy).
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
} finally {
  await prisma.$disconnect();
}
