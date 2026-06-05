/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useLanguageStore } from "../store/languageStore";
import { 
  Search, 
  ArrowRight, 
  Layers, 
  Cpu,
  MessageCircle
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
    menuAdvisorLabel: string;
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
  siteConfig = {
    siteName: "HuurGo",
    heroTagline: "Snel & Makkelijk Hoogwerkers Huren",
    heroTitle: "Wat heeft u nodig?",
    heroSubtitle: "Kies uw categorie en huur direct. Simpel, snel, all-in.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "AI Adviseur",
    menuOrdersLabel: "Mijn Account"
  },
  customCategories = [
    { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.", heights: "12m - 17m", price: "v.a. €80/dag" },
    { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.", heights: "15m - 17m", price: "v.a. €160/dag" },
    { id: "schaarlift", label: "Schaarlift (8m)", listLabel: "Schaarliften (8m)", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.", heights: "8m", price: "v.a. €80/dag" },
    { id: "schaarlift-smal", label: "Smal Model Schaarlift (10m)", listLabel: "Schaarliften (10m smal)", desc: "Compacte en smalle schaarlift voor nauwe gangpaden en binnenruimtes tot 10 meter werkhoogte.", heights: "10m", price: "v.a. €95/dag" },
    { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.", heights: "5m - 10m", price: "v.a. €75/dag" },
    { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.", heights: "18m - 21m", price: "v.a. €90/dag" },
    { id: "ecolift", label: "Ecolift", listLabel: "Ecolift", desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.", heights: "4.2m", price: "v.a. €45/dag" },
    { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete kluspakketten speciaal samengesteld voor specifieke ZZP- en particuliere klussen.", heights: "4m - 21m", price: "v.a. €80/dag" }
  ]
}: HomeSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const t = useLanguageStore((state) => state.t);

  const categoryIcons = [
    "🚛", "🕷️", "✂️", "📐", "🏗️", "🪜", "🌿", "📦"
  ];

  const bgClasses = [
    "from-blue-600/10 to-indigo-600/10 hover:border-blue-400/50",
    "from-indigo-600/10 to-purple-600/10 hover:border-indigo-400/50",
    "from-amber-500/10 to-orange-500/10 hover:border-amber-400/50",
    "from-rose-500/10 to-pink-500/10 hover:border-rose-400/50",
    "from-teal-500/10 to-emerald-500/10 hover:border-teal-400/50",
    "from-cyan-500/10 to-blue-500/10 hover:border-cyan-400/50",
    "from-emerald-500/10 to-green-500/10 hover:border-emerald-400/50",
    "from-violet-500/10 to-purple-500/10 hover:border-violet-400/50"
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, selectedCat === "all" ? "" : selectedCat);
    setActiveTab("catalog");
  };

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Subtle ambient background */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-indigo-500/5 blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-blue-500/5 blur-[120px] -z-10" />

      <div className="mx-auto max-w-5xl">
        
        {/* COMPACT HERO — Single Focus */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 space-y-3"
        >
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            {siteConfig.heroTitle || "Wat heeft u nodig?"}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
            {siteConfig.heroSubtitle || "Kies uw categorie en huur direct. Simpel, snel, all-in."}
          </p>
        </motion.div>

        {/* SEARCH BAR — Clean & Simple */}
        <motion.form 
          onSubmit={handleSearchSubmit}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl border border-slate-200 bg-white shadow-sm max-w-2xl mx-auto mb-10"
        >
          <div className="flex-1 flex items-center px-3 space-x-2 bg-slate-50 rounded-xl border border-slate-100/80">
            <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")} 
              className="w-full py-3 text-sm bg-transparent outline-none focus:ring-0 text-slate-800 placeholder-slate-400"
            />
          </div>

          <select 
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-4 py-3 text-xs text-slate-700 font-semibold bg-white rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
          >
            <option value="all">{t("filterAll")}</option>
            {customCategories.filter(c => c.id !== "klussensets").map((c) => (
              <option key={c.id} value={c.id}>
                {c.listLabel || c.label}
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

        {/* 7 CATEGORY CARDS — The Main Focus */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="space-y-5"
        >
          <div className="flex justify-between items-end">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Kies uw categorie
              </h2>
            </div>
            <button 
              onClick={() => setActiveTab("advisor")}
              className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold group transition-colors cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>AI Adviseur</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {customCategories.filter(cat => cat.id !== "klussensets").map((cat, idx) => (
              <div
                key={cat.id}
                onClick={() => {
                  onSearch("", cat.id);
                  setActiveTab("catalog");
                }}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br bg-white/95 hover:bg-white shadow-sm hover:shadow-md p-4 sm:p-5 text-left cursor-pointer transition-all duration-300 hover:-translate-y-1 ${bgClasses[idx % bgClasses.length]} flex flex-col justify-between min-h-[180px] sm:min-h-[200px]`}
              >
                <div className="space-y-2 z-10">
                  <span className="text-2xl select-none">{categoryIcons[idx % categoryIcons.length]}</span>
                  <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
                    {cat.listLabel || cat.label}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 leading-snug line-clamp-2 hidden sm:block">
                    {cat.desc}
                  </p>
                </div>

                <div className="flex items-end justify-between pt-3 border-t border-slate-100/80 z-10 mt-auto">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block leading-none uppercase">Hoogte</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">{cat.heights}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-400 block leading-none uppercase">All-in</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5 font-mono">{cat.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* WHATSAPP CTA STRIP */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-10 mb-6"
        >
          <a
            href={buildWhatsAppGeneralUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-3 w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] no-underline"
          >
            <MessageCircle className="h-5 w-5" />
            <span>Direct advies nodig? WhatsApp ons!</span>
          </a>
        </motion.div>

        {/* Minimal footer info */}
        <div className="text-center pt-4 pb-2">
          <p className="text-[10px] text-slate-400 font-mono">
            Alphen a/d Rijn • TÜV / BMWT Gecertificeerd • Zelf ophalen of bezorgen
          </p>
        </div>

      </div>
    </div>
  );
}
