import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine } from "../types";
import { categoryIconMap } from "./icons/CategoryIcons";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import { checkAvailability } from "../utils/availability";
import { withVat } from "../utils/format";
import { computeDiscounts } from "../utils/pricing";
import VatToggle from "./VatToggle";
import MachineDetailModal from "./MachineDetailModal";


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

  // Renders the € sign joined to the number so every price on the catalog
  // (day rate, actie, tariff table) reads consistently — "€60,50".
  const formatPrice = (p: number): string =>
    "€" + (p % 1 === 0
      ? Math.round(p).toLocaleString("nl-NL")
      : p.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const formatShortDate = (iso: string): string => {
    const d = new Date(iso);
    const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);
  const [detailSource, setDetailSource] = useState<"pricing" | "info">("pricing");
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

  // Only show active machines everywhere in the catalog
  const activeMachines = useMemo(() => machines.filter(m => m.isActive !== false), [machines]);

  // Count total physical units per base model name (active only)
  const stockCountByBase = useMemo(() => {
    const counts: Record<string, number> = {};
    activeMachines.forEach(m => {
      const base = getBaseName(m.name);
      counts[base] = (counts[base] || 0) + 1;
    });
    return counts;
  }, [activeMachines]);

  // Map base name → all unit IDs (used by BookingSection for auto-assignment)
  const unitIdsByBase = useMemo(() => {
    const map: Record<string, string[]> = {};
    activeMachines.forEach(m => {
      const base = getBaseName(m.name);
      if (!map[base]) map[base] = [];
      map[base].push(m.id);
    });
    return map;
  }, [activeMachines]);

  // Filtered Machines — category + search only, deduplicated to show ONE card per model
  const filteredMachines = useMemo(() => {
    const filtered = activeMachines.filter((machine) => {
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
  }, [activeMachines, selectedCategory, searchQuery]);

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
          <nav aria-label="Categorie filter" className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pr-7 sm:pr-0">
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
                      ? "bg-slate-800 text-white border-slate-900 shadow-sm"
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
          {/* Scroll affordance: fade + chevron hint on mobile (hidden once the
              row fits, i.e. on sm+ where all tabs are visible) */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center pl-6 pr-1 bg-gradient-to-l from-white via-white to-transparent sm:hidden">
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
          </div>

          {/* Row 2: Search + VAT display toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-2 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-colors">
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
                      className="group relative overflow-hidden rounded-2xl border bg-white flex flex-col border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                    >
                      {/* Top-left badge: Availability + optional stock count */}
                      {(() => {
                        const stock = stockCountByBase[getBaseName(machine.name)] ?? 1;
                        const available = isMachineAvailableThisWeek(machine.id);
                        const nextDate = !available ? getNextAvailableDate(machine.id) : null;
                        const availText = available ? "Beschikbaar" : nextDate ? `Vrij ${formatShortDate(nextDate)}` : "Vol geboekt";
                        return (
                          <div className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[10px] font-bold shadow-sm backdrop-blur-sm ${
                            available
                              ? "bg-slate-900/80 text-white"
                              : "bg-white/90 border border-amber-200 text-amber-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${available ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {availText}
                            {stock > 1 && (
                              <span className={`font-black pl-0.5 ${available ? "text-emerald-300" : "text-amber-600"}`}>· {stock}×</span>
                            )}
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
                              {getBaseName(machine.name)}
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            {machine.oneDayPrice && machine.oneDayPrice < machine.pricePerDay ? (
                              <>
                                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5">Dagactie</span>
                                <div className="text-xl font-display font-black leading-none text-amber-600 mt-1">
                                  {formatPrice(vp(machine.oneDayPrice))}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  <span className="line-through">{formatPrice(vp(machine.pricePerDay))}</span> per dag {vatLabel}
                                </div>
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

                        {/* Tarieven — single button replacing pills */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPricingPreviewMachine(machine); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-600 text-[11px] font-semibold transition-all cursor-pointer group"
                        >
                          <span className="flex items-center gap-1.5">
                            <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                            Alle tarieven &amp; kortingen
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                        </button>

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
                          <span className="text-slate-300 select-none shrink-0">·</span>
                          {(machine.suitableFor ?? []).length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">Algemeen gebruik</span>
                          )}
                          {(machine.suitableFor ?? []).slice(0, 2).map((prof) => (
                            <span
                              key={prof}
                              className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 px-2 py-0.5 rounded-full transition-colors duration-150 cursor-default select-none"
                            >
                              {prof}
                            </span>
                          ))}
                        </div>

                        {/* Campaign badge */}
                        {(machine.campaignText || machine.campaignDiscountPercent) && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg w-fit">
                            <Zap className="h-3 w-3 text-amber-500" />
                            {machine.campaignText || "Promo"}
                            {!!machine.campaignDiscountPercent && ` −${machine.campaignDiscountPercent}%`}
                          </div>
                        )}

                        {/* Action buttons — primary CTA is dominant */}
                        <div className="flex gap-2 mt-auto pt-1.5">
                          <button
                            onClick={() => {
                              setSelectedDetailMachine(machine);
                              setDetailSource("info");
                              onAddSystemLog?.("system", currentUser?.name ?? "Gast", `Bekijkt specificaties: "${machine.name}"`);
                            }}
                            className="advice-btn flex-none px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-[11px] font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer"
                          >
                            {t("btnSpecifications")}
                          </button>
                          <button
                            onClick={() => onSelectMachineForBooking(machine)}
                            className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
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
          const rows: { period: string; when: string; price: number; badge?: string; highlight?: "fire" | "green" | "teal" | "violet" }[] = [];

          // 1 dag: always first row; actie highlight only when cheaper than day rate
          const oneDayHasActie = !!(m.oneDayPrice && m.oneDayPrice < m.pricePerDay);
          rows.push({
            period: oneDayHasActie ? "Dagactie" : "1 dag",
            when: "Ma – Vr",
            price: oneDayHasActie ? m.oneDayPrice! : m.pricePerDay,
            highlight: oneDayHasActie ? "fire" : undefined,
          });
          // Always show 2-day: use twoDayPrice if set, otherwise pricePerDay × 2
          rows.push({ period: "2 dagen (doordeweeks)", when: "Ma – Do", price: m.twoDayPrice ?? (m.pricePerDay * 2) });
          if (m.weekendPrice) {
            rows.push({ period: "Weekend", when: "Za – Zo", price: m.weekendPrice, highlight: "violet" });
          }
          if (m.weeklyPrice) {
            rows.push({ period: "3–5 dagen (werkweek)", when: "Ma – Vr", price: m.weeklyPrice, badge: d.weekly > 0 ? `−${d.weekly}%` : undefined, highlight: "green" });
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
                        }`}>{formatPrice(vp(row.price))}</span>
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
