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

// Categories the global add-ons never apply to. "safety" (Veiligheidsset Pro) only
// excludes ladderlift (a furniture-moving lift, not a working-at-height platform);
// "rijplaten" (ground protection plates) also excludes the trailer-mounted "Toe &
// Go" units, the Kamersteiger and the Pecolift, which never drive onto soft/sloped
// terrain. Mirrored by server/routes/orders.ts — keep identical.
const GLOBAL_ADDON_EXCLUDED_CATEGORIES: Record<"safety" | "rijplaten", string[]> = {
  safety: ["ladderlift"],
  rijplaten: ["aanhanger", "kamersteiger", "ecolift", "ladderlift"],
};

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
  validationError: string | null;
  setValidationError: (err: string | null) => void;
  isAvailable: boolean;
  handleNextStep: () => void;
  setActiveTab: (tab: string) => void;
  customerProfile: string;
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; deliveryType?: string;
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
  // Set once the customer tries to proceed — gates the red "missing field"
  // highlights below so they never show before the first attempt.
  const [attempted, setAttempted] = useState(false);

  const timeSlotBlocked = deliveryType === "delivery_by_us" && !deliveryTimeSlot;

  // The error banner/highlights above reflect a validation snapshot from the
  // last click — once the customer actually fixes the thing it complained
  // about, clear it immediately instead of leaving a stale message on screen.
  useEffect(() => {
    if (validationError) setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryTimeSlot, deliveryType, cartItems.length, deliveryDistanceKm]);

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
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors cursor-pointer bg-transparent border-none p-0 font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Terug naar catalogus
          </button>
        </div>
        <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-slate-700" />
          <span>{t("step1Title")}</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">{t("step1Subtitle")}</p>
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
                <span className="text-xs text-slate-400 block">Depot — gratis</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dankzij de compacte afmetingen past dit product eenvoudig in een personenauto of kleine
              bestelwagen — u kunt het zelf gemakkelijk vervoeren.
            </p>
            <span className="text-sm font-black text-emerald-600 block">Kosteloos</span>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <span className="text-xs text-slate-400 block">Binnen 20 km straal</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              Wij leveren de machine af en halen hem terug op.
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-sm font-black text-emerald-600">€150,-</span>
              <span className="text-xs text-slate-500 font-semibold">heen + terug</span>
            </div>
            {deliveryType === "delivery_by_us" && (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-px" />
                <p className="text-xs text-amber-800 font-semibold leading-snug">
                  Tip: huur zelf een aanhanger en bespaar €150 transportkosten.
                </p>
              </div>
            )}
          </button>

          {/* Opt 2 — Aanhanger huren */}
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
                <span className="text-xs text-slate-400 block">Eigen auto, onze aanhanger</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              U rijdt zelf met uw eigen voertuig en onze aanhanger.
            </p>
            {sums && sums.days > 0 ? (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-sm font-black text-emerald-600 font-mono">{euroCompact(sums.days * 25)}</span>
                <span className="text-xs text-slate-500 font-semibold font-mono">({sums.days} dgn × €25,-)</span>
              </div>
            ) : (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-sm font-black text-emerald-600">€25,-/dag</span>
              </div>
            )}
          </button>

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
                <span className="text-xs text-slate-400 block">Zoeterwoude depot</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              Ophalen bij ons depot — gratis.
            </p>
            <span className="text-sm font-black text-emerald-600 mt-2 block">Kosteloos</span>
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

      {/* Delivery time slot — only for "Wij bezorgen" */}
      {deliveryType === "delivery_by_us" && (
        <div className="space-y-3 pt-4 border-t-2 border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-800 font-bold">Gewenst bezorgmoment</span>
            <span className="text-xs text-rose-500 font-semibold uppercase tracking-wide">Verplicht</span>
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
                <span className="text-xs text-slate-400 font-mono">{slot.time}</span>
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
          <span className="text-xs text-slate-400">Optioneel</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Global safety set — not relevant for a furniture-moving ladderlift */}
          {!!selectedMachine && !GLOBAL_ADDON_EXCLUDED_CATEGORIES.safety.includes(selectedMachine.category) && (
          <div
            onClick={() => {
              if (selectedAddons.includes("safety")) {
                setSelectedAddons(selectedAddons.filter(x => x !== "safety"));
              } else {
                setSelectedAddons([...selectedAddons, "safety"]);
              }
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedAddons.includes("safety")
                ? "bg-slate-50 border-slate-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900">Veiligheidsset Pro</h4>
                <input
                  type="checkbox"
                  checked={selectedAddons.includes("safety")}
                  onChange={()=>{}}
                  className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                Luxe veiligheidsharnas combi, lijn met valdemper en TÜV goedgekeurde bouwhelm met gehoorbescherming.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 mt-3 block">€15,- / week (elke 7 dagen +€15)</span>
          </div>
          )}

          {/* Ground protection plates — only for platforms that stand directly on the
              terrain; not relevant for a trailer unit, scaffolding, or manual lift. */}
          {!!selectedMachine && !GLOBAL_ADDON_EXCLUDED_CATEGORIES.rijplaten.includes(selectedMachine.category) && (
          <div
            onClick={() => {
              if (selectedAddons.includes("rijplaten")) {
                setSelectedAddons(selectedAddons.filter(x => x !== "rijplaten"));
              } else {
                setSelectedAddons([...selectedAddons, "rijplaten"]);
              }
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedAddons.includes("rijplaten")
                ? "bg-slate-50 border-slate-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900">Rijplaten</h4>
                <input
                  type="checkbox"
                  checked={selectedAddons.includes("rijplaten")}
                  onChange={()=>{}}
                  className="h-4 w-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                Bij een helling, drempel of oneffen terrein, op zachte ondergrond (zoals gras), of als u de
                ondergrond niet wilt beschadigen is het gebruik van rijplaten noodzakelijk.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 mt-3 block">€6,- / week (elke 7 dagen +€6)</span>
          </div>
          )}

          {/* Product-specific cross-sell extras (per week) */}
          {selectedMachine?.crossSellAddons?.map((addon) => (
            <div
              key={addon.id}
              onClick={() => {
                if (selectedAddons.includes(addon.id)) {
                  setSelectedAddons(selectedAddons.filter(x => x !== addon.id));
                } else {
                  setSelectedAddons([...selectedAddons, addon.id]);
                }
              }}
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
                    onChange={()=>{}}
                    className="h-4 w-4 accent-orange-500 rounded cursor-pointer shrink-0"
                  />
                </div>
                {addon.description && (
                  <p className="text-xs text-slate-600 leading-normal">{addon.description}</p>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 mt-3 block">
                +€{addon.pricePerWeek},- / per week
                {!selectedMachine?.weeklyOnly && addon.pricePerTwoDay ? <span className="text-slate-500 font-normal"> · €{addon.pricePerTwoDay},- / 2 dgn</span> : null}
                {!selectedMachine?.weeklyOnly && addon.pricePerDay ? <span className="text-slate-500 font-normal"> · €{addon.pricePerDay},- / dag</span> : null}
              </span>
            </div>
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

