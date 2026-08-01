/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { useLanguageStore } from "../store/languageStore";
import { loadClarity } from "../utils/analytics";

// New key (was "hwh_cookie_accepted"). Renaming intentionally re-prompts visitors
// who only ever saw the old accept-only banner, so they can now also decline.
const STORAGE_KEY = "hwh_cookie_consent";

export default function CookieBanner() {
  const t = useLanguageStore((s) => s.t);
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  const persist = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  const handleAccept = () => {
    persist("accepted");
    loadClarity(); // only now do analytics cookies load
  };

  const handleReject = () => persist("rejected");

  return (
    // z-[55] sits above the WhatsApp FAB (z-[51]) and the mobile bottom nav
    // (z-50) so the consent prompt is visible, but below modals (z-[60]) so an
    // open dialog is never overlapped by the bottom-pinned banner.
    <motion.div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      initial={{ y: "110%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.4 }}
      className="fixed inset-x-0 bottom-0 z-[55] bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-slate-600 leading-snug flex-1 flex items-start gap-2.5">
          <span className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 border border-orange-100">
            <Cookie className="h-4 w-4" />
          </span>
          <span>
          {t("cookieText")}{" "}
          <Link
            to="/privacy"
            className="underline text-slate-600 hover:text-slate-800 transition-colors"
          >
            {t("cookieMoreInfo")}
          </Link>
          </span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReject}
            className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            {t("cookieReject")}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-slate-900 text-xs font-bold transition-colors cursor-pointer"
          >
            {t("cookieAccept")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
