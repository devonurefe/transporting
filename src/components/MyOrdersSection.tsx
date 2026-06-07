/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  ClipboardCheck, 
  MapPin, 
  Calendar, 
  FileText, 
  Star, 
  Bell, 
  CreditCard, 
  Sliders, 
  PlusCircle, 
  CheckCircle,
  Truck,
  Sparkles,
  RefreshCw,
  Clock,
  User,
  Mail,
  Building2,
  SlidersHorizontal,
  BellRing,
  Download,
  Check,
  Smartphone,
  Eye,
  Info,
  UserPlus,
  LogOut,
  ShieldCheck,
  Lock,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Order, UserProfile } from "../types";
import { useAuthStore } from "../store/authStore";
import { printInvoice } from "../utils/invoice";

interface MyOrdersSectionProps {
  orders: Order[];
  onTriggerNotification: (title: string, message: string, type: "info" | "success" | "warning", persist?: boolean) => void;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  userProfiles?: UserProfile[];
  onUpdateOrderStatus: (orderId: string, nextStatus: any) => void;
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

export default function MyOrdersSection({ 
  orders, 
  onTriggerNotification,
  currentUser,
  setCurrentUser,
  userProfiles,
  onUpdateOrderStatus,
  onAddSystemLog
}: MyOrdersSectionProps) {


  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  
  // Custom login forms state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginCompany, setLoginCompany] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regProfile, setRegProfile] = useState("Schilder");

  const [resendEmailAddress, setResendEmailAddress] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const { login, register, updateProfile, resendVerification, logout } = useAuthStore();



  const [emailSubscription, setEmailSubscription] = useState(true);
  const [smsSubscription, setSmsSubscription] = useState(false);

  // Form profile edits state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileSector, setProfileSector] = useState("Particulier");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");

  // Sync profile details when currentUser changes
  React.useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || "");
      setProfilePhone(currentUser.phone || "");
      setProfileCompany(currentUser.companyName || "");
      setProfileSector(currentUser.profileType || "Particulier");
      setProfileAddress(currentUser.address || "");
      setProfileAvatarUrl(currentUser.avatarUrl || "");
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (!profileName.trim()) {
      onTriggerNotification("Fout", "Naam is verplicht.", "warning");
      return;
    }

    const success = await updateProfile({
      name: profileName.trim(),
      phone: profilePhone.trim(),
      profile: profileSector,
      companyName: profileCompany.trim(),
      address: profileAddress.trim(),
      avatarUrl: profileAvatarUrl.trim()
    });

    if (success) {
      const updatedUser: UserProfile = {
        ...currentUser,
        name: profileName.trim(),
        phone: profilePhone.trim(),
        companyName: profileCompany.trim() || undefined,
        profileType: profileSector,
        address: profileAddress.trim() || undefined,
        avatarUrl: profileAvatarUrl.trim() || undefined
      };
      
      setCurrentUser(updatedUser);
      onTriggerNotification("Profiel Opgeslagen", "Uw profielgegevens zijn succesvol bijgewerkt! Deze zijn nu veilig opgeslagen in onze database.", "success");
      onAddSystemLog?.("system", currentUser.name, `Klant heeft profielgegevens permanent bijgewerkt.`);
    } else {
      const errorMsg = useAuthStore.getState().error || "Fout bij profiel opslaan.";
      onTriggerNotification("Profiel Fout", `Bijwerken mislukt: ${errorMsg}`, "warning");
    }
  };

  const handleRateOrder = async (orderId: string, stars: number) => {
    setRatings(prev => ({ ...prev, [orderId]: stars }));
    const token = localStorage.getItem("hwh_token");
    try {
      await fetch(`/api/orders/${orderId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ rating: stars })
      });
    } catch (e) {
      console.error("Failed to save rating:", e);
    }
    onTriggerNotification(
      "Waardering Opgeslagen",
      `Bedankt! Uw waardering van ${stars} sterren is opgeslagen.`,
      "success",
      false
    );
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Weet u zeker dat u deze bestelling wilt annuleren? Dit kan niet ongedaan worden gemaakt.")) return;
    setCancellingOrderId(orderId);
    const token = localStorage.getItem("hwh_token");
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        onUpdateOrderStatus(orderId, "Geannuleerd");
        onAddSystemLog?.("status", currentUser?.name || "Klant", `Bestelling ${orderId} geannuleerd door klant.`);
        onTriggerNotification("Bestelling Geannuleerd", "Uw bestelling is geannuleerd. U ontvangt een bevestiging per e-mail.", "info");
      } else {
        const data = await res.json().catch(() => ({}));
        onTriggerNotification("Annulering Mislukt", data.error || "Annulering mislukt. Neem contact op via WhatsApp.", "warning");
      }
    } catch (e) {
      onTriggerNotification("Annulering Mislukt", "Netwerkfout. Probeer het opnieuw.", "warning");
    }
    setCancellingOrderId(null);
  };

  const handleDownloadInvoice = (order: Order) => {
    onTriggerNotification(
      "Factuur Genereren",
      `Factuur ${order.id} wordt klaargemaakt voor PDF download...`,
      "success",
      false
    );
    printInvoice(order, currentUser?.companyName);
  };

  const handleResendVerification = async () => {
    if (!resendEmailAddress) return;
    setIsResending(true);
    const success = await resendVerification(resendEmailAddress);
    setIsResending(false);
    
    if (success) {
      onTriggerNotification(
        "Verificatie-e-mail Verzonden",
        `Er is een nieuwe verificatielink verzonden naar ${resendEmailAddress}. Controleer uw inbox.`,
        "success"
      );
      setResendEmailAddress(null);
    } else {
      const errorMsg = useAuthStore.getState().error || "Kan verificatiemail niet verzenden.";
      onTriggerNotification("Verzenden Mislukt", errorMsg, "warning");
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      onTriggerNotification("Inloggen Mislukt", "E-mail en wachtwoord zijn verplicht.", "warning");
      return;
    }

    const success = await login(loginEmail, loginPassword);
    if (success) {
      const user = useAuthStore.getState().user;
      if (user) {
        setResendEmailAddress(null);
        // Admin users are handled by App.tsx — don't set customer context
        if (user.role !== "admin") {
          setCurrentUser({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            profileType: user.profile || "Particulier",
            companyName: loginCompany.trim() || undefined,
            pastRentalsCount: 0
          });
          onAddSystemLog?.("login", user.name, "Klant is succesvol ingelogd met beveiligd account.");
          onTriggerNotification(
            "Klant Ingelogd",
            `Welkom terug ${user.name}! Uw lopende huren zijn ingeladen.`,
            "success"
          );
        }
      }
    } else {
      const isUnverified = useAuthStore.getState().isUnverified;
      const errorMsg = useAuthStore.getState().error || "Ongeldige inloggegevens.";
      if (isUnverified) {
        setResendEmailAddress(loginEmail.trim());
      } else {
        setResendEmailAddress(null);
      }
      onTriggerNotification("Inloggen Mislukt", errorMsg, "warning");
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      onTriggerNotification("Registratie Mislukt", "Naam, e-mail en wachtwoord zijn verplicht.", "warning");
      return;
    }

    const success = await register({
      email: regEmail.trim(),
      password: regPassword.trim(),
      name: regName.trim(),
      phone: regPhone.trim() || undefined,
      profile: regProfile
    });

    if (success) {
      onAddSystemLog?.("signup", regName.trim(), `Nieuw klantaccount aangemaakt.`);
      onTriggerNotification(
        "Registratie Voltooid",
        `Account aangemaakt! U kunt nu direct inloggen met uw e-mailadres.`,
        "success"
      );
      const justRegisteredEmail = regEmail.trim();
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPhone("");
      setRegCompany("");
      setIsRegistering(false);
      // Pre-fill login email for convenience
      setLoginEmail(justRegisteredEmail);
    } else {
      const errorMsg = useAuthStore.getState().error || "Registratie mislukt.";
      onTriggerNotification("Registratie Mislukt", errorMsg, "warning");
    }
  };



  // If NOT LOGGED IN: Render a beautiful Customer Login Experience (Visitor UI only)
  if (!currentUser) {
    return (
      <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-5 sm:px-6 lg:px-8 animate-fade-in">
        <div className="absolute top-1/4 right-5 h-80 w-80 rounded-full bg-indigo-500/5 blur-[120px] -z-10" />
        <div className="absolute bottom-12 left-8 h-96 w-96 rounded-full bg-blue-500/3 blur-[140px] -z-10" />

        <div className="mx-auto max-w-4xl space-y-10">
          
          {/* Header block */}
          <div className="text-center space-y-3">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Welkom op het <span className="text-indigo-600">Klant Portaal</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-550 text-slate-600 max-w-xl mx-auto leading-relaxed">
              Log in om uw actieve huurcontracten te beheren, transportstatussen te volgen, live BMWT-certificaten te downloaden en facturen in te zien.
            </p>
          </div>

          <div className="flex justify-center items-start">
            
            {/* Login form */}
            <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex border-b border-slate-200 pb-1">
                <button
                  onClick={() => setIsRegistering(false)}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    !isRegistering ? "text-indigo-600 border-indigo-600" : "text-slate-400 hover:text-slate-605 border-transparent"
                  }`}
                >
                  Regulier Inloggen
                </button>
                <button
                  onClick={() => setIsRegistering(true)}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    isRegistering ? "text-indigo-600 border-indigo-600" : "text-slate-400 hover:text-slate-605 border-transparent"
                  }`}
                >
                  Account Aanmaken
                </button>
              </div>

              {!isRegistering ? (
                // Sign In Form
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Geregistreerd E-mailadres</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Mail className="h-4 w-4 text-slate-450 shrink-0 mr-2.5" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="bijv. jan@devriesschilderwerken.nl"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-450 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Beveiligd Wachtwoord</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Lock className="h-4 w-4 text-slate-450 shrink-0 mr-2.5" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-450 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Bedrijfsnaam <span className="text-slate-400 font-normal">(Optioneel)</span></label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Building2 className="h-4 w-4 text-slate-450 shrink-0 mr-2.5" />
                      <input
                        type="text"
                        value={loginCompany}
                        onChange={(e) => setLoginCompany(e.target.value)}
                        placeholder="De Vries Schilderwerken"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-450"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:scale-[1.01] active:opacity-95 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-450" />
                    <span>Beveiligd Inloggen</span>
                  </button>

                  {resendEmailAddress && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 border border-amber-200/85 rounded-2xl p-4.5 mt-3 space-y-2.5 text-left border-dashed"
                    >
                      <p className="text-[11px] text-amber-900 leading-normal font-semibold">
                        Uw e-mailadres is nog niet geverifieerd. Heeft u geen e-mail ontvangen? Klik hieronder om de verificatielink opnieuw te verzenden naar <strong>{resendEmailAddress}</strong>.
                      </p>
                      <button
                        type="button"
                        disabled={isResending}
                        onClick={handleResendVerification}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer border-none flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        {isResending ? (
                          <span>Verzenden...</span>
                        ) : (
                          <span>Verificatie-e-mail opnieuw verzenden</span>
                        )}
                      </button>
                    </motion.div>
                  )}
                </form>
              ) : (
                // Register Form
                <form onSubmit={handleManualRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Volledige Naam</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Jan de Vries"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 h-10 placeholder-slate-400 font-medium shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">E-mailadres</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="jan@schilder.nl"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Beveiligd Wachtwoord</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-indigo-500 transition-colors shadow-sm">
                      <Lock className="h-4 w-4 text-slate-450 shrink-0 mr-2.5" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimaal 6 tekens"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-450 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Telefoonnummer</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+31 6 12345678"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Bedrijfsnaam</label>
                    <input
                      type="text"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      placeholder="Zelfstandige of B.V."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-600 block font-semibold">Vakgebied / Profiel</label>
                      <select
                        value={regProfile}
                        onChange={(e) => setRegProfile(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 h-10 cursor-pointer shadow-sm font-bold"
                      >
                        <option value="Schilder">Schilder</option>
                        <option value="Hovenier / Groenverzorging">Hovenier / Groenverzorging</option>
                        <option value="Glazenwasser / Gevelreiniger">Glazenwasser / Gevelreiniger</option>
                        <option value="Aannemer">Aannemer / Renovatie</option>
                        <option value="Installateur / Elektricien">Installateur / Elektricien</option>
                        <option value="Dakdekker / Gevelwerker">Dakdekker / Gevelwerker</option>
                        <option value="Industrieel Onderhoud">Industrieel Onderhoud</option>
                        <option value="Particulier">Particulier</option>
                        <option value="Overig / Anders">Overig / Anders</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-1 border-none"
                      >
                        <UserPlus className="h-4 w-4 text-emerald-300" />
                        <span>Versturen</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

          </div>

        </div>

      </div>
    );
  }

  // Under visitor mode: Filter orders based on currently logged in user email and status filter
  const userFilteredOrders = orders.filter(o => o.customerEmail.toLowerCase() === currentUser.email.toLowerCase());

  const filteredOrders = userFilteredOrders.filter(o => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return o.status === "Goedgekeurd" || o.status === "Onderweg";
    if (activeFilter === "pending") return o.status === "In behandeling";
    if (activeFilter === "completed") return o.status === "Voltooid";
    return true;
  });

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-10 px-5 sm:px-6 lg:px-8">
      {/* Absolute background effects */}
      <div className="absolute top-1/4 right-5 h-80 w-80 rounded-full bg-indigo-500/5 blur-[120px] -z-10" />
      <div className="absolute bottom-12 left-8 h-96 w-96 rounded-full bg-blue-500/3 blur-[140px] -z-10" />

      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Core Customer profile header and logout control (Isolates single user perfectly) */}
        <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="h-16 w-16 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-inner"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-650 text-white font-black text-xl flex items-center justify-center border-2 border-indigo-500/40 shadow-md uppercase select-none font-display">
                  {currentUser.name.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center text-[8px] font-bold text-white">✓</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-display text-xl font-black text-slate-900">{currentUser.name}</h2>
                <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  Actieve Klant (Sessie)
                </span>
              </div>
              <p className="text-xs text-slate-550 font-semibold mt-1 flex items-center space-x-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{currentUser.companyName || "Particulier"}</span>
                <span className="text-slate-300">•</span>
                <span className="text-teal-700 font-extrabold">{currentUser.profileType}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2.5 text-xs bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 font-mono">
              <span className="text-slate-500 font-bold">Past Rentals:</span>
              <span className="text-slate-800 font-extrabold">{currentUser.pastRentalsCount} afgerond</span>
            </div>

            {/* Logout Customer Profile */}
            <button
              onClick={() => {
                logout();
                setCurrentUser(null);
                onTriggerNotification("Uitgelogd", "U heeft uw klant-sessie beëindigd.", "info");
              }}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl cursor-pointer transition-colors font-bold shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              <span>Sessie Sluiten</span>
            </button>
          </div>
        </section>

        {/* CORE PORTAL DECK & NOTIFICATIONS PREFERENCES */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Main List Column */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Filter & Headline block */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-2">
              <div>
                <h3 className="font-display font-black text-base text-slate-800">Actieve Huurobjecten & Overeenkomsten</h3>
                <p className="text-xs text-slate-550 text-slate-500 mt-0.5">Mijn huidige reserveringen gesorteerd op datum.</p>
              </div>

              {/* Inline layout category switcher */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                {[
                  { id: "all", label: "Alles" },
                  { id: "active", label: "Actief" },
                  { id: "pending", label: "Aanvragen" },
                  { id: "completed", label: "Historie" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all border-none cursor-pointer leading-none ${
                      activeFilter === f.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-850"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Deck */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-white border border-slate-200 shadow-sm p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 animate-fade-in">
                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-wider font-sans">Geen reserveringen gevonden</h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm font-semibold">
                      Dit account ({currentUser.email}) heeft momenteel geen actieve contracten binnen het gekozen filter. Boek een machine via de catalogus om uw eerste bestelling te plaatsen.
                    </p>
                  </div>
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const stars = ratings[o.id] || 0;
                  return (
                    <div
                      key={o.id}
                      className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl space-y-4 transition-all duration-300 hover:border-indigo-300 hover:shadow-md relative overflow-hidden"
                    >
                      {o.status === "Onderweg" && (
                        <div className="absolute top-0 right-0 h-1 border-b border-t-0 border-indigo-505 border-indigo-500 w-full animate-pulse bg-indigo-100" />
                      )}

                      <div className="flex flex-col sm:flex-row justify-between gap-3.5 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                              {o.id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">Overeenkomst van {new Date(o.createdAt).toLocaleDateString("nl-NL")}</span>
                          </div>
                          <h4 className="font-display font-black text-sm sm:text-base text-slate-900 mt-1.5 text-sans">
                            {o.machineName}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`inline-block text-[9px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                            o.status === "In behandeling" 
                              ? "bg-amber-50 text-amber-850 text-amber-700 border-amber-200" 
                              : o.status === "Goedgekeurd"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : o.status === "Onderweg"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-105 bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {o.status}
                          </span>
                        </div>
                      </div>

                      {/* Info details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[9.5px] text-slate-450 text-slate-500 font-mono font-bold block uppercase tracking-wider">Huurperiode</span>
                          <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span>{o.startDate} t/m {o.endDate}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Totaal: {o.rentalDays} {o.rentalDays === 1 ? 'dag' : 'dagen'}</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9.5px] text-slate-450 text-slate-500 font-mono font-bold block uppercase tracking-wider">Hub Logistiek</span>
                          <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
                            <Truck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{o.deliveryType === "self_pickup" ? "Zelf ophalen bij Hub" : "Hub-Bezorging met Chauffeur"}</span>
                          </div>
                          {o.deliveryAddress && (
                            <span className="text-[10px] text-slate-500 mt-1 block truncate max-w-[180px] font-semibold" title={o.deliveryAddress}>
                              Adres: {o.deliveryAddress}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 sm:text-right">
                          <span className="text-[9.5px] text-slate-500 font-mono font-bold block uppercase tracking-wider">Kostenoverzicht</span>
                          <div className="text-sm font-mono font-black text-teal-700">
                            € {o.totalAmount.toFixed(2)}
                          </div>
                          <span className="text-[9px] text-slate-400 font-semibold block">Inclusief 21% BTW & logistiek</span>
                          {o.borgsom && o.borgsom > 0 && (
                            <div className="mt-1.5 text-right">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold inline-block ${
                                o.borgsomStatus === "returned" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : o.borgsomStatus === "withheld" ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {o.borgsomStatus === "returned" ? "✅ Borg teruggestort"
                                : o.borgsomStatus === "withheld" ? "🔴 Borg ingehouden"
                                : `🟡 Borg € ${o.borgsom.toFixed(2)} in behandeling`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stepper tracking */}
                      <div className="bg-slate-50 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4.5 border border-slate-100">
                        
                        <div className="flex items-center space-x-2 flex-grow max-w-md w-full">
                          {[
                            { label: "Raming", active: true },
                            { label: "Ingepland", active: o.status !== "In behandeling" },
                            { label: "Onderweg", active: o.status === "Onderweg" || o.status === "Voltooid" },
                            { label: "Gereed", active: o.status === "Voltooid" }
                          ].map((step, idx) => {
                            return (
                              <React.Fragment key={idx}>
                                {idx > 0 && (
                                  <div className={`flex-grow h-0.5 ${step.active ? "bg-emerald-500" : "bg-slate-200"}`} />
                                )}
                                <div className="flex items-center space-x-1 shrink-0">
                                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[9px] font-bold ${
                                    step.active ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-400"
                                  }`}>
                                    {step.active ? "✓" : idx + 1}
                                  </div>
                                  <span className={`hidden sm:inline text-[8.5px] font-black uppercase ${step.active ? "text-emerald-700 font-extrabold" : "text-slate-400"}`}>
                                    {step.label}
                                  </span>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <button
                            onClick={() => handleDownloadInvoice(o)}
                            className="flex items-center space-x-1 font-black text-[10px] bg-white hover:bg-slate-50 transition-colors text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
                          >
                            <Download className="h-3 w-3 text-indigo-600" />
                            <span>Factuur PDF</span>
                          </button>

                          {o.status === "In behandeling" && (
                            <button
                              disabled={cancellingOrderId === o.id}
                              onClick={() => handleCancelOrder(o.id)}
                              className="flex items-center space-x-1 font-black text-[10px] bg-white hover:bg-rose-50 transition-colors text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              {cancellingOrderId === o.id ? (
                                <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <span>Annuleren</span>
                              )}
                            </button>
                          )}

                          {o.status === "Voltooid" && (
                            <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => handleRateOrder(o.id, star)}
                                  className="p-1 hover:scale-110 active:scale-90 transition-transform text-slate-300"
                                >
                                  <Star className={`h-3 w-3 ${
                                    star <= stars ? "text-amber-500 fill-amber-500" : "text-slate-300"
                                  }`} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Right Notifications Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6 animate-fade-in">
            
            {/* Customer Profile Customizer Settings */}
            <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-3xl space-y-4">
              <h4 className="font-display font-black text-xs text-slate-850 uppercase tracking-wider flex items-center space-x-2">
                <User className="h-4 w-4 text-indigo-650 text-indigo-600" />
                <span>Profiel & Standaardgegevens</span>
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Beheer uw gegevens. Deze worden bij nieuwe bestellingen automatisch voor u klaargezet.
              </p>
              
              <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Volledige Naam</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="bijv. Jan de Vries"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Telefoonnummer</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="bijv. +31 6 12345678"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Bedrijfsnaam (Optioneel)</label>
                  <input
                    type="text"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="bijv. De Vries Schilderwerken B.V."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Sectorklasse / Profiel</label>
                  <select
                    value={profileSector}
                    onChange={(e) => setProfileSector(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Schilder">🎨 Schilder</option>
                    <option value="Hovenier / Groenverzorging">🌳 Hovenier / Groenverzorging</option>
                    <option value="Glazenwasser / Gevelreiniger">🧼 Glazenwasser / Gevelreiniger</option>
                    <option value="Aannemer">🏗️ Aannemer</option>
                    <option value="Installateur / Elektricien">⚡ Installateur / Elektricien</option>
                    <option value="Dakdekker / Gevelwerker">🏠 Dakdekker & Gevelwerker</option>
                    <option value="Industrieel Onderhoud">⚙️ Industrieel Onderhoud</option>
                    <option value="Particulier">👤 Particulier</option>
                    <option value="Overig / Anders">❓ Overig / Anders</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Standaard Bezorgadres</label>
                  <textarea
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                    placeholder="bijv. Keizersgracht 420, Amsterdam"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Profielafbeelding URL (Optioneel)</label>
                  <input
                    type="text"
                    value={profileAvatarUrl}
                    onChange={(e) => setProfileAvatarUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-805 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Laat leeg voor initialen badge"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer border-none shadow-sm transition-colors text-center"
                >
                  Profiel Opslaan
                </button>
              </form>
            </div>

            {/* Live Updates Preferences */}
            <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-3xl space-y-4">
              <h4 className="font-display font-black text-xs text-slate-850 uppercase tracking-wider flex items-center space-x-2">
                <BellRing className="h-4 w-4 text-emerald-600" />
                <span>Mijn Notificaties</span>
              </h4>
              <p className="text-[11px] text-slate-650 font-semibold leading-relaxed">
                Kies uw voorkeurskanalen voor reserveringsbevestigingen, BMWT certificaten, en status updates van de chauffeur.
              </p>
              
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                
                {/* Email toggle */}
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-xs font-black block text-slate-700 group-hover:text-indigo-600 transition-colors animate-fade-in">E-mail Notificaties</span>
                    <span className="text-[9.5px] text-slate-505 text-slate-500">Live contracten, orders & facturen in inbox</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailSubscription}
                    onChange={(e) => {
                      setEmailSubscription(e.target.checked);
                      onTriggerNotification("Voorkeuren Gewijzigd", `E-mailmeldingen zijn ${e.target.checked ? 'geactiveerd' : 'gedeactiveerd'}.`, "info");
                    }}
                    className="h-4 w-4 accent-indigo-600 rounded border-slate-300 text-indigo-600 bg-white"
                  />
                </label>

                {/* SMS toggle */}
                <label className="flex items-center justify-between cursor-pointer group pt-1">
                  <div>
                    <span className="text-xs font-black block text-slate-705 text-slate-700 group-hover:text-indigo-600 transition-colors">SMS Bezorgupdates</span>
                    <span className="text-[9.5px] text-slate-500">Sms wanneer de chauffeur onze Hub verlaat</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsSubscription}
                    onChange={(e) => {
                      setSmsSubscription(e.target.checked);
                      onTriggerNotification("SMS Activatie", `SMS notificaties zijn ${e.target.checked ? 'ingeschakeld' : 'uitgeschakeld'}.`, "info");
                    }}
                    className="h-4 w-4 accent-indigo-600 rounded border-slate-300 text-indigo-600 bg-white"
                  />
                </label>

              </div>
            </div>

          </div>

        </section>



        {/* WhatsApp Help Banner */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4.5 transition-all text-left gap-4 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-slate-800 text-xs sm:text-sm">Vragen over uw bestelling of transportstatus?</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                Heeft u specifieke logistieke vragen over de levering, wilt u een wijziging doorgeven of staat de chauffeur niet op tijd op locatie? Stuur ons direct een WhatsApp-bericht voor directe opheldering van onze planningsdesk.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/31645617283"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-98 shadow-sm cursor-pointer whitespace-nowrap border-none"
          >
            <span>Stuur een Bericht</span>
            <span>💬</span>
          </a>
        </div>

      </div>
    </div>
  );
}
