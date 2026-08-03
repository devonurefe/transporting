/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Betaalstand van een order: is het bedrag dat binnenkwam nog gelijk aan wat de
 * order kost?
 *
 * "paid" was lang een vlag zonder bedrag, en dat gaat mis zodra een order ná de
 * betaling wordt bewerkt. PATCH /api/orders/:id herberekent het totaal, maar
 * laat paymentStatus staan en maakt géén nieuwe betaallink aan (dat wordt voor
 * een betaalde order bewust overgeslagen, anders zou de klant twee keer kunnen
 * betalen). Een huur die van €100 naar €150 werd verlengd, bleef daardoor in het
 * adminpaneel staan als volledig betaald — het verschil verdween stilletjes.
 *
 * Order.paidAmount legt vast wat er werkelijk is afgerekend, op het moment dat
 * de betaling binnenkwam. Deze helpers zetten dat om in iets toonbaars.
 */

/** Minimale ordervorm waar de betaalstand uit volgt. */
export interface PaymentStateOrder {
  paymentStatus?: string | null;
  totalAmount: number;
  /** Null voor orders van vóór dit veld, of wanneer er nooit is betaald. */
  paidAmount?: number | null;
}

/** Centen-tolerantie, gelijk aan de servervalidatie in server/routes/orders.ts. */
const EPSILON = 0.01;

/**
 * Wat er nog openstaat. 0 wanneer er niets (meer) te betalen valt.
 *
 * Legacy-orders zonder paidAmount die als "paid" geregistreerd staan, gelden als
 * volledig betaald: we weten niet beter, en ze alsnog als deels betaald tonen zou
 * een berg valse meldingen opleveren over huren die allang zijn afgerond.
 */
export function outstandingBalance(order: PaymentStateOrder): number {
  if (order.paymentStatus !== "paid") return 0;
  if (order.paidAmount == null) return 0;
  const diff = order.totalAmount - order.paidAmount;
  return diff > EPSILON ? Math.round(diff * 100) / 100 : 0;
}

/**
 * Order staat als betaald geregistreerd, maar er is inmiddels méér verschuldigd
 * dan er is afgerekend — vrijwel altijd doordat de order na betaling is bewerkt.
 */
export function isPartiallyPaid(order: PaymentStateOrder): boolean {
  return outstandingBalance(order) > 0;
}

/**
 * Is er te veel betaald? Gebeurt bij een bewerking die het totaal juist verlaagt
 * (kortere huur, add-on eraf). Geen automatische terugstorting — de admin moet
 * dit zelf afhandelen, dus het moet wél zichtbaar zijn.
 */
export function overpaidAmount(order: PaymentStateOrder): number {
  if (order.paymentStatus !== "paid" || order.paidAmount == null) return 0;
  const diff = order.paidAmount - order.totalAmount;
  return diff > EPSILON ? Math.round(diff * 100) / 100 : 0;
}

/** Label voor de betaalbadge in het adminpaneel. */
export function paymentBadgeLabel(order: PaymentStateOrder): "Betaald" | "Deels betaald" | "Te veel betaald" | "Teruggestort" | "In Afwachting" {
  if (order.paymentStatus === "refunded") return "Teruggestort";
  if (order.paymentStatus !== "paid") return "In Afwachting";
  if (isPartiallyPaid(order)) return "Deels betaald";
  if (overpaidAmount(order) > 0) return "Te veel betaald";
  return "Betaald";
}
