/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Phone, Mail, CheckCircle } from "lucide-react";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (toast: { id: string; title: string; message: string; type: "info" | "success" | "warning" }) => void;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

export default function ContactModal({ isOpen, onClose, onShowToast, onAddSystemLog }: ContactModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 space-y-6 text-slate-800 animate-fade-in my-8"
          >
            {/* Top ambient header bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-orange-400 to-amber-400" />
            
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-display uppercase tracking-wider block font-bold">Klantenservice en Ondersteuning</span>
                <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">Support & Live Advies Center</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Left Pane: Direct WhatsApp & Call channels */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-3">
                  <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-wider block">Directe Communicatie</span>
                  <p className="text-[11.5px] leading-relaxed text-slate-500 font-medium">
                    Heeft u direct antwoord of advies nodig over de inzetbaarheid van een hoogwerker? Start direct een gesprek of bel ons hoofdkantoor.
                  </p>
                </div>
                
                <div className="space-y-2.5">
                  {/* WhatsApp link */}
                  <a
                    href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_NUMBER ?? "31611848899"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-xs cursor-pointer gap-3 shadow-sm hover:shadow group text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8.5px] text-emerald-100 block font-bold leading-none mb-0.5 uppercase tracking-wide">WhatsApp Expert</span>
                      <span className="font-bold text-white text-[11.5px] block truncate">Start Live Chat 💬</span>
                    </div>
                  </a>

                  {/* Phone button */}
                  <a
                    href="tel:+31172456789"
                    className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8.5px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">Bellen Regionaal</span>
                      <span className="font-sans font-semibold text-slate-800 text-[11.5px]">+31 (0)6 11 84 88 99</span>
                    </div>
                  </a>

                  {/* Email Link */}
                  <a
                    href="mailto:mustafa@mbhoogwerkers.com"
                    className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8.5px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">E-mail Servicedesk</span>
                      <span className="text-slate-800 text-[11px] block break-all font-semibold truncate">mustafa@mbhoogwerkers.com</span>
                    </div>
                  </a>
                </div>
              </div>

              {/* Right Pane: Support Ticket Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get("ticketName") as string;
                  const contact = formData.get("ticketContact") as string;
                  const topic = formData.get("ticketTopic") as string;
                  const message = formData.get("ticketMsg") as string;
                  
                  if (name && contact && message) {
                    onClose();
                    onShowToast({
                      id: `support-${Date.now()}`,
                      title: "Supportvraag Ontvangen",
                      message: `Beste ${name}, uw vraag over '${topic}' is in behandeling. We nemen binnen 15 minuten contact op!`,
                      type: "success"
                    });
                    onAddSystemLog("system", name, `Supportvraag [${topic}]: ${message} (Contact: ${contact})`);
                  }
                }}
                className="md:col-span-7 flex flex-col justify-between space-y-3"
              >
                <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-wider block">Direct een support-vraag stellen</span>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    name="ticketName"
                    required
                    placeholder="Uw Volledige Naam (of Bedrijfsnaam)"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-440 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                  />

                  <input
                    type="text"
                    name="ticketContact"
                    required
                    placeholder="E-mail of telefoonnummer"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-440 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                  />

                  <select
                    name="ticketTopic"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 font-semibold cursor-pointer"
                  >
                    <option value="Klantenservice">Klantenservice & Hulp</option>
                    <option value="AI Advies">Hulp bij AI Adviseur</option>
                    <option value="Transport & Logistiek">Transport & Logistieke Vraag</option>
                    <option value="Vloot & Tarieven">Zakelijke Vloot Aanvraag</option>
                    <option value="Overig">Overig / Technisch probleem</option>
                  </select>

                  <textarea
                    name="ticketMsg"
                    required
                    rows={3}
                    placeholder="Wat is uw specifieke vraag over de inzetbaarheid van ons materieel?"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-440 outline-none focus:ring-1 focus:ring-slate-300 resize-none font-sans font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span>Verstuur Bericht</span>
                </button>
              </form>
            </div>

            {/* Dynamic Callback request section */}
            <div className="pt-3.5 border-t border-slate-100 space-y-3.5">
              <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest block">Liever direct telefonisch advies? Bel-mij-terug formulier:</span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const phone = formData.get("callbackPhone");
                  if (phone) {
                    onClose();
                    onShowToast({
                      id: `callback-${Date.now()}`,
                      title: "Belaanvraag Ontvangen",
                      message: `Onze logistieke adviseur belt u binnen 10 minuten terug op ${phone}. Hartelijk dank!`,
                      type: "success"
                    });
                    onAddSystemLog("system", "Bezoeker", `Belaanvraag geregistreerd voor nummer: ${phone} (Alphen aan den Rijn hub).`);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="tel"
                  name="callbackPhone"
                  required
                  placeholder="Uw telefoonnummer (bijv. +31 6 ...)"
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-440 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none"
                >
                  Bel mij terug
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
