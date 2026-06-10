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
  type LucideProps
} from "lucide-react";
import { motion } from "motion/react";
import { buildWhatsAppGeneralUrl } from "../utils/whatsapp";

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
  "from-blue-50 to-indigo-100 border-blue-100",
  "from-amber-50 to-orange-100 border-amber-100",
  "from-rose-50 to-pink-100 border-rose-100",
  "from-teal-50 to-emerald-100 border-teal-100",
  "from-cyan-50 to-blue-100 border-cyan-100",
  "from-violet-50 to-purple-100 border-violet-100",
  "from-emerald-50 to-green-100 border-emerald-100",
  "from-orange-50 to-amber-100 border-orange-100",
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
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const HOME_ORDER = ["schaarlift", "spin", "mastlift", "kamersteiger", "ladderlift", "ecolift", "aanhanger"];

  const displayCategories = customCategories
    .filter(c => !SKIP_IDS.has(c.id))
    .map(c => c.id === "schaarlift"
      ? { ...c, label: "Schaarliften", listLabel: "Schaarliften", heights: "6m - 10m", price: "v.a. €65/dag" }
      : c
    )
    .sort((a, b) => {
      const ai = HOME_ORDER.indexOf(a.id);
      const bi = HOME_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div>

      {/* ── HERO — tekst + CTA op afbeelding ── */}
      <div
        className="relative bg-slate-900 bg-cover bg-center bg-no-repeat overflow-hidden flex flex-col justify-end px-5 sm:px-6 lg:px-8 pb-10 sm:pb-14 min-h-[420px] sm:min-h-[500px]"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-800/25 to-slate-900/80 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3 sm:space-y-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              {t("heroTagline")}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
              {language === "nl" && siteConfig.heroTitle ? siteConfig.heroTitle : t("heroTitle")}
            </h1>
            <p className="text-sm sm:text-base text-slate-200 max-w-lg mx-auto leading-relaxed">
              {language === "nl" && siteConfig.heroSubtitle ? siteConfig.heroSubtitle : t("heroSubtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-7"
          >
            <a
              href={buildWhatsAppGeneralUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-3 w-full max-w-sm mx-auto py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] no-underline"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span>Direct advies nodig? WhatsApp ons!</span>
            </a>
          </motion.div>

          <p className="text-center text-[10px] text-white/40 font-mono mt-5">
            Zoeterwoude · TÜV / BMWT Gecertificeerd · Zelf ophalen of bezorgen
          </p>
        </div>
      </div>

      {/* ── CATEGORY CARDS ── */}
      <div className="bg-white px-4 sm:px-6 pt-6 pb-10">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3">
          {displayCategories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Truck;
            const bg = bgClasses[i % bgClasses.length];
            const isLast = displayCategories.length % 2 !== 0 && i === displayCategories.length - 1;

            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => onSearch("", cat.id)}
                className={`bg-gradient-to-br ${bg} border rounded-2xl p-4 text-left cursor-pointer hover:shadow-md active:scale-[0.98] transition-all${isLast ? " col-span-2" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/70 rounded-xl">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
                <p className="font-bold text-[12px] text-slate-800 leading-snug mb-3 line-clamp-2">
                  {cat.listLabel || cat.label}
                </p>
                <div className="space-y-1.5 mt-auto">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 w-10 shrink-0">Hoogte</p>
                    <p className="text-sm font-bold text-slate-700">{cat.heights}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 w-10 shrink-0">All-in</p>
                    <p className="text-sm font-extrabold text-emerald-600">{cat.price}</p>
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
