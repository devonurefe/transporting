/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../store/appStore";
import { withImageWidth } from "../utils/image";
import { HuurGoText } from "./Header";

// Admin-editable homepage photo gallery (Admin → Customizer) shown between the
// Coffee Corner block and the footer reviews: real company/work photos in a
// continuously auto-scrolling carousel (drifts left by itself, like the
// homepage deals row) — one photo at a time on mobile, several side by side
// on desktop. Off until an admin fills in a title + at least one photo and
// enables it — same "no fabricated content" rule as Coffee Corner/the hero.
export default function PhotoGallerySection() {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const siteConfigLoaded = useAppStore((state) => state.siteConfigLoaded);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the last real user interaction (touch/hover/manual nav) so the
  // auto-scroll tick can pause for a bit instead of fighting it — same
  // approach as the homepage deals carousel (HomeSection.tsx DealsCarousel).
  const lastInteractionRef = useRef(0);
  const scrollPosRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);

  const images = (siteConfig.galleryImages ?? []).filter((url): url is string => typeof url === "string" && url.length > 0);
  const canLoop = images.length > 1;
  // Duplicate the row so the auto-scroll can wrap seamlessly from the end
  // back to the start instead of snapping back visibly.
  const loopImages = canLoop ? [...images, ...images] : images;

  const markInteraction = () => {
    lastInteractionRef.current = performance.now();
  };

  const tick = useCallback((now: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = now;
    const dt = Math.min(now - lastTimeRef.current, 64);
    lastTimeRef.current = now;
    const el = scrollRef.current;
    const recentlyInteracted = now - lastInteractionRef.current < 1500;
    if (el && canLoop && !recentlyInteracted) {
      const half = el.scrollWidth / 2;
      scrollPosRef.current += (34 * dt) / 1000;
      if (scrollPosRef.current >= half) scrollPosRef.current -= half;
      el.scrollLeft = scrollPosRef.current;
    } else if (el) {
      scrollPosRef.current = el.scrollLeft;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [canLoop]);

  useEffect(() => {
    if (!canLoop) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, canLoop]);

  if (!siteConfigLoaded || !siteConfig.galleryEnabled) return null;
  if (!siteConfig.galleryTitle?.trim() || images.length === 0) return null;

  const scrollBack = () => {
    const el = scrollRef.current;
    if (!el) return;
    markInteraction();
    const card = el.querySelector<HTMLElement>("[data-gallery-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    const half = el.scrollWidth / 2;
    let next = el.scrollLeft - step;
    if (next < 0) next += half;
    scrollPosRef.current = next;
    el.scrollTo({ left: next, behavior: "smooth" });
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
            <Camera className="h-4 w-4" /> <HuurGoText />
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

          {/* Only a "back" control — the row already drifts forward on its
              own, on both mobile and desktop. */}
          {canLoop && (
            <button
              type="button"
              onClick={scrollBack}
              aria-label="Vorige"
              className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-1 select-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onTouchStart={markInteraction}
            onTouchMove={markInteraction}
            onTouchEnd={markInteraction}
            onMouseEnter={markInteraction}
            onMouseMove={markInteraction}
          >
            {loopImages.map((url, i) => (
              <div
                key={i}
                data-gallery-card
                className="shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] h-64 sm:h-72 lg:h-80 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center"
              >
                <img
                  src={withImageWidth(url, 640) || url}
                  alt={`${siteConfig.galleryTitle} ${(i % images.length) + 1}`}
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
