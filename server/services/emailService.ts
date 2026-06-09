/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resend } from "resend";

// Initialize Resend with env key
// In local development, if RESEND_API_KEY is not defined, we fallback to mocking
const resendApiKey = process.env.RESEND_API_KEY || "";
const resend = resendApiKey && resendApiKey !== "MY_RESEND_API_KEY" ? new Resend(resendApiKey) : null;

// Standard sender email (if domain is verified, use verified domain. Otherwise Resend sandbox uses onboarding@resend.dev)
const SENDER_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "https://mbhoogwerkers.com";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_EMAIL || "mustafa@mbhoogwerkers.com";

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
    const isPickup = order.deliveryType === "self_pickup";
    const deliveryMethodText = isPickup ? "Zelf Afhalen (Gratis)" : "Bezorgservice op locatie";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reserveringsbevestiging HuurGo</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px border-slate-200; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { background: linear-gradient(135deg, #4f46e5, #3b82f6); padding: 40px 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
          .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .order-id { font-mono; display: inline-block; background: #f1f5f9; padding: 6px 12px; border-radius: 9999px; font-weight: bold; color: #4f46e5; font-size: 13px; margin-bottom: 20px; }
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
            <h1>HuurGo</h1>
            <p>Uw reserveringsbevestiging is succesvol verwerkt</p>
          </div>
          <div class="content">
            <span class="order-id">Reservering ID: ${order.id}</span>
            <p>Beste <strong>${order.customerName}</strong>,</p>
            <p>Hartelijk dank voor uw reservering bij HuurGo. Onze logistieke afdeling en AI-planner hebben uw reservering direct gereserveerd en in behandeling genomen. Hieronder vindt u de specificaties:</p>
            
            <div class="details-grid">
              <div class="details-item">
                <div class="label">Gereserveerd Object</div>
                <div class="value">${order.machineName}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate} (${order.rentalDays} dagen)</div>
              </div>
              <div class="details-item">
                <div class="label">Leveringsmethode</div>
                <div class="value">${deliveryMethodText}</div>
              </div>
              ${!isPickup && order.deliveryAddress ? `
              <div class="details-item">
                <div class="label">Bezorgadres</div>
                <div class="value">${order.deliveryAddress}</div>
              </div>
              ` : ''}
              <div class="details-item">
                <div class="label">Status</div>
                <div class="value" style="color: #d97706;">In behandeling (Accordering eigenaar vereist)</div>
              </div>
            </div>

            <div class="price-block">
              <div class="label">Totaal Overeenkomst (incl. BTW)</div>
              <div class="price-amount">€ ${order.totalAmount.toFixed(2)}</div>
            </div>

            <p style="font-size: 13px; line-height: 1.6; color: #475569;">
              Wij nemen zo snel mogelijk contact met u op zodra de definitieve logistieke accordering is bevestigd. Meestal gebeurt dit binnen 1 uur.
            </p>

            <div style="text-align: center;">
              <a href="${APP_URL}/orders" class="btn" style="color: #ffffff;">Mijn Reserveringen Bekijken</a>
            </div>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} HuurGo B.V. • BMWT-gecertificeerd verhuurnetwerk • Alphen aan den Rijn, Nederland
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
      subject: `Bevestiging van uw reservering ${order.id} - HuurGo`,
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
            <p>Admin alert voor HuurGo.nl</p>
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
                <div class="value">${order.customerName} (${order.customerProfile})<br><span style="font-weight: normal; font-size: 11px; font-family: monospace;">${order.customerEmail} | ${order.customerPhone || ''}</span></div>
              </div>
              <div class="details-item">
                <div class="label">Gevraagd Materieel</div>
                <div class="value">${order.machineName}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate} (${order.rentalDays}d)</div>
              </div>
              <div class="details-item">
                <div class="label">Huurcontract Waarde</div>
                <div class="value" style="color: #10b981; font-size: 15px;">€ ${order.totalAmount.toFixed(2)}</div>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${APP_URL}/admin" class="btn">Naar HubAdmin Dashboard</a>
            </div>
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
      subject: `🚨 Nieuwe Reservering ${order.id} - €${order.totalAmount.toFixed(2)} - ${order.customerName}`,
      html: htmlContent,
    });
  },

  /**
   * Send Order Status Update Email to Customer (e.g. Approved, Out for delivery)
   */
  sendStatusUpdate: async (order: EmailOrderData) => {
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
      statusDescription = "De huurperiode is beëindigd en het materieel is succesvol retour ontvangen. Bedankt voor uw vertrouwen in HuurGo!";
      headerColor = "linear-gradient(135deg, #64748b, #475569)";
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Statusupdate reservering HuurGo</title>
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
            <h1>HuurGo</h1>
            <p>Update over uw reservering ${order.id}</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="status-badge" style="color: #4f46e5;">Status: ${order.status}</span>
            </div>
            <p>Beste <strong>${order.customerName}</strong>,</p>
            <p>${statusDescription}</p>
            
            <h4 style="margin-top: 24px; font-size: 14px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px;">Reservering details</h4>
            <div class="details-grid">
              <div class="details-item">
                <div class="label">Machine</div>
                <div class="value">${order.machineName}</div>
              </div>
              <div class="details-item">
                <div class="label">Huurperiode</div>
                <div class="value">${order.startDate} t/m ${order.endDate}</div>
              </div>
              ${order.deliveryAddress ? `
              <div class="details-item">
                <div class="label">Bezorgadres</div>
                <div class="value">${order.deliveryAddress}</div>
              </div>
              ` : ''}
              <div class="details-item">
                <div class="label">Totaalsom</div>
                <div class="value" style="color: #10b981;">€ ${order.totalAmount.toFixed(2)}</div>
              </div>
            </div>

            <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-top: 20px;">
              Mocht u nog vragen of wijzigingen hebben, neem dan gerust direct contact op met onze planners via de website.
            </p>

            <div style="text-align: center;">
              <a href="${APP_URL}/orders" class="btn" style="color: #ffffff;">Mijn Account Openen</a>
            </div>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} HuurGo B.V. • BMWT-gecertificeerd verhuurnetwerk • Alphen aan den Rijn, Nederland
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
      subject: `Update van uw reservering ${order.id}: ${order.status} - HuurGo`,
      html: htmlContent,
    });
  },

  /**
   * Send Email Verification Link to the Customer
   */
  sendVerificationEmail: async (customer: { name: string; email: string }, token: string, origin: string) => {
    const verificationUrl = `${origin}/api/auth/verify?token=${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Activeer uw HuurGo Account</title>
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
            <h1>HuurGo</h1>
            <p>Bevestig uw e-mailadres om uw account te activeren</p>
          </div>
          <div class="content">
            <p class="welcome-text">Beste <strong>${customer.name}</strong>,</p>
            <p class="info-text">
              Welkom bij HuurGo! U heeft succesvol een account aangemaakt. Om te kunnen inloggen op het Klant Portaal en uw reserveringen te beheren, dient u eerst uw e-mailadres te verifiëren door op de onderstaande knop te klikken:
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
            © ${new Date().getFullYear()} HuurGo B.V. • BMWT-gecertificeerd verhuurnetwerk • Alphen aan den Rijn, Nederland
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Attempting to send verification email to ${customer.email}`);
    console.log(`[EmailService] Verification Link: ${verificationUrl}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Resend NOT configured. Simulated verification email sent.`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: customer.email,
      subject: "Activeer uw HuurGo account",
      html: htmlContent,
    });
  },

  /**
   * Send a reminder email to the customer one day before the rental starts
   */
  sendRentalReminder: async (order: EmailOrderData) => {
    const isPickup = order.deliveryType === "self_pickup";
    const deliveryText = isPickup ? "Zelf afhalen bij HuurGo, Distributieweg 12, Amsterdam" : `Bezorging op adres: ${order.deliveryAddress || ""}`;

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
            <p>Beste <strong>${order.customerName}</strong>,</p>
            <p>Dit is een vriendelijke herinnering dat uw gereserveerde machine <strong>morgen</strong> klaar staat.</p>
            <div class="details-grid">
              <div class="details-item"><div class="label">Reservering</div><div class="value">${order.id}</div></div>
              <div class="details-item"><div class="label">Machine</div><div class="value">${order.machineName}</div></div>
              <div class="details-item"><div class="label">Startdatum</div><div class="value">${order.startDate}</div></div>
              <div class="details-item"><div class="label">Ophalen / Levering</div><div class="value">${deliveryText}</div></div>
            </div>
            <p style="font-size: 13px; color: #475569;">Zorg dat de opstelplaats toegankelijk is. Bij vragen kunt u contact opnemen via WhatsApp.</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} HuurGo B.V. • BMWT-gecertificeerd verhuurnetwerk</div>
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
      subject: `Herinnering: Uw hoogwerker ${order.machineName} is morgen klaar — ${order.id}`,
      html: htmlContent
    });
  },

  /**
   * Send password reset link to customer
   */
  sendPasswordResetEmail: async (email: string, name: string, token: string, appUrl: string) => {
    const resetUrl = `${appUrl}/orders?reset_token=${token}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Wachtwoord Resetten - HuurGo</title>
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
          <div class="header"><h1>HuurGo</h1><p>Wachtwoord resetten</p></div>
          <div class="content">
            <p style="text-align:left;">Beste <strong>${name}</strong>,</p>
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
          <div class="footer">© ${new Date().getFullYear()} HuurGo B.V. • BMWT-gecertificeerd verhuurnetwerk</div>
        </div>
      </body>
      </html>
    `;

    console.log(`[EmailService] Sending password reset email to ${email}`);

    if (!resend) {
      console.log(`[EmailService] [MOCK] Password reset email simulated. Reset URL: ${resetUrl}`);
      return true;
    }

    return sendWithRetry({
      from: SENDER_EMAIL,
      to: email,
      subject: "Wachtwoord resetten - HuurGo",
      html: htmlContent
    });
  }
};
