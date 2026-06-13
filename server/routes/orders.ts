import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
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
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// GET orders: admins see all orders, customers see only their own orders.
ordersRouter.get("/", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pageQuery = req.query.page;
    const limitQuery = req.query.limit;
    const whereClause = req.user?.role === "admin" ? undefined : { customerId: req.user!.id };

    if (pageQuery || limitQuery) {
      const page = Number(pageQuery) || 1;
      const limit = Number(limitQuery) || 20;
      const skip = (page - 1) * limit;

      const totalCount = await prisma.order.count({
        where: whereClause
      });
      const totalPages = Math.ceil(totalCount / limit);

      res.setHeader("X-Total-Pages", String(totalPages));
      res.setHeader("X-Total-Count", String(totalCount));

      const dbOrders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });
      const formatted = dbOrders.map(o => ({
        ...o,
        startDate: o.startDate.toISOString().split("T")[0],
        endDate: o.endDate.toISOString().split("T")[0],
        addons: safeParseAddons(o.addons)
      }));
      return res.json(formatted);
    } else {
      const dbOrders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" }
      });
      const formatted = dbOrders.map(o => ({
        ...o,
        startDate: o.startDate.toISOString().split("T")[0],
        endDate: o.endDate.toISOString().split("T")[0],
        addons: safeParseAddons(o.addons)
      }));
      return res.json(formatted);
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// POST orders — with input validation and date collision detection
ordersRouter.post("/", orderCreationLimiter, async (req: AuthenticatedRequest, res: Response) => {
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
    const transportCostClient = Number(orderData.transportCost || 0);
    const driverCostClient = Number(orderData.driverCost || 0);
    const addonsTotal = (Array.isArray(orderData.addons) ? orderData.addons : []).reduce((sum: number, a: any) => {
      const addon = typeof a === "object" && a !== null ? a : {};
      const price = Number(addon.price || 0);
      const billing = addon.billing ?? "flat";
      return sum + (billing === "daily" ? price * rentalDays : price);
    }, 0);
    // Flat-rate pricing mirrors src/utils/pricing.ts calculateItemSubtotal.
    // Strict weekend: 2 days starting Saturday (Sat+Sun) or 3 days starting Friday
    // (Fri+Sat+Sun). startDate is a UTC-parsed Date, so getUTCDay() is timezone-safe.
    let serverSubtotal: number;
    const m = machine as any;
    const dow = startDate.getUTCDay();
    const strictWeekend = (rentalDays === 2 && dow === 6) || (rentalDays === 3 && dow === 5);
    if (rentalDays === 1 && m.oneDayPrice) {
      serverSubtotal = m.oneDayPrice;
    } else if (rentalDays === 2 && strictWeekend && m.weekendPrice) {
      serverSubtotal = m.weekendPrice;
    } else if (rentalDays === 2 && m.twoDayPrice) {
      serverSubtotal = m.twoDayPrice;
    } else if (rentalDays === 3 && strictWeekend && m.weekendPrice) {
      serverSubtotal = m.weekendPrice;
    } else if ((rentalDays === 3 || rentalDays === 4) && m.weeklyPrice) {
      serverSubtotal = m.weeklyPrice;
    } else if (rentalDays >= 5 && rentalDays < 28 && m.weeklyPrice) {
      const fullWeeks = Math.floor(rentalDays / 5);
      const remainder = rentalDays % 5;
      serverSubtotal = fullWeeks * m.weeklyPrice + remainder * machine.pricePerDay;
    } else if (rentalDays >= 28 && m.monthlyPrice) {
      const fullMonths = Math.floor(rentalDays / 28);
      const remainder = rentalDays % 28;
      let remainderCost: number;
      if (remainder >= 5 && m.weeklyPrice) {
        remainderCost = Math.floor(remainder / 5) * m.weeklyPrice + (remainder % 5) * machine.pricePerDay;
      } else {
        remainderCost = remainder * machine.pricePerDay;
      }
      serverSubtotal = fullMonths * m.monthlyPrice + remainderCost;
    } else {
      const rawSubtotal = machine.pricePerDay * rentalDays;
      let serverDiscountAmount = 0;
      if (rentalDays >= 30 && machine.monthlyDiscountPercent) {
        serverDiscountAmount = rawSubtotal * (machine.monthlyDiscountPercent / 100);
      } else if (rentalDays >= 7 && machine.weeklyDiscountPercent) {
        serverDiscountAmount = rawSubtotal * (machine.weeklyDiscountPercent / 100);
      }
      if (machine.campaignDiscountPercent) {
        serverDiscountAmount += rawSubtotal * (machine.campaignDiscountPercent / 100);
      }
      if (machine.campaignDiscountAmount) {
        serverDiscountAmount += (machine.campaignDiscountAmount as number);
      }
      serverSubtotal = Math.max(0, rawSubtotal - serverDiscountAmount);
    }
    serverSubtotal = Math.round(serverSubtotal * 100) / 100;
    const serverVat = Math.round((serverSubtotal + transportCostClient + driverCostClient + addonsTotal) * 21) / 100;
    const serverTotal = Math.round((serverSubtotal + transportCostClient + driverCostClient + addonsTotal + serverVat) * 100) / 100;
    if (Math.abs(serverTotal - Number(orderData.totalAmount)) > 0.10) {
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
      const conflictingOrders = await tx.order.findMany({
        where: {
          machineId: orderData.machineId,
          status: { not: "Geannuleerd" },
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } }
          ]
        }
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
          machineName: orderData.machineName,
          machinePrice: machine.pricePerDay,
          startDate,
          endDate,
          rentalDays,
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
          status: "In behandeling",
          customerId: resolvedCustomerId,
          addons: JSON.stringify(orderData.addons || []),
          invoiceNumber,
          paymentStatus: "awaiting"
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    // Trigger transactional emails asynchronously
    const emailData = {
      ...newOrder,
      startDate: newOrder.startDate.toISOString().split("T")[0],
      endDate: newOrder.endDate.toISOString().split("T")[0],
      customerPhone: newOrder.customerPhone || ""
    };
    emailService.sendOrderConfirmation(emailData).catch(err => console.error("Customer confirmation email error:", err));
    emailService.sendAdminAlert(emailData).catch(err => console.error("Admin alert email error:", err));

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
    res.status(500).json({ error: "Failed to create order" });
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
    res.status(500).json({ error: "Failed to update payment status" });
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
    res.status(500).json({ error: "Failed to cancel order" });
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
    if (!order || (req.user?.role !== "admin" && order.customerId !== req.user?.id)) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }

    const orderRating = await prisma.orderRating.upsert({
      where: { orderId: id },
      create: { orderId: id, rating: Number(rating), comment: comment || null },
      update: { rating: Number(rating), comment: comment || null }
    });

    res.json(orderRating);
  } catch (error) {
    console.error("Error saving rating:", error);
    res.status(500).json({ error: "Failed to save rating" });
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
    res.status(500).json({ error: "Failed to fetch rating" });
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
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/orders/send-reminders — sends rental reminders for orders starting tomorrow
// Protected by REMINDER_SECRET env var so it can be called from a cron service
ordersRouter.post("/send-reminders", async (req: AuthenticatedRequest, res: Response) => {
  const secret = process.env.REMINDER_SECRET;
  const providedKey = req.headers["x-reminder-key"] || req.body?.key;

  // Always require a secret — if not configured, endpoint is disabled
  if (!secret) {
    return res.status(503).json({ error: "Reminder endpoint niet geconfigureerd (stel REMINDER_SECRET in)" });
  }
  const keyBuf = Buffer.from(String(providedKey || ""));
  const secretBuf = Buffer.from(secret);
  if (keyBuf.length !== secretBuf.length || !crypto.timingSafeEqual(keyBuf, secretBuf)) {
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
    res.status(500).json({ error: "Failed to send reminders" });
  }
});
