// Eén bron voor "wil deze klant e-mail van ons?".
//
// Deze check zat eerder in drie kopieën (server/routes/orders.ts, de scheduler in
// server.ts, en zou bij elke nieuwe mailflow opnieuw zijn overgeschreven). Dat is
// precies het soort duplicaat dat stil uit elkaar loopt: een klant die de toggle
// in "Mijn Reserveringen" uitzet moet in ÉLKE flow met rust gelaten worden, niet
// in de flows waar iemand eraan dacht.
//
// Semantiek (overal identiek): een gast zonder customerId heeft nooit een
// voorkeur kunnen instellen en krijgt dus wél mail; een ontbrekende rij telt om
// dezelfde reden als "wil mail". Alleen een expliciete emailOptIn === false zet
// de mail uit.

import { prisma } from "../../prisma/client.js";

export async function customerWantsEmail(customerId: string | null): Promise<boolean> {
  if (!customerId) return true;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { emailOptIn: true }
  });
  return customer?.emailOptIn !== false;
}

// Gebatchte variant voor lussen over veel orders (de dagelijkse cron): één query
// voor alle betrokken klanten in plaats van één query per order.
export async function batchCustomerEmailOptIns(customerIds: (string | null)[]): Promise<Map<string, boolean>> {
  const ids = Array.from(new Set(customerIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map();
  const customers = await prisma.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, emailOptIn: true }
  });
  return new Map(customers.map(c => [c.id, c.emailOptIn !== false]));
}

export function wantsEmailFromBatch(optIns: Map<string, boolean>, customerId: string | null): boolean {
  if (!customerId) return true;
  return optIns.get(customerId) ?? true;
}
