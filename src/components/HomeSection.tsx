/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useLanguageStore } from "../store/languageStore";
import { 
  Search, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  Truck, 
  Clock, 
  Cpu, 
  HelpCircle,
  TrendingDown,
  Wrench,
  Paintbrush,
  Sun,
  Briefcase,
  Package,
  Hammer
} from "lucide-react";
import { motion } from "motion/react";

const klusPakketten = [
  {
    id: "set-paint-comfort",
    title: "Schilderskit Comfort (10m)",
    sub: "Binnenschilderwerk & wanden",
    desc: "Inclusief 2x 20m verlengkabels, veiligheidsharnas, non-marking banden en extra vloerbeschermers.",
    price: "€115/dag",
    height: "10m",
    suit: "Schilders & Klussers",
    color: "from-amber-500/10 via-amber-600/5 to-white border-amber-300 text-amber-900 shadow-sm"
  },
  {
    id: "set-solar-pro",
    title: "Solar Pro Montage set (12m)",
    sub: "Zonnepanelen installatie & daken",
    desc: "Inclusief compacte hybride knikarmhoogwerker, handige materiaalhaken en all-risk kasko dekking.",
    price: "€185/dag",
    height: "12m",
    suit: "Zonnepaneel Teams",
    color: "from-blue-500/10 via-blue-600/5 to-white border-blue-200 text-blue-900 shadow-sm"
  },
  {
    id: "set-prune-compact",
    title: "Tuin Snoeisets compact (12m)",
    sub: "Snoeien & boomverzorging",
    desc: "Compacte Spinhoogwerker op rupsbanden met 4x plastic rijplaten en helm met gehoorbescherming.",
    price: "€170/dag",
    height: "12m",
    suit: "Particulieren & Hoveniers",
    color: "from-emerald-500/10 via-emerald-600/5 to-white border-emerald-300 text-emerald-900 shadow-sm"
  },
  {
    id: "set-gutter-fast",
    title: "Dakgootschep Snelstart (16m)",
    sub: "Gootreiniging & inspectie",
    desc: "Zelf rijden met rijbewijs B. Inclusief platformvak voor gereedschappen, dakgootschep en 230V stroom in werkbak.",
    price: "€215/dag",
    height: "16m",
    suit: "Glazenwassers & DHZ",
    color: "from-rose-500/10 via-rose-600/5 to-white border-rose-300 text-rose-900 shadow-sm"
  },
  {
    id: "set-facade-heavy",
    title: "Gevelreiniger Compact (14m)",
    sub: "Gevelreiniging & voegwerk",
    desc: "Compacte telescoophoogwerker met uitstekend bereik. Inclusief hogedrukspuit haspelmontage.",
    price: "€195/dag",
    height: "14m",
    suit: "Schilders & Klussers",
    color: "from-purple-500/10 via-indigo-600/5 to-white border-purple-300 text-violet-900 shadow-sm"
  },
  {
    id: "set-window-premium",
    title: "Glazenwasser Pro-Kit (16m)",
    sub: "Glasbewassing op hoogte",
    desc: "Truckhoogwerker (rijbewijs B) voorzien van osmose-watertank frame klemmen en brede platformbak.",
    price: "€220/dag",
    height: "16m",
    suit: "Glazenwasserbedrijven",
    color: "from-teal-500/10 via-teal-600/5 to-white border-teal-300 text-teal-900 shadow-sm"
  },
  {
    id: "set-diy-weekend",
    title: "Weekend Deal DHZ (10m)",
    sub: "Kluswerk rondom huis & schuur",
    desc: "10m trailerhoogwerker incl. helm, tuigje & gratis 24/7 telefonische coaching van onze AI-coördinator.",
    price: "€90/dag",
    height: "10m",
    suit: "Particulieren & DHZ",
    color: "from-cyan-500/10 via-blue-600/5 to-white border-cyan-300 text-cyan-900 shadow-sm"
  },
  {
    id: "set-light-install",
    title: "Licht & Camera Installatieset (12m)",
    sub: "Beveiligingssystemen & spotlights",
    desc: "Spinhoogwerker met stroomhaspel-onderbouw en een brede platformbak voor gereedschapskisten.",
    price: "€175/dag",
    height: "12m",
    suit: "Elektriciëns & ZZP",
    color: "from-amber-500/10 via-amber-600/5 to-white border-amber-300 text-amber-900 shadow-sm"
  }
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
    heroTitle: "Huur uw hoogwerker in een handomdraai.",
    heroSubtitle: "HuurGo is er voor ZZP'ers en particulieren. Geen gedoe, direct online geregeld. Vind binnen 1 minuut de perfecte machine voor uw schilderklus, tuinonderhoud of gevelwerk met onze slimme AI-assistent.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "AI Adviseur",
    menuOrdersLabel: "Mijn Account"
  },
  customCategories = [
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.", heights: "6m - 10m", price: "v.a. €80/dag" },
    { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over serres, schuttingen of daken heen te reiken.", heights: "12m - 16m", price: "v.a. €155/dag" },
    { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Groot zijdelings bereik, ideaal voor boomverzorging en gevels.", heights: "14m - 16m", price: "v.a. €175/dag" },
    { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden naar uw klus met autorijbewijs B. Snel op- en afstellen.", heights: "16m", price: "v.a. €195/dag" },
    { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Compact op rupsbanden. Past door een standaard tuinpoort van 80cm.", heights: "12m - 16m", price: "v.a. €160/dag" },
    { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete sets speciaal samengesteld voor schilder-, snoei- of dakgootklus.", heights: "10m - 16m", price: "v.a. €90/dag" },
    { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig zelf te vervoeren achter uw auto met rijbewijs B.", heights: "12m", price: "v.a. €80/dag" }
  ]
}: HomeSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);


  const categories = customCategories.map((c, idx) => {
    const iconColors = ["text-blue-400", "text-indigo-400", "text-rose-400", "text-teal-400", "text-amber-400", "text-emerald-400"];
    const bgClasses = [
      "from-blue-600/10 to-indigo-600/10 hover:border-blue-500/40",
      "from-indigo-600/10 to-purple-600/10 hover:border-indigo-500/40",
      "from-rose-600/10 to-orange-600/10 hover:border-rose-500/40",
      "from-teal-600/10 to-emerald-600/10 hover:border-teal-500/40",
      "from-amber-600/10 to-yellow-600/10 hover:border-amber-500/40",
      "from-emerald-600/10 to-teal-600/10 hover:border-emerald-500/40"
    ];
    const defaultImages = [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1608220179550-e128cc63979e?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=400&auto=format&fit=crop"
    ];

    return {
      id: c.id,
      title: c.listLabel || c.label,
      desc: c.desc,
      heights: c.heights,
      price: c.price,
      iconColor: iconColors[idx % iconColors.length],
      bgClass: bgClasses[idx % bgClasses.length],
      image: defaultImages[idx % defaultImages.length]
    };
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, selectedCat === "all" ? "" : selectedCat);
    setActiveTab("catalog");
  };

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Decorative Radial Glowing Elements */}
      <div className="absolute top-1/4 left-1/10 h-100 w-100 rounded-full bg-indigo-600/10 blur-[120px] -z-10 pulse-bg" />
      <div className="absolute bottom-1/5 right-1/10 h-120 w-120 rounded-full bg-blue-600/8 blur-[140px] -z-10" />

      <div className="mx-auto max-w-7xl">
        {/* HERO SECTION - Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-20">
          
          {/* Left glowing copy */}
          <div className="lg:col-span-7 space-y-7 text-left">
            {/* Tagline */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 rounded-full border border-indigo-150 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>{t("heroTagline")}</span>
            </motion.div>
 
            {/* Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]"
            >
              {t("heroTitle")}
            </motion.h1>
 
            {/* Subtext */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl"
            >
              {t("heroSubtitle")}
            </motion.p>
 
            {/* FLOTATING KPI BADGES */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
            >
              {[
                { label: "100% Gekeurd", desc: "TÜV & BMWT", icon: ShieldCheck, color: "text-teal-650" },
                { label: "B-Rijbewijs", desc: "Zelf rijden", icon: Truck, color: "text-indigo-600" },
                { label: "Snel Geleverd", desc: "Of zelf halen", icon: Clock, color: "text-blue-650" }
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm backdrop-blur-md">
                    <Icon className={`h-5 w-5 mt-0.5 ${kpi.color}`} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 leading-none">{kpi.label}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-none font-mono">{kpi.desc}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
 
            {/* INSTANT SEARCH WIDGET (Hovering glass bar) */}
            <motion.form 
              onSubmit={handleSearchSubmit}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="premium-glow flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl border border-slate-200 bg-white shadow-md max-w-3xl"
            >
              <div className="flex-1 flex items-center px-3 space-x-2 bg-slate-50 rounded-xl border border-slate-100/80">
                <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")} 
                  className="w-full py-3.5 text-sm bg-transparent outline-none focus:ring-0 text-slate-800 placeholder-slate-400"
                />
              </div>
 
              <select 
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="px-4 py-3.5 text-xs text-slate-700 font-semibold bg-white rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[150px]"
              >
                <option value="all">{t("filterAll")}</option>
                <option value="schaarlift">Schaarliften</option>
                <option value="knikarm">Knikarmhoogwerkers</option>
                <option value="telescoop">Telescoophoogwerkers</option>
                <option value="auto">Autohoogwerkers</option>
                <option value="spin">Spinhoogwerkers</option>
              </select>
 
              <button 
                type="submit"
                className="flex items-center justify-center space-x-1.5 font-bold hover:opacity-90 active:scale-97 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-6 py-3.5 rounded-xl transition-all font-display border-none cursor-pointer"
              >
                <span>{t("searchButton")}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.form>
          </div>

          {/* Right Showcase: high-end imagery of machine */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative aspect-square max-w-[430px] mx-auto rounded-3xl overflow-hidden border border-slate-200 shadow-sm group bg-white"
            >
              {/* Outer gradient glow wrapper */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-blue-500/10 to-teal-500/5 blur-md -z-10" />

              <img 
                src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=700&auto=format&fit=crop" 
                alt="HoogwerkerHub Premium Equipment" 
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-95 saturate-110"
                referrerPolicy="no-referrer"
              />

              {/* Hover spec drawer overlay */}
              <div className="absolute inset-x-4 bottom-4 glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-200 bg-white/90 shadow-md">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">Featured Machine</h4>
                  <p 
                    onClick={() => {
                      onSearch("", "telescoop");
                      setActiveTab("catalog");
                    }} 
                    className="text-xs text-indigo-600 font-bold font-display mt-0.5 hover:text-indigo-700 cursor-pointer transition-colors"
                  >
                    Telescoophoogwerker (26m)
                  </p>
                </div>
                <button
                  onClick={() => {
                    onSearch("", "telescoop");
                    setActiveTab("catalog");
                  }}
                  className="h-8 w-8 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center text-white transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CATEGORY SELECTOR - Interactive Card Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-1.5">
                <Layers className="h-5 w-5 text-indigo-600" />
                <span>Blader per Categorie</span>
              </h2>
              <p className="text-xs text-slate-550 mt-1">Selecteer een machinegroep en vind specifieke afmetingen en bereiken.</p>
            </div>
            
            {/* Quick Link/Help */}
            <button 
              onClick={() => setActiveTab("advisor")}
              className="mt-2.5 sm:mt-0 flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold group transition-colors cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Laat de AI Adviseur kiezen</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {categories.map((cat, idx) => {
              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    onSearch("", cat.id);
                    setActiveTab("catalog");
                  }}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 hover:bg-white shadow-sm hover:shadow-md p-5 text-left cursor-pointer transition-all duration-400 hover:-translate-y-1.5 ${cat.bgClass} flex flex-col justify-between min-h-[220px]`}
                >
                  {/* Subtle background machinery photo for texture */}
                  <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity z-0">
                    <img src={cat.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>

                  <div className="space-y-3 z-10">
                    <span className={`inline-block font-mono text-[9px] uppercase tracking-wider font-extrabold ${cat.iconColor}`}>
                      {cat.id}
                    </span>
                    <h3 className="font-display font-bold text-base text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-3">
                      {cat.desc}
                    </p>
                  </div>

                  <div className="flex items-end justify-between pt-4 border-t border-slate-100 z-10 mt-auto">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block leading-none">Bereik</span>
                      <span className="text-xs font-bold text-slate-800 block mt-1">{cat.heights}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 block leading-none">Vanaf</span>
                      <span className="text-xs font-bold text-teal-750 block mt-1 font-mono">{cat.price}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COMPREHENSIVE EXPERT DIY & PROFESSIONAL TASK-BASED SOLUTIONS */}
        <div id="kluspakketten" className="mt-20 space-y-8 pt-10 border-t border-slate-200/80 animate-fade-in relative">
          
          {/* Section banner outline & background glow decoration */}
          <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-emerald-600/5 blur-[100px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <span className="text-[10px] bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 text-emerald-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                Kant-en-klare Kluspakketten Deal
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2.5 flex items-center space-x-2">
                <Package className="h-6.5 w-6.5 text-emerald-605 text-emerald-600 shrink-0" />
                <span>Professionele Klus Bundels & Sets</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-2xl">
                Onze experts hebben de vloot, stroomkabels, veiligheidstuigen en toebehoren samengesteld voor de meest voorkomende klusgroepen. 
                Snel, gecertificeerd en direct operationeel bij u op locatie met óf zonder deskundige vloot-operator.
              </p>
            </div>
            
            <button
              onClick={() => {
                onSearch("", "klussensets");
                setActiveTab("catalog");
              }}
              className="flex items-center space-x-1 border border-slate-200 hover:border-emerald-500 bg-white hover:bg-slate-50 text-slate-705 text-slate-700 hover:text-emerald-750 text-xs px-4 py-2.5 rounded-xl transition-all font-semibold cursor-pointer shadow-sm"
            >
              <span>Bekijk alle pakketten in de catalogus</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {klusPakketten.map((bundle) => {
              return (
                <div
                  key={bundle.id}
                  onClick={() => {
                    onSearch(bundle.id, "klussensets");
                    setActiveTab("catalog");
                  }}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg ${bundle.color}`}
                >
                  {/* Subtle design top pattern */}
                  <div className="absolute top-0 right-0 h-12 w-12 bg-white/10 rounded-bl-3xl -z-10 group-hover:scale-110 transition-transform" />

                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9.5px] uppercase font-mono tracking-wider font-extrabold opacity-75 select-none">
                      {bundle.sub}
                    </span>
                    <span className="text-[10px] font-bold font-mono text-teal-800 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                      {bundle.height}
                    </span>
                  </div>

                  <h3 className="font-display font-extrabold text-sm text-slate-900 group-hover:text-amber-950 transition-colors leading-snug">
                    {bundle.title}
                  </h3>

                  <p className="text-[11px] text-slate-650 leading-relaxed mt-2.5 min-h-[50px]">
                    {bundle.desc}
                  </p>

                  <div className="mt-4 pt-3.5 border-t border-slate-150 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 font-sans text-[10.5px]">Voor: <strong className="text-slate-805 font-semibold text-slate-800">{bundle.suit}</strong></span>
                    <span className="font-bold text-teal-700">{bundle.price}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TRUST BANNER - HOLLAND PREMIER VENDOR */}
        <div className="mt-20 border-t border-slate-200/80 pt-12 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className="text-2xl md:text-3xl font-extrabold text-slate-900 font-display">Alphen a/d Rijn</span>
              <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">Hoofdkantoor & Hub</p>
            </div>
            <div>
              <span className="text-2xl md:text-3xl font-extrabold text-slate-900 font-display">€ 0,-</span>
              <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">Zelf Ophalen</p>
            </div>
            <div>
              <span className="text-2xl md:text-3xl font-extrabold text-slate-900 font-display">&lt; 4 Minuten</span>
              <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">AI Match Tijd</p>
            </div>
            <div>
              <span className="text-2xl md:text-3xl font-extrabold text-slate-900 font-display">TÜV / BMWT</span>
              <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">Gecertificeerde Vloot</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
