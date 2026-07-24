import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { publicReadLimiter } from "../middleware/publicGuard.js";
import { emailService } from "../services/emailService.js";
import { mollieService } from "../services/mollieService.js";
import { audit } from "../utils/audit.js";
import { resolveFees } from "../utils/fees.js";
import { computeOrderSubtotal, computeTransport, computeAddonsTotal, computeVatAndTotal, buildStoredAddons, computeRentalDays, clampTrailerDays, CampaignRuleLike } from "../utils/orderPricing.js";
import { buildUblInvoiceXml } from "../utils/ublInvoice.js";

export const ordersRouter = Router();

// Genereert — of vernieuwt — de Mollie-betaallink van een order. Fire-and-forget:
// dit mag nooit een order-request laten falen of vertragen. Lukt het niet (geen
// MOLLIE_API_KEY, netwerkfout), dan blijft mollieCheckoutUrl leeg en valt de
// admin-UI terug op de handmatige "[PLAK HIER DE BETAALLINK]"-placeholder.
//
// Wordt aangeroepen vanuit alle drie de paden die een te betalen bedrag opleveren:
// de klant-checkout, de handmatige admin-order, en een prijswijziging via PATCH.
function syncMolliePaymentLink(order: {
  id: string;
  totalAmount: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  molliePaymentId?: string | null;
}): void {
  // "on_location" krijgt per definitie geen link, en een al betaalde order mag er
  // nooit een nieuwe (opnieuw betaalbare) link bij krijgen.
  if (order.paymentMethod === "on_location") return;
  if (order.paymentStatus === "paid") return;

  void (async () => {
    // Bestaat er al een link, dan moet die eerst ongeldig worden: de klant heeft
    // de oude URL nog in WhatsApp staan en zou anders het oude (mogelijk veel
    // lagere) bedrag kunnen afrekenen en als volledig betaald gelden.
    // Best-effort — mislukt archiveren, dan loggen we dat en maken we alsnog de
    // nieuwe link aan; geen link is een slechter resultaat dan een oude erbij.
    if (order.molliePaymentId) {
      const archived = await mollieService.archivePaymentLink(order.molliePaymentId);
      if (!archived) {
        console.warn("[Mollie] Oude betaallink", order.molliePaymentId, "niet gearchiveerd voor order", order.id, "— die blijft mogelijk betaalbaar.");
      }
    }
    const result = await mollieService.createPaymentLink(order);
    if (!result) return;
    await prisma.order.update({
      where: { id: order.id },
      data: { molliePaymentId: result.id, mollieCheckoutUrl: result.checkoutUrl }
    });
  })().catch(err => {
    console.error("[Mollie] Betaallink synchroniseren mislukt voor order", order.id, ":", err);
  });
}

// Sequential invoice number, format "Factuur YYNNNN" (2-digit year + 4-digit
// sequence, e.g. "Factuur 260013"). The counter is global (not reset per year),
// matching the historical INV-YYYY-NNNN scheme it replaces. Shared by both order
// creation paths so the format never diverges. Legacy orders keep their old
// stored INV-… number.
function formatInvoiceNumber(seq: number): string {
  const yy = String(new Date().getFullYear()).slice(-2);
  return `Factuur ${yy}${String(seq).padStart(4, "0")}`;
}

// Optional customer purchase-order (PO) reference, shown on the invoice.
// Free text, capped and trimmed; empty/whitespace becomes null.
function sanitizePoNumber(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, 60);
}

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

// Guests (no customerId) never had a preference to set, so they keep receiving
// live-update emails by default; only a registered customer can opt out.
async function customerWantsEmail(customerId: string | null): Promise<boolean> {
  if (!customerId) return true;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { emailOptIn: true }
  });
  return customer?.emailOptIn !== false;
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

// Gedeelde order-validatieconstanten + regexen. POST heeft historisch eigen
// inline-kopieën (ongewijzigd gelaten); PATCH en handmatige creatie gebruiken deze.
const ORDER_VALID_PROFILES = [
  "Schilder", "Hovenier / Groenverzorging", "Glazenwasser / Gevelreiniger",
  "Aannemer", "Installateur / Elektricien", "Dakdekker / Gevelwerker",
  "Industrieel Onderhoud", "Particulier", "Overig / Anders",
  "Installateur", "Hovenier", "Glazenwasser", "Stukadoor", "Magazijn", "Gevelreiniger",
];
const ORDER_VALID_DELIVERY_TYPES = ["self_pickup", "delivery_by_us", "trailer_rental"];
// Nifty 120/170 ("aanhanger" category) and Ladderlift are themselves towed
// behind the customer's own vehicle — renting an additional trailer to move
// a product that already hitches to a tow bar makes no sense. Mirrors the
// exclusion in src/components/booking/BookingStep1.tsx.
const TRAILER_RENTAL_EXCLUDED_CATEGORIES = ["aanhanger", "ladderlift"];
const ORDER_VALID_TIME_SLOTS = ["morning", "afternoon"];
const ORDER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Availability + blocked-date check binnen een transactie. Gooit CONFLICT_ORDER /
// BLOCKED_DATE (zelfde vorm als POST) zodat de catch-afhandeling identiek is.
// excludeOrderId: sla de order zelf over bij het bewerken van bestaande datums.
// Mirrors src/utils/availability.ts checkAvailability() (capacity + buffer).
async function assertMachineAvailableInTx(
  tx: Prisma.TransactionClient,
  machineId: string,
  startDate: Date,
  endDate: Date,
  excludeOrderId?: string
): Promise<void> {
  const machineCapacity = await tx.machine.findUnique({
    where: { id: machineId },
    select: { bufferDays: true, stockQuantity: true, isRetired: true }
  });
  const bufferMs = (machineCapacity?.bufferDays ?? 0) * 24 * 60 * 60 * 1000;
  const stockQuantity = machineCapacity?.stockQuantity ?? 1;

  // Retired, or an unresolved DamageReport/open MaintenanceEvent exists —
  // blocks the whole machine regardless of dates/stock. Mirrors the client-side
  // check in src/utils/availability.ts (operationallyBlocked param).
  if (machineCapacity?.isRetired) {
    throw new Error("OPERATIONALLY_BLOCKED");
  }
  const [openDamage, openMaintenance] = await Promise.all([
    tx.damageReport.findFirst({ where: { machineId, resolvedAt: null }, select: { id: true } }),
    tx.maintenanceEvent.findFirst({ where: { machineId, completedDate: null }, select: { id: true } })
  ]);
  if (openDamage || openMaintenance) {
    throw new Error("OPERATIONALLY_BLOCKED");
  }

  const potentialConflicts = await tx.order.findMany({
    where: {
      machineId,
      status: { not: "Geannuleerd" },
      startDate: { lte: endDate },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {})
    }
  });
  const candidateOrders = potentialConflicts.filter(o => startDate <= new Date(o.endDate.getTime() + bufferMs));

  if (candidateOrders.length > 0) {
    let curr = new Date(startDate);
    let dayCounter = 0;
    let exhaustedOn: Date | null = null;
    while (curr <= endDate && dayCounter < 1000) {
      dayCounter++;
      const dayTime = curr.getTime();
      const concurrent = candidateOrders.filter(o => {
        const bufferedEnd = o.endDate.getTime() + bufferMs;
        return dayTime >= o.startDate.getTime() && dayTime <= bufferedEnd;
      }).length;
      if (concurrent >= stockQuantity) { exhaustedOn = new Date(curr); break; }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    if (exhaustedOn) {
      const exhaustedTime = exhaustedOn.getTime();
      throw Object.assign(new Error("CONFLICT_ORDER"), {
        conflictingDates: candidateOrders
          .filter(o => exhaustedTime >= o.startDate.getTime() && exhaustedTime <= (o.endDate.getTime() + bufferMs))
          .map(o => ({ start: o.startDate.toISOString().split("T")[0], end: o.endDate.toISOString().split("T")[0] }))
      });
    }
  }

  const blocked = await tx.blockedDate.findFirst({
    where: { machineId, date: { gte: startDate, lte: endDate } }
  });
  if (blocked) {
    throw Object.assign(new Error("BLOCKED_DATE"), {
      date: blocked.date.toISOString().split("T")[0],
      reason: blocked.reason
    });
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

// GET /api/orders/stats — admin dashboard headline aggregates over ALL orders.
// The order list is paginated (max 100/page), so computing KPIs client-side from
// the loaded window silently under-counts once there are >100 orders. This
// aggregates in the DB (groupBy + sum), so cumulative revenue and counts stay
// correct at any volume. Cancelled orders are excluded from revenue.
ordersRouter.get("/stats", requireAdmin as any, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [statusGroups, revenueAgg, paidAgg, overdueCount] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: "Geannuleerd" } } }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: "Geannuleerd" }, paymentStatus: "paid" } }),
      prisma.order.count({ where: { status: "Onderweg", endDate: { lt: new Date() } } })
    ]);
    const byStatus: Record<string, number> = {};
    let totalOrders = 0;
    for (const g of statusGroups) {
      byStatus[g.status] = g._count._all;
      totalOrders += g._count._all;
    }
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      totalOrders,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
      paidRevenue: paidAgg._sum.totalAmount ?? 0,
      activeRentals: (byStatus["Goedgekeurd"] ?? 0) + (byStatus["Onderweg"] ?? 0),
      pending: byStatus["In behandeling"] ?? 0,
      // "Retour" = physically back, not yet inspected — distinct from active
      // (still with the customer) and pending (not yet approved).
      awaitingInspection: (byStatus["Retour"] ?? 0) + (byStatus["Schade gemeld"] ?? 0),
      overdueCount,
      byStatus
    });
  } catch (error) {
    console.error("Error computing order stats:", error);
    res.status(500).json({ error: "Kon orderstatistieken niet berekenen" });
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
  const VALID_DELIVERY_TYPES = ["self_pickup", "delivery_by_us", "trailer_rental"] as const;
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

  // paymentMethod enum validation — "link" (online betaallink) of "on_location"
  // (betalen bij ophalen/levering). Optioneel; leeg wordt als "link" opgeslagen.
  const VALID_PAYMENT_METHODS = ["link", "on_location"];
  if (orderData.paymentMethod && !VALID_PAYMENT_METHODS.includes(String(orderData.paymentMethod))) {
    return res.status(400).json({ error: "Ongeldige betaalwijze" });
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
    // Deactivated/soft-deleted machines are unbookable regardless of how the
    // customer reached this machineId (direct link, shared WhatsApp URL, or a
    // raw API call) — the admin's "Deactiveer" action must be a hard block, not
    // just a catalog/homepage visibility filter.
    if (!machine || machine.isActive === false || machine.deletedAt) {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    if (Math.abs(machine.pricePerDay - Number(orderData.machinePrice)) > 0.01) {
      return res.status(400).json({ error: "Prijs niet actueel. Ververs de pagina en probeer opnieuw." });
    }

    // Load campaign rules for server-side discount mirror
    const siteConf = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const campaignRules: Array<{ scope: string; scopeValue: string; discountPercent: number; isActive: boolean }> =
      Array.isArray((siteConf as any)?.campaignRules) ? (siteConf as any).campaignRules : [];
    // Admin-instelbare transport-/add-on-tarieven — spiegel van getTransportFees/
    // getGlobalAddons in src/utils/pricing.ts (identieke defaults + clamps)
    const fees = resolveFees(siteConf as any);

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
    // trailer_rental: klant kiest zelf het aantal aanhangerdagen (1..rentalDays).
    // Verplicht + gevalideerd voor trailer-orders; genegeerd voor andere bezorgtypes.
    // Uitgesloten voor Nifty ("aanhanger") en Ladderlift — die worden zelf al
    // achter een voertuig getrokken, een extra aanhanger huren is dan zinloos.
    let trailerDays: number | null = null;
    if (dt === "trailer_rental") {
      if (TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes((machine as any).category)) {
        return res.status(400).json({ error: "Aanhanger huren is niet beschikbaar voor dit product — het wordt zelf achter een voertuig getrokken." });
      }
      trailerDays = clampTrailerDays(orderData.trailerDays, rentalDays);
      if (trailerDays === null) {
        return res.status(400).json({ error: "Ongeldig aantal aanhangerdagen" });
      }
    }
    const authTransport = computeTransport(dt, rentalDays, fees, trailerDays);
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
    // the client. Shared with PATCH/manual-create via computeAddonsTotal (mirrors
    // src/utils/pricing.ts addonPriceForRental + the category exclusions).
    const addonsResult = computeAddonsTotal(machine, rentalDays, orderData.addons, fees);
    if ("error" in addonsResult) {
      return res.status(400).json({ error: addonsResult.error });
    }
    const addonsTotal = addonsResult.total;
    // Authoritative subtotal (tier + weekend package + Sunday block + campaign) —
    // shared with PATCH/manual-create, mirrors src/utils/pricing.ts calculateItemSubtotal.
    const serverSubtotal = computeOrderSubtotal(machine, rentalDays, startDate, campaignRules, String(orderData.customerProfile || ""));
    const { vat: serverVat, total: serverTotal } = computeVatAndTotal(serverSubtotal, transportCostClient, driverCostClient, addonsTotal);
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
      // Availability + blocked-date check (capacity/buffer aware) — shared with
      // PATCH/manual-create via assertMachineAvailableInTx.
      await assertMachineAvailableInTx(tx, orderData.machineId, startDate, endDate);

      // Atomic sequential invoice number (Dutch BTW wetgeving)
      const counter = await tx.invoiceCounter.upsert({
        where: { id: "default" },
        create: { id: "default", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      const invoiceNumber = formatInvoiceNumber(counter.lastNumber);

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
          poNumber: sanitizePoNumber(orderData.poNumber),
          trailerDays, // server-gevalideerd; null voor niet-trailer bezorgtypes
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
          addons: JSON.stringify(buildStoredAddons(machine, rentalDays, orderData.addons, fees)),
          weekendWork: null, // legacy field — weekend work toggle removed; weekend handling is now automatic (package + Sunday block)
          invoiceNumber,
          paymentStatus: "awaiting",
          // Klant-gekozen betaalwijze; standaard "link" (online betaallink) als de
          // client niets meestuurt, zodat legacy-gedrag behouden blijft.
          paymentMethod: orderData.paymentMethod === "on_location" ? "on_location" : "link"
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

    // Genereer asynchroon een echte Mollie-betaallink (zie syncMolliePaymentLink).
    syncMolliePaymentLink(newOrder);

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
    if (error?.message === "OPERATIONALLY_BLOCKED") {
      return res.status(409).json({ error: "Deze machine is tijdelijk niet beschikbaar (onderhoud/reparatie)" });
    }
    if (error?.code === "P2034" || error?.code === "40001") {
      return res.status(409).json({ error: "Er is veel vraag naar deze machine. Probeer het over enkele seconden opnieuw." });
    }
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Kon bestelling niet aanmaken" });
  }
});

// POST /api/orders/admin — back-office manual order creation (walk-in/phone).
// Admin-only, no rate limit, price computed authoritatively server-side (no client
// price to trust). Links to an existing customer by email when one matches.
ordersRouter.post("/admin", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body ?? {};
  try {
    if (!body.machineId || !body.customerName || !body.customerEmail) {
      return res.status(400).json({ error: "Onvolledige bestelgegevens" });
    }
    if (String(body.customerName).length > 200) return res.status(400).json({ error: "Naam is te lang (max 200 tekens)" });
    const email = String(body.customerEmail);
    if (email.length > 254 || !ORDER_EMAIL_REGEX.test(email)) return res.status(400).json({ error: "Ongeldig e-mailadres" });
    if (body.customerProfile && !ORDER_VALID_PROFILES.includes(String(body.customerProfile))) {
      return res.status(400).json({ error: "Profiel type niet ondersteund" });
    }
    if (!body.startDate || !body.endDate) return res.status(400).json({ error: "Start- en einddatum zijn verplicht" });
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error: "Ongeldige datumnotatie" });
    if (endDate < startDate) return res.status(400).json({ error: "Einddatum moet na de startdatum liggen" });
    if (!ORDER_VALID_DELIVERY_TYPES.includes(body.deliveryType)) return res.status(400).json({ error: "Ongeldig bezorgtype" });
    if (body.deliveryAddress && String(body.deliveryAddress).length > 500) return res.status(400).json({ error: "Bezorgadres is te lang (max 500 tekens)" });
    if (body.deliveryTimeSlot && !ORDER_VALID_TIME_SLOTS.includes(String(body.deliveryTimeSlot))) return res.status(400).json({ error: "Ongeldig bezorgmoment" });
    if (body.customerPhone) {
      const clean = String(body.customerPhone).replace(/[\s\-().+]/g, "");
      if (!/^\d{7,15}$/.test(clean)) return res.status(400).json({ error: "Ongeldig telefoonnummer" });
    }

    const machine = await prisma.machine.findUnique({ where: { id: body.machineId } });
    if (!machine || machine.isActive === false || machine.deletedAt) {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    if ((machine as any).pickupOnly && body.deliveryType !== "self_pickup") {
      return res.status(400).json({ error: "Voor dit product is alleen afhalen mogelijk" });
    }
    if (body.deliveryType === "trailer_rental" && TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes((machine as any).category)) {
      return res.status(400).json({ error: "Aanhanger huren is niet beschikbaar voor dit product — het wordt zelf achter een voertuig getrokken." });
    }

    const rentalDays = computeRentalDays(startDate, endDate);
    if (rentalDays > 365) return res.status(400).json({ error: "Maximale huurperiode is 365 dagen. Neem contact op voor langere periodes." });

    const siteConf = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const campaignRules: CampaignRuleLike[] = Array.isArray((siteConf as any)?.campaignRules) ? (siteConf as any).campaignRules : [];
    const fees = resolveFees(siteConf as any);
    const addonsResult = computeAddonsTotal(machine, rentalDays, body.addons, fees);
    if ("error" in addonsResult) return res.status(400).json({ error: addonsResult.error });
    const subtotal = computeOrderSubtotal(machine, rentalDays, startDate, campaignRules, String(body.customerProfile || ""));
    // trailer_rental: aantal aanhangerdagen (1..rentalDays). Ontbreekt het bij een
    // handmatige trailer-order, dan valt computeTransport terug op de volledige periode.
    let manualTrailerDays: number | null = null;
    if (body.deliveryType === "trailer_rental" && body.trailerDays !== undefined) {
      manualTrailerDays = clampTrailerDays(body.trailerDays, rentalDays);
      if (manualTrailerDays === null) return res.status(400).json({ error: "Ongeldig aantal aanhangerdagen" });
    }
    const transport = computeTransport(body.deliveryType, rentalDays, fees, manualTrailerDays);
    const { vat, total } = computeVatAndTotal(subtotal, transport, 0, addonsResult.total);
    const storedAddons = buildStoredAddons(machine, rentalDays, body.addons, fees);

    // Link to an existing customer account by email (case-insensitive) if present.
    const matchedCustomer = await prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });

    const created = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      await assertMachineAvailableInTx(tx, body.machineId, startDate, endDate);
      const counter = await tx.invoiceCounter.upsert({
        where: { id: "default" }, create: { id: "default", lastNumber: 1 }, update: { lastNumber: { increment: 1 } }
      });
      const invoiceNumber = formatInvoiceNumber(counter.lastNumber);
      return tx.order.create({
        data: {
          id: `HWH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          machineId: body.machineId,
          machineName: machine.name,
          machinePrice: machine.pricePerDay,
          startDate, endDate, rentalDays,
          deliveryType: body.deliveryType,
          deliveryAddress: body.deliveryAddress || "",
          deliveryTimeSlot: body.deliveryTimeSlot ? String(body.deliveryTimeSlot) : null,
          poNumber: sanitizePoNumber(body.poNumber),
          trailerDays: manualTrailerDays,
          customerName: String(body.customerName),
          customerEmail: email,
          customerPhone: body.customerPhone ? String(body.customerPhone) : "",
          customerProfile: body.customerProfile || "Particulier",
          subtotal, transportCost: transport, driverCost: 0, vatAmount: vat, totalAmount: total,
          status: "In behandeling",
          customerId: matchedCustomer?.id ?? null,
          addons: JSON.stringify(storedAddons),
          weekendWork: null,
          invoiceNumber,
          paymentStatus: "awaiting"
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    audit(req, "order.created_manual", { entity: "Order", entityId: created.id, meta: { machineId: body.machineId, total } });
    // Ook een telefonisch opgenomen order krijgt een echte betaallink, anders zou
    // "Betaallink sturen" hier altijd de handmatige placeholder tonen terwijl een
    // klant-order dat niet doet. paymentMethod is hier null (het handmatige
    // formulier vraagt er niet naar) — dat telt overal als "link", net als in de UI.
    syncMolliePaymentLink(created);
    return res.status(201).json({
      ...created,
      startDate: created.startDate.toISOString().split("T")[0],
      endDate: created.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(created.addons)
    });
  } catch (error: any) {
    if (error?.message === "CONFLICT_ORDER") return res.status(409).json({ error: "Deze machine is al gereserveerd in de opgegeven periode", conflictingDates: error.conflictingDates });
    if (error?.message === "BLOCKED_DATE") return res.status(409).json({ error: "De machine is niet beschikbaar op bepaalde datums in de opgegeven periode", blockedDates: [{ date: error.date, reason: error.reason }] });
    if (error?.message === "OPERATIONALLY_BLOCKED") return res.status(409).json({ error: "Deze machine is tijdelijk niet beschikbaar (onderhoud/reparatie)" });
    if (error?.code === "P2034" || error?.code === "40001") return res.status(409).json({ error: "Er is veel vraag naar deze machine. Probeer het over enkele seconden opnieuw." });
    console.error("Error creating manual order:", error);
    return res.status(500).json({ error: "Kon bestelling niet aanmaken" });
  }
});

// PATCH /api/orders/:id — admin edits an existing order (reschedule, fix customer
// contact, change delivery/add-ons). All prices are recomputed authoritatively
// server-side via the shared pricing helpers; only provided fields change. Not
// allowed on a completed/cancelled order. Availability is re-checked (excluding
// this order) so a reschedule can't double-book.
ordersRouter.patch("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const body = req.body ?? {};
  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Bestelling niet gevonden" });
    if (existing.status === "Geannuleerd" || existing.status === "Voltooid") {
      return res.status(400).json({ error: "Een afgeronde of geannuleerde bestelling kan niet meer worden bewerkt" });
    }
    const machine = await prisma.machine.findUnique({ where: { id: existing.machineId } });
    if (!machine) return res.status(404).json({ error: "Machine niet gevonden" });

    const changed: string[] = [];
    let startDate = existing.startDate;
    let endDate = existing.endDate;
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const s = new Date(body.startDate ?? existing.startDate);
      const e = new Date(body.endDate ?? existing.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return res.status(400).json({ error: "Ongeldige datumnotatie" });
      if (e < s) return res.status(400).json({ error: "Einddatum moet na de startdatum liggen" });
      if (s.getTime() !== existing.startDate.getTime()) { startDate = s; changed.push("startDate"); }
      if (e.getTime() !== existing.endDate.getTime()) { endDate = e; changed.push("endDate"); }
    }
    let customerName = existing.customerName;
    if (body.customerName !== undefined) {
      const v = String(body.customerName).trim();
      if (!v || v.length > 200) return res.status(400).json({ error: "Ongeldige naam" });
      customerName = v; changed.push("customerName");
    }
    let customerEmail = existing.customerEmail;
    if (body.customerEmail !== undefined) {
      const v = String(body.customerEmail);
      if (v.length > 254 || !ORDER_EMAIL_REGEX.test(v)) return res.status(400).json({ error: "Ongeldig e-mailadres" });
      customerEmail = v; changed.push("customerEmail");
    }
    let customerPhone = existing.customerPhone;
    if (body.customerPhone !== undefined) {
      const raw = String(body.customerPhone);
      if (raw) {
        const clean = raw.replace(/[\s\-().+]/g, "");
        if (!/^\d{7,15}$/.test(clean)) return res.status(400).json({ error: "Ongeldig telefoonnummer" });
      }
      customerPhone = raw || null; changed.push("customerPhone");
    }
    let customerProfile = existing.customerProfile;
    if (body.customerProfile !== undefined) {
      if (body.customerProfile && !ORDER_VALID_PROFILES.includes(String(body.customerProfile))) {
        return res.status(400).json({ error: "Profiel type niet ondersteund" });
      }
      customerProfile = body.customerProfile || "Particulier"; changed.push("customerProfile");
    }
    let deliveryType = existing.deliveryType;
    if (body.deliveryType !== undefined) {
      if (!ORDER_VALID_DELIVERY_TYPES.includes(body.deliveryType)) return res.status(400).json({ error: "Ongeldig bezorgtype" });
      deliveryType = body.deliveryType; changed.push("deliveryType");
    }
    if ((machine as any).pickupOnly && deliveryType !== "self_pickup") {
      return res.status(400).json({ error: "Voor dit product is alleen afhalen mogelijk" });
    }
    if (deliveryType === "trailer_rental" && TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes((machine as any).category)) {
      return res.status(400).json({ error: "Aanhanger huren is niet beschikbaar voor dit product — het wordt zelf achter een voertuig getrokken." });
    }
    let deliveryAddress = existing.deliveryAddress;
    if (body.deliveryAddress !== undefined) {
      if (String(body.deliveryAddress).length > 500) return res.status(400).json({ error: "Bezorgadres is te lang (max 500 tekens)" });
      deliveryAddress = String(body.deliveryAddress || ""); changed.push("deliveryAddress");
    }
    let deliveryTimeSlot = existing.deliveryTimeSlot;
    if (body.deliveryTimeSlot !== undefined) {
      if (body.deliveryTimeSlot && !ORDER_VALID_TIME_SLOTS.includes(String(body.deliveryTimeSlot))) return res.status(400).json({ error: "Ongeldig bezorgmoment" });
      deliveryTimeSlot = body.deliveryTimeSlot ? String(body.deliveryTimeSlot) : null; changed.push("deliveryTimeSlot");
    }
    let poNumber = existing.poNumber;
    if (body.poNumber !== undefined) {
      poNumber = sanitizePoNumber(body.poNumber); changed.push("poNumber");
    }
    const addonsInput = body.addons !== undefined ? body.addons : safeParseAddons(existing.addons);
    if (body.addons !== undefined) changed.push("addons");

    if (changed.length === 0) return res.status(400).json({ error: "Geen wijzigingen opgegeven" });

    const rentalDays = computeRentalDays(startDate, endDate);
    if (rentalDays > 365) return res.status(400).json({ error: "Maximale huurperiode is 365 dagen." });

    const siteConf = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const campaignRules: CampaignRuleLike[] = Array.isArray((siteConf as any)?.campaignRules) ? (siteConf as any).campaignRules : [];
    const fees = resolveFees(siteConf as any);
    const addonsResult = computeAddonsTotal(machine, rentalDays, addonsInput, fees);
    if ("error" in addonsResult) return res.status(400).json({ error: addonsResult.error });
    const subtotal = computeOrderSubtotal(machine, rentalDays, startDate, campaignRules, String(customerProfile || ""));
    // Aanhangerdagen bepalen: expliciet in de body (strikt gevalideerd), anders de
    // opgeslagen waarde (soepel geclampt zodat een datumwijziging niet faalt op een
    // oude waarde), anders null → computeTransport valt terug op de volledige periode
    // (legacy-orders van vóór deze functie behouden zo hun prijs). Bij een niet-trailer
    // bezorgtype wordt de aanhangerwaarde gewist.
    let trailerDays: number | null = null;
    if (deliveryType === "trailer_rental") {
      if (body.trailerDays !== undefined) {
        trailerDays = clampTrailerDays(body.trailerDays, rentalDays);
        if (trailerDays === null) return res.status(400).json({ error: "Ongeldig aantal aanhangerdagen" });
        changed.push("trailerDays");
      } else if (existing.trailerDays != null) {
        trailerDays = Math.max(1, Math.min(existing.trailerDays, rentalDays));
      }
    }
    const transport = computeTransport(deliveryType, rentalDays, fees, trailerDays);
    const { vat, total } = computeVatAndTotal(subtotal, transport, 0, addonsResult.total);
    const storedAddons = buildStoredAddons(machine, rentalDays, addonsInput, fees);

    const updated = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      await assertMachineAvailableInTx(tx, existing.machineId, startDate, endDate, id);
      return tx.order.update({
        where: { id },
        data: {
          startDate, endDate, rentalDays,
          customerName, customerEmail, customerPhone, customerProfile, poNumber,
          deliveryType, deliveryAddress, deliveryTimeSlot, trailerDays,
          subtotal, transportCost: transport, driverCost: 0, vatAmount: vat, totalAmount: total,
          addons: JSON.stringify(storedAddons)
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    audit(req, "order.updated", { entity: "Order", entityId: id, meta: { fields: changed.slice(0, 40) } });
    // Is het te betalen bedrag gewijzigd, dan klopt een eerder verstuurde betaallink
    // niet meer: die staat nog op het oude bedrag. Oude link archiveren + nieuwe
    // aanmaken. Bewust alléén bij een bedragwijziging — bij bv. een getypte
    // naamcorrectie zou je anders de link die de klant al heeft ongeldig maken.
    if (Math.abs(updated.totalAmount - existing.totalAmount) > 0.01) {
      syncMolliePaymentLink(updated);
    }
    return res.json({
      ...updated,
      startDate: updated.startDate.toISOString().split("T")[0],
      endDate: updated.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(updated.addons)
    });
  } catch (error: any) {
    if (error?.message === "CONFLICT_ORDER") return res.status(409).json({ error: "Deze machine is al gereserveerd in de opgegeven periode", conflictingDates: error.conflictingDates });
    if (error?.message === "BLOCKED_DATE") return res.status(409).json({ error: "De machine is niet beschikbaar op bepaalde datums in de opgegeven periode", blockedDates: [{ date: error.date, reason: error.reason }] });
    if (error?.message === "OPERATIONALLY_BLOCKED") return res.status(409).json({ error: "Deze machine is tijdelijk niet beschikbaar (onderhoud/reparatie)" });
    if (error?.code === "P2034" || error?.code === "40001") return res.status(409).json({ error: "Er is veel vraag naar deze machine. Probeer het over enkele seconden opnieuw." });
    console.error("Error updating order:", error);
    return res.status(500).json({ error: "Kon bestelling niet bijwerken" });
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
    audit(req, "order.payment", { entity: "Order", entityId: id, meta: { to: paymentStatus } });
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

// PUT /api/orders/:id/date-proposal — admin records/clears a proposed reschedule.
// Lightweight and non-destructive: it only stores the proposed dates for follow-up
// in the admin panel; it never touches the real startDate/endDate, pricing, or
// availability. Send { proposedStartDate, proposedEndDate } (ISO date strings) to
// set, or { proposedStartDate: null } to clear once the customer has responded.
ordersRouter.put("/:id/date-proposal", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { proposedStartDate, proposedEndDate } = req.body ?? {};

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Bestelling niet gevonden" });

    let data: { proposedStartDate: Date | null; proposedEndDate: Date | null; proposedAt: Date | null };
    if (proposedStartDate == null && proposedEndDate == null) {
      // Clear an existing proposal
      data = { proposedStartDate: null, proposedEndDate: null, proposedAt: null };
    } else {
      const start = new Date(proposedStartDate);
      const end = new Date(proposedEndDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Ongeldige voorsteldata" });
      }
      if (end < start) {
        return res.status(400).json({ error: "Einddatum moet op of na de startdatum liggen" });
      }
      data = { proposedStartDate: start, proposedEndDate: end, proposedAt: new Date() };
    }

    const updatedOrder = await prisma.order.update({ where: { id }, data });
    audit(req, "order.date_proposal", {
      entity: "Order",
      entityId: id,
      meta: data.proposedStartDate
        ? { start: proposedStartDate, end: proposedEndDate }
        : { cleared: true }
    });
    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: safeParseAddons(updatedOrder.addons)
    });
  } catch (error) {
    console.error("Error saving date proposal:", error);
    res.status(500).json({ error: "Kon datumvoorstel niet opslaan" });
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
    if (await customerWantsEmail(updatedOrder.customerId)) {
      emailService.sendStatusUpdate(emailData).catch(err => console.error("Cancel email error:", err));
    }
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

// GET /api/orders/ratings/recent — public list of the most recent REAL customer
// reviews that have written text, for the footer testimonial ticker. Privacy:
// deliberately returns NO customer name (OrderRating has none, and we don't join
// customer identity into a public feed). Only rating + comment + date.
ordersRouter.get("/ratings/recent", publicReadLimiter, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await prisma.orderRating.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { rating: true, comment: true, createdAt: true },
    });
    // Guard against empty/whitespace comments slipping through.
    const reviews = rows
      .filter((r) => (r.comment ?? "").trim().length > 0)
      .map((r) => ({ rating: r.rating, comment: (r.comment ?? "").trim(), createdAt: r.createdAt }));
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching recent ratings:", error);
    res.json([]);
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

// GET /api/orders/export — download all orders as CSV (admin only)
// Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), status (comma-separated), format ("csv"|"json")
// format=json returns the same server-filtered result set (unbounded by list-endpoint pagination)
// so the admin UI can show accurate totals for a filter before committing to the download.
ordersRouter.get("/export", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { from, to, status, format } = req.query as Record<string, string>;

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !ISO_DATE_RE.test(from)) {
    return res.status(400).json({ error: "Ongeldig 'van' datumformaat (verwacht: YYYY-MM-DD)" });
  }
  if (to && !ISO_DATE_RE.test(to)) {
    return res.status(400).json({ error: "Ongeldig 'tot' datumformaat (verwacht: YYYY-MM-DD)" });
  }

  const where: any = {};
  if (from) where.startDate = { ...(where.startDate ?? {}), gte: new Date(from + "T00:00:00.000Z") };
  if (to)   where.startDate = { ...(where.startDate ?? {}), lte: new Date(to   + "T23:59:59.999Z") };
  if (status) {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) where.status = { in: statuses };
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    if (format === "json") {
      return res.json({
        count: orders.length,
        orders: orders.map(o => ({
          id: o.id,
          status: o.status,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount
        }))
      });
    }

    const escape = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = [
      "Order ID","Naam","E-mail","Telefoon","Profiel",
      "Machine","Dagtarief","Startdatum","Einddatum","Dagen",
      "Levertype","Adres","Subtotaal","Transport","Chauffeur","BTW","Totaal",
      "Status","Betaalstatus","Betaalwijze","Aangemaakt op"
    ];

    const rows = orders.map(o => [
      o.id,
      o.customerName,
      o.customerEmail ?? "",
      o.customerPhone ?? "",
      o.customerProfile ?? "",
      o.machineName,
      o.machinePrice.toFixed(2),
      o.startDate.toISOString().split("T")[0],
      o.endDate.toISOString().split("T")[0],
      o.rentalDays,
      o.deliveryType ?? "",
      o.deliveryAddress ?? "",
      o.subtotal.toFixed(2),
      o.transportCost.toFixed(2),
      o.driverCost.toFixed(2),
      o.vatAmount.toFixed(2),
      o.totalAmount.toFixed(2),
      o.status,
      o.paymentStatus ?? "",
      (o as any).paymentMethod === "on_location" ? "Op locatie" : (o as any).paymentMethod === "link" ? "Betaallink" : "",
      o.createdAt.toISOString().split("T")[0]
    ].map(escape).join(","));

    const csv = [headers.join(","), ...rows].join("\r\n");
    const filename = `huurgo-orders-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("﻿" + csv); // BOM for Excel UTF-8 detection
  } catch (error) {
    console.error("Error exporting orders:", error);
    res.status(500).json({ error: "Export mislukt" });
  }
});

// GET /api/orders/:id/export/ubl — single-order UBL 2.1 e-invoice XML, the
// standard NL/EU e-factuur format most accounting packages (incl. Exact
// Online) can import directly as a purchase invoice on the customer's side.
// "Stage 1" Exact integration — no OAuth/API connection needed, see CLAUDE.md.
ordersRouter.get("/:id/export/ubl", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    const cfg = await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: { companyLegalName: true, companyAddress: true, kvkNumber: true, btwNumber: true, contactEmail: true, contactPhone: true }
    });

    const company = {
      legalName: cfg?.companyLegalName || "MB Hoogwerkers B.V.",
      address: cfg?.companyAddress || "Produktieweg 20, 2382 PB Zoeterwoude",
      kvkNumber: cfg?.kvkNumber || "67438237",
      btwNumber: cfg?.btwNumber || "NL856990656B01",
      email: cfg?.contactEmail || "info@huurgo.nl",
      phone: cfg?.contactPhone || "071 542 8114"
    };

    const xml = buildUblInvoiceXml(
      {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        poNumber: order.poNumber,
        machineName: order.machineName,
        machinePrice: order.machinePrice,
        startDate: order.startDate,
        endDate: order.endDate,
        rentalDays: order.rentalDays,
        subtotal: order.subtotal,
        transportCost: order.transportCost,
        driverCost: order.driverCost,
        vatAmount: order.vatAmount,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        addons: safeParseAddons(order.addons)
      },
      company
    );

    const safeName = (order.invoiceNumber || order.id).replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-ubl.xml"`);
    res.send(xml);
  } catch (error) {
    console.error("Error exporting order to UBL:", error);
    res.status(500).json({ error: "Export mislukt" });
  }
});

// "Onderweg" no longer jumps straight to "Voltooid" — the machine must first
// come back to "Retour" (physically returned, unverified) before an admin
// either clears it ("Voltooid") or logs damage via POST /:id/report-damage
// (which itself sets "Schade gemeld"). See docs/admin-platform-audit-2026-07.md §3/§9.
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  "In behandeling": ["Goedgekeurd", "Geannuleerd"],
  "Goedgekeurd": ["Onderweg", "Geannuleerd"],
  "Onderweg": ["Retour"],
  "Retour": ["Voltooid", "Schade gemeld"],
  "Schade gemeld": ["Voltooid"],
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
    audit(req, "order.status", { entity: "Order", entityId: id, meta: { from: order.status, to: status } });

    // Trigger status update email asynchronously — respects the customer's live-update preference
    if (await customerWantsEmail(updatedOrder.customerId)) {
      const emailData = {
        ...updatedOrder,
        startDate: updatedOrder.startDate.toISOString().split("T")[0],
        endDate: updatedOrder.endDate.toISOString().split("T")[0],
        customerPhone: updatedOrder.customerPhone || ""
      };
      emailService.sendStatusUpdate(emailData).catch(err => console.error("Status update email error:", err));
    }

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

// Admin-only photos array for a damage report — base64 data: URLs, same storage
// pattern as Machine.imageUrl but never exposed on any public endpoint. Caps
// count and per-item length to bound abuse; returns null (reject) if malformed.
// Bounded to stay well under the 15mb body limit registered in server.ts
// for /api/orders (POST :id/report-damage) — 6 × 2M chars ≈ 12MB base64 max.
function sanitizeDamagePhotos(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.length > 6) return null;
  const cleaned: string[] = [];
  for (const p of raw) {
    if (typeof p !== "string" || p.length === 0) return null;
    if (p.length > 2_000_000) return null; // ~1.5MB decoded per photo
    cleaned.push(p);
  }
  return cleaned;
}

// POST /api/orders/:id/report-damage — logs a DamageReport for the order's
// machine and moves the order to "Schade gemeld" in one transaction, so the
// machine is blocked (see server/utils/machineStatus.ts) the instant damage
// is recorded, never in a partially-applied state. Only legal from "Retour"
// (mirrors VALID_STATUS_TRANSITIONS — this is the only path into "Schade gemeld").
ordersRouter.post("/:id/report-damage", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const description = String(req.body?.description ?? "").trim();
  if (!description || description.length > 2000) {
    return res.status(400).json({ error: "Omschrijving is verplicht (max 2000 tekens)" });
  }
  const photos = sanitizeDamagePhotos(req.body?.photos);
  if (photos === null) {
    return res.status(400).json({ error: "Ongeldige foto's (max 10, elk te groot bestand)" });
  }
  let repairCost: number | null = null;
  if (req.body?.repairCost !== undefined && req.body?.repairCost !== null && req.body?.repairCost !== "") {
    const v = Number(req.body.repairCost);
    if (isNaN(v) || v < 0 || v > 1_000_000) return res.status(400).json({ error: "Ongeldig herstelbedrag" });
    repairCost = Math.round(v * 100) / 100;
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    const allowed = VALID_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes("Schade gemeld")) {
      return res.status(400).json({ error: `Schade melden kan niet vanuit status '${order.status}'` });
    }

    const [damageReport, updatedOrder] = await prisma.$transaction([
      prisma.damageReport.create({
        data: {
          orderId: id,
          machineId: order.machineId,
          machineName: order.machineName,
          description,
          photos: photos.length > 0 ? photos : undefined,
          repairCost: repairCost ?? undefined
        }
      }),
      prisma.order.update({ where: { id }, data: { status: "Schade gemeld" } })
    ]);

    audit(req, "order.damage_reported", {
      entity: "Order",
      entityId: id,
      meta: { machineId: order.machineId, damageReportId: damageReport.id, hasPhotos: photos.length > 0 }
    });

    if (await customerWantsEmail(updatedOrder.customerId)) {
      const emailData = {
        ...updatedOrder,
        startDate: updatedOrder.startDate.toISOString().split("T")[0],
        endDate: updatedOrder.endDate.toISOString().split("T")[0],
        customerPhone: updatedOrder.customerPhone || ""
      };
      emailService.sendStatusUpdate(emailData).catch(err => console.error("Damage-report status email error:", err));
    }

    res.status(201).json({
      damageReport,
      order: {
        ...updatedOrder,
        startDate: updatedOrder.startDate.toISOString().split("T")[0],
        endDate: updatedOrder.endDate.toISOString().split("T")[0],
        addons: safeParseAddons(updatedOrder.addons)
      }
    });
  } catch (error) {
    console.error("Error reporting damage:", error);
    res.status(500).json({ error: "Kon schademelding niet opslaan" });
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
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayStart = new Date(todayStr + "T00:00:00.000Z");

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const tomorrowStart = new Date(tomorrowStr + "T00:00:00.000Z");
    const tomorrowEnd = new Date(tomorrowStr + "T23:59:59.999Z");

    // Auto-cancel stale orders: "In behandeling" + unpaid + startDate already passed.
    // These are bookings where the customer never paid and the rental window is gone —
    // keeping them blocks the calendar for no reason.
    const staleOrders = await prisma.order.findMany({
      where: {
        status: "In behandeling",
        paymentStatus: "awaiting",
        startDate: { lt: todayStart }
      }
    });

    let autoCancelled = 0;
    for (const order of staleOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "Geannuleerd" }
      });
      autoCancelled++;
      console.log(`[AutoCancel] ${order.id} — startDate ${order.startDate.toISOString().split("T")[0]} passed, never paid → Geannuleerd`);
    }

    // Send rental reminders for tomorrow's confirmed orders
    const orders = await prisma.order.findMany({
      where: {
        startDate: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: ["Goedgekeurd", "Onderweg"] }
      }
    });

    let sent = 0;
    for (const order of orders) {
      if (!(await customerWantsEmail(order.customerId))) continue;
      const emailData = {
        ...order,
        startDate: order.startDate.toISOString().split("T")[0],
        endDate: order.endDate.toISOString().split("T")[0],
        customerPhone: order.customerPhone || ""
      };
      const ok = await emailService.sendRentalReminder(emailData);
      if (ok) sent++;
    }

    // Payment reminders: unpaid "In behandeling" orders placed 24h+ ago that
    // haven't already gotten one. Skipped entirely once paid or reminded --
    // never re-sent on every daily cron run.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const unpaidOrders = await prisma.order.findMany({
      where: {
        status: "In behandeling",
        paymentStatus: "awaiting",
        createdAt: { lte: dayAgo },
        paymentReminderSentAt: null
      }
    });

    let paymentRemindersSent = 0;
    for (const order of unpaidOrders) {
      if (!(await customerWantsEmail(order.customerId))) continue;
      const emailData = {
        ...order,
        startDate: order.startDate.toISOString().split("T")[0],
        endDate: order.endDate.toISOString().split("T")[0],
        customerPhone: order.customerPhone || ""
      };
      const ok = await emailService.sendPaymentReminder(emailData);
      if (ok) {
        paymentRemindersSent++;
        await prisma.order.update({ where: { id: order.id }, data: { paymentReminderSentAt: new Date() } });
      }
    }

    console.log(`[Reminders] Sent ${sent}/${orders.length} rental reminders for ${tomorrowStr}, ${paymentRemindersSent}/${unpaidOrders.length} payment reminders`);
    res.json({ sent, total: orders.length, date: tomorrowStr, autoCancelled, paymentRemindersSent, paymentRemindersTotal: unpaidOrders.length });
  } catch (error) {
    console.error("Error sending reminders:", error);
    res.status(500).json({ error: "Kon herinneringen niet verzenden" });
  }
});
