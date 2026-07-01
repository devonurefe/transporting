/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, Download, MessageCircle, ClipboardList, ArrowLeft, Copy, Check as CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { Order, UserProfile } from "../../types";
import { printInvoice } from "../../utils/invoice";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
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
  bookingError?: string | null;
}

export default function BookingSuccess({
  successOrder,
  successOrders,
  paymentGateway,
  setStep,
  setSuccessOrder,
  setActiveTab,
  currentUser,
  whatsappUrl,
  bookingError
}: BookingSuccessProps) {
  const t = useLanguageStore((state) => state.t);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  if (!successOrder) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
      <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
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

  const allOrders = successOrders.length > 0 ? successOrders : [successOrder];
  const combinedTotal = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const isMulti = allOrders.length > 1;

  const machineEntries = isMulti
    ? allOrders.map((o, i) => ({
        label: `Machine ${i + 1}`,
        value: `${o.machineName.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")} — ${o.startDate} t/m ${o.endDate}`,
        highlight: true,
      }))
    : [
        { label: t("specMachine"), value: successOrder.machineName, highlight: true },
        {
          label: t("specPeriod"),
          value: `${successOrder.startDate} t/m ${successOrder.endDate} (${successOrder.rentalDays} ${successOrder.rentalDays === 1 ? "dag" : "dagen"})`,
        },
      ];

  const specs = [
    { label: t("specRenter"), value: successOrder.customerName },
    ...machineEntries,
    {
      label: t("specCollection"),
      value: successOrder.deliveryType === "self_pickup"
        ? "Zelf ophalen (gratis)"
        : successOrder.deliveryType === "trailer_rental"
        ? "Aanhanger huren"
        : "Bezorging door ons",
    },
    ...(successOrder.deliveryType === "delivery_by_us" && successOrder.deliveryTimeSlot
      ? [{ label: "Bezorgmoment", value: successOrder.deliveryTimeSlot === "morning" ? "Ochtend (07:00–09:00)" : "Middag (13:00–17:00)" }]
      : []
    ),
    ...(successOrder.deliveryAddress ? [{ label: t("specAddress"), value: successOrder.deliveryAddress }] : []),
    { label: t("specTotal"), value: euro(combinedTotal), price: true },
  ];

  return (
    <motion.div
      key="success-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="bg-white border border-slate-200 shadow-lg max-w-xl mx-auto rounded-2xl overflow-hidden"
    >
      {bookingError && (
        <div className="flex items-start gap-3 bg-amber-50 border-b border-amber-200 px-5 py-3 text-amber-800">
          <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
          <p className="text-xs font-semibold leading-snug">{bookingError}</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-50 to-white px-6 pt-8 pb-6 text-center border-b border-slate-100">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-600 mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-black text-slate-900">{t("successTitle")}</h1>
        <div className="flex items-center justify-center gap-2 mt-2 mb-1">
          <span className="font-mono font-black text-lg text-slate-800 tracking-wider">{successOrder.id}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(successOrder.id).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
          >
            {copied ? <CheckIcon className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? "Gekopieerd!" : "Kopieer"}
          </button>
        </div>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">{t("successConfirmRef")}</p>
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
              className={`text-xs font-bold text-right leading-snug min-w-0 break-words ${
                (s as any).price
                  ? "text-lg font-mono text-slate-900"
                  : (s as any).highlight
                  ? "text-slate-700"
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

          {/* WhatsApp button — primary CTA */}
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-black text-base transition-all duration-200 cursor-pointer no-underline shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/35"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            {t("successConfirmWA")}
          </motion.a>
        </div>
      )}

      {/* Bottom actions — secondary, kept visually subdued so they don't compete with the WhatsApp CTA */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-center gap-5">
        <button
          onClick={() => printInvoice((successOrders ?? []).length > 0 ? successOrders : successOrder, undefined, true, siteConfig)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors duration-150 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          {t("successPdfBtn")}
        </button>

        <span className="text-slate-200 select-none">|</span>

        <button
          onClick={() => { setStep(1); setSuccessOrder(null); setActiveTab("orders"); }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors duration-150 cursor-pointer"
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          {t("successOrdersBtn")}
        </button>

        <span className="text-slate-200 select-none">|</span>

        <button
          onClick={() => { setStep(1); setSuccessOrder(null); setActiveTab("home"); }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors duration-150 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          Terug
        </button>
      </div>
    </motion.div>
  );
}
