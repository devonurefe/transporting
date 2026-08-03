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
  Mail,
  Send,
  MessageCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { getAdminAuthHeaders } from "../../utils/authHeaders";
import { showAdminToast } from "./AdminToast";

interface AdminDiagnosticsProps {
  systemLogs: any[];
  adminLanguage?: string;
}

export default function AdminDiagnostics({ systemLogs, adminLanguage }: AdminDiagnosticsProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const orders = useAppStore((state) => state.orders);
  const loadAllOrders = useAppStore((state) => state.loadAllOrders);

  // Booking-statistics cards below claim to be "computed from real orders" —
  // the shared store only holds the 100 most-recently-created orders by
  // default, which under-counts once total orders exceed that. Load every
  // page so the claim is actually true.
  useEffect(() => { loadAllOrders(); }, [loadAllOrders]);

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

  // Echte e-mail-/WhatsApp-configuratiestatus — beantwoordt "waarom komt er geen
  // mail aan" zonder dat iemand op de VPS moet inloggen om de boot-log te lezen.
  interface EmailDiagnostics {
    resendConfigured: boolean;
    emailFrom: string;
    adminAlertEmailConfigured: boolean;
    adminAlertEmail: string | null;
    whatsappConfigured: boolean;
  }
  const [emailDiag, setEmailDiag] = useState<EmailDiagnostics | null>(null);
  const [emailDiagError, setEmailDiagError] = useState(false);
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent">("idle");
  // Leeg = server stuurt naar het account-e-mailadres van de ingelogde admin.
  // Overschrijfbaar: Resend "geslaagd" bewijst alleen dat de send is
  // geaccepteerd, niet dat het inlog-adres (vaak op een eigen domein, bv.
  // admin@huurgo.nl) ook echt een gecontroleerde mailbox is — daarom kan de
  // admin hier een adres invullen dat ze nu meteen kunnen checken (bv. Gmail).
  const [testEmailTo, setTestEmailTo] = useState("");

  // Beveiligingsstatus: op dit moment alleen de vraag of het geseede
  // adminaccount nog het wachtwoord uit de repo gebruikt. Die controle draaide al
  // bij het opstarten maar schreef enkel een console.error — op een onbemande VPS
  // leest niemand dat, dus hier moet het zichtbaar zijn.
  const [securityStatus, setSecurityStatus] = useState<{ defaultAdminPassword: boolean; defaultAdminEmail: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/email-status", { headers: getAdminAuthHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { if (active) setEmailDiag(data); })
      .catch(() => { if (active) setEmailDiagError(true); });
    fetch("/api/admin/security-status", { headers: getAdminAuthHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { if (active) setSecurityStatus(data); })
      .catch(() => { /* stil: een mislukte check mag het paneel niet blokkeren */ });
    return () => { active = false; };
  }, []);

  const sendTestEmail = async () => {
    setTestEmailState("sending");
    try {
      const to = testEmailTo.trim();
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify(to ? { to } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Onbekende fout");
      if (data.mocked) {
        showAdminToast(
          t(
            "MOCK-modus: RESEND_API_KEY is niet ingesteld — er is GEEN echte e-mail verzonden.",
            "MOCK mode: RESEND_API_KEY is not set — no real e-mail was sent.",
            "MOCK modu: RESEND_API_KEY ayarlı değil — gerçek bir e-posta gönderilmedi."
          ),
          "error"
        );
      } else if (data.ok) {
        showAdminToast(
          t(`Testmail verzonden naar ${data.sentTo} via Resend.`, `Test e-mail sent to ${data.sentTo} via Resend.`, `${data.sentTo} adresine Resend üzerinden test e-postası gönderildi.`),
          "success"
        );
      } else {
        showAdminToast(
          t("Resend accepteerde de testmail niet — controleer de API-sleutel en het afzenderdomein.", "Resend rejected the test e-mail — check the API key and sender domain.", "Resend test e-postasını kabul etmedi — API anahtarını ve gönderen alan adını kontrol edin."),
          "error"
        );
      }
    } catch (err: any) {
      showAdminToast(err?.message || t("Testmail versturen mislukt.", "Failed to send test e-mail.", "Test e-postası gönderilemedi."), "error");
    }
    setTestEmailState("sent");
    setTimeout(() => setTestEmailState("idle"), 3000);
  };

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
      {/* Standaardwachtwoord — bovenaan en niet weg te klikken: zolang dit
          waar is kan iedereen die de broncode kent inloggen als beheerder. */}
      {securityStatus?.defaultAdminPassword && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-black text-red-900">
              {t("Adminaccount gebruikt nog het standaardwachtwoord",
                 "Admin account still uses the default password",
                 "Yönetici hesabı hâlâ varsayılan şifreyi kullanıyor")}
            </p>
            <p className="text-xs text-red-800 mt-1 leading-relaxed">
              {t(
                `Het account ${securityStatus.defaultAdminEmail} gebruikt nog het wachtwoord waarmee het is aangemaakt. Dat staat in de broncode, dus iedereen die die kan inzien kan nu inloggen. Wijzig het direct via Beheerders → Wachtwoord wijzigen.`,
                `The account ${securityStatus.defaultAdminEmail} still uses the password it was created with. That password is in the source code, so anyone who can read it can log in right now. Change it via Beheerders → Wachtwoord wijzigen.`,
                `${securityStatus.defaultAdminEmail} hesabı hâlâ oluşturulduğu şifreyi kullanıyor. O şifre kaynak kodda, yani kodu görebilen herkes şu anda giriş yapabilir. Beheerders → Wachtwoord wijzigen üzerinden hemen değiştirin.`
              )}
            </p>
          </div>
        </div>
      )}

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
            <span className="ml-auto text-[9px] text-slate-400 font-mono">{t("Codebase-configuratie, geen live meting", "Codebase configuration, not a live probe", "Kod tabanı yapılandırması, canlı ölçüm değil")}</span>
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
                  <span className="text-[10px] text-slate-500 block">{t("Geparametriseerde queries — enkele getagde raw SQL-calls, nooit met user input", "Parameterised queries — a few tagged raw SQL calls, never with user input", "Parametreli sorgular — birkaç etiketli ham SQL çağrısı, asla kullanıcı girdisiyle değil")}</span>
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
                  <span className="text-[10px] text-slate-500 block">{t("Let's Encrypt via Certbot (Nginx reverse proxy)", "Let's Encrypt via Certbot (Nginx reverse proxy)", "Certbot ile Let's Encrypt (Nginx ters proxy)")}</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">

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

      {/* E-mail & WhatsApp configuratie — beantwoordt "waarom komt er geen mail
          aan": elke transactionele mail-methode valt stil terug op MOCK-modus
          (console-log, geen echte verzending) zodra RESEND_API_KEY ontbreekt,
          zonder dat dat ergens anders in de app zichtbaar wordt. */}
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Mail className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("E-mail & WhatsApp Configuratie", "Email & WhatsApp Configuration", "E-posta & WhatsApp Yapılandırması")}</h3>
          </div>
        </div>

        {emailDiagError ? (
          <p className="text-xs text-rose-600 font-semibold">{t("Kon configuratiestatus niet ophalen.", "Could not fetch configuration status.", "Yapılandırma durumu alınamadı.")}</p>
        ) : !emailDiag ? (
          <p className="text-xs text-slate-400">{t("Laden…", "Loading…", "Yükleniyor…")}</p>
        ) : (
          <div className="space-y-3.5 pt-1 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg border ${emailDiag.resendConfigured ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-rose-50 border-rose-200 text-rose-600"}`}>
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">Resend (transactionele e-mail)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">{t("Afzender: ", "Sender: ", "Gönderen: ")}{emailDiag.emailFrom}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${emailDiag.resendConfigured ? "bg-teal-100 text-teal-800 border-teal-200" : "bg-rose-100 text-rose-800 border-rose-200"}`}>
                {emailDiag.resendConfigured ? t("GECONFIGUREERD", "CONFIGURED", "YAPILANDIRILDI") : t("MOCK-MODUS", "MOCK MODE", "MOCK MODU")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg border ${emailDiag.adminAlertEmailConfigured ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-amber-50 border-amber-200 text-amber-600"}`}>
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("Admin-alertmail (nieuwe order/annulering)", "Admin alert e-mail (new order/cancellation)", "Yönetici uyarı e-postası (yeni sipariş/iptal)")}</span>
                  <span className="text-[10px] text-slate-500 block font-mono">{emailDiag.adminAlertEmail ?? t("niet ingesteld (ADMIN_EMAIL)", "not set (ADMIN_EMAIL)", "ayarlı değil (ADMIN_EMAIL)")}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${emailDiag.adminAlertEmailConfigured ? "bg-teal-100 text-teal-800 border-teal-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                {emailDiag.adminAlertEmailConfigured ? t("INGESTELD", "SET", "AYARLI") : t("ONTBREEKT", "MISSING", "EKSİK")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg border ${emailDiag.whatsappConfigured ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-amber-50 border-amber-200 text-amber-600"}`}>
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">WhatsApp (VITE_WHATSAPP_NUMBER)</span>
                  <span className="text-[10px] text-slate-500 block">{t("Handmatige knoppen/links — nooit automatisch verzonden.", "Manual buttons/links — never sent automatically.", "Manuel butonlar/linkler — asla otomatik gönderilmez.")}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${emailDiag.whatsappConfigured ? "bg-teal-100 text-teal-800 border-teal-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                {emailDiag.whatsappConfigured ? t("INGESTELD", "SET", "AYARLI") : t("ONTBREEKT", "MISSING", "EKSİK")}
              </span>
            </div>

            <div className="pt-1 space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  {t("Verzenden naar (leeg = mijn eigen accountadres)", "Send to (blank = my own account address)", "Şuraya gönder (boş = kendi hesap adresim)")}
                </label>
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder={t("bv. eigen Gmail-adres om nu meteen te checken", "e.g. your Gmail address to check right away", "örn. hemen kontrol edebileceğiniz Gmail adresiniz")}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-0 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {t(
                    "Een 'geslaagd' bij Resend bewijst alleen dat de send is geaccepteerd — niet dat het inlog-adres (vaak op een eigen domein) ook een echt gecontroleerde mailbox is. Vul hier een adres in dat u nu direct kunt checken.",
                    "A Resend 'success' only proves the send was accepted — not that the login address (often on a custom domain) is a real, checked mailbox. Enter an address you can check right now.",
                    "Resend'in 'başarılı' demesi sadece gönderimin kabul edildiğini kanıtlar — giriş adresinin (genelde kendi alan adında) gerçekten kontrol edilen bir kutu olduğunu değil. Şimdi hemen kontrol edebileceğiniz bir adres girin."
                  )}
                </p>
              </div>
              <button
                onClick={sendTestEmail}
                disabled={testEmailState === "sending"}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none"
              >
                <Send className="h-3.5 w-3.5" />
                {testEmailState === "sending"
                  ? t("Versturen…", "Sending…", "Gönderiliyor…")
                  : testEmailTo.trim()
                  ? t(`Testmail sturen naar ${testEmailTo.trim()}`, `Send test e-mail to ${testEmailTo.trim()}`, `${testEmailTo.trim()} adresine test e-postası gönder`)
                  : t("Testmail naar mijn eigen e-mailadres sturen", "Send test e-mail to my own address", "Kendi e-posta adresime test e-postası gönder")}
              </button>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {t(
                  "Test de daadwerkelijke bezorging (niet alleen of de sleutel aanwezig is) — een ongeldige sleutel of een niet-geverifieerd afzenderdomein faalt pas hier.",
                  "Tests actual delivery (not just whether the key is present) — an invalid key or unverified sender domain only fails here.",
                  "Gerçek teslimatı test eder (sadece anahtarın var olup olmadığını değil) — geçersiz bir anahtar veya doğrulanmamış gönderen alan adı ancak burada başarısız olur."
                )}
              </p>
            </div>
          </div>
        )}
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

        <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-900 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto shadow-inner relative">
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
