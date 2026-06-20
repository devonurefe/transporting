/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck, TrendingDown, Package, ChevronDown, Calendar, Truck, Tag } from "lucide-react";
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
    weeklyBreakdown?: { weeks: number; pricePerWeek: number; remainder: number; dailyRate: number; remainderCost?: number } | null;
    campaignSavings?: number;
    weekendWorkAnswer?: "ja" | "nee" | null;
  };
}

/* Accordion detail row */
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
  const lCls = accent === "emerald" ? "text-emerald-700 font-semibold"
    : accent === "amber" ? "text-amber-700 font-semibold"
    : dim ? "text-slate-500"
    : "text-slate-600";
  const vCls = accent === "emerald" ? "text-emerald-700 font-semibold"
    : accent === "amber" ? "text-amber-700 font-semibold"
    : dim ? "text-slate-500"
    : "text-slate-700 font-semibold";
  return (
    <div className="flex justify-between items-center gap-3">
      <span className={`text-xs leading-snug ${lCls}`}>{label}</span>
      <span className={`text-xs font-mono shrink-0 ${vCls}`}>{value}</span>
    </div>
  );
}

/* Top-level summary row */
function SummaryRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "emerald" | "blue" | "amber";
}) {
  const vCls = accent === "emerald" ? "text-emerald-600"
    : accent === "blue" ? "text-blue-700"
    : accent === "amber" ? "text-amber-700"
    : "text-slate-800";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400 shrink-0">{icon}</span>
        <span className="text-xs text-slate-500 leading-snug">{label}</span>
      </div>
      <span className={`text-xs font-semibold text-right shrink-0 whitespace-nowrap leading-snug ${vCls}`}>{value}</span>
    </div>
  );
}

export default function BookingPriceSummary({ selectedMachine, machineCount = 1, sums }: BookingPriceSummaryProps) {
  const t = useLanguageStore((state) => state.t);
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);

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
  // Only surface the "free weekend days" line once the customer has explicitly
  // declared they will NOT work the weekend — in that case the subtotal is already
  // reduced to the working days. When they pick "Ja, ik werk" the full werkweektarief
  // applies (weekend included) and while unanswered we keep the summary neutral.
  const showWeekendFree = sums.spansWeekend && sums.weekendWorkAnswer === "nee";
  const totalSavings = (sums.campaignSavings ?? 0)
    + (!sums.weeklyBreakdown && !sums.isFlatRate ? sums.discountAmount : 0);

  // Weekend "niet werken": only the working (non-weekend) days are charged, so the
  // per-day rate and breakdown are expressed per WORKING day (not blended over all
  // calendar days, which would show a misleadingly low €/dag).
  const isWeekendNoWork = !!showWeekendFree;
  const workingDays = Math.max(0, sums.days - (sums.weekendDays ?? 0));

  // Flat-rate / weekly tiers bake the discount into the price, so "Je bespaart"
  // never fires for them. Surface a small badge when the effective day rate is
  // genuinely below the list day rate so the customer understands the saving.
  const effectivePerDay = isWeekendNoWork && workingDays > 0 ? sums.subtotal / workingDays
    : sums.weeklyBreakdown ? sums.weeklyBreakdown.dailyRate
    : sums.days > 0 ? sums.subtotal / sums.days
    : selectedMachine.pricePerDay;
  const hasTierDeal = (sums.isFlatRate || !!sums.weeklyBreakdown)
    && effectivePerDay < selectedMachine.pricePerDay - 0.01;

  // Day-count is already shown under the total ("· N dagen huur"); the Huurperiode
  // row only names the applied tariff so it stays one clean line. The 6-27 day
  // pro-rata band is also a weekly tariff, so it reads "Werkweektarief".
  const rateLabel = sums.isFlatRate && sums.tierLabel
    ? sums.tierLabel
    : sums.weeklyBreakdown
    ? "Werkweektarief"
    : "Dagtarief";

  const transportFree = sums.transport === 0 && sums.driver === 0;
  const transportName = sums.deliveryType === "trailer_drop_return" ? "Aanhanger Drop & Return"
    : sums.deliveryType === "trailer_rental" ? "Aanhanger op locatie"
    : sums.deliveryType === "delivery_by_us" ? "Transportkosten"
    : t("priceSummaryPickup");
  const transportValue = transportFree ? t("priceSummaryPickupFree") : euro(sums.transport + sums.driver);

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
            selectedMachine.weeklyOnly && selectedMachine.weeklyPrice ? (
              <span className="text-sm font-black text-slate-800 font-mono">
                {euroCompact(selectedMachine.weeklyPrice)}/week
              </span>
            ) : hasTierDeal ? (
              <span className="font-mono flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm font-black text-emerald-600">{euroCompact(effectivePerDay)}/dag</span>
                <span className="text-xs line-through text-slate-400 font-semibold">{euroCompact(selectedMachine.pricePerDay)}/dag</span>
              </span>
            ) : (
              <span className="text-sm font-black text-slate-800 font-mono">
                {euroCompact(selectedMachine.pricePerDay)}/dag
              </span>
            )
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── TOTAAL (prominent) ──────────────────── */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{t("priceSummaryTotal")}</p>
          <p className="text-3xl font-black text-slate-900 font-mono leading-none">{euro(sums.total)}</p>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
            {t("priceSummaryInclVAT")} · {sums.days} {sums.days === 1 ? "dag" : "dagen"} huur
          </p>
        </div>

        {/* ── SAMENVATTING ───────────────────────── */}
        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          <SummaryRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Tarief"
            value={rateLabel}
          />
          <SummaryRow
            icon={<Truck className="h-3.5 w-3.5" />}
            label={transportName}
            value={transportValue}
            accent={transportFree ? "emerald" : undefined}
          />
          {totalSavings > 0 && (
            <SummaryRow
              icon={(sums.isFlatRate || !!sums.weeklyBreakdown)
                ? <Tag className="h-3.5 w-3.5" />
                : <TrendingDown className="h-3.5 w-3.5" />}
              label={(sums.isFlatRate || !!sums.weeklyBreakdown) ? "Campagnekorting" : "Je bespaart"}
              value={`− ${euro(totalSavings)}`}
              accent={(sums.isFlatRate || !!sums.weeklyBreakdown) ? "amber" : "emerald"}
            />
          )}
          {showWeekendFree && (
            <SummaryRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label={(sums.weekendDays ?? 0) === 1 ? "Weekenddag" : "Weekenddagen"}
              value="Gratis (geen gebruik)"
              accent="emerald"
            />
          )}
          {sums.addonCost > 0 && sums.addonDetails.map(addon => (
            <SummaryRow
              key={addon.id}
              icon={<Tag className="h-3.5 w-3.5" />}
              label={addon.name}
              value={euro(Number(addon.price))}
            />
          ))}
        </div>

        {/* ── ACCORDION TRIGGER ──────────────────── */}
        <button
          type="button"
          onClick={() => setBreakdownOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-700 font-semibold py-1 border-t border-slate-100 transition-colors cursor-pointer bg-transparent border-x-0 border-b-0"
        >
          <span>Prijsopbouw bekijken</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`} />
        </button>

        {/* ── ACCORDION BODY ─────────────────────── */}
        {breakdownOpen && (
          <div className="space-y-3 pt-1 border-t border-slate-100">

            {/* BEREKENING */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Berekening</p>

              {!sums.weeklyBreakdown && !sums.isFlatRate && sums.effectiveDailyRate != null && sums.days >= 6 && (
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-[10px] text-emerald-700 font-semibold leading-snug">
                    Werkweektarief {euroCompact(sums.effectiveDailyRate)}/dag
                    <span className="ml-1.5 line-through text-slate-400 font-normal">{euroCompact(selectedMachine.pricePerDay)}/dag</span>
                  </span>
                </div>
              )}

              {isWeekendNoWork ? (
                <>
                  <Row
                    label={`${workingDays} ${workingDays === 1 ? "werkdag" : "werkdagen"} berekend`}
                    value={euro(sums.subtotal)}
                  />
                  <Row
                    label={`${sums.weekendDays ?? 0} ${(sums.weekendDays ?? 0) === 1 ? "weekenddag" : "weekenddagen"}`}
                    value="Gratis"
                    accent="emerald"
                  />
                </>
              ) : sums.weeklyBreakdown ? (
                <>
                  <Row
                    label={`${sums.weeklyBreakdown.weeks}× Werkweektarief (5 dgn)`}
                    value={euro(sums.weeklyBreakdown.weeks * sums.weeklyBreakdown.pricePerWeek)}
                  />
                  {sums.weeklyBreakdown.remainder > 0 && (
                    <Row
                      label={`${sums.weeklyBreakdown.remainder} extra ${sums.weeklyBreakdown.remainder === 1 ? "dag" : "dagen"}`}
                      value={euro(sums.weeklyBreakdown.remainderCost ?? sums.weeklyBreakdown.remainder * sums.weeklyBreakdown.dailyRate)}
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

            {/* KORTINGEN */}
            {((!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0) || (sums.campaignSavings ?? 0) > 0) && (
              <>
                <div className="h-px bg-slate-100" />
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kortingen</p>
                  {!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0 && (
                    <Row
                      label={<span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 shrink-0" />{sums.discountLabel}</span>}
                      value={`− ${euro(sums.discountAmount)}`}
                      accent="emerald"
                    />
                  )}
                  {(sums.campaignSavings ?? 0) > 0 && (
                    <Row
                      label={<span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 shrink-0" />Campagnekorting</span>}
                      value={`− ${euro(sums.campaignSavings!)}`}
                      accent="amber"
                    />
                  )}
                </div>
              </>
            )}

            {/* BEZORGING + ADD-ONS */}
            <div className="h-px bg-slate-100" />
            <div className="space-y-2">
              {sums.transport > 0 || sums.driver > 0 ? (
                <Row
                  label={sums.deliveryType === "trailer_drop_return" ? "Aanhanger Drop & Return"
                    : sums.deliveryType === "trailer_rental" ? t("priceSummaryTrailer")
                    : t("priceSummaryDelivery")}
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

            {/* SUBTOTAAL + BTW */}
            <div className="h-px bg-slate-100" />
            <div className="space-y-1.5">
              <Row label="Subtotaal (excl. BTW)" value={euro(priceExVat)} />
              <Row label="BTW 21%" value={euro(sums.vat)} dim />
            </div>

          </div>
        )}

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
