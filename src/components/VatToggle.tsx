/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAppStore } from "../store/appStore";

interface VatToggleProps {
  size?: "xs" | "sm";
}

/**
 * Segmented pill that switches the global price display between
 * excl. and incl. BTW. Display only — calculations are untouched.
 */
export default function VatToggle({ size = "sm" }: VatToggleProps) {
  const vatDisplay = useAppStore((s) => s.vatDisplay);
  const setVatDisplay = useAppStore((s) => s.setVatDisplay);

  const pad = size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]";

  return (
    <div
      role="group"
      aria-label="Prijsweergave incl. of excl. BTW"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 shrink-0"
    >
      {(["excl", "incl"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={vatDisplay === mode}
          onClick={() => setVatDisplay(mode)}
          className={`${pad} font-bold rounded-full whitespace-nowrap transition-all cursor-pointer ${
            vatDisplay === mode
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {mode === "excl" ? "excl. btw" : "incl. btw"}
        </button>
      ))}
    </div>
  );
}
