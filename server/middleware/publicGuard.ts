import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

/**
 * Hardening for the public, unauthenticated read endpoints (catalog, site-config,
 * categories, ratings). Goal: raise the cost of bulk scraping without harming real
 * visitors or search-engine crawlers.
 *
 * Note: this is deliberately NOT a hard anti-scraping wall (impossible for public
 * content). Googlebot/social scrapers fetch the rendered HTML pages (the catch-all
 * route with server-injected meta), never these JSON endpoints, so tightening them
 * does not affect SEO.
 */

// Generous enough for normal human browsing (a catalog visit = a handful of calls)
// but caps automated enumeration. Stacks under the global 300/min /api limiter.
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: { error: "Te veel verzoeken. Probeer het over een minuut opnieuw." },
  standardHeaders: true,
  legacyHeaders: false,
});

function allowedHosts(servingHost: string): string[] {
  const hosts = new Set<string>();
  // The actual serving domain (domain-agnostic: works on onrender.com AND huurgo.nl
  // without config) — same-origin requests carry this host in Origin/Referer.
  if (servingHost) {
    const h = servingHost.toLowerCase();
    hosts.add(h);
    hosts.add(h.startsWith("www.") ? h.slice(4) : `www.${h}`);
  }
  // Plus the configured canonical domain (covers www/non-www variants).
  const raw = (process.env.APP_URL || "https://huurgo.nl").replace(/\/$/, "");
  const domain = raw.replace(/^https?:\/\/(www\.)?/, "").toLowerCase();
  hosts.add(domain);
  hosts.add(`www.${domain}`);
  return Array.from(hosts);
}

/**
 * Soft same-origin guard. Blocks requests whose Origin/Referer is present but points
 * at a *foreign* host (cross-site XHR, hotlinking, naive scrapers that spoof a referer).
 * Header-less requests are allowed through (privacy browsers strip Referer, and we
 * never want to block a real user) — the rate limiter is the backstop for those.
 * Compares against the actual serving host so it never blocks legit same-origin
 * traffic regardless of which domain the app runs on. Only enforced in production.
 */
export function softOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "production") return next();
  const origin = req.get("origin") || req.get("referer");
  if (!origin) return next(); // no header → allow (rate limiter still applies)
  try {
    const host = new URL(origin).host.toLowerCase();
    if (allowedHosts(req.get("host") || "").includes(host)) return next();
  } catch {
    return next(); // unparseable header → don't punish
  }
  res.status(403).json({ error: "Toegang geweigerd." });
}
