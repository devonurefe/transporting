/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Mail, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguageStore } from "../store/languageStore";
import { useAppStore } from "../store/appStore";
import { HuurGoLogo, BrandedText } from "./Header";
import { SERVICE_CITIES } from "../data/serviceCities";

interface FooterProps {
  siteName: string;
  setActiveTab: (tab: string) => void;
  setShowContactModal: (show: boolean) => void;
}

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
  {
    name: "Karin Hoogenbosch",
    date: "4 maanden geleden",
    text: "Vlotte service van begin tot eind. Machine was schoon en goed onderhouden, de instructie helder. Comfortabel werken op hoogte. Zeker een aanrader!",
  },
  {
    name: "Frank Verhoeven Schilderwerken",
    date: "2 weken geleden",
    text: "Schaarlift op tijd afgeleverd en de chauffeur legde alles goed uit. Ideaal voor ons schilderproject op de tweede verdieping. Prima tarief voor de kwaliteit.",
  },
  {
    name: "Bouwbedrijf Smits B.V.",
    date: "7 maanden geleden",
    text: "Al meerdere jaren vaste klant bij MB Hoogwerkers. Betrouwbaar materiaal, scherpe tarieven en altijd goed bereikbaar via WhatsApp. Een echte topper.",
  },
  {
    name: "Anita Timmers",
    date: "3 weken geleden",
    text: "Mastlift paste precies door ons smalle poortje van 80 cm. Goede uitleg vooraf en het apparaat werkte de hele week foutloos. Fijn dat ze meedachten!",
  },
];

function ReviewCard({ r }: { r: typeof REVIEWS[0] }) {
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-2.5">
      <div className="text-amber-400 text-sm leading-none tracking-wide">★★★★★</div>
      <p className="text-[13px] text-slate-300 leading-relaxed line-clamp-3">{r.text}</p>
      <div className="flex items-center justify-between gap-3 pt-1.5">
        <span className="text-[11px] font-bold text-white">{r.name}</span>
        <span className="text-[10px] text-slate-500 shrink-0">{r.date}</span>
      </div>
    </div>
  );
}

export default function Footer({ siteName, setActiveTab: _setActiveTab, setShowContactModal }: FooterProps) {
  const t = useLanguageStore((state) => state.t);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const contactEmail = siteConfig.contactEmail || "info@mbhoogwerkers.com";

  const leftCol = REVIEWS.filter((_, i) => i % 2 === 0);
  const rightCol = REVIEWS.filter((_, i) => i % 2 !== 0);

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
                <p className="text-xs text-slate-400 mt-0.5">Beoordeeld door klanten op Google</p>
              </div>
            </div>
            <a
              href="https://www.google.com/maps/place/MB+Hoogwerkers+bv/@52.1398936,4.5166788,18z"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white transition-colors no-underline sm:ml-auto"
            >
              Bekijk alle reviews op Google →
            </a>
          </div>

          {/* Review ticker */}
          <div className="relative overflow-hidden review-ticker-wrap h-[370px] sm:h-[430px] cursor-default select-none">

            {/* Top + bottom fade masks */}
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-slate-950 to-transparent z-10 pointer-events-none" />

            {/* Mobile: single column */}
            <div className="sm:hidden review-ticker flex flex-col gap-3">
              {[...REVIEWS, ...REVIEWS].map((r, i) => (
                <ReviewCard key={i} r={r} />
              ))}
            </div>

            {/* Desktop: two columns at different speeds */}
            <div className="hidden sm:flex gap-4">
              <div className="flex-1 review-ticker flex flex-col gap-3">
                {[...leftCol, ...leftCol].map((r, i) => (
                  <ReviewCard key={i} r={r} />
                ))}
              </div>
              <div className="flex-1 review-ticker-b flex flex-col gap-3">
                {[...rightCol, ...rightCol].map((r, i) => (
                  <ReviewCard key={i} r={r} />
                ))}
              </div>
            </div>

          </div>

          {/* Hint */}
          <p className="text-center text-[10px] text-slate-600 mt-4">Tik om te pauzeren</p>

        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 py-14 sm:py-16">

        {/* Top row — 2 columns, left aligned */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-14 pb-12 border-b border-slate-800">

          {/* Brand + email */}
          <div className="space-y-4 flex flex-col items-start">
            <HuurGoLogo className="h-9" dark />
            <p className="text-[10px] text-slate-500 -mt-1"><BrandedText text="HuurGo is een initiatief van MB Hoogwerkers" dark /></p>
            <p className="text-xs text-slate-400 leading-loose max-w-xs">
              Professionele verhuur van gecertificeerde hoogwerkers, schaarliften en mastliften voor ZZP'ers, aannemers en particulieren in heel Nederland.
            </p>
            <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors no-underline">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {contactEmail}
            </a>
          </div>

          {/* Hours & Location */}
          <div className="space-y-4 flex flex-col items-start">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{t("footerHours")}</h4>
            <div className="flex flex-col gap-4 text-xs text-slate-400">
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200 block">{t("footerHoursLine")}</span>
                  <span className="text-slate-500 text-xs">{t("footerClosed")}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200 block">Zoeterwoude (HQ)</span>
                  <span className="text-slate-500 text-xs">Produktieweg 20, 2382 PB</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Service-area + helpful links (internal linking for local SEO) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 py-10 border-b border-slate-800">
          <div className="sm:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Werkgebied — hoogwerker huren</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SERVICE_CITIES.map((c) => (
                <Link
                  key={c.slug}
                  to={`/hoogwerker-huren/${c.slug}`}
                  className="text-xs text-slate-400 hover:text-white transition-colors no-underline"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Informatie</h4>
            <div className="flex flex-col gap-2">
              <Link to="/veelgestelde-vragen" className="text-xs text-slate-400 hover:text-white transition-colors no-underline">Veelgestelde vragen</Link>
              <Link to="/catalog" className="text-xs text-slate-400 hover:text-white transition-colors no-underline">Alle hoogwerkers</Link>
              <button onClick={() => setShowContactModal(true)} className="text-xs text-slate-400 hover:text-white transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Contact &amp; openingstijden</button>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-600">
          <span><BrandedText text="© 2026 HuurGo / MB Hoogwerkers B.V. · KvK 67438237 · BTW NL856990656B01" dark /></span>
          <div className="flex gap-3">
            <span className="text-xs font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">TÜV Gecertificeerd</span>
            <span className="text-xs font-bold bg-slate-800/60 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-md">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
