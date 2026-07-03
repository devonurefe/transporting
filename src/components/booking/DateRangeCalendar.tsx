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
import { someUnitAvailable, SimpleOrder } from "../../utils/availability";
import { calculateRentalDays, calculateItemSubtotal, displayRentalDays, isWeekendPackage, hasSundayBlock } from "../../utils/pricing";
import { euro, withVat } from "../../utils/format";

interface DateRangeCalendarProps {
  machine: Machine;
  startDate: string;          // committed selection "YYYY-MM-DD" or ""
  endDate: string;            // committed selection "YYYY-MM-DD" or ""
  profile: string;            // customerProfile, for the live price preview
  onConfirm: (start: string, end: string) => void;
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

  // All physical units of this model (same base name, "(Unit N)" stripped). A day
  // is only locked when EVERY unit is busy; one free unit keeps the day open.
  const unitIds = useMemo(() => {
    const baseName = (n: string) => n.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
    const base = baseName(machine.name);
    const ids = allMachines
      .filter((m) => m.isActive !== false && baseName(m.name) === base)
      .map((m) => m.id);
    return ids.length ? ids : [machine.id];
  }, [allMachines, machine.id, machine.name]);
  const unitKey = unitIds.join(",");

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
      // Require a single unit free for the whole [start..next] span, not just that day
      if (!someUnitAvailable(unitIds, draftStart, next, orders, blockedDates, today)) { hitBlock = true; break; }
      cap = next; cursor = next;
    }
    return { maxEnd: cap, cappedByRealBlock: hitBlock };
  }, [draftStart, draftEnd, orders, blockedDates, unitKey, today]);

  const grid = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const lead = mondayIndex(firstDow);
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    type Cell = { key: string; day: number; status: "past" | "unavailable" | "available" | "capped" | "weekendoff"; selectable: boolean; isStart: boolean; isEnd: boolean; inRange: boolean } | null;
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(viewYear, viewMonth, d);
      let status: "past" | "unavailable" | "available" | "capped";
      if (key < today) status = "past";
      else if (!someUnitAvailable(unitIds, key, key, orders, blockedDates, today)) status = "unavailable";
      else status = "available";
      const isCapped = status === "available" && !!draftStart && !draftEnd && maxEnd !== "" && key > maxEnd;
      let cellStatus: "past" | "unavailable" | "available" | "capped" | "weekendoff" = isCapped ? "capped" : status;
      let selectable = status === "available" && !isCapped;
      // Depot closed Sat+Sun (weekendRulesEnabled): restrict the END day so a normal
      // work rental never returns on a weekend. When picking the end:
      //  - weekday start (Mon–Fri): end may be Mon–Sat (a Saturday end auto-adds the
      //    Sunday block, return Monday). A Sunday end is only the Fri+Sat+Sun package.
      //  - Saturday start: only Sat+Sun (end Sunday) is a valid weekend package.
      //  - Sunday start: single day only.
      // Start days stay open — a Sat/Sun start can only become a weekend package.
      if (machine.weekendRulesEnabled && selectable) {
        const dow = new Date(key).getUTCDay(); // 0=Sun .. 6=Sat
        const choosingEnd = !!draftStart && !draftEnd && key > draftStart;
        if (choosingEnd) {
          const startDow = new Date(draftStart).getUTCDay();
          const span = calculateRentalDays(draftStart, key);
          let ok = true;
          if (startDow >= 1 && startDow <= 5) {
            ok = dow === 0 ? (startDow === 5 && span === 3) : true;
          } else if (startDow === 6) {
            ok = dow === 0 && span === 2;
          } else {
            ok = false; // Sunday start → single day only
          }
          if (!ok) { selectable = false; cellStatus = "weekendoff"; }
        }
      }
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
  }, [viewYear, viewMonth, orders, blockedDates, draftStart, draftEnd, maxEnd, unitKey, today, machine.weekendRulesEnabled]);

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
    // key > draftStart: set as end
    if (someUnitAvailable(unitIds, draftStart, key, orders, blockedDates, today)) setDraftEnd(key);
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
  const rangeAvail = !!draftStart && someUnitAvailable(unitIds, draftStart, effectiveEnd, orders, blockedDates, today);
  const days = rangeAvail ? calculateRentalDays(draftStart, effectiveEnd) : 0;
  const minDays = machine.minRentalDays ?? 1;
  const validRange = rangeAvail && days >= minDays;
  const subtotal = validRange ? calculateItemSubtotal(machine, days, profile, campaignRules, draftStart) : 0;
  const displayDays = displayRentalDays(machine, draftStart, days);
  // Weekend rules feedback for the live preview.
  const previewIsPackage = validRange && isWeekendPackage(machine, draftStart, days);
  const previewHasBlock = validRange && hasSundayBlock(machine, draftStart, days);

  const confirm = () => { if (!validRange) return; onConfirm(draftStart, effectiveEnd); close(); };
  const reset = () => { setDraftStart(""); setDraftEnd(""); };

  const committedDays = startDate && endDate ? displayRentalDays(machine, startDate, calculateRentalDays(startDate, endDate)) : 0;
  const buttonLabel = startDate && endDate
    ? `${formatShort(startDate)} – ${formatShort(endDate)} · ${committedDays} ${committedDays === 1 ? "dag" : "dagen"}`
    : t("calSelectPeriod");

  const dayAria = (key: string, status: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const label = `${d} ${MONTHS_NL[m - 1]} ${y}`;
    const stateNl = status === "unavailable" ? t("calLegendUnavailable")
      : status === "weekendoff" ? "weekend — niet als retourdag"
      : status === "available" ? t("calLegendAvailable") : "";
    return stateNl ? `${label}, ${stateNl}` : label;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        // Open on the earliest possible touch signal so the dialog appears on the
        // FIRST tap, before iOS Safari's synthesized click (which can get swallowed
        // by scroll/ghost-click heuristics and read as "I had to tap twice"). Both
        // touchstart and pointerdown are wired (some iOS Safari versions are more
        // reliable with one or the other); onClick stays as the keyboard-activation
        // path. open() itself ignores the duplicate calls from the same tap.
        onTouchStart={() => open()}
        onPointerDown={() => open()}
        onClick={open}
        style={{ touchAction: "manipulation" }}
        className={`w-full flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border transition-colors shadow-sm cursor-pointer text-left ${
          startDate && endDate ? "border-slate-300 text-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-300"
        }`}
      >
        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-xs font-bold flex-1">{buttonLabel}</span>
        <span className="text-[10px] text-slate-500 font-bold shrink-0">{startDate && endDate ? t("calChange") : ""}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="relative z-[60] w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90dvh] overflow-hidden"
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
                <div className="flex items-center justify-between px-4 pt-3">
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
                <div className="px-4 pt-2 pb-1" aria-busy={loading}>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DOW_NL.map((d) => (
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 py-1 select-none">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {grid.map((cell, i) => {
                      if (!cell) return <div key={`e-${i}`} />;
                      const { key, day, status, selectable, isStart, isEnd, inRange } = cell;
                      const base = "relative h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-colors";
                      let cls = "";
                      if (isStart || isEnd) cls = "bg-amber-500 text-white shadow-sm";
                      else if (inRange) cls = "bg-amber-100 text-amber-900";
                      else if (status === "available") cls = "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer";
                      else if (status === "unavailable") cls = "bg-rose-50 text-rose-300 cursor-not-allowed";
                      else if (status === "weekendoff") cls = "bg-slate-100 text-slate-300 cursor-not-allowed line-through decoration-slate-300"; // weekend, niet als startdag
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

                {/* Hint when capping is active — only when a genuine booked/blocked day
                    was found nearby; the 366-day search always resolves to SOME date,
                    so gate on cappedByRealBlock or this would show for every selection. */}
                {cappedByRealBlock && !!draftStart && !draftEnd && (
                  <p className="text-[10px] text-center text-slate-400 px-5 pb-1 leading-relaxed">
                    {t("calCappedHint")}
                  </p>
                )}

                {/* Hint: depot closed in the weekend. Kept to ONE short, bold line —
                    the contextual notes in the price preview below explain the weekend
                    package / Sunday block the moment they actually apply. */}
                {machine.weekendRulesEnabled && (
                  <p className="text-[11px] text-center font-bold text-slate-600 px-5 pb-1 leading-relaxed">
                    Depot in het weekend gesloten — za/zo geen ophalen of retour.
                  </p>
                )}

                {/* Hint: minimum rental period not yet reached */}
                {minDays > 1 && rangeAvail && days < minDays && (
                  <p className="text-[10px] text-center text-amber-600 font-semibold px-5 pb-1 leading-relaxed">
                    Minimale huurperiode is {minDays} dagen — selecteer een langere periode.
                  </p>
                )}
                {/* Static minimum period note */}
                {minDays > 1 && !(rangeAvail && days < minDays) && (
                  <p className="text-[10px] text-center text-slate-400 px-5 pb-1 leading-relaxed">
                    Minimale huurperiode: {minDays} dagen.
                  </p>
                )}

                {/* Legend */}
                <div className="flex items-center justify-center gap-3 px-4 py-2 text-xs text-slate-500 font-semibold">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-200 border border-emerald-400" />{t("calLegendAvailable")}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t("calLegendSelected")}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />{t("calLegendUnavailable")}</span>
                </div>
              </div>

              {/* Price preview — outside scroll, always visible above footer */}
              {validRange && (
                <div className="mx-4 mb-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {previewIsPackage ? "Weekendpakket" : `${displayDays} ${displayDays === 1 ? "dag" : "dagen"}`}
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900">{euro(withVat(subtotal, vatDisplay))} <span className="text-[10px] font-normal text-slate-400">{vatDisplay === "incl" ? "incl. btw" : "excl. btw"}</span></span>
                  </div>
                  {previewIsPackage && (
                    <p className="text-[10px] text-amber-700 leading-snug">Ophalen vrijdag vanaf 13:00 · retour maandag 08:00. Vrijdagochtend al nodig? Kies alleen vr + za.</p>
                  )}
                  {previewHasBlock && (
                    <p className="text-[10px] text-amber-700 leading-snug">Incl. zondagblokkade €{machine.sundayBlockFee} · retour maandag 08:00.</p>
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
