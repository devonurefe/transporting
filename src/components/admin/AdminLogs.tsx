/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Terminal, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile } from "../../types";

interface AdminLogsProps {
  key?: string;
  systemLogs: any[];
  onClearSystemLogs: () => void;
  userProfiles: UserProfile[];
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminLogs({ systemLogs, onClearSystemLogs, userProfiles, onAddSystemLog, adminLanguage }: AdminLogsProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  return (
    <motion.div
      key="logs-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Log entries feed column */}
        <div className="md:col-span-7 glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-amber-600" />
              <h3 className="font-display font-bold text-sm text-slate-900">{t("Systeemactiviteit (In- & Uitlog Logs)", "System Activity (Login & Logout Logs)", "Sistem Aktiviteleri (Giriş & Çıkış Günlükleri)")}</h3>
            </div>
            {systemLogs.length > 0 && (
              <button
                onClick={onClearSystemLogs}
                className="text-[10px] font-extrabold text-slate-600 hover:text-rose-600 flex items-center space-x-1 border border-slate-200 bg-slate-50 hover:bg-rose-50 py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>{t("Schoonmaken", "Clear Logs", "Günlükleri Temizle")}</span>
              </button>
            )}
          </div>

          <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-950 space-y-3 font-mono text-xs max-h-[200px] sm:max-h-96 overflow-y-auto scrollbar-thin">
            {systemLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                {t("Geen logdata beschikbaar. Simuleer acties rechts!", "No log data available. Simulate actions on the right!", "Kayıtlı sistem günlüğü bulunamadı. Sağ taraftan simülasyon yapabilirsiniz!")}
              </div>
            ) : (
              systemLogs.map((log) => {
                let typeColor = "text-amber-400 bg-amber-500/10 border border-amber-500/15";
                if (log.type === "login") typeColor = "text-blue-400 bg-blue-500/10 border border-blue-500/15";
                if (log.type === "logout") typeColor = "text-rose-400 bg-rose-500/10 border border-rose-500/15";
                if (log.type === "booking") typeColor = "text-teal-400 bg-teal-500/10 border border-teal-500/15";
                if (log.type === "fleet") typeColor = "text-indigo-400 bg-indigo-500/10 border border-indigo-500/15";
                if (log.type === "status") typeColor = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/15";

                return (
                  <div key={log.id} className="p-2.5 rounded-xl bg-white/2 hover:bg-white/4 border border-white/3 transition-colors flex items-start space-x-2">
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0 mt-0.5 ${typeColor}`}>
                      {log.type}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="text-slate-200 font-medium leading-relaxed">
                        <span className="text-indigo-300 font-bold mr-1">{log.user}:</span>
                        {log.description}
                      </div>
                      <div className="text-[9.5px] text-slate-500 flex items-center justify-between font-mono pt-0.5">
                        <span>Time: {new Date(log.timestamp).toLocaleTimeString("nl-NL")}</span>
                        <span>Date: {new Date(log.timestamp).toLocaleDateString("nl-NL")}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active accounts status controller */}
        <div className="md:col-span-5 glass-panel p-5 rounded-3xl space-y-4">
          <div>
            <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center space-x-1">
              <Users className="h-4 w-4 text-amber-600" />
              <span>{t("Bezoekers & Klantactiviteit", "Visitor & Customer Activity", "Ziyaretçi & Müşteri Aktiviteleri")}</span>
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
              {t("Als eigenaar kunt u direct loggebeurtenissen simuleren om uw verbindingen te testen. Klik op de in-/uitlog triggers hieronder om direct de live logs feed te injecteren conform uw specificatie!", "As the owner, you can directly simulate log events to test your connections. Click the login/logout triggers below to inject the live logs feed directly according to your specification!", "Yönetici olarak bağlantılarınızı test etmek için doğrudan günlük olaylarını simüle edebilirsiniz. Belirttiğiniz özelliklere göre canlı günlük akışını doğrudan enjekte etmek için aşağıdaki giriş/çıkış tetikleyicilerine tıklayın!")}
            </p>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            {userProfiles.map((p) => {
              return (
                <div key={p.id} className="p-3 bg-slate-50 rounded-xl space-y-2.5 border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const fallback = el.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="h-6 w-6 rounded-full bg-amber-500 text-white text-[9px] font-black items-center justify-center shrink-0"
                        style={{ display: p.avatarUrl ? "none" : "flex" }}
                        aria-hidden="true"
                      >
                        {(p.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-800 leading-none">{p.name}</h5>
                        <span className="text-[9px] text-slate-500 mt-0.5 inline-block">{p.profileType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      onClick={() => {
                        onAddSystemLog("login", p.name, t("Klant heeft ingelogd op de website (Gezamenlijke sessie geopend via IP-check).", "Customer has logged into the website (Shared session opened via IP check).", "Müşteri web sitesine giriş yaptı (IP kontrolü ile ortak oturum açıldı)."));
                      }}
                      className="py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 text-[9.5px] font-bold text-blue-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <UserCheck className="h-3 w-3 shrink-0" />
                      <span>{t("Inlog Log", "Login Log", "Giriş Günlüğü")}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        onAddSystemLog("logout", p.name, t("Klant heeft zich uitgelogd en de sessie is beëindigd.", "Customer has logged out and the session has ended.", "Müşteri çıkış yaptı ve oturum sonlandırıldı."));
                      }}
                      className="py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-[9.5px] font-bold text-rose-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <UserX className="h-3 w-3 shrink-0" />
                      <span>{t("Uitlog Log", "Logout Log", "Çıkış Günlüğü")}</span>
                    </button>
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
