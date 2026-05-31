/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CheckCircle2, Check } from "lucide-react";
import { motion } from "motion/react";
import { Order } from "../../types";

interface BookingSuccessProps {
  successOrder: Order | null;
  paymentGateway: string;
  setStep: (step: number) => void;
  setSuccessOrder: (order: Order | null) => void;
  setActiveTab: (tab: string) => void;
}

export default function BookingSuccess({
  successOrder,
  paymentGateway,
  setStep,
  setSuccessOrder,
  setActiveTab
}: BookingSuccessProps) {
  if (!successOrder) return null;

  return (
    <motion.div
      key="success-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 shadow-xl max-w-2xl mx-auto p-8 rounded-3xl space-y-6 text-center relative overflow-hidden"
    >
      {/* Green/teal glow radiant */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-emerald-50 to-transparent -z-10" />

      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm animate-bounce mb-2">
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div>
        <span className="text-[10px] font-mono uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-extrabold tracking-wider">
          Boeking Succesvol Verwerkt
        </span>
        <h1 className="font-display text-2xl font-black text-slate-900 mt-4">
          Factuur & Overeenkomst Geaccordeerd!
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-2 max-w-md mx-auto">
          Uw hoogwerker is officieel geregistreerd onder referentienummer{" "}
          <strong className="text-indigo-600 font-mono">{successOrder?.id}</strong>. Inkoop-betaling is met succes voldaan via de beveiligde <strong className="text-teal-700 uppercase">{paymentGateway} Gateway</strong>.
        </p>
      </div>

      {/* Booking specifications board */}
      <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-200 space-y-3 max-w-lg mx-auto text-xs font-semibold shadow-sm">
        <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-100">
          <span>Huurder:</span>
          <span className="text-slate-800 font-bold">{successOrder.customerName}</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-100">
          <span>Hoogwerker Model:</span>
          <span className="text-indigo-700 font-bold">{successOrder.machineName}</span>
        </div>
        <div className="flex justify-between items-center text-slate-505 text-slate-505 text-slate-500 pb-1.5 border-b border-slate-100">
          <span>Gereserveerde Periode:</span>
          <span className="text-slate-800 font-bold">{successOrder.startDate} t/m {successOrder.endDate} ({successOrder.rentalDays} {successOrder.rentalDays === 1 ? 'dag' : 'dagen'})</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-100">
          <span>Logistieke Omgang:</span>
          <span className="text-teal-700 font-bold">
            {successOrder.deliveryType === "self_pickup" ? "Zelf ophalen bij de Hub" : "Transport door Hub Chauffeur"}
          </span>
        </div>
        {successOrder.deliveryAddress && (
          <div className="flex justify-between items-start text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="shrink-0 mr-3">Afleveradres:</span>
            <span className="text-slate-808 text-slate-800 text-right leading-snug">{successOrder.deliveryAddress}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Mollie Betaalbedrag:</span>
          <span className="text-base font-mono font-bold text-teal-700">€ {successOrder.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Action routes */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-6 border-t border-slate-200">
        <button
          onClick={() => {
            setStep(1);
            setSuccessOrder(null);
            setActiveTab("home");
          }}
          className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all border border-slate-200 cursor-pointer shadow-sm border-none"
        >
          Terug naar Home
        </button>

        <button
          onClick={() => {
            setStep(1);
            setSuccessOrder(null);
            setActiveTab("orders");
          }}
          className="bg-indigo-655 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer border-none"
        >
          Mijn Bestellingen Bekijken
        </button>
      </div>
    </motion.div>
  );
}
