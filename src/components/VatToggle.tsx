/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAppStore } from "../store/appStore";

interface VatToggleProps {
  size?: "xs" | "sm";
  /** Full-width on mobile (equal halves), compact inline from sm+. */
  block?: boolean;
}

/**
 * Segmented pill that switches the global price display between
 * excl. and incl. BTW. Display only — calculations are untouched.
 */
export default function VatToggle({ size = "sm", block = false }: VatToggleProps) {
  const vatDisplay = useAppStore((s) => s.vatDisplay);
  const setVatDisplay = useAppStore((s) => s.setVatDisplay);

  // Default ("sm") matches the search bar next to it: rounded-xl, text-xs,
  // py-1 so the overall height lines up. "xs" keeps the compact pill used
  // inside the booking summary.
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  const outerRadius = size === "xs" ? "rounded-full" : "rounded-xl";
  const innerRadius = size === "xs" ? "rounded-full" : "rounded-lg";
  const outerPad = size === "xs" ? "p-0.5" : "p-1";

  return (
    <div
      role="group"
      aria-label="Prijsweergave incl. of excl. BTW"
      className={`items-center ${outerRadius} border border-slate-200/80 bg-white ${outerPad} ${
        block ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex shrink-0"
      }`}
    >
      {(["excl", "incl"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={vatDisplay === mode}
          onClick={() => setVatDisplay(mode)}
          className={`${pad} font-bold ${innerRadius} whitespace-nowrap transition-all cursor-pointer ${
            block ? "flex-1 text-center sm:flex-none" : ""
          } ${
            vatDisplay === mode
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {mode === "excl" ? "excl. btw" : "incl. btw"}
        </button>
      ))}
    </div>
  );
}
