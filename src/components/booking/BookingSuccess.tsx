/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, Check, Download, Lock, UserPlus } from "lucide-react";
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
        password: password,
        name: successOrder.customerName,
        phone: successOrder.customerPhone || undefined,
        profile: successOrder.customerProfile || undefined
      });
      if (success) {
        setRegisterSuccess(true);
      } else {
        const storeError = useAuthStore.getState().error;
        setRegisterError(storeError || "Registratie mislukt. Mogelijk bestaat er al een account met dit e-mailadres.");
      }
    } catch (err) {
      setRegisterError("Er is een netwerkfout opgetreden. Probeer het opnieuw.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <motion.div
      key="success-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 shadow-xl max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl space-y-6 text-center relative overflow-hidden"
    >
      {/* Green/teal glow radiant */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-emerald-50 to-transparent -z-10" />

      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm animate-bounce mb-2">
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div>
        <span className="text-xs font-mono uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-full font-extrabold tracking-wider">
          Boeking Succesvol Geregistreerd
        </span>
        <h1 className="font-display text-2xl font-black text-slate-900 mt-4">
          {paymentGateway === "whatsapp" ? "Reservering Aangevraagd!" : "Factuur & Overeenkomst Geaccordeerd!"}
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-2 max-w-md mx-auto">
          Uw hoogwerker is officieel geregistreerd onder referentienummer{" "}
          <strong className="text-indigo-600 font-mono">{successOrder?.id}</strong>.{" "}
          {paymentGateway === "whatsapp" ? (
            <span>Bevestig uw boeking via WhatsApp om uw betaallink te ontvangen.</span>
          ) : (
            <span>Inkoop-aanvraag is succesvol geregistreerd via de beveiligde <strong className="text-teal-700 uppercase">{paymentGateway} Gateway</strong>.</span>
          )}
        </p>
      </div>

      {/* Booking specifications board */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto text-xs font-semibold shadow-sm text-center">
        
        <div className="pb-2.5 border-b border-slate-200/60 space-y-0.5">
          <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Huurder</span>
          <span className="text-slate-800 font-bold text-sm block">{successOrder.customerName}</span>
        </div>

        <div className="pb-2.5 border-b border-slate-200/60 space-y-0.5">
          <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Hoogwerker Model</span>
          <span className="text-indigo-700 font-bold text-sm block">{successOrder.machineName}</span>
        </div>

        <div className="pb-2.5 border-b border-slate-200/60 space-y-0.5">
          <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Gereserveerde Periode</span>
          <span className="text-slate-800 font-bold text-sm block">
            {successOrder.startDate} t/m {successOrder.endDate} ({successOrder.rentalDays} {successOrder.rentalDays === 1 ? 'dag' : 'dagen'})
          </span>
        </div>

        <div className="pb-2.5 border-b border-slate-200/60 space-y-0.5">
          <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Logistieke Omgang</span>
          <span className="text-teal-700 font-bold text-sm block">
            {successOrder.deliveryType === "self_pickup" ? "Zelf ophalen bij de Hub" : "Transport door Hub Chauffeur"}
          </span>
        </div>

        {successOrder.deliveryAddress && (
          <div className="pb-2.5 border-b border-slate-200/60 space-y-0.5">
            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Afleveradres</span>
            <span className="text-slate-800 font-bold block leading-relaxed">{successOrder.deliveryAddress}</span>
          </div>
        )}

        <div className="pt-2.5 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-450 text-slate-400 font-bold block">Betaalbedrag</span>
          <span className="text-xl font-mono font-bold text-teal-700 block">€ {successOrder.totalAmount.toFixed(2)}</span>
        </div>

      </div>

      {whatsappUrl && (
        <div className="p-6 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border border-emerald-200 shadow-md rounded-3xl max-w-lg mx-auto text-center space-y-4 relative overflow-hidden">
          {/* Subtle green glow ornament */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
          
          <p className="text-xs text-emerald-800 font-extrabold leading-normal">
            Klik op de onderstaande knop om uw boeking te verzenden naar onze planner op WhatsApp en direct uw iDEAL betaallink te ontvangen:
          </p>
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            animate={{ 
              scale: [1, 1.02, 1],
              boxShadow: [
                "0 10px 25px -5px rgba(16, 185, 129, 0.4)",
                "0 20px 35px 5px rgba(16, 185, 129, 0.6)",
                "0 10px 25px -5px rgba(16, 185, 129, 0.4)"
              ]
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center space-x-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-black text-base px-8 py-4.5 rounded-2xl cursor-pointer border-none no-underline w-full max-w-md mx-auto shadow-xl"
          >
            <span className="relative flex h-3 w-3 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-85"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="tracking-wide">💬 Open WhatsApp & Bevestig Boeking</span>
          </motion.a>
        </div>
      )}

      {/* Action routes */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-6 border-t border-slate-200 w-full">
        <button
          onClick={() => printInvoice(successOrders.length > 0 ? successOrders : successOrder)}
          className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-teal-100 border-none"
        >
          <Download className="h-4 w-4" />
          <span>Factuur Downloaden (PDF)</span>
        </button>

        <button
          onClick={() => {
            setStep(1);
            setSuccessOrder(null);
            setActiveTab("home");
          }}
          className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all border border-slate-200 cursor-pointer shadow-sm border-none"
        >
          Terug naar Home
        </button>

        <button
          onClick={() => {
            setStep(1);
            setSuccessOrder(null);
            setActiveTab("orders");
          }}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer border-none"
        >
          Mijn Bestellingen
        </button>
      </div>
    </motion.div>
  );
}
