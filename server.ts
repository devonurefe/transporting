import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDirectoryExistence(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJsonFile(fileName: string, defaultValue: any) {
  ensureDirectoryExistence(DATA_DIR);
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
    return defaultValue;
  }
}

function saveJsonFile(fileName: string, data: any) {
  ensureDirectoryExistence(DATA_DIR);
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${fileName}:`, err);
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory Database
const defaultMachines: any[] = [
  {
    id: "schaar-elek",
    name: "Elektrische Schaarlift (12m)",
    category: "schaarlift",
    categoryLabel: "Schaarlift",
    height: 12,
    reach: 0,
    weight: 2800,
    pricePerDay: 120,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gele elektrische schaarlift voor binnengebruik en schilderwerk",
    description: "Perfect geschikt voor binnenwerkzaamheden, installatiewerk, en schilderwerk in sporthallen of magazijnen. Emissievrij en voorzien van non-marking banden.",
    suitableFor: ["Schilder", "Installateur", "Magazijn", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25,
    campaignText: "Lente Actie",
    campaignDiscountPercent: 5
  },
  {
    id: "knik-diesel",
    name: "Knikarmhoogwerker (18m)",
    category: "knikarm",
    categoryLabel: "Knikarmhoogwerker",
    height: 18,
    reach: 16,
    weight: 7200,
    pricePerDay: 210,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Knikarmhoogwerker werkzaam op bouwterrein",
    description: "Uiterst flexibele hoogwerker met knik-telescoop constructie. Ideaal om over obstakels heen te reiken bij gevelreiniging of renovatie.",
    suitableFor: ["Glazenwasser", "Aannemer", "Gevelreiniger"],
    weeklyDiscountPercent: 15,
    monthlyDiscountPercent: 30,
    campaignText: "GevelSpecial",
    campaignDiscountAmount: 45
  },
  {
    id: "tele-diesel",
    name: "Telescoophoogwerker Heavy-Duty (26m)",
    category: "telescoop",
    categoryLabel: "Telescoophoogwerker",
    height: 26,
    reach: 24,
    weight: 11500,
    pricePerDay: 340,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Grote telescoophoogwerker op ruw terrein",
    description: "Maximale reikwijdte and werkhoogte op uitdagende bouwterreinen. 4WD aangedreven met krachtige prestaties voor zware industriële projecten.",
    suitableFor: ["Aannemer", "Industriebouw", "Dakdekker"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "truck-b",
    name: "Autohoogwerker B-Rijbewijs (22m)",
    category: "auto",
    categoryLabel: "Autohoogwerker",
    height: 22,
    reach: 20,
    weight: 3500,
    pricePerDay: 250,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Autohoogwerker gemonteerd op busje voor openbare verlichting",
    description: "Zelf rijden naar uw klus met een standaard autorijbewijs B. Snel operationeel met hydraulische stempels, perfect voor straatverlichting en boomverzorging.",
    suitableFor: ["Gemeente", "Boomverzorging", "Schilder", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25,
    campaignText: "LenteKorting",
    campaignDiscountPercent: 8
  },
  {
    id: "spin-crawl",
    name: "Spinhoogwerker Spider (15m)",
    category: "spin",
    categoryLabel: "Spinhoogwerker",
    height: 15,
    reach: 13,
    weight: 1900,
    pricePerDay: 180,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Spinhoogwerker op rubberen rupsbanden manoeuvrerend in smalle tuin",
    description: "Uiterst compacte spinhoogwerker op rubberen rupsbanden. Past door een standaard binnendeur, beschadigt kwetsbare vloeren niet, en stempelt overal af.",
    suitableFor: ["Hovenier", "Schilder", "Restauratie", "Binnenwerk"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "set-paint-comfort",
    name: "Schilderskit Extra Comfort (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12,
    reach: 0,
    weight: 2900,
    pricePerDay: 140,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Schilderskit Combiset",
    description: "Kant-en-klaar editie speciaal voor schilderwerk binnen. Inclusief 2x 20m verlengkabels, 1x luxe veiligheidsharnas, non-marking banden en vloerbeschermers.",
    suitableFor: ["Schilder", "Particulier"],
    weeklyDiscountPercent: 10,
    campaignText: "SchilderDeal",
    campaignDiscountPercent: 5
  },
  {
    id: "set-solar-pro",
    name: "Zonnepaneel Montage Pakket (18m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 18,
    reach: 16,
    weight: 7300,
    pricePerDay: 240,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Solar Montage set",
    description: "Perfect samengestelde set voor snelle zonnepaneelinstallatie op daken. Inclusief knikarmhoogwerker, handige materiaalgorrel/haken en all-risk kasko dekking.",
    suitableFor: ["Aannemer", "Installateur"],
    weeklyDiscountPercent: 15,
    campaignText: "EcoGarant",
    campaignDiscountAmount: 30
  },
  {
    id: "set-prune-compact",
    name: "Snoei & Tuin Compact Kit (15m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 15,
    reach: 13,
    weight: 1950,
    pricePerDay: 195,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Tuin Snoei compact set",
    description: "Compacte kit voor boomonderhoud of snoeiwerk. Inclusief Spinhoogwerker op rupsbanden, 4x plastic rijplaten tegen gazonbeschadiging en helm met gehoorbescherming.",
    suitableFor: ["Hovenier", "Boomverzorging"],
    weeklyDiscountPercent: 12
  },
  {
    id: "set-gutter-fast",
    name: "Dakgoot Reinigingsset Snelle Start",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 22,
    reach: 20,
    weight: 3500,
    pricePerDay: 265,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Dakgoot kit",
    description: "Zelf rijden met B-rijbewijs. Gemonteerd met een speciaal platformvak voor gereedschappen, dakgootschep-set en 230V stroomaansluiting in het platform.",
    suitableFor: ["Particulier", "Glazenwasser"],
    weeklyDiscountPercent: 10,
    campaignText: "GootDeal",
    campaignDiscountPercent: 8
  },
  {
    id: "set-facade-heavy",
    name: "Gevelreiniging Heavy-Duty Set (26m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 26,
    reach: 24,
    weight: 11600,
    pricePerDay: 375,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gevel kit",
    description: "Robuust telescooppakket voor veeleisende buitenreiniging. Inclusief slanghaspel-gevelextensie klemmen, hogedruk generator module en all-risk kasko dekking.",
    suitableFor: ["Glazenwasser", "Gevelreiniger"],
    weeklyDiscountPercent: 15
  },
  {
    id: "set-window-premium",
    name: "Glazenwasser Premium Kit (22m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 22,
    reach: 20,
    weight: 3500,
    pricePerDay: 270,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Glasbewassing",
    description: "Zelfrijdende truck hoogwerker (rijbewijs B) voorzien van osmose-watertank montage klemmen en brede platformbak voor veilig glasbewassing op hoogte.",
    suitableFor: ["Glazenwasser"],
    weeklyDiscountPercent: 12
  },
  {
    id: "set-diy-weekend",
    name: "Particuliere Weekend Deal (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12,
    reach: 0,
    weight: 2800,
    pricePerDay: 110,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Particuliere weekendset",
    description: "De ultieme doe-het-zelf favoriet voor schilderen of lampen vervangen. Inclusief veiligheidsharnas, helm en gratis telefonische advieslijn via onze AI-coördinator.",
    suitableFor: ["Particulier"],
    campaignText: "WeekendSpecial",
    campaignDiscountPercent: 10
  },
  {
    id: "set-light-install",
    name: "Licht & Camera Installatieset (15m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 15,
    reach: 13,
    weight: 1900,
    pricePerDay: 190,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Licht installatieset",
    description: "Ideaal voor installateurs van beveiligingscamera's, straatverlichting en sportveld armaturen. Inclusief spinhoogwerker, geactiveerde stroomhaspel kit en gemonteerde materiaalkorf.",
    suitableFor: ["Installateur"],
    weeklyDiscountPercent: 12
  },
  {
    id: "aanhanger-compact",
    name: "Aanhangerhoogwerker Compact (12m)",
    category: "aanhanger",
    categoryLabel: "Aanhangerhoogwerker",
    height: 12,
    reach: 6.5,
    weight: 1200,
    pricePerDay: 95,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Compacte aanhanger hoogwerker",
    description: "Zeer lichte en stabiele aanhangerhoogwerker. Eenvoudig zelf te transporteren met een standaard B/BE rijbewijs en uiterst compact wendbaar op locatie.",
    suitableFor: ["Particulier", "Schilder", "Installateur"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "tele-max",
    name: "Super-Reach Telescoophoogwerker (40m)",
    category: "telescoop",
    categoryLabel: "Telescoophoogwerker",
    height: 40,
    reach: 30,
    weight: 18500,
    pricePerDay: 480,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Super-reach telescoophoogwerker",
    description: "Onze allerhoogste telescoophoogwerker voor professionele megaprojecten. Voorzien van 4WD terreinaandrijving, uiterst robuuste mast en maximale klasse C-beveiliging.",
    suitableFor: ["Aannemer", "Industriebouw"],
    weeklyDiscountPercent: 15,
    monthlyDiscountPercent: 35
  }
];

const defaultBlockedDates: any[] = [
  { id: "b1", machineId: "schaar-elek", date: "2026-06-15", reason: "Onderhoud BMWT" },
  { id: "b2", machineId: "schaar-elek", date: "2026-06-16", reason: "Onderhoud BMWT" },
  { id: "b3", machineId: "knik-diesel", date: "2026-06-20", reason: "Calibratie keuring" },
  { id: "b4", machineId: "set-paint-comfort", date: "2026-06-10", reason: "Gereserveerd voor demo" }
];

const defaultOrders = [
  {
    id: "HWH-9921",
    machineId: "schaar-elek",
    machineName: "Elektrische Schaarlift (12m)",
    machinePrice: 120,
    startDate: "2026-06-05",
    endDate: "2026-06-08",
    rentalDays: 3,
    deliveryType: "delivery_with_driver",
    deliveryAddress: "Keizersgracht 420, 1016 EK Amsterdam",
    customerName: "Jan de Vries",
    customerEmail: "jan@devriesschilderwerken.nl",
    customerPhone: "+31 6 12345678",
    customerProfile: "Schilder",
    subtotal: 360,
    transportCost: 120,
    driverCost: 150,
    vatAmount: 132.3,
    totalAmount: 762.3,
    status: "Goedgekeurd",
    createdAt: "2026-05-29T12:30:15Z"
  },
  {
    id: "HWH-9918",
    machineId: "spin-crawl",
    machineName: "Spinhoogwerker Spider (15m)",
    machinePrice: 180,
    startDate: "2026-06-12",
    endDate: "2026-06-13",
    rentalDays: 1,
    deliveryType: "self_pickup",
    customerName: "Sven van der Berg",
    customerEmail: "sven@vanderberggroen.nl",
    customerPhone: "+31 6 87654321",
    customerProfile: "Hovenier / Groenverzorging",
    subtotal: 180,
    transportCost: 0,
    driverCost: 0,
    vatAmount: 37.8,
    totalAmount: 217.8,
    status: "In behandeling",
    createdAt: "2026-05-29T15:05:42Z"
  }
];

const defaultCategories = [
  { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor loodsen, schilder- en rechtlijnig montagewerk.", heights: "8m - 14m", price: "v.a. €120/dag" },
  { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over vaste obstakels heen te reiken.", heights: "12m - 20m", price: "v.a. €210/dag" },
  { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Gigantisch bereik op ruw bouwterrein.", heights: "16m - 40m", price: "v.a. €340/dag" },
  { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden met B-rijbewijs. Snel op locatie operationeel.", heights: "18m - 24m", price: "v.a. €250/dag" },
  { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Kruipt door binnendeuren en over zachte grasvelden.", heights: "12m - 22m", price: "v.a. €180/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Kant-en-klaar editie voor schilder, zonnepaneel of snoeiwerk.", heights: "10m - 26m", price: "v.a. €110/dag" },
  { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig te transporteren en direct achter de auto te koppelen.", heights: "12m - 17m", price: "v.a. €95/dag" }
];

const defaultSiteConfig = {
  siteName: "HoogwerkerHub",
  heroTagline: "Smart Verhuur van Hoogwerkers in Nederland",
  heroTitle: "Uitzonderlijk bereik. Volledig ontzorgd.",
  heroSubtitle: "Van schilderwerk binnen tot zware industriebouw buiten; HoogwerkerHub levert direct de juiste machines op locatie. Met of zonder vakbekwame chauffeur, gecontroleerd door onze slimme AI-assistent.",
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalogus",
  menuAdvisorLabel: "Vloot Adviseur",
  menuOrdersLabel: "Mijn Account",
  menuAdminLabel: "Portaal"
};

let machines = loadJsonFile("machines.json", defaultMachines);
let blockedDates = loadJsonFile("blocked-dates.json", defaultBlockedDates);
let orders = loadJsonFile("orders.json", defaultOrders);
let customCategories = loadJsonFile("categories.json", defaultCategories);
let siteConfig = loadJsonFile("site-config.json", defaultSiteConfig);

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

// REST Api Endpoints

// GET machines
app.get("/api/machines", (req, res) => {
  res.json(machines);
});

// POST new machine
app.post("/api/machines", (req, res) => {
  const { 
    name, 
    category, 
    height, 
    reach, 
    weight, 
    pricePerDay, 
    powerType, 
    imageUrl, 
    description, 
    suitableFor,
    weeklyDiscountPercent,
    monthlyDiscountPercent,
    campaignText,
    campaignDiscountPercent,
    campaignDiscountAmount
  } = req.body;
  
  if (!name || !category || !height || !pricePerDay) {
    return res.status(400).json({ error: "Missing required machine fields" });
  }

  const newMachine = {
    id: `custom-${Date.now()}`,
    name,
    category,
    categoryLabel: category.charAt(0).toUpperCase() + category.slice(1),
    height: Number(height),
    reach: Number(reach || 0),
    weight: Number(weight || 1500),
    pricePerDay: Number(pricePerDay),
    powerType: powerType || "Elektrisch",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: name,
    description: description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.",
    suitableFor: suitableFor || ["Algemeen"],
    weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : undefined,
    monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : undefined,
    campaignText: campaignText || undefined,
    campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : undefined,
    campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : undefined
  };

  machines.push(newMachine);
  saveJsonFile("machines.json", machines);
  res.status(201).json(newMachine);
});

// GET orders
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// POST orders
app.post("/api/orders", (req, res) => {
  const orderData = req.body;
  if (!orderData.machineId || !orderData.customerName || !orderData.customerEmail) {
    return res.status(400).json({ error: "Onvolledige bestelgegevens" });
  }

  const newOrder = {
    id: `HWH-${Math.floor(1000 + Math.random() * 9000)}`,
    machineId: orderData.machineId,
    machineName: orderData.machineName,
    machinePrice: Number(orderData.machinePrice),
    startDate: orderData.startDate,
    endDate: orderData.endDate,
    rentalDays: Number(orderData.rentalDays),
    deliveryType: orderData.deliveryType,
    deliveryAddress: orderData.deliveryAddress || "",
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    customerPhone: orderData.customerPhone,
    customerProfile: orderData.customerProfile || "Particulier",
    subtotal: Number(orderData.subtotal),
    transportCost: Number(orderData.transportCost || 0),
    driverCost: Number(orderData.driverCost || 0),
    vatAmount: Number(orderData.vatAmount),
    totalAmount: Number(orderData.totalAmount),
    status: "In behandeling" as const,
    createdAt: new Date().toISOString(),
    addons: orderData.addons || []
  };

  orders.unshift(newOrder);
  saveJsonFile("orders.json", orders);
  res.status(201).json(newOrder);
});

// GET blocked dates
app.get("/api/blocked-dates", (req, res) => {
  res.json(blockedDates);
});

// POST blocked dates
app.post("/api/blocked-dates", (req, res) => {
  const { machineId, date, reason, action } = req.body;
  if (!machineId || !date) {
    return res.status(400).json({ error: "Onvolledige invoer" });
  }

  if (action === "unblock") {
    blockedDates = blockedDates.filter(b => !(b.machineId === machineId && b.date === date));
    saveJsonFile("blocked-dates.json", blockedDates);
    res.json({ success: true, message: "Datum gedeblokkeerd" });
  } else {
    // Check if duplicate
    const exists = blockedDates.some(b => b.machineId === machineId && b.date === date);
    if (!exists) {
      blockedDates.push({
        id: `block-${Date.now()}`,
        machineId,
        date,
        reason: reason || "Handmatig geblokkeerd door beheerder"
      });
      saveJsonFile("blocked-dates.json", blockedDates);
    }
    res.status(201).json({ success: true, message: "Datum succesvol geblokkeerd" });
  }
});

// GET site config and custom categories
app.get("/api/site-config", (req, res) => {
  res.json(siteConfig);
});

app.post("/api/site-config", (req, res) => {
  siteConfig = { ...siteConfig, ...req.body };
  saveJsonFile("site-config.json", siteConfig);
  res.json({ success: true, siteConfig });
});

app.get("/api/categories", (req, res) => {
  res.json(customCategories);
});

app.post("/api/categories", (req, res) => {
  if (Array.isArray(req.body)) {
    customCategories = req.body;
  } else {
    customCategories.push(req.body);
  }
  saveJsonFile("categories.json", customCategories);
  res.json({ success: true, customCategories });
});

// POST Gemini Advisor
app.post("/api/gemini/advisor", async (req, res) => {
  const { messages, userProfile } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Slechte aanvraag parameters" });
  }

  // Construct context with our machines for the Gemini Prompt
  const machineCatalogContext = machines.map(m => (
    `- ID: "${m.id}", Naam: "${m.name}", Categorie: "${m.category}", Werkhoogte: ${m.height}m, Horizontaal bereik: ${m.reach}m, Gewicht: ${m.weight}kg, Tarief: €${m.pricePerDay}/dag, Aandrijving: ${m.powerType}, Geschikt voor: ${m.suitableFor.join(", ")}. Beschrijving: ${m.description}`
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
4. Indien je een specifieke machine of machinegroep wilt aanbevelen die echt perfect past bij hun behoeften, sluit dan je antwoord af of neem in je tekst de specifieke machine ID's op binnen de tags <suggest>MACHINE_ID</suggest>, bijvoorbeeld: <suggest>schaar-elek</suggest> of <suggest>spin-crawl</suggest>. Je mag meerdere tags toevoegen als je meerdere machines vergelijkt of aanbeveelt.
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
  let suggestedIds: string[] = [];

  if (lastUserMsg.includes("schilder") || lastUserMsg.includes("verf") || lastUserMsg.includes("binnen")) {
    fallbackReply = "Als professionele schilder heeft u waarschijnlijk een stabiele hoogwerker nodig die geschikt is voor binnenwerk en kwetsbare vloeren. Ik raad onze **Elektrische Schaarlift (12m)** aan voor rechte muren of onze uiterst wendbare **Spinhoogwerker Spider (15m)** als u over kasten of tuinen heen moet manoeuvreren. Ze zijn beiden emissievrij en fluisterstil!\n\n<suggest>schaar-elek</suggest>\n<suggest>spin-crawl</suggest>\n\nHeeft u al een idee van de gewenste werkhoogte?";
  } else if (lastUserMsg.includes("hovenier") || lastUserMsg.includes("buiten") || lastUserMsg.includes("boom") || lastUserMsg.includes("ruw")) {
    fallbackReply = "Voor buitenwerkzaamheden op ruw of onverhard terrein raad ik absoluut onze **Spinhoogwerker Spider (15m)** met rupsbanden aan of de krachtige **Telescoophoogwerker Heavy-Duty (26m)** als u enorme hoogte nodig heeft. Bent u op zoek naar snel transport tussen locaties? Dan is de **Autohoogwerker B-Rijbewijs (22m)** ideaal omdat u hier zelf mee mag rijden!\n\n<suggest>spin-crawl</suggest>\n<suggest>truck-b</suggest>";
  } else if (lastUserMsg.includes("glazenwasser") || lastUserMsg.includes("gevel") || lastUserMsg.includes("reiken")) {
    fallbackReply = "Voor gevelreiniging of glasbewassing is zijdelings bereik cruciaal. De **Knikarmhoogwerker (18m)** biedt 16 meter horizontaal bereik en kan eenvoudig over geparkeerde auto's of luifels reiken. Indien u snel langs meerdere panden moet reizen, is de **Autohoogwerker B-Rijbewijs (22m)** uw beste vriend!\n\n<suggest>knik-diesel</suggest>\n<suggest>truck-b</suggest>";
  } else {
    fallbackReply = "Welkom bij HoogwerkerHub! Ik help u graag met het vinden van de beste hoogwerker voor uw specifieke klus. Bent u actief als schilder, installateur, aannemer of particulier? En werkt u hoofdzakelijk binnen of buiten? \n\nLaat me ook gerust weten welke werkhoogte u zoekt, dan sturen we direct de juiste suggestie!\n\nU kunt hieronder ook op een van de snelle opties klikken.";
  }

  return res.json({ reply: fallbackReply });
});

// Configure Vite integration for SPA fallback
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production build from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 HoogwerkerHub Server Running on http://localhost:${PORT}`);
    console.log(`🤖 Serving full-stack React SPA with Dutch AI Advisor`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
