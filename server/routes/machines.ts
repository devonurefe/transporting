import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { publicReadLimiter, softOriginGuard } from "../middleware/publicGuard.js";

export const machinesRouter = Router();

function sanitizeImageUrls(arr: unknown[]): string[] {
  return arr.filter((u): u is string => {
    if (typeof u !== "string") return false;
    try { return new URL(u).protocol === "https:"; } catch { return false; }
  });
}

function sanitizeSuitableFor(raw: unknown): string[] {
  const defaults = ["Algemeen"];
  if (!Array.isArray(raw)) return defaults;
  const items = raw
    .filter((v) => typeof v === "string" && v.trim().length > 0)
    .map((v) => String(v).replace(/[<>"]/g, "").trim().slice(0, 60));
  return items.length > 0 ? items : defaults;
}

function sanitizeImageUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  if (!url) return "";
  if (url.startsWith("/")) return url;            // local static paths
  if (url.startsWith("data:image/")) return url;  // uploaded base64 images
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return url;
  } catch { /* invalid URL */ }
  return ""; // reject javascript:, file:, and other executable schemes
}

async function getCategoryLabel(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  });
  return category?.label || categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

// GET machines — public catalog feed (rate-limited + soft same-origin guard
// to deter bulk scraping; SEO crawlers use the HTML routes, not this endpoint)
machinesRouter.get("/", publicReadLimiter, softOriginGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pageQuery = req.query.page;
    const limitQuery = req.query.limit;

    if (pageQuery || limitQuery) {
      const page = Number(pageQuery) || 1;
      const limit = Math.min(Number(limitQuery) || 20, 100);
      const skip = (page - 1) * limit;

      const totalCount = await prisma.machine.count({ where: { deletedAt: null } });
      const totalPages = Math.ceil(totalCount / limit);

      res.setHeader("X-Total-Pages", String(totalPages));
      res.setHeader("X-Total-Count", String(totalCount));

      const dbMachines = await prisma.machine.findMany({
        where: { deletedAt: null },
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
      const dbMachines = await prisma.machine.findMany({ where: { deletedAt: null } });
      const formatted = dbMachines.map(m => ({
        ...m,
        suitableFor: Array.isArray(m.suitableFor) ? m.suitableFor : [],
        additionalImages: Array.isArray(m.additionalImages) ? m.additionalImages : []
      }));
      return res.json(formatted);
    }
  } catch (error) {
    console.error("Error fetching machines:", error);
    res.status(500).json({ error: "Kon machines niet ophalen" });
  }
});

// Shared validation for machine input (used by both POST and PUT)
function validateMachineInput(body: any): { valid: boolean; error?: string } {
  const { name, category, height, pricePerDay, reach, weight, weeklyDiscountPercent, monthlyDiscountPercent, campaignDiscountPercent, campaignDiscountAmount } = body;

  if (!name?.trim() || !category?.trim() || !height || !pricePerDay) {
    return { valid: false, error: "Verplichte machinevelden ontbreken" };
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

  for (const f of ["weekendPrice", "twoDayPrice", "threeDayPrice", "fourDayPrice", "weeklyPrice", "monthlyPrice", "oneDayPrice", "sundayBlockFee"] as const) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== "") {
      const v = Number(body[f]);
      if (isNaN(v) || v <= 0) return { valid: false, error: `${f} moet een positief getal groter dan 0 zijn.` };
      if (v > 100000) return { valid: false, error: `${f} mag maximaal €100.000 zijn.` };
    }
  }

  if (body.minRentalDays !== undefined && body.minRentalDays !== null && body.minRentalDays !== "") {
    const v = Number(body.minRentalDays);
    if (isNaN(v) || v < 1 || v > 365) return { valid: false, error: "Minimale huurperiode moet tussen 1 en 365 dagen liggen." };
  }
  if (body.weeklyOnly && (body.weeklyPrice === undefined || body.weeklyPrice === null || body.weeklyPrice === "")) {
    return { valid: false, error: "Weekprijs (€/week) is verplicht wanneer 'alleen per week' is ingeschakeld." };
  }

  return { valid: true };
}

// Cross-sell addons are stored as JSON — sanitise to a fixed shape and cap counts/lengths.
function sanitizeCrossSell(raw: unknown): { id: string; name: string; description: string; pricePerWeek: number; pricePerDay?: number; pricePerTwoDay?: number }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  // Parse an optional flat short-rental price: positive number → keep, otherwise drop the field.
  const optPrice = (v: any): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return !isNaN(n) && n > 0 && n <= 100000 ? n : undefined;
  };
  const cleaned = raw
    .map((a: any, i: number) => {
      const base = {
        id: String(a?.id ?? "").slice(0, 60).trim() || `addon-${i + 1}`,
        name: String(a?.name ?? "").slice(0, 120).trim(),
        description: String(a?.description ?? "").slice(0, 300).trim(),
        pricePerWeek: Number(a?.pricePerWeek ?? 0)
      };
      const pricePerDay = optPrice(a?.pricePerDay);
      const pricePerTwoDay = optPrice(a?.pricePerTwoDay);
      return {
        ...base,
        ...(pricePerDay !== undefined ? { pricePerDay } : {}),
        ...(pricePerTwoDay !== undefined ? { pricePerTwoDay } : {})
      };
    })
    .filter(a => a.name && !isNaN(a.pricePerWeek) && a.pricePerWeek >= 0 && a.pricePerWeek <= 100000)
    .slice(0, 10);
  return cleaned.length > 0 ? cleaned : null;
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
    oneDayPrice,
    powerType,
    imageUrl,
    imageAlt,
    description,
    suitableFor,
    weeklyDiscountPercent,
    monthlyDiscountPercent,
    campaignText,
    campaignDiscountPercent,
    campaignDiscountAmount,
    weekendPrice,
    twoDayPrice,
    weeklyPrice,
    monthlyPrice,
    packageContents,
    additionalImages,
    specs: rawSpecsCreate
  } = req.body;

  const sanitizeSpecs = (raw: unknown) => {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const cleaned = raw
      .map((s: any) => ({ label: String(s?.label ?? "").slice(0, 80), value: String(s?.value ?? "").slice(0, 200) }))
      .filter(s => s.label.trim() && s.value.trim())
      .slice(0, 30);
    return cleaned.length > 0 ? cleaned : null;
  };
  const specs = sanitizeSpecs(rawSpecsCreate);

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
        oneDayPrice: oneDayPrice ? Number(oneDayPrice) : null,
        powerType: powerType || "Elektrisch",
        imageUrl: sanitizeImageUrl(imageUrl) || "/placeholder-machine.webp",
        imageAlt: typeof imageAlt === "string" && imageAlt.trim() ? imageAlt.trim().slice(0, 300) : name,
        description: (description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.").slice(0, 2000),
        suitableFor: sanitizeSuitableFor(suitableFor),
        weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : null,
        weekendPrice: weekendPrice ? Number(weekendPrice) : null,
        twoDayPrice: twoDayPrice ? Number(twoDayPrice) : null,
        threeDayPrice: req.body.threeDayPrice ? Number(req.body.threeDayPrice) : null,
        fourDayPrice: req.body.fourDayPrice ? Number(req.body.fourDayPrice) : null,
        weeklyPrice: weeklyPrice ? Number(weeklyPrice) : null,
        monthlyPrice: monthlyPrice ? Number(monthlyPrice) : null,
        sundayBlockFee: req.body.sundayBlockFee ? Number(req.body.sundayBlockFee) : null,
        weekendRulesEnabled: Boolean(req.body.weekendRulesEnabled),
        packageContents: packageContents || null,
        additionalImages: Array.isArray(additionalImages) ? sanitizeImageUrls(additionalImages) : [],
        specs: Array.isArray(specs) && specs.length > 0 ? specs : Prisma.JsonNull,
        bufferDays: req.body.bufferDays !== undefined ? Math.min(2, Math.max(0, Math.round(Number(req.body.bufferDays)))) : 0,
        minRentalDays: req.body.minRentalDays !== undefined && req.body.minRentalDays !== null && req.body.minRentalDays !== "" ? Math.round(Number(req.body.minRentalDays)) : null,
        weeklyOnly: Boolean(req.body.weeklyOnly),
        pickupOnly: Boolean(req.body.pickupOnly),
        crossSellAddons: sanitizeCrossSell(req.body.crossSellAddons) ?? Prisma.JsonNull
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
    oneDayPrice,
    powerType,
    imageUrl,
    imageAlt,
    description,
    suitableFor,
    weeklyDiscountPercent,
    monthlyDiscountPercent,
    campaignText,
    campaignDiscountPercent,
    campaignDiscountAmount,
    weekendPrice,
    twoDayPrice,
    weeklyPrice,
    monthlyPrice,
    packageContents,
    additionalImages,
    specs: rawSpecsPut
  } = req.body;

  const specsUpdate = rawSpecsPut !== undefined
    ? (Array.isArray(rawSpecsPut) && rawSpecsPut.length > 0
        ? rawSpecsPut
            .map((s: any) => ({ label: String(s?.label ?? "").slice(0, 80), value: String(s?.value ?? "").slice(0, 200) }))
            .filter((s: any) => s.label.trim() && s.value.trim())
            .slice(0, 30)
        : null)
    : undefined;

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
        oneDayPrice: oneDayPrice !== undefined && oneDayPrice !== null && oneDayPrice !== "" ? Number(oneDayPrice) : null,
        powerType: powerType || "Elektrisch",
        imageUrl: imageUrl !== undefined && imageUrl !== null ? sanitizeImageUrl(imageUrl) : undefined,
        imageAlt: typeof imageAlt === "string" && imageAlt.trim() ? imageAlt.trim().slice(0, 300) : name,
        description: (description || "Gebruiksvriendelijke hoogwerker geschikt voor lichte installatie of inspectie.").slice(0, 2000),
        suitableFor: sanitizeSuitableFor(suitableFor),
        weeklyDiscountPercent: weeklyDiscountPercent !== undefined && weeklyDiscountPercent !== null ? Number(weeklyDiscountPercent) : null,
        monthlyDiscountPercent: monthlyDiscountPercent !== undefined && monthlyDiscountPercent !== null ? Number(monthlyDiscountPercent) : null,
        campaignText: campaignText || null,
        campaignDiscountPercent: campaignDiscountPercent !== undefined && campaignDiscountPercent !== null ? Number(campaignDiscountPercent) : null,
        campaignDiscountAmount: campaignDiscountAmount !== undefined && campaignDiscountAmount !== null ? Number(campaignDiscountAmount) : null,
        weekendPrice: weekendPrice !== undefined && weekendPrice !== null && weekendPrice !== "" ? Number(weekendPrice) : null,
        twoDayPrice: twoDayPrice !== undefined && twoDayPrice !== null && twoDayPrice !== "" ? Number(twoDayPrice) : null,
        threeDayPrice: req.body.threeDayPrice !== undefined && req.body.threeDayPrice !== null && req.body.threeDayPrice !== "" ? Number(req.body.threeDayPrice) : null,
        fourDayPrice: req.body.fourDayPrice !== undefined && req.body.fourDayPrice !== null && req.body.fourDayPrice !== "" ? Number(req.body.fourDayPrice) : null,
        weeklyPrice: weeklyPrice !== undefined && weeklyPrice !== null && weeklyPrice !== "" ? Number(weeklyPrice) : null,
        monthlyPrice: monthlyPrice !== undefined && monthlyPrice !== null && monthlyPrice !== "" ? Number(monthlyPrice) : null,
        sundayBlockFee: req.body.sundayBlockFee !== undefined && req.body.sundayBlockFee !== null && req.body.sundayBlockFee !== "" ? Number(req.body.sundayBlockFee) : null,
        weekendRulesEnabled: Boolean(req.body.weekendRulesEnabled),
        packageContents: packageContents !== undefined ? packageContents : null,
        additionalImages: Array.isArray(additionalImages) ? sanitizeImageUrls(additionalImages) : [],
        specs: specsUpdate === undefined ? undefined : (specsUpdate ?? Prisma.JsonNull),
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
        bufferDays: req.body.bufferDays !== undefined ? Math.min(2, Math.max(0, Math.round(Number(req.body.bufferDays)))) : undefined,
        minRentalDays: req.body.minRentalDays !== undefined && req.body.minRentalDays !== null && req.body.minRentalDays !== "" ? Math.round(Number(req.body.minRentalDays)) : null,
        weeklyOnly: Boolean(req.body.weeklyOnly),
        pickupOnly: Boolean(req.body.pickupOnly),
        showInWeeklyOffers: req.body.showInWeeklyOffers !== undefined ? Boolean(req.body.showInWeeklyOffers) : undefined,
        crossSellAddons: req.body.crossSellAddons !== undefined ? (sanitizeCrossSell(req.body.crossSellAddons) ?? Prisma.JsonNull) : undefined
      }
    });

    res.json({
      ...updatedMachine,
      suitableFor: Array.isArray(updatedMachine.suitableFor) ? updatedMachine.suitableFor : [],
      additionalImages: Array.isArray(updatedMachine.additionalImages) ? updatedMachine.additionalImages : []
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    console.error("Error updating machine:", error);
    res.status(500).json({ error: "Machine bijwerken mislukt" });
  }
});

// PATCH toggle machine active status (admin only, lightweight endpoint)
machinesRouter.patch("/:id/toggle-active", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const machine = await prisma.machine.findUnique({ where: { id }, select: { isActive: true } });
    if (!machine) return res.status(404).json({ error: "Machine niet gevonden" });
    const updated = await prisma.machine.update({
      where: { id },
      data: { isActive: !machine.isActive }
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error: any) {
    console.error("Error toggling machine status:", error);
    res.status(500).json({ error: "Status wijzigen mislukt" });
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
    // Soft-delete: mark as deleted instead of physically removing so historical orders remain traceable
    await prisma.machine.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });
    res.json({ success: true, message: "Machine succesvol verwijderd" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Machine niet gevonden" });
    }
    console.error("Error deleting machine:", error);
    res.status(500).json({ error: "Machine kon niet worden verwijderd" });
  }
});
