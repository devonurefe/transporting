/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Coffee } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/appStore";

// Admin-editable homepage block (Admin → Customizer) shown just above the
// footer: a company photo + inviting copy, with an optional CTA button.
// Off until an admin fills in a title + description and enables it — same
// "no fabricated content" rule as the hero/Google-rating fields.
export default function CoffeeCornerSection() {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);

  if (!siteConfigLoaded || !siteConfig.coffeeCornerEnabled) return null;
  if (!siteConfig.coffeeCornerTitle?.trim() || !siteConfig.coffeeCornerDescription?.trim()) return null;

  const imageUrl = siteConfig.coffeeCornerImageUrl === "/site-coffee-image"
    ? "/site-coffee-image?w=768"
    : siteConfig.coffeeCornerImageUrl;

  // Admin kan de CTA overschrijven (bv. een WhatsApp-link); zonder eigen tekst/
  // link wijst de knop naar de nieuwe "Over ons"-pagina (bedrijf, adres,
  // assortiment, missie — dezelfde al-bestaande content, geen nieuwe velden).
  const ctaLabel = siteConfig.coffeeCornerCtaLabel?.trim() || "Maak kennis met HuurGo";
  const ctaHref = siteConfig.coffeeCornerCtaHref?.trim() || "/over-ons";
  const isInternalCta = ctaHref.startsWith("/");

  return (
    <div className="bg-white border-t border-slate-100 px-4 sm:px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-0 bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-sm"
        >
          <div className="relative h-56 sm:h-full min-h-[220px] bg-slate-200">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={siteConfig.coffeeCornerTitle}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-amber-600 bg-amber-50">
                <Coffee className="h-8 w-8" strokeWidth={1.8} />
                <span className="text-xs font-bold">Coffee Corner</span>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-2">
              <Coffee className="h-4 w-4" /> Coffee Corner
            </span>
            <h2 className="font-display font-black text-lg sm:text-xl text-slate-900 mb-2.5">
              {siteConfig.coffeeCornerTitle}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-5">
              {siteConfig.coffeeCornerDescription}
            </p>
            {isInternalCta ? (
              <Link
                to={ctaHref}
                className="self-center sm:self-start inline-flex items-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md transition-all no-underline"
              >
                {ctaLabel}
              </Link>
            ) : (
              <a
                href={ctaHref}
                target={ctaHref.startsWith("http") ? "_blank" : undefined}
                rel={ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className="self-center sm:self-start inline-flex items-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md transition-all no-underline"
              >
                {ctaLabel}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
