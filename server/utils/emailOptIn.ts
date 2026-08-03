// Eén bron voor "wil de ontvanger van deze order e-mail van ons?".
//
// Deze check zat eerder in drie kopieën (server/routes/orders.ts, de scheduler in
// server.ts, en zou bij elke nieuwe mailflow opnieuw zijn overgeschreven). Dat is
// precies het soort duplicaat dat stil uit elkaar loopt: een klant die de toggle
// in "Mijn Reserveringen" uitzet moet in ÉLKE flow met rust gelaten worden, niet
// in de flows waar iemand eraan dacht.
//
// Semantiek (overal identiek), in deze volgorde:
//  1. Order.emailOptOut === true  → nooit mailen. Dit is de voorkeur van een
//     inmiddels verwijderde klant, vastgelegd op de order zelf.
//  2. Geen customerId (gast)      → wél mailen; een gast heeft nooit een
//     voorkeur kunnen instellen.
//  3. Anders het Customer-record; een ontbrekende rij telt om dezelfde reden
//     als "wil mail". Alleen een expliciete emailOptIn === false zet mail uit.
//
// Stap 1 bestaat omdat stap 2 anders averechts werkt bij verwijderde klanten:
// het verwijderen zet customerId op null (de order blijft bestaan wegens de
// bewaarplicht voor facturen), waarna iemand die juist géén mail wilde weer als
// gast werd behandeld — en dus weer post kreeg op het e-mailadres dat nog op de
// orderregel staat.

import { prisma } from "../../prisma/client.js";

/** Het minimum dat we van een order moeten weten om te mogen mailen. */
export interface EmailRecipientOrder {
  customerId: string | null;
  emailOptOut?: boolean | null;
}

export async function orderWantsEmail(order: EmailRecipientOrder): Promise<boolean> {
  if (order.emailOptOut) return false;
  if (!order.customerId) return true;
  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId },
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

export function wantsEmailFromBatch(optIns: Map<string, boolean>, order: EmailRecipientOrder): boolean {
  if (order.emailOptOut) return false;
  if (!order.customerId) return true;
  return optIns.get(order.customerId) ?? true;
}
