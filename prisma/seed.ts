import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const defaultCategories = [
  {
    id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers",
    desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.",
    heights: "12m - 17m", price: "v.a. €80/dag",
    infoContent: {
      useCases: ["Schilderwerk en onderhoud aan gevels en hogere panden", "Dakgootreiniging en dakreparaties", "Montage van zonnepanelen", "Boomverzorging"],
      advantages: ["Geen transportkosten: zelf rijden met rijbewijs B", "In 5 minuten opgesteld", "Geen kraanwagen nodig", "Flexibel: volgt u naar elke locatie"],
      notFor: ["Smalle tuinpoorten smaller dan 2 meter", "Zachte bodem, gras", "Binnenwerk in gebouwen"]
    }
  },
  {
    id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers",
    desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.",
    heights: "15m - 17m", price: "v.a. €160/dag",
    infoContent: {
      useCases: ["Boomverzorging en snoeiwerk", "Gevelonderhoud op moeilijk bereikbare hoeken", "Werkzaamheden op kwetsbare gazons"],
      advantages: ["Rupsbanden: geen schade aan gras of tegels", "Past door poortjes vanaf 80 cm", "Stabiel op hellingen"],
      notFor: ["Binnenwerk in gebouwen", "Langdurig gebruik op openbare wegen", "Locaties alleen bereikbaar via trap"]
    }
  },
  {
    id: "schaarlift", label: "Schaarlift (8m)", listLabel: "Schaarliften (8m)",
    desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.",
    heights: "8m", price: "v.a. €80/dag",
    infoContent: {
      useCases: ["Plafondreparaties en schilderwerk binnenshuis", "Montage van verlichting en HVAC", "Magazijn- en kantooronderhoud"],
      advantages: ["Groot stabiel werkplatform", "Elektrisch en geruisloos", "Past door standaard deuropeningen (smal model)"],
      notFor: ["Oneffen of zachte buitengrond", "Steile hellingen", "Werkzaamheden waarbij lateraal uitreiken vereist is"]
    }
  },
  {
    id: "schaarlift-smal", label: "Smal Model Schaarlift (10m)", listLabel: "Schaarliften (10m smal)",
    desc: "Compacte en smalle schaarlift voor nauwe gangpaden en binnenruimtes tot 10 meter werkhoogte.",
    heights: "10m", price: "v.a. €95/dag",
    infoContent: {
      useCases: ["Plafondreparaties en schilderwerk binnenshuis", "Montage van verlichting en HVAC", "Magazijn- en kantooronderhoud"],
      advantages: ["Groot stabiel werkplatform", "Elektrisch en geruisloos", "Past door standaard deuropeningen (smal model)"],
      notFor: ["Oneffen of zachte buitengrond", "Steile hellingen", "Werkzaamheden waarbij lateraal uitreiken vereist is"]
    }
  },
  {
    id: "schaarlift-6m", label: "Compacte Schaarlift (6m)", listLabel: "Schaarliften (6m)",
    desc: "Compacte elektrische schaarlift voor snel en veilig werken op 6 meter. Past door standaard binnendeuren.",
    heights: "6m", price: "v.a. €65/dag",
    infoContent: {
      useCases: ["Plafondreparaties en schilderwerk binnenshuis", "Montage van verlichting en HVAC", "Magazijn- en kantooronderhoud"],
      advantages: ["Groot stabiel werkplatform", "Elektrisch en geruisloos", "Past door standaard deuropeningen (smal model)"],
      notFor: ["Oneffen of zachte buitengrond", "Steile hellingen", "Werkzaamheden waarbij lateraal uitreiken vereist is"]
    }
  },
  {
    id: "mastlift", label: "Mastlift", listLabel: "Mastliften",
    desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.",
    heights: "5m - 10m", price: "v.a. €75/dag",
    infoContent: {
      useCases: ["Installatie in magazijnen en fabrieken", "Licht onderhoud in smalle gangen", "Schilderwerk op beperkte ruimte"],
      advantages: ["Uiterst compact en licht", "Geschikt voor lifttransport", "Direct inzetbaar"],
      notFor: ["Buitengebruik of ongelijke vloeren", "Zwaar constructiewerk", "Meer dan 1 persoon op hoogte"]
    }
  },
  {
    id: "kamersteiger", label: "Kamersteiger", listLabel: "Kamersteigers",
    desc: "Stabiele en lichtgewicht kamersteigers voor veilig binnenwerk tot 4 meter. Snel op- en afgebouwd.",
    heights: "4m", price: "v.a. €35/dag",
    infoContent: {
      useCases: ["Schilderwerk en stucwerk aan plafonds", "Binnenhuisrenovaties", "Plaatsing van plafondlampen"],
      advantages: ["Licht aluminium: snel op- en afgebouwd", "Geen stroom of accu nodig", "Stabiel werkplatform"],
      notFor: ["Buitengebruik of ongelijke vloeren", "Werkhoogtes boven 4 meter", "Zwaar materiaal hijsen"]
    }
  },
  {
    id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften",
    desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.",
    heights: "18m - 21m", price: "v.a. €90/dag",
    infoContent: {
      useCases: ["Verhuizingen via raam of balkon", "Dakdekkers: dakpannen transport", "Installatie van dakramen en zonnepanelen"],
      advantages: ["Veilig tillen zonder traplopen", "Tot 21 meter bereik (7 woonlagen)", "Groot gewichtsvermogen"],
      notFor: ["Personentransport", "Locaties zonder vrij pad langs gevel", "Binnenwerk"]
    }
  },
  {
    id: "ecolift", label: "Pecolift", listLabel: "Pecolift",
    desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.",
    heights: "3.5m", price: "v.a. €45/dag",
    infoContent: {
      useCases: ["Schilderwerk, elektra, installatie binnenshuis", "Kantoren, winkels, scholen", "Licht onderhoud op vaste vloer"],
      advantages: ["Direct klaar: geen montagetijd", "100% handmatig: geen accu of stroom", "Veilig 360° werken", "Beschadigt kwetsbare vloeren niet"],
      notFor: ["Buitengebruik (alleen vlakke harde binnenvloeren)", "Zware bouwmaterialen (max. 150 kg incl. persoon)", "Lateraal uitreiken"]
    }
  }
];

const defaultMachines = [
  // CATEGORIE 1: "Tow & Go" Aanhangerhoogwerkers
  {
    id: "nifty-120-1",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 95,   // regular day rate (= twoDayPrice/2)
    oneDayPrice: 50,   // 1-dag actie "Slechts 1 dag korting!"
    powerType: "Elektrisch",
    imageUrl: "/images/machines/nifty-120-1.webp",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Uiterst wendbare en compacte aanhangerhoogwerker, eenvoudig zelf mee te nemen met rijbewijs B. Geen transportkosten en binnen 5 minuten stabiel opgesteld voor uw gevel- of schilderklus.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 120,
    twoDayPrice: 170,
    threeDayPrice: 260,
    fourDayPrice: 310,
    weeklyPrice: 340,
    extraDayPrice: 70,
    monthlyPrice: 990
  },
  {
    id: "nifty-120-2",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker (Unit 2)",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 95,
    oneDayPrice: 50,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/nifty-120-2.webp",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Compacte aanhangerhoogwerker (Unit 2). Makkelijk aan te koppelen en te manoeuvreren op uw werkplek.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 120,
    twoDayPrice: 170,
    threeDayPrice: 260,
    fourDayPrice: 310,
    weeklyPrice: 340,
    extraDayPrice: 70,
    monthlyPrice: 990
  },
  {
    id: "nifty-120-3",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker (Unit 3)",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 95,
    oneDayPrice: 50,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/nifty-120-3.webp",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Betrouwbare Nifty 120 aanhangerhoogwerker (Unit 3) met telescooparm.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 120,
    twoDayPrice: 170,
    threeDayPrice: 260,
    fourDayPrice: 310,
    weeklyPrice: 340,
    extraDayPrice: 70,
    monthlyPrice: 990
  },
  {
    id: "nifty-170",
    name: "Nifty 170 \"Toe & Go\" Aanhangerhoogwerker",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 17.1,
    reach: 8.7,
    weight: 2160,
    pricePerDay: 120,  // regular day rate (= twoDayPrice/2)
    oneDayPrice: 60,   // 1-dag actie
    powerType: "Hybride",
    imageUrl: "/images/machines/nifty-170.webp",
    imageAlt: "Nifty 170 zware aanhangerhoogwerker",
    description: "Zware aanhangerhoogwerker met 17.1 meter werkhoogte en een gigantisch zijdelings bereik. Ideaal voor boomverzorging en gevelwerk aan hogere panden.",
    suitableFor: ["Hovenier", "Schilder", "Glazenwasser"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 150,
    twoDayPrice: 210,
    threeDayPrice: 320,
    fourDayPrice: 390,
    weeklyPrice: 430,
    extraDayPrice: 90,
    monthlyPrice: 1250
  },

  // CATEGORIE 2: Spinhoogwerkers (Rupshoogwerkers)
  {
    id: "hinowa-15-70",
    name: "Hinowa Goldlift 15.70 Rupshoogwerker",
    category: "spin",
    categoryLabel: "Rupshoogwerker",
    height: 15.4,
    reach: 6.6,
    weight: 1400,
    pricePerDay: 228,
    powerType: "Hybride",
    imageUrl: "/images/machines/hinowa-15-70.webp",
    imageAlt: "Hinowa 15.70 spinhoogwerker op rupsbanden",
    description: "Compacte örümcek lift op rupsbanden. Past door een tuinpoort van slechts 80cm breed. Optimale drukverdeling op kwetsbare bodems.",
    suitableFor: ["Hovenier", "Schilder", "Gevelreiniger"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 340,
    twoDayPrice: 390,
    threeDayPrice: 520,
    fourDayPrice: 560,
    weeklyPrice: 590,
    extraDayPrice: 115,
    monthlyPrice: 1750
  },
  {
    id: "hinowa-17-75",
    name: "Hinowa Lightlift 17.75 Rupshoogwerker",
    category: "spin",
    categoryLabel: "Rupshoogwerker",
    height: 17.06,
    reach: 7.5,
    weight: 2200,
    pricePerDay: 275,
    powerType: "Hybride",
    imageUrl: "/images/machines/hinowa-17-75.webp",
    imageAlt: "Hinowa 17.75 zware spinhoogwerker",
    description: "Krachtige, lichte spinhoogwerker op rupsbanden. Perfect voor gevelwerken en onderhoud in krappe buitenlocaties tot 17 meter.",
    suitableFor: ["Hovenier", "Aannemer", "Glazenwasser"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 410,
    twoDayPrice: 470,
    threeDayPrice: 630,
    fourDayPrice: 680,
    weeklyPrice: 715,
    extraDayPrice: 140,
    monthlyPrice: 2100
  },

  // CATEGORIE 3: Elektrische Schaarliften (8 meter)
  {
    id: "optimum-8-1",
    name: "Haulotte Optimum 8 Schaarlift",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 7.76,
    reach: 0,
    weight: 1520,
    pricePerDay: 75,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/optimum-8-1.webp",
    imageAlt: "Haulotte Optimum 8 scissor lift",
    description: "Compacte elektrische schaarlift voor stabiel rechtlijnig binnenwerk op 8 meter. Non-marking banden voorkomen strepen op vloeren.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 115,
    twoDayPrice: 130,
    threeDayPrice: 170,
    fourDayPrice: 185,
    weeklyPrice: 195,
    extraDayPrice: 46,
    monthlyPrice: 540
  },
  {
    id: "optimum-8-2",
    name: "Haulotte Optimum 8 Schaarlift (Unit 2)",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 7.76,
    reach: 0,
    weight: 1520,
    pricePerDay: 75,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/optimum-8-2.webp",
    imageAlt: "Haulotte Optimum 8 scissor lift",
    description: "Compacte elektrische schaarlift (Unit 2) voor installatie en schilderwerk binnen.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 115,
    twoDayPrice: 130,
    threeDayPrice: 170,
    fourDayPrice: 185,
    weeklyPrice: 195,
    extraDayPrice: 46,
    monthlyPrice: 540
  },
  {
    id: "compact-8-1",
    name: "Haulotte Compact 8 Schaarlift",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 8.2,
    reach: 0,
    weight: 1650,
    pricePerDay: 78,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-8-1.webp",
    imageAlt: "Haulotte Compact 8 scissor lift",
    description: "Stabiele elektrische schaarlift met een extra ruim platform dankzij het uitschuifbare dek. Uitstekend geschikt voor onderhoud en montage.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 115,
    twoDayPrice: 130,
    threeDayPrice: 170,
    fourDayPrice: 185,
    weeklyPrice: 195,
    extraDayPrice: 46,
    monthlyPrice: 540
  },
  {
    id: "compact-8-2",
    name: "Haulotte Compact 8 Schaarlift (Unit 2)",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 8.2,
    reach: 0,
    weight: 1650,
    pricePerDay: 78,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-8-2.webp",
    imageAlt: "Haulotte Compact 8 scissor lift",
    description: "Stabiele elektrische schaarlift (Unit 2) met uitschuifbaar dek.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 115,
    twoDayPrice: 130,
    threeDayPrice: 170,
    fourDayPrice: 185,
    weeklyPrice: 195,
    extraDayPrice: 46,
    monthlyPrice: 540
  },

  // CATEGORIE 4: Smalle Elektrische Schaarliften (10 meter)
  {
    id: "compact-10n-1",
    name: "Haulotte Compact 10N Schaarlift (Smal)",
    category: "schaarlift-smal",
    categoryLabel: "Smal Model Schaarlift (10m)",
    height: 10.0,
    reach: 0,
    weight: 2190,
    pricePerDay: 95,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-10n-1.webp",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Met een breedte van slechts 81cm is deze smalle schaarlift perfect voor nauwe gangpaden in magazijnen en krappe binnenruimtes tot 10 meter.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 145,
    twoDayPrice: 165,
    threeDayPrice: 215,
    fourDayPrice: 235,
    weeklyPrice: 250,
    extraDayPrice: 60,
    monthlyPrice: 680
  },
  {
    id: "compact-10n-2",
    name: "Haulotte Compact 10N Schaarlift (Smal) (Unit 2)",
    category: "schaarlift-smal",
    categoryLabel: "Smal Model Schaarlift (10m)",
    height: 10.0,
    reach: 0,
    weight: 2190,
    pricePerDay: 95,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/compact-10n-2.webp",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Smalle schaarlift (Unit 2) met non-marking banden voor compact en geruisloos binnenwerk.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 145,
    twoDayPrice: 165,
    threeDayPrice: 215,
    fourDayPrice: 235,
    weeklyPrice: 250,
    extraDayPrice: 60,
    monthlyPrice: 680
  },

  // CATEGORIE 4b: Compacte Schaarliften (6m) — Dingli JCPT 0607 DC
  {
    id: "dingli-6m",
    name: "Dingli JCPT 0607 DC Compact Schaarlift",
    category: "schaarlift-6m",
    categoryLabel: "Compacte Schaarlift (6m)",
    height: 6.0,
    reach: 0,
    weight: 695,
    pricePerDay: 55,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/dingli-6m.webp",
    imageAlt: "Dingli JCPT 0607 DC compact elektrische schaarlift 6 meter",
    description: "Lichtgewicht elektrische schaarlift met 6 meter werkhoogte. Uiterst compact en geschikt voor smalle gangpaden en lage doorgangshoogtes. Ideaal voor onderhoudsklussen in winkels, scholen en kantoren.",
    suitableFor: ["Installateur", "Schilder", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 85,
    twoDayPrice: 95,
    threeDayPrice: 125,
    fourDayPrice: 135,
    weeklyPrice: 145,
    extraDayPrice: 34,
    monthlyPrice: 390
  },

  // CATEGORIE 4c: Kamersteigers — Altrex RS TOWER 44-Power (2-dag minimum, €15/2dgn, €19/week)
  {
    id: "altrex-rs44",
    name: "Altrex RS TOWER 44-Power Kamersteiger",
    category: "kamersteiger",
    categoryLabel: "Kamersteiger",
    height: 2.75,
    reach: 0,
    weight: 105,
    pricePerDay: 19,
    powerType: "Handmatig",
    imageUrl: "/images/machines/altrex-rs44.webp",
    imageAlt: "Altrex RS TOWER 44-Power kamersteiger binnenwerk",
    description: "Veilig, licht en originele Altrex-kwaliteit. Inklapbaar en eenvoudig op te bouwen voor uw renovatieklussen binnen en buiten.",
    suitableFor: ["Schilder", "Stukadoor", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: null,
    twoDayPrice: 15,
    weeklyPrice: 19,
    monthlyPrice: null,
    minRentalDays: 2,
    weeklyOnly: false,
    pickupOnly: true,
    packageContents: "Inklapbaar hoofdframe (Module A); Werkplatform; Zwenkwielenset met rem; **Wettelijk verplichte driehoekstabilisatoren (inbegrepen)**",
    crossSellAddons: [
      { id: "altrex-rs44-uitbreiding", name: "Uitbreidingsset (Module B)", description: "Extra originele Altrex bovenbuizenset om uw werkhoogte van 2,75 m naar 4 m te verhogen.", pricePerWeek: 19 },
      { id: "altrex-rs44-toolbuddy", name: "Altrex Toolbuddy", description: "Praktische ophanghaak zodat uw gereedschap en verfemmer binnen handbereik blijven tijdens het werken.", pricePerWeek: 5 }
    ]
  },

  // CATEGORIE 5: Verticale Mastliften
  {
    id: "star-10",
    name: "Haulotte Star 10 Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 10.0,
    reach: 3.0,
    weight: 2677,
    pricePerDay: 130,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/star-10.webp",
    imageAlt: "Haulotte Star 10 mastlift met knikarm",
    description: "Verticale mastlift met 10 meter werkhoogte en een knikarm voor 3.0 meter horizontaal bereik. Past perfect door binnendeuren.",
    suitableFor: ["Schilder", "Installateur", "Restauratie"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 200,
    twoDayPrice: 230,
    threeDayPrice: 280,
    fourDayPrice: 360,
    weeklyPrice: 405,
    extraDayPrice: 80,
    monthlyPrice: 980
  },
  {
    id: "skyjack-sj16",
    name: "Skyjack SJ16 Verticale Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 6.6,
    reach: 0,
    weight: 966,
    pricePerDay: 49,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/skyjack-sj16.webp",
    imageAlt: "Skyjack SJ16 verticale mastlift",
    description: "Uiterst lichte en compacte verticale mastlift. Ideaal voor kantooronderhoud, winkelinrichting en lichte montagewerkzaamheden op vlakke vloeren.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 75,
    twoDayPrice: 90,
    threeDayPrice: 115,
    fourDayPrice: 136,
    weeklyPrice: 150,
    extraDayPrice: 30,
    monthlyPrice: 370
  },
  {
    id: "bravi-mini-hd",
    name: "Bravi Leonardo HD Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 4.9,
    reach: 0,
    weight: 510,
    pricePerDay: 40,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/bravi-mini-hd.webp",
    imageAlt: "Bravi Leonardo HD compacte lift",
    description: "De meest compacte en robuuste lift in zijn klasse. Rijdt moeiteloos door standaard deuropeningen en is dankzij het gewicht van 510kg uiterst liftvriendelijk.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    // Tiered pricing + weekend rules (pilot product). 1d €40, 2d €80, 3d €105,
    // 4d €125, 5d (werkweek) €140, dag 6+ = €28/dag (extraDayPrice), weekendpakket €69,
    // zondagblokkade €20. Depot gesloten za/zo → weekendRulesEnabled.
    twoDayPrice: 80,
    threeDayPrice: 105,
    fourDayPrice: 125,
    weekendPrice: 69,
    weeklyPrice: 140,
    extraDayPrice: 28,
    monthlyPrice: 340,
    sundayBlockFee: 20,
    weekendRulesEnabled: true
  },
  {
    id: "jlg-1230es",
    name: "JLG 1230ES Verticale Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 5.5,
    reach: 0,
    weight: 790,
    pricePerDay: 40,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/jlg-1230es.webp",
    imageAlt: "JLG 1230ES mastlift",
    description: "Betrouwbare en energiezuinige mastlift met elektrisch rijsysteem. Zeer lange accuduur voor intensieve binnenklussen tot 5.5 meter.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 69,
    twoDayPrice: 80,
    threeDayPrice: 105,
    fourDayPrice: 125,
    weeklyPrice: 140,
    extraDayPrice: 28,
    monthlyPrice: 340
  },

  // CATEGORIE 6: Verhuisliften / Ladderliften
  {
    id: "ladderlift-18",
    name: "Ladderlift / Verhuislift (18m)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 18.0,
    reach: 0,
    weight: 1200,
    pricePerDay: 120,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/ladderlift-18.webp",
    imageAlt: "Ladderlift verhuislift 18m",
    description: "Compact opstelbare ladderlift voor het veilig transporteren van verhuisdozen, meubilair of bouwmaterialen via het raam of balkon tot de 5e verdieping.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 180,
    twoDayPrice: 210,
    threeDayPrice: 280,
    fourDayPrice: 310,
    weeklyPrice: 330,
    extraDayPrice: 65,
    monthlyPrice: 990
  },
  {
    id: "ladderlift-21-1",
    name: "Ladderlift / Verhuislift Heavy-Load (21m)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 21.0,
    reach: 0,
    weight: 1350,
    pricePerDay: 135,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/ladderlift-21-1.webp",
    imageAlt: "Zware verhuislift ladderlift 21m",
    description: "Sterke en stabiele ladderlift met 21 meter bereik. Perfect voor grote verhuizingen, dakdekkers en installatieklussen aan hoge gevels.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 200,
    twoDayPrice: 235,
    threeDayPrice: 315,
    fourDayPrice: 350,
    weeklyPrice: 375,
    extraDayPrice: 75,
    monthlyPrice: 1125
  },
  {
    id: "ladderlift-21-2",
    name: "Ladderlift / Verhuislift Heavy-Load (21m) (Unit 2)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 21.0,
    reach: 0,
    weight: 1350,
    pricePerDay: 135,
    powerType: "Elektrisch",
    imageUrl: "/images/machines/ladderlift-21-2.webp",
    imageAlt: "Zware verhuislift ladderlift 21m Unit 2",
    description: "Stabiele 21m ladderlift (Unit 2) voor verhuizers en installateurs.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 200,
    twoDayPrice: 235,
    threeDayPrice: 315,
    fourDayPrice: 350,
    weeklyPrice: 375,
    extraDayPrice: 75,
    monthlyPrice: 1125
  },

  // Categorie 7: Handmatige Lichtgewicht Klasse (Pecolift)
  {
    id: "ecolift",
    name: "Pecolift Low-Level Access",
    category: "ecolift",
    categoryLabel: "Pecolift",
    height: 3.5,
    reach: 0,
    weight: 180,
    pricePerDay: 39,
    powerType: "Handmatig",
    imageUrl: "/images/machines/ecolift.webp",
    imageAlt: "Pecolift handmatig lage toegangsplatform",
    description: "Volledig milieuvriendelijke low-level access lift. Geen batterijen, olie of hydrauliek nodig. Draai simpelweg aan het wiel om uzelf tot 3,5 meter werkhoogte te liften. Draagvermogen 150 kg. Gewicht 180 kg. Geluidloos en veilig.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: null,
    monthlyDiscountPercent: null,
    campaignText: null,
    campaignDiscountPercent: null,
    campaignDiscountAmount: null,
    weekendPrice: 59,
    weeklyPrice: 99,
    monthlyPrice: 290
  },

];

const defaultBlockedDates: { id: string; machineId: string; date: Date; reason: string }[] = [];

const defaultSiteConfig = {
  id: "default",
  siteName: "huurgo",
  heroTagline: "Professionele Hoogwerker Verhuur",
  heroTitle: "De juiste machine, snel en veilig geregeld.",
  heroSubtitle: "HuurGo verhuurt gecertificeerde hoogwerkers, schaarliften, mastliften en ladderliften aan ZZP'ers, aannemers en particulieren in heel Nederland. Meer dan 50 BMWT-gecertificeerde machines, direct beschikbaar.",
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalogus",
  menuAdvisorLabel: "Snel Advies", // legacy/unused; retained so the schema column stays populated
  menuOrdersLabel: "Mijn Account",
  menuAdminLabel: "Portaal"
};

const mockCustomers = [
  {
    email: "jan@devriesschilderwerken.nl",
    name: "Jan de Vries",
    phone: "+31 6 12345678",
    companyName: "De Vries Schilderwerken B.V.",
    profile: "Schilder",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop"
  },
  {
    email: "sven@meer-groen.nl",
    name: "Sven van der Meer",
    phone: "+31 6 87654321",
    companyName: "MeerGroen Boomverzorging",
    profile: "Hovenier / Groenverzorging",
    avatarUrl: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=150&auto=format&fit=crop"
  },
  {
    email: "l.bakker@bakkerclean.nl",
    name: "Lieke Bakker",
    phone: "+31 6 49201837",
    companyName: "Bakker Glazenwasserij & Gevelonderhoud",
    profile: "Glazenwasser / Gevelreiniger",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop"
  },
  {
    email: "daan@huizingabouwtech.nl",
    name: "Daan Huizinga",
    phone: "+31 6 38402174",
    companyName: "Huizinga Bouw & Renovatie",
    profile: "Aannemer",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop"
  },
  {
    email: "mila.v@xs4all.nl",
    name: "Mila Visser",
    phone: "+31 6 77281944",
    companyName: "",
    profile: "Particulier",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop"
  }
];

async function main() {
  console.log("Removing klussensets machines and category...");
  await prisma.machine.deleteMany({ where: { category: "klussensets" } });
  await prisma.category.deleteMany({ where: { id: "klussensets" } });

  console.log("Seeding categories (upsert)...");
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { label: cat.label, listLabel: cat.listLabel, desc: cat.desc, heights: cat.heights, price: cat.price, infoContent: (cat as any).infoContent ?? null },
      create: cat
    });
  }

  console.log("Seeding machines (create-only + flat-rate backfill)...");
  for (const mach of defaultMachines) {
    // Never overwrite admin-customized data (prices, images, discounts) on existing machines.
    // Only insert when the machine does not yet exist.
    await prisma.machine.upsert({
      where: { id: mach.id },
      update: {}, // preserve all admin changes
      create: mach
    });
    // Back-fill the three flat-rate price fields that were added 2026-06.
    // Only write them when the column is still null (first run after db push).
    const wp  = (mach as any).weekendPrice ?? null;
    const tdp = (mach as any).twoDayPrice  ?? null;
    const t3p = (mach as any).threeDayPrice ?? null;
    const t4p = (mach as any).fourDayPrice  ?? null;
    const wkp = (mach as any).weeklyPrice  ?? null;
    const edp = (mach as any).extraDayPrice ?? null;
    const mp  = (mach as any).monthlyPrice ?? null;
    const odp = (mach as any).oneDayPrice  ?? null;
    const sbf = (mach as any).sundayBlockFee ?? null;
    if (wp  !== null) await prisma.machine.updateMany({ where: { id: mach.id, weekendPrice: null }, data: { weekendPrice: wp } });
    if (tdp !== null) await prisma.machine.updateMany({ where: { id: mach.id, twoDayPrice:  null }, data: { twoDayPrice:  tdp } });
    if (t3p !== null) await prisma.machine.updateMany({ where: { id: mach.id, threeDayPrice: null }, data: { threeDayPrice: t3p } });
    if (t4p !== null) await prisma.machine.updateMany({ where: { id: mach.id, fourDayPrice:  null }, data: { fourDayPrice:  t4p } });
    if (wkp !== null) await prisma.machine.updateMany({ where: { id: mach.id, weeklyPrice:  null }, data: { weeklyPrice:  wkp } });
    // extraDayPrice: added 2026-07. Back-filled when null (covers both brand-new
    // rows and existing rows that predate this column) so the day-6+ tier price
    // uses the real "Ekstra Dag" rate instead of the weeklyPrice/5 fallback.
    if (edp !== null) await prisma.machine.updateMany({ where: { id: mach.id, extraDayPrice: null }, data: { extraDayPrice: edp } });
    if (mp  !== null) await prisma.machine.updateMany({ where: { id: mach.id, monthlyPrice: null }, data: { monthlyPrice: mp } });
    if (odp !== null) await prisma.machine.updateMany({ where: { id: mach.id, oneDayPrice:  null }, data: { oneDayPrice:  odp } });
    if (sbf !== null) await prisma.machine.updateMany({ where: { id: mach.id, sundayBlockFee: null }, data: { sundayBlockFee: sbf } });
  }

  // Bravi Leonardo — migrate to the tiered pricing + weekend-rules pilot. Guarded on
  // the previous flat weeklyPrice (110) so intentional admin edits are never clobbered;
  // brand-new databases already get these via `create` above and skip this no-op.
  console.log("Configuring Bravi Leonardo (tiered pricing + weekend rules)...");
  await prisma.machine.updateMany({
    where: { id: "bravi-mini-hd", weeklyPrice: 110 },
    data: {
      twoDayPrice: 80,
      threeDayPrice: 105,
      fourDayPrice: 125,
      weeklyPrice: 140,
      weekendPrice: 69,
      sundayBlockFee: 20,
      weekendRulesEnabled: true
    }
  });

  // Correct pricePerDay for Nifty actie-machines: it was seeded as the actie price (50/60)
  // but must be the regular day rate (95/120 = twoDayPrice/2) for correct multi-day calculations.
  // Only corrects if price is still at the original wrong value — preserves any intentional admin edits.
  console.log("Correcting Nifty regular day rates (pricePerDay)...");
  for (const [id, wrongPrice, correctPrice] of [
    ["nifty-120-1", 50, 95], ["nifty-120-2", 50, 95], ["nifty-120-3", 50, 95],
    ["nifty-170", 60, 120]
  ] as [string, number, number][]) {
    await prisma.machine.updateMany({ where: { id, pricePerDay: wrongPrice }, data: { pricePerDay: correctPrice } });
  }

  // Configure the Altrex Kamersteiger: min 2 days, 2-day €15, 3-5 days €19 flat, pickup-only.
  // Guarded on the original scaffold day-rate (35) so a later admin edit is never clobbered;
  // brand-new databases get the full config via `create` above and skip this no-op.
  console.log("Configuring Altrex Kamersteiger (2-dag min, €15/2dgn, €19/week, pickup-only)...");
  await prisma.machine.updateMany({
    where: { id: "altrex-rs44", pricePerDay: 35 },
    data: {
      name: "Altrex RS TOWER 44-Power Kamersteiger",
      pricePerDay: 19,
      twoDayPrice: 15,
      weeklyPrice: 19,
      minRentalDays: 2,
      weeklyOnly: false,
      pickupOnly: true,
      description: "Veilig, licht en originele Altrex-kwaliteit. Inklapbaar en eenvoudig op te bouwen voor uw renovatieklussen binnen en buiten.",
      packageContents: "Inklapbaar hoofdframe (Module A); Werkplatform; Zwenkwielenset met rem; **Wettelijk verplichte driehoekstabilisatoren (inbegrepen)**",
      crossSellAddons: [
        { id: "altrex-rs44-uitbreiding", name: "Uitbreidingsset (Module B)", description: "Extra originele Altrex bovenbuizenset om uw werkhoogte van 2,75 m naar 4 m te verhogen.", pricePerWeek: 19 },
        { id: "altrex-rs44-toolbuddy", name: "Altrex Toolbuddy", description: "Praktische ophanghaak zodat uw gereedschap en verfemmer binnen handbereik blijven tijdens het werken.", pricePerWeek: 5 }
      ]
    }
  });

  // Altrex RS 44: ensure weeklyOnly=false and minRentalDays=2 on every seed run.
  // The pricePerDay: 35 guard above only ran once — production machines that already had
  // pricePerDay: 19 kept weeklyOnly: true (old default) and minRentalDays: null/7,
  // causing the calendar to block all sub-week selections. weeklyOnly must always be false:
  // this machine uses the tiered flat-rate system (twoDayPrice + weeklyPrice tiers), not
  // per-week billing. minRentalDays is only corrected when null to preserve intentional edits.
  console.log("Correcting Altrex RS 44 billing mode (weeklyOnly=false, minRentalDays≥2)...");
  await prisma.machine.updateMany({
    where: { id: "altrex-rs44" },
    data: { weeklyOnly: false }
  });
  await prisma.machine.updateMany({
    where: { id: "altrex-rs44", minRentalDays: null },
    data: { minRentalDays: 2 }
  });

  // One-off correction: RS 44-POWER base working height is 2.75 m (Module B upgrades it to 4 m),
  // and Module B (Uitbreidingsset) is €19/week. Guarded on the previous height (4 m) so any later
  // admin edit to the height is preserved and re-runs are a no-op.
  console.log("Correcting Altrex RS 44 (2.75 m base, Module B → 4 m @ €19/wk)...");
  await prisma.machine.updateMany({
    where: { id: "altrex-rs44", height: 4 },
    data: {
      height: 2.75,
      crossSellAddons: [
        { id: "altrex-rs44-uitbreiding", name: "Uitbreidingsset (Module B)", description: "Extra originele Altrex bovenbuizenset om uw werkhoogte van 2,75 m naar 4 m te verhogen.", pricePerWeek: 19 },
        { id: "altrex-rs44-toolbuddy", name: "Altrex Toolbuddy", description: "Praktische ophanghaak zodat uw gereedschap en verfemmer binnen handbereik blijven tijdens het werken.", pricePerWeek: 5 }
      ]
    }
  });

  // 2026-07 competitive price refresh — full tier ladder (1/2/3/4/5-dag, weekend,
  // maand) for the Dikey Mast, Makaslı, Hinowa Örümcek, Ladderlift en Nifty groepen,
  // per het nieuwe prijzenblad. Elke update is guarded op de vorige bekende waarde,
  // zodat dit een eenmalige correctie is: een latere handmatige admin-wijziging wordt
  // nooit overschreven, en een fresh install (die de nieuwe prijzen al via `create`
  // krijgt) slaat deze blokken automatisch over als no-op.
  console.log("Applying 2026-07 competitive price refresh...");
  await prisma.machine.updateMany({
    where: { id: "bravi-mini-hd", pricePerDay: 45, monthlyPrice: 320 },
    data: { pricePerDay: 40, monthlyPrice: 340 }
  });
  await prisma.machine.updateMany({
    where: { id: "jlg-1230es", pricePerDay: 45, weeklyPrice: 110 },
    data: { pricePerDay: 40, twoDayPrice: 80, threeDayPrice: 105, fourDayPrice: 125, weeklyPrice: 140, monthlyPrice: 340 }
  });
  await prisma.machine.updateMany({
    where: { id: "skyjack-sj16", pricePerDay: 55, weeklyPrice: 140 },
    data: { pricePerDay: 49, twoDayPrice: 90, threeDayPrice: 115, fourDayPrice: 136, weeklyPrice: 150, weekendPrice: 75, monthlyPrice: 370 }
  });
  await prisma.machine.updateMany({
    where: { id: "star-10", pricePerDay: 95, weeklyPrice: 260 },
    data: { pricePerDay: 130, twoDayPrice: 230, threeDayPrice: 280, fourDayPrice: 360, weeklyPrice: 405, weekendPrice: 200, monthlyPrice: 980 }
  });
  await prisma.machine.updateMany({
    where: { id: "dingli-6m", pricePerDay: 49, weeklyPrice: 120 },
    data: { pricePerDay: 55, twoDayPrice: 95, threeDayPrice: 125, fourDayPrice: 135, weeklyPrice: 145, weekendPrice: 85, monthlyPrice: 390 }
  });
  await prisma.machine.updateMany({
    where: { id: { in: ["optimum-8-1", "optimum-8-2"] }, pricePerDay: 65, weeklyPrice: 159 },
    data: { pricePerDay: 75, twoDayPrice: 130, threeDayPrice: 170, fourDayPrice: 185, weeklyPrice: 195, weekendPrice: 115, monthlyPrice: 540 }
  });
  await prisma.machine.updateMany({
    where: { id: { in: ["compact-8-1", "compact-8-2"] }, pricePerDay: 65, weeklyPrice: 159 },
    data: { pricePerDay: 78, twoDayPrice: 130, threeDayPrice: 170, fourDayPrice: 185, weeklyPrice: 195, weekendPrice: 115, monthlyPrice: 540 }
  });
  await prisma.machine.updateMany({
    where: { id: { in: ["compact-10n-1", "compact-10n-2"] }, pricePerDay: 89, weeklyPrice: 215 },
    data: { pricePerDay: 95, twoDayPrice: 165, threeDayPrice: 215, fourDayPrice: 235, weeklyPrice: 250, weekendPrice: 145, monthlyPrice: 680 }
  });
  await prisma.machine.updateMany({
    where: { id: "hinowa-15-70", pricePerDay: 200, weeklyPrice: 750 },
    data: { pricePerDay: 228, twoDayPrice: 390, threeDayPrice: 520, fourDayPrice: 560, weeklyPrice: 590, weekendPrice: 340, monthlyPrice: 1750 }
  });
  await prisma.machine.updateMany({
    where: { id: "hinowa-17-75", pricePerDay: 250, weeklyPrice: 920 },
    data: { pricePerDay: 275, twoDayPrice: 470, threeDayPrice: 630, fourDayPrice: 680, weeklyPrice: 715, weekendPrice: 410, monthlyPrice: 2100 }
  });
  await prisma.machine.updateMany({
    where: { id: "ladderlift-18", pricePerDay: 89, weeklyPrice: 290 },
    data: { pricePerDay: 120, twoDayPrice: 210, threeDayPrice: 280, fourDayPrice: 310, weeklyPrice: 330, weekendPrice: 180, monthlyPrice: 990 }
  });
  await prisma.machine.updateMany({
    where: { id: { in: ["ladderlift-21-1", "ladderlift-21-2"] }, pricePerDay: 110, weeklyPrice: 360 },
    data: { pricePerDay: 135, twoDayPrice: 235, threeDayPrice: 315, fourDayPrice: 350, weeklyPrice: 375, weekendPrice: 200, monthlyPrice: 1125 }
  });
  await prisma.machine.updateMany({
    where: { id: { in: ["nifty-120-1", "nifty-120-2", "nifty-120-3"] }, twoDayPrice: 190, weeklyPrice: 335 },
    data: { twoDayPrice: 170, threeDayPrice: 260, fourDayPrice: 310, weeklyPrice: 340, weekendPrice: 120, monthlyPrice: 990 }
  });
  await prisma.machine.updateMany({
    where: { id: "nifty-170", twoDayPrice: 240, weekendPrice: 195 },
    data: { twoDayPrice: 210, threeDayPrice: 320, fourDayPrice: 390, weekendPrice: 150, monthlyPrice: 1250 }
  });

  console.log("Seeding blocked dates (upsert)...");
  for (const bd of defaultBlockedDates) {
    await prisma.blockedDate.upsert({
      where: { id: bd.id },
      update: { machineId: bd.machineId, date: bd.date, reason: bd.reason },
      create: bd
    });
  }

  console.log("Seeding site config (create only, preserve existing)...");
  await prisma.siteConfig.upsert({
    where: { id: defaultSiteConfig.id },
    update: {}, // Never overwrite admin-customized settings
    create: defaultSiteConfig
  });

  console.log("Seeding admin (upsert)...");
  const adminEmail = "admin@huurgo.nl";
  // Never seed a guessable password: without ADMIN_DEFAULT_PASSWORD a random
  // one is generated and printed once to the deploy log
  let adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(12).toString("base64url");
    console.warn(`[Seed] ADMIN_DEFAULT_PASSWORD not set — generated admin password (save it now, shown only once): ${adminPassword}`);
  }
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {}, // Preserve existing admin password if already set
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: "huurgo Admin",
      role: "admin"
    }
  });

  // Demo-klanten en demo-orders horen niet in productie thuis (voorheen
  // moest scripts/cleanup-demo-data.sh ze achteraf verwijderen). Alleen
  // seeden buiten productie, of wanneer expliciet gevraagd.
  const seedDemoData =
    process.env.SEED_DEMO_DATA === "true" || process.env.NODE_ENV !== "production";
  if (!seedDemoData) {
    console.log("Skipping demo customers/orders (production — set SEED_DEMO_DATA=true to include).");
    console.log("Seeding completed successfully!");
    return;
  }

  console.log("Seeding customer profiles (upsert)...");
  const customerPasswordHash = await bcrypt.hash("customer123", 12);
  const createdCustomers: Record<string, string> = {};

  for (const customerData of mockCustomers) {
    const cust = await prisma.customer.upsert({
      where: { email: customerData.email },
      update: {
        name: customerData.name,
        phone: customerData.phone || null,
        profile: customerData.profile,
        companyName: customerData.companyName || null,
        avatarUrl: customerData.avatarUrl || null,
      },
      create: {
        email: customerData.email,
        passwordHash: customerPasswordHash,
        name: customerData.name,
        phone: customerData.phone || null,
        profile: customerData.profile,
        companyName: customerData.companyName || null,
        avatarUrl: customerData.avatarUrl || null,
        isEmailVerified: true,
        verificationToken: null
      }
    });
    createdCustomers[cust.email] = cust.id;
  }

  console.log("Seeding default orders...");
  const orderId = "HWH-9921";
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existingOrder) {
    await prisma.order.create({
      data: {
        id: orderId,
        machineId: "optimum-8-1",
        machineName: "Haulotte Optimum 8 Schaarlift",
        machinePrice: 80,
        startDate: new Date("2026-06-05"),
        endDate: new Date("2026-06-08"),
        rentalDays: 3,
        deliveryType: "delivery_by_us",
        deliveryAddress: "Keizersgracht 420, 1016 EK Amsterdam",
        customerName: "Jan de Vries",
        customerEmail: "jan@devriesschilderwerken.nl",
        customerPhone: "+31 6 12345678",
        customerProfile: "Schilder",
        subtotal: 240,
        transportCost: 120,
        driverCost: 150,
        vatAmount: 107.1,
        totalAmount: 617.1,
        status: "Goedgekeurd",
        customerId: createdCustomers["jan@devriesschilderwerken.nl"],
        addons: JSON.stringify([])
      }
    });
  }

  const secondOrderId = "HWH-9918";
  const existingSecondOrder = await prisma.order.findUnique({ where: { id: secondOrderId } });
  if (!existingSecondOrder) {
    await prisma.order.create({
      data: {
        id: secondOrderId,
        machineId: "hinowa-15-70",
        machineName: "Hinowa Goldlift 15.70 Rupshoogwerker",
        machinePrice: 160,
        startDate: new Date("2026-06-12"),
        endDate: new Date("2026-06-13"),
        rentalDays: 1,
        deliveryType: "self_pickup",
        customerName: "Sven van der Meer",
        customerEmail: "sven@meer-groen.nl",
        customerPhone: "+31 6 87654321",
        customerProfile: "Hovenier / Groenverzorging",
        subtotal: 160,
        transportCost: 0,
        driverCost: 0,
        vatAmount: 33.6,
        totalAmount: 193.6,
        status: "In behandeling",
        customerId: createdCustomers["sven@meer-groen.nl"],
        addons: JSON.stringify([])
      }
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
