/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Mail, MapPin, Clock } from "lucide-react";
import { useLanguageStore } from "../store/languageStore";
import { HuurGoLogo } from "./Header";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

export default function Footer({ siteName, setActiveTab: _setActiveTab, setShowContactModal }: FooterProps) {
  const t = useLanguageStore((state) => state.t);
  const REVIEWS = [
    {
      name: "Pieter van den Berg",
      date: "2 maanden geleden",
      text: "Super service! De Nifty 120 was binnen 5 minuten opgesteld, perfect voor mijn dakgoot klus. Fijne communicatie via WhatsApp en eerlijk advies. Aanrader!",
    },
    {
      name: "Erik Janssen",
      date: "3 maanden geleden",
      text: "Machine was goed onderhouden en op tijd geleverd. Prima prijs-kwaliteitverhouding. Inmiddels voor het tweede project bij MB Hoogwerkers gehuurd.",
    },
    {
      name: "Sandra Bakker",
      date: "1 maand geleden",
      text: "De rupshoogwerker paste precies door ons 80 cm tuinpoortje. Uitstekend advies vooraf over welke machine het beste paste. Zeker een aanrader!",
    },
    {
      name: "J. de Vries Schildersbedrijf",
      date: "5 maanden geleden",
      text: "Als aannemer huur ik regelmatig bij MB Hoogwerkers. Altijd betrouwbaar materiaal, eerlijk advies en scherpe tarieven. Echt een topper in de regio.",
    },
    {
      name: "Thomas Willems",
      date: "6 weken geleden",
      text: "Ladderlift was perfect voor onze verhuizing naar de 4e verdieping. Vriendelijke en snelle service. Zeker voor herhaling vatbaar!",
    },
  ];

  return (
    <footer className="bg-slate-950 border-t border-slate-800 pb-20 md:pb-0">

      {/* ── GOOGLE REVIEWS ── */}
      <div className="bg-slate-950 border-b border-slate-800">
        <div className="py-10 sm:py-12 px-5 sm:px-8 lg:px-10 mx-auto max-w-7xl">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-full bg-white flex items-center justify-center shrink-0">
                <span className="text-base font-black" style={{ background: "linear-gradient(135deg, #4285F4 25%, #EA4335 50%, #FBBC05 75%, #34A853 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>G</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-base leading-none">4.9</span>
                  <span className="text-amber-400 text-sm leading-none">★★★★★</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Beoordeeld door klanten op Google</p>
              </div>
            </div>
            <a
              href="https://www.google.com/maps/place/MB+Hoogwerkers+bv/@52.1398936,4.5166788,18z"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-400 hover:text-white transition-colors no-underline sm:ml-auto"
            >
              Bekijk alle reviews op Google →
            </a>
          </div>

          {/* Review cards */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="bg-slate-900 border border-slate-700 rounded-2xl p-4 min-w-[260px] sm:min-w-0 flex-shrink-0 sm:flex-shrink space-y-2"
              >
                <div className="text-amber-400 text-sm leading-none">★★★★★</div>
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{r.text}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-white">{r.name}</span>
                  <span className="text-[10px] text-slate-500">{r.date}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 py-14 sm:py-16">

        {/* Top row — 2 columns, left aligned */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-14 pb-12 border-b border-slate-800">

          {/* Brand + email */}
          <div className="space-y-4 flex flex-col items-start">
            <HuurGoLogo className="h-9" dark />
            <p className="text-xs text-slate-400 leading-loose max-w-xs">
              Professionele verhuur van gecertificeerde hoogwerkers, schaarliften en mastliften voor zzp'ers, aannemers en particulieren door heel Nederland.
            </p>
            <a href="mailto:info@mbhoogwerkers.com" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors no-underline">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              info@mbhoogwerkers.com
            </a>
          </div>

          {/* Hours & Location */}
          <div className="space-y-4 flex flex-col items-start">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("footerHours")}</h4>
            <div className="flex flex-col gap-4 text-xs text-slate-400">
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
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[10.5px] text-slate-600">
          <span>© 2026 HuurGo / MB Hoogwerkers B.V. · KvK 67438237 · BTW NL856990656B01</span>
          <div className="flex gap-3">
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">TÜV Gecertificeerd</span>
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
