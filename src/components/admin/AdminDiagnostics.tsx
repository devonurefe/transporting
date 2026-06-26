/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal as TerminalIcon,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Database,
  Key,
  Network,
  TrendingUp,
  Clock,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";

interface AdminDiagnosticsProps {
  systemLogs: any[];
  userProfiles: any[];
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminDiagnostics({ systemLogs, userProfiles, onAddSystemLog, adminLanguage }: AdminDiagnosticsProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const orders = useAppStore((state) => state.orders);

  // Operational counts — real
  const activeRentals = orders.filter((o) => o.status === "Goedgekeurd" || o.status === "Onderweg").length;
  const pendingApproval = orders.filter((o) => o.status === "In behandeling").length;
  const totalActive = orders.filter((o) => o.status !== "Geannuleerd").length;

  // Real computed business metrics
  const realMetrics = useMemo(() => {
    const completed = orders.filter(o => o.status === "Voltooid");
    const cancelled = orders.filter(o => o.status === "Geannuleerd");
    const nonCancelled = orders.filter(o => o.status !== "Geannuleerd");

    const conversionRate = nonCancelled.length > 0
      ? Math.round((completed.length / nonCancelled.length) * 100)
      : null;

    const cancellationRate = orders.length > 0
      ? Math.round((cancelled.length / orders.length) * 100)
      : null;

    const avgDays = completed.length > 0
      ? +(completed.reduce((sum, o) => {
          const ms = new Date(o.endDate).getTime() - new Date(o.startDate).getTime();
          return sum + ms / 86_400_000;
        }, 0) / completed.length).toFixed(1)
      : null;

    const todayStr = new Date().toISOString().split("T")[0];
    const todayOrders = orders.filter(o => {
      const created = o.createdAt ? o.createdAt.split("T")[0] : null;
      return created === todayStr;
    }).length;

    return { conversionRate, cancellationRate, avgDays, completed: completed.length, cancelled: cancelled.length, todayOrders };
  }, [orders]);

  // Real database health — measured round-trip to /api/health every 15 s
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "unhealthy">("checking");

  useEffect(() => {
    let active = true;
    const probe = async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const elapsed = Math.round(performance.now() - start);
        if (!active) return;
        const body = await res.json().catch(() => ({}));
        setDbLatency(elapsed);
        setDbStatus(res.ok && body?.services?.database === "connected" ? "connected" : "unhealthy");
      } catch {
        if (!active) return;
        setDbLatency(null);
        setDbStatus("unhealthy");
      }
    };
    probe();
    const timer = setInterval(probe, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  // Format systemLogs as terminal lines
  const terminalLines = useMemo(() => {
    if (systemLogs.length === 0) return [];
    return [...systemLogs].reverse().slice(0, 40).map(log => {
      const ts = log.timestamp ? new Date(log.timestamp).toLocaleString("nl-NL", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
      const typeTag = {
        login: "[AUTH] ",
        logout: "[AUTH] ",
        signup: "[AUTH] ",
        booking: "[BOOK] ",
        fleet: "[FLEET]",
        status: "[STATE]",
        system: "[SYS]  ",
      }[log.type as string] ?? "[INFO] ";
      return `[${ts}] ${typeTag} ${log.user} — ${log.description}`;
    });
  }, [systemLogs]);

  return (
    <motion.div
      key="diagnostics-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in text-slate-800"
    >
      {/* Top row — 3 live operational cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("Actieve verhuur", "Active rentals", "Aktif kiralamalar")}</span>
            <Activity className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{activeRentals}</span>
              <span className="text-slate-500 text-xs font-semibold">{t("goedgekeurd / onderweg", "approved / en route", "onaylı / yolda")}</span>
            </div>
            <span className="text-[10px] text-teal-600 font-bold flex items-center space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-ping shrink-0" />
              <span>{t("Live uit reserveringen", "Live from bookings", "Rezervasyonlardan canlı")}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${totalActive > 0 ? Math.round((activeRentals / totalActive) * 100) : 0}%` }} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("Wacht op accordering", "Awaiting approval", "Onay bekliyor")}</span>
            <Clock className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{pendingApproval}</span>
              <span className="text-slate-500 text-xs font-semibold">{t("in behandeling", "in progress", "işlemde")}</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {t("Reserveringen die op betaling/accordering wachten.", "Bookings awaiting payment/approval.", "Ödeme/onay bekleyen rezervasyonlar.")}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${totalActive > 0 ? Math.round((pendingApproval / totalActive) * 100) : 0}%` }} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("Database latentie", "Database latency", "Veritabanı gecikmesi")}</span>
            <Database className="h-4.5 w-4.5 text-teal-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{dbLatency === null ? "—" : `${dbLatency} ms`}</span>
              <span className="text-slate-500 text-xs font-semibold">round-trip /api/health</span>
            </div>
            <span className={`text-[10px] font-bold flex items-center space-x-1 ${dbStatus === "connected" ? "text-teal-600" : dbStatus === "unhealthy" ? "text-red-600" : "text-slate-400"}`}>
              {dbStatus === "unhealthy" ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              <span>{dbStatus === "connected" ? t("Verbonden", "Connected", "Bağlı") : dbStatus === "unhealthy" ? t("Niet bereikbaar", "Unreachable", "Erişilemiyor") : t("Controleren…", "Checking…", "Kontrol ediliyor…")}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${dbStatus === "unhealthy" ? "bg-red-500" : "bg-gradient-to-r from-teal-500 to-indigo-500"}`}
              style={{ width: `${dbLatency === null ? 100 : Math.min(100, Math.max(8, (dbLatency / 500) * 100))}%` }} />
          </div>
        </div>

      </div>

      {/* Middle row — Security + Real business metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

        {/* Security panel — only factual claims */}
        <div className="md:col-span-6 glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Beveiliging & Access Token Audits", "Security & Access Token Audits", "Güvenlik & Erişim Belirteci Denetimleri")}</h3>
          </div>

          <div className="space-y-3.5 pt-2 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("JWT Token Audit", "JWT Token Audit", "JWT Belirteç Denetimi")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Handshake handtekeningen via SHA-256", "Handshake signatures via SHA-256", "SHA-256 el sıkışma imzaları")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold font-mono px-2 py-0.5 rounded-full border border-teal-200">
                {t("AAN", "ON", "AÇIK")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                  <Network className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("Rate-Limiter", "Rate-Limiter", "Hız Sınırlandırıcı")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("300 req/min globaal · 10/15 min op auth", "300 req/min global · 10/15 min on auth", "300 istek/dk genel · 10/15 dk auth üzerinde")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold font-mono px-2 py-0.5 rounded-full border border-teal-200">
                {t("AAN", "ON", "AÇIK")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("SQL-Injectie Filters (Prisma ORM)", "SQL Injection Filters (Prisma ORM)", "SQL Enjeksiyon Filtreleri (Prisma ORM)")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Geparametriseerde queries — geen raw SQL", "Parameterised queries — no raw SQL", "Parametreli sorgular — ham SQL yok")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                {t("NOMINAAL", "NOMINAL", "NOMİNAL")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("HTTPS / SSL Certificaat", "HTTPS / SSL Certificate", "HTTPS / SSL Sertifikası")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Render.com beheerd TLS certificaat", "Render.com managed TLS certificate", "Render.com yönetilen TLS sertifikası")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                {t("ACTIEF", "ACTIVE", "AKTİF")}
              </span>
            </div>
          </div>
        </div>

        {/* Real business metrics — computed from actual order data */}
        <div className="md:col-span-6 glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <TrendingUp className="h-4.5 w-4.5 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Boekingsstatistieken", "Booking Statistics", "Rezervasyon İstatistikleri")}</h3>
            <span className="ml-auto text-[9px] text-slate-400 font-mono">{t("Berekend uit echte orders", "Computed from real orders", "Gerçek siparişlerden hesaplandı")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Conversieratio", "Conversion Rate", "Dönüşüm Oranı")}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">
                {realMetrics.conversionRate !== null ? `${realMetrics.conversionRate}%` : "—"}
              </div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Voltooide huren / alle niet-geannuleerde reserveringen.", "Completed rentals / all non-cancelled bookings.", "Tamamlanan kiralamalar / iptal edilmemiş rezervasyonlar.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Gem. Huurperiode", "Avg. Rental Period", "Ort. Kiralama Süresi")}</span>
                <Clock className="h-3.5 w-3.5 text-teal-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">
                {realMetrics.avgDays !== null ? `${realMetrics.avgDays}d` : "—"}
              </div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Gemiddeld aantal huuragen bij voltooide orders.", "Average rental days across completed orders.", "Tamamlanan siparişlerde ortalama kiralama günü.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Annuleringsratio", "Cancellation Rate", "İptal Oranı")}</span>
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">
                {realMetrics.cancellationRate !== null ? `${realMetrics.cancellationRate}%` : "—"}
              </div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Geannuleerde bestellingen t.o.v. totaal.", "Cancelled orders vs total.", "Toplam içindeki iptal edilen siparişler.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Orders Vandaag", "Orders Today", "Bugünkü Siparişler")}</span>
                <Activity className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">{realMetrics.todayOrders}</div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Nieuwe reserveringen aangemaakt vandaag.", "New bookings created today.", "Bugün oluşturulan yeni rezervasyonlar.")}</p>
            </div>

          </div>
        </div>

      </div>

      {/* Activity log terminal — real session events */}
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4.5 w-4.5 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Activiteitenlog — Sessie", "Activity Log — Session", "Etkinlik Günlüğü — Oturum")}</h3>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">{systemLogs.length} {t("events", "events", "olay")}</span>
        </div>

        <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-900 font-mono text-[10.5px] sm:text-[11px] text-slate-300 max-h-80 overflow-y-auto shadow-inner relative">
          <div className="absolute top-3 left-4 flex space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500/80" />
          </div>
          <div className="pt-4 space-y-2">
            {terminalLines.length === 0 ? (
              <div className="text-slate-500 italic">{t("Geen activiteit in deze sessie…", "No activity in this session…", "Bu oturumda etkinlik yok…")}</div>
            ) : terminalLines.map((line, idx) => {
              let cls = "text-slate-300";
              if (line.includes("[AUTH]")) cls = "text-indigo-400";
              if (line.includes("[BOOK]")) cls = "text-amber-400";
              if (line.includes("[STATE]")) cls = "text-teal-400";
              if (line.includes("[FLEET]")) cls = "text-blue-400";
              if (line.includes("[SYS]")) cls = "text-emerald-400";
              return (
                <div key={idx} className={`leading-relaxed border-b border-white/5 pb-1 ${cls}`}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </motion.div>
  );
}
