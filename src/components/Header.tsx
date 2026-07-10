/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
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
import { useAppStore } from "../store/appStore";
import { AppNotification, UserProfile, CartItem } from "../types";

export function HuurGoLogo({ className = "h-8", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Green accent bar — scales with container height */}
      <svg viewBox="0 0 8 44" className="h-full w-auto shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22c55e"/>
            <stop offset="100%" stopColor="#15803d"/>
          </linearGradient>
        </defs>
        <rect width="8" height="44" rx="4" fill="url(#barGrad)"/>
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none select-none">
        <div className="flex items-baseline gap-0">
          <span className={`font-display font-black tracking-tight text-[1.25em]`} style={{ letterSpacing: '-0.03em', color: dark ? '#fff' : '#0f172a' }}>huur</span>
          <span className="font-display font-black tracking-tight text-orange-600 text-[1.25em]" style={{ letterSpacing: '-0.03em' }}>go</span>
          <span className="font-display font-black text-emerald-500 text-[1.25em]">.</span>
        </div>
        {/* dark=false (light header bg) needs a darker gray for contrast; dark=true
            (dark header bg) needs a lighter gray — the reverse of what's intuitive. */}
        <span className={`font-semibold hidden sm:block text-[0.48em] uppercase tracking-[0.18em] mt-[2px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Simpel en snel</span>
      </div>
    </div>
  );
}

/**
 * Inline brand wordmark for use inside running text. Mirrors the logo's colour
 * identity: "Huur" follows the background (white on dark, near-black on light),
 * "go" is the brand orange and the trailing dot is emerald green.
 * Pass `dark` when rendered on a dark background.
 */
export function HuurGoText({ dark = false }: { dark?: boolean }) {
  return (
    <span className="font-display font-black tracking-tight whitespace-nowrap" style={{ letterSpacing: "-0.03em" }}>
      <span style={{ color: dark ? "#ffffff" : "#0f172a" }}>huur</span>
      <span className="text-orange-600">go</span>
      <span className="text-emerald-500">.</span>
    </span>
  );
}

/**
 * Small brand watermark pinned to the corner of product/category photo tiles,
 * so every machine card carries the original logo mark without crowding the
 * photo. Own white pill keeps it legible over any product photo. Pass
 * size="lg" on larger photo surfaces (e.g. the detail modal hero image).
 */
export function CardBrandWatermark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div
      className={`absolute z-10 pointer-events-none bg-white/90 backdrop-blur-sm rounded-md shadow-sm ring-1 ring-black/5 ${
        size === "lg" ? "top-3 right-3 px-2.5 py-1.5" : "top-2 right-2 px-2 py-1.5"
      }`}
    >
      <span className={`leading-none ${size === "lg" ? "text-sm" : "text-xs"}`}>
        <HuurGoText />
      </span>
    </div>
  );
}

/**
 * Renders an arbitrary string and replaces every brand-name occurrence with the
 * branded <HuurGoText /> wordmark. Matching is case-insensitive and tolerates an
 * optional space ("HuurGo", "huurGo", "huurgo", "Huur Go"), so admin-editable
 * site config / translations render the logo wordmark regardless of how the brand
 * was typed. Note: only used on prose without domains/emails (huurgo.nl etc.).
 */
export function BrandedText({ text, dark = false }: { text: string; dark?: boolean }) {
  const parts = text.split(/huur\s?go/gi);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <HuurGoText dark={dark} />}
        </React.Fragment>
      ))}
    </>
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
  cartItems = []
}: HeaderProps) {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const language = useLanguageStore((state) => state.language);
  const toggleLanguage = useLanguageStore((state) => state.toggleLanguage);
  const t = useLanguageStore((state) => state.t);

  // Close dropdown when user logs out so it doesn't reopen on next login
  React.useEffect(() => {
    if (!currentUser) setShowNotifDropdown(false);
  }, [currentUser]);
  return (
    <>
      <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isAdminMode 
          ? "border-amber-500/30 bg-amber-50/90 shadow-md shadow-amber-500/5 text-slate-800" 
          : "border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm text-slate-800"
      }`}>
        <div className="mx-auto relative flex max-w-7xl h-14 sm:h-20 items-center justify-between px-5 sm:px-6 lg:px-8">
        
        {/* Brand Logo & State Indicator */}
        <div 
          onClick={() => {
            setActiveTab(isAdminMode ? "admin" : "home");
          }}
          className="flex cursor-pointer items-center hover:opacity-90 active:scale-95 transition-all shrink-0"
        >
          {isAdminMode ? (
            <div className="flex items-center space-x-2.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
                <Lock className="h-5 w-5 text-slate-950 font-bold" />
              </div>
              <div>
                <span className="inline-block font-display text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  HubAdmin Portal
                </span>
                <div className="hidden sm:flex items-center space-x-1">
                  <span className="text-amber-500 text-xs font-semibold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    Beheerder Actief
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <HuurGoLogo className="h-7 sm:h-10 w-auto" />
          )}
        </div>        {/* Dynamic Desktop Navigation */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-1 lg:space-x-2">
          {isAdminMode ? (
            // Admin Mode Navigation Indicator (Simple, informative)
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-xl text-xs text-amber-900 font-semibold my-0.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Systeembeheer & Vloot Dashboard</span>
            </div>
          ) : (
            // Clean Visitor Navigation Links
            (
              [
                { id: "home", label: (language === "nl" && siteConfig.menuHomeLabel) ? siteConfig.menuHomeLabel : t("menuHome"), icon: Home },
                { id: "catalog", label: (language === "nl" && siteConfig.menuCatalogLabel) ? siteConfig.menuCatalogLabel : t("menuCatalog"), icon: Layers },
                { id: "adviestool", label: t("menuAdvisor"), icon: Sparkles },
                { id: "booking", label: t("menuBooking"), icon: ClipboardList },
              ] as { id: string; label: string; icon: any; badge?: string }[]
            ).map((tab) => {
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
                      ? "text-slate-900 bg-slate-100/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                  
                  {tab.badge && (
                    <span className="ml-1 text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-full">
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
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-orange-400 to-amber-300 rounded-full"
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
              className="inline-flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 px-3 py-2 sm:px-4 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.03] active:scale-95 hover:shadow-md cursor-pointer shrink-0"
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
                aria-label="Taal wisselen"
                className="inline-flex items-center justify-center space-x-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer select-none active:scale-95 shrink-0 shadow-xs"
              >
                <span className="font-bold uppercase">{language}</span>
              </button>

              {/* Notification Bell — only visible to logged-in members */}
              {currentUser && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifDropdown(!showNotifDropdown);
                      if (!showNotifDropdown) markAllNotificationsAsRead();
                    }}
                    aria-label="Meldingen"
                    className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white">
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
                          className="absolute right-0 mt-3.5 w-[min(18rem,calc(100vw-1rem))] sm:w-80 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-20"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                            <div className="flex items-center space-x-1.5">
                              <Bell className="h-4 w-4 text-slate-600" />
                              <h4 className="font-display font-bold text-sm text-slate-900">Mijn Meldingen</h4>
                            </div>
                            {notifications.length > 0 && (
                              <button
                                onClick={clearNotifications}
                                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-rose-600 transition-colors"
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
                                  className="group relative flex space-x-2.5 p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100"
                                >
                                  <div className="mt-0.5">
                                    {n.type === "success" ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                                      {n.title}
                                    </h5>
                                    <p className="text-xs text-slate-500 leading-snug mt-0.5">
                                      {n.message}
                                    </p>
                                    <span className="text-[10px] text-slate-400 mt-1 block">
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
              )}

              {/* Customer Avatar indicator */}
              {currentUser ? (
                <div 
                  onClick={() => setActiveTab("orders")}
                  className="flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 p-1.5 sm:py-1.5 sm:px-3 rounded-xl cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  {currentUser.avatarUrl ? (
                    <img 
                       src={currentUser.avatarUrl} 
                       alt="" 
                       className="h-6 w-6 rounded-full object-cover border border-slate-200"
                       referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-slate-600 to-slate-700 text-white font-extrabold text-[10px] flex items-center justify-center border border-slate-300 uppercase font-display select-none shrink-0 shadow-inner">
                      {currentUser.name.charAt(0)}
                    </div>
                  )}
                  <span className="hidden lg:inline-block text-xs font-bold text-slate-700 truncate max-w-[100px] ml-2" title={currentUser.name}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab("orders")}
                  className="inline-flex items-center justify-center min-h-[40px] px-3 sm:px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer select-none active:scale-95 shrink-0 shadow-xs"
                  title="Login"
                >
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline-block ml-1.5">Login</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>

      {/* Dynamic Mobile Bottom Bar switcher */}
      {!isAdminMode && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex min-h-16 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg justify-around items-center px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          {([
            { id: "home", label: (language === "nl" && siteConfig.menuHomeLabel) ? siteConfig.menuHomeLabel : t("menuHome"), icon: Home },
            { id: "catalog", label: (language === "nl" && siteConfig.menuCatalogLabel) ? siteConfig.menuCatalogLabel : t("menuCatalog"), icon: Layers },
            { id: "adviestool", label: t("menuAdvisor"), icon: Sparkles },
            { id: "booking", label: t("menuBooking"), icon: ClipboardList },
            ...(currentUser ? [{ id: "orders", label: (language === "nl" && siteConfig.menuOrdersLabel) ? siteConfig.menuOrdersLabel : t("menuMyArea"), icon: User }] : []),
          ] as { id: string; label: string; icon: any }[]).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center flex-grow h-full text-center transition-all ${
                  isActive ? "text-slate-900 font-semibold" : "text-slate-500"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
                <span className="text-[10px] mt-0.5 font-medium leading-none">{tab.label}</span>
                
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
