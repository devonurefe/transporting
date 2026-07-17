/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  MapPin, Mail, Phone, Building2, ArrowRight, Coffee,
  ShieldCheck, Truck, MessageCircle, Clock, BadgeCheck, Euro,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { BrandedText } from "./Header";

// "Over ons" — verzamelt uitsluitend al bestaande, echte gegevens (geen
// verzonnen content): bedrijfsgegevens/adres (SiteConfig, dezelfde velden als
// Footer), USP's/missie (dezelfde resolver als WhyHuurGoBand.tsx, dus admin-
// beheerd via AdminContent) en het assortiment (customCategories). Bereikbaar
// via de "Maak kennis met ons"-CTA op de Coffee Corner-homepageblok.
const DEFAULT_TRUST_POINTS = [
  {
    icon: "shield" as const,
    title: "Gecertificeerd materieel",
    text: "TÜV-gekeurde hoogwerkers (cat. 1-3B), goed onderhouden en bedrijfsklaar afgeleverd.",
  },
  {
    icon: "truck" as const,
    title: "Snelle levering in heel NL",
    text: "Bezorging door eigen chauffeur of zelf ophalen in Zoeterwoude — u kiest wat past.",
  },
  {
    icon: "phone" as const,
    title: "Persoonlijk advies via WhatsApp",
    text: "Twijfelt u over de juiste machine? Wij denken vrijblijvend met u mee, vóór u boekt.",
  },
];

const USP_ICON_MAP: Record<string, typeof ShieldCheck> = {
  shield: ShieldCheck, clock: Clock, truck: Truck, "badge-check": BadgeCheck, euro: Euro, phone: MessageCircle,
};

export default function AboutSection() {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const customCategories = useAppStore((state) => state.customCategories);

  useEffect(() => {
    document.title = `Over ons | ${siteConfig.siteName || "huurgo"}`;
    window.scrollTo(0, 0);
  }, [siteConfig.siteName]);

  const legalName = siteConfig.companyLegalName || "MB Hoogwerkers B.V.";
  const address = siteConfig.companyAddress || "Produktieweg 20, 2382 PB Zoeterwoude";
  const contactEmail = siteConfig.contactEmail || "info@mbhoogwerkers.com";
  const contactPhone = siteConfig.contactPhone || "+31 71 542 8114";
  const kvk = siteConfig.kvkNumber || "67438237";
  const btw = siteConfig.btwNumber || "NL856990656B01";

  const trustPoints = Array.isArray(siteConfig.uspItems) && siteConfig.uspItems.length > 0
    ? siteConfig.uspItems.map((it) => ({ Icon: USP_ICON_MAP[it.icon] ?? ShieldCheck, title: it.title, text: it.text }))
    : DEFAULT_TRUST_POINTS.map((it) => ({ Icon: USP_ICON_MAP[it.icon], title: it.title, text: it.text }));

  const hasCoffeeCorner = !!(siteConfig.coffeeCornerEnabled && siteConfig.coffeeCornerTitle?.trim() && siteConfig.coffeeCornerDescription?.trim());
  const coffeeImageUrl = siteConfig.coffeeCornerImageUrl === "/site-coffee-image"
    ? "/site-coffee-image?w=768"
    : siteConfig.coffeeCornerImageUrl;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center space-y-4"
      >
        <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Maak kennis met <BrandedText text="HuurGo" />
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {siteConfig.heroSubtitle || "HuurGo verhuurt gecertificeerde hoogwerkers, schaarliften, mastliften en ladderliften aan ZZP'ers, aannemers en particulieren in heel Nederland. Direct online geregeld, zonder gedoe."}
        </p>
      </motion.header>

      {/* Missie / waarom HuurGo — zelfde content + resolver als WhyHuurGoBand op de homepage */}
      <section className="space-y-5">
        <h2 className="font-display text-lg sm:text-xl font-black text-slate-900 text-center">Onze missie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trustPoints.map(({ Icon, title, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2.5 shadow-sm"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Assortiment — echte, admin-beheerde categorieën, linkt door naar gefilterde catalogus */}
      {customCategories.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-lg sm:text-xl font-black text-slate-900 text-center">Ons assortiment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customCategories.map((c) => (
              <Link
                key={c.id}
                to={`/catalog?cat=${encodeURIComponent(c.id)}`}
                className="group flex items-center justify-between gap-3 bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md rounded-2xl p-4 transition-all no-underline"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{c.listLabel || c.label}</h3>
                  {c.desc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.desc}</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Coffee Corner — hergebruikt dezelfde admin-content als het homepageblok */}
      {hasCoffeeCorner && (
        <section className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden grid grid-cols-1 sm:grid-cols-2">
          <div className="relative h-52 sm:h-full min-h-[200px] bg-slate-200">
            {coffeeImageUrl ? (
              <img src={coffeeImageUrl} alt={siteConfig.coffeeCornerTitle} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-amber-600 bg-amber-50">
                <Coffee className="h-8 w-8" strokeWidth={1.8} />
              </div>
            )}
          </div>
          <div className="p-6 flex flex-col justify-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-2">
              <Coffee className="h-4 w-4" /> Coffee Corner
            </span>
            <h2 className="font-display font-black text-lg text-slate-900 mb-2">{siteConfig.coffeeCornerTitle}</h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{siteConfig.coffeeCornerDescription}</p>
          </div>
        </section>
      )}

      {/* Bedrijfsgegevens & adres — zelfde velden als de Footer */}
      <section className="bg-slate-950 rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-lg font-black text-white">{legalName}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 text-slate-300 hover:text-white transition-colors no-underline"
          >
            <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{address}</span>
          </a>
          <a href={`mailto:${contactEmail}`} className="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors no-underline">
            <Mail className="h-4 w-4 text-amber-500 shrink-0" />
            <span>{contactEmail}</span>
          </a>
          <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors no-underline">
            <Phone className="h-4 w-4 text-amber-500 shrink-0" />
            <span>{contactPhone}</span>
          </a>
          <span className="flex items-center gap-2.5 text-slate-400 text-xs">
            KvK {kvk} · BTW {btw}
          </span>
        </div>
      </section>
    </div>
  );
}
