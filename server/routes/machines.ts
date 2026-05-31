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
    const dbMachines = await prisma.machine.findMany();
    const formatted = dbMachines.map(m => ({
      ...m,
      suitableFor: m.suitableFor ? m.suitableFor.split(";") : []
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching machines:", error);
    res.status(500).json({ error: "Failed to fetch machines" });
  }
});

// POST new machine
machinesRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
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
    campaignDiscountAmount
  } = req.body;
  
  if (!name || !category || !height || !pricePerDay) {
    return res.status(400).json({ error: "Missing required machine fields" });
  }

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
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
        imageAlt: name,
        description: description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.",
        suitableFor: Array.isArray(suitableFor) ? suitableFor.join(";") : "Algemeen",
        weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : null
      }
    });

    res.status(201).json({
      ...newMachine,
      suitableFor: newMachine.suitableFor ? newMachine.suitableFor.split(";") : []
    });
  } catch (error) {
    console.error("Error creating machine:", error);
    res.status(500).json({ error: "Failed to create machine" });
  }
});

// PUT update machine
machinesRouter.put("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
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
    campaignDiscountAmount
  } = req.body;
  
  if (!name || !category || !height || !pricePerDay) {
    return res.status(400).json({ error: "Missing required machine fields" });
  }

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
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop",
        imageAlt: name,
        description: description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.",
        suitableFor: Array.isArray(suitableFor) ? suitableFor.join(";") : suitableFor || "Algemeen",
        weeklyDiscountPercent: weeklyDiscountPercent !== undefined && weeklyDiscountPercent !== null ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent !== undefined && monthlyDiscountPercent !== null ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent !== undefined && campaignDiscountPercent !== null ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount !== undefined && campaignDiscountAmount !== null ? Number(campaignDiscountAmount) : null
      }
    });

    res.json({
      ...updatedMachine,
      suitableFor: updatedMachine.suitableFor ? updatedMachine.suitableFor.split(";") : []
    });
  } catch (error: any) {
    console.error("Error updating machine:", error);
    res.status(500).json({ error: "Failed to update machine: " + error.message });
  }
});

// DELETE machine
machinesRouter.delete("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Delete potential overlapping blocked dates or dependencies
    await prisma.blockedDate.deleteMany({
      where: { machineId: id }
    });
    // In our simplified setup, order references can be nullified or left
    await prisma.machine.delete({
      where: { id }
    });
    res.json({ success: true, message: "Machine deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting machine:", error);
    res.status(500).json({ error: "Failed to delete machine: " + error.message });
  }
});
