/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ArrowUpRight, Bell, Smartphone, Calendar, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { euro } from "../../utils/format";
import { getTodaysLogistics } from "../../utils/logistics";
import type { AdminSubTab } from "../AdminSection";

interface AdminDashboardProps {
  setSubTab: (tab: AdminSubTab) => void;
  setOrdersFilter?: (filter: string[]) => void;
  adminLanguage?: string;
}

export default function AdminDashboard({ setSubTab, setOrdersFilter, adminLanguage }: AdminDashboardProps) {
  const machines = useAppStore((state) => state.machines);
  const orders = useAppStore((state) => state.orders);
  const fetchOrders = useAppStore((state) => state.fetchOrders);
  const loadAllOrders = useAppStore((state) => state.loadAllOrders);
  const maintenanceEvents = useAppStore((state) => state.maintenanceEvents);
  const damageReports = useAppStore((state) => state.damageReports);
  const fetchMaintenanceEvents = useAppStore((state) => state.fetchMaintenanceEvents);
  const fetchDamageReports = useAppStore((state) => state.fetchDamageReports);
  const token = useAuthStore((state) => state.token);

  useEffect(() => { fetchMaintenanceEvents(); fetchDamageReports(); }, [fetchMaintenanceEvents, fetchDamageReports]);

  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [hoveredTrendMonth, setHoveredTrendMonth] = useState<string | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const prevOrderCount = useRef(orders.length);
  const [customerStats, setCustomerStats] = useState<{ total: number; newThisMonth: number } | null>(null);
  // Server-side aggregates over ALL orders — the order list is paginated (max 100),
  // so headline KPIs computed from the loaded window under-count at scale. Prefer
  // these when available, fall back to the store-derived numbers otherwise.
  const [orderStats, setOrderStats] = useState<{ totalRevenue: number; paidRevenue: number; activeRentals: number; pending: number; awaitingInspection: number; overdueCount: number; totalOrders: number } | null>(null);

  const refreshOrderStats = useCallback(() => {
    if (!token) return;
    fetch("/api/orders/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.totalRevenue === "number") setOrderStats(d); })
      .catch(() => {});
  }, [token]);

  const last6Months = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleDateString(adminLanguage === "tr" ? "tr-TR" : (adminLanguage === "en" ? "en-US" : "nl-NL"), { month: "short", year: "2-digit" }),
        key: `${d.getFullYear()}-${d.getMonth()}`
      });
    }
    return months;
  }, [adminLanguage]);

  const monthlyRevenue = useMemo(() => last6Months.map((m) => {
    const amount = orders.reduce((sum, order) => {
      if (order.status === "Geannuleerd") return sum;
      const orderDate = new Date(order.createdAt);
      if (orderDate.getMonth() === m.monthIndex && orderDate.getFullYear() === m.year) {
        return sum + order.totalAmount;
      }
      return sum;
    }, 0);
    return { ...m, revenue: amount };
  }), [orders, last6Months]);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };
  
  // Sums for KPI dashboards — memoized to avoid re-running on every render
  const { activeRentals, pendingRegistrations, awaitingInspection, totalEarnings, profileEarnings } = useMemo(() => ({
    activeRentals: orders.filter(o => o.status === "Goedgekeurd" || o.status === "Onderweg").length,
    pendingRegistrations: orders.filter(o => o.status === "In behandeling").length,
    awaitingInspection: orders.filter(o => o.status === "Retour" || o.status === "Schade gemeld").length,
    totalEarnings: orders.reduce((acc, o) => o.status === "Geannuleerd" ? acc : acc + o.totalAmount, 0),
    profileEarnings: orders.reduce((acc, order) => {
      if (order.status === "Geannuleerd") return acc;
      const prof = order.customerProfile || "Particulier";
      let key = "Particulier";
      if (prof.toLowerCase().includes("schilder")) key = "Schilder";
      else if (prof.toLowerCase().includes("hovenier") || prof.toLowerCase().includes("groen")) key = "Hovenier";
      else if (prof.toLowerCase().includes("glazenwasser")) key = "Glazenwasser";
      else if (prof.toLowerCase().includes("aannemer") || prof.toLowerCase().includes("bouw")) key = "Aannemer";
      acc[key] = (acc[key] || 0) + order.totalAmount;
      return acc;
    }, { Schilder: 0, Hovenier: 0, Glazenwasser: 0, Aannemer: 0, Particulier: 0 } as Record<string, number>)
  }), [orders]);

  // Effective headline KPIs: server aggregate (all orders) wins over the
  // store-derived value (loaded window only) so counts/revenue stay correct >100 orders.
  const kpiEarnings = orderStats?.totalRevenue ?? totalEarnings;
  // "Cumulatieve Omzet" below is a booked total (every non-cancelled order,
  // including still-pending "In behandeling" requests and unpaid approved
  // ones) — same definition Accounting's "Totale omzet" uses, just all-time
  // instead of date-ranged. Without also surfacing the paid portion here,
  // this card reads as "money in the bank" when it can include quotes that
  // were never paid yet — show both, same distinction Accounting already
  // makes, so the two panels never appear to disagree.
  const kpiPaidEarnings = orderStats?.paidRevenue
    ?? orders.reduce((acc, o) => (o.status !== "Geannuleerd" && o.paymentStatus === "paid" ? acc + o.totalAmount : acc), 0);
  const kpiActive = orderStats?.activeRentals ?? activeRentals;
  const kpiPending = orderStats?.pending ?? pendingRegistrations;
  const kpiAwaitingInspection = orderStats?.awaitingInspection ?? awaitingInspection;
  const kpiOverdue = orderStats?.overdueCount ?? orders.filter(o => o.status === "Onderweg" && o.endDate < new Date().toISOString().split("T")[0]).length;
  const openMaintenanceCount = maintenanceEvents.filter(e => !e.completedDate).length;
  const openDamageCount = damageReports.filter(d => !d.resolvedAt).length;

  // Today's departures/returns — same grouping AdminPlanning's day view uses
  // (src/utils/logistics.ts), so the two never disagree on what "today" means.
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todaysLogistics = useMemo(() => getTodaysLogistics(orders, todayStr), [orders, todayStr]);

  // Cancellation rate — cheap ratio over orders already loaded via loadAllOrders().
  const cancellationRate = useMemo(() => {
    if (orders.length === 0) return 0;
    return Math.round((orders.filter(o => o.status === "Geannuleerd").length / orders.length) * 100);
  }, [orders]);

  const revenueByCategory = useMemo(() => {
    const machineCategory = new Map(machines.map(m => [m.id, m.categoryLabel || m.category]));
    const acc: Record<string, number> = {};
    orders.forEach(o => {
      if (o.status === "Geannuleerd") return;
      const cat = machineCategory.get(o.machineId) || t("Onbekend", "Unknown", "Bilinmeyen");
      acc[cat] = (acc[cat] || 0) + o.totalAmount;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orders, machines]);

  const categoryCount = machines.reduce((acc, machine) => {
    const cat = machine.category;
    let label = "Algemeen";
    if (cat === "schaarlift") label = t("Schaarliften", "Scissor Lifts", "Makaslı Platformlar");
    else if (cat === "knikarm") label = t("Knikarmhoogv.", "Articulated", "Eklemli Platform");
    else if (cat === "telescoop") label = t("Telescoop", "Telescopic", "Teleskopik Platform");
    else if (cat === "auto") label = t("Autohoogv.", "Truck-mounted", "Araç Üstü");
    else if (cat === "spin") label = t("Rupshoogv.", "Spider Lifts", "Paletli Platform");
    else if (cat === "aanhanger") label = t("Aanhanger", "Trailer Lift", "Römork Platformu");
    else if (cat === "mastlift") label = t("Mastliften", "Mast Lifts", "Direk Platformu");
    else if (cat === "ladderlift") label = t("Ladderliften", "Ladder Lifts", "Merdiven Platformu");
    else if (cat === "ecolift") label = t("Ecoliften", "Eco Lifts", "Eco Platform");
    else if (cat === "klussensets") label = t("Klussensets", "Tool Sets", "Takım Setleri");

    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Machine utilization — last 90 days
  const machineUtilization = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const data: Record<string, { name: string; days: number; revenue: number }> = {};

    orders
      .filter(o => o.status !== "Geannuleerd")
      .forEach(o => {
        const start = new Date(o.startDate);
        const end = new Date(o.endDate);
        if (end < cutoff) return;
        const effectiveStart = start < cutoff ? cutoff : start;
        const days = Math.max(1, Math.ceil((end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
        const key = o.machineId;
        if (!data[key]) data[key] = { name: o.machineName.replace(/\s*\(Unit\s+\d+\)\s*$/i, ""), days: 0, revenue: 0 };
        data[key].days += days;
        data[key].revenue += o.totalAmount;
      });

    return Object.entries(data)
      .map(([id, d]) => ({ id, name: d.name, days: d.days, revenue: d.revenue, pct: Math.min(100, Math.round((d.days / 90) * 100)) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [orders]);

  // Auto-refresh orders every 60 s — skips when tab is hidden to avoid wasted fetches
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        await fetchOrders();
        refreshOrderStats();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchOrders, refreshOrderStats]);

  // Fetch server-side order aggregates on mount (and whenever the token changes)
  useEffect(() => { refreshOrderStats(); }, [refreshOrderStats]);

  // The revenue trend / utilization charts below read from the shared `orders`
  // store, which fetchOrders() only fills with the 100 most-recently-created
  // orders. Load every remaining page once so those charts (and their "based
  // on all contracts" copy) actually cover the full history, not just page 1.
  useEffect(() => { loadAllOrders(); }, [loadAllOrders]);

  // Fetch customer count once on mount
  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/customers", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.customers) return;
        const now = new Date();
        const thisMonth = data.customers.filter((c: any) => {
          const d = new Date(c.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        setCustomerStats({ total: data.customers.length, newThisMonth: thisMonth });
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (notifPermission !== "granted") return;
    if (orders.length > prevOrderCount.current) {
      const diff = orders.length - prevOrderCount.current;
      new Notification(`huurgo — ${diff} nieuwe bestelling${diff > 1 ? "en" : ""}! 🦾`, {
        body: "Er zijn nieuwe reserveringen binnengekomen. Klik om te bekijken.",
        icon: "/icon-192.png",
      });
    }
    prevOrderCount.current = orders.length;
  }, [orders.length, notifPermission]);

  // Real month-over-month revenue trend
  const currentMonthRevenue = monthlyRevenue.at(-1)?.revenue ?? 0;
  const prevMonthRevenue = monthlyRevenue.at(-2)?.revenue ?? 0;
  const revenueTrend = prevMonthRevenue > 0
    ? `${currentMonthRevenue >= prevMonthRevenue ? "+" : ""}${((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue * 100).toFixed(1)}% ${t("t.o.v. vorige maand", "vs last month", "geçen aya göre")}`
    : (currentMonthRevenue > 0 ? t("Eerste omzet dit jaar", "First revenue this year", "İlk ciro") : t("Nog geen omzet", "No revenue yet", "Henüz ciro yok"));

  return (
    <motion.div
      key="dash-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Glowing Premium KPI Card deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: t("Cumulatieve Omzet", "Cumulative Revenue", "Toplam Ciro"), value: `${euro(kpiEarnings)}`, paidValue: kpiPaidEarnings, trend: revenueTrend, color: "bg-amber-50 border border-amber-200 text-amber-900 shadow-sm", tab: "accounting" as const, filter: [] as string[] },
          { title: t("Actieve Huren", "Active Rentals", "Aktif Kiralamalar"), value: `${kpiActive} ${t("machines", "machines", "makine")}`, trend: t("Klik voor details →", "Click for details →", "Detay için tıkla →"), color: "border border-slate-200 bg-slate-50 text-slate-800 shadow-sm", tab: "orders" as const, filter: ["Goedgekeurd", "Onderweg"] as string[] },
          { title: t("Vloot Bezetting", "Fleet Occupancy", "Filo Doluluk Oranı"), value: `${machines.length > 0 ? Math.round((kpiActive / machines.length) * 100) : 0}% ${t("bezet", "occupied", "dolu")}`, trend: `${machines.length} ${t("units totaal", "total units", "toplam adet")}`, color: "border border-slate-200 bg-slate-50 text-slate-800 shadow-sm", tab: "machines" as const, filter: [] as string[] },
          { title: t("Ter Beoordeling", "To Review", "Onay Bekleyenler"), value: `${kpiPending} ${t("aanvragen", "requests", "başvuru")}`, trend: t("Klik voor details →", "Click for details →", "Detay için tıkla →"), color: kpiPending > 0 ? "border border-amber-200 bg-amber-50 text-amber-950 shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-500 shadow-sm", tab: "orders" as const, filter: ["In behandeling"] as string[] },
          { title: t("Wacht op Controle", "Awaiting Inspection", "Kontrol Bekliyor"), value: `${kpiAwaitingInspection} ${t("retouren", "returns", "iade")}`, trend: t("Klik voor details →", "Click for details →", "Detay için tıkla →"), color: kpiAwaitingInspection > 0 ? "border border-indigo-200 bg-indigo-50 text-indigo-950 shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-500 shadow-sm", tab: "orders" as const, filter: ["Retour", "Schade gemeld"] as string[] }
        ].map((card, idx) => {
          return (
            <div
              key={idx}
              onClick={() => { setSubTab(card.tab); if (card.tab === "orders") setOrdersFilter?.(card.filter); }}
              className={`p-5 rounded-2xl flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] ${card.color}`}
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider block leading-none">
                  {card.title}
                </span>
                <span className="text-xl font-display font-extrabold text-slate-900 mt-3.5 block">
                  {card.value}
                </span>
                {card.paidValue !== undefined && (
                  <span className="text-[10px] font-mono text-emerald-700 mt-1 block">
                    {t("Waarvan ontvangen", "Of which received", "Bunun ödeneni")}: {euro(card.paidValue)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 block mt-auto leading-none pt-4">
                {card.trend}
              </span>
            </div>
          );
        })}

        {/* New customers KPI */}
        <div
          onClick={() => setSubTab("customers")}
          className="p-5 rounded-2xl flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] border border-teal-200 bg-teal-50 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-[10px] uppercase font-bold text-teal-500 font-mono tracking-wider block leading-none">
              {t("Nieuwe Klanten", "New Customers", "Yeni Müşteriler")}
            </span>
            <UserPlus className="h-4 w-4 text-teal-400 shrink-0" />
          </div>
          <div>
            <span className="text-xl font-display font-extrabold text-teal-900 block mt-3.5">
              {customerStats !== null ? customerStats.newThisMonth : "—"}
              {customerStats !== null && (
                <span className="text-sm font-normal text-teal-600 ml-1">{t("deze maand", "this month", "bu ay")}</span>
              )}
            </span>
          </div>
          <span className="text-[10px] font-mono text-teal-600 block mt-auto leading-none pt-4">
            {customerStats !== null
              ? t(`${customerStats.total} totaal geregistreerd`, `${customerStats.total} total registered`, `${customerStats.total} toplam kayıtlı`)
              : t("Laden...", "Loading...", "Yükleniyor...")}
          </span>
        </div>
      </div>

      {/* Operational snapshot — today's logistics, overdue, open maintenance/damage,
          cancellation rate. Deliberately not "vanity" — every tile links to the
          panel that acts on it. See docs/admin-platform-audit-2026-07.md §12. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div onClick={() => setSubTab("planning")} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
          <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block">{t("Vertrek vandaag", "Departing today", "Bugün çıkış")}</span>
          <span className="text-lg font-display font-extrabold text-slate-900 block mt-1">{todaysLogistics.departing.length}</span>
        </div>
        <div onClick={() => setSubTab("planning")} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
          <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block">{t("Retour vandaag", "Returning today", "Bugün iade")}</span>
          <span className="text-lg font-display font-extrabold text-slate-900 block mt-1">{todaysLogistics.returning.length}</span>
        </div>
        <div
          onClick={() => { setSubTab("orders"); setOrdersFilter?.(["Onderweg"]); }}
          className={`p-3.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all ${kpiOverdue > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}
        >
          <span className={`text-[9px] uppercase font-bold font-mono tracking-wider block ${kpiOverdue > 0 ? "text-rose-600" : "text-slate-500"}`}>{t("Te laat", "Overdue", "Gecikmiş")}</span>
          <span className={`text-lg font-display font-extrabold block mt-1 ${kpiOverdue > 0 ? "text-rose-800" : "text-slate-900"}`}>{kpiOverdue}</span>
        </div>
        <div
          onClick={() => setSubTab("maintenance")}
          className={`p-3.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all ${openMaintenanceCount > 0 ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}
        >
          <span className={`text-[9px] uppercase font-bold font-mono tracking-wider block ${openMaintenanceCount > 0 ? "text-indigo-600" : "text-slate-500"}`}>{t("In onderhoud", "In maintenance", "Bakımda")}</span>
          <span className={`text-lg font-display font-extrabold block mt-1 ${openMaintenanceCount > 0 ? "text-indigo-800" : "text-slate-900"}`}>{openMaintenanceCount}</span>
        </div>
        <div
          onClick={() => setSubTab("maintenance")}
          className={`p-3.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all ${openDamageCount > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200"}`}
        >
          <span className={`text-[9px] uppercase font-bold font-mono tracking-wider block ${openDamageCount > 0 ? "text-orange-600" : "text-slate-500"}`}>{t("Schade open", "Damage open", "Açık hasar")}</span>
          <span className={`text-lg font-display font-extrabold block mt-1 ${openDamageCount > 0 ? "text-orange-800" : "text-slate-900"}`}>{openDamageCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block">{t("Annuleringspercentage", "Cancellation rate", "İptal oranı")}</span>
          <span className="text-lg font-display font-extrabold text-slate-900 block mt-1">{cancellationRate}%</span>
        </div>
      </div>

      {/* VISUAL ANALYTICS GRAPHICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Revenue by Industry/Profile */}
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div>
            <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider">{t("Huur-omzet per Doelgroep", "Rental Revenue by Audience", "Sektörlere Göre Kiralama Cirosu")}</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{t("Live overzicht gesegmenteerd op schilders, groenverzorgers e.a.", "Live overview segmented by painters, landscapers, etc.", "Boyacılar, peyzajcılar ve diğerlerine göre canlı ciro dağılımı.")}</p>
          </div>

          <div className="space-y-4">
            <div className="h-44 flex items-end justify-between px-2 pt-4 border-b border-slate-200 relative">
              <div className="absolute right-2 top-0 flex flex-col text-right text-[9px] font-mono text-slate-500">
                <span>Max: € {Math.max(...Object.values(profileEarnings), 100).toFixed(0)}</span>
                <span>Midden: € {(Math.max(...Object.values(profileEarnings), 100) / 2).toFixed(0)}</span>
              </div>

              {Object.entries(profileEarnings).map(([sector, val]) => {
                const maxVal = Math.max(...Object.values(profileEarnings), 100);
                const percent = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const isHovered = hoveredSector === sector;
                
                // Assign unique sector style parameters
                const colors: Record<string, string> = {
                  Schilder: "bg-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.2)]",
                  Hovenier: "bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.2)]",
                  Glazenwasser: "bg-teal-500 shadow-[0_4px_12px_rgba(20,184,166,0.2)]",
                  Aannemer: "bg-amber-500 shadow-[0_4px_12px_rgba(245,158,11,0.2)]",
                  Particulier: "bg-indigo-500 shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
                };

                return (
                  <div
                    key={sector}
                    className="flex flex-col items-center flex-1 group cursor-pointer"
                    onMouseEnter={() => setHoveredSector(sector)}
                    onMouseLeave={() => setHoveredSector(null)}
                  >
                    {/* Tooltip wrapper */}
                    <div className={`absolute -top-4 transition-all duration-250 ease-out flex flex-col items-center pointer-events-none ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 translate-y-1"}`}>
                      <span className="bg-slate-900 border border-slate-200 px-2 py-1 rounded-lg text-[10px] text-white font-black font-mono shadow-xl">
                        {euro(val)}
                      </span>
                      <div className="w-1.5 h-1.5 bg-slate-900 border-r border-b border-slate-200 rotate-45 -mt-1" />
                    </div>

                    {/* Rounded Bar with custom height */}
                    <div className="w-10 sm:w-12 bg-slate-100 rounded-t-xl overflow-hidden h-32 flex items-end">
                      <div
                        style={{ height: `${Math.max(percent, 4)}%` }}
                        className={`w-full rounded-t-lg transition-all duration-500 ease-out origin-bottom ${colors[sector] || "bg-slate-400"} ${isHovered ? "brightness-125 scale-x-[1.04]" : "brightness-100"}`}
                      />
                    </div>

                    <span className={`text-[9px] font-mono mt-2 transition-colors ${isHovered ? "text-slate-900 font-bold" : "text-slate-500"}`}>
                      {sector}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
              {Object.entries(profileEarnings).map(([sector, val]) => (
                <div key={sector} className="flex items-center space-x-1.5 text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${
                    sector === "Schilder" ? "bg-blue-500" :
                    sector === "Hovenier" ? "bg-emerald-500" :
                    sector === "Glazenwasser" ? "bg-teal-500" :
                    sector === "Aannemer" ? "bg-amber-500" : "bg-indigo-500"
                  }`} />
                  <span className="font-medium">{sector}:</span>
                  <span className="font-mono font-bold text-slate-800 ml-auto">€ {val.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Fleet Composition Linear scale */}
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div>
            <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider">{t("Actieve Vloot Samenstelling", "Active Fleet Composition", "Aktif Filo Dağılımı")}</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{t("Volledige inventaris verdeeld over productgroepen", "Complete inventory divided by product groups", "Ürün gruplarına göre tam envanter dağılımı")}</p>
          </div>

          <div className="space-y-6">
            {/* Interactive multi-segmented bar meter representing composition */}
            <div className="space-y-2">
              <div className="flex h-5 w-full rounded-full overflow-hidden bg-slate-100 p-0.5 border border-slate-200">
                {Object.entries(categoryCount).map(([group, val], idx) => {
                  const totalUnits = Object.values(categoryCount).reduce((a, b) => a + b, 0);
                  const segmentPercent = (val / totalUnits) * 100;

                  const segmentColors = [
                    "bg-amber-500 shadow-[0_2px_6px_rgba(245,158,11,0.15)]",
                    "bg-blue-500 shadow-[0_2px_6px_rgba(59,130,246,0.15)]",
                    "bg-rose-500 shadow-[0_2px_6px_rgba(244,63,94,0.15)]",
                    "bg-emerald-500 shadow-[0_2px_6px_rgba(16,185,129,0.15)]",
                    "bg-teal-500 shadow-[0_2px_6px_rgba(20,184,166,0.15)]",
                  ];
                  const colorClass = segmentColors[idx % segmentColors.length];

                  return (
                    <div
                      key={group}
                      style={{ width: `${segmentPercent}%` }}
                      className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 relative group cursor-pointer ${colorClass}`}
                    >
                      {/* Inline tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-200 text-[9px] text-white px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-30 shadow-2xl">
                        {group}: {val} {val === 1 ? t("unit", "unit", "adet") : t("units", "units", "adet")} ({Math.round(segmentPercent)}%)
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{t("Vloot-omvang", "Fleet size", "Filo büyüklüğü")}: {machines.length} {t("Geregistreerd", "Registered", "Kayıtlı")}</span>
              </div>
            </div>

            {/* Direct progress indicators for each group */}
            <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
              {Object.entries(categoryCount).map(([group, val], idx) => {
                const totalUnits = Object.values(categoryCount).reduce((a, b) => a + b, 0);
                const valPercent = (val / totalUnits) * 100;
                const segmentColors = ["bg-amber-500", "bg-blue-500", "bg-rose-500", "bg-emerald-500", "bg-teal-500"];
                const colorClass = segmentColors[idx % segmentColors.length];

                return (
                  <div key={group} className="space-y-1">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-700 font-extrabold">{group}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{val} {val === 1 ? t("machine", "machine", "makine") : t("machines", "machines", "makine")} ({Math.round(valPercent)}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${valPercent}%` }} className={`h-full rounded-full ${colorClass}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Omzet per Categorie — computed from the same loaded orders as the
          profile/utilization panels above, no schema change needed. */}
      {revenueByCategory.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-3 bg-white border border-slate-200 shadow-sm">
          <div>
            <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider">{t("Omzet per Categorie", "Revenue by Category", "Kategoriye Göre Ciro")}</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{t("Gebaseerd op alle geladen contracten", "Based on all loaded contracts", "Yüklenen tüm sözleşmelere dayalı")}</p>
          </div>
          <div className="space-y-2">
            {revenueByCategory.map(([cat, val]) => {
              const maxVal = revenueByCategory[0][1];
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-700 font-extrabold">{cat}</span>
                    <span className="text-slate-500 font-mono text-[10px]">{euro(val)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-amber-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel 3: Monthly Revenue Spline Area Chart */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 bg-white border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider">
              {t("Huur-omzet Trend (Laatste 6 Maanden)", "Rental Revenue Trend (Last 6 Months)", "Kiralama Ciro Trendi (Son 6 Ay)")}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {t("Dynamische omzetontwikkeling gebaseerd op alle contracten", "Dynamic revenue development based on all contracts", "Tüm sözleşmelere dayalı dinamik ciro gelişimi")}
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200/30 shadow-inner">
            {t("Totaal", "Total", "Toplam")}: {euro(kpiEarnings)}
          </div>
        </div>

        <div className="relative pt-3 select-none">
          {orders.length === 0 && (
            <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 rounded-2xl z-40 border border-slate-200/50 shadow-inner">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">
                {t("Geen Transactiehistorie", "No Transaction History", "İşlem Geçmişi Yok")}
              </span>
              <p className="text-[10px] text-slate-500 mt-1.5 max-w-xs leading-normal">
                {t("Er zijn momenteel geen actieve of voltooide reserveringen geregistreerd in het systeem.", "There are currently no active or completed reservations registered in the system.", "Sistemde kayıtlı aktif veya tamamlanmış herhangi bir rezervasyon bulunmamaktadır.")}
              </p>
            </div>
          )}
          {/* Interactive HTML Tooltips */}
          {(() => {
            const maxTrendRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 100);
            const trendPoints = monthlyRevenue.map((m, i) => {
              const x = 50 + i * 100;
              const y = 160 - (m.revenue / Math.max(maxTrendRevenue, 1)) * 110;
              return { x, y, label: m.label, revenue: m.revenue, key: m.key };
            });

            return (
              <>
                {trendPoints.map((p) => {
                  const isHovered = hoveredTrendMonth === p.key;
                  return (
                    <div
                      key={p.key}
                      style={{
                        left: `${(p.x / 600) * 100}%`,
                        top: `${(p.y / 200) * 100}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-12 transition-all duration-200 pointer-events-none ${
                        isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-1"
                      } z-40`}
                    >
                      <div className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl text-[10px] text-white font-extrabold font-mono shadow-2xl flex flex-col items-center">
                        <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-black">{p.label}</span>
                        <span className="mt-0.5 text-teal-400">{euro(p.revenue)}</span>
                      </div>
                      <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 mx-auto -mt-1" />
                    </div>
                  );
                })}

                <svg viewBox="0 0 600 200" className="w-full h-auto overflow-visible select-none">
                  <defs>
                    <linearGradient id="trendLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>

                    <linearGradient id="trendAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 160 - ratio * 110;
                    return (
                      <g key={idx}>
                        <line
                          x1="45"
                          y1={y}
                          x2="555"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text
                          x="35"
                          y={y + 3.5}
                          textAnchor="end"
                          className="text-[8.5px] font-mono fill-slate-400 font-bold"
                        >
                          € {Math.round(ratio * maxTrendRevenue)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Shaded Area path */}
                  <path
                    d={`${trendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} L ${
                      trendPoints[trendPoints.length - 1].x
                    } 160 L ${trendPoints[0].x} 160 Z`}
                    fill="url(#trendAreaGradient)"
                  />

                  {/* Polyline Spline */}
                  <path
                    d={trendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                    fill="none"
                    stroke="url(#trendLineGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Interactive Nodes */}
                  {trendPoints.map((p) => {
                    const isHovered = hoveredTrendMonth === p.key;
                    return (
                      <g key={p.key}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="15"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredTrendMonth(p.key)}
                          onMouseLeave={() => setHoveredTrendMonth(null)}
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? "6.5" : "4.5"}
                          className={`transition-all duration-150 fill-white cursor-pointer ${
                            isHovered ? "stroke-purple-500 stroke-[3.5]" : "stroke-indigo-600 stroke-2"
                          }`}
                          onMouseEnter={() => setHoveredTrendMonth(p.key)}
                          onMouseLeave={() => setHoveredTrendMonth(null)}
                        />
                        <text
                          x={p.x}
                          y="182"
                          textAnchor="middle"
                          className={`text-[9px] font-mono font-bold transition-colors ${
                            isHovered ? "fill-slate-900 font-extrabold" : "fill-slate-500"
                          }`}
                        >
                          {p.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </>
            );
          })()}
        </div>
      </div>

      {/* Orders Summary lists */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 bg-white border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-display font-bold text-sm text-slate-900">{t("Inkomende Aanvragen & Huren", "Incoming Requests & Rentals", "Gelen Talepler & Kiralamalar")}</h3>
          <button 
            onClick={() => setSubTab("orders")}
            className="text-xs text-amber-600 hover:text-amber-800 font-bold flex items-center space-x-1 cursor-pointer"
          >
            <span>{t("Bekijk alle", "View all", "Tümünü gör")}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 font-bold pr-4">Ref No.</th>
                <th className="pb-3 font-bold pr-4">{t("Klant", "Customer", "Müşteri")}</th>
                <th className="pb-3 font-bold pr-4 hidden sm:table-cell">{t("Machine", "Machine", "Makine")}</th>
                <th className="pb-3 font-bold pr-4 hidden sm:table-cell">{t("Bedrag (incl BTW)", "Amount (incl VAT)", "Tutar")}</th>
                <th className="pb-3 font-bold text-center">{t("Status", "Status", "Durum")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    {t("Er zijn momenteel geen boekingen in de database.", "There are currently no bookings in the database.", "Veri tabanında şu anda rezervasyon bulunmamaktadır.")}
                  </td>
                </tr>
              ) : (
                orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 pr-4 font-mono font-bold text-indigo-600 text-[11px]">{o.id}</td>
                    <td className="py-4 pr-4">
                      <span className="font-semibold text-slate-800 block">{o.customerName}</span>
                      <span className="text-[11px] text-slate-400 font-normal">{o.customerProfile}</span>
                    </td>
                    <td className="py-4 pr-4 text-slate-600 max-w-[160px] hidden sm:table-cell">
                      <span className="block leading-snug">{o.machineName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{o.rentalDays}d</span>
                    </td>
                    <td className="py-4 pr-4 font-mono text-teal-600 font-bold hidden sm:table-cell">{euro(o.totalAmount)}</td>
                    <td className="py-4 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        o.status === "In behandeling"
                          ? "bg-amber-100 text-amber-700"
                          : o.status === "Goedgekeurd"
                            ? "bg-teal-100 text-teal-700"
                            : o.status === "Onderweg"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                      }`}>
                        {o.status === "In behandeling"
                          ? t("Wacht", "Pending", "Bekliyor")
                          : o.status === "Goedgekeurd"
                            ? t("OK", "OK", "Onaylandı")
                            : o.status === "Onderweg"
                              ? t("Weg", "Dispatched", "Yolda")
                              : t("Klaar", "Done", "Tamam")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machine Utilization Heatmap — laatste 90 dagen */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 bg-white border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start border-b border-slate-200 pb-3">
          <div>
            <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider">
              {t("Machinebezetting", "Machine Utilization", "Makine Kullanımı")} — {t("laatste 90 dagen", "last 90 days", "son 90 gün")}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {t("Bezettingsgraad per machine op basis van verhuurde dagen", "Occupancy rate per machine based on rental days", "Kiralanan günlere göre makine başına doluluk oranı")}
            </p>
          </div>
          {machineUtilization.length > 0 && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-3">
              {machineUtilization.length} {t("machines", "machines", "makine")}
            </span>
          )}
        </div>

        {machineUtilization.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            {t("Geen verhuurdata in de laatste 90 dagen.", "No rental data in the last 90 days.", "Son 90 günde kiralama verisi yok.")}
          </p>
        ) : (
          <div className="space-y-3">
            {machineUtilization.map((m) => {
              const isHov = hoveredMachine === m.id;
              const barColor = m.pct >= 70 ? "bg-teal-500" : m.pct >= 30 ? "bg-amber-400" : "bg-rose-400";
              return (
                <div
                  key={m.id}
                  className="space-y-1 cursor-default group"
                  onMouseEnter={() => setHoveredMachine(m.id)}
                  onMouseLeave={() => setHoveredMachine(null)}
                >
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className={`font-semibold truncate max-w-[55%] transition-colors ${isHov ? "text-slate-900" : "text-slate-600"}`}>{m.name}</span>
                    <span className={`font-mono font-bold transition-colors ${m.pct >= 70 ? "text-teal-600" : m.pct >= 30 ? "text-amber-600" : "text-rose-500"}`}>
                      {m.pct}% · {m.days}d · €{Math.round(m.revenue)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${m.pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${barColor} ${isHov ? "brightness-110" : ""}`}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-100">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500 inline-block" /> ≥70% {t("hoog", "high", "yüksek")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> 30–69% {t("gemiddeld", "medium", "orta")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> &lt;30% {t("laag", "low", "düşük")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Admin Tools — PWA + Google Calendar + Browser Meldingen */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 bg-white border border-slate-200 shadow-sm">
        <h4 className="font-display font-bold text-xs uppercase text-slate-500 tracking-wider border-b border-slate-200 pb-3">
          {t("Admin Tools", "Admin Tools", "Yönetici Araçları")}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* PWA Install */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="h-8 w-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4 text-orange-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 leading-snug">{t("App installeren", "Install App", "Uygulamayı Kur")}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                {t('Browser menu → "Aan beginscherm toevoegen" om huurgo als app te gebruiken.', 'Browser menu → "Add to Home Screen" to use huurgo as an app.', 'Tarayıcı menüsü → "Ana ekrana ekle".')}
              </p>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-blue-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 leading-snug">{t("Google Agenda", "Google Calendar", "Google Takvim")}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                {t("Koppel de iCal-feed via Instellingen → Agenda in dit admin-panel.", "Connect the iCal feed via Settings → Calendar in this admin panel.", "Bu panelde Ayarlar → Takvim üzerinden iCal akışını bağlayın.")}
              </p>
            </div>
          </div>

          {/* Browser Notifications */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${notifPermission === "granted" ? "bg-teal-50 border border-teal-100" : "bg-slate-100 border border-slate-200"}`}>
              <Bell className={`h-4 w-4 ${notifPermission === "granted" ? "text-teal-500" : "text-slate-400"}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-800 leading-snug">
                {notifPermission === "granted"
                  ? t("Meldingen actief ✓", "Notifications active ✓", "Bildirimler Aktif ✓")
                  : t("Browser meldingen", "Browser notifications", "Tarayıcı Bildirimleri")}
              </p>
              {notifPermission === "granted" ? (
                <p className="text-[10px] text-teal-600 mt-0.5 font-semibold">
                  {t("Nieuwe bestellingen worden gemeld.", "New orders will be notified.", "Yeni siparişler bildirilecek.")}
                </p>
              ) : notifPermission === "denied" ? (
                <p className="text-[10px] text-rose-500 mt-0.5">
                  {t("Geblokkeerd in browser. Zet aan via site-instellingen.", "Blocked in browser. Enable via site settings.", "Tarayıcıda engellendi. Site ayarlarından etkinleştirin.")}
                </p>
              ) : notifPermission === "unsupported" ? (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {t("Niet ondersteund door deze browser.", "Not supported by this browser.", "Bu tarayıcı desteklenmiyor.")}
                </p>
              ) : (
                <button
                  onClick={async () => {
                    const perm = await Notification.requestPermission();
                    setNotifPermission(perm);
                  }}
                  className="mt-1.5 text-[10px] font-bold text-white bg-slate-700 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none"
                >
                  {t("Inschakelen", "Enable", "Etkinleştir")} →
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

    </motion.div>
  );
}
