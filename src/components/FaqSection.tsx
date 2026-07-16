/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle, MessageCircle, ArrowRight } from "lucide-react";
import { resolveFaqItems } from "../data/faq";
import { useAppStore } from "../store/appStore";
import { HuurGoText } from "./Header";
import { buildWhatsAppGeneralUrl } from "../utils/whatsapp";

/**
 * Visible FAQ page (/veelgestelde-vragen). Mirrors the FAQPage JSON-LD in App.tsx
 * (both read from src/data/faq.ts) so Google's rich result matches the page.
 */
export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  // Admin-beheerde FAQ (AdminContent) met de hard-coded lijst als fallback —
  // dezelfde resolver als de FAQPage JSON-LD in App.tsx
  const faqItems = resolveFaqItems(useAppStore((state) => state.siteConfig).faqItems);

  useEffect(() => {
    document.title = "Veelgestelde vragen — Hoogwerker huren | huurgo";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center mb-8 space-y-2">
        <span className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-slate-100 mb-1">
          <HelpCircle className="h-5 w-5 text-orange-500" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Veelgestelde vragen</h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Antwoorden op de meestgestelde vragen over het huren van een hoogwerker bij <HuurGoText />.
          Staat uw vraag er niet bij? Wij helpen u graag via WhatsApp.
        </p>
      </header>

      <div className="space-y-2.5">
        {faqItems.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="no-press w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-bold text-slate-900 leading-snug">{item.q}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 sm:px-5 pb-4 -mt-1 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-8 rounded-2xl bg-slate-900 text-white p-6 text-center space-y-3">
        <h2 className="text-base font-bold">Nog een vraag over hoogwerker huren?</h2>
        <p className="text-sm text-slate-300">Stuur ons gerust een bericht — u krijgt snel persoonlijk antwoord en advies.</p>
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          <a
            href={buildWhatsAppGeneralUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-shine inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-bold transition-colors no-underline"
          >
            <MessageCircle className="h-4 w-4" /> Stel uw vraag via WhatsApp
          </a>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
          >
            Bekijk het assortiment <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
