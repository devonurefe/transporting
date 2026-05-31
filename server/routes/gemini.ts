import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { GoogleGenAI } from "@google/genai";
import { AuthenticatedRequest, requireAdmin } from "../middleware/auth.js";

export const geminiRouter = Router();

// Lazy-initialization of Gemini client for safety
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_")) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// POST Gemini Advisor
geminiRouter.post("/advisor", async (req: AuthenticatedRequest, res: Response) => {
  const { messages, userProfile } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Slechte aanvraag parameters" });
  }

  let dbMachines: any[] = [];
  try {
    dbMachines = await prisma.machine.findMany();
  } catch (error) {
    console.error("Error fetching machines for advisor:", error);
  }

  const machineCatalogContext = dbMachines.map(m => (
    `- ID: "${m.id}", Naam: "${m.name}", Categorie: "${m.category}", Werkhoogte: ${m.height}m, Horizontaal bereik: ${m.reach}m, Gewicht: ${m.weight}kg, Tarief: €${m.pricePerDay}/dag, Aandrijving: ${m.powerType}, Geschikt voor: ${m.suitableFor ? m.suitableFor.split(";").join(", ") : ""}. Beschrijving: ${m.description}`
  )).join("\n");

  const systemInstruction = `
Je bent de legendarische en gastvrije AI Hoogwerker Adviseur van "HoogwerkerHub" (gevestigd in Nederland).
Je doel is om de gebruiker op een vriendelijke, deskundige en uiterst professionele manier te begeleiden bij het selecteren van de perfecte hoogwerker of machinegroep voor hun specifieke klus.

Hier is de actuele inventaris van onze hoogwerkers:
${machineCatalogContext}

Gedragsregels:
1. Reageer ALTIJD in het Nederlands. Wees enthousiast, bemoedigend en toon absolute Nederlandse nuchterheid en vakkennis.
2. Identificeer indien mogelijk de achtergrond van de klant (Schilder, Aannemer, Glazenwasser, Hovenier, Particulier, etc.). Onze machines passen specifiek bij hun profielen.
3. Vraag subtiel naar hun behoeften indien onduidelijk: Werkhoogte in meters? Horizontaal bereik gewenst? Binnen of buiten gebruik (elektrisch versus diesel)? Kwetsbare ondergrond? Is transport gewenst of komen ze de machine zelf ophalen?
4. Indien je een specifieke machine of machinegroep wilt aanbevelen die echt perfect past bij their behoeften, sluit dan je antwoord af of neem in je tekst de specifieke machine ID's op binnen de tags <suggest>MACHINE_ID</suggest>, bijvoorbeeld: <suggest>schaar-elek</suggest> of <suggest>spin-crawl</suggest>. Je mag meerdere tags toevoegen als je meerdere machines vergelijkt of aanbeveelt.
5. Houd de toon premium en luxueus, net zoals de visuele look van onze Stripe of Apple-stijl website. Leg ingewikkelde termen eenvoudig uit.
`;

  // Format messages into Content format for Gemini (User/Model turns)
  // Ensure we match the expected contents parameter format: Array of parts
  const formattedContents = messages.map((m: any) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }]
  }));

  const client = getGeminiClient();

  if (client) {
    try {
      console.log("Sending prompt to Gemini API ('gemini-3.5-flash')...");
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || "Excuses, ik kon geen reactie genereren. Hoe kan ik u vandaag helpen?";
      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Gemini API error:", err);
      // Fallback gracefully if API error occurs
    }
  }

  // Pure High-IQ Simulated Response if Gemini API Key is missing or errored
  console.log("Using smart simulated rule-based fallback response...");
  const lastUserMsg = messages[messages.length - 1]?.text?.toLowerCase() || "";
  let fallbackReply = "";

  if (lastUserMsg.includes("zonnepaneel") || lastUserMsg.includes("zonnepanelen") || lastUserMsg.includes("solar")) {
    fallbackReply = "Voor zonnepaneel installaties is een knikarmhoogwerker uitermate geschikt om veilig en flexibel over de dakgoot heen te reiken. Ons speciaal samengestelde **Zonnepaneel Montage Pakket (18m)** bevat een hybride knikarmhoogwerker inclusief handige materiaalgordels en haken om panelen veilig te hanteren.\n\n<suggest>set-solar-pro</suggest>\n<suggest>knik-diesel</suggest>\n\nZullen we de beschikbaarheid van deze set bekijken voor uw projectlocatie?";
  } else if (lastUserMsg.includes("dakreparatie") || lastUserMsg.includes("schoorsteen") || lastUserMsg.includes("dakdekker") || lastUserMsg.includes("dakpannen") || lastUserMsg.includes("pannen vervangen")) {
    fallbackReply = "Bij dakreparaties, schoorsteenvoegen of pannen vervangen op hoogte heeft u een stabiele en betrouwbare machine nodig. Voor zware klussen op ruw terrein raad ik de **Telescoophoogwerker Heavy-Duty (26m)** aan. Als het dak minder makkelijk bereikbaar is of de ondergrond kwetsbaar (bijvoorbeeld een oprit of tuin), is de compacte **Spinhoogwerker Spider (15m)** met stempels de perfecte oplossing.\n\n<suggest>tele-diesel</suggest>\n<suggest>spin-crawl</suggest>\n\nWilt u zelf de machine besturen of wilt u een gecertificeerde machinist erbij huren?";
  } else if (lastUserMsg.includes("camera") || lastUserMsg.includes("lichtmast") || lastUserMsg.includes("lichten") || lastUserMsg.includes("lichtmasten") || lastUserMsg.includes("beveiligingscamera")) {
    fallbackReply = "Voor het monteren van camera's of lichtarmaturen binnen of buiten adviseren wij onze specialistische **Licht & Camera Installatieset (15m)** (inclusief spinhoogwerker en stroomhaspel) of de compacte **Elektrische Schaarlift (12m)** met non-marking banden voor strakke gangpaden binnen magazijnen.\n\n<suggest>set-light-install</suggest>\n<suggest>schaar-elek</suggest>\n\nHeeft de werklocatie een vlakke betonvloer of is er sprake van een onverharde ondergrond?";
  } else if (lastUserMsg.includes("industrie") || lastUserMsg.includes("staalbouw") || lastUserMsg.includes("staalconstructie") || lastUserMsg.includes("industriebouw")) {
    fallbackReply = "Voor grootschalige industriële projecten, staalbouw en constructiewerk op ruw terrein heeft u brute kracht en maximaal bereik nodig. Onze **Super-Reach Telescoophoogwerker (40m)** biedt een ongekende werkhoogte en reikwijdte met maximale 4WD tractie. Voor iets compactere, maar eveneens zware taken is de **Telescoophoogwerker Heavy-Duty (26m)** de absolute industriestandaard.\n\n<suggest>tele-max</suggest>\n<suggest>tele-diesel</suggest>\n\nWij kunnen het transport met onze eigen diepladers volledig voor u verzorgen. Zullen we een offerte opstellen?";
  } else if (lastUserMsg.includes("schilder") || lastUserMsg.includes("verf") || lastUserMsg.includes("binnen")) {
    fallbackReply = "Als professionele schilder heeft u waarschijnlijk een stabiele hoogwerker nodig die geschikt is voor binnenwerk en kwetsbare vloeren. Ik raad onze **Elektrische Schaarlift (12m)** aan voor rechte muren of onze uiterst wendbare **Spinhoogwerker Spider (15m)** als u over kasten of tuinen heen moet manoeuvreren. Ze zijn beiden emissievrij en fluisterstil!\n\n<suggest>schaar-elek</suggest>\n<suggest>spin-crawl</suggest>\n\nHeeft u al een idee van de gewenste werkhoogte?";
  } else if (lastUserMsg.includes("parke") || lastUserMsg.includes("vloer") || lastUserMsg.includes("laminaat") || lastUserMsg.includes("plafond") || lastUserMsg.includes("bouw") || lastUserMsg.includes("klus")) {
    fallbackReply = "Voor binnenwerkzaamheden zoals het leggen van parket/vloeren, plafondafwerking of renovatie is een stabiele, compacte en emissievrije hoogwerker cruciaal. Onze **Elektrische Schaarlift (12m)** is uitgerust met non-marking banden en extra vloerbescherming, perfect om uw kwetsbare vloer krasvrij te houden! Indien u in krappe hoeken of over obstakels heen moet werken, is de **Spinhoogwerker Spider (15m)** op rubberen rupsbanden een uitstekende keuze.\n\n<suggest>schaar-elek</suggest>\n<suggest>spin-crawl</suggest>\n\nZullen we de logistieke beschikbaarheid voor uw gewenste datums controleren?";
  } else if (lastUserMsg.includes("hovenier") || lastUserMsg.includes("buiten") || lastUserMsg.includes("boom") || lastUserMsg.includes("ruw")) {
    fallbackReply = "Voor buitenwerkzaamheden op ruw of onverhard terrein raad ik absoluut onze **Spinhoogwerker Spider (15m)** met rupsbanden aan of de krachtige **Telescoophoogwerker Heavy-Duty (26m)** als u enorme hoogte nodig heeft. Bent u op zoek naar snel transport tussen locaties? Dan is de **Autohoogwerker B-Rijbewijs (22m)** ideaal omdat u hier zelf mee mag rijden!\n\n<suggest>spin-crawl</suggest>\n<suggest>truck-b</suggest>";
  } else if (lastUserMsg.includes("glazenwasser") || lastUserMsg.includes("gevel") || lastUserMsg.includes("reiken")) {
    fallbackReply = "Voor gevelreiniging of glasbewassing is zijdelings bereik cruciaal. De **Knikarmhoogwerker (18m)** biedt 16 meter horizontaal bereik en kan eenvoudig over geparkeerde auto's of luifels reiken. Indien u snel langs meerdere panden moet reizen, is de **Autohoogwerker B-Rijbewijs (22m)** uw beste vriend!\n\n<suggest>knik-diesel</suggest>\n<suggest>truck-b</suggest>";
  } else {
    fallbackReply = "Welkom bij HoogwerkerHub! Ik help u graag met het vinden van de beste hoogwerker voor uw specifieke klus. Bent u actief als schilder, installateur, aannemer of particulier? En werkt u hoofdzakelijk binnen of buiten? \n\nLaat me ook gerust weten welke werkhoogte u zoekt, dan sturen we direct de juiste suggestie!\n\nU kunt hieronder ook op een van de snelle opties klikken.";
  }

  return res.json({ reply: fallbackReply });
});

// POST Gemini Auto-Fill specifications based on machine name
geminiRouter.post("/autofill", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { machineName } = req.body;
  if (!machineName || typeof machineName !== "string" || !machineName.trim()) {
    return res.status(400).json({ error: "Slechte aanvraag parameters: modelnaam is verplicht" });
  }

  const systemInstruction = `
    Je bent de technische specificatie-expert van "HoogwerkerHub".
    Je taak is om op basis van de ingevoerde modelnaam van een hoogwerker (bijvoorbeeld "Genie GS-1930" of "JLG 450AJ") de exacte technische specificaties te bepalen en een premium marketingomschrijving te genereren.

    Je MOET antwoorden in een strikt JSON-formaat dat exact voldoet aan het volgende JSON-schema:
    {
      "category": "schaarlift" | "knikarm" | "telescoop" | "auto" | "spin", (kies degene die het beste past bij dit model)
      "height": getal, (werkhoogte in meters, bijvoorbeeld 16)
      "reach": getal, (zijwaarts bereik in meters, gebruik 0 indien niet van toepassing of onbekend)
      "weight": getal, (eigen gewicht van de machine in kg, bijvoorbeeld 3200)
      "pricePerDay": getal, (huurtarief per dag in Euro's, schat een marktconform tarief in, bijv 150)
      "powerType": "Elektrisch" | "Diesel" | "Hybride", (de aandrijving die dit model standaard heeft)
      "suitableFor": ["beroep1", "beroep2"], (lijst met doelgroepen zoals "Schilder", "Aannemer", "Glazenwasser", "Hovenier", "Installateur", max 3-4)
      "description": "Premium omschrijving...", (schrijf een professionele en aantrekkelijke productomschrijving in het Nederlands die de belangrijkste voordelen benadrukt)
      "imageUrl": "https://..." (geef een passende hoge resolutie Unsplash afbeelding URL die past bij het type hoogwerker, selecteer uit de volgende opties:
        - Voor schaarlift: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop"
        - Voor knikarm: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=600&auto=format&fit=crop"
        - Voor telescoop: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop"
        - Voor auto: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop"
        - Voor spin: "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&auto=format&fit=crop"
      ),
      "packageContents": "item1; item2; item3; item4" (genereer een puntkomma-gescheiden lijst van 4 tot 6 inbegrepen items of services die typisch bij dit model horen, zoals verlengsnoeren, harnas, rijplaten, handleiding, etc. in het Nederlands, max 200 tekens)
    }

    Geef GEEN andere tekst, markdown-blokken (zoals \`\`\`json) of uitleg buiten de geldige JSON.
  `;

  const client = getGeminiClient();

  if (client) {
    try {
      console.log(`Querying Gemini for autofill specs of: ${machineName}...`);
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Genereer specificaties voor hoogwerker model: "${machineName}"`,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const jsonText = response.text || "{}";
      const cleanJson = jsonText.trim();
      const result = JSON.parse(cleanJson);
      return res.json(result);
    } catch (err: any) {
      console.error("Gemini Autofill API error:", err);
    }
  }

  // Graceful simulated fallback if API Key is not set or errors
  console.log("Using smart simulated auto-fill fallback response...");
  const lowerName = machineName.toLowerCase();
  let fallback: any = {
    category: "schaarlift",
    height: 12,
    reach: 0,
    weight: 2300,
    pricePerDay: 110,
    powerType: "Elektrisch",
    suitableFor: ["Schilder", "Installateur"],
    description: `De ${machineName} is een uitstekende en betrouwbare keuze voor al uw onderhouds- en installatiewerkzaamheden op hoogte. Dankzij de stille en emissievrije aandrijving is deze machine ideaal voor gebruik in magazijnen, kantoorpanden en andere binnenlocaties. De non-marking banden voorkomen strepen op kwetsbare vloeren.`,
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    packageContents: "1x Gecertificeerde Elektrische Schaarlift (12m werkhoogte);2x 20m zware verlengkabels (230V / IP44);1x Handige gereedschapsbak gemonteerd op het werkplatform;1x Luxe comfort-veiligheidsharnas (EN-361 gekeurd);4x Non-marking witte banden (geen sporen op luxe vloeren)"
  };

  if (lowerName.includes("knik") || lowerName.includes("articulated") || lowerName.includes("jlg 450") || lowerName.includes("genie z")) {
    fallback = {
      category: "knikarm",
      height: 16,
      reach: 12,
      weight: 6500,
      pricePerDay: 190,
      powerType: "Elektrisch",
      suitableFor: ["Glazenwasser", "Schilder", "Aannemer"],
      description: `De ${machineName} knikarmhoogwerker biedt maximale flexibiliteit dankzij het ingenieuze knikarmontwerp. Hiermee reikt u eenvoudig over obstakels en daken heen. Perfect voor schilderwerk, gevelreiniging of zonnepaneelinstallaties op wisselend terrein.`,
      imageUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=600&auto=format&fit=crop",
      packageContents: "1x Knikarmhoogwerker (18m werkhoogte, 16m zijdelings bereik);2x Heavy-duty materiaalgordels met verstelbare karbijnhaakjes;1x Premium valbeveiligingsset Pro met schokdemper;1x Geïntegreerde 230V stroomaansluiting rechtstreeks in de werkbak;All-Risk Casco schadeverzekering"
    };
  } else if (lowerName.includes("tele") || lowerName.includes("jlg 600") || lowerName.includes("genie s")) {
    fallback = {
      category: "telescoop",
      height: 22,
      reach: 18,
      weight: 11200,
      pricePerDay: 240,
      powerType: "Diesel",
      suitableFor: ["Aannemer", "Staalbouwer"],
      description: `Met de ${machineName} telescopische hoogwerker haalt u brute kracht en een enorm horizontaal bereik in huis. Uitermate geschikt voor grote industriële projecten, staalbouw en buitengebruik op onverharde, ruwe bouwterreinen.`,
      imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop",
      packageContents: "1x Telescoophoogwerker Diesel (26m werkhoogte) - 4x4 aangedreven;2x Slanghaspel mastklemmen voor hogedrukslangen tot korf;1x Geïntegreerde generator unit (stroom & hogedrukwatertoevoer);1x Volledige All-Risk Casco dekking zonder eigen risico;2x Waterdichte mouwbeschermers & vizierbrillen"
    };
  } else if (lowerName.includes("truck") || lowerName.includes("auto") || lowerName.includes("rijbewijs")) {
    fallback = {
      category: "auto",
      height: 22,
      reach: 14,
      weight: 3450,
      pricePerDay: 200,
      powerType: "Diesel",
      suitableFor: ["Glazenwasser", "Hovenier"],
      description: `De ${machineName} autohoogwerker is de ideale partner voor klussen op meerdere locaties per dag. Met uw standaard B-rijbewijs mag u zelf met deze truck de weg op. Ideaal voor snel en mobiel werk aan gevels, bomen of lantaarnpalen.`,
      imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
      packageContents: "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist);1x Telescopische dakgootschep & telescopische trekker/bezem set;1x Geïntegreerde 230V stroomaansluiting in de korf;1x Geperforeerde aluminium werkbak voor emmers en afval;1x Set van 4 wegafzetting pionnen met reflecterende strips"
    };
  } else if (lowerName.includes("spin") || lowerName.includes("spider") || lowerName.includes("rups")) {
    fallback = {
      category: "spin",
      height: 15,
      reach: 8,
      weight: 1800,
      pricePerDay: 160,
      powerType: "Hybride",
      suitableFor: ["Hovenier", "Schilder"],
      description: `Dankzij de compacte spinhoogwerker stempels en rupsbanden manoeuvreert de ${machineName} moeiteloos door smalle poorten of over zachte grasvelden. Het lage gewicht verdeelt de druk uitstekend, waardoor de machine perfect is voor tuinen en binnenpleinen met kwetsbare bestrating.`,
      imageUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&auto=format&fit=crop",
      packageContents: "1x Spinhoogwerker Spider (15m werkhoogte) op smalle rupsbanden;4x Heavy-duty kunststof rijplaten (voorkomt sporen in gazons);1x Gecertificeerde bosbouwer snoeihelm met vizier en oorkappen;1x Magnetische relingtray voor snoeigereedschappen;1x spanbandenset"
    };
  }

  return res.json(fallback);
});
