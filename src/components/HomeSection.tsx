/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import {
  MessageCircle,
  Truck,
  Tractor,
  Scissors,
  MoveVertical,
  ArrowUpFromLine,
  Leaf,
  Columns2,
  Zap,
  type LucideProps
} from "lucide-react";
import { motion } from "motion/react";
import { buildWhatsAppGeneralUrl } from "../utils/whatsapp";
import { withVat } from "../utils/format";
import VatToggle from "./VatToggle";

type IconComponent = React.FC<LucideProps>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  aanhanger:    Truck,
  spin:         Tractor,
  schaarlift:   Scissors,
  mastlift:     MoveVertical,
  ladderlift:   ArrowUpFromLine,
  ecolift:      Leaf,
  kamersteiger: Columns2,
};

const bgClasses = [
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
  "from-white to-slate-50 border-slate-200",
];

interface HomeSectionProps {
  onSearch: (query: string, category: string) => void;
  setActiveTab: (tab: string) => void;
  siteConfig?: {
    siteName: string;
    heroTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    menuHomeLabel: string;
    menuCatalogLabel: string;
    menuOrdersLabel: string;
  };
  customCategories?: {
    id: string;
    label: string;
    listLabel?: string;
    desc: string;
    heights: string;
    price: string;
  }[];
}

const SKIP_IDS = new Set(["klussensets", "schaarlift-smal", "schaarlift-6m"]);

export default function HomeSection({
  onSearch,
  customCategories = [
    { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "", heights: "12m - 17m", price: "v.a. €80/dag" },
    { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "", heights: "15m - 17m", price: "v.a. €160/dag" },
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "", heights: "6m - 10m", price: "v.a. €65/dag" },
    { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "", heights: "5m - 10m", price: "v.a. €75/dag" },
    { id: "kamersteiger", label: "Kamersteiger", listLabel: "Kamersteigers", desc: "", heights: "4m", price: "v.a. €35/dag" },
    { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "", heights: "18m - 21m", price: "v.a. €90/dag" },
    { id: "ecolift", label: "Pecolift", listLabel: "Pecolift", desc: "", heights: "4.2m", price: "v.a. €45/dag" },
  ]
}: HomeSectionProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const machines = useAppStore((state) => state.machines);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const SCHAARLIFT_VARIANTS = new Set(["schaarlift", "schaarlift-smal", "schaarlift-6m"]);

  // Live minimum price per category (each schaarlift sub-type keeps its own key)
  const livePriceByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    machines.forEach(m => {
      const key = m.category;
      if (map[key] === undefined || m.pricePerDay < map[key]) map[key] = m.pricePerDay;
    });
    return map;
  }, [machines]);

  // First machine image per category for card thumbnails
  const imageByCategory = React.useMemo(() => {
    const map: Record<string, string> = {};
    machines.forEach(m => {
      if (!m.imageUrl) return;
      const key = SCHAARLIFT_VARIANTS.has(m.category) ? "schaarlift" : m.category;
      if (!map[key]) map[key] = m.imageUrl;
    });
    return map;
  }, [machines]);

  const HOME_ORDER = ["schaarlift", "spin", "mastlift", "kamersteiger", "ladderlift", "ecolift", "aanhanger"];

  const displayCategories = customCategories
    .filter(c => !SKIP_IDS.has(c.id))
    .map(c => c.id === "schaarlift"
      ? { ...c, label: "Schaarliften 6-8-10", listLabel: "Schaarliften 6-8-10", heights: "6 / 8 / 10 m", price: "v.a. €49/dag" }
      : c
    )
    .sort((a, b) => {
      const ai = HOME_ORDER.indexOf(a.id);
      const bi = HOME_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div>

      {/* ── HERO IMAGE — sade, metin yok ── */}
      <div
        className="relative bg-slate-900 bg-cover bg-center bg-no-repeat overflow-hidden min-h-[260px] sm:min-h-[400px] lg:min-h-[480px]"
        style={{ backgroundImage: "url('/hero-huurgo-v2.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      </div>

      {/* ── HERO TEXT + CTA — resmin altında beyaz alanda ── */}
      <div className="bg-white px-5 sm:px-6 pt-8 pb-6 text-center border-b border-slate-100">
        <div className="mx-auto max-w-lg space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600"
          >
            {t("heroTagline")}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.07 }}
            className="font-display text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight"
          >
            {language === "nl" && siteConfig.heroTitle ? siteConfig.heroTitle : t("heroTitle")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="text-sm text-slate-500 leading-relaxed"
          >
            {language === "nl" && siteConfig.heroSubtitle ? siteConfig.heroSubtitle : t("heroSubtitle")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="pt-2"
          >
            <a
              href={buildWhatsAppGeneralUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-3 w-full max-w-sm py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] no-underline"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span>Direct advies nodig? WhatsApp ons!</span>
            </a>
          </motion.div>
        </div>
      </div>

      {/* ── CAMPAIGN TICKER STRIP ── */}
      {(() => {
        const seen = new Set<string>();
        const campaignMachines = machines.filter(m =>
          (m.oneDayPrice && m.oneDayPrice < m.pricePerDay) || m.campaignText || m.campaignDiscountPercent
        ).filter(m => {
          const baseName = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
          if (seen.has(baseName)) return false;
          seen.add(baseName);
          return true;
        });

        if (campaignMachines.length === 0) return null;

        const doubled = [...campaignMachines, ...campaignMachines];

        return (
          <div className="bg-amber-50 border-y border-amber-100 py-2 overflow-hidden">
            <motion.div
              className="gap-4 whitespace-nowrap flex"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              {doubled.map((m, i) => {
                const baseName = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
                return (
                  <button
                    key={`${m.id}-${i}`}
                    type="button"
                    onClick={() => onSearch("", m.category)}
                    className="bg-white border border-amber-200 rounded-full px-3 py-1 text-[11px] font-bold text-amber-800 shrink-0 inline-flex items-center gap-1.5 shadow-sm hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                  >
                    <Zap className="h-3 w-3 text-amber-500" />
                    {baseName}
                    {m.oneDayPrice && m.oneDayPrice < m.pricePerDay && (
                      <span className="text-amber-500">1 dag €{withVat(m.oneDayPrice, vatDisplay) % 1 === 0 ? Math.round(withVat(m.oneDayPrice, vatDisplay)) : withVat(m.oneDayPrice, vatDisplay).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                    {m.campaignText && (
                      <span className="text-amber-500">{m.campaignText}</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </div>
        );
      })()}

      {/* ── CATEGORY CARDS ── */}
      <div className="bg-white px-4 sm:px-6 pt-6 pb-10">
        <div className="max-w-5xl mx-auto flex justify-end mb-3">
          <VatToggle />
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayCategories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Truck;
            const bg = bgClasses[i % bgClasses.length];
            const isLast = displayCategories.length % 2 !== 0 && i === displayCategories.length - 1;
            const catImage = imageByCategory[cat.id];

            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => onSearch("", cat.id)}
                className={`bg-gradient-to-br ${bg} border rounded-2xl overflow-hidden text-left cursor-pointer hover:shadow-md active:scale-[0.98] transition-all${isLast ? " col-span-2" : ""}`}
              >
                {catImage ? (
                  <div className={`relative overflow-hidden bg-slate-100 ${isLast ? "h-24 sm:h-28" : "h-20 sm:h-24"}`}>
                    <img
                      src={catImage}
                      alt={cat.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
                    />
                  </div>
                ) : (
                  <div className="px-4 pt-4 pb-0">
                    <div className="p-2 bg-white/70 rounded-xl w-fit">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                  </div>
                )}
                <div className="p-4 pt-3">
                  <p className="font-bold text-xs text-slate-800 leading-snug mb-3 line-clamp-2 min-h-[2.25rem]">
                    {cat.listLabel || cat.label}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Hoogte</p>
                      <p className="text-sm font-bold text-slate-700 leading-tight">{cat.heights}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">All-in</p>
                      <p className="text-sm font-extrabold text-emerald-600 leading-tight">
                        {livePriceByCategory[cat.id] !== undefined
                          ? `v.a. €${(() => { const v = withVat(livePriceByCategory[cat.id], vatDisplay); return v % 1 === 0 ? Math.round(v).toLocaleString("nl-NL") : v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })()}/dag`
                          : cat.price}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
