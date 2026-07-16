// Sanitizers voor de admin-beheerbare contentvelden op SiteConfig (AdminContent-
// paneel). Zelfde filosofie als sanitizeGoogleReview in siteConfig.ts: alles
// length-capped, getallen geklemd, misvormde entries gedropt in plaats van
// opgeslagen. Tekstvelden mogen nooit base64-afbeeldingen bevatten (payload!).

export const USP_ICONS = ["shield", "clock", "truck", "badge-check", "euro", "phone"] as const;
export type UspIcon = (typeof USP_ICONS)[number];

const cleanText = (v: unknown, max: number): string => {
  if (typeof v !== "string") return "";
  const s = v.trim().slice(0, max);
  // data:-URL's (base64-afbeeldingen) horen niet in tekstvelden thuis
  return s.includes("data:image") ? "" : s;
};

export function sanitizeFaqItems(raw: unknown): Array<{ q: string; a: string }> | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .map((it) => ({ q: cleanText((it as any)?.q, 200), a: cleanText((it as any)?.a, 2000) }))
    .filter((it) => it.q && it.a)
    .slice(0, 40);
  return items;
}

export function sanitizeUspItems(raw: unknown): Array<{ icon: UspIcon; title: string; text: string }> | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((it) => ({
      icon: (USP_ICONS.includes((it as any)?.icon) ? (it as any).icon : "shield") as UspIcon,
      title: cleanText((it as any)?.title, 100),
      text: cleanText((it as any)?.text, 400)
    }))
    .filter((it) => it.title && it.text)
    .slice(0, 8);
}

export function sanitizeOpeningHours(raw: unknown): { monFri: string; sat: string; sun: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const hours = {
    monFri: cleanText(r.monFri, 60),
    sat: cleanText(r.sat, 60),
    sun: cleanText(r.sun, 60)
  };
  return hours.monFri || hours.sat || hours.sun ? hours : null;
}

const clampFee = (v: unknown): number | null => {
  const n = Number(v);
  return isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
};

export function sanitizeTransportFees(raw: unknown): { deliveryFee: number; trailerPerDay: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const deliveryFee = clampFee(r.deliveryFee);
  const trailerPerDay = clampFee(r.trailerPerDay);
  // Beide velden verplicht geldig — halve tarieven opslaan zou de prijs-spiegel
  // onvoorspelbaar maken
  if (deliveryFee === null || trailerPerDay === null) return null;
  return { deliveryFee, trailerPerDay };
}

export function sanitizeGlobalAddons(raw: unknown): { safety: { name: string; pricePerWeek: number }; rijplaten: { name: string; pricePerWeek: number } } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, Record<string, unknown> | undefined>;
  const one = (entry: Record<string, unknown> | undefined, defaultName: string) => {
    const price = clampFee(entry?.pricePerWeek);
    if (price === null) return null;
    return { name: cleanText(entry?.name, 60) || defaultName, pricePerWeek: price };
  };
  const safety = one(r.safety, "Veiligheidsset Pro");
  const rijplaten = one(r.rijplaten, "Rijplaten");
  if (!safety || !rijplaten) return null;
  return { safety, rijplaten };
}

// Juridische pagina's: markdown, hard gecapt. data:image blijft hier WEL
// toegestaan? Nee — ook hier weren, een 60k-veld vol base64 is precies wat we
// niet willen. Platte markdown + links volstaan.
export function sanitizeLegalContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.slice(0, 60_000);
  return s.includes("data:image") ? s.replace(/data:image[^)\s"']*/g, "") : s;
}
