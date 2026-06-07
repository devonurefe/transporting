/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { HuurGoLogo } from "./Header";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab, setShowContactModal }: FooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200 pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-slate-100">

          {/* Brand */}
          <div className="space-y-3">
            <HuurGoLogo className="h-8 w-auto" />
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Snelle verhuur van hoogwerkers voor zzp'ers en particulieren in heel Nederland.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wide">BMWT-Lid</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wide">Co-Verzekerd</span>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Navigatie</h4>
            <nav className="flex flex-col space-y-2">
              {[
                { label: "Home", action: () => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Katalogus", action: () => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Direct Huren", action: () => { setActiveTab("booking"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Contact", action: () => setShowContactModal(true) },
              ].map((link, i) => (
                <button
                  key={i}
                  onClick={link.action}
                  className="text-xs text-slate-600 hover:text-indigo-600 transition-colors text-left cursor-pointer bg-transparent border-none p-0 font-medium"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</h4>
            <div className="flex flex-col space-y-2.5">
              <a href="tel:+31715428114" className="flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-600 transition-colors no-underline">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                071 542 8114
              </a>
              <a href="mailto:info@mbhoogwerkers.com" className="flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-600 transition-colors no-underline">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                info@mbhoogwerkers.com
              </a>
              <a href="https://wa.me/31715428114" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#25D366] hover:text-[#1da851] transition-colors no-underline font-semibold">
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                WhatsApp Support
              </a>
            </div>
          </div>

          {/* Hours */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Openingstijden</h4>
            <div className="flex flex-col space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">Ma – Za: 07:00–19:00</span>
                  <span className="text-slate-400">Zondag gesloten</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">Zoeterwoude (HQ)</span>
                  <span className="text-slate-400">Produktieweg 20, 2382 PB</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10.5px] text-slate-400">
          <span>© 2026 {siteName} B.V. · KvK 67438237 · BTW NL856990656B01</span>
          <div className="flex gap-3">
            <span className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">TÜV Gecertificeerd</span>
            <span className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
