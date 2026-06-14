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
import { useLanguageStore } from "../../store/languageStore";
import { euro } from "../../utils/format";

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
  const t = useLanguageStore((state) => state.t);
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  if (!successOrder) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
      <div className="h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      <p className="text-sm font-medium">Bestelling verwerken...</p>
    </div>
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setRegisterError("Wachtwoord moet minimaal 8 tekens bevatten.");
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
    { label: t("specRenter"), value: successOrder.customerName },
    { label: t("specMachine"), value: successOrder.machineName, highlight: true },
    {
      label: t("specPeriod"),
      value: `${successOrder.startDate} t/m ${successOrder.endDate} (${successOrder.rentalDays} ${successOrder.rentalDays === 1 ? "dag" : "dagen"})`,
    },
    {
      label: t("specCollection"),
      value: successOrder.deliveryType === "self_pickup"
        ? "Zelf ophalen (gratis)"
        : successOrder.deliveryType === "trailer_rental"
        ? "Aanhanger huren"
        : "Bezorging door ons",
    },
    ...(successOrder.deliveryAddress ? [{ label: t("specAddress"), value: successOrder.deliveryAddress }] : []),
    { label: t("specTotal"), value: euro(successOrder.totalAmount), price: true },
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
        <h1 className="font-display text-xl font-black text-slate-900">{t("successTitle")}</h1>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          Referentie:{" "}
          <span className="font-mono font-bold text-indigo-600">{successOrder.id}</span>
          {" — "}
          {t("successConfirmRef")}
        </p>
        <span className="inline-block mt-3 text-[10px] font-mono uppercase bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-bold tracking-wider">
          {t("successPending")}
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
            {[t("successWAStep1"), t("successWAStep2"), t("successWAStep3")].map((step, i) => (
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
            {t("successConfirmWA")}
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
          {t("successPdfBtn")}
        </button>

        <button
          onClick={() => { setStep(1); setSuccessOrder(null); setActiveTab("orders"); }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          {t("successOrdersBtn")}
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
