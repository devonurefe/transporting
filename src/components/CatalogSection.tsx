import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowUpToLine,
  ArrowRightLeft,
  Zap,
  Search,
  ShoppingCart,
  Info,
  X,
  Tag,
  ChevronRight,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { Machine } from "../types";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import { someUnitAvailable } from "../utils/availability";
import { withVat, priceNum } from "../utils/format";
import { computeDiscounts } from "../utils/pricing";
import VatToggle from "./VatToggle";
import MachineDetailModal from "./MachineDetailModal";
import { CardBrandWatermark } from "./Header";


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

/**
 * Catalog card image with a shimmer skeleton until the photo loads, so the
 * fixed-ratio box never flashes empty white (zero layout shift). Falls back to
 * the first additional image, then the local placeholder, on error.
 */
function CardImage({ src, alt, additional }: { src: string; alt?: string; additional?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 skeleton-shimmer" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-contain group-hover:scale-105 transition-all duration-500 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          if (additional && e.currentTarget.src !== additional) {
            e.currentTarget.src = additional;
            setLoaded(true);
          } else {
            e.currentTarget.src = "/placeholder-machine.webp";
            setLoaded(true);
          }
        }}
      />
    </>
  );
}

// Look up extra specs: machine.specs (admin-edited DB value) takes priority, then hardcoded fallback.
function getExtraSpecs(id: string, machineSpecs?: unknown): Array<{ label: string; value: string }> {
  return getSpecsForMachine(id, machineSpecs);
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

  // Model-aware: a model is "Beschikbaar" if ANY of its physical units is free.
  // Stock counts stay server-side — the customer only sees available / vol.
  const isModelAvailableThisWeek = (unitIds: string[]): boolean =>
    someUnitAvailable(unitIds, today, nextWeek, orders, blockedDates);

  const getNextAvailableDate = (unitIds: string[]): string | null => {
    for (let i = 1; i <= 90; i++) {
      const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (someUnitAvailable(unitIds, d, d, orders, blockedDates)) return d;
    }
    return null;
  };

  // Renders the € sign joined to the number so every price on the catalog
  // (day rate, actie, tariff table) reads consistently — "€60,50".
  const formatPrice = (p: number): string => "€" + priceNum(p);

  const formatShortDate = (iso: string): string => {
    const d = new Date(iso);
    const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);
  const [detailSource, setDetailSource] = useState<"pricing" | "info">("pricing");
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [pricingPreviewMachine, setPricingPreviewMachine] = useState<Machine | null>(null);

  // Category filter row: enable the right chevron to scroll the tab strip, and
  // hide it once the user reaches the end (or when all tabs already fit).
  const categoryNavRef = useRef<HTMLElement>(null);
  const [canScrollCategories, setCanScrollCategories] = useState(false);
  const scrollCategories = () => {
    categoryNavRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Per-machine customer ratings (real bookings only) for catalog social proof.
  const [machineRatings, setMachineRatings] = useState<Record<string, { average: number; count: number }>>({});
  useEffect(() => {
    let active = true;
    fetch("/api/orders/ratings/by-machine")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => { if (active) setMachineRatings(data ?? {}); })
      .catch(() => { /* ratings are non-critical — fail silently */ });
    return () => { active = false; };
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

  // Keep the category scroll chevron in sync with the strip's overflow state.
  useEffect(() => {
    const el = categoryNavRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollCategories(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [categoryTabs.length]);

  // Strip " (Unit N)" suffix to get base model name for grouping
  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  // Only show active machines everywhere in the catalog
  const activeMachines = useMemo(() => machines.filter(m => m.isActive !== false), [machines]);

  // Map base name → all unit IDs (used for model-level availability + auto-assignment)
  const unitIdsByBase = useMemo(() => {
    const map: Record<string, string[]> = {};
    activeMachines.forEach(m => {
      const base = getBaseName(m.name);
      if (!map[base]) map[base] = [];
      map[base].push(m.id);
    });
    return map;
  }, [activeMachines]);

  // Combine customer ratings across all physical units of a model (the catalog
  // shows one card per model), weighted by each unit's number of ratings.
  const ratingForUnits = (unitIds: string[]): { average: number; count: number } | null => {
    let total = 0;
    let count = 0;
    for (const id of unitIds) {
      const r = machineRatings[id];
      if (r?.count) { total += r.average * r.count; count += r.count; }
    }
    return count > 0 ? { average: total / count, count } : null;
  };

  // Defer the search query so typing stays responsive: the input updates
  // immediately while the (heavier) filter + grid re-render lags a keystroke behind.
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  // Filtered Machines — category + search only, deduplicated to show ONE card per model
  const filteredMachines = useMemo(() => {
    const filtered = activeMachines.filter((machine) => {
      const matchesCategory = selectedCategory === "all"
        ? machine.category !== "klussensets"
        : selectedCategory === "schaarlift-group"
        ? SCHAARLIFT_IDS.has(machine.category)
        : machine.category === selectedCategory;

      const q = deferredSearchQuery.trim().toLowerCase();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMachines, selectedCategory, deferredSearchQuery]);

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
          <div className="relative">
          <nav ref={categoryNavRef} aria-label="Categorie filter" className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pr-7">
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
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all border cursor-pointer ${
                    isActive
                      ? "bg-slate-800 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
          {/* Scroll affordance: a clickable chevron that scrolls the tab strip,
              shown only while there are more tabs hidden to the right. */}
          {canScrollCategories && (
            <button
              type="button"
              onClick={scrollCategories}
              aria-label="Meer categorieën tonen"
              className="absolute right-0 top-0 bottom-0 flex items-center pl-8 pr-1 bg-gradient-to-l from-white via-white to-transparent cursor-pointer border-none"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          )}
          </div>

          {/* Row 2: Search + VAT display toggle — stacked full-width on mobile,
              side-by-side from sm+ so both controls stay balanced. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex w-full sm:flex-1 items-center bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-2 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-colors">
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
            <VatToggle block />
          </div>
        </div>

        {/* Grid Machinery Deck */}
        <div className="space-y-6">

            {/* Micro Warning if list is empty */}
            {filteredMachines.length === 0 && (
              <div className="glass-panel p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 bg-white border border-slate-200 shadow-sm">
                <Info className="h-8 w-8 text-orange-500" />
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Geen machines gevonden</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Geen machines gevonden voor uw zoekopdracht. Probeer een andere zoekterm.
                  </p>
                </div>
                <button
                  onClick={resetFilters}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0"
                >
                  Zoekopdracht wissen
                </button>
              </div>
            )}

            {/* Grid layout — wider cards: 1-col mobile, 2-col tablet+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {/* initial={false}: skip the fly-in animation for cards already on
                  screen when this mounts — otherwise every card in the grid
                  animates in at once on first visit, which reads as jittery/
                  broken rather than a real page. Still animates smoothly when
                  the filtered set changes (search/category switch). */}
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredMachines.map((machine) => {
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      key={machine.id}
                      className="group relative overflow-hidden rounded-2xl border bg-white flex flex-col border-slate-200 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-200 hover:-translate-y-1.5 transition-all duration-300"
                    >
                      {/* Top-left badge: only shown when NOT available — no "Beschikbaar" label on available units */}
                      {(() => {
                        const unitIds = unitIdsByBase[getBaseName(machine.name)] ?? [machine.id];
                        const available = isModelAvailableThisWeek(unitIds);
                        if (available) return null;
                        const nextDate = getNextAvailableDate(unitIds);
                        const availText = nextDate ? `Vrij ${formatShortDate(nextDate)}` : "Vol geboekt";
                        return (
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[10px] font-bold shadow-sm backdrop-blur-sm bg-white/90 border border-amber-200 text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-amber-400" />
                            {availText}
                          </div>
                        );
                      })()}

                      {/* IMAGE with powerType overlay — clickable to open detail modal */}
                      <div
                        className="relative aspect-[3/2] w-full overflow-hidden bg-white cursor-pointer"
                        onClick={() => {
                          setSelectedDetailMachine(machine);
                          setDetailSource("pricing");
                          onAddSystemLog?.("system", currentUser?.name ?? "Gast", `Bekijkt specificaties: "${machine.name}"`);
                        }}
                      >
                        <CardBrandWatermark />
                        <CardImage
                          src={machine.imageUrl || (machine.additionalImages?.[0] ?? "/placeholder-machine.webp")}
                          alt={machine.imageAlt}
                          additional={machine.additionalImages?.[0]}
                        />
                        {/* Power type only — machine name/category already shown below the image, no overlay duplicate */}
                        <div className="absolute bottom-0 right-0 px-3 py-2">
                          <span className="text-[10px] font-semibold text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">
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
                      <div className="p-5 flex flex-col gap-3 flex-1">

                        {/* Name + Price */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-bold text-[15px] text-slate-900 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors duration-200">
                              <Link to={`/hoogwerker/${machine.id}`} className="hover:underline">
                                {getBaseName(machine.name)}
                              </Link>
                            </h3>
                            {(() => {
                              const unitIds = unitIdsByBase[getBaseName(machine.name)] ?? [machine.id];
                              const r = ratingForUnits(unitIds);
                              if (!r) return null;
                              return (
                                <div className="flex items-center gap-1 mt-1" aria-label={`${r.average.toFixed(1)} van 5 sterren, ${r.count} beoordelingen`}>
                                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                  <span className="text-xs font-bold text-slate-700">{r.average.toFixed(1)}</span>
                                  <span className="text-[11px] text-slate-400">({r.count})</span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="text-right shrink-0">
                            {machine.oneDayPrice && machine.oneDayPrice < machine.pricePerDay ? (
                              <>
                                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5">Dagactie</span>
                                <div className="text-xl font-display font-black leading-none text-amber-600 mt-1">
                                  {formatPrice(vp(machine.oneDayPrice))}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  <span className="line-through">{formatPrice(vp(machine.pricePerDay))}</span> per dag {vatLabel}
                                </div>
                              </>
                            ) : machine.weeklyPrice && machine.minRentalDays && machine.minRentalDays >= 2 ? (
                              <>
                                <div className="text-xl font-display font-black leading-none text-slate-900">
                                  {formatPrice(vp(machine.weeklyPrice))}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">per week {vatLabel}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-xl font-display font-black leading-none text-slate-900">
                                  {formatPrice(vp(machine.pricePerDay))}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">per dag {vatLabel}</div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Tarieven — visually upgraded: amber gradient + shimmer when discounts exist */}
                        {(() => {
                          const d = computeDiscounts(machine);
                          const hasCampaign = !!(machine.campaignDiscountPercent && machine.campaignDiscountPercent > 0);
                          const hasWeekly = d.weekly > 0;
                          const hasMonthly = d.monthly > 0;
                          const hasAnyDiscount = hasWeekly || hasMonthly || hasCampaign;
                          const badgeLabel = hasCampaign
                            ? `-${machine.campaignDiscountPercent}% actie`
                            : hasWeekly
                            ? `-${d.weekly}%/week`
                            : hasMonthly
                            ? `-${d.monthly}%/maand`
                            : null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPricingPreviewMachine(machine); }}
                              className={[
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer group relative overflow-hidden",
                                hasAnyDiscount
                                  ? "tarief-deal bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-amber-400/40 shadow-sm hover:from-amber-600 hover:to-orange-600"
                                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300",
                              ].join(" ")}
                            >
                              <span className="flex items-center gap-1.5 relative z-10 min-w-0">
                                <Tag className={`h-3 w-3 shrink-0 ${hasAnyDiscount ? "text-white/90" : "text-slate-400"}`} />
                                <span className="truncate">Alle tarieven &amp; kortingen</span>
                                {badgeLabel && (
                                  <span className="shrink-0 bg-white text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded leading-none whitespace-nowrap shadow-sm">
                                    {badgeLabel}
                                  </span>
                                )}
                              </span>
                              <ChevronRight className={`h-3.5 w-3.5 shrink-0 ml-1 group-hover:translate-x-0.5 transition-all relative z-10 ${hasAnyDiscount ? "text-white/80" : "text-slate-400 group-hover:text-slate-600"}`} />
                            </button>
                          );
                        })()}

                        {/* Spec + SuitableFor — single row */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-600 border-t border-slate-100 pt-2.5">
                          <span className="flex items-center gap-1 shrink-0" title="Werkhoogte">
                            <ArrowUpToLine className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                            <span className="font-bold text-slate-800">{machine.height}m</span>
                          </span>
                          {machine.reach > 0 && (
                            <span className="flex items-center gap-1 shrink-0" title="Uitreik">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                              {machine.reach}m
                            </span>
                          )}
                        </div>

                        {/* Campaign badge */}
                        {(machine.campaignText || machine.campaignDiscountPercent) && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg w-fit">
                            <Zap className="h-3 w-3 text-amber-500" />
                            {machine.campaignText || "Promo"}
                            {!!machine.campaignDiscountPercent && ` −${machine.campaignDiscountPercent}%`}
                          </div>
                        )}

                        {/* Action buttons — evenly split so the CTA reads as its own
                            button instead of a stretched block fused to the other one */}
                        <div className="flex gap-3 mt-auto pt-1.5">
                          <button
                            onClick={() => {
                              setSelectedDetailMachine(machine);
                              setDetailSource("info");
                              onAddSystemLog?.("system", currentUser?.name ?? "Gast", `Bekijkt specificaties: "${machine.name}"`);
                            }}
                            className="advice-btn flex-1 px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-[11px] font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer"
                          >
                            {t("btnSpecifications")}
                          </button>
                          <button
                            onClick={() => onSelectMachineForBooking(machine)}
                            className="cta-shine flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
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

      {/* Full detail modal — shared MachineDetailModal component */}
      <AnimatePresence>
        {selectedDetailMachine && (
          <MachineDetailModal
            machine={selectedDetailMachine}
            onClose={() => { setSelectedDetailMachine(null); setDetailSource("pricing"); }}
            onBook={(m) => { setSelectedDetailMachine(null); setDetailSource("pricing"); onSelectMachineForBooking(m); }}
            vatDisplay={vatDisplay}
            customCategories={customCategories}
            showPricing={detailSource === "pricing"}
          />
        )}
      </AnimatePresence>

      {/* ── PRICING PREVIEW MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {pricingPreviewMachine && (() => {
          const m = pricingPreviewMachine;
          const d = computeDiscounts(m);
          const vp = (n: number) => withVat(n, vatDisplay);
          const rows: { period: string; when: string; price: number; priceText?: string; badge?: string; highlight?: "fire" | "green" | "teal" | "violet" }[] = [];
          const minRental = m.minRentalDays ?? 1;

          if (m.weekendRulesEnabled) {
            // Tiered pricing model: distinct 1–5 day rates + per-day extra from day 6.
            // A rental that stays entirely within the closed weekend (single Sat, single
            // Sun, or Sat+Sun) gets the flat weekend package instead; every other
            // combination (incl. a Friday start or a longer Sat/Sun-start rental) is
            // priced by day count — the automatic Sunday block is explained below.
            if (minRental < 2) {
              const oneDayHasActie = !!(m.oneDayPrice && m.oneDayPrice < m.pricePerDay);
              rows.push({ period: oneDayHasActie ? "Dagactie" : "1 dag", when: "Ma – Vr", price: oneDayHasActie ? m.oneDayPrice! : m.pricePerDay, highlight: oneDayHasActie ? "fire" : undefined });
            }
            rows.push({ period: "2 dagen", when: "Doordeweeks", price: m.twoDayPrice ?? (m.pricePerDay * 2) });
            if (m.threeDayPrice ?? m.weeklyPrice) rows.push({ period: "3 dagen", when: "Doordeweeks", price: (m.threeDayPrice ?? m.weeklyPrice)! });
            if (m.fourDayPrice ?? m.weeklyPrice) rows.push({ period: "4 dagen", when: "Doordeweeks", price: (m.fourDayPrice ?? m.weeklyPrice)! });
            if (m.weeklyPrice) rows.push({ period: "5 dagen (werkweek)", when: "Ma – Vr", price: m.weeklyPrice, badge: d.weekly > 0 ? `−${d.weekly}%` : undefined, highlight: "green" });
            if (m.weeklyPrice) rows.push({ period: "Extra dag", when: "Vanaf dag 6, per dag", price: m.weeklyPrice / 5, priceText: `+ ${formatPrice(vp(m.weeklyPrice / 5))}` });
            if (m.weekendPrice) rows.push({ period: "Weekend", when: "Losse za, zo of za+zo · retour ma 08:00", price: m.weekendPrice, highlight: "violet" });
            if (m.monthlyPrice) rows.push({ period: "4 weken (28 dagen)", when: "Langlopend", price: m.monthlyPrice, badge: d.monthly > 0 ? `−${d.monthly}%` : undefined, highlight: "teal" });
          } else {
            // Legacy pricing display (non weekend-rules machines).
            if (minRental < 2) {
              const oneDayHasActie = !!(m.oneDayPrice && m.oneDayPrice < m.pricePerDay);
              rows.push({
                period: oneDayHasActie ? "Dagactie" : "1 dag",
                when: "Ma – Vr",
                price: oneDayHasActie ? m.oneDayPrice! : m.pricePerDay,
                highlight: oneDayHasActie ? "fire" : undefined,
              });
            }
            rows.push({ period: minRental >= 2 ? "2 dagen (min.)" : "2 dagen (doordeweeks)", when: "Ma – Do", price: m.twoDayPrice ?? (m.pricePerDay * 2) });
            if (m.weekendPrice) {
              rows.push({ period: "Weekend", when: "Za – Zo", price: m.weekendPrice, highlight: "violet" });
            }
            if (m.weeklyPrice) {
              rows.push({ period: "3–5 dagen (werkweek)", when: "Ma – Vr", price: m.weeklyPrice, badge: d.weekly > 0 ? `−${d.weekly}%` : undefined, highlight: "green" });
            }
            if (m.monthlyPrice) {
              rows.push({ period: "4 weken (28 dagen)", when: "Langlopend", price: m.monthlyPrice, badge: d.monthly > 0 ? `−${d.monthly}%` : undefined, highlight: "teal" });
            }
          }

          return (
            <motion.div
              key="pricing-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-0.5">{m.categoryLabel}</p>
                    <h3 className="font-display font-black text-slate-900 text-base leading-snug">{m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dagtarief <span className="font-bold text-slate-800">{formatPrice(vp(m.pricePerDay))}</span> <span className="text-slate-400">{vatLabel}</span>
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
                        row.highlight === "violet" ? "bg-amber-50" : "bg-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${
                          row.highlight === "fire" ? "text-amber-700" :
                          row.highlight === "green" ? "text-emerald-700" :
                          row.highlight === "teal" ? "text-teal-700" :
                          row.highlight === "violet" ? "text-amber-700" : "text-slate-800"
                        }`}>{row.period}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{row.when}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.badge && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                            row.highlight === "green" ? "bg-emerald-100 text-emerald-700" : "bg-teal-100 text-teal-700"
                          }`}>{row.badge}</span>
                        )}
                        {row.highlight === "fire" && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Actie</span>
                        )}
                        <span className={`font-mono font-extrabold text-sm ${
                          row.highlight === "fire" ? "text-amber-700" :
                          row.highlight === "green" ? "text-emerald-700" :
                          row.highlight === "teal" ? "text-teal-700" :
                          row.highlight === "violet" ? "text-amber-700" : "text-slate-900"
                        }`}>{row.priceText ?? formatPrice(vp(row.price))}</span>
                      </div>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div className="px-5 py-6 text-center text-xs text-slate-400">Alleen dagprijs beschikbaar</div>
                  )}
                  {m.weekendRulesEnabled && (
                    <div className="px-5 py-3 bg-amber-100/70">
                      <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-amber-900 leading-snug">
                            Alleen za, zo of za+zo? Vast weekendtarief. Langer (of vanaf vrijdag)? Gewoon dagtarief.
                          </p>
                          {m.sundayBlockFee ? (
                            <p className="text-xs font-bold text-amber-900 leading-snug">
                              Huur t/m zaterdag? +{formatPrice(vp(m.sundayBlockFee))} zondagblokkade, retour ma 08:00.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
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
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <ShoppingCart className="h-4 w-4" />
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
