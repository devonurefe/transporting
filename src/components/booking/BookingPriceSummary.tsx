/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck, TrendingDown, Package, ChevronDown, Calendar, Truck, Tag, MessageCircle, BadgeCheck, Umbrella } from "lucide-react";
import { Machine } from "../../types";
import { useLanguageStore } from "../../store/languageStore";
import { euro, euroCompact } from "../../utils/format";
import { withImageWidth } from "../../utils/image";

interface BookingPriceSummaryProps {
  selectedMachine: Machine | null;
  startDate?: string;
  endDate?: string;
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
    trailerDays?: number;
    weekendDays?: number;
    sundayBlockTotal?: number;
    effectiveDailyRate?: number | null;
    tierLabel?: string | null;
    isFlatRate?: boolean;
    weeklyBreakdown?: { weeks: number; pricePerWeek: number; remainder: number; dailyRate: number; remainderCost?: number } | null;
    campaignSavings?: number;
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
    : "text-slate-600 font-medium";
  const vCls = accent === "emerald" ? "text-emerald-700 font-bold"
    : accent === "amber" ? "text-amber-700 font-bold"
    : dim ? "text-slate-500 font-semibold"
    : "text-slate-900 font-bold";
  return (
    <div className="flex justify-between items-center gap-3 py-1">
      <span className={`text-xs leading-snug ${lCls}`}>{label}</span>
      <span className={`text-sm font-mono shrink-0 ${vCls}`}>{value}</span>
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
  label: React.ReactNode;
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

/* Two-line label for the Sunday-block row: "Zondagblokkade" + a lighter
   "(retour ma 08:00)" note on its own line, instead of one phrase that
   wraps mid-word on narrow screens. */
function SundayBlockLabel({ t }: { t: (key: string) => string }) {
  return (
    <span className="block">
      <span>{t("priceSummarySundayBlock")}</span>
      <span className="block text-[10px] opacity-75">{t("priceSummarySundayBlockNote")}</span>
    </span>
  );
}

/** Dutch short date, e.g. "19 jun" — matches the catalog card format. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function BookingPriceSummary({ selectedMachine, startDate, endDate, sums }: BookingPriceSummaryProps) {
  const t = useLanguageStore((state) => state.t);
  // Open by default — customers (and staff relaying prices over the phone)
  // should see what's in the total immediately, not have to find the toggle.
  const [breakdownOpen, setBreakdownOpen] = React.useState(true);

  // Reservation period label: confirm WHICH dates the customer booked (the
  // calendar is no longer visible in step 2).
  const periodLabel = startDate && endDate
    ? `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`
    : null;

  if (!selectedMachine) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl text-center space-y-3">
        <div className="mx-auto h-10 w-10 bg-slate-50 text-slate-400 flex items-center justify-center rounded-full border border-slate-100">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-700">{t("priceSummaryChooseMachine")}</h4>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
            {t("priceSummaryChooseMachineHint")}
          </p>
        </div>
      </div>
    );
  }

  // No period picked yet (sums.days === 0, nothing priced) — show a neutral
  // placeholder instead of a misleading "€0,00 · 0 dagen" total.
  if (sums.days === 0) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl text-center space-y-3">
        <div className="mx-auto h-10 w-10 bg-slate-50 text-slate-400 flex items-center justify-center rounded-full border border-slate-100">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-700">{t("priceSummaryChooseDates")}</h4>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
            {t("priceSummaryChooseDatesHint")}
          </p>
        </div>
      </div>
    );
  }

  const priceExVat = sums.subtotal + sums.transport + sums.driver + sums.addonCost;
  // Forced Sunday block (last work day Saturday → machine held over the closed
  // Sunday, return Monday 08:00). The subtotal already includes it; split it out
  // for display so the tariff line shows the clean base and the block its own line.
  const blockFee = sums.sundayBlockTotal ?? 0;
  const baseSubtotal = sums.subtotal - blockFee;
  const totalSavings = (sums.campaignSavings ?? 0)
    + (!sums.weeklyBreakdown && !sums.isFlatRate ? sums.discountAmount : 0);

  // Weekend package is a flat deal, not a day rate — dividing €69 by 3 calendar
  // days would show a misleading "€23/dag", so it gets its own flat display.
  const isWeekendPkg = sums.isFlatRate && sums.tierLabel === "Weekendpakket";

  // Flat-rate / weekly tiers bake the discount into the price, so "Je bespaart"
  // never fires for them. Surface a small badge when the effective day rate is
  // genuinely below the list day rate so the customer understands the saving.
  const effectivePerDay = sums.weeklyBreakdown ? sums.weeklyBreakdown.dailyRate
    : sums.days > 0 ? baseSubtotal / sums.days
    : selectedMachine.pricePerDay;
  const hasTierDeal = !isWeekendPkg && (sums.isFlatRate || !!sums.weeklyBreakdown)
    && effectivePerDay < selectedMachine.pricePerDay - 0.01;

  // Day-count is already shown under the total ("· N dagen huur"); the Huurperiode
  // row only names the applied tariff so it stays one clean line. The 6-27 day
  // pro-rata band is also a weekly tariff, so it reads "Werkweektarief".
  const rateLabel = sums.isFlatRate && sums.tierLabel
    ? sums.tierLabel
    : sums.weeklyBreakdown
    ? t("priceSummaryWorkWeekRate")
    : t("priceSummaryDayRate");

  const transportFree = sums.transport === 0 && sums.driver === 0;
  // Trailer is billed per customer-chosen day count (not the rental period) —
  // surface that count the same way the Rijplaten add-on shows "(6 stuks)".
  const trailerDaysSuffix = sums.trailerDays
    ? ` (${sums.trailerDays} ${sums.trailerDays === 1 ? "dag" : "dagen"})`
    : "";
  const transportName = sums.deliveryType === "trailer_rental" ? `${t("priceSummaryTrailerOnLocation")}${trailerDaysSuffix}`
    : sums.deliveryType === "delivery_by_us" ? t("priceSummaryDelivery")
    : t("priceSummaryPickup");
  const transportValue = transportFree ? t("priceSummaryPickupFree") : euro(sums.transport + sums.driver);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">

      {/* Machine preview */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 border-b border-slate-100">
        <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-sm">
          <img
            src={withImageWidth(selectedMachine.imageUrl, 320) || selectedMachine.additionalImages?.[0] || "/placeholder-machine.webp"}
            alt=""
            className="h-full w-full object-contain p-1.5"
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
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide leading-none mb-1.5">{t("priceSummaryReservation")}</p>
          <h4 className="text-sm font-extrabold text-slate-900 leading-tight mb-1">
            {selectedMachine.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}
          </h4>
          {(
            selectedMachine.weeklyOnly && selectedMachine.weeklyPrice ? (
              <span className="text-sm font-black text-slate-800 font-mono">
                {euroCompact(selectedMachine.weeklyPrice)}{t("priceSummaryPerWeek")}
              </span>
            ) : isWeekendPkg ? (
              <span className="text-sm font-black text-amber-700 font-mono">
                {euroCompact(baseSubtotal)} · {sums.tierLabel}
              </span>
            ) : hasTierDeal ? (
              <span className="font-mono flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm font-black text-emerald-600">{euroCompact(effectivePerDay)}{t("priceSummaryPerDay")}</span>
                <span className="text-xs line-through text-slate-400 font-semibold">{euroCompact(selectedMachine.pricePerDay)}{t("priceSummaryPerDay")}</span>
              </span>
            ) : (
              <span className="text-sm font-black text-slate-800 font-mono">
                {euroCompact(selectedMachine.pricePerDay)}{t("priceSummaryPerDay")}
              </span>
            )
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── TOTAAL (prominent) ──────────────────── */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t("priceSummaryTotal")}</p>
          <p className="text-3xl font-black text-slate-900 font-mono leading-none tracking-tight">{euro(sums.total)}</p>
          <p className="text-[11px] font-normal text-slate-400 mt-2.5 leading-snug">
            {t("priceSummaryInclVAT")} · {isWeekendPkg
              ? sums.tierLabel
              : `${sums.days} ${sums.days === 1 ? t("priceSummaryDayRental") : t("priceSummaryDaysRental")}`}
          </p>
          {periodLabel && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mt-2 leading-snug">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{t("priceSummaryRentPeriod")}: {periodLabel}{isWeekendPkg ? " · retour ma 08:00" : ""}</span>
            </p>
          )}
        </div>

        {/* ── SAMENVATTING ───────────────────────── */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <SummaryRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label={t("priceSummaryRate")}
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
              label={(sums.isFlatRate || !!sums.weeklyBreakdown) ? t("priceSummaryCampaignDiscount") : t("priceSummaryYouSave")}
              value={`− ${euro(totalSavings)}`}
              accent={(sums.isFlatRate || !!sums.weeklyBreakdown) ? "amber" : "emerald"}
            />
          )}
          {blockFee > 0 && (
            <SummaryRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label={<SundayBlockLabel t={t} />}
              value={euro(blockFee)}
              accent="amber"
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
          // touch-action: manipulation kills iOS Safari's ~300 ms double-tap-zoom
          // wait, which otherwise swallows the first tap on this toggle. The larger
          // py-3 hit area also helps thumbs land it reliably on mobile.
          style={{ touchAction: "manipulation" }}
          // A filled, bordered pill (same shape language as the trailer/delivery
          // option cards above) instead of a plain text row — the toggle used to
          // blend into the summary rows above it and read as inert copy, not a
          // clickable control.
          className={`w-full flex items-center justify-between gap-2 text-xs font-bold py-3 px-3.5 rounded-xl border transition-colors cursor-pointer select-none ${
            breakdownOpen
              ? "bg-slate-50 border-slate-200 text-slate-800"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
          }`}
        >
          <span>{t("priceSummaryViewBreakdown")}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`} />
        </button>

        {/* ── ACCORDION BODY ─────────────────────── */}
        {breakdownOpen && (
          <div className="space-y-4 rounded-xl bg-slate-50 border border-slate-100 p-4">

            {/* BEREKENING */}
            <div className="space-y-2.5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("priceSummaryCalculation")}</p>

              {!sums.weeklyBreakdown && !sums.isFlatRate && sums.effectiveDailyRate != null && sums.days >= 6 && (
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-[10px] text-emerald-700 font-semibold leading-snug">
                    {t("priceSummaryWorkWeekRate")} {euroCompact(sums.effectiveDailyRate)}{t("priceSummaryPerDay")}
                    <span className="ml-1.5 line-through text-slate-400 font-normal">{euroCompact(selectedMachine.pricePerDay)}{t("priceSummaryPerDay")}</span>
                  </span>
                </div>
              )}

              {sums.weeklyBreakdown ? (
                <>
                  <Row
                    label={`${sums.weeklyBreakdown.weeks}× ${t("priceSummaryWorkWeekRate5Days")}`}
                    value={euro(sums.weeklyBreakdown.weeks * sums.weeklyBreakdown.pricePerWeek)}
                  />
                  {sums.weeklyBreakdown.remainder > 0 && (
                    <Row
                      label={`${sums.weeklyBreakdown.remainder} ${sums.weeklyBreakdown.remainder === 1 ? t("priceSummaryExtraDay") : t("priceSummaryExtraDays")}`}
                      value={euro(sums.weeklyBreakdown.remainderCost ?? sums.weeklyBreakdown.remainder * sums.weeklyBreakdown.dailyRate)}
                    />
                  )}
                </>
              ) : sums.isFlatRate && sums.tierLabel ? (
                <Row label={`1× ${sums.tierLabel}`} value={euro(baseSubtotal)} />
              ) : (
                <Row
                  label={`${sums.days} ${sums.days === 1 ? t("priceSummaryDay") : t("priceSummaryDays")} × ${euroCompact(selectedMachine.pricePerDay)}`}
                  value={euro(sums.rawSubtotal)}
                />
              )}
              {blockFee > 0 && (
                <Row
                  label={<SundayBlockLabel t={t} />}
                  value={euro(blockFee)}
                  accent="amber"
                />
              )}
            </div>

            {/* KORTINGEN */}
            {((!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0) || (sums.campaignSavings ?? 0) > 0) && (
              <>
                <div className="h-px bg-slate-200" />
                <div className="space-y-2.5">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("priceSummaryDiscounts")}</p>
                  {!sums.weeklyBreakdown && !sums.isFlatRate && sums.discountAmount > 0 && (
                    <Row
                      label={<span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 shrink-0" />{sums.discountLabel}</span>}
                      value={`− ${euro(sums.discountAmount)}`}
                      accent="emerald"
                    />
                  )}
                  {(sums.campaignSavings ?? 0) > 0 && (
                    <Row
                      label={<span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 shrink-0" />{t("priceSummaryCampaignDiscount")}</span>}
                      value={`− ${euro(sums.campaignSavings!)}`}
                      accent="amber"
                    />
                  )}
                </div>
              </>
            )}

            {/* BEZORGING + ADD-ONS */}
            <div className="h-px bg-slate-200" />
            <div className="space-y-2.5">
              {sums.transport > 0 || sums.driver > 0 ? (
                <Row
                  label={sums.deliveryType === "trailer_rental" ? `${t("priceSummaryTrailer")}${trailerDaysSuffix}`
                    : t("priceSummaryDelivery")}
                  value={euro(sums.transport + sums.driver)}
                />
              ) : (
                <div className="flex justify-between items-center gap-3 py-0.5">
                  <span className="text-xs font-medium text-slate-600">{t("priceSummaryPickup")}</span>
                  <span className="text-sm font-bold text-emerald-600">{t("priceSummaryPickupFree")}</span>
                </div>
              )}
              {sums.addonCost > 0 && sums.addonDetails.map(addon => (
                <Row key={addon.id} label={addon.name} value={euro(Number(addon.price))} />
              ))}
            </div>

            {/* SUBTOTAAL + BTW */}
            <div className="h-px bg-slate-200" />
            <div className="space-y-2 pt-0.5">
              <Row label={t("priceSummarySubtotalExclVAT")} value={euro(priceExVat)} />
              <Row label={t("priceSummaryVAT21")} value={euro(sums.vat)} dim />
            </div>

          </div>
        )}

      </div>

      {/* Trust footer — korte geruststellingen vlak bij het totaalbedrag,
          precies waar de twijfel ontstaat */}
      <div className="px-4 pb-4">
        <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{t("priceSummaryNoHidden")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{t("priceSummaryWhatsAppSupport")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{t("priceSummaryCertified")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Umbrella className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{t("priceSummaryInsuranceIncluded")}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
