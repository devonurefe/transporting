import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { publicReadLimiter } from "../middleware/publicGuard.js";
import { emailService } from "../services/emailService.js";

export const ordersRouter = Router();

// Addons are stored as a JSON string column — a corrupt row must not crash the request
function safeParseAddons(raw: string | null): any[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("Corrupt addons JSON in order row:", raw?.slice(0, 100));
    return [];
  }
}

// Serializable transactions abort with P2034 when two bookings race on the same
// machine — retry with backoff instead of surfacing a 500 to the customer
async function withSerializableRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isSerializationFailure = error?.code === "P2034" || error?.code === "40001";
      if (!isSerializationFailure || attempt >= retries) throw error;
      await new Promise(r => setTimeout(r, attempt * 100 + Math.random() * 100));
    }
  }
}

const orderCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: { error: "Te veel boekingspogingen van dit IP. Probeer het over een uur opnieuw." },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory idempotency cache (Render is single-process; 1-hour TTL prevents duplicate orders on retry)
const processedIdempotencyKeys = new Map<string, { orderId: string; createdAt: number }>();
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;
// Sweep expired entries every 10 minutes so the Map doesn't grow unbounded on a long-running process
setInterval(() => {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [k, v] of processedIdempotencyKeys) {
    if (v.createdAt < cutoff) processedIdempotencyKeys.delete(k);
  }
}, 10 * 60 * 1000);

const guestRatingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Te veel beoordelingspogingen. Probeer het over 15 minuten opnieuw." },
  standardHeaders: true,
  legacyHeaders: false,
});

const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Te veel beschikbaarheidsverzoeken. Probeer het over een minuut opnieuw." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public availability feed used by the booking calendar. It intentionally exposes
// only the minimum data needed to detect date collisions.
ordersRouter.get("/availability", availabilityLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { machineId } = req.query;
  if (!machineId || typeof machineId !== "string") {
    return res.status(400).json({ error: "machineId parameter is verplicht" });
  }

  try {
    const dbOrders = await prisma.order.findMany({
      where: {
        machineId,
        status: { not: "Geannuleerd" }
      },
      select: {
        id: true,
        machineId: true,
        startDate: true,
        endDate: true,
        status: true
      },
      orderBy: { createdAt: "desc" }
    });
    const formatted = dbOrders.map(o => ({
      ...o,
      startDate: o.startDate.toISOString().split("T")[0],
      endDate: o.endDate.toISOString().split("T")[0]
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching order availability:", error);
    res.status(500).json({ error: "Kon beschikbaarheid niet ophalen" });
  }
});

// GET orders: admins see all orders (paginated, max 100/page), customers see only their own.
ordersRouter.get("/", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const whereClause = isAdmin ? undefined : { customerId: req.user!.id };

    const page = Math.max(1, Number(req.query.page) || 1);
    // Admin requests are always paginated (max 100); customer requests are small by nature.
    const defaultLimit = isAdmin ? 50 : 500;
    const maxLimit = isAdmin ? 100 : 500;
    const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
    const skip = (page - 1) * limit;

    const [dbOrders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.order.count({ where: whereClause })
    ]);

    res.setHeader("X-Total-Pages", String(Math.ceil(totalCount / limit)));
    res.setHeader("X-Total-Count", String(totalCount));

    const formatted = dbOrders.map(o => ({
      ...o,
      startDate: o.startDate.toISOString().split("T")[0],
      endDate: o.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(o.addons)
    }));
    return res.json(formatted);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Kon bestellingen niet ophalen" });
  }
});

// POST orders — with input validation and date collision detection
ordersRouter.post("/", orderCreationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  // Idempotency: return the existing order if the client retries with the same key (network timeout scenario)
  const idempotencyKey = req.headers["idempotency-key"];
  if (idempotencyKey && typeof idempotencyKey === "string") {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) {
      if (Date.now() - existing.createdAt < IDEMPOTENCY_TTL_MS) {
        const existingOrder = await prisma.order.findUnique({ where: { id: existing.orderId } });
        if (existingOrder) {
          return res.status(200).json({
            ...existingOrder,
            startDate: existingOrder.startDate.toISOString().split("T")[0],
            endDate: existingOrder.endDate.toISOString().split("T")[0],
            addons: safeParseAddons(existingOrder.addons)
          });
        }
      } else {
        processedIdempotencyKeys.delete(idempotencyKey);
      }
    }
  }

  const orderData = req.body;

  // Basic input validation
  if (!orderData.machineId || !orderData.customerName || !orderData.customerEmail) {
    return res.status(400).json({ error: "Onvolledige bestelgegevens" });
  }

  // Name and email length caps
  if (String(orderData.customerName).length > 200) {
    return res.status(400).json({ error: "Naam is te lang (max 200 tekens)" });
  }
  if (String(orderData.customerEmail).length > 254) {
    return res.status(400).json({ error: "E-mailadres is te lang" });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(orderData.customerEmail)) {
    return res.status(400).json({ error: "Ongeldig e-mailadres" });
  }

  // customerProfile whitelist (prevents XSS/injection via stored profile)
  const VALID_PROFILES = [
    // Current values (must match BookingStep2 + MyOrdersSection dropdowns exactly)
    "Schilder", "Hovenier / Groenverzorging", "Glazenwasser / Gevelreiniger",
    "Aannemer", "Installateur / Elektricien", "Dakdekker / Gevelwerker",
    "Industrieel Onderhoud", "Particulier", "Overig / Anders",
    // Legacy values kept for existing orders already stored in the database
    "Installateur", "Hovenier", "Glazenwasser", "Stukadoor", "Magazijn", "Gevelreiniger",
  ];
  if (orderData.customerProfile && !VALID_PROFILES.includes(String(orderData.customerProfile))) {
    return res.status(400).json({ error: "Profiel type niet ondersteund" });
  }

  // Date validation
  if (!orderData.startDate || !orderData.endDate) {
    return res.status(400).json({ error: "Start- en einddatum zijn verplicht" });
  }
  const startDate = new Date(orderData.startDate);
  const endDate = new Date(orderData.endDate);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: "Ongeldige datumnotatie" });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: "Einddatum moet na de startdatum liggen" });
  }
  // Reject bookings that start in the past — the frontend guard
  // (BookingSection.tsx) is bypassable via a crafted request. Compare against
  // the start of today in UTC, consistent with the getUTCDay() pricing logic.
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  if (startDate < startOfToday) {
    return res.status(400).json({ error: "Startdatum mag niet in het verleden liggen" });
  }

  // Amount validation
  if (Number(orderData.totalAmount) <= 0 || isNaN(Number(orderData.totalAmount))) {
    return res.status(400).json({ error: "Ongeldig totaalbedrag" });
  }

  // deliveryType enum validation
  const VALID_DELIVERY_TYPES = ["self_pickup", "delivery_by_us", "trailer_rental", "trailer_drop_return"] as const;
  if (!VALID_DELIVERY_TYPES.includes(orderData.deliveryType)) {
    return res.status(400).json({ error: "Ongeldig bezorgtype" });
  }

  // deliveryAddress length limit
  if (orderData.deliveryAddress && String(orderData.deliveryAddress).length > 500) {
    return res.status(400).json({ error: "Bezorgadres is te lang (max 500 tekens)" });
  }

  // deliveryTimeSlot enum validation
  const VALID_TIME_SLOTS = ["morning", "afternoon"];
  if (orderData.deliveryTimeSlot && !VALID_TIME_SLOTS.includes(String(orderData.deliveryTimeSlot))) {
    return res.status(400).json({ error: "Ongeldig bezorgmoment" });
  }

  // customerPhone format validation (optional field, but if provided must look like a phone number)
  if (orderData.customerPhone) {
    const phoneClean = String(orderData.customerPhone).replace(/[\s\-().+]/g, "");
    if (!/^\d{7,15}$/.test(phoneClean)) {
      return res.status(400).json({ error: "Ongeldig telefoonnummer" });
    }
  }

  try {
    // Server-side price validation — reject if client price deviates from DB
    const machine = await prisma.machine.findUnique({ where: { id: orderData.machineId } });
    if (!machine) {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    if (Math.abs(machine.pricePerDay - Number(orderData.machinePrice)) > 0.01) {
      return res.status(400).json({ error: "Prijs niet actueel. Ververs de pagina en probeer opnieuw." });
    }

    // Load campaign rules for server-side discount mirror
    const siteConf = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const campaignRules: Array<{ scope: string; scopeValue: string; discountPercent: number; isActive: boolean }> =
      Array.isArray((siteConf as any)?.campaignRules) ? (siteConf as any).campaignRules : [];

    // Server-side financial recalculation — prevent subtotal/VAT/total manipulation.
    // rentalDays is recomputed from the dates (inclusive, same formula as
    // BookingSection.tsx) — never trusted from the client, otherwise a 30-day
    // booking could be paid as a 1-day rental.
    const rentalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
    if (orderData.rentalDays !== undefined && Number(orderData.rentalDays) !== rentalDays) {
      return res.status(400).json({ error: "Huurperiode komt niet overeen met de gekozen datums. Ververs de pagina en probeer opnieuw." });
    }
    if (rentalDays > 365) {
      return res.status(400).json({ error: "Maximale huurperiode is 365 dagen. Neem contact op voor langere periodes." });
    }
    // Compute authoritative transport cost server-side — never trust the client value
    const dt = orderData.deliveryType as string;
    // Pickup-only products (e.g. Kamersteiger) may never be delivered. The frontend
    // forces self_pickup, but a crafted request could bypass that.
    if ((machine as any).pickupOnly && dt !== "self_pickup") {
      return res.status(400).json({ error: "Voor dit product is alleen afhalen mogelijk" });
    }
    const authTransport =
      dt === "self_pickup"           ? 0
      : dt === "delivery_by_us"      ? 150
      : dt === "trailer_drop_return" ? 35
      : /* trailer_rental */           25 * rentalDays;
    const transportCostClient = Number(orderData.transportCost || 0);
    if (Math.abs(transportCostClient - authTransport) > 0.01) {
      return res.status(400).json({ error: "Ongeldig transportbedrag" });
    }
    // driverCost is always 0 in the current flow; reject non-zero to prevent manipulation
    const driverCostClient = Number(orderData.driverCost || 0);
    if (driverCostClient !== 0) {
      return res.status(400).json({ error: "Ongeldig chauffeurskostenbedrag" });
    }
    // Addon prices are recomputed authoritatively from the DB — never trusted from
    // the client. The global "safety" addon plus this machine's own product-specific
    // cross-sell extras are the only accepted ids. (Weekend handling is no longer an
    // addon — it adjusts the subtotal via orderData.weekendWork below.)
    const crossSell: Array<{ id: string; name?: string; pricePerWeek: number }> =
      Array.isArray((machine as any).crossSellAddons) ? (machine as any).crossSellAddons : [];
    const crossSellMap = new Map(crossSell.map(a => [String(a.id), a]));
    const addonWeeks = Math.max(1, Math.ceil(
      Math.max(rentalDays, ((machine as any).minRentalDays > 0 ? (machine as any).minRentalDays : 7)) / 7
    ));
    const rawAddons = Array.isArray(orderData.addons) ? orderData.addons : [];
    let addonsTotal = 0;
    for (const a of rawAddons) {
      if (typeof a !== "object" || a === null) {
        return res.status(400).json({ error: "Ongeldige toevoeging in bestelling" });
      }
      const id = String(a.id ?? "");
      if (id === "safety") {
        addonsTotal += 15 * rentalDays;
      } else if (crossSellMap.has(id)) {
        addonsTotal += Number(crossSellMap.get(id)!.pricePerWeek || 0) * addonWeeks;
      } else {
        return res.status(400).json({ error: "Ongeldige toevoeging in bestelling" });
      }
    }
    // Flat-rate pricing mirrors src/utils/pricing.ts calculateItemSubtotal.
    // Strict weekend: 2 days starting Saturday (Sat+Sun).
    // startDate is a UTC-parsed Date, so getUTCDay() is timezone-safe.
    const profile = String(orderData.customerProfile || "").toLowerCase();

    // Campaign discounts apply on top of flat rates (mirrors pricing.ts withCampaign).
    // Volume discounts are already embedded in flat rates — not double-counted.
    const withCampaign = (base: number): number => {
      let pct = 0;
      for (const rule of campaignRules.filter(r => r.isActive)) {
        const matches = rule.scope === "global"
          || (rule.scope === "category" && machine.category.toLowerCase() === rule.scopeValue.toLowerCase())
          || (rule.scope === "product" && machine.id === rule.scopeValue)
          || (rule.scope === "role" && profile === rule.scopeValue.toLowerCase());
        if (matches) pct = Math.max(pct, rule.discountPercent);
      }
      if (machine.campaignDiscountPercent) pct = Math.max(pct, machine.campaignDiscountPercent as number);
      let disc = base * (pct / 100);
      if (machine.campaignDiscountAmount) disc += machine.campaignDiscountAmount as number;
      return Math.max(0, base - disc);
    };

    let serverSubtotal: number;
    const m = machine as any;
    const dow = startDate.getUTCDay();
    const strictWeekend = rentalDays === 2 && dow === 6;

    // Weekend "niet werken" discount — mirrors src/utils/pricing.ts calculateItemSubtotal.
    // On the weekly basis (3–27 days) a customer who declares they will NOT work the
    // weekend only pays for the working (non-weekend) days at the weekly day rate.
    const weekendWork = String(orderData.weekendWork ?? "");
    let weekendDaysCount = 0;
    {
      const cur = new Date(startDate);
      cur.setUTCHours(0, 0, 0, 0);
      for (let i = 0; i < rentalDays; i++) {
        const d = cur.getUTCDay();
        if (d === 0 || d === 6) weekendDaysCount++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    const weekendNoWork = weekendWork === "nee" && m.weeklyPrice && !m.weeklyOnly
      && rentalDays >= 3 && rentalDays < 28 && !strictWeekend && weekendDaysCount > 0;

    if (weekendNoWork) {
      // Working (non-weekend) days at the weekly day rate. 1-2 working days floored at
      // the normal short-stay tier; total capped at the monthly price. Mirrors pricing.ts.
      const workingDays = rentalDays - weekendDaysCount;
      let base = Math.round(workingDays * (m.weeklyPrice / 5));
      if (workingDays === 1) base = Math.max(base, m.oneDayPrice ?? machine.pricePerDay);
      else if (workingDays === 2) base = Math.max(base, m.twoDayPrice ?? machine.pricePerDay * 2);
      if (m.monthlyPrice) base = Math.min(base, m.monthlyPrice);
      serverSubtotal = withCampaign(base);
    } else if (m.weeklyOnly && m.weeklyPrice) {
      // Weekly-only billing — minimum 1 week, charged per started week.
      // Mirrors src/utils/pricing.ts billableWeeks().
      const min = m.minRentalDays > 0 ? m.minRentalDays : 7;
      const weeks = Math.max(1, Math.ceil(Math.max(rentalDays, min) / 7));
      serverSubtotal = withCampaign(weeks * m.weeklyPrice);
    } else if (rentalDays === 1 && m.oneDayPrice) {
      serverSubtotal = withCampaign(m.oneDayPrice);
    } else if (rentalDays === 2 && strictWeekend && m.weekendPrice) {
      serverSubtotal = withCampaign(m.weekendPrice);
    } else if (rentalDays === 2 && m.twoDayPrice) {
      serverSubtotal = withCampaign(m.twoDayPrice);
    } else if ((rentalDays === 3 || rentalDays === 4 || rentalDays === 5) && m.weeklyPrice) {
      serverSubtotal = withCampaign(m.weeklyPrice);
    } else if (rentalDays >= 6 && rentalDays < 28 && m.weeklyPrice) {
      // Pro-rata capped at the monthly price (sub-month never costs more than a month).
      let base = Math.round(rentalDays * (m.weeklyPrice / 5));
      if (m.monthlyPrice) base = Math.min(base, m.monthlyPrice);
      serverSubtotal = withCampaign(base);
    } else if (rentalDays >= 28 && m.monthlyPrice) {
      const fullMonths = Math.floor(rentalDays / 28);
      const remainder = rentalDays % 28;
      let remainderCost: number;
      if (remainder >= 3 && m.weeklyPrice) {
        remainderCost = Math.round(remainder * (m.weeklyPrice / 5));
      } else {
        remainderCost = remainder * machine.pricePerDay;
      }
      remainderCost = Math.min(remainderCost, m.monthlyPrice);
      serverSubtotal = withCampaign(fullMonths * m.monthlyPrice + remainderCost);
    } else {
      // Mirrors src/utils/pricing.ts evaluateDiscountPercent: take the HIGHEST discount,
      // do not stack volume + campaign discounts. Campaign rules are also applied here.
      const rawSubtotal = machine.pricePerDay * rentalDays;
      let highestDiscountPercent = 0;
      if (rentalDays >= 28 && machine.monthlyDiscountPercent) {
        highestDiscountPercent = Math.max(highestDiscountPercent, machine.monthlyDiscountPercent);
      } else if (rentalDays >= 6 && machine.weeklyDiscountPercent) {
        highestDiscountPercent = Math.max(highestDiscountPercent, machine.weeklyDiscountPercent);
      }
      for (const rule of campaignRules.filter(r => r.isActive)) {
        let matches = false;
        if (rule.scope === "global") matches = true;
        else if (rule.scope === "category") matches = machine.category.toLowerCase() === rule.scopeValue.toLowerCase();
        else if (rule.scope === "product") matches = machine.id === rule.scopeValue;
        else if (rule.scope === "role") matches = profile === rule.scopeValue.toLowerCase();
        if (matches) highestDiscountPercent = Math.max(highestDiscountPercent, rule.discountPercent);
      }
      if (machine.campaignDiscountPercent) {
        highestDiscountPercent = Math.max(highestDiscountPercent, machine.campaignDiscountPercent);
      }
      let serverDiscountAmount = rawSubtotal * (highestDiscountPercent / 100);
      if (machine.campaignDiscountAmount) {
        serverDiscountAmount += (machine.campaignDiscountAmount as number);
      }
      serverSubtotal = Math.max(0, rawSubtotal - serverDiscountAmount);
    }
    serverSubtotal = Math.round(serverSubtotal * 100) / 100;
    const serverVat = Math.round((serverSubtotal + transportCostClient + driverCostClient + addonsTotal) * 21) / 100;
    const serverTotal = Math.round((serverSubtotal + transportCostClient + driverCostClient + addonsTotal + serverVat) * 100) / 100;
    if (Math.abs(serverTotal - Number(orderData.totalAmount)) > 0.01) {
      return res.status(400).json({ error: "Totaalbedrag klopt niet. Ververs de pagina en probeer opnieuw." });
    }

    // Resolve customer ID from auth token if present (outside transaction — read-only)
    let resolvedCustomerId: string | null = null;
    if (req.user && req.user.role !== "admin") {
      const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
      if (customer) resolvedCustomerId = req.user.id;
    }

    // Serializable transaction: availability check + blocked-date check + create are atomic
    const newOrder = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      // Re-fetch bufferDays inside the transaction so we always use the current value
      // even if an admin changed it between the machine fetch above and now
      const machineBuffer = await tx.machine.findUnique({
        where: { id: orderData.machineId },
        select: { bufferDays: true }
      });
      const bufferMs = (machineBuffer?.bufferDays ?? 0) * 24 * 60 * 60 * 1000;

      // Fetch orders that could potentially conflict (started before or on the requested end date)
      // Then apply buffer: an existing order blocks startDate..endDate+bufferDays
      const potentialConflicts = await tx.order.findMany({
        where: {
          machineId: orderData.machineId,
          status: { not: "Geannuleerd" },
          startDate: { lte: endDate }
        }
      });
      const conflictingOrders = potentialConflicts.filter(o => {
        const bufferedEnd = new Date(o.endDate.getTime() + bufferMs);
        return startDate <= bufferedEnd;
      });

      if (conflictingOrders.length > 0) {
        throw Object.assign(new Error("CONFLICT_ORDER"), {
          conflictingDates: conflictingOrders.map(o => ({
            start: o.startDate.toISOString().split("T")[0],
            end: o.endDate.toISOString().split("T")[0]
          }))
        });
      }

      const blocked = await tx.blockedDate.findFirst({
        where: {
          machineId: orderData.machineId,
          date: { gte: startDate, lte: endDate }
        }
      });

      if (blocked) {
        throw Object.assign(new Error("BLOCKED_DATE"), {
          date: blocked.date.toISOString().split("T")[0],
          reason: blocked.reason
        });
      }

      // Atomic sequential invoice number (Dutch BTW wetgeving)
      const counter = await tx.invoiceCounter.upsert({
        where: { id: "default" },
        create: { id: "default", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      const invoiceYear = new Date().getFullYear();
      const invoiceNumber = `INV-${invoiceYear}-${String(counter.lastNumber).padStart(4, "0")}`;

      return tx.order.create({
        data: {
          id: `HWH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          machineId: orderData.machineId,
          machineName: machine.name,  // always from DB — never trust client (stored XSS risk)
          machinePrice: machine.pricePerDay,
          startDate,
          endDate,
          rentalDays,
          deliveryType: orderData.deliveryType,
          deliveryAddress: orderData.deliveryAddress || "",
          deliveryTimeSlot: orderData.deliveryTimeSlot ? String(orderData.deliveryTimeSlot) : null,
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          customerPhone: orderData.customerPhone,
          customerProfile: orderData.customerProfile || "Particulier",
          subtotal: serverSubtotal,   // server-computed — never store client values
          transportCost: authTransport,
          driverCost: 0,
          vatAmount: serverVat,
          totalAmount: serverTotal,
          status: "In behandeling",
          customerId: resolvedCustomerId,
          // Reconstruct from server-side data — never persist client-sent names or prices
          addons: JSON.stringify(rawAddons.map((a: any) => {
            const id = String(a.id ?? "");
            if (id === "safety") return { id: "safety", name: "Veiligheidskit", price: 15 * rentalDays };
            const sa = crossSellMap.get(id);
            return { id, name: sa?.name ?? id, price: Number(sa?.pricePerWeek ?? 0) * addonWeeks };
          })),
          weekendWork: weekendWork === "ja" || weekendWork === "nee" ? weekendWork : null,
          invoiceNumber,
          paymentStatus: "awaiting"
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    // Store idempotency key so retries return the same order instead of creating a duplicate
    if (idempotencyKey && typeof idempotencyKey === "string") {
      processedIdempotencyKeys.set(idempotencyKey, { orderId: newOrder.id, createdAt: Date.now() });
    }

    // Trigger transactional emails asynchronously
    const emailData = {
      ...newOrder,
      startDate: newOrder.startDate.toISOString().split("T")[0],
      endDate: newOrder.endDate.toISOString().split("T")[0],
      customerPhone: newOrder.customerPhone || ""
    };
    emailService.sendOrderConfirmation(emailData).catch(err => {
      console.error("[EMAIL] Customer confirmation permanently failed for order", newOrder.id, ":", err);
      emailService.sendEmailFailureAlert(newOrder.id, newOrder.customerEmail, String(err)).catch(() => {});
    });
    emailService.sendAdminAlert(emailData).catch(err => {
      console.error("[EMAIL] Admin alert permanently failed for order", newOrder.id, ":", err);
    });

    res.status(201).json({
      ...newOrder,
      startDate: newOrder.startDate.toISOString().split("T")[0],
      endDate: newOrder.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(newOrder.addons)
    });
  } catch (error: any) {
    if (error?.message === "CONFLICT_ORDER") {
      return res.status(409).json({
        error: "Deze machine is al gereserveerd in de opgegeven periode",
        conflictingDates: error.conflictingDates
      });
    }
    if (error?.message === "BLOCKED_DATE") {
      return res.status(409).json({
        error: "De machine is niet beschikbaar op bepaalde datums in de opgegeven periode",
        blockedDates: [{ date: error.date, reason: error.reason }]
      });
    }
    if (error?.code === "P2034" || error?.code === "40001") {
      return res.status(409).json({ error: "Er is veel vraag naar deze machine. Probeer het over enkele seconden opnieuw." });
    }
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Kon bestelling niet aanmaken" });
  }
});

// PUT /api/orders/:id/payment — admin marks payment received
ordersRouter.put("/:id/payment", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  const validStatuses = ["awaiting", "paid", "refunded"];
  if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
    return res.status(400).json({ error: "Ongeldige betalingsstatus" });
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { paymentStatus }
    });
    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(updatedOrder.addons)
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Kon betalingsstatus niet bijwerken" });
  }
});

// PUT /api/orders/:id/cancel — customer cancels their own order
ordersRouter.put("/:id/cancel", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    // Same 404 for "not found" and "not yours" — don't confirm order IDs exist
    if (!order || (req.user?.role !== "admin" && order.customerId !== req.user?.id)) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }

    if (order.status !== "In behandeling") {
      return res.status(400).json({ error: "Alleen bestellingen met status 'In behandeling' kunnen worden geannuleerd" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: "Geannuleerd" }
    });

    const emailData = {
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      customerPhone: updatedOrder.customerPhone || ""
    };
    emailService.sendStatusUpdate(emailData).catch(err => console.error("Cancel email error:", err));
    emailService.sendAdminCancelAlert(emailData).catch(err => console.error("Admin cancel alert error:", err));

    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(updatedOrder.addons)
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Kon bestelling niet annuleren" });
  }
});

// POST /api/orders/:id/rating — customer submits a rating
ordersRouter.post("/:id/rating", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
    return res.status(400).json({ error: "Beoordeling moet een geheel getal tussen 1 en 5 zijn" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || order.customerId !== req.user?.id) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    if (order.status !== "Voltooid") {
      return res.status(400).json({ error: "Alleen voltooide bestellingen kunnen worden beoordeeld" });
    }

    const safeComment = comment ? String(comment).slice(0, 2000) : null;
    const orderRating = await prisma.orderRating.upsert({
      where: { orderId: id },
      create: { orderId: id, rating: Number(rating), comment: safeComment },
      update: { rating: Number(rating), comment: safeComment }
    });

    res.json(orderRating);
  } catch (error) {
    console.error("Error saving rating:", error);
    res.status(500).json({ error: "Kon beoordeling niet opslaan" });
  }
});

// POST /api/orders/:id/rating/guest — guests rate their order by providing the booking e-mail.
// No auth token required; the customerEmail acts as a shared secret for this one order.
ordersRouter.post("/:id/rating/guest", guestRatingLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { email, rating, comment } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "E-mailadres is verplicht" });
  }
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
    return res.status(400).json({ error: "Beoordeling moet een geheel getal tussen 1 en 5 zijn" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    // Only allow for guest orders (customerId null) and only when email matches
    if (!order || order.customerId !== null || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }

    const safeComment = comment ? String(comment).slice(0, 2000) : null;
    const orderRating = await prisma.orderRating.upsert({
      where: { orderId: id },
      create: { orderId: id, rating: Number(rating), comment: safeComment },
      update: { rating: Number(rating), comment: safeComment }
    });

    res.json(orderRating);
  } catch (error) {
    console.error("Error saving guest rating:", error);
    res.status(500).json({ error: "Kon beoordeling niet opslaan" });
  }
});

// GET /api/orders/ratings/summary — public aggregate of real customer ratings,
// used to drive the aggregateRating JSON-LD on the homepage. Returns zeros when
// there are no ratings yet so the structured data omits the rating entirely.
ordersRouter.get("/ratings/summary", publicReadLimiter, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const agg = await prisma.orderRating.aggregate({ _avg: { rating: true }, _count: { rating: true } });
    res.json({ average: agg._avg.rating ?? 0, count: agg._count.rating ?? 0 });
  } catch (error) {
    console.error("Error aggregating ratings:", error);
    res.json({ average: 0, count: 0 });
  }
});

// GET /api/orders/ratings/by-machine — public per-machine rating aggregate,
// used to show star ratings on catalog cards. Joins OrderRating → Order to
// group by machineId. Returns a { machineId: { average, count } } map.
ordersRouter.get("/ratings/by-machine", publicReadLimiter, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ machineId: string; avg: number; cnt: bigint }>>`
      SELECT o."machineId" AS "machineId", AVG(r.rating)::float AS avg, COUNT(r.rating) AS cnt
      FROM "OrderRating" r
      JOIN "Order" o ON o.id = r."orderId"
      GROUP BY o."machineId"
    `;
    const map: Record<string, { average: number; count: number }> = {};
    for (const row of rows) {
      map[row.machineId] = { average: Number(row.avg), count: Number(row.cnt) };
    }
    res.json(map);
  } catch (error) {
    console.error("Error aggregating ratings by machine:", error);
    res.json({});
  }
});

// GET /api/orders/:id/rating — fetch an order's rating
ordersRouter.get("/:id/rating", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || (req.user?.role !== "admin" && order.customerId !== req.user?.id)) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }

    const rating = await prisma.orderRating.findUnique({ where: { orderId: id } });
    res.json(rating || null);
  } catch (error) {
    console.error("Error fetching rating:", error);
    res.status(500).json({ error: "Kon beoordeling niet ophalen" });
  }
});

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  "In behandeling": ["Goedgekeurd", "Geannuleerd"],
  "Goedgekeurd": ["Onderweg", "Geannuleerd"],
  "Onderweg": ["Voltooid"],
  "Voltooid": [],
  "Geannuleerd": []
};

// PUT /api/orders/:id/status
ordersRouter.put("/:id/status", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is verplicht" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    // Validate transition is allowed
    const allowed = VALID_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Overgang van '${order.status}' naar '${status}' is niet toegestaan`
      });
    }

    // Require payment received before approving
    if (status === "Goedgekeurd" && order.paymentStatus !== "paid") {
      return res.status(400).json({
        error: "Betaling moet eerst als ontvangen worden gemarkeerd voordat de bestelling kan worden goedgekeurd"
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status }
    });

    // Trigger status update email asynchronously
    const emailData = {
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      customerPhone: updatedOrder.customerPhone || ""
    };
    emailService.sendStatusUpdate(emailData).catch(err => console.error("Status update email error:", err));

    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(updatedOrder.addons)
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Kon bestelstatus niet bijwerken" });
  }
});

// POST /api/orders/send-reminders — sends rental reminders for orders starting tomorrow
// Protected by REMINDER_SECRET env var so it can be called from a cron service
ordersRouter.post("/send-reminders", async (req: AuthenticatedRequest, res: Response) => {
  const secret = process.env.REMINDER_SECRET;
  const providedKey = req.headers["x-reminder-key"];

  // Always require a secret — if not configured, endpoint is disabled
  if (!secret) {
    return res.status(503).json({ error: "Reminder endpoint niet geconfigureerd (stel REMINDER_SECRET in)" });
  }
  // Hash both sides to fixed length before comparing — prevents secret-length leakage
  const keyHash = crypto.createHash("sha256").update(String(providedKey || "")).digest();
  const secHash = crypto.createHash("sha256").update(secret).digest();
  if (!crypto.timingSafeEqual(keyHash, secHash)) {
    return res.status(401).json({ error: "Ongeldige sleutel" });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const tomorrowStart = new Date(tomorrowStr + "T00:00:00.000Z");
    const tomorrowEnd = new Date(tomorrowStr + "T23:59:59.999Z");

    const orders = await prisma.order.findMany({
      where: {
        startDate: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: ["Goedgekeurd", "Onderweg"] }
      }
    });

    let sent = 0;
    for (const order of orders) {
      const emailData = {
        ...order,
        startDate: order.startDate.toISOString().split("T")[0],
        endDate: order.endDate.toISOString().split("T")[0],
        customerPhone: order.customerPhone || ""
      };
      const ok = await emailService.sendRentalReminder(emailData);
      if (ok) sent++;
    }

    console.log(`[Reminders] Sent ${sent}/${orders.length} reminders for ${tomorrowStr}`);
    res.json({ sent, total: orders.length, date: tomorrowStr });
  } catch (error) {
    console.error("Error sending reminders:", error);
    res.status(500).json({ error: "Kon herinneringen niet verzenden" });
  }
});
