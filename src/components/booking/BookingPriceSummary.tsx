/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TrendingDown } from "lucide-react";
import { Machine } from "../../types";

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
  };
}

export default function BookingPriceSummary({ selectedMachine, sums }: BookingPriceSummaryProps) {
  if (!selectedMachine) {
    return (
      <div className="glass-panel p-6 rounded-3xl text-center space-y-3 bg-white border border-slate-200 shadow-md">
        <div className="mx-auto h-10 w-10 bg-slate-50 text-slate-400 flex items-center justify-center rounded-full border border-slate-100 shadow-inner">
          <TrendingDown className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-700">Specificatie leeg</h4>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
            Kies een hoogwerker of kluspakket uit de catalogus om uw realtime prijsberekening te starten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl bg-white border border-slate-200">
      <div className="border-b border-slate-200 pb-2.5">
        <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-500">
          Huur Specificatie
        </h4>
      </div>

      {/* Product Card */}
      <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
        <div className="h-12 w-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
          <img 
            src={selectedMachine.imageUrl} 
            alt="" 
            className="h-full w-full object-cover" 
            referrerPolicy="no-referrer" 
            onError={(e) => {
              e.currentTarget.src = "/placeholder-machine.webp";
            }}
          />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-800 truncate leading-none">{selectedMachine.name}</h4>
          <span className="text-[9.5px] text-teal-700 block font-bold font-mono mt-1.5 leading-none">€ {selectedMachine.pricePerDay} / dag</span>
        </div>
      </div>

      {/* Sum details */}
      <div className="space-y-2 pt-2 text-xs">
        
        <div className="flex justify-between items-center text-slate-500">
          <span>Aantal dagen gevraagd:</span>
          <span className="font-bold text-slate-800 font-mono">{sums.days} {sums.days === 1 ? 'dag' : 'dagen'}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500">
          <span>Bruto lokatieduur tarief:</span>
          <span className="font-bold text-slate-800 font-mono">€ {sums.rawSubtotal}</span>
        </div>

        {sums.discountAmount > 0 && (
          <div className="flex justify-between items-center text-emerald-700 font-bold">
            <span className="flex items-center space-x-1">
              <TrendingDown className="h-3 w-3 shrink-0" />
              <span>{sums.discountLabel}:</span>
            </span>
            <span className="font-mono font-bold">- € {sums.discountAmount.toFixed(0)}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-slate-500 border-b border-slate-100 pb-2">
          <span>Netto lokatieduur tarief:</span>
          <span className="font-bold text-slate-800 font-mono">€ {sums.subtotal.toFixed(0)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500">
          <span>Transportkosten (Heen/Weer):</span>
          <span className="font-bold text-slate-800 font-mono">
            {sums.transport > 0 ? `€ ${sums.transport}` : "Zelf ophalen"}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-500 border-b border-slate-100 pb-2">
          <span>Chauffeur & Demonstratie:</span>
          <span className="font-bold text-slate-800 font-mono">
            {sums.driver > 0 ? `€ ${sums.driver}` : "Enkel Afhalen"}
          </span>
        </div>

        {sums.addonCost > 0 && (
          <div className="border-b border-slate-100 pb-2">
            <span className="text-[10px] text-indigo-700 font-mono font-bold uppercase tracking-wider block mb-1">Toegevoegde Extra's (Sepet):</span>
            <div className="space-y-1">
              {sums.addonDetails.map(addon => (
                <div key={addon.id} className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>• {addon.name}:</span>
                  <span className="font-bold text-teal-700 font-mono">€ {addon.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-slate-500">
          <span>Omzetbelasting BTW (21%):</span>
          <span className="font-bold text-slate-800 font-mono">€ {sums.vat.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-end pt-3 border-t border-slate-100">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block leading-none">Totaal Overeenkomst</span>
            <span className="text-[8px] text-slate-400">Inclusief BTW & Training</span>
          </div>
          <span className="text-xl font-mono font-black text-indigo-650 text-indigo-600 leading-none">
            € {sums.total.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
