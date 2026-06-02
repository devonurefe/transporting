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
    res.json(dbOrders);
  } catch (error) {
    console.error("Error fetching order availability:", error);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// GET orders: admins see all orders, customers see only their own orders.
ordersRouter.get("/", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbOrders = await prisma.order.findMany({
      where: req.user?.role === "admin" ? undefined : { customerId: req.user!.id },
      orderBy: { createdAt: "desc" }
    });
    const formatted = dbOrders.map(o => ({
      ...o,
      addons: JSON.parse(o.addons || "[]")
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// POST orders
ordersRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const orderData = req.body;
  if (!orderData.machineId || !orderData.customerName || !orderData.customerEmail) {
    return res.status(400).json({ error: "Onvolledige bestelgegevens" });
  }

  try {
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
        status: "In behandeling",
        customerId: resolvedCustomerId,
        addons: JSON.stringify(orderData.addons || [])
      }
    });

    // Trigger transactional emails asynchronously
    const emailData = {
      ...newOrder,
      customerPhone: newOrder.customerPhone || ""
    };
    emailService.sendOrderConfirmation(emailData).catch(err => console.error("Customer confirmation email error:", err));
    emailService.sendAdminAlert(emailData).catch(err => console.error("Admin alert email error:", err));

    res.status(201).json({
      ...newOrder,
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
      customerPhone: updatedOrder.customerPhone || ""
    };
    emailService.sendStatusUpdate(emailData).catch(err => console.error("Status update email error:", err));

    res.json({
      ...updatedOrder,
      addons: JSON.parse(updatedOrder.addons || "[]")
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});
