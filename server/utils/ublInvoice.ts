/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Builds a UBL 2.1 Invoice XML document for a single HuurGo order — the
 * standard Dutch/EU e-invoice format that Exact Online (and most other
 * accounting packages) can import directly as a purchase invoice on the
 * customer's side. This is the "Stage 1" Exact integration: no OAuth/API
 * connection to Exact required, the admin just downloads the file and the
 * customer imports it into their own bookkeeping. See CLAUDE.md for the
 * planned "Stage 2" (direct Exact REST API push).
 */

export interface UblCompanyDetails {
  legalName: string;
  address: string;
  kvkNumber: string;
  btwNumber: string;
  email: string;
  phone: string;
}

export interface UblAddon {
  name: string;
  price: number;
  billing: "daily" | "flat" | "weekly";
}

export interface UblOrderInput {
  id: string;
  invoiceNumber: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  poNumber: string | null;
  machineName: string;
  machinePrice: number;
  startDate: Date;
  endDate: Date;
  rentalDays: number;
  subtotal: number;
  transportCost: number;
  driverCost: number;
  vatAmount: number;
  totalAmount: number;
  createdAt: Date;
  addons: UblAddon[];
}

const VAT_PERCENT = 21;

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const isoDate = (d: Date): string => d.toISOString().split("T")[0];
const amount = (n: number): string => n.toFixed(2);

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

interface Line {
  description: string;
  name: string;
  quantity: number;
  unitCode: "DAY" | "C62"; // C62 = "one" (UN/ECE unit code for a piece/unit)
  lineExtensionAmount: number;
  priceAmount: number;
}

function buildInvoiceLineXml(line: Line, index: number): string {
  return `  <cac:InvoiceLine>
    <cbc:ID>${index}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${line.unitCode}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${amount(line.lineExtensionAmount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${esc(line.description)}</cbc:Description>
      <cbc:Name>${esc(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${VAT_PERCENT}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${amount(line.priceAmount)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
}

export function buildUblInvoiceXml(order: UblOrderInput, company: UblCompanyDetails): string {
  const invoiceId = order.invoiceNumber || order.id;
  const issueDate = order.createdAt;
  const dueDate = addDays(issueDate, 14);

  const addonsTotal = order.addons.reduce((sum, a) => sum + a.price, 0);
  const subtotalExclVat = order.subtotal + order.transportCost + order.driverCost + addonsTotal;

  const lines: Line[] = [
    {
      description: `Huurperiode: ${isoDate(order.startDate)} t/m ${isoDate(order.endDate)}`,
      name: order.machineName,
      quantity: order.rentalDays,
      unitCode: "DAY",
      lineExtensionAmount: order.subtotal,
      priceAmount: order.machinePrice
    }
  ];

  order.addons.forEach((a) => {
    const qty = a.billing === "daily" ? order.rentalDays : 1;
    lines.push({
      description: `Extra optie/accessoire (${order.machineName})`,
      name: a.name,
      quantity: qty,
      unitCode: a.billing === "daily" ? "DAY" : "C62",
      lineExtensionAmount: a.price,
      priceAmount: a.price / qty
    });
  });

  if (order.transportCost > 0) {
    lines.push({
      description: "Heen- en teruglevering op locatie",
      name: "Logistieke Transportservice",
      quantity: 1,
      unitCode: "C62",
      lineExtensionAmount: order.transportCost,
      priceAmount: order.transportCost
    });
  }

  if (order.driverCost > 0) {
    lines.push({
      description: "Inclusief instructiebegeleiding op locatie",
      name: "Gecertificeerde BMWT Chauffeursassistentie",
      quantity: 1,
      unitCode: "C62",
      lineExtensionAmount: order.driverCost,
      priceAmount: order.driverCost
    });
  }

  const linesXml = lines.map((l, i) => buildInvoiceLineXml(l, i + 1)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>${esc(invoiceId)}</cbc:ID>
  <cbc:IssueDate>${isoDate(issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${isoDate(dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
${order.poNumber ? `  <cbc:BuyerReference>${esc(order.poNumber)}</cbc:BuyerReference>\n` : ""}  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${esc(company.legalName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(company.address)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(company.btwNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(company.legalName)}</cbc:RegistrationName>
        <cbc:CompanyID>${esc(company.kvkNumber)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${esc(company.email)}</cbc:ElectronicMail>
        <cbc:Telephone>${esc(company.phone)}</cbc:Telephone>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${esc(order.customerName)}</cbc:Name>
      </cac:PartyName>
      ${order.deliveryAddress ? `<cac:PostalAddress>
        <cbc:StreetName>${esc(order.deliveryAddress)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>` : ""}
      <cac:Contact>
        <cbc:ElectronicMail>${esc(order.customerEmail)}</cbc:ElectronicMail>
        ${order.customerPhone ? `<cbc:Telephone>${esc(order.customerPhone)}</cbc:Telephone>` : ""}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${amount(order.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${amount(subtotalExclVat)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${amount(order.vatAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${VAT_PERCENT}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${amount(subtotalExclVat)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${amount(subtotalExclVat)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${amount(order.totalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${amount(order.totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>
`;
}
