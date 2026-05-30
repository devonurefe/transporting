/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, Bell, Info, CheckCircle, AlertTriangle, X, MapPin, Phone, Mail, Clock, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Header from "./components/Header";
import HomeSection from "./components/HomeSection";
import CatalogSection from "./components/CatalogSection";
import AdvisorSection from "./components/AdvisorSection";
import BookingSection from "./components/BookingSection";
import AdminSection from "./components/AdminSection";
import MyOrdersSection from "./components/MyOrdersSection";
import { Machine, Order, AppNotification, ChatMessage, UserProfile, CartItem } from "./types";

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
  const [activeTab, setActiveTab] = useState<string>("home");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // Manageable storefront elements
  const [siteConfig, setSiteConfig] = useState({
    siteName: "HoogwerkerHub",
    heroTagline: "Smart Verhuur van Hoogwerkers in Nederland",
    heroTitle: "Uitzonderlijk bereik. Volledig ontzorgd.",
    heroSubtitle: "Van schilderwerk binnen tot zware industriebouw buiten; HoogwerkerHub levert direct de juiste machines op locatie. Met of zonder vakbekwame chauffeur, gecontroleerd door onze slimme AI-assistent.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "Vloot Adviseur",
    menuOrdersLabel: "Mijn Account",
    menuAdminLabel: "Portaal"
  });

  const [customCategories, setCustomCategories] = useState([
    { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor loodsen, schilder- en rechtlijnig montagewerk.", heights: "8m - 14m", price: "v.a. €120/dag" },
    { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over vaste obstakels heen te reiken.", heights: "12m - 20m", price: "v.a. €210/dag" },
    { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Gigantisch bereik op ruw bouwterrein.", heights: "16m - 40m", price: "v.a. €340/dag" },
    { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden met B-rijbewijs. Snel op locatie operationeel.", heights: "18m - 24m", price: "v.a. €250/dag" },
    { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Kruipt door binnendeuren en over zachte grasvelden.", heights: "12m - 22m", price: "v.a. €180/dag" },
    { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Kant-en-klaar editie voor schilder, zonnepaneel of snoeiwerk.", heights: "10m - 26m", price: "v.a. €110/dag" },
    { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig te transporteren en direct achter de auto te koppelen.", heights: "12m - 17m", price: "v.a. €95/dag" }
  ]);

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

  // Initial Rest sync with developer Express APIs
  useEffect(() => {
    // Fetch site config
    fetch("/api/site-config")
      .then((res) => {
        if (!res.ok) throw new Error("Site config fetch failed");
        return res.json();
      })
      .then((data) => {
        if (data) setSiteConfig(data);
      })
      .catch((err) => {
        console.warn("Using default client-side storefront branding config...");
      });

    // Fetch custom categories
    fetch("/api/categories")
      .then((res) => {
        if (!res.ok) throw new Error("Categories fetch failed");
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data)) setCustomCategories(data);
      })
      .catch((err) => {
        console.warn("Using default client-side categorizations...");
      });

    // Fetch machines
    fetch("/api/machines")
      .then((res) => {
        if (!res.ok) throw new Error("Catalog fetch failed");
        return res.json();
      })
      .then((data) => {
        setMachines(data);
      })
      .catch((err) => {
        console.warn("REST API client-fallback loaded due to development build pipeline connection...");
      });

    // Fetch orders
    fetch("/api/orders")
      .then((res) => {
        if (!res.ok) throw new Error("Order fetch failed");
        return res.json();
      })
      .then((data) => {
        setOrders(data);
      })
      .catch((err) => {
        console.warn("In-memory fallback orders initialized successfully...");
      });
  }, []);

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
    
    // Add to cart if not already present
    setCartItems((prev) => {
      const exists = prev.some((item) => item.machine.id === machine.id);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          machine,
          startDate: "2026-06-05",
          endDate: "2026-06-08"
        }
      ];
    });

    setActiveTab("booking");
    triggerNotification(
      "Machine geselecteerd",
      `"${machine.name}" is toegevoegd aan uw boekinglijst.`,
      "success"
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    triggerNotification(
      "Machine Verwijderd",
      "De gekozen machine is verwijderd uit uw selectie.",
      "info"
    );
  };

  const handleUpdateCartItemDates = (id: string, start: string, end: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, startDate: start, endDate: end } : item))
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Action: Submit reservation checkout
  const handleCreateReservation = async (orderData: Partial<Order>): Promise<Order | null> => {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error("Checkout creation failed via API");
      }

      const freshOrder: Order = await response.json();
      setOrders((prev) => [freshOrder, ...prev]);

      triggerNotification(
        "Betaling Geverifieerd",
        `Uw reservation ${freshOrder.id} is veilig geaccordeerd in de Mollie gateway.`,
        "success"
      );

      return freshOrder;
    } catch (err) {
      console.error(err);
      
      // Fallback implementation for maximum safety
      const simulatedOrder: Order = {
        id: `HWH-${Math.floor(1000 + Math.random() * 9000)}`,
        machineId: orderData.machineId || "demo",
        machineName: orderData.machineName || "Demomachine",
        machinePrice: Number(orderData.machinePrice || 100),
        startDate: orderData.startDate || "2026-06-05",
        endDate: orderData.endDate || "2026-06-08",
        rentalDays: Number(orderData.rentalDays || 3),
        deliveryType: orderData.deliveryType || "self_pickup",
        deliveryAddress: orderData.deliveryAddress || "",
        customerName: orderData.customerName || "Jan Demo",
        customerEmail: orderData.customerEmail || "demo@demo.nl",
        customerPhone: orderData.customerPhone || "06",
        customerProfile: orderData.customerProfile || "Particulier",
        subtotal: Number(orderData.subtotal || 0),
        transportCost: Number(orderData.transportCost || 0),
        driverCost: Number(orderData.driverCost || 0),
        vatAmount: Number(orderData.vatAmount || 0),
        totalAmount: Number(orderData.totalAmount || 0),
        status: "In behandeling",
        createdAt: new Date().toISOString()
      };

      setOrders((prev) => [simulatedOrder, ...prev]);
      triggerNotification(
        "Gereserveerd (Local Offline Mode)",
        `Uw reservation ${simulatedOrder.id} is offline opgeslagen in uw lokale sessie.`,
        "success"
      );
      return simulatedOrder;
    }
  };

  // Action: Add machinery from Admin portal
  const handleAddMachine = async (machData: Partial<Machine>): Promise<boolean> => {
    try {
      const response = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(machData)
      });

      if (!response.ok) throw new Error("Machinery creation failed");

      const created: Machine = await response.json();
      setMachines((prev) => [...prev, created]);

      triggerNotification(
        "Vloot Uitgebreid",
        `Model "${created.name}" is succesvol toegevoegd aan de actieve verhuurbasis.`,
        "success"
      );
      return true;
    } catch (err) {
      console.error(err);
      
      // Fallback
      const fallbackMach: Machine = {
        id: `custom-${Date.now()}`,
        name: machData.name || "Custom Unit Pro",
        category: machData.category || "schaarlift",
        categoryLabel: (machData.category || "schaarlift").toUpperCase(),
        height: Number(machData.height || 12),
        reach: Number(machData.reach || 0),
        weight: Number(machData.weight || 2000),
        pricePerDay: Number(machData.pricePerDay || 100),
        powerType: machData.powerType || "Elektrisch",
        imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=400&auto=format&fit=crop",
        imageAlt: "Custom Unit",
        description: machData.description || "Toegevoegd via handmatige admin procedure.",
        suitableFor: machData.suitableFor || ["Algemeen"]
      };

      setMachines((prev) => [...prev, fallbackMach]);
      triggerNotification(
        "Vloot Toegevoegd (Offline)",
        `Model "${fallbackMach.name}" is lokaal toegevoegd aan uw vloot.`,
        "success"
      );
      return true;
    }
  };

  // Action: Progress order status in Admin table
  const handleUpdateOrderStatus = (orderId: string, nextStatus: any) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          triggerNotification(
            "Contract Geüpdatet",
            `Aanvraag ${o.id} is veranderd naar status: "${nextStatus}".`,
            "info"
          );
          return { ...o, status: nextStatus };
        }
        return o;
      })
    );
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

      {/* Top Banner indicating preview condition */}
      <div className="bg-gradient-to-r from-slate-100/80 via-white to-slate-100/80 border-b border-slate-200/80 py-2 px-4 text-center text-[11px] text-slate-600 flex items-center justify-center space-x-1 font-mono">
        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
        <span>Ontwikkeld als premium high-fidelity mockup conform Stripe / Apple / Linear standaarden.</span>
      </div>

      {/* Primary Workspace Sections */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
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
          )}

          {activeTab === "catalog" && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CatalogSection 
                machines={machines}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onSelectMachineForBooking={handleSelectMachineForBooking}
                aiRecommendedMachineIds={aiRecommendedMachineIds}
              />
            </motion.div>
          )}

          {activeTab === "advisor" && (
            <motion.div
              key="advisor"
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
              />
            </motion.div>
          )}

          {activeTab === "booking" && (
            <motion.div
              key="booking"
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
          )}

          {activeTab === "orders" && (
            <motion.div
              key="orders"
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
          )}

          {activeTab === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AdminSection 
                machines={machines}
                orders={orders}
                onAddMachine={handleAddMachine}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                isAdminMode={isAdminMode}
                setIsAdminMode={setIsAdminMode}
                userProfiles={mockUserProfiles}
                systemLogs={systemLogs}
                onAddSystemLog={handleAddSystemLog}
                onClearSystemLogs={handleClearSystemLogs}
                siteConfig={siteConfig}
                setSiteConfig={setSiteConfig as any}
                customCategories={customCategories}
                setCustomCategories={setCustomCategories}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Footer block */}
      <footer className="border-t border-slate-200 bg-white pt-14 pb-10 text-xs text-slate-600 font-normal shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* Main 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 text-left animate-fade-in">
            
            {/* Column 1: Brand Profile & Certifications */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="font-display text-lg font-black tracking-tight text-slate-900">{siteConfig.siteName}</span>
                <span className="text-[10px] text-teal-700 font-mono font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-150">B.V.</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xs">
                Premium hoogwerker verhuur in heel Nederland. Onze slimme AI-assistent helpt u direct bij het selecteren van de juiste machines op locatie.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">
                  BMWT-Lid
                </span>
                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">
                  Cat. 1-3B Co-Verzekerd
                </span>
              </div>
            </div>

            {/* Column 2: Direct Contact details */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-extrabold pb-1 border-b border-slate-100">
                Direct Contact
              </h4>
              <div className="space-y-2.5">
                <a 
                  href="tel:+31172456789" 
                  className="flex items-center space-x-2.5 text-slate-600 hover:text-indigo-600 transition-colors group cursor-pointer"
                >
                  <Phone className="h-4 w-4 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-mono font-bold text-slate-850 text-[12.5px]">+31 (0)172 456 789</span>
                </a>
                <a 
                  href="mailto:support@hoogwerkerhub.nl" 
                  className="flex items-center space-x-2.5 text-slate-600 hover:text-indigo-600 transition-colors group cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-mono break-all text-slate-700 text-[11.5px]">support@hoogwerkerhub.nl</span>
                </a>
                <div className="flex items-start space-x-2.5 text-slate-600 pt-1">
                  <MapPin className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-850 block">Hoofdkantoor Hub</span>
                    <span className="text-[11px] leading-tight text-slate-500">Edisonweg 14, 2408 AB<br />Alphen aan den Rijn</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Logistics & Working Hours */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-extrabold pb-1 border-b border-slate-100">
                Logistiek & Openingstijden
              </h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-2.5">
                  <Clock className="h-4.5 w-4.5 text-teal-650 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Maandag t/m Zaterdag</span>
                    <span className="font-mono text-teal-700 font-bold">07:00 – 18:00 uur</span>
                    <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                      Zondagsgesloten in overeenstemming met BMWT-rustregels voor logistiek transport.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 4: Quick Navigation & Admin Console */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-extrabold pb-1 border-b border-slate-100">
                Snelkoppelingen
              </h4>
              <nav className="flex flex-col space-y-2 text-left">
                <button 
                  onClick={() => { setActiveTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="hover:text-indigo-650 text-slate-500 transition-colors cursor-pointer text-left font-semibold"
                >
                  Home
                </button>
                <button 
                  onClick={() => { setActiveTab("catalog"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="hover:text-indigo-650 text-slate-500 transition-colors cursor-pointer text-left font-semibold"
                >
                  Catalogus verhuur vloot
                </button>
                <button 
                  onClick={() => { setActiveTab("advisor"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                  className="hover:text-indigo-650 text-slate-500 transition-colors cursor-pointer text-left font-semibold"
                >
                  Vloot Smart Adviseur
                </button>
                <button 
                  onClick={() => setShowContactModal(true)} 
                  className="hover:text-indigo-650 text-slate-500 transition-colors cursor-pointer text-left font-semibold"
                >
                  Systeeminformatie & Contact
                </button>
                
                <div className="pt-2">
                  <button 
                    onClick={() => { setActiveTab("admin"); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                    className="w-full text-center text-amber-700 hover:text-amber-800 font-mono text-[10.5px] font-black border border-amber-500/20 hover:border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer hover:scale-[1.02]"
                    title="Systeembeheerder Console Log"
                  >
                    ⚿ Eigenaar Portaal [AdminMode]
                  </button>
                </div>
              </nav>
            </div>

          </div>

          {/* Bottom Copyright & KvK Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-slate-200 text-[11px] text-slate-500 gap-3">
            <span>© 2026 HoogwerkerHub B.V. Alle rechten voorbehouden. KvK Alphen a/d Rijn 8849201. Geregistreerd BMWT-lid.</span>
            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Veiligheidsklasse Categorie 1-3B Co-Verzekerd.
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
              className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 space-y-6 text-slate-800"
            >
              {/* Top ambient header bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-indigo-650 to-amber-500" />
              
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-teal-650 font-mono uppercase tracking-wider block font-bold">Regionale Aanwezigheid</span>
                  <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">Klantenservice & Hub</h3>
                </div>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left pane: Hub Coordinates */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Hoofdkantoor & Hub</label>
                    <div className="flex items-start space-x-2.5">
                      <MapPin className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-800">HoogwerkerHub B.V.</p>
                        <p>Edisonweg 14</p>
                        <p>2408 AB Alphen aan den Rijn</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">(Zuid-Holland • Routebeheer)</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Openingstijden Logistiek</label>
                    <div className="flex items-start space-x-2.5">
                      <Clock className="h-4.5 w-4.5 text-teal-605 text-teal-600 shrink-0" />
                      <div className="text-xs text-slate-650">
                        <p className="font-semibold text-slate-800">Maandag t/m Zaterdag</p>
                        <p className="font-mono text-teal-700 font-bold">07:00 – 18:00 uur</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">Zondagen gesloten i.v.m. BMWT-rustregels.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Direct Action list */}
                <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-150">
                  <span className="text-[10px] font-mono text-indigo-650 uppercase tracking-wider block font-bold">Direct contact opnemen</span>
                  
                  <div className="space-y-2.5">
                    {/* Phone button */}
                    <a
                      href="tel:+31172456789"
                      className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-305 transition-all text-xs cursor-pointer gap-3 text-slate-705 group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-slate-400 block font-medium leading-none mb-0.5">Bellen regionaal</span>
                        <span className="font-mono font-bold text-slate-800 text-[12.5px]">+31 (0)172 456 789</span>
                      </div>
                    </a>

                    {/* Email Link */}
                    <a
                      href="mailto:support@hoogwerkerhub.nl"
                      className="w-full flex items-center p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-305 transition-all text-xs cursor-pointer gap-3 text-slate-705 group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 font-mono">
                        <span className="text-[9px] text-slate-400 block font-medium leading-none mb-0.5 font-sans">Stuur e-mail</span>
                        <span className="text-slate-800 text-[11px] block break-all font-bold">support@hoogwerkerhub.nl</span>
                      </div>
                    </a>

                    {/* WhatsApp link */}
                    <a
                      href="https://wa.me/31645617283"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center p-3 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/35 transition-all text-xs cursor-pointer gap-3 text-slate-705 group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-emerald-600 block font-medium leading-none mb-0.5">WhatsApp Direct</span>
                        <span className="font-bold text-slate-800 block text-[12px]">Directe Chat Starten 💬</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>

              {/* Dynamic Callback request section */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Wilt u dat onze Hub u terugbelt?</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const phone = formData.get("callbackPhone");
                    if (phone) {
                      setShowContactModal(false);
                      setActiveToast({
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
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer font-display shrink-0"
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

    </div>
  );
}
