/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactModal from "./components/ContactModal";
import PWAInstallBanner from "./components/PWAInstallBanner";
import ToastNotification from "./components/ToastNotification";
import { Machine, Order, AppNotification, ChatMessage, UserProfile, CartItem } from "./types";
import { useAuthStore } from "./store/authStore";
import { useAppStore } from "./store/appStore";


// Dynamic Code Splitting (React.lazy)
const HomeSection = lazy(() => import("./components/HomeSection"));
const CatalogSection = lazy(() => import("./components/CatalogSection"));
const AdvisorSection = lazy(() => import("./components/AdvisorSection"));
const BookingSection = lazy(() => import("./components/BookingSection"));
const AdminSection = lazy(() => import("./components/AdminSection"));
const MyOrdersSection = lazy(() => import("./components/MyOrdersSection"));

// Premium Loading Indicator Component
function LoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 text-indigo-650 text-indigo-600 animate-spin" />
      <span className="text-xs text-slate-500 font-mono tracking-wider uppercase font-semibold">Laden van premium module...</span>
    </div>
  );
}

// Mock user profiles are now dynamically fetched from the database via `/api/auth/mock-profiles` inside components.

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname === "/" ? "home" : location.pathname.substring(1);
  const setActiveTab = (tab: string) => {
    navigate(tab === "home" ? "/" : `/${tab}`);
  };

  // Global scroll-to-top on route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Back to Top button show/hide tracking
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isAdminMode, setIsAdminModeState] = useState<boolean>(() => {
    return localStorage.getItem("hwh_admin_mode") === "true";
  });

  const setIsAdminMode = useCallback((val: boolean) => {
    localStorage.setItem("hwh_admin_mode", String(val));
    setIsAdminModeState(val);
  }, []);

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const storeUser = useAuthStore((state) => state.user);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
    } else {
      setCurrentUser(null);
      setIsAdminMode(false);
    }
  }, [storeUser, setIsAdminMode, navigate, location.pathname]);

  // System and Activity Logs
  const [systemLogs, setSystemLogs] = useState<any[]>([
    {
      id: "log-1",
      type: "system",
      user: "Systeem",
      description: "HoogwerkerHub B.V. vlootbeheersysteem geïnitialiseerd. BMWT verbinding stabiel.",
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
  
  // Highlighting state: keeps track of machine IDs suggested by the AI advisor
  const [aiRecommendedMachineIds, setAiRecommendedMachineIds] = useState<string[]>([]);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);

  // Search parameters pre-filled from landing page search submit
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: "notif-1",
      title: "Welkom bij HoogwerkerHub!",
      message: "Ontdek premium gekeurde en direct leverbare hoogwerkers voor heel Nederland.",
      type: "success",
      read: false,
      timestamp: new Date().toISOString()
    }
  ]);

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
      setNotifications((prev) => [newNotif, ...prev]);
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
      triggerNotification("Fout", appError, "warning");
      clearAppError();
    }
  }, [appError, triggerNotification, clearAppError]);

  useEffect(() => {
    if (authError) {
      triggerNotification("Fout", authError, "warning");
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

  // AI Advisor persistent chat messages list
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-advisor",
      sender: "advisor",
      text: "Hallo! Geef me gerust uw werkprofiel (bijv. schilder, glazenwasser, hovenier) of de benodigde werkhoogte door, dan stel ik direct de ideale configuratie voor u samen.",
      timestamp: new Date().toISOString()
    }
  ]);

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

  const getAuthHeaders = () => {
    const token = localStorage.getItem("hwh_token");
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
    setSelectedCategory(category || "all");
  };

  // Action: Select machine for booking & support cart
  const handleSelectMachineForBooking = (machine: Machine) => {
    setSelectedMachine(machine);
    addToCart(machine, "2026-06-05", "2026-06-08");
    setActiveTab("booking");
    
    // Live visitor logging
    handleAddSystemLog(
      "booking", 
      currentUser ? currentUser.name : "Gast", 
      `Voegt machine toe aan winkelwagen: "${machine.name}" (Tarief: €${machine.pricePerDay}/dag)`
    );
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
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error("Checkout creation failed via API");
      }

      const freshOrder: Order = await response.json();
      useAppStore.setState((state) => ({ orders: [freshOrder, ...state.orders] }));

      triggerNotification(
        "Betaling Geverifieerd",
        `Uw reservation ${freshOrder.id} is veilig geaccordeerd in de Mollie gateway.`,
        "success"
      );

      return freshOrder;
    } catch (err) {
      console.error(err);
      return null;
    }
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

  // AI Advisor recommendations callback: Highlights items in Catalog
  const handleRecommendMachinesFromAdvisor = (suggestedIds: string[]) => {
    setAiRecommendedMachineIds(suggestedIds);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased text-sm">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 inset-x-0 h-150 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none -z-10" />

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
      <main className="flex-grow">
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
                    aiRecommendedMachineIds={aiRecommendedMachineIds}
                    onAddSystemLog={handleAddSystemLog}
                    currentUser={currentUser}
                  />
                </motion.div>
              } />

              <Route path="/advisor" element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AdvisorSection 
                    machines={machines}
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    onRecommendMachines={handleRecommendMachinesFromAdvisor}
                    onSelectMachineForBooking={handleSelectMachineForBooking}
                    currentUser={currentUser}
                    onAddSystemLog={handleAddSystemLog}
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

      {/* PWA INSTALL FLOATING BANNER */}
      <PWAInstallBanner />

      {/* FLOATING ACTION BACK-TO-TOP BUTTON */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-40 p-3.5 rounded-full bg-slate-900/90 text-white shadow-xl backdrop-blur-md border border-white/10 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center border-none"
            title="Omhoog scrollen"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
