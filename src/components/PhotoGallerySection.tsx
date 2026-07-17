/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../store/appStore";
import { withImageWidth } from "../utils/image";

// Admin-editable homepage photo gallery (Admin → Customizer) shown between the
// Coffee Corner block and the footer reviews: real company/work photos in a
// horizontally scrolling, snap-to-card carousel — one photo at a time on
// mobile, several side by side on desktop. Off until an admin fills in a
// title + at least one photo and enables it — same "no fabricated content"
// rule as Coffee Corner/the hero.
export default function PhotoGallerySection() {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);
  const scrollRef = useRef<HTMLDivElement>(null);

  const images = (siteConfig.galleryImages ?? []).filter((url): url is string => typeof url === "string" && url.length > 0);

  if (!siteConfigLoaded || !siteConfig.galleryEnabled) return null;
  if (!siteConfig.galleryTitle?.trim() || images.length === 0) return null;

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-gallery-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="bg-white border-t border-slate-100 px-4 sm:px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35 }}
          className="text-center mb-8"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-2">
            <Camera className="h-4 w-4" /> {siteConfig.siteName || "HuurGo"}
          </span>
          <h2 className="font-display font-black text-lg sm:text-xl text-slate-900 leading-tight">
            {siteConfig.galleryTitle}
          </h2>
          {siteConfig.galleryDescription?.trim() && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl mx-auto">
              {siteConfig.galleryDescription}
            </p>
          )}
        </motion.div>

        <div className="relative">
          {/* Edge fades — hint that the row scrolls on mobile */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 z-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 z-10 bg-gradient-to-l from-white to-transparent" />

          {/* Prev/next — desktop only, mobile relies on native swipe */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label="Vorige"
                className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label="Volgende"
                className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {images.map((url, i) => (
              <div
                key={i}
                data-gallery-card
                className="snap-center shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm"
              >
                <img
                  src={withImageWidth(url, 640) || url}
                  alt={`${siteConfig.galleryTitle} ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
