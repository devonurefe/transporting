/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Kenniscentrum seed content — the initial set of articles and guides.
 *
 * The Kenniscentrum is admin-managed: the live content lives in the BlogPost
 * table and is edited via AdminBlog. This file is ONLY the seed source used by
 * prisma/seed.ts to create the starter posts on a fresh database (with the same
 * "never overwrite admin edits" upsert pattern as the machine/category seed).
 * The frontend reads from /api/blog-posts, not from this array.
 *
 * Two content types:
 *  - "artikel"      — SEO blog articles that answer real Google searches and
 *                     link back to the catalog/booking flow.
 *  - "handleiding"  — product guides / how-it-works, meant to be shared with a
 *                     customer (clickable, sendable link) before or during a rental.
 *
 * `content` is lightweight Markdown: `## Heading`, blank-line-separated
 * paragraphs, `- ` bullet lines and `**bold**` inline. The public renderer
 * (BlogArticlePage) and the admin editor both use this format — keep it simple.
 *
 * Quality over quantity: every post is hand-written, specific to our own fleet
 * and service area, and answers a real intent. Thin, duplicated or keyword-
 * stuffed filler triggers Google's Helpful Content penalties — the reason bulk
 * AI blog spam gets buried. Don't pad the list to hit a number.
 */

export interface BlogSeed {
  slug: string;
  type: "artikel" | "handleiding";
  title: string;
  /** Meta description + card excerpt (≤ ~160 chars). */
  excerpt: string;
  /** Short chip label (e.g. "Keuzehulp", "Kosten", "Handleiding"). */
  category: string;
  /** Lightweight Markdown body — see format note above. */
  content: string;
}

export const BLOG_SEED: BlogSeed[] = [
  {
    slug: "welke-hoogwerker-huren",
    type: "artikel",
    title: "Welke hoogwerker heb ik nodig? De types op een rij",
    excerpt:
      "Schaarlift, spinhoogwerker, mastlift of aanhangerhoogwerker? Ontdek in deze keuzehulp welk type hoogwerker past bij uw werkhoogte, ondergrond en klus.",
    category: "Keuzehulp",
    content: `De juiste hoogwerker huren begint bij één vraag: wat gaat u precies doen, en waar? Werkhoogte, de ondergrond en de ruimte om te manoeuvreren bepalen samen welk type machine het veiligst en voordeligst is. In deze gids zetten we de vier meestgehuurde types naast elkaar.

## Begin bij de werkhoogte, niet bij de machine

Verhuurbedrijven noemen altijd de werkhoogte: de hoogte die u met uitgestrekte armen bereikt vanuit de bak. Reken grofweg met uw eigen reikhoogte van 2 meter erbovenop. Wilt u een dakgoot op 8 meter reinigen, dan volstaat een machine met circa 8 meter werkhoogte — u hoeft niet de volle platformhoogte te huren.

Onderschat de hoogte niet, maar overdrijf ook niet: een grotere machine is zwaarder, breder en duurder, terwijl een te kleine machine u dwingt gevaarlijk ver te reiken. Twijfelt u tussen twee maten, kies dan de machine die u rechtop en met beide voeten in de bak laat werken.

## De vier types en waar ze in uitblinken

Elk type hoogwerker is gebouwd voor een ander soort werk:

- **Schaarlift** — recht omhoog, groot en stabiel platform. Ideaal voor binnenwerk, montage en schilderwerk op een vlakke, harde ondergrond. Elektrische modellen werken geruisloos en zonder uitstoot binnen.
- **Spin- of rupshoogwerker** — smal (vanaf ± 80 cm), rijdt over gras en klinkers en reikt tot 15–17 meter. De keuze voor boomverzorging, tuinen en moeilijk bereikbare gevels achter het huis.
- **Aanhangerhoogwerker** — u trekt hem zelf achter de auto en zet hem op steunpoten. Praktisch en betaalbaar voor gevel-, schilder- en onderhoudswerk tot ± 17 meter op een stevige ondergrond.
- **Mastlift** — compact en licht, voor snel en veilig werk op matige hoogte binnen. Perfect voor installateurs, elektriciens en winkelinrichting.

## Let op de ondergrond en de doorgang

De mooiste machine is nutteloos als u er niet komt. Meet de smalste doorgang naar de werkplek: een tuinpoort van 80 cm laat wél een spinhoogwerker door, maar geen schaarlift. Werkt u op gras of een net aangelegde tuin, kies dan een rupsmachine met lage bodemdruk die geen sporen trekt.

Binnen speelt het gewicht op de vloer en de uitstoot een rol — daar horen elektrische schaar- en mastliften thuis. Weet u het niet zeker? Stuur ons de maten en een foto via WhatsApp, dan adviseren wij de juiste machine.

## Veelgestelde vragen

**Wat is het verschil tussen platformhoogte en werkhoogte?**
De platformhoogte is de hoogte van de vloer van de bak; de werkhoogte is wat u met uitgestrekte armen bereikt, ongeveer 2 meter hoger. Deze gids gebruikt de werkhoogte.

**Welke hoogwerker is het beste voor binnenwerk?**
Voor binnenwerk kiest u een elektrische schaarlift of een compacte mastlift: beide werken geruisloos en zonder uitstoot en belasten de vloer gelijkmatig.`,
  },
  {
    slug: "wat-kost-een-hoogwerker-huren",
    type: "artikel",
    title: "Wat kost een hoogwerker huren? Prijzen per dag, week en maand",
    excerpt:
      "Wat kost een hoogwerker huren? Bekijk de richtprijzen per dag, week en maand, plus de bijkomende kosten voor bezorging en trailer — zonder borg.",
    category: "Kosten",
    content: `De huurprijs van een hoogwerker hangt af van het type, de werkhoogte en de huurduur — en van slimme keuzes rond bezorging. Hieronder ziet u waar u op moet letten, zodat u vooraf precies weet wat u betaalt.

## Richtprijzen: dag, weekend, werkweek en maand

Een compacte schaarlift huurt u bij huurgo al vanaf circa €49 per dag (excl. btw). Grotere rups- en aanhangerhoogwerkers liggen hoger, afhankelijk van de werkhoogte. Hoe langer u huurt, hoe voordeliger de dagprijs.

- **1 dag** — scherpste losse tarief, ideaal voor een korte klus.
- **Weekend** — vaste weekendprijs voor werk dat binnen zaterdag en zondag valt.
- **Werkweek (5 dagen)** — de populairste keuze, met een duidelijk lagere dagprijs.
- **Maand** — het voordeligst per dag, voor langlopende projecten.

Onze prijzen zijn all-in: de brandstof of een volledig opgeladen accu zit erbij in.

## Bijkomende kosten: bezorging en trailer

Er zijn drie manieren om de machine op locatie te krijgen. Zelf ophalen op ons depot in Zoeterwoude is gratis. Huurt u onze trailer, dan rekenen we €25 per dag. Volledige bezorging op locatie door onze chauffeur kost €150 vast, ongeacht de afstand binnen ons werkgebied.

Voor een korte klus dicht bij huis is zelf ophalen vaak het voordeligst; voor een zware machine of een adres verderop weegt de bezorging al snel op tegen het gedoe van zelf rijden.

## Geen borg, geen aanbetaling

Anders dan bij veel verhuurders werkt huurgo volledig zonder borg. Na uw online reservering bevestigt u via WhatsApp en ontvangt u een iDEAL- of Tikkie-betaallink; zodra die betaling binnen is, staat uw reservering vast.

Wilt u een exacte prijs voor uw situatie? Kies uw machine en data in de catalogus — de prijs verschijnt direct, inclusief het juiste dag-, week- of maandtarief.

## Veelgestelde vragen

**Wat kost een schaarlift huren per dag?**
Een schaarlift huren kost bij huurgo vanaf circa €49 per dag exclusief btw. Het werkweektarief (5 dagen) is per dag aanzienlijk voordeliger.

**Moet ik borg betalen om een hoogwerker te huren?**
Nee, huurgo werkt volledig zonder borg. U betaalt de huur via iDEAL of Tikkie na bevestiging van uw reservering.`,
  },
  {
    slug: "schaarlift-of-hoogwerker",
    type: "artikel",
    title: "Schaarlift of telescoophoogwerker: wat kies je?",
    excerpt:
      "Schaarlift of telescoop-/knikhoogwerker huren? Vergelijk bereik, ondergrond en prijs, en ontdek welke machine past bij binnenwerk, gevels of tuinen.",
    category: "Vergelijking",
    content: `Twee van de meestgevraagde machines lijken op afstand inwisselbaar, maar zijn dat allerminst. Een schaarlift gaat recht omhoog; een telescoop- of knikhoogwerker reikt ook opzij en over obstakels heen. Die ene eigenschap bepaalt vaak welke van de twee uw klus vlot en veilig klaart.

## Recht omhoog versus opzij reiken

Een schaarlift beweegt alleen verticaal: het platform schuift recht boven het onderstel omhoog. Dat maakt hem stabiel en geeft een ruime, rechthoekige bak. Ideaal wanneer u er recht onder kunt staan, zoals bij plafonds, magazijnstellingen en vlakke gevels.

Een telescoop- of knikhoogwerker (waaronder onze spin- en aanhangerhoogwerkers) heeft een giek die uitschuift én kan knikken. Zo reikt u over een schuur, een haag of een geparkeerde auto heen naar een punt dat u recht van onderen nooit zou bereiken. Dat bereik opzij — de 'outreach' — is precies waar een schaarlift tekortschiet.

## Ondergrond en toegang

Schaarliften werken het best op een vlakke, verharde en draagkrachtige ondergrond; de meeste elektrische modellen zijn bedoeld voor binnen of een nette buitenvloer. Onze rups- en spinhoogwerkers rijden juist over gras, grind en klinkers en passen door een doorgang vanaf circa 80 cm.

## Kort samengevat

- Kies een **schaarlift** bij vlak binnen- of gevelwerk waar u er recht onder kunt, op een harde ondergrond.
- Kies een **spin-, rups- of aanhangerhoogwerker** als u opzij of over obstakels moet reiken, hoger dan ± 10 meter wilt, of op gras/klinkers werkt.
- Twijfelt u? Onze keuzehulp en ons WhatsApp-advies wijzen u snel de juiste kant op.

## Veelgestelde vragen

**Kan een schaarlift over een obstakel heen reiken?**
Nee, een schaarlift gaat alleen recht omhoog. Moet u over een schuur, haag of auto heen reiken, kies dan een telescoop-, knik- of spinhoogwerker met giek.

**Welke machine is geschikt voor werk in de tuin?**
Voor tuinen kiest u een rups- of spinhoogwerker: die rijdt over gras zonder sporen te trekken en past door een smalle poort vanaf circa 80 cm.`,
  },
  {
    slug: "hoogwerker-huren-zonder-borg",
    type: "artikel",
    title: "Hoogwerker huren zonder borg: zo werkt het",
    excerpt:
      "Hoogwerker huren zonder borg en zonder aanbetaling? Ontdek hoe reserveren, betalen via iDEAL en bezorging bij huurgo werken — in een paar simpele stappen.",
    category: "Zo werkt het",
    content: `Veel verhuurders vragen een borg van honderden euro's die u weken later pas terugkrijgt. Bij huurgo hoeft dat niet: u huurt volledig zonder borg en zonder aanbetaling. In deze korte gids leest u hoe het reserveren, betalen en leveren precies verloopt.

## Waarom zonder borg?

Een borg is voor de verhuurder een zekerheid, maar voor u een last: uw geld staat vast en de afhandeling kost tijd. Doordat elke machine verzekerd, gecontroleerd en geregistreerd de deur uitgaat, kunnen wij zonder borg werken — en houdt u uw budget vrij voor de klus zelf.

## In vier stappen geregeld

- **1. Kies uw machine en data** in de catalogus. De prijs verschijnt direct, inclusief het juiste dag-, week- of maandtarief.
- **2. Reserveer online** — geen aanbetaling, geen borg.
- **3. Bevestig via WhatsApp** en ontvang een iDEAL- of Tikkie-betaallink voor het huurbedrag.
- **4. Kies zelf ophalen of bezorging;** wij leveren vaak nog dezelfde of de volgende werkdag.

## Betalen en bevestigen

U betaalt uitsluitend het afgesproken huurbedrag, veilig via iDEAL of Tikkie. Zodra de betaling binnen is, staat uw reservering definitief vast en stemmen we het aflever- of ophaalmoment met u af. Geen kleine lettertjes, geen geblokkeerd bedrag op uw rekening.

Heeft u vooraf een vraag over de machinekeuze of de levering? Stuur ons gerust een bericht via WhatsApp — we denken vrijblijvend met u mee voordat u boekt.

## Veelgestelde vragen

**Is een hoogwerker huren zonder borg echt mogelijk?**
Ja. Bij huurgo huurt u volledig zonder borg en zonder aanbetaling. U betaalt alleen het huurbedrag via iDEAL of Tikkie na uw reservering.

**Wanneer staat mijn reservering vast?**
Zodra uw betaling via de iDEAL- of Tikkie-link binnen is, is de reservering definitief en spreken we het aflever- of ophaalmoment met u af.`,
  },
  {
    slug: "veilig-werken-met-een-hoogwerker",
    type: "handleiding",
    title: "Veilig werken met een hoogwerker: praktische handleiding",
    excerpt:
      "Veilig werken op hoogte? Deze handleiding zet de belangrijkste tips en regels op een rij: harnas, windkracht, ondergrond, IPAF/VCA en de check vóór u omhoog gaat.",
    category: "Handleiding",
    content: `Werken op hoogte gaat goed zolang u een paar basisregels respecteert. Een hoogwerker is een veilig gereedschap, maar alleen als de machine goed staat, het weer meewerkt en u de juiste bescherming draagt. Deze checklist helpt u ongelukken te voorkomen — stuur hem gerust door naar iedereen die met de machine gaat werken.

## Vóór u omhoog gaat: de opstelling

De meeste incidenten ontstaan niet in de lucht, maar bij het opstellen. Zet de machine op een vlakke, draagkrachtige ondergrond en gebruik de steunpoten (stempels) volgens de handleiding. Controleer of er geen putdeksels, kabelgoten of zachte bermen onder de steunpunten zitten.

Kijk ook omhoog: hoogspanningslijnen, dakranden en luifels vormen een reëel gevaar. Houd de voorgeschreven afstand tot elektriciteitsleidingen aan en plan uw bewegingen voordat u de bak instapt.

## Bescherming en gedrag in de bak

Draag in een telescoop-, knik- of spinhoogwerker altijd een harnas met een korte vanglijn, aangelijnd aan het daarvoor bestemde punt in de bak. Blijf met beide voeten op de vloer van het platform — nooit op de railing klimmen om net iets verder te reiken.

- Draag een goedgekeurd harnas en lijn aan in gieklift-machines.
- Blijf binnen de bak; gebruik geen ladder of opstapje in de bak.
- Respecteer het maximale gewicht (personen + gereedschap).
- Werk niet bij windkracht boven de door de fabrikant opgegeven grens — vaak rond 12,5 m/s (windkracht 6). Bij twijfel: naar beneden.

## Certificaat, instructie en keuring

Voor particulier gebruik volstaat meestal de korte instructie die wij bij levering geven. Op professionele bouwplaatsen wordt vaak een geldig IPAF- of VCA-certificaat gevraagd; controleer de eisen van uw opdrachtgever vóór aanvang. Onze machines zijn TÜV-gekeurd en worden onderhouden en gecontroleerd afgeleverd.

Merkt u tijdens het werk iets ongewoons — een storing, een lekkage of een instabiel gevoel? Kom naar beneden en neem contact met ons op. Veiligheid gaat altijd vóór de planning.

## Veelgestelde vragen

**Heb ik een certificaat nodig om een hoogwerker te bedienen?**
Voor particulier gebruik is meestal geen certificaat nodig; wij geven een korte instructie bij levering. Op professionele bouwplaatsen wordt vaak een geldig IPAF- of VCA-certificaat gevraagd.

**Bij welke windkracht mag ik niet meer werken?**
Houd de grens van de fabrikant aan, vaak rond 12,5 m/s (windkracht 6). Bij twijfel of toenemende wind gaat u naar beneden.`,
  },
];
