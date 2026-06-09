/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  ShieldAlert, 
  AlertTriangle, 
  Check, 
  DollarSign, 
  Clock,
  Briefcase,
  Printer
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { printInvoice } from "../../utils/invoice";

interface AdminOrdersProps {
  key?: string;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminOrders({ onAddSystemLog, adminLanguage }: AdminOrdersProps) {
  const orders = useAppStore((state) => state.orders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  const formatPhoneForWA = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("00")) return digits.slice(2);
    if (digits.startsWith("0")) return "31" + digits.slice(1);
    if (!digits.startsWith("31")) return "31" + digits;
    return digits;
  };

  const openWhatsAppToCustomer = (order: any, nextStatus: string) => {
    if (!order?.customerPhone) return;
    const machine = getBaseName(order.machineName);
    const lines: string[] = [];
    if (nextStatus === "Goedgekeurd") {
      lines.push("Goed nieuws! ✅", "", `Uw boeking *${order.id}* voor de *${machine}* is goedgekeurd.`, "", "U ontvangt binnenkort de iDEAL betaallink om de huur te bevestigen.", "", "Met vriendelijke groet,", "*HuurGo*");
    } else if (nextStatus === "Onderweg") {
      lines.push("Uw machine is onderweg! 🚐", "", `De *${machine}* (ref: *${order.id}*) wordt vandaag bezorgd.`, "", "De chauffeur neemt contact op bij aankomst.", "", "Met vriendelijke groet,", "*HuurGo*");
    } else if (nextStatus === "Voltooid") {
      lines.push("Bedankt voor uw huur! 🙏", "", `Uw huurperiode voor de *${machine}* (ref: *${order.id}*) is afgerond.`, "", "We hopen u snel weer van dienst te zijn!", "", "*HuurGo*");
    } else if (nextStatus === "Geannuleerd") {
      lines.push("Annulering bevestigd ❌", "", `Uw boeking *${order.id}* is helaas geannuleerd.`, "", "Heeft u vragen? Neem gerust contact op.", "", "*HuurGo*");
    } else {
      return;
    }
    const phone = formatPhoneForWA(order.customerPhone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  };

  // Modal and custom date proposal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(null);
  const [isProposingDate, setIsProposingDate] = useState<boolean>(false);
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const handleUpdateStatus = async (orderId: string, nextStatus: string, logMsg: string, order?: any) => {
    // Open WA synchronously (in click handler) to avoid popup blocker
    if (order) openWhatsAppToCustomer(order, nextStatus);
    setIsUpdatingStatus(true);
    const success = await updateOrderStatus(orderId, nextStatus);
    setIsUpdatingStatus(false);
    if (success) {
      onAddSystemLog("status", adminUser?.name ?? "Admin", logMsg);
      if (selectedDetailOrder && selectedDetailOrder.id === orderId) {
        setSelectedDetailOrder((prev: any) => ({ ...prev, status: nextStatus }));
      }
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("hwh_admin_token");
    return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  };

  const handleUpdatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    setIsUpdatingPayment(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ paymentStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        onAddSystemLog("status", adminUser?.name ?? "Admin", `Betaling ${paymentStatus === "paid" ? "ontvangen" : "bijgewerkt"} voor order ${orderId}.`);
        if (selectedDetailOrder?.id === orderId) {
          setSelectedDetailOrder((prev: any) => ({ ...prev, paymentStatus: updated.paymentStatus }));
        }
      }
    } catch (e) {
      console.error("Payment status update error:", e);
    }
    setIsUpdatingPayment(false);
  };

  const handleSendDateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate) {
      alert("Voer zowel de startdatum als de einddatum in.");
      return;
    }
    
    // Log proposal activity
    onAddSystemLog(
      "system",
      adminUser?.name ?? "Admin",
      `Nieuw datumvoorstel verzonden voor contract ${selectedDetailOrder.id} (${selectedDetailOrder.customerName}). Nieuwe data: ${newStartDate} t/m ${newEndDate}.`
    );

    alert(`Datumvoorstel (${newStartDate} t/m ${newEndDate}) is succesvol verzonden naar ${selectedDetailOrder.customerName}!`);
    setIsProposingDate(false);
    setSelectedDetailOrder(null);
  };

  return (
    <motion.div
      key="orders-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-display font-bold text-sm text-slate-900">{t("Alle Actieve & Historische Contracten", "All Active & Historical Contracts", "Tüm Aktif ve Geçmiş Sözleşmeler")}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{t("Hier accordeert u inkomende reserveringen en past u de logistieke status aan van klanten.", "Here you approve incoming reservations and adjust the logistics status.", "Buradan gelen rezervasyonları onaylar ve müşterilerin lojistik durumlarını düzenlersiniz.")}</p>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden space-y-3">
          {orders.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              {t("Geen contracten beschikbaar.", "No contracts available.", "Kullanılabilir sözleşme yok.")}
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{o.customerName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{o.id}</div>
                  </div>
                  <span className={`flex-shrink-0 text-[9px] font-mono px-2.5 py-1 rounded-full font-extrabold uppercase ${
                    o.status === "In behandeling" ? "bg-amber-100 text-amber-600 border border-amber-200"
                    : o.status === "Goedgekeurd" ? "bg-teal-100 text-teal-600 border border-teal-200"
                    : o.status === "Onderweg" ? "bg-blue-100 text-blue-600 border border-blue-200"
                    : o.status === "Geannuleerd" ? "bg-rose-100 text-rose-600 border border-rose-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {t(o.status, o.status, o.status)}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-700">{getBaseName(o.machineName)}</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{o.startDate} · {o.rentalDays}d</span>
                  <span className="font-mono font-bold text-teal-600">€ {o.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                    className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                  >
                    {t("Bekijken", "View", "Detaylar")}
                  </button>
                  <button onClick={() => printInvoice(o)} className="text-[11px] font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer flex items-center justify-center">
                    <Printer className="h-3.5 w-3.5 text-indigo-600" />
                  </button>
                  {o.status === "In behandeling" && (
                    <button onClick={() => handleUpdateStatus(o.id, "Goedgekeurd", `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`, o)}
                      className="flex-1 text-[11px] font-black py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 transition-colors cursor-pointer border-none">
                      {t("Accorderen", "Approve", "Onayla")}
                    </button>
                  )}
                  {o.status === "Goedgekeurd" && (
                    <button onClick={() => handleUpdateStatus(o.id, "Onderweg", `Machine onderweg: ${o.id}.`, o)}
                      className="flex-1 text-[11px] font-black py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer border-none">
                      {t("Versturen", "Dispatch", "Yola Çıkar")}
                    </button>
                  )}
                  {o.status === "Onderweg" && (
                    <button onClick={() => handleUpdateStatus(o.id, "Voltooid", `Contract afgerond: ${o.id}.`, o)}
                      className="flex-1 text-[11px] font-black py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer border-none">
                      {t("Voltooien", "Complete", "Tamamla")}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3.5 font-bold font-mono">ID</th>
                <th className="pb-3.5 font-bold">{t("Huurder Details", "Tenant Details", "Kiracı Bilgileri")}</th>
                <th className="pb-3.5 font-bold">{t("Besteld Object", "Ordered Item", "Kiralanan Makine")}</th>
                <th className="pb-3.5 font-bold">{t("Grote Logistiek", "Logistics", "Lojistik Tipi")}</th>
                <th className="pb-3.5 font-bold">{t("Periode", "Period", "Dönem")}</th>
                <th className="pb-3.5 font-bold">{t("Som", "Amount", "Tutar")}</th>
                <th className="pb-3.5 font-bold text-center">{t("Accordering & Acties", "Approval & Actions", "Onay & İşlemler")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {t("Geen contracten beschikbaar in het beheerder log.", "No contracts available in the admin log.", "Yönetici kaydında kullanılabilir sözleşme bulunmamaktadır.")}
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors group">
                      <td 
                        onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                        className="py-3 px-3 font-mono font-bold text-indigo-600 cursor-pointer hover:underline text-xs"
                        title={t("Klik om contract details in te zien", "Click to view contract details", "Sözleşme detaylarını görmek için tıklayın")}
                      >
                        {o.id}
                      </td>
                      <td 
                        onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                        className="py-3 px-3 font-medium text-slate-800 cursor-pointer"
                        title={t("Klik om klantgegevens in te zien", "Click to view customer details", "Müşteri bilgilerini görmek için tıklayın")}
                      >
                        <div className="font-bold text-slate-950 group-hover:text-indigo-650 group-hover:text-indigo-600 transition-colors mb-1 text-xs">{o.customerName}</div>
                        <span className="block text-[10px] text-slate-450 text-slate-500 font-mono mt-0.5 leading-none">{o.customerPhone}</span>
                        <span className="block text-[10px] text-slate-400 font-sans mt-1.5 truncate max-w-[180px] leading-none" title={o.customerEmail}>{o.customerEmail}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-850 text-slate-800 text-xs mb-1">{getBaseName(o.machineName)}</div>
                        <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9.5px] font-bold">{o.customerProfile}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          {o.deliveryType === "self_pickup" 
                            ? t("Zelf Afhalen (Gratis)", "Self Pickup (Free)", "Kendim Teslim Alacağım (Ücretsiz)") 
                            : t("Bezorgservice", "Delivery Service", "Adrese Teslimat")}
                        </span>
                        {o.deliveryAddress && (
                          <span className="block text-[9.5px] text-slate-450 text-slate-500 truncate max-w-[200px] mt-1.5 leading-tight" title={o.deliveryAddress}>
                            {o.deliveryAddress}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-850 text-slate-800 font-semibold text-xs">{o.startDate}</div>
                        <span className="text-[10px] text-slate-450 text-slate-500 block font-mono mt-1.5">({o.rentalDays}d)</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-teal-600 text-xs">€ {o.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col gap-2.5 justify-center items-center">
                          <span className={`inline-block text-[9.5px] font-mono px-3 py-1 rounded-full font-extrabold uppercase tracking-wider ${
                            o.status === "In behandeling" 
                              ? "bg-amber-400/20 text-amber-500 border border-amber-300/30" 
                              : o.status === "Goedgekeurd"
                                ? "bg-teal-500/20 text-teal-500 border border-teal-400/30"
                                : o.status === "Onderweg"
                                  ? "bg-blue-500/20 text-blue-500 border border-blue-400/30"
                                  : o.status === "Geannuleerd"
                                    ? "bg-rose-500/20 text-rose-500 border border-rose-450/30"
                                    : "bg-slate-700/30 text-slate-400 border border-slate-500/30"
                          }`}>
                            {o.status === "In behandeling" 
                              ? t("In behandeling", "Pending", "Beklemede") 
                              : o.status === "Goedgekeurd"
                                ? t("Goedgekeurd", "Approved", "Onaylandı")
                                : o.status === "Onderweg"
                                  ? t("Onderweg", "Dispatched", "Yolda")
                                  : o.status === "Geannuleerd"
                                    ? t("Geannuleerd", "Cancelled", "İptal Edildi")
                                    : t("Voltooid", "Completed", "Tamamlandı")}
                          </span>
 
                          <div className="flex space-x-1.5 mt-0.5">
                            <button
                              onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                              className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-98"
                            >
                              {t("Bekijken", "View", "Detaylar")}
                            </button>
 
                            <button
                              onClick={() => printInvoice(o)}
                              className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer flex items-center justify-center hover:scale-[1.02] active:scale-98"
                              title={t("Factuur Afdrukken", "Print Invoice", "Faturayı Yazdır")}
                            >
                              <Printer className="h-4 w-4 text-indigo-600" />
                            </button>
 
                            {/* Handle action buttons */}
                            {o.status === "In behandeling" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id,
                                  "Goedgekeurd",
                                  `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`,
                                  o
                                )}
                                className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-[10px] font-black px-3.5 py-1.5 rounded-xl cursor-pointer leading-none transition-all hover:scale-[1.02] active:scale-95 border-none shadow-md"
                              >
                                {t("Accorderen", "Approve", "Onayla")}
                              </button>
                            )}
                            {o.status === "Goedgekeurd" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id,
                                  "Onderweg",
                                  `Chauffeur ingepland & machine onderweg: ${o.id}.`,
                                  o
                                )}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3.5 py-1.5 rounded-xl cursor-pointer leading-none transition-all hover:scale-[1.02] active:scale-95 border-none shadow-md"
                              >
                                {t("Versturen", "Dispatch", "Yola Çıkar")}
                              </button>
                            )}
                            {o.status === "Onderweg" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id,
                                  "Voltooid",
                                  `Verhuurcontract succesvol afgerond: ${o.id}.`,
                                  o
                                )}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-3.5 py-1.5 rounded-xl cursor-pointer leading-none transition-all hover:scale-[1.02] active:scale-95 border-none shadow-md"
                              >
                                {t("Voltooien", "Complete", "Tamamla")}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY DETAILS MODAL */}
      <AnimatePresence>
        {selectedDetailOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailOrder(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh] text-slate-800"
            >
              {/* Top Premium Line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

              {/* Close Button & Header */}
              <div className="flex justify-between items-start mb-5 shrink-0">
                <div>
                  <span className="text-[10px] text-amber-600 font-mono uppercase tracking-widest block font-bold">
                    Contract & Huurder Audit
                  </span>
                  <h3 className="font-display text-sm font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
                    <span>Dossier:</span> 
                    <span className="font-mono text-indigo-650 text-indigo-600 font-bold">{selectedDetailOrder.id}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailOrder(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Body Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column: Customer Details */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                      <User className="h-4 w-4 text-amber-500" />
                      <span>Huurder & Contactgegevens</span>
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-24 block">Volledige Naam:</span>
                        <strong className="text-slate-800">{selectedDetailOrder.customerName}</strong>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-24 block">Telefoon:</span>
                        <a href={`tel:${selectedDetailOrder.customerPhone}`} className="text-indigo-600 font-mono font-semibold hover:underline flex items-center space-x-1">
                          <Phone className="h-3 w-3 inline" />
                          <span>{selectedDetailOrder.customerPhone}</span>
                        </a>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-24 block">E-mailadres:</span>
                        <a href={`mailto:${selectedDetailOrder.customerEmail}`} className="text-indigo-600 font-mono font-semibold hover:underline flex items-center space-x-1">
                          <Mail className="h-3 w-3 inline" />
                          <span>{selectedDetailOrder.customerEmail}</span>
                        </a>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-24 block">Beroepsprofiel:</span>
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1">
                          <Briefcase className="h-3 w-3 text-slate-500" />
                          <span>{selectedDetailOrder.customerProfile}</span>
                        </span>
                      </div>

                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <span className="text-slate-500 block font-bold text-[10px] uppercase font-mono tracking-wider">Logistieke Details:</span>
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block">
                              {selectedDetailOrder.deliveryType === "self_pickup" ? "Zelf Afhalen in Vestiging" : "Bezorging door HuurGo"}
                            </span>
                            {selectedDetailOrder.deliveryAddress && (
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-mono">
                                {selectedDetailOrder.deliveryAddress}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Order Details */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>Bestellingsinformatie</span>
                    </h4>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-600">Geselecteerd Model:</span>
                        <strong className="text-slate-800">{getBaseName(selectedDetailOrder.machineName)}</strong>
                      </div>

                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-600">Dagtarief:</span>
                        <span className="font-mono">€ {selectedDetailOrder.machinePrice.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-600">Huurperiode:</span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-800">{selectedDetailOrder.startDate}</span>
                          <span className="text-[10px] text-slate-500 block font-mono">({selectedDetailOrder.rentalDays} dagen)</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-slate-500 block font-bold text-[10px] uppercase font-mono tracking-wider">Kostenopbouw:</span>
                        
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">Subtotaal ({selectedDetailOrder.rentalDays}d x €{selectedDetailOrder.machinePrice}):</span>
                          <span className="font-mono">€ {selectedDetailOrder.subtotal.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">Transportkosten (Logistiek):</span>
                          <span className="font-mono">€ {selectedDetailOrder.transportCost.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">BMWT Chauffeurskosten:</span>
                          <span className="font-mono">€ {selectedDetailOrder.driverCost.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px] border-b border-slate-200 pb-1.5">
                          <span className="text-slate-600">BTW (21%):</span>
                          <span className="font-mono text-slate-500">€ {selectedDetailOrder.vatAmount.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm pt-1">
                          <strong className="text-slate-800 font-extrabold">Eindtotaal:</strong>
                          <span className="font-mono text-teal-600 font-black text-base">€ {selectedDetailOrder.totalAmount.toFixed(2)}</span>
                        </div>

                        <div className="border-t border-slate-200 pt-2 mt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600">Betaalstatus:</span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              selectedDetailOrder.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700"
                              : selectedDetailOrder.paymentStatus === "refunded" ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-700"
                            }`}>
                              {selectedDetailOrder.paymentStatus === "paid" ? "Betaald" : selectedDetailOrder.paymentStatus === "refunded" ? "Teruggestort" : "In Afwachting"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Date Proposal Section */}
                <div className="p-4.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Datumwijziging & Voorstellen</span>
                    </h5>
                    
                    <button
                      onClick={() => setIsProposingDate(!isProposingDate)}
                      className="text-[10px] font-bold text-amber-800 hover:text-amber-900 border border-amber-200 hover:bg-amber-100/50 bg-white py-1 px-2.5 rounded-lg transition-colors cursor-pointer border-none"
                    >
                      {isProposingDate ? "Sluiten" : "Nieuwe datum voorstellen"}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isProposingDate && (
                      <motion.form 
                        onSubmit={handleSendDateProposal}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-2.5 overflow-hidden border-t border-amber-200/50"
                      >
                        <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                          Indien de gewenste machine niet leverbaar is of de planning vol zit, kunt u hieronder een alternatieve huurperiode voorstellen aan de klant. De klant ontvangt direct een notificatie in zijn dossier.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 block font-bold">Voorgestelde Startdatum</label>
                            <input 
                              type="date"
                              required
                              value={newStartDate}
                              onChange={(e) => setNewStartDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer shadow-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 block font-bold">Voorgestelde Einddatum</label>
                            <input 
                              type="date"
                              required
                              value={newEndDate}
                              onChange={(e) => setNewEndDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer shadow-sm"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] px-4 py-2 rounded-lg shadow-sm hover:shadow active:scale-97 transition-all cursor-pointer border-none"
                          >
                            Voorstel Verzenden
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-slate-100 shrink-0 mt-5 space-y-3">

                {/* Row 1: Utility actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-mono px-2.5 py-1 rounded-full font-extrabold uppercase ${
                      selectedDetailOrder.status === "In behandeling" ? "bg-amber-100 text-amber-700"
                      : selectedDetailOrder.status === "Goedgekeurd" ? "bg-teal-100 text-teal-700"
                      : selectedDetailOrder.status === "Onderweg" ? "bg-blue-100 text-blue-700"
                      : selectedDetailOrder.status === "Geannuleerd" ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500"
                    }`}>
                      {selectedDetailOrder.status}
                    </span>
                    {selectedDetailOrder.paymentStatus !== "paid" && (
                      <button
                        type="button"
                        disabled={isUpdatingPayment}
                        onClick={() => handleUpdatePaymentStatus(selectedDetailOrder.id, "paid")}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <DollarSign className="h-3 w-3 shrink-0" />
                        <span>Betaling Ontvangen ✓</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => printInvoice(selectedDetailOrder)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                      <span>{t("Afdrukken / PDF", "Print / PDF", "Yazdır / PDF")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOrder(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer border-none"
                    >
                      Sluiten
                    </button>
                  </div>
                </div>

                {/* Row 2: Status actions */}
                {selectedDetailOrder.status !== "Geannuleerd" && selectedDetailOrder.status !== "Voltooid" && (
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => {
                        if (confirm("Weet u zeker dat u dit contract permanent wilt annuleren?")) {
                          handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Geannuleerd",
                            `Huurcontract permanent geannuleerd door verhuurder: ${selectedDetailOrder.id}.`,
                            selectedDetailOrder
                          );
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span>Annuleren</span>
                    </button>
                    <div className="flex items-center gap-2">
                      {selectedDetailOrder.status === "In behandeling" && (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Goedgekeurd",
                            `Bestelling goedgekeurd: ${selectedDetailOrder.id} voor ${selectedDetailOrder.customerName}.`,
                            selectedDetailOrder
                          )}
                          className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-black px-4 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Check className="h-4 w-4 shrink-0" />
                          <span>Accorderen</span>
                        </button>
                      )}
                      {selectedDetailOrder.status === "Goedgekeurd" && (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Onderweg",
                            `Chauffeur ingepland & machine onderweg: ${selectedDetailOrder.id}.`,
                            selectedDetailOrder
                          )}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none disabled:opacity-60"
                        >
                          Versturen
                        </button>
                      )}
                      {selectedDetailOrder.status === "Onderweg" && (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Voltooid",
                            `Verhuurcontract succesvol afgerond: ${selectedDetailOrder.id}.`,
                            selectedDetailOrder
                          )}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none disabled:opacity-60"
                        >
                          Voltooien
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
