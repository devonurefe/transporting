/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../store/appStore";
import { withImageWidth } from "../utils/image";
import { HuurGoText } from "./Header";

// Admin-editable homepage photo gallery (Admin → Customizer) shown between the
// Coffee Corner block and the footer reviews: real company/work photos in a
// carousel that auto-advances one full card at a time (never mid-scroll/cut
// off — each stop shows a complete, sharp photo) — one photo at a time on
// mobile, several side by side on desktop. Off until an admin fills in a
// title + at least one photo and enables it — same "no fabricated content"
// rule as Coffee Corner/the hero.
export default function PhotoGallerySection() {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the last real user interaction (touch/hover/manual nav) so the
  // auto-advance timer can pause for a bit instead of fighting it.
  const lastInteractionRef = useRef(0);

  const images = (siteConfig.galleryImages ?? []).filter((url): url is string => typeof url === "string" && url.length > 0);
  const canAdvance = images.length > 1;

  const markInteraction = () => {
    lastInteractionRef.current = performance.now();
  };

  // Finds the card nearest the current scroll position, so advancing always
  // starts from wherever the user last manually swiped to (never desyncs).
  const currentIndex = () => {
    const el = scrollRef.current;
    if (!el) return 0;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    return closest;
  };

  const goTo = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[index] as HTMLElement | undefined;
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    if (!canAdvance) return;
    const interval = setInterval(() => {
      if (performance.now() - lastInteractionRef.current < 3000) return;
      goTo((currentIndex() + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdvance, images.length]);

  if (!siteConfigLoaded || !siteConfig.galleryEnabled) return null;
  if (!siteConfig.galleryTitle?.trim() || images.length === 0) return null;

  const goBack = () => {
    markInteraction();
    goTo((currentIndex() - 1 + images.length) % images.length);
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
          <span className="inline-flex items-center text-base sm:text-lg mb-2">
            <HuurGoText />
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
          {/* Edge fades — hint that the row scrolls */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 z-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 z-10 bg-gradient-to-l from-white to-transparent" />

          {/* Only a "back" control — the row already advances forward on its
              own, on both mobile and desktop. */}
          {canAdvance && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Vorige"
              className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 select-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onTouchStart={markInteraction}
            onTouchMove={markInteraction}
            onTouchEnd={markInteraction}
            onMouseEnter={markInteraction}
            onMouseMove={markInteraction}
          >
            {images.map((url, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] h-64 sm:h-72 lg:h-80 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center"
              >
                <img
                  src={withImageWidth(url, 640) || url}
                  alt={`${siteConfig.galleryTitle} ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
