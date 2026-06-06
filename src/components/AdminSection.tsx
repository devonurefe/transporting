/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  BarChart3, 
  Layers, 
  Settings, 
  PlusCircle, 
  FolderLock, 
  Truck, 
  ShieldAlert,
  LogIn,
  Terminal,
  ShieldCheck,
  Calendar,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { useLanguageStore } from "../store/languageStore";

// Import modular sub-components
import AdminDashboard from "./admin/AdminDashboard";
import AdminOrders from "./admin/AdminOrders";
import AdminMachines from "./admin/AdminMachines";
import AdminCalendar from "./admin/AdminCalendar";
import AdminAddMachine from "./admin/AdminAddMachine";
import AdminCustomizer from "./admin/AdminCustomizer";
import AdminLogs from "./admin/AdminLogs";
import AdminDiagnostics from "./admin/AdminDiagnostics";
import AdminAccounting from "./admin/AdminAccounting";

interface AdminSectionProps {
  isAdminMode: boolean;
  setIsAdminMode: (adminMode: boolean) => void;
  userProfiles?: UserProfile[];
  systemLogs: any[];
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  onClearSystemLogs: () => void;
}

export default function AdminSection({
  isAdminMode,
  setIsAdminMode,
  userProfiles,
  systemLogs,
  onAddSystemLog,
  onClearSystemLogs,
}: AdminSectionProps) {
  const [subTab, setSubTab] = useState<"dashboard" | "orders" | "machines" | "calendar" | "add" | "logs" | "customizer" | "diagnostics" | "accounting">("dashboard");
  const [showAdvancedSubmenu, setShowAdvancedSubmenu] = useState<boolean>(false);

  React.useEffect(() => {
    if (["add", "customizer", "accounting", "diagnostics", "logs"].includes(subTab)) {
      setShowAdvancedSubmenu(true);
    }
  }, [subTab]);

  const { login, logout } = useAuthStore();
  const machines = useAppStore((state) => state.machines);
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);
  
  const adminLanguage = useLanguageStore((state) => state.adminLanguage);
  const setAdminLanguage = useLanguageStore((state) => state.setAdminLanguage);
  const tAdmin = useLanguageStore((state) => state.tAdmin);

  // Admin login credentials
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleAdminVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      alert("E-mailadres en wachtwoord zijn verplicht.");
      return;
    }

    const success = await login(adminEmail, adminPassword);
    if (success) {
      const user = useAuthStore.getState().user;
      if (user && user.role === "admin") {
        setIsAdminMode(true);
        onAddSystemLog(
          "login", 
          "HuurGo Admin", 
          "Beheersessie verbonden met beveiligd beheerderstoken."
        );
      } else {
        logout();
        setIsAdminMode(false);
        alert("Toegang geweigerd. Dit account heeft geen beheerdersrechten.");
      }
    } else {
      const errorMsg = useAuthStore.getState().error || "Fout bij beheerdersinlog.";
      alert(`Inloggen mislukt: ${errorMsg}`);
    }
  };

  // If Owner is NOT logged into Admin mode, display secure login gateway
  if (!isAdminMode) {
    return (
      <div className="relative min-h-[calc(100vh-4.5rem)] py-16 px-5 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-orange-600/3 blur-[120px] -z-10" />

        <div className="w-full max-w-md bg-slate-900/60 p-8 rounded-3xl border border-white/5 space-y-6 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Eigenaarsportaal Login</h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Beveiligde console voor de bedrijfseigenaar om de volledige vloot en actieve gebruikersstromen te overzien.
            </p>
          </div>

          <form onSubmit={handleAdminVerifyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-350 tracking-wider uppercase font-mono">Beheerder E-mail</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-medium h-10 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="text-[11px] font-bold text-slate-350 tracking-wider uppercase">Beveiligd Wachtwoord</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-medium h-10 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] active:scale-99 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>Verbinding Maken (Accederen)</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              Beveiligde toegang voor geautoriseerde beheerders
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] py-4 sm:py-8 px-5 sm:px-6 lg:px-8">
      
      {/* Absolute Neon Grid lines decorative */}
      <div className="absolute top-1/2 left-1/3 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px] -z-10" />

      <div className="mx-auto max-w-7xl">
        
        {/* Workspace Title bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-amber-200 pb-3 sm:pb-5 mb-4 sm:mb-8">
          <div>
            <h1 className="font-display text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center space-x-2">
              <FolderLock className="h-5 w-5 sm:h-6.5 sm:w-6.5 text-amber-500" />
              <span>{tAdmin("adminPortalTitle")}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 sm:mt-2">
              {tAdmin("adminPortalSubtitle")}
            </p>
          </div>

          <div className="flex items-center space-x-3.5 mt-3 sm:mt-0">
            {/* Dedicated Admin Language Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
              {(["nl", "en", "tr"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setAdminLanguage(lang)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border-none ${
                    adminLanguage === lang
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-xs text-amber-800 font-bold shadow-xs">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>{tAdmin("adminSecure")}</span>
            </div>
          </div>
        </div>

        {/* Outer Split layout: Left sidebar switch, right tables/workspaces */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-panel p-2 sm:p-4 rounded-2xl flex flex-row lg:flex-col lg:space-y-1 overflow-x-auto lg:overflow-x-visible gap-1 pb-2 lg:pb-4 scrollbar-none flex-nowrap scroll-smooth">
              
              {/* MVP Core tabs */}
              {[
                { id: "dashboard", label: tAdmin("adminTabDashboard"), icon: BarChart3 },
                { id: "orders", label: tAdmin("adminTabOrders"), icon: Truck, count: orders.length },
                { id: "machines", label: tAdmin("adminTabMachines"), icon: Layers, count: machines.length },
                { id: "calendar", label: tAdmin("adminTabCalendar"), icon: Calendar, count: blockedDates.length }
              ].map((sub) => {
                const Icon = sub.icon;
                const isSel = subTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSubTab(sub.id as any)}
                    className={`flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-left text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-initial cursor-pointer border-none ${
                      isSel 
                        ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-500/20 shadow-[0_4px_12px_rgba(245,158,11,0.25)]" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent bg-transparent"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4.5 w-4.5 ${isSel ? "text-slate-950" : "text-amber-500/80"}`} />
                      <span>{sub.label}</span>
                    </div>
                    {sub.count !== undefined && (
                      <span className={`hidden lg:inline-block font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-600"}`}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Geavanceerd Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedSubmenu(!showAdvancedSubmenu)}
                className={`flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-left text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-initial cursor-pointer border-none ${
                  ["add", "customizer", "accounting", "diagnostics", "logs"].includes(subTab)
                    ? "bg-slate-100 text-slate-900 border border-slate-200" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent bg-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Settings className="h-4.5 w-4.5 text-amber-500/80" />
                  <span>Geavanceerd</span>
                </div>
                <span className="text-[10px] text-slate-450 ml-1">{showAdvancedSubmenu ? "▼" : "▶"}</span>
              </button>

              {/* Advanced sub tabs */}
              {showAdvancedSubmenu && [
                { id: "add", label: tAdmin("adminTabAdd"), icon: PlusCircle },
                { id: "customizer", label: tAdmin("adminTabCustomizer"), icon: Settings },
                { id: "accounting", label: adminLanguage === "tr" ? "Muhasebe (Exact)" : adminLanguage === "en" ? "Accounting (Exact)" : "Boekhouding (Exact)", icon: Database },
                { id: "diagnostics", label: adminLanguage === "tr" ? "Sistem Teşhisi" : adminLanguage === "en" ? "System Diagnostics" : "Systeemdiagnose", icon: ShieldAlert },
                { id: "logs", label: tAdmin("adminTabLogs"), icon: Terminal, count: systemLogs.length }
              ].map((sub) => {
                const Icon = sub.icon;
                const isSel = subTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSubTab(sub.id as any)}
                    className={`flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-left text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-initial cursor-pointer border-none pl-5 sm:pl-7 ${
                      isSel 
                        ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-500/20 shadow-[0_4px_12px_rgba(245,158,11,0.25)]" 
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent bg-transparent"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4.5 w-4.5 ${isSel ? "text-slate-950" : "text-amber-500/60"}`} />
                      <span>{sub.label}</span>
                    </div>
                    {sub.count !== undefined && (
                      <span className={`hidden lg:inline-block font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-500"}`}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* Live website indicators */}
            <div className="glass-panel p-4.5 rounded-2xl hidden lg:block space-y-3">
              <h4 className="font-display font-bold text-[10px] uppercase text-slate-500 tracking-wider">BMWT Status</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Server Gateway</span>
                  <span className="text-teal-600 font-semibold flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    <span className="font-mono">ONLINE</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>SSL Handshake</span>
                  <span className="text-teal-600 font-semibold font-mono">SECURE</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Fleet Availability</span>
                  <span className="text-slate-800 font-mono font-bold">100% Gecertificeerd</span>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONFIG VIEWPORT */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {subTab === "dashboard" && (
                <AdminDashboard key="dashboard" setSubTab={setSubTab} adminLanguage={adminLanguage} />
              )}
              {subTab === "orders" && (
                <AdminOrders key="orders" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
              )}
              {subTab === "machines" && (
                <AdminMachines key="machines" setSubTab={setSubTab} onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
              )}
              {subTab === "calendar" && (
                <AdminCalendar key="calendar" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
              )}
              {subTab === "add" && (
                <AdminAddMachine key="add" setSubTab={setSubTab} onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
              )}
              {subTab === "customizer" && (
                <AdminCustomizer key="customizer" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
              )}
              {subTab === "accounting" && (
                <AdminAccounting key="accounting" adminLanguage={adminLanguage} />
              )}
              {subTab === "diagnostics" && (
                <AdminDiagnostics 
                  key="diagnostics" 
                  systemLogs={systemLogs} 
                  userProfiles={userProfiles || []} 
                  onAddSystemLog={onAddSystemLog} 
                  adminLanguage={adminLanguage}
                />
              )}
              {subTab === "logs" && (
                <AdminLogs 
                  key="logs" 
                  systemLogs={systemLogs} 
                  onClearSystemLogs={onClearSystemLogs} 
                  userProfiles={userProfiles || []} 
                  onAddSystemLog={onAddSystemLog} 
                  adminLanguage={adminLanguage}
                />
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
}
