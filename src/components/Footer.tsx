/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Mail, MapPin, Clock, ShieldCheck, Truck, MessageCircle, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
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
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-2.5">
      <div className="text-amber-500 text-sm leading-none tracking-wide">★★★★★</div>
      <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-3">{r.text}</p>
      <div className="flex items-center justify-between gap-3 pt-1.5">
        <span className="text-[11px] font-bold text-slate-900">{r.name}</span>
        <span className="text-[10px] text-slate-400 shrink-0">{r.date}</span>
      </div>
    </div>
  );
}

const TRUST_POINTS = [
  {
    Icon: ShieldCheck,
    title: "Gecertificeerd materieel",
    body: "TÜV-gekeurde hoogwerkers (cat. 1-3B), goed onderhouden en bedrijfsklaar afgeleverd.",
  },
  {
    Icon: Truck,
    title: "Snelle levering in heel NL",
    body: "Bezorging door eigen chauffeur of zelf ophalen in Zoeterwoude — u kiest wat past.",
  },
  {
    Icon: MessageCircle,
    title: "Persoonlijk advies via WhatsApp",
    body: "Twijfelt u over de juiste machine? Wij denken vrijblijvend met u mee, vóór u boekt.",
  },
];

export default function Footer({ siteName, setActiveTab, setShowContactModal }: FooterProps) {
  const t = useLanguageStore((state) => state.t);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const contactEmail = siteConfig.contactEmail || "info@mbhoogwerkers.com";

  const leftCol = REVIEWS.filter((_, i) => i % 2 === 0);
  const rightCol = REVIEWS.filter((_, i) => i % 2 !== 0);

  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/orders/ratings/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d && d.count > 0) setRating({ average: d.average, count: d.count }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <footer className="bg-slate-950 pb-20 md:pb-0">

      {/* ── WHY HUURGO — scroll-revealed trust band ──
          Crisp top edge (shadow, not a blended gradient bar) for a cleaner
          hand-off from the page content above. */}
      <div className="bg-gradient-to-b from-amber-50 to-white border-b border-amber-100 shadow-[0_-12px_24px_-20px_rgba(15,23,42,0.15)]">
        <div className="py-10 sm:py-14 px-5 sm:px-8 lg:px-10 mx-auto max-w-7xl">

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"
          >
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Waarom <BrandedText text="HuurGo" />
              </h3>
              <p className="text-xs text-slate-500 mt-1.5">Betrouwbaar materieel, eerlijk advies en scherpe tarieven in heel Nederland.</p>
            </div>
            {rating && (
              <div className="flex items-center gap-2.5 bg-white border border-amber-100 shadow-sm rounded-2xl px-4 py-2.5 shrink-0">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0" />
                <div className="leading-none">
                  <span className="text-slate-900 font-black text-lg">{rating.average.toFixed(1)}</span>
                  <span className="text-slate-500 text-xs ml-1.5">gemiddeld · {rating.count} {rating.count === 1 ? "beoordeling" : "beoordelingen"}</span>
                </div>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {TRUST_POINTS.map(({ Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-2.5 hover:border-orange-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 group-hover:bg-orange-500/20 group-hover:scale-105 transition-all duration-300">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <h4 className="text-sm font-bold text-slate-900">{title}</h4>
                <p className="text-[13px] text-slate-500 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>

      {/* ── GOOGLE REVIEWS ticker ── */}
      <div className="bg-gradient-to-b from-white to-amber-50 border-b border-amber-100">
        <div className="py-10 sm:py-12 px-5 sm:px-8 lg:px-10 mx-auto max-w-7xl">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35 }}
            className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6"
          >
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <span className="text-base font-black" style={{ background: "linear-gradient(135deg, #4285F4 25%, #EA4335 50%, #FBBC05 75%, #34A853 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>G</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  {/* Toon alleen een echt cijfer — nooit een verzonnen score */}
                  {rating ? (
                    <>
                      <span className="text-slate-900 font-bold text-base leading-none">{rating.average.toFixed(1)}</span>
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-slate-500">({rating.count} {rating.count === 1 ? "beoordeling" : "beoordelingen"})</span>
                    </>
                  ) : (
                    <span className="text-slate-900 font-bold text-base leading-none">Google Reviews</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Beoordeeld door klanten op Google</p>
              </div>
            </div>
            <a
              href="https://www.google.com/maps/place/MB+Hoogwerkers+bv/@52.1398936,4.5166788,18z"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors no-underline sm:ml-auto"
            >
              Bekijk alle reviews op Google →
            </a>
          </motion.div>

          {/* Review ticker */}
          <div className="relative overflow-hidden review-ticker-wrap h-[370px] sm:h-[430px] cursor-default select-none">

            {/* Top + bottom fade masks */}
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-amber-50 to-transparent z-10 pointer-events-none" />

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

          <p className="text-center text-[10px] text-slate-400 mt-4">Zweef om te pauzeren</p>

        </div>
      </div>

      {/* Transition into dark footer — straight, crisp cut with a thin
          accent line instead of a blended gradient bar. */}
      <div className="h-10 sm:h-14 bg-amber-50 border-b-2 border-orange-400" aria-hidden="true" />

      {/* ── DARK FOOTER — 3-column symmetrical layout ── */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 pb-14 sm:pb-16">

        {/* Orange accent rule at the top of the dark section */}
        <div className="w-16 h-0.5 bg-gradient-to-r from-orange-500 to-orange-400/0 mb-10 rounded-full" aria-hidden="true" />

        {/* 3-column grid: Brand | Hours & Location | Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 lg:gap-12 pb-10 border-b border-slate-800">

          {/* Col 1 — Brand */}
          <div className="space-y-4 flex flex-col items-start">
            <HuurGoLogo className="h-9" dark />
            <p className="text-[10px] text-slate-500 -mt-1"><BrandedText text="HuurGo is een initiatief van MB Hoogwerkers" dark /></p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Professionele verhuur van gecertificeerde hoogwerkers, schaarliften en mastliften voor ZZP'ers, aannemers en particulieren.
            </p>
            <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors no-underline mt-1">
              <span className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                <Mail className="h-3.5 w-3.5" />
              </span>
              {contactEmail}
            </a>
          </div>

          {/* Col 2 — Hours & Location */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("footerHours")}</h4>
            <div className="flex flex-col gap-3.5 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-snug">
                  <span className="font-semibold text-slate-200 block">{t("footerHoursLine")}</span>
                  <span className="text-slate-500 text-[11px]">{t("footerClosed")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <div className="leading-snug">
                  <span className="font-semibold text-slate-200 block">Zoeterwoude (HQ)</span>
                  <span className="text-slate-500 text-[11px]">Produktieweg 20, 2382 PB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Col 3 — Links */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Informatie</h4>
            <div className="flex flex-col gap-0.5">
              <Link
                to="/veelgestelde-vragen"
                onClick={(e) => { e.preventDefault(); setActiveTab("veelgestelde-vragen"); }}
                className="flex items-center gap-2 py-2 text-xs text-slate-400 hover:text-white transition-colors no-underline group"
              >
                <span className="h-1 w-1 rounded-full bg-slate-700 group-hover:bg-orange-500 transition-colors shrink-0" />
                Veelgestelde vragen
              </Link>
              <Link
                to="/catalog"
                onClick={(e) => { e.preventDefault(); setActiveTab("catalog"); }}
                className="flex items-center gap-2 py-2 text-xs text-slate-400 hover:text-white transition-colors no-underline group"
              >
                <span className="h-1 w-1 rounded-full bg-slate-700 group-hover:bg-orange-500 transition-colors shrink-0" />
                Alle hoogwerkers
              </Link>
              <button
                onClick={() => setShowContactModal(true)}
                className="flex items-center gap-2 py-2 text-xs text-slate-400 hover:text-white transition-colors text-left bg-transparent border-none px-0 cursor-pointer group"
              >
                <span className="h-1 w-1 rounded-full bg-slate-700 group-hover:bg-orange-500 transition-colors shrink-0" />
                Contact &amp; openingstijden
              </button>
            </div>
          </div>

        </div>

        {/* Service cities — full width below the 3 columns */}
        <div className="py-8 border-b border-slate-800">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Werkgebied — hoogwerker huren</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {SERVICE_CITIES.map((c) => (
              <Link
                key={c.slug}
                to={`/hoogwerker-huren/${c.slug}`}
                onClick={(e) => { e.preventDefault(); setActiveTab(`hoogwerker-huren/${c.slug}`); }}
                className="inline-block py-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors no-underline"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom row — copyright + badges */}
        <div className="pt-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-600">
          <span><BrandedText text="© 2026 HuurGo / MB Hoogwerkers B.V. · KvK 67438237 · BTW NL856990656B01" dark /></span>
          <div className="flex gap-2">
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700/60 text-slate-500 px-2.5 py-1 rounded-lg">TÜV Gecertificeerd</span>
            <span className="text-[10px] font-bold bg-slate-800/60 border border-slate-700/60 text-slate-500 px-2.5 py-1 rounded-lg">Cat. 1-3B</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
