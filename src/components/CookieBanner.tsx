/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";

const STORAGE_KEY = "hwh_cookie_accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-14 sm:bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-white/90 backdrop-blur-sm border-t border-slate-200 shadow-lg sm:px-6">
      <p className="text-xs text-slate-600 leading-snug">
        Wij gebruiken cookies voor optimale werking van de site.{" "}
        <a
          href="#privacy"
          className="underline text-indigo-600 hover:text-indigo-800 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById("privacy");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Meer info
        </a>
      </p>
      <button
        onClick={handleAccept}
        className="shrink-0 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-colors cursor-pointer"
      >
        Accepteren
      </button>
    </div>
  );
}
