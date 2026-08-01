/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, CalendarRange, X, Phone, Mail, MapPin, Package } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { euro } from "../../utils/format";
import { Order } from "../../types";
import AdminStatusBadge from "./AdminStatusBadge";

interface AdminRentalTimelineProps {
  adminLanguage: "nl" | "en" | "tr";
}

// ── date helpers (local-time, day granularity) ──────────────────────────────
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Orders store dates as "YYYY-MM-DD"; parse to a local midnight Date.
const parseDay = (s: string): Date => {
  const [y, m, d] = s.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
// Whole days between two day-Dates (b - a).
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

const STATUS_STYLE: Record<string, { bar: string; dot: string }> = {
  "In behandeling": { bar: "bg-amber-400/90 border-amber-500 text-amber-950", dot: "bg-amber-400" },
  "Goedgekeurd":    { bar: "bg-emerald-400/90 border-emerald-500 text-emerald-950", dot: "bg-emerald-400" },
  "Onderweg":       { bar: "bg-blue-400/90 border-blue-500 text-blue-950", dot: "bg-blue-400" },
  "Voltooid":       { bar: "bg-slate-300 border-slate-400 text-slate-700", dot: "bg-slate-400" },
};

interface Lane {
  bookings: {
    id: string;
    customerName: string;
    status: string;
    start: Date;
    end: Date; // inclusive last rental day
    leftPct: number;
    widthPct: number;
    // The machine's bufferDays (maintenance/charging) after this booking's end
    // date, visible in the window — null when the machine has no buffer or it
    // falls entirely outside the visible range. Without this the timeline
    // showed a machine as free the instant a rental bar ended, while
    // assertMachineAvailableInTx/checkAvailability actually keep it
    // unavailable for bufferDays more days — a real "app says booked, timeline
    // says free" discrepancy for an admin trying to schedule the next rental.
    bufferLeftPct: number | null;
    bufferWidthPct: number | null;
    order: Order; // full order, so a tap can open the same quick-view used in Planning
  }[];
  lastEnd: number; // day-offset of the last booking's end, for greedy lane packing
}

export default function AdminRentalTimeline({ adminLanguage }: AdminRentalTimelineProps) {
  const al = (nl: string, en: string, tr: string) =>
    adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl;

  const orders = useAppStore((s) => s.orders);
  const machines = useAppStore((s) => s.machines);
  const blockedDates = useAppStore((s) => s.blockedDates);
  const loadAllOrders = useAppStore((s) => s.loadAllOrders);

  // The shared store only holds the most-recent window of orders; a booking far
  // in the future can fall outside it, so pull the full set for the timeline.
  useEffect(() => { loadAllOrders(); }, [loadAllOrders]);

  const WINDOWS = [
    { days: 1,   label: al("1 dag", "1 day", "1 gün") },
    { days: 7,   label: al("7 dagen", "7 days", "7 gün") },
    { days: 30,  label: al("30 dagen", "30 days", "30 gün") },
    { days: 365, label: al("1 jaar", "1 year", "1 yıl") },
  ] as const;

  const [windowDays, setWindowDays] = useState<number>(30);
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  // Quick-view popup for a tapped booking bar — narrow bars (short rentals on
  // a long window) truncate the customer name to a couple of characters, so
  // a tap needs to reveal the full details. Same pattern/markup as the
  // booking quick-view modal in AdminPlanning.
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const deliveryLabel = (type: string) => {
    if (type === "delivery_by_us") return al("Bezorging", "Delivery", "Teslimat");
    if (type === "trailer_rental") return al("Aanhanger", "Trailer", "Treyler");
    return al("Ophalen", "Pickup", "Teslim Al");
  };

  const today = useMemo(() => startOfDay(new Date()), []);
  const windowStart = anchor;
  const windowEnd = useMemo(() => addDays(windowStart, windowDays), [windowStart, windowDays]);

  const fmt = (d: Date) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: windowDays >= 90 ? "2-digit" : undefined });

  // Evenly spaced axis ticks with date labels + gridlines.
  const ticks = useMemo(() => {
    const count = windowDays <= 1 ? 1 : windowDays <= 7 ? windowDays : windowDays <= 30 ? 10 : 12;
    const out: { pct: number; label: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const offset = (windowDays * i) / count;
      out.push({ pct: (i / count) * 100, label: fmt(addDays(windowStart, Math.round(offset))) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStart, windowDays]);

  // Non-cancelled bookings that overlap the visible window, grouped per machine
  // and packed into non-overlapping lanes so simultaneous rentals don't collide.
  const rows = useMemo(() => {
    const activeMachines = machines.filter((m) => m.isActive !== false);
    const winStartOff = 0;
    const winEndOff = windowDays; // exclusive
    return activeMachines.map((m) => {
      const relevant = orders
        .filter((o) => o.machineId === m.id && o.status !== "Geannuleerd")
        .map((o) => {
          const start = parseDay(o.startDate);
          const end = parseDay(o.endDate);
          return { o, start, end, startOff: daysBetween(windowStart, start), endOff: daysBetween(windowStart, end) };
        })
        // overlaps window if it starts before window end and ends on/after window start
        .filter((b) => b.startOff < winEndOff && b.endOff >= winStartOff)
        .sort((a, b) => a.startOff - b.startOff);

      const lanes: Lane[] = [];
      for (const b of relevant) {
        // clamp to window; bar spans [startOff, endOff+1) in day units
        const clampedStart = Math.max(b.startOff, winStartOff);
        const clampedEnd = Math.min(b.endOff + 1, winEndOff);
        const leftPct = (clampedStart / windowDays) * 100;
        const widthPct = Math.max(((clampedEnd - clampedStart) / windowDays) * 100, 1.2);
        // Buffer window: [endOff+1, endOff+1+bufferDays), clamped the same way
        // as the booking bar itself. Only computed for a real (non-cancelled)
        // booking that's actually visible — a buffer entirely before/after the
        // window renders nothing.
        const bufferDays = (m as any).bufferDays ?? 0;
        let bufferLeftPct: number | null = null;
        let bufferWidthPct: number | null = null;
        if (bufferDays > 0) {
          const bufStart = Math.max(b.endOff + 1, winStartOff);
          const bufEnd = Math.min(b.endOff + 1 + bufferDays, winEndOff);
          if (bufEnd > bufStart) {
            bufferLeftPct = (bufStart / windowDays) * 100;
            bufferWidthPct = ((bufEnd - bufStart) / windowDays) * 100;
          }
        }
        const entry = {
          id: b.o.id,
          customerName: b.o.customerName,
          status: b.o.status,
          start: b.start,
          end: b.end,
          leftPct,
          widthPct,
          bufferLeftPct,
          bufferWidthPct,
          order: b.o,
        };
        let lane = lanes.find((l) => l.lastEnd < b.startOff);
        if (!lane) { lane = { bookings: [], lastEnd: -Infinity }; lanes.push(lane); }
        lane.bookings.push(entry);
        lane.lastEnd = b.endOff;
      }
      // blocked dates for this machine within the window → small striped markers
      const blocks = blockedDates
        .filter((bd) => bd.machineId === m.id)
        .map((bd) => daysBetween(windowStart, parseDay(bd.date)))
        .filter((off) => off >= winStartOff && off < winEndOff);

      return { machine: m, lanes, blocks, count: relevant.length };
    });
  }, [machines, orders, blockedDates, windowStart, windowDays]);

  const todayOff = daysBetween(windowStart, today);
  const todayPct = todayOff >= 0 && todayOff < windowDays ? (todayOff / windowDays) * 100 : null;

  const shift = (dir: -1 | 1) => setAnchor((a) => addDays(a, dir * Math.max(1, Math.round(windowDays / (windowDays >= 365 ? 4 : windowDays >= 30 ? 3 : 1)))));

  const totalBookings = rows.reduce((s, r) => s + r.count, 0);

  return (
    <motion.div
      key="timeline-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Header / controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-indigo-600" />
            {al("Bezettingskalender", "Occupancy Calendar", "Doluluk Takvimi")}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {al(
              `${totalBookings} boeking(en) in beeld · welke machine wanneer verhuurd is`,
              `${totalBookings} booking(s) shown · which machine is rented when`,
              `${totalBookings} rezervasyon görünüyor · hangi makine ne zaman kirada`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Window length toggle */}
          <div className="inline-flex bg-slate-100 rounded-xl p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setWindowDays(w.days)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border-none ${
                  windowDays === w.days ? "bg-white text-indigo-700 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="inline-flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} aria-label={al("Vorige", "Previous", "Önceki")}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer border-none">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAnchor(today)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer border-none">
              {al("Vandaag", "Today", "Bugün")}
            </button>
            <button type="button" onClick={() => shift(1)} aria-label={al("Volgende", "Next", "Sonraki")}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer border-none">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend + window range */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(STATUS_STYLE).map(([status, s]) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.dot}`} /> {status}
            </span>
          ))}
        </div>
        <span className="font-bold text-slate-600">{fmt(windowStart)} — {fmt(addDays(windowEnd, -1))}</span>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[720px]">
          {/* Axis header */}
          <div className="flex items-stretch border-b border-slate-200">
            <div className="w-40 shrink-0 pr-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {al("Machine", "Machine", "Makine")}
            </div>
            <div className="relative flex-1 h-8">
              {ticks.map((tk, i) => (
                <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${tk.pct}%`, transform: "translateX(-50%)" }}>
                  <span className="text-[9.5px] font-semibold text-slate-400 whitespace-nowrap">{tk.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* vertical gridlines across all rows */}
            <div className="absolute inset-0 ml-40 pointer-events-none">
              {ticks.map((tk, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-100" style={{ left: `${tk.pct}%` }} />
              ))}
              {todayPct !== null && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-500/60 z-10" style={{ left: `${todayPct}%` }} title={al("Vandaag", "Today", "Bugün")} />
              )}
            </div>

            {rows.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">{al("Geen machines", "No machines", "Makine yok")}</div>
            )}

            {rows.map(({ machine, lanes, blocks }) => {
              const laneCount = Math.max(lanes.length, 1);
              const rowHeight = laneCount * 26 + (laneCount - 1) * 4 + 12;
              return (
                <div key={machine.id} className="flex items-stretch border-b border-slate-100 hover:bg-slate-50/60">
                  <div className="w-40 shrink-0 pr-3 py-2 flex items-center">
                    <span className="text-[11px] font-bold text-slate-700 leading-snug line-clamp-2" title={machine.name}>
                      {machine.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim()}
                    </span>
                  </div>
                  <div className="relative flex-1" style={{ minHeight: rowHeight }}>
                    {/* blocked-date markers */}
                    {blocks.map((off, i) => (
                      <div
                        key={`b-${i}`}
                        className="absolute top-1 bottom-1 bg-[repeating-linear-gradient(45deg,#e2e8f0_0,#e2e8f0_3px,transparent_3px,transparent_6px)] rounded-sm opacity-70"
                        style={{ left: `${(off / windowDays) * 100}%`, width: `${(1 / windowDays) * 100}%` }}
                        title={al("Geblokkeerd", "Blocked", "Bloke")}
                      />
                    ))}
                    {/* booking bars, one row per lane */}
                    {lanes.map((lane, li) =>
                      lane.bookings.map((b) => {
                        const style = STATUS_STYLE[b.status] ?? STATUS_STYLE["Voltooid"];
                        return (
                          <React.Fragment key={b.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(b.order)}
                              className={`absolute h-[26px] rounded-md border px-1.5 flex items-center overflow-hidden cursor-pointer appearance-none transition-transform hover:scale-[1.03] hover:z-20 ${style.bar}`}
                              style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%`, top: 6 + li * 30 }}
                              title={`${machine.name}\n${b.customerName}\n${b.start.toLocaleDateString("nl-NL")} t/m ${b.end.toLocaleDateString("nl-NL")}\n${b.status} · ${b.id}`}
                            >
                              <span className="text-[10px] font-bold truncate">{b.customerName}</span>
                            </button>
                            {/* Buffer days (maintenance/charging) — same days assertMachineAvailableInTx
                                keeps unavailable for a new booking, shown as a hatched extension of the
                                bar so the timeline doesn't read as "free" the instant the rental ends. */}
                            {b.bufferLeftPct !== null && b.bufferWidthPct !== null && (
                              <div
                                className="absolute h-[26px] rounded-md border border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9_0,#f1f5f9_3px,#e2e8f0_3px,#e2e8f0_6px)] opacity-80"
                                style={{ left: `${b.bufferLeftPct}%`, width: `${b.bufferWidthPct}%`, top: 6 + li * 30 }}
                                title={al("Onderhoud/laadbuffer — nog niet beschikbaar", "Maintenance/charging buffer — not yet available", "Bakım/şarj tamponu — henüz uygun değil")}
                              />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick-view popup — same markup/pattern as AdminPlanning's booking modal */}
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
                    <span className="font-bold text-slate-800">{fmt(parseDay(selectedOrder.startDate))} – {fmt(parseDay(selectedOrder.endDate))}</span>
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
                    {selectedOrder.addons.map((a) => a.name).join(" · ")}
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
