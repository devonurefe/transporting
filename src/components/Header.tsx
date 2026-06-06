/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Building2, 
  MessageSquareText, 
  ClipboardList, 
  Settings, 
  Bell, 
  Layers, 
  Home, 
  ShieldCheck, 
  Sparkles,
  Phone,
  CheckCircle2,
  Trash2,
  LogOut,
  User,
  Lock,
  ShieldAlert,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguageStore } from "../store/languageStore";
import { AppNotification, UserProfile, CartItem } from "../types";

export function HuurGoLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 250 80" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <text 
        x="10" 
        y="42" 
        fontFamily="Outfit, sans-serif" 
        fontWeight="800" 
        fontSize="34" 
        fill="#0f2d59"
      >
        Huur
      </text>
      <text 
        x="90" 
        y="42" 
        fontFamily="Outfit, sans-serif" 
        fontWeight="850" 
        fontSize="34" 
        fill="#FF7A20"
      >
        Go
      </text>
      
      <g transform="translate(138, 17)">
        <line x1="0" y1="12" x2="22" y2="12" stroke="#0f2d59" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="0" y1="20" x2="22" y2="20" stroke="#0f2d59" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="0" y1="28" x2="22" y2="28" stroke="#0f2d59" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M22 6 L36 20 L22 34 Z" fill="#FF7A20" />
      </g>

      <text 
        x="12" 
        y="68" 
        fontFamily="Outfit, sans-serif" 
        fontWeight="500" 
        fontSize="15" 
        fill="#0f2d59"
      >
        Snel en simpel
      </text>
    </svg>
  );
}

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: AppNotification[];
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  currentUser: UserProfile | null;
  onCustomerLogout: () => void;
  isAdminMode: boolean;
  setIsAdminMode: (adminMode: boolean) => void;
  cartItems?: CartItem[];
  siteConfig?: {
    siteName: string;
    heroTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    menuHomeLabel: string;
    menuCatalogLabel: string;
    menuAdvisorLabel: string;
    menuOrdersLabel: string;
  };
}

export default function Header({
  activeTab,
  setActiveTab,
  notifications,
  markAllNotificationsAsRead,
  clearNotifications,
  currentUser,
  onCustomerLogout,
  isAdminMode,
  setIsAdminMode,
  cartItems = [],
  siteConfig = {
    siteName: "HuurGo",
    heroTagline: "Snel & Makkelijk Hoogwerkers Huren",
    heroTitle: "Huur uw hoogwerker in een handomdraai.",
    heroSubtitle: "HuurGo is er voor ZZP'ers en particulieren. Geen gedoe, direct online geregeld. Vind binnen 1 minuut de perfecte machine voor uw schilderklus, tuinonderhoud of gevelwerk met onze slimme AI-assistent.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "Snel Advies",
    menuOrdersLabel: "Mijn Account"
  }
}: HeaderProps) {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const language = useLanguageStore((state) => state.language);
  const toggleLanguage = useLanguageStore((state) => state.toggleLanguage);
  const t = useLanguageStore((state) => state.t);


  return (
    <>
      <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isAdminMode 
          ? "border-amber-500/30 bg-amber-50/90 shadow-md shadow-amber-500/5 text-slate-800" 
          : "border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm text-slate-800"
      }`}>
        <div className="mx-auto flex max-w-7xl h-14 sm:h-20 items-center justify-between px-3 sm:px-6 lg:px-8">
        
        {/* Brand Logo & State Indicator */}
        <div 
          onClick={() => {
            if (!isAdminMode) {
              setActiveTab("home");
            }
          }} 
          className="flex cursor-pointer items-center hover:opacity-90 active:scale-95 transition-all shrink-0"
        >
          {isAdminMode ? (
            <div className="flex items-center space-x-2.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
                <Lock className="h-5 w-5 text-slate-950 font-bold" />
              </div>
              <div>
                <span className="inline-block font-display text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
                  HubAdmin Portal
                </span>
                <div className="hidden sm:flex items-center space-x-1 text-[10px] font-mono tracking-wider uppercase">
                  <span className="text-amber-400 font-bold flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping inline-block mr-1" />
                    <span>Beheerder Actief</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <HuurGoLogo className="h-8 sm:h-12 w-auto" />
          )}
        </div>        {/* Dynamic Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 shrink">
          {isAdminMode ? (
            // Admin Mode Navigation Indicator (Simple, informative)
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-xl text-xs text-amber-900 font-semibold my-0.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Systeembeheer & Vloot Dashboard</span>
            </div>
          ) : (
            // Clean Visitor Navigation Links
            [
              { id: "home", label: siteConfig.menuHomeLabel || t("menuHome"), icon: Home },
              { id: "catalog", label: siteConfig.menuCatalogLabel || t("menuCatalog"), icon: Layers },
              { id: "advisor", label: siteConfig.menuAdvisorLabel || t("menuAdvisor"), icon: Sparkles, badge: "Smart" },
              { id: "booking", label: t("stepLogistics"), icon: ClipboardList },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowNotifDropdown(false);
                  }}
                  className={`relative flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-semibold tracking-wide transition-all duration-350 ${
                    isActive 
                      ? "text-indigo-600 bg-indigo-50/60 shadow-[0_1px_2px_rgba(79,70,229,0.05)]" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-450"}`} />
                  <span>{tab.label}</span>
                  
                  {tab.badge && (
                    <span className="ml-1 text-[8.5px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}

                  {tab.id === "booking" && cartItems.length > 0 && (
                    <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse">
                      {cartItems.length}
                    </span>
                  )}
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })
          )}
        </nav>

        {/* Dynamic Right Utility Tray */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {isAdminMode ? (
            // Owner Logout Button (Exits back to the website)
            <button
              onClick={() => {
                setIsAdminMode(false);
                onCustomerLogout();
                setActiveTab("home");
              }}
              className="inline-flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 px-3 py-2 sm:px-4 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.03] active:scale-97 hover:shadow-md cursor-pointer shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Console Sluiten (Uitloggen)</span>
              <span className="inline sm:hidden">Uitloggen</span>
            </button>
          ) : (
            // Public Visitors Utilities
            <>
              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer select-none shrink-0 shadow-xs"
              >
                <span className="font-mono uppercase">{language}</span>
              </button>

              {/* Notification Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifDropdown(!showNotifDropdown);
                    if (!showNotifDropdown) markAllNotificationsAsRead();
                  }}
                  className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {showNotifDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowNotifDropdown(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-3.5 w-85 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-20"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                          <div className="flex items-center space-x-1.5">
                            <Bell className="h-4 w-4 text-indigo-600" />
                            <h4 className="font-display font-bold text-sm text-slate-900">Live Updates</h4>
                          </div>
                          {notifications.length > 0 && (
                            <button
                              onClick={clearNotifications}
                              className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Wissen</span>
                            </button>
                          )}
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {notifications.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Geen nieuwe meldingen beschikbaar.
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className="group relative flex space-x-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100"
                              >
                                <div className="mt-0.5">
                                  {n.type === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 text-indigo-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h5 className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                    {n.title}
                                  </h5>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                    {n.message}
                                  </p>
                                  <span className="text-[9px] font-mono text-slate-500 mt-1 block">
                                    {new Date(n.timestamp).toLocaleTimeString("nl-NL", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Customer Avatar indicator */}
              {currentUser ? (
                <div 
                  onClick={() => setActiveTab("orders")}
                  className="flex items-center bg-indigo-50 hover:bg-indigo-100 border border-indigo-100/50 p-1.5 sm:py-1.5 sm:px-3 rounded-xl cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  {currentUser.avatarUrl ? (
                    <img 
                       src={currentUser.avatarUrl} 
                       alt="" 
                       className="h-6 w-6 rounded-full object-cover border border-indigo-200" 
                       referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-650 text-white font-extrabold text-[10px] flex items-center justify-center border border-indigo-200 uppercase font-display select-none shrink-0 shadow-inner">
                      {currentUser.name.charAt(0)}
                    </div>
                  )}
                  <span className="hidden lg:inline-block text-xs font-bold text-indigo-700 truncate max-w-[100px] ml-2" title={currentUser.name}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab("orders")}
                  className="inline-flex items-center justify-center border border-slate-200 hover:border-slate-300 bg-white p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all active:scale-97 shrink-0"
                  title="Klant Login"
                >
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline-block ml-1.5">Klant Login</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>

      {/* Dynamic Mobile Bottom Bar switcher */}
      {!isAdminMode && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-14 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg justify-around items-center px-1 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          {[
            { id: "home", label: "Home", icon: Home },
            { id: "catalog", label: "Catalogus", icon: Layers },
            { id: "advisor", label: "Advisor", icon: Sparkles },
            { id: "booking", label: "Boeken", icon: ClipboardList },
            { id: "orders", label: currentUser ? "Mijn Area" : "Inloggen", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center flex-grow h-full text-center transition-all ${
                  isActive ? "text-indigo-600 font-semibold" : "text-slate-500"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-[9.5px] mt-1 font-medium leading-none">{tab.label}</span>
                
                {tab.id === "booking" && cartItems.length > 0 && (
                  <span className="absolute top-1.5 right-1/2 translate-x-5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-black text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                    {cartItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
