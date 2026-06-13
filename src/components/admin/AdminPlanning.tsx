/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { CalendarDays, Truck, RotateCcw, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "../../store/appStore";

interface AdminPlanningProps {
  adminLanguage: string;
}

export default function AdminPlanning({ adminLanguage: _adminLanguage }: AdminPlanningProps) {
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);
  const machines = useAppStore((state) => state.machines);

  const [view, setView] = useState<"today" | "week">("today");
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return d;
  }, [weekOffset, todayStr]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m.name])), [machines]);

  const activeOrders = useMemo(
    () => orders.filter((o) => ["In behandeling", "Goedgekeurd", "Onderweg"].includes(o.status)),
    [orders]
  );

  const departingToday = useMemo(() => activeOrders.filter((o) => o.startDate === todayStr), [activeOrders, todayStr]);
  const returningToday = useMemo(() => activeOrders.filter((o) => o.endDate === todayStr), [activeOrders, todayStr]);

  const blockedToday = useMemo(
    () => blockedDates.filter((b) => b.date === todayStr).map((b) => ({ ...b, machineName: machineMap.get(b.machineId) || b.machineId })),
    [blockedDates, machineMap, todayStr]
  );

  const deliveryLabel = (type: string) => {
    if (type === "delivery_by_us") return "Bezorging";
    if (type === "trailer_rental") return "Aanhanger";
    return "Ophalen";
  };

  const isToday = (d: Date) => d.toISOString().split("T")[0] === todayStr;

  const statusBadge = (status: string) => {
    if (status === "Goedgekeurd") return "bg-teal-100 text-teal-700";
    if (status === "Onderweg") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <motion.div
      key="planning"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-500" />
            Planningsoverzicht
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dagelijks en wekelijks overzicht van machinevertrek en ‑retour
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          {(["today", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                view === v ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white"
              }`}
            >
              {v === "today" ? "Vandaag" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {/* ── TODAY VIEW ─────────────────────────────────────────────── */}
      {view === "today" && (
        <div className="space-y-4">
          <div className="text-center py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-black text-amber-800">
              {today.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Departing */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-500" />
                Vertrek vandaag
                <span className="ml-auto bg-indigo-100 text-indigo-700 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {departingToday.length}
                </span>
              </h3>
              {departingToday.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Geen machines vertrekken vandaag</p>
              ) : (
                <div className="space-y-2">
                  {departingToday.map((o) => (
                    <div key={o.id} className="flex items-start gap-2.5 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="h-6 w-6 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Truck className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{o.machineName}</p>
                        <p className="text-[10px] text-slate-500">{o.customerName}</p>
                        <p className="text-[10px] text-indigo-600 font-semibold">
                          {deliveryLabel(o.deliveryType)} · {o.rentalDays} dag{o.rentalDays !== 1 ? "en" : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${statusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Returning */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-teal-500" />
                Retour vandaag
                <span className="ml-auto bg-teal-100 text-teal-700 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {returningToday.length}
                </span>
              </h3>
              {returningToday.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Geen machines keren vandaag terug</p>
              ) : (
                <div className="space-y-2">
                  {returningToday.map((o) => (
                    <div key={o.id} className="flex items-start gap-2.5 p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                      <div className="h-6 w-6 rounded-lg bg-teal-500 flex items-center justify-center shrink-0 mt-0.5">
                        <RotateCcw className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{o.machineName}</p>
                        <p className="text-[10px] text-slate-500">{o.customerName}</p>
                        <p className="text-[10px] text-teal-600 font-semibold">
                          {deliveryLabel(o.deliveryType)} · #{o.id}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${statusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Blocked machines today */}
          {blockedToday.length > 0 && (
            <div className="bg-white border border-red-100 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-500" />
                Geblokkeerd vandaag
                <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {blockedToday.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {blockedToday.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    <Lock className="h-3 w-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-800">{b.machineName}</span>
                    {b.reason && <span className="text-[10px] text-red-500">— {b.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {departingToday.length === 0 && returningToday.length === 0 && blockedToday.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              Geen activiteit gepland voor vandaag.
            </div>
          )}
        </div>
      )}

      {/* ── WEEK VIEW ──────────────────────────────────────────────── */}
      {view === "week" && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer border-none bg-transparent px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Vorige
            </button>
            <div className="text-xs font-black text-slate-800 text-center">
              {weekDays[0].toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
              {" – "}
              {weekDays[6].toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
              {weekOffset === 0 && <span className="ml-2 text-amber-600 font-medium">(deze week)</span>}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer border-none bg-transparent px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Volgende <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 7-column day grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day, idx) => {
              const dayStr = day.toISOString().split("T")[0];
              const departing = activeOrders.filter((o) => o.startDate === dayStr);
              const returning = activeOrders.filter((o) => o.endDate === dayStr);
              const blocked = blockedDates.filter((b) => b.date === dayStr);
              const current = isToday(day);

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-1.5 min-h-[130px] flex flex-col gap-1 ${
                    current ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`text-center pb-1 border-b mb-0.5 ${current ? "border-amber-200" : "border-slate-100"}`}>
                    <div className={`text-[9px] uppercase tracking-wide font-bold ${current ? "text-amber-600" : "text-slate-400"}`}>
                      {day.toLocaleDateString("nl-NL", { weekday: "short" })}
                    </div>
                    <div className={`text-xs font-black leading-tight ${current ? "text-amber-700" : "text-slate-800"}`}>
                      {day.getDate()}
                    </div>
                  </div>

                  {departing.map((o) => (
                    <div
                      key={`d-${o.id}`}
                      title={`${o.machineName} → ${o.customerName}`}
                      className="bg-indigo-100 text-indigo-800 rounded px-1 py-0.5 text-[9px] font-semibold truncate flex items-center gap-0.5"
                    >
                      <Truck className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{o.machineName.split(" ")[0]}</span>
                    </div>
                  ))}

                  {returning.map((o) => (
                    <div
                      key={`r-${o.id}`}
                      title={`${o.machineName} ← ${o.customerName}`}
                      className="bg-teal-100 text-teal-800 rounded px-1 py-0.5 text-[9px] font-semibold truncate flex items-center gap-0.5"
                    >
                      <RotateCcw className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{o.machineName.split(" ")[0]}</span>
                    </div>
                  ))}

                  {blocked.map((b, i) => (
                    <div
                      key={`b-${i}`}
                      title={b.reason || "Geblokkeerd"}
                      className="bg-red-100 text-red-700 rounded px-1 py-0.5 text-[9px] font-semibold truncate flex items-center gap-0.5"
                    >
                      <Lock className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{machineMap.get(b.machineId)?.split(" ")[0] ?? "Geblokkeerd"}</span>
                    </div>
                  ))}

                  {departing.length === 0 && returning.length === 0 && blocked.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-300 text-[9px]">—</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 text-[10px] text-slate-500 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-200 inline-block" />
              Vertrek
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-teal-200 inline-block" />
              Retour
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-200 inline-block" />
              Geblokkeerd
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
