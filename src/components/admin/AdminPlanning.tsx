/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarDays, Truck, RotateCcw, Lock, ChevronLeft, ChevronRight, X, Phone, Mail, MapPin, Package } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { euro } from "../../utils/format";
import AdminStatusBadge from "./AdminStatusBadge";

type AnyOrder = any;

function makeAl(adminLanguage: string) {
  return (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };
}

function makeLocale(adminLanguage: string) {
  return adminLanguage === "tr" ? "tr-TR" : adminLanguage === "en" ? "en-US" : "nl-NL";
}

// Formats a Date as "YYYY-MM-DD" using LOCAL calendar day, not UTC.
// toISOString() returns UTC which is one day behind in UTC+ timezones (NL = UTC+1/+2).
function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── DayPanel — defined OUTSIDE AdminPlanning so React doesn't remount it ──
interface DayPanelProps {
  targetStr: string;
  todayStr: string;
  departing: AnyOrder[];
  returning: AnyOrder[];
  blocked: { machineId: string; machineName: string; reason?: string }[];
  dateLabel: string;
  adminLanguage: string;
  onSelectOrder: (o: AnyOrder) => void;
}

const DayPanel = React.memo(function DayPanel({
  targetStr, todayStr, departing, returning, blocked, dateLabel, adminLanguage, onSelectOrder,
}: DayPanelProps) {
  const al = makeAl(adminLanguage);
  const isTargetToday = targetStr === todayStr;

  const deliveryLabel = (type: string) => {
    if (type === "delivery_by_us") return al("Bezorging", "Delivery", "Teslimat");
    if (type === "trailer_rental") return al("Aanhanger", "Trailer", "Treyler");
    return al("Ophalen", "Pickup", "Teslim Al");
  };

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
            <span className="ml-auto bg-indigo-100 text-indigo-700 text-[10px] font-mono px-2 py-0.5 rounded-full">{departing.length}</span>
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
                  onClick={() => onSelectOrder(o)}
                  className="w-full text-left flex items-start gap-2.5 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer"
                >
                  <div className="h-6 w-6 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{o.machineName}</p>
                    <p className="text-[10px] text-slate-500">{o.customerName}</p>
                    <p className="text-[10px] text-indigo-600 font-semibold">
                      {deliveryLabel(o.deliveryType)} · {o.rentalDays} {al("dag", "day", "gün")}{o.rentalDays !== 1 ? (adminLanguage === "nl" ? "en" : adminLanguage === "en" ? "s" : "") : ""}
                    </p>
                  </div>
                  <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} className="shrink-0" />
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
            <span className="ml-auto bg-teal-100 text-teal-700 text-[10px] font-mono px-2 py-0.5 rounded-full">{returning.length}</span>
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
                  onClick={() => onSelectOrder(o)}
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
                  <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} className="shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="bg-white border border-red-100 rounded-2xl p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
            <Lock className="h-4 w-4 text-red-500" />
            {al("Geblokkeerd", "Blocked", "Bloke")}
            <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-mono px-2 py-0.5 rounded-full">{blocked.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {blocked.map((b, i) => (
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
});

// ── WeekGrid — memoized so it doesn't re-render when popup opens/closes ──
interface WeekGridProps {
  weekDays: Date[];
  activeOrders: AnyOrder[];
  blockedDates: { machineId: string; date: string; reason?: string }[];
  todayStr: string;
  machineMap: Map<string, string>;
  locale: string;
  adminLanguage: string;
  onSelectOrder: (o: AnyOrder) => void;
}

const WeekGrid = React.memo(function WeekGrid({
  weekDays, activeOrders, blockedDates, todayStr, machineMap, locale, adminLanguage, onSelectOrder,
}: WeekGridProps) {
  const al = makeAl(adminLanguage);

  const departingByDate = useMemo(() => {
    const m = new Map<string, AnyOrder[]>();
    for (const o of activeOrders) {
      if (!m.has(o.startDate)) m.set(o.startDate, []);
      m.get(o.startDate)!.push(o);
    }
    return m;
  }, [activeOrders]);

  const returningByDate = useMemo(() => {
    const m = new Map<string, AnyOrder[]>();
    for (const o of activeOrders) {
      if (!m.has(o.endDate)) m.set(o.endDate, []);
      m.get(o.endDate)!.push(o);
    }
    return m;
  }, [activeOrders]);

  const blockedByDate = useMemo(() => {
    const m = new Map<string, typeof blockedDates>();
    for (const b of blockedDates) {
      if (!m.has(b.date)) m.set(b.date, []);
      m.get(b.date)!.push(b);
    }
    return m;
  }, [blockedDates]);

  return (
    <div className="grid grid-cols-7 gap-1.5 min-w-[700px] sm:min-w-0">
      {weekDays.map((day, idx) => {
        const dayStr = fmtLocalDate(day);
        const departing = departingByDate.get(dayStr) ?? [];
        const returning = returningByDate.get(dayStr) ?? [];
        const blocked = blockedByDate.get(dayStr) ?? [];
        const current = dayStr === todayStr;

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
                onClick={() => onSelectOrder(o)}
                onTouchEnd={(e) => { e.preventDefault(); onSelectOrder(o); }}
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
                onClick={() => onSelectOrder(o)}
                onTouchEnd={(e) => { e.preventDefault(); onSelectOrder(o); }}
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
  );
});

// ── WeekDayList — mobile stacked alternative to WeekGrid (no horizontal
// scroll). WeekGrid's 7-column layout needs min-w-[700px] to stay readable,
// which forces sideways scrolling on a phone; this shows the same per-day
// data as one card per day instead, mirroring the md:hidden card pattern
// already used in AdminOrders/AdminMachines/AdminCustomers. ──
const WeekDayList = React.memo(function WeekDayList({
  weekDays, activeOrders, blockedDates, todayStr, machineMap, locale, adminLanguage, onSelectOrder,
}: WeekGridProps) {
  const al = makeAl(adminLanguage);

  const departingByDate = useMemo(() => {
    const m = new Map<string, AnyOrder[]>();
    for (const o of activeOrders) {
      if (!m.has(o.startDate)) m.set(o.startDate, []);
      m.get(o.startDate)!.push(o);
    }
    return m;
  }, [activeOrders]);

  const returningByDate = useMemo(() => {
    const m = new Map<string, AnyOrder[]>();
    for (const o of activeOrders) {
      if (!m.has(o.endDate)) m.set(o.endDate, []);
      m.get(o.endDate)!.push(o);
    }
    return m;
  }, [activeOrders]);

  const blockedByDate = useMemo(() => {
    const m = new Map<string, typeof blockedDates>();
    for (const b of blockedDates) {
      if (!m.has(b.date)) m.set(b.date, []);
      m.get(b.date)!.push(b);
    }
    return m;
  }, [blockedDates]);

  return (
    <div className="space-y-2.5">
      {weekDays.map((day, idx) => {
        const dayStr = fmtLocalDate(day);
        const departing = departingByDate.get(dayStr) ?? [];
        const returning = returningByDate.get(dayStr) ?? [];
        const blocked = blockedByDate.get(dayStr) ?? [];
        const current = dayStr === todayStr;
        const total = departing.length + returning.length + blocked.length;

        return (
          <div key={idx} className={`rounded-xl border overflow-hidden ${current ? "border-amber-300" : "border-slate-200"}`}>
            <div className={`flex items-center justify-between px-3 py-2 ${current ? "bg-amber-50" : "bg-slate-50"}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[11px] font-black uppercase tracking-wide ${current ? "text-amber-700" : "text-slate-500"}`}>
                  {day.toLocaleDateString(locale, { weekday: "short" })}
                </span>
                <span className={`text-xs font-bold ${current ? "text-amber-800" : "text-slate-700"}`}>
                  {day.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                </span>
              </div>
              {total > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{total}</span>
              )}
            </div>
            {total === 0 ? (
              <div className="px-3 py-3 text-center text-[11px] text-slate-300 bg-white">—</div>
            ) : (
              <div className="p-2 space-y-1.5 bg-white">
                {departing.map((o) => (
                  <button
                    key={`d-${o.id}`}
                    type="button"
                    onClick={() => onSelectOrder(o)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer text-left min-h-[40px]"
                  >
                    <Truck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{o.machineName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{o.customerName}</p>
                    </div>
                    <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} className="shrink-0" />
                  </button>
                ))}
                {returning.map((o) => (
                  <button
                    key={`r-${o.id}`}
                    type="button"
                    onClick={() => onSelectOrder(o)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 bg-teal-50 rounded-lg border border-teal-100 hover:bg-teal-100 transition-colors cursor-pointer text-left min-h-[40px]"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{o.machineName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{o.customerName}</p>
                    </div>
                    <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} className="shrink-0" />
                  </button>
                ))}
                {blocked.map((b, i) => (
                  <div key={`b-${i}`} className="w-full flex items-center gap-2 px-2.5 py-2 bg-red-50 rounded-lg border border-red-100 min-h-[40px]">
                    <Lock className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-red-800 truncate">{machineMap.get(b.machineId) ?? al("Geblokkeerd", "Blocked", "Bloke")}</p>
                      {b.reason && <p className="text-[10px] text-red-500 truncate">{b.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── Main component ──────────────────────────────────────────────────────────
interface AdminPlanningProps {
  adminLanguage: string;
}

export default function AdminPlanning({ adminLanguage }: AdminPlanningProps) {
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);
  const machines = useAppStore((state) => state.machines);

  const [view, setView] = useState<"today" | "tomorrow" | "week">("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<AnyOrder | null>(null);

  const al = makeAl(adminLanguage);
  const locale = makeLocale(adminLanguage);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = useMemo(() => fmtLocalDate(today), [today]);

  const tomorrowDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);
  const tomorrowStr = useMemo(() => fmtLocalDate(tomorrowDate), [tomorrowDate]);

  const todayLabel = useMemo(
    () => today.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [today, locale]
  );
  const tomorrowLabel = useMemo(
    () => tomorrowDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [tomorrowDate, locale]
  );

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return d;
  }, [weekOffset, today]);

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

  const departingToday    = useMemo(() => activeOrders.filter((o) => o.startDate === todayStr),    [activeOrders, todayStr]);
  const returningToday    = useMemo(() => activeOrders.filter((o) => o.endDate   === todayStr),    [activeOrders, todayStr]);
  const departingTomorrow = useMemo(() => activeOrders.filter((o) => o.startDate === tomorrowStr), [activeOrders, tomorrowStr]);
  const returningTomorrow = useMemo(() => activeOrders.filter((o) => o.endDate   === tomorrowStr), [activeOrders, tomorrowStr]);

  const blockedToday = useMemo(
    () => blockedDates.filter((b) => b.date === todayStr).map((b) => ({ ...b, machineName: machineMap.get(b.machineId) || b.machineId })),
    [blockedDates, machineMap, todayStr]
  );
  const blockedTomorrow = useMemo(
    () => blockedDates.filter((b) => b.date === tomorrowStr).map((b) => ({ ...b, machineName: machineMap.get(b.machineId) || b.machineId })),
    [blockedDates, machineMap, tomorrowStr]
  );

  // Stable callback so WeekGrid/DayPanel don't re-render when popup opens
  const handleSelectOrder = useCallback((o: AnyOrder) => setSelectedOrder(o), []);

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  const deliveryLabel = (type: string) => {
    if (type === "delivery_by_us") return al("Bezorging", "Delivery", "Teslimat");
    if (type === "trailer_rental") return al("Aanhanger", "Trailer", "Treyler");
    return al("Ophalen", "Pickup", "Teslim Al");
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
          todayStr={todayStr}
          departing={departingToday}
          returning={returningToday}
          blocked={blockedToday}
          dateLabel={todayLabel}
          adminLanguage={adminLanguage}
          onSelectOrder={handleSelectOrder}
        />
      )}

      {/* ── TOMORROW VIEW ──────────────────────────────────────────── */}
      {view === "tomorrow" && (
        <DayPanel
          targetStr={tomorrowStr}
          todayStr={todayStr}
          departing={departingTomorrow}
          returning={returningTomorrow}
          blocked={blockedTomorrow}
          dateLabel={tomorrowLabel}
          adminLanguage={adminLanguage}
          onSelectOrder={handleSelectOrder}
        />
      )}

      {/* ── WEEK VIEW ──────────────────────────────────────────────── */}
      {view === "week" && (
        <div className="space-y-4">
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

          {/* Mobile: one stacked card per day (no horizontal scroll). At sm: and up,
              the 7-column grid fits without a forced min-width, so it switches over. */}
          <div className="sm:hidden">
            <WeekDayList
              weekDays={weekDays}
              activeOrders={activeOrders}
              blockedDates={blockedDates}
              todayStr={todayStr}
              machineMap={machineMap}
              locale={locale}
              adminLanguage={adminLanguage}
              onSelectOrder={handleSelectOrder}
            />
          </div>
          <div className="hidden sm:block overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-1">
            <WeekGrid
              weekDays={weekDays}
              activeOrders={activeOrders}
              blockedDates={blockedDates}
              todayStr={todayStr}
              machineMap={machineMap}
              locale={locale}
              adminLanguage={adminLanguage}
              onSelectOrder={handleSelectOrder}
            />
          </div>

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
              transition={{ duration: 0.1 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="relative z-[60] w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400" />

              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                  <p className="text-[10px] font-mono text-indigo-500 uppercase tracking-widest">{selectedOrder.id}</p>
                  <h3 className="font-display font-black text-slate-900 text-base leading-snug mt-0.5">
                    {selectedOrder.machineName}
                  </h3>
                  <AdminStatusBadge status={selectedOrder.status} adminLanguage={adminLanguage} className="mt-1" />
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-3">
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

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Periode", "Period", "Dönem")}</span>
                    <span className="font-bold text-slate-800">{fmt(selectedOrder.startDate)} – {fmt(selectedOrder.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400 font-mono text-[10px]">{al("Dagen", "Days", "Günler")}</span>
                    <span className="font-bold text-slate-800">{selectedOrder.rentalDays} {al("dag", "day", "gün")}{selectedOrder.rentalDays !== 1 ? (adminLanguage === "nl" ? "en" : adminLanguage === "en" ? "s" : "") : ""}</span>
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
                    <span className="font-extrabold text-indigo-700 font-mono">{selectedOrder.totalAmount != null ? euro(selectedOrder.totalAmount) : ""}</span>
                  </div>
                </div>

                {selectedOrder.addons && selectedOrder.addons.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Package className="h-3 w-3 shrink-0" />
                    {selectedOrder.addons.map((a: AnyOrder) => a.name).join(" · ")}
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
