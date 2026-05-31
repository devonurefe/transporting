/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CreditCard, Sparkle, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface BookingStep3Props {
  paymentGateway: "stripe" | "mollie";
  setPaymentGateway: (gateway: "stripe" | "mollie") => void;
  idealBank: string;
  setIdealBank: (bank: string) => void;
  cardNumber: string;
  setCardNumber: (num: string) => void;
  cardName: string;
  setCardName: (name: string) => void;
  cardExpiry: string;
  setCardExpiry: (expiry: string) => void;
  cardCVC: string;
  setCardCVC: (cvc: string) => void;
  isSubmitting: boolean;
  setStep: (step: number) => void;
  handleCreateBooking: () => void;
}

export default function BookingStep3({
  paymentGateway,
  setPaymentGateway,
  idealBank,
  setIdealBank,
  cardNumber,
  setCardNumber,
  cardName,
  setCardName,
  cardExpiry,
  setCardExpiry,
  cardCVC,
  setCardCVC,
  isSubmitting,
  setStep,
  handleCreateBooking
}: BookingStep3Props) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in">
      <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
        <CreditCard className="h-5 w-5 text-indigo-650 text-indigo-600 animate-pulse" />
        <span>Veilige Afrekening via Bank of Inkoopkaart</span>
      </h3>

      {/* Choose gateway simulation standard */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-500 font-mono font-extrabold uppercase block">Kies Payment Gateway SDK</span>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setPaymentGateway("mollie")}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all border-none ${
              paymentGateway === "mollie" 
                ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm" 
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="text-xs font-black flex items-center space-x-1.5">
              <Sparkle className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>Mollie (Zelf iDEAL, Bancontact)</span>
            </span>
          </button>

          <button
            onClick={() => setPaymentGateway("stripe")}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all border-none ${
              paymentGateway === "stripe" 
                ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm" 
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="text-xs font-black flex items-center space-x-1.5">
              <CreditCard className="h-3.5 w-3.5 text-[#635BFF] shrink-0" />
              <span>Stripe (Inkoopkaart, Creditcard)</span>
            </span>
          </button>
        </div>
      </div>

      {/* Toggle Payment fields based on integration selected */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
        
        {paymentGateway === "mollie" ? (
          /* MOLLIE iDEAL FLOW */
          <div className="space-y-3">
            <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
              <div className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
              <span className="text-xs font-black text-slate-800">Live iDEAL Selectie via Mollie API v2</span>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-mono font-extrabold uppercase">Kies uw bank-instelling</label>
              <select
                value={idealBank}
                onChange={(e) => setIdealBank(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-805 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer h-10.5 shadow-sm"
              >
                <option value="rabobank">Rabobank (NL)</option>
                <option value="ing">ING Bank (NL)</option>
                <option value="abnamro">ABN AMRO Bank (NL)</option>
                <option value="sns">SNS Bank (NL)</option>
                <option value="regiobank">RegioBank (NL)</option>
              </select>
            </div>

            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10.5px] text-slate-600 leading-relaxed">
              Bij het akkoord gaan, wordt u doorgestuurd naar uw beveiligde bankapplicatie. Na betaling keert u automatisch terug voor het downloaden van uw huurovereenkomst.
            </div>
          </div>
        ) : (
          /* STRIPE SDK CREDIT CARD FLOW */
          <div className="space-y-3">
            <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
              <div className="h-2 w-2 rounded-full bg-[#635BFF] animate-ping" />
              <span className="text-xs font-black text-slate-800">Stripe Elements Secure Form</span>
            </div>

            {/* Visual Credit Card */}
            <div className="w-full h-36 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-950 border border-white/5 p-4.5 flex flex-col justify-between relative overflow-hidden text-xs text-white font-mono shadow-md">
              <div className="absolute top-0 right-0 h-28 w-28 bg-[#635BFF]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="font-bold uppercase text-[10px] tracking-widest text-[#635BFF]">Inkoopkaart</span>
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div className="text-sm font-bold tracking-[3px] py-1.5">
                {cardNumber || "•••• •••• •••• ••••"}
              </div>
              <div className="flex justify-between items-end text-[10px] uppercase text-slate-400">
                <div>
                  <span className="text-[8px] block leading-none">Kaarthouder</span>
                  <span className="text-white font-bold leading-normal mt-0.5 block truncate max-w-[130px]">{cardName || "J. de Vries"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] block leading-none">EXPIRE</span>
                  <span className="text-white font-bold leading-normal mt-0.5 block">{cardExpiry || "MM/JJ"}</span>
                </div>
              </div>
            </div>

            {/* Stripe Input Entries */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Kaarthouder Naam</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Jan de Vries"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Inkoopkaart Nummer (Creditcard)</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => {
                    const text = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                    setCardNumber(text);
                  }}
                  maxLength={19}
                  placeholder="5248 1234 5678 9921"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Vervaldatum</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="08/28"
                    maxLength={5}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-805 text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Beveiligingscode (CVC)</label>
                  <input
                    type="password"
                    value={cardCVC}
                    onChange={(e) => setCardCVC(e.target.value)}
                    placeholder="•••"
                    maxLength={3}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-808 text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* CE Certified Assurance Info */}
      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-[10.5px] text-emerald-800 leading-relaxed shadow-sm">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <strong>BMWT Class-C Verzekeringsdekking:</strong> Uw betaling accrediteert direct de verzekeringsdekking voor windvlagen tot windkracht 6 Beaufort en mechanische schade-indemniteit.
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => setStep(2)}
          className="bg-slate-50 hover:bg-slate-100 text-slate-705 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1 border border-slate-200 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Terug</span>
        </button>

        <button
          onClick={handleCreateBooking}
          disabled={isSubmitting}
          className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-xs px-7 py-3 rounded-xl transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer border-none shadow-md shadow-indigo-100"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span>Verwerken...</span>
            </>
          ) : (
            <>
              <span>Veilig Betalen</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
