/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (localStorage.getItem("hwh_pwa_dismissed") !== "true") {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissBanner = () => {
    localStorage.setItem("hwh_pwa_dismissed", "true");
    setShowInstallBanner(false);
  };

  return (
    <AnimatePresence>
      {showInstallBanner && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-20 md:bottom-6 left-4 z-50 max-w-sm p-4 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl flex items-start space-x-3.5"
        >
          <div className="text-xl p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            🏗️
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold font-display leading-tight">HoogwerkerHub installeren?</h4>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Installeer onze PWA voor snellere laadtijden, realtime push-notificaties en offline kalenderinzicht.
            </p>
            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={handleInstallClick}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl border-none cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                Nu installeren
              </button>
              <button
                onClick={handleDismissBanner}
                className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-xl border-none cursor-pointer transition-all"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
