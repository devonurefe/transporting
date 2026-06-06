/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Phone, Mail, MapPin, Clock, MessageCircle, Shield, Award } from "lucide-react";
import { HuurGoLogo } from "./Header";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab, setShowContactModal }: FooterProps) {
  return (
    <footer className="relative bg-slate-950 text-slate-400 pt-16 pb-24 md:pb-16 border-t border-slate-900 overflow-hidden">
      {/* Premium ambient decorative glow */}
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-0 left-10 h-80 w-80 rounded-full bg-emerald-500/2 blur-[100px] pointer-events-none" />

      {/* Subtle top divider line with gradient */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 mb-12">
          
          {/* Column 1: Brand & Certifications */}
          <div className="space-y-4 flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center space-x-2.5 transition-transform duration-300 hover:scale-[1.02]">
              <div className="p-1.5 bg-white/5 rounded-xl border border-white/10 shadow-inner">
                <HuurGoLogo className="h-7 w-auto filter brightness-0 invert" />
              </div>
              <span className="text-[9px] text-indigo-400 font-extrabold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25 tracking-widest uppercase">
                B.V.
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
              De slimste en snelste verhuurder van compacte hoogwerkers in heel Nederland. Ontworpen voor zzp'ers en particulieren.
            </p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
              <span className="inline-flex items-center space-x-1 bg-amber-500/5 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                <Award className="h-3 w-3 text-amber-400" />
                <span>BMWT-Lid</span>
              </span>
              <span className="inline-flex items-center space-x-1 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span>Co-Verzekerd</span>
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="hidden md:flex space-y-4 flex-col items-center md:items-start text-center md:text-left">
            <h4 className="font-display font-extrabold tracking-wider text-[11px] uppercase text-white pb-2 border-b border-white/5 w-full">
              Snelkoppelingen
            </h4>
            <nav className="flex flex-col space-y-2.5 w-full items-center md:items-start">
              {[
                { label: "Home", action: () => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Katalogus / Fleet", action: () => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Direct Huren", action: () => { setActiveTab("booking"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "Support & Contact", action: () => setShowContactModal(true) }
              ].map((link, idx) => (
                <button
                  key={idx}
                  onClick={link.action}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer border-none bg-transparent py-0.5 hover:translate-x-1 duration-200 transform"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Column 3: Contact Channels */}
          <div className="space-y-4 flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="font-display font-extrabold tracking-wider text-[11px] uppercase text-white pb-2 border-b border-white/5 w-full">
              Direct Contact
            </h4>
            <div className="flex flex-col space-y-3.5 w-full items-center md:items-start">
              <a 
                href="tel:+31172456789" 
                className="flex items-center space-x-2.5 text-slate-400 hover:text-white transition-colors group cursor-pointer no-underline"
              >
                <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-indigo-500/40 group-hover:bg-indigo-500/5 transition-all">
                  <Phone className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400" />
                </div>
                <span className="font-sans font-bold text-xs tracking-tight">+31 172 456 789</span>
              </a>
              <a 
                href="mailto:support@huurgo.nl" 
                className="flex items-center space-x-2.5 text-slate-400 hover:text-white transition-colors group cursor-pointer no-underline"
              >
                <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-indigo-500/40 group-hover:bg-indigo-500/5 transition-all">
                  <Mail className="h-3.5 w-3.5 text-slate-450 group-hover:text-indigo-400" />
                </div>
                <span className="font-sans font-bold text-xs tracking-tight break-all">support@huurgo.nl</span>
              </a>
              <a
                href="https://wa.me/31612345678"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2.5 text-[#25D366] hover:text-[#20bd5a] transition-colors group cursor-pointer no-underline"
              >
                <div className="h-7 w-7 rounded-lg bg-[#25D366]/5 border border-[#25D366]/20 flex items-center justify-center group-hover:bg-[#25D366]/10 transition-all">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <span className="font-sans font-bold text-xs tracking-tight">WhatsApp Support</span>
              </a>
            </div>
          </div>

          {/* Column 4: Hours & Head Office */}
          <div className="space-y-4 flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="font-display font-extrabold tracking-wider text-[11px] uppercase text-white pb-2 border-b border-white/5 w-full">
              Openingstijden & Hub
            </h4>
            <div className="flex flex-col space-y-3.5">
              <div className="flex items-start space-x-2.5">
                <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs block leading-none">Maandag t/m Zaterdag</span>
                  <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-0.5 mt-1.5 inline-block font-mono">07:00 – 18:00</span>
                </div>
              </div>
              <div className="flex items-start space-x-2.5">
                <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-450" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs block leading-none">Hub Alphen a/d Rijn</span>
                  <span className="text-[10.5px] leading-relaxed text-slate-400 block mt-1.5">Edisonweg 14, 2408 AB<br />Alphen aan den Rijn</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom copyright and legal disclaimer */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-slate-900 text-[10.5px] text-slate-500 gap-3">
          <span className="text-center sm:text-left">© 2026 {siteName} B.V. Alle rechten voorbehouden. KvK 8849201.</span>
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-black bg-slate-900 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              TÜV Gecertificeerd
            </span>
            <span className="text-[9px] font-black bg-slate-900 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Cat. 1-3B Co-Verzekerd
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
