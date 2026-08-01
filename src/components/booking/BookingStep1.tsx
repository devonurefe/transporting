/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Calendar, Building2, X, Truck, ShieldAlert, ArrowRight, MessageCircle, ChevronLeft, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CartItem, DeliveryType, Machine } from "../../types";
import { buildWhatsAppUrl, buildWhatsAppTransportInquiryUrl, buildWhatsAppAlternativeDatesUrl } from "../../utils/whatsapp";
import { withImageWidth } from "../../utils/image";
import BookingPriceSummary from "./BookingPriceSummary";
import DateRangeCalendar from "./DateRangeCalendar";
import { useLanguageStore } from "../../store/languageStore";
import { useAppStore } from "../../store/appStore";
import MachineDetailModal from "../MachineDetailModal";
import { euroCompact } from "../../utils/format";
import { getTransportFees, getGlobalAddons, calculateRentalDays } from "../../utils/pricing";

// Categories the global add-ons never apply to. "safety" (Veiligheidsset Pro) only
// excludes ladderlift (a furniture-moving lift, not a working-at-height platform);
// "rijplaten" (ground protection plates) also excludes the trailer-mounted "Toe &
// Go" units, the Kamersteiger and the Pecolift, which never drive onto soft/sloped
// terrain. Mirrored by server/routes/orders.ts — keep identical.
const GLOBAL_ADDON_EXCLUDED_CATEGORIES: Record<"safety" | "rijplaten", string[]> = {
  safety: ["ladderlift"],
  rijplaten: ["aanhanger", "kamersteiger", "ecolift", "ladderlift"],
};

// Nifty 120/170 ("aanhanger" category) and Ladderlift are themselves towed
// behind the customer's own vehicle — renting an additional trailer to move
// a product that already hitches to a tow bar makes no sense. Mirrored by
// server/routes/orders.ts (TRAILER_RENTAL_EXCLUDED_CATEGORIES) — keep identical.
const TRAILER_RENTAL_EXCLUDED_CATEGORIES = ["aanhanger", "ladderlift"];

interface BookingStep1Props {
  cartItems: CartItem[];
  getItemAvailability: (machineId: string, start: string, end: string) => { available: boolean; reason: string };
  onRemoveCartItem: (id: string) => void;
  onUpdateCartItemDates: (id: string, start: string, end: string) => void;
  deliveryType: DeliveryType;
  setDeliveryType: (type: DeliveryType) => void;
  setDeliveryAddress: (address: string) => void;
  selectedAddons: string[];
  setSelectedAddons: (addons: string[]) => void;
  rijplatenQty: number;
  setRijplatenQty: (qty: number) => void;
  trailerDays: number;
  setTrailerDays: (days: number) => void;
  validationError: string | null;
  setValidationError: (err: string | null) => void;
  isAvailable: boolean;
  handleNextStep: () => void;
  setActiveTab: (tab: string) => void;
  customerProfile: string;
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; deliveryType?: string; trailerDays?: number;
    weekendDays?: number; sundayBlockTotal?: number; effectiveDailyRate?: number | null;
    tierLabel?: string | null; isFlatRate?: boolean;
    weeklyBreakdown?: { weeks: number; pricePerWeek: number; remainder: number; dailyRate: number; remainderCost?: number } | null;
    campaignSavings?: number;
  };
  selectedMachine?: Machine | null;
  deliveryDistanceKm?: number | null;
  deliveryTimeSlot: string;
  setDeliveryTimeSlot: (slot: string) => void;
  deliveryAddress?: string;
}

export default function BookingStep1({
  cartItems,
  getItemAvailability,
  onRemoveCartItem,
  onUpdateCartItemDates,
  deliveryType,
  setDeliveryType,
  setDeliveryAddress,
  selectedAddons,
  setSelectedAddons,
  rijplatenQty,
  setRijplatenQty,
  trailerDays,
  setTrailerDays,
  validationError,
  setValidationError,
  isAvailable,
  handleNextStep,
  setActiveTab,
  customerProfile,
  sums,
  selectedMachine,
  deliveryDistanceKm,
  deliveryTimeSlot,
  setDeliveryTimeSlot,
  deliveryAddress,
}: BookingStep1Props) {
  const t = useLanguageStore((state) => state.t);
  const vatDisplay = useAppStore((state) => state.vatDisplay);
  const [previewMachine, setPreviewMachine] = useState<Machine | null>(null);
  // Expandable long-form explanation for the Rijplaten add-on (kept collapsed by
  // default so the compact add-on card stays readable).
  const [rijplatenInfoOpen, setRijplatenInfoOpen] = useState(false);
  // Local draft text for the free-entry plate-count field. Kept as a string so the
  // customer can clear it and type any number without the value snapping back on
  // every keystroke; it's normalised (min 1, default 4) on blur.
  const [rijplatenQtyText, setRijplatenQtyText] = useState(String(rijplatenQty || 4));
  // Lokale draft-tekst voor het aanhanger-dagenveld. Start leeg bij 0 zodat de
  // klant een bewuste keuze maakt (min 1 is verplicht om door te gaan).
  const [trailerDaysText, setTrailerDaysText] = useState(trailerDays > 0 ? String(trailerDays) : "");
  // Set once the customer tries to proceed — gates the red "missing field"
  // highlights below so they never show before the first attempt.
  const [attempted, setAttempted] = useState(false);

  const timeSlotBlocked = deliveryType === "delivery_by_us" && !deliveryTimeSlot;
  // Bovengrens = de huurperiode van het EERSTE cart-item (de aanhanger wordt alleen
  // op item 0 berekend, en de server clampt op dat item z'n rentalDays). Niet
  // sums.days gebruiken — dat is de som over álle cart-items en zou bij meerdere
  // machines te hoog zijn, waardoor de server-validatie de order zou weigeren.
  const leadTrailerDays = (cartItems[0]?.startDate && cartItems[0]?.endDate)
    ? calculateRentalDays(cartItems[0].startDate, cartItems[0].endDate)
    : 0;
  // No "|| 365" fallback here: before the lead item has dates, leadTrailerDays
  // is legitimately 0 and the cap should reflect that (1), not a made-up
  // ceiling — showing "Maximaal 365 dagen" to a customer who hasn't even
  // chosen a rental period yet was the actual bug being fixed here.
  const maxTrailerDays = Math.max(1, leadTrailerDays);
  // Aanhanger geselecteerd maar nog geen (geldig) aantal dagen gekozen, of een
  // aantal boven de huidige huurperiode — kan voorkomen tussen het inkorten van
  // de huurdatums in dit scherm en de clamp-effect hieronder die bijstuurt op
  // de volgende render. Blokkeer het doorgaan net als de verplichte
  // bezorgtijdslot-keuze hierboven, in plaats van een generieke servermelding.
  const trailerBlocked = deliveryType === "trailer_rental" && (trailerDays < 1 || trailerDays > maxTrailerDays);

  // Keep trailerDays valid if the lead item's rental period shrinks after it
  // was set (e.g. picking 7 days, choosing a 7-day trailer, then editing the
  // dates down to 3) — without this it silently stays over the new max until
  // final submit rejects it server-side with a generic "Ongeldig aantal
  // aanhangerdagen", far from where the mismatch actually happened.
  useEffect(() => {
    if (trailerDays > maxTrailerDays) {
      setTrailerDays(maxTrailerDays);
      setTrailerDaysText(String(maxTrailerDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxTrailerDays]);

  // Admin-instelbare tarieven (SiteConfig → AdminContent); defaults = de oude literals
  const siteConfig = useAppStore((state) => state.siteConfig);
  const fees = getTransportFees(siteConfig);
  const gAddons = getGlobalAddons(siteConfig);

  // The error banner/highlights above reflect a validation snapshot from the
  // last click — once the customer actually fixes the thing it complained
  // about, clear it immediately instead of leaving a stale message on screen.
  useEffect(() => {
    if (validationError) setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryTimeSlot, deliveryType, cartItems.length, deliveryDistanceKm, trailerDays]);

  // Reservation period for the price summary — neutral copy when the cart
  // mixes machines booked for different periods.
  const leadItem = cartItems[0];
  const mixedPeriods = cartItems.length > 1 && cartItems.some(
    (i) => i.startDate !== leadItem?.startDate || i.endDate !== leadItem?.endDate
  );

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer bg-transparent border-none p-0 font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Terug naar het assortiment
          </button>
        </div>
        <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-slate-700" />
          <span>{t("step1Title")}</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">{t("step1Subtitle")}</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="text-center py-10 space-y-4">
          <div className="mx-auto h-12 w-12 bg-slate-100 text-slate-500 flex items-center justify-center rounded-full shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-sm">{t("step1EmptyCart")}</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {t("step1EmptyCartSub")}
            </p>
          </div>
          <button
            onClick={() => setActiveTab("catalog")}
            className="bg-slate-800 hover:bg-slate-900 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all border-none cursor-pointer"
          >
            {t("step1BrowseCatalog")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cartItems.map((item) => {
            const availability = getItemAvailability(item.machine.id, item.startDate || "", item.endDate || "");
            return (
              <div key={item.id} className="relative p-4 rounded-2xl bg-slate-50/50 border border-slate-200 space-y-5 shadow-sm">
                {/* X — absolute top-right, never overlaps the name */}
                <button
                  type="button"
                  onClick={() => onRemoveCartItem(item.id)}
                  className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors border-none cursor-pointer"
                  title="Verwijderen"
                  aria-label="Verwijderen uit winkelwagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-start gap-3 pr-10">
                  <div
                    className="h-20 w-20 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm cursor-pointer hover:ring-2 hover:ring-slate-400 transition-all relative group/thumb"
                    onClick={() => setPreviewMachine(item.machine)}
                    title="Bekijk details"
                  >
                    <img
                      src={withImageWidth(item.machine.imageUrl, 320) || item.machine.additionalImages?.[0] || "/placeholder-machine.webp"}
                      alt={item.machine.name}
                      className="object-contain h-full w-full p-1.5 group-hover/thumb:scale-110 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-machine.webp";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors duration-200 rounded-2xl" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{item.machine.name}</h4>
                  </div>
                </div>

                {/* Pill — full card width, same as calendar below */}
                <button
                  type="button"
                  onClick={() => setPreviewMachine(item.machine)}
                  className="w-full flex justify-center items-center gap-1.5 text-xs bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 hover:border-orange-300 font-bold px-3 py-2.5 mt-1 rounded-full cursor-pointer transition-colors"
                >
                  Tarieven &amp; specificaties →
                </button>

                <div className="pt-3 border-t border-slate-200">
                  <DateRangeCalendar
                    machine={item.machine}
                    startDate={item.startDate}
                    endDate={item.endDate}
                    profile={customerProfile}
                    onConfirm={(s, e) => onUpdateCartItemDates(item.id, s, e)}
                  />
                </div>

                {/* Item Availability status bar — only shown for a genuine conflict on
                    chosen dates. A plain "available" state and the not-yet-picked state
                    both stay silent, so the pill + calendar above get the visual room
                    (the calendar's own "Selecteer periode" placeholder already covers
                    that hint) instead of a default green/red banner. */}
                {!availability.available && item.startDate && item.endDate && (
                  <div className="p-2.5 rounded-xl border text-xs flex items-center space-x-2 shadow-sm bg-rose-50 border-rose-200 text-rose-700 font-semibold">
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                    <span className="font-semibold">{availability.reason}</span>
                  </div>
                )}

                {/* WhatsApp fallback only for a genuine conflict on chosen dates —
                    not shown while the customer simply hasn't picked a period yet. */}
                {!availability.available && item.startDate && item.endDate && (
                  <a
                    href={buildWhatsAppAlternativeDatesUrl(item.machine.name, item.startDate, item.endDate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Overleg datums via WhatsApp</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Logistical preference setup */}
      <div className="space-y-3 pt-4 border-t-2 border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t("step1TransportOpts")}</h3>

        {selectedMachine?.pickupOnly ? (
          /* Pickup-only product — no delivery or trailer options */
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-400 ring-1 ring-slate-200 space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-slate-200">
                <Building2 className="h-4 w-4 text-slate-800" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Afhalen in Zoeterwoude</h4>
                <span className="text-xs text-slate-500 block">Depot — gratis</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dankzij de compacte afmetingen past dit product eenvoudig in een personenauto of kleine
              bestelwagen — u kunt het zelf gemakkelijk vervoeren.
            </p>
            <span className="text-sm font-black text-emerald-700 block">Kosteloos</span>
          </div>
        ) : (
        <div className={`grid grid-cols-1 ${
          !!selectedMachine && TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes(selectedMachine.category) ? "sm:grid-cols-2" : "sm:grid-cols-3"
        } gap-3`}>
          {/* Opt 1 — Wij bezorgen */}
          <button
            type="button"
            onClick={() => setDeliveryType("delivery_by_us")}
            aria-pressed={deliveryType === "delivery_by_us"}
            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
              deliveryType === "delivery_by_us"
                ? "bg-slate-50 border-slate-400 ring-1 ring-slate-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${deliveryType === "delivery_by_us" ? "bg-slate-200" : "bg-slate-100"}`}>
                <Truck className={`h-4 w-4 ${deliveryType === "delivery_by_us" ? "text-slate-800" : "text-slate-500"}`} />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Wij bezorgen</h4>
                <span className="text-xs text-slate-500 block">Binnen 20 km straal</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              Wij leveren de machine af en halen hem terug op.
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-sm font-black text-emerald-700">{euroCompact(fees.deliveryFee)}</span>
              <span className="text-xs text-slate-500 font-semibold">heen + terug</span>
            </div>
            {deliveryType === "delivery_by_us" && (!selectedMachine || !TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes(selectedMachine.category)) && (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-px" />
                <p className="text-xs text-amber-800 font-semibold leading-snug">
                  Tip: huur zelf een aanhanger en bespaar {euroCompact(fees.deliveryFee)} transportkosten.
                </p>
              </div>
            )}
          </button>

          {/* Opt 2 — Aanhanger huren (niet relevant voor producten die zelf al
              achter een voertuig getrokken worden — Nifty aanhanger-groep,
              Ladderlift) */}
          {(!selectedMachine || !TRAILER_RENTAL_EXCLUDED_CATEGORIES.includes(selectedMachine.category)) && (
          <button
            type="button"
            onClick={() => {
              setDeliveryType("trailer_rental");
              setDeliveryAddress("");
              setDeliveryTimeSlot("");
            }}
            aria-pressed={deliveryType === "trailer_rental"}
            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
              deliveryType === "trailer_rental"
                ? "bg-slate-50 border-slate-400 ring-1 ring-slate-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${deliveryType === "trailer_rental" ? "bg-slate-200" : "bg-slate-100"}`}>
                <Truck className={`h-4 w-4 ${deliveryType === "trailer_rental" ? "text-slate-800" : "text-slate-500"}`} />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Aanhanger huren</h4>
                <span className="text-xs text-slate-500 block">Eigen auto, onze aanhanger</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              U rijdt zelf met uw eigen voertuig en onze aanhanger.
            </p>
            {/* Prijs hangt af van het aantal gekozen dagen (kiezer verschijnt
                hieronder zodra deze optie is geselecteerd). */}
            {deliveryType === "trailer_rental" && trailerDays > 0 ? (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-sm font-black text-emerald-700">{euroCompact(trailerDays * fees.trailerPerDay)}</span>
                <span className="text-xs text-slate-500 font-semibold">({trailerDays} {trailerDays === 1 ? "dag" : "dgn"} × {euroCompact(fees.trailerPerDay)})</span>
              </div>
            ) : (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-sm font-black text-emerald-700">{euroCompact(fees.trailerPerDay)}/dag</span>
                <span className="text-xs text-slate-500 font-semibold">u kiest het aantal dagen</span>
              </div>
            )}
          </button>
          )}

          {/* Opt 3 — Zelf ophalen */}
          <button
            type="button"
            onClick={() => {
              setDeliveryType("self_pickup");
              setDeliveryAddress("");
              setDeliveryTimeSlot("");
            }}
            aria-pressed={deliveryType === "self_pickup"}
            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
              deliveryType === "self_pickup"
                ? "bg-slate-50 border-slate-400 ring-1 ring-slate-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${deliveryType === "self_pickup" ? "bg-slate-200" : "bg-slate-100"}`}>
                <Building2 className={`h-4 w-4 ${deliveryType === "self_pickup" ? "text-slate-800" : "text-slate-500"}`} />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Zelf ophalen</h4>
                <span className="text-xs text-slate-500 block">Zoeterwoude depot</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              Ophalen bij ons depot — gratis.
            </p>
            <span className="text-sm font-black text-emerald-700 mt-2 block">Kosteloos</span>
          </button>
        </div>
        )}
      </div>

      {/* Distance >20 km — prijs op aanvraag, checkout blocked */}
      {deliveryDistanceKm && deliveryDistanceKm > 20 && deliveryType === "delivery_by_us" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Buiten 20 km — Prijs op aanvraag</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                Uw bezorgadres ligt ±{deliveryDistanceKm} km van ons depot in Zoeterwoude.
                Voor bezorging op maat hanteren wij een maatwerkprijs — neem contact op via WhatsApp.
              </p>
            </div>
          </div>
          <a
            href={buildWhatsAppTransportInquiryUrl(cartItems, deliveryAddress ?? '', deliveryDistanceKm)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-bold rounded-xl transition-colors"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            Vraag offerte aan via WhatsApp
          </a>
        </div>
      )}

      {/* Aanhanger — aantal dagen (alleen bij "Aanhanger huren"). De klant betaalt
          de aanhanger alleen voor de dagen die hij hem meeneemt, niet de hele
          huurperiode. Zelfde +/− kiezer-patroon als de Rijplaten-add-on. */}
      {deliveryType === "trailer_rental" && (
        <div className="space-y-3 pt-4 border-t-2 border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-800 font-bold">Aanhanger — aantal dagen</span>
            <span className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Verplicht</span>
          </div>
          <div className={`rounded-xl border p-4 transition-colors ${attempted && trailerBlocked ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-xs text-slate-600 leading-normal mb-3">
              U betaalt de aanhanger alleen voor de dagen dat u hem meeneemt (ophalen +
              terugbrengen), niet voor de hele huurperiode. Kies hieronder het aantal dagen.
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">Aantal dagen</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Eén dag minder"
                  onClick={() => {
                    const n = Math.max(0, (parseInt(trailerDaysText, 10) || 0) - 1);
                    setTrailerDays(n);
                    setTrailerDaysText(n > 0 ? String(n) : "");
                  }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-base leading-none hover:bg-slate-100 cursor-pointer"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={trailerDaysText}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setTrailerDaysText(raw);
                    if (raw !== "") setTrailerDays(Math.min(maxTrailerDays, parseInt(raw, 10)));
                    else setTrailerDays(0);
                  }}
                  onBlur={() => {
                    let n = parseInt(trailerDaysText, 10);
                    if (Number.isNaN(n) || n < 0) n = 0;
                    n = Math.min(maxTrailerDays, n);
                    setTrailerDays(n);
                    setTrailerDaysText(n > 0 ? String(n) : "");
                  }}
                  className="w-16 text-center text-sm font-bold text-slate-900 border border-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <button
                  type="button"
                  aria-label="Eén dag meer"
                  onClick={() => {
                    const n = Math.min(maxTrailerDays, (parseInt(trailerDaysText, 10) || 0) + 1);
                    setTrailerDays(n);
                    setTrailerDaysText(String(n));
                  }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-base leading-none hover:bg-slate-100 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {trailerDays > 0 ? (
                <>{trailerDays} {trailerDays === 1 ? "dag" : "dagen"} × {euroCompact(fees.trailerPerDay)} = <span className="font-bold text-slate-700">{euroCompact(trailerDays * fees.trailerPerDay)}</span></>
              ) : (
                <>Kies minimaal 1 dag · {euroCompact(fees.trailerPerDay)} per dag</>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Maximaal {maxTrailerDays} {maxTrailerDays === 1 ? "dag" : "dagen"} (uw huurperiode). Langer nodig? Neem contact op via WhatsApp.
            </p>
          </div>
          {attempted && trailerBlocked && (
            <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Kies minimaal 1 aanhangerdag om door te gaan
            </p>
          )}
        </div>
      )}

      {/* Delivery time slot — only for "Wij bezorgen" */}
      {deliveryType === "delivery_by_us" && (
        <div className="space-y-3 pt-4 border-t-2 border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-800 font-bold">Gewenst bezorgmoment</span>
            <span className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Verplicht</span>
          </div>
          <div className={`grid grid-cols-2 gap-3 rounded-xl border p-2 transition-colors ${attempted && timeSlotBlocked ? "border-rose-400 bg-rose-50/40" : "border-transparent"}`}>
            {[
              { id: "morning", label: "Ochtend", time: "07:00 – 09:00" },
              { id: "afternoon", label: "Middag", time: "13:00 – 17:00" },
            ].map(slot => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setDeliveryTimeSlot(slot.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  deliveryTimeSlot === slot.id
                    ? "bg-slate-50 border-slate-400 ring-1 ring-slate-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="text-xs font-bold text-slate-900 block">{slot.label}</span>
                <span className="text-xs text-slate-500 font-mono">{slot.time}</span>
              </button>
            ))}
          </div>
          {attempted && timeSlotBlocked && (
            <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Kies een bezorgmoment om door te gaan
            </p>
          )}
        </div>
      )}

      {/* Minimum-rental notice */}
      {selectedMachine?.weeklyOnly ? (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed flex items-start gap-2">
          <Calendar className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Dit product wordt <span className="font-bold">per week</span> verhuurd met een minimum van
            1 week. Kortere periodes worden afgerekend als een volledige week.
          </span>
        </div>
      ) : selectedMachine?.minRentalDays && selectedMachine.minRentalDays > 1 ? (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed flex items-start gap-2">
          <Calendar className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Minimale huurperiode voor dit product is <span className="font-bold">{selectedMachine.minRentalDays} dagen</span>.
            Selecteer een periode van minimaal {selectedMachine.minRentalDays} dagen.
          </span>
        </div>
      ) : null}

      {/* Extra opties */}
      <div className="space-y-3 pt-4 border-t-2 border-slate-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-800 font-bold">
            {selectedMachine?.crossSellAddons?.length ? "Handige accessoires voor uw klus" : t("step1AddonsTitle")}
          </span>
          <span className="text-xs text-slate-500">Optioneel</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Global safety set — not relevant for a furniture-moving ladderlift */}
          {!!selectedMachine && !GLOBAL_ADDON_EXCLUDED_CATEGORIES.safety.includes(selectedMachine.category) && (
          <label
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedAddons.includes("safety")
                ? "bg-slate-50 border-slate-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900">{gAddons.safety.name}</h4>
                <input
                  type="checkbox"
                  checked={selectedAddons.includes("safety")}
                  onChange={() => {
                    if (selectedAddons.includes("safety")) {
                      setSelectedAddons(selectedAddons.filter(x => x !== "safety"));
                    } else {
                      setSelectedAddons([...selectedAddons, "safety"]);
                    }
                  }}
                  className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                Luxe veiligheidsharnas combi, lijn met valdemper en TÜV goedgekeurde bouwhelm met gehoorbescherming.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700 mt-3 block">€{gAddons.safety.pricePerWeek},- / week (elke 7 dagen +€{gAddons.safety.pricePerWeek})</span>
          </label>
          )}

          {/* Ground protection plates — only for platforms that stand directly on the
              terrain; not relevant for a trailer unit, scaffolding, or manual lift. */}
          {!!selectedMachine && !GLOBAL_ADDON_EXCLUDED_CATEGORIES.rijplaten.includes(selectedMachine.category) && (
          <label
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedAddons.includes("rijplaten")
                ? "bg-slate-50 border-slate-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
            } ${
              // The grid is md:grid-cols-3 but often only the safety + rijplaten
              // cards render, leaving an unused third column — give rijplaten that
              // free width on desktop (mobile stays grid-cols-1, unaffected).
              "md:col-span-2"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900">Rijplaten <span className="font-semibold text-slate-500">(aantal naar keuze)</span></h4>
                <input
                  type="checkbox"
                  checked={selectedAddons.includes("rijplaten")}
                  onChange={() => {
                    if (selectedAddons.includes("rijplaten")) {
                      setSelectedAddons(selectedAddons.filter(x => x !== "rijplaten"));
                    } else {
                      setSelectedAddons([...selectedAddons, "rijplaten"]);
                      setRijplatenQty(4);
                      setRijplatenQtyText("4");
                    }
                  }}
                  className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                Bij een helling, drempel of oneffen terrein, op zachte ondergrond (zoals gras), of als u de
                ondergrond niet wilt beschadigen is het gebruik van rijplaten noodzakelijk.
              </p>

              {/* Quantity picker + info — only when the add-on is selected. Clicks here
                  must not bubble up to the card's toggle handler. */}
              {selectedAddons.includes("rijplaten") && (
                <div className="mt-3 pt-3 border-t border-slate-200" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">Aantal platen</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Eén minder"
                        onClick={() => {
                          const n = Math.max(1, (parseInt(rijplatenQtyText, 10) || 4) - 1);
                          setRijplatenQty(n);
                          setRijplatenQtyText(String(n));
                        }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-base leading-none hover:bg-slate-100 cursor-pointer"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={rijplatenQtyText}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                          setRijplatenQtyText(raw);
                          if (raw !== "") setRijplatenQty(Math.min(999, parseInt(raw, 10)));
                        }}
                        onBlur={() => {
                          let n = parseInt(rijplatenQtyText, 10);
                          if (Number.isNaN(n) || n < 1) n = 4;
                          n = Math.min(999, n);
                          setRijplatenQty(n);
                          setRijplatenQtyText(String(n));
                        }}
                        className="w-16 text-center text-sm font-bold text-slate-900 border border-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      />
                      <button
                        type="button"
                        aria-label="Eén meer"
                        onClick={() => {
                          const n = Math.min(999, (parseInt(rijplatenQtyText, 10) || 4) + 1);
                          setRijplatenQty(n);
                          setRijplatenQtyText(String(n));
                        }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-base leading-none hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {rijplatenQty} × €{gAddons.rijplaten.pricePerWeek},- = <span className="font-bold text-slate-700">€{rijplatenQty * gAddons.rijplaten.pricePerWeek},- per week</span>
                  </p>

                  <button
                    type="button"
                    onClick={() => setRijplatenInfoOpen((v) => !v)}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-transparent border-none p-0 cursor-pointer"
                  >
                    <Info className="h-3.5 w-3.5" />
                    {rijplatenInfoOpen ? "Minder info" : "Meer info — hoeveel platen heb ik nodig?"}
                  </button>

                  {rijplatenInfoOpen && (
                    <div className="mt-2 space-y-2 text-xs text-slate-600 leading-relaxed">
                      <p>
                        Het gebruik van rijplaten is essentieel voor een veilige, stabiele en efficiënte
                        werkomgeving. Eén enkele rijplaat is in de praktijk zelden voldoende. Kies het juiste
                        aantal op basis van uw situatie:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><span className="font-semibold text-slate-700">Bescherming van de ondergrond:</span> voorkom krassen, spoorvorming of verzakkingen aan beton, asfalt, bestrating of vloeren door de druk te verdelen.</li>
                        <li><span className="font-semibold text-slate-700">Zachte ondergrond &amp; wegzakken:</span> op onverhard terrein, modderige bodems of zandwegen creëren rijplaten een stabiele rijbaan naar de werkplek.</li>
                        <li><span className="font-semibold text-slate-700">Gazon en beplanting:</span> bescherm gras en tuinen tegen diepe sporen, zodat het terrein onbeschadigd achterblijft.</li>
                        <li><span className="font-semibold text-slate-700">Hellingscorrectie &amp; waterpas stellen:</span> op ongelijk terrein weigert de machine om veiligheidsredenen te stijgen — met (gestapelde) rijplaten onder de wielen stelt u de machine waterpas.</li>
                      </ul>
                      <div className="rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-sky-800">
                        <span className="font-bold">Advies voor het aantal:</span>
                        <ul className="mt-1 space-y-0.5">
                          <li><span className="font-semibold">4 stuks</span> — vaste standplaats (onder elke band één plaat)</li>
                          <li><span className="font-semibold">6–10 stuks</span> — kort verplaatsbaar rijpad naar de werkplek</li>
                          <li><span className="font-semibold">12+ stuks</span> — complete rijbaan of volledige bescherming van gazon/zachte grond</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className="text-xs font-bold text-slate-700 mt-3 block">€6,- per week per stuk (elke 7 dagen +€6)</span>
          </label>
          )}

          {/* Product-specific cross-sell extras (per week) */}
          {selectedMachine?.crossSellAddons?.map((addon) => (
            <label
              key={addon.id}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedAddons.includes(addon.id)
                  ? "bg-slate-50 border-slate-400 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="text-xs font-bold text-slate-900">{addon.name}</h4>
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.id)}
                    onChange={() => {
                      if (selectedAddons.includes(addon.id)) {
                        setSelectedAddons(selectedAddons.filter(x => x !== addon.id));
                      } else {
                        setSelectedAddons([...selectedAddons, addon.id]);
                      }
                    }}
                    className="h-4 w-4 accent-orange-500 rounded cursor-pointer shrink-0"
                  />
                </div>
                {addon.description && (
                  <p className="text-xs text-slate-600 leading-normal">{addon.description}</p>
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 mt-3 block">
                +€{addon.pricePerWeek},- / per week
                {!selectedMachine?.weeklyOnly && addon.pricePerTwoDay ? <span className="text-slate-500 font-normal"> · €{addon.pricePerTwoDay},- / 2 dgn</span> : null}
                {!selectedMachine?.weeklyOnly && addon.pricePerDay ? <span className="text-slate-500 font-normal"> · €{addon.pricePerDay},- / dag</span> : null}
              </span>
            </label>
          ))}

        </div>
      </div>

      {/* Dynamic inline warning banner replacement */}
      {validationError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, x: -6 }}
          animate={{ opacity: 1, scale: 1, x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.4 }}
          className="p-4 bg-rose-50 border-rose-200 border text-rose-800 text-xs rounded-xl flex items-start space-x-2.5 my-3 shadow-sm"
        >
          <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold leading-normal">
            <span className="font-extrabold text-slate-900 block mb-0.5">Invoerfout gedetecteerd</span>
            {validationError}
          </div>
          <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-600 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none bg-transparent">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Mobile price summary — shows after all selections, before Doorgaan */}
      {sums && (
        <div className="lg:hidden pt-2">
          <BookingPriceSummary selectedMachine={selectedMachine ?? null} machineCount={cartItems.length || 1} startDate={leadItem?.startDate} endDate={leadItem?.endDate} multiplePeriods={mixedPeriods} sums={sums} />
        </div>
      )}

      {/* Step control — always clickable: a click while a required choice is
          missing highlights that section in red (above) instead of doing
          nothing, so the customer can see exactly what to fill in. */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            onClick={() => { setAttempted(true); handleNextStep(); }}
            className="cta-shine bg-orange-500 hover:bg-orange-600 text-white cursor-pointer active:scale-[0.98] shadow-lg shadow-orange-500/25 font-bold text-sm w-full sm:w-auto px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 border-none order-1 sm:order-2"
          >
            <span>Doorgaan naar gegevens</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
        {attempted && validationError && (
          <p className="text-xs text-rose-600 font-bold mt-2.5 flex items-center gap-1.5 sm:justify-end">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Vul de verplichte velden hierboven in om door te gaan
          </p>
        )}
      </div>
      {/* Machine detail modal — full shared component */}
      <AnimatePresence>
        {previewMachine && (
          <MachineDetailModal
            machine={previewMachine}
            onClose={() => setPreviewMachine(null)}
            onBook={() => setPreviewMachine(null)}
            vatDisplay={vatDisplay}
            showPricing={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

