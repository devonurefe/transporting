/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck, TrendingDown, Package } from "lucide-react";
import { Machine } from "../../types";
import { useLanguageStore } from "../../store/languageStore";

interface BookingPriceSummaryProps {
  selectedMachine: Machine | null;
  sums: {
    days: number;
    rawSubtotal: number;
    subtotal: number;
    discountAmount: number;
    discountLabel: string;
    transport: number;
    driver: number;
    addonCost: number;
    addonDetails: { id: string; name: string; price: number }[];
    vat: number;
    total: number;
    deliveryType?: string;
  };
}

export default function BookingPriceSummary({ selectedMachine, sums }: BookingPriceSummaryProps) {
  const t = useLanguageStore((state) => state.t);

  if (!selectedMachine) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl text-center space-y-3">
        <div className="mx-auto h-10 w-10 bg-slate-50 text-slate-400 flex items-center justify-center rounded-full border border-slate-100">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-700">{t("priceSummaryChooseMachine")}</h4>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
            Selecteer een hoogwerker uit de catalogus om uw prijs te zien.
          </p>
        </div>
      </div>
    );
  }

  const priceExVat = sums.subtotal + sums.transport + sums.driver + sums.addonCost;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">

      {/* Machine preview */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-100">
        <div className="h-14 w-20 rounded-xl overflow-hidden bg-slate-200 shrink-0">
          <img
            src={selectedMachine.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide leading-none mb-1">{t("priceSummaryReservation")}</p>
          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{selectedMachine.name}</h4>
          <span className="text-[11px] text-indigo-600 font-bold font-mono">€ {selectedMachine.pricePerDay}/dag</span>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="p-4 space-y-3">

        {/* Days × rate */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600">
            {sums.days} {sums.days === 1 ? 'dag' : 'dagen'} × €{selectedMachine.pricePerDay}
          </span>
          <span className="text-xs font-bold text-slate-800 font-mono">€ {sums.rawSubtotal.toFixed(0)}</span>
        </div>

        {/* Discount */}
        {sums.discountAmount > 0 && (
          <div className="flex justify-between items-center bg-emerald-50 -mx-4 px-4 py-2 rounded-lg">
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              {sums.discountLabel}
            </span>
            <span className="text-xs font-bold text-emerald-700 font-mono">− €{sums.discountAmount.toFixed(0)}</span>
          </div>
        )}

        {/* Delivery */}
        {(sums.transport > 0 || sums.driver > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">
              {sums.deliveryType === "trailer_rental" ? t("priceSummaryTrailer") : t("priceSummaryDelivery")}
            </span>
            <span className="text-xs font-bold text-slate-800 font-mono">€ {(sums.transport + sums.driver).toFixed(0)}</span>
          </div>
        )}

        {/* Self-pickup confirmation */}
        {sums.transport === 0 && sums.driver === 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">{t("priceSummaryPickup")}</span>
            <span className="text-xs font-semibold text-emerald-600">{t("priceSummaryPickupFree")}</span>
          </div>
        )}

        {/* Add-ons */}
        {sums.addonCost > 0 && sums.addonDetails.map(addon => (
          <div key={addon.id} className="flex justify-between items-center">
            <span className="text-xs text-slate-600 truncate max-w-[160px]">{addon.name}</span>
            <span className="text-xs font-bold text-slate-800 font-mono">€ {Number(addon.price).toFixed(2)}</span>
          </div>
        ))}

        {/* BTW */}
        <div className="flex justify-between items-center text-slate-400 border-t border-slate-100 pt-3">
          <span className="text-[11px]">BTW 21%</span>
          <span className="text-[11px] font-mono">€ {sums.vat.toFixed(2)}</span>
        </div>

        {/* Total */}
        <div className="bg-indigo-600 -mx-4 px-4 py-4 rounded-b-none">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] text-indigo-200 font-semibold uppercase tracking-wide">{t("priceSummaryTotal")}</p>
              <p className="text-[10px] text-indigo-300 mt-0.5">{t("priceSummaryInclVAT")}</p>
            </div>
            <span className="text-2xl font-black text-white font-mono">€ {sums.total.toFixed(0)}</span>
          </div>
        </div>


      </div>

      {/* Trust footer */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-2 border-t border-slate-100">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>{t("priceSummaryNoHidden")}</span>
        </div>
      </div>

    </div>
  );
}
