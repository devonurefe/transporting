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
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppNotification, UserProfile, CartItem } from "../types";

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
    siteName: "HoogwerkerHub",
    heroTagline: "Smart Verhuur van Hoogwerkers in Nederland",
    heroTitle: "Uitzonderlijk bereik. Volledig ontzorgd.",
    heroSubtitle: "Van schilderwerk binnen tot zware industriebouw buiten; HoogwerkerHub levert direct de juiste machines op locatie. Met of zonder vakbekwame chauffeur, gecontroleerd door onze slimme AI-assistent.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "Vloot Adviseur",
    menuOrdersLabel: "Mijn Account"
  }
}: HeaderProps) {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
      isAdminMode 
        ? "border-amber-500/30 bg-amber-50/90 shadow-md shadow-amber-500/5 text-slate-800" 
        : "border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm text-slate-800"
    }`}>
      <div className="mx-auto flex max-w-7xl h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & State Indicator */}
        <div 
          onClick={() => {
            if (!isAdminMode) {
              setActiveTab("home");
            }
          }} 
          className="flex cursor-pointer items-center space-x-2.5 hover:opacity-90 active:scale-95 transition-all shrink-0"
        >
          <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br transition-all ${
            isAdminMode 
              ? "from-amber-500 to-orange-600 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse" 
              : "from-indigo-500 to-blue-600 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          }`}>
            {isAdminMode ? (
              <Lock className="h-5 w-5 text-slate-950 font-bold" />
            ) : (
              <Building2 className="h-5.5 w-5.5 text-white" />
            )}
            <motion.div 
              layoutId="glowCircle" 
              className={`absolute -inset-1 rounded-xl -z-10 blur-sm ${
                isAdminMode ? "bg-amber-500/20" : "bg-indigo-500/20"
              }`}
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            />
          </div>
          <div>
            <span className="font-display text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
              {isAdminMode ? "HubAdmin Portal" : siteConfig.siteName}
            </span>
            <div className="flex items-center space-x-1 text-[10px] font-mono tracking-wider uppercase">
              {isAdminMode ? (
                <span className="text-amber-400 font-bold flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping inline-block mr-1" />
                  <span>Beheerder Actief</span>
                </span>
              ) : (
                <span className="text-teal-400 flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 opacity-75 inline-block mr-1" />
                  <span>Nederland • Premium</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 bg-slate-100 border border-slate-200/60 rounded-full px-2 py-1 md:ml-6 lg:ml-12 shrink-0">
          {isAdminMode ? (
            // Admin Mode Navigation Indicator (Simple, informative)
            <div className="flex items-center space-x-2 bg-amber-550/10 border border-amber-500/20 px-4 py-2 rounded-xl text-xs text-amber-900 font-semibold my-0.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Systeem Beheer & Vloot Dashboard (Şirket Sahibi Konsolu)</span>
            </div>
          ) : (
            // Clean Visitor Navigation Links
            [
              { id: "home", label: siteConfig.menuHomeLabel, icon: Home },
              { id: "catalog", label: siteConfig.menuCatalogLabel, icon: Layers },
              { id: "advisor", label: siteConfig.menuAdvisorLabel, icon: Sparkles, badge: "Smart" },
              { id: "booking", label: "Boeken", icon: ClipboardList },
              { id: "orders", label: siteConfig.menuOrdersLabel, icon: User },
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
                  className={`relative flex items-center space-x-1.5 px-5 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? "text-indigo-700 bg-white shadow-sm" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-indigo-600" : ""}`} />
                  <span>{tab.label}</span>
                  
                  {tab.badge && (
                    <span className="ml-1 text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}

                  {tab.id === "booking" && cartItems.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[9.5px] font-black text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse">
                      {cartItems.length}
                    </span>
                  )}
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-4 right-4 h-[2px] bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })
          )}
        </nav>

        {/* Dynamic Right Utility Tray */}
        <div className="flex items-center space-x-5 md:space-x-6">
          {isAdminMode ? (
            // Owner Logout Button (Exits back to the website)
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab("home");
              }}
              className="inline-flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 px-4.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.03] active:scale-97 hover:shadow-md cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Console Sluiten (Uitloggen)</span>
            </button>
          ) : (
            // Public Visitors Utilities
            <>
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
                  className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 py-1.5 px-3.5 rounded-xl cursor-pointer transition-all active:scale-95"
                >
                  <img 
                     src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop"} 
                     alt="" 
                     className="h-6 w-6 rounded-full object-cover border border-indigo-200" 
                     referrerPolicy="no-referrer"
                  />
                  <span className="hidden lg:inline-block text-xs font-bold text-indigo-700 truncate max-w-[100px]" title={currentUser.name}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab("orders")}
                  className="inline-flex items-center space-x-1 border border-slate-200 hover:border-slate-300 bg-white px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 transition-all active:scale-97 shrink-0"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span>Klant Login</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dynamic Mobile Bottom Bar switcher */}
      {!isAdminMode && (
        <div className="md:hidden flex h-11 border-t border-slate-200 bg-white justify-around items-center px-2">
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
                className={`flex flex-col items-center justify-center flex-grow h-full text-center transition-all ${
                  isActive ? "text-indigo-600 animate-pulse" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] mt-0.5 font-medium leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
