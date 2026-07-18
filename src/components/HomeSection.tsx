/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useCallback } from "react";
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
import { computeDiscounts } from "../utils/pricing";
import { withImageWidth } from "../utils/image";
import VatToggle from "./VatToggle";
import { BrandedText, HuurGoText, CardBrandWatermark } from "./Header";
import { Machine } from "../types";
import AdviesStrip from "./AdviesStrip";
import TrustBadges from "./TrustBadges";
import HowItWorksSection from "./HowItWorksSection";
import WhyHuurGoBand from "./WhyHuurGoBand";
import CoffeeCornerSection from "./CoffeeCornerSection";
import PhotoGallerySection from "./PhotoGallerySection";

// Merken die daadwerkelijk in de vloot zitten (zie seed) — als muted
// wordmark-strip onder de categoriekaarten. Tekst, geen logo-assets.
const FLEET_BRANDS = ["Haulotte", "JLG", "Niftylift", "Hinowa", "Bravi", "Skyjack", "Dingli", "Altrex"];

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

const CAT_LABEL: Record<string, string> = {
  schaarlift:   "Schaarlift",
  spin:         "Rupshoogwerker",
  aanhanger:    "Aanhangerhoogwerker",
  mastlift:     "Mastlift",
  ladderlift:   "Ladderlift",
  ecolift:      "Pecolift",
  kamersteiger: "Kamersteiger",
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

// Categories that are billed per week, not per day
const WEEKLY_PRICED_CATEGORIES = new Set(["kamersteiger"]);

// ── Single-row draggable + auto-scrolling deals carousel ──
function DealsCarousel({ machines, onSearch }: { machines: Machine[]; onSearch: (q: string, cat: string) => void }) {
  const t = useLanguageStore((state) => state.t);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  // Set once real drag movement crosses DRAG_THRESHOLD; stays true through
  // the click that follows pointerup so a genuine drag never also fires
  // onSearch. Left false for a plain tap (no movement), so the card's click
  // reaches it normally.
  const didDragRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  // Auto-scroll must yield to the user, not just during a touch/mouse drag.
  // On desktop, wheel/trackpad scrolling never touches isDragging at all, so
  // without this the rAF tick fights every wheel tick on the very next
  // frame — the row visibly jerks back toward the auto-scroll direction,
  // which reads as "sticky"/sliding on its own. Track the last real user
  // interaction and pause auto-scroll for a bit after it. Hovering feeds
  // into this same recency window (via onMouseMove) rather than pausing
  // indefinitely for as long as the cursor merely rests over the row —
  // a mouse idling there (which never happens on touch) would otherwise
  // freeze the carousel forever instead of just while actively interacting.
  const lastInteractionRef = useRef(0);
  // Authoritative sub-pixel scroll position, tracked independently of
  // el.scrollLeft. At this speed (~42px/s) each frame only advances by a
  // fraction of a pixel; `el.scrollLeft += delta` reads back whatever the
  // browser rounded scrollLeft to on the previous write, so on engines that
  // round to the nearest (or floor to the) integer pixel on every read, the
  // fractional part gets silently discarded every single frame — the value
  // never crosses the next whole pixel and the row never visibly moves at
  // all, even though the rAF loop is running correctly. Driving scrollLeft
  // from our own float ref instead of round-tripping through the DOM avoids
  // that class of bug regardless of which engine rounds it.
  const scrollPosRef = useRef(0);

  const seen = new Set<string>();
  const deduped = machines.filter(m => {
    const bn = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
    if (seen.has(bn)) return false;
    seen.add(bn);
    return true;
  });
  const allCards = [...deduped, ...deduped];

  const tick = useCallback((now: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = now;
    const dt = Math.min(now - lastTimeRef.current, 64);
    lastTimeRef.current = now;
    const el = ref.current;
    const recentlyInteracted = now - lastInteractionRef.current < 1200;
    if (el && !isDragging.current && !recentlyInteracted) {
      const half = el.scrollWidth / 2;
      scrollPosRef.current += (42 * dt) / 1000;
      if (scrollPosRef.current >= half) scrollPosRef.current -= half;
      el.scrollLeft = scrollPosRef.current;
    } else if (el) {
      // User (or native touch scroll) is driving scrollLeft directly right
      // now — keep our accumulator in sync so auto-scroll resumes from the
      // real position instead of jumping back to wherever it last was.
      scrollPosRef.current = el.scrollLeft;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Drag distance (px) before a pointerdown counts as an intentional drag
  // rather than a tap. Below this, we never call setPointerCapture — doing
  // so unconditionally on every pointerdown (the previous approach) captured
  // even plain taps, which made browsers redirect the whole event stream
  // (including the synthesized click) to this row instead of the card
  // button underneath, so cards silently stopped being clickable.
  const DRAG_THRESHOLD = 6;

  // Custom drag is mouse-only: desktop browsers have no native "click and
  // drag to scroll" gesture, so we simulate one. Touch pointers bail out
  // immediately and fall through to the browser's own native horizontal
  // scrolling instead (see touchAction below) — an earlier version routed
  // touch through this same pointer-capture logic, which turned out to be
  // unreliable on real iOS Safari (reported: manual swiping did nothing at
  // all, not just the auto-scroll). Native scrolling is guaranteed to work
  // everywhere and needs zero custom JS.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    activePointerIdRef.current = e.pointerId;
    dragStartX.current = e.clientX;
    dragScrollLeft.current = ref.current?.scrollLeft ?? 0;
    didDragRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (activePointerIdRef.current !== e.pointerId || !ref.current) return;
    const dx = dragStartX.current - e.clientX;
    if (!isDragging.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      isDragging.current = true;
      didDragRef.current = true;
      // Defensive: setPointerCapture can throw in some browsers. isDragging
      // is already true at this point, so an uncaught throw would otherwise
      // permanently block the auto-scroll tick below (never reset back to
      // false) — freezing the carousel for good instead of just losing
      // capture-follow-outside-bounds behavior.
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch { /* non-fatal — dragging still works without capture */ }
    }
    let next = dragScrollLeft.current + dx;
    const half = ref.current.scrollWidth / 2;
    if (next < 0) next += half;
    if (next >= half) next -= half;
    ref.current.scrollLeft = next;
  };

  const onPointerUp = () => {
    activePointerIdRef.current = null;
    isDragging.current = false;
    lastTimeRef.current = 0;
    lastInteractionRef.current = performance.now();
  };

  // Native touch scroll doesn't run through the pointer handlers above (they
  // bail out for touch), so track its start/end via plain Touch Events —
  // supported forever, unlike Pointer Events during scroll gestures which
  // are inconsistent on some mobile browsers. This is what actually pauses
  // the rAF auto-scroll while the user is touch-scrolling, and resumes it
  // ~1.2s after they lift their finger, mirroring the mouse behavior above.
  const onTouchStart = () => {
    lastInteractionRef.current = performance.now();
  };
  const onTouchMove = () => {
    lastInteractionRef.current = performance.now();
  };
  const onTouchEnd = () => {
    lastInteractionRef.current = performance.now();
  };

  // Desktop mice send vertical wheel deltas; a plain overflow-x-scroll row
  // relies on the browser to redirect that to horizontal scroll, which many
  // browsers only do when nothing else can consume the event — here the
  // page itself still scrolls vertically, so the wheel just scrolls the
  // page and the row never moves. Convert the dominant delta axis to
  // scrollLeft explicitly so wheel/trackpad reliably scrolls the row.
  // Must be a native, non-passive listener: React attaches its synthetic
  // wheel handler as passive by default, so e.preventDefault() there is a
  // silent no-op.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      lastInteractionRef.current = performance.now();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const onMouseEnter = () => {
    lastInteractionRef.current = performance.now();
  };

  const onMouseMove = () => {
    lastInteractionRef.current = performance.now();
  };

  const fmt = (p: number) => p % 1 === 0 ? `€${Math.round(p)}` : `€${p.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-gradient-to-b from-amber-50 to-white border-b border-amber-100 pt-8 pb-10">
      <div className="flex items-end justify-between mb-4 px-4 sm:px-6 max-w-5xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 rounded-lg p-1">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-display font-black text-xl text-slate-900">{t("Weekaanbiedingen", "Weekly Deals", "Haftalık Fırsatlar")}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-8">{t("Profiteer nu van onze speciale actieprijzen", "Take advantage of our special offers", "Özel fiyatlardan şimdi yararlanın")}</p>
        </div>
        <button type="button" onClick={() => onSearch("", "")} className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors shrink-0 pb-0.5">
          {t("Bekijk alles", "View all", "Tümünü gör")} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto relative">
      {/* Edge fades — hint that the row scrolls/drags on mobile */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-5 z-10 bg-gradient-to-r from-amber-50 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-white to-transparent" />
      <div
        ref={ref}
        className="overflow-x-scroll cursor-grab active:cursor-grabbing select-none"
        // No touchAction override — default "auto" lets the browser natively
        // scroll this row horizontally on touch (and pass vertical swipes
        // through to the page). Touch is deliberately not routed through the
        // pointer-drag handlers below; see the comment on onPointerDown.
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Fires whenever capture is released, including cases where the
        // browser revokes it without a matching pointerup/pointercancel —
        // a safety net so isDragging can never get stuck true and freeze
        // the auto-scroll tick for good.
        onLostPointerCapture={onPointerUp}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex gap-4 px-4" style={{ width: "max-content" }}>
          {allCards.map((m, i) => {
            const baseName = m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
            const machineImageFull = m.imageUrl || (m.additionalImages as string[])?.[0];
            // This card is a fixed 200x200 thumbnail — request a smaller width than the
            // 800px server default (meant for larger contexts like the detail modal) so
            // we don't ship 2x more image data than this thumbnail can ever show.
            const machineImage = machineImageFull
              ? `${machineImageFull}${machineImageFull.includes("?") ? "&" : "?"}w=480`
              : machineImageFull;
            const campaignPct = m.campaignDiscountPercent ?? 0;
            const basePrice = m.oneDayPrice && m.oneDayPrice < m.pricePerDay ? m.oneDayPrice : m.pricePerDay;
            const effectivePrice = campaignPct > 0 ? basePrice * (1 - campaignPct / 100) : basePrice;
            const hasDayDiscount = !!(m.oneDayPrice && m.oneDayPrice < m.pricePerDay);
            const displayPrice = withVat(effectivePrice, vatDisplay);
            const originalPrice = withVat(m.pricePerDay, vatDisplay);
            const CatIcon = CATEGORY_ICONS[m.category] ?? Truck;
            const hasDiscount = hasDayDiscount || campaignPct > 0;
            const key = i < deduped.length ? m.id : `${m.id}-b`;
            const isClone = i >= deduped.length;
            return (
              <button
                key={key}
                type="button"
                aria-hidden={isClone || undefined}
                tabIndex={isClone ? -1 : undefined}
                onClick={() => { if (didDragRef.current) return; onSearch(baseName, m.category); }}
                className="shrink-0 w-[200px] rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all text-left group"
              >
                <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white flex flex-col h-full">
                  <div className="relative aspect-square w-full bg-amber-50 shrink-0 overflow-hidden">
                    {machineImage ? (
                      <img src={machineImage} alt={baseName} loading="lazy" draggable={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${CAT_GRADIENT[m.category] ?? "from-amber-100 to-amber-200"} flex items-center justify-center`}>
                        <CatIcon className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black px-2.5 py-1 rounded-bl-xl shadow-sm">
                        {campaignPct ? `−${campaignPct}%` : "Dagactie"}
                      </div>
                    )}
                    {m.campaignText && (
                      <div className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-amber-700 text-[10px] font-bold rounded-bl-xl px-2.5 py-1 border-b border-l border-amber-100">
                        {m.campaignText}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col gap-2 flex-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-none">
                      {CAT_LABEL[m.category] ?? m.category}
                    </span>
                    <p className="font-display font-black text-xs text-slate-900 leading-snug line-clamp-2">{baseName}</p>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-sm font-black text-amber-700">{fmt(displayPrice)}</span>
                      {hasDiscount && <span className="text-[10px] text-slate-500 line-through">{fmt(originalPrice)}</span>}
                      <span className="text-[10px] text-slate-500">/ dag</span>
                    </div>
                    <div className="mt-auto pt-0.5">
                      <div className="w-full text-center bg-amber-500 group-hover:bg-amber-600 text-slate-900 text-[10px] font-black py-2 px-2 rounded-lg transition-colors">
                        {t("Direct boeken →", "Book now →", "Hemen rezervasyon →")}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function HomeSection({
  onSearch,
  setActiveTab,
  // Fallback-labels (alleen zichtbaar in de adminbeheer + als de live prijs
  // ontbreekt); de kaart zelf toont altijd de live "vanaf"-prijs. Consistent
  // "v.a."-formaat en één schaarlift-vanafprijs (€49, ook in SEO/marketing).
  customCategories = [
    { id: "aanhanger", label: "\"Tow & Go\" Aanhangerhoogwerker", listLabel: "\"Tow & Go\" Aanhangerhoogwerkers", desc: "", heights: "12m - 17m", price: "v.a. €80/dag" },
    { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "", heights: "15m - 17m", price: "v.a. €160/dag" },
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "", heights: "6m - 10m", price: "v.a. €49/dag" },
    { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "", heights: "5m - 10m", price: "v.a. €75/dag" },
    { id: "kamersteiger", label: "Kamersteiger", listLabel: "Kamersteigers", desc: "", heights: "4m", price: "v.a. €35/dag" },
    { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "", heights: "18m - 21m", price: "v.a. €90/dag" },
    { id: "ecolift", label: "Pecolift", listLabel: "Pecolift", desc: "", heights: "4.2m", price: "v.a. €45/dag" },
  ]
}: HomeSectionProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);
  const machines = useAppStore((state) => state.machines);
  const campaignRules = useAppStore((state) => state.campaignRules);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);

  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
      a: t("Onze tarieven zijn standaard exclusief 21% BTW. Via de BTW-knop bovenaan het assortiment schakelt u eenvoudig naar inclusief BTW om het werkelijke bedrag te zien.",
          "Our rates are standard excluding 21% VAT. Use the VAT toggle at the top of the assortment to switch to including VAT.",
          "Fiyatlarımız standart olarak %21 KDV hariçtir. Katalog sayfasının üstündeki KDV düğmesiyle KDV dahil fiyatı görebilirsiniz.")
    },
    {
      q: t("Wat zijn de bezorg- en transportkosten?", "What are delivery and transport costs?", "Teslimat ve nakliye ücretleri nelerdir?"),
      a: t("Bezorging door ons: €150 all-in (heen en retour). Aanhanger huren: €25 per dag. Zelf ophalen in Zoeterwoude is gratis.",
          "Delivery by us: €150 all-in (incl. return). Trailer rental: €25/day. Self pickup in Zoeterwoude is free.",
          "Bizim tarafımızdan teslimat: €150 (gidiş-dönüş dahil). Römork kiralama: günlük €25. Zoeterwoude'dan kendi teslim alma ücretsizdir.")
    },
    {
      q: t("Is er een borg of aanbetaling vereist?", "Is a deposit required?", "Depozito gerekli mi?"),
      a: t("Nee, wij werken volledig zonder borg. U betaalt alleen de huursom via iDEAL of Tikkie na bevestiging van uw boeking via WhatsApp.",
          "No, we work entirely without a deposit. You only pay the rental amount via iDEAL or Tikkie after confirming your booking via WhatsApp.",
          "Hayır, tamamen depozitosuz çalışıyoruz. WhatsApp üzerinden rezervasyonunuz onaylandıktan sonra sadece kira tutarını iDEAL veya Tikkie ile ödersiniz.")
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
  const weeklyOfferMachines = React.useMemo(() => activeMachines.filter(m => m.showInWeeklyOffers === true), [activeMachines]);

  // Live pricing per category (schaarlift/schaarlift-smal/schaarlift-6m share one
  // "schaarlift" key, since the card represents the whole 6/8/10m family). Every
  // field — including the card photo — comes from ONE representative machine,
  // never mixed across different units, so the photo, price and badge on a card
  // always describe the same real, bookable product.
  //
  // Rule: the CHEAPEST active machine in the category always wins the card
  // (by effective day price, i.e. after any sitewide/category campaign discount
  // — the real payable amount). A pricier unit's own promo (1-day actie, its
  // own campaign) never bumps it ahead of a genuinely cheaper unit — a "v.a."
  // (starting from) price that isn't actually the lowest in the category would
  // mislead. The winner's OWN badge (if it happens to have a 1-day actie,
  // product/category campaign, or ≥5% weekly-tier discount) is still shown —
  // deals aren't hidden, they just never override which unit represents the card.
  const categoryMeta = React.useMemo(() => {
    type Badge = "dag" | "actie" | "tier" | "none";
    type Meta = { price: number; count: number; badge: Badge; badgePct: number; image: string };
    type Candidate = { effective: number; badge: Badge; badgePct: number; image: string };
    const winners: Record<string, Candidate> = {};
    const counts: Record<string, number> = {};

    activeMachines.forEach(m => {
      const key = SCHAARLIFT_VARIANTS.has(m.category) ? "schaarlift" : m.category;
      counts[key] = (counts[key] ?? 0) + 1;

      let globalPct = 0;
      let specialPct = m.campaignDiscountPercent ?? 0;
      for (const rule of campaignRules) {
        if (!rule.isActive) continue;
        if (rule.scope === "global") { globalPct = Math.max(globalPct, rule.discountPercent); continue; }
        const matches = (rule.scope === "category" && m.category.toLowerCase() === rule.scopeValue.toLowerCase())
          || (rule.scope === "product" && m.id === rule.scopeValue);
        if (matches) specialPct = Math.max(specialPct, rule.discountPercent);
      }

      let specialEffective = m.pricePerDay * (1 - specialPct / 100);
      if (m.campaignDiscountAmount) specialEffective = Math.max(0, specialEffective - m.campaignDiscountAmount);
      const specialDiscountPct = m.pricePerDay > 0 ? Math.round((1 - specialEffective / m.pricePerDay) * 100) : 0;

      let effective = m.pricePerDay * (1 - Math.max(specialPct, globalPct) / 100);
      if (m.campaignDiscountAmount) effective = Math.max(0, effective - m.campaignDiscountAmount);

      const dagActiePct = m.oneDayPrice && m.oneDayPrice > 0 && m.oneDayPrice < m.pricePerDay
        ? Math.round((1 - m.oneDayPrice / m.pricePerDay) * 100)
        : 0;

      let badge: Badge;
      let badgePct: number;
      if (dagActiePct > 0) {
        badge = "dag"; badgePct = dagActiePct;
      } else if (specialDiscountPct > 0 || m.campaignDiscountAmount) {
        badge = "actie"; badgePct = specialDiscountPct;
      } else {
        // kamersteiger's "day" price field is really its flat week rate (see
        // WEEKLY_PRICED_CATEGORIES), so a day-vs-week comparison there would be
        // comparing the same number to itself — skip the tier badge for it.
        const weekly = WEEKLY_PRICED_CATEGORIES.has(m.category) ? 0 : computeDiscounts(m).weekly;
        badge = weekly >= 5 ? "tier" : "none"; badgePct = weekly;
      }

      const current = winners[key];
      if (!current || effective < current.effective) {
        const image = m.imageUrl || m.additionalImages?.[0] || "";
        winners[key] = { effective, badge, badgePct, image };
      }
    });

    const map: Record<string, Meta> = {};
    Object.entries(winners).forEach(([key, w]) => {
      map[key] = { price: w.effective, count: counts[key], badge: w.badge, badgePct: w.badgePct, image: w.image };
    });
    return map;
  }, [activeMachines, campaignRules]);

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

      {/* ── HERO BANNER — clean background photo + crisp HTML text overlay ──
          Text/icons are rendered as HTML (not baked into the image) so they
          stay razor-sharp at any resolution/zoom and are translatable. Upload
          a TEXT-FREE photo in Admin → Customizer for the best result. */}
      <div className="relative bg-slate-900 h-[240px] sm:h-[480px] lg:h-[540px]">
        {/* Image + decorative layers clipped so Ken Burns / glows don't escape */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Show fallback image immediately — eliminates the skeleton flash on first
              visit. This is the LCP element, so it renders at full opacity (no fade —
              a fade-in delays measured LCP) with fetchpriority=high. The default hero
              is served as a preloaded WebP <picture>; an admin-configured hero comes
              from /site-hero-image (base64) or an external URL. */}
          {(siteConfigLoaded && siteConfig.heroImageUrl) ? (
            siteConfig.heroImageUrl === "/site-hero-image" ? (
              // Admin hero via the sharp proxy — request responsive widths so mobile
              // gets ~768w (~70 KB) instead of the full-width image. Matches the
              // server-injected preload's imagesrcset.
              <img
                src="/site-hero-image?w=1600"
                srcSet="/site-hero-image?w=768 768w, /site-hero-image?w=1280 1280w, /site-hero-image?w=1600 1600w"
                sizes="100vw"
                alt=""
                fetchPriority="high"
                decoding="async"
                className="w-full h-full block object-cover animate-kenburns [object-position:80%_center] sm:[object-position:85%_center] [transform-origin:80%_center] sm:[transform-origin:85%_center]"
              />
            ) : (
              <img
                src={siteConfig.heroImageUrl}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="w-full h-full block object-cover animate-kenburns [object-position:80%_center] sm:[object-position:85%_center] [transform-origin:80%_center] sm:[transform-origin:85%_center]"
              />
            )
          ) : (
            <picture>
              <source type="image/webp" srcSet="/hero-huurgo-v2-640.webp 640w, /hero-huurgo-v2.webp 1024w" sizes="100vw" />
              <img
                src="/hero-huurgo-v2.jpg"
                alt=""
                fetchPriority="high"
                decoding="async"
                className="w-full h-full block object-cover animate-kenburns [object-position:80%_center] sm:[object-position:85%_center] [transform-origin:80%_center] sm:[transform-origin:85%_center]"
              />
            </picture>
          )}

          {/* Readability scrim — darker toward the bottom-left where the text sits */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/45 to-black/10 pointer-events-none" />

          {/* Ambient brand glows — drift slowly to give the dark hero subtle,
              premium life without hurting text contrast (low opacity + blur). */}
          <div className="float-slow pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-orange-500/25 blur-[90px] mix-blend-screen" aria-hidden="true" />
          <div className="float-slow pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-emerald-400/15 blur-[90px] mix-blend-screen" style={{ animationDelay: "-3.5s" }} aria-hidden="true" />

          {/* Soft bottom feather — eases the hard cut into the white section below */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Overlay content — outside overflow-hidden so the logo dot is never clipped */}
        <div className="absolute inset-0 flex items-end pointer-events-none">
          <div className="px-5 sm:px-8 lg:px-14 pb-5 sm:pb-7 lg:pb-9 w-full max-w-2xl">
            {/* Brand wordmark in its original logo form, with tagline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-2.5 sm:mb-3.5"
            >
              <span className="inline-block text-2xl sm:text-3xl lg:text-4xl drop-shadow-sm">
                <HuurGoText />
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.07 }}
              className="font-display font-black italic tracking-tight text-white leading-[0.95] text-2xl sm:text-5xl lg:text-6xl drop-shadow-sm"
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

            {/* Compact mobile trust row — fills the previously empty space under
                the headline on phones; desktop keeps the fuller version above.
                Fixed 3-col grid so the labels can never overflow narrow screens. */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14 }}
              className="grid grid-cols-3 gap-2 sm:hidden mt-3"
            >
              {[
                { Icon: Clock, label: t("Online boeken", "Book online", "Online kirala") },
                { Icon: Truck, label: t("Snelle levering", "Fast delivery", "Hızlı teslimat") },
                { Icon: UserRound, label: t("Voor iedereen", "For everyone", "Herkes için") },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/90 text-white">
                    <Icon className="h-3 w-3" strokeWidth={2.4} />
                  </span>
                  <span className="text-[10px] font-semibold text-white/90 leading-tight truncate">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── HERO TEXT + CTA — centered single column ── */}
      <div className="relative bg-white px-5 sm:px-6 pt-10 pb-8 border-b border-slate-100 overflow-hidden">
        {/* Soft ambient glow — drifts gently behind the headline for depth */}
        <div className="float-slow pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-orange-500/10 blur-[90px] -z-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl text-center space-y-3.5">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700"
          >
            {t("heroTagline")}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.07 }}
            className="font-display text-2xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight"
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
          {/* Primaire CTA naar de catalogus + secundaire WhatsApp-knop. De
              catalogus-knop is bewust de meest opvallende: boeken is het doel,
              WhatsApp het vangnet voor twijfelaars. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5"
          >
            <button
              onClick={() => onSearch("", "")}
              className="cta-shine inline-flex items-center justify-center gap-2 w-full sm:w-auto py-3.5 px-7 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
            >
              <span>{t("Bekijk alle machines", "View all machines", "Tüm makineleri görüntüle")}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
            <a
              href={buildWhatsAppGeneralUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white border border-slate-200 hover:border-[#25D366] text-slate-700 font-bold text-sm transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] no-underline"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[#25D366]" />
              <span>{t("Direct advies via WhatsApp", "Direct advice via WhatsApp", "WhatsApp'tan hemen danışın")}</span>
            </a>
          </motion.div>

          {/* Trust badges direct onder de CTA's — echte score/cijfers only */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
            className="pt-3"
          >
            <TrustBadges />
          </motion.div>
        </div>
      </div>

      {/* ── DEALS CAROUSEL ── */}
      {weeklyOfferMachines.length > 0 && <DealsCarousel machines={weeklyOfferMachines} onSearch={onSearch} />}

      {/* ── CATEGORY CARDS ── */}
      <div className="bg-gradient-to-b from-white to-slate-50 px-4 sm:px-6 pt-10 pb-14">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="font-display font-black text-lg sm:text-xl text-slate-900 leading-tight">
              {t("Kies uw machine", "Choose your machine", "Makinenizi seçin")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("Alle categorieën in één overzicht", "All categories at a glance", "Tüm kategoriler bir bakışta")}
            </p>
          </div>
          <VatToggle />
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {displayCategories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Truck;
            const meta = categoryMeta[cat.id];
            const catImage = meta?.image || "";
            const fallbackGradient = CAT_GRADIENT[cat.id] ?? "from-slate-100 to-slate-200";
            const hasBadge = !!(meta && meta.badge !== "none");

            return (
              <button
                key={cat.id}
                onClick={() => onSearch("", cat.id)}
                className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden text-left cursor-pointer hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 flex flex-col"
              >
                {/* Discount badge — pinned to the card's own top-right corner
                    instead of sharing a row with the price. The title below
                    reserves right-padding so a short name never runs under it;
                    a long name (line-clamp-2) simply wraps to its own second
                    line, which has full width since the badge only occupies
                    the first line's corner. Mobile is now 2-across (the old
                    full-width single column made this section ~40% of the
                    whole page), so both breakpoints use the same compact
                    sizing with only minor mobile bumps for tap targets. */}
                {meta && meta.badge !== "none" && (
                  <span
                    className={`absolute top-2 right-2 sm:top-1.5 sm:right-1.5 z-10 inline-flex items-center gap-0.5 rounded-full pl-2 pr-2.5 sm:pl-1.5 sm:pr-2 py-1 sm:py-0.5 text-[10px] sm:text-[9px] font-black text-white shadow-md ring-1 ring-white/40 ${
                      meta.badge === "tier"
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-500/25"
                        : "bg-gradient-to-r from-rose-600 to-red-500 shadow-rose-500/25"
                    }`}
                  >
                    <Zap className="h-2.5 w-2.5 sm:h-2 sm:w-2 shrink-0 fill-current" />
                    <span>{`−${meta.badgePct}%`}</span>
                  </span>
                )}
                <div className="p-3 sm:p-3.5 flex flex-col min-w-0">
                  <p className={`font-display font-black text-[13px] sm:text-sm text-slate-900 leading-snug line-clamp-2 mb-1.5 ${hasBadge ? "pr-11 sm:pr-14" : ""}`}>
                    {cat.listLabel || cat.label}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-2">
                    <span className="font-semibold text-slate-500 text-[11px] sm:hidden">{cat.heights}</span>
                    <span className="text-slate-300 select-none sm:hidden">•</span>
                    <span className="font-black text-emerald-700 text-xs leading-tight">
                      {(() => {
                        if (!meta) return "Prijs op aanvraag";
                        const v = withVat(meta.price, vatDisplay);
                        const fmt = v % 1 === 0 ? Math.round(v).toLocaleString("nl-NL") : v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const unit = WEEKLY_PRICED_CATEGORIES.has(cat.id) ? "week" : "dag";
                        return `€${fmt}/${unit}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[11px] sm:text-[10px] font-bold text-orange-700 group-hover:text-orange-800 group-hover:gap-1 transition-all duration-300">
                      <span>{t("Bekijk", "View", "Görüntüle")}</span>
                      <ChevronRight className="h-3 w-3" />
                    </span>
                    {meta && meta.count > 1 && (
                      <span className="sm:hidden text-[10px] text-slate-500 font-medium shrink-0">
                        {t(`${meta.count} modellen`, `${meta.count} models`, `${meta.count} model`)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom — wide machine photo on a pure white background so the
                    white-background product photos sit flush with no grey halo */}
                <div className="relative w-full aspect-[4/3] overflow-hidden border-t border-slate-100 bg-white">
                  <CardBrandWatermark />
                  {catImage ? (
                    <img
                      src={withImageWidth(catImage, 480) ?? catImage}
                      alt={cat.label}
                      className="w-full h-full object-contain p-2 sm:p-1.5 transition-transform duration-500 ease-out group-hover:scale-105"
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
                    <Icon className="h-8 w-8 sm:h-6 sm:w-6 text-slate-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── MERKEN-STRIP — muted wordmarks van de echte vloot ── */}
        <div className="max-w-5xl mx-auto mt-12">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3.5">
            {t("Onze merken", "Our brands", "Markalarımız")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
            {FLEET_BRANDS.map((brand) => (
              <span key={brand} className="font-display font-black text-base sm:text-lg uppercase tracking-wider text-slate-500 select-none">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOE WERKT HUREN? — vier stappen ── */}
      <HowItWorksSection />

      {/* ── ADVIESTOOL ENTRY ── */}
      <div className="px-4 sm:px-6 pt-2 pb-12">
        <div className="max-w-2xl mx-auto">
          <AdviesStrip tall />
        </div>
      </div>

      {/* ── WAAROM HUURGO — trustband (verhuisd uit de footer) ── */}
      <WhyHuurGoBand />

      {/* ── FAQ SECTION ── */}
      <div className="bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-7">
            <h2 className="font-display font-black text-xl text-slate-900">{t("Veelgestelde vragen", "Frequently asked questions", "Sık sorulan sorular")}</h2>
            <p className="text-xs text-slate-500 mt-1">{t("Alles wat u wilt weten over hoogwerker huren", "Everything you need to know about renting aerial lifts", "Yüksek erişim kiralama hakkında bilmeniz gerekenler")}</p>
          </div>
          {/* Homepage toont bewust maar 3 vragen — de volledige lijst (incl.
              admin-beheerde items) staat op /veelgestelde-vragen. */}
          <div className="space-y-2.5">
            {FAQ_ITEMS.slice(0, 3).map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="no-press w-full flex items-center justify-between px-4 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
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
          <div className="text-center mt-5">
            <button
              type="button"
              onClick={() => setActiveTab("veelgestelde-vragen")}
              className="inline-flex items-center gap-1 text-sm font-bold text-orange-700 hover:text-orange-900 transition-colors cursor-pointer bg-transparent border-none"
            >
              {t("Alle vragen", "All questions", "Tüm sorular")} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── COFFEE CORNER — admin-editable, hidden until enabled in Customizer ── */}
      <CoffeeCornerSection />

      {/* ── PHOTO GALLERY — admin-editable, hidden until enabled in Customizer ── */}
      <PhotoGallerySection />

    </div>
  );
}
