/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import AdviesModal from "./AdviesModal";

const STEPS = [
  { icon: "🏗️", title: "Vertel wat u gaat doen", text: "Op hoogte werken, spullen omhoog of een kleine klus." },
  { icon: "📏", title: "Een paar korte vragen", text: "Werkhoogte, ondergrond en type werk — meer niet." },
  { icon: "✅", title: "Direct de beste match", text: "Wij tonen de machines uit ons park die passen." },
];

const BENEFITS = [
  "Kies uit schaarliften, mastliften, spinhoogwerkers, verhuisliften en steigers",
  "Advies op basis van ons eigen verhuurpark — geen loze aanbevelingen",
  "Gratis en vrijblijvend, in een halve minuut",
  "Geen match? Direct persoonlijk advies via WhatsApp",
];

/**
 * Crawlable landing page (/adviestool). Gives Google real content + meta (the
 * server injects <title>/description/FAQ JSON-LD for this route) and a button
 * that opens the same wizard modal used by the strip.
 */
export default function AdviesSection() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = "Welke hoogwerker heb ik nodig? · Keuzehulp | huurgo";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      {/* Hero */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Keuzehulp
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4 tracking-tight text-balance">
          Welke hoogwerker heb ik nodig?
        </h1>
        <p className="text-slate-500 mt-3 max-w-xl mx-auto">
          Twijfelt u tussen een schaarlift, mastlift of spinhoogwerker? Beantwoord een paar korte vragen en zie direct
          welke machine uit ons verhuurpark bij uw klus past.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl mt-6 transition-colors cursor-pointer"
        >
          Start de keuzehulp <ArrowRight className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-3 mt-12">
        {STEPS.map((s, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-2xl" aria-hidden="true">{s.icon}</span>
            <p className="text-sm font-bold text-slate-900 mt-3">{s.title}</p>
            <p className="text-xs text-slate-500 mt-1">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 mt-8">
        <h2 className="text-base font-bold text-slate-900 mb-4">Waarom de keuzehulp gebruiken?</h2>
        <ul className="space-y-2.5">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Fallback note + secondary CTA */}
      <div className="text-center mt-10">
        <p className="text-sm text-slate-500">
          Liever meteen persoonlijk advies? Bekijk het{" "}
          <Link to="/catalog" className="font-semibold text-indigo-600 hover:underline">
            volledige assortiment
          </Link>{" "}
          of neem contact op.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-indigo-600 font-bold text-sm mt-4 hover:underline cursor-pointer"
        >
          <MessageCircle className="h-4 w-4" /> Start de keuzehulp
        </button>
      </div>

      <AdviesModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
