/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Sparkles, Bell, Info, CheckCircle, AlertTriangle, X, MapPin, Phone, Mail, Clock, MessageSquare, Loader2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
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

const mockUserProfiles: UserProfile[] = [
  {
    id: "user-1",
    name: "Jan de Vries",
    email: "jan@devriesschilderwerken.nl",
    phone: "+31 6 12345678",
    companyName: "De Vries Schilderwerken B.V.",
    profileType: "Schilder",
    pastRentalsCount: 14,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop",
    historyRecommendedIds: ["lift-1", "lift-3"]
  },
  {
    id: "user-2",
    name: "Sven van der Meer",
    email: "sven@meer-groen.nl",
    phone: "+31 6 87654321",
    companyName: "MeerGroen Boomverzorging",
    profileType: "Hovenier / Groenverzorging",
    pastRentalsCount: 8,
    avatarUrl: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=150&auto=format&fit=crop",
    historyRecommendedIds: ["lift-1", "lift-5"]
  },
  {
    id: "user-3",
    name: "Lieke Bakker",
    email: "l.bakker@bakkerclean.nl",
    phone: "+31 6 49201837",
    companyName: "Bakker Glazenwasserij & Gevelonderhoud",
    profileType: "Glazenwasser / Gevelreiniger",
    pastRentalsCount: 22,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop",
    historyRecommendedIds: ["lift-2", "lift-3"]
  },
  {
    id: "user-4",
    name: "Daan Huizinga",
    email: "daan@huizingabouwtech.nl",
    phone: "+31 6 38402174",
    companyName: "Huizinga Bouw & Renovatie",
    profileType: "Aannemer",
    pastRentalsCount: 2,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop",
    historyRecommendedIds: ["lift-3", "lift-4"]
  },
  {
    id: "user-5",
    name: "Mila Visser",
    email: "mila.v@xs4all.nl",
    phone: "+31 6 77281944",
    profileType: "Particulier",
    pastRentalsCount: 1,
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop",
    historyRecommendedIds: ["lift-4"]
  }
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname === "/" ? "home" : location.pathname.substring(1);
  const setActiveTab = (tab: string) => {
    navigate(tab === "home" ? "/" : `/${tab}`);
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
        if (localStorage.getItem("hwh_admin_mode") === null) {
          setIsAdminMode(true);
        }
      } else {
        setCurrentUser({
          id: storeUser.id,
          name: storeUser.name,
          email: storeUser.email,
          phone: storeUser.phone || "",
          profileType: storeUser.profile || "Particulier",
          companyName: storeUser.profile !== "Particulier" ? "Firma " + storeUser.name : undefined,
          pastRentalsCount: 0
        });
        setIsAdminMode(false);
      }
    } else {
      setCurrentUser(null);
      setIsAdminMode(false);
    }
  }, [storeUser, setIsAdminMode]);

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

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Triggering notifications dynamically
  const triggerNotification = useCallback((title: string, message: string, type: "info" | "success" | "warning") => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type,
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications((prev) => [newNotif, ...prev]);
    
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
    triggerNotification("Afgemeld", "U bent nu veilig afgemeld uit uw account.", "info");
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

  // Triggered when search is executed from landing hero
  const handleLandingPageSearch = (query: string, category: string) => {
    setSearchQuery(query);
    setSelectedCategory(category || "all");
    triggerNotification(
      "Zoekopdracht Uitgevoerd",
      `Filteropdracht ingesteld voor category "${category || "Alles"}" met query "${query || "Geen"}".`,
      "info"
    );
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

    triggerNotification(
      "Machine geselecteerd",
      `"${machine.name}" is toegevoegd aan uw boekinglijst.`,
      "success"
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

    triggerNotification(
      "Machine Verwijderd",
      "De gekozen machine is verwijderd uit uw selectie.",
      "info"
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
    triggerNotification(
      "AI Analyse Voltooid",
      `De AI adviseur adviseert ${suggestedIds.length} object(en) die perfect matchen met uw activiteit.`,
      "success"
    );
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
        isAdminMode={isAdminMode}
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
                    userProfiles={mockUserProfiles}
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
                    userProfiles={mockUserProfiles}
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
      <footer className="border-t border-slate-150 bg-slate-50/50 pt-16 pb-12 text-[12.5px] text-slate-500 font-normal shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Main 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 text-left animate-fade-in">
            
            {/* Column 1: Brand Profile & Certifications */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="font-display text-lg font-black tracking-tight text-slate-900">{siteConfig.siteName}</span>
                <span className="text-[9.5px] text-indigo-700 font-semibold bg-indigo-50/70 px-2 py-0.5 rounded-full border border-indigo-100/50">B.V.</span>
              </div>
              <p className="text-slate-500 text-[12px] leading-relaxed max-w-xs">
                Premium hoogwerker verhuur in heel Nederland. Onze slimme AI-assistent helpt u direct bij het selecteren van de juiste machines op locatie.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <span className="bg-amber-50/80 border border-amber-200/50 text-amber-800 text-[9.5px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full">
                  BMWT-Lid
                </span>
                <span className="bg-indigo-50/80 border border-indigo-200/50 text-indigo-800 text-[9.5px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full">
                  Cat. 1-3B Co-Verzekerd
                </span>
              </div>
            </div>

            {/* Column 2: Direct Contact details */}
            <div className="space-y-4">
              <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
                Direct Contact
              </h4>
              <div className="space-y-3">
                <a 
                  href="tel:+31172456789" 
                  className="flex items-center space-x-2.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
                >
                  <Phone className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 shrink-0 group-hover:scale-110 transition-all duration-200" />
                  <span className="font-sans font-medium text-slate-750 text-[13px] tracking-tight">+31 (0)172 456 789</span>
                </a>
                <a 
                  href="mailto:support@hoogwerkerhub.nl" 
                  className="flex items-center space-x-2.5 text-slate-650 hover:text-indigo-600 transition-colors group cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 shrink-0 group-hover:scale-110 transition-all duration-200" />
                  <span className="font-sans font-medium break-all text-slate-700 text-[12.5px] tracking-tight">support@hoogwerkerhub.nl</span>
                </a>
                <div className="flex items-start space-x-2.5 text-slate-600 pt-1">
                  <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-800 text-[13px] block">Hoofdkantoor Hub</span>
                    <span className="text-[12px] leading-relaxed text-slate-500 block mt-0.5">Edisonweg 14, 2408 AB<br />Alphen aan den Rijn</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Logistics & Working Hours */}
            <div className="space-y-4">
              <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
                Logistiek & Openingstijden
              </h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-2.5">
                  <Clock className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-800 text-[13px] block">Maandag t/m Zaterdag</span>
                    <span className="text-[11.5px] font-semibold text-indigo-650 bg-indigo-50/60 border border-indigo-100/80 rounded px-2 py-0.5 mt-1.5 inline-block">07:00 – 18:00 uur</span>
                    <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                      Zondagsgesloten in overeenstemming met BMWT-rustregels voor logistiek transport.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 4: Quick Navigation & Admin Console */}
            <div className="space-y-4">
              <h4 className="font-display font-semibold tracking-wider text-[11px] uppercase text-slate-800 pb-1.5 border-b border-slate-100/80">
                Snelkoppelingen
              </h4>
              <nav className="flex flex-col space-y-2 text-left">
                <button 
                  onClick={() => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-left py-0.5"
                >
                  Home
                </button>
                <button 
                  onClick={() => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-left py-0.5"
                >
                  Catalog
                </button>
                <button 
                  onClick={() => { setActiveTab("advisor"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-left py-0.5"
                >
                  Adviseur
                </button>
                <button 
                  onClick={() => setShowContactModal(true)} 
                  className="text-[12.5px] font-medium text-slate-650 hover:text-indigo-600 transition-colors cursor-pointer text-left py-0.5"
                >
                  Contact
                </button>
                
                <div className="pt-2.5">
                  <button 
                    onClick={() => { setActiveTab("admin"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                    className="w-full inline-flex items-center justify-center space-x-1.5 text-[11.5px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/50 hover:border-amber-300 px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                    title="Systeembeheerder Console Log"
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Eigenaar Portaal</span>
                  </button>
                </div>
              </nav>
            </div>

          </div>

          {/* Bottom Copyright & KvK Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-slate-200 text-[11.5px] text-slate-500 gap-3">
            <span>© 2026 {siteConfig.siteName} B.V. Alle rechten voorbehouden. KvK Alphen a/d Rijn 8849201. Geregistreerd BMWT-lid.</span>
            <span className="text-[10px] font-semibold bg-slate-50 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200/60">
              Veiligheidsklasse Categorie 1-3B Co-Verzekerd
            </span>
          </div>

        </div>
      </footer>

      {/* INTERACTIVE CONTACT DETAILS MODAL */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 space-y-6 text-slate-800 animate-fade-in"
            >
              {/* Top ambient header bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-indigo-600 to-amber-500" />
              
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-600 font-display uppercase tracking-wider block font-bold">Klantenservice en Ondersteuning</span>
                  <h3 className="font-display text-2xl font-black text-slate-905 text-slate-900 tracking-tight">Support & Live Advies Center</h3>
                </div>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                {/* Left Pane: Direct WhatsApp & Call channels */}
                <div className="md:col-span-5 flex flex-col justify-between space-y-5 bg-slate-50 p-4.5 rounded-2xl border border-slate-150">
                  <div className="space-y-3">
                    <span className="text-[10px] font-display font-semibold text-indigo-650 uppercase tracking-wider block">Directe Communicatie</span>
                    <p className="text-[11.5px] leading-relaxed text-slate-500 font-medium">
                      Heeft u direct antwoord of advies nodig over de inzetbaarheid van een hoogwerker? Start direct een gesprek of bel ons hoofdkantoor.
                    </p>
                  </div>
                  
                  <div className="space-y-2.5">
                    {/* WhatsApp link (Prominent green card) */}
                    <a
                      href="https://wa.me/31645617283"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-xs cursor-pointer gap-3 shadow-sm hover:shadow group"
                    >
                      <div className="h-7 w-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8.5px] text-emerald-100 block font-bold leading-none mb-0.5 uppercase tracking-wide">WhatsApp Expert</span>
                        <span className="font-bold text-white text-[11.5px] block truncate">Start Live Chat 💬</span>
                      </div>
                    </a>

                    {/* Phone button */}
                    <a
                      href="tel:+31172456789"
                      className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-205 border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm"
                    >
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8.5px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">Bellen Regionaal</span>
                        <span className="font-sans font-semibold text-slate-800 text-[11.5px]">+31 (0)172 456 789</span>
                      </div>
                    </a>

                    {/* Email Link */}
                    <a
                      href="mailto:support@hoogwerkerhub.nl"
                      className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-100/50 border border-slate-205 border-slate-200 transition-all text-xs cursor-pointer gap-3 text-slate-700 group shadow-sm"
                    >
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8.5px] text-slate-400 block font-bold leading-none mb-0.5 uppercase tracking-wide">E-mail Servicedesk</span>
                        <span className="text-slate-800 text-[11px] block break-all font-semibold truncate">support@hoogwerkerhub.nl</span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Right Pane: Support Ticket Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const name = formData.get("ticketName") as string;
                    const contact = formData.get("ticketContact") as string;
                    const topic = formData.get("ticketTopic") as string;
                    const message = formData.get("ticketMsg") as string;
                    
                    if (name && contact && message) {
                      setShowContactModal(false);
                      setActiveToast({
                        id: `support-${Date.now()}`,
                        title: "Supportvraag Ontvangen",
                        message: `Beste ${name}, uw vraag over '${topic}' is in behandeling. We nemen binnen 15 minuten contact op!`,
                        type: "success"
                      });
                      handleAddSystemLog("system", name, `Supportvraag [${topic}]: ${message} (Contact: ${contact})`);
                    }
                  }}
                  className="md:col-span-7 flex flex-col justify-between space-y-3"
                >
                  <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-wider block">Direct een support-vraag stellen</span>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="ticketName"
                      required
                      placeholder="Uw Volledige Naam (of Bedrijfsnaam)"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />

                    <input
                      type="text"
                      name="ticketContact"
                      required
                      placeholder="E-mail of telefoonnummer"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />

                    <select
                      name="ticketTopic"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
                    >
                      <option value="Klantenservice">Klantenservice & Hulp</option>
                      <option value="AI Advies">Hulp bij AI Adviseur</option>
                      <option value="Transport & Logistiek">Transport & Logistieke Vraag</option>
                      <option value="Vloot & Tarieven">Zakelijke Vloot Aanvraag</option>
                      <option value="Overig">Overig / Technisch probleem</option>
                    </select>

                    <textarea
                      name="ticketMsg"
                      required
                      rows={3}
                      placeholder="Wat is uw specifieke vraag over de inzetbaarheid van ons materieel?"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-350 shrink-0" />
                    <span>Verstuur Bericht</span>
                  </button>
                </form>
              </div>

              {/* Dynamic Callback request section */}
              <div className="pt-3.5 border-t border-slate-100 space-y-3.5">
                <span className="text-[10px] font-display font-semibold text-slate-550 text-slate-500 uppercase tracking-widest block">Liever direct telefonisch advies? Bel-mij-terug formulier:</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const phone = formData.get("callbackPhone");
                    if (phone) {
                      setShowContactModal(false);
                      setActiveToast({
                        id: `callback-${Date.now()}`,
                        title: "Belaanvraag Ontvangen",
                        message: `Onze logistieke adviseur belt u binnen 10 minuten terug op ${phone}. Hartelijk dank!`,
                        type: "success"
                      });
                      handleAddSystemLog("system", "Bezoeker", `Belaanvraag geregistreerd voor nummer: ${phone} (Alphen aan den Rijn hub).`);
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="tel"
                    name="callbackPhone"
                    required
                    placeholder="Uw telefoonnummer (bijv. +31 6 ...)"
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0 border-none"
                  >
                    Bel mij terug
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING ACTION TOAST POPUPS (TOP RIGHT PANEL) */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 0, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-24 right-4 z-50 w-80 p-4 rounded-2xl glass-panel shadow-2xl flex items-start space-x-3 border-l-4 border-l-indigo-500"
          >
            <div className="mt-0.5 shrink-0">
              {activeToast.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-teal-400" />
              ) : activeToast.type === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-amber-550" />
              ) : (
                <Info className="h-5 w-5 text-blue-400" />
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="text-xs font-bold text-white leading-none">
                {activeToast.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {activeToast.message}
              </p>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="p-1 rounded text-slate-500 hover:text-white transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA INSTALL FLOATING BANNER */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-16 md:bottom-6 left-4 z-50 max-w-sm p-4 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl flex items-start space-x-3.5"
          >
            <div className="text-xl p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
              🏗️
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold font-display leading-tight">HoogwerkerHub installeren?</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Installeer onze PWA voor snellere laadtijden, realtime push-notificaties en offline kalenderinzicht.
              </p>
              <div className="flex items-center space-x-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl border-none cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  Nu installeren
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-xl border-none cursor-pointer transition-all"
                >
                  Later
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
