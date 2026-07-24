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
 * Creates a single-use Mollie payment link for an order. The order's own ID is
 * stored verbatim as the Mollie `description` — Payment Links have no metadata
 * field, so the webhook handler matches the incoming payment back to our Order
 * by re-fetching the payment and comparing its `description` to `Order.id`.
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

export interface FetchedPayment {
  status: string;
  description: string;
}

/**
 * Re-fetches a payment by ID from Mollie's API — the webhook handler must never
 * trust the POST body's contents for the payment status, only the ID, per
 * Mollie's documented security model.
 */
async function getPayment(paymentId: string): Promise<FetchedPayment | null> {
  if (!mollieClient) return null;
  try {
    const payment = await mollieClient.payments.get(paymentId);
    return { status: payment.status, description: payment.description };
  } catch (err) {
    console.error("[Mollie] Betaling ophalen mislukt voor id", paymentId, ":", err);
    return null;
  }
}

export const mollieService = { createPaymentLink, getPayment };
