/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import {
  Search,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { buildWhatsAppGeneralUrl } from "../utils/whatsapp";

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

export default function HomeSection({ 
  onSearch, 
  setActiveTab,
  customCategories = [
    { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.", heights: "12m - 17m", price: "v.a. €80/dag" },
    { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.", heights: "15m - 17m", price: "v.a. €160/dag" },
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Verkrijgbaar in 6m, 8m en 10m werkhoogte. Past door standaard deuren.", heights: "6m - 10m", price: "v.a. €80/dag" },
    { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.", heights: "5m - 10m", price: "v.a. €75/dag" },
    { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.", heights: "18m - 21m", price: "v.a. €90/dag" },
    { id: "ecolift", label: "Ecolift", listLabel: "Ecolift", desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.", heights: "4.2m", price: "v.a. €45/dag" },
    { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete kluspakketten speciaal samengesteld voor specifieke ZZP- en particuliere klussen.", heights: "4m - 21m", price: "v.a. €80/dag" }
  ]
}: HomeSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const siteConfig = useAppStore((state) => state.siteConfig);
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, selectedCat === "all" ? "" : selectedCat);
  };

  return (
    <div>

      {/* ── HERO SECTION — photo background only here ── */}
      <div
        className="relative bg-slate-900 bg-cover bg-center bg-no-repeat overflow-hidden px-5 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      >
        {/* Gradient overlay — only dark enough to read text */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/65 via-slate-800/50 to-slate-900/60 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl">

          {/* Tagline + Title + Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6 sm:mb-8 space-y-3 sm:space-y-4"
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

          {/* Search bar */}
          <motion.form
            onSubmit={handleSearchSubmit}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col sm:flex-row items-stretch gap-2 p-1.5 sm:p-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm shadow-sm max-w-2xl mx-auto"
          >
            <div className="flex-1 flex items-center px-3 space-x-2 bg-white/90 rounded-xl">
              <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "nl" && siteConfig.heroTagline ? siteConfig.heroTagline : t("searchPlaceholder")}
                className="w-full py-3 text-sm bg-transparent outline-none focus:ring-0 text-slate-800 placeholder-slate-400"
              />
            </div>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="px-4 py-3 text-xs text-slate-700 font-semibold bg-white rounded-xl border border-white/20 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
            >
              <option value="all">{t("filterAll")}</option>
              {customCategories.filter(c => c.id !== "klussensets" && !["schaarlift-smal", "schaarlift-6m"].includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === "schaarlift" ? "Schaarliften" : (c.listLabel || c.label)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="flex items-center justify-center space-x-1.5 font-bold hover:opacity-90 active:scale-97 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-3 rounded-xl transition-all font-display border-none cursor-pointer"
            >
              <span>{t("searchButton")}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.form>

          {/* WhatsApp CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto w-full mt-4"
          >
            <a
              href={buildWhatsAppGeneralUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-3 w-full py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] no-underline"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Direct advies nodig? WhatsApp ons!</span>
            </a>
          </motion.div>

          <p className="text-center text-[10px] text-white/40 font-mono mt-3">
            Zoeterwoude • TÜV / BMWT Gecertificeerd • Zelf ophalen of bezorgen
          </p>

        </div>
      </div>

    </div>
  );
}
