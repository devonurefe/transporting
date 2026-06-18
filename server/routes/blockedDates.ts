import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const blockedDatesRouter = Router();

// GET blocked dates
blockedDatesRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blocked = await prisma.blockedDate.findMany();
    const formatted = blocked.map(b => ({
      ...b,
      date: b.date.toISOString().split("T")[0]
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching blocked dates:", error);
    res.status(500).json({ error: "Kon geblokkeerde datums niet ophalen" });
  }
});

// POST blocked dates
blockedDatesRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { machineId, date, reason, action } = req.body;
  if (!machineId || !date) {
    return res.status(400).json({ error: "Onvolledige invoer" });
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: "Ongeldige datum" });
  }

  try {
    if (action === "unblock") {
      await prisma.blockedDate.deleteMany({
        where: { machineId, date: parsedDate }
      });
      res.json({ success: true, message: "Datum gedeblokkeerd" });
    } else {
      const exists = await prisma.blockedDate.findFirst({
        where: { machineId, date: parsedDate }
      });
      if (!exists) {
        await prisma.blockedDate.create({
          data: {
            machineId,
            date: parsedDate,
            reason: reason || "Handmatig geblokkeerd door beheerder"
          }
        });
      }
      res.status(201).json({ success: true, message: "Datum succesvol geblokkeerd" });
    }
  } catch (error) {
    console.error("Error modifying blocked dates:", error);
    res.status(500).json({ error: "Kon geblokkeerde datums niet wijzigen" });
  }
});
