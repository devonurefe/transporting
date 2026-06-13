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

// Per-model extra specs (platformhoogte, draagvermogen, afmeting, breedte etc.)
// Unit variants (-1/-2/-3 suffix) fall back to the base key via getExtraSpecs().
const MACHINE_SPECS: Record<string, Array<{ label: string; value: string }>> = {
  "nifty-120": [
    { label: "Platformhoogte",    value: "10,2 m" },
    { label: "Platformafmeting",  value: "76 × 163 cm" },
    { label: "Draagvermogen",     value: "200 kg (2 pers.)" },
    { label: "Transportbreedte",  value: "159 cm" },
    { label: "Transportlengte",   value: "468 cm" },
    { label: "Transporthoogte",   value: "180 cm" },
    { label: "Kogelgewicht",      value: "ca. 75 kg" },
    { label: "Rijbewijs",         value: "Categorie B vereist" },
    { label: "Opsteltijd",        value: "± 5 min" },
    { label: "Stroomopname",      value: "230 V / accu" },
  ],
  "nifty-170": [
    { label: "Platformhoogte",      value: "15,1 m" },
    { label: "Platformafmeting",    value: "76 × 163 cm" },
    { label: "Draagvermogen",       value: "200 kg (2 pers.)" },
    { label: "Transportbreedte",    value: "179 cm" },
    { label: "Transporthoogte",     value: "ca. 190 cm" },
    { label: "Rijbewijs",           value: "Categorie B vereist" },
    { label: "Opsteltijd",          value: "± 10 min" },
    { label: "Aandrijving rijden",  value: "Diesel + elektrisch" },
  ],
  "hinowa-15-70": [
    { label: "Platformhoogte",          value: "13,4 m" },
    { label: "Platformafmeting",        value: "70 × 120 cm" },
    { label: "Draagvermogen",           value: "200 kg (2 pers.)" },
    { label: "Rupsbreedte",             value: "79 cm (59 cm ingetrokken)" },
    { label: "Min. poortbreedte",       value: "60 cm" },
    { label: "Max. helling (rijden)",   value: "25°" },
    { label: "Stabilisatoren",          value: "4× automatisch" },
    { label: "Rijden in geheven stand", value: "Niet toegestaan" },
  ],
  "hinowa-17-75": [
    { label: "Platformhoogte",          value: "15,06 m" },
    { label: "Platformafmeting",        value: "70 × 120 cm" },
    { label: "Draagvermogen",           value: "200 kg (2 pers.)" },
    { label: "Rupsbreedte",             value: "89 cm" },
    { label: "Min. poortbreedte",       value: "90 cm" },
    { label: "Max. helling (rijden)",   value: "20°" },
    { label: "Stabilisatoren",          value: "4× automatisch" },
    { label: "Rijden in geheven stand", value: "Niet toegestaan" },
  ],
  "optimum-8": [
    { label: "Platformhoogte",     value: "5,76 m" },
    { label: "Platformafmeting",   value: "136 × 69 cm (uitschuif: 256 × 69 cm)" },
    { label: "Draagvermogen",      value: "230 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "76 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Max. helling",       value: "25 %" },
  ],
  "compact-8": [
    { label: "Platformhoogte",     value: "6,17 m" },
    { label: "Platformafmeting",   value: "165 × 76 cm (uitschuif: 265 × 76 cm)" },
    { label: "Draagvermogen",      value: "230 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "82 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Max. helling",       value: "25 %" },
  ],
  "compact-10n": [
    { label: "Platformhoogte",     value: "7,96 m" },
    { label: "Platformafmeting",   value: "126 × 81 cm (uitschuif: 251 × 81 cm)" },
    { label: "Draagvermogen",      value: "450 kg (2 pers.)" },
    { label: "Machinebreedte",     value: "81 cm" },
    { label: "Accu",               value: "4 × 6 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "81 cm breed" },
  ],
  "dingli-6m": [
    { label: "Platformhoogte",     value: "4,0 m" },
    { label: "Platformafmeting",   value: "74 × 60 cm" },
    { label: "Draagvermogen",      value: "230 kg" },
    { label: "Machinebreedte",     value: "74 cm" },
    { label: "Accu",               value: "2 × 12 V / 24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Min. deuropening",   value: "74 cm breed" },
  ],
  "altrex-rs44": [
    { label: "Platformhoogte",   value: "2,0 m" },
    { label: "Platformafmeting", value: "ca. 135 × 60 cm" },
    { label: "Draagvermogen",    value: "200 kg" },
    { label: "Machinebreedte",   value: "75 cm" },
    { label: "Materiaal",        value: "Aluminium" },
    { label: "Wielen",           value: "4× met vergrendeling" },
    { label: "Montagetijd",      value: "± 5 min" },
    { label: "Norm",             value: "NEN-EN 1004" },
  ],
  "star-10": [
    { label: "Platformhoogte",     value: "8,0 m" },
    { label: "Platformafmeting",   value: "80 × 120 cm" },
    { label: "Draagvermogen",      value: "230 kg (1 pers.)" },
    { label: "Machinebreedte",     value: "78 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Draairadius",        value: "0 cm (zero-radius)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "skyjack-sj16": [
    { label: "Platformhoogte",     value: "4,6 m" },
    { label: "Platformafmeting",   value: "74 × 76 cm" },
    { label: "Draagvermogen",      value: "136 kg (1 pers.)" },
    { label: "Machinebreedte",     value: "74 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Draairadius",        value: "0 cm (zero-radius)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "bravi-mini-hd": [
    { label: "Platformhoogte",     value: "2,9 m" },
    { label: "Platformafmeting",   value: "70 × 70 cm" },
    { label: "Draagvermogen",      value: "200 kg" },
    { label: "Machinebreedte",     value: "69 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Min. deuropening",   value: "69 cm breed" },
    { label: "Liftvriendelijk",    value: "Ja (smal profiel)" },
    { label: "Non-marking banden", value: "Ja" },
  ],
  "jlg-1230es": [
    { label: "Platformhoogte",     value: "3,65 m (12 ft)" },
    { label: "Platformafmeting",   value: "76 × 68 cm" },
    { label: "Draagvermogen",      value: "227 kg" },
    { label: "Machinebreedte",     value: "76 cm" },
    { label: "Accu",               value: "24 V" },
    { label: "Non-marking banden", value: "Ja" },
    { label: "Rijden geheven",     value: "Niet toegestaan" },
  ],
  "ladderlift-18": [
    { label: "Max. belasting",    value: "200 kg (goederen)" },
    { label: "Bandenbreedte",     value: "ca. 40 cm" },
    { label: "Transportsnelheid", value: "ca. 0,4 m/s" },
    { label: "Stroomvereiste",    value: "230 V / 16 A" },
    { label: "Personentransport", value: "Niet toegestaan" },
    { label: "Opsteltijd",        value: "± 15 min" },
    { label: "Bereik (etages)",   value: "t/m ca. 5e verdieping" },
  ],
  "ladderlift-21": [
    { label: "Max. belasting",    value: "250 kg (goederen)" },
    { label: "Bandenbreedte",     value: "ca. 40 cm" },
    { label: "Transportsnelheid", value: "ca. 0,5 m/s" },
    { label: "Stroomvereiste",    value: "230 V / 16 A" },
    { label: "Personentransport", value: "Niet toegestaan" },
    { label: "Opsteltijd",        value: "± 20 min" },
    { label: "Bereik (etages)",   value: "t/m ca. 7e verdieping" },
  ],
  "ecolift": [
    { label: "Platformhoogte",   value: "2,2 m" },
    { label: "Platformafmeting", value: "65 × 65 cm" },
    { label: "Draagvermogen",    value: "150 kg (incl. persoon)" },
    { label: "Machinebreedte",   value: "69 cm" },
    { label: "Bediening",        value: "Handmatig (zwengel)" },
    { label: "Energiebron",      value: "Geen (geen accu / stroom)" },
    { label: "Min. deuropening", value: "70 cm breed" },
    { label: "Norm",             value: "CE gecertificeerd" },
  ],
};

// Look up extra specs: machine.specs (admin-edited) takes priority, then hardcoded fallback.
function getExtraSpecs(id: string, machineSpecs?: unknown): Array<{ label: string; value: string }> {
  if (Array.isArray(machineSpecs) && machineSpecs.length > 0) return machineSpecs as Array<{ label: string; value: string }>;
  return MACHINE_SPECS[id] ?? MACHINE_SPECS[id.replace(/-[123]$/, "")] ?? [];
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

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
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

                      {/* Top-right: compare checkbox */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 z-20"
                      >
                        <label className="flex items-center gap-1 bg-white/90 backdrop-blur border border-slate-200 px-2 py-1 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors duration-200 shadow-sm">
                          <input
                            id={`compare-${machine.id}`}
                            type="checkbox"
                            checked={compareIds.includes(machine.id)}
                            onChange={(e) => {
                              if (e.target.checked && compareIds.length < 4) {
                                setCompareIds(prev => [...prev, machine.id]);
                              } else {
                                setCompareIds(prev => prev.filter(id => id !== machine.id));
                              }
                            }}
                            className="h-3 w-3 accent-indigo-600 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold text-slate-700 select-none">Vergelijk</span>
                        </label>
                      </div>

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

                        {/* Tarieven — colorful rate pills */}
                        {(machine.weekendPrice || machine.weeklyPrice || machine.monthlyPrice) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {machine.weekendPrice && (
                              <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md">
                                wknd <span className="font-extrabold">€{formatPrice(vp(machine.weekendPrice))}</span>
                              </span>
                            )}
                            {machine.weeklyPrice && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                week <span className="font-extrabold">€{formatPrice(vp(machine.weeklyPrice))}</span>
                              </span>
                            )}
                            {machine.monthlyPrice && (
                              <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                                maand <span className="font-extrabold">€{formatPrice(vp(machine.monthlyPrice))}</span>
                              </span>
                            )}
                          </div>
                        )}

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

      {/* Sticky floating 'Vergelijk Machines' bar */}
      <AnimatePresence>
        {compareIds.length >= 2 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-white border border-slate-200 shadow-xl rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4"
          >
            <div className="flex items-center space-x-3 w-full sm:w-auto overflow-x-auto py-1 scrollbar-none">
              <div className="bg-indigo-50 p-2 rounded-xl shrink-0 animate-pulse">
                <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="shrink-0">
                <h4 className="text-xs font-bold text-slate-900">Vergelijk Machines</h4>
                <p className="text-[10px] text-slate-500 font-mono">{compareIds.length} geselecteerd (max 4)</p>
              </div>
              
              {/* Small horizontal preview grid */}
              <div className="flex items-center space-x-2 pl-2">
                {compareIds.map(id => {
                  const m = machines.find(item => item.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="relative group/thumb shrink-0">
                      <img 
                        src={m.imageUrl} 
                        alt={m.name} 
                        className="h-8 w-12 object-cover rounded-md border border-slate-200" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-machine.webp";
                        }}
                      />
                      <button
                        onClick={() => setCompareIds(compareIds.filter(cid => cid !== id))}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 transition-colors cursor-pointer z-10"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => setCompareIds([])}
                className="px-4 py-2 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer transition-colors"
              >
                Wissen
              </button>

              <button
                onClick={() => setShowCompareModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition-all cursor-pointer text-white flex items-center justify-center space-x-1.5"
              >
                <span>Vergelijk Nu</span>
                <ArrowRightLeft className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal Overlay */}
      <AnimatePresence>
        {showCompareModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCompareModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh] my-8"
            >
              {/* Top bar stripe */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500" />

              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <span className="text-[10px] text-indigo-600 font-mono uppercase tracking-wider block font-bold">Zij-aan-zij Vergelijking</span>
                  <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">Vloot Specificatievergelijker</h3>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable grid Table container */}
              <div className="overflow-x-auto flex-1 pb-4 scrollbar-thin scrollbar-thumb-white/10">
                <div className="min-w-[640px] divide-y divide-white/5 space-y-4">
                  {/* Header cards row */}
                  <div className="grid grid-cols-5 gap-4 pb-4">
                    <div className="col-span-1 flex flex-col justify-end">
                      <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">Eigenschappen</p>
                    </div>

                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      if (!m) return <div key={id} className="col-span-1" />;
                      return (
                        <div key={id} className="col-span-1 bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between space-y-3 relative group">
                          <button
                            onClick={() => setCompareIds(compareIds.filter(cid => cid !== id))}
                            className="absolute top-2 right-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg p-1 transition-colors z-20 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-200">
                            <img 
                              src={m.imageUrl} 
                              alt={m.name} 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-machine.webp";
                              }}
                            />
                          </div>

                          <div>
                            <h4 className="font-sans font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                              {m.name}
                            </h4>
                            <span className="text-[9px] font-mono text-indigo-600 block mt-1 uppercase tracking-wider">{m.categoryLabel}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pad remaining empty slots up to 4 columns */}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="col-span-1 border border-dashed border-white/5 bg-white/2 rounded-2xl flex flex-col items-center justify-center p-4 min-h-[140px]">
                        <p className="text-[10.5px] text-slate-500 font-mono text-center">Selecteer nog een machine...</p>
                      </div>
                    ))}
                  </div>

                  {/* Row 1: Werkhoogte */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <ArrowUpToLine className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>Werkhoogte</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.height} meter` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-h-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 2: Zijdelings Bereik */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <ArrowRightLeft className="h-4 w-4 text-teal-400 shrink-0" />
                      <span>Zijdelings Bereik</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.reach} meter` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-r-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 3: Machinegewicht */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <Weight className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Machinegewicht</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.weight.toLocaleString('nl-NL')} kg` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-w-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 4: Aandrijving */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Aandrijving</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-bold text-slate-300 text-center sm:text-left">
                          {m ? m.powerType : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-p-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 5: Geschikt voor */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-start text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Geschikt voor</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 flex flex-wrap gap-1">
                          {m ? m.suitableFor.map((app, idx2) => {
                            const AppIcon = professionIconMap[app];
                            return (
                              <span key={idx2} className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[10px] text-indigo-200">
                                {AppIcon && <AppIcon className="h-3 w-3 shrink-0" />}
                                {app}
                              </span>
                            );
                          }) : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-s-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 6: Tarief per dag */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <span className="font-mono font-black text-teal-400 text-sm">€</span>
                      <span>Tarief / dag</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-extrabold text-[#14b8a6] text-sm text-center sm:text-left">
                          {m ? `€ ${formatPrice(vp(m.pricePerDay))}` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-t-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 7: Direct Boeken */}
                  <div className="grid grid-cols-5 gap-4 py-4 items-center">
                    <div className="col-span-1" />
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      if (!m) return <div key={id} className="col-span-1" />;
                      return (
                        <div key={id} className="col-span-1">
                          <button
                            onClick={() => {
                              setShowCompareModal(false);
                              onSelectMachineForBooking(m);
                            }}
                            className="w-full relative overflow-hidden flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-center"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 text-teal-300" />
                            <span>Direct Boeken</span>
                          </button>
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-b-${idx}`} className="col-span-1 font-mono text-slate-600">—</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer warning */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500 text-[10px] uppercase font-mono tracking-wider shrink-0 mt-2">
                <span>BMWT-Veiligheidsgids 2026 - Hub inspectie inbegrepen</span>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold tracking-normal uppercase transition-colors cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                    {/* B — Prijs & Boeken */}
                    <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Dagtarief</p>
                          <p className="text-3xl font-mono font-extrabold text-slate-900 leading-none">
                            €{formatPrice(vp(selectedDetailMachine.pricePerDay))}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{vatDisplay === "incl" ? "incl. BTW" : "excl. BTW"} per dag</p>
                          {selectedDetailMachine.oneDayPrice && selectedDetailMachine.oneDayPrice < selectedDetailMachine.pricePerDay && (
                            <p className="text-[10px] font-bold text-amber-600 mt-1">
                              1 dag actie: €{formatPrice(vp(selectedDetailMachine.oneDayPrice))}
                            </p>
                          )}
                        </div>
                        <VatToggle size="xs" />
                      </div>
                      {(() => { const d = computeDiscounts(selectedDetailMachine); return (d.weekly > 0 || d.monthly > 0) ? (
                        <div className="flex gap-2 flex-wrap">
                          {d.weekly > 0 && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                              werkweek −{d.weekly}%
                            </span>
                          )}
                          {d.monthly > 0 && (
                            <span className="text-xs font-bold text-teal-700 bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-full">
                              4 weken −{d.monthly}%
                            </span>
                          )}
                        </div>
                      ) : null; })()}
                      {/* Tarieventabel — alle ingestelde flattarieven */}
                      {(selectedDetailMachine.oneDayPrice || selectedDetailMachine.twoDayPrice || selectedDetailMachine.weekendPrice || selectedDetailMachine.weeklyPrice || selectedDetailMachine.monthlyPrice) && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-[10px]">
                          {selectedDetailMachine.oneDayPrice && selectedDetailMachine.oneDayPrice < selectedDetailMachine.pricePerDay && (
                            <div className="flex items-center px-3 py-1.5 bg-amber-50 border-b border-amber-100">
                              <span className="text-amber-700 font-bold flex-1">1 dag actie</span>
                              <span className="font-mono font-extrabold text-amber-700">€{formatPrice(vp(selectedDetailMachine.oneDayPrice))}</span>
                            </div>
                          )}
                          {selectedDetailMachine.twoDayPrice && (
                            <div className="flex items-center px-3 py-1.5 bg-white border-b border-slate-100">
                              <span className="text-slate-600 flex-1">2 dagen (doordeweeks)</span>
                              <span className="font-mono font-bold text-slate-800">€{formatPrice(vp(selectedDetailMachine.twoDayPrice))}</span>
                            </div>
                          )}
                          {selectedDetailMachine.weekendPrice && (
                            <div className="flex items-center px-3 py-1.5 bg-white border-b border-slate-100">
                              <span className="text-slate-600 flex-1">Weekend (2–3 dagen)</span>
                              <span className="font-mono font-bold text-slate-800">€{formatPrice(vp(selectedDetailMachine.weekendPrice))}</span>
                            </div>
                          )}
                          {selectedDetailMachine.weeklyPrice && (() => { const d = computeDiscounts(selectedDetailMachine); return (
                            <div className="flex items-center px-3 py-1.5 bg-emerald-50 border-b border-emerald-100">
                              <span className="text-emerald-700 font-semibold flex-1">Werkweek (5 dagen)</span>
                              {d.weekly > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full mr-2">−{d.weekly}%</span>}
                              <span className="font-mono font-extrabold text-emerald-700">€{formatPrice(vp(selectedDetailMachine.weeklyPrice))}</span>
                            </div>
                          ); })()}
                          {selectedDetailMachine.monthlyPrice && (() => { const d = computeDiscounts(selectedDetailMachine); return (
                            <div className="flex items-center px-3 py-1.5 bg-teal-50">
                              <span className="text-teal-700 font-semibold flex-1">4 weken (28 dagen)</span>
                              {d.monthly > 0 && <span className="text-[9px] font-bold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full mr-2">−{d.monthly}%</span>}
                              <span className="font-mono font-extrabold text-teal-700">€{formatPrice(vp(selectedDetailMachine.monthlyPrice))}</span>
                            </div>
                          ); })()}
                        </div>
                      )}

                      {selectedDetailMachine.campaignText && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl w-fit">
                          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {selectedDetailMachine.campaignText}
                          {selectedDetailMachine.campaignDiscountPercent ? ` −${selectedDetailMachine.campaignDiscountPercent}%` : ""}
                        </div>
                      )}
                      <button
                        onClick={() => { setSelectedDetailMachine(null); onSelectMachineForBooking(selectedDetailMachine); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        {t("btnRentNow")}
                      </button>
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
              <div className="pt-4 border-t border-slate-200 flex justify-end shrink-0 mt-3">
                <button
                  onClick={() => setSelectedDetailMachine(null)}
                  className="px-5 py-2 hover:bg-slate-100 bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Sluiten
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
