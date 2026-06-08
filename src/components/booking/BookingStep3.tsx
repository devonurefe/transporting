/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Machine } from "../../types";
import BookingPriceSummary from "./BookingPriceSummary";

interface BookingStep3Props {
  isSubmitting: boolean;
  setStep: (step: number) => void;
  handleCreateBooking: () => void;
  bookingError?: string | null;
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; borgsom: number;
  };
  selectedMachine?: Machine | null;
}

export default function BookingStep3({
  isSubmitting,
  setStep,
  handleCreateBooking,
  bookingError,
  sums,
  selectedMachine
}: BookingStep3Props) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in">
      <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
        <span className="text-emerald-600 text-lg">💬</span>
        <span>Reservering Bevestigen via WhatsApp</span>
      </h3>

      {/* WhatsApp flow explanation */}
      <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 space-y-4 shadow-inner">
        <div className="flex items-center space-x-2 pb-1.5 border-b border-emerald-200">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-black text-slate-800">Reserveren via WhatsApp & iDEAL Betaallink</span>
        </div>

        <p className="text-xs leading-relaxed text-slate-600 font-medium">
          Uw aanvraag wordt geregistreerd en u wordt doorgestuurd naar WhatsApp met een kant-en-klaar bericht. Ons vlootbeheer controleert de bestelling en stuurt u direct een <strong>beveiligde iDEAL-betaallink</strong> via WhatsApp.
        </p>

        <div className="p-3.5 bg-white/70 border border-emerald-100 rounded-xl space-y-2">
          <div className="flex items-start space-x-2 text-xs text-emerald-800">
            <span className="font-bold font-mono shrink-0">1.</span>
            <span>Klik op "Boeking Afronden" om uw aanvraag te registreren.</span>
          </div>
          <div className="flex items-start space-x-2 text-xs text-emerald-800">
            <span className="font-bold font-mono shrink-0">2.</span>
            <span>Verzend het vooraf samengestelde bericht via WhatsApp naar onze planner.</span>
          </div>
          <div className="flex items-start space-x-2 text-xs text-emerald-800">
            <span className="font-bold font-mono shrink-0">3.</span>
            <span>Ontvang een Tikkie of Mollie iDEAL-betaallink. Na betaling is uw boeking definitief.</span>
          </div>
        </div>
      </div>

      {/* CE Certified Assurance Info */}
      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-xs text-emerald-800 leading-relaxed shadow-sm">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <strong>BMWT Class-C Verzekeringsdekking:</strong> Uw betaling accrediteert direct de verzekeringsdekking voor windvlagen tot windkracht 6 Beaufort en mechanische schade-indemniteit.
        </div>
      </div>

      {bookingError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl leading-relaxed">
          {bookingError}
        </div>
      )}

      {sums && (
        <div className="lg:hidden">
          <BookingPriceSummary selectedMachine={selectedMachine ?? null} sums={sums} />
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between pt-4 border-t border-slate-200 gap-3">
        <button
          onClick={() => setStep(2)}
          className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer shadow-sm w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Terug</span>
        </button>

        <button
          onClick={handleCreateBooking}
          disabled={isSubmitting}
          className="font-extrabold text-xs px-7 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer border-none shadow-md w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-100/50"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Verwerken...</span>
            </>
          ) : (
            <span>Boeking Afronden via WhatsApp 💬</span>
          )}
        </button>
      </div>

    </div>
  );
}
