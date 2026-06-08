/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CartItem } from "../types";

// HuurGo WhatsApp business number
const WHATSAPP_NUMBER = (import.meta as any).env?.VITE_WHATSAPP_NUMBER ?? "31611848899";

interface OrderTotals {
  days: number;
  subtotal: number;
  transport: number;
  vat: number;
  total: number;
}

/**
 * Builds a WhatsApp click-to-chat URL with a pre-filled rental inquiry message requesting an iDeal payment link.
 */
export function buildWhatsAppUrl(
  cartItems: CartItem[],
  deliveryType?: string,
  customerName?: string,
  customerEmail?: string,
  customerPhone?: string,
  totals?: OrderTotals
): string {
  const lines: string[] = [];

  lines.push("Hallo HuurGo! 👋");
  lines.push("");
  lines.push("Ik wil graag de volgende machine(s) boeken en betalen via een iDEAL betaallink:");
  lines.push("");

  for (const item of cartItems) {
    const start = item.startDate || "–";
    const end = item.endDate || "–";
    const itemDays = totals && cartItems.length === 1 ? totals.days : null;
    lines.push(`• ${item.machine.name}`);
    lines.push(`  Periode: ${start} t/m ${end}`);
    if (itemDays) {
      lines.push(`  ${itemDays} ${itemDays === 1 ? "dag" : "dagen"} × €${item.machine.pricePerDay},-/dag = €${(item.machine.pricePerDay * itemDays).toFixed(0)},-`);
    } else {
      lines.push(`  Tarief: €${item.machine.pricePerDay}/dag`);
    }
    lines.push("");
  }

  if (deliveryType) {
    const label = deliveryType === "self_pickup"
      ? "Zelf ophalen bij de Hub (Gratis)"
      : deliveryType === "trailer_rental"
      ? `Aanhanger huren (€25/dag${totals ? ` × ${totals.days} d = €${totals.transport.toFixed(0)},-` : ""})`
      : `Bezorging door ons (€75/rit, heen + terug = €150,-)`;
    lines.push(`Logistiek: ${label}`);
  }

  if (totals && totals.total > 0) {
    lines.push("");
    lines.push("─────────────────────");
    lines.push(`Subtotaal (excl. BTW): €${totals.subtotal.toFixed(2)}`);
    lines.push(`BTW (21%): €${totals.vat.toFixed(2)}`);
    lines.push(`✅ Totaal incl. BTW: €${totals.total.toFixed(2)}`);
    lines.push("─────────────────────");
  }

  if (customerName && customerName.trim().length > 0) {
    lines.push("");
    lines.push("Mijn contactgegevens:");
    lines.push(`Naam: ${customerName}`);
    if (customerPhone) lines.push(`Telefoon: ${customerPhone}`);
    if (customerEmail) lines.push(`E-mail: ${customerEmail}`);
  }

  lines.push("");
  lines.push("Stuur mij alstublieft een iDEAL betaallink (bijv. Tikkie of Mollie link) zodat ik de betaling direct kan afronden.");
  lines.push("Bedankt!");

  const encodedText = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
}

/**
 * Builds a simple WhatsApp URL for general inquiries (no cart context).
 */
export function buildWhatsAppGeneralUrl(categoryLabel?: string): string {
  let message = "Hallo HuurGo! Ik heb een vraag over het huren van een hoogwerker.";

  if (categoryLabel) {
    message = `Hallo HuurGo! Ik ben geïnteresseerd in het huren van een ${categoryLabel}. Kunt u mij adviseren?`;
  }

  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
}
