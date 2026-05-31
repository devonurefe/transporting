import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const blockedDatesRouter = Router();

// GET blocked dates
blockedDatesRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blocked = await prisma.blockedDate.findMany();
    res.json(blocked);
  } catch (error) {
    console.error("Error fetching blocked dates:", error);
    res.status(500).json({ error: "Failed to fetch blocked dates" });
  }
});

// POST blocked dates
blockedDatesRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { machineId, date, reason, action } = req.body;
  if (!machineId || !date) {
    return res.status(400).json({ error: "Onvolledige invoer" });
  }

  try {
    if (action === "unblock") {
      await prisma.blockedDate.deleteMany({
        where: { machineId, date }
      });
      res.json({ success: true, message: "Datum gedeblokkeerd" });
    } else {
      const exists = await prisma.blockedDate.findFirst({
        where: { machineId, date }
      });
      if (!exists) {
        await prisma.blockedDate.create({
          data: {
            machineId,
            date,
            reason: reason || "Handmatig geblokkeerd door beheerder"
          }
        });
      }
      res.status(201).json({ success: true, message: "Datum succesvol geblokkeerd" });
    }
  } catch (error) {
    console.error("Error modifying blocked dates:", error);
    res.status(500).json({ error: "Failed to modify blocked dates" });
  }
});
