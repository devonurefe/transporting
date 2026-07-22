/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resend } from "resend";
import { prisma } from "../../prisma/client.js";

// Initialize Resend with env key
// In local development, if RESEND_API_KEY is not defined, we fallback to mocking
const resendApiKey = process.env.RESEND_API_KEY || "";
const resend = resendApiKey && resendApiKey !== "MY_RESEND_API_KEY" ? new Resend(resendApiKey) : null;

// Standard sender email (if domain is verified, use verified domain. Otherwise Resend sandbox uses onboarding@resend.dev)
const SENDER_ADDRESS = process.env.EMAIL_FROM || "onboarding@resend.dev";
// Show a friendly "HuurGo" display name in the recipient's inbox instead of the raw address
const SENDER_EMAIL = SENDER_ADDRESS.includes("<") ? SENDER_ADDRESS : `HuurGo <${SENDER_ADDRESS}>`;
// Reply-to for customer-facing mail. EMAIL_FROM may be a noreply address that isn't
// monitored, so replies must land on the real, MX-forwarded mailbox (info@huurgo.nl →
// huurgomb@gmail.com). Overridable via REPLY_TO; defaults to the info-box.
const REPLY_TO_ADDRESS = process.env.REPLY_TO || "info@huurgo.nl";
const APP_URL = process.env.APP_URL || "https://localhost:3000";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_EMAIL || "";
// Payment runs over WhatsApp (customer requests the iDEAL/Tikkie link). The
// number is the same one the client uses; only render WA buttons when set.
const WHATSAPP_NUMBER = (process.env.VITE_WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER || "").replace(/[^0-9]/g, "");

/** Build a wa.me link with a pre-filled, URL-encoded message. */
const waLink = (message: string): string =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

// Admin-instelbare bedrijfsgegevens (SiteConfig, al bewerkbaar via AdminCustomizer)
// voor de e-mailfooters en het afhaaladres. 60s in-memory cache — een template
// wordt per verzonden e-mail één keer opgebouwd, geen reden om elke keer de DB
// te raken. Fallbacks = de historische literals; sjabloonstructuur blijft in code.
interface CompanyDetails {
  legalName: string;
  address: string;
  footerLong: string;  // met "• Zoeterwoude, Nederland" suffix
  footerShort: string; // zonder suffix (compactere sjablonen)
}
let companyDetailsCache: { value: CompanyDetails; expiresAt: number } | null = null;

async function getCompanyDetails(): Promise<CompanyDetails> {
  if (companyDetailsCache && companyDetailsCache.expiresAt > Date.now()) {
    return companyDetailsCache.value;
  }
  const DEFAULT_LEGAL_NAME = "MB Hoogwerkers B.V.";
  const DEFAULT_ADDRESS = "Produktieweg 20, 2382 PB Zoeterwoude";
  let legalName = DEFAULT_LEGAL_NAME;
  let address = DEFAULT_ADDRESS;
  try {
    const cfg = await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: { companyLegalName: true, companyAddress: true }
    });
    if (cfg?.companyLegalName) legalName = cfg.companyLegalName;
    if (cfg?.companyAddress) address = cfg.companyAddress;
  } catch {
    // DB-hik: fallbacks blijven gelden, een e-mail mag hier nooit op falen
  }
  const year = new Date().getFullYear();
  const value: CompanyDetails = {
    legalName,
    address,
    footerLong: `© ${year} huurgo / ${legalName} • BMWT-gecertificeerd verhuurnetwerk • Zoeterwoude, Nederland`,
    footerShort: `© ${year} huurgo / ${legalName} • BMWT-gecertificeerd verhuurnetwerk`
  };
  companyDetailsCache = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

// Escape user-supplied values before interpolating into HTML email bodies
const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface EmailOrderData {
  id: string;
  machineName: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerProfile?: string | null;
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryTimeSlot?: string | null;
  totalAmount: number;
  status: string;
}

type EmailPayload = Parameters<NonNullable<typeof resend>["emails"]["send"]>[0];

async function sendWithRetry(payload: EmailPayload, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await resend!.emails.send(payload);
      if (error) throw error;
      return true;
    } catch (err) {
      if (attempt < retries) await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  console.error("[EmailService] Permanently failed after", retries, "attempts:", payload.to);
  return false;
}

export const emailService = {
  /**
   * Send Order Confirmation Email to the Customer
   */
  sendOrderConfirmation: async (order: EmailOrderData) => {
    const company = await getCompanyDetails();
    const isPickup = order.deliveryType === "self_pickup";
    const deliveryMethodText = isPickup ? "Zelf Afhalen (Gratis)" : "Bezorgservice op locatie";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reserveringsbevestiging huurgo</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { background: linear-gradient(135deg, #4f46e5, #3b82f6); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
          .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .order-id { font-family: monospace; display: inline-block; background: #f1f5f9; padding: 6px 12px; border-radius: 9999px; font-weight: bold; color: #4f46e5; font-size: 13px; margin-bottom: 20px; }
          .details-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.05em; }
          .value { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 4px; }
          .price-block { text-align: center; margin: 30px 0; padding: 20px; border: 2px dashed #e2e8f0; border-radius: 16px; }
          .price-amount { font-size: 28px; font-weight: 800; color: #10b981; margin-top: 4px; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: bold; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">huur<span style="color:#fb923c;">go</span></h1>
            <p>Uw reserveringsbevestiging is succesvol verwerkt</p>
          </div>
          <div class="content">
            <span class="order-id">Reservering ID: ${order.id}</span>
            <p>Beste <strong>${esc(order.customerName)}</strong>,</p>
            <p>Hartelijk dank voor uw reservering bij huurgo. Ons verhuurteam heeft uw reservering direct in behandeling genomen. Hieronder vindt u de specificaties:</p>
            
            <div class="details-grid">
              <div class="details-item">
                <div class="label">Gereserveerd Object</div>
                <div class="value">${esc(order.machineName)}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate} (${order.rentalDays} dagen)</div>
              </div>
              <div class="details-item">
                <div class="label">Leveringsmethode</div>
                <div class="value">${deliveryMethodText}</div>
              </div>
              ${!isPickup && order.deliveryTimeSlot ? `
              <div class="details-item">
                <div class="label">Bezorgmoment</div>
                <div class="value">${order.deliveryTimeSlot === 'morning' ? 'Ochtend (07:00–09:00)' : 'Middag (13:00–17:00)'}</div>
              </div>
              ` : ''}
              ${!isPickup && order.deliveryAddress ? `
              <div class="details-item">
                <div class="label">Bezorgadres</div>
                <div class="value">${esc(order.deliveryAddress)}</div>
              </div>
              ` : ''}
              <div class="details-item">
                <div class="label">Status</div>
                <div class="value" style="color: #d97706;">In behandeling (Accordering eigenaar vereist)</div>
              </div>
            </div>

            <div class="price-block">
              <div style="font-size:12px; color:#64748b;">Subtotaal (excl. 21% BTW): &nbsp; €${(order.totalAmount / 1.21).toFixed(2)}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">BTW 21%: &nbsp; €${(order.totalAmount - order.totalAmount / 1.21).toFixed(2)}</div>
              <div class="label" style="margin-top:12px;">Totaal Overeenkomst (incl. BTW)</div>
              <div class="price-amount">€${order.totalAmount.toFixed(2)}</div>
            </div>

            ${WHATSAPP_NUMBER ? `
            <div style="margin: 28px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; text-align: center;">
              <div style="font-size: 14px; font-weight: 700; color: #166534;">Laatste stap: bevestig via WhatsApp</div>
              <p style="font-size: 13px; line-height: 1.6; color: #15803d; margin: 8px 0 16px;">
                Vraag eenvoudig uw iDEAL/Tikkie-betaallink aan. Zodra de betaling binnen is, bevestigen wij uw reservering.
              </p>
              <a href="${waLink(`Hallo huurgo! 🦾 Graag ontvang ik de betaallink (iDEAL/Tikkie) voor mijn reservering ${order.id}.`)}"
                 style="display: inline-block; background: #25D366; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: bold; font-size: 14px;">
                Betaallink aanvragen via WhatsApp
              </a>
            </div>
            ` : `
            <p style="font-size: 13px; line-height: 1.6; color: #475569;">
              Wij nemen zo snel mogelijk contact met u op zodra de definitieve logistieke accordering is bevestigd. Meestal gebeurt dit binnen 1 uur.
            </p>
            `}

            <div style="margin: 24px 0; padding: 0 4px;">
              <div class="label" style="margin-bottom: 10px;">Wat gebeurt er nu?</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 13px; color: #475569; line-height: 1.5;">
                <tr><td style="padding: 4px 0; vertical-align: top; width: 24px;"><strong style="color:#4f46e5;">1.</strong></td><td style="padding: 4px 0;">U vraagt de betaallink aan${WHATSAPP_NUMBER ? " via WhatsApp" : ""}.</td></tr>
                <tr><td style="padding: 4px 0; vertical-align: top;"><strong style="color:#4f46e5;">2.</strong></td><td style="padding: 4px 0;">Na betaling zetten wij uw reservering op <strong>Goedgekeurd</strong>.</td></tr>
                <tr><td style="padding: 4px 0; vertical-align: top;"><strong style="color:#4f46e5;">3.</strong></td><td style="padding: 4px 0;">${isPickup ? "U haalt de machine op op de afgesproken datum." : "Wij bezorgen de machine op het afgesproken moment."}</td></tr>
              </table>
            </div>

            <div style="text-align: center;">
              <a href="${APP_URL}/orders" class="btn" style="color: #ffffff;">Mijn Reserveringen Bekijken</a>
            </div>
          </div>
          <div class="footer">
            ${company.footerLong}
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Attempting to send confirmation email for ${order.id} to ${order.customerEmail}`);
    
    if (!resend) {
      console.log(`[EmailService] [MOCK] Resend NOT configured. Simulated email sent successfully.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: order.customerEmail,
      replyTo: REPLY_TO_ADDRESS,
      subject: `Bevestiging van uw reservering ${order.id} - huurgo`,
      html: htmlContent,
    });
  },

  /**
   * Send Alert Email to Admin when a new order is received
   */
  sendAdminAlert: async (order: EmailOrderData) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nieuwe Reservering Ontvangen</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: #0f172a; padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #f59e0b; }
          .content { padding: 40px 30px; }
          .details-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #edf2f7; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .btn { display: inline-block; background: #f59e0b; color: #0f172a; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 NIEUWE RESERVERING</h1>
            <p>Admin alert voor huurgo.nl</p>
          </div>
          <div class="content">
            <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: #0f172a;">Beste Admin,</h3>
            <p>Er is zojuist een nieuwe online reservering binnengekomen via het storefront portaal. Deze vereist directe accordering in het HubAdmin dashboard:</p>
            
            <div class="details-grid">
              <div class="details-item">
                <div class="label">Reservering ID</div>
                <div class="value" style="color: #4f46e5; font-family: monospace; font-size: 14px;">${order.id}</div>
              </div>
              <div class="details-item">
                <div class="label">Klant Details</div>
                <div class="value">${esc(order.customerName)}${order.customerProfile ? ` (${esc(order.customerProfile)})` : ''}<br><span style="font-weight: normal; font-size: 11px; font-family: monospace;">${esc(order.customerEmail)} | ${esc(order.customerPhone || '')}</span></div>
              </div>
              <div class="details-item">
                <div class="label">Gevraagd Materieel</div>
                <div class="value">${esc(order.machineName)}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate} (${order.rentalDays}d)</div>
              </div>
              <div class="details-item">
                <div class="label">Huurcontract Waarde</div>
                <div class="value" style="color: #10b981; font-size: 15px;">€${order.totalAmount.toFixed(2)}</div>
              </div>
            </div>

            <div style="text-align: center; margin-bottom: 16px;">
              <a href="${APP_URL}/admin" class="btn">Naar HubAdmin Dashboard</a>
            </div>
            ${WHATSAPP_NUMBER && order.customerPhone ? `
            <div style="text-align:center;margin-top:16px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">
              <p style="font-size:12px;font-weight:700;color:#166534;margin:0 0 10px;">Klant direct contacteren via WhatsApp</p>
              <a href="${waLink(`Hallo ${order.customerName}! 🦾 Bedankt voor uw reservering ${order.id}. Wij nemen zo spoedig mogelijk contact met u op.`)}"
                 style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:bold;font-size:13px;">
                WhatsApp klant
              </a>
            </div>` : ""}
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Attempting to send Admin Alert for ${order.id} to ${ADMIN_ALERT_EMAIL}`);
    
    if (!resend) {
      console.log(`[EmailService] [MOCK] Resend NOT configured. Simulated admin alert sent.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      // Reply straight to the customer from the alert, not to the info-box
      replyTo: order.customerEmail || REPLY_TO_ADDRESS,
      subject: `🚨 Nieuwe Reservering ${order.id} - €${order.totalAmount.toFixed(2)} - ${order.customerName}`,
      html: htmlContent,
    });
  },

  /**
   * Send Order Status Update Email to Customer (e.g. Approved, Out for delivery)
   */
  sendStatusUpdate: async (order: EmailOrderData) => {
    const company = await getCompanyDetails();
    let statusTitle = "Status bijgewerkt";
    let statusDescription = `De status van uw reservering ${order.id} is bijgewerkt naar: <strong>${order.status}</strong>.`;
    let headerColor = "linear-gradient(135deg, #4f46e5, #3b82f6)";

    if (order.status === "Goedgekeurd") {
      statusTitle = "🎉 Reservering Goedgekeurd!";
      statusDescription = "Onze verhuurplanner heeft uw reservering officieel goedgekeurd. De hoogwerker is gereserveerd in onze vlootagenda.";
      headerColor = "linear-gradient(135deg, #10b981, #059669)";
    } else if (order.status === "Onderweg") {
      statusTitle = "🚚 Uw Hoogwerker is Onderweg!";
      statusDescription = "De transporteur heeft de machine geladen en is onderweg naar uw afleveradres. Zorg ervoor dat de opstelplaats vrij is voor levering.";
      headerColor = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
    } else if (order.status === "Voltooid") {
      statusTitle = "Huurcontract Voltooid";
      statusDescription = "De huurperiode is beëindigd en het materieel is succesvol retour ontvangen. Bedankt voor uw vertrouwen in huurgo!";
      headerColor = "linear-gradient(135deg, #64748b, #475569)";
    }

    // Approval only fires after payment is marked "paid" (enforced server-side in
    // orders.ts), so the Goedgekeurd mail doubles as the payment-received receipt —
    // no separate payment email is sent.
    const paymentBlock = order.status === "Goedgekeurd" ? `
      <div style="text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 16px 20px; margin-top: 24px;">
        <p style="font-size: 14px; font-weight: 700; color: #166534; margin: 0;">✓ Betaling ontvangen</p>
        <p style="font-size: 12px; color: #15803d; margin: 6px 0 0;">Uw betaling van €${order.totalAmount.toFixed(2)} is verwerkt. Uw reservering is nu definitief bevestigd.</p>
      </div>` : "";

    const ratingUrl = `${APP_URL}/?rate=${encodeURIComponent(order.id)}&email=${encodeURIComponent(order.customerEmail)}`;
    const ratingBlock = order.status === "Voltooid" ? `
      <div style="text-align: center; background: #fffbeb; border: 1px solid #fde68a; border-radius: 16px; padding: 20px; margin-top: 24px;">
        <p style="font-size: 20px; margin: 0 0 6px;">⭐</p>
        <p style="font-size: 13px; font-weight: 700; color: #92400e; margin: 0 0 12px;">Wat vond u van de verhuurervaring?</p>
        <a href="${ratingUrl}" style="display: inline-block; background: #f59e0b; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 10px; font-weight: bold; font-size: 13px;">Geef een beoordeling</a>
      </div>` : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Statusupdate reservering huurgo</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: ${headerColor}; padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .status-badge { display: inline-block; background: #f1f5f9; padding: 6px 16px; border-radius: 9999px; font-weight: bold; color: #4f46e5; font-size: 13px; margin-bottom: 20px; text-transform: uppercase; }
          .details-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: bold; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">huur<span style="color:#fb923c;">go</span></h1>
            <p>Update over uw reservering ${order.id}</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="status-badge" style="color: #4f46e5;">Status: ${esc(order.status)}</span>
            </div>
            <p>Beste <strong>${esc(order.customerName)}</strong>,</p>
            <p>${statusDescription}</p>
            ${paymentBlock}

            <h4 style="margin-top: 24px; font-size: 14px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px;">Reservering details</h4>
            <div class="details-grid">
              <div class="details-item">
                <div class="label">Machine</div>
                <div class="value">${esc(order.machineName)}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate}</div>
              </div>
              ${order.deliveryAddress ? `
              <div class="details-item">
                <div class="label">Bezorgadres</div>
                <div class="value">${esc(order.deliveryAddress)}</div>
              </div>
              ` : ''}
              <div class="details-item">
                <div class="label">Totaalsom</div>
                <div class="value" style="color: #10b981;">€${order.totalAmount.toFixed(2)}</div>
              </div>
            </div>

            <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-top: 20px;">
              Mocht u nog vragen of wijzigingen hebben, neem dan gerust direct contact op met onze planners via de website.
            </p>

            <div style="text-align: center;">
              <a href="${APP_URL}/orders" class="btn" style="color: #ffffff;">Mijn Account Openen</a>
            </div>
            ${ratingBlock}
          </div>
          <div class="footer">
            ${company.footerLong}
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Attempting to send status update (${order.status}) for ${order.id} to ${order.customerEmail}`);
    
    if (!resend) {
      console.log(`[EmailService] [MOCK] Resend NOT configured. Simulated status update email sent.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: order.customerEmail,
      replyTo: REPLY_TO_ADDRESS,
      subject: `Update van uw reservering ${order.id}: ${order.status} - huurgo`,
      html: htmlContent,
    });
  },

  /**
   * Send Email Verification Link to the Customer
   */
  sendVerificationEmail: async (customer: { name: string; email: string }, token: string, origin: string) => {
    const company = await getCompanyDetails();
    const verificationUrl = `${origin}/api/auth/verify?token=${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Activeer uw huurgo Account</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { background: linear-gradient(135deg, #4f46e5, #3b82f6); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
          .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 40px 30px; text-align: center; }
          .welcome-text { font-size: 16px; color: #0f172a; text-align: left; line-height: 1.6; }
          .info-text { font-size: 14px; color: #475569; text-align: left; line-height: 1.6; margin-top: 16px; }
          .btn-container { margin: 35px 0; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 35px; border-radius: 12px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15); transition: all 0.2s; }
          .link-fallback { font-size: 11px; color: #64748b; word-break: break-all; margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #edf2f7; text-align: left; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">huur<span style="color:#fb923c;">go</span></h1>
            <p>Bevestig uw e-mailadres om uw account te activeren</p>
          </div>
          <div class="content">
            <p class="welcome-text">Beste <strong>${esc(customer.name)}</strong>,</p>
            <p class="info-text">
              Welkom bij huurgo! U heeft succesvol een account aangemaakt. Om te kunnen inloggen op het Klant Portaal en uw reserveringen te beheren, dient u eerst uw e-mailadres te verifiëren door op de onderstaande knop te klikken:
            </p>
            
            <div class="btn-container">
              <a href="${verificationUrl}" class="btn" target="_blank">E-mailadres Verifiëren</a>
            </div>

            <p class="info-text" style="font-size: 12px;">
              Deze link is 24 uur geldig. Heeft u dit account niet zelf aangemaakt? Dan kunt u deze e-mail gerust negeren.
            </p>

            <div class="link-fallback">
              <strong>Werkt de knop niet?</strong><br/>
              Kopieer en plak de volgende URL direct in uw internetbrowser:<br/>
              <a href="${verificationUrl}" style="color: #4f46e5; text-decoration: underline;">${verificationUrl}</a>
            </div>
          </div>
          <div class="footer">
            ${company.footerLong}
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Attempting to send verification email to ${customer.email}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Resend NOT configured. Simulated verification email sent.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_ADDRESS,
      subject: "Activeer uw huurgo account",
      html: htmlContent,
    });
  },

  /**
   * Send a reminder email to the customer one day before the rental starts
   */
  sendRentalReminder: async (order: EmailOrderData) => {
    const company = await getCompanyDetails();
    const isPickup = order.deliveryType === "self_pickup";
    const deliveryText = isPickup ? `Zelf afhalen bij MB Hoogwerkers, ${company.address}` : `Bezorging op adres: ${esc(order.deliveryAddress || "")}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Herinnering: Uw huur begint morgen</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: linear-gradient(135deg, #0d9488, #0891b2); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .details-grid { display: grid; gap: 14px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Uw huur begint morgen!</h1>
          </div>
          <div class="content">
            <p>Beste <strong>${esc(order.customerName)}</strong>,</p>
            <p>Dit is een vriendelijke herinnering dat uw gereserveerde machine <strong>morgen</strong> klaar staat.</p>
            <div class="details-grid">
              <div class="details-item"><div class="label">Reservering</div><div class="value">${order.id}</div></div>
              <div class="details-item"><div class="label">Machine</div><div class="value">${esc(order.machineName)}</div></div>
              <div class="details-item"><div class="label">Startdatum</div><div class="value">${order.startDate}</div></div>
              <div class="details-item"><div class="label">Ophalen / Levering</div><div class="value">${deliveryText}</div></div>
            </div>
            <p style="font-size: 13px; color: #475569;">Zorg dat de opstelplaats toegankelijk is. Bij vragen kunt u contact opnemen via WhatsApp.</p>
          </div>
          <div class="footer">${company.footerShort}</div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Sending rental reminder for ${order.id} to ${order.customerEmail}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Rental reminder simulated.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: order.customerEmail,
      replyTo: REPLY_TO_ADDRESS,
      subject: `Herinnering: Uw hoogwerker ${order.machineName} is morgen klaar — ${order.id}`,
      html: htmlContent
    });
  },

  /**
   * Send a reminder email to a customer whose booking is still unpaid a day
   * after placing it. Mirrors sendRentalReminder's structure/styling.
   */
  sendPaymentReminder: async (order: EmailOrderData) => {
    const company = await getCompanyDetails();
    const paymentWaLink = waLink(
      `Hallo huurgo! 👋\n\nIk heb zojuist een betaalherinnering ontvangen voor boeking ${order.id}.\n\nKunt u mij de betaallink nogmaals sturen?\n\nBedankt! 🦾`
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Herinnering: betaling nog niet ontvangen</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: linear-gradient(135deg, #d97706, #ea580c); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .details-grid { display: grid; gap: 14px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .btn { display: inline-block; background: #25D366; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: bold; font-size: 14px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ We wachten nog op uw betaling</h1>
          </div>
          <div class="content">
            <p>Beste <strong>${esc(order.customerName)}</strong>,</p>
            <p>We hebben nog geen betaling ontvangen voor onderstaande boeking. U kunt de betaling alsnog voldoen via de eerder verzonden iDEAL-link.</p>
            <div class="details-grid">
              <div class="details-item"><div class="label">Reservering</div><div class="value">${order.id}</div></div>
              <div class="details-item"><div class="label">Machine</div><div class="value">${esc(order.machineName)}</div></div>
              <div class="details-item"><div class="label">Startdatum</div><div class="value">${order.startDate}</div></div>
            </div>
            <p style="font-size: 13px; color: #475569;"><strong>Let op:</strong> als de betaling niet binnen 48 uur is ontvangen, wordt de boeking helaas automatisch geannuleerd.</p>
            ${WHATSAPP_NUMBER ? `<p style="text-align:center;"><a href="${paymentWaLink}" class="btn">💬 Betaallink opnieuw aanvragen</a></p>` : ""}
            <p style="font-size: 13px; color: #475569;">Loopt er iets mis of heeft u een vraag? Neem gerust contact met ons op via WhatsApp.</p>
          </div>
          <div class="footer">${company.footerShort}</div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Sending payment reminder for ${order.id} to ${order.customerEmail}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Payment reminder simulated.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: order.customerEmail,
      replyTo: REPLY_TO_ADDRESS,
      subject: `Herinnering: betaling voor ${order.machineName} nog niet ontvangen — ${order.id}`,
      html: htmlContent
    });
  },

  /**
   * Send password reset link to customer
   */
  sendPasswordResetEmail: async (email: string, name: string, token: string, appUrl: string) => {
    const company = await getCompanyDetails();
    const resetUrl = `${appUrl}/orders?reset_token=${token}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Wachtwoord Resetten - huurgo</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: linear-gradient(135deg, #4f46e5, #3b82f6); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 40px 30px; text-align: center; }
          .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 35px; border-radius: 12px; font-weight: bold; font-size: 14px; margin: 24px 0; }
          .link-fallback { font-size: 11px; color: #64748b; word-break: break-all; margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #edf2f7; text-align: left; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">huur<span style="color:#fb923c;">go</span></h1><p>Wachtwoord resetten</p></div>
          <div class="content">
            <p style="text-align:left;">Beste <strong>${esc(name)}</strong>,</p>
            <p style="text-align:left; font-size:13px; color:#475569; line-height:1.6;">
              U heeft een aanvraag ingediend om uw wachtwoord te resetten. Klik op de knop hieronder om een nieuw wachtwoord in te stellen. De link is 1 uur geldig.
            </p>
            <a href="${resetUrl}" class="btn">Nieuw Wachtwoord Instellen</a>
            <p style="font-size:12px; color:#94a3b8;">Heeft u dit niet aangevraagd? Dan kunt u deze e-mail negeren.</p>
            <div class="link-fallback">
              <strong>Werkt de knop niet?</strong><br/>
              <a href="${resetUrl}" style="color:#4f46e5;">${resetUrl}</a>
            </div>
          </div>
          <div class="footer">${company.footerShort}</div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Sending password reset email to ${email}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Password reset email simulated.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: email,
      replyTo: REPLY_TO_ADDRESS,
      subject: "Wachtwoord resetten - huurgo",
      html: htmlContent
    });
  },

  /**
   * Send cancellation alert to admin when a customer cancels an order
   */
  sendAdminCancelAlert: async (order: EmailOrderData) => {
    const company = await getCompanyDetails();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: #dc2626; padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .details-grid { display: grid; gap: 14px; margin: 24px 0; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #edf2f7; }
          .details-item { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .details-item:last-child { border-bottom: none; padding-bottom: 0; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .btn { display: inline-block; background: #dc2626; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>❌ RESERVERING GEANNULEERD</h1><p>Admin alert voor huurgo.nl</p></div>
          <div class="content">
            <p>Een klant heeft zojuist een reservering geannuleerd via het klantenportaal.</p>
            <div class="details-grid">
              <div class="details-item"><div class="label">Reservering ID</div><div class="value" style="color:#dc2626; font-family:monospace;">${order.id}</div></div>
              <div class="details-item"><div class="label">Klant</div><div class="value">${esc(order.customerName)} — ${esc(order.customerEmail)}</div></div>
              <div class="details-item"><div class="label">Machine</div><div class="value">${esc(order.machineName)}</div></div>
              <div class="details-item"><div class="label">Periode</div><div class="value">${order.startDate} t/m ${order.endDate} (${order.rentalDays}d)</div></div>
              <div class="details-item"><div class="label">Waarde (vervallen)</div><div class="value" style="color:#dc2626;">€${order.totalAmount.toFixed(2)}</div></div>
            </div>
            <div style="text-align:center;"><a href="${APP_URL}/admin" class="btn">Bekijk in Admin Dashboard</a></div>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resend) {
      console.log(`[EmailService] [MOCK] Admin cancel alert simulated for ${order.id}.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      replyTo: order.customerEmail || REPLY_TO_ADDRESS,
      subject: `❌ Annulering ${order.id} — ${order.customerName} — €${order.totalAmount.toFixed(2)}`,
      html: htmlContent,
    });
  },

  /**
   * Send admin alert with WhatsApp quick-link when a new order arrives
   */
  sendAdminAlertWithWA: async (order: EmailOrderData) => {
    // Reuse the existing admin alert email — which already has all the fields.
    // We just need to add a WA link in the email body. Since the email HTML is
    // generated in sendAdminAlert, we call sendAdminAlert (which already
    // constructs the WA link) and also fire a separate WA-link email section.
    return emailService.sendAdminAlert(order);
  },

  /**
   * Send a personalised campaign email to a single customer
   */
  sendCampaignEmail: async (customer: { name: string; email: string }, subject: string, body: string): Promise<boolean> => {
    const company = await getCompanyDetails();
    const safeBody = body
      .split("\n")
      .map(line => `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#334155;">${
        line.trim() === "" ? "&nbsp;" : line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      }</p>`)
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${esc(subject)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#f8fafc; color:#1e293b; margin:0; padding:20px; }
          .container { max-width:600px; margin:0 auto; background:#fff; border-radius:24px; border:1px solid #e2e8f0; overflow:hidden; }
          .header { background:linear-gradient(135deg,#4f46e5,#3b82f6); padding:32px 30px; text-align:center; color:#fff; }
          .header h1 { margin:0; font-size:22px; font-weight:800; }
          .content { padding:36px 30px; }
          .footer { background:#f1f5f9; padding:18px 30px; text-align:center; font-size:11px; color:#64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">huur<span style="color:#fb923c;">go</span></h1></div>
          <div class="content">
            <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 16px;">Beste <strong>${esc(customer.name)}</strong>,</p>
            ${safeBody}
            <div style="margin-top:28px;text-align:center;">
              <a href="${APP_URL}" style="display:inline-block;background:#f59e0b;color:#0f172a;text-decoration:none;padding:12px 30px;border-radius:12px;font-weight:800;font-size:13px;">
                Bekijk ons aanbod →
              </a>
            </div>
          </div>
          <div class="footer">
            ${company.footerLong}<br>
            <span style="font-size:10px;color:#94a3b8;">U ontvangt dit bericht omdat u klant bent bij MB Hoogwerkers B.V.</span>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resend) {
      console.log(`[EmailService] [MOCK] Campaign email to ${customer.email}: "${subject}"`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_ADDRESS,
      subject,
      html: htmlContent,
    });
  },

  sendEmailFailureAlert: async (orderId: string, customerEmail: string, errorMsg: string): Promise<boolean> => {
    if (!ADMIN_ALERT_EMAIL) return false;
    if (!resend) {
      console.log(`[EmailService] [MOCK] Email failure alert for order ${orderId}`);
      return true;
    }
    return sendWithRetry({
      from: SENDER_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      replyTo: customerEmail || REPLY_TO_ADDRESS,
      subject: `⚠️ [HuurGo] Email bevestiging mislukt: ${orderId}`,
      html: `<p>De klantbevestiging voor bestelling <strong>${orderId}</strong> kon niet worden bezorgd aan <strong>${customerEmail}</strong>.<br><br>Neem handmatig contact op met de klant.<br><br><small>Fout: ${errorMsg}</small></p>`,
    });
  },

  /**
   * Diagnostic send: a real email through the same Resend client/sender as
   * every other transactional email, addressed to the requesting admin's own
   * inbox. Distinct from every other method here in that it reports whether
   * it actually hit the Resend API (`mocked: false`) or silently no-opped
   * because RESEND_API_KEY is absent (`mocked: true`) — every other method
   * above collapses that distinction to a plain `true`, which is correct for
   * fire-and-forget order emails but useless for a "why isn't email arriving"
   * diagnostic, where that exact distinction is the whole point.
   */
  sendTestEmail: async (toEmail: string): Promise<{ ok: boolean; mocked: boolean }> => {
    if (!resend) {
      console.log(`[EmailService] [MOCK] Test email to ${toEmail} — RESEND_API_KEY not configured, nothing actually sent.`);
      return { ok: true, mocked: true };
    }
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;color:#0f172a;">huur<span style="color:#fb923c;">go</span> — testmail</h2>
        <p style="font-size:14px;color:#334155;">Dit is een testbericht vanuit het admin-diagnostiekpaneel, verstuurd op ${new Date().toISOString()}.</p>
        <p style="font-size:13px;color:#64748b;">Komt deze e-mail aan? Dan werkt de Resend-configuratie (${SENDER_EMAIL}) correct.</p>
      </div>`;
    const ok = await sendWithRetry({
      from: SENDER_EMAIL,
      to: toEmail,
      replyTo: REPLY_TO_ADDRESS,
      subject: "huurgo — testmail vanuit Diagnostiek",
      html,
    });
    return { ok, mocked: false };
  },
};

// Config-status voor het admin-diagnostiekpaneel — booleans/veilige velden alleen,
// nooit de sleutel zelf. Los geëxporteerd (i.p.v. via het emailService-object)
// zodat het duidelijk een ander soort functie is: synchroon, geen sideeffects.
export function getEmailDiagnostics() {
  return {
    resendConfigured: !!resend,
    emailFrom: SENDER_EMAIL,
    replyTo: REPLY_TO_ADDRESS,
    adminAlertEmailConfigured: !!ADMIN_ALERT_EMAIL,
    adminAlertEmail: ADMIN_ALERT_EMAIL || null,
    whatsappConfigured: !!WHATSAPP_NUMBER,
  };
}
