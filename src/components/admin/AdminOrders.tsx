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
  Briefcase
} from "lucide-react";
import { useAppStore } from "../../store/appStore";

interface AdminOrdersProps {
  key?: string;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminOrders({ onAddSystemLog, adminLanguage }: AdminOrdersProps) {
  const orders = useAppStore((state) => state.orders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // Modal and custom date proposal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(null);
  const [isProposingDate, setIsProposingDate] = useState<boolean>(false);
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const handleUpdateStatus = async (orderId: string, nextStatus: string, logMsg: string) => {
    setIsUpdatingStatus(true);
    const success = await updateOrderStatus(orderId, nextStatus);
    setIsUpdatingStatus(false);
    if (success) {
      onAddSystemLog("status", "Onur (Eigenaar)", logMsg);
      // Update local state if modal is open
      if (selectedDetailOrder && selectedDetailOrder.id === orderId) {
        setSelectedDetailOrder((prev: any) => ({ ...prev, status: nextStatus }));
      }
    }
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
      "Onur (Eigenaar)",
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

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
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
                        className="py-4 font-mono font-bold text-indigo-600 cursor-pointer hover:underline"
                        title={t("Klik om contract details in te zien", "Click to view contract details", "Sözleşme detaylarını görmek için tıklayın")}
                      >
                        {o.id}
                      </td>
                      <td 
                        onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                        className="py-4 font-medium text-slate-800 cursor-pointer"
                        title={t("Klik om klantgegevens in te zien", "Click to view customer details", "Müşteri bilgilerini görmek için tıklayın")}
                      >
                        <div className="font-bold group-hover:text-indigo-650 group-hover:text-indigo-600 transition-colors">{o.customerName}</div>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{o.customerPhone}</span>
                        <span className="block text-[9.5px] text-slate-500 truncate max-w-[120px]">{o.customerEmail}</span>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-slate-800">{o.machineName}</div>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{o.customerProfile}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-[11px] text-slate-600 block">
                          {o.deliveryType === "self_pickup" 
                            ? t("Zelf Afhalen (Gratis)", "Self Pickup (Free)", "Kendim Teslim Alacağım (Ücretsiz)") 
                            : t("Bezorgservice", "Delivery Service", "Adrese Teslimat")}
                        </span>
                        {o.deliveryAddress && (
                          <span className="block text-[9px] text-slate-500 truncate max-w-[150px] mt-0.5 leading-none" title={o.deliveryAddress}>
                            {o.deliveryAddress}
                          </span>
                        )}
                      </td>
                      <td className="py-4 whitespace-nowrap">
                        <div className="text-slate-800">{o.startDate}</div>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">({o.rentalDays}d)</span>
                      </td>
                      <td className="py-4 font-mono font-bold text-teal-600 font-mono">€ {o.totalAmount.toFixed(2)}</td>
                      <td className="py-4 text-center">
                        <div className="flex flex-col gap-1.5 justify-center items-center">
                          <span className={`inline-block text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase ${
                            o.status === "In behandeling" 
                              ? "bg-amber-400/20 text-amber-400" 
                              : o.status === "Goedgekeurd"
                                ? "bg-teal-500/20 text-teal-400"
                                : o.status === "Onderweg"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : o.status === "Geannuleerd"
                                    ? "bg-rose-500/20 text-rose-500"
                                    : "bg-slate-700/30 text-slate-400"
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

                          <div className="flex space-x-1">
                            <button
                              onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                              className="text-[9px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border-none cursor-pointer"
                            >
                              {t("Bekijken", "View", "Detaylar")}
                            </button>

                            {/* Handle action buttons */}
                            {o.status === "In behandeling" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id, 
                                  "Goedgekeurd", 
                                  `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`
                                )}
                                className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-[9px] font-black px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95 border-none"
                              >
                                {t("Accorderen", "Approve", "Onayla")}
                              </button>
                            )}
                            {o.status === "Goedgekeurd" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id, 
                                  "Onderweg", 
                                  `Chauffeur ingepland & machine onderweg: ${o.id}.`
                                )}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95 border-none"
                              >
                                {t("Versturen", "Dispatch", "Yola Çıkar")}
                              </button>
                            )}
                            {o.status === "Onderweg" && (
                              <button
                                onClick={() => handleUpdateStatus(
                                  o.id, 
                                  "Voltooid", 
                                  `Verhuurcontract succesvol afgerond: ${o.id}.`
                                )}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95 border-none"
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
                              {selectedDetailOrder.deliveryType === "self_pickup" ? "Zelf Afhalen in Vestiging" : "Bezorging door HoogwerkerHub"}
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
                        <strong className="text-slate-800">{selectedDetailOrder.machineName}</strong>
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
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0 mt-5">
                <div>
                  <span className="text-[10px] text-slate-500 block font-mono">Status: {selectedDetailOrder.status}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailOrder(null)}
                    className="px-4 py-2 hover:bg-slate-100 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer border-none"
                  >
                    Sluiten
                  </button>

                  {/* Cancel Button */}
                  {selectedDetailOrder.status !== "Geannuleerd" && selectedDetailOrder.status !== "Voltooid" && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => {
                        if (confirm("Weet u zeker dat u dit contract permanent wilt annuleren?")) {
                          handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Geannuleerd",
                            `Huurcontract permanent geannuleerd door verhuurder: ${selectedDetailOrder.id}.`
                          );
                        }
                      }}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span>Annuleren</span>
                    </button>
                  )}

                  {/* Core State actions */}
                  {selectedDetailOrder.status === "In behandeling" && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleUpdateStatus(
                        selectedDetailOrder.id,
                        "Goedgekeurd",
                        `Bestelling goedgekeurd: ${selectedDetailOrder.id} voor ${selectedDetailOrder.customerName}.`
                      )}
                      className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-black px-4.5 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none flex items-center space-x-1"
                    >
                      <Check className="h-4 w-4 shrink-0 text-slate-950" />
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
                        `Chauffeur ingepland & machine onderweg: ${selectedDetailOrder.id}.`
                      )}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4.5 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none"
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
                        `Verhuurcontract succesvol afgerond: ${selectedDetailOrder.id}.`
                      )}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4.5 py-2 rounded-lg cursor-pointer transition-transform active:scale-95 border-none"
                    >
                      Voltooien
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
