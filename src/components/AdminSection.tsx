/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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
  CalendarDays,
  CalendarRange,
  Database,
  Users,
  BookOpen,
  FileText,
  Wrench
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { useLanguageStore } from "../store/languageStore";

import AdminAvailabilityWidget from "./admin/AdminAvailabilityWidget";
import { AdminToastHost, showAdminToast } from "./admin/AdminToast";

// Lazy load modular sub-components for code splitting and better initial bundle load performance
const AdminDashboard = React.lazy(() => import("./admin/AdminDashboard"));
const AdminOrders = React.lazy(() => import("./admin/AdminOrders"));
const AdminMachines = React.lazy(() => import("./admin/AdminMachines"));
const AdminCalendar = React.lazy(() => import("./admin/AdminCalendar"));
const AdminAddMachine = React.lazy(() => import("./admin/AdminAddMachine"));
const AdminCustomizer = React.lazy(() => import("./admin/AdminCustomizer"));
const AdminLogs = React.lazy(() => import("./admin/AdminLogs"));
const AdminUsers = React.lazy(() => import("./admin/AdminUsers"));
const AdminContent = React.lazy(() => import("./admin/AdminContent"));
const AdminDiagnostics = React.lazy(() => import("./admin/AdminDiagnostics"));
const AdminAccounting = React.lazy(() => import("./admin/AdminAccounting"));
const AdminPlanning = React.lazy(() => import("./admin/AdminPlanning"));
const AdminRentalTimeline = React.lazy(() => import("./admin/AdminRentalTimeline"));
const AdminCustomers = React.lazy(() => import("./admin/AdminCustomers"));
const AdminBlog = React.lazy(() => import("./admin/AdminBlog"));
const AdminMaintenance = React.lazy(() => import("./admin/AdminMaintenance"));

function AdminLoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
      <p className="text-xs text-slate-500 font-semibold tracking-wide animate-pulse">
        Beheerpaneel laden...
      </p>
    </div>
  );
}

// Alle admin-subtabs — panelen die setSubTab als prop krijgen importeren dit
// type zodat de unions niet uit elkaar lopen.
export type AdminSubTab =
  | "dashboard" | "orders" | "machines" | "calendar" | "planning" | "timeline" | "customers"
  | "add" | "blog" | "logs" | "customizer" | "diagnostics" | "accounting" | "users" | "content" | "maintenance";

const ADVANCED_TAB_IDS: AdminSubTab[] = ["add", "blog", "customizer", "content", "accounting", "diagnostics", "logs", "users", "maintenance"];

interface AdminSectionProps {
  isAdminMode: boolean;
  setIsAdminMode: (adminMode: boolean) => void;
  userProfiles?: UserProfile[];
  systemLogs: any[];
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

export default function AdminSection({
  isAdminMode,
  setIsAdminMode,
  userProfiles,
  systemLogs,
  onAddSystemLog,
}: AdminSectionProps) {
  const [subTab, setSubTab] = useState<AdminSubTab>("dashboard");
  const [ordersFilter, setOrdersFilter] = useState<string[]>([]);
  // Deep-link target set by AdminCustomers' order-history drill-down —
  // jumps to Orders with this exact order opened (see AdminOrders' initialOrderId).
  const [orderIdFocus, setOrderIdFocus] = useState<string | null>(null);
  const [showAdvancedSubmenu, setShowAdvancedSubmenu] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile nav dropdown on an outside tap/click — it previously only
  // closed via a tab selection or re-tapping the toggle button, so tapping
  // anywhere else on the page left it open, covering the content below it.
  useEffect(() => {
    if (!showMobileMenu) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showMobileMenu]);

  // Reset to dashboard when logo is clicked (navigate to /admin while already on /admin)
  const location = useLocation();
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    setSubTab("dashboard");
    setOrdersFilter([]);
    setOrderIdFocus(null);
    setShowMobileMenu(false);
  }, [location.key]);

  React.useEffect(() => {
    if (ADVANCED_TAB_IDS.includes(subTab)) {
      setShowAdvancedSubmenu(true);
    }
  }, [subTab]);

  const { login, logout } = useAuthStore();
  const machines = useAppStore((state) => state.machines);
  const orders = useAppStore((state) => state.orders);
  const blockedDates = useAppStore((state) => state.blockedDates);

  // Always refresh data when admin panel mounts (catches stale state after login)
  React.useEffect(() => {
    if (isAdminMode) {
      useAppStore.getState().fetchAllData();
    }
  }, [isAdminMode]);
  
  const adminLanguage = useLanguageStore((state) => state.adminLanguage);
  const setAdminLanguage = useLanguageStore((state) => state.setAdminLanguage);
  const tAdmin = useLanguageStore((state) => state.tAdmin);

  // Eén navigatiedefinitie voor mobiel dropdown + desktop sidebar (voorheen
  // drie keer gedupliceerd — een tabwijziging vereiste drie edits).
  const al = (nl: string, en: string, tr: string) =>
    adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl;
  // Volgorde is gegroepeerd op werkstroom i.p.v. losse chronologie: Sözleşmeler
  // (bestellingen) direct gevolgd door Dagplanning omdat die laatste een pure
  // afgeleide dagweergave ván bestellingen is (wat vertrekt/keert terug vandaag) —
  // stond voorheen los tussen Machines en Bezettingskalender. Machines/Bloke
  // Günler/Bezettingskalender staan nu bij elkaar (alle drie vloot-gerelateerd),
  // Klanten sluit de kernlijst af. Zie ook de audit die tot deze herindeling leidde.
  const coreTabs: { id: AdminSubTab; label: string; icon: typeof Settings; count?: number }[] = [
    { id: "dashboard", label: tAdmin("adminTabDashboard"), icon: BarChart3 },
    { id: "orders", label: tAdmin("adminTabOrders"), icon: Truck, count: orders.length },
    { id: "planning", label: al("Dagplanning", "Daily Planning", "Günlük Sevkiyat"), icon: CalendarDays },
    { id: "machines", label: tAdmin("adminTabMachines"), icon: Layers, count: machines.length },
    // De drie datum-panelen heetten alle drie iets met "kalender/planning", terwijl
    // ze verschillende dingen doen: adminTabCalendar = datums blokkeren,
    // planning = wat vertrekt/keert terug vandaag, timeline = bezetting per machine
    // over tijd. Namen zeggen nu wát het paneel doet i.p.v. dat het "een kalender" is.
    { id: "calendar", label: tAdmin("adminTabCalendar"), icon: Calendar, count: blockedDates.length },
    { id: "timeline", label: al("Bezettingskalender", "Occupancy Calendar", "Doluluk Takvimi"), icon: CalendarRange },
    { id: "customers", label: al("Klanten", "Customers", "Müşteriler"), icon: Users },
  ];
  const advancedTabs: { id: AdminSubTab; label: string; icon: typeof Settings; count?: number }[] = [
    { id: "add", label: tAdmin("adminTabAdd"), icon: PlusCircle },
    { id: "blog", label: al("Kenniscentrum", "Knowledge base", "Bilgi Merkezi"), icon: BookOpen },
    { id: "customizer", label: tAdmin("adminTabCustomizer"), icon: Settings },
    { id: "content", label: al("Content", "Content", "İçerik"), icon: FileText },
    { id: "accounting", label: al("Omzet & Export", "Revenue & Export", "Ciro ve Dışa Aktarma"), icon: Database },
    { id: "diagnostics", label: al("Systeemdiagnose", "System Diagnostics", "Sistem Teşhisi"), icon: ShieldAlert },
    { id: "maintenance", label: al("Onderhoud & Schade", "Maintenance & Damage", "Bakım ve Hasar"), icon: Wrench },
    { id: "logs", label: tAdmin("adminTabLogs"), icon: Terminal },
    { id: "users", label: al("Beheerders", "Administrators", "Yöneticiler"), icon: ShieldCheck },
  ];

  // Admin login credentials
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const requiresTwoFactor = useAuthStore((state) => state.requiresTwoFactor);

  const completeAdminLogin = () => {
    const user = useAuthStore.getState().user;
    if (user && user.role === "admin") {
      setIsAdminMode(true);
      onAddSystemLog(
        "login",
        "huurgo Admin",
        "Beheersessie verbonden met beveiligd beheerderstoken."
      );
      // Synchronously fetch all data with the newly set admin token
      useAppStore.getState().fetchAllData();
    } else {
      logout();
      setIsAdminMode(false);
      showAdminToast(al("Toegang geweigerd. Dit account heeft geen beheerdersrechten.", "Access denied. This account has no administrator rights.", "Erişim reddedildi. Bu hesabın yönetici yetkisi yok."), "error");
    }
  };

  const handleAdminVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      showAdminToast(al("E-mailadres en wachtwoord zijn verplicht.", "Email address and password are required.", "E-posta adresi ve şifre zorunludur."), "error");
      return;
    }

    const success = await login(adminEmail, adminPassword);
    if (success) {
      completeAdminLogin();
    } else if (useAuthStore.getState().requiresTwoFactor) {
      // Wachtwoord klopte, 2FA-codestap wordt getoond — geen fouttoast
      setTwoFactorCode("");
    } else {
      const errorMsg = useAuthStore.getState().error || "Fout bij beheerdersinlog.";
      showAdminToast(`${al("Inloggen mislukt", "Login failed", "Giriş başarısız")}: ${errorMsg}`, "error");
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.trim().length < 6) {
      showAdminToast(al("Voer de 6-cijferige code in.", "Enter the 6-digit code.", "6 haneli kodu girin."), "error");
      return;
    }
    const success = await useAuthStore.getState().verifyTwoFactor(twoFactorCode.trim());
    if (success) {
      setTwoFactorCode("");
      completeAdminLogin();
    } else {
      const state = useAuthStore.getState();
      showAdminToast(state.error || al("Ongeldige verificatiecode", "Invalid verification code", "Geçersiz doğrulama kodu"), "error");
      if (!state.requiresTwoFactor) setTwoFactorCode(""); // pre-auth verlopen → terug naar stap 1
    }
  };

  // If Owner is NOT logged into Admin mode, display secure login gateway
  if (!isAdminMode) {
    return (
      <div className="relative min-h-[calc(100vh-4.5rem)] py-16 px-5 sm:px-6 lg:px-8 flex items-center justify-center">
        <AdminToastHost />
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-orange-600/3 blur-[120px] -z-10" />

        <div className="w-full max-w-md bg-slate-900/60 p-8 rounded-3xl border border-white/5 space-y-6 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">{al("Eigenaarsportaal Login", "Owner Portal Login", "Yönetici Portalı Girişi")}</h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {al(
                "Beveiligde console voor de bedrijfseigenaar om de volledige vloot en actieve gebruikersstromen te overzien.",
                "Secure console for the business owner to oversee the full fleet and active user flows.",
                "İşletme sahibinin tüm filoyu ve aktif kullanıcı akışlarını görüntülemesi için güvenli konsol."
              )}
            </p>
          </div>

          {requiresTwoFactor ? (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase font-mono">{al("Verificatiecode (2FA)", "Verification code (2FA)", "Doğrulama kodu (2FA)")}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full bg-slate-950/50 border border-white/5 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-lg text-white outline-none font-bold h-12 transition-all font-mono tracking-[0.4em] text-center"
                />
                <p className="text-[10px] text-slate-500">
                  {al("Voer de 6-cijferige code uit uw authenticator-app in.", "Enter the 6-digit code from your authenticator app.", "Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.")}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] active:scale-99 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{al("Code verifiëren", "Verify code", "Kodu doğrula")}</span>
              </button>

              <button
                type="button"
                onClick={() => { useAuthStore.getState().clearError(); setTwoFactorCode(""); }}
                className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-white bg-transparent border-none cursor-pointer transition-colors"
              >
                {al("← Terug naar inloggen", "← Back to login", "← Girişe dön")}
              </button>
            </form>
          ) : (
          <form onSubmit={handleAdminVerifyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase font-mono">{al("Beheerder E-mail", "Admin e-mail", "Yönetici E-postası")}</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 focus:border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-medium h-10 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{al("Beveiligd Wachtwoord", "Secure password", "Güvenli Şifre")}</label>
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
              <span>{al("Inloggen als Beheerder", "Log in as Admin", "Yönetici Olarak Giriş Yap")}</span>
            </button>
          </form>
          )}

          <div className="pt-2 text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              {al("Beveiligde toegang voor geautoriseerde beheerders", "Secure access for authorized administrators", "Yetkili yöneticiler için güvenli erişim")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] py-4 sm:py-8 px-5 sm:px-6 lg:px-8">
      <AdminToastHost />

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
            {/* Mobile Navigation Dropdown */}
            <div ref={mobileMenuRef} className="lg:hidden relative w-full mb-2 z-20">
              <button
                type="button"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs cursor-pointer focus:outline-none"
              >
                <div className="flex items-center space-x-2.5">
                  {(() => {
                    const activeTabInfo = [...coreTabs, ...advancedTabs].find(t => t.id === subTab);
                    const Icon = activeTabInfo?.icon || Settings;
                    return (
                      <>
                        <Icon className="h-4.5 w-4.5 text-amber-500" />
                        <span>{activeTabInfo?.label}</span>
                      </>
                    );
                  })()}
                </div>
                <span className="text-[10px] text-slate-500">{showMobileMenu ? "▲" : "▼"}</span>
              </button>

              <AnimatePresence>
                {showMobileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-200 z-30"
                  >
                    <div className="p-2 space-y-0.5">
                      {coreTabs.map((sub) => {
                        const Icon = sub.icon;
                        const isSel = subTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSubTab(sub.id);
                              setShowMobileMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none ${
                              isSel 
                                ? "bg-amber-500 text-slate-950" 
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <Icon className={`h-4.5 w-4.5 ${isSel ? "text-slate-950" : "text-amber-500/80"}`} />
                              <span>{sub.label}</span>
                            </div>
                            {sub.count !== undefined && (
                              <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-600"}`}>
                                {sub.count}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedSubmenu(!showAdvancedSubmenu)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none bg-slate-50 text-slate-700`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <Settings className="h-4.5 w-4.5 text-amber-500/80" />
                            <span>{al("Geavanceerd", "Advanced", "Gelişmiş")}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{showAdvancedSubmenu ? "▼" : "▶"}</span>
                        </button>
                        
                        {showAdvancedSubmenu && (
                          <div className="mt-1 pl-3 border-l-2 border-slate-100 space-y-0.5">
                            {advancedTabs.map((sub) => {
                              const Icon = sub.icon;
                              const isSel = subTab === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => {
                                    setSubTab(sub.id);
                                    setShowMobileMenu(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none ${
                                    isSel 
                                      ? "bg-amber-500 text-slate-950" 
                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5">
                                    <Icon className={`h-4.5 w-4.5 ${isSel ? "text-slate-950" : "text-amber-500/60"}`} />
                                    <span>{sub.label}</span>
                                  </div>
                                  {sub.count !== undefined && (
                                    <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-500"}`}>
                                      {sub.count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:flex-col lg:space-y-1 glass-panel p-4 rounded-2xl gap-1 pb-4">
              {/* MVP Core tabs */}
              {coreTabs.map((sub) => {
                const Icon = sub.icon;
                const isSel = subTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSubTab(sub.id)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none ${
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
                      <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-600"}`}>
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
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none ${
                  ADVANCED_TAB_IDS.includes(subTab)
                    ? "bg-slate-100 text-slate-900 border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent bg-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Settings className="h-4.5 w-4.5 text-amber-500/80" />
                  <span>{al("Geavanceerd", "Advanced", "Gelişmiş")}</span>
                </div>
                <span className="text-[10px] text-slate-400 ml-1">{showAdvancedSubmenu ? "▼" : "▶"}</span>
              </button>

              {/* Advanced sub tabs */}
              {showAdvancedSubmenu && advancedTabs.map((sub) => {
                const Icon = sub.icon;
                const isSel = subTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSubTab(sub.id)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border-none pl-7 ${
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
                      <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-slate-100 text-slate-500"}`}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Het voormalige "BMWT Status"-blok stond hier: hardcoded
                ONLINE/SECURE-teksten zonder echte telemetrie. Verwijderd —
                echte systeemstatus staat in het Diagnostics-paneel. */}

            {/* Availability Checker Widget */}
            <AdminAvailabilityWidget />
          </div>

          {/* MAIN CONFIG VIEWPORT */}
          <div className="lg:col-span-9">
            <React.Suspense fallback={<AdminLoadingSpinner />}>
              <AnimatePresence mode="wait">
                {subTab === "dashboard" && (
                  <AdminDashboard key="dashboard" setSubTab={setSubTab} setOrdersFilter={setOrdersFilter} adminLanguage={adminLanguage} />
                )}
                {subTab === "orders" && (
                  <AdminOrders key="orders" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} statusFilter={ordersFilter} onClearStatusFilter={() => setOrdersFilter([])} initialOrderId={orderIdFocus} />
                )}
                {subTab === "machines" && (
                  <AdminMachines key="machines" setSubTab={setSubTab} onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
                )}
                {subTab === "calendar" && (
                  <AdminCalendar key="calendar" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
                )}
                {subTab === "planning" && (
                  <AdminPlanning key="planning" adminLanguage={adminLanguage} />
                )}
                {subTab === "timeline" && (
                  <AdminRentalTimeline key="timeline" adminLanguage={adminLanguage} />
                )}
                {subTab === "customers" && (
                  <AdminCustomers key="customers" adminLanguage={adminLanguage} onViewOrder={(orderId) => { setOrderIdFocus(orderId); setSubTab("orders"); }} />
                )}
                {subTab === "add" && (
                  <AdminAddMachine key="add" setSubTab={setSubTab} onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
                )}
                {subTab === "blog" && (
                  <AdminBlog key="blog" adminLanguage={adminLanguage} onAddSystemLog={onAddSystemLog} />
                )}
                {subTab === "customizer" && (
                  <AdminCustomizer key="customizer" onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
                )}
                {subTab === "content" && (
                  <AdminContent key="content" adminLanguage={adminLanguage} onAddSystemLog={onAddSystemLog} />
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
                {subTab === "maintenance" && (
                  <AdminMaintenance key="maintenance" adminLanguage={adminLanguage} />
                )}
                {subTab === "logs" && (
                  <AdminLogs key="logs" adminLanguage={adminLanguage} />
                )}
                {subTab === "users" && (
                  <AdminUsers key="users" adminLanguage={adminLanguage} />
                )}
              </AnimatePresence>
            </React.Suspense>
          </div>

        </div>

      </div>
    </div>
  );
}
