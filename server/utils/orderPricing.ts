// Gedeelde, server-side order-prijsberekening. Eén bron voor zowel de publieke
// POST /api/orders (waar de client-prijs hiertegen wordt gevalideerd) als de
// admin PATCH /api/orders/:id en de handmatige back-office order-creatie.
//
// Dit is de SERVER-kant van de prijs-spiegel: het spiegelt src/utils/pricing.ts
// (calculateItemSubtotal / tierPrice / isWeekendPackage / hasSundayBlock /
// addonPriceForRental) EXACT. Elke wijziging hier moet ook in pricing.ts —
// anders wijkt de client-prijs af en faalt de order met "Totaalbedrag klopt
// niet". Uitgebreid unit-getest in src/__tests__/orderPricing.test.ts tegen
// dezelfde scenario's als de frontend pricing-tests.

import { ResolvedFees } from "./fees.js";

export interface CampaignRuleLike {
  scope: string;
  scopeValue: string;
  discountPercent: number;
  isActive: boolean;
}

// Inclusieve huurdagen uit twee UTC-Datums (10e t/m 12e = 3 dagen). Identiek aan
// calculateRentalDays in src/utils/pricing.ts en de inline-berekening in POST.
export function computeRentalDays(startDate: Date, endDate: Date): number {
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
}

// Autoritatieve transportkosten voor een bezorgtype. Spiegelt de POST-logica.
//
// trailer_rental: de klant kiest zelf hoeveel dagen hij de aanhanger houdt (hij
// gebruikt hem in de praktijk alleen bij ophalen + terugbrengen, niet de hele
// huurperiode). `trailerDays` komt daarom van de client en wordt hier geclampt op
// [1, rentalDays]. Ontbreekt het (legacy-order van vóór deze functie), dan valt
// het terug op de oude berekening (× volledige huurperiode) zodat bestaande
// orders hun oorspronkelijke prijs behouden.
export function clampTrailerDays(trailerDays: unknown, rentalDays: number): number | null {
  const n = Number(trailerDays);
  if (!Number.isInteger(n) || n < 1 || n > rentalDays) return null;
  return n;
}

export function computeTransport(
  deliveryType: string,
  rentalDays: number,
  fees: ResolvedFees,
  trailerDays?: number | null
): number {
  if (deliveryType === "self_pickup") return 0;
  if (deliveryType === "delivery_by_us") return fees.deliveryFee;
  // trailer_rental
  const days = trailerDays == null ? rentalDays : trailerDays;
  return fees.trailerPerDay * days;
}

// Autoritatief subtotaal (excl. transport/add-ons/btw), inclusief weekendpakket,
// zondagblokkade en campagnekorting. `startDate` is een UTC-geparste Date zodat
// getUTCDay() tijdzone-veilig is. Spiegelt calculateItemSubtotal EXACT.
export function computeOrderSubtotal(
  machine: any,
  rentalDays: number,
  startDate: Date,
  campaignRules: CampaignRuleLike[],
  profileRaw: string
): number {
  const m = machine as any;
  const profile = String(profileRaw || "").toLowerCase();

  // Campagnekorting bovenop een flat-rate basis (spiegelt pricing.ts withCampaign).
  // Volumekorting zit al in de flat rates — niet dubbel tellen.
  const withCampaign = (base: number): number => {
    let pct = 0;
    for (const rule of campaignRules.filter(r => r.isActive)) {
      const matches = rule.scope === "global"
        || (rule.scope === "category" && String(m.category).toLowerCase() === rule.scopeValue.toLowerCase())
        || (rule.scope === "product" && m.id === rule.scopeValue)
        || (rule.scope === "role" && profile === rule.scopeValue.toLowerCase());
      if (matches) pct = Math.max(pct, rule.discountPercent);
    }
    if (m.campaignDiscountPercent) pct = Math.max(pct, m.campaignDiscountPercent as number);
    let disc = base * (pct / 100);
    if (m.campaignDiscountAmount) disc += m.campaignDiscountAmount as number;
    return Math.max(0, base - disc);
  };

  const dow = startDate.getUTCDay();
  const strictWeekend = rentalDays === 2 && dow === 6;

  const tierPrice = (n: number): number | null => {
    if (n === 1 && m.oneDayPrice) return m.oneDayPrice;
    if (n === 2) {
      if (!m.weekendRulesEnabled && strictWeekend && m.weekendPrice) return m.weekendPrice;
      if (m.twoDayPrice) return m.twoDayPrice;
    }
    if (n === 3 && m.threeDayPrice) return m.threeDayPrice;
    if (n === 4 && m.fourDayPrice) return m.fourDayPrice;
    if ((n === 3 || n === 4 || n === 5) && m.weeklyPrice) return m.weeklyPrice;
    if (n >= 6 && n < 28 && m.weeklyPrice) {
      const extra = m.extraDayPrice ?? m.weeklyPrice / 5;
      let base = Math.round(m.weeklyPrice + (n - 5) * extra);
      if (m.monthlyPrice) base = Math.min(base, m.monthlyPrice);
      return base;
    }
    if (n >= 28 && m.monthlyPrice) {
      const fullMonths = Math.floor(n / 28);
      const remainder = n % 28;
      let remainderCost: number;
      if (remainder >= 3 && m.weeklyPrice) {
        const extra = m.extraDayPrice ?? m.weeklyPrice / 5;
        remainderCost = Math.round(remainder * extra);
      } else {
        remainderCost = remainder * m.pricePerDay;
      }
      remainderCost = Math.min(remainderCost, m.monthlyPrice);
      return fullMonths * m.monthlyPrice + remainderCost;
    }
    return null;
  };

  const endDow = (() => {
    const e = new Date(startDate);
    e.setUTCHours(0, 0, 0, 0);
    e.setUTCDate(e.getUTCDate() + (rentalDays - 1));
    return e.getUTCDay();
  })();
  const isWeekendPackage = !!(m.weekendRulesEnabled && m.weekendPrice && (
    (rentalDays === 1 && (dow === 6 || dow === 0)) ||
    (rentalDays === 2 && dow === 6 && endDow === 0)
  ));
  const hasSundayBlock = !!(m.weekendRulesEnabled && m.sundayBlockFee && !isWeekendPackage && endDow === 6);

  let subtotal: number;
  if (m.weeklyOnly && m.weeklyPrice) {
    const min = m.minRentalDays > 0 ? m.minRentalDays : 7;
    const weeks = Math.max(1, Math.ceil(Math.max(rentalDays, min) / 7));
    subtotal = withCampaign(weeks * m.weeklyPrice);
  } else if (isWeekendPackage) {
    subtotal = withCampaign(m.weekendPrice);
  } else if (tierPrice(rentalDays) !== null) {
    subtotal = withCampaign(tierPrice(rentalDays) as number);
  } else {
    const rawSubtotal = m.pricePerDay * rentalDays;
    let highestDiscountPercent = 0;
    if (rentalDays >= 28 && m.monthlyDiscountPercent) {
      highestDiscountPercent = Math.max(highestDiscountPercent, m.monthlyDiscountPercent);
    } else if (rentalDays >= 6 && m.weeklyDiscountPercent) {
      highestDiscountPercent = Math.max(highestDiscountPercent, m.weeklyDiscountPercent);
    }
    for (const rule of campaignRules.filter(r => r.isActive)) {
      let matches = false;
      if (rule.scope === "global") matches = true;
      else if (rule.scope === "category") matches = String(m.category).toLowerCase() === rule.scopeValue.toLowerCase();
      else if (rule.scope === "product") matches = m.id === rule.scopeValue;
      else if (rule.scope === "role") matches = profile === rule.scopeValue.toLowerCase();
      if (matches) highestDiscountPercent = Math.max(highestDiscountPercent, rule.discountPercent);
    }
    if (m.campaignDiscountPercent) {
      highestDiscountPercent = Math.max(highestDiscountPercent, m.campaignDiscountPercent);
    }
    let serverDiscountAmount = rawSubtotal * (highestDiscountPercent / 100);
    if (m.campaignDiscountAmount) serverDiscountAmount += (m.campaignDiscountAmount as number);
    subtotal = Math.max(0, rawSubtotal - serverDiscountAmount);
  }

  if (hasSundayBlock) subtotal += Number(m.sundayBlockFee);
  return Math.round(subtotal * 100) / 100;
}

// Autoritatief add-on-totaal, of een foutmelding wanneer de client een ongeldige
// toevoeging/aantal stuurt. Spiegelt de add-on-validatie in POST /api/orders EXACT
// (globale add-ons + machine-eigen cross-sell, categorie-uitsluitingen, rijplaten-
// aantal). `addons` = de rauwe orderData.addons-array.
const GLOBAL_ADDON_EXCLUDED_CATEGORIES: Record<string, string[]> = {
  safety: ["ladderlift"],
  rijplaten: ["aanhanger", "kamersteiger", "ecolift", "ladderlift"],
};

export function computeAddonsTotal(
  machine: any,
  rentalDays: number,
  addons: unknown,
  fees: ResolvedFees
): { total: number } | { error: string } {
  const m = machine as any;
  const crossSell: Array<{ id: string; pricePerWeek: number; pricePerDay?: number; pricePerTwoDay?: number }> =
    Array.isArray(m.crossSellAddons) ? m.crossSellAddons : [];
  const crossSellMap = new Map(crossSell.map(a => [String(a.id), a]));
  const machineWeeklyOnly = Boolean(m.weeklyOnly);
  const addonWeeks = Math.max(1, Math.ceil(
    Math.max(rentalDays, (m.minRentalDays > 0 ? m.minRentalDays : 7)) / 7
  ));
  const addonPrice = (sa: { pricePerWeek?: number; pricePerDay?: number; pricePerTwoDay?: number }): number => {
    if (!machineWeeklyOnly) {
      if (rentalDays === 1 && sa.pricePerDay != null && sa.pricePerDay > 0) return Number(sa.pricePerDay);
      if (rentalDays === 2 && sa.pricePerTwoDay != null && sa.pricePerTwoDay > 0) return Number(sa.pricePerTwoDay);
    }
    return Number(sa.pricePerWeek || 0) * addonWeeks;
  };
  const GLOBAL_ADDON_RATES: Record<string, number> = {
    safety: fees.addons.safety.pricePerWeek,
    rijplaten: fees.addons.rijplaten.pricePerWeek,
  };
  const globalAddonQty = (id: string, a: any): number | null => {
    if (id !== "rijplaten") return 1;
    const q = Number(a?.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 999) return null;
    return q;
  };
  const machineCategory = String(m.category ?? "");
  const rawAddons = Array.isArray(addons) ? addons : [];
  let total = 0;
  for (const a of rawAddons) {
    if (typeof a !== "object" || a === null) {
      return { error: "Ongeldige toevoeging in bestelling" };
    }
    const id = String((a as any).id ?? "");
    if (id in GLOBAL_ADDON_RATES) {
      if (GLOBAL_ADDON_EXCLUDED_CATEGORIES[id].includes(machineCategory)) {
        return { error: "Ongeldige toevoeging in bestelling" };
      }
      const qty = globalAddonQty(id, a);
      if (qty === null) return { error: "Ongeldig aantal rijplaten" };
      total += GLOBAL_ADDON_RATES[id] * addonWeeks * qty;
    } else if (crossSellMap.has(id)) {
      total += addonPrice(crossSellMap.get(id)!);
    } else {
      return { error: "Ongeldige toevoeging in bestelling" };
    }
  }
  return { total };
}

// Bouwt de op te slaan add-on-records ({ id, name, price, quantity? }) uit
// server-side data — nooit client-namen/prijzen persisteren. Roep dit pas aan
// nadat computeAddonsTotal de invoer heeft goedgekeurd (zelfde tarieven/aantallen).
export function buildStoredAddons(
  machine: any,
  rentalDays: number,
  addons: unknown,
  fees: ResolvedFees
): Array<{ id: string; name: string; price: number; quantity?: number }> {
  const m = machine as any;
  const crossSell: Array<{ id: string; name?: string; pricePerWeek: number; pricePerDay?: number; pricePerTwoDay?: number }> =
    Array.isArray(m.crossSellAddons) ? m.crossSellAddons : [];
  const crossSellMap = new Map(crossSell.map(a => [String(a.id), a]));
  const machineWeeklyOnly = Boolean(m.weeklyOnly);
  const addonWeeks = Math.max(1, Math.ceil(
    Math.max(rentalDays, (m.minRentalDays > 0 ? m.minRentalDays : 7)) / 7
  ));
  const addonPrice = (sa: { pricePerWeek?: number; pricePerDay?: number; pricePerTwoDay?: number }): number => {
    if (!machineWeeklyOnly) {
      if (rentalDays === 1 && sa.pricePerDay != null && sa.pricePerDay > 0) return Number(sa.pricePerDay);
      if (rentalDays === 2 && sa.pricePerTwoDay != null && sa.pricePerTwoDay > 0) return Number(sa.pricePerTwoDay);
    }
    return Number(sa.pricePerWeek || 0) * addonWeeks;
  };
  const rawAddons = Array.isArray(addons) ? addons : [];
  return rawAddons.map((a: any) => {
    const id = String(a?.id ?? "");
    if (id === "safety") return { id: "safety", name: fees.addons.safety.name, price: fees.addons.safety.pricePerWeek * addonWeeks };
    if (id === "rijplaten") {
      const q = Number(a?.quantity);
      const qty = Number.isInteger(q) && q >= 1 && q <= 999 ? q : 1;
      return { id: "rijplaten", name: `${fees.addons.rijplaten.name} (${qty} ${qty === 1 ? "stuk" : "stuks"})`, price: fees.addons.rijplaten.pricePerWeek * addonWeeks * qty, quantity: qty };
    }
    const sa = crossSellMap.get(id);
    return { id, name: sa?.name ?? id, price: sa ? addonPrice(sa) : 0 };
  });
}

// Volledige btw + totaal uit de losse componenten. 21% btw, 2 decimalen.
export function computeVatAndTotal(subtotal: number, transport: number, driver: number, addonsTotal: number): { vat: number; total: number } {
  const vat = Math.round((subtotal + transport + driver + addonsTotal) * 21) / 100;
  const total = Math.round((subtotal + transport + driver + addonsTotal + vat) * 100) / 100;
  return { vat, total };
}
