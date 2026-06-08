import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";

export const ordersRouter = Router();

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
  try {
    const dbOrders = await prisma.order.findMany({
      where: {
        status: {
          not: "Geannuleerd"
        }
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
        addons: JSON.parse(o.addons || "[]")
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
        addons: JSON.parse(o.addons || "[]")
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

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(orderData.customerEmail)) {
    return res.status(400).json({ error: "Ongeldig e-mailadres" });
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

  try {
    // Server-side price validation — reject if client price deviates from DB
    const machine = await prisma.machine.findUnique({ where: { id: orderData.machineId } });
    if (!machine) {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    if (Math.abs(machine.pricePerDay - Number(orderData.machinePrice)) > 0.01) {
      return res.status(400).json({ error: "Prijs niet actueel. Ververs de pagina en probeer opnieuw." });
    }

    // Resolve customer ID from auth token if present (outside transaction — read-only)
    let resolvedCustomerId: string | null = null;
    if (req.user && req.user.role !== "admin") {
      const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
      if (customer) resolvedCustomerId = req.user.id;
    }

    // Serializable transaction: availability check + blocked-date check + create are atomic
    const newOrder = await prisma.$transaction(async (tx) => {
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
          status: "In behandeling",
          customerId: resolvedCustomerId,
          addons: JSON.stringify(orderData.addons || []),
          borgsom: Number(orderData.borgsom || 0),
          borgsomStatus: "pending",
          invoiceNumber,
          paymentStatus: "awaiting"
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
      addons: JSON.parse(newOrder.addons)
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
      addons: JSON.parse(updatedOrder.addons || "[]")
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

// PUT /api/orders/:id/borgsom — admin updates borgsom status
ordersRouter.put("/:id/borgsom", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { borgsomStatus } = req.body;

  const validStatuses = ["pending", "returned", "withheld"];
  if (!borgsomStatus || !validStatuses.includes(borgsomStatus)) {
    return res.status(400).json({ error: "Ongeldige borgsom status" });
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { borgsomStatus }
    });

    if (borgsomStatus === "returned") {
      const emailData = {
        ...updatedOrder,
        startDate: updatedOrder.startDate.toISOString().split("T")[0],
        endDate: updatedOrder.endDate.toISOString().split("T")[0],
        customerPhone: updatedOrder.customerPhone || ""
      };
      emailService.sendBorgsomRefundEmail(emailData).catch(err => console.error("Borgsom refund email error:", err));
    }

    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: JSON.parse(updatedOrder.addons || "[]")
    });
  } catch (error) {
    console.error("Error updating borgsom status:", error);
    res.status(500).json({ error: "Failed to update borgsom status" });
  }
});

// PUT /api/orders/:id/cancel — customer cancels their own order
ordersRouter.put("/:id/cancel", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    if (req.user?.role !== "admin" && order.customerId !== req.user?.id) {
      return res.status(403).json({ error: "U heeft geen toestemming om deze bestelling te annuleren" });
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

    res.json({
      ...updatedOrder,
      startDate: updatedOrder.startDate.toISOString().split("T")[0],
      endDate: updatedOrder.endDate.toISOString().split("T")[0],
      addons: JSON.parse(updatedOrder.addons || "[]")
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
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    if (req.user?.role !== "admin" && order.customerId !== req.user?.id) {
      return res.status(403).json({ error: "U heeft geen toestemming" });
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
    if (!order) return res.status(404).json({ error: "Bestelling niet gevonden" });

    if (req.user?.role !== "admin" && order.customerId !== req.user?.id) {
      return res.status(403).json({ error: "U heeft geen toestemming" });
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
      addons: JSON.parse(updatedOrder.addons || "[]")
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

  if (secret && providedKey !== secret) {
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
