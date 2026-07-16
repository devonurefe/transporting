// Transport- en globale add-on-tarieven, admin-instelbaar via SiteConfig
// (AdminContent → Tarieven). Dit is de SERVER-kant van de prijs-spiegel;
// src/utils/pricing.ts (getTransportFees/getGlobalAddons) is de client-kant.
// BEIDE kanten moeten identieke defaults en clamps houden, anders faalt de
// ordervalidatie met "Ongeldig transportbedrag" — zie CLAUDE.md.

export const DEFAULT_TRANSPORT_FEES = { deliveryFee: 150, trailerPerDay: 25 } as const;

export const DEFAULT_GLOBAL_ADDONS = {
  safety: { name: "Veiligheidsset Pro", pricePerWeek: 15 },
  rijplaten: { name: "Rijplaten", pricePerWeek: 6 }
} as const;

export interface ResolvedFees {
  deliveryFee: number;
  trailerPerDay: number;
  addons: {
    safety: { name: string; pricePerWeek: number };
    rijplaten: { name: string; pricePerWeek: number };
  };
}

const clampFee = (raw: unknown, fallback: number): number => {
  const n = Number(raw);
  return isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : fallback;
};

const cleanName = (raw: unknown, fallback: string): string =>
  typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 60) : fallback;

// Eén resolver voor beide tariefvelden; ontbrekende/misvormde velden vallen
// per veld terug op de default (= de historische hard-coded literal).
export function resolveFees(siteConf: { transportFees?: unknown; globalAddons?: unknown } | null | undefined): ResolvedFees {
  const tf = (siteConf?.transportFees ?? {}) as Record<string, unknown>;
  const ga = (siteConf?.globalAddons ?? {}) as Record<string, Record<string, unknown> | undefined>;
  return {
    deliveryFee: clampFee(tf?.deliveryFee, DEFAULT_TRANSPORT_FEES.deliveryFee),
    trailerPerDay: clampFee(tf?.trailerPerDay, DEFAULT_TRANSPORT_FEES.trailerPerDay),
    addons: {
      safety: {
        name: cleanName(ga?.safety?.name, DEFAULT_GLOBAL_ADDONS.safety.name),
        pricePerWeek: clampFee(ga?.safety?.pricePerWeek, DEFAULT_GLOBAL_ADDONS.safety.pricePerWeek)
      },
      rijplaten: {
        name: cleanName(ga?.rijplaten?.name, DEFAULT_GLOBAL_ADDONS.rijplaten.name),
        pricePerWeek: clampFee(ga?.rijplaten?.pricePerWeek, DEFAULT_GLOBAL_ADDONS.rijplaten.pricePerWeek)
      }
    }
  };
}
