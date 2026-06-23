/**
 * Generates public/sitemap.xml from the static routes + the service-city slugs
 * declared in src/data/serviceCities.ts. Runs as `prebuild` so the sitemap is
 * always in sync with the city list (no manual drift). Slugs are extracted with
 * a regex so this stays a dependency-free plain Node script (no TS compile).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const BASE_URL = "https://huurgo.nl";

// Static, indexable routes (admin/booking/orders are intentionally excluded).
const staticPaths = ["/", "/catalog", "/veelgestelde-vragen"];

const citiesSrc = readFileSync(resolve(root, "src/data/serviceCities.ts"), "utf8");
const slugs = [...citiesSrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
const cityPaths = slugs.map((s) => `/hoogwerker-huren/${s}`);

const today = new Date().toISOString().split("T")[0];
const urls = [...staticPaths, ...cityPaths]
  .map(
    (p) =>
      `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(resolve(root, "public/sitemap.xml"), xml);
console.log(`[genSitemap] Wrote ${staticPaths.length + cityPaths.length} URLs (${slugs.length} cities) to public/sitemap.xml`);
