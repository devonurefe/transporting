/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactModal from "./components/ContactModal";
import PWAInstallBanner from "./components/PWAInstallBanner";
import ToastNotification from "./components/ToastNotification";
import CookieBanner from "./components/CookieBanner";
import { Machine, Order, AppNotification, UserProfile, CartItem } from "./types";
import { useAuthStore } from "./store/authStore";
import { useAppStore } from "./store/appStore";
import { buildWhatsAppGeneralUrl, buildWhatsAppOrderStatusUrl, buildWhatsAppPaymentLinkUrl, buildWhatsAppAdviceUrl } from "./utils/whatsapp";


// Dynamic Code Splitting (React.lazy)
const HomeSection = lazy(() => import("./components/HomeSection"));
const CatalogSection = lazy(() => import("./components/CatalogSection"));
const BookingSection = lazy(() => import("./components/BookingSection"));
const AdminSection = lazy(() => import("./components/AdminSection"));
const MyOrdersSection = lazy(() => import("./components/MyOrdersSection"));

// Premium Loading Indicator Component
function LoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
      <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
      <span className="text-sm text-slate-400 font-medium">Laden...</span>
    </div>
  );
}

// Mock user profiles are now dynamically fetched from the database via `/api/auth/mock-profiles` inside components.

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname === "/" ? "home" : location.pathname.substring(1);

  // Search parameters pre-filled from landing page search submit
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const setActiveTab = (tab: string) => {
    if (tab === "catalog") {
      setSelectedCategory("all");
      setSearchQuery("");
    }
    navigate(tab === "home" ? "/" : `/${tab}`);
  };

  // Global scroll-to-top on route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // SEO: per-route title, meta description and canonical (SPA fallback)
  useEffect(() => {
    const seo: Record<string, { title: string; desc: string; noindex?: boolean }> = {
      "/": {
        title: "HuurGo — Hoogwerkers Huren | Leiden, Den Haag, Alphen a/d Rijn",
        desc: "Hoogwerker huren v.a. €49/dag. Schaarlift, rupshoogwerker & ladderlift. Bezorging in Leiden, Den Haag & Alphen a/d Rijn. Geen borg — ook voor particulieren & ZZP.",
      },
      "/catalog": {
        title: "Hoogwerker Huren — Schaarliften, Rupshoogwerkers & Meer | HuurGo",
        desc: "Bekijk alle hoogwerkers: schaarliften 6–10m, rupshoogwerkers, ladderliften & meer. Direct huren v.a. €49/dag. ZZP & particulier welkom. Heel Zuid-Holland.",
      },
      "/booking": {
        title: "Online Reserveren — Snel & Eenvoudig | HuurGo",
        desc: "Reserveer uw hoogwerker in 3 stappen. Kies uw data, ontvang direct de prijs en bevestig via WhatsApp met iDEAL betaallink. Geen borg vereist.",
      },
      "/orders": {
        title: "Mijn Reserveringen | HuurGo",
        desc: "Beheer uw huurcontracten, volg de status en download facturen.",
        noindex: true,
      },
      "/admin": { title: "Beheer | HuurGo", desc: "", noindex: true },
    };
    const entry = seo[location.pathname] ?? seo["/"];
    document.title = entry.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", entry.desc);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", `${window.location.origin}${location.pathname === "/" ? "/" : location.pathname}`);
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (entry.noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.setAttribute("name", "robots");
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute("content", "noindex, nofollow");
    } else if (robotsMeta) {
      robotsMeta.setAttribute("content", "index, follow");
    }
  }, [location.pathname]);

  const [fabOpen, setFabOpen] = useState(false);
  const [fabPulse, setFabPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFabPulse(prev => {
        if (!prev) {
          setTimeout(() => setFabPulse(false), 900);
          return true;
        }
        return prev;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [replaceCartMachine, setReplaceCartMachine] = useState<Machine | null>(null);
  const [isAdminMode, setIsAdminModeState] = useState<boolean>(() => {
    return localStorage.getItem("hwh_admin_mode") === "true";
  });

  const setIsAdminMode = useCallback((val: boolean) => {
    localStorage.setItem("hwh_admin_mode", String(val));
    setIsAdminModeState(val);
  }, []);

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const storeUser = useAuthStore((state) => state.user);
  const authChecked = useAuthStore((state) => state.authChecked);
  const setVatDisplay = useAppStore((state) => state.setVatDisplay);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Detect fresh login (not session restore) and nudge user back to booking if cart has items
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!authChecked) return;
    const uid = storeUser?.id ?? null;
    if (uid && !prevUserIdRef.current && storeUser?.role !== "admin") {
      const items = useAppStore.getState().cartItems;
      if (items.length > 0) {
        // Use a short timeout so triggerNotification is available after render
        setTimeout(() => {
          triggerNotification(
            "Winkelwagen bewaard",
            "Je hebt nog een machine geselecteerd. Ga naar Boeken om door te gaan.",
            "info",
            false
          );
        }, 400);
      }
    }
    prevUserIdRef.current = uid;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUser?.id, authChecked]);

  useEffect(() => {
    if (storeUser) {
      if (storeUser.role === "admin") {
        setCurrentUser(null);
        setIsAdminMode(true);
        // Only redirect to /admin if trying to access the customer portal
        if (location.pathname === "/orders" || location.pathname === "/login") {
          navigate("/admin");
        }
      } else {
        setCurrentUser({
          id: storeUser.id,
          name: storeUser.name,
          email: storeUser.email,
          phone: storeUser.phone || "",
          profileType: storeUser.profile || "Particulier",
          companyName: storeUser.companyName || undefined,
          address: storeUser.address || undefined,
          avatarUrl: storeUser.avatarUrl || undefined,
          pastRentalsCount: 0
        });
        setIsAdminMode(false);
      }
    } else if (authChecked) {
      // Auth check is complete and confirmed no user — safe to clear admin mode
      setCurrentUser(null);
      setIsAdminMode(false);
      setVatDisplay("incl");
      localStorage.setItem("hwh_vat_display", "incl");
    }
    // When authChecked=false (still loading), don't touch isAdminMode
    // so the admin panel stays visible while the token is being verified
  }, [storeUser, authChecked, setIsAdminMode, navigate, location.pathname]);

  useEffect(() => {
    if (!currentUser) return;
    const PROFESSIONAL = new Set([
      "ZZP", "Bedrijf", "Schilder", "Hovenier", "Hovenier / Groenverzorging",
      "Glazenwasser", "Glazenwasser / Gevelreiniger", "Aannemer",
      "Installateur", "Installateur / Elektricien", "Dakdekker / Gevelwerker",
      "Industrieel Onderhoud", "Metselaar", "Stukadoor", "Magazijn", "Gevelreiniger"
    ]);
    const mode = PROFESSIONAL.has(currentUser.profileType) ? "excl" : "incl";
    setVatDisplay(mode);
    localStorage.setItem("hwh_vat_display", mode);
  }, [currentUser?.id, setVatDisplay]);

  // System and Activity Logs
  const [systemLogs, setSystemLogs] = useState<any[]>([
    {
      id: "log-1",
      type: "system",
      user: "Systeem",
      description: "HuurGo B.V. vlootbeheersysteem geïnitialiseerd. BMWT verbinding stabiel.",
      timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
    },
    {
      id: "log-2",
      type: "booking",
      user: "System Daemon",
      description: "Dagelijkse synchronisatie met Mollie betalingsgateway afgerond.",
      timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
    }
  ]);

  const handleAddSystemLog = useCallback((type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => {
    const newLog = {
      id: `log-${Date.now()}`,
      type,
      user,
      description,
      timestamp: new Date().toISOString()
    };
    setSystemLogs(prev => [newLog, ...prev]);
  }, []);

  const handleClearSystemLogs = useCallback(() => {
    setSystemLogs([]);
  }, []);

  // Auto-log page visits for visitors live activity tracking
  useEffect(() => {
    const tabName = location.pathname === "/" ? "home" : location.pathname.substring(1);
    // Avoid double logging on initial mount or empty paths
    if (tabName !== "admin" && tabName !== "logs") {
      handleAddSystemLog(
        "system",
        currentUser ? currentUser.name : "Gast",
        `Navigeert naar pagina/sectie: "${tabName.toUpperCase()}"`
      );
    }
  }, [location.pathname, currentUser, handleAddSystemLog]);

  // Bridge setters to Zustand useAppStore
  const setSiteConfig = (updateFn: any) => {
    const current = useAppStore.getState().siteConfig;
    const next = typeof updateFn === "function" ? updateFn(current) : updateFn;
    useAppStore.getState().updateSiteConfig(next);
  };

  const setCustomCategories = (updateFn: any) => {
    const current = useAppStore.getState().customCategories;
    const next = typeof updateFn === "function" ? updateFn(current) : updateFn;
    useAppStore.getState().updateCategories(next);
  };
  
  const [showContactModal, setShowContactModal] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Toast State for on-screen popup alerts
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning";
  } | null>(null);

  // Triggering notifications dynamically
  const triggerNotification = useCallback((
    title: string,
    message: string,
    type: "info" | "success" | "warning",
    persist: boolean = true
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type,
      read: false,
      timestamp: new Date().toISOString()
    };

    if (persist) {
      setNotifications((prev) => {
        // Skip if same title+message already in the list within the last 2 seconds
        const recent = prev.find(n =>
          n.title === title && n.message === message &&
          Date.now() - new Date(n.timestamp).getTime() < 2000
        );
        if (recent) return prev;
        return [newNotif, ...prev];
      });
    }
    
    // Set active popup toast
    setActiveToast({
      id: newNotif.id,
      title,
      message,
      type
    });
  }, []);

  // Handle active toast expiration
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const appError = useAppStore((state) => state.error);
  const clearAppError = useAppStore((state) => state.clearError);
  const authError = useAuthStore((state) => state.error);
  const clearAuthError = useAuthStore((state) => state.clearError);

  useEffect(() => {
    if (appError) {
      triggerNotification("Fout", appError, "warning", false);
      clearAppError();
    }
  }, [appError, triggerNotification, clearAppError]);

  useEffect(() => {
    if (authError) {
      triggerNotification("Fout", authError, "warning", false);
      clearAuthError();
    }
  }, [authError, triggerNotification, clearAuthError]);

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleCustomerLogout = useCallback(() => {
    if (currentUser) {
      handleAddSystemLog("logout", currentUser.name, "Klant heeft de sessie handmatig beëindigd.");
    }
    useAuthStore.getState().logout();
    setCurrentUser(null);
    triggerNotification("Afgemeld", "U bent nu veilig afgemeld uit uw account.", "info", false);
  }, [currentUser, handleAddSystemLog, triggerNotification]);

  const fetchAllData = useAppStore((state) => state.fetchAllData);
  const machines = useAppStore((state) => state.machines);
  const orders = useAppStore((state) => state.orders);
  const customCategories = useAppStore((state) => state.customCategories);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const cartItems = useAppStore((state) => state.cartItems);
  
  const addToCart = useAppStore((state) => state.addToCart);
  const removeFromCart = useAppStore((state) => state.removeFromCart);
  const updateCartItemDates = useAppStore((state) => state.updateCartItemDates);
  const clearCart = useAppStore((state) => state.clearCart);

  const addMachine = useAppStore((state) => state.addMachine);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const fetchBlockedDates = useAppStore((state) => state.fetchBlockedDates);

  const getAuthHeaders = () => {
    const isAdminPath = location.pathname.startsWith("/admin");
    const token = localStorage.getItem(isAdminPath ? "hwh_admin_token" : "hwh_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
  };

  // Initial Rest sync with developer Express APIs
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle redirect query parameters for email verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const email = params.get("email");
    const errorMsg = params.get("error");

    if (verified === "true") {
      triggerNotification(
        "E-mail Geverifieerd",
        `Gefeliciteerd! Het e-mailadres ${email ? `(${email})` : ""} is succesvol geverifieerd. U kunt nu inloggen.`,
        "success"
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verified === "false") {
      triggerNotification(
        "Verificatie Mislukt",
        errorMsg || "De verificatielink is ongeldig of verlopen.",
        "warning"
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Triggered when search is executed from landing hero
  const handleLandingPageSearch = (query: string, category: string) => {
    setSearchQuery(query);
    // "schaarlift" on homepage = all scissor lifts group in catalog
    const mapped = category === "schaarlift" ? "schaarlift-group" : (category || "all");
    setSelectedCategory(mapped);
    navigate("/catalog");
  };

  // Replaces the cart with the chosen machine and moves to the booking flow.
  const proceedWithBooking = (machine: Machine) => {
    setSelectedMachine(machine);
    const todayStr = new Date().toISOString().split("T")[0];
    const endStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    clearCart();
    addToCart(machine, todayStr, endStr);
    fetchBlockedDates();
    setActiveTab("booking");

    // Live visitor logging
    handleAddSystemLog(
      "booking",
      currentUser ? currentUser.name : "Gast",
      `Voegt machine toe aan winkelwagen: "${machine.name}" (Tarief: €${machine.pricePerDay}/dag)`
    );
  };

  // Action: Select machine for booking & support cart. When the cart already
  // holds a machine we ask for confirmation via a Dutch in-app modal (native
  // confirm() shows OS-localized buttons, which broke the Dutch-only UI).
  const handleSelectMachineForBooking = (machine: Machine) => {
    if (cartItems.length > 0) {
      setReplaceCartMachine(machine);
      return;
    }
    proceedWithBooking(machine);
  };

  const handleRemoveCartItem = (id: string) => {
    const item = cartItems.find(c => c.id === id);
    removeFromCart(id);
    
    // Live visitor logging
    handleAddSystemLog(
      "booking",
      currentUser ? currentUser.name : "Gast",
      `Verwijdert machine uit winkelwagen: "${item ? item.machine.name : 'Hoogwerker'}"`
    );
  };

  const handleUpdateCartItemDates = (id: string, start: string, end: string) => {
    updateCartItemDates(id, start, end);
    const item = cartItems.find(c => c.id === id);
    handleAddSystemLog(
      "booking",
      currentUser ? currentUser.name : "Gast",
      `Wijzigt huurperiode voor "${item ? item.machine.name : 'hoogwerker'}": ${start} t/m ${end}`
    );
  };

  const handleClearCart = () => {
    clearCart();
    handleAddSystemLog("booking", currentUser ? currentUser.name : "Gast", "Winkelwagen volledig leeggemaakt.");
  };

  // Action: Submit reservation checkout
  const handleCreateReservation = async (orderData: Partial<Order>): Promise<Order | null> => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Serverfout (${response.status})`);
    }

    const freshOrder: Order = await response.json();
    useAppStore.setState((state) => ({ orders: [freshOrder, ...state.orders] }));

    triggerNotification(
      "Reservering Ontvangen",
      `Aanvraag ${freshOrder.id} is succesvol ingediend.`,
      "success"
    );

    return freshOrder;
  };

  // Action: Add machinery from Admin portal
  const handleAddMachine = async (machData: Partial<Machine>): Promise<boolean> => {
    const success = await addMachine(machData);
    if (success) {
      triggerNotification(
        "Vloot Uitgebreid",
        `Model "${machData.name}" is succesvol toegevoegd aan de actieve verhuurbasis.`,
        "success"
      );
      return true;
    }
    return false;
  };

  // Action: Progress order status in Admin table
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: any) => {
    const success = await updateOrderStatus(orderId, nextStatus);
    if (success) {
      triggerNotification(
        "Contract Geüpdatet",
        `Aanvraag ${orderId} is veranderd naar status: "${nextStatus}".`,
        "info"
      );
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased pb-16 md:pb-0">

      {/* JSON-LD Structured Data for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": ["LocalBusiness", "RentalService"],
            "name": `${siteConfig.siteName || "HuurGo"} — Hoogwerkers Verhuur`,
            "description": "Snel en eenvoudig hoogwerkers huren bij HuurGo. Schaarlift, spinhoogwerker en aanhangerhoogwerker voor ZZP'ers en particulieren.",
            "url": window.location.origin,
            "telephone": siteConfig.contactPhone || "+31715428114",
            "email": siteConfig.contactEmail || "info@mbhoogwerkers.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": siteConfig.companyAddress || "Produktieweg 20",
              "postalCode": "2382 PB",
              "addressLocality": "Zoeterwoude",
              "addressCountry": "NL"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 52.0981,
              "longitude": 4.5215
            },
            "openingHoursSpecification": [{
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
              "opens": "08:00",
              "closes": "17:00"
            }],
            "priceRange": "€€",
            "currenciesAccepted": "EUR",
            "paymentAccepted": "iDEAL, Bank Transfer",
            "areaServed": {
              "@type": "State",
              "name": "Zuid-Holland"
            },
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Hoogwerker Verhuur",
              "itemListElement": [
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Schaarlift huren" } },
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Spinhoogwerker huren" } },
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Aanhangerhoogwerker huren" } }
              ]
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "reviewCount": "47",
              "bestRating": "5",
              "worstRating": "1"
            }
          })
        }}
      />

      {/* FAQ JSON-LD for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Kan ik als particulier een hoogwerker huren?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Ja, MB Hoogwerkers verhuurt aan particulieren, ZZP'ers en aannemers. Er is geen borg vereist en u kunt direct online reserveren."
                }
              },
              {
                "@type": "Question",
                "name": "Wat kost een schaarlift huren per dag?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Een schaarlift huren kost v.a. €49 per dag exclusief btw. Het werkweektarief (5 dagen) bedraagt v.a. €185. Prijzen zijn all-in inclusief brandstof of opgeladen accu."
                }
              },
              {
                "@type": "Question",
                "name": "Hoe snel wordt de hoogwerker geleverd?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Wij bezorgen dezelfde of volgende werkdag binnen 20 km van ons depot in Zoeterwoude. Dit omvat Leiden, Den Haag, Alphen aan den Rijn en omgeving."
                }
              },
              {
                "@type": "Question",
                "name": "Is er een borg of aanbetaling vereist?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Nee, MB Hoogwerkers werkt volledig zonder borg. U betaalt via iDEAL of Tikkie na bevestiging van uw reservering via WhatsApp."
                }
              },
              {
                "@type": "Question",
                "name": "Welke hoogwerkers zijn beschikbaar voor huur?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Wij verhuren schaarliften (6–10 m), rupshoogwerkers / spinhoogwerkers (15–17 m), aanhangerhoogwerkers (12–17 m), mastliften, ladderliften / verhuisliften, pecoliften en kamersteigers."
                }
              }
            ]
          })
        }}
      />

      {/* Background ambient lighting */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-slate-100/60 to-transparent pointer-events-none -z-10" />

      {/* A11y: keyboard/screen-reader users can jump past the navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-slate-800 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:text-sm focus:font-bold"
      >
        Direct naar inhoud
      </a>

      {/* Main Navigation Header */}
      <Header
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        notifications={notifications}
        markAllNotificationsAsRead={markAllNotificationsAsRead}
        clearNotifications={clearNotifications}
        currentUser={currentUser}
        onCustomerLogout={handleCustomerLogout}
        isAdminMode={isAdminMode && location.pathname === "/admin"}
        setIsAdminMode={setIsAdminMode}
        siteConfig={siteConfig}
        cartItems={cartItems}
      />



      {/* Primary Workspace Sections */}
      <main id="main-content" className="flex-grow">
        <Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            <Routes location={location}>
              <Route path="/" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomeSection
                    onSearch={handleLandingPageSearch}
                    setActiveTab={setActiveTab}
                    siteConfig={siteConfig}
                    customCategories={customCategories}
                  />
                </motion.div>
              } />

              <Route path="/catalog" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CatalogSection 
                    machines={machines}
                    customCategories={customCategories}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    onSelectMachineForBooking={handleSelectMachineForBooking}
                    onAddSystemLog={handleAddSystemLog}
                    currentUser={currentUser}
                  />
                </motion.div>
              } />

              <Route path="/booking" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <BookingSection 
                    selectedMachine={selectedMachine}
                    onCreateReservation={handleCreateReservation}
                    setActiveTab={setActiveTab}
                    machines={machines}
                    onSelectMachine={setSelectedMachine}
                    currentUser={currentUser}
                    cartItems={cartItems}
                    onRemoveCartItem={handleRemoveCartItem}
                    onUpdateCartItemDates={handleUpdateCartItemDates}
                    onClearCart={handleClearCart}
                  />
                </motion.div>
              } />

              <Route path="/orders" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MyOrdersSection 
                    orders={orders} 
                    onTriggerNotification={triggerNotification} 
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                    onAddSystemLog={handleAddSystemLog}
                  />
                </motion.div>
              } />

              <Route path="/admin" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AdminSection 
                    isAdminMode={isAdminMode}
                    setIsAdminMode={setIsAdminMode}
                    systemLogs={systemLogs}
                    onAddSystemLog={handleAddSystemLog}
                    onClearSystemLogs={handleClearSystemLogs}
                  />
                </motion.div>
              } />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Bottom Footer block */}
      <Footer 
        siteName={siteConfig.siteName} 
        setActiveTab={setActiveTab} 
        setShowContactModal={setShowContactModal} 
      />

      {/* CART REPLACE CONFIRMATION (Dutch in-app modal, not native confirm) */}
      <AnimatePresence>
        {replaceCartMachine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={() => setReplaceCartMachine(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-slate-900 mb-2">Winkelwagen vervangen?</h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Er staat al een machine in uw winkelwagen. Wilt u deze vervangen door de nieuwe selectie?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setReplaceCartMachine(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => { const m = replaceCartMachine; setReplaceCartMachine(null); proceedWithBooking(m); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors cursor-pointer"
                >
                  Vervangen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE CONTACT DETAILS MODAL */}
      <ContactModal
        isOpen={showContactModal} 
        onClose={() => setShowContactModal(false)} 
        onShowToast={(toast) => setActiveToast(toast)} 
        onAddSystemLog={handleAddSystemLog} 
      />

      {/* FLOATING ACTION TOAST POPUPS (TOP RIGHT PANEL) */}
      <ToastNotification 
        toast={activeToast} 
        onClose={() => setActiveToast(null)} 
      />

      {/* FLOATING WHATSAPP BUTTON + QUICK TEMPLATES */}
      {!isAdminMode && (
        <>
          {fabOpen && (
            <div className="fixed inset-0 z-[50]" onClick={() => setFabOpen(false)} />
          )}
          <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[51] flex flex-col items-end gap-2">
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64 space-y-1.5"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 pb-1">Stuur ons een bericht</p>
                {[
                  {
                    icon: "📅",
                    label: "Machine huren",
                    sub: "Ik wil een machine boeken",
                    url: buildWhatsAppGeneralUrl(),
                  },
                  {
                    icon: "📋",
                    label: "Status van mijn boeking",
                    sub: "Waar staat mijn aanvraag?",
                    url: buildWhatsAppOrderStatusUrl(),
                  },
                  {
                    icon: "💳",
                    label: "Betaallink ontvangen",
                    sub: "Ik wacht op mijn iDEAL link",
                    url: buildWhatsAppPaymentLinkUrl(),
                  },
                  {
                    icon: "🔧",
                    label: "Advies over machine",
                    sub: "Welke machine past bij mijn klus?",
                    url: buildWhatsAppAdviceUrl(),
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setFabOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-emerald-50 transition-colors no-underline group"
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 leading-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight truncate">{item.sub}</p>
                    </div>
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            {fabPulse && !fabOpen && (
              <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40 pointer-events-none" />
            )}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => { setFabOpen(v => !v); setFabPulse(false); }}
              className={`relative flex items-center justify-center h-11 w-11 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer border-none shadow-emerald-500/25 ${fabOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-[#25D366] hover:bg-[#1da851]"}`}
              title="Hulp nodig? Chat via WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
        </>
      )}

      {/* Cookie consent banner */}
      <CookieBanner />

    </div>
  );
}
