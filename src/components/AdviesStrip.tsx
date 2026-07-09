/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useAppStore } from "../store/appStore";
import AdviesModal from "./AdviesModal";

/**
 * Entry point for the Adviestool: an indigo strip that opens the wizard modal.
 * Self-contained — manages its own open state — so it can be dropped onto the
 * home page and the catalogus without extra plumbing. Hidden when an admin has
 * switched the tool off via siteConfig.advisorConfig.enabled === false.
 */
export default function AdviesStrip() {
  const advisorConfig = useAppStore(
    (s) => (s.siteConfig as { advisorConfig?: { enabled?: boolean } }).advisorConfig
  );
  const [open, setOpen] = useState(false);

  if (advisorConfig?.enabled === false) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-4 text-left rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white hover:from-indigo-100 px-4 sm:px-5 py-4 transition-colors cursor-pointer"
      >
        <span className="grid place-items-center h-11 w-11 rounded-xl bg-indigo-600 text-white shrink-0">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm sm:text-base font-bold text-slate-900">
            Niet zeker welke machine u nodig heeft?
          </span>
          <span className="block text-xs sm:text-sm text-slate-500">
            Beantwoord een paar korte vragen — wij zoeken de beste match uit ons park.
          </span>
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
          Start de keuzehulp <ArrowRight className="h-4 w-4" />
        </span>
      </button>
      <AdviesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
