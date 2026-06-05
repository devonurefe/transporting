import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultCategories = [
  { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.", heights: "6m - 10m", price: "v.a. €80/dag" },
  { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over serres, schuttingen of daken heen te reiken.", heights: "12m - 16m", price: "v.a. €155/dag" },
  { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Groot zijdelings bereik, ideaal voor boomverzorging en gevels.", heights: "14m - 16m", price: "v.a. €175/dag" },
  { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden naar uw klus met autorijbewijs B. Snel op- en afstellen.", heights: "16m", price: "v.a. €195/dag" },
  { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Compact op rupsbanden. Past door een standaard tuinpoort van 80cm.", heights: "12m - 16m", price: "v.a. €160/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete sets speciaal samengesteld voor schilder-, snoei- of dakgootklus.", heights: "10m - 16m", price: "v.a. €90/dag" },
  { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig zelf te vervoeren achter uw auto met rijbewijs B.", heights: "12m", price: "v.a. €80/dag" }
];

const defaultMachines = [
  {
    id: "schaar-elek",
    name: "Elektrische Schaarlift Compact (10m)",
    category: "schaarlift",
    categoryLabel: "Schaarlift",
    height: 10,
    reach: 0,
    weight: 2000,
    pricePerDay: 95,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gele elektrische schaarlift voor binnengebruik en schilderwerk",
    description: "Handzame en emissievrije schaarlift met uitschuifbaar platform. Past door standaard deuropeningen en is uitgerust met non-marking banden. Ideaal voor schilder- en montagewerk binnenshuis.",
    suitableFor: ["Schilder", "Installateur", "Magazijn", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25,
    campaignText: "Lente Actie",
    campaignDiscountPercent: 5
  },
  {
    id: "knik-diesel",
    name: "Knikarmhoogwerker Hybride (12m)",
    category: "knikarm",
    categoryLabel: "Knikarmhoogwerker",
    height: 12,
    reach: 6,
    weight: 3200,
    pricePerDay: 155,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Knikarmhoogwerker werkzaam op bouwterrein",
    description: "Compacte hybride knikarmhoogwerker die eenvoudig over schuttingen, serres of dakkapellen heen reikt. Zeer wendbaar en perfect voor onderhoudswerk rondom het huis.",
    suitableFor: ["Glazenwasser", "Schilder", "Particulier"],
    weeklyDiscountPercent: 15,
    monthlyDiscountPercent: 30,
    campaignText: "SchilderSpecial",
    campaignDiscountAmount: 20
  },
  {
    id: "tele-diesel",
    name: "Compacte Telescoophoogwerker (14m)",
    category: "telescoop",
    categoryLabel: "Telescoophoogwerker",
    height: 14,
    reach: 10,
    weight: 3400,
    pricePerDay: 175,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Telescoophoogwerker",
    description: "Telescoophoogwerker met uitstekend zijdelings bereik op ruwer terrein. Ideaal voor boomverzorging, buitenreiniging of schilderwerk aan gevels.",
    suitableFor: ["Schilder", "Gevelreiniger", "Hovenier"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "truck-b",
    name: "Autohoogwerker Rijbewijs B (16m)",
    category: "auto",
    categoryLabel: "Autohoogwerker",
    height: 16,
    reach: 11,
    weight: 3500,
    pricePerDay: 195,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Autohoogwerker gemonteerd op busje voor openbare verlichting",
    description: "Zelf rijden naar uw klus met een standaard autorijbewijs B. Geen transportkosten! Binnen 5 minuten stabiel afgestempeld voor gevelwas of snoeiwerk.",
    suitableFor: ["Gemeente", "Boomverzorging", "Schilder", "Particulier"],
    weeklyDiscountPercent: 10,
    monthlyDiscountPercent: 25,
    campaignText: "ZelfRijActie",
    campaignDiscountPercent: 8
  },
  {
    id: "spin-crawl",
    name: "Spinhoogwerker Spider Compact (12m)",
    category: "spin",
    categoryLabel: "Spinhoogwerker",
    height: 12,
    reach: 7,
    weight: 1600,
    pricePerDay: 160,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Spinhoogwerker op rubberen rupsbanden",
    description: "Lichte spinhoogwerker op rubberen rupsbanden. Met een breedte van slechts 80cm past hij door vrijwel elke tuinpoort. Stempelt af op ongelijke ondergronden.",
    suitableFor: ["Hovenier", "Schilder", "Restauratie", "Particulier"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "set-paint-comfort",
    name: "Schilderspakket Extra Gemak (10m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 10,
    reach: 0,
    weight: 2000,
    pricePerDay: 115,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Schilderskit Combiset",
    description: "Compleet schilderspakket inclusief compacte schaarlift, 2x 20m verlengkabels, vloerbeschermers en een gecertificeerd veiligheidsharnas.",
    suitableFor: ["Schilder", "Particulier"],
    weeklyDiscountPercent: 10,
    campaignText: "SchilderKorting",
    campaignDiscountPercent: 5
  },
  {
    id: "set-solar-pro",
    name: "Zonnepaneel Montage Pakket (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12,
    reach: 6,
    weight: 3200,
    pricePerDay: 185,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Solar Montage set",
    description: "Perfecte set voor zonnepaneelinstallateurs. Inclusief hybride knikarmhoogwerker, handige materiaalhaken en all-risk kasko dekking.",
    suitableFor: ["Aannemer", "Installateur"],
    weeklyDiscountPercent: 15,
    campaignText: "EcoHuur",
    campaignDiscountAmount: 20
  },
  {
    id: "set-prune-compact",
    name: "Tuin & Boomsnoei Compact Kit (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12,
    reach: 7,
    weight: 1600,
    pricePerDay: 170,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Tuin Snoei compact set",
    description: "Complete set voor boomverzorging in tuinen. Inclusief compacte spinhoogwerker, 4x plastic rijplaten tegen gazonbeschadiging en een veiligheidshelm met gehoorbescherming.",
    suitableFor: ["Hovenier", "Boomverzorging", "Particulier"],
    weeklyDiscountPercent: 12
  },
  {
    id: "set-gutter-fast",
    name: "Dakgootschep Snelstart Set (16m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 16,
    reach: 11,
    weight: 3500,
    pricePerDay: 215,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1542385151-efd9000785a0?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Dakgoot kit",
    description: "Zelf rijden met rijbewijs B. Gemonteerd met platformvak voor gereedschappen, dakgootschep en 230V stroomaansluiting in de werkbak.",
    suitableFor: ["Particulier", "Glazenwasser"],
    weeklyDiscountPercent: 10,
    campaignText: "DakGootActie",
    campaignDiscountPercent: 8
  },
  {
    id: "set-facade-heavy",
    name: "Gevelreiniging Compact Kit (14m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 14,
    reach: 10,
    weight: 3400,
    pricePerDay: 195,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Gevel kit",
    description: "Pakket voor doe-het-zelf gevelreiniging of voegwerk. Inclusief compacte telescoophoogwerker en hogedrukspuit haspelmontage.",
    suitableFor: ["Glazenwasser", "Gevelreiniger", "Particulier"],
    weeklyDiscountPercent: 15
  },
  {
    id: "set-window-premium",
    name: "Glazenwasser Premium Set (16m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 16,
    reach: 11,
    weight: 3500,
    pricePerDay: 220,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Glasbewassing",
    description: "Truckhoogwerker (rijbewijs B) voorzien van osmose-watertank klemmen en brede platformbak voor veilig glasbewassingswerk.",
    suitableFor: ["Glazenwasser"],
    weeklyDiscountPercent: 12
  },
  {
    id: "set-diy-weekend",
    name: "Weekend Deal Doe-Het-Zelf (10m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 10,
    reach: 5,
    weight: 1200,
    pricePerDay: 90,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Particuliere weekendset",
    description: "De ultieme doe-het-zelf favoriet voor weekendklussen rondom het huis. Inclusief trailerhoogwerker, veiligheidskit en 24/7 telefonisch advies.",
    suitableFor: ["Particulier"],
    campaignText: "WeekendSpecial",
    campaignDiscountPercent: 10
  },
  {
    id: "set-light-install",
    name: "Licht & Camera Installatieset (12m)",
    category: "klussensets",
    categoryLabel: "Kluspakket",
    height: 12,
    reach: 7,
    weight: 1600,
    pricePerDay: 175,
    powerType: "Hybride",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Licht installatieset",
    description: "Spinhoogwerker met stroomhaspel-onderbouw en een brede platformbak voor gereedschapskisten. Ideaal voor camera-installatie.",
    suitableFor: ["Installateur", "Particulier"],
    weeklyDiscountPercent: 12
  },
  {
    id: "aanhanger-compact",
    name: "Aanhangerhoogwerker Easy-Tow (12m)",
    category: "aanhanger",
    categoryLabel: "Aanhangerhoogwerker",
    height: 12,
    reach: 6.5,
    weight: 1200,
    pricePerDay: 80,
    powerType: "Elektrisch",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Compacte aanhanger hoogwerker",
    description: "Zeer lichte en stabiele aanhangerhoogwerker. Eenvoudig zelf te trekken achter uw eigen auto met een standaard B-rijbewijs. Snel en veilig op te stellen.",
    suitableFor: ["Particulier", "Schilder", "Installateur"],
    weeklyDiscountPercent: 12,
    monthlyDiscountPercent: 28
  },
  {
    id: "tele-max",
    name: "Telescoophoogwerker Compact (16m)",
    category: "telescoop",
    categoryLabel: "Telescoophoogwerker",
    height: 16,
    reach: 12,
    weight: 3800,
    pricePerDay: 210,
    powerType: "Diesel",
    imageUrl: "https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?q=80&w=600&auto=format&fit=crop",
    imageAlt: "Super-reach telescoophoogwerker",
    description: "Compacte telescoophoogwerker met uitstekend bereik voor gevel- en snoeiwerk op grotere hoogte. Uiterst wendbaar.",
    suitableFor: ["Aannemer", "Gevelreiniger", "Schilder"],
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
  const adminEmail = "admin@huurgo.nl";
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!1";
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: "HuurGo Admin",
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
        machineName: "Elektrische Schaarlift Compact (10m)",
        machinePrice: 95,
        startDate: new Date("2026-06-05"),
        endDate: new Date("2026-06-08"),
        rentalDays: 3,
        deliveryType: "delivery_with_driver",
        deliveryAddress: "Keizersgracht 420, 1016 EK Amsterdam",
        customerName: "Jan de Vries",
        customerEmail: "jan@devriesschilderwerken.nl",
        customerPhone: "+31 6 12345678",
        customerProfile: "Schilder",
        subtotal: 285,
        transportCost: 120,
        driverCost: 150,
        vatAmount: 116.55,
        totalAmount: 671.55,
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
        machineName: "Spinhoogwerker Spider Compact (12m)",
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
