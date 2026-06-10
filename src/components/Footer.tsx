/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Mail, MapPin, Clock } from "lucide-react";
import { useLanguageStore } from "../store/languageStore";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab: _setActiveTab, setShowContactModal }: FooterProps) {
  const t = useLanguageStore((state) => state.t);
  return (
    <footer className="bg-slate-950 border-t border-slate-800 pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 py-14 sm:py-16">

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-14 pb-12 border-b border-slate-800 text-center sm:text-left">

          {/* Brand */}
          <div className="space-y-5 flex flex-col items-center sm:items-start">
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-2xl font-extrabold text-emerald-400">huur</span>
              <span className="font-display text-2xl font-extrabold text-orange-400">go.</span>
            </div>
            <p className="text-xs text-slate-400 leading-loose max-w-xs">
              Professionele verhuur van gecertificeerde hoogwerkers, schaarliften en mastliften voor zzp'ers, aannemers en particulieren door heel Nederland.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md uppercase tracking-wide">BMWT-Lid</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-md uppercase tracking-wide">Co-Verzekerd</span>
            </div>
          </div>

          {/* Hours & Location */}
          <div className="space-y-5 flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2 w-full text-center sm:text-left">{t("footerHours")}</h4>
            <div className="flex flex-col gap-4 text-xs text-slate-400 items-center sm:items-start">
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200 block">{t("footerHoursLine")}</span>
                  <span className="text-slate-500 text-[11px]">{t("footerClosed")}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200 block">Zoeterwoude (HQ)</span>
                  <span className="text-slate-500 text-[11px]">Produktieweg 20, 2382 PB</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10.5px] text-slate-600">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>© 2026 HuurGo / MB Hoogwerkers B.V. · KvK 67438237 · BTW NL856990656B01</span>
            <a href="mailto:info@mbhoogwerkers.com" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors no-underline">
              <Mail className="h-3 w-3 shrink-0" />
              info@mbhoogwerkers.com
            </a>
          </div>
          <div className="flex gap-3">
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">TÜV Gecertificeerd</span>
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
