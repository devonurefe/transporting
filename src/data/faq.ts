/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for the FAQ. Used both for the visible /veelgestelde-vragen
 * page (FaqSection) and the FAQPage JSON-LD in App.tsx — Google requires the
 * structured data to match the on-page content, so they must share this list.
 */
export interface FaqItem {
  q: string;
  a: string;
}

// Admin-override: wanneer de eigenaar FAQ-items heeft opgeslagen in SiteConfig
// (AdminContent → FAQ) winnen die; anders geldt de hard-coded lijst hieronder.
// FaqSection én de FAQPage JSON-LD in App.tsx moeten dezelfde resolver gebruiken,
// anders wijkt de structured data af van de zichtbare pagina.
export function resolveFaqItems(configItems?: Array<{ q: string; a: string }> | null): FaqItem[] {
  return Array.isArray(configItems) && configItems.length > 0 ? configItems : FAQ_ITEMS;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Kan ik als particulier een hoogwerker huren?",
    a: "Ja, MB Hoogwerkers verhuurt aan particulieren, ZZP'ers en aannemers. Er is geen borg vereist en u kunt direct online reserveren.",
  },
  {
    q: "Wat kost een schaarlift huren per dag?",
    a: "Een schaarlift huren kost v.a. €49 per dag exclusief btw. Het werkweektarief (5 dagen) bedraagt v.a. €185. Prijzen zijn all-in inclusief brandstof of opgeladen accu.",
  },
  {
    q: "Hoe snel wordt de hoogwerker geleverd?",
    a: "Wij bezorgen dezelfde of volgende werkdag binnen 20 km van ons depot in Zoeterwoude. Dit omvat Leiden, Den Haag, Alphen aan den Rijn en omgeving.",
  },
  {
    q: "Is er een borg of aanbetaling vereist?",
    a: "Nee, MB Hoogwerkers werkt volledig zonder borg. U betaalt via iDEAL of Tikkie na bevestiging van uw reservering via WhatsApp.",
  },
  {
    q: "Welke hoogwerkers zijn beschikbaar voor huur?",
    a: "Wij verhuren schaarliften (6–10 m), rupshoogwerkers / spinhoogwerkers (15–17 m), aanhangerhoogwerkers (12–17 m), mastliften, ladderliften / verhuisliften, pecoliften en kamersteigers.",
  },
  {
    q: "Heb ik een rijbewijs of certificaat nodig om een hoogwerker te bedienen?",
    a: "Voor de meeste machines volstaat een korte instructie die wij bij levering geven. Voor professioneel gebruik op bouwplaatsen wordt vaak een geldig IPAF- of VCA-certificaat gevraagd; voor particulier gebruik is dat doorgaans niet nodig. Vraag ons gerust om advies voor uw situatie.",
  },
  {
    q: "Kan ik de hoogwerker zelf ophalen?",
    a: "Ja, zelf ophalen op ons depot in Zoeterwoude is gratis en kan met een geschikte aanhanger of bus. U kunt ook kiezen voor bezorging met onze trailer of volledige levering op locatie.",
  },
  {
    q: "Past een hoogwerker door een smalle poort of doorgang?",
    a: "Onze rups- en spinhoogwerkers zijn vanaf circa 80 cm breed en passen door de meeste tuinpoorten en doorgangen. Twijfelt u over de doorgang? Stuur ons de maten via WhatsApp en wij adviseren de juiste machine.",
  },
  {
    q: "Wat gebeurt er bij slecht weer of een defect?",
    a: "Onze machines worden gecontroleerd en onderhouden afgeleverd. Bij een technisch defect dat niet aan het gebruik ligt, zorgen wij zo snel mogelijk voor een oplossing of vervangend materieel. Werken bij harde wind wordt om veiligheidsredenen afgeraden.",
  },
  {
    q: "Hoe werkt de betaling?",
    a: "Na uw online reservering bevestigt u via WhatsApp, waarna u een iDEAL- of Tikkie-betaallink ontvangt. Zodra de betaling binnen is, staat uw reservering definitief vast — zonder borg.",
  },
];
