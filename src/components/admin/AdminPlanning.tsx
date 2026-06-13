/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarDays, Truck, RotateCcw, Lock, ChevronLeft, ChevronRight, X, Phone, Mail, MapPin, Package } from "lucide-react";
import { useAppStore } from "../../store/appStore";

interface AdminPlanningProps {
  adminLanguage: string;
}

export default function AdminPlanning({ adminLanguage }: AdminPlanningProps) {
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);
  const machines = useAppStore((state) => state.machines);

  const [view, setView] = useState<"today" | "tomorrow" | "week">("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const al = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const locale = adminLanguage === "tr" ? "tr-TR" : adminLanguage === "en" ? "en-US" : "nl-NL";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

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

  const departingTomorrow = useMemo(() => activeOrders.filter((o) => o.startDate === tomorrowStr), [activeOrders, tomorrowStr]);
  const returningTomorrow = useMemo(() => activeOrders.filter((o) => o.endDate === tomorrowStr), [activeOrders, tomorrowStr]);
  const blockedTomorrow = useMemo(
    () => blockedDates.filter((b) => b.date === tomorrowStr).map((b) => ({ ...b, machineName: machineMap.get(b.machineId) || b.machineId })),
    [blockedDates, machineMap, tomorrowStr]
  );

  const deliveryLabel = (type: string) => {
    if (type === "delivery_by_us") return al("Bezorging", "Delivery", "Teslimat");
    if (type === "trailer_rental") return al("Aanhanger", "Trailer", "Treyler");
    return al("Ophalen", "Pickup", "Teslim Al");
  };

  const isToday = (d: Date) => d.toISOString().split("T")[0] === todayStr;

  const statusBadge = (status: string) => {
    if (status === "Goedgekeurd") return "bg-teal-100 text-teal-700";
    if (status === "Onderweg") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  };

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  // Reusable day-panel for today/tomorrow views
  function DayPanel({ targetStr, departing, returning, blocked, dateLabel }: {
    targetStr: string;
    departing: any[];
    returning: any[];
    blocked: any[];
    dateLabel: string;
  }) {
    const isTargetToday = targetStr === todayStr;
    return (
      <div className="space-y-4">
        <div className="text-center py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-black text-amber-800">{dateLabel}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Departing */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-500" />
              {isTargetToday
                ? al("Vertrek vandaag", "Departing today", "Bugün hareket ediyor")
                : al("Vertrek morgen", "Departing tomorrow", "Yarın hareket ediyor")}
              <span className="ml-auto bg-indigo-100 text-indigo-700 text-[10px] font-mono px-2 py-0.5 rounded-full">
                {departing.length}
              </span>
            </h3>
            {departing.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                {al("Geen machines vertrekken", "No machines departing", "Hareket eden makine yok")}
              </p>
            ) : (
              <div className="space-y-2">
                {departing.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrder(o)}
                    className="w-full text-left flex items-start gap-2.5 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer"
                  >
                    <div className="h-6 w-6 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Truck className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{o.machineName}</p>
                      <p className="text-[10px] text-slate-500">{o.customerName}</p>
                      <p className="text-[10px] text-indigo-600 font-semibold">
                        {deliveryLabel(o.deliveryType)} · {o.rentalDays} {al("dag", "day", "gün")}{o.rentalDays !== 1 ? (adminLanguage === "nl" ? "en" : "s") : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${statusBadge(o.status)}`}>
                      {o.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Returning */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-teal-500" />
              {isTargetToday
                ? al("Retour vandaag", "Returning today", "Bugün geri dönüyor")
                : al("Retour morgen", "Returning tomorrow", "Yarın geri dönüyor")}
              <span className="ml-auto bg-teal-100 text-teal-700 text-[10px] font-mono px-2 py-0.5 rounded-full">
                {returning.length}
              </span>
            </h3>
            {returning.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                {al("Geen machines keren terug", "No machines returning", "Geri dönen makine yok")}
              </p>
            ) : (
              <div className="space-y-2">
                {returning.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrder(o)}
                    className="w-full text-left flex items-start gap-2.5 p-2.5 bg-teal-50 rounded-xl border border-teal-100 hover:bg-teal-100 hover:border-teal-200 transition-colors cursor-pointer"
                  >
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Blocked */}
        {blocked.length > 0 && (
          <div className="bg-white border border-red-100 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              {al("Geblokkeerd", "Blocked", "Bloke")}
              <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-mono px-2 py-0.5 rounded-full">{blocked.length}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {blocked.map((b: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                  <Lock className="h-3 w-3 text-red-400" />
                  <span className="text-[10px] font-bold text-red-800">{b.machineName}</span>
                  {b.reason && <span className="text-[10px] text-red-500">— {b.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {departing.length === 0 && returning.length === 0 && blocked.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            {al("Geen activiteit gepland.", "No activity planned.", "Planlanan aktivite yok.")}
          </div>
        )}
      </div>
    );
  }

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
            {al("Planningsoverzicht", "Planning Overview", "Planlama Özeti")}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {al(
              "Dagelijks en wekelijks overzicht van machinevertrek en ‑retour",
              "Daily and weekly overview of machine departures and returns",
              "Günlük ve haftalık makine hareket özeti"
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          {([
            ["today",    al("Vandaag", "Today",    "Bugün")],
            ["tomorrow", al("Morgen",  "Tomorrow", "Yarın")],
            ["week",     al("Week",    "Week",     "Hafta")],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                view === v ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TODAY VIEW ─────────────────────────────────────────────── */}
      {view === "today" && (
        <DayPanel
          targetStr={todayStr}
          departing={departingToday}
          returning={returningToday}
          blocked={blockedToday}
          dateLabel={today.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        />
      )}

      {/* ── TOMORROW VIEW ──────────────────────────────────────────── */}
      {view === "tomorrow" && (
        <DayPanel
          targetStr={tomorrowStr}
          departing={departingTomorrow}
          returning={returningTomorrow}
          blocked={blockedTomorrow}
          dateLabel={tomorrowDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        />
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
              <ChevronLeft className="h-4 w-4" /> {al("Vorige", "Prev", "Önceki")}
            </button>
            <div className="text-xs font-black text-slate-800 text-center">
              <div>
                {weekDays[0].toLocaleDateString(locale, { day: "numeric", month: "short" })}
                {" – "}
                {weekDays[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {weekOffset === 0 && (
                <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                  {al("deze week", "this week", "bu hafta")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer border-none bg-transparent px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {al("Volgende", "Next", "Sonraki")} <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 7-column day grid — horizontal scroll on mobile */}
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-1">
          <div className="grid grid-cols-7 gap-1.5 min-w-[700px] sm:min-w-0">
            {weekDays.map((day, idx) => {
              const dayStr = day.toISOString().split("T")[0];
              const departing = activeOrders.filter((o) => o.startDate === dayStr);
              const returning = activeOrders.filter((o) => o.endDate === dayStr);
              const blocked = blockedDates.filter((b) => b.date === dayStr);
              const current = isToday(day);

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-1.5 min-h-[140px] flex flex-col gap-1 ${
                    current ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`text-center pb-1 border-b mb-0.5 ${current ? "border-amber-200" : "border-slate-100"}`}>
                    <div className={`text-[10px] uppercase tracking-wide font-bold ${current ? "text-amber-600" : "text-slate-400"}`}>
                      {day.toLocaleDateString(locale, { weekday: "short" })}
                    </div>
                    <div className={`text-sm font-black leading-tight ${current ? "text-amber-700" : "text-slate-800"}`}>
                      {day.getDate()}
                    </div>
                  </div>

                  {departing.map((o) => (
                    <button
                      key={`d-${o.id}`}
                      type="button"
                      title={`${o.machineName} → ${o.customerName}`}
                      onClick={() => setSelectedOrder(o)}
                      onTouchEnd={(e) => { e.preventDefault(); setSelectedOrder(o); }}
                      className="bg-indigo-100 text-indigo-800 rounded-md px-1.5 py-1 text-[10px] font-semibold truncate flex items-center gap-1 hover:bg-indigo-200 transition-colors cursor-pointer border-none w-full text-left min-h-[32px]"
                      style={{ touchAction: "manipulation" }}
                    >
                      <Truck className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.machineName.split(" ")[0]}</span>
                    </button>
                  ))}

                  {returning.map((o) => (
                    <button
                      key={`r-${o.id}`}
                      type="button"
                      title={`${o.machineName} ← ${o.customerName}`}
                      onClick={() => setSelectedOrder(o)}
                      onTouchEnd={(e) => { e.preventDefault(); setSelectedOrder(o); }}
                      className="bg-teal-100 text-teal-800 rounded-md px-1.5 py-1 text-[10px] font-semibold truncate flex items-center gap-1 hover:bg-teal-200 transition-colors cursor-pointer border-none w-full text-left min-h-[32px]"
                      style={{ touchAction: "manipulation" }}
                    >
                      <RotateCcw className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.machineName.split(" ")[0]}</span>
                    </button>
                  ))}

                  {blocked.map((b, i) => (
                    <div
                      key={`b-${i}`}
                      title={b.reason || al("Geblokkeerd", "Blocked", "Bloke")}
                      className="bg-red-100 text-red-700 rounded-md px-1.5 py-1 text-[10px] font-semibold truncate flex items-center gap-1 min-h-[32px]"
                    >
                      <Lock className="h-3 w-3 shrink-0" />
                      <span className="truncate">{machineMap.get(b.machineId)?.split(" ")[0] ?? al("Geblokkeerd", "Blocked", "Bloke")}</span>
                    </div>
                  ))}

                  {departing.length === 0 && returning.length === 0 && blocked.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-300 text-xs">—</div>
                  )}
                </div>
              );
            })}
          </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 text-[10px] text-slate-500 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-200 inline-block" />
              {al("Vertrek", "Departure", "Hareket")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-teal-200 inline-block" />
              {al("Retour", "Return", "Geri Dönüş")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-200 inline-block" />
              {al("Geblokkeerd", "Blocked", "Bloke")}
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL POPUP ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="relative z-[60] w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Top stripe */}
              <div className="h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400" />

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                  <p className="text-[10px] font-mono text-indigo-500 uppercase tracking-widest">{selectedOrder.id}</p>
                  <h3 className="font-display font-black text-slate-900 text-base leading-snug mt-0.5">
                    {selectedOrder.machineName}
                  </h3>
                  <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    selectedOrder.status === "Goedgekeurd" ? "bg-teal-100 text-teal-700"
                    : selectedOrder.status === "Onderweg" ? "bg-blue-100 text-blue-700"
                    : selectedOrder.status === "Voltooid" ? "bg-slate-100 text-slate-600"
                    : selectedOrder.status === "Geannuleerd" ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
                  }`}>{selectedOrder.status}</span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {/* Klant */}
                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {al("Klant", "Customer", "Müşteri")}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{selectedOrder.customerName}</p>
                  {selectedOrder.customerPhone && (
                    <a href={`tel:${selectedOrder.customerPhone}`} className="flex items-center gap-2 text-xs text-indigo-600 no-underline hover:text-indigo-800">
                      <Phone className="h-3 w-3" />{selectedOrder.customerPhone}
                    </a>
                  )}
                  {selectedOrder.customerEmail && (
                    <a href={`mailto:${selectedOrder.customerEmail}`} className="flex items-center gap-2 text-xs text-indigo-600 no-underline hover:text-indigo-800">
                      <Mail className="h-3 w-3" />{selectedOrder.customerEmail}
                    </a>
                  )}
                  {selectedOrder.deliveryAddress && (
                    <div className="flex items-start gap-2 text-xs text-slate-600">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />{selectedOrder.deliveryAddress}
                    </div>
                  )}
                </div>

                {/* Periode & Logistiek */}
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Periode", "Period", "Dönem")}</span>
                    <span className="font-bold text-slate-800">{fmt(selectedOrder.startDate)} – {fmt(selectedOrder.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Dagen", "Days", "Günler")}</span>
                    <span className="font-bold text-slate-800">{selectedOrder.rentalDays} {al("dag", "day", "gün")}{selectedOrder.rentalDays !== 1 ? (adminLanguage === "nl" ? "en" : "s") : ""}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Logistiek", "Logistics", "Lojistik")}</span>
                    <span className="font-bold text-slate-800">{deliveryLabel(selectedOrder.deliveryType)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Profiel", "Profile", "Profil")}</span>
                    <span className="font-bold text-slate-800">{selectedOrder.customerProfile}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-indigo-50">
                    <span className="text-indigo-600 font-mono text-[10px] font-bold">{al("Totaal", "Total", "Toplam")}</span>
                    <span className="font-extrabold text-indigo-700 font-mono">€ {selectedOrder.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Addons */}
                {selectedOrder.addons && selectedOrder.addons.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Package className="h-3 w-3 shrink-0" />
                    {selectedOrder.addons.map((a: any) => a.name).join(" · ")}
                  </div>
                )}

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border-none"
                >
                  {al("Sluiten", "Close", "Kapat")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
