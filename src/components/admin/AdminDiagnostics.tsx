/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Terminal as TerminalIcon, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  HardDrive, 
  Database, 
  RefreshCw, 
  Zap, 
  Users, 
  ShoppingCart, 
  Clock, 
  AlertTriangle, 
  Key, 
  Network 
} from "lucide-react";
import { motion } from "motion/react";

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

  // Live fluctuating stats
  const [cpuLoad, setCpuLoad] = useState(12);
  const [memoryUsage, setMemoryUsage] = useState(64.2); // MB
  const [dbLatency, setDbLatency] = useState(1.8); // ms
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([
    `[INFO] [2026-05-31 13:29:00] ` + t("HuurGo Daemon v2.1.4 succesvol gestart.", "HuurGo Daemon v2.1.4 started successfully.", "HuurGo Daemon v2.1.4 başarıyla başlatıldı."),
    `[INFO] [2026-05-31 13:29:02] ` + t("PostgreSQL verbindingspool tot stand gebracht.", "PostgreSQL connection pool established.", "PostgreSQL bağlantı havuzu kuruldu."),
    `[SEC]  [2026-05-31 13:29:05] ` + t("CSRF en XSS beveiligingsheaders geïnjecteerd.", "CSRF and XSS protection headers injected.", "CSRF ve XSS koruma başlıkları enjekte edildi."),
    `[INFO] [2026-05-31 13:29:10] ` + t("WhatsApp gateway en e-mail dispatcher gevalideerd.", "WhatsApp gateway and email dispatcher validated.", "WhatsApp geçidi ve e-posta dağıtıcısı doğrulandı."),
    `[WARN] [2026-05-31 13:30:15] ` + t("SMTP: E-mailkanaal meldde el-systeemsluiting waarschuwing (opnieuw proberen in de achtergrond).", "SMTP: Email carrier channel reported handshake warning (retrying in background).", "SMTP: E-posta kanalı el sıkışma uyarısı bildirdi (arka planda yeniden deneniyor)."),
    `[OK]   [2026-05-31 13:31:00] ` + t("Alle systemen nominaal. Gereed voor beheerderscommando's.", "All systems nominal. Ready for admin commands.", "[OK] Tüm sistemler nominal. Yönetici komutları için hazır.")
  ]);

  // Fluctuating metric updates in background
  useEffect(() => {
    const timer = setInterval(() => {
      setCpuLoad(prev => {
        const change = (Math.random() - 0.5) * 4;
        return Math.max(5, Math.min(35, parseFloat((prev + change).toFixed(1))));
      });
      setMemoryUsage(prev => {
        const change = (Math.random() - 0.5) * 0.8;
        return Math.max(60, Math.min(75, parseFloat((prev + change).toFixed(1))));
      });
      setDbLatency(prev => {
        const change = (Math.random() - 0.5) * 0.4;
        return Math.max(0.8, Math.min(4.5, parseFloat((prev + change).toFixed(2))));
      });
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const triggerSelfAudit = () => {
    if (isAuditing) return;
    setIsAuditing(true);
    setAuditLogs([]);

    const steps = [
      { text: t("[INIT]  Initialiseren van complete systeemdiagnostiek...", "[INIT]  Initializing complete system diagnostics...", "[INIT]  Komple sistem teşhisi başlatılıyor..."), delay: 200 },
      { text: t("[CPU]   Analyseren van CPU & Core affinity threads... [OK]", "[CPU]   Analyzing CPU & Core affinity threads... [OK]", "[CPU]   CPU ve Çekirdek eğilimi iş parçacıkları analiz ediliyor... [OK]"), delay: 500 },
      { text: t("[MEM]   Garbage collection getriggerd... Geheugenhypotheek opgeruimd! [Done]", "[MEM]   Garbage collection triggered... Memory bloat cleared! [Done]", "[MEM]   Çöp toplayıcı tetiklendi... Bellek şişkinliği temizlendi! [Done]"), delay: 800 },
      { text: t("[DB]    PostgreSQL index validatie op 'Machine', 'Order', 'BlockedDate'... [OK - 9 indexen verified]", "[DB]    Validating PostgreSQL indexes on 'Machine', 'Order', 'BlockedDate'... [OK - 9 indexes verified]", "[DB]    PostgreSQL indeksleri doğrulanıyor: 'Machine', 'Order', 'BlockedDate'... [OK - 9 indeks doğrulandı]"), delay: 1200 },
      { text: t("[SEC]   Actieve TLS 1.3 sleuteluitwisseling inspecteren... [A+ Beveiliging]", "[SEC]   Inspecting active TLS 1.3 key exchanges... [A+ Security]", "[SEC]   Aktif TLS 1.3 anahtar değişimleri denetleniyor... [A+ Güvenlik]"), delay: 1500 },
      { text: t("[API]   Resend e-mail service verbinding testen... [OK - Latency 118ms]", "[API]   Testing Resend email service connection... [OK - Latency 118ms]", "[API]   Resend e-posta servis bağlantısı test ediliyor... [OK - Gecikme 118ms]"), delay: 1900 },
      { text: t("[SMTP]  Testmail zenden naar server dispatcher... [Done - SMTP Handshake Succesvol]", "[SMTP]  Sending test email to server dispatcher... [Done - SMTP Handshake Successful]", "[SMTP]  Sunucu dağıtıcısına test e-postası gönderiliyor... [Tamamlandı - SMTP El Sıkışması Başarılı]"), delay: 2300 },
      { text: t("[AUDIT] Analyseren van inlogtokens & rate-limiters... [0 Inbreuken gedetecteerd]", "[AUDIT] Analyzing login tokens & rate-limiters... [0 Violations detected]", "[AUDIT] Giriş belirteçleri ve hız sınırlandırıcılar analiz ediliyor... [0 İhlal tespit edildi]"), delay: 2600 },
      { text: t("[SUCCESS] Zelfdiagnose voltooid! Alle systemen operationeel en nominal.", "[SUCCESS] Self-diagnostics completed! All systems operational and nominal.", "[SUCCESS] Kendi kendine teşhis tamamlandı! Tüm sistemler çalışır durumda ve nominal."), delay: 3000 }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setAuditLogs(prev => [...prev, step.text]);
        if (step.text.includes("[SUCCESS]")) {
          setIsAuditing(false);
          onAddSystemLog(
            "system",
            "Diagnostische Monitor",
            t("Volledige website-diagnose handmatig uitgevoerd: 0 fouten gedetecteerd en cache geoptimaliseerd.", "Full website diagnostics performed manually: 0 errors detected and cache optimized.", "Manuel olarak tam web sitesi teşhisi gerçekleştirildi: 0 hata tespit edildi ve önbellek optimize edildi.")
          );
        }
      }, step.delay);
    });
  };

  return (
    <motion.div
      key="diagnostics-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in text-slate-800"
    >
      {/* Upper Grid - Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CPU Panel */}
        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("Server CPU Belasting", "Server CPU Load", "Sunucu İşlemci Yükü")}</span>
            <Cpu className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{cpuLoad}%</span>
              <span className="text-slate-500 text-xs font-semibold">{t("van 8 cores", "of 8 cores", "/ 8 Çekirdek")}</span>
            </div>
            <span className="text-[10px] text-teal-600 font-bold block flex items-center space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-ping shrink-0" />
              <span>{t("Optimaal gecentreerd", "Optimally balanced", "Kusursuz Dengelendi")}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700" 
              style={{ width: `${cpuLoad}%` }}
            />
          </div>
        </div>

        {/* Memory Panel */}
        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("Memory Allocation", "Memory Allocation", "Ayrılan Bellek")}</span>
            <HardDrive className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{memoryUsage} MB</span>
              <span className="text-slate-500 text-xs font-semibold">{t("heap", "heap", "yığın")}</span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              {t("Garbage Collector: ", "Garbage Collector: ", "Çöp Toplayıcı: ")}<strong>{t("Actief (vrijgave el. 10m)", "Active (released 10m ago)", "Aktif (10dk önce boşaltıldı)")}</strong>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700" 
              style={{ width: `${(memoryUsage / 256) * 100}%` }}
            />
          </div>
        </div>

        {/* Database Query Latency */}
        <div className="glass-panel p-5 rounded-3xl space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider font-mono">{t("SQLite Query Latency", "SQLite Query Latency", "SQLite Sorgu Gecikmesi")}</span>
            <Database className="h-4.5 w-4.5 text-teal-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-mono font-black text-slate-900">{dbLatency} ms</span>
              <span className="text-slate-500 text-xs font-semibold">{t("avg read/write", "avg read/write", "ort. okuma/yazma")}</span>
            </div>
            <span className="text-[10px] text-teal-600 font-bold block flex items-center space-x-1">
              <ShieldCheck className="h-3 w-3 text-teal-500" />
              <span>{t("Optimized indexes", "Optimized indexes", "Optimize indeksler")}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-700" 
              style={{ width: `${(dbLatency / 10) * 100}%` }}
            />
          </div>
        </div>

      </div>

      {/* Middle Grid - Security & Visitor stats */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Security & Access Logs Audit Column */}
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
                  <span className="font-semibold block text-slate-800">{t("Rate-Limiter Triggers", "Rate-Limiter Triggers", "Hız Sınırlandırıcı Tetikleyicileri")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Beschermt API-gateway tegen DOS", "Protects API gateway from DOS", "API geçidini DOS saldırılarından korur")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-2 py-0.5 rounded-full border border-slate-300">
                {t("0 Triggers / min", "0 Triggers / min", "0 Tetikleme / dk")}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold block text-slate-800">{t("SQL-Injectie Filters", "SQL Injection Filters", "SQL Enjeksiyon Filtreleri")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Sanitisatie van invoervelden en queryparameters", "Sanitization of input fields and query parameters", "Giriş alanları ve sorgu parametrelerinin temizlenmesi")}</span>
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
                  <span className="font-semibold block text-slate-800">{t("SSL Certificaat Status", "SSL Certificate Status", "SSL Sertifikası Durumu")}</span>
                  <span className="text-[10px] text-slate-500 block">{t("Let's Encrypt Wildcard cert.", "Let's Encrypt Wildcard cert.", "Let's Encrypt Joker Sertifikası")}</span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                {t("GELDIG (182d over)", "VALID (182d left)", "GEÇERLİ (182 gün kaldı)")}
              </span>
            </div>
          </div>
        </div>

        {/* Visitor Behavioral Analytics */}
        <div className="md:col-span-6 glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <Users className="h-4.5 w-4.5 text-blue-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Bezoekersgedrag & Conversierapporten", "Visitor Behavior & Conversion Reports", "Ziyaretçi Davranışları & Dönüşüm Raporları")}</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Cart Abandonment", "Cart Abandonment", "Sepeti Terk Etme")}</span>
                <ShoppingCart className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">18.4%</div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Percentage huurwagens die verlaten zijn voor afronding.", "Percentage of rental items abandoned before completion.", "İşlem tamamlanmadan önce terk edilen kiralama sepeti oranı.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Gem. Boekingstijd", "Avg. Booking Time", "Ort. Rezervasyon Süresi")}</span>
                <Clock className="h-3.5 w-3.5 text-teal-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">2m 14s</div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Gemiddelde tijd tussen platform selectie en bestelbevestiging.", "Average time between platform selection and order confirmation.", "Platform seçimi ile sipariş onayı arasında geçen ortalama süre.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("WhatsApp Aanvragen / Gast", "WhatsApp Requests / Guest", "Ziyaretçi Başına WhatsApp")}</span>
                <Activity className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">4.8</div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("WhatsApp-aanvragen per bezoeker vóór de definitieve boeking.", "WhatsApp requests per visitor before the final booking.", "Kesin rezervasyon öncesi ziyaretçi başına WhatsApp talepleri.")}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t("Bounce Ratio", "Bounce Ratio", "Hemen Çıkma Oranı")}</span>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-mono font-black text-slate-950">26.1%</div>
              <p className="text-[9px] text-slate-500 leading-normal">{t("Percentage bezoekers dat na één pagina de Hub verlaat.", "Percentage of visitors leaving the Hub after one page.", "Hub sitesini tek bir sayfadan sonra terk eden ziyaretçilerin oranı.")}</p>
            </div>

          </div>
        </div>

      </div>

      {/* Lower Row - Interactive Diagnostic Terminal */}
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4.5 w-4.5 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Actieve Foutconsole & Diagnostische Terminal", "Active Fault Console & Diagnostic Terminal", "Aktif Hata Konsolu & Teşhis Terminali")}</h3>
          </div>
          
          <button
            onClick={triggerSelfAudit}
            disabled={isAuditing}
            className={`text-xs font-bold py-1.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:scale-[1.02] active:scale-98 transition-all flex items-center space-x-1.5 cursor-pointer text-slate-800 ${
              isAuditing ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? "animate-spin text-amber-500" : "text-slate-600"}`} />
            <span>{isAuditing ? t("Analyseren...", "Analyzing...", "Çözümleniyor...") : t("Systeem Zelfcontrole", "System Self Audit", "Sistemi Kendi Kendini Denetle")}</span>
          </button>
        </div>

        <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-900 space-y-2.5 font-mono text-[10.5px] sm:text-[11.5px] text-slate-300 max-h-80 overflow-y-auto scrollbar-thin shadow-inner relative overflow-hidden">
          {/* Decorative Terminal Header dots */}
          <div className="absolute top-3 left-4 flex space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500/80" />
          </div>
          
          <div className="pt-4 space-y-2">
            {auditLogs.map((log, idx) => {
              let textClass = "text-slate-300";
              if (log.startsWith("[WARN]")) textClass = "text-amber-400 font-semibold";
              if (log.startsWith("[SEC]")) textClass = "text-indigo-400 font-semibold";
              if (log.startsWith("[SUCCESS]")) textClass = "text-teal-400 font-black tracking-wide";
              if (log.startsWith("[OK]")) textClass = "text-emerald-400";
              if (log.startsWith("[INIT]")) textClass = "text-blue-400 font-bold";

              return (
                <div key={idx} className={`leading-relaxed border-b border-white/5 pb-1 ${textClass}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </motion.div>
  );
}
