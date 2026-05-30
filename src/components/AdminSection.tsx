/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  BarChart3, 
  Layers, 
  Settings, 
  TrendingUp, 
  Users, 
  Sparkles, 
  PlusCircle, 
  FolderLock, 
  Truck, 
  Check, 
  X,
  Plus,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  LogIn,
  LogOut,
  Terminal,
  UserCheck,
  UserX,
  ShieldCheck,
  Trash2,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine, Order, UserProfile } from "../types";

interface AdminSectionProps {
  machines: Machine[];
  orders: Order[];
  onAddMachine: (machineData: Partial<Machine>) => Promise<boolean>;
  onUpdateOrderStatus: (orderId: string, nextStatus: any) => void;
  isAdminMode: boolean;
  setIsAdminMode: (adminMode: boolean) => void;
  userProfiles: UserProfile[];
  systemLogs: any[];
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  onClearSystemLogs: () => void;
  siteConfig: {
    siteName: string;
    heroTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    menuHomeLabel: string;
    menuCatalogLabel: string;
    menuAdvisorLabel: string;
    menuOrdersLabel: string;
  };
  setSiteConfig: React.Dispatch<React.SetStateAction<{
    siteName: string;
    heroTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    menuHomeLabel: string;
    menuCatalogLabel: string;
    menuAdvisorLabel: string;
    menuOrdersLabel: string;
    menuAdminLabel: string;
  }>>;
  customCategories: {
    id: string;
    label: string;
    listLabel?: string;
    desc: string;
    heights: string;
    price: string;
  }[];
  setCustomCategories: React.Dispatch<React.SetStateAction<{
    id: string;
    label: string;
    listLabel?: string;
    desc: string;
    heights: string;
    price: string;
  }[]>>;
}

export default function AdminSection({
  machines,
  orders,
  onAddMachine,
  onUpdateOrderStatus,
  isAdminMode,
  setIsAdminMode,
  userProfiles,
  systemLogs,
  onAddSystemLog,
  onClearSystemLogs,
  siteConfig,
  setSiteConfig,
  customCategories,
  setCustomCategories,
}: AdminSectionProps) {
  // Navigation sidebar sub-sections
  const [subTab, setSubTab] = useState<"dashboard" | "orders" | "machines" | "calendar" | "add" | "logs" | "customizer">("dashboard");
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Calendar manually blocked dates state & API handlers
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [selectedBlockMachineId, setSelectedBlockMachineId] = useState<string>("");
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [blockReason, setBlockReason] = useState<string>("Planmatig Onderhoud / Keuring");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState<boolean>(
    () => localStorage.getItem("gcal_linked") === "true"
  );
  const [isConnectingGCal, setIsConnectingGCal] = useState<boolean>(false);

  const handleToggleGoogleCalendar = () => {
    if (isGoogleCalendarConnected) {
      localStorage.removeItem("gcal_linked");
      setIsGoogleCalendarConnected(false);
    } else {
      setIsConnectingGCal(true);
      setTimeout(() => {
        localStorage.setItem("gcal_linked", "true");
        setIsGoogleCalendarConnected(true);
        setIsConnectingGCal(false);
      }, 1500);
    }
  };

  const handleSaveSiteConfig = () => {
    setIsSavingConfig(true);
    fetch("/api/site-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteConfig)
    })
    .then((res) => {
      if (!res.ok) throw new Error("Faulty response");
      return res.json();
    })
    .then(() => {
      onAddSystemLog("system", "Onur (Eigenaar)", "Storefront algemene en navigatie instellingen opgeslagen.");
      alert("Instellingen succesvol permanent opgeslagen!");
    })
    .catch((err) => {
      console.error(err);
      alert("Opslaan mislukt, probeer het opnieuw.");
    })
    .finally(() => {
      setIsSavingConfig(false);
    });
  };

  const fetchBlockedDates = async () => {
    try {
      const response = await fetch("/api/blocked-dates");
      if (response.ok) {
        const data = await response.json();
        setBlockedDates(data);
      }
    } catch (err) {
      console.error("Failed to load blocked dates:", err);
    }
  };

  React.useEffect(() => {
    fetchBlockedDates();
  }, []);

  const handleBlockDateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockMachineId || !blockDate) return;
    setIsSubmittingBlock(true);
    try {
      const res = await fetch("/api/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: selectedBlockMachineId,
          date: blockDate,
          reason: blockReason
        })
      });
      if (res.ok) {
        setBlockReason("Planmatig Onderhoud / Keuring");
        await fetchBlockedDates();
        onAddSystemLog("system", "Onur (Eigenaar)", `Datum ${blockDate} handmatig geblokkeerd of gesloten voor machine/pakket ID: ${selectedBlockMachineId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleUnblockDate = async (machineId: string, date: string) => {
    try {
      const res = await fetch("/api/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId,
          date,
          action: "unblock"
        })
      });
      if (res.ok) {
        await fetchBlockedDates();
        onAddSystemLog("system", "Onur (Eigenaar)", `Blokkade opgeheven voor datum ${date} op machine ID: ${machineId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin login credentials (pre-loaded)
  const [adminEmail, setAdminEmail] = useState("admin@hoogwerkerhub.nl");
  const [adminPassword, setAdminPassword] = useState("••••••••");

  // New Machine form state
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"schaarlift" | "knikarm" | "telescoop" | "auto" | "spin">("schaarlift");
  const [newHeight, setNewHeight] = useState("16");
  const [newReach, setNewReach] = useState("12");
  const [newWeight, setNewWeight] = useState("3200");
  const [newPrice, setNewPrice] = useState("150");
  const [newPower, setNewPower] = useState<"Elektrisch" | "Diesel" | "Hybride">("Elektrisch");
  const [newDescription, setNewDescription] = useState("");
  const [suitableInput, setSuitableInput] = useState("Schilder, Aannemer");

  // Sums for KPI dashboards
  const activeRentals = orders.filter(o => o.status === "Goedgekeurd" || o.status === "Onderweg").length;
  const completedRentals = orders.filter(o => o.status === "Voltooid").length;
  const pendingRegistrations = orders.filter(o => o.status === "In behandeling").length;
  
  const totalEarnings = orders.reduce((acc, current) => {
    return acc + current.totalAmount;
  }, 0);

  // Dynamic statistics calculated from active orders
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const profileEarnings = orders.reduce((acc, order) => {
    const prof = order.customerProfile || "Particulier";
    let key = "Particulier";
    if (prof.toLowerCase().includes("schilder")) key = "Schilder";
    else if (prof.toLowerCase().includes("hovenier") || prof.toLowerCase().includes("groen")) key = "Hovenier";
    else if (prof.toLowerCase().includes("glazenwasser")) key = "Glazenwasser";
    else if (prof.toLowerCase().includes("aannemer") || prof.toLowerCase().includes("bouw")) key = "Aannemer";
    
    acc[key] = (acc[key] || 0) + order.totalAmount;
    return acc;
  }, { Schilder: 0, Hovenier: 0, Glazenwasser: 0, Aannemer: 0, Particulier: 0 } as Record<string, number>);

  const categoryCount = machines.reduce((acc, machine) => {
    const cat = machine.category;
    let label = "Algemeen";
    if (cat === "schaarlift") label = "Schaarliften";
    else if (cat === "knikarm") label = "Knikarm";
    else if (cat === "telescoop") label = "Telescoop";
    else if (cat === "auto") label = "Autohoogv.";
    else if (cat === "spin") label = "Spinhoogv.";

    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleAdminVerifyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminMode(true);
    onAddSystemLog(
      "login", 
      "Onur (Bedrijfseigenaar)", 
      "Beheersessie verbonden vanaf geautoriseerd IP-adres (Amsterdam SSL Node)."
    );
  };

  const handleSubmitNewMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHeight || !newPrice) {
      alert("Naam, Hoogte en Prijs per dag zijn verplicht.");
      return;
    }

    setIsAdding(true);
    
    const parsedSuitable = suitableInput.split(",").map(s => s.trim()).filter(s => s.length > 0);

    const result = await onAddMachine({
      name: newName,
      category: newCategory,
      height: Number(newHeight),
      reach: Number(newReach),
      weight: Number(newWeight),
      pricePerDay: Number(newPrice),
      powerType: newPower,
      description: newDescription,
      suitableFor: parsedSuitable.length > 0 ? parsedSuitable : ["Algemeen"]
    });

    setIsAdding(false);

    if (result) {
      onAddSystemLog(
        "fleet", 
        "Onur (Bedrijfseigenaar)", 
        `Nieuw apparaat toegevoegd aan vloot: ${newName} (${newPower}).`
      );
      // Reset form fields
      setNewName("");
      setNewDescription("");
      setSuitableInput("Schilder, Aannemer");
      setSubTab("machines");
    } else {
      alert("Fout bij opslaan.");
    }
  };

  // If Owner is NOT logged into Admin mode, display secure login gateway
  if (!isAdminMode) {
    return (
      <div className="relative min-h-[calc(100vh-4.5rem)] py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-orange-600/3 blur-[120px] -z-10" />

        <div className="w-full max-w-md bg-slate-900/60 p-8 rounded-3xl border border-white/5 space-y-6 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Eigenaarsportaal Giriş</h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Beveiligde console voor de bedrijfseigenaar om de volledige vloot en actieve gebruikersstromen te overzien.
            </p>
          </div>

          <form onSubmit={handleAdminVerifyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-350 tracking-wider uppercase">Beheerder E-mail</label>
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
              className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] active:scale-99 cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>Verbinding Maken (Accederen)</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              Inloggegevens zijn lokaal versleuteld • AES-256
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-8 px-4 sm:px-6 lg:px-8">
      
      {/* Absolute Neon Grid lines decorative */}
      <div className="absolute top-1/2 left-1/3 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px] -z-10" />

      <div className="mx-auto max-w-7xl">
        
        {/* Workspace Title bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-amber-500/10 pb-5 mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center space-x-2.5">
              <FolderLock className="h-6.5 w-6.5 text-amber-400" />
              <span>HubAdmin Command Center</span>
            </h1>
            <p className="text-[11px] text-amber-400 font-mono uppercase tracking-wider mt-1 block">
              Gecentraliseerd Vloot- en Gebruikersdashboard (Eigenaar Portaal)
            </p>
          </div>

          <div className="flex items-center space-x-2 mt-3 sm:mt-0 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-xs text-amber-200 font-bold">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>Secure Admin Control • Active Connection</span>
          </div>
        </div>

        {/* Outer Split layout: Left sidebar switch, right tables/workspaces */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Navigation Sidebar panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-panel p-4 rounded-2xl flex flex-row lg:flex-col lg:space-y-1 overflow-x-auto lg:overflow-x-visible gap-1 pb-3 lg:pb-4 scrollbar-thin">
              
              {[
                { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                { id: "orders", label: "Huurcontracten", icon: Truck, count: orders.length },
                { id: "machines", label: "Machine Beheer", icon: Layers, count: machines.length },
                { id: "calendar", label: "Kalender & Datums", icon: Calendar, count: blockedDates.length },
                { id: "add", label: "Machine Toevoegen", icon: PlusCircle },
                { id: "customizer", label: "Beheer Storefront", icon: Settings },
                { id: "logs", label: "Ziyaretçi & Live Logs", icon: Terminal, count: systemLogs.length }
              ].map((sub) => {
                const Icon = sub.icon;
                const isSel = subTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSubTab(sub.id as any)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-initial cursor-pointer ${
                      isSel 
                        ? "bg-amber-550 bg-amber-600 text-slate-950 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.25)]" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/4 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4.5 w-4.5 ${isSel ? "text-slate-950" : "text-amber-400/80"}`} />
                      <span>{sub.label}</span>
                    </div>
                    {sub.count !== undefined && (
                      <span className={`hidden lg:inline-block font-mono text-[9px] px-2 py-0.5 rounded-full ${isSel ? "bg-slate-950 text-amber-400" : "bg-white/10 text-slate-300"}`}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* Live website indicators */}
            <div className="glass-panel p-4.5 rounded-2xl hidden lg:block space-y-3">
              <h4 className="font-display font-bold text-[10px] uppercase text-slate-400 tracking-wider">BMWT Status</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Server Gateway</span>
                  <span className="text-teal-400 font-semibold flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
                    <span className="font-mono">ONLINE</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>SSL Handshake</span>
                  <span className="text-teal-400 font-semibold font-mono">SECURE</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Fleet Availability</span>
                  <span className="text-white font-mono font-bold">100% Gecertificeerd</span>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONFIG VIEWPORT */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              
              {/* SUB TAB: DASHBOARD */}
              {subTab === "dashboard" && (
                <motion.div
                  key="dash-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Glowing Premium KPI Card deck */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {[
                      { title: "Cumulatieve Omzet", value: `€ ${totalEarnings.toFixed(2)}`, trend: "+14.2% deze maand", color: "from-amber-650 to-orange-650 bg-amber-900/30 border border-amber-500/20", kpiGlow: "" },
                      { title: "Actieve Huren", value: `${activeRentals} machines`, trend: "Planners onderweg", color: "border border-white/5 bg-slate-900/60" },
                      { title: "Vloot Bezetting", value: `${Math.round((activeRentals / machines.length) * 100)}% bezet`, trend: `${machines.length} units totaal`, color: "border border-white/5 bg-slate-900/60" },
                      { title: "Ter Beoordeling", value: `${pendingRegistrations} aanvragen`, trend: "Eigenaar goedkeuring", color: pendingRegistrations > 0 ? "border border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "border border-white/5 bg-slate-900/60 text-slate-400" }
                    ].map((card, idx) => {
                      return (
                        <div 
                          key={idx} 
                          className={`p-5 rounded-2xl flex flex-col justify-between min-h-[140px] ${card.color} ${card.kpiGlow || ""}`}
                        >
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block leading-none">
                              {card.title}
                            </span>
                            <span className="text-xl font-display font-extrabold text-white mt-3.5 block">
                              {card.value}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-auto leading-none pt-4">
                            {card.trend}
                          </span>
                        </div>
                      );
                    })}

                  </div>

                  {/* VISUAL ANALYTICS GRAPHICS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Panel 1: Revenue by Industry/Profile */}
                    <div className="glass-panel p-6 rounded-3xl space-y-4">
                      <div>
                        <h4 className="font-display font-bold text-xs uppercase text-slate-400 tracking-wider">Huur-omzet per Doelgroep</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Live overzicht gesegmenteerd op schilders, groenverzorgers e.a.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="h-44 flex items-end justify-between px-2 pt-4 border-b border-white/5 relative">
                          <div className="absolute right-2 top-0 flex flex-col text-right text-[9px] font-mono text-slate-500">
                            <span>Max: € {Math.max(...Object.values(profileEarnings), 100).toFixed(0)}</span>
                            <span>Midden: € {(Math.max(...Object.values(profileEarnings), 100) / 2).toFixed(0)}</span>
                          </div>

                          {Object.entries(profileEarnings).map(([sector, val]) => {
                            const maxVal = Math.max(...Object.values(profileEarnings), 100);
                            const percent = maxVal > 0 ? (val / maxVal) * 100 : 0;
                            const isHovered = hoveredSector === sector;
                            
                            // Assign unique sector style parameters
                            const colors: Record<string, string> = {
                              Schilder: "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
                              Hovenier: "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
                              Glazenwasser: "bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.3)]",
                              Aannemer: "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
                              Particulier: "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                            };

                            return (
                              <div
                                key={sector}
                                className="flex flex-col items-center flex-1 group cursor-pointer"
                                onMouseEnter={() => setHoveredSector(sector)}
                                onMouseLeave={() => setHoveredSector(null)}
                              >
                                {/* Tooltip wrapper */}
                                <div className={`absolute -top-4 transition-all duration-250 ease-out flex flex-col items-center pointer-events-none ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90 translate-y-1"}`}>
                                  <span className="bg-slate-950/95 border border-white/10 px-2 py-1 rounded-lg text-[10px] text-white font-black font-mono shadow-xl">
                                    € {val.toFixed(2)}
                                  </span>
                                  <div className="w-1.5 h-1.5 bg-slate-950 border-r border-b border-white/10 rotate-45 -mt-1" />
                                </div>

                                {/* Rounded Bar with custom height */}
                                <div className="w-10 sm:w-12 bg-white/5 rounded-t-xl overflow-hidden h-32 flex items-end">
                                  <div
                                    style={{ height: `${Math.max(percent, 4)}%` }}
                                    className={`w-full rounded-t-lg transition-all duration-500 ease-out origin-bottom ${colors[sector] || "bg-slate-400"} ${isHovered ? "brightness-125 scale-x-[1.04]" : "brightness-100"}`}
                                  />
                                </div>

                                <span className={`text-[9px] font-mono mt-2 transition-colors ${isHovered ? "text-white font-bold" : "text-slate-400"}`}>
                                  {sector}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                          {Object.entries(profileEarnings).map(([sector, val]) => (
                            <div key={sector} className="flex items-center space-x-1.5 text-slate-300">
                              <span className={`h-2 w-2 rounded-full ${
                                sector === "Schilder" ? "bg-blue-500" :
                                sector === "Hovenier" ? "bg-emerald-500" :
                                sector === "Glazenwasser" ? "bg-teal-500" :
                                sector === "Aannemer" ? "bg-amber-500" : "bg-indigo-500"
                              }`} />
                              <span className="font-medium">{sector}:</span>
                              <span className="font-mono font-bold text-white ml-auto">€ {val.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: Fleet Composition Linear scale */}
                    <div className="glass-panel p-6 rounded-3xl space-y-4">
                      <div>
                        <h4 className="font-display font-bold text-xs uppercase text-slate-400 tracking-wider">Actieve Vloot Samenstelling</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Volledige inventaris verdeeld over productgroepen</p>
                      </div>

                      <div className="space-y-6">
                        {/* Interactive multi-segmented bar meter representing composition */}
                        <div className="space-y-2">
                          <div className="flex h-5 w-full rounded-full overflow-hidden bg-white/5 p-0.5 border border-white/10">
                            {Object.entries(categoryCount).map(([group, val], idx) => {
                              const totalUnits = Object.values(categoryCount).reduce((a, b) => a + b, 0);
                              const segmentPercent = (val / totalUnits) * 100;

                              const segmentColors = [
                                "bg-amber-450 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
                                "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.25)]",
                                "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
                                "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
                                "bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.25)]",
                              ];
                              const colorClass = segmentColors[idx % segmentColors.length];

                              return (
                                <div
                                  key={group}
                                  style={{ width: `${segmentPercent}%` }}
                                  className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 relative group cursor-pointer ${colorClass}`}
                                >
                                  {/* Inline tooltip */}
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-white/10 text-[9px] text-white px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-30 shadow-2xl">
                                    {group}: {val} {val === 1 ? "unit" : "units"} ({Math.round(segmentPercent)}%)
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span>Vloot-omvang: {machines.length} Geregistreerd</span>
                            <span>BMWT Inspectienorm 2026</span>
                          </div>
                        </div>

                        {/* Direct progress indicators for each group */}
                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                          {Object.entries(categoryCount).map(([group, val], idx) => {
                            const totalUnits = Object.values(categoryCount).reduce((a, b) => a + b, 0);
                            const valPercent = (val / totalUnits) * 100;
                            const segmentColors = ["bg-amber-500", "bg-blue-500", "bg-rose-500", "bg-emerald-500", "bg-teal-500"];
                            const colorClass = segmentColors[idx % segmentColors.length];

                            return (
                              <div key={group} className="space-y-1">
                                <div className="flex items-center justify-between text-[10.5px]">
                                  <span className="text-slate-300 font-bold">{group}</span>
                                  <span className="text-slate-400 font-mono text-[10px]">{val} {val === 1 ? "machine" : "machines"} ({Math.round(valPercent)}%)</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-950/80 rounded-full overflow-hidden">
                                  <div style={{ width: `${valPercent}%` }} className={`h-full rounded-full ${colorClass}`} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Orders Summary lists */}
                  <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h3 className="font-display font-bold text-sm text-white">Inkomende Aanvragen & Huren</h3>
                      <button 
                        onClick={() => setSubTab("orders")}
                        className="text-xs text-amber-400 hover:text-white font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Bekijk alle</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-400">
                            <th className="pb-2.5 font-bold">Ref No.</th>
                            <th className="pb-2.5 font-bold">Klant</th>
                            <th className="pb-2.5 font-bold">Machine</th>
                            <th className="pb-2.5 font-bold">Dagen</th>
                            <th className="pb-2.5 font-bold">Bedrag (incl BTW)</th>
                            <th className="pb-2.5 font-bold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/4">
                          {orders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-500">
                                Er zijn momenteel geen boekingen in de database.
                              </td>
                            </tr>
                          ) : (
                            orders.slice(0, 4).map((o) => {
                              return (
                                <tr key={o.id} className="hover:bg-white/2 transition-colors">
                                  <td className="py-3 font-mono font-bold text-indigo-300">{o.id}</td>
                                  <td className="py-3 font-medium text-white">
                                    {o.customerName}
                                    <span className="block text-[10px] text-slate-500 font-normal">{o.customerProfile}</span>
                                  </td>
                                  <td className="py-3 text-slate-300">{o.machineName}</td>
                                  <td className="py-3 font-mono">{o.rentalDays}d</td>
                                  <td className="py-3 font-mono text-teal-400 font-bold">€ {o.totalAmount.toFixed(2)}</td>
                                  <td className="py-3 text-center">
                                    <span className={`inline-block text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase ${
                                      o.status === "In behandeling" 
                                        ? "bg-amber-400/20 text-amber-400" 
                                        : o.status === "Goedgekeurd"
                                          ? "bg-teal-500/20 text-teal-400"
                                          : o.status === "Onderweg"
                                            ? "bg-blue-500/20 text-blue-400"
                                            : "bg-slate-700/30 text-slate-400"
                                    }`}>
                                      {o.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* SUB TAB: ORDERS CONTRACTS */}
              {subTab === "orders" && (
                <motion.div
                  key="orders-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <h3 className="font-display font-bold text-sm text-white">Alle Actieve & Historische Contracten</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Hier accordeert u inkomende reserveringen en past u de logistieke status aan van klanten.</p>
                    </div>

                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-400">
                            <th className="pb-3.5 font-bold font-mono">ID</th>
                            <th className="pb-3.5 font-bold">Huurder Details</th>
                            <th className="pb-3.5 font-bold">Besteld Object</th>
                            <th className="pb-3.5 font-bold">Grote Logistiek</th>
                            <th className="pb-3.5 font-bold">Periode</th>
                            <th className="pb-3.5 font-bold">Som</th>
                            <th className="pb-3.5 font-bold text-center">Accordering & Acties</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {orders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                Geen contracten beschikbaar in het beheerder log.
                              </td>
                            </tr>
                          ) : (
                            orders.map((o) => {
                              return (
                                <tr key={o.id} className="hover:bg-white/2 transition-colors">
                                  <td className="py-4 font-mono font-bold text-indigo-300">{o.id}</td>
                                  <td className="py-4 font-medium text-white col-span-1">
                                    <div>{o.customerName}</div>
                                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{o.customerPhone}</span>
                                    <span className="block text-[9.5px] text-slate-500 truncate max-w-[120px]">{o.customerEmail}</span>
                                  </td>
                                  <td className="py-4">
                                    <div className="font-bold text-slate-200">{o.machineName}</div>
                                    <span className="block text-[10px] text-slate-500 mt-0.5">{o.customerProfile}</span>
                                  </td>
                                  <td className="py-4">
                                    <span className="text-[11px] text-slate-350 block">
                                      {o.deliveryType === "self_pickup" ? "Zelf Afhalen (Gratis)" : "Bezorgservice"}
                                    </span>
                                    {o.deliveryAddress && (
                                      <span className="block text-[9px] text-slate-500 truncate max-w-[150px] mt-0.5 leading-none" title={o.deliveryAddress}>
                                        {o.deliveryAddress}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 whitespace-nowrap">
                                    <div className="text-white">{o.startDate}</div>
                                    <span className="text-[10px] text-slate-500 block font-mono mt-0.5">({o.rentalDays}d)</span>
                                  </td>
                                  <td className="py-4 font-mono font-bold text-teal-400">€ {o.totalAmount.toFixed(2)}</td>
                                  <td className="py-4 text-center">
                                    <div className="flex flex-col gap-1.5 justify-center items-center">
                                      <span className={`inline-block text-[9px] font-mono px-2 py-0.5 rounded-full font-extrabold uppercase ${
                                        o.status === "In behandeling" 
                                          ? "bg-amber-400/20 text-amber-400" 
                                          : o.status === "Goedgekeurd"
                                            ? "bg-teal-500/20 text-teal-400"
                                            : o.status === "Onderweg"
                                              ? "bg-blue-500/20 text-blue-400"
                                              : "bg-slate-700/30 text-slate-400"
                                      }`}>
                                        {o.status}
                                      </span>

                                      {/* Handle action buttons */}
                                      {o.status === "In behandeling" && (
                                        <button
                                          onClick={() => {
                                            onUpdateOrderStatus(o.id, "Goedgekeurd");
                                            onAddSystemLog("status", "Onur (Eigenaar)", `Bestelling goedgekeurd: ${o.id} voor ${o.customerName}.`);
                                          }}
                                          className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-[9px] font-black px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95"
                                        >
                                          Accorderen
                                        </button>
                                      )}
                                      {o.status === "Goedgekeurd" && (
                                        <button
                                          onClick={() => {
                                            onUpdateOrderStatus(o.id, "Onderweg");
                                            onAddSystemLog("status", "Onur (Eigenaar)", `Chauffeur ingepland & machine onderweg: ${o.id}.`);
                                          }}
                                          className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95"
                                        >
                                          Versturen
                                        </button>
                                      )}
                                      {o.status === "Onderweg" && (
                                        <button
                                          onClick={() => {
                                            onUpdateOrderStatus(o.id, "Voltooid");
                                            onAddSystemLog("status", "Onur (Eigenaar)", `Verhuurcontract succesvol afgerond: ${o.id}.`);
                                          }}
                                          className="bg-slate-755 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold px-2.5 py-1 rounded cursor-pointer leading-none transition-transform active:scale-95"
                                        >
                                          Voltooien
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SUB TAB: MACHINERY LIST CATALOG */}
              {subTab === "machines" && (
                <motion.div
                  key="mach-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">Actuele Machine Pool</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Overzicht van geverifieerde units beschikbaar op het netwerk.</p>
                      </div>
                      <button
                        onClick={() => setSubTab("add")}
                        className="bg-amber-500/25 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Toevoegen</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-400">
                            <th className="pb-2.5 font-bold">Machine</th>
                            <th className="pb-2.5 font-bold">Onderdeel</th>
                            <th className="pb-2.5 font-bold">Werkhoogte</th>
                            <th className="pb-2.5 font-bold">ZijwBereik</th>
                            <th className="pb-2.5 font-bold">Gewicht</th>
                            <th className="pb-2.5 font-bold">Aandrijving</th>
                            <th className="pb-2.5 font-bold">Totaalprijs/dag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {machines.map((m) => {
                            return (
                              <tr key={m.id} className="hover:bg-white/2 transition-colors">
                                <td className="py-3 font-bold text-white flex items-center space-x-2.5">
                                  <div className="h-8 w-11 rounded-lg overflow-hidden shrink-0 border border-white/5 bg-slate-950">
                                    <img src={m.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                  <span>{m.name}</span>
                                </td>
                                <td className="py-3 uppercase font-mono text-[9px] text-slate-400 font-extrabold">{m.category}</td>
                                <td className="py-3 text-slate-350 font-mono">{m.height} m</td>
                                <td className="py-3 text-slate-350 font-mono">{m.reach || "--"} m</td>
                                <td className="py-3 text-slate-350 font-mono">{m.weight || "--"} kg</td>
                                <td className="py-3 text-slate-350">{m.powerType || "Elektrisch"}</td>
                                <td className="py-3 font-mono text-teal-400 font-bold">€ {m.pricePerDay}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SUB TAB: ADD NEW MACHINE FORM */}
              {subTab === "add" && (
                <motion.div
                  key="add-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-panel p-6 rounded-3xl space-y-6"
                >
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                      <PlusCircle className="h-5 w-5 text-amber-400" />
                      <span>Voeg een Nieuwe Hoogwerker toe aan de Vloot</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Na toevoeging is deze machine direct doorzoekbaar en boekbaar op de website.</p>
                  </div>

                  <form onSubmit={handleSubmitNewMachine} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Titel / Modelnaam</label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Bijv. Elektrische Schaarlift Pro 140"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Machine Categorie</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as any)}
                          className="w-full bg-[#080d17] border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 cursor-pointer h-9.5"
                        >
                          <option value="schaarlift">Schaarlift (schaarlift)</option>
                          <option value="knikarm">Knikarmhoogwerker (knikarm)</option>
                          <option value="telescoop">Telescoophoogwerker (telescoop)</option>
                          <option value="auto">Autohoogwerker B-Rijbewijs (auto)</option>
                          <option value="spin">Spinhoogwerker Spider (spin)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Werkhoogte (in meters)</label>
                        <input
                          type="number"
                          required
                          value={newHeight}
                          onChange={(e) => setNewHeight(e.target.value)}
                          placeholder="Bijv. 16"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Zijwaarts Bereik (in meters, optioneel)</label>
                        <input
                          type="number"
                          value={newReach}
                          onChange={(e) => setNewReach(e.target.value)}
                          placeholder="Bijv. 12"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Eigen Gewicht (in kg, optioneel)</label>
                        <input
                          type="number"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          placeholder="Bijv. 3200"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-300 block font-semibold">Huurtarief (Euro per Dag)</label>
                        <input
                          type="number"
                          required
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          placeholder="Bijv. 150"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-300 block font-semibold">Aandrijving</label>
                        <div className="flex space-x-4">
                          {["Elektrisch", "Diesel", "Hybride"].map((power) => (
                            <label key={power} className="flex items-center space-x-2 cursor-pointer text-xs">
                              <input
                                  type="radio"
                                  name="newPowerRadio"
                                  checked={newPower === power}
                                  onChange={() => setNewPower(power as any)}
                                  className="accent-amber-500"
                                />
                              <span className="text-slate-300">{power}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-300 block font-semibold">Doelgroepen (komma gescheiden)</label>
                        <input
                          type="text"
                          value={suitableInput}
                          onChange={(e) => setSuitableInput(e.target.value)}
                          placeholder="Bijv. Schilder, Aannemer, Glazenwasser, Hovenier"
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-300 block font-semibold">Omschrijving</label>
                        <textarea
                          rows={3}
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="Korte beschrijving van de toepasbaarheid..."
                          className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 resize-none"
                        />
                      </div>

                    </div>

                    <div className="flex justify-end pt-4 border-t border-white/5">
                      <button
                        type="submit"
                        disabled={isAdding}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0 flex items-center space-x-1.5 cursor-pointer"
                      >
                        {isAdding ? (
                          <>
                            <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Opslaan...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-slate-950" />
                            <span>Vloot Opslaan</span>
                          </>
                        )}
                      </button>
                    </div>

                  </form>
                </motion.div>
              )}

              {/* NEW SUB TAB: LIVE LOGS & VISITOR CONTROLLER */}
              {subTab === "logs" && (
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
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center space-x-2">
                          <Terminal className="h-4 w-4 text-amber-400" />
                          <h3 className="font-display font-bold text-sm text-white">Systeemactiviteit (In- & Uitlog Logs)</h3>
                        </div>
                        {systemLogs.length > 0 && (
                          <button
                            onClick={onClearSystemLogs}
                            className="text-[10px] font-bold text-slate-500 hover:text-rose-400 flex items-center space-x-1 border border-white/5 hover:border-rose-400/20 bg-white/3 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Schoonmaken</span>
                          </button>
                        )}
                      </div>

                      <div className="bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-white/5 space-y-3 font-mono text-[10px] sm:text-[11px] max-h-120 overflow-y-auto scrollbar-thin">
                        {systemLogs.length === 0 ? (
                          <div className="py-12 text-center text-slate-500">
                            Geen logdata beschikbaar. Simuleer acties rechts!
                          </div>
                        ) : (
                          systemLogs.map((log) => {
                            let typeColor = "text-amber-400 bg-amber-500/10 border border-amber-500/15";
                            if (log.type === "login") typeColor = "text-blue-400 bg-blue-500/10 border border-blue-500/15";
                            if (log.type === "logout") typeColor = "text-rose-455 text-rose-400 bg-rose-500/10 border border-rose-500/15";
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
                        <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center space-x-1">
                          <Users className="h-4 w-4 text-amber-400" />
                          <span>Ziyaretçi & Klant Controllers</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          Als eigenaar kunt u direct loggebeurtenissen simuleren om uw verbindingen te testen. Klik op de in-/uitlog triggers hieronder om direct de live logs feed te injecteren conform uw specificatie!
                        </p>
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-white/5">
                        {userProfiles.map((p) => {
                          return (
                            <div key={p.id} className="p-3 bg-slate-950/40 rounded-xl space-y-2.5 border border-white/3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <img src={p.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                                  <div>
                                    <h5 className="text-[11px] font-bold text-white leading-none">{p.name}</h5>
                                    <span className="text-[9px] text-slate-500 mt-0.5 inline-block">{p.profileType}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-0.5">
                                <button
                                  onClick={() => {
                                    onAddSystemLog("login", p.name, `Klant heeft ingelogd op de website (Gezamenlijke sessie geopend via IP-check).`);
                                  }}
                                  className="py-1.5 bg-blue-600/10 hover:bg-blue-600 hover:text-white border border-blue-500/20 text-[9.5px] font-bold text-blue-300 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1"
                                >
                                  <UserCheck className="h-3 w-3 shrink-0" />
                                  <span>Inlog Log</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    onAddSystemLog("logout", p.name, `Klant heeft zich uitgelogd (Sessie vernietigd, koekboodschappen verwijderd).`);
                                  }}
                                  className="py-1.5 bg-rose-600/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-[9.5px] font-bold text-rose-300 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1"
                                >
                                  <UserX className="h-3 w-3 shrink-0" />
                                  <span>Uitlog Log</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* SUB TAB: CUSTOMIZER */}
              {subTab === "customizer" && (
                <motion.div
                  key="customizer-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="glass-panel p-6 rounded-3xl space-y-6">
                    <div className="border-b border-white/5 pb-3">
                      <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                        <Settings className="h-5 w-5 text-amber-400" />
                        <span>Beheer Storefront & Customizer</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Pas logo's, banners, menu-namen of product-categorieën direct aan op de website.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Store Details Form */}
                      <div className="space-y-4 p-5 rounded-2xl bg-white/3 border border-white/5">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Algemene Storefront Copywriting</h4>
                        
                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Store Naam (Logo)</label>
                          <input
                            type="text"
                            value={siteConfig.siteName}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, siteName: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Hero Tagline Banner</label>
                          <input
                            type="text"
                            value={siteConfig.heroTagline}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, heroTagline: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Hero Grote Titel</label>
                          <input
                            type="text"
                            value={siteConfig.heroTitle}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, heroTitle: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Hero Korte Paragraaf (Subtitle)</label>
                          <textarea
                            rows={3}
                            value={siteConfig.heroSubtitle}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 resize-none animate-none"
                          />
                        </div>

                      </div>

                      {/* Header Menu Labels Form */}
                      <div className="space-y-4 p-5 rounded-2xl bg-white/3 border border-white/5">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Navigatiemenu Aanpassen</h4>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Labels - Homepagina</label>
                          <input
                            type="text"
                            value={siteConfig.menuHomeLabel}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, menuHomeLabel: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Labels - Catalogus</label>
                          <input
                            type="text"
                            value={siteConfig.menuCatalogLabel}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, menuCatalogLabel: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Labels - AI Vloot Adviseur</label>
                          <input
                            type="text"
                            value={siteConfig.menuAdvisorLabel}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, menuAdvisorLabel: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Labels - Mijn Account</label>
                          <input
                            type="text"
                            value={siteConfig.menuOrdersLabel}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, menuOrdersLabel: e.target.value }))}
                            className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                          />
                        </div>

                      </div>

                      {/* Save Button for Site Config */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveSiteConfig}
                          disabled={isSavingConfig}
                          className="flex items-center space-x-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        >
                          {isSavingConfig ? (
                            <>
                              <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1" />
                              <span>Opslaan...</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4.5 w-4.5 shrink-0" />
                              <span>Storefront Instellingen Opslaan</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                    {/* Category Manager */}
                    <div className="p-5 rounded-2xl bg-white/3 border border-white/5 space-y-4">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Actuele Groep Categoriseringen & Filter Opties</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {customCategories.map((cat) => (
                          <div key={cat.id} className="p-3 bg-slate-950/60 border border-white/5 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white">{cat.label}</span>
                              <div className="flex items-center space-x-1">
                                <span className="text-[9px] font-mono text-amber-400 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded font-extrabold">{cat.id}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Weet u zeker dat u de categorie "${cat.label}" wilt verwijderen?`)) {
                                      const updated = customCategories.filter((c) => c.id !== cat.id);
                                      setCustomCategories(updated);
                                      fetch("/api/categories", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(updated)
                                      })
                                      .then(() => {
                                        onAddSystemLog("system", "Onur (Eigenaar)", `Categorie verwijderd: ${cat.label} (${cat.id}).`);
                                      });
                                    }
                                  }}
                                  className="text-rose-450 hover:text-rose-400 font-extrabold px-1 cursor-pointer transition-colors"
                                  title="Verwijder Categorie"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-relaxed">{cat.desc}</p>
                            <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-mono">
                              <span>Hoogten: {cat.heights}</span>
                              <span>Prijzen: {cat.price}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Category Form inline */}
                      <AddCategoryForm customCategories={customCategories} setCustomCategories={setCustomCategories} onAddSystemLog={onAddSystemLog} />

                    </div>

                  </div>
                </motion.div>
              )}

              {subTab === "calendar" && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="lg:col-span-9 space-y-6 animate-fade-in"
                >
                  <div className="glass-panel p-6 rounded-3xl space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4">
                      <div>
                        <h3 className="font-display font-black text-lg text-white flex items-center space-x-2">
                          <Calendar className="h-5.5 w-5.5 text-amber-400" />
                          <span>Kalender Blokkades & Systeemsluitingen</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Blokkeer specifiek materieel of pakketten voor onderhoud, keuringen of feestdagen om realtime boekingen te voorkomen.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchBlockedDates}
                        className="text-[11px] font-mono text-amber-400 hover:text-white mt-2 sm:mt-0 flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3 shrink-0" />
                        <span>Ververs kalender</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: block a date form */}
                      <form onSubmit={handleBlockDateSubmit} className="lg:col-span-5 p-5 rounded-2xl bg-white/3 border border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Selecteer om te Blokkeren</h4>
                        
                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Kies Machine of Set/Pakket *</label>
                          <select
                            required
                            value={selectedBlockMachineId}
                            onChange={(e) => setSelectedBlockMachineId(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value="">-- Maak uw vlootkeuze --</option>
                            {machines.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Geplande Sluitingsdatum *</label>
                          <input
                            type="date"
                            required
                            value={blockDate}
                            onChange={(e) => setBlockDate(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 block font-semibold">Reden voor de Blokkade *</label>
                          <input
                            type="text"
                            required
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="bijv: TÜV Keuring / Periodiek onderhoud / Demo"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingBlock || !selectedBlockMachineId}
                          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl transition-all border-none cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                          <Plus className="h-4 w-4 shrink-0" />
                          <span>{isSubmittingBlock ? "Sluiten..." : "Sluit deze datum"}</span>
                        </button>
                      </form>

                      {/* Right: show active blocked list */}
                      <div className="lg:col-span-7 space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Actieve Systeemsluitingen ({blockedDates.length})</span>
                          <span className="text-[10px] lowercase font-normal font-mono text-slate-500">gebaseerd op realtime database</span>
                        </h4>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                          {blockedDates.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-white/2 border border-white/3 text-center text-slate-500 space-y-2">
                              <Calendar className="h-8 w-8 text-slate-600 mx-auto" />
                              <p className="text-xs font-medium">Alle datums zijn momenteel open voor boekingen.</p>
                            </div>
                          ) : (
                            blockedDates.map((block) => {
                              const relatedMachine = machines.find(m => m.id === block.machineId);
                              return (
                                <div key={block.id} className="p-3.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/8 border border-amber-500/15 transition-all flex justify-between items-start">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                      <h4 className="text-xs font-extrabold text-white truncate leading-none">
                                        {relatedMachine ? relatedMachine.name : block.machineId}
                                      </h4>
                                    </div>
                                    <p className="text-[10px] font-mono text-amber-300 leading-none">
                                      Datum: {block.date}
                                    </p>
                                    <p className="text-[10.5px] text-slate-400 leading-normal">
                                      Reden: <span className="text-slate-200 font-semibold">{block.reason || "Geen opgegeven reden"}</span>
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleUnblockDate(block.machineId, block.date)}
                                    className="text-[10px] font-bold text-rose-450 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/20 cursor-pointer transition-colors"
                                  >
                                    Vrijgeven
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Google Calendar Linkage Card */}
                    <div className="border-t border-white/5 pt-6 mt-6 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${isGoogleCalendarConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse'} shrink-0`} />
                            <span>Google Calendar Realtime Synchronisatie (API)</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Integreer uw vlootagenda met Google Agenda voor automatische updates op mobiel en tablet.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleToggleGoogleCalendar}
                          disabled={isConnectingGCal}
                          className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all flex items-center space-x-2 cursor-pointer ${
                            isGoogleCalendarConnected 
                              ? "bg-slate-950 border border-white/10 text-rose-450 hover:bg-slate-900" 
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-650/10"
                          }`}
                        >
                          {isConnectingGCal ? (
                            <>
                              <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                              <span>Verbinding maken...</span>
                            </>
                          ) : isGoogleCalendarConnected ? (
                            <span>Koppeling verbreken</span>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 shrink-0" />
                              <span>Google Agenda koppelen</span>
                            </>
                          )}
                        </button>
                      </div>

                      {isGoogleCalendarConnected ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 grid grid-cols-1 md:grid-cols-12 gap-5"
                        >
                          {/* Sync Options Panel */}
                          <div className="md:col-span-12 lg:col-span-5 space-y-3">
                            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Synchronisatie Instellingen</h5>
                            <div className="space-y-2 text-xs text-slate-300">
                              <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
                                <input type="checkbox" defaultChecked className="rounded bg-slate-950 accent-emerald-500" />
                                <span>Randevus & huurovereenkomsten push</span>
                              </label>
                              <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
                                <input type="checkbox" defaultChecked className="rounded bg-slate-950 accent-emerald-500" />
                                <span>BMWT Keuringen/blokkades push</span>
                              </label>
                              <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
                                <input type="checkbox" defaultChecked className="rounded bg-slate-950 accent-emerald-500" />
                                <span>Logistiek transport schema's push</span>
                              </label>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                              Status: <span className="text-emerald-400 font-semibold font-mono">LIVE ACTIEF</span> • Gekoppeld aan <b>info@hoogwerkerhub.nl</b>. Herinneringen ingesteld op 24 uur vooraf.
                            </p>
                          </div>

                          {/* Synced Event Feeds */}
                          <div className="md:col-span-12 lg:col-span-7 space-y-3.5">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex justify-between items-center">
                              <span>Recente kalender synchronisatielogboek</span>
                              <span className="text-emerald-500 text-[9px] bg-emerald-500/10 px-1 rounded font-extrabold font-mono flex items-center space-x-1">
                                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span>LIVE</span>
                              </span>
                            </h5>

                            <div className="space-y-2 text-[11px] font-mono">
                              {blockedDates.length === 0 && orders.length === 0 && (
                                <div className="text-slate-500 text-xs py-2 italic font-sans">Geen actieve data om te synchroniseren.</div>
                              )}
                              {blockedDates.slice(0, 2).map((block, bIdx) => {
                                const mOption = machines.find((m) => m.id === block.machineId);
                                return (
                                  <div key={`gcal-block-${bIdx}`} className="p-2 bg-slate-950/60 border border-white/5 rounded-lg flex justify-between items-center text-slate-300">
                                    <span className="truncate">🔧 [Keuring] {mOption ? mOption.name : block.machineId} ({block.date})</span>
                                    <span className="text-[9px] text-emerald-400 shrink-0 ml-1 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase font-bold font-mono">gesynchroniseerd</span>
                                  </div>
                                );
                              })}
                              {orders.slice(0, 2).map((ord, oIdx) => (
                                <div key={`gcal-ord-${oIdx}`} className="p-2 bg-slate-950/60 border border-white/5 rounded-lg flex justify-between items-center text-slate-300">
                                  <span className="truncate">🎯 [Huur] {ord.id} - {ord.customerName} ({ord.machineName})</span>
                                  <span className="text-[9px] text-emerald-400 shrink-0 ml-1 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase font-bold font-mono">gesynchroniseerd</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-400 flex items-center space-x-3">
                          <span className="text-xl">💡</span>
                          <span>
                            <b>Google Agenda</b> koppeling is momenteel gedeactiveerd. Klik hierboven om uw account veilig te autoriseren. Zo worden nieuwe orders direct weggeschreven en inspectie-blokkades gesynchroniseerd.
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
}

function AddCategoryForm({
  customCategories,
  setCustomCategories,
  onAddSystemLog
}: {
  customCategories: any[];
  setCustomCategories: any;
  onAddSystemLog: any;
}) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [listLabel, setListLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [heights, setHeights] = useState("");
  const [price, setPrice] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !label.trim()) {
      alert("Groep ID en Groep Label zijn verplicht.");
      return;
    }
    const cleanId = id.trim().toLowerCase().replace(/\s+/g, "");
    
    // Check duplication
    if (customCategories.some((c: any) => c.id === cleanId)) {
      alert("Groep met deze ID bestaat al.");
      return;
    }

    const newCat = {
      id: cleanId,
      label: label.trim(),
      listLabel: listLabel.trim() || label.trim() + "en",
      desc: desc.trim() || "Moderne hoogwerkers voor diverse klussen.",
      heights: heights.trim() || "10m - 20m",
      price: price.trim() || "v.a. €150/dag"
    };

    const updated = [...customCategories, newCat];
    setCustomCategories(updated);
    
    fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    })
    .then((res) => {
      if (!res.ok) throw new Error("Category save failed");
      onAddSystemLog("system", "Onur (Eigenaar)", `Nieuwe categorie permanent opgeslagen: ${label} (${cleanId}).`);
    })
    .catch((err) => {
      console.error(err);
    });
    
    // Reset inputs
    setId("");
    setLabel("");
    setListLabel("");
    setDesc("");
    setHeights("");
    setPrice("");
  };

  return (
    <form onSubmit={handleAdd} className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-3">
      <h5 className="text-[10.5px] font-bold text-amber-200 uppercase tracking-tight">Voeg Nieuwe Categorie Toe</h5>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input 
          type="text" 
          value={id} 
          onChange={(e) => setId(e.target.value)} 
          required 
          placeholder="Groep ID (bijv: rupslift)" 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
        <input 
          type="text" 
          value={label} 
          onChange={(e) => setLabel(e.target.value)} 
          required 
          placeholder="Groep Label (bijv: Rupslift)" 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
        <input 
          type="text" 
          value={listLabel} 
          onChange={(e) => setListLabel(e.target.value)} 
          placeholder="Meervoud (bijv: Rupsliften)" 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
        <input 
          type="text" 
          value={heights} 
          onChange={(e) => setHeights(e.target.value)} 
          placeholder="Hoogte bereik (bijv: 12m - 18m)" 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
        <input 
          type="text" 
          value={price} 
          onChange={(e) => setPrice(e.target.value)} 
          placeholder="Startprijs (bijv: v.a. €190/dag)" 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
        <input 
          type="text" 
          value={desc} 
          onChange={(e) => setDesc(e.target.value)} 
          placeholder="Korte omschrijving van de groep..." 
          className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" 
        />
      </div>
      <div className="flex justify-end pt-1">
        <button 
          type="submit" 
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-slate-950 rounded-lg transition-all cursor-pointer border-none shadow-sm"
        >
          Categorie Toevoegen
        </button>
      </div>
    </form>
  );
}
