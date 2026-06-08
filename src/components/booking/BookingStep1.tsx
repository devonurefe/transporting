/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Calendar, Building2, X, Truck, Sparkles, ShieldAlert, ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { CartItem, DeliveryType, Machine } from "../../types";
import { buildWhatsAppUrl } from "../../utils/whatsapp";
import BookingPriceSummary from "./BookingPriceSummary";

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
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; deliveryType?: string;
  };
  selectedMachine?: Machine | null;
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
  sums,
  selectedMachine
}: BookingStep1Props) {
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          <span>Huurperiode &amp; Bezorging</span>
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">Kies uw datums en hoe u de machine wilt ontvangen.</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="text-center py-10 space-y-4">
          <div className="mx-auto h-12 w-12 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-full shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-sm">Uw winkelwagen is leeg</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Selecteer een of meer machines uit onze catalogus om uw boeking te starten.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("catalog")}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all border-none cursor-pointer"
          >
            Catalogus Bekijken
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cartItems.map((item) => {
            const availability = getItemAvailability(
              item.machine.id, 
              item.startDate || new Date().toISOString().split("T")[0], 
              item.endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            );
            return (
              <div key={item.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-mono text-[10px] text-slate-400 overflow-hidden shadow-sm">
                      <img 
                        src={item.machine.imageUrl || `/api/placeholder/100/100`} 
                        alt={item.machine.name} 
                        className="object-cover h-full w-full"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-machine.webp";
                        }}
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{item.machine.name}</h4>
                      <p className="text-[10px] text-slate-500 font-medium font-mono">Tarief: <span className="text-teal-700 font-bold">€{item.machine.pricePerDay},-</span> / dag</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab("catalog")}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors border-none bg-transparent cursor-pointer font-medium hidden sm:block"
                    >
                      Ander model
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCartItem(item.id)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border-none cursor-pointer"
                      title="Verwijderen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] text-slate-500 block font-bold">Begindatum</label>
                    <div className="flex items-center bg-white rounded-xl px-2.5 py-2 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Calendar className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="date"
                        min={todayStr}
                        value={item.startDate}
                        onChange={(e) => onUpdateCartItemDates(item.id, e.target.value, item.endDate || "")}
                        className="bg-transparent border-none text-xs text-slate-800 outline-none w-full cursor-pointer font-bold focus:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] text-slate-500 block font-bold">Einddatum (Retour)</label>
                    <div className="flex items-center bg-white rounded-xl px-2.5 py-2 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Calendar className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="date"
                        min={item.startDate || todayStr}
                        value={item.endDate}
                        onChange={(e) => onUpdateCartItemDates(item.id, item.startDate || "", e.target.value)}
                        className="bg-transparent border-none text-xs text-slate-880 text-slate-800 outline-none w-full cursor-pointer font-bold focus:ring-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Item Availability status bar */}
                <div className={`p-2.5 rounded-xl border text-[11px] flex items-center space-x-2 shadow-sm ${
                  availability.available
                    ? "bg-teal-50 border-teal-200 text-teal-800 font-semibold"
                    : "bg-rose-50 border-rose-200 text-rose-700 font-semibold"
                }`}>
                  {availability.available ? (
                    <>
                      <CheckCircle2Icon className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Beschikbaar op uw geselecteerde datums!</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-rose-605 text-rose-600 shrink-0" />
                      <span className="font-semibold">{availability.reason}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logistical preference setup */}
      <div className="space-y-3.5 pt-4 border-t border-slate-200">
        <span className="text-xs text-slate-600 font-bold uppercase tracking-wider font-mono">Transport Opties</span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Opt 1 — Wij bezorgen */}
          <div
            onClick={() => setDeliveryType("delivery_by_us")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              deliveryType === "delivery_by_us"
                ? "bg-indigo-50 border-indigo-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Truck className="h-4 w-4 text-indigo-600" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900"><span className="text-indigo-500 font-mono">Optie 1 · </span>Wij bezorgen</h4>
                <span className="text-[9.5px] text-slate-400 block font-mono">Binnen 20 km straal</span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-normal">
              Wij leveren de machine af en halen hem terug op. Geef uw afleveradres op in de volgende stap.
            </p>
            <span className="text-xs font-mono font-bold text-indigo-600 mt-2 block">€75,- / rit (heen + terug = €150,-)</span>
          </div>

          {/* Opt 2 — Aanhanger huren */}
          <div
            onClick={() => {
              setDeliveryType("trailer_rental");
              setDeliveryAddress("");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              deliveryType === "trailer_rental"
                ? "bg-indigo-50 border-indigo-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Truck className="h-4 w-4 text-amber-600" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900"><span className="text-amber-500 font-mono">Optie 2 · </span>Onze aanhanger huren</h4>
                <span className="text-[9.5px] text-slate-400 block font-mono">Eigen auto, onze aanhanger</span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-normal">
              U rijdt zelf met uw eigen voertuig en gebruikt onze aanhanger om de machine te vervoeren.
            </p>
            <span className="text-xs font-mono font-bold text-amber-700 mt-2 block">€25,- / dag (aanhanger)</span>
          </div>

          {/* Opt 3 — Zelf ophalen */}
          <div
            onClick={() => {
              setDeliveryType("self_pickup");
              setDeliveryAddress("");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              deliveryType === "self_pickup"
                ? "bg-indigo-50 border-indigo-400 shadow-sm"
                : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
            }`}
          >
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="h-7 w-7 rounded-lg bg-teal-50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-teal-600" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900"><span className="text-teal-500 font-mono">Optie 3 · </span>Zelf ophalen</h4>
                <span className="text-[9.5px] text-slate-400 block font-mono">Nifty 120 / Nifty 170</span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-normal">
              U haalt de machine kosteloos op bij onze hub. Geschikt voor Nifty 120 en Nifty 170 met eigen auto.
            </p>
            <span className="text-xs font-mono font-bold text-teal-600 mt-2 block">Kosteloos / € 0,-</span>
          </div>
        </div>
      </div>

      {/* Shopping Basket & Add-ons Selection Row */}
      <div className="space-y-3.5 pt-5 border-t border-slate-200">
        <div className="flex justify-between items-center">
          <span className="text-xs text-indigo-705 text-indigo-700 font-bold uppercase tracking-wider font-mono flex items-center space-x-1.5">
            <Sparkles className="h-4 w-4 text-indigo-650 text-indigo-600" />
            <span>Winkelwagen: Kies Extra Opties & Services</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Combineer naar wens</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                ? "bg-indigo-50 border-indigo-400 shadow-sm" 
                : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900">Veiligheidsset Pro</h4>
                <input 
                  type="checkbox"
                  checked={selectedAddons.includes("safety")}
                  onChange={()=>{}}
                  className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <p className="text-[10.5px] text-slate-600 leading-normal">
                Luxe veiligheidsharnas combi, lijn met valdemper en TÜV goedgekeurde bouwhelm met gehoorbescherming.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-700 mt-3 block">€15,- / per dag</span>
          </div>

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
          <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-550 text-rose-650 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none bg-transparent">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Mobile price summary — shows after all selections, before Doorgaan */}
      {sums && (
        <div className="lg:hidden pt-2">
          <BookingPriceSummary selectedMachine={selectedMachine ?? null} sums={sums} />
        </div>
      )}

      {/* Step control */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          onClick={handleNextStep}
          disabled={!isAvailable || cartItems.length === 0}
          className={`font-semibold text-xs w-full sm:w-auto px-6 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 border-none shadow-md order-1 sm:order-2 ${
            isAvailable && cartItems.length > 0
              ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-indigo-200" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          <span>Doorgaan naar gegevens</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CheckCircle2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
