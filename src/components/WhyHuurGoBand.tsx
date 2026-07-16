/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, Truck, MessageCircle, Star, Clock, BadgeCheck, Euro, Phone } from "lucide-react";
import { motion } from "motion/react";
import { BrandedText } from "./Header";
import { useAppStore } from "../store/appStore";

// Verhuisd uit de Footer naar de homepage-body, zodat bezoekers de
// USP's zien vóór ze bij de FAQ zijn — niet pas helemaal onderaan.
// Admin-override via SiteConfig.uspItems (AdminContent → USP's); deze lijst
// is de fallback zolang de eigenaar niets heeft opgeslagen.
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

// Icon-whitelist — spiegel van USP_ICONS in server/utils/sanitizeContent.ts
const USP_ICON_MAP: Record<string, typeof ShieldCheck> = {
  shield: ShieldCheck,
  clock: Clock,
  truck: Truck,
  "badge-check": BadgeCheck,
  euro: Euro,
  phone: Phone,
};

export default function WhyHuurGoBand() {
  // Admin-beheerde USP's (AdminContent) — fallback: de hard-coded TRUST_POINTS
  const uspItems = useAppStore((state) => state.siteConfig.uspItems);
  const trustPoints = Array.isArray(uspItems) && uspItems.length > 0
    ? uspItems.map((it) => ({ Icon: USP_ICON_MAP[it.icon] ?? ShieldCheck, title: it.title, body: it.text }))
    : TRUST_POINTS;

  // Interne klantbeoordelingen (uit /api/orders/ratings/summary) — los van de
  // externe Google-score die de footer-reviewsectie toont.
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
    <div className="bg-gradient-to-b from-amber-50 to-white border-y border-amber-100">
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
          {trustPoints.map(({ Icon, title, body }, i) => (
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
  );
}
