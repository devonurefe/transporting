import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { publicReadLimiter } from "../middleware/publicGuard.js";

export const siteConfigRouter = Router();

const CORRECT_SUBTITLE = "HuurGo verhuurt gecertificeerde hoogwerkers, schaarliften, mastliften en ladderliften aan ZZP'ers, aannemers en particulieren in heel Nederland. Meer dan 50 BMWT-gecertificeerde machines, direct beschikbaar.";

const defaultSiteConfig = {
  id: "default",
  siteName: "huurgo",
  heroTagline: "Professionele Hoogwerker Verhuur",
  heroTitle: "De juiste machine, snel en veilig geregeld.",
  heroSubtitle: CORRECT_SUBTITLE,
  menuHomeLabel: "Home",
  menuCatalogLabel: "Catalogus",
  menuOrdersLabel: "Mijn Account",
  menuAdminLabel: "Portaal",
  contactEmail: "info@mbhoogwerkers.com",
  contactPhone: "+31 71 542 8114",
  companyAddress: "Produktieweg 20, 2382 PB Zoeterwoude",
  kvkNumber: "67438237",
  btwNumber: "NL856990656B01",
  companyLegalName: "huurgo B.V."
};

// GET site config
siteConfigRouter.get("/site-config", publicReadLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    // Admins editing the site need the raw base64 hero back; the public feed
    // replaces it with the binary-proxy URL so the JSON stays small.
    const wantsFull = req.query.full === "1" && req.user?.role === "admin";
    if (wantsFull) {
      res.setHeader("Cache-Control", "no-store");
      return res.json(config || defaultSiteConfig);
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (config && typeof config.heroImageUrl === "string" && config.heroImageUrl.startsWith("data:image/")) {
      return res.json({ ...config, heroImageUrl: "/site-hero-image" });
    }
    res.json(config || defaultSiteConfig);
  } catch (error) {
    console.error("Error fetching site config:", error);
    res.status(500).json({ error: "Kon siteconfiguratie niet ophalen" });
  }
});

// Whitelist of editable SiteConfig fields — never pass req.body straight to Prisma
const SITE_CONFIG_FIELDS = [
  "siteName", "heroTagline", "heroTitle", "heroSubtitle", "heroImageUrl",
  // menuAdvisorLabel is a legacy AI-advisor column: kept in the schema to avoid a
  // destructive db push, but no longer editable — the advisor feature is gone.
  "menuHomeLabel", "menuCatalogLabel", "menuOrdersLabel", "menuAdminLabel",
  "contactEmail", "contactPhone", "companyAddress", "kvkNumber", "btwNumber", "companyLegalName"
] as const;

// Sanitize one admin-curated Google review. Everything is length-capped and the
// rating clamped to 1–5; malformed entries are dropped rather than stored.
function sanitizeGoogleReview(r: any): { author: string; rating: number; text: string; date: string } | null {
  if (!r || typeof r !== "object") return null;
  const text = typeof r.text === "string" ? r.text.trim().slice(0, 600) : "";
  if (!text) return null; // a review without text is useless in the ticker
  const ratingNum = Number(r.rating);
  const rating = isNaN(ratingNum) ? 5 : Math.max(1, Math.min(5, Math.round(ratingNum)));
  return {
    author: typeof r.author === "string" ? r.author.trim().slice(0, 80) : "",
    rating,
    text,
    date: typeof r.date === "string" ? r.date.trim().slice(0, 40) : "",
  };
}

function pickSiteConfigFields(body: any): Record<string, string | number | null | unknown[]> {
  const data: Record<string, string | number | null | unknown[]> = {};
  for (const field of SITE_CONFIG_FIELDS) {
    // heroImageUrl stores a base64 data URL — allow up to 5 MB; all other fields max 1 KB
    const maxLen = field === "heroImageUrl" ? 5_000_000 : 1000;
    // Never persist the binary-proxy placeholder: the public feed returns
    // heroImageUrl="/site-hero-image", so if a stale client echoes it back we must
    // ignore it rather than overwrite the real stored base64 image with the path.
    if (field === "heroImageUrl" && body?.[field] === "/site-hero-image") continue;
    if (typeof body?.[field] === "string" && body[field].length <= maxLen) {
      data[field] = body[field];
    }
  }

  // Google rating: real external number, admin-entered. Accept a value in [0,5]
  // (one decimal) and a non-negative integer count; "" or null clears the field
  // so the footer stops showing a score. Anything malformed is ignored.
  if ("googleRating" in (body ?? {})) {
    const raw = body.googleRating;
    if (raw === null || raw === "") {
      data.googleRating = null;
    } else {
      const n = Number(raw);
      if (!isNaN(n) && n >= 0 && n <= 5) data.googleRating = Math.round(n * 10) / 10;
    }
  }
  if ("googleReviewCount" in (body ?? {})) {
    const raw = body.googleReviewCount;
    if (raw === null || raw === "") {
      data.googleReviewCount = null;
    } else {
      const n = Number(raw);
      if (!isNaN(n) && n >= 0 && n <= 1_000_000) data.googleReviewCount = Math.round(n);
    }
  }

  // Admin-curated Google reviews (max 20). Send [] or null to clear.
  if ("googleReviews" in (body ?? {})) {
    const raw = body.googleReviews;
    if (raw === null || raw === "") {
      data.googleReviews = [];
    } else if (Array.isArray(raw)) {
      data.googleReviews = raw.slice(0, 20).map(sanitizeGoogleReview).filter(Boolean);
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
    res.status(500).json({ error: "Kon siteconfiguratie niet bijwerken" });
  }
});

// GET categories
siteConfigRouter.get("/categories", publicReadLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany();
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Kon categorieën niet ophalen" });
  }
});

// GET campaign rules
siteConfigRouter.get("/campaign-rules", publicReadLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    const rules = (config as any)?.campaignRules;
    res.json(Array.isArray(rules) ? rules : []);
  } catch (error) {
    console.error("Error fetching campaign rules:", error);
    res.status(500).json({ error: "Kon campagneregels niet ophalen" });
  }
});

// Validate a single campaign rule. The shape { scope, scopeValue, discountPercent,
// isActive } is trusted by server/routes/orders.ts for server-side discounting, so
// reject anything malformed instead of storing raw req.body. id/name are preserved
// for the admin UI (AdminCustomizer.tsx).
function sanitizeCampaignRule(rule: any): { id: string; name: string; scope: string; scopeValue: string; discountPercent: number; isActive: boolean } | null {
  if (!rule || typeof rule !== "object") return null;
  const VALID_SCOPES = ["global", "category", "product", "role"];
  const scope = typeof rule.scope === "string" ? rule.scope : "";
  if (!VALID_SCOPES.includes(scope)) return null;
  const discountPercent = Number(rule.discountPercent);
  if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;
  return {
    id: typeof rule.id === "string" ? rule.id.slice(0, 100) : `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof rule.name === "string" ? rule.name.slice(0, 100) : "",
    scope,
    scopeValue: typeof rule.scopeValue === "string" ? rule.scopeValue.slice(0, 100) : "",
    discountPercent: Math.round(discountPercent),
    isActive: rule.isActive === true,
  };
}

// POST campaign rules (admin only)
siteConfigRouter.post("/campaign-rules", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Een lijst met campagneregels wordt verwacht" });
    }
    if (req.body.length > 50) {
      return res.status(400).json({ error: "Maximaal 50 campagneregels toegestaan" });
    }
    const sanitized = req.body.map(sanitizeCampaignRule);
    if (sanitized.some(r => r === null)) {
      return res.status(400).json({ error: "Ongeldige campagneregel-gegevens" });
    }
    const rules = sanitized as Array<{ scope: string; scopeValue: string; discountPercent: number; isActive: boolean }>;
    await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: { campaignRules: rules },
      create: {
        id: "default",
        siteName: "huurgo",
        heroTagline: "Professionele Hoogwerker Verhuur",
        heroTitle: "De juiste machine, snel en veilig geregeld.",
        heroSubtitle: CORRECT_SUBTITLE,
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
    res.status(500).json({ error: "Kon campagneregels niet opslaan" });
  }
});

// ── Adviestool (product-finder) config ──────────────────────────────────────
// Only copy is stored: question texts, option labels, the on/off toggle and the
// WhatsApp fallback text. The question STRUCTURE and matching logic live in code
// (src/utils/advisor.ts), so an admin can never break scoring by editing here.
// Everything is length-capped and unknown shapes are dropped rather than stored.
function sanitizeAdvisorConfig(body: any): { enabled: boolean; waFallback: string; overrides: Record<string, { q?: string; options?: Record<string, string> }> } | null {
  if (!body || typeof body !== "object") return null;
  const str = (v: any, max: number): string | undefined =>
    typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;

  const overrides: Record<string, { q?: string; options?: Record<string, string> }> = {};
  const rawOverrides = body.overrides;
  if (rawOverrides && typeof rawOverrides === "object") {
    // Cap the number of questions we accept overrides for.
    for (const key of Object.keys(rawOverrides).slice(0, 20)) {
      if (!/^[a-z0-9_-]{1,40}$/i.test(key)) continue;
      const entry = rawOverrides[key];
      if (!entry || typeof entry !== "object") continue;
      const cleaned: { q?: string; options?: Record<string, string> } = {};
      const q = str(entry.q, 200);
      if (q) cleaned.q = q;
      if (entry.options && typeof entry.options === "object") {
        const opts: Record<string, string> = {};
        for (const ov of Object.keys(entry.options).slice(0, 20)) {
          if (!/^[a-z0-9_-]{1,40}$/i.test(ov)) continue;
          const label = str(entry.options[ov], 120);
          if (label) opts[ov] = label;
        }
        if (Object.keys(opts).length) cleaned.options = opts;
      }
      if (cleaned.q || cleaned.options) overrides[key] = cleaned;
    }
  }

  return {
    enabled: body.enabled !== false, // default on unless explicitly disabled
    waFallback: str(body.waFallback, 500) ?? "",
    overrides,
  };
}

// POST advisor config (admin only)
siteConfigRouter.post("/advisor-config", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const advisorConfig = sanitizeAdvisorConfig(req.body);
    if (!advisorConfig) {
      return res.status(400).json({ error: "Ongeldige adviestool-configuratie" });
    }
    await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: { advisorConfig } as any,
      create: { ...defaultSiteConfig, advisorConfig, id: "default" } as any,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving advisor config:", error);
    res.status(500).json({ error: "Kon adviestool-configuratie niet opslaan" });
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
    res.status(500).json({ error: "Kon categorieën niet bijwerken" });
  }
});
