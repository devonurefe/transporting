/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
  Printer,
  Truck,
  Loader2,
  Bell
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { HuurGoText } from "../Header";
import { printInvoice } from "../../utils/invoice";
import { euro, formatDateNL } from "../../utils/format";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminStatusBadge from "./AdminStatusBadge";
import { OrderStatus } from "../../types";
import { getAdminAuthHeaders } from "../../utils/authHeaders";
import { showAdminToast } from "./AdminToast";

interface AdminOrdersProps {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
  statusFilter?: string[];
  onClearStatusFilter?: () => void;
}

export default function AdminOrders({ onAddSystemLog, adminLanguage, statusFilter, onClearStatusFilter }: AdminOrdersProps) {
  const orders = useAppStore((state) => state.orders);
  const ordersPage = useAppStore((state) => state.ordersPage);
  const ordersTotalPages = useAppStore((state) => state.ordersTotalPages);
  const ordersTotalCount = useAppStore((state) => state.ordersTotalCount);
  const loadMoreOrders = useAppStore((state) => state.loadMoreOrders);
  const loadAllOrders = useAppStore((state) => state.loadAllOrders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const adminUser = useAuthStore((state) => state.user);

  const [dateFilter, setDateFilter] = useState<"all" | "today" | "tomorrow" | "week">("all");
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localStatusFilter, setLocalStatusFilter] = useState<string>(
    statusFilter && statusFilter.length > 0 ? statusFilter[0] : "all"
  );

  // Sync when external statusFilter prop changes (e.g. KPI card click from dashboard)
  const statusFilterKey = statusFilter?.join(",") ?? "";
  useEffect(() => {
    if (statusFilter && statusFilter.length > 0) {
      setLocalStatusFilter(statusFilter[0]);
    } else {
      setLocalStatusFilter("all");
    }
  }, [statusFilterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () =>
    setSelectedIds(prev => prev.size === displayOrders.length && displayOrders.every(o => prev.has(o.id)) ? new Set() : new Set(displayOrders.map(o => o.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  const todayISO = new Date().toISOString().split("T")[0];
  const tomorrowISO = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();
  const weekStartISO = (() => {
    const d = new Date(); const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d.toISOString().split("T")[0];
  })();
  const weekEndISO = (() => {
    const d = new Date(); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow));
    return d.toISOString().split("T")[0];
  })();

  // Filters draaien client-side over de geladen orders. Zodra een filter
  // actief is, laden we daarom automatisch ALLE pagina's — anders zijn
  // orders buiten de eerste pagina onvindbaar voor de admin.
  const filtersActive = searchText.trim() !== "" || dateFilter !== "all" || localStatusFilter !== "all";
  const allLoaded = ordersPage >= ordersTotalPages;
  const [loadingAll, setLoadingAll] = useState(false);
  useEffect(() => {
    if (!filtersActive || allLoaded || loadingAll) return;
    let active = true;
    setLoadingAll(true);
    loadAllOrders().finally(() => { if (active) setLoadingAll(false); });
    return () => { active = false; };
  }, [filtersActive, allLoaded, loadingAll, loadAllOrders]);

  const statusFiltered = localStatusFilter !== "all"
    ? orders.filter(o => o.status === localStatusFilter)
    : orders;

  const q = searchText.trim().toLowerCase();
  const textFiltered = q
    ? statusFiltered.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerEmail || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        getBaseName(o.machineName).toLowerCase().includes(q)
      )
    : statusFiltered;

  const displayOrders = dateFilter === "today"
    ? textFiltered.filter(o => o.startDate <= todayISO && o.endDate >= todayISO)
    : dateFilter === "tomorrow"
    ? textFiltered.filter(o => o.startDate <= tomorrowISO && o.endDate >= tomorrowISO)
    : dateFilter === "week"
    ? textFiltered.filter(o => o.startDate <= weekEndISO && o.endDate >= weekStartISO)
    : textFiltered;

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // Zombie/stale pending detection. An "In behandeling" order that is unpaid
  // blocks the machine's availability indefinitely (server/routes/orders.ts only
  // excludes "Geannuleerd" from conflict checks). We don't auto-cancel — the
  // WhatsApp payment flow is manual — but we flag stale ones so an admin can act.
  const STALE_PENDING_HOURS = 48;
  const daysOpen = (o: any): number => {
    const created = new Date(o.createdAt).getTime();
    if (isNaN(created)) return 0;
    return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000));
  };
  const isStalePending = (o: any): boolean => {
    if (o.status !== "In behandeling" || o.paymentStatus === "paid") return false;
    const created = new Date(o.createdAt).getTime();
    if (isNaN(created)) return false;
    return Date.now() - created > STALE_PENDING_HOURS * 60 * 60 * 1000;
  };
  const staleCount = orders.filter(isStalePending).length;

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
      lines.push("Goed nieuws! ✅", "", `Uw boeking *${order.id}* voor de *${machine}* is goedgekeurd.`, "", "U ontvangt binnenkort de iDEAL betaallink om de huur te bevestigen.", "", "Met vriendelijke groet,", "*huurgo*");
    } else if (nextStatus === "Onderweg") {
      lines.push("Uw machine is onderweg! 🚐", "", `De *${machine}* (ref: *${order.id}*) wordt vandaag bezorgd.`, "", "De chauffeur neemt contact op bij aankomst.", "", "Met vriendelijke groet,", "*huurgo*");
    } else if (nextStatus === "Voltooid") {
      lines.push("Bedankt voor uw huur! 🦾", "", `Uw huurperiode voor de *${machine}* (ref: *${order.id}*) is afgerond.`, "", "We hopen u snel weer van dienst te zijn!", "", "*huurgo*");
    } else if (nextStatus === "Geannuleerd") {
      lines.push("Annulering bevestigd ❌", "", `Uw boeking *${order.id}* is helaas geannuleerd.`, "", "Heeft u vragen? Neem gerust contact op.", "", "*huurgo*");
    } else {
      return;
    }
    const phone = formatPhoneForWA(order.customerPhone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    // Use <a> click trick so it works even after an async await
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);
  };

  // Kant-en-klaar sjabloon om een klant te herinneren aan een nog openstaande
  // betaling — gebruikt dezelfde 48-uurstermijn die de "stale pending"-check
  // hierboven al hanteert, zodat de belofte in het bericht klopt met wat er
  // daadwerkelijk gebeurt als er niet op tijd wordt betaald.
  const sendPaymentReminder = (order: any) => {
    if (!order?.customerPhone) return;
    const machine = getBaseName(order.machineName);
    const lines = [
      "Vriendelijke herinnering ⏰",
      "",
      `We hebben nog geen betaling ontvangen voor uw boeking *${order.id}* (*${machine}*).`,
      "",
      "U kunt de betaling alsnog voldoen via de eerder verzonden betaallink.",
      "",
      `Let op: als de betaling niet binnen ${STALE_PENDING_HOURS} uur is ontvangen, wordt de boeking helaas automatisch geannuleerd.`,
      "",
      "Loopt er iets mis met de betaallink of heeft u een vraag? Neem gerust contact met ons op.",
      "",
      "Met vriendelijke groet,",
      "*huurgo*"
    ];
    const phone = formatPhoneForWA(order.customerPhone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);
    onAddSystemLog("system", adminUser?.name ?? "Admin", `Betalingsherinnering via WhatsApp gestuurd voor order ${order.id} (${order.customerName}).`);
  };

  // Modal and custom date proposal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(null);
  const [isProposingDate, setIsProposingDate] = useState<boolean>(false);
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [staleDismissed, setStaleDismissed] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  const closeModal = () => {
    setSelectedDetailOrder(null);
    setIsProposingDate(false);
    setNewStartDate("");
    setNewEndDate("");
    setStatusError(null);
  };

  const confirmCancelOrder = () => {
    if (!selectedDetailOrder) return;
    handleUpdateStatus(
      selectedDetailOrder.id,
      "Geannuleerd",
      `Huurcontract permanent geannuleerd door verhuurder: ${selectedDetailOrder.id}.`,
      selectedDetailOrder
    );
    setShowCancelConfirm(false);
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus, logMsg: string, order?: any) => {
    // Pre-validate: "Goedkeuren" requires payment marked first
    if (nextStatus === "Goedgekeurd" && order?.paymentStatus !== "paid") {
      setStatusError(t(
        "Markeer eerst de betaling als ontvangen (knop 'Betaling Ontvangen ✓') voordat u de bestelling kunt goedkeuren.",
        "Mark payment as received ('Payment Received ✓') before approving the order.",
        "'Ödeme Alındı Onay Ver' butonuna basarak ödemeyi onayladıktan sonra siparişi onaylayabilirsiniz."
      ));
      setTimeout(() => setStatusError(null), 6000);
      return;
    }

    setIsUpdatingStatus(true);
    const result = await updateOrderStatus(orderId, nextStatus);
    setIsUpdatingStatus(false);

    if (result === true) {
      onAddSystemLog("status", adminUser?.name ?? "Admin", logMsg);
      if (selectedDetailOrder && selectedDetailOrder.id === orderId) {
        setSelectedDetailOrder((prev: any) => ({ ...prev, status: nextStatus }));
      }
      // Open WA AFTER successful update (use <a> trick to minimize popup blocker)
      if (order?.customerPhone) {
        openWhatsAppToCustomer(order, nextStatus);
      }
    } else if (result) {
      // result is an error string
      setStatusError(result as string);
      setTimeout(() => setStatusError(null), 7000);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    setIsUpdatingPayment(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "PUT",
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ paymentStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        // Update Zustand store so the order list reflects the new payment status immediately
        useAppStore.setState((state: any) => ({
          orders: state.orders.map((o: any) =>
            o.id === orderId ? { ...o, paymentStatus: updated.paymentStatus } : o
          )
        }));
        onAddSystemLog("status", adminUser?.name ?? "Admin", `Betaling ${paymentStatus === "paid" ? "ontvangen" : "bijgewerkt"} voor order ${orderId}.`);
        if (selectedDetailOrder?.id === orderId) {
          setSelectedDetailOrder((prev: any) => ({ ...prev, paymentStatus: updated.paymentStatus }));
        }
      }
    } catch (e) {
      console.error("Payment status update error:", e);
      setStatusError("Betaling bijwerken mislukt. Controleer de verbinding en probeer opnieuw.");
      setTimeout(() => setStatusError(null), 6000);
    }
    setIsUpdatingPayment(false);
  };

  const handleSendDateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate) {
      showAdminToast("Voer zowel de startdatum als de einddatum in.", "error");
      return;
    }
    if (new Date(newEndDate) < new Date(newStartDate)) {
      showAdminToast("Einddatum moet op of na de startdatum liggen.", "error");
      return;
    }
    const machine = getBaseName(selectedDetailOrder.machineName);
    const lines = [
      "Goed nieuws! Wij kunnen uw reservering herplannen. 📅",
      "",
      `Bestelling: *${selectedDetailOrder.id}*`,
      `Machine: *${machine}*`,
      `Nieuwe voorsteldata: *${newStartDate} t/m ${newEndDate}*`,
      "",
      "Kunt u dit bevestigen of heeft u een andere voorkeur?",
      "",
      "Met vriendelijke groet,",
      "*huurgo*"
    ];
    if (selectedDetailOrder.customerPhone) {
      const phone = formatPhoneForWA(selectedDetailOrder.customerPhone);
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 200);
    }
    onAddSystemLog(
      "system",
      adminUser?.name ?? "Admin",
      `Datumvoorstel via WhatsApp gestuurd voor contract ${selectedDetailOrder.id} (${selectedDetailOrder.customerName}). Voorstel: ${newStartDate} t/m ${newEndDate}.`
    );
    closeModal();
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

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "all",           nl: "Alle",          en: "All",        tr: "Tümü" },
            { key: "In behandeling",nl: "In behandeling",en: "Pending",    tr: "İşlemde",   color: "amber"  },
            { key: "Goedgekeurd",   nl: "Goedgekeurd",   en: "Approved",   tr: "Onaylandı", color: "teal"   },
            { key: "Onderweg",      nl: "Onderweg",      en: "Delivery",   tr: "Yolda",     color: "blue"   },
            { key: "Voltooid",      nl: "Voltooid",      en: "Completed",  tr: "Tamamlandı",color: "slate"  },
            { key: "Geannuleerd",   nl: "Geannuleerd",   en: "Cancelled",  tr: "İptal",     color: "rose"   },
          ] as const).map((s) => {
            const label = adminLanguage === "tr" ? s.tr : adminLanguage === "en" ? s.en : s.nl;
            const isActive = localStatusFilter === s.key;
            const colorClass = isActive
              ? s.key === "all"           ? "bg-indigo-600 text-white border-indigo-700"
              : s.key === "In behandeling"? "bg-amber-500 text-white border-amber-600"
              : s.key === "Goedgekeurd"   ? "bg-teal-500 text-white border-teal-600"
              : s.key === "Onderweg"      ? "bg-blue-600 text-white border-blue-700"
              : s.key === "Voltooid"      ? "bg-slate-600 text-white border-slate-700"
              : "bg-rose-600 text-white border-rose-700"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700";
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setLocalStatusFilter(s.key); if (s.key === "all") onClearStatusFilter?.(); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border cursor-pointer shadow-sm ${colorClass}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Free-text search */}
        <div className="relative">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("Zoek op naam, e-mail, ID of machine...", "Search by name, email, ID or machine...", "Ad, e-posta, ID veya makineye göre ara...")}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:bg-white placeholder:text-slate-400"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "today", "tomorrow", "week"] as const).map((f) => {
            const label = f === "all" ? t("Alle", "All", "Tümü") : f === "today" ? t("Vandaag", "Today", "Bugün") : f === "tomorrow" ? t("Morgen", "Tomorrow", "Yarın") : t("Deze Week", "This Week", "Bu Hafta");
            return (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                  dateFilter === f
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {statusError && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3 text-xs text-rose-700 font-medium animate-fade-in">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{statusError}</span>
          </div>
        )}

        {/* Stale pending warning — unconfirmed bookings that needlessly block the agenda */}
        {staleCount > 0 && !staleDismissed && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-800 font-medium animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span className="flex-1">
              {t(
                `${staleCount} openstaande boeking(en) langer dan ${STALE_PENDING_HOURS} uur niet bevestigd en onbetaald — deze blokkeren mogelijk onnodig de agenda. Controleer of ze geannuleerd kunnen worden.`,
                `${staleCount} pending booking(s) unconfirmed and unpaid for over ${STALE_PENDING_HOURS}h — these may be needlessly blocking the calendar. Review whether they can be cancelled.`,
                `${staleCount} adet bekleyen rezervasyon ${STALE_PENDING_HOURS} saatten uzun süredir onaylanmadı ve ödenmedi — takvimi gereksiz yere bloke ediyor olabilir. İptal edilebilir mi kontrol edin.`
              )}
            </span>
            <button
              type="button"
              onClick={() => setStaleDismissed(true)}
              className="shrink-0 text-amber-500 hover:text-amber-700 bg-transparent border-none cursor-pointer p-0"
              aria-label={t("Sluiten", "Dismiss", "Kapat")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Mobile card layout */}
        <div className="md:hidden space-y-3">
          {displayOrders.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              {t("Geen contracten beschikbaar.", "No contracts available.", "Kullanılabilir sözleşme yok.")}
            </div>
          ) : (
            displayOrders.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{o.customerName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{o.id}</div>
                  </div>
                  <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} className="flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{getBaseName(o.machineName)}</span>
                  {isStalePending(o) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      <Clock className="h-2.5 w-2.5" /> {daysOpen(o)}d {t("open", "open", "açık")}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">{formatDateNL(o.startDate)} · {o.rentalDays}d</span>
                    {o.deliveryTimeSlot && o.deliveryType === "delivery_by_us" && (
                      <span className="ml-2 text-[9.5px] text-indigo-500 font-bold">
                        {o.deliveryTimeSlot === "morning" ? "Ochtend" : "Middag"}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-teal-600">{euro(o.totalAmount)}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                    className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                  >
                    {t("Beheer", "Manage", "Yönet")}
                  </button>
                  <button onClick={() => printInvoice(o, undefined, false, siteConfig)} className="text-[11px] font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer flex items-center justify-center">
                    <Printer className="h-3.5 w-3.5 text-indigo-600" />
                  </button>
                  {o.status === "In behandeling" && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, "Goedgekeurd", `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`, o)}
                      disabled={isUpdatingStatus}
                      title={o.paymentStatus !== "paid" ? t("Markeer eerst betaling als ontvangen", "Mark payment received first", "Önce ödemeyi alındı olarak işaretle") : undefined}
                      className={`flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : o.paymentStatus !== "paid" ? "bg-teal-200 text-teal-700 cursor-not-allowed opacity-60" : "bg-teal-500 hover:bg-teal-600 text-slate-950 cursor-pointer"}`}
                    >
                      {isUpdatingStatus ? "…" : t("Goedkeuren", "Approve", "Onayla")}
                    </button>
                  )}
                  {o.status === "Goedgekeurd" && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, "Onderweg", `Machine onderweg: ${o.id}.`, o)}
                      disabled={isUpdatingStatus}
                      className={`flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"}`}
                    >
                      {isUpdatingStatus ? "…" : t("Bezorgen", "Dispatch", "Yola Çıkar")}
                    </button>
                  )}
                  {o.status === "Onderweg" && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, "Voltooid", `Contract afgerond: ${o.id}.`, o)}
                      disabled={isUpdatingStatus}
                      className={`flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"}`}
                    >
                      {isUpdatingStatus ? "…" : t("Huur afronden", "Complete", "Tamamla")}
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
                <th className="pb-3.5 pr-3 w-8">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded accent-indigo-600 cursor-pointer"
                    checked={displayOrders.length > 0 && displayOrders.every(o => selectedIds.has(o.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
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
              {displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {t("Geen contracten beschikbaar in het beheerder log.", "No contracts available in the admin log.", "Yönetici kaydında kullanılabilir sözleşme bulunmamaktadır.")}
                  </td>
                </tr>
              ) : (
                displayOrders.map((o) => {
                  return (
                    <tr key={o.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(o.id) ? "bg-indigo-50/60" : ""}`}>
                      <td className="py-3 pr-3 pl-1 w-8">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded accent-indigo-600 cursor-pointer"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                        />
                      </td>
                      <td
                        onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                        className="py-3 px-3 font-mono font-bold text-indigo-600 cursor-pointer hover:underline text-xs"
                        title={t("Klik om contract details in te zien", "Click to view contract details", "Sözleşme detaylarını görmek için tıklayın")}
                      >
                        {o.id}
                        {isStalePending(o) && (
                          <span className="inline-flex items-center gap-1 ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 align-middle"
                            title={t("Onbevestigd en onbetaald — blokkeert mogelijk onnodig de agenda", "Unconfirmed and unpaid — may needlessly block the calendar", "Onaylanmadı ve ödenmedi — takvimi gereksiz bloke edebilir")}>
                            <Clock className="h-2.5 w-2.5" /> {daysOpen(o)}d
                          </span>
                        )}
                      </td>
                      <td 
                        onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                        className="py-3 px-3 font-medium text-slate-800 cursor-pointer"
                        title={t("Klik om klantgegevens in te zien", "Click to view customer details", "Müşteri bilgilerini görmek için tıklayın")}
                      >
                        <div className="font-bold text-slate-950 group-hover:text-indigo-600 transition-colors mb-1 text-xs">{o.customerName}</div>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5 leading-none">{o.customerPhone}</span>
                        <span className="block text-[10px] text-slate-400 font-sans mt-1.5 truncate max-w-[180px] leading-none" title={o.customerEmail}>{o.customerEmail}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 text-xs mb-1">{getBaseName(o.machineName)}</div>
                        <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9.5px] font-bold">{o.customerProfile}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          {o.deliveryType === "self_pickup"
                            ? t("Zelf Afhalen (Gratis)", "Self Pickup (Free)", "Kendim Teslim Alacağım (Ücretsiz)")
                            : o.deliveryType === "trailer_rental"
                            ? t("Aanhanger huren", "Trailer Rental", "Treyler ile Taşıma")
                            : t("Bezorgservice", "Delivery Service", "Adrese Teslimat")}
                        </span>
                        {o.deliveryTimeSlot && o.deliveryType === "delivery_by_us" && (
                          <span className="block text-[9.5px] text-indigo-500 font-bold mt-0.5">
                            {o.deliveryTimeSlot === "morning" ? "⏰ Ochtend 07:00–09:00" : "⏰ Middag 13:00–17:00"}
                          </span>
                        )}
                        {o.deliveryAddress && (
                          <span className="block text-[9.5px] text-slate-500 truncate max-w-[200px] mt-1 leading-tight" title={o.deliveryAddress}>
                            {o.deliveryAddress}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-800 font-semibold text-xs">{formatDateNL(o.startDate)}</div>
                        <span className="text-[10px] text-slate-500 block font-mono mt-1.5">({o.rentalDays}d)</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-teal-600 text-xs">{euro(o.totalAmount)}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col gap-2.5 justify-center items-center">
                          <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} variant="translucent" />

                          <div className="flex space-x-1.5 mt-0.5">
                            <button
                              onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                              className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-98"
                            >
                              {t("Beheer", "Manage", "Yönet")}
                            </button>
 
                            <button
                              onClick={() => printInvoice(o, undefined, false, siteConfig)}
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
                                disabled={isUpdatingStatus}
                                title={o.paymentStatus !== "paid" ? t("Markeer eerst betaling als ontvangen", "Mark payment received first", "Önce ödemeyi alındı olarak işaretle") : undefined}
                                className={`text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : o.paymentStatus !== "paid" ? "bg-teal-200 text-teal-700 cursor-not-allowed opacity-60" : "bg-teal-500 hover:bg-teal-600 text-slate-950 cursor-pointer hover:scale-[1.02] active:scale-95"}`}
                              >
                                {isUpdatingStatus ? "…" : t("Goedkeuren", "Approve", "Onayla")}
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
                                disabled={isUpdatingStatus}
                                className={`text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer hover:scale-[1.02] active:scale-95"}`}
                              >
                                {isUpdatingStatus ? "…" : t("Bezorgen", "Dispatch", "Yola Çıkar")}
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
                                disabled={isUpdatingStatus}
                                className={`text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:scale-[1.02] active:scale-95"}`}
                              >
                                {isUpdatingStatus ? "…" : t("Huur afronden", "Complete", "Tamamla")}
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

        {/* Pagination: handmatig bijladen zonder filters; met een actief
            filter laden we automatisch alles en tonen we de voortgang. */}
        {ordersPage < ordersTotalPages && !filtersActive && (
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => loadMoreOrders()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              {t("Meer laden", "Load more", "Daha fazla yükle")} ({orders.length} / {ordersTotalCount})
            </button>
          </div>
        )}
        {filtersActive && loadingAll && (
          <div className="flex items-center justify-center gap-2 pt-1 text-xs font-semibold text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("Alle bestellingen doorzoeken…", "Searching all orders…", "Tüm siparişler taranıyor…")} ({orders.length} / {ordersTotalCount})
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="bulk-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 border border-slate-700"
          >
            <span className="text-[11px] font-bold text-slate-300 shrink-0">
              {selectedIds.size} geselecteerd
            </span>
            <div className="w-px h-4 bg-slate-600 mx-1 shrink-0" />
            <button
              type="button"
              onClick={async () => {
                const targets = displayOrders.filter(o => selectedIds.has(o.id) && o.status === "In behandeling" && o.paymentStatus === "paid");
                for (const o of targets) {
                  await handleUpdateStatus(o.id, "Goedgekeurd", `Bulk goedgekeurd: ${o.id} voor ${o.customerName}.`, o);
                }
                clearSelection();
              }}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-[11px] font-black transition-colors cursor-pointer border-none shrink-0"
            >
              Goedkeuren ({displayOrders.filter(o => selectedIds.has(o.id) && o.status === "In behandeling" && o.paymentStatus === "paid").length})
            </button>
            <button
              type="button"
              onClick={async () => {
                const targets = displayOrders.filter(o => selectedIds.has(o.id) && o.paymentStatus !== "paid");
                for (const o of targets) {
                  await handleUpdatePaymentStatus(o.id, "paid");
                }
                clearSelection();
              }}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer border-none shrink-0"
            >
              Betaling ({displayOrders.filter(o => selectedIds.has(o.id) && o.paymentStatus !== "paid").length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-1 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors cursor-pointer border-none shrink-0"
              aria-label="Deselecteer alles"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY DETAILS MODAL */}
      <AnimatePresence>
        {selectedDetailOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => closeModal()}
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
                    {t("Bestelling beheren", "Manage Order", "Sipariş Yönetimi")}
                  </span>
                  <h3 className="font-display text-sm font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
                    <span className="text-slate-500 font-medium">Order</span>
                    <span className="font-mono text-indigo-600 font-bold">{selectedDetailOrder.id}</span>
                  </h3>
                </div>
                <button
                  onClick={() => closeModal()}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Body Grid */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6 scrollbar-thin">
                
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
                              {selectedDetailOrder.deliveryType === "self_pickup" ? "Zelf Afhalen in Vestiging" : <>Bezorging door <HuurGoText /></>}
                            </span>
                            {selectedDetailOrder.deliveryAddress && (
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-mono">
                                {selectedDetailOrder.deliveryAddress}
                              </p>
                            )}
                            {selectedDetailOrder.deliveryTimeSlot && selectedDetailOrder.deliveryType === "delivery_by_us" && (
                              <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                                Bezorgmoment: {selectedDetailOrder.deliveryTimeSlot === "morning" ? "Ochtend (07:00–09:00)" : "Middag (13:00–17:00)"}
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
                        <span className="font-mono">{euro(selectedDetailOrder.machinePrice)}</span>
                      </div>

                      <div className="flex justify-between items-start border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-600 shrink-0">Huurperiode:</span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-800 block">
                            {formatDateNL(selectedDetailOrder.startDate)} <span className="text-slate-400 font-normal">t/m</span> {formatDateNL(selectedDetailOrder.endDate)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">({selectedDetailOrder.rentalDays} dagen)</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-slate-500 block font-bold text-[10px] uppercase font-mono tracking-wider">Kostenopbouw:</span>
                        
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">Subtotaal ({selectedDetailOrder.rentalDays}d x €{selectedDetailOrder.machinePrice}):</span>
                          <span className="font-mono">{euro(selectedDetailOrder.subtotal)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">Transportkosten (Logistiek):</span>
                          <span className="font-mono">{euro(selectedDetailOrder.transportCost)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-600">BMWT Chauffeurskosten:</span>
                          <span className="font-mono">{euro(selectedDetailOrder.driverCost)}</span>
                        </div>

                        <div className="flex justify-between items-baseline text-[11px] border-b border-slate-200 pb-1.5">
                          <span className="text-slate-600">BTW (21%):</span>
                          <span className="font-mono text-slate-500">{euro(selectedDetailOrder.vatAmount)}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm pt-1">
                          <strong className="text-slate-800 font-extrabold">Eindtotaal:</strong>
                          <span className="font-mono text-teal-600 font-black text-base">{euro(selectedDetailOrder.totalAmount)}</span>
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
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{t("Alternatieve datum voorstellen", "Propose alternative date", "Alternatif Tarih Öner")}</span>
                    </h5>

                    <button
                      onClick={() => setIsProposingDate(!isProposingDate)}
                      className="text-[10px] font-bold text-amber-800 hover:text-amber-900 border border-amber-200 hover:bg-amber-100/50 bg-white py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {isProposingDate ? t("Sluiten", "Close", "Kapat") : t("Datum wijzigen", "Change date", "Tarihi Değiştir")}
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1 min-w-0">
                            <label className="text-[10px] text-slate-500 block font-bold">{t("Startdatum", "Start date", "Başlangıç tarihi")}</label>
                            <input
                              type="date"
                              required
                              value={newStartDate}
                              onChange={(e) => setNewStartDate(e.target.value)}
                              className="w-full min-w-0 bg-white border border-slate-200 focus:border-amber-500 rounded-lg px-2 py-2 text-sm text-slate-800 font-bold outline-none cursor-pointer shadow-sm"
                            />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <label className="text-[10px] text-slate-500 block font-bold">{t("Einddatum", "End date", "Bitiş tarihi")}</label>
                            <input
                              type="date"
                              required
                              value={newEndDate}
                              onChange={(e) => setNewEndDate(e.target.value)}
                              className="w-full min-w-0 bg-white border border-slate-200 focus:border-amber-500 rounded-lg px-2 py-2 text-sm text-slate-800 font-bold outline-none cursor-pointer shadow-sm"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] px-4 py-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer border-none"
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
                {statusError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-[11px] text-rose-700 font-medium">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                    <span>{statusError}</span>
                  </div>
                )}

                {/* Row 1: Status badge on its own line, then payment actions as
                    equally-sized full-width buttons below — stacked on mobile,
                    side by side from sm: up. Crowding these into one flex-wrap
                    row with the status pill made the wrap point unpredictable
                    on narrow phones (one button dropping alone, left-aligned,
                    a different width than everything else). */}
                <div className="flex items-center gap-2">
                  <AdminStatusBadge status={selectedDetailOrder.status} adminLanguage={adminLanguage} />
                </div>
                {selectedDetailOrder.paymentStatus !== "paid" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingPayment}
                      onClick={() => handleUpdatePaymentStatus(selectedDetailOrder.id, "paid")}
                      className={`bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold py-2.5 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${!selectedDetailOrder.customerPhone ? "sm:col-span-2" : ""}`}
                    >
                      <DollarSign className="h-3.5 w-3.5 shrink-0" />
                      <span>{t("Betaling Ontvangen ✓", "Payment Received ✓", "Ödeme Alındı Onay Ver")}</span>
                    </button>
                    {selectedDetailOrder.customerPhone && (
                      <button
                        type="button"
                        onClick={() => sendPaymentReminder(selectedDetailOrder)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold py-2.5 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Bell className="h-3.5 w-3.5 shrink-0" />
                        <span>{t("Betalingsherinnering Sturen", "Send Payment Reminder", "Ödeme Hatırlatma Gönder")}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Row 2: Primary action (forward status) — full width, dominant */}
                {selectedDetailOrder.status !== "Geannuleerd" && selectedDetailOrder.status !== "Voltooid" && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
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
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-teal-500/20"
                      >
                        <Check className="h-5 w-5 shrink-0" />
                        <span>{t("Goedkeuren", "Approve", "Onayla")}</span>
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
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-blue-500/20"
                      >
                        <Truck className="h-5 w-5 shrink-0" />
                        <span>{t("Bezorging starten", "Start delivery", "Teslimatı Başlat")}</span>
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
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-indigo-500/20"
                      >
                        <Check className="h-5 w-5 shrink-0" />
                        <span>{t("Huur afgerond", "Mark complete", "Tamamlandı")}</span>
                      </button>
                    )}

                    {/* Cancel — destructive, separated below primary */}
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full py-2 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 hover:bg-rose-50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span>{t("Bestelling annuleren", "Cancel order", "Siparişi İptal Et")}</span>
                    </button>
                  </div>
                )}

                {/* Row 3: Utility actions (print + close) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => printInvoice(selectedDetailOrder, undefined, false, siteConfig)}
                    className="flex-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("PDF / Afdruk", "PDF / Print", "PDF / Yazdır")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    {t("Sluiten", "Close", "Kapat")}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AdminConfirmDialog
        open={showCancelConfirm}
        title={t("Bestelling annuleren", "Cancel order", "Siparişi iptal et")}
        message={t("Weet u zeker dat u dit contract permanent wilt annuleren?", "Are you sure you want to permanently cancel this order?", "Bu siparişi kalıcı olarak iptal etmek istediğinizden emin misiniz?")}
        confirmLabel={t("Annuleren bevestigen", "Confirm cancellation", "İptali onayla")}
        cancelLabel={t("Terug", "Back", "Geri")}
        onConfirm={confirmCancelOrder}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </motion.div>
  );
}
