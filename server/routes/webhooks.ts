/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, urlencoded } from "express";
import { prisma } from "../../prisma/client.js";
import { mollieService } from "../services/mollieService.js";
import { audit } from "../utils/audit.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const webhooksRouter = Router();

// Mollie POSTs `id` as a form-urlencoded field (not JSON) — this router gets its
// own body parser instead of relying on the global express.json() in server.ts.
const mollieBodyParser = urlencoded({ extended: false });

// POST /api/webhooks/mollie — called by Mollie whenever a payment's status
// changes. Per Mollie's documented security model, the POST body is NOT trusted
// for the actual status: only the payment `id` is read from it, and the current
// status is re-fetched from Mollie's own API before anything is persisted.
webhooksRouter.post("/mollie", mollieBodyParser, async (req: AuthenticatedRequest, res) => {
  const paymentId = req.body?.id;
  if (!paymentId || typeof paymentId !== "string") {
    return res.sendStatus(400);
  }

  try {
    const payment = await mollieService.getPayment(paymentId);
    if (!payment) {
      // Unknown to Mollie (or MOLLIE_API_KEY unset) — nothing to do, but don't
      // make Mollie retry forever on something that will never resolve.
      return res.sendStatus(200);
    }

    if (payment.status === "paid") {
      // Match back to our Order via the description we set at link-creation time
      // (Order.id) — Mollie's Payment Links API has no metadata field to carry
      // our own identifier directly. Idempotent: skip if already marked paid so
      // Mollie's automatic webhook retries never double-log the audit trail.
      const order = await prisma.order.findFirst({
        where: { id: payment.description, paymentStatus: { not: "paid" } }
      });
      if (order) {
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } });
        audit(req, "order.payment", {
          entity: "Order",
          entityId: order.id,
          meta: { to: "paid", source: "mollie_webhook" },
          actor: { role: "system", email: "mollie-webhook" }
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("[Mollie] Webhook verwerken mislukt voor payment", paymentId, ":", err);
    // Non-2xx so Mollie retries — this may be a transient DB/network error.
    res.sendStatus(500);
  }
});
