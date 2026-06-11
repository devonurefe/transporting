import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const machinesRouter = Router();

async function getCategoryLabel(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  });
  return category?.label || categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

// GET machines
machinesRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pageQuery = req.query.page;
    const limitQuery = req.query.limit;

    if (pageQuery || limitQuery) {
      const page = Number(pageQuery) || 1;
      const limit = Number(limitQuery) || 20;
      const skip = (page - 1) * limit;

      const totalCount = await prisma.machine.count();
      const totalPages = Math.ceil(totalCount / limit);

      res.setHeader("X-Total-Pages", String(totalPages));
      res.setHeader("X-Total-Count", String(totalCount));

      const dbMachines = await prisma.machine.findMany({
        skip,
        take: limit
      });
      const formatted = dbMachines.map(m => ({
        ...m,
        suitableFor: Array.isArray(m.suitableFor) ? m.suitableFor : [],
        additionalImages: Array.isArray(m.additionalImages) ? m.additionalImages : []
      }));
      return res.json(formatted);
    } else {
      const dbMachines = await prisma.machine.findMany();
      const formatted = dbMachines.map(m => ({
        ...m,
        suitableFor: Array.isArray(m.suitableFor) ? m.suitableFor : [],
        additionalImages: Array.isArray(m.additionalImages) ? m.additionalImages : []
      }));
      return res.json(formatted);
    }
  } catch (error) {
    console.error("Error fetching machines:", error);
    res.status(500).json({ error: "Failed to fetch machines" });
  }
});

// Shared validation for machine input (used by both POST and PUT)
function validateMachineInput(body: any): { valid: boolean; error?: string } {
  const { name, category, height, pricePerDay, reach, weight, weeklyDiscountPercent, monthlyDiscountPercent, campaignDiscountPercent, campaignDiscountAmount } = body;

  if (!name?.trim() || !category?.trim() || !height || !pricePerDay) {
    return { valid: false, error: "Missing required machine fields" };
  }

  const numHeight = Number(height);
  const numReach = Number(reach || 0);
  const numWeight = Number(weight || 1500);
  const numPrice = Number(pricePerDay);

  if (isNaN(numHeight) || numHeight <= 0) return { valid: false, error: "Werkhoogte moet een positief getal groter dan 0 zijn." };
  if (isNaN(numReach) || numReach < 0) return { valid: false, error: "Zijwaarts bereik moet 0 of groter zijn." };
  if (isNaN(numWeight) || numWeight <= 0) return { valid: false, error: "Gewicht moet een positief getal groter dan 0 zijn." };
  if (isNaN(numPrice) || numPrice <= 0) return { valid: false, error: "Huurtarief moet een positief getal groter dan 0 zijn." };

  if (weeklyDiscountPercent !== undefined && weeklyDiscountPercent !== null && weeklyDiscountPercent !== "") {
    const v = Number(weeklyDiscountPercent);
    if (isNaN(v) || v < 0 || v > 100) return { valid: false, error: "Weekkorting moet tussen 0% en 100% liggen." };
  }
  if (monthlyDiscountPercent !== undefined && monthlyDiscountPercent !== null && monthlyDiscountPercent !== "") {
    const v = Number(monthlyDiscountPercent);
    if (isNaN(v) || v < 0 || v > 100) return { valid: false, error: "Maandkorting moet tussen 0% en 100% liggen." };
  }
  if (campaignDiscountPercent !== undefined && campaignDiscountPercent !== null && campaignDiscountPercent !== "") {
    const v = Number(campaignDiscountPercent);
    if (isNaN(v) || v < 0 || v > 100) return { valid: false, error: "Campagne kortingspercentage moet tussen 0% en 100% liggen." };
  }
  if (campaignDiscountAmount !== undefined && campaignDiscountAmount !== null && campaignDiscountAmount !== "") {
    const v = Number(campaignDiscountAmount);
    if (isNaN(v) || v < 0) return { valid: false, error: "Campagne kortingsbedrag moet 0 of groter zijn." };
  }

  return { valid: true };
}

// POST new machine
machinesRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const validation = validateMachineInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { 
    name, 
    category, 
    height, 
    reach, 
    weight, 
    pricePerDay, 
    powerType, 
    imageUrl, 
    description, 
    suitableFor,
    weeklyDiscountPercent,
    monthlyDiscountPercent,
    campaignText,
    campaignDiscountPercent,
    campaignDiscountAmount,
    packageContents,
    additionalImages
  } = req.body;

  try {
    const categoryLabel = await getCategoryLabel(category);
    const newMachine = await prisma.machine.create({
      data: {
        id: `custom-${Date.now()}`,
        name,
        category,
        categoryLabel,
        height: Number(height),
        reach: Number(reach || 0),
        weight: Number(weight || 1500),
        pricePerDay: Number(pricePerDay),
        powerType: powerType || "Elektrisch",
        imageUrl: imageUrl || "/placeholder-machine.webp",
        imageAlt: name,
        description: description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.",
        suitableFor: Array.isArray(suitableFor) ? suitableFor : ["Algemeen"],
        weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : null,
        packageContents: packageContents || null,
        additionalImages: Array.isArray(additionalImages) ? additionalImages : []
      }
    });

    res.status(201).json({
      ...newMachine,
      suitableFor: Array.isArray(newMachine.suitableFor) ? newMachine.suitableFor : [],
      additionalImages: Array.isArray(newMachine.additionalImages) ? newMachine.additionalImages : []
    });
  } catch (error: any) {
    console.error("Error creating machine:", error);
    res.status(500).json({ error: "Machine aanmaken mislukt" });
  }
});

// PUT update machine
machinesRouter.put("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const validation = validateMachineInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { 
    name, 
    category, 
    height, 
    reach, 
    weight, 
    pricePerDay, 
    powerType, 
    imageUrl, 
    description, 
    suitableFor,
    weeklyDiscountPercent,
    monthlyDiscountPercent,
    campaignText,
    campaignDiscountPercent,
    campaignDiscountAmount,
    packageContents,
    additionalImages
  } = req.body;

  try {
    const categoryLabel = await getCategoryLabel(category);
    const updatedMachine = await prisma.machine.update({
      where: { id },
      data: {
        name,
        category,
        categoryLabel,
        height: Number(height),
        reach: Number(reach || 0),
        weight: Number(weight || 1500),
        pricePerDay: Number(pricePerDay),
        powerType: powerType || "Elektrisch",
        imageUrl: imageUrl !== undefined && imageUrl !== null ? imageUrl : "",
        imageAlt: name,
        description: description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.",
        suitableFor: Array.isArray(suitableFor) ? suitableFor : suitableFor ? [suitableFor] : ["Algemeen"],
        weeklyDiscountPercent: weeklyDiscountPercent !== undefined && weeklyDiscountPercent !== null ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent !== undefined && monthlyDiscountPercent !== null ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent !== undefined && campaignDiscountPercent !== null ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount !== undefined && campaignDiscountAmount !== null ? Number(campaignDiscountAmount) : null,
        packageContents: packageContents !== undefined ? packageContents : null,
        additionalImages: Array.isArray(additionalImages) ? additionalImages : []
      }
    });

    res.json({
      ...updatedMachine,
      suitableFor: Array.isArray(updatedMachine.suitableFor) ? updatedMachine.suitableFor : [],
      additionalImages: Array.isArray(updatedMachine.additionalImages) ? updatedMachine.additionalImages : []
    });
  } catch (error: any) {
    console.error("Error updating machine:", error);
    res.status(500).json({ error: "Machine bijwerken mislukt" });
  }
});

// DELETE machine
machinesRouter.delete("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const activeOrder = await prisma.order.findFirst({
      where: {
        machineId: id,
        status: { in: ["In behandeling", "Goedgekeurd", "Onderweg"] }
      }
    });
    if (activeOrder) {
      return res.status(409).json({ error: "Deze machine heeft actieve bestellingen en kan niet worden verwijderd. Annuleer eerst alle actieve bestellingen." });
    }
    await prisma.blockedDate.deleteMany({
      where: { machineId: id }
    });
    await prisma.machine.delete({
      where: { id }
    });
    res.json({ success: true, message: "Machine deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting machine:", error);
    res.status(500).json({ error: "Failed to delete machine: " + error.message });
  }
});
