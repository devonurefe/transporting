import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowUpToLine,
  ArrowRightLeft,
  Weight,
  Zap,
  Check,
  Search,
  ShoppingBag,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Paintbrush,
  Home,
  Wrench,
  Leaf,
  HardHat,
  Droplets,
  Layers,
  Package,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine } from "../types";
import { categoryIconMap } from "./icons/CategoryIcons";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import { checkAvailability } from "../utils/availability";
import { withVat } from "../utils/format";
import VatToggle from "./VatToggle";

const professionIconMap: Record<string, LucideIcon> = {
  Schilder: Paintbrush,
  Particulier: Home,
  Installateur: Wrench,
  Hovenier: Leaf,
  Aannemer: HardHat,
  Glazenwasser: Droplets,
  Stukadoor: Layers,
  Magazijn: Package,
  Gevelreiniger: Building2,
};

interface CatalogSectionProps {
  machines: Machine[];
  customCategories?: {
    id: string;
    label: string;
    listLabel?: string;
    desc: string;
    heights: string;
    price: string;
    infoContent?: {
      useCases?: string[];
      advantages?: string[];
      notFor?: string[];
    };
  }[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  onSelectMachineForBooking: (machine: Machine) => void;
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  currentUser?: { name: string } | null;
}

// Per-model extra specs live in src/utils/machineSpecs.ts (admin-editable via AdminMachines).
import { getSpecsForMachine } from "../utils/machineSpecs";

// Look up extra specs: machine.specs (admin-edited DB value) takes priority, then hardcoded fallback.
function getExtraSpecs(id: string, machineSpecs?: unknown): Array<{ label: string; value: string }> {
  return getSpecsForMachine(id, machineSpecs);
}

function computeDiscounts(m: Machine) {
  // Use pricePerDay as the regular day rate baseline for discount % calculation
  const weekly = m.weeklyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.weeklyPrice / (5 * m.pricePerDay)) * 100)
    : (m.weeklyDiscountPercent ?? 0);
  const monthly = m.monthlyPrice && m.pricePerDay > 0
    ? Math.round((1 - m.monthlyPrice / (28 * m.pricePerDay)) * 100)
    : (m.monthlyDiscountPercent ?? 0);
  return { weekly: Math.max(0, weekly), monthly: Math.max(0, monthly) };
}

export default function CatalogSection({
  machines,
  customCategories = [],
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onSelectMachineForBooking,
  onAddSystemLog,
  currentUser,
}: CatalogSectionProps) {
  const t = useLanguageStore((state) => state.t);
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  // Display-only VAT conversion for every price shown in this section
  const vp = (p: number) => withVat(p, vatDisplay);
  const vatLabel = vatDisplay === "incl" ? "incl. btw" : "excl. btw";

  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const isMachineAvailableThisWeek = (machineId: string): boolean => {
    const result = checkAvailability(machineId, today, nextWeek, orders, blockedDates);
    return result.available;
  };

  const getNextAvailableDate = (machineId: string): string | null => {
    for (let i = 1; i <= 90; i++) {
      const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (checkAvailability(machineId, d, d, orders, blockedDates).available) return d;
    }
    return null;
  };

  const formatPrice = (p: number): string =>
    p % 1 === 0
      ? Math.round(p).toLocaleString("nl-NL")
      : p.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatShortDate = (iso: string): string => {
    const d = new Date(iso);
    const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [pricingPreviewMachine, setPricingPreviewMachine] = useState<Machine | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setActiveDetailImageIndex(0);
  }, [selectedDetailMachine]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
  };

  const SCHAARLIFT_IDS = new Set(["schaarlift", "schaarlift-smal", "schaarlift-6m"]);

  const categoryTabs = useMemo(() => {
    const tabs: { id: string; label: string }[] = [{ id: "all", label: "Alle Types" }];
    let schaarAdded = false;
    for (const cat of customCategories) {
      if (cat.id === "klussensets") continue;
      if (SCHAARLIFT_IDS.has(cat.id)) {
        if (!schaarAdded) {
          tabs.push({ id: "schaarlift-group", label: "Schaarliften" });
          schaarAdded = true;
        }
      } else {
        tabs.push({ id: cat.id, label: cat.listLabel || cat.label });
      }
    }
    return tabs;
  }, [customCategories]);

  // Strip " (Unit N)" suffix to get base model name for grouping
  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  // Count total physical units per base model name (from ALL machines, not filtered)
  const stockCountByBase = useMemo(() => {
    const counts: Record<string, number> = {};
    machines.forEach(m => {
      const base = getBaseName(m.name);
      counts[base] = (counts[base] || 0) + 1;
    });
    return counts;
  }, [machines]);

  // Map base name → all unit IDs (used by BookingSection for auto-assignment)
  const unitIdsByBase = useMemo(() => {
    const map: Record<string, string[]> = {};
    machines.forEach(m => {
      const base = getBaseName(m.name);
      if (!map[base]) map[base] = [];
      map[base].push(m.id);
    });
    return map;
  }, [machines]);

  // Filtered Machines — category + search only, deduplicated to show ONE card per model
  const filteredMachines = useMemo(() => {
    const filtered = machines.filter((machine) => {
      const matchesCategory = selectedCategory === "all"
        ? machine.category !== "klussensets"
        : selectedCategory === "schaarlift-group"
        ? SCHAARLIFT_IDS.has(machine.category)
        : machine.category === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = q === "" ||
        machine.id.toLowerCase().includes(q) ||
        machine.category.toLowerCase().includes(q) ||
        machine.name.toLowerCase().includes(q) ||
        (machine.description?.toLowerCase() || "").includes(q) ||
        (machine.suitableFor ?? []).some(p => p.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });

    // Deduplicate: show only the first unit (representative) per model
    const seen = new Set<string>();
    const deduped = filtered.filter(machine => {
      const base = getBaseName(machine.name);
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    });

    // Sort: ascending by height so 6m → 8m → 10m within schaarliften; then by price
    return deduped.sort((a, b) => {
      if (a.height !== b.height) return a.height - b.height;
      return a.pricePerDay - b.pricePerDay;
    });
  }, [machines, selectedCategory, searchQuery]);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] py-6 sm:py-10 px-5 sm:px-6 lg:px-8">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-10 left-5 h-80 w-80 rounded-full bg-blue-600/5 blur-[100px] -z-10" />

      <div className="mx-auto max-w-7xl">
        
        {/* Title Deck */}
        <div className="mb-6">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>{t("catalogTitle")}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t("catalogSubtitle")}
          </p>
        </div>

        {/* Clean Unified Control Bar */}
        <div className="flex flex-col gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm mb-6">
          {/* Row 1: Category tabs */}
          <nav aria-label="Categorie filter" className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
            {categoryTabs.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedCategory(tab.id);
                    onAddSystemLog?.(
                      "system",
                      currentUser ? currentUser.name : "Gast",
                      `Filtert catalogus op categorie: "${tab.label}"`
                    );
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-600/20"
                      : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {(() => {
                    const Icon = categoryIconMap[tab.id];
                    return Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null;
                  })()}
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Row 2: Search + VAT display toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-colors">
              <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
              <input
                id="catalog-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op type, hoogte, beroep..."
                className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 ml-2 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <VatToggle />
          </div>
        </div>

        {/* Grid Machinery Deck */}
        <div className="space-y-6">

            {/* Micro Warning if list is empty */}
            {filteredMachines.length === 0 && (
              <div className="glass-panel p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 bg-white border border-slate-200 shadow-sm">
                <Info className="h-8 w-8 text-indigo-600" />
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Geen machines gevonden</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Geen machines gevonden voor uw zoekopdracht. Probeer een andere zoekterm.
                  </p>
                </div>
                <button
                  onClick={resetFilters}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0"
                >
                  Zoekopdracht wissen
                </button>
              </div>
            )}

            {/* Grid layout — wider cards: 2-col from sm, 3-col only at xl */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
              <AnimatePresence mode="popLayout">
                {filteredMachines.map((machine) => {
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      key={machine.id}
                      className="group relative overflow-hidden rounded-2xl border bg-white flex flex-col border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200"
                    >
                      {/* Top-left badge: Availability + optional stock count */}
                      {(() => {
                        const stock = stockCountByBase[getBaseName(machine.name)] ?? 1;
                        const available = isMachineAvailableThisWeek(machine.id);
                        const nextDate = !available ? getNextAvailableDate(machine.id) : null;
                        const availText = available ? "Beschikbaar" : nextDate ? `Vrij ${formatShortDate(nextDate)}` : "Vol geboekt";
                        return (
                          <div className={`absolute top-3 left-3 z-20 flex items-center gap-1 py-1 px-2.5 rounded-full text-[10px] font-bold shadow-sm ${
                            available
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                              : "bg-amber-50 border border-amber-200 text-amber-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${available ? "bg-emerald-500" : "bg-amber-400"}`} />
                            {availText}
                            {stock > 1 && (
                              <span className={`font-black pl-0.5 ${available ? "text-emerald-600" : "text-amber-600"}`}>· {stock}×</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* IMAGE with category + powerType overlay — clickable to open detail modal */}
                      <div
                        className="relative aspect-[3/2] w-full overflow-hidden bg-white cursor-pointer"
                        onClick={() => {
                          setSelectedDetailMachine(machine);
                          onAddSystemLog?.("system", currentUser?.name ?? "Gast", `Bekijkt specificaties: "${machine.name}"`);
                        }}
                      >
                        <img
                          src={machine.imageUrl || (machine.additionalImages?.[0] ?? "/placeholder-machine.webp")}
                          alt={machine.imageAlt}
                          loading="lazy"
                          className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const fallback = machine.additionalImages?.[0];
                            if (fallback && e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            } else {
                              e.currentTarget.src = "/placeholder-machine.webp";
                            }
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/45 to-transparent flex items-end justify-between">
                          <span className="text-[10px] font-bold text-white/95 uppercase tracking-wider leading-none">
                            {machine.categoryLabel}
                          </span>
                          <span className="text-[10px] font-semibold text-white/90 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-md">
                            {machine.powerType}
                          </span>
                        </div>
                        {/* Hover hint */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                            Meer info
                          </span>
                        </div>
                      </div>

                      {/* CARD CONTENT */}
                      <div className="p-4 flex flex-col gap-2.5 flex-1">

                        {/* Name + Price */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors duration-200">
                              {getBaseName(machine.name)}
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xl font-display font-black leading-none bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                              €{formatPrice(vp(machine.pricePerDay))}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">per dag {vatLabel}</div>
                            {machine.oneDayPrice && machine.oneDayPrice < machine.pricePerDay && (
                              <div className="text-[10px] text-amber-600 font-bold mt-0.5">1 dag actie €{formatPrice(vp(machine.oneDayPrice))}</div>
                            )}
                          </div>
                        </div>

                        {/* Tarieven — single button replacing pills */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPricingPreviewMachine(machine); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-700 text-[11px] font-semibold transition-all cursor-pointer group"
                        >
                          <span className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-emerald-500 shrink-0" />
                            Alle tarieven &amp; kortingen
                          </span>
                          <span className="text-emerald-500 group-hover:text-emerald-700 transition-colors text-[10px] font-mono">→</span>
                        </button>

                        {/* Spec + SuitableFor — single row */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-600 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1 shrink-0" title="Werkhoogte">
                            <ArrowUpToLine className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span className="font-bold text-slate-800">{machine.height}m</span>
                          </span>
                          {machine.reach > 0 && (
                            <span className="flex items-center gap-1 shrink-0" title="Uitreik">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                              {machine.reach}m
                            </span>
                          )}
                          <span className="text-slate-300 select-none shrink-0">·</span>
                          {(machine.suitableFor ?? []).length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">Algemeen gebruik</span>
                          )}
                          {(machine.suitableFor ?? []).slice(0, 2).map((prof) => (
                            <span
                              key={prof}
                              className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-2 py-0.5 rounded-full transition-colors duration-150 cursor-default select-none"
                            >
                              {prof}
                            </span>
                          ))}
                          {(machine.suitableFor ?? []).length > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold px-1 select-none">+{machine.suitableFor.length - 2} meer</span>
                          )}
                        </div>

                        {/* Campaign badge */}
                        {machine.campaignText && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg w-fit">
                            <Zap className="h-3 w-3 text-amber-500" />
                            {machine.campaignText}
                            {machine.campaignDiscountPercent && ` −${machine.campaignDiscountPercent}%`}
                          </div>
                        )}

                        {/* Action buttons — primary CTA is dominant */}
                        <div className="flex gap-2 mt-auto pt-1.5">
                          <button
                            onClick={() => {
                              setSelectedDetailMachine(machine);
                              onAddSystemLog?.("system", currentUser?.name ?? "Gast", `Bekijkt specificaties: "${machine.name}"`);
                            }}
                            className="advice-btn flex-none px-3 py-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-700 hover:text-indigo-900 text-[11px] font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer"
                          >
                            {t("btnSpecifications")}
                          </button>
                          <button
                            onClick={() => onSelectMachineForBooking(machine)}
                            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            {t("btnRentNow")}
                          </button>
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

        </div>

      </div>

      {/* Specifications & Bundle Contents Modal */}
      <AnimatePresence>
        {selectedDetailMachine && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailMachine(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh] my-8"
            >
              {/* Premium Gradient Top Stripe */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400" />

              {/* Close Button & Header */}
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <span className="text-[10px] text-teal-600 font-mono uppercase tracking-widest block font-bold">
                    {selectedDetailMachine.categoryLabel || "Vloot Details"} • {selectedDetailMachine.powerType}
                  </span>
                  <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">
                    {selectedDetailMachine.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailMachine(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Content — single column, mobile-first */}
              {(() => {
                const catInfo = customCategories.find(c => c.id === selectedDetailMachine.category)?.infoContent ?? null;
                const allDetailImages = [
                  selectedDetailMachine.imageUrl,
                  ...(selectedDetailMachine.additionalImages ?? [])
                ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
                const packageItems = selectedDetailMachine.packageContents?.trim()
                  ? selectedDetailMachine.packageContents.split(";").map(s => s.trim()).filter(Boolean)
                  : null;

                const getDefaultPackageItems = (id: string): string[] => {
                  switch (id) {
                    case "set-paint-comfort": return [
                      "1x Gecertificeerde Elektrische Schaarlift (12m werkhoogte)",
                      "2x 20m zware rubberen verlengkabels (230V / IP44)",
                      "1x Handige gereedschapsbak gemonteerd op het werkplatform",
                      "1x Luxe comfort-veiligheidsharnas (EN-361 gekeurd)",
                      "4x Non-marking witte banden (geen sporen op luxe vloeren)",
                      "10m Vloerbeschermingsvlies (gratis meegeleverd)",
                    ];
                    case "set-solar-pro": return [
                      "1x Knikarmhoogwerker (18m werkhoogte, 16m zijdelings bereik)",
                      "2x Heavy-duty materiaalgordels met verstelbare karbijnhaakjes",
                      "1x Speciaal ontworpen zonnepaneel-draagbeugel aan de korf",
                      "1x Alleenstaand EN-361 Premium valbeveiligingsset Pro met schokdemper",
                      "1x Geïntegreerde 230V stroomaansluiting rechtstreeks in de werkbak",
                    ];
                    case "set-prune-compact": return [
                      "1x Spinhoogwerker Spider (15m werkhoogte) op smalle rupsbanden",
                      "4x Heavy-duty kunststof rijplaten (voorkomt sporen in gazons)",
                      "1x Gecertificeerde bosbouwer snoeihelm met vizier en oorkappen",
                      "1x Magnetische relingtray voor snoeigereedschappen",
                      "1x Biologische kettingzaag olie (1 Liter)",
                      "1x Spanbandenset voor extra stempelfixatie op hellingen",
                    ];
                    case "set-gutter-fast": return [
                      "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
                      "1x Telescopische dakgootschep & telescopische trekker/bezem set",
                      "1x Geïntegreerde 230V stroomaansluiting in de korf",
                      "1x Geperforeerde aluminium werkbak voor emmers en afval",
                      "1x Set van 4 wegafzetting pionnen met reflecterende strips",
                      "1x Veiligheidshesje en handschoenen (maat L)",
                    ];
                    case "set-facade-heavy": return [
                      "1x Telescoophoogwerker Diesel (26m werkhoogte) - 4x4 aangedreven",
                      "2x Slanghaspel mastklemmen voor hogedrukslangen tot korf",
                      "1x Geïntegreerde generator unit (stroom & hogedrukwatertoevoer)",
                      "2x Waterdichte mouwbeschermers & vizierbrillen voor gevelspuiten",
                      "1x RVS werkbakorganizer voor spuitlansen",
                    ];
                    case "set-window-premium": return [
                      "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
                      "1x Osmose watertank montagebeugels aan de werkbak",
                      "1x Extra brede 2-persoons platformbak (gondel)",
                      "4x Stempelschotels om wegzakken in zachte straatstenen te voorkomen",
                      "1x Ruitenwisserset Pro (trekkers, inwasmoffen & telescoopsteel)",
                      "1x Waterbestendige opbergtas aan de korf",
                    ];
                    case "set-diy-weekend": return [
                      "1x Compacte Elektrische Schaarlift (12m werkhoogte)",
                      "1x Comfort EN-361 gecertificeerd veiligheidsharnas",
                      "1x Premium klushelm met kinband",
                      "1x Stap-voor-stap gedrukte handleiding 'Veilig Werken op Hoogte'",
                      "Voorrangstoegang tot onze 24/7 telefonische hulplijn (WhatsApp)",
                    ];
                    case "set-light-install": return [
                      "1x Spinhoogwerker Hybrid (15m werkhoogte) op rupsen",
                      "1x Automatische veertrommel haspelkit voor mastbekabeling",
                      "1x Magnetische bak voor schroeven, klemmen en zekeringen",
                      "2x Comfort harnassen met snelgespen",
                      "1x Professionele laser nevelmeter (te leen)",
                    ];
                    default: return [
                      "1x Professionele en gekeurde machine",
                      "1x Volle tank brandstof of 100% opgeladen accupakket",
                      "1x Hub service inspectie voorafgaand aan aflevering",
                      "BMWT Veiligheidscertificaat handleiding in de werkbak",
                      "24/7 Technische storingshulp & backup service",
                    ];
                  }
                };

                return (
                  <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin scrollbar-thumb-slate-200">

                    {/* A — Afbeeldingen */}
                    <div className="space-y-2">
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm relative group">
                        <AnimatePresence mode="wait">
                          <motion.img
                            key={activeDetailImageIndex}
                            src={allDetailImages[activeDetailImageIndex] ?? "/placeholder-machine.webp"}
                            alt={`${selectedDetailMachine.name} — foto ${activeDetailImageIndex + 1}`}
                            className="w-full h-full object-contain"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                          />
                        </AnimatePresence>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent pointer-events-none" />
                        {allDetailImages.length > 1 && (
                          <>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setActiveDetailImageIndex(p => p === 0 ? allDetailImages.length - 1 : p - 1); }}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                            ><ChevronLeft className="h-4 w-4" /></button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setActiveDetailImageIndex(p => p === allDetailImages.length - 1 ? 0 : p + 1); }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                            ><ChevronRight className="h-4 w-4" /></button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-950/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                              {allDetailImages.map((_, i) => (
                                <button key={i} type="button" onClick={() => setActiveDetailImageIndex(i)}
                                  className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeDetailImageIndex ? "bg-indigo-400 w-3.5" : "bg-white/60 hover:bg-white w-1.5"}`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {allDetailImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto py-0.5 scrollbar-none">
                          {allDetailImages.map((url, i) => (
                            <button key={i} type="button" onClick={() => setActiveDetailImageIndex(i)}
                              className={`relative h-11 w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-white ${i === activeDetailImageIndex ? "border-indigo-600 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-400"}`}
                            >
                              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* B — Tarieven (compact tier table) */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      {/* Header: dagtarief + BTW toggle */}
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Dagtarief</span>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-display font-black text-slate-900">€{formatPrice(vp(selectedDetailMachine.pricePerDay))}</span>
                            <span className="text-[10px] text-slate-400">{vatLabel} p/dag</span>
                          </div>
                        </div>
                        <VatToggle size="xs" />
                      </div>
                      {/* Tier rows */}
                      <div className="divide-y divide-slate-100">
                        {selectedDetailMachine.oneDayPrice && selectedDetailMachine.oneDayPrice < selectedDetailMachine.pricePerDay && (
                          <div className="flex items-center px-4 py-2.5 bg-amber-50">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-amber-700">1 dag actie</p>
                              <p className="text-[10px] text-amber-500">Ma – Vr</p>
                            </div>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mr-2">Actie</span>
                            <span className="font-mono font-extrabold text-sm text-amber-700">€{formatPrice(vp(selectedDetailMachine.oneDayPrice))}</span>
                          </div>
                        )}
                        {(() => {
                          const twoDay = selectedDetailMachine.twoDayPrice ?? (selectedDetailMachine.pricePerDay * 2);
                          return (
                            <div className="flex items-center px-4 py-2.5 bg-white">
                              <div className="flex-1">
                                <p className="text-xs font-bold text-slate-800">2 dagen (doordeweeks)</p>
                                <p className="text-[10px] text-slate-400">Ma – Do</p>
                              </div>
                              <span className="font-mono font-extrabold text-sm text-slate-900">€{formatPrice(vp(twoDay))}</span>
                            </div>
                          );
                        })()}
                        {selectedDetailMachine.weekendPrice && (
                          <div className="flex items-center px-4 py-2.5 bg-violet-50">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-violet-700">Weekend</p>
                              <p className="text-[10px] text-violet-400">Za – Zo  /  Vr – Zo</p>
                            </div>
                            <span className="font-mono font-extrabold text-sm text-violet-700">€{formatPrice(vp(selectedDetailMachine.weekendPrice))}</span>
                          </div>
                        )}
                        {selectedDetailMachine.weeklyPrice && (() => { const d = computeDiscounts(selectedDetailMachine); return (
                          <div className="flex items-center px-4 py-2.5 bg-emerald-50">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-emerald-700">3–5 dagen (werkweek)</p>
                              <p className="text-[10px] text-emerald-400">Ma – Vr</p>
                            </div>
                            {d.weekly > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 mr-2">−{d.weekly}%</span>}
                            <span className="font-mono font-extrabold text-sm text-emerald-700">€{formatPrice(vp(selectedDetailMachine.weeklyPrice))}</span>
                          </div>
                        ); })()}
                        {selectedDetailMachine.monthlyPrice && (() => { const d = computeDiscounts(selectedDetailMachine); return (
                          <div className="flex items-center px-4 py-2.5 bg-teal-50">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-teal-700">4 weken (28 dagen)</p>
                              <p className="text-[10px] text-teal-400">Langlopend</p>
                            </div>
                            {d.monthly > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 mr-2">−{d.monthly}%</span>}
                            <span className="font-mono font-extrabold text-sm text-teal-700">€{formatPrice(vp(selectedDetailMachine.monthlyPrice))}</span>
                          </div>
                        ); })()}
                        {selectedDetailMachine.campaignText && (
                          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50">
                            <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="text-[11px] font-bold text-amber-700">
                              {selectedDetailMachine.campaignText}{selectedDetailMachine.campaignDiscountPercent ? ` −${selectedDetailMachine.campaignDiscountPercent}%` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* C — Omschrijving */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Omschrijving</p>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        {selectedDetailMachine.description}
                      </p>
                    </div>

                    {/* D — Technische Specificaties */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Technische Specificaties</p>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-white">
                          <span className="text-[10px] font-mono text-slate-400">Type machine</span>
                          <span className="text-sm font-bold text-slate-900">{selectedDetailMachine.categoryLabel}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 bg-white">
                          <span className="text-[10px] font-mono text-slate-400">Werkhoogte</span>
                          <span className="text-sm font-bold text-slate-900 font-mono">{selectedDetailMachine.height} m</span>
                        </div>
                        {selectedDetailMachine.reach > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 bg-white">
                            <span className="text-[10px] font-mono text-slate-400">Uitreik</span>
                            <span className="text-sm font-bold text-slate-900 font-mono">{selectedDetailMachine.reach} m</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-3 py-2 bg-white">
                          <span className="text-[10px] font-mono text-slate-400">Gewicht</span>
                          <span className="text-sm font-bold text-slate-900 font-mono">{selectedDetailMachine.weight.toLocaleString("nl-NL")} kg</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 bg-white">
                          <span className="text-[10px] font-mono text-slate-400">Aandrijving</span>
                          <span className={`text-sm font-bold font-mono ${selectedDetailMachine.powerType === "Diesel" ? "text-orange-600" : selectedDetailMachine.powerType === "Hybride" ? "text-blue-700" : "text-emerald-700"}`}>
                            {selectedDetailMachine.powerType}
                          </span>
                        </div>
                        {getExtraSpecs(selectedDetailMachine.id, (selectedDetailMachine as any).specs).map((spec) => (
                          <div key={spec.label} className="flex items-center justify-between px-3 py-2 bg-white">
                            <span className="text-[10px] font-mono text-slate-400">{spec.label}</span>
                            <span className="text-sm font-bold text-slate-700 text-right max-w-[55%]">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                      {selectedDetailMachine.packageContents && (() => {
                        const items = selectedDetailMachine.packageContents!.split(";").map(s => s.trim()).filter(Boolean);
                        return items.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Inbegrepen</p>
                            {items.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                <span className="text-emerald-500 font-black shrink-0 mt-0.5 select-none">✓</span>{item}
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* E — Geschikt voor */}
                    {(selectedDetailMachine.suitableFor ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Geschikt Voor</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDetailMachine.suitableFor.map((tag) => {
                            const TagIcon = professionIconMap[tag];
                            return (
                              <span key={tag} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                                {TagIcon && <TagIcon className="h-3 w-3 shrink-0" />}
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* F — Toepassing (van kaartaccordeon naar modal) */}
                    {catInfo && (catInfo.useCases?.length || catInfo.advantages?.length || catInfo.notFor?.length) ? (
                      <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 space-y-4">
                        <p className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-bold">Toepassing & Geschiktheid</p>
                        {catInfo.useCases && catInfo.useCases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoUseCases")}</p>
                            <ul className="space-y-1.5">
                              {catInfo.useCases.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                                  <span className="text-emerald-500 font-black shrink-0 mt-0.5 select-none">✓</span>{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {catInfo.advantages && catInfo.advantages.length > 0 && (
                          <div>
                            <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoAdvantages")}</p>
                            <ul className="space-y-1.5">
                              {catInfo.advantages.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                                  <span className="text-indigo-500 font-black shrink-0 mt-0.5 select-none">+</span>{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {catInfo.notFor && catInfo.notFor.length > 0 && (
                          <div>
                            <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoNotFor")}</p>
                            <ul className="space-y-1.5">
                              {catInfo.notFor.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                                  <span className="text-rose-400 font-black shrink-0 mt-0.5 select-none">✕</span>{item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* G — Pakketinhoud */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-teal-600 shrink-0" />
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">Inbegrepen in de Huurprijs</p>
                      </div>
                      <div className="space-y-2">
                        {(packageItems ?? getDefaultPackageItems(selectedDetailMachine.id)).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                            <span className="text-teal-600 font-bold shrink-0 mt-0.5 font-mono select-none">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* H — Compliance footer */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl text-[10px] text-slate-500 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-100 border border-amber-200 text-amber-900 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold font-mono">BMWT</span>
                        <span>Jaarlijks veilig gekeurd</span>
                      </div>
                      <span className="font-mono text-indigo-400">Art. {selectedDetailMachine.id}</span>
                    </div>

                  </div>
                );
              })()}
              
              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center gap-3 shrink-0 mt-3">
                <button
                  onClick={() => setSelectedDetailMachine(null)}
                  className="px-5 py-2 hover:bg-slate-100 bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Sluiten
                </button>
                <button
                  onClick={() => { setSelectedDetailMachine(null); onSelectMachineForBooking(selectedDetailMachine!); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {t("btnRentNow")}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── PRICING PREVIEW MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {pricingPreviewMachine && (() => {
          const m = pricingPreviewMachine;
          const d = computeDiscounts(m);
          const vp = (n: number) => withVat(n, vatDisplay);
          const rows: { period: string; when: string; price: number; badge?: string; highlight?: "fire" | "green" | "teal" | "violet" }[] = [];

          if (m.oneDayPrice && m.oneDayPrice < m.pricePerDay) {
            rows.push({ period: "1 dag actie", when: "Ma – Vr", price: m.oneDayPrice, highlight: "fire" });
          }
          // Always show 2-day: use twoDayPrice if set, otherwise pricePerDay × 2
          rows.push({ period: "2 dagen (doordeweeks)", when: "Ma – Do", price: m.twoDayPrice ?? (m.pricePerDay * 2) });
          if (m.weekendPrice) {
            rows.push({ period: "Weekend", when: "Za – Zo  /  Vr – Zo", price: m.weekendPrice, highlight: "violet" });
          }
          if (m.weeklyPrice) {
            rows.push({ period: "3 – 5 dagen (werkweek)", when: "Ma – Vr", price: m.weeklyPrice, badge: d.weekly > 0 ? `−${d.weekly}%` : undefined, highlight: "green" });
          }
          if (m.monthlyPrice) {
            rows.push({ period: "4 weken (28 dagen)", when: "Langlopend", price: m.monthlyPrice, badge: d.monthly > 0 ? `−${d.monthly}%` : undefined, highlight: "teal" });
          }

          return (
            <motion.div
              key="pricing-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setPricingPreviewMachine(null)}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-0.5">{m.categoryLabel}</p>
                    <h3 className="font-display font-black text-slate-900 text-base leading-snug">{m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dagtarief <span className="font-bold text-slate-800">€{formatPrice(vp(m.pricePerDay))}</span> <span className="text-slate-400">{vatLabel}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPricingPreviewMachine(null)}
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Tier table — scrollable on mobile */}
                <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-5 py-3 ${
                        row.highlight === "fire" ? "bg-amber-50" :
                        row.highlight === "green" ? "bg-emerald-50" :
                        row.highlight === "teal" ? "bg-teal-50" :
                        row.highlight === "violet" ? "bg-violet-50" : "bg-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${
                          row.highlight === "fire" ? "text-amber-700" :
                          row.highlight === "green" ? "text-emerald-700" :
                          row.highlight === "teal" ? "text-teal-700" :
                          row.highlight === "violet" ? "text-violet-700" : "text-slate-800"
                        }`}>{row.period}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{row.when}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.badge && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            row.highlight === "green" ? "bg-emerald-100 text-emerald-700" : "bg-teal-100 text-teal-700"
                          }`}>{row.badge}</span>
                        )}
                        {row.highlight === "fire" && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Actie</span>
                        )}
                        <span className={`font-mono font-extrabold text-sm ${
                          row.highlight === "fire" ? "text-amber-700" :
                          row.highlight === "green" ? "text-emerald-700" :
                          row.highlight === "teal" ? "text-teal-700" :
                          row.highlight === "violet" ? "text-violet-700" : "text-slate-900"
                        }`}>€{formatPrice(vp(row.price))}</span>
                      </div>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div className="px-5 py-6 text-center text-xs text-slate-400">Alleen dagprijs beschikbaar</div>
                  )}
                </div>

                {/* BTW toggle + CTA */}
                <div className="px-5 pt-4 space-y-3 bg-slate-50 border-t border-slate-100 shrink-0" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Weergave</span>
                    <VatToggle size="xs" />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPricingPreviewMachine(null); onSelectMachineForBooking(m); }}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Huur Nu
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
