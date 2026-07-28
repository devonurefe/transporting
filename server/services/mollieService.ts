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
//
// Only a "live_" key activates the client — a "test_" key is treated the same
// as no key at all. Mollie's test-mode checkout lets the visitor pick
// "Paid"/"Failed"/"Expired" themselves with no money moving, so a test key
// automatically emailing that link to real customers (added alongside the
// unpaid-order auto-release) would let anyone self-approve a free rental, and
// would let the release cron auto-cancel real bookings once a "live_" key is
// finally configured but a stray "test_" one from onboarding was left in
// place. Whoever pastes a "test_" key here during onboarding gets today's
// known-safe manual-placeholder-link behaviour, not a live payment surface —
// no separate flag to remember to flip when the account goes live.
const mollieApiKey = process.env.MOLLIE_API_KEY || "";
const mollieClient = mollieApiKey.startsWith("live_") ? createMollieClient({ apiKey: mollieApiKey }) : null;

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
 * Archives a payment link so Mollie will no longer accept payments on it.
 * Used when an order's total changes after the link was already sent: the
 * customer still has the old URL in WhatsApp, and without archiving they could
 * settle the old (possibly much lower) amount and be marked as fully paid.
 *
 * Returns true on success, false on any failure — never throws, so a failed
 * archive can be logged without blocking creation of the replacement link.
 */
async function archivePaymentLink(linkId: string): Promise<boolean> {
  if (!mollieClient) return false;
  try {
    await mollieClient.paymentLinks.update(linkId, { archived: true });
    return true;
  } catch (err) {
    console.error("[Mollie] Betaallink archiveren mislukt voor id", linkId, ":", err);
    return false;
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

export const mollieService = { createPaymentLink, archivePaymentLink, isPaymentLinkPaid };
