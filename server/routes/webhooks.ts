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

// POST /api/webhooks/mollie — called by Mollie whenever a payment link's status
// changes. Per Mollie's documented security model, the POST body is NOT trusted
// for the actual status: only the id is read from it, and the current status is
// re-fetched from Mollie's own API before anything is persisted.
//
// Confirmed empirically (not just from docs): for a Payment Links–based flow,
// the `id` Mollie posts here is the payment LINK's own id (pl_...) — the same
// id already stored on Order.molliePaymentId at link-creation time — NOT the
// underlying payment's id (tr_...). An earlier version of this handler assumed
// the latter and called payments.get(id) with a pl_... id, which Mollie's SDK
// rejects outright ("appears invalid: unexpected format"), so no order was ever
// found. Matching directly on molliePaymentId sidesteps that entirely.
webhooksRouter.post("/mollie", mollieBodyParser, async (req: AuthenticatedRequest, res) => {
  const linkId = req.body?.id;
  console.log("[Mollie] Webhook ontvangen, payment-link id:", linkId);
  if (!linkId || typeof linkId !== "string") {
    console.warn("[Mollie] Webhook zonder geldig 'id' veld in body:", req.body);
    return res.sendStatus(400);
  }

  try {
    const paid = await mollieService.isPaymentLinkPaid(linkId);
    if (paid === null) {
      // Unknown to Mollie (or MOLLIE_API_KEY unset) — nothing to do, but don't
      // make Mollie retry forever on something that will never resolve.
      console.warn("[Mollie] Payment-link", linkId, "kon niet worden opgehaald bij Mollie — genegeerd.");
      return res.sendStatus(200);
    }
    console.log("[Mollie] Payment-link", linkId, "paid:", paid);

    if (paid) {
      // Idempotent: skip if already marked paid so Mollie's automatic webhook
      // retries never double-log the audit trail.
      const order = await prisma.order.findFirst({
        where: { molliePaymentId: linkId, paymentStatus: { not: "paid" } }
      });
      if (order) {
        // Het betaalde bedrag vastleggen, niet alleen de vlag: de betaallink is
        // aangemaakt op dit totaal, dus dit is wat er binnenkwam. Wordt de order
        // later bewerkt en stijgt het totaal, dan blijft het verschil zichtbaar.
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid", paidAmount: order.totalAmount }
        });
        audit(req, "order.payment", {
          entity: "Order",
          entityId: order.id,
          meta: { to: "paid", source: "mollie_webhook" },
          actor: { role: "system", email: "mollie-webhook" }
        });
        console.log("[Mollie] Order", order.id, "gemarkeerd als betaald via webhook.");
      } else {
        // Either the order is already paid (idempotent retry — fine) or no order
        // has this molliePaymentId — worth knowing which, so log the raw value.
        console.warn("[Mollie] Geen (onbetaalde) order gevonden met molliePaymentId ===", JSON.stringify(linkId));
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("[Mollie] Webhook verwerken mislukt voor payment-link", linkId, ":", err);
    // Non-2xx so Mollie retries — this may be a transient DB/network error.
    res.sendStatus(500);
  }
});
