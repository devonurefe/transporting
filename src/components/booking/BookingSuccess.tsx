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
  paymentGateway: string;
  setStep: (step: number) => void;
  setSuccessOrder: (order: Order | null) => void;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile | null;
}

export default function BookingSuccess({
  successOrder,
  paymentGateway,
  setStep,
  setSuccessOrder,
  setActiveTab,
  currentUser
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
        <span className="text-[10px] font-mono uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-extrabold tracking-wider">
          Boeking Succesvol Verwerkt
        </span>
        <h1 className="font-display text-2xl font-black text-slate-900 mt-4">
          Factuur & Overeenkomst Geaccordeerd!
        </h1>
        <p className="text-xs text-slate-650 font-medium mt-2 max-w-md mx-auto">
          Uw hoogwerker is officieel geregistreerd onder referentienummer{" "}
          <strong className="text-indigo-600 font-mono">{successOrder?.id}</strong>. Inkoop-betaling is met succes voldaan via de beveiligde <strong className="text-teal-700 uppercase">{paymentGateway} Gateway</strong>.
        </p>
      </div>

      {/* Booking specifications board */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 max-w-lg mx-auto text-xs font-semibold shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 pb-2 border-b border-slate-200/60 gap-1">
          <span>Huurder:</span>
          <span className="text-slate-800 font-bold text-left sm:text-right">{successOrder.customerName}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 pb-2 border-b border-slate-200/60 gap-1">
          <span>Hoogwerker Model:</span>
          <span className="text-indigo-700 font-bold text-left sm:text-right">{successOrder.machineName}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 pb-2 border-b border-slate-200/60 gap-1">
          <span>Gereserveerde Periode:</span>
          <span className="text-slate-800 font-bold text-left sm:text-right">{successOrder.startDate} t/m {successOrder.endDate} ({successOrder.rentalDays} {successOrder.rentalDays === 1 ? 'dag' : 'dagen'})</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 pb-2 border-b border-slate-200/60 gap-1">
          <span>Logistieke Omgang:</span>
          <span className="text-teal-700 font-bold text-left sm:text-right">
            {successOrder.deliveryType === "self_pickup" ? "Zelf ophalen bij de Hub" : "Transport door Hub Chauffeur"}
          </span>
        </div>
        {successOrder.deliveryAddress && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start text-slate-500 pb-2 border-b border-slate-200/60 gap-1">
            <span className="shrink-0">Afleveradres:</span>
            <span className="text-slate-800 text-left sm:text-right leading-snug">{successOrder.deliveryAddress}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline pt-1.5 gap-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Betaalbedrag:</span>
          <span className="text-base font-mono font-bold text-teal-700 text-left sm:text-right">€ {successOrder.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Dynamic Account Creation form for Guests */}
      {!currentUser && (
        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl text-left max-w-lg mx-auto space-y-3.5 shadow-sm">
          <div className="flex items-start space-x-2.5">
            <UserPlus className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">Direct lid worden? Sla uw gegevens op!</h4>
              <p className="text-[10.5px] text-slate-500 mt-0.5 leading-normal">
                U heeft gehuurd als gast. Stel nu een wachtwoord in om direct uw account te activeren. Hiermee kunt u de status van uw levering live volgen en facturen inzien.
              </p>
            </div>
          </div>

          {registerSuccess ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-850 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
              <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Account succesvol aangemaakt!</strong> We hebben een verificatie-e-mail verzonden naar <strong className="font-mono">{successOrder.customerEmail}</strong>. Verifieer uw e-mailadres om in te loggen.
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3 pt-1">
              {registerError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] leading-snug">
                  {registerError}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Stel een wachtwoord in..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none h-10 shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer border-none h-10 flex items-center justify-center space-x-1"
                >
                  <span>Registreren</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Action routes */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-6 border-t border-slate-200">
        <button
          onClick={() => printInvoice(successOrder)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-teal-100 border-none"
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
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer border-none"
        >
          Mijn Bestellingen
        </button>
      </div>
    </motion.div>
  );
}
