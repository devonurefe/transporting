/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Mail, MapPin, Clock, ShieldCheck, Truck, MessageCircle, Star } from "lucide-react";
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

  // Real customer rating aggregate from our own platform (OrderRating). We only
  // surface the figure when there are genuine ratings — no fabricated numbers.
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/orders/ratings/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d && d.count > 0) setRating({ average: d.average, count: d.count }); })
      .catch(() => { /* silent — trust band renders without the figure */ });
    return () => { active = false; };
  }, []);

  return (
    <footer className="bg-slate-950 border-t border-slate-800 pb-20 md:pb-0">

      {/* ── WHY HUURGO — factual trust band (replaces fabricated testimonials) ── */}
      <div className="bg-slate-950 border-b border-slate-800">
        <div className="py-10 sm:py-14 px-5 sm:px-8 lg:px-10 mx-auto max-w-7xl">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">Waarom HuurGo</h3>
              <p className="text-xs text-slate-400 mt-1.5">Betrouwbaar materieel, eerlijk advies en scherpe tarieven in heel Zuid-Holland.</p>
            </div>
            {rating && (
              <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-700/60 rounded-2xl px-4 py-2.5 shrink-0">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0" />
                <div className="leading-none">
                  <span className="text-white font-black text-lg">{rating.average.toFixed(1)}</span>
                  <span className="text-slate-400 text-xs ml-1.5">gemiddeld · {rating.count} {rating.count === 1 ? "beoordeling" : "beoordelingen"}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {TRUST_POINTS.map(({ Icon, title, body }) => (
              <div key={title} className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <h4 className="text-sm font-bold text-white">{title}</h4>
                <p className="text-[13px] text-slate-400 leading-relaxed">{body}</p>
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
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {SERVICE_CITIES.map((c) => (
                <Link
                  key={c.slug}
                  to={`/hoogwerker-huren/${c.slug}`}
                  onClick={(e) => { e.preventDefault(); setActiveTab(`hoogwerker-huren/${c.slug}`); }}
                  className="inline-block py-1.5 text-xs text-slate-400 hover:text-white transition-colors no-underline"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Informatie</h4>
            <div className="flex flex-col gap-1">
              <Link to="/veelgestelde-vragen" onClick={(e) => { e.preventDefault(); setActiveTab("veelgestelde-vragen"); }} className="block py-2 -my-1 text-xs text-slate-400 hover:text-white transition-colors no-underline">Veelgestelde vragen</Link>
              <Link to="/catalog" onClick={(e) => { e.preventDefault(); setActiveTab("catalog"); }} className="block py-2 -my-1 text-xs text-slate-400 hover:text-white transition-colors no-underline">Alle hoogwerkers</Link>
              <button onClick={() => setShowContactModal(true)} className="block py-2 -my-1 text-xs text-slate-400 hover:text-white transition-colors text-left bg-transparent border-none px-0 cursor-pointer">Contact &amp; openingstijden</button>
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
