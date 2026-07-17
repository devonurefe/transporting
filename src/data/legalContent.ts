/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Standaard juridische teksten (privacybeleid + algemene voorwaarden). Dit is
// de CODE-fallback, in lijn met het `siteConfig.x ?? codeDefault`-patroon
// elders in de app: zolang de admin geen eigen tekst opslaat via AdminContent
// → Juridisch (SiteConfig.privacyPolicy / termsConditions blijft null), tonen
// zowel de publieke /privacy- en /voorwaarden-pagina's als het admin-tekstvak
// deze versie. Zodra de admin opslaat, wint de DB-waarde.
//
// Formaat = de lichte markdown die MarkdownBody.tsx ondersteunt: `## kop`,
// alinea's gescheiden door een lege regel, `- ` opsommingen en **vet**. Geen
// `###`, tabellen of links-als-markup (e-mailadressen renderen als platte tekst).
//
// LET OP: dit is een degelijke, op de codebase afgestemde starttekst — laat 'm
// vóór livegang juridisch controleren en pas processors/bewaartermijnen aan waar
// de praktijk afwijkt.

export const DEFAULT_PRIVACY_POLICY = `MB Hoogwerkers B.V. ("HuurGo", "wij", "ons") respecteert uw privacy en verwerkt uw persoonsgegevens uitsluitend in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG). In dit privacybeleid leggen we uit welke gegevens we verzamelen, waarom, hoe lang we ze bewaren en welke rechten u heeft.

**Laatst bijgewerkt:** 17 juli 2026

## Verwerkingsverantwoordelijke

MB Hoogwerkers B.V., handelend onder de naam HuurGo, is de verwerkingsverantwoordelijke voor de verwerking van uw persoonsgegevens.

- **Bedrijf:** MB Hoogwerkers B.V.
- **Adres:** Produktieweg 20, 2382 PB Zoeterwoude
- **KvK-nummer:** 67438237
- **BTW-nummer:** NL856990656B01
- **E-mail:** info@huurgo.nl
- **Website:** huurgo.nl

## Welke gegevens wij verwerken

Afhankelijk van uw gebruik van de website verwerken wij de volgende persoonsgegevens:

- **Contact- en boekingsgegevens:** naam, e-mailadres, telefoonnummer, bedrijfsnaam en (indien van toepassing) uw beroeps- of klantprofiel.
- **Aflever- en huurgegevens:** bezorg- of afhaaladres, gekozen machine(s), huurperiode, transportkeuze en eventuele extra opties.
- **Accountgegevens:** als u een klantaccount aanmaakt, uw inloggegevens (uw wachtwoord wordt uitsluitend versleuteld/gehasht opgeslagen, wij zien het nooit) en uw voorkeuren.
- **Facturatiegegevens:** de gegevens die nodig zijn om een geldige factuur op te stellen conform de fiscale bewaarplicht.
- **Beoordelingen:** een eventuele beoordeling en toelichting die u na afloop van een huur achterlaat.
- **Technische gegevens:** IP-adres en algemene gebruiksstatistieken, uitsluitend voor beveiliging en, met uw toestemming, voor analyse.

## Doeleinden en grondslagen

Wij verwerken uw gegevens alleen voor duidelijk omschreven doelen, telkens op basis van een wettelijke grondslag uit de AVG:

- **Uitvoering van de huurovereenkomst** (grondslag: uitvoering overeenkomst): het verwerken en bevestigen van uw boeking, het plannen van transport of afhalen, en communicatie hierover.
- **Facturatie en administratie** (grondslag: wettelijke verplichting): het opstellen en bewaren van facturen conform de Nederlandse belastingwetgeving.
- **Klantenservice en accountbeheer** (grondslag: uitvoering overeenkomst / gerechtvaardigd belang): het beantwoorden van vragen en het beheren van uw account.
- **Beveiliging en fraudepreventie** (grondslag: gerechtvaardigd belang): het beveiligen van de website en het voorkomen van misbruik.
- **Analyse en verbetering van de website** (grondslag: toestemming): uitsluitend wanneer u hiervoor via de cookiebanner toestemming geeft.

## Betaling

Betalingen verlopen via een betaallink (zoals iDEAL of Tikkie) die wij u na uw boeking toesturen. Wij verwerken en bewaren zelf **geen** creditcard- of volledige rekeninggegevens; de afhandeling loopt via de betaaldienstverlener die de link aanbiedt.

## Delen met derden

Wij verkopen uw gegevens nooit. Wij schakelen wel zorgvuldig geselecteerde verwerkers in die ons helpen de dienst te leveren, uitsluitend voor de hierboven genoemde doelen en onder een verwerkersovereenkomst:

- **Hosting:** onze website en database draaien op een server binnen de Europese Unie (Nederland).
- **E-mail:** voor het versturen van bevestigingen, statusupdates en herinneringen gebruiken wij een externe e-maildienst.
- **Analyse:** uitsluitend met uw toestemming maken wij gebruik van een statistiekdienst om het gebruik van de website te meten.

Daarnaast kunnen wij gegevens delen wanneer wij daartoe wettelijk verplicht zijn (bijvoorbeeld aan de Belastingdienst of bevoegde autoriteiten).

## Bewaartermijnen

Wij bewaren uw gegevens niet langer dan noodzakelijk:

- **Facturen en boekingsadministratie:** 7 jaar, conform de wettelijke fiscale bewaarplicht.
- **Accountgegevens:** zolang u een actief account heeft; na een verwijderverzoek worden deze verwijderd, behoudens gegevens die wij wettelijk langer moeten bewaren.
- **Beveiligings- en auditlogs:** maximaal circa 180 dagen.
- **Gegevens van niet-afgeronde of geannuleerde aanvragen:** worden op afzienbare termijn opgeschoond.

## Cookies

Onze website gebruikt functionele cookies die nodig zijn om de site te laten werken (zoals uw sessie en cookievoorkeur). Analytische cookies plaatsen wij uitsluitend nadat u daarvoor via de cookiebanner toestemming heeft gegeven. U kunt uw keuze op elk moment aanpassen of intrekken.

## Beveiliging

Wij nemen passende technische en organisatorische maatregelen om uw gegevens te beschermen, waaronder versleutelde verbindingen (HTTPS), gehashte wachtwoorden, toegangsbeperking tot ons beheerportaal met tweefactorauthenticatie en het bijhouden van een auditlog van beheerhandelingen.

## Uw rechten

Op grond van de AVG heeft u het recht om:

- uw persoonsgegevens **in te zien**;
- onjuiste gegevens te laten **corrigeren**;
- uw gegevens te laten **verwijderen** ("recht op vergetelheid");
- de verwerking te laten **beperken**;
- **bezwaar** te maken tegen verwerking op grond van gerechtvaardigd belang;
- uw gegevens in een gangbaar formaat te ontvangen (**dataportabiliteit**);
- een eenmaal gegeven **toestemming in te trekken**.

Wilt u een van deze rechten uitoefenen? Neem dan contact met ons op via info@huurgo.nl. Wij reageren binnen de wettelijke termijn en kunnen u om aanvullende identificatie vragen om misbruik te voorkomen.

## Klacht indienen

Bent u het niet eens met hoe wij met uw gegevens omgaan, dan kunt u een klacht indienen bij de Autoriteit Persoonsgegevens via autoriteitpersoonsgegevens.nl.

## Wijzigingen

Wij kunnen dit privacybeleid van tijd tot tijd aanpassen, bijvoorbeeld bij wijzigingen in onze dienstverlening of wet- en regelgeving. De actuele versie staat altijd op deze pagina, met bovenaan de datum van de laatste wijziging.

## Contact

Heeft u vragen over dit privacybeleid of over de verwerking van uw persoonsgegevens? Neem gerust contact met ons op:

- **MB Hoogwerkers B.V. (HuurGo)**
- **E-mail:** info@huurgo.nl
- **Adres:** Produktieweg 20, 2382 PB Zoeterwoude`;

export const DEFAULT_TERMS_CONDITIONS = `Deze algemene voorwaarden zijn van toepassing op elke huurovereenkomst die via huurgo.nl tot stand komt tussen u ("huurder") en MB Hoogwerkers B.V., handelend onder de naam HuurGo ("wij", "ons", "verhuurder").

**Laatst bijgewerkt:** 17 juli 2026

## Verhuurder

- **Bedrijf:** MB Hoogwerkers B.V.
- **Adres:** Produktieweg 20, 2382 PB Zoeterwoude
- **KvK-nummer:** 67438237
- **BTW-nummer:** NL856990656B01
- **E-mail:** info@huurgo.nl

## Toepasselijkheid

Deze voorwaarden gelden voor iedere aanvraag, boeking en huurovereenkomst via huurgo.nl, ongeacht of u als particulier, ZZP'er of bedrijf huurt. Door een boeking te plaatsen gaat u akkoord met deze voorwaarden. Afwijkende afspraken gelden alleen als wij deze schriftelijk (e-mail volstaat) hebben bevestigd.

## Totstandkoming van de huurovereenkomst

- U selecteert een machine, kiest een huurperiode en rondt de boeking af via de website.
- De huurovereenkomst komt tot stand zodra u de boeking bevestigt en hiervan een orderbevestiging per e-mail ontvangt.
- Directe onlinebetaling is niet nodig om te boeken; zie "Betaling" hieronder voor hoe de betaling verloopt.

## Prijzen en btw

- Prijzen op de website worden standaard exclusief 21% btw getoond, met een schakelaar om inclusief btw te bekijken. Het bedrag dat u bij het afronden van de boeking ziet, is het definitieve, inclusief btw en eventuele transport- of servicekosten.
- Er wordt **geen borg of aanbetaling** in rekening gebracht.
- Prijzen kunnen door ons worden aangepast; een reeds bevestigde boeking blijft tegen de destijds afgesproken prijs staan.

## Betaling

- Na uw boeking nemen wij per WhatsApp contact met u op om een betaallink (bijvoorbeeld iDEAL of Tikkie) te sturen.
- Wij verwerken en bewaren zelf geen creditcard- of volledige rekeninggegevens; de betaling verloopt via de externe betaaldienst achter de link.
- Uw bestelling krijgt de status "Goedgekeurd" zodra de betaling door ons is ontvangen en bevestigd. Zonder ontvangen betaling kan een boeking niet worden goedgekeurd of uitgeleverd.

## Levering en afhalen

U kiest bij het boeken één van de volgende opties:

- **Zelf afhalen:** kosteloos, op ons depot in Zoeterwoude.
- **Bezorging door ons:** tegen een vaste bezorgvergoeding (zichtbaar vóór het afronden van de boeking), standaard binnen 20 km van ons depot. Buiten dit gebied is bezorging op aanvraag, tegen een offerte op maat.
- **Aanhanger huren:** u haalt de machine zelf op met onze aanhanger, tegen een dagtarief.

Bij bezorging kiest u een gewenst tijdvak (ochtend of middag); wij spannen ons in dit aan te houden, maar dit is geen harde levertijd-garantie.

## Huurperiode en gebruik van de machine

- De huurperiode telt vanaf de afgesproken startdatum tot en met de afgesproken einddatum (beide dagen inbegrepen).
- Onze machines zijn BMWT-gecertificeerd (categorie 1-3B) en worden bedrijfsklaar en goed onderhouden afgeleverd.
- U gebruikt de machine uitsluitend voor het doel waarvoor deze is bestemd, conform de bijgeleverde instructies en geldende veiligheidsvoorschriften, en uitsluitend door personen die daartoe bevoegd en bekwaam zijn.
- Onderverhuur of het in gebruik geven van de machine aan derden is niet toegestaan zonder onze schriftelijke toestemming.
- U levert de machine bij het einde van de huurperiode terug in dezelfde staat als waarin u deze ontvangen heeft, behoudens normale slijtage.

## Annuleren

- Zolang uw bestelling de status "In behandeling" heeft (dus vóór goedkeuring/betaling), kunt u deze kosteloos zelf annuleren via "Mijn Account".
- Is uw bestelling al goedgekeurd, neem dan zo snel mogelijk contact met ons op via WhatsApp of e-mail; wij bekijken dan samen met u de mogelijkheden.
- Wij kunnen een bestelling annuleren bij bijvoorbeeld onvoorziene onbeschikbaarheid van de machine; u ontvangt hiervan bericht en een reeds ontvangen betaling wordt terugbetaald.

## Aansprakelijkheid en schade

- U bent tijdens de huurperiode verantwoordelijk voor de machine en aansprakelijk voor schade die ontstaat door onzorgvuldig, onjuist of ondeskundig gebruik, of door gebruik in strijd met deze voorwaarden of de bijgeleverde instructies.
- Wij zijn niet aansprakelijk voor gevolgschade, bedrijfsschade of schade aan derden die voortvloeit uit het gebruik van de gehuurde machine, behoudens opzet of bewuste roekeloosheid van onze kant.
- Meld schade, een defect of een ongeval met de machine zo snel mogelijk aan ons, in ieder geval vóór retournering.

## Klachten en geschillen

Heeft u een klacht over de machine, de levering of onze dienstverlening? Neem dan contact met ons op via info@huurgo.nl, zodat wij samen naar een oplossing kunnen zoeken. Komen we er onderling niet uit, dan is Nederlands recht van toepassing en is de bevoegde Nederlandse rechter aangewezen om het geschil te beslechten.

## Wijzigingen

Wij kunnen deze algemene voorwaarden van tijd tot tijd aanpassen. De actuele versie staat altijd op deze pagina, met bovenaan de datum van de laatste wijziging. Voor een reeds lopende huurovereenkomst blijven de voorwaarden gelden die golden op het moment van boeken.

## Contact

- **MB Hoogwerkers B.V. (HuurGo)**
- **E-mail:** info@huurgo.nl
- **Adres:** Produktieweg 20, 2382 PB Zoeterwoude`;
