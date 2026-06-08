/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab: _setActiveTab, setShowContactModal }: FooterProps) {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 pb-10 border-b border-slate-800 text-center sm:text-left">

          {/* Brand */}
          <div className="space-y-4 flex flex-col items-center sm:items-start">
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-xl font-extrabold text-emerald-400">huur</span>
              <span className="font-display text-xl font-extrabold text-orange-400">go.</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Professionele verhuur van gecertificeerde hoogwerkers, schaarliften en mastliften voor zzp'ers, aannemers en particulieren door heel Nederland.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md uppercase tracking-wide">BMWT-Lid</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md uppercase tracking-wide">Co-Verzekerd</span>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3 flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Contact</h4>
            <div className="flex flex-col space-y-2.5 items-center sm:items-start">
              <a href="tel:+31715428114" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors no-underline">
                <Phone className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                071 542 8114
              </a>
              <a href="mailto:info@mbhoogwerkers.com" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors no-underline">
                <Mail className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                info@mbhoogwerkers.com
              </a>
              <a href="https://wa.me/31715428114" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#25D366] hover:text-[#1da851] transition-colors no-underline font-semibold">
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                WhatsApp Support
              </a>
            </div>
          </div>

          {/* Hours */}
          <div className="space-y-3 flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Openingstijden</h4>
            <div className="flex flex-col space-y-2.5 text-xs text-slate-400 items-center sm:items-start">
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Ma – Za: 07:00–19:00</span>
                  <span className="text-slate-500">Zondag gesloten</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Zoeterwoude (HQ)</span>
                  <span className="text-slate-500">Produktieweg 20, 2382 PB</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10.5px] text-slate-600">
          <span>© 2026 HuurGo / MB Hoogwerkers B.V. · KvK 67438237 · BTW NL856990656B01</span>
          <div className="flex gap-3">
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2 py-0.5 rounded-md">TÜV Gecertificeerd</span>
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2 py-0.5 rounded-md">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
