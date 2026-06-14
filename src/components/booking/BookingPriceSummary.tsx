/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck, TrendingDown, Package } from "lucide-react";
import { Machine } from "../../types";
import { useLanguageStore } from "../../store/languageStore";
import { euro, euroCompact } from "../../utils/format";

interface BookingPriceSummaryProps {
  selectedMachine: Machine | null;
  machineCount?: number;
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
    weekendDays?: number;
    spansWeekend?: boolean;
    effectiveDailyRate?: number | null;
    tierLabel?: string | null;
    isFlatRate?: boolean;
    weeklyBreakdown?: { weeks: number; pricePerWeek: number; remainder: number; dailyRate: number } | null;
  };
}

export default function BookingPriceSummary({ selectedMachine, machineCount = 1, sums }: BookingPriceSummaryProps) {
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
            src={selectedMachine.imageUrl || selectedMachine.additionalImages?.[0] || "/placeholder-machine.webp"}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const fallback = selectedMachine.additionalImages?.[0];
              if (fallback && e.currentTarget.src !== fallback) {
                e.currentTarget.src = fallback;
              } else {
                e.currentTarget.src = "/placeholder-machine.webp";
              }
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide leading-none mb-1">{t("priceSummaryReservation")}</p>
          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
            {machineCount > 1 ? `${machineCount} machines gereserveerd` : selectedMachine.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}
          </h4>
          {machineCount === 1 && <span className="text-xs text-indigo-600 font-bold font-mono">{euroCompact(selectedMachine.pricePerDay)}/dag</span>}
        </div>
      </div>

      {/* Price breakdown */}
      <div className="p-4 space-y-3">

        {/* Days × rate, flat-rate tier, or weekly linear breakdown */}
        {sums.weeklyBreakdown ? (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600">{sums.weeklyBreakdown.weeks}× Wekelijks Tarief (5 dgn)</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{euro(sums.weeklyBreakdown.weeks * sums.weeklyBreakdown.pricePerWeek)}</span>
            </div>
            {sums.weeklyBreakdown.remainder > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">
                  {sums.weeklyBreakdown.remainder} {sums.weeklyBreakdown.remainder === 1 ? 'dag' : 'dagen'} × {euroCompact(sums.weeklyBreakdown.dailyRate)}
                </span>
                <span className="text-xs font-bold text-slate-800 font-mono">{euro(sums.weeklyBreakdown.remainder * sums.weeklyBreakdown.dailyRate)}</span>
              </div>
            )}
          </div>
        ) : sums.isFlatRate && sums.tierLabel ? (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">1× {sums.tierLabel}</span>
            <span className="text-xs font-bold text-slate-800 font-mono">{euro(sums.subtotal)}</span>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">
              {sums.days} {sums.days === 1 ? 'dag' : 'dagen'} × {euroCompact(selectedMachine.pricePerDay)}
            </span>
            <span className="text-xs font-bold text-slate-800 font-mono">{euro(sums.rawSubtotal)}</span>
          </div>
        )}

        {/* Info strip — for discounts, weekend spans, and linear weekly rate badge */}
        {((!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0) || sums.spansWeekend || (!sums.weeklyBreakdown && sums.effectiveDailyRate)) && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2.5">

            {/* Effectief dagtarief uitleg (6–27 dagen) — hidden when weeklyBreakdown is shown */}
            {!sums.weeklyBreakdown && sums.effectiveDailyRate != null && sums.days >= 6 && (
              <div className="flex items-start gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                <div className="text-xs leading-snug">
                  <p className="font-semibold text-slate-700">Werkweektarief toegepast</p>
                  <p className="text-slate-500 mt-0.5">
                    {sums.days} dagen ×{" "}
                    <span className="font-semibold text-indigo-600">{euroCompact(sums.effectiveDailyRate)}/dag</span>
                    <span className="ml-1.5 line-through text-slate-400">{euroCompact(selectedMachine.pricePerDay)}/dag</span>
                  </p>
                </div>
              </div>
            )}

            {/* Discount row — hidden for flat-rate and weekly breakdown tiers */}
            {!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0 && (
              <div className={`flex justify-between items-center text-emerald-700 text-xs font-semibold${(sums.effectiveDailyRate != null && sums.days >= 6) || sums.spansWeekend ? " pt-2 border-t border-slate-200" : ""}`}>
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  {sums.discountLabel}
                </span>
                <span className="font-mono">− {euro(sums.discountAmount)}</span>
              </div>
            )}

            {/* Gratis weekendopslag */}
            {sums.spansWeekend && (
              <div className={`flex items-center gap-2 text-xs text-blue-700${(!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0) || (!sums.weeklyBreakdown && sums.effectiveDailyRate != null && sums.days >= 6) ? " pt-2 border-t border-slate-200" : ""}`}>
                <span className="shrink-0">🗓</span>
                <span>
                  <span className="font-semibold">Gratis weekendopslag</span>
                  {" — "}
                  {(sums.weekendDays ?? 0) === 1 ? "1 weekend dag" : `${sums.weekendDays} weekend dagen`} inbegrepen
                </span>
              </div>
            )}

          </div>
        )}

        {/* Delivery */}
        {(sums.transport > 0 || sums.driver > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">
              {sums.deliveryType === "trailer_rental" ? t("priceSummaryTrailer") : t("priceSummaryDelivery")}
            </span>
            <span className="text-xs font-bold text-slate-800 font-mono">{euro(sums.transport + sums.driver)}</span>
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
            <span className="text-xs font-bold text-slate-800 font-mono">{euro(Number(addon.price))}</span>
          </div>
        ))}

        {/* Subtotaal excl. BTW */}
        <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-3">
          <span className="text-xs">Subtotaal (excl. BTW)</span>
          <span className="text-xs font-bold text-slate-800 font-mono">{euro(priceExVat)}</span>
        </div>

        {/* BTW */}
        <div className="flex justify-between items-center text-slate-400">
          <span className="text-xs">BTW 21%</span>
          <span className="text-xs font-mono">{euro(sums.vat)}</span>
        </div>

        {/* Total */}
        <div className="bg-indigo-600 -mx-4 px-4 py-4 rounded-b-none">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] text-indigo-200 font-semibold uppercase tracking-wide">{t("priceSummaryTotal")}</p>
              <p className="text-[10px] text-indigo-300 mt-0.5">{t("priceSummaryInclVAT")}</p>
            </div>
            <span className="text-2xl font-black text-white font-mono">{euro(sums.total)}</span>
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
