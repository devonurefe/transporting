import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultCategories = [
  { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor loodsen, schilder- en rechtlijnig montagewerk.", heights: "8m - 14m", price: "v.a. €120/dag" },
  { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over vaste obstakels heen te reiken.", heights: "12m - 20m", price: "v.a. €210/dag" },
  { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Gigantisch bereik op ruw bouwterrein.", heights: "16m - 40m", price: "v.a. €340/dag" },
  { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden met B-rijbewijs. Snel op locatie operationeel.", heights: "18m - 24m", price: "v.a. €250/dag" },
  { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Kruipt door binnendeuren en over zachte grasvelden.", heights: "12m - 22m", price: "v.a. €180/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Kant-en-klaar editie voor schilder, zonnepaneel of snoeiwerk.", heights: "10m - 26m", price: "v.a. €110/dag" },
  { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig te transporteren en direct achter de auto te koppelen.", heights: "12m - 17m", price: "v.a. €95/dag" }
];

const defaultMachines = [
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
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Spinhoogwerker op rubberen rupsbanden manoeuvrerend in smalle tuin",
    description: "Uiterst compacte spinhoogwerker op rubberen rupsbanden. Past door een standaard binnendeur, beschadigt kwetsbare vloeren niet, and stempelt overal af.",
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
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Dakgoot kit",
    description: "Zelf rijden met B-rijbewijs. Gemonteerd met een speciaal platformvak voor gereedschappen, dakgootschep-set and 230V stroomaansluiting in het platform.",
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
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gevel kit",
    description: "Robuust telescooppakket voor veeleisende buitenreiniging. Inclusief slanghaspel-gevelextensie klemmen, hogedruk generator module and all-risk kasko dekking.",
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
    imageUrl: "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Glasbewassing",
    description: "Zelfrijdende truck hoogwerker (rijbewijs B) voorzien van osmose-watertank montage klemmen and brede platformbak voor veilig glasbewassing op hoogte.",
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
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Particuliere weekendset",
    description: "De ultieme doe-het-zelf favoriet voor schilderen of lampen vervangen. Inclusief veiligheidsharnas, helm and gratis telefonische advieslijn via onze AI-coördinator.",
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
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Licht installatieset",
    description: "Ideaal voor installateurs van beveiligingscamera's, straatverlichting and sportveld armaturen. Inclusief spinhoogwerker, geactiveerde stroomhaspel kit and gemonteerde materiaalkorf.",
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
    description: "Zeer lichte and stabiele aanhangerhoogwerker. Eenvoudig zelf te transporteren met een standaard B/BE rijbewijs and uiterst compact wendbaar op locatie.",
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
    imageUrl: "https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Super-reach telescoophoogwerker",
    description: "Onze allerhoogste telescoophoogwerker voor professionele megaprojecten. Voorzien van 4WD terreinaandrijving, uiterst robuuste mast and maximale klasse C-beveiliging.",
    suitableFor: ["Aannemer", "Industriebouw"],
    weeklyDiscountPercent: 15,
    monthlyDiscountPercent: 35
  }
];

const defaultBlockedDates = [
  { id: "b1", machineId: "schaar-elek", date: new Date("2026-06-15"), reason: "Onderhoud BMWT" },
  { id: "b2", machineId: "schaar-elek", date: new Date("2026-06-16"), reason: "Onderhoud BMWT" },
  { id: "b3", machineId: "knik-diesel", date: new Date("2026-06-20"), reason: "Calibratie keuring" },
  { id: "b4", machineId: "set-paint-comfort", date: new Date("2026-06-10"), reason: "Gereserveerd voor demo" }
];

const defaultSiteConfig = {
  id: "default",
  siteName: "HoogwerkerHub",
  heroTagline: "Smart Verhuur van Hoogwerkers in Nederland",
  heroTitle: "Uitzonderlijk bereik. Volledig ontzorgd.",
  heroSubtitle: "Van schilderwerk binnen tot zware industriebouw buiten; HoogwerkerHub levert direct de juiste machines op locatie. Met of zonder vakbekwame chauffeur, gecontroleerd door onze slimme AI-assistent.",
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalog",
  menuAdvisorLabel: "Adviseur",
  menuOrdersLabel: "Contact",
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
  console.log("Cleaning database...");
  await prisma.notification.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.category.deleteMany();
  await prisma.siteConfig.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();

  console.log("Seeding categories...");
  for (const cat of defaultCategories) {
    await prisma.category.create({ data: cat });
  }

  console.log("Seeding machines...");
  for (const mach of defaultMachines) {
    await prisma.machine.create({ data: mach });
  }

  console.log("Seeding blocked dates...");
  for (const bd of defaultBlockedDates) {
    await prisma.blockedDate.create({ data: bd });
  }

  console.log("Seeding site config...");
  await prisma.siteConfig.create({ data: defaultSiteConfig });

  console.log("Seeding admin...");
  const adminEmail = "admin@hoogwerkerhub.nl";
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!1";
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: "HoogwerkerHub Admin",
        role: "admin"
      }
    });
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.log(`\n⚠️  ADMIN ACCOUNT CREATED WITH GENERATED PASSWORD:`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   ⚠️  Please change this password immediately after first login!\n`);
    } else {
      console.log(`✅ Admin account created with ADMIN_DEFAULT_PASSWORD env variable.`);
    }
  }

  console.log("Seeding customer profiles...");
  const customerPasswordHash = await bcrypt.hash("customer123", 10);
  const createdCustomers: Record<string, string> = {};

  for (const customerData of mockCustomers) {
    const cust = await prisma.customer.create({
      data: {
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
        machineId: "schaar-elek",
        machineName: "Elektrische Schaarlift (12m)",
        machinePrice: 120,
        startDate: new Date("2026-06-05"),
        endDate: new Date("2026-06-08"),
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
        machineId: "spin-crawl",
        machineName: "Spinhoogwerker Spider (15m)",
        machinePrice: 180,
        startDate: new Date("2026-06-12"),
        endDate: new Date("2026-06-13"),
        rentalDays: 1,
        deliveryType: "self_pickup",
        customerName: "Sven van der Meer",
        customerEmail: "sven@meer-groen.nl",
        customerPhone: "+31 6 87654321",
        customerProfile: "Hovenier / Groenverzorging",
        subtotal: 180,
        transportCost: 0,
        driverCost: 0,
        vatAmount: 37.8,
        totalAmount: 217.8,
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
