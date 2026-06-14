/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CartItem } from "../types";
import { euro, euroCompact } from "./format";

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
  totals?: OrderTotals,
  weekendWorkAnswer?: 'ja' | 'nee'
): string {
  const lines: string[] = [];

  lines.push("🏗️ *Verhuurverzoek via HuurGo*");
  lines.push("");
  lines.push("─────────────────────────────");
  lines.push("📦 *BESTELDE MACHINE(S)*");
  lines.push("─────────────────────────────");

  for (const item of cartItems) {
    const start = item.startDate || "–";
    const end = item.endDate || "–";
    // Compute per-item days from item dates; single-cart uses authoritative totals
    let perItemDays: number | null = null;
    let perItemSubtotal: number | null = null;
    if (totals && cartItems.length === 1) {
      perItemDays = totals.days;
      perItemSubtotal = totals.subtotal;
    } else if (item.startDate && item.endDate) {
      const diff = new Date(item.endDate).getTime() - new Date(item.startDate).getTime();
      perItemDays = Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)) + 1);
    }
    lines.push(`▸ *${item.machine.name}*`);
    lines.push(`   📅 Periode:  ${start}  →  ${end}`);
    if (perItemDays && perItemSubtotal) {
      lines.push(`   💶 ${perItemDays} ${perItemDays === 1 ? "dag" : "dagen"} — *${euroCompact(perItemSubtotal)}*`);
    } else if (perItemDays) {
      lines.push(`   💶 ${perItemDays} ${perItemDays === 1 ? "dag" : "dagen"} × ${euroCompact(item.machine.pricePerDay)}/dag`);
    } else {
      lines.push(`   💶 Tarief: ${euroCompact(item.machine.pricePerDay)}/dag`);
    }
    lines.push("");
  }

  if (deliveryType) {
    lines.push("─────────────────────────────");
    lines.push("🚛 *TRANSPORT*");
    lines.push("─────────────────────────────");
    const label = deliveryType === "self_pickup"
      ? "✅  Zelf ophalen  –  Produktieweg 20, Zoeterwoude  (Gratis)\n   🕐 Openingstijden: ma–vr 08:00–17:00"
      : deliveryType === "trailer_rental"
      ? `🔗  Aanhanger huren  (€ 25,-/dag${totals ? `  ×  ${totals.days} d  =  ${euroCompact(totals.transport)}` : ""})`
      : `🚐  Bezorging door ons  (heen + terug = € 150,-)`;
    lines.push(label);
    lines.push("");
  }

  if (totals && totals.total > 0) {
    lines.push("─────────────────────────────");
    lines.push("💰 *PRIJSOVERZICHT*");
    lines.push("─────────────────────────────");
    lines.push(`   Subtotaal (excl. BTW) :  ${euro(totals.subtotal)}`);
    lines.push(`   BTW 21%               :  ${euro(totals.vat)}`);
    lines.push("─────────────────────────────");
    lines.push(`✅ *Totaal incl. BTW :  ${euro(totals.total)}*`);
    lines.push("─────────────────────────────");
    lines.push("");
  }

  if (customerName && customerName.trim().length > 0) {
    lines.push("👤 *CONTACTGEGEVENS*");
    lines.push("─────────────────────────────");
    lines.push(`   Naam     :  ${customerName}`);
    if (customerPhone) lines.push(`   📞 Tel  :  ${customerPhone}`);
    if (customerEmail) lines.push(`   📧 Mail :  ${customerEmail}`);
    lines.push("");
  }

  if (weekendWorkAnswer) {
    lines.push("─────────────────────────────");
    lines.push("🗓 *WEEKEND VERKLARING*");
    lines.push("─────────────────────────────");
    if (weekendWorkAnswer === 'ja') {
      lines.push("✅ Klant gaat in het weekend werken (+€75 weekendtoeslag)");
    } else {
      lines.push("❌ Klant gaat NIET in het weekend werken");
      lines.push("   ⚠️ Urenteller wordt gecontroleerd — bij gebruik alsnog standaard weekendtarief");
    }
    lines.push("");
  }

  lines.push("💳 *Verzoek:*");
  lines.push("Stuur mij een iDEAL betaallink zodat ik");
  lines.push("de betaling direct kan afronden.");
  lines.push("");
  lines.push("Alvast bedankt! 🦾");

  const encodedText = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
}

/**
 * Builds a simple WhatsApp URL for general inquiries (no cart context).
 */
export function buildWhatsAppGeneralUrl(categoryLabel?: string): string {
  let message = "Hallo HuurGo! Ik heb een vraag over het huren van een hoogwerker. Alvast bedankt! 🦾";

  if (categoryLabel) {
    message = `Hallo HuurGo! Ik ben geïnteresseerd in het huren van een ${categoryLabel}. Kunt u mij adviseren? 🦾`;
  }

  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
}

/**
 * Builds a WhatsApp URL for transport outside 20 km radius — redirects to custom quote flow.
 */
export function buildWhatsAppTransportInquiryUrl(
  cartItems: CartItem[],
  addressLabel: string,
  distanceKm: number
): string {
  const machineLines = cartItems
    .map(item => `▸ ${item.machine.name}  (${item.startDate || "–"} → ${item.endDate || "–"})`)
    .join("\n");

  const lines = [
    `🚛 *Bezorgverzoek buiten 20 km — HuurGo*`,
    `─────────────────────────────`,
    `📦 *Machine(s):*`,
    machineLines,
    `─────────────────────────────`,
    `📍 *Bezorgadres:* ${addressLabel || "Niet opgegeven"}`,
    `📏 *Afstand tot depot:* ±${distanceKm} km`,
    `─────────────────────────────`,
    `💬 *Verzoek:*`,
    `Ik wil graag een offerte ontvangen voor bezorging buiten de 20 km zone.`,
    ``,
    `Alvast bedankt! 🦾`,
  ];

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Customer asking for status of their existing booking.
 */
export function buildWhatsAppOrderStatusUrl(orderId?: string, machineName?: string): string {
  const lines = [
    "Hallo HuurGo! 👋",
    "",
    "Ik wil graag de status opvragen van mijn boeking.",
    orderId ? `📋 Referentienummer: ${orderId}` : "",
    machineName ? `🏗️ Machine: ${machineName}` : "",
    "",
    "Kunt u mij informeren over de huidige status en wanneer ik de bevestiging kan verwachten?",
    "Alvast bedankt! 🦾",
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Customer waiting for their iDEAL payment link after booking.
 */
export function buildWhatsAppPaymentLinkUrl(orderId?: string): string {
  const lines = [
    "Hallo HuurGo! 👋",
    "",
    "Ik heb zojuist een boeking geplaatst en wacht op mijn iDEAL betaallink.",
    orderId ? `📋 Referentienummer: ${orderId}` : "",
    "",
    "Kunt u mij de betaallink sturen zodat ik direct kan afrekenen?",
    "Bedankt! 🦾",
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Customer requesting advice on which machine suits their job.
 */
export function buildWhatsAppAdviceUrl(jobDescription?: string): string {
  const lines = [
    "Hallo HuurGo! 👋",
    "",
    "Ik ben op zoek naar een geschikte hoogwerker voor mijn klus maar weet niet goed welke machine het beste past.",
    jobDescription ? `Klus: ${jobDescription}` : "",
    "",
    "Kunt u mij adviseren welke machine het meest geschikt is?",
    "Alvast bedankt! 🦾",
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
