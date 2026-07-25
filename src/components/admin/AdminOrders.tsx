/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
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
  Bell,
  Undo2,
  PlusCircle,
  Pencil,
  Send,
  Banknote,
  CreditCard,
  FileDown
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { HuurGoText } from "../Header";
import { printInvoice } from "../../utils/invoice";
import { euro, formatDateNL } from "../../utils/format";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminOrderFormModal from "./AdminOrderFormModal";
import AdminStatusBadge from "./AdminStatusBadge";
import { OrderStatus } from "../../types";
import { getAdminAuthHeaders } from "../../utils/authHeaders";
import { showAdminToast } from "./AdminToast";

interface AdminOrdersProps {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
  statusFilter?: string[];
  onClearStatusFilter?: () => void;
  // Deep-link target from AdminCustomers' order-history drill-down: jump
  // straight to this order (search filter + auto-opened detail modal).
  initialOrderId?: string | null;
}

export default function AdminOrders({ onAddSystemLog, adminLanguage, statusFilter, onClearStatusFilter, initialOrderId }: AdminOrdersProps) {
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
  // Betaalstatus is een aparte as dan de status-chips hierboven: "Onaylandı"/"Yolda"/
  // "Tamamlandı" zijn per definitie altijd betaald (de "Goedkeuren"-gate laat niets
  // anders toe), dus dit filter is vrijwel alleen zinvol binnen "İşlemde" — maar we
  // houden 'm globaal zodat een enkele onbetaalde uitzondering elders (bv. een
  // geannuleerde order die nooit betaald is) ook vindbaar blijft.
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "awaiting">("all");
  const [searchText, setSearchText] = useState(initialOrderId ?? "");
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

  // Sync when the initialOrderId prop changes (deep-link from AdminCustomers'
  // order-history drill-down).
  useEffect(() => {
    if (initialOrderId) setSearchText(initialOrderId);
  }, [initialOrderId]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () =>
    setSelectedIds(prev => prev.size === displayOrders.length && displayOrders.every(o => prev.has(o.id)) ? new Set() : new Set(displayOrders.map(o => o.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  const todayISO = new Date().toISOString().split("T")[0];
  // "Onderweg" past its endDate — still with the customer, expected back already.
  // See docs/admin-platform-audit-2026-07.md §3/§14 (overdue detection).
  const isOverdue = (o: any) => o.status === "Onderweg" && o.endDate < todayISO;
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
  const filtersActive = searchText.trim() !== "" || dateFilter !== "all" || localStatusFilter !== "all" || paymentFilter !== "all";
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

  const paymentFiltered = paymentFilter === "all"
    ? statusFiltered
    : paymentFilter === "paid"
    ? statusFiltered.filter(o => o.paymentStatus === "paid")
    : statusFiltered.filter(o => o.paymentStatus === "awaiting");

  const q = searchText.trim().toLowerCase();
  const textFiltered = q
    ? paymentFiltered.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerEmail || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        getBaseName(o.machineName).toLowerCase().includes(q)
      )
    : paymentFiltered;

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
    // Een "op locatie"-order is per definitie nog niet betaald tot ophalen/levering;
    // die als "onbetaald blijft hangen" markeren is ruis, geen signaal.
    if (o.paymentMethod === "on_location") return false;
    const created = new Date(o.createdAt).getTime();
    if (isNaN(created)) return false;
    return Date.now() - created > STALE_PENDING_HOURS * 60 * 60 * 1000;
  };
  const staleCount = orders.filter(isStalePending).length;

  // Spiegelt de server-side goedkeurgate (PUT /:id/status): vooruitbetaling is
  // verplicht, behalve bij "betalen op locatie" — die klant betaalt pas bij
  // ophalen/levering, dus daar is "nog niet betaald" geen blokkade.
  const canApprove = (o: any): boolean =>
    o?.paymentStatus === "paid" || o?.paymentMethod === "on_location";

  // Spiegelt de server-side guard op GET /:id/export/ubl: een UBL-bestand is een
  // formeel e-factuurdocument, dat mag nooit voor een nog niet goedgekeurd
  // verzoek of een geannuleerde order — er is dan niets (bevestigds) te factureren.
  const canExportUbl = (o: any): boolean =>
    o?.status !== "In behandeling" && o?.status !== "Geannuleerd";

  // Een geannuleerde order die nog als "paid" geregistreerd staat, is geld dat
  // administratief nog moet worden teruggestort (de "Terugstorting registreren"-
  // knop) — makkelijk te vergeten omdat annuleren zelf de betaalstatus niet
  // aanpast. Persistente badge in plaats van alleen de eenmalige waarschuwing in
  // de annuleer-confirmatie, zodat dit niet stilletjes blijft liggen.
  const needsRefund = (o: any): boolean =>
    o?.status === "Geannuleerd" && o?.paymentStatus === "paid";
  const refundPendingCount = orders.filter(needsRefund).length;

  // "Betalingsherinnering Sturen" heeft geen zin op een order die net geplaatst is
  // — er is nog niets om aan te herinneren. Zelfde 24-uursdrempel als de
  // automatische betaalherinnering in de cron (server/routes/orders.ts
  // send-reminders, dayAgo = 24u): de handmatige knop verschijnt pas op het
  // moment dat het systeem zelf ook een herinnering zou overwegen, in plaats van
  // vanaf minuut nul naast "Betaallink sturen" te staan.
  const REMINDER_ELIGIBLE_HOURS = 24;
  const canRemindPayment = (o: any): boolean => {
    const created = new Date(o?.createdAt).getTime();
    if (isNaN(created)) return false;
    return Date.now() - created > REMINDER_ELIGIBLE_HOURS * 60 * 60 * 1000;
  };

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
      lines.push("Goed nieuws! ✅", "", `Uw boeking *${order.id}* voor de *${machine}* is goedgekeurd.`, "", "Uw betaling is ontvangen en de machine staat voor u gereserveerd.", "", "Met vriendelijke groet,", "*huurgo*");
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
  // betaling. Twee varianten, want het bericht moet kloppen met de gekozen
  // betaalwijze: bij "op locatie" is er nooit een betaallink verstuurd én wordt
  // de order niet automatisch geannuleerd (zie de cron in server/routes/orders.ts),
  // dus dan zou de link-tekst naar iets verwijzen dat niet bestaat en zou de
  // 48-uursdreiging een loze belofte zijn. De link-variant gebruikt wél dezelfde
  // 48-uurstermijn die de "stale pending"-check en de auto-annulering hanteren.
  const sendPaymentReminder = (order: any) => {
    if (!order?.customerPhone) return;
    const machine = getBaseName(order.machineName);
    const onLocation = order.paymentMethod === "on_location";
    const lines = onLocation ? [
      "Vriendelijke herinnering ⏰",
      "",
      `Voor uw boeking *${order.id}* (*${machine}*) staat de betaling nog open.`,
      "",
      "U kunt dit bedrag voldoen op locatie bij ophalen of levering (pin of contant).",
      "",
      "Heeft u een vraag of wilt u toch liever vooraf betalen? Neem gerust contact met ons op.",
      "",
      "Met vriendelijke groet,",
      "*huurgo*"
    ] : [
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

  // Kant-en-klaar sjabloon om de klant een betaallink te sturen. De admin plakt de
  // daadwerkelijke iDEAL/Tikkie-link op de gemarkeerde plek voordat het bericht wordt
  // verzonden (of Mollie heeft 'm al automatisch ingevuld). De 48-uurstermijn komt
  // overeen met de "stale pending"-check hierboven, zodat de belofte in het bericht
  // klopt met wat er gebeurt als er niet op tijd wordt betaald.
  // Bewust GEEN "is bevestigd/goedgekeurd" taal hier — de order is op dit punt nog
  // "In behandeling", niet goedgekeurd. Die belofte hoort bij de aparte "Goedgekeurd"
  // WhatsApp (openWhatsAppToCustomer hierboven), die pas verstuurd wordt zodra de admin
  // écht op "Onayla" drukt. Vóór deze fix beloofden beide berichten een bevestiging,
  // wat voor de klant als tegenstrijdig/dubbelop overkwam (zie ook 2026-07 audit).
  // Puur een WhatsApp-bericht — er wordt geen status of e-mail gewijzigd.
  const sendPaymentLink = (order: any) => {
    if (!order?.customerPhone) return;
    const machine = getBaseName(order.machineName);
    const lines = [
      `Beste ${order.customerName},`,
      "",
      `Bedankt voor uw aanvraag *${order.id}* voor de *${machine}*!`,
      "",
      "Om uw reservering te bevestigen, rondt u de betaling af via onderstaande link:",
      // Echte Mollie-link zodra beschikbaar (meestal binnen enkele seconden na het
      // plaatsen van de bestelling); anders de placeholder die de admin zelf invult —
      // dekt legacy orders en het geval dat MOLLIE_API_KEY niet ingesteld is.
      order.mollieCheckoutUrl || "[PLAK HIER DE BETAALLINK]",
      "",
      `Let op: als de betaling niet binnen ${STALE_PENDING_HOURS} uur is voldaan, vervalt de aanvraag automatisch.`,
      "",
      "Heeft u een andere betaalwens? Laat het ons gerust weten.",
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
    onAddSystemLog("system", adminUser?.name ?? "Admin", `Betaallink via WhatsApp gestuurd voor order ${order.id} (${order.customerName}).`);
  };

  // "Exact" export — downloads a UBL 2.1 e-invoice XML for this order, the
  // standard NL/EU e-factuur format Exact Online (and most other accounting
  // packages) can import directly as a purchase invoice. See CLAUDE.md
  // "Exact accounting export" — this is the file-based Stage 1, no direct
  // Exact API/OAuth connection yet.
  const [exportingUblId, setExportingUblId] = useState<string | null>(null);
  const handleExportUbl = async (order: any) => {
    setExportingUblId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/export/ubl`, { headers: getAdminAuthHeaders() });
      if (!res.ok) {
        showAdminToast(t("Exact-export mislukt.", "Exact export failed.", "Exact dışa aktarma başarısız."), "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(order.invoiceNumber || order.id).replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}-ubl.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onAddSystemLog("system", adminUser?.name ?? "Admin", `Factuur geëxporteerd naar Exact (UBL) voor order ${order.id} (${order.customerName}).`);
    } catch {
      showAdminToast(t("Exact-export mislukt. Controleer de verbinding.", "Exact export failed. Check your connection.", "Exact dışa aktarma başarısız. Bağlantınızı kontrol edin."), "error");
    } finally {
      setExportingUblId(null);
    }
  };

  // Modal and custom date proposal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(null);
  const [isProposingDate, setIsProposingDate] = useState<boolean>(false);

  // Auto-open the deep-linked order's detail modal once it's loaded (the
  // search-text filter above only narrows the list — this is what makes the
  // link land "birebir" on the exact order instead of just a filtered list).
  // Guarded by a ref so it only fires once per initialOrderId — otherwise the
  // admin closing the modal manually while orders keeps refreshing would pop
  // it back open every time the polled order list updates.
  const autoOpenedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialOrderId || autoOpenedForRef.current === initialOrderId) return;
    const match = orders.find(o => o.id === initialOrderId);
    if (match) {
      setSelectedDetailOrder(match);
      setIsProposingDate(false);
      autoOpenedForRef.current = initialOrderId;
    }
  }, [initialOrderId, orders]);
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [staleDismissed, setStaleDismissed] = useState<boolean>(false);
  const [refundBannerDismissed, setRefundBannerDismissed] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  // Damage-report inline form (shown from the "Retour" step — see reportOrderDamage in appStore)
  const reportOrderDamage = useAppStore((state) => state.reportOrderDamage);
  const [showDamageForm, setShowDamageForm] = useState<boolean>(false);
  const [damageDescription, setDamageDescription] = useState<string>("");
  const [damageRepairCost, setDamageRepairCost] = useState<string>("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const [isSubmittingDamage, setIsSubmittingDamage] = useState<boolean>(false);
  const [damageError, setDamageError] = useState<string | null>(null);

  const MAX_DAMAGE_PHOTOS = 6;
  const handleDamagePhotoUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, MAX_DAMAGE_PHOTOS - damagePhotos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setDamagePhotos(prev => prev.length < MAX_DAMAGE_PHOTOS ? [...prev, reader.result as string] : prev);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const closeDamageForm = () => {
    setShowDamageForm(false);
    setDamageDescription("");
    setDamageRepairCost("");
    setDamagePhotos([]);
    setDamageError(null);
  };

  const submitDamageReport = async () => {
    if (!selectedDetailOrder) return;
    if (!damageDescription.trim()) {
      setDamageError(t("Omschrijving is verplicht.", "Description is required.", "Açıklama zorunludur."));
      return;
    }
    setIsSubmittingDamage(true);
    setDamageError(null);
    const result = await reportOrderDamage(selectedDetailOrder.id, {
      description: damageDescription.trim(),
      photos: damagePhotos,
      repairCost: damageRepairCost ? Number(damageRepairCost) : undefined
    });
    setIsSubmittingDamage(false);
    if (result === true) {
      onAddSystemLog("status", adminUser?.name ?? "Admin", `Schade gemeld voor bestelling ${selectedDetailOrder.id}: ${damageDescription.trim().slice(0, 80)}`);
      setSelectedDetailOrder((prev: any) => prev ? { ...prev, status: "Schade gemeld" } : prev);
      closeDamageForm();
    } else {
      setDamageError(result);
    }
  };

  const confirmRefundOrder = () => {
    if (!selectedDetailOrder) return;
    handleUpdatePaymentStatus(selectedDetailOrder.id, "refunded");
    setShowRefundConfirm(false);
  };

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
    // Pre-validate: "Goedkeuren" requires payment marked first (behalve op locatie)
    if (nextStatus === "Goedgekeurd" && !canApprove(order)) {
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

  const handleSendDateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate) {
      showAdminToast("Voer zowel de startdatum als de einddatum in.", "error");
      return;
    }
    if (new Date(newEndDate) < new Date(newStartDate)) {
      showAdminToast("Einddatum moet op of na de startdatum liggen.", "error");
      return;
    }
    // Persist the proposal so it's visible on the order afterwards (follow-up).
    // Non-blocking for the WhatsApp step: if saving fails we still let the admin
    // send the message, but we warn them the follow-up flag wasn't stored.
    try {
      const res = await fetch(`/api/orders/${selectedDetailOrder.id}/date-proposal`, {
        method: "PUT",
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ proposedStartDate: newStartDate, proposedEndDate: newEndDate })
      });
      if (res.ok) {
        const updated = await res.json();
        useAppStore.setState((state: any) => ({
          orders: state.orders.map((o: any) =>
            o.id === selectedDetailOrder.id
              ? { ...o, proposedStartDate: updated.proposedStartDate, proposedEndDate: updated.proposedEndDate, proposedAt: updated.proposedAt }
              : o
          )
        }));
      } else {
        showAdminToast("Voorstel kon niet worden opgeslagen, maar u kunt het bericht wel versturen.", "error");
      }
    } catch {
      showAdminToast("Voorstel kon niet worden opgeslagen, maar u kunt het bericht wel versturen.", "error");
    }
    const machine = getBaseName(selectedDetailOrder.machineName);
    const lines = [
      `Beste *${selectedDetailOrder.customerName}*`,
      "",
      "Goed nieuws!",
      "Wij kunnen uw reservering herplannen. 📅",
      "",
      `Bestelling: *${selectedDetailOrder.id}*`,
      `Machine: *${machine}*`,
      `Nieuwe voorsteldata: *${newStartDate} t/m ${newEndDate}*`,
      "",
      "Kunt u dit bevestigen of heeft u een andere voorkeur?",
      "",
      "Met vriendelijke groet,",
      "*HuurGo Team*"
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

  // Clear a stored date proposal once the customer has responded / it's resolved.
  const handleClearDateProposal = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/date-proposal`, {
        method: "PUT",
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ proposedStartDate: null, proposedEndDate: null })
      });
      if (res.ok) {
        useAppStore.setState((state: any) => ({
          orders: state.orders.map((o: any) =>
            o.id === orderId ? { ...o, proposedStartDate: null, proposedEndDate: null, proposedAt: null } : o
          )
        }));
        if (selectedDetailOrder?.id === orderId) {
          setSelectedDetailOrder((prev: any) => prev ? { ...prev, proposedStartDate: null, proposedEndDate: null, proposedAt: null } : prev);
        }
      } else {
        showAdminToast("Voorstel wissen mislukt.", "error");
      }
    } catch {
      showAdminToast("Voorstel wissen mislukt.", "error");
    }
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
        <div className="border-b border-slate-200 pb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Alle Actieve & Historische Contracten", "All Active & Historical Contracts", "Tüm Aktif ve Geçmiş Sözleşmeler")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("Hier accordeert u inkomende reserveringen en past u de logistieke status aan van klanten.", "Here you approve incoming reservations and adjust the logistics status.", "Buradan gelen rezervasyonları onaylar ve müşterilerin lojistik durumlarını düzenlersiniz.")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-3 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("Nieuwe bestelling", "New order", "Yeni sipariş")}</span>
            <span className="sm:hidden">{t("Nieuw", "New", "Yeni")}</span>
          </button>
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
            // Count per status from the loaded orders window (same scope as the list itself).
            const count = s.key === "all" ? orders.length : orders.filter(o => o.status === s.key).length;
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
                {label} <span className={`ml-0.5 tabular-nums ${isActive ? "opacity-90" : "opacity-60"}`}>({count})</span>
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

        {/* Payment-status filter — a separate axis from the status chips above:
            "Onaylandı"/"Yolda"/"Tamamlandı" are by definition always paid (the
            "Goedkeuren"-gate enforces it), so this mostly matters inside "İşlemde"
            (which orders are ready to approve vs. still waiting on the customer).
            Kept as its own slim row rather than a 7th status chip so the main
            row never wraps to a 3rd line. Counts reflect the active status filter. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "all",      nl: "Alle betalingen", en: "All payments",   tr: "Tüm ödemeler" },
            { key: "paid",     nl: "Betaald",          en: "Paid",          tr: "Ödendi" },
            { key: "awaiting", nl: "In afwachting",    en: "Awaiting",      tr: "Ödeme Bekliyor" },
          ] as const).map((f) => {
            const label = adminLanguage === "tr" ? f.tr : adminLanguage === "en" ? f.en : f.nl;
            const count = f.key === "all" ? statusFiltered.length : statusFiltered.filter(o => o.paymentStatus === f.key).length;
            const isActive = paymentFilter === f.key;
            const colorClass = isActive
              ? f.key === "paid" ? "bg-emerald-500 text-white border-emerald-600"
              : f.key === "awaiting" ? "bg-amber-500 text-white border-amber-600"
              : "bg-slate-700 text-white border-slate-800"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700";
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setPaymentFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border cursor-pointer shadow-sm ${colorClass}`}
              >
                {label} <span className={`ml-0.5 tabular-nums ${isActive ? "opacity-90" : "opacity-60"}`}>({count})</span>
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

        {/* Refund pending — cancelling an order never touches paymentStatus, so a
            paid-then-cancelled order is easy to lose track of until someone
            manually clicks "Terugstorting registreren". */}
        {refundPendingCount > 0 && !refundBannerDismissed && (
          <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3.5 py-3 text-xs text-violet-800 font-medium animate-fade-in">
            <Undo2 className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
            <span className="flex-1">
              {t(
                `${refundPendingCount} geannuleerde bestelling(en) staan nog als "betaald" — registreer de terugstorting zodra het bedrag daadwerkelijk is teruggeboekt.`,
                `${refundPendingCount} cancelled order(s) still show as "paid" — register the refund once the amount has actually been sent back.`,
                `${refundPendingCount} adet iptal edilmiş sipariş hâlâ "ödendi" görünüyor — tutarı gerçekten iade ettiğinizde iadeyi kaydedin.`
              )}
            </span>
            <button
              type="button"
              onClick={() => setRefundBannerDismissed(true)}
              className="shrink-0 text-violet-500 hover:text-violet-700 bg-transparent border-none cursor-pointer p-0"
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
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <AdminStatusBadge status={o.status} adminLanguage={adminLanguage} />
                    {isOverdue(o) && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                        {t("Te laat", "Overdue", "Gecikmiş")}
                      </span>
                    )}
                    {needsRefund(o) && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                        {t("Terugstorting open", "Refund pending", "İade Bekliyor")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{getBaseName(o.machineName)}</span>
                  {isStalePending(o) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      <Clock className="h-2.5 w-2.5" /> {daysOpen(o)}d {t("open", "open", "açık")}
                    </span>
                  )}
                  {o.proposedStartDate && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      📅 {t("Voorstel", "Proposal", "Öneri")}
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
                  <button onClick={() => printInvoice(o, undefined, o.status === "In behandeling", siteConfig)} className="text-[11px] font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer flex items-center justify-center">
                    <Printer className="h-3.5 w-3.5 text-indigo-600" />
                  </button>
                  {canExportUbl(o) && (
                    <button
                      onClick={() => handleExportUbl(o)}
                      disabled={exportingUblId === o.id}
                      title={t("Exporteer naar Exact (UBL)", "Export to Exact (UBL)", "Exact'a aktar (UBL)")}
                      className="text-[11px] font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer flex items-center justify-center disabled:opacity-50"
                    >
                      {exportingUblId === o.id ? <Loader2 className="h-3.5 w-3.5 text-emerald-600 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-emerald-600" />}
                    </button>
                  )}
                  {o.status === "In behandeling" && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, "Goedgekeurd", `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`, o)}
                      disabled={isUpdatingStatus}
                      title={!canApprove(o) ? t("Markeer eerst betaling als ontvangen", "Mark payment received first", "Önce ödemeyi alındı olarak işaretle") : undefined}
                      className={`flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : !canApprove(o) ? "bg-teal-200 text-teal-700 cursor-not-allowed opacity-60" : "bg-teal-500 hover:bg-teal-600 text-slate-950 cursor-pointer"}`}
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
                      onClick={() => handleUpdateStatus(o.id, "Retour", `Machine terug ontvangen, controle vereist: ${o.id}.`, o)}
                      disabled={isUpdatingStatus}
                      className={`flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"}`}
                    >
                      {isUpdatingStatus ? "…" : t("Terug ontvangen", "Mark returned", "Teslim Alındı")}
                    </button>
                  )}
                  {o.status === "Retour" && (
                    <button
                      onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                      disabled={isUpdatingStatus}
                      className="flex-1 text-[11px] font-black py-2 rounded-xl transition-colors border-none bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer"
                    >
                      {t("Controleren", "Inspect", "Kontrol et")}
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
                    className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
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
                          className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
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
                        {o.proposedStartDate && (
                          <span className="inline-flex items-center gap-1 ml-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 align-middle"
                            title={t("Openstaand datumvoorstel", "Pending date proposal", "Bekleyen tarih önerisi")}>
                            📅 {t("Voorstel", "Proposal", "Öneri")}
                          </span>
                        )}
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
                          {isOverdue(o) && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                              {t("Te laat", "Overdue", "Gecikmiş")}
                            </span>
                          )}
                          {needsRefund(o) && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                              {t("Terugstorting open", "Refund pending", "İade Bekliyor")}
                            </span>
                          )}

                          <div className="flex space-x-1.5 mt-0.5">
                            <button
                              onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                              className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-98"
                            >
                              {t("Beheer", "Manage", "Yönet")}
                            </button>
 
                            <button
                              onClick={() => printInvoice(o, undefined, o.status === "In behandeling", siteConfig)}
                              className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer flex items-center justify-center hover:scale-[1.02] active:scale-98"
                              title={t("Factuur Afdrukken", "Print Invoice", "Faturayı Yazdır")}
                            >
                              <Printer className="h-4 w-4 text-indigo-600" />
                            </button>

                            {canExportUbl(o) && (
                              <button
                                onClick={() => handleExportUbl(o)}
                                disabled={exportingUblId === o.id}
                                className="text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200/60 shadow-sm cursor-pointer flex items-center justify-center hover:scale-[1.02] active:scale-98 disabled:opacity-50"
                                title={t("Exporteer naar Exact (UBL)", "Export to Exact (UBL)", "Exact'a aktar (UBL)")}
                              >
                                {exportingUblId === o.id ? <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" /> : <FileDown className="h-4 w-4 text-emerald-600" />}
                              </button>
                            )}

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
                                title={!canApprove(o) ? t("Markeer eerst betaling als ontvangen", "Mark payment received first", "Önce ödemeyi alındı olarak işaretle") : undefined}
                                className={`text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : !canApprove(o) ? "bg-teal-200 text-teal-700 cursor-not-allowed opacity-60" : "bg-teal-500 hover:bg-teal-600 text-slate-950 cursor-pointer hover:scale-[1.02] active:scale-95"}`}
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
                                  "Retour",
                                  `Machine terug ontvangen, controle vereist: ${o.id}.`,
                                  o
                                )}
                                disabled={isUpdatingStatus}
                                className={`text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md ${isUpdatingStatus ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:scale-[1.02] active:scale-95"}`}
                              >
                                {isUpdatingStatus ? "…" : t("Terug ontvangen", "Mark returned", "Teslim Alındı")}
                              </button>
                            )}
                            {o.status === "Retour" && (
                              <button
                                onClick={() => { setSelectedDetailOrder(o); setIsProposingDate(false); }}
                                disabled={isUpdatingStatus}
                                className="text-[10px] font-black px-3.5 py-1.5 rounded-xl leading-none transition-all border-none shadow-md bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer hover:scale-[1.02] active:scale-95"
                              >
                                {t("Controleren", "Inspect", "Kontrol et")}
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
                const targets = displayOrders.filter(o => selectedIds.has(o.id) && o.status === "In behandeling" && canApprove(o));
                for (const o of targets) {
                  await handleUpdateStatus(o.id, "Goedgekeurd", `Bulk goedgekeurd: ${o.id} voor ${o.customerName}.`, o);
                }
                clearSelection();
              }}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-[11px] font-black transition-colors cursor-pointer border-none shrink-0"
            >
              Goedkeuren ({displayOrders.filter(o => selectedIds.has(o.id) && o.status === "In behandeling" && canApprove(o)).length})
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

                        <div className="border-t border-slate-200 pt-2 mt-1 space-y-1.5">
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
                          {/* Door de klant gekozen betaalwijze — bepaalt of de admin een
                              betaallink stuurt (link) of op locatie int (op locatie). */}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600">Betaalwijze:</span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${
                              selectedDetailOrder.paymentMethod === "on_location" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {selectedDetailOrder.paymentMethod === "on_location"
                                ? <><Banknote className="h-2.5 w-2.5" /> Op locatie</>
                                : <><CreditCard className="h-2.5 w-2.5" /> Betaallink</>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Date Proposal Section — collapsed to a single slim link by default.
                    This is a rare action (only used on a scheduling conflict), but the
                    full bordered panel used to always render at full height regardless
                    of state, permanently pushing every action button below it down the
                    page. Now it only expands into the full card when there's an actual
                    pending proposal to track, or the admin has opened the form. */}
                {!isProposingDate && !(selectedDetailOrder.proposedStartDate && selectedDetailOrder.proposedEndDate) ? (
                  <button
                    type="button"
                    onClick={() => setIsProposingDate(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:bg-amber-50 py-2 rounded-xl transition-colors cursor-pointer border border-dashed border-amber-200 bg-transparent"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("Alternatieve datum voorstellen", "Propose alternative date", "Alternatif Tarih Öner")}</span>
                  </button>
                ) : (
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

                  {/* Pending proposal follow-up — visible so a sent proposal is tracked */}
                  {selectedDetailOrder.proposedStartDate && selectedDetailOrder.proposedEndDate && (
                    <div className="flex items-start justify-between gap-2 bg-white border border-amber-300 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">{t("Openstaand voorstel", "Pending proposal", "Bekleyen öneri")}</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                          📅 {new Date(selectedDetailOrder.proposedStartDate).toLocaleDateString("nl-NL")} t/m {new Date(selectedDetailOrder.proposedEndDate).toLocaleDateString("nl-NL")}
                        </p>
                        {selectedDetailOrder.proposedAt && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{t("Verstuurd op", "Sent on", "Gönderildi")}: {new Date(selectedDetailOrder.proposedAt).toLocaleString("nl-NL")}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleClearDateProposal(selectedDetailOrder.id)}
                        className="shrink-0 text-[10px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 bg-white py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {t("Afgehandeld", "Resolved", "Tamamlandı")}
                      </button>
                    </div>
                  )}

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
                            {/* Icon overlay: a bare native date input renders as a blank box with
                                no placeholder/icon on iOS Safari until tapped, so it can look broken.
                                Decorative only (pointer-events-none) — the input itself is still what
                                receives the tap and opens the native picker. */}
                            <div className="relative">
                              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <input
                                type="date"
                                required
                                value={newStartDate}
                                onChange={(e) => setNewStartDate(e.target.value)}
                                className="w-full min-w-0 bg-white border border-slate-200 focus:border-amber-500 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-800 font-bold text-center outline-none cursor-pointer shadow-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-1 min-w-0">
                            <label className="text-[10px] text-slate-500 block font-bold">{t("Einddatum", "End date", "Bitiş tarihi")}</label>
                            <div className="relative">
                              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <input
                                type="date"
                                required
                                value={newEndDate}
                                onChange={(e) => setNewEndDate(e.target.value)}
                                className="w-full min-w-0 bg-white border border-slate-200 focus:border-amber-500 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-800 font-bold text-center outline-none cursor-pointer shadow-sm"
                              />
                            </div>
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
                )}

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
                  {isOverdue(selectedDetailOrder) && (
                    <span className="text-[9.5px] font-mono px-3 py-1 rounded-full font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                      {t("Te laat", "Overdue", "Gecikmiş")}
                    </span>
                  )}
                  {needsRefund(selectedDetailOrder) && (
                    <span className="text-[9.5px] font-mono px-3 py-1 rounded-full font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                      {t("Terugstorting open", "Refund pending", "İade Bekliyor")}
                    </span>
                  )}
                </div>
                {selectedDetailOrder.paymentStatus !== "paid" && (
                  <div className="space-y-2">
                    {/* Stap 1 — Betaallink sturen. Groene primaire knop bovenaan het
                        betaalblok: opent een kant-en-klaar WhatsApp-bericht met een
                        placeholder voor de link. Alleen bij een telefoonnummer én wanneer
                        de klant NIET "op locatie" heeft gekozen (dan is een link overbodig).
                        Verstuurt alleen een WhatsApp — geen status of e-mail wijzigt. */}
                    {selectedDetailOrder.customerPhone && selectedDetailOrder.paymentMethod !== "on_location" && (
                      <button
                        type="button"
                        onClick={() => sendPaymentLink(selectedDetailOrder)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold py-2.5 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm border-none"
                      >
                        <Send className="h-3.5 w-3.5 shrink-0" />
                        <span>{t("Betaallink sturen", "Send payment link", "Ödeme Linki Gönder")}</span>
                      </button>
                    )}
                    {/* Klant betaalt op locatie — dan is een betaallink niet nodig. */}
                    {selectedDetailOrder.paymentMethod === "on_location" && (
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-600">
                        <Banknote className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{t("Klant betaalt op locatie (bij ophalen/levering) — geen betaallink nodig.", "Customer pays on location (at pickup/delivery) — no payment link needed.", "Müşteri lokasyonda ödeyecek (teslim alma/teslimat) — ödeme linki gerekmez.")}</span>
                      </div>
                    )}
                    {/* Stap 2 & 3 — markeer betaling ontvangen / stuur een herinnering.
                        De herinnering verschijnt pas na 24u (canRemindPayment) — een
                        order van net geplaatst heeft nog niets om aan te herinneren,
                        en dat was hiervoor vanaf minuut nul al naast "Betaallink
                        sturen" te zien, met exact dezelfde nadruk. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isUpdatingPayment}
                        onClick={() => handleUpdatePaymentStatus(selectedDetailOrder.id, "paid")}
                        className={`bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold py-2.5 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${(!selectedDetailOrder.customerPhone || !canRemindPayment(selectedDetailOrder)) ? "sm:col-span-2" : ""}`}
                      >
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        <span>{t("Betaling Ontvangen ✓", "Payment Received ✓", "Ödeme Alındı Onay Ver")}</span>
                      </button>
                      {selectedDetailOrder.customerPhone && canRemindPayment(selectedDetailOrder) && (
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
                    {/* Verduidelijking bij "link"-orders: Mollie zet dit zelf op "paid"
                        zodra de klant betaalt (webhook) — de knop hierboven is dan een
                        handmatige uitzondering, geen verplichte volgende stap. Zonder
                        dit leest de knop als "dit moet u zelf aanklikken". */}
                    {selectedDetailOrder.paymentMethod !== "on_location" && (
                      <p className="text-[10px] text-slate-400 px-0.5">
                        {t(
                          "Wordt automatisch op \"Betaald\" gezet zodra de klant via de link betaalt — bovenstaande knop is alleen voor handmatige uitzonderingen.",
                          "Automatically flips to \"Paid\" once the customer pays via the link — the button above is only for manual exceptions.",
                          "Müşteri linkten ödediğinde otomatik olarak \"Ödendi\" olur — yukarıdaki buton sadece manuel istisnalar içindir."
                        )}
                      </p>
                    )}
                  </div>
                )}
                {/* Refund — only for a paid order. Records paymentStatus "refunded"
                    so cancelled-but-paid money is reconciled (the badge then reads
                    "Teruggestort"). Guarded behind a confirm dialog. */}
                {selectedDetailOrder.paymentStatus === "paid" && (
                  <button
                    type="button"
                    disabled={isUpdatingPayment}
                    onClick={() => setShowRefundConfirm(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold py-2.5 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Undo2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("Terugstorting registreren", "Register refund", "İade Kaydet")}</span>
                  </button>
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
                          "Retour",
                          `Machine terug ontvangen, controle vereist: ${selectedDetailOrder.id}.`,
                          selectedDetailOrder
                        )}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-indigo-500/20"
                      >
                        <Truck className="h-5 w-5 shrink-0" />
                        <span>{t("Terug ontvangen", "Mark returned", "Teslim Alındı")}</span>
                      </button>
                    )}

                    {/* Retour = physically back, unverified — admin must explicitly
                        clear it or log damage before it can reach "Voltooid".
                        See docs/admin-platform-audit-2026-07.md §3/§9. */}
                    {selectedDetailOrder.status === "Retour" && !showDamageForm && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Voltooid",
                            `Controle uitgevoerd, geen schade — huur afgerond: ${selectedDetailOrder.id}.`,
                            selectedDetailOrder
                          )}
                          className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-teal-500/20"
                        >
                          <Check className="h-5 w-5 shrink-0" />
                          <span>{t("Alles in orde — afronden", "All good — complete", "Sorun yok — tamamla")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => setShowDamageForm(true)}
                          className="w-full py-2.5 text-orange-700 hover:text-orange-800 border border-orange-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-white"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{t("Schade melden", "Report damage", "Hasar bildir")}</span>
                        </button>
                      </div>
                    )}

                    {selectedDetailOrder.status === "Retour" && showDamageForm && (
                      <div className="space-y-2.5 bg-orange-50 border border-orange-200 rounded-xl p-3">
                        <p className="text-xs font-black text-orange-800">{t("Schademelding", "Damage report", "Hasar bildirimi")}</p>
                        <textarea
                          value={damageDescription}
                          onChange={(e) => setDamageDescription(e.target.value)}
                          placeholder={t("Omschrijf de schade...", "Describe the damage...", "Hasarı açıklayın...")}
                          rows={3}
                          maxLength={2000}
                          className="w-full text-xs rounded-lg border border-orange-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <input
                          type="number"
                          min={0}
                          value={damageRepairCost}
                          onChange={(e) => setDamageRepairCost(e.target.value)}
                          placeholder={t("Geschat herstelbedrag (optioneel)", "Estimated repair cost (optional)", "Tahmini onarım bedeli (opsiyonel)")}
                          className="w-full text-xs rounded-lg border border-orange-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleDamagePhotoUpload(e.target.files)}
                          className="w-full text-[11px]"
                        />
                        {damagePhotos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {damagePhotos.map((p, i) => (
                              <img key={i} src={p} alt="" className="h-12 w-12 object-cover rounded-lg border border-orange-200" />
                            ))}
                          </div>
                        )}
                        {damageError && <p className="text-[11px] font-bold text-rose-600">{damageError}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={closeDamageForm}
                            className="flex-1 py-2 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold bg-white cursor-pointer"
                          >
                            {t("Annuleren", "Cancel", "İptal")}
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingDamage}
                            onClick={submitDamageReport}
                            className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60"
                          >
                            {isSubmittingDamage ? "…" : t("Schademelding opslaan", "Save damage report", "Hasar bildirimini kaydet")}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedDetailOrder.status === "Schade gemeld" && (
                      <div className="space-y-1.5">
                        <p className="text-[10.5px] text-slate-500 leading-snug">
                          {t(
                            "Let op: dit sluit alleen deze huur af. De machine blijft geblokkeerd tot de schademelding is opgelost in het Onderhoud & Schade-paneel.",
                            "Note: this only closes this rental. The machine stays blocked until the damage report is resolved in the Maintenance & Damage panel.",
                            "Not: bu sadece bu kirayı kapatır. Hasar bildirimi Bakım ve Hasar panelinde çözülene kadar makine bloke kalır."
                          )}
                        </p>
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleUpdateStatus(
                            selectedDetailOrder.id,
                            "Voltooid",
                            `Schade afgehandeld, huur afgerond: ${selectedDetailOrder.id}.`,
                            selectedDetailOrder
                          )}
                          className="w-full bg-slate-600 hover:bg-slate-700 text-white text-sm font-black py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] border-none flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <Check className="h-5 w-5 shrink-0" />
                          <span>{t("Huur afronden", "Close rental", "Kirayı kapat")}</span>
                        </button>
                      </div>
                    )}

                  </div>
                )}

                {/* Edit — reschedule / fix customer details / change delivery.
                    Only while the order can still change (not completed/cancelled).
                    Placed before Cancel: common/constructive action first, rare/
                    destructive one last. */}
                {selectedDetailOrder.status !== "Voltooid" && selectedDetailOrder.status !== "Geannuleerd" && (
                  <button
                    type="button"
                    onClick={() => setEditingOrder(selectedDetailOrder)}
                    className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("Bestelling bewerken", "Edit order", "Siparişi düzenle")}</span>
                  </button>
                )}

                {/* Cancel — destructive, separated below primary/edit. Only shown for
                    statuses the server actually allows to cancel
                    (VALID_STATUS_TRANSITIONS in server/routes/orders.ts:
                    In behandeling / Goedgekeurd → Geannuleerd). A dispatched
                    ("Onderweg") order can no longer be cancelled, so hiding the
                    button here prevents a guaranteed server rejection. */}
                {(selectedDetailOrder.status === "In behandeling" || selectedDetailOrder.status === "Goedgekeurd") && (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full py-2 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 hover:bg-rose-50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("Bestelling annuleren", "Cancel order", "Siparişi İptal Et")}</span>
                  </button>
                )}

                {/* Row 3: Utility actions (print + Exact export + close) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => printInvoice(selectedDetailOrder, undefined, selectedDetailOrder.status === "In behandeling", siteConfig)}
                    className="flex-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("PDF / Afdruk", "PDF / Print", "PDF / Yazdır")}</span>
                  </button>
                  {canExportUbl(selectedDetailOrder) && (
                    <button
                      type="button"
                      disabled={exportingUblId === selectedDetailOrder.id}
                      onClick={() => handleExportUbl(selectedDetailOrder)}
                      title={t(
                        "Downloadt een UBL e-factuur XML die uw klant rechtstreeks kan importeren in Exact Online (of vergelijkbare boekhoudsoftware).",
                        "Downloads a UBL e-invoice XML your customer can import directly into Exact Online (or similar accounting software).",
                        "Müşterinizin doğrudan Exact Online'a (veya benzer muhasebe yazılımına) aktarabileceği bir UBL e-fatura XML dosyası indirir."
                      )}
                      className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {exportingUblId === selectedDetailOrder.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <FileDown className="h-3.5 w-3.5 shrink-0" />}
                      <span>{t("Exporteer naar Exact", "Export to Exact", "Exact'a aktar")}</span>
                    </button>
                  )}
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
        message={
          selectedDetailOrder?.paymentStatus === "paid"
            ? t(
                "Weet u zeker dat u dit contract permanent wilt annuleren? Let op: de betaling blijft als 'Betaald' staan — registreer daarna een terugstorting om het bedrag terug te boeken.",
                "Are you sure you want to permanently cancel this order? Note: the payment stays marked 'Paid' — register a refund afterwards to reconcile the amount.",
                "Bu siparişi kalıcı olarak iptal etmek istediğinizden emin misiniz? Not: ödeme 'Ödendi' olarak kalır — tutarı geri almak için ardından iade kaydedin."
              )
            : t("Weet u zeker dat u dit contract permanent wilt annuleren?", "Are you sure you want to permanently cancel this order?", "Bu siparişi kalıcı olarak iptal etmek istediğinizden emin misiniz?")
        }
        confirmLabel={t("Annuleren bevestigen", "Confirm cancellation", "İptali onayla")}
        cancelLabel={t("Terug", "Back", "Geri")}
        onConfirm={confirmCancelOrder}
        onCancel={() => setShowCancelConfirm(false)}
      />
      <AdminConfirmDialog
        open={showRefundConfirm}
        danger={false}
        title={t("Terugstorting registreren", "Register refund", "İade kaydet")}
        message={t(
          "Markeer de betaling van deze bestelling als teruggestort? Dit past alleen de betaalstatus aan; het bedrag stort u zelf terug via uw betaalprovider.",
          "Mark this order's payment as refunded? This only updates the payment status; you refund the amount yourself via your payment provider.",
          "Bu siparişin ödemesini iade edildi olarak işaretle? Bu yalnızca ödeme durumunu günceller; tutarı kendi ödeme sağlayıcınız üzerinden iade edersiniz."
        )}
        confirmLabel={t("Terugstorting bevestigen", "Confirm refund", "İadeyi onayla")}
        cancelLabel={t("Terug", "Back", "Geri")}
        onConfirm={confirmRefundOrder}
        onCancel={() => setShowRefundConfirm(false)}
      />
      {showCreateForm && (
        <AdminOrderFormModal
          mode="create"
          adminLanguage={adminLanguage}
          onClose={() => setShowCreateForm(false)}
          onSaved={(msg) => showAdminToast(msg, "success")}
        />
      )}
      {editingOrder && (
        <AdminOrderFormModal
          mode="edit"
          order={editingOrder}
          adminLanguage={adminLanguage}
          onClose={() => setEditingOrder(null)}
          onSaved={(msg) => { showAdminToast(msg, "success"); closeModal(); }}
        />
      )}
    </motion.div>
  );
}
