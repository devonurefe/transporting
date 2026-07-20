/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  X, ShoppingCart, ChevronLeft, ChevronRight, Package, Zap, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine } from "../types";
import { buildPricingTierRows } from "../utils/pricing";
import { getSpecsForMachine } from "../utils/machineSpecs";
import { withVat, priceNum } from "../utils/format";
import { withImageWidth } from "../utils/image";
import { useLanguageStore } from "../store/languageStore";
import { useModalA11y } from "../hooks/useModalA11y";
import VatToggle from "./VatToggle";
import { CardBrandWatermark } from "./Header";

type CategoryInfoEntry = {
  id: string;
  infoContent?: { useCases?: string[]; advantages?: string[]; notFor?: string[] };
};

export interface MachineDetailModalProps {
  machine: Machine;
  onClose: () => void;
  onBook: (machine: Machine) => void;
  vatDisplay: "incl" | "excl";
  customCategories?: CategoryInfoEntry[];
  showPricing?: boolean;
}

function getDefaultPackageItems(id: string): string[] {
  switch (id) {
    case "set-paint-comfort": return [
      "1x Gecertificeerde Elektrische Schaarlift (12m werkhoogte)",
      "2x 20m zware rubberen verlengkabels (230V / IP44)",
      "1x Handige gereedschapsbak gemonteerd op het werkplatform",
      "1x Luxe comfort-veiligheidsharnas (EN-361 gekeurd)",
      "4x Non-marking witte banden (geen sporen op luxe vloeren)",
      "10m Vloerbeschermingsvlies (gratis meegeleverd)",
    ];
    case "set-solar-pro": return [
      "1x Knikarmhoogwerker (18m werkhoogte, 16m zijdelings bereik)",
      "2x Heavy-duty materiaalgordels met verstelbare karbijnhaakjes",
      "1x Speciaal ontworpen zonnepaneel-draagbeugel aan de korf",
      "1x Alleenstaand EN-361 Premium valbeveiligingsset Pro met schokdemper",
      "1x Geïntegreerde 230V stroomaansluiting rechtstreeks in de werkbak",
    ];
    case "set-prune-compact": return [
      "1x Spinhoogwerker Spider (15m werkhoogte) op smalle rupsbanden",
      "4x Heavy-duty kunststof rijplaten (voorkomt sporen in gazons)",
      "1x Gecertificeerde bosbouwer snoeihelm met vizier en oorkappen",
      "1x Magnetische relingtray voor snoeigereedschappen",
      "1x Biologische kettingzaagolie (1 Liter)",
      "1x Spanbandenset voor extra stempelfixatie op hellingen",
    ];
    case "set-gutter-fast": return [
      "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
      "1x Telescopische dakgootschep & telescopische trekker/bezem set",
      "1x Geïntegreerde 230V stroomaansluiting in de korf",
      "1x Geperforeerde aluminium werkbak voor emmers en afval",
      "1x Set van 4 wegafzettingspionnen met reflecterende strips",
      "1x Veiligheidshesje en handschoenen (maat L)",
    ];
    case "set-facade-heavy": return [
      "1x Telescoophoogwerker Diesel (26m werkhoogte) - 4x4 aangedreven",
      "2x Slanghaspel mastklemmen voor hogedrukslangen tot korf",
      "1x Geïntegreerde generator unit (stroom & hogedrukwatertoevoer)",
      "2x Waterdichte mouwbeschermers & vizierbrillen voor gevelspuiten",
      "1x RVS werkbakorganizer voor spuitlansen",
    ];
    case "set-window-premium": return [
      "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
      "1x Osmose watertank montagebeugels aan de werkbak",
      "1x Extra brede 2-persoons platformbak (gondel)",
      "4x Stempelschotels om wegzakken in zachte straatstenen te voorkomen",
      "1x Ruitenwisserset Pro (trekkers, inwasmoffen & telescoopsteel)",
      "1x Waterbestendige opbergtas aan de korf",
    ];
    case "set-diy-weekend": return [
      "1x Compacte Elektrische Schaarlift (12m werkhoogte)",
      "1x Comfort EN-361 gecertificeerd veiligheidsharnas",
      "1x Premium klushelm met kinband",
      "1x Stap-voor-stap gedrukte handleiding 'Veilig Werken op Hoogte'",
      "Voorrangstoegang tot onze 24/7 telefonische hulplijn (WhatsApp)",
    ];
    case "set-light-install": return [
      "1x Spinhoogwerker Hybrid (15m werkhoogte) op rupsen",
      "1x Automatische veertrommel haspelkit voor mastbekabeling",
      "1x Magnetische bak voor schroeven, klemmen en zekeringen",
      "2x Comfort harnassen met snelgespen",
      "1x Professionele laser nevelmeter (te leen)",
    ];
    default: return [
      "1x Professionele en gekeurde machine",
      "1x Volle tank brandstof of 100% opgeladen accupakket",
      "1x Hub service inspectie voorafgaand aan aflevering",
      "BMWT Veiligheidscertificaat handleiding in de werkbak",
      "24/7 Technische storingshulp & backup service",
    ];
  }
}

export default function MachineDetailModal({
  machine,
  onClose,
  onBook,
  vatDisplay,
  customCategories = [],
  showPricing = true,
}: MachineDetailModalProps) {
  const t = useLanguageStore((state) => state.t);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const dialogRef = useModalA11y(true, onClose);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [machine.id]);

  const vp = (p: number) => withVat(p, vatDisplay);
  const vatLabel = vatDisplay === "incl" ? "incl. btw" : "excl. btw";
  // Same row-builder as CatalogSection's "Alle tarieven & kortingen" preview —
  // keeps the two tariff tables for a product identical (they used to be
  // separately hand-rolled here and drifted, e.g. always showing "1 dag" even
  // for machines with a minRentalDays of 2).
  const pricingRows = buildPricingTierRows(machine);
  const catInfo = customCategories.find(c => c.id === machine.category)?.infoContent ?? null;
  const allImages = [machine.imageUrl, ...(machine.additionalImages ?? [])].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
  const packageItems = machine.packageContents?.trim()
    ? machine.packageContents.split(";").map(s => s.trim()).filter(Boolean)
    : null;
  // Render **bold** segments (e.g. legally required stabilizers) within a package line.
  const renderPkg = (item: string) =>
    item.split(/\*\*(.+?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-bold text-slate-900">{part}</strong> : part
    );

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto flex items-start sm:items-center justify-center p-4"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${machine.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")} — details`}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 26 }}
        // max-w-4xl (896px) read as oversized on desktop — the aspect-video hero
        // image alone rendered ~500px tall, dwarfing everything below it. max-w-2xl
        // only ever shrinks the sm:+ breakpoints in practice since mobile viewports
        // are already narrower than that, so this doesn't touch the mobile layout.
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden z-[60] flex flex-col max-h-[90vh] my-8 outline-none"
      >
        {/* Top gradient stripe */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-orange-400 to-amber-400" />

        {/* Header */}
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div>
            <span className="text-xs text-teal-600 uppercase tracking-widest block font-bold">
              {machine.categoryLabel || "Vloot Details"} • {machine.powerType}
            </span>
            <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              {machine.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-4 scrollbar-thin scrollbar-thumb-slate-200">

          {/* A — Images */}
          <div className="space-y-2">
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm relative group">
              <CardBrandWatermark size="lg" />
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIndex}
                  src={allImages[activeImageIndex] ?? "/placeholder-machine.webp"}
                  alt={`${machine.name} — foto ${activeImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent pointer-events-none" />
              {allImages.length > 1 && (
                <>
                  <button type="button" aria-label="Vorige foto"
                    onClick={(e) => { e.stopPropagation(); setActiveImageIndex(p => p === 0 ? allImages.length - 1 : p - 1); }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                  ><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" aria-label="Volgende foto"
                    onClick={(e) => { e.stopPropagation(); setActiveImageIndex(p => p === allImages.length - 1 ? 0 : p + 1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                  ><ChevronRight className="h-5 w-5" /></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-950/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    {allImages.map((_, i) => (
                      <button key={i} type="button" onClick={() => setActiveImageIndex(i)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeImageIndex ? "bg-white w-3.5" : "bg-white/50 hover:bg-white w-1.5"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto overscroll-x-contain py-0.5 scrollbar-none">
                {allImages.map((url, i) => (
                  <button key={i} type="button" onClick={() => setActiveImageIndex(i)}
                    className={`relative h-11 w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-white ${i === activeImageIndex ? "border-orange-500 ring-2 ring-orange-400/20" : "border-slate-200 hover:border-slate-400"}`}
                  >
                    <img src={withImageWidth(url, 320) ?? url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* B — Pricing tiers */}
          {showPricing && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Dagtarief</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-display font-black text-slate-900">€{priceNum(vp(machine.pricePerDay))}</span>
                    <span className="text-[10px] text-slate-500">{vatLabel} p/dag</span>
                  </div>
                </div>
                <VatToggle size="xs" />
              </div>
              <div className="divide-y divide-slate-100">
                {pricingRows.map((row, i) => {
                  const bg = row.highlight === "fire" ? "bg-amber-50"
                    : row.highlight === "green" ? "bg-emerald-50"
                    : row.highlight === "teal" ? "bg-teal-50"
                    : row.highlight === "violet" ? "bg-amber-50" : "bg-white";
                  const text = row.highlight === "fire" ? "text-amber-700"
                    : row.highlight === "green" ? "text-emerald-700"
                    : row.highlight === "teal" ? "text-teal-700"
                    : row.highlight === "violet" ? "text-amber-700" : "text-slate-800";
                  const subtext = row.highlight === "fire" ? "text-amber-500"
                    : row.highlight === "green" ? "text-emerald-600"
                    : row.highlight === "teal" ? "text-teal-600"
                    : row.highlight === "violet" ? "text-amber-600" : "text-slate-500";
                  const badgeCls = row.highlight === "teal" ? "bg-teal-100 text-teal-700" : "bg-emerald-100 text-emerald-700";
                  return (
                    <div key={i} className={`flex items-center px-4 py-2.5 ${bg}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${text}`}>{row.period}</p>
                        <p className={`text-[10px] leading-snug ${subtext}`}>{row.when}</p>
                      </div>
                      {row.badge && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full mr-2 ${badgeCls}`}>{row.badge}</span>}
                      {row.highlight === "fire" && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mr-2">Actie</span>}
                      <span className={`font-mono font-extrabold text-sm shrink-0 whitespace-nowrap ${text}`}>
                        {row.pricePrefix ?? ""}€{priceNum(vp(row.price))}
                      </span>
                    </div>
                  );
                })}
                {machine.campaignText && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50">
                    <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-amber-700">
                      {machine.campaignText}{machine.campaignDiscountPercent ? ` −${machine.campaignDiscountPercent}%` : ""}
                    </span>
                  </div>
                )}
                {machine.weekendRulesEnabled && (
                  <div className="px-4 py-3 bg-amber-100/70 space-y-1">
                    <p className="text-xs font-bold text-amber-900 leading-snug flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>Alleen za, zo of za+zo? Vast weekendtarief. Langer (of vanaf vrijdag)? Gewoon dagtarief.</span>
                    </p>
                    {machine.sundayBlockFee ? (
                      <p className="text-xs font-bold text-amber-900 leading-snug pl-5">
                        Huur t/m zaterdag? +€{priceNum(vp(machine.sundayBlockFee))} zondagblokkade, retour ma 08:00.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C — Description */}
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Omschrijving</p>
            <p className="text-slate-700 text-sm leading-relaxed">{machine.description?.replace(/\s*\(Unit\s+\d+\)/gi, "").replace(/\s{2,}/g, " ").trim()}</p>
          </div>

          {/* D — Technical specs */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Technische Specificaties</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                <span className="text-xs text-slate-500 font-medium">Type machine</span>
                <span className="text-sm font-bold text-slate-900">{machine.categoryLabel}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                <span className="text-xs text-slate-500 font-medium">Werkhoogte</span>
                <span className="text-sm font-bold text-slate-900 font-mono text-right">{machine.height} m</span>
              </div>
              {machine.reach > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                  <span className="text-xs text-slate-500 font-medium">Uitreik</span>
                  <span className="text-sm font-bold text-slate-900 font-mono text-right">{machine.reach} m</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                <span className="text-xs text-slate-500 font-medium">Gewicht</span>
                <span className="text-sm font-bold text-slate-900 font-mono text-right">{machine.weight.toLocaleString("nl-NL")} kg</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                <span className="text-xs text-slate-500 font-medium">Aandrijving</span>
                <span className="text-sm font-bold font-mono text-slate-900 text-right">
                  {machine.powerType}
                </span>
              </div>
              {getSpecsForMachine(machine.id, (machine as any).specs).map((spec) => (
                <div key={spec.label} className="flex items-center justify-between px-3 py-2.5 bg-white">
                  <span className="text-xs text-slate-500 font-medium">{spec.label}</span>
                  <span className="text-sm font-bold text-slate-700 text-right max-w-[55%]">{spec.value}</span>
                </div>
              ))}
            </div>
            {machine.packageContents && (() => {
              const items = machine.packageContents!.split(";").map(s => s.trim()).filter(Boolean);
              return items.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Inbegrepen</p>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="text-emerald-500 font-black shrink-0 mt-0.5 select-none">✓</span><span>{renderPkg(item)}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          {/* F — Toepassing & Geschiktheid */}
          {catInfo && (catInfo.useCases?.length || catInfo.advantages?.length || catInfo.notFor?.length) ? (
            <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Toepassing & Geschiktheid</p>
              {catInfo.useCases && catInfo.useCases.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoUseCases")}</p>
                  <ul className="space-y-1.5">
                    {catInfo.useCases.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                        <span className="text-emerald-500 font-black shrink-0 mt-0.5 select-none">✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {catInfo.advantages && catInfo.advantages.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoAdvantages")}</p>
                  <ul className="space-y-1.5">
                    {catInfo.advantages.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                        <span className="text-orange-500 font-black shrink-0 mt-0.5 select-none">+</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {catInfo.notFor && catInfo.notFor.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">{t("infoNotFor")}</p>
                  <ul className="space-y-1.5">
                    {catInfo.notFor.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                        <span className="text-rose-400 font-black shrink-0 mt-0.5 select-none">✕</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {/* G — Package contents */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600 shrink-0" />
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Inbegrepen in de Huurprijs</p>
            </div>
            <div className="space-y-2">
              {(packageItems ?? getDefaultPackageItems(machine.id)).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="text-teal-600 font-bold shrink-0 mt-0.5 select-none">✓</span>
                  <span>{renderPkg(item)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* H — Compliance */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 border border-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold">BMWT</span>
              <span>Jaarlijks veilig gekeurd</span>
            </div>
            <span className="font-mono text-slate-500">Art. {machine.id}</span>
          </div>

        </div>

        {/* Footer — price + CTA, always visible on all screen sizes. Sluiten stays
            pinned left; price chip + Huur Nu are grouped on the right from sm: so they
            read as one unit instead of Huur Nu stretching to fill the entire row next
            to a comparatively tiny price on wide screens. */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-200 shrink-0 mt-3">
          <button
            onClick={onClose}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Sluiten
          </button>
          <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
            <div className="shrink-0 px-3 py-2 hidden sm:block bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-[9px] text-slate-500 leading-none">per dag</p>
              <p className="text-sm font-black text-slate-900 font-mono leading-tight">
                €{priceNum(vp(machine.pricePerDay))}<span className="text-[10px] font-normal text-slate-500">/dag</span>
              </p>
            </div>
            <button
              onClick={() => onBook(machine)}
              className="cta-shine flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 sm:px-8 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
            >
              <ShoppingCart className="h-4 w-4" />
              Huur Nu
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
