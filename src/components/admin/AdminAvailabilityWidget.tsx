import React, { useState, useMemo } from "react";
import { CalendarSearch, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { checkAvailability } from "../../utils/availability";

export default function AdminAvailabilityWidget() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const machines = useAppStore((s) => s.machines);
  const orders = useAppStore((s) => s.orders);
  const blockedDates = useAppStore((s) => s.blockedDates);

  const todayStr = new Date().toISOString().split("T")[0];

  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  const results = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return null;

    // Group machines by base model name
    const modelMap: Record<string, { units: typeof machines; }> = {};
    machines.forEach(m => {
      if (m.category === "klussensets") return;
      const base = getBaseName(m.name);
      if (!modelMap[base]) modelMap[base] = { units: [] };
      modelMap[base].units.push(m);
    });

    // Same engine the public booking flow uses (src/utils/availability.ts) —
    // combines orders AND blocked dates (maintenance/keuring), honoring
    // bufferDays and stockQuantity, so this widget can't show "Beschikbaar"
    // for a machine an admin just blocked in the Calendar panel.
    return Object.entries(modelMap).map(([base, { units }]) => {
      const freeUnits = units.filter(unit =>
        checkAvailability(
          unit.id, startDate, endDate, orders, blockedDates, todayStr,
          unit.bufferDays ?? 0, unit.stockQuantity ?? 1
        ).available
      );

      return {
        name: base,
        total: units.length,
        free: freeUnits.length,
        category: units[0].categoryLabel,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [startDate, endDate, machines, orders, blockedDates, todayStr]);

  return (
    <div className="glass-panel p-4 rounded-2xl hidden lg:block bg-white border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center space-x-2">
        <CalendarSearch className="h-4 w-4 text-indigo-600 shrink-0" />
        <h4 className="font-display font-bold text-[10px] uppercase text-slate-500 tracking-wider">
          Beschikbaarheid Checker
        </h4>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Van</label>
            <input
              type="date"
              value={startDate}
              min={todayStr}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Tot</label>
            <input
              type="date"
              value={endDate}
              min={startDate || todayStr}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
            />
          </div>
        </div>
      </div>

      {!results && (
        <p className="text-[10px] text-slate-400 text-center py-1">Kies een periode om beschikbaarheid te zien.</p>
      )}

      {startDate && endDate && startDate > endDate && (
        <p className="text-[10px] text-rose-500 text-center py-1">Einddatum moet na begindatum liggen.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-none">
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-800 truncate">{r.name}</p>
                <p className="text-[9px] text-slate-400">{r.category}</p>
              </div>
              <div className="shrink-0 ml-2">
                {r.free === 0 ? (
                  <span className="flex items-center space-x-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                    <XCircle className="h-2.5 w-2.5" />
                    <span>Bezet</span>
                  </span>
                ) : r.free === r.total ? (
                  <span className="flex items-center space-x-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    <span>{r.free}/{r.total}</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <MinusCircle className="h-2.5 w-2.5" />
                    <span>{r.free}/{r.total}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
