/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Phone, Mail, CheckCircle } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useLanguageStore } from "../store/languageStore";
import { getWhatsAppNumber } from "../utils/whatsapp";
import { useModalA11y } from "../hooks/useModalA11y";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (toast: { id: string; title: string; message: string; type: "info" | "success" | "warning" }) => void;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

export default function ContactModal({ isOpen, onClose, onShowToast, onAddSystemLog }: ContactModalProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const contactEmail = siteConfig.contactEmail || "info@huurgo.nl";
  const contactPhone = siteConfig.contactPhone || "+31 (0)6 11 84 88 99";
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<"ticket" | "callback">("ticket");
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto flex items-start justify-center p-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Support & contact", "Support & contact", "Destek & iletişim")}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 space-y-6 text-slate-800 animate-fade-in my-8 outline-none"
          >
            {/* Top ambient header bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-orange-400 to-amber-400" />
            
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-display uppercase tracking-wider block font-bold">{t("Klantenservice en Ondersteuning", "Customer Service & Support", "Müşteri Hizmetleri ve Destek")}</span>
                <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">{t("Support & Live Advies Center", "Support & Live Advice Center", "Destek & Canlı Danışma Merkezi")}</h3>
              </div>
              <button
                onClick={onClose}
                aria-label={t("Sluiten", "Close", "Kapat")}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Left Pane: Direct WhatsApp & Call channels */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-3">
                  <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-wider block">{t("Directe Communicatie", "Direct Communication", "Doğrudan İletişim")}</span>
                  <p className="text-[11.5px] leading-relaxed text-slate-500 font-medium">
                    {t(
                      "Heeft u direct antwoord of advies nodig over de inzetbaarheid van een hoogwerker? Start direct een gesprek of bel ons hoofdkantoor.",
                      "Need a direct answer or advice on whether a lift suits your job? Start a chat right away or call our head office.",
                      "Bir platformun işinize uygunluğu hakkında hemen cevap veya tavsiye mi istiyorsunuz? Hemen bir sohbet başlatın veya merkez ofisimizi arayın."
                    )}
                  </p>
                </div>
                
                <div className="space-y-2.5">
                  {/* WhatsApp link */}
                  <a
                    href={`https://wa.me/${getWhatsAppNumber()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center p-3 rounded-xl bg-[#25D366] text-white hover:bg-[#1da851] transition-all text-xs cursor-pointer gap-3 shadow-sm hover:shadow group text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-emerald-100 block font-bold leading-none mb-0.5 uppercase tracking-wide">{t("WhatsApp Expert", "WhatsApp Expert", "WhatsApp Uzmanı")}</span>
                      <span className="font-bold text-white text-[11.5px] block truncate">{t("Start Live Chat 💬", "Start Live Chat 💬", "Canlı Sohbeti Başlat 💬")}</span>
                    </div>
                  </a>

                  {/* Phone button */}
                  <a
                    href={`tel:${contactPhone.replace(/[\s()\-]/g, "")}`}
                    className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">{t("Bellen Regionaal", "Call Regional Office", "Bölge Ofisini Ara")}</span>
                      <span className="font-sans font-semibold text-slate-800 text-[11.5px]">{contactPhone}</span>
                    </div>
                  </a>

                  {/* Email Link */}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm text-decoration-none"
                  >
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">{t("E-mail Servicedesk", "Email Service Desk", "E-posta Destek Hattı")}</span>
                      <span className="text-slate-800 text-[11px] block break-all font-semibold truncate">{contactEmail}</span>
                    </div>
                  </a>
                </div>
              </div>

              {/* Right Pane: Tabbed forms */}
              <div className="md:col-span-7 flex flex-col space-y-3">
                {/* Tab strip */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                  {(["ticket", "callback"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer border-none ${
                        activeTab === tab
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "ticket" ? t("Supportvraag", "Support request", "Destek talebi") : t("Bel mij terug", "Call me back", "Beni geri arayın")}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === "ticket" ? (
                    <motion.form
                      key="ticket"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
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
                            title: t("Supportvraag Ontvangen", "Support Request Received", "Destek Talebi Alındı"),
                            message: language === "en"
                              ? `Dear ${name}, your question about '${topic}' is being processed. We'll be in touch within 15 minutes!`
                              : `Beste ${name}, uw vraag over '${topic}' is in behandeling. We nemen binnen 15 minuten contact op!`,
                            type: "success"
                          });
                          onAddSystemLog("system", name, `Supportvraag [${topic}]: ${message} (Contact: ${contact})`);
                        }
                      }}
                      className="flex flex-col justify-between space-y-2 flex-1"
                    >
                      <div className="space-y-2">
                        <input
                          type="text"
                          name="ticketName"
                          required
                          placeholder={t("Uw Volledige Naam (of Bedrijfsnaam)", "Your Full Name (or Company Name)", "Ad Soyad (veya Şirket Adı)")}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                        />
                        <input
                          type="text"
                          name="ticketContact"
                          required
                          placeholder={t("E-mail of telefoonnummer", "Email or phone number", "E-posta veya telefon numarası")}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                        />
                        <select
                          name="ticketTopic"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 font-semibold cursor-pointer"
                        >
                          <option value="Klantenservice">{t("Klantenservice & Hulp", "Customer Service & Help", "Müşteri Hizmetleri & Yardım")}</option>
                          <option value="Transport & Logistiek">{t("Transport & Logistieke Vraag", "Transport & Logistics Question", "Nakliye & Lojistik Sorusu")}</option>
                          <option value="Vloot & Tarieven">{t("Zakelijke Vloot Aanvraag", "Business Fleet Request", "Kurumsal Filo Talebi")}</option>
                          <option value="Overig">{t("Overig / Technisch probleem", "Other / Technical issue", "Diğer / Teknik sorun")}</option>
                        </select>
                        <textarea
                          name="ticketMsg"
                          required
                          rows={3}
                          placeholder={t("Wat is uw specifieke vraag over de inzetbaarheid van ons materieel?", "What's your specific question about our equipment's suitability?", "Ekipmanımızın uygunluğu hakkında özel sorunuz nedir?")}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 resize-none font-sans font-medium"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none flex items-center justify-center space-x-1.5"
                      >
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{t("Verstuur Bericht", "Send Message", "Mesaj Gönder")}</span>
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="callback"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const phone = formData.get("callbackPhone");
                        if (phone) {
                          onClose();
                          onShowToast({
                            id: `callback-${Date.now()}`,
                            title: t("Belaanvraag Ontvangen", "Callback Request Received", "Geri Arama Talebi Alındı"),
                            message: language === "en"
                              ? `Our logistics advisor will call you back on ${phone} within 10 minutes. Thank you!`
                              : `Onze logistieke adviseur belt u binnen 10 minuten terug op ${phone}. Hartelijk dank!`,
                            type: "success"
                          });
                          onAddSystemLog("system", "Bezoeker", `Belaanvraag geregistreerd voor nummer: ${phone} (Zoeterwoude hub).`);
                        }
                      }}
                      className="flex flex-col justify-between space-y-3 flex-1"
                    >
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {t(
                            "Liever direct spraak? Laat uw nummer achter en onze logistieke adviseur belt u terug binnen kantooruren.",
                            "Prefer to talk directly? Leave your number and our logistics advisor will call you back during office hours.",
                            "Doğrudan konuşmayı mı tercih edersiniz? Numaranızı bırakın, lojistik danışmanımız mesai saatleri içinde sizi geri arasın."
                          )}
                        </p>
                        <input
                          type="tel"
                          name="callbackPhone"
                          required
                          placeholder={t("Uw telefoonnummer (bijv. +31 6 ...)", "Your phone number (e.g. +31 6 ...)", "Telefon numaranız (örn. +90 5xx ...)")}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none"
                      >
                        {t("Bel mij terug", "Call me back", "Beni geri arayın")}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
