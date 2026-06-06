import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultCategories = [
  { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.", heights: "12m - 17m", price: "v.a. €80/dag" },
  { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.", heights: "15m - 17m", price: "v.a. €160/dag" },
  { id: "schaarlift", label: "Schaarlift (8m)", listLabel: "Schaarliften (8m)", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.", heights: "8m", price: "v.a. €80/dag" },
  { id: "schaarlift-smal", label: "Smal Model Schaarlift (10m)", listLabel: "Schaarliften (10m smal)", desc: "Compacte en smalle schaarlift voor nauwe gangpaden en binnenruimtes tot 10 meter werkhoogte.", heights: "10m", price: "v.a. €95/dag" },
  { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.", heights: "5m - 10m", price: "v.a. €75/dag" },
  { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.", heights: "18m - 21m", price: "v.a. €90/dag" },
  { id: "ecolift", label: "Ecolift", listLabel: "Ecolift", desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.", heights: "4.2m", price: "v.a. €45/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete kluspakketten speciaal samengesteld voor specifieke ZZP- en particuliere klussen.", heights: "4m - 21m", price: "v.a. €80/dag" }
];

const defaultMachines = [
  // KATEGORİ 1: "Toe & Go" Aanhangerhoogwerkers
  {
    id: "nifty-120-1",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Uiterst wendbare en compacte aanhangerhoogwerker, eenvoudig zelf mee te nemen met rijbewijs B. Geen transportkosten en binnen 5 minuten stabiel opgesteld voor uw gevel- of schilderklus.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "nifty-120-2",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker (Unit 2)",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Compacte aanhangerhoogwerker (Unit 2). Makkelijk aan te koppelen en te manoeuvreren op uw werkplek.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "nifty-120-3",
    name: "Nifty 120 \"Toe & Go\" Aanhangerhoogwerker (Unit 3)",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Nifty 120 aanhangerhoogwerker met trekhaak",
    description: "Betrouwbare Nifty 120 aanhangerhoogwerker (Unit 3) met telescooparm.",
    suitableFor: ["Schilder", "Particulier", "Installateur"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "nifty-170",
    name: "Nifty 170 \"Toe & Go\" Aanhangerhoogwerker",
    category: "aanhanger",
    categoryLabel: "\"Toe & Go\" Aanhangerhoogwerker",
    height: 17.1,
    reach: 8.7,
    weight: 2160,
    pricePerDay: 120,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Nifty 170 zware aanhangerhoogwerker",
    description: "Zware aanhangerhoogwerker met 17.1 meter werkhoogte en een gigantisch zijdelings bereik. Ideaal voor boomverzorging en gevelwerk aan hogere panden.",
    suitableFor: ["Hovenier", "Schilder", "Glazenwasser"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },

  // KATEGORİ 2: Paletli Örümcek Platformlar (Rupshoogwerkers)
  {
    id: "hinowa-15-70",
    name: "Hinowa Goldlift 15.70 Rupshoogwerker",
    category: "spin",
    categoryLabel: "Rupshoogwerker",
    height: 15.4,
    reach: 6.6,
    weight: 1400,
    pricePerDay: 160,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Hinowa 15.70 spinhoogwerker op rupsbanden",
    description: "Compacte örümcek lift op rupsbanden. Past door een tuinpoort van slechts 80cm breed. Optimale drukverdeling op kwetsbare bodems.",
    suitableFor: ["Hovenier", "Schilder", "Gevelreiniger"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "hinowa-17-75",
    name: "Hinowa Lightlift 17.75 Rupshoogwerker",
    category: "spin",
    categoryLabel: "Rupshoogwerker",
    height: 17.06,
    reach: 7.5,
    weight: 2200,
    pricePerDay: 180,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Hinowa 17.75 zware spinhoogwerker",
    description: "Krachtige, lichte spinhoogwerker op rupsbanden. Perfect voor gevelwerken en onderhoud in krappe buitenlocaties tot 17 meter.",
    suitableFor: ["Hovenier", "Aannemer", "Glazenwasser"],
    weeklyDiscountPercent: 15,
    monthlyDiscountPercent: 30
  },

  // KATEGORİ 3: Standart Akülü Makaslı Liftler (Schaarliften - 8 Metre)
  {
    id: "optimum-8-1",
    name: "Haulotte Optimum 8 Schaarlift",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 7.76,
    reach: 0,
    weight: 1520,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Optimum 8 scissor lift",
    description: "Compacte elektrische schaarlift voor stabiel rechtlijnig binnenwerk op 8 meter. Non-marking banden voorkomen strepen op vloeren.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "optimum-8-2",
    name: "Haulotte Optimum 8 Schaarlift (Unit 2)",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 7.76,
    reach: 0,
    weight: 1520,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Optimum 8 scissor lift",
    description: "Compacte elektrische schaarlift (Unit 2) voor installatie en schilderwerk binnen.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "compact-8-1",
    name: "Haulotte Compact 8 Schaarlift",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 8.2,
    reach: 0,
    weight: 1650,
    pricePerDay: 85,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Compact 8 scissor lift",
    description: "Stabiele elektrische schaarlift met een extra ruim platform dankzij het uitschuifbare dek. Uitstekend geschikt voor onderhoud en montage.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "compact-8-2",
    name: "Haulotte Compact 8 Schaarlift (Unit 2)",
    category: "schaarlift",
    categoryLabel: "Schaarlift (8m)",
    height: 8.2,
    reach: 0,
    weight: 1650,
    pricePerDay: 85,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Compact 8 scissor lift",
    description: "Stabiele elektrische schaarlift (Unit 2) met uitschuifbaar dek.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },

  // KATEGORİ 4: Dar Şasi Akülü Makaslı Liftler (Smal model - 10 Metre)
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
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Met een breedte van slechts 81cm is deze smalle schaarlift perfect voor nauwe gangpaden in magazijnen en krappe binnenruimtes tot 10 meter.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
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
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Compact 10N smalle schaarlift",
    description: "Smalle schaarlift (Unit 2) met non-marking banden voor compact og geruisloos binnenwerk.",
    suitableFor: ["Installateur", "Schilder", "Magazijn"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },

  // KATEGORİ 5: Dikey Mastlı Personel Yükselticiler (Mastliften)
  {
    id: "star-10",
    name: "Haulotte Star 10 Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 10.0,
    reach: 3.0,
    weight: 2677,
    pricePerDay: 110,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Haulotte Star 10 mastlift met knikarm",
    description: "Verticale mastlift met 10 meter werkhoogte en een knikarm voor 3.0 meter horizontaal bereik. Past perfect door binnendeuren.",
    suitableFor: ["Schilder", "Installateur", "Restauratie"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "skyjack-sj16",
    name: "Skyjack SJ16 Verticale Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 6.6,
    reach: 0,
    weight: 966,
    pricePerDay: 78,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Skyjack SJ16 verticale mastlift",
    description: "Uiterst lichte en compacte verticale mastlift. Ideaal voor kantooronderhoud, winkelinrichting en lichte montagewerkzaamheden op vlakke vloeren.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "bravi-mini-hd",
    name: "Bravi Leonardo HD Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 4.9,
    reach: 0,
    weight: 510,
    pricePerDay: 75,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Bravi Leonardo HD compacte lift",
    description: "De meest compacte en robuuste lift in zijn klasse. Rijdt moeiteloos door standaard deuropeningen en is dankzij het gewicht van 510kg uiterst liftvriendelijk.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "jlg-1230es",
    name: "JLG 1230ES Verticale Mastlift",
    category: "mastlift",
    categoryLabel: "Mastlift",
    height: 5.5,
    reach: 0,
    weight: 790,
    pricePerDay: 76,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600&auto=format&fit=crop",
    imageAlt: "JLG 1230ES mastlift",
    description: "Betrouwbare en energiezuinige mastlift met elektrisch rijsysteem. Zeer lange accuduur voor intensieve binnenklussen tot 5.5 meter.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },

  // KATEGORİ 6: Eşya ve Yük Asansörleri (Verhuisliften / Ladderliften)
  {
    id: "ladderlift-18",
    name: "Ladderlift / Verhuislift (18m)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 18.0,
    reach: 0,
    weight: 1200,
    pricePerDay: 90,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Ladderlift verhuislift 18m",
    description: "Compact opstelbare ladderlift voor het veilig transporteren van verhuisdozen, meubilair of bouwmaterialen via het raam of balkon tot de 5e verdieping.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25
  },
  {
    id: "ladderlift-21-1",
    name: "Ladderlift / Verhuislift Heavy-Load (21m)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 21.0,
    reach: 0,
    weight: 1350,
    pricePerDay: 110,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Zware verhuislift ladderlift 21m",
    description: "Sterke en stabiele ladderlift met 21 meter bereik. Perfect voor grote verhuizingen, dakdekkers en installatieklussen aan hoge gevels.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "ladderlift-21-2",
    name: "Ladderlift / Verhuislift Heavy-Load (21m) (Unit 2)",
    category: "ladderlift",
    categoryLabel: "Ladderlift",
    height: 21.0,
    reach: 0,
    weight: 1350,
    pricePerDay: 110,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Zware verhuislift ladderlift 21m Unit 2",
    description: "Stabiele 21m ladderlift (Unit 2) voor verhuizers en installateurs.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },

  // KATEGORİ 7: İnsan Gücüyle Yürüyen Hafif Sınıf (Ecolift)
  {
    id: "ecolift",
    name: "JLG Ecolift Low-Level Access",
    category: "ecolift",
    categoryLabel: "Ecolift",
    height: 4.2,
    reach: 0,
    weight: 305,
    pricePerDay: 45,
    powerType: "Handmatig",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "JLG Ecolift handmatige lift",
    description: "Volledig milieuvriendelijke low-level access lift. Geen batterijen, olie of hydrauliek nodig. Draai simpelweg aan het wiel om uzelf tot 4.2 meter werkhoogte te liften. Geluidloos en veilig.",
    suitableFor: ["Schilder", "Installateur", "Particulier"],
    weeklyDiscountPercent: 5,
    monthlyDiscountPercent: 15
  },

  // KATEGORİ 8: Kluspakketten (klussensets)
  {
    id: "set-paint-comfort",
    name: "ZZP Schilder Comfort Set (8m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 8.0,
    reach: 0,
    weight: 1520,
    pricePerDay: 90,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Schilderspakket",
    description: "Speciaal schilderspakket inclusief Haulotte Optimum 8 scissor lift, speciale vloerbeschermingsmatten og 2x 20m IP44 verlengkabels.",
    suitableFor: ["Schilder", "Particulier"],
    weeklyDiscountPercent: 10,
    campaignText: "SchilderKorting",
    campaignDiscountPercent: 5
  },
  {
    id: "set-solar-pro",
    name: "ZZP Zonnepaneel Installatie Set (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 135,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Solar Montage set",
    description: "Ideaal voor installateurs van zonnepanelen. Inclusief Nifty 120 'Toe & Go' aanhangerlift met trekhaak, handige materiaalhaken en een veiligheidsharnas.",
    suitableFor: ["Installateur", "Aannemer"],
    weeklyDiscountPercent: 15,
    campaignText: "EcoHuur",
    campaignDiscountAmount: 20
  },
  {
    id: "set-prune-compact",
    name: "Groen & Snoei Rups Set (15m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 15.4,
    reach: 6.6,
    weight: 1400,
    pricePerDay: 185,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Tuin Snoei compact set",
    description: "Uitstekende set voor boom- en tuinonderhoud. Inclusief Hinowa 15.70 spinhoogwerker op rupsbanden, 4x plastic rijplaten en zaag-veiligheidsset.",
    suitableFor: ["Hovenier", "Particulier"],
    weeklyDiscountPercent: 12
  },
  {
    id: "set-gutter-fast",
    name: "Dakgoot & Reiniging Snelstart (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12.2,
    reach: 6.1,
    weight: 1400,
    pricePerDay: 115,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Dakgoot kit",
    description: "Bespaar op logistiek met de Nifty 120 'Toe & Go' trailerhoogwerker. Inclusief speciale dakgootschepset en veiligheidslijn.",
    suitableFor: ["Particulier", "Glazenwasser"],
    weeklyDiscountPercent: 10,
    campaignText: "DakGootActie",
    campaignDiscountPercent: 8
  },
  {
    id: "set-facade-heavy",
    name: "ZZP Gevel & Metselwerk Set (17m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 17.06,
    reach: 7.5,
    weight: 2200,
    pricePerDay: 210,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gevel kit",
    description: "Professionele set voor zwaar buitenonderhoud en voegwerk. Inclusief Hinowa 17.75 spinhoogwerker op rupsbanden en hogedrukslangophanging.",
    suitableFor: ["Gevelreiniger", "Aannemer"],
    weeklyDiscountPercent: 15
  },
  {
    id: "set-window-premium",
    name: "Verhuizing & Ladderlift Set (21m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 21.0,
    reach: 0,
    weight: 1350,
    pricePerDay: 130,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Glasbewassing",
    description: "Compleet pakket voor verhuizingen of meebeltransport. Inclusief 21m ladderlift, 4x meubel-verhuisdekens en stevige spanbanden.",
    suitableFor: ["Particulier", "Aannemer"],
    weeklyDiscountPercent: 12
  }
];

const defaultBlockedDates = [
  { id: "b1", machineId: "optimum-8-1", date: new Date("2026-06-15"), reason: "Onderhoud BMWT" },
  { id: "b2", machineId: "optimum-8-1", date: new Date("2026-06-16"), reason: "Onderhoud BMWT" },
  { id: "b3", machineId: "nifty-120-1", date: new Date("2026-06-20"), reason: "Calibratie keuring" },
  { id: "b4", machineId: "set-paint-comfort", date: new Date("2026-06-10"), reason: "Gereserveerd voor demo" }
];

const defaultSiteConfig = {
  id: "default",
  siteName: "HuurGo",
  heroTagline: "Snel & Makkelijk Hoogwerkers Huren",
  heroTitle: "Huur uw hoogwerker in een handomdraai.",
  heroSubtitle: "HuurGo is er voor ZZP'ers en particulieren. Geen gedoe, direct online geregeld. Vind binnen 1 minuut de perfecte machine voor uw schilderklus, tuinonderhoud of gevelwerk met onze slimme AI-assistent.",
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalogus",
  menuAdvisorLabel: "AI Adviseur",
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
  console.log("Seeding categories (upsert)...");
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { label: cat.label, listLabel: cat.listLabel, desc: cat.desc, heights: cat.heights, price: cat.price },
      create: cat
    });
  }

  console.log("Seeding machines (upsert)...");
  for (const mach of defaultMachines) {
    await prisma.machine.upsert({
      where: { id: mach.id },
      update: {
        name: mach.name,
        category: mach.category,
        categoryLabel: mach.categoryLabel,
        height: mach.height,
        reach: mach.reach,
        weight: mach.weight,
        pricePerDay: mach.pricePerDay,
        powerType: mach.powerType,
        imageUrl: mach.imageUrl,
        imageAlt: mach.imageAlt,
        description: mach.description,
        suitableFor: mach.suitableFor,
        weeklyDiscountPercent: mach.weeklyDiscountPercent ?? null,
        monthlyDiscountPercent: mach.monthlyDiscountPercent ?? null,
        campaignText: (mach as any).campaignText ?? null,
        campaignDiscountPercent: (mach as any).campaignDiscountPercent ?? null,
        campaignDiscountAmount: (mach as any).campaignDiscountAmount ?? null,
      },
      create: mach
    });
  }

  console.log("Seeding blocked dates (upsert)...");
  for (const bd of defaultBlockedDates) {
    await prisma.blockedDate.upsert({
      where: { id: bd.id },
      update: { machineId: bd.machineId, date: bd.date, reason: bd.reason },
      create: bd
    });
  }

  console.log("Seeding site config (upsert)...");
  await prisma.siteConfig.upsert({
    where: { id: defaultSiteConfig.id },
    update: defaultSiteConfig,
    create: defaultSiteConfig
  });

  console.log("Seeding admin (upsert)...");
  const adminEmail = "admin@huurgo.nl";
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      name: "HuurGo Admin",
      role: "admin"
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: "HuurGo Admin",
      role: "admin"
    }
  });

  console.log("Seeding customer profiles (upsert)...");
  const customerPasswordHash = await bcrypt.hash("customer123", 10);
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
        deliveryType: "delivery_with_driver",
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
