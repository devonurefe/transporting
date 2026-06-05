/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab, setShowContactModal }: FooterProps) {
  return (
    <footer className="border-t border-slate-150 bg-slate-50/50 pt-16 pb-12 text-[12.5px] text-slate-500 font-normal shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 text-left animate-fade-in">
          
          {/* Column 1: Brand Profile & Certifications */}
          <div className="space-y-4 hidden sm:block">
            <div className="flex items-center space-x-2">
              <span className="font-display text-lg font-black tracking-tight text-slate-900">{siteName}</span>
              <span className="text-[9.5px] text-indigo-700 font-semibold bg-indigo-50/70 px-2 py-0.5 rounded-full border border-indigo-100/50">B.V.</span>
            </div>
            <p className="text-slate-500 text-[12px] leading-relaxed max-w-xs">
              Snel en simpel compacte hoogwerkers huren voor ZZP'ers en particulieren. Onze slimme AI-assistent helpt u direct online de juiste machine te kiezen.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="bg-amber-50/80 border border-amber-200/50 text-amber-800 text-[9.5px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full">
                BMWT-Lid
              </span>
              <span className="bg-indigo-50/80 border border-indigo-200/50 text-indigo-800 text-[9.5px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full">
                Cat. 1-3B Co-Verzekerd
              </span>
            </div>
          </div>

          {/* Column 2: Direct Contact details */}
          <div className="space-y-4 hidden sm:block">
            <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
              Direct Contact
            </h4>
            <div className="space-y-3">
              <a 
                href="tel:+31172456789" 
                className="flex items-center space-x-2.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
              >
                <Phone className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 shrink-0 group-hover:scale-110 transition-all duration-200" />
                <span className="font-sans font-medium text-slate-750 text-[13px] tracking-tight">+31 (0)172 456 789</span>
              </a>
              <a 
                href="mailto:support@hoogwerkerhub.nl" 
                className="flex items-center space-x-2.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
              >
                <Mail className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 shrink-0 group-hover:scale-110 transition-all duration-200" />
                <span className="font-sans font-medium break-all text-slate-700 text-[12.5px] tracking-tight">support@hoogwerkerhub.nl</span>
              </a>
              <div className="flex items-start space-x-2.5 text-slate-600 pt-1">
                <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-800 text-[13px] block">Hoofdkantoor Hub</span>
                  <span className="text-[12px] leading-relaxed text-slate-500 block mt-0.5">Edisonweg 14, 2408 AB<br />Alphen aan den Rijn</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Logistics & Working Hours */}
          <div className="space-y-4 hidden sm:block">
            <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
              Logistiek & Openingstijden
            </h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-2.5">
                <Clock className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-800 text-[13px] block">Maandag t/m Zaterdag</span>
                  <span className="text-[11.5px] font-semibold text-indigo-650 bg-indigo-50/60 border border-indigo-100/80 rounded px-2 py-0.5 mt-1.5 inline-block">07:00 – 18:00 uur</span>
                  <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                    Zondagsgesloten in overeenstemming met BMWT-rustregels voor logistiek transport.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Quick Navigation */}
          <div className="space-y-4 text-center sm:text-left">
            <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
              Snelkoppelingen
            </h4>
            <nav className="flex flex-row flex-wrap justify-center gap-x-6 gap-y-2 sm:flex-col sm:space-y-2 sm:items-start">
              <button 
                onClick={() => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Home
              </button>
              <button 
                onClick={() => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Catalogus
              </button>
              <button 
                onClick={() => { setActiveTab("advisor"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Adviseur
              </button>
              <button 
                onClick={() => setShowContactModal(true)} 
                className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-center sm:text-left py-0.5 border-none bg-transparent"
              >
                Contact
              </button>
            </nav>
          </div>

        </div>

        {/* Bottom Copyright & KvK Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-slate-200 text-[11.5px] text-slate-500 gap-3">
          <span>© 2026 {siteName} B.V. Alle rechten voorbehouden. KvK Alphen a/d Rijn 8849201. Geregistreerd lid.</span>
          <span className="text-[10px] font-semibold bg-slate-50 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200/60">
            Veiligheidsklasse Categorie 1-3B Co-Verzekerd
          </span>
        </div>

      </div>
    </footer>
  );
}
