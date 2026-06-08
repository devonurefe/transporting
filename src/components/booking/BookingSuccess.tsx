/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, Download, MessageCircle, ClipboardList, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Order, UserProfile } from "../../types";
import { printInvoice } from "../../utils/invoice";
import { useAuthStore } from "../../store/authStore";

interface BookingSuccessProps {
  successOrder: Order | null;
  successOrders: Order[];
  paymentGateway: string;
  setStep: (step: number) => void;
  setSuccessOrder: (order: Order | null) => void;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile | null;
  whatsappUrl?: string;
}

export default function BookingSuccess({
  successOrder,
  successOrders,
  paymentGateway,
  setStep,
  setSuccessOrder,
  setActiveTab,
  currentUser,
  whatsappUrl
}: BookingSuccessProps) {
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  if (!successOrder) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setRegisterError("Wachtwoord moet minimaal 6 tekens bevatten.");
      return;
    }
    setIsRegistering(true);
    setRegisterError("");
    try {
      const success = await useAuthStore.getState().register({
        email: successOrder.customerEmail,
        password,
        name: successOrder.customerName,
        phone: successOrder.customerPhone || undefined,
        profile: successOrder.customerProfile || undefined,
      });
      if (success) {
        setRegisterSuccess(true);
      } else {
        setRegisterError(useAuthStore.getState().error || "Registratie mislukt.");
      }
    } catch {
      setRegisterError("Er is een netwerkfout opgetreden. Probeer het opnieuw.");
    } finally {
      setIsRegistering(false);
    }
  };

  const specs = [
    { label: "Huurder", value: successOrder.customerName },
    { label: "Hoogwerker", value: successOrder.machineName, highlight: true },
    {
      label: "Periode",
      value: `${successOrder.startDate} t/m ${successOrder.endDate} (${successOrder.rentalDays} ${successOrder.rentalDays === 1 ? "dag" : "dagen"})`,
    },
    {
      label: "Afhaling",
      value: successOrder.deliveryType === "self_pickup" ? "Zelf ophalen" : "Bezorging door chauffeur",
    },
    ...(successOrder.deliveryAddress ? [{ label: "Adres", value: successOrder.deliveryAddress }] : []),
    { label: "Totaal incl. BTW", value: `€ ${successOrder.totalAmount.toFixed(2)}`, price: true },
    ...(successOrder.borgsom && successOrder.borgsom > 0
      ? [{ label: "Borgsom (terugbetaalbaar)", value: `€ ${successOrder.borgsom.toFixed(2)}`, borgsom: true }]
      : []),
  ];

  return (
    <motion.div
      key="success-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="bg-white border border-slate-200 shadow-lg max-w-xl mx-auto rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-50 to-white px-6 pt-8 pb-6 text-center border-b border-slate-100">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-600 mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-black text-slate-900">Reservering Aangevraagd</h1>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          Referentie:{" "}
          <span className="font-mono font-bold text-indigo-600">{successOrder.id}</span>
          {" — "}
          Bevestig via WhatsApp om uw betaallink te ontvangen.
        </p>
        <span className="inline-block mt-3 text-[10px] font-mono uppercase bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-bold tracking-wider">
          Nog niet bevestigd
        </span>
      </div>

      {/* Specs */}
      <div className="px-6 py-4 space-y-0 divide-y divide-slate-100">
        {specs.map((s, i) => (
          <div key={i} className="flex items-baseline justify-between py-2.5 gap-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">{s.label}</span>
            <span
              className={`text-xs font-bold text-right leading-snug ${
                (s as any).price
                  ? "text-lg font-mono text-slate-900"
                  : (s as any).borgsom
                  ? "text-amber-700 font-mono"
                  : (s as any).highlight
                  ? "text-indigo-700"
                  : "text-slate-800"
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* WhatsApp CTA */}
      {whatsappUrl && (
        <div className="px-6 py-5 border-t border-slate-100 space-y-4">
          {/* Steps */}
          <ol className="space-y-2">
            {[
              "Klik hieronder om uw aanvraag te bevestigen via WhatsApp.",
              "U ontvangt binnen 2 uur een beveiligde iDEAL-betaallink.",
              "Na betaling is uw boeking definitief bevestigd.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                <span className="shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {/* WhatsApp button */}
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-sm transition-colors duration-200 cursor-pointer no-underline shadow-sm"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            Bevestig via WhatsApp
          </motion.a>
        </div>
      )}

      {/* Bottom actions */}
      <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => printInvoice(successOrders.length > 0 ? successOrders : successOrder, undefined, true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all duration-200 cursor-pointer"
        >
          <Download className="h-4 w-4 shrink-0" />
          Pro-forma PDF
        </button>

        <button
          onClick={() => { setStep(1); setSuccessOrder(null); setActiveTab("orders"); }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          Mijn Bestellingen
        </button>

        <button
          onClick={() => { setStep(1); setSuccessOrder(null); setActiveTab("home"); }}
          className="sm:hidden flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 text-xs font-medium transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>
      </div>
    </motion.div>
  );
}
