/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service-area cities for local SEO landing pages (/hoogwerker-huren/:stad).
 * HuurGo (MB Hoogwerkers) is based in Zoeterwoude and delivers throughout
 * Zuid-Holland. Each city has its own crawlable page with unique copy so
 * Google ranks us for "hoogwerker huren {stad}" searches — the main entry
 * point for local rental traffic that competitors (o.a. Gromax) dominate.
 *
 * Keep copy genuinely distinct per city (no duplicated boilerplate) to avoid
 * thin-content penalties. Distances are road minutes from Zoeterwoude.
 */
export interface ServiceCity {
  slug: string;
  name: string;
  /** Short intro (1–2 sentences) shown under the H1 and used as meta description. */
  intro: string;
  /** Longer body paragraph with local context (neighbourhoods, typical jobs). */
  body: string;
  /** Nearby places/areas we also serve from here (internal context + relevance). */
  nearby: string[];
  /** Approx. road travel time from the Zoeterwoude depot. */
  driveMinutes: number;
}

export const SERVICE_CITIES: ServiceCity[] = [
  {
    slug: "leiden",
    name: "Leiden",
    intro:
      "Hoogwerker huren in Leiden? Wij bezorgen dezelfde of volgende werkdag in heel Leiden en omgeving — zonder borg, all-in geprijsd.",
    body:
      "Of u nu de gevel van een grachtenpand in de binnenstad schildert, dakgoten reinigt in de Merenwijk of een verbouwing doet in Leiden-Zuidwest: wij hebben de juiste machine. Voor smalle straten en poorten in het historische centrum zijn onze rups- en spinhoogwerkers ideaal, omdat ze door een doorgang van 80 cm passen. Ons depot in Zoeterwoude ligt op een steenworp afstand, dus bezorging is snel en goedkoop.",
    nearby: ["Leiderdorp", "Oegstgeest", "Voorschoten", "Zoeterwoude"],
    driveMinutes: 10,
  },
  {
    slug: "den-haag",
    name: "Den Haag",
    intro:
      "Hoogwerker huren in Den Haag voor schilder-, onderhouds- of bouwklussen. Snelle bezorging in de hele regio Haaglanden, geen borg vereist.",
    body:
      "Van portiekwoningen in de Schilderswijk tot herenhuizen in Benoordenhout en bedrijfspanden op de Binckhorst — voor elk project op hoogte leveren wij de passende hoogwerker. Werkt u binnen, dan adviseren wij een elektrische schaarlift of een smalle mastlift zonder uitstoot. Voor hoge gevels zijn onze aanhanger- en knikhoogwerkers tot 17 meter de juiste keuze.",
    nearby: ["Rijswijk", "Voorburg", "Leidschendam", "Wassenaar"],
    driveMinutes: 25,
  },
  {
    slug: "alphen-aan-den-rijn",
    name: "Alphen aan den Rijn",
    intro:
      "Hoogwerker huren in Alphen aan den Rijn? Direct online reserveren en snel geleverd in het Groene Hart, zonder borg.",
    body:
      "Aannemers, hoveniers en particulieren in Alphen aan den Rijn vertrouwen op onze vloot voor klussen op hoogte. Voor boomverzorging en tuinonderhoud in wijken als Kerk en Zanen of Ridderveld zijn onze rupshoogwerkers met rupsbanden ideaal: ze rijden over gras zonder schade. Voor bouw en onderhoud leveren wij schaarliften en aanhangerhoogwerkers op locatie.",
    nearby: ["Boskoop", "Hazerswoude", "Koudekerk aan den Rijn", "Bodegraven"],
    driveMinutes: 20,
  },
  {
    slug: "zoetermeer",
    name: "Zoetermeer",
    intro:
      "Hoogwerker huren in Zoetermeer voor bedrijf of particulier. All-in tarieven, snelle bezorging, en altijd persoonlijk advies.",
    body:
      "Zoetermeer kent veel grootschalige bouw en bedrijventerreinen zoals Lansinghage en Zoeterhage, waar onze diesel- en hybride hoogwerkers tot 17 meter uitkomst bieden. In woonwijken als Rokkeveen en Oosterheem leveren wij compacte schaarliften en mastliften die geruisloos en zonder uitstoot binnen werken.",
    nearby: ["Benthuizen", "Pijnacker", "Berkel en Rodenrijs", "Den Haag"],
    driveMinutes: 25,
  },
  {
    slug: "leiderdorp",
    name: "Leiderdorp",
    intro:
      "Hoogwerker huren in Leiderdorp? Ons depot ligt om de hoek — dezelfde dag geleverd, zonder borg en all-in geprijsd.",
    body:
      "Leiderdorp ligt direct naast ons depot in Zoeterwoude, dus u bent verzekerd van de snelste bezorging en de laagste transportkosten. Voor onderhoud aan woningen in de Vogelwijk of bedrijfspanden langs de A4 hebben wij schaarliften, mastliften en aanhangerhoogwerkers direct beschikbaar.",
    nearby: ["Leiden", "Zoeterwoude", "Hoogmade", "Koudekerk aan den Rijn"],
    driveMinutes: 8,
  },
  {
    slug: "voorschoten",
    name: "Voorschoten",
    intro:
      "Hoogwerker huren in Voorschoten voor schilder-, snoei- of onderhoudswerk. Snel geleverd, zonder borg, met eerlijk advies.",
    body:
      "In het groene Voorschoten draait veel werk om tuinonderhoud, boomverzorging en gevelschilderwerk aan vrijstaande woningen. Onze rups- en spinhoogwerkers rijden zachtjes over gazons en bereiken lastige plekken achter de woning, terwijl onze schaarliften ideaal zijn voor strak en veilig schilderwerk.",
    nearby: ["Wassenaar", "Leidschendam", "Leiden", "Den Haag"],
    driveMinutes: 18,
  },
  {
    slug: "katwijk",
    name: "Katwijk",
    intro:
      "Hoogwerker huren in Katwijk en omgeving. Bestand tegen kustwind en zout — onze machines worden snel en zonder borg geleverd.",
    body:
      "Aan de kust in Katwijk, Rijnsburg en Valkenburg zijn gevels extra gevoelig voor weer en wind, waardoor regelmatig onderhoud nodig is. Wij leveren robuuste schaarliften en aanhangerhoogwerkers voor schilder- en reinigingswerk, ook op de hogere appartementencomplexen langs de boulevard.",
    nearby: ["Rijnsburg", "Valkenburg", "Noordwijk", "Oegstgeest"],
    driveMinutes: 20,
  },
  {
    slug: "delft",
    name: "Delft",
    intro:
      "Hoogwerker huren in Delft voor de binnenstad of bedrijventerrein. Compact materieel voor smalle straten, zonder borg.",
    body:
      "De historische binnenstad van Delft vraagt om wendbaar materieel: onze spinhoogwerkers passen door smalle stegen en poorten en zetten zich stabiel op met steunpoten. Voor de campus en bedrijventerreinen rond de TU Delft leveren wij grotere schaar- en knikhoogwerkers voor industrieel onderhoud.",
    nearby: ["Rijswijk", "Den Hoorn", "Pijnacker", "Schipluiden"],
    driveMinutes: 30,
  },
  {
    slug: "gouda",
    name: "Gouda",
    intro:
      "Hoogwerker huren in Gouda en het Groene Hart. Snelle bezorging, all-in tarieven en geen borg vereist.",
    body:
      "Voor onderhoud aan de karakteristieke panden rond de Markt en de Sint-Janskerk in Gouda zijn onze compacte hoogwerkers de veilige keuze. Op de bedrijventerreinen Goudse Poort en Gouwepark leveren wij grotere diesel- en hybride machines voor bouw en industrieel onderhoud.",
    nearby: ["Waddinxveen", "Reeuwijk", "Bodegraven", "Moordrecht"],
    driveMinutes: 30,
  },
  {
    slug: "wassenaar",
    name: "Wassenaar",
    intro:
      "Hoogwerker huren in Wassenaar voor villa-onderhoud, boomverzorging en schilderwerk. Zorgvuldig, snel en zonder borg.",
    body:
      "Wassenaar staat bekend om royale villa's met grote tuinen en hoge gevels. Onze rupshoogwerkers tot 17 meter bereiken moeiteloos hoge daklijnen en bomen, terwijl ze met lage bodemdruk het gazon ontzien. Voor strak schilderwerk leveren wij daarnaast stabiele schaarliften.",
    nearby: ["Voorschoten", "Den Haag", "Leidschendam", "Katwijk"],
    driveMinutes: 22,
  },
];

export function getCityBySlug(slug: string): ServiceCity | undefined {
  return SERVICE_CITIES.find((c) => c.slug === slug);
}
