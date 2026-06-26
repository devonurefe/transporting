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
  Clock,
  UserRound,
  Tractor,
  Scissors,
  MoveVertical,
  ArrowUpFromLine,
  Leaf,
  Columns2,
  Zap,
  ChevronRight,
  type LucideProps
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { buildWhatsAppGeneralUrl } from "../utils/whatsapp";
import { withVat } from "../utils/format";
import VatToggle from "./VatToggle";
import { BrandedText, HuurGoText } from "./Header";

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

const CAT_GRADIENT: Record<string, string> = {
  schaarlift:   "from-slate-100 to-slate-200",
  spin:         "from-teal-100 to-teal-200",
  aanhanger:    "from-amber-100 to-amber-200",
  mastlift:     "from-orange-100 to-amber-100",
  ladderlift:   "from-blue-100 to-blue-200",
  ecolift:      "from-emerald-100 to-emerald-200",
  kamersteiger: "from-slate-100 to-slate-200",
};

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
    { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "", heights: "12m - 17m", price: "€80/dag" },
    { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "", heights: "15m - 17m", price: "€160/dag" },
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "", heights: "6m - 10m", price: "€65/dag" },
    { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "", heights: "5m - 10m", price: "€75/dag" },
    { id: "kamersteiger", label: "Kamersteiger", listLabel: "Kamersteigers", desc: "", heights: "4m", price: "€35/dag" },
    { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "", heights: "18m - 21m", price: "€90/dag" },
    { id: "ecolift", label: "Pecolift", listLabel: "Pecolift", desc: "", heights: "4.2m", price: "€45/dag" },
  ]
}: HomeSectionProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);
  const machines = useAppStore((state) => state.machines);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);

  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const campaignScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Continuous gentle left-drift marquee for the weekly-deals row. The cards are
  // rendered twice (a hidden-on-desktop clone set), so when the scroll passes the
  // first set's width we subtract it for a seamless loop. Only acts when the row
  // overflows (mobile horizontal scroll); on sm+ it's a static grid. Pauses on
  // touch/drag and is disabled under prefers-reduced-motion.
  React.useEffect(() => {
    const el = campaignScrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let paused = false;
    let raf = 0;
    let pos = el.scrollLeft;
    const SPEED = 0.4; // px/frame ≈ 24px/s
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("pointerup", resume);
    el.addEventListener("pointercancel", resume);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("touchend", resume);
    const tick = () => {
      if (paused || el.scrollWidth - el.clientWidth <= 4) {
        pos = el.scrollLeft;
      } else {
        // One repeating set = (total + bridging gap-4) / 2, so the wrap lands on
        // identical pixels with no visible seam.
        const setWidth = (el.scrollWidth + 16) / 2;
        pos += SPEED;
        if (pos >= setWidth) pos -= setWidth;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("pointercancel", resume);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("touchend", resume);
    };
  }, [machines]);

  const FAQ_ITEMS = [
    {
      q: t("Hoe annuleer ik mijn huur?", "How do I cancel my rental?", "Kiralamamı nasıl iptal ederim?"),
      a: t("Annuleren kan gratis tot 48 uur voor de startdatum via uw bestellingenoverzicht of via WhatsApp. Bij annulering binnen 48 uur kunnen annuleringskosten in rekening worden gebracht.",
          "You can cancel free of charge up to 48 hours before the start date via your order overview or via WhatsApp. Cancellations within 48 hours may incur cancellation fees.",
          "Başlangıç tarihinden 48 saat öncesine kadar ücretsiz iptal edebilirsiniz. 48 saat içinde iptallerde iptal ücreti uygulanabilir.")
    },
    {
      q: t("Welk rijbewijs heb ik nodig?", "What driving licence do I need?", "Hangi ehliyete ihtiyacım var?"),
      a: t("Voor aanhangerhoogwerkers tot 3.500 kg heeft u rijbewijs B nodig. Voor zwaardere combinaties is rijbewijs BE vereist. Twijfelt u? Wij adviseren u graag via WhatsApp.",
          "For trailer lifts up to 3,500 kg you need a category B licence. For heavier combinations, a BE licence is required. Unsure? We're happy to advise via WhatsApp.",
          "3.500 kg'a kadar römorklı araçlar için B ehliyeti yeterlidir. Daha ağır kombinasyonlar için BE gereklidir.")
    },
    {
      q: t("Zijn de prijzen inclusief BTW?", "Are prices including VAT?", "Fiyatlar KDV dahil mi?"),
      a: t("Onze tarieven zijn standaard exclusief 21% BTW. Via de BTW-knop bovenaan de catalogus schakelt u eenvoudig naar inclusief BTW om het werkelijke bedrag te zien.",
          "Our rates are standard excluding 21% VAT. Use the VAT toggle at the top of the catalogue to switch to including VAT.",
          "Fiyatlarımız standart olarak %21 KDV hariçtir. Katalog sayfasının üstündeki KDV düğmesiyle KDV dahil fiyatı görebilirsiniz.")
    },
    {
      q: t("Wat zijn de bezorg- en transportkosten?", "What are delivery and transport costs?", "Teslimat ve nakliye ücretleri nelerdir?"),
      a: t("Bezorging door ons: €150 all-in (heen en retour). Aanhanger huren: €25 per dag. Zelf ophalen in Zoeterwoude is gratis. Borg: €150 (wordt teruggestort na de huurperiode).",
          "Delivery by us: €150 all-in (incl. return). Trailer rental: €25/day. Self pickup in Zoeterwoude is free. Deposit: €150 (refunded after the rental period).",
          "Bizim tarafımızdan teslimat: €150 (gidiş-dönüş dahil). Römork kiralama: günlük €25. Zoeterwoude'dan kendi teslim alma ücretsizdir. Depozito: €150 (iade edilir).")
    },
    {
      q: t("Hoe werkt de betaling?", "How does payment work?", "Ödeme nasıl çalışır?"),
      a: t("Na uw online boeking sturen wij u via WhatsApp een betaallink (Tikkie of iDEAL). Na ontvangst van uw betaling wordt de boeking definitief bevestigd en ontvangt u een factuur per e-mail.",
          "After your online booking, we send you a payment link via WhatsApp (Tikkie or iDEAL). Once payment is received, the booking is confirmed and you receive an invoice by email.",
          "Online rezervasyonunuzun ardından WhatsApp üzerinden bir ödeme linki (Tikkie veya iDEAL) göndeririz. Ödeme alındıktan sonra rezervasyon onaylanır.")
    },
  ];

  const SCHAARLIFT_VARIANTS = new Set(["schaarlift", "schaarlift-smal", "schaarlift-6m"]);

  const activeMachines = React.useMemo(() => machines.filter(m => m.isActive !== false), [machines]);

  // Live minimum price per category (each schaarlift sub-type keeps its own key)
  const livePriceByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    activeMachines.forEach(m => {
      const key = m.category;
      if (map[key] === undefined || m.pricePerDay < map[key]) map[key] = m.pricePerDay;
    });
    return map;
  }, [activeMachines]);

  // First machine image per category for card thumbnails
  const imageByCategory = React.useMemo(() => {
    const map: Record<string, string> = {};
    activeMachines.forEach(m => {
      const img = m.imageUrl || m.additionalImages?.[0] || "";
      if (!img) return;
      const key = SCHAARLIFT_VARIANTS.has(m.category) ? "schaarlift" : m.category;
      if (!map[key]) map[key] = img;
    });
    return map;
  }, [activeMachines]);

  const HOME_ORDER = ["schaarlift", "spin", "mastlift", "kamersteiger", "ladderlift", "ecolift", "aanhanger"];

  const displayCategories = customCategories
    .filter(c => !SKIP_IDS.has(c.id))
    .map(c => c.id === "schaarlift"
      ? { ...c, label: "Schaarliften 6-8-10", listLabel: "Schaarliften 6-8-10", heights: "6 / 8 / 10 m", price: "€49/dag" }
      : c
    )
    .sort((a, b) => {
      const ai = HOME_ORDER.indexOf(a.id);
      const bi = HOME_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div>

      {/* ── HERO BANNER — clean background photo + crisp HTML text overlay ──
          Text/icons are rendered as HTML (not baked into the image) so they
          stay razor-sharp at any resolution/zoom and are translatable. Upload
          a TEXT-FREE photo in Admin → Customizer for the best result. */}
      <div className="relative bg-slate-900 overflow-hidden h-[260px] sm:h-[380px] lg:h-[420px]">
        {siteConfigLoaded ? (
          <motion.img
            key={siteConfig.heroImageUrl || 'default'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            src={siteConfig.heroImageUrl || '/hero-huurgo-v2.jpg'}
            alt=""
            className="w-full h-full block object-cover [object-position:60%_center] sm:[object-position:65%_center]"
          />
        ) : (
          // Skeleton placeholder while the config is still loading
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse" />
        )}

        {/* Readability scrim — darker toward the bottom-left where the text sits */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/45 to-black/10 pointer-events-none" />

        {/* Overlay content — anchored bottom-left */}
        <div className="absolute inset-0 flex items-end pointer-events-none">
          <div className="px-5 sm:px-8 lg:px-14 pb-5 sm:pb-7 lg:pb-9 w-full max-w-2xl">
            {/* Brand wordmark in its original logo form, with tagline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-2.5 sm:mb-3.5"
            >
              <span className="text-2xl sm:text-3xl lg:text-4xl drop-shadow-sm">
                <HuurGoText dark />
              </span>
              <span className="block font-semibold text-[9px] sm:text-[11px] uppercase tracking-[0.18em] text-white/70 mt-0.5">
                {t("heroBannerEyebrow")}
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.07 }}
              className="font-display font-black italic tracking-tight text-white leading-[0.95] text-3xl sm:text-5xl lg:text-6xl drop-shadow-sm"
            >
              {t("heroBannerLine1")}
              <br />
              <span className="text-orange-500">{t("heroBannerLine2")}</span>
            </motion.h2>

            {/* Trust features — hidden on the shortest screens to keep mobile clean */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14 }}
              className="hidden sm:flex items-start gap-7 lg:gap-9 mt-6 lg:mt-8"
            >
              {[
                { Icon: Clock, label: t("heroFeatureOnline") },
                { Icon: Truck, label: t("heroFeatureDelivery") },
                { Icon: UserRound, label: t("heroFeatureAudience") },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 max-w-[180px]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/90 text-white shadow-sm">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── HERO TEXT + CTA — centered single column ── */}
      <div className="bg-white px-5 sm:px-6 pt-8 pb-6 border-b border-slate-100">
        <div className="mx-auto max-w-xl text-center space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600"
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
            <BrandedText text={language === "nl" && siteConfig.heroSubtitle ? siteConfig.heroSubtitle : t("heroSubtitle")} />
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="pt-1"
          >
            <a
              href={buildWhatsAppGeneralUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-3 w-full max-w-sm mx-auto py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] no-underline"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span>Direct advies? WhatsApp ons!</span>
            </a>
          </motion.div>
        </div>
      </div>

      {/* ── CAMPAIGN CARDS SECTION ── */}
      {(() => {
        const seen = new Set<string>();
        const campaignMachines = activeMachines.filter(m =>
          (m.oneDayPrice && m.oneDayPrice < m.pricePerDay) || m.campaignText || m.campaignDiscountPercent
        ).filter(m => {
          const baseName = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
          if (seen.has(baseName)) return false;
          seen.add(baseName);
          return true;
        });

        if (campaignMachines.length === 0) return null;

        return (
          <div className="bg-gradient-to-b from-amber-50 to-white border-b border-amber-100 px-4 sm:px-6 pt-6 pb-7">
            {/* Header */}
            <div className="flex items-end justify-between mb-4 max-w-5xl mx-auto">
              <div>
                <div className="flex items-center gap-2">
                  <div className="bg-amber-500 rounded-lg p-1">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="font-display font-black text-xl text-slate-900">{t("Weekaanbiedingen", "Weekly Deals", "Haftalık Fırsatlar")}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-8">{t("Profiteer nu van onze speciale actieprijzen", "Take advantage of our special offers", "Özel fiyatlardan şimdi yararlanın")}</p>
              </div>
              <button
                type="button"
                onClick={() => onSearch("", "")}
                className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors shrink-0 pb-0.5"
              >
                {t("Bekijk alles", "View all", "Tümünü gör")} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Cards — horizontal scroll on mobile, grid on sm+ */}
            <div className="max-w-5xl mx-auto">
              <div ref={campaignScrollRef} className="flex gap-4 overflow-x-auto pb-3 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[...campaignMachines.map(m => ({ m, clone: false })), ...campaignMachines.map(m => ({ m, clone: true }))].map(({ m, clone }, i) => {
                  const baseName = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
                  const machineImage = m.imageUrl || m.additionalImages?.[0];
                  const campaignPct = m.campaignDiscountPercent ?? 0;
                  const basePrice = m.oneDayPrice && m.oneDayPrice < m.pricePerDay ? m.oneDayPrice : m.pricePerDay;
                  const effectivePrice = campaignPct > 0 ? basePrice * (1 - campaignPct / 100) : basePrice;
                  const hasDayDiscount = !!(m.oneDayPrice && m.oneDayPrice < m.pricePerDay);
                  const displayPrice = withVat(effectivePrice, vatDisplay);
                  const originalPrice = withVat(m.pricePerDay, vatDisplay);
                  const fmtPrice = (p: number) => p % 1 === 0
                    ? `€${Math.round(p)}`
                    : `€${p.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const CatIcon = CATEGORY_ICONS[m.category] ?? Truck;

                  return (
                    <motion.button
                      key={clone ? `${m.id}-clone` : m.id}
                      aria-hidden={clone || undefined}
                      tabIndex={clone ? -1 : undefined}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: clone ? 0 : i * 0.07 }}
                      type="button"
                      onClick={() => onSearch(baseName, m.category)}
                      className={`shrink-0 w-[200px] sm:w-auto bg-white rounded-2xl border border-amber-100 shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all text-left overflow-hidden flex flex-col group ${clone ? "sm:hidden" : ""}`}
                    >
                      {/* Image */}
                      <div className="relative aspect-[3/2] w-full overflow-hidden bg-amber-50 shrink-0">
                        {machineImage ? (
                          <img
                            src={machineImage}
                            alt={baseName}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${CAT_GRADIENT[m.category] ?? "from-amber-100 to-amber-200"} flex items-center justify-center`}>
                            <CatIcon className="h-10 w-10 text-slate-400" />
                          </div>
                        )}
                        {/* Discount ribbon */}
                        {(campaignPct || hasDayDiscount) && (
                          <div className="absolute top-0 left-0 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-br-xl shadow-sm">
                            {campaignPct ? `−${campaignPct}%` : "Dagactie"}
                          </div>
                        )}
                        {m.campaignText && (
                          <div className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-amber-700 text-[10px] font-bold rounded-bl-xl px-2.5 py-1 border-b border-l border-amber-100">
                            {m.campaignText}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
                        <p className="font-display font-black text-[13px] text-slate-900 leading-snug line-clamp-2 break-words">{baseName}</p>

                        {/* Price block */}
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-lg font-black text-amber-600">{fmtPrice(displayPrice)}</span>
                          {(hasDayDiscount || campaignPct > 0) && (
                            <span className="text-[11px] text-slate-400 line-through">{fmtPrice(originalPrice)}</span>
                          )}
                          <span className="text-[11px] text-slate-400">/ dag</span>
                        </div>

                        {/* CTA button */}
                        <div className="mt-auto pt-0.5">
                          <div className="w-full text-center bg-amber-500 group-hover:bg-amber-600 text-white text-[11px] font-black py-2 px-3 rounded-xl transition-colors">
                            {t("Direct boeken →", "Book now →", "Hemen rezervasyon →")}
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
      })()}

      {/* ── CATEGORY CARDS ── */}
      <div className="bg-white px-4 sm:px-6 pt-6 pb-10">
        <div className="max-w-5xl mx-auto flex justify-end mb-3">
          <VatToggle />
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {displayCategories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Truck;
            const catImage = imageByCategory[cat.id];
            const fallbackGradient = CAT_GRADIENT[cat.id] ?? "from-slate-100 to-slate-200";

            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => onSearch("", cat.id)}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden text-left cursor-pointer hover:border-orange-200 hover:shadow-lg hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-200 flex flex-col"
              >
                {/* Top — text info: name + height • price on one line */}
                <div className="p-4 flex flex-col gap-1.5 min-w-0">
                  <p className="font-display font-black text-base sm:text-lg text-slate-900 leading-snug line-clamp-2">
                    {cat.listLabel || cat.label}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-semibold text-slate-600">{cat.heights}</span>
                    <span className="text-slate-300 select-none">•</span>
                    <span className="font-black text-emerald-600 text-base leading-tight">
                      {livePriceByCategory[cat.id] !== undefined
                        ? `€${(() => { const v = withVat(livePriceByCategory[cat.id], vatDisplay); return v % 1 === 0 ? Math.round(v).toLocaleString("nl-NL") : v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })()}/dag`
                        : "Prijs op aanvraag"}
                    </span>
                  </div>
                </div>

                {/* Bottom — wide machine photo on white background */}
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-white border-t border-slate-100">
                  {catImage ? (
                    <img
                      src={catImage}
                      alt={cat.label}
                      className="w-full h-full object-contain p-1.5 sm:p-3 transition-transform duration-500 ease-out group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                      }}
                    />
                  ) : null}
                  {/* Icon fallback (shown when no photo or photo fails) */}
                  <div
                    className={`absolute inset-0 bg-white flex items-center justify-center ${catImage ? "hidden" : "flex"}`}
                  >
                    <Icon className="h-10 w-10 text-slate-300" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── FAQ SECTION ── */}
      <div className="bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-display font-black text-xl text-slate-900">{t("Veelgestelde vragen", "Frequently asked questions", "Sık sorulan sorular")}</h2>
            <p className="text-xs text-slate-500 mt-1">{t("Alles wat u wilt weten over hoogwerker huren", "Everything you need to know about renting aerial lifts", "Yüksek erişim kiralama hakkında bilmeniz gerekenler")}</p>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-sm text-slate-900 pr-4">{item.q}</span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                  >
                    <ChevronRight className="h-3 w-3 rotate-90" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
