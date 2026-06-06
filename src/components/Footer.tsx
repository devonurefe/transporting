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
    <footer className="border-t border-slate-150 bg-slate-50/50 pt-6 sm:pt-12 pb-20 sm:pb-12 text-[12.5px] text-slate-500 font-normal shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-12">
        
        {/* Main Grid — Mobile: Centered stack, Desktop: Left-aligned 4-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-10 text-center sm:text-left">
          
          {/* Column 1: Brand Profile & Certifications */}
          <div className="col-span-1 space-y-3 flex flex-col items-center sm:items-start">
            <div className="flex items-center justify-center sm:justify-start space-x-2">
              <HuurGoLogo className="h-8 w-auto" />
              <span className="text-[9px] text-indigo-700 font-semibold bg-indigo-50/70 px-1.5 py-0.5 rounded-full border border-indigo-100/50">B.V.</span>
            </div>
            <p className="text-slate-500 text-[11px] sm:text-[12px] leading-relaxed mt-1 text-center sm:text-left">
              Snel en simpel compacte hoogwerkers huren voor ZZP'ers en particulieren.
            </p>
            <div className="flex flex-wrap gap-1 justify-center sm:justify-start">
              <span className="bg-amber-50/80 border border-amber-200/50 text-amber-800 text-[8px] sm:text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full">
                BMWT-Lid
              </span>
              <span className="bg-indigo-50/80 border border-indigo-200/50 text-indigo-800 text-[8px] sm:text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full">
                Co-Verzekerd
              </span>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div className="hidden sm:flex col-span-1 space-y-3 flex-col items-center sm:items-start">
            <h4 className="font-display font-semibold tracking-wider text-[10px] sm:text-[11px] uppercase text-slate-800 pb-1 border-b border-slate-100/80 w-full text-center sm:text-left">
              Snelkoppelingen
            </h4>
            <nav className="flex flex-row flex-wrap gap-x-4 gap-y-1 justify-center sm:flex-col sm:space-y-1 sm:items-start">
              <button 
                onClick={() => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[11px] sm:text-[12px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Home
              </button>
              <button 
                onClick={() => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[11px] sm:text-[12px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Catalogus
              </button>
              <button 
                onClick={() => { setActiveTab("advisor"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[11px] sm:text-[12px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                AI Adviseur
              </button>
              <button 
                onClick={() => setShowContactModal(true)} 
                className="text-[11px] sm:text-[12px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Contact
              </button>
            </nav>
          </div>

          {/* Column 3: Direct Contact details */}
          <div className="col-span-1 space-y-3 flex flex-col items-center sm:items-start">
            <h4 className="font-display font-semibold tracking-wider text-[10px] sm:text-[11px] uppercase text-slate-800 pb-1 border-b border-slate-100/80 w-full text-center sm:text-left">
              Direct Contact
            </h4>
            <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 justify-center sm:flex-col sm:space-y-2 sm:items-start">
              <a 
                href="tel:+31172456789" 
                className="flex items-center space-x-1.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-650 shrink-0 transition-all" />
                <span className="font-sans font-medium text-slate-750 text-[11px] sm:text-[12px] tracking-tight">+31 172 456 789</span>
              </a>
              <a 
                href="mailto:support@huurgo.nl" 
                className="flex items-center space-x-1.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-650 shrink-0 transition-all" />
                <span className="font-sans font-medium text-slate-750 text-[11px] sm:text-[12px] tracking-tight break-all">support@huurgo.nl</span>
              </a>
              <a
                href="https://wa.me/31612345678"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 text-[#25D366] hover:text-[#20bd5a] transition-colors group cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 transition-all" />
                <span className="font-sans font-medium text-[11px] sm:text-[12px] tracking-tight">WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Column 4: Logistics & Working Hours */}
          <div className="col-span-1 space-y-3 flex flex-col items-center sm:items-start">
            <h4 className="font-display font-semibold tracking-wider text-[10px] sm:text-[11px] uppercase text-slate-800 pb-1 border-b border-slate-100/80 w-full text-center sm:text-left">
              Openingstijden
            </h4>
            <div className="flex flex-row flex-wrap gap-x-6 gap-y-3 justify-center sm:flex-col sm:space-y-2">
              <div className="flex flex-col items-center sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 sm:mt-0.5" />
                <div className="text-center sm:text-left">
                  <span className="font-medium text-slate-800 text-[11px] sm:text-[12px] block">Ma t/m Za</span>
                  <span className="text-[9.5px] sm:text-[10.5px] font-semibold text-indigo-605 text-indigo-600 bg-indigo-50/60 border border-indigo-100/80 rounded px-1.5 py-0.5 mt-0.5 inline-block">07:00 – 18:00</span>
                </div>
              </div>
              <div className="flex flex-col items-center sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 sm:mt-0.5" />
                <div className="text-center sm:text-left">
                  <span className="font-medium text-slate-800 text-[11px] sm:text-[12px] block">Hoofdkantoor</span>
                  <span className="text-[9.5px] sm:text-[11px] leading-relaxed text-slate-500 block mt-0.5">Edisonweg 14, 2408 AB<br />Alphen aan den Rijn</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & KvK Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 sm:pt-8 border-t border-slate-200 text-[10px] sm:text-[11.5px] text-slate-500 gap-2 sm:gap-3">
          <span className="text-center sm:text-left">© 2026 {siteName} B.V. Alle rechten voorbehouden. KvK 8849201.</span>
          <span className="text-[9px] sm:text-[10px] font-semibold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200/60">
            Cat. 1-3B Co-Verzekerd
          </span>
        </div>

      </div>
    </footer>
  );
}
