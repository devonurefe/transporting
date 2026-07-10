import { Router, Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { publicReadLimiter, softOriginGuard } from "../middleware/publicGuard.js";

export const blogPostsRouter = Router();

const VALID_TYPES = ["artikel", "handleiding"] as const;
const MAX_CONTENT = 40000;

// URL-safe slug: lowercase, accents stripped, non-alphanumerics collapsed to "-".
function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Guarantee a unique slug — append -2, -3, … when the base is taken. `ignoreId`
// lets an update keep its own slug without colliding with itself.
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || `post-${Date.now()}`;
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

interface CleanInput {
  type: string;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  published: boolean;
  slug?: string;
}

// Validate + clamp a create/update payload. Returns an error string on failure.
function validate(body: any): { error?: string; data?: CleanInput } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title) return { error: "Titel is verplicht." };
  if (!content) return { error: "Inhoud is verplicht." };
  if (title.length > 200) return { error: "Titel mag maximaal 200 tekens zijn." };
  if (content.length > MAX_CONTENT) return { error: `Inhoud mag maximaal ${MAX_CONTENT} tekens zijn.` };

  const type = VALID_TYPES.includes(body.type) ? body.type : "artikel";
  const excerpt = (typeof body.excerpt === "string" ? body.excerpt.trim() : "").slice(0, 300);
  const category = (typeof body.category === "string" ? body.category.trim() : "").slice(0, 60) ||
    (type === "handleiding" ? "Handleiding" : "Artikel");
  const published = Boolean(body.published);
  // An explicit slug is optional; when present we still sanitise it.
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : undefined;

  return {
    data: {
      type,
      title: title.slice(0, 200),
      excerpt: excerpt || title.slice(0, 160),
      category,
      content,
      published,
      slug,
    },
  };
}

// GET — public feed returns only published posts (safe to cache briefly and crawl).
// Admins pass ?all=1 to also get drafts back for the management panel.
blogPostsRouter.get("/", publicReadLimiter, softOriginGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wantsAll = req.query.all === "1" && req.user?.role === "admin";
    if (wantsAll) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    }
    const posts = await prisma.blogPost.findMany({
      where: wantsAll ? {} : { published: true },
      orderBy: [{ createdAt: "desc" }],
    });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    res.status(500).json({ error: "Kon artikelen niet ophalen" });
  }
});

// GET one by slug — public (published only); admins see drafts too.
blogPostsRouter.get("/:slug", publicReadLimiter, softOriginGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post) return res.status(404).json({ error: "Artikel niet gevonden" });
    const isAdmin = req.user?.role === "admin";
    if (!post.published && !isAdmin) return res.status(404).json({ error: "Artikel niet gevonden" });
    res.setHeader("Cache-Control", isAdmin ? "no-store" : "public, max-age=60, stale-while-revalidate=300");
    res.json(post);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    res.status(500).json({ error: "Kon artikel niet ophalen" });
  }
});

// POST — create (admin)
blogPostsRouter.post("/", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { error, data } = validate(req.body);
  if (error || !data) return res.status(400).json({ error });
  try {
    const slug = await uniqueSlug(data.slug || data.title);
    const post = await prisma.blogPost.create({
      data: {
        id: `post-${Date.now()}`,
        slug,
        type: data.type,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        content: data.content,
        published: data.published,
      },
    });
    res.status(201).json(post);
  } catch (e) {
    console.error("Error creating blog post:", e);
    res.status(500).json({ error: "Artikel aanmaken mislukt" });
  }
});

// PUT — update (admin)
blogPostsRouter.put("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { error, data } = validate(req.body);
  if (error || !data) return res.status(400).json({ error });
  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Artikel niet gevonden" });
    // Regenerate the slug only when an explicit new slug is supplied; otherwise
    // keep the original so shared/indexed URLs don't break on every edit.
    const slug = data.slug ? await uniqueSlug(data.slug, existing.id) : existing.slug;
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        slug,
        type: data.type,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        content: data.content,
        published: data.published,
      },
    });
    res.json(post);
  } catch (e: any) {
    if (e?.code === "P2025") return res.status(404).json({ error: "Artikel niet gevonden" });
    console.error("Error updating blog post:", e);
    res.status(500).json({ error: "Artikel bijwerken mislukt" });
  }
});

// PATCH — toggle published (admin, lightweight)
blogPostsRouter.patch("/:id/toggle-publish", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { published: true } });
    if (!post) return res.status(404).json({ error: "Artikel niet gevonden" });
    const updated = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { published: !post.published },
    });
    res.json({ id: updated.id, published: updated.published });
  } catch (e) {
    console.error("Error toggling blog post:", e);
    res.status(500).json({ error: "Status wijzigen mislukt" });
  }
});

// DELETE — remove (admin)
blogPostsRouter.delete("/:id", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    if (e?.code === "P2025") return res.status(404).json({ error: "Artikel niet gevonden" });
    console.error("Error deleting blog post:", e);
    res.status(500).json({ error: "Artikel verwijderen mislukt" });
  }
});
