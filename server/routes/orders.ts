import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { AuthenticatedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";

export const ordersRouter = Router();

// Public availability feed used by the booking calendar. It intentionally exposes
// only the minimum data needed to detect date collisions.
ordersRouter.get("/availability", async (req: AuthenticatedRequest, res: Response) => {
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
ordersRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
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
    // Check for date collisions with existing active orders for the same machine
    const conflictingOrders = await prisma.order.findMany({
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
      return res.status(409).json({
        error: "Deze machine is al gereserveerd in de opgegeven periode",
        conflictingDates: conflictingOrders.map(o => ({
          start: o.startDate.toISOString().split("T")[0],
          end: o.endDate.toISOString().split("T")[0]
        }))
      });
    }

    // Check for blocked dates in the requested range
    const blockedDates = await prisma.blockedDate.findMany({
      where: {
        machineId: orderData.machineId,
        date: { gte: startDate, lte: endDate }
      }
    });

    if (blockedDates.length > 0) {
      return res.status(409).json({
        error: "De machine is niet beschikbaar op bepaalde datums in de opgegeven periode",
        blockedDates: blockedDates.map(bd => ({
          date: bd.date.toISOString().split("T")[0],
          reason: bd.reason
        }))
      });
    }

    // Resolve customer ID from auth token if present
    let resolvedCustomerId: string | null = null;
    if (req.user && req.user.role !== "admin") {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id }
      });
      if (customer) {
        resolvedCustomerId = req.user.id;
      }
    }

    const newOrder = await prisma.order.create({
      data: {
        id: `HWH-${Math.floor(1000 + Math.random() * 9000)}`,
        machineId: orderData.machineId,
        machineName: orderData.machineName,
        machinePrice: Number(orderData.machinePrice),
        startDate: startDate,
        endDate: endDate,
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
        borgsomStatus: "pending"
      }
    });

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
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// PUT /api/orders/:id/status
ordersRouter.put("/:id/status", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is verplicht" });
  }

  try {
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
