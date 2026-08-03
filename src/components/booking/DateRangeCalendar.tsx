/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Check, RotateCcw, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine } from "../../types";
import { useAppStore } from "../../store/appStore";
import { useLanguageStore } from "../../store/languageStore";
import { someUnitAvailable, findAvailableUnit, SimpleOrder } from "../../utils/availability";
import { calculateRentalDays, calculateItemSubtotal, displayRentalDays, isWeekendPackage, hasSundayBlock } from "../../utils/pricing";
import { euro, withVat } from "../../utils/format";

interface DateRangeCalendarProps {
  machine: Machine;
  startDate: string;          // committed selection "YYYY-MM-DD" or ""
  endDate: string;            // committed selection "YYYY-MM-DD" or ""
  profile: string;            // customerProfile, for the live price preview
  // De derde parameter is de unit die de periode daadwerkelijk kan draaien. De
  // kalender rekent op modelniveau, dus dat hoeft niet de unit te zijn waar de
  // cataloguskaart naar wees; zonder dit zou de klant een groene datum kiezen en
  // er vervolgens "niet beschikbaar" op krijgen.
  onConfirm: (start: string, end: string, unitId: string) => void;
  todayStr?: string;          // injectable for tests
}

const MONTHS_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DOW_NL = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];

// --- Timezone-safe "YYYY-MM-DD" helpers: never call .toISOString() on a Date built
// with the local-time constructor, that shifts the day in non-UTC zones. ---
function toKey(y: number, mIdx: number, d: number): string {
  return `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7; // getUTCDay() Sun=0..Sat=6 → Mon=0..Sun=6
}
function formatShort(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_NL[m - 1].slice(0, 3)}`;
}

export default function DateRangeCalendar({ machine, startDate, endDate, profile, onConfirm, todayStr }: DateRangeCalendarProps) {
  const t = useLanguageStore((s) => s.t);
  const blockedDates = useAppStore((s) => s.blockedDates);
  const fetchBlockedDates = useAppStore((s) => s.fetchBlockedDates);
  const campaignRules = useAppStore((s) => s.campaignRules);
  const vatDisplay = useAppStore((s) => s.vatDisplay);
  const allMachines = useAppStore((s) => s.machines);

  // All physical units of this model (same base name, "(Unit N)" stripped), each
  // carrying its own stock quantity. A day is only locked when every unit has
  // exhausted its stock; one unit with remaining capacity keeps the day open.
  const units = useMemo(() => {
    const baseName = (n: string) => n.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
    const base = baseName(machine.name);
    const matched = allMachines
      .filter((m) => m.isActive !== false && baseName(m.name) === base)
      .map((m) => ({ id: m.id, stockQuantity: m.stockQuantity ?? 1, operationallyBlocked: m.operationallyBlocked ?? false }));
    return matched.length ? matched : [{ id: machine.id, stockQuantity: machine.stockQuantity ?? 1, operationallyBlocked: machine.operationallyBlocked ?? false }];
  }, [allMachines, machine.id, machine.name, machine.stockQuantity]);
  const unitIds = useMemo(() => units.map((u) => u.id), [units]);
  const unitKey = units.map((u) => `${u.id}:${u.stockQuantity}:${u.operationallyBlocked ?? false}`).join(",");

  const today = todayStr || new Date().toISOString().split("T")[0];
  const todayYear = Number(today.split("-")[0]);
  const todayMonth = Number(today.split("-")[1]) - 1;

  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState<SimpleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  const initMonth = startDate || today;
  const [viewYear, setViewYear] = useState(Number(initMonth.split("-")[0]));
  const [viewMonth, setViewMonth] = useState(Number(initMonth.split("-")[1]) - 1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const open = () => {
    if (isOpen) return; // pointerdown + click both fire on the trigger — open once
    setDraftStart(startDate);
    setDraftEnd(endDate);
    const m = startDate || today;
    setViewYear(Number(m.split("-")[0]));
    setViewMonth(Number(m.split("-")[1]) - 1);
    setIsOpen(true);
    openedAtRef.current = Date.now();
  };
  const close = () => {
    setIsOpen(false);
    // Intentionally no focus() call here — it causes re-tap issues on iOS
  };

  // Fetch occupancy for every unit of this model so we know the true free count.
  const loadOccupancy = useCallback(async (): Promise<SimpleOrder[]> => {
    const results = await Promise.all(
      unitIds.map((id) =>
        fetch(`/api/orders/availability?machineId=${encodeURIComponent(id)}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => (Array.isArray(data) ? data : []))
          .catch(() => [])
      )
    );
    return results.flat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitKey]); // unitIds is derived from unitKey

  // Prefetch occupancy on mount and whenever the unit set changes, so the grid is
  // already populated BEFORE the user opens the calendar — no empty→populated flash
  // and no network wait on open. blockedDates already comes from the global store
  // (fetched app-wide at startup); refresh it once here in the background too.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadOccupancy()
      .then((o) => { if (!cancelled) setOrders(o); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadOccupancy]);

  useEffect(() => {
    fetchBlockedDates(); // one background refresh; does not block opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Silent refresh each time the calendar opens: update only on success and never
  // reset to [] first, so opening never shows a blank/all-available grid.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadOccupancy().then((o) => { if (!cancelled) setOrders(o); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape closes; basic focus management + Tab trap within the dialog
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Max selectable end: walk forward from start until the first unavailable day,
  // so a range can never span a blocked/booked day. Only constrains while no end yet.
  // `cappedByRealBlock` is true only when that walk actually hit a genuine booked/
  // blocked day within the search window — the hint text below should stay silent
  // when the 366-day search simply ran out (nothing nearby is actually blocking).
  const { maxEnd, cappedByRealBlock } = useMemo(() => {
    if (!draftStart || draftEnd) return { maxEnd: "", cappedByRealBlock: false };
    let cap = draftStart;
    let cursor = draftStart;
    let hitBlock = false;
    for (let i = 0; i < 366; i++) {
      const next = addDaysKey(cursor, 1);
      // Require a single unit free for the whole [start..next] span, not just that day.
      // bufferDays MUST be passed here — omitting it (defaults to 0) is what let the
      // calendar mark a day "available" while checkAvailability (BookingSection.tsx,
      // which does pass bufferDays) rejected the exact same range as booked.
      if (!someUnitAvailable(units, draftStart, next, orders, blockedDates, today, machine.bufferDays ?? 0)) { hitBlock = true; break; }
      cap = next; cursor = next;
    }
    return { maxEnd: cap, cappedByRealBlock: hitBlock };
  }, [draftStart, draftEnd, orders, blockedDates, unitKey, today, machine.bufferDays]);

  const grid = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const lead = mondayIndex(firstDow);
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    type Cell = { key: string; day: number; status: "past" | "unavailable" | "available" | "capped"; selectable: boolean; isStart: boolean; isEnd: boolean; inRange: boolean } | null;
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(viewYear, viewMonth, d);
      let status: "past" | "unavailable" | "available" | "capped";
      if (key < today) status = "past";
      // Same bufferDays fix as maxEnd above — a single day's own coloring must also
      // respect the machine's prep/maintenance buffer around adjacent bookings.
      else if (!someUnitAvailable(units, key, key, orders, blockedDates, today, machine.bufferDays ?? 0)) status = "unavailable";
      else status = "available";
      const isCapped = status === "available" && !!draftStart && !draftEnd && maxEnd !== "" && key > maxEnd;
      const cellStatus: "past" | "unavailable" | "available" | "capped" = isCapped ? "capped" : status;
      const selectable = status === "available" && !isCapped;
      // No day-of-week restriction here — every available day is selectable as
      // start or end (Sat/Sun included). Price is derived purely from the day
      // count via calculateItemSubtotal(); the only weekend-specific effect is
      // the automatic Sunday block fee when the rental's last day is Saturday.
      cells.push({
        key,
        day: d,
        status: cellStatus,
        selectable,
        isStart: key === draftStart,
        isEnd: key === draftEnd,
        inRange: !!draftStart && !!draftEnd && key > draftStart && key < draftEnd,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth, orders, blockedDates, draftStart, draftEnd, maxEnd, unitKey, today, machine.bufferDays]);

  const onDayClick = (key: string, selectable: boolean) => {
    if (!selectable) return;
    // Both dates set: any click starts a fresh single-day selection
    if (draftStart && draftEnd) {
      setDraftStart(key);
      setDraftEnd("");
      return;
    }
    // No start yet: first click → set start (1-day immediately valid via effectiveEnd)
    if (!draftStart) { setDraftStart(key); return; }
    // Start set, no end: re-clicking the start day deselects; clicking elsewhere sets end
    if (key === draftStart) { setDraftStart(""); return; }
    if (key < draftStart) { setDraftStart(key); return; }
    // key > draftStart: set as end (bufferDays required — same reason as maxEnd/grid above)
    if (someUnitAvailable(units, draftStart, key, orders, blockedDates, today, machine.bufferDays ?? 0)) setDraftEnd(key);
  };

  const canPrev = !(viewYear === todayYear && viewMonth === todayMonth);
  const goPrev = () => {
    if (!canPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1);
  };

  // When only start is picked (no end yet), treat it as a 1-day selection so
  // the confirm button enables immediately after the first tap.
  const effectiveEnd = draftEnd || draftStart;
  // bufferDays required — without it "Bevestigen" could confirm a range that
  // BookingSection.tsx's checkAvailability (which does pass bufferDays) then
  // rejects as booked, exactly the calendar/booking mismatch this fixes.
  const rangeAvail = !!draftStart && someUnitAvailable(units, draftStart, effectiveEnd, orders, blockedDates, today, machine.bufferDays ?? 0);
  const days = rangeAvail ? calculateRentalDays(draftStart, effectiveEnd) : 0;
  const minDays = machine.minRentalDays ?? 1;
  const validRange = rangeAvail && days >= minDays;
  const subtotal = validRange ? calculateItemSubtotal(machine, days, profile, campaignRules, draftStart) : 0;
  const displayDays = displayRentalDays(machine, draftStart, days);
  // Weekend rules feedback for the live preview.
  const previewIsPackage = validRange && isWeekendPackage(machine, draftStart, days);
  const previewHasBlock = validRange && hasSundayBlock(machine, draftStart, days);
  const draftStartDow = draftStart ? new Date(draftStart).getUTCDay() : -1;
  const previewEndDow = validRange ? new Date(effectiveEnd).getUTCDay() : -1;
  // The rental's last day lands on the closed weekend (Sat or Sun) — the depot can
  // never physically process a return then, so the real return always happens
  // Monday, regardless of whether that's a package, a block fee, or just a
  // deliberately-chosen Sunday end.
  const endsWeekendClosed = validRange && !!machine.weekendRulesEnabled && (previewEndDow === 6 || previewEndDow === 0);
  // Friday start that runs into the closed weekend (Sat and/or Sun end) — the
  // depot hands the machine over Friday afternoon regardless of which weekend
  // day the rental ends on, so this note is independent of the block fee above.
  const fridayIntoWeekend = validRange && machine.weekendRulesEnabled && draftStartDow === 5 && endsWeekendClosed;
  // Sat/Sun can never be a literal pickup day either (depot closed) — whenever the
  // rental "starts" on Sat or Sun, for ANY length, the machine is always physically
  // handed over the preceding Friday afternoon instead.
  const startsWeekendClosed = validRange && !!machine.weekendRulesEnabled && (draftStartDow === 6 || draftStartDow === 0);
  const showPickupFridayNote = fridayIntoWeekend || startsWeekendClosed;

  const confirm = () => {
    if (!validRange) return;
    // rangeAvail was al waar, dus er ís een vrije unit; machine.id als laatste
    // redmiddel zodat we nooit zonder id bevestigen.
    const unit = findAvailableUnit(units, draftStart, effectiveEnd, orders, blockedDates, today, machine.bufferDays ?? 0);
    onConfirm(draftStart, effectiveEnd, unit?.id ?? machine.id);
    close();
  };
  const reset = () => { setDraftStart(""); setDraftEnd(""); };

  const committedDays = startDate && endDate ? displayRentalDays(machine, startDate, calculateRentalDays(startDate, endDate)) : 0;
  const buttonLabel = startDate && endDate
    ? `${formatShort(startDate)} – ${formatShort(endDate)} · ${committedDays} ${committedDays === 1 ? "dag" : "dagen"}`
    : t("calSelectPeriod");

  const dayAria = (key: string, status: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const label = `${d} ${MONTHS_NL[m - 1]} ${y}`;
    const stateNl = status === "unavailable" ? t("calLegendUnavailable")
      : status === "available" ? t("calLegendAvailable") : "";
    return stateNl ? `${label}, ${stateNl}` : label;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        // Open on pointerUP of a genuine tap (pointer barely moved since pointerdown).
        // Opening on touchstart/pointerdown — the previous approach — also fired when
        // the customer merely started SCROLLING with their finger on this button,
        // popping the calendar open uninvited and reading as "it flickers open/closed,
        // I need 2-3 taps". A scroll gesture either moves >12px or gets a pointercancel,
        // so it never opens here; a real tap still opens before the synthesized click
        // (which the dialog's 500 ms click-swallow guard then absorbs). onClick stays
        // as the keyboard-activation path; open() ignores the duplicate call.
        onPointerDown={(e) => { pointerDownPosRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const d = pointerDownPosRef.current;
          pointerDownPosRef.current = null;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) open();
        }}
        onPointerCancel={() => { pointerDownPosRef.current = null; }}
        onClick={open}
        style={{ touchAction: "manipulation" }}
        // No dates picked yet: an orange-accented look (same CTA color as
        // "Doorgaan") so this doesn't read as just another muted field next
        // to the colorful transport/add-on cards further down the page —
        // customers were skipping past it and only noticing on validation error.
        className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-3 border transition-colors shadow-sm cursor-pointer text-left ${
          startDate && endDate
            ? "bg-white border-slate-300 text-slate-800"
            : "bg-orange-50 border-orange-300 text-orange-800 hover:border-orange-400 hover:bg-orange-100 ring-1 ring-orange-100"
        }`}
      >
        <Calendar className={`h-4 w-4 shrink-0 ${startDate && endDate ? "text-slate-400" : "text-orange-500"}`} />
        <span className="text-xs font-bold flex-1">{buttonLabel}</span>
        <span className="text-[10px] text-slate-500 font-bold shrink-0">{startDate && endDate ? t("calChange") : ""}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(e) => {
                // Guard against phantom touch-through right after open. Some mobile
                // browsers fire a delayed "ghost click" at the same coordinates as the
                // opening tap, landing on this backdrop and instantly closing the modal
                // — which reads to the user as "I had to tap 2-3 times to open it".
                // 600 ms comfortably outlives that ghost-click window on slower devices.
                if (Date.now() - openedAtRef.current < 600) return;
                e.stopPropagation();
                close();
              }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              ref={dialogRef}
              onClick={(e) => e.stopPropagation()}
              // The trigger opens on pointerdown; the same tap's click event then
              // lands on whatever now sits at those coordinates — this dialog. Swallow
              // any click in the first 500 ms so it can't select a random day.
              onClickCapture={(e) => {
                if (Date.now() - openedAtRef.current < 500) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-label={`${t("calTitle")} — ${machine.name}`}
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              // Edge-to-edge bottom sheet on mobile that hugs its content: since the
              // Friday toggle box was removed the content is short enough to fit, and
              // a fixed 92dvh height left a large empty white band under the legend.
              // max-h keeps the scrollable body working on very short viewports.
              // Reverts to a centered card on wider screens.
              className="relative z-[60] w-full max-h-[92dvh] sm:max-w-sm lg:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col sm:max-h-[85vh] lg:max-h-[88vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-900 truncate">{t("calTitle")}</h4>
                  <p className="text-[10px] text-slate-400 truncate">{machine.name}</p>
                </div>
                <button type="button" onClick={close} aria-label={t("calClose")} className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable body: month nav + grid + legend */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Month navigation */}
                <div className="flex items-center justify-between px-4 pt-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={!canPrev}
                    aria-label={t("calPrevMonth")}
                    className={`p-1.5 rounded-lg transition-colors ${canPrev ? "hover:bg-slate-100 text-slate-600 cursor-pointer" : "text-slate-200 cursor-not-allowed"}`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 capitalize">{MONTHS_NL[viewMonth]} {viewYear}</span>
                  <button type="button" onClick={goNext} aria-label={t("calNextMonth")} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Grid */}
                <div className="px-4 pt-2 pb-1 mb-1.5" aria-busy={loading}>
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {DOW_NL.map((d) => (
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 py-1 select-none">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {grid.map((cell, i) => {
                      if (!cell) return <div key={`e-${i}`} />;
                      const { key, day, status, selectable, isStart, isEnd, inRange } = cell;
                      // 44px op mobiel (WCAG/iOS dokungrootte-richtlijn), h-9 (36px) blijft vanaf sm: —
                      // geen xs:-breakpoint in deze Tailwind-setup, dus sm: is de kleinste beschikbare stap.
                      // lg: schaalt weer iets op — de bredere lg:max-w-md dialoog liet anders
                      // alleen witruimte rond de cellen groeien in plaats van de cellen zelf.
                      const base = "relative h-11 sm:h-9 lg:h-11 rounded-lg text-xs lg:text-sm font-bold flex items-center justify-center transition-colors";
                      let cls = "";
                      if (isStart || isEnd) cls = "bg-amber-500 text-white shadow-sm";
                      else if (inRange) cls = "bg-amber-100 text-amber-900";
                      else if (status === "available") cls = "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer";
                      else if (status === "unavailable") cls = "bg-rose-50 text-rose-300 cursor-not-allowed";
                      else if (status === "capped") cls = "bg-emerald-50 text-emerald-300 cursor-not-allowed"; // available after block, need new start
                      else cls = "text-slate-300 cursor-not-allowed"; // past
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!selectable}
                          aria-label={dayAria(key, status)}
                          aria-pressed={isStart || isEnd || inRange}
                          onClick={() => onDayClick(key, selectable)}
                          className={`${base} ${cls} border-none`}
                        >
                          {day}
                          {status === "unavailable" && (
                            <span aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-rose-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hints group — spaced apart from both the grid above and the legend
                    below so this reads as its own block, not squeezed against either. */}
                <div className="px-5 pb-1.5 space-y-1">
                  {/* Hint when capping is active — only when a genuine booked/blocked day
                      was found nearby; the 366-day search always resolves to SOME date,
                      so gate on cappedByRealBlock or this would show for every selection. */}
                  {cappedByRealBlock && !!draftStart && !draftEnd && (
                    <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                      {t("calCappedHint")}
                    </p>
                  )}

                  {/* Hint: depot closed in the weekend — every day is selectable, price
                      is always the normal day-count tier (+ automatic Sunday block fee
                      when the rental's last day is Saturday, shown below in the preview). */}
                  {machine.weekendRulesEnabled && (
                    <p className="text-xs text-center font-extrabold text-slate-700 leading-relaxed">
                      Depot in het weekend gesloten — za/zo geen ophalen of retour.
                    </p>
                  )}

                  {/* Hint: minimum rental period not yet reached */}
                  {minDays > 1 && rangeAvail && days < minDays && (
                    <p className="text-xs text-center text-amber-600 font-bold leading-relaxed">
                      Minimale huurperiode is {minDays} dagen — selecteer een langere periode.
                    </p>
                  )}
                  {/* Static minimum period note */}
                  {minDays > 1 && !(rangeAvail && days < minDays) && (
                    <p className="text-[11px] text-center text-slate-500 font-semibold leading-relaxed">
                      Minimale huurperiode: {minDays} dagen.
                    </p>
                  )}
                </div>

                {/* Legend — separated with a top border so it reads as a distinct
                    footer note, not squeezed against the hints above. */}
                <div className="flex items-center justify-center gap-3 px-4 py-1.5 mt-0.5 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-200 border border-emerald-400" />{t("calLegendAvailable")}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t("calLegendSelected")}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />{t("calLegendUnavailable")}</span>
                </div>
              </div>

              {/* Price preview — outside scroll, always visible above footer */}
              {validRange && (
                <div className="mx-4 mb-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {previewIsPackage ? "Weekendpakket" : `${displayDays} ${displayDays === 1 ? "dag" : "dagen"}`}
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900">{euro(withVat(subtotal, vatDisplay))} <span className="text-[10px] font-normal text-slate-400">{vatDisplay === "incl" ? "incl. btw" : "excl. btw"}</span></span>
                  </div>
                  {previewIsPackage && (
                    <p className="text-[11px] font-semibold text-amber-700 leading-snug">Vast weekendtarief · retour maandag 08:00.</p>
                  )}
                  {previewHasBlock && (
                    <p className="text-[11px] font-semibold text-amber-700 leading-snug">Incl. zondagblokkade €{machine.sundayBlockFee} · retour maandag 08:00.</p>
                  )}
                  {showPickupFridayNote && (
                    <p className="text-[11px] font-semibold text-amber-700 leading-snug">
                      Ophalen vrijdag vanaf 13:00{endsWeekendClosed ? " · retour maandag 08:00." : "."}
                    </p>
                  )}
                  {/* Any other rental ending on the closed weekend (e.g. a weekday start
                      ending on Sunday, or ending Saturday without a block fee configured):
                      the depot can't take a return then, so make the Monday-morning
                      return explicit instead of leaving the customer guessing. */}
                  {endsWeekendClosed && !previewIsPackage && !previewHasBlock && !showPickupFridayNote && (
                    <p className="text-[11px] font-semibold text-amber-700 leading-snug">
                      Depot za/zo gesloten · retour maandag 08:00.
                    </p>
                  )}
                </div>
              )}

              {/* Footer actions — always visible */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("calReset")}
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!validRange}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border-none ${
                    validRange ? "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-sm active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {t("calConfirm")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
