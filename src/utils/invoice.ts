/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from "../types";

/**
 * Utility to generate and print a professional Dutch rental invoice/agreement
 * for a HuurGo order using native browser print capability.
 */
interface BusinessInfo {
  companyLegalName?: string;
  companyAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  kvkNumber?: string;
  btwNumber?: string;
}

export function printInvoice(orderOrOrders: Order | Order[], clientCompanyName?: string, isProforma?: boolean, businessInfo?: BusinessInfo) {
  const escapeHtml = (str: string): string => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];
  if (orders.length === 0) return;

  const primaryOrder = orders[0];
  if (!primaryOrder.invoiceNumber) {
    console.warn(`[Invoice] Order ${primaryOrder.id} missing sequential invoiceNumber — invoice may not comply with Dutch BTW requirements`);
  }
  const invoiceNumber = primaryOrder.invoiceNumber
    ? (orders.length === 1 ? primaryOrder.invoiceNumber : `${primaryOrder.invoiceNumber}-GRP`)
    : (orders.length === 1 ? primaryOrder.id : `${primaryOrder.id}-GRP`);
    
  const todayDate = new Date().toLocaleDateString("nl-NL");
  const dueDateStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("nl-NL");

  let totalSubtotal = 0;
  let totalTransport = 0;
  let totalDriver = 0;
  let totalAddonCost = 0;
  let totalVat = 0;
  let totalAmount = 0;
  let maxRentalDays = 0;

  orders.forEach(o => {
    totalSubtotal += o.subtotal;
    totalTransport += o.transportCost;
    totalDriver += o.driverCost;
    totalVat += o.vatAmount;
    totalAmount += o.totalAmount;
    if (o.rentalDays > maxRentalDays) {
      maxRentalDays = o.rentalDays;
    }
    if (o.addons && o.addons.length > 0) {
      o.addons.forEach(a => {
        totalAddonCost += a.price;
      });
    }
  });

  const subtotalExclVat = totalSubtotal + totalTransport + totalDriver + totalAddonCost;
  
  // Custom document title based on context and booking status
  let documentTitle: string;
  let paymentStatusLabel: string;
  let paymentStatusColor: string;
  if (isProforma) {
    documentTitle = "PRO-FORMA FACTUUR / OFFERTE";
    paymentStatusLabel = "AANGEVRAAGD";
    paymentStatusColor = "#b45309"; // amber
  } else if (primaryOrder.status === "Geannuleerd") {
    documentTitle = "GEANNULEERDE HUUROVEREENKOMST";
    paymentStatusLabel = "GEANNULEERD";
    paymentStatusColor = "#dc2626";
  } else {
    documentTitle = "OFFICIËLE HUUROVEREENKOMST & FACTUUR";
    if (primaryOrder.paymentStatus === "paid") {
      paymentStatusLabel = "BETAALD";
      paymentStatusColor = "#059669";
    } else if (primaryOrder.paymentStatus === "refunded") {
      paymentStatusLabel = "TERUGBETAALD";
      paymentStatusColor = "#7c3aed";
    } else {
      paymentStatusLabel = "OPENSTAAND";
      paymentStatusColor = "#d97706";
    }
  }

  // Delivery details display
  const logisticsText = primaryOrder.deliveryType === "self_pickup"
    ? "Zelf afhalen bij vestiging MB Hoogwerkers (gratis)"
    : primaryOrder.deliveryType === "trailer_rental"
    ? "Aanhanger meegenomen — zelf heen en terug"
    : "Bezorging door MB Hoogwerkers (heen + terug €150)";

  const customerCompany = clientCompanyName || "Particulier";

  // Escape user input fields to prevent XSS / HTML Injection
  const escCustomerName = escapeHtml(primaryOrder.customerName);
  const escCustomerCompany = escapeHtml(customerCompany);
  const escCustomerProfile = escapeHtml(primaryOrder.customerProfile || "Particulier");
  const escCustomerPhone = escapeHtml(primaryOrder.customerPhone || "");
  const escCustomerEmail = escapeHtml(primaryOrder.customerEmail);
  const escDeliveryAddress = escapeHtml(primaryOrder.deliveryAddress || "");

  // Generate dynamic table rows
  let tableRowsHtml = "";
  orders.forEach(o => {
    const escMachineName = escapeHtml(o.machineName);
    tableRowsHtml += `
      <!-- Machine rental -->
      <tr>
        <td>
          <strong>${escMachineName}</strong>
          <div class="item-spec">Huurperiode: ${o.startDate} t/m ${o.endDate}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Inclusief BMWT machine-verzekering & klusgids checklist pakket.</div>
        </td>
        <td style="text-align: right; font-family: monospace;">€${o.machinePrice.toFixed(2)}</td>
        <td style="text-align: center;">${o.rentalDays}</td>
        <td style="text-align: right; font-family: monospace;">€${o.subtotal.toFixed(2)}</td>
      </tr>
      
      <!-- Addons for this machine -->
      ${(o.addons || []).map(addon => `
      <tr>
        <td>
          <strong>${escapeHtml(addon.name)}</strong>
          <div class="item-spec">Type: Extra optie / accessoire (${escMachineName})</div>
        </td>
        <td style="text-align: right; font-family: monospace;">€${(addon.price / (addon.billing === "daily" ? o.rentalDays : 1)).toFixed(2)}</td>
        <td style="text-align: center;">${addon.billing === "daily" ? o.rentalDays : 1}</td>
        <td style="text-align: right; font-family: monospace;">€${addon.price.toFixed(2)}</td>
      </tr>
      `).join('')}
    `;
  });

  // Flat fees (Transport / Driver)
  if (totalTransport > 0) {
    tableRowsHtml += `
      <tr>
        <td>
          <strong>Logistieke Transportservice</strong>
          <div class="item-spec">Heen- en teruglevering op locatie</div>
        </td>
        <td style="text-align: right; font-family: monospace;">€${totalTransport.toFixed(2)}</td>
        <td style="text-align: center;">1</td>
        <td style="text-align: right; font-family: monospace;">€${totalTransport.toFixed(2)}</td>
      </tr>
    `;
  }

  if (totalDriver > 0) {
    tableRowsHtml += `
      <tr>
        <td>
          <strong>Gecertificeerde BMWT Chauffeursassistentie</strong>
          <div class="item-spec">Inclusief instructiebegeleiding op locatie</div>
        </td>
        <td style="text-align: right; font-family: monospace;">€${totalDriver.toFixed(2)}</td>
        <td style="text-align: center;">1</td>
        <td style="text-align: right; font-family: monospace;">€${totalDriver.toFixed(2)}</td>
      </tr>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <title>${invoiceNumber} - HuurGo Nederland</title>
      <!-- Premium Fonts -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
      <script>/* fonts load passively — print triggered from parent */</script>

      <style>
        /* Modern styling optimized for both screen preview and high-contrast A4 print */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          line-height: 1.5;
          padding: 40px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        
        /* Header Grid layout */
        .header-section {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 25px;
          margin-bottom: 30px;
          align-items: center;
        }
        
        .logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-text {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .logo-accent {
          color: #d97706; /* amber-600 */
        }
        
        .issuer-info {
          font-size: 11px;
          color: #64748b;
          text-align: right;
          line-height: 1.6;
        }
        .issuer-name {
          font-weight: 800;
          color: #0f172a;
          font-size: 12px;
          margin-bottom: 4px;
        }
        
        /* Document Title Section */
        .doc-title-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 35px;
        }
        .doc-type-label {
          font-family: 'Outfit', sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .doc-number {
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          color: #4f46e5; /* indigo-600 */
        }
        
        /* Party Info Symmetrical Columns */
        .parties-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 35px;
        }
        .party-box {
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 16px;
          padding: 20px;
        }
        .party-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }
        .party-detail {
          font-size: 12px;
          line-height: 1.7;
          color: #334155;
        }
        .party-detail strong {
          color: #0f172a;
          font-size: 13.5px;
        }
        
        /* Invoice Details strip */
        .meta-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          background-color: #f1f5f9;
          border-radius: 12px;
          padding: 15px;
          margin-bottom: 35px;
          text-align: center;
        }
        .meta-item-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }
        .meta-item-value {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }
        
        /* Pricing Table */
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 35px;
        }
        .invoice-table th {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 16px;
          text-align: left;
        }
        .invoice-table th:first-child {
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
        }
        .invoice-table th:last-child {
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
          text-align: right;
        }
        .invoice-table td {
          padding: 16px;
          font-size: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: top;
        }
        .invoice-table td:last-child {
          text-align: right;
          font-weight: 600;
          color: #0f172a;
        }
        .item-spec {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 4px;
          font-family: monospace;
        }
        
        /* Summary Totals area */
        .totals-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 45px;
        }
        .totals-box {
          width: 320px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 12px;
          border-top: 2px solid #e2e8f0;
          padding-top: 15px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          color: #475569;
        }
        .totals-row.grand-total {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
          margin-top: 5px;
        }
        .totals-row.grand-total .total-amount {
          color: #0d9488; /* teal-600 */
          font-size: 18px;
          font-family: monospace;
        }
        
        /* Compliance & Info Stamps */
        .compliance-banner {
          display: flex;
          align-items: center;
          gap: 15px;
          background-color: #f0fdf4; /* green-50 */
          border: 1px dashed #bbf7d0; /* green-200 */
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 45px;
        }
        .compliance-badge {
          background-color: #16a34a; /* green-600 */
          color: #ffffff;
          font-size: 10px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-family: 'Outfit', sans-serif;
          flex-shrink: 0;
        }
        .compliance-text {
          font-size: 11px;
          color: #166534; /* green-800 */
          line-height: 1.5;
        }
        
        /* Footer Bank details */
        .footer-terms {
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          line-height: 1.6;
          border-top: 1px solid #f1f5f9;
          padding-top: 20px;
        }
        .footer-highlight {
          color: #64748b;
          font-weight: 600;
        }
        
        /* Print rules */
        @media print {
          body {
            padding: 20px;
            background-color: #ffffff;
          }
          .container {
            width: 100%;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Header Section -->
        <header class="header-section">
          <div class="logo-area">
            <!-- Sleek SVG hoist crane logo -->
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 30H30" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M9 30L14 6H17L22 30" stroke="#0F172A" stroke-width="2" stroke-linejoin="round"/>
              <path d="M11 20H20" stroke="#0F172A" stroke-width="1.5"/>
              <path d="M14.5 6L32 6" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M29 6V15L27 13" stroke="#D97706" stroke-width="1.5" stroke-linejoin="round"/>
              <circle cx="29" cy="17" r="1.5" fill="#4F46E5"/>
            </svg>
            <span class="logo-text">Huur<span class="logo-accent">Go</span></span>
          </div>
          
          <div class="issuer-info">
            <div class="issuer-name">${escapeHtml(businessInfo?.companyLegalName || "HuurGo B.V.")}</div>
            <div>${escapeHtml(businessInfo?.companyAddress || "Produktieweg 20, 2382 PB Zoeterwoude")}</div>
            <div>E: ${escapeHtml(businessInfo?.contactEmail || "info@mbhoogwerkers.com")} | T: ${escapeHtml(businessInfo?.contactPhone || "071 542 8114")}</div>
            <div>KvK-nummer: ${escapeHtml(businessInfo?.kvkNumber || "67438237")} | BTW-nummer: ${escapeHtml(businessInfo?.btwNumber || "NL856990656B01")}</div>
          </div>
        </header>
        
        <!-- Document Title -->
        <div class="doc-title-container">
          <h1 class="doc-type-label">${documentTitle}</h1>
          <span class="doc-number">${invoiceNumber}</span>
        </div>
        
        <!-- Parties Block -->
        <div class="parties-grid">
          <!-- Client details -->
          <div class="party-box">
            <h3 class="party-title">Huurder / Klant</h3>
            <div class="party-detail">
              <strong>${escCustomerName}</strong><br/>
              ${primaryOrder.customerProfile === 'Particulier' ? '' : `<span>Bedrijf: ${escCustomerCompany}</span><br/>`}
              <span>Vakgebied: ${escCustomerProfile}</span><br/>
              <span>Telefoon: ${escCustomerPhone}</span><br/>
              <span>E-mail: ${escCustomerEmail}</span>
            </div>
          </div>
          
          <!-- Delivery/Logistics details -->
          <div class="party-box">
            <h3 class="party-title">Aflevering & Logistiek</h3>
            <div class="party-detail">
              <strong>${primaryOrder.deliveryType === 'self_pickup' ? 'Afhalen' : 'Adreslevering'}</strong><br/>
              <span>${logisticsText}</span><br/>
              ${primaryOrder.deliveryAddress ? `<span style="font-family: monospace; font-size:11px; display:inline-block; margin-top:5px; color:#475569;">${escDeliveryAddress}</span>` : '<span>Afhaallocatie: Produktieweg 20, 2382 PB Zoeterwoude</span>'}
            </div>
          </div>
        </div>
        
        <!-- Metadata Strip -->
        <div class="meta-strip">
          <div>
            <div class="meta-item-label">Boekingsdatum</div>
            <div class="meta-item-value">${new Date(primaryOrder.createdAt).toLocaleDateString("nl-NL")}</div>
          </div>
          <div>
            <div class="meta-item-label">Huurduur (Max)</div>
            <div class="meta-item-value">${maxRentalDays} dag(en)</div>
          </div>
          <div>
            <div class="meta-item-label">Betalingsstatus</div>
            <div class="meta-item-value" style="color: ${paymentStatusColor};">${paymentStatusLabel}</div>
          </div>
          <div>
            <div class="meta-item-label">Vervaldatum</div>
            <div class="meta-item-value">${dueDateStr}</div>
          </div>
        </div>
        
        <!-- Pricing Table -->
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Omschrijving Verhuurd Materieel & Diensten</th>
              <th style="text-align: right; width: 120px;">Dagtarief / Stukprijs</th>
              <th style="text-align: center; width: 80px;">Aantal</th>
              <th style="text-align: right; width: 140px;">Totaal (Excl. BTW)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
        
        <!-- Totals Summary -->
        <div class="totals-container">
          <div class="totals-box">
            <div class="totals-row">
              <span>Subtotaal (Excl. BTW)</span>
              <span style="font-family: monospace;">€${subtotalExclVat.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>BTW Belasting (21%)</span>
              <span style="font-family: monospace;">€${totalVat.toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Eindtotaal (Incl. BTW)</span>
              <span class="total-amount">€${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Safety Banner Compliance -->
        <div class="compliance-banner">
          <span class="compliance-badge">BMWT Gecertificeerd</span>
          <div class="compliance-text">
            <strong>Veiligheidscertificering NEN-EN 280:</strong> Dit leidende verhuurobject voldoet aan de strengste Europese veiligheidsvoorwaarden. De periodieke keuring is verricht onder toezicht van de BMWT keuringsinstantie.
          </div>
        </div>
        
        ${isProforma ? `
        <!-- Proforma notice -->
        <div style="background: #fffbeb; border: 1px dashed #fbbf24; border-radius: 12px; padding: 16px 20px; margin-bottom: 35px; font-size: 11px; color: #92400e; line-height: 1.6;">
          <strong style="display: block; margin-bottom: 4px; font-size: 12px;">⚠️ Dit is een pro-forma offerte — geen officiële factuur</strong>
          Betaling vindt plaats na ontvangst van een iDEAL-betaallink via WhatsApp. Zodra de betaling is ontvangen, maakt MB Hoogwerkers een officiële factuur op en stuurt deze per e-mail toe.
        </div>
        ` : ''}

        <!-- Footer Terms -->
        <footer class="footer-terms">
          <p>Op alle huurovereenkomsten zijn de algemene <span class="footer-highlight">BMWT-verhuurvoorwaarden 2026</span> van toepassing.</p>
          ${isProforma
            ? `<p>Betaling via WhatsApp — u ontvangt een Tikkie of Mollie iDEAL-betaallink. Na betaling is uw boeking definitief bevestigd.</p>`
            : `<p>Betalingswijze: Voldaan via iDEAL / Tikkie betaallink. Factuurkenmerk: ${primaryOrder.invoiceNumber || primaryOrder.id}</p>`
          }
          <p style="margin-top: 8px;">Dank u voor uw vertrouwen in de hoogste en veiligste kwaliteit van <strong>MB Hoogwerkers</strong>.</p>
        </footer>
        
      </div>
      
      <!-- print triggered from opener -->
    </body>
    </html>
  `;

  // Convert English decimal amounts to Dutch locale format (e.g. €1234.56 → € 1.234,56)
  const htmlContentNL = htmlContent.replace(
    /€(\d+\.\d{2})/g,
    (_, n) => `€ ${parseFloat(n).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContentNL);
    printWindow.document.close();
    printWindow.focus();
    // Trigger print after fonts & layout settle; 900ms covers Google Fonts load
    setTimeout(() => {
      printWindow.print();
    }, 900);
  } else {
    alert("Popup-blocker actief! Gelieve pop-ups toe te staan voor deze website om de PDF factuur te kunnen genereren.");
  }
}

