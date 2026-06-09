/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Link2, Link2Off, RefreshCw, CheckCircle2, AlertCircle, FileText, Database, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useLanguageStore } from "../../store/languageStore";

interface AdminAccountingProps {
  key?: string;
  adminLanguage?: string;
}

export default function AdminAccounting({ adminLanguage }: AdminAccountingProps) {
  const [isConnected, setIsConnected] = useState(true);
  const [clientId, setClientId] = useState("ex-online-client-id-88492");
  const [clientSecret, setClientSecret] = useState("••••••••••••••••••••••••••••••••");
  const [division, setDivision] = useState("124092"); // Default division code for HuurGo Nederland
  const [autoSync, setAutoSync] = useState(true);
  const [autoEmail, setAutoEmail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const [syncLogs, setSyncLogs] = useState([
    {
      id: "sync-1",
      orderId: "HWH-9921",
      customer: "Jan de Vries",
      amount: "€671,55",
      status: "success",
      message: "Verkoopboeking aangemaakt in Exact dagboek 70 (Verkoop). Account 'Jan de Vries' gematcht.",
      timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
    },
    {
      id: "sync-2",
      orderId: "HWH-9918",
      customer: "Sven van der Meer",
      amount: "€193,60",
      status: "success",
      message: "Relatie aangemaakt & Verkoopboeking verzonden naar Exact Online divisie 124092.",
      timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString()
    }
  ]);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const handleManualSync = () => {
    if (!isConnected) {
      setSyncFeedback(t("Fout: Geen actieve verbinding met Exact Online.", "Error: No active connection to Exact Online.", "Hata: Exact Online ile aktif bağlantı bulunamadı."));
      return;
    }
    setIsSyncing(true);
    setSyncFeedback(null);

    setTimeout(() => {
      setIsSyncing(false);
      const newLog = {
        id: `sync-${Date.now()}`,
        orderId: `HWH-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: "Mila Visser",
        amount: "€90,00",
        status: "success",
        message: "Factuur handmatig gesynchroniseerd met verkoopboek. Relatienummer match: ACC-39402.",
        timestamp: new Date().toISOString()
      };
      setSyncLogs(prev => [newLog, ...prev]);
      setSyncFeedback(t("Synchronisatie succesvol afgerond!", "Synchronization completed successfully!", "Senkronizasyon başarıyla tamamlandı!"));
    }, 1200);
  };

  const handleToggleConnection = () => {
    setIsConnected(prev => !prev);
    setSyncFeedback(null);
  };

  return (
    <motion.div
      key="accounting-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Connection & Setup Configuration */}
        <div className="lg:col-span-5 glass-panel p-5.5 rounded-3xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <Database className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="font-display font-bold text-sm text-slate-900">
                {t("Exact Online Koppeling", "Exact Online Integration", "Exact Online Bağlantısı")}
              </h3>
            </div>
            
            <button
              onClick={handleToggleConnection}
              className={`text-[10px] font-extrabold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center space-x-1 ${
                isConnected 
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700" 
                  : "bg-slate-100 hover:bg-slate-200 border-slate-250 text-slate-700"
              }`}
            >
              {isConnected ? (
                <>
                  <Link2 className="h-3 w-3" />
                  <span>{t("Gekoppeld", "Connected", "Bağlı")}</span>
                </>
              ) : (
                <>
                  <Link2Off className="h-3 w-3" />
                  <span>{t("Ontkoppeld", "Disconnected", "Bağlantı Kesildi")}</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11.5px] text-slate-500 leading-normal space-y-2">
            <p>
              {t(
                "Koppel uw HuurGo administratie in real-time met de Exact Online API om verkoopfacturen en debiteuren automatisch te boeken.",
                "Connect your HuurGo administration in real-time with the Exact Online API to automatically post sales invoices and debtors.",
                "HuurGo muhasebe kayıtlarınızı, satış faturalarını ve cari kartları otomatik işlemek için Exact Online API ile gerçek zamanlı bağlayın."
              )}
            </p>
            {isConnected && (
              <div className="flex items-center space-x-1.5 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-850 text-emerald-800 text-[10.5px]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>OAuth 2.5 API Token is momenteel actief en stabiel.</span>
              </div>
            )}
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                {t("Divisie Nummer (Exact Division ID)", "Division Number (Exact Division ID)", "Şube / Divizyon Kodu")}
              </label>
              <input
                type="text"
                value={division}
                disabled={!isConnected}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 h-9 transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                disabled={!isConnected}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 h-9 transition-all disabled:opacity-50 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                disabled={!isConnected}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 h-9 transition-all disabled:opacity-50"
              />
            </div>

            {/* Checkboxes parameters */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  disabled={!isConnected}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4 shrink-0"
                />
                <span className="text-xs text-slate-700 font-medium select-none">
                  {t("Automatisch facturen doorsturen", "Automatically sync sales invoices", "Faturaları otomatik senkronize et")}
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEmail}
                  disabled={!isConnected}
                  onChange={(e) => setAutoEmail(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4 shrink-0"
                />
                <span className="text-xs text-slate-700 font-medium select-none">
                  {t("E-mail factuur direct vanuit Exact", "E-mail invoice directly from Exact", "Faturayı doğrudan Exact üzerinden e-postala")}
                </span>
              </label>
            </div>
          </form>
        </div>

        {/* Right Column: Real-time logs and Sync commands */}
        <div className="lg:col-span-7 glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="font-display font-bold text-sm text-slate-900">
                {t("Synchronisatie Logboek", "Synchronization Logs", "Senkronizasyon Günlüğü")}
              </h3>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-[10.5px] px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 border-none h-8.5 shadow-sm active:scale-97"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{t("Handmatig Syncken", "Sync Now", "Şimdi Eşitle")}</span>
            </button>
          </div>

          {syncFeedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 animate-fade-in ${
              syncFeedback.includes("Fout") || syncFeedback.includes("Error") || syncFeedback.includes("Hata")
                ? "bg-rose-50 border-rose-150 text-rose-800"
                : "bg-emerald-50 border-emerald-150 text-emerald-800"
            }`}>
              {syncFeedback.includes("Fout") || syncFeedback.includes("Error") || syncFeedback.includes("Hata") ? (
                <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              )}
              <span>{syncFeedback}</span>
            </div>
          )}

          {/* Sync logs timeline list */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {syncLogs.map((log) => {
              return (
                <div 
                  key={log.id} 
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 hover:border-slate-350 transition-colors shadow-sm"
                >
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shrink-0 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-extrabold text-slate-800 font-mono">
                        {log.orderId} ({log.customer})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString("nl-NL")}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 leading-relaxed">
                      {log.message}
                    </p>
                    <div className="flex justify-between items-center pt-1 text-[9.5px]">
                      <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100/55 px-1.5 py-0.2 rounded-md">
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-slate-800 font-extrabold">
                        {log.amount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
