/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowUpToLine, ArrowRightLeft, Weight, Zap, ShoppingCart, ShieldCheck } from "lucide-react";
import { Machine } from "../types";
import { useAppStore } from "../store/appStore";
import { euro, euroCompact } from "../utils/format";
import { buildPricingTierRows } from "../utils/pricing";
import { useSeo, SEO_BASE_URL } from "../utils/seo";
import MachineDetailModal from "./MachineDetailModal";

interface MachineDetailPageProps {
  onSelectMachineForBooking: (machine: Machine) => void;
}

/**
 * Dedicated, crawlable page per machine (/hoogwerker/:id). Gives Google a unique
 * URL + real content + meta (server injects per-machine <title>/OG/Product JSON-LD).
 */
export default function MachineDetailPage({ onSelectMachineForBooking }: MachineDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const machines = useAppStore((s) => s.machines);
  const vatDisplay = useAppStore((s) => s.vatDisplay);
  const customCategories = useAppStore((s) => s.customCategories);
  const [showModal, setShowModal] = useState(false);

  const machine = useMemo(() => machines.find((m) => m.id === id), [machines, id]);

  // Client-side title/canonical/OG + BreadcrumbList for SPA navigation (server
  // already injects Product JSON-LD + meta for crawlers on direct/shared links).
  useSeo(
    machine
      ? {
          title: `${machine.name} huren — ${euroCompact(machine.pricePerDay)}/dag | huurgo`,
          description: machine.description
            ? machine.description.replace(/\s+/g, " ").trim().slice(0, 155)
            : `${machine.name} huren bij huurgo. Werkhoogte ${machine.height}m. Direct online reserveren, zonder borg.`,
          path: `/hoogwerker/${machine.id}`,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SEO_BASE_URL },
              { "@type": "ListItem", position: 2, name: "Catalogus", item: `${SEO_BASE_URL}/catalog` },
              { "@type": "ListItem", position: 3, name: machine.name, item: `${SEO_BASE_URL}/hoogwerker/${machine.id}` },
            ],
          },
        }
      : { title: "Machine niet gevonden | huurgo", path: "/catalog" }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [machine]);

  // Still loading the catalog
  if (machines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">Laden…</div>
    );
  }

  // Deactivated machines are treated as "not found" — a direct/shared link must
  // never bypass the admin's decision to take a unit offline for booking.
  if (!machine || machine.isActive === false) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-lg font-black text-slate-900">Machine niet gevonden</h1>
        <p className="text-sm text-slate-500">Deze machine bestaat niet (meer). Bekijk ons volledige aanbod.</p>
        <Link to="/catalog" className="inline-block bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
          Naar het assortiment
        </Link>
      </div>
    );
  }

  // Same row-builder as MachineDetailModal/CatalogSection's tariff table — this
  // page used to hand-roll its own (Dagtarief/Werkweektarief/Maandtarief only),
  // which drifted from the real pricing engine: it ignored oneDayPrice/twoDay/
  // threeDay/fourDay/weekendPrice tiers entirely and didn't respect
  // minRentalDays, exactly the class of bug buildPricingTierRows() was created
  // to prevent (see its own comment in pricing.ts).
  const pricingRows = buildPricingTierRows(machine);
  const book = () => { onSelectMachineForBooking(machine); navigate("/booking"); };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <Link to="/catalog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar het assortiment
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Image — object-contain so the full machine fits (wide ladderliften
            were cropped by object-cover); white/slate frame absorbs the margins. */}
        <div className="rounded-3xl overflow-hidden bg-white border border-slate-200 aspect-[4/3] p-3 sm:p-4">
          <img
            src={machine.imageUrl || machine.additionalImages?.[0] || "/placeholder-machine.webp"}
            alt={machine.imageAlt || `${machine.name} huren`}
            className="h-full w-full object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
          />
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{machine.categoryLabel || machine.category}</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{machine.name} huren</h1>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{euroCompact(machine.pricePerDay)}</span>
            <span className="text-sm text-slate-500">per dag (excl. btw)</span>
          </div>

          {/* Spec chips */}
          <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-600">
            <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full" title="Werkhoogte">
              <ArrowUpToLine className="h-3.5 w-3.5 text-orange-500" /> {machine.height}m werkhoogte
            </span>
            {machine.reach > 0 && (
              <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full" title="Reikwijdte">
                <ArrowRightLeft className="h-3.5 w-3.5 text-orange-400" /> {machine.reach}m reik
              </span>
            )}
            {machine.weight > 0 && (
              <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full" title="Gewicht">
                <Weight className="h-3.5 w-3.5 text-slate-400" /> {machine.weight} kg
              </span>
            )}
            <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full" title="Aandrijving">
              <Zap className="h-3.5 w-3.5 text-emerald-500" /> {machine.powerType}
            </span>
          </div>

          {/* Price tiers — full tariff table (1-dag actie, weekend, per-day tiers,
              werkweek/maand + korting-badges), identical to the modal's table */}
          <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-600">Dagtarief</span>
              <span className="font-bold text-slate-800 font-mono">{euro(machine.pricePerDay)}</span>
            </div>
            {pricingRows.map((row, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-2.5">
                <div>
                  <span className="text-slate-600">{row.period}</span>
                  {row.badge && <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{row.badge}</span>}
                </div>
                <span className="font-bold text-slate-800 font-mono">{row.pricePrefix ?? ""}{euro(row.price)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={book}
              disabled={machine.operationallyBlocked}
              className="cta-shine flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-orange-500"
            >
              <ShoppingCart className="h-4 w-4" /> {machine.operationallyBlocked ? "Niet beschikbaar" : "Huur Nu"}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all"
            >
              Specificaties
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Zonder borg · direct online geregeld · snel geleverd in Zuid-Holland
          </p>
        </div>
      </div>

      {/* Description */}
      {machine.description ? (
        <div className="mt-8 max-w-3xl">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-2">Over de {machine.name}</h2>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{machine.description}</p>
        </div>
      ) : null}

      {/* Full spec modal (reuses the existing component) */}
      {showModal && (
        <MachineDetailModal
          machine={machine}
          onClose={() => setShowModal(false)}
          onBook={(m) => { setShowModal(false); onSelectMachineForBooking(m); navigate("/booking"); }}
          vatDisplay={vatDisplay}
          customCategories={customCategories}
        />
      )}
    </div>
  );
}
