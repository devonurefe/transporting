// Dagelijks onderhoud op openstaande orders: betaalherinneringen en het
// vrijgeven van onbetaald gebleven aanvragen.
//
// Waarom dit een apart bestand is: beide taken bestonden al binnen de HTTP-route
// POST /api/orders/send-reminders, maar die route vereist REMINDER_SECRET en
// wordt door geen enkele cron aangeroepen — in productie draaide er dus nooit
// iets van. De in-process scheduler in server.ts (die wél draait) kende alleen
// de huurherinnering. Door de logica hier te centraliseren draaien route en
// scheduler gegarandeerd hetzelfde, in plaats van twee versies die uiteenlopen.
//
// ── Waarom een onbetaalde aanvraag vrijgegeven MOET worden ──────────────────
// Beschikbaarheid wordt afgeleid uit orders: alles wat niet "Geannuleerd" is
// bezet de machine. Een klant die reserveert en nooit betaalt, houdt die datums
// dus voor onbepaalde tijd rood voor iedereen. De bestaande opruiming greep pas
// in nádat de startdatum verstreken was — voor een boeking van 12 t/m 15
// augustus die op 27 juli is geplaatst betekende dat ruim twee weken blokkade
// voor niets, en in productie zelfs permanent.

import { prisma } from "../../prisma/client.js";
import { emailService } from "./emailService.js";
import { batchCustomerEmailOptIns, wantsEmailFromBatch } from "../utils/emailOptIn.js";

// Herinnering na 24 uur, vrijgeven na 72 uur. De 72 uur is bewust ruimer dan de
// 48 uur uit de admin-waarschuwing: wie vrijdagavond boekt, heeft bij 48 uur
// geen enkele werkdag om te betalen voordat de aanvraag vervalt.
export const PAYMENT_REMINDER_HOURS = 24;
export const UNPAID_RELEASE_HOURS = 72;

// "Betalen op locatie" is per definitie nog niet betaald tot aan ophalen of
// levering — die orders mogen nooit herinnerd of vrijgegeven worden.
//
// De null-tak is essentieel en empirisch geverifieerd: legacy orders van vóór
// het paymentMethod-veld hebben NULL, en Prisma's `not` laat NULL-rijen buiten
// de match. Zonder die tak zouden juist die orders stil buiten beide flows
// vallen.
const NOT_ON_LOCATION = [{ paymentMethod: null }, { paymentMethod: { not: "on_location" } }];

function toEmailOrder(order: {
  startDate: Date;
  endDate: Date;
  customerPhone: string | null;
  [key: string]: unknown;
}) {
  return {
    ...order,
    startDate: order.startDate.toISOString().split("T")[0],
    endDate: order.endDate.toISOString().split("T")[0],
    customerPhone: order.customerPhone || ""
  } as any;
}

/**
 * Geeft onbetaald gebleven aanvragen vrij door ze te annuleren, zodat de datums
 * weer boekbaar worden.
 *
 * Vrijgeven gebeurt zodra één van beide klokken afloopt — wat het eerst komt:
 *   • UNPAID_RELEASE_HOURS sinds het plaatsen van de order, of
 *   • de startdatum is inmiddels gepasseerd.
 * De tweede tak vangt de korte-termijnboeking af (vandaag geplaatst voor
 * overmorgen) die anders pas ver ná de huurperiode zou vervallen.
 *
 * Alleen "In behandeling" + onbetaald + niet-op-locatie komt in aanmerking, dus
 * een goedgekeurde of betaalde order wordt nooit geraakt.
 */
export function startOfUtcDay(now: Date): Date {
  return new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");
}

// Apart en geëxporteerd zodat de selectie unit-getest kan worden zonder database:
// dit is de enige plek in de codebase die uit zichzelf klantorders annuleert, dus
// de voorwaarden mogen niet stilletjes verschuiven. Zie
// src/__tests__/orderMaintenance.test.ts.
export function buildUnpaidReleaseWhere(now: Date) {
  const cutoff = new Date(now.getTime() - UNPAID_RELEASE_HOURS * 60 * 60 * 1000);
  return {
    status: "In behandeling",
    paymentStatus: "awaiting",
    AND: [
      { OR: NOT_ON_LOCATION },
      {
        OR: [
          // Verlopen wachttijd — maar alleen als er ooit een betaallink is
          // aangemaakt. Zonder die eis zou dit klanten afstraffen die nooit een
          // manier hadden om te betalen: de link wordt asynchroon bij Mollie
          // opgehaald en kan ontbreken (Mollie plat, geen MOLLIE_API_KEY, of een
          // netwerkfout in de fire-and-forget aanroep). Draait de shop volledig
          // handmatig, dan vervalt er dus nooit iets automatisch — dat is de
          // juiste, voorzichtige uitkomst.
          { AND: [{ createdAt: { lte: cutoff } }, { mollieCheckoutUrl: { not: null } }] },
          // Startdatum voorbij: de huurperiode is hoe dan ook weg, dus hier
          // speelt de betaallink geen rol meer. Dit is puur agenda-opruiming.
          { startDate: { lt: startOfUtcDay(now) } }
        ]
      }
    ]
  };
}

export async function releaseUnpaidOrders(): Promise<{ released: number }> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);

  const stale = await prisma.order.findMany({ where: buildUnpaidReleaseWhere(now) });
  if (stale.length === 0) return { released: 0 };

  await prisma.order.updateMany({
    where: { id: { in: stale.map(o => o.id) } },
    data: { status: "Geannuleerd" }
  });

  // Alleen mailen over een huurperiode die nog moet komen. Bij de eerste run na
  // het inschakelen hiervan zit er mogelijk een stapel oude, allang verlopen
  // aanvragen in de database; iemand een "uw aanvraag is vervallen"-mail sturen
  // over datums van maanden geleden is verwarrend, terwijl het annuleren zelf
  // wél klopt.
  const notifiable = stale.filter(o => o.startDate >= todayStart);
  const optIns = await batchCustomerEmailOptIns(notifiable.map(o => o.customerId));
  for (const order of notifiable) {
    if (!wantsEmailFromBatch(optIns, order.customerId)) continue;
    await emailService
      .sendStatusUpdate(toEmailOrder({ ...order, status: "Geannuleerd" }), { expiredUnpaid: true })
      .catch(err => console.error(`[Release] Vervalmail mislukt voor ${order.id}:`, err));
  }

  for (const order of stale) {
    console.log(
      `[Release] ${order.id} — ${order.startDate.toISOString().split("T")[0]} t/m ` +
      `${order.endDate.toISOString().split("T")[0]}, onbetaald sinds ${order.createdAt.toISOString()} → Geannuleerd, datums vrijgegeven`
    );
  }
  console.log(`[Release] ${stale.length} onbetaalde aanvraag/aanvragen vrijgegeven (${notifiable.length} klant(en) gemaild).`);
  return { released: stale.length };
}

/**
 * Stuurt één betaalherinnering per onbetaalde aanvraag die minstens
 * PAYMENT_REMINDER_HOURS oud is. Order.paymentReminderSentAt is de
 * idempotentie-marker, zodat een openstaande order niet elke dag opnieuw
 * gemaild wordt.
 *
 * Dit hoort vóór releaseUnpaidOrders te draaien: iemand wiens aanvraag vervalt,
 * moet daar eerst één keer aan herinnerd zijn.
 */
export async function sendPaymentReminders(): Promise<{ sent: number; total: number }> {
  const cutoff = new Date(Date.now() - PAYMENT_REMINDER_HOURS * 60 * 60 * 1000);
  const unpaid = await prisma.order.findMany({
    where: {
      status: "In behandeling",
      paymentStatus: "awaiting",
      createdAt: { lte: cutoff },
      paymentReminderSentAt: null,
      OR: NOT_ON_LOCATION
    }
  });
  if (unpaid.length === 0) return { sent: 0, total: 0 };

  const optIns = await batchCustomerEmailOptIns(unpaid.map(o => o.customerId));
  let sent = 0;
  for (const order of unpaid) {
    if (!wantsEmailFromBatch(optIns, order.customerId)) continue;
    const ok = await emailService.sendPaymentReminder(toEmailOrder(order));
    if (ok) {
      sent++;
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentReminderSentAt: new Date() }
      });
    }
  }
  console.log(`[PaymentReminder] ${sent}/${unpaid.length} herinnering(en) verstuurd.`);
  return { sent, total: unpaid.length };
}
