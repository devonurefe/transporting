import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const siteConfigRouter = Router();

const CORRECT_SUBTITLE = "MB Hoogwerkers verhuurt hoogwerkers, schaarliften en ladderliften aan ZZP'ers en particulieren. Geen gedoe, direct online geregeld. Kies uw machine en boek eenvoudig via WhatsApp.";

const defaultSiteConfig = {
  id: "default",
  siteName: "HuurGo",
  heroTagline: "Professionele Hoogwerker Verhuur",
  heroTitle: "De juiste machine, snel en veilig geregeld.",
  heroSubtitle: CORRECT_SUBTITLE,
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalogus",
  menuOrdersLabel: "Mijn Account",
  menuAdminLabel: "Portaal"
};

// GET site config
siteConfigRouter.get("/site-config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    let config = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    // Auto-fix stale AI-assistent text that may be stored in DB
    if (config?.heroSubtitle?.includes("AI-assistent") || config?.heroSubtitle?.includes("AI assistant")) {
      config = await prisma.siteConfig.update({
        where: { id: "default" },
        data: { heroSubtitle: CORRECT_SUBTITLE }
      });
    }
    res.json(config || defaultSiteConfig);
  } catch (error) {
    console.error("Error fetching site config:", error);
    res.status(500).json({ error: "Failed to fetch site config" });
  }
});

// POST site config
siteConfigRouter.post("/site-config", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: req.body,
      create: { id: "default", ...req.body }
    });
    res.json({ success: true, siteConfig: updated });
  } catch (error) {
    console.error("Error updating site config:", error);
    res.status(500).json({ error: "Failed to update site config" });
  }
});

// GET categories
siteConfigRouter.get("/categories", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST categories
siteConfigRouter.post("/categories", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      await prisma.category.deleteMany();
      for (const cat of req.body) {
        await prisma.category.create({ data: cat });
      }
    } else {
      await prisma.category.upsert({
        where: { id: req.body.id },
        update: req.body,
        create: req.body
      });
    }
    const categories = await prisma.category.findMany();
    res.json({ success: true, customCategories: categories });
  } catch (error) {
    console.error("Error updating categories:", error);
    res.status(500).json({ error: "Failed to update categories" });
  }
});
