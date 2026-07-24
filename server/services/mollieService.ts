/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Named import, not default — the package's CJS default export doesn't resolve
// correctly as a callable under this project's ESM/tsx runtime (verified: the
// default binding resolves to the whole module namespace object, not the function).
import { createMollieClient } from "@mollie/api-client";

// Same fail-soft shape as emailService's Resend init: if MOLLIE_API_KEY is unset,
// every method below becomes a no-op and the caller falls back to the pre-Mollie
// behaviour (manual placeholder link, manual "Betaling Ontvangen" click).
const mollieApiKey = process.env.MOLLIE_API_KEY || "";
const mollieClient = mollieApiKey ? createMollieClient({ apiKey: mollieApiKey }) : null;

const APP_URL = process.env.APP_URL || "https://localhost:3000";

export interface CreatedPaymentLink {
  id: string;
  checkoutUrl: string;
}

/**
 * Creates a single-use Mollie payment link for an order. `Order.molliePaymentId`
 * stores this link's own ID (pl_...) — that is exactly the ID Mollie's webhook
 * hands back (confirmed empirically: the webhook does NOT send the underlying
 * payment's tr_... id, it sends the payment link's own pl_... id), so the
 * webhook handler can match straight on `molliePaymentId`. The order's own ID
 * is also stored verbatim as the Mollie `description`, purely for the merchant's
 * benefit (shown on Mollie's own checkout/dashboard pages) — not used for matching.
 *
 * Returns null on any failure (missing API key, network error, Mollie rejecting
 * the request) — callers must treat that as "no link yet" and keep today's
 * manual-placeholder behaviour, never throw/block order creation on this.
 */
async function createPaymentLink(order: { id: string; totalAmount: number }): Promise<CreatedPaymentLink | null> {
  if (!mollieClient) return null;
  try {
    const paymentLink = await mollieClient.paymentLinks.create({
      description: order.id,
      amount: { currency: "EUR", value: order.totalAmount.toFixed(2) },
      redirectUrl: APP_URL,
      webhookUrl: `${APP_URL}/api/webhooks/mollie`
    });
    return { id: paymentLink.id, checkoutUrl: paymentLink.getPaymentUrl() };
  } catch (err) {
    console.error("[Mollie] Betaallink aanmaken mislukt voor order", order.id, ":", err);
    return null;
  }
}

/**
 * Re-fetches a payment LINK by its own ID (pl_...) from Mollie's API — the
 * webhook handler must never trust the POST body's contents for the actual
 * status, only the ID, per Mollie's documented security model. `paidAt` is set
 * by Mollie the moment the link's (single-use) payment completes.
 */
async function isPaymentLinkPaid(linkId: string): Promise<boolean | null> {
  if (!mollieClient) return null;
  try {
    const paymentLink = await mollieClient.paymentLinks.get(linkId);
    return !!paymentLink.paidAt;
  } catch (err) {
    console.error("[Mollie] Betaallink ophalen mislukt voor id", linkId, ":", err);
    return null;
  }
}

export const mollieService = { createPaymentLink, isPaymentLinkPaid };
