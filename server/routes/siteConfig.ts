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

// Whitelist of editable SiteConfig fields — never pass req.body straight to Prisma
const SITE_CONFIG_FIELDS = [
  "siteName", "heroTagline", "heroTitle", "heroSubtitle",
  "menuHomeLabel", "menuCatalogLabel", "menuAdvisorLabel", "menuOrdersLabel", "menuAdminLabel"
] as const;

function pickSiteConfigFields(body: any): Record<string, string> {
  const data: Record<string, string> = {};
  for (const field of SITE_CONFIG_FIELDS) {
    if (typeof body?.[field] === "string" && body[field].length <= 1000) {
      data[field] = body[field];
    }
  }
  return data;
}

// POST site config
siteConfigRouter.post("/site-config", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = pickSiteConfigFields(req.body);
    const updated = await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { ...defaultSiteConfig, ...data, id: "default" }
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

// GET campaign rules
siteConfigRouter.get("/campaign-rules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const rules = (config as any)?.campaignRules;
    res.json(Array.isArray(rules) ? rules : []);
  } catch (error) {
    console.error("Error fetching campaign rules:", error);
    res.status(500).json({ error: "Failed to fetch campaign rules" });
  }
});

// POST campaign rules (admin only)
siteConfigRouter.post("/campaign-rules", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = req.body;
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: "Expected an array of campaign rules" });
    }
    await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: { campaignRules: rules },
      create: {
        id: "default",
        siteName: "HuurGo",
        heroTagline: "Professionele Hoogwerker Verhuur",
        heroTitle: "De juiste machine, snel en veilig geregeld.",
        heroSubtitle: "MB Hoogwerkers verhuurt hoogwerkers, schaarliften en ladderliften aan ZZP'ers en particulieren.",
        menuHomeLabel: "Home",
        menuCatalogLabel: "Catalogus",
        menuOrdersLabel: "Mijn Account",
        menuAdminLabel: "Portaal",
        campaignRules: rules
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving campaign rules:", error);
    res.status(500).json({ error: "Failed to save campaign rules" });
  }
});

// POST categories
function sanitizeCategory(cat: any): { id: string; label: string; listLabel: string; desc: string; heights: string; price: string; infoContent?: any } | null {
  if (!cat || typeof cat.id !== "string" || !/^[a-z0-9-]{1,50}$/.test(cat.id)) return null;
  const str = (v: any, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    id: cat.id,
    label: str(cat.label, 100),
    listLabel: str(cat.listLabel, 100),
    desc: str(cat.desc, 1000),
    heights: str(cat.heights, 200),
    price: str(cat.price, 200),
    infoContent: cat.infoContent && typeof cat.infoContent === "object" ? cat.infoContent : undefined,
  };
}

siteConfigRouter.post("/categories", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      if (req.body.length > 50) {
        return res.status(400).json({ error: "Maximaal 50 categorieën toegestaan" });
      }
      const cats = req.body.map(sanitizeCategory);
      if (cats.some(c => c === null)) {
        return res.status(400).json({ error: "Ongeldige categorie-gegevens" });
      }
      // Replace atomically — a failure mid-way must not leave the table half-empty
      await prisma.$transaction([
        prisma.category.deleteMany(),
        ...cats.map(cat => prisma.category.create({ data: cat! })),
      ]);
    } else {
      const cat = sanitizeCategory(req.body);
      if (!cat) {
        return res.status(400).json({ error: "Ongeldige categorie-gegevens" });
      }
      await prisma.category.upsert({
        where: { id: cat.id },
        update: cat,
        create: cat
      });
    }
    const categories = await prisma.category.findMany();
    res.json({ success: true, customCategories: categories });
  } catch (error) {
    console.error("Error updating categories:", error);
    res.status(500).json({ error: "Failed to update categories" });
  }
});
