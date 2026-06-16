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
    campaignSavings?: number;
  };
}

function Row({
  label,
  value,
  accent,
  dim,
}: {
  label: React.ReactNode;
  value: string;
  accent?: "emerald" | "amber";
  dim?: boolean;
}) {
  const lCls = accent === "emerald"
    ? "text-emerald-700 font-semibold"
    : accent === "amber"
    ? "text-amber-700 font-semibold"
    : dim
    ? "text-slate-400"
    : "text-slate-600";
  const vCls = accent === "emerald"
    ? "text-emerald-700 font-semibold"
    : accent === "amber"
    ? "text-amber-700 font-semibold"
    : dim
    ? "text-slate-400"
    : "text-slate-800 font-bold";
  return (
    <div className="flex justify-between items-center gap-3">
      <span className={`text-xs leading-snug ${lCls}`}>{label}</span>
      <span className={`text-xs font-mono shrink-0 ${vCls}`}>{value}</span>
    </div>
  );
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
  const showWeekendFree = sums.spansWeekend && !sums.addonDetails.some(a => a.id === "weekend_surcharge");
  const hasKortingen =
    (!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0) ||
    (sums.campaignSavings ?? 0) > 0 ||
    showWeekendFree;

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
          {machineCount === 1 && (
            <span className="text-xs text-slate-600 font-bold font-mono">{euroCompact(selectedMachine.pricePerDay)}/dag</span>
          )}
        </div>
      </div>

      {/* Breakdown body */}
      <div className="p-4 flex flex-col gap-3">

        {/* ── BEREKENING ──────────────────────── */}
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Berekening</p>

          {/* Werkweektarief badge (6-27 dagen, no weeklyBreakdown) */}
          {!sums.weeklyBreakdown && !sums.isFlatRate && sums.effectiveDailyRate != null && sums.days >= 6 && (
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="text-[10px] text-emerald-700 font-semibold leading-snug">
                Werkweektarief {euroCompact(sums.effectiveDailyRate)}/dag
                <span className="ml-1.5 line-through text-slate-400 font-normal">{euroCompact(selectedMachine.pricePerDay)}/dag</span>
              </span>
            </div>
          )}

          {/* Rate line(s) */}
          {sums.weeklyBreakdown ? (
            <>
              <Row
                label={`${sums.weeklyBreakdown.weeks}× Wekelijks Tarief (5 dgn)`}
                value={euro(sums.weeklyBreakdown.weeks * sums.weeklyBreakdown.pricePerWeek)}
              />
              {sums.weeklyBreakdown.remainder > 0 && (
                <Row
                  label={`${sums.weeklyBreakdown.remainder} ${sums.weeklyBreakdown.remainder === 1 ? "dag" : "dagen"} × ${euroCompact(sums.weeklyBreakdown.dailyRate)}`}
                  value={euro(sums.weeklyBreakdown.remainder * sums.weeklyBreakdown.dailyRate)}
                />
              )}
            </>
          ) : sums.isFlatRate && sums.tierLabel ? (
            <Row label={`1× ${sums.tierLabel}`} value={euro(sums.subtotal)} />
          ) : (
            <Row
              label={`${sums.days} ${sums.days === 1 ? "dag" : "dagen"} × ${euroCompact(selectedMachine.pricePerDay)}`}
              value={euro(sums.rawSubtotal)}
            />
          )}
        </div>

        {/* ── KORTINGEN (conditional) ─────────── */}
        {hasKortingen && (
          <>
            <div className="h-px bg-slate-100" />
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kortingen</p>

              {!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0 && (
                <Row
                  label={
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 shrink-0" />
                      {sums.discountLabel}
                    </span>
                  }
                  value={`− ${euro(sums.discountAmount)}`}
                  accent="emerald"
                />
              )}

              {(sums.campaignSavings ?? 0) > 0 && (
                <Row
                  label={
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 shrink-0" />
                      Campagnekorting
                    </span>
                  }
                  value={`− ${euro(sums.campaignSavings!)}`}
                  accent="amber"
                />
              )}

              {showWeekendFree && (
                <div className="flex items-center gap-2 text-[11px] text-blue-700">
                  <span className="shrink-0">🗓</span>
                  <span>
                    <span className="font-semibold">Gratis weekendopslag</span>
                    {" — "}
                    {(sums.weekendDays ?? 0) === 1 ? "1 weekend dag" : `${sums.weekendDays} weekend dagen`} inbegrepen
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── BEZORGING & ADD-ONS ─────────────── */}
        <div className="h-px bg-slate-100" />
        <div className="space-y-2">
          {sums.transport > 0 || sums.driver > 0 ? (
            <Row
              label={sums.deliveryType === "trailer_drop_return" ? "Aanhanger Drop & Return" : sums.deliveryType === "trailer_rental" ? t("priceSummaryTrailer") : t("priceSummaryDelivery")}
              value={euro(sums.transport + sums.driver)}
            />
          ) : (
            <div className="flex justify-between items-center gap-3">
              <span className="text-xs text-slate-600">{t("priceSummaryPickup")}</span>
              <span className="text-xs font-semibold text-emerald-600">{t("priceSummaryPickupFree")}</span>
            </div>
          )}

          {sums.addonCost > 0 && sums.addonDetails.map(addon => (
            <Row key={addon.id} label={addon.name} value={euro(Number(addon.price))} />
          ))}
        </div>

        {/* ── SUBTOTAAL + BTW ─────────────────── */}
        <div className="h-px bg-slate-100" />
        <div className="space-y-1.5">
          <Row label="Subtotaal (excl. BTW)" value={euro(priceExVat)} />
          <Row label="BTW 21%" value={euro(sums.vat)} dim />
        </div>

      </div>

      {/* Total */}
      <div className="bg-slate-900 px-4 py-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wide">{t("priceSummaryTotal")}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t("priceSummaryInclVAT")}</p>
          </div>
          <span className="text-2xl font-black text-white font-mono">{euro(sums.total)}</span>
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
