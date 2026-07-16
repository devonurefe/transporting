/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Calendar,
  Star,
  Bell,
  CheckCircle,
  Truck,
  Clock,
  User,
  Mail,
  Building2,
  BellRing,
  Download,
  Check,
  Info,
  UserPlus,
  LogOut,
  Lock,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Order, OrderStatus, UserProfile } from "../types";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { printInvoice } from "../utils/invoice";
import { buildWhatsAppOrderStatusUrl, buildWhatsAppPaymentLinkUrl, buildWhatsAppLogisticsUrl } from "../utils/whatsapp";

interface MyOrdersSectionProps {
  orders: Order[];
  onTriggerNotification: (title: string, message: string, type: "info" | "success" | "warning", persist?: boolean) => void;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  userProfiles?: UserProfile[];
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function MyOrdersSection({
  orders,
  onTriggerNotification,
  currentUser,
  setCurrentUser,
  userProfiles,
  onUpdateOrderStatus,
  onAddSystemLog,
  setActiveTab,
}: MyOrdersSectionProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null);
  
  // Custom login forms state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regProfile, setRegProfile] = useState("Schilder");
  const [regPrivacyAccepted, setRegPrivacyAccepted] = useState(false);
  const [regMarketingConsent, setRegMarketingConsent] = useState(false);

  const [resendEmailAddress, setResendEmailAddress] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Inline form errors
  const [loginError, setLoginError] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Check URL for password reset token
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");
    if (token) {
      setResetToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { login, register, updateProfile, updateEmailOptIn, resendVerification, logout } = useAuthStore();
  const isAuthLoading = useAuthStore((state) => state.isLoading);

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
      const res = await fetch(`/api/orders/${orderId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ rating: stars })
      });
      if (!res.ok) throw new Error("Rating save failed");
      onTriggerNotification(
        "Waardering Opgeslagen",
        `Bedankt! Uw waardering van ${stars} sterren is opgeslagen.`,
        "success",
        false
      );
    } catch (e) {
      console.error("Failed to save rating:", e);
      setRatings(prev => { const next = { ...prev }; delete next[orderId]; return next; });
      onTriggerNotification("Fout", "Waardering kon niet worden opgeslagen. Probeer het opnieuw.", "warning", false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelModalOrderId(null);
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
    printInvoice(order, currentUser?.companyName, true, siteConfig);
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
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("E-mail en wachtwoord zijn verplicht.");
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
            companyName: user.companyName || undefined,
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
      setLoginError(errorMsg);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setIsSendingReset(true);
    setForgotError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSent(true);
      } else {
        setForgotError(data.error || "Er is een fout opgetreden.");
      }
    } catch {
      setForgotError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || !resetToken) return;
    setIsResettingPassword(true);
    setResetError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: newPassword.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(true);
        setResetToken(null);
      } else {
        setResetError(data.error || "Er is een fout opgetreden.");
      }
    } catch {
      setResetError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegError("Naam, e-mail en wachtwoord zijn verplicht.");
      return;
    }
    if (!regPrivacyAccepted) {
      setRegError("U dient akkoord te gaan met de privacyverklaring om door te gaan.");
      return;
    }
    if (regPassword.trim().length < 8) {
      onTriggerNotification("Registratie Mislukt", "Wachtwoord moet minimaal 8 tekens bevatten.", "warning");
      return;
    }
    if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      onTriggerNotification("Registratie Mislukt", "Wachtwoord moet minimaal één letter en één cijfer bevatten.", "warning");
      return;
    }

    const success = await register({
      email: regEmail.trim(),
      password: regPassword.trim(),
      name: regName.trim(),
      phone: regPhone.trim() || undefined,
      profile: regProfile,
      companyName: regCompany.trim() || undefined,
      marketingConsent: regMarketingConsent
    });

    if (success) {
      onAddSystemLog?.("signup", regName.trim(), `Nieuw klantaccount aangemaakt.`);
      const needsVerification = useAuthStore.getState().isUnverified;
      onTriggerNotification(
        `Welkom, ${regName.trim().split(" ")[0]}!`,
        needsVerification
          ? `Uw account is aangemaakt. Controleer uw e-mail om uw account te activeren.`
          : `Uw account is aangemaakt. U kunt nu direct werktuigen reserveren.`,
        "success"
      );
      const justRegisteredEmail = regEmail.trim();
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPhone("");
      setRegCompany("");
      setRegPrivacyAccepted(false);
      setRegMarketingConsent(false);
      setIsRegistering(false);
      // Pre-fill login email for convenience
      setLoginEmail(justRegisteredEmail);
    } else {
      const errorMsg = useAuthStore.getState().error || "Registratie mislukt. Probeer het opnieuw.";
      setRegError(errorMsg);
    }
  };



  // If NOT LOGGED IN: Render a beautiful Customer Login Experience (Visitor UI only)
  if (!currentUser) {
    return (
      <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-5 sm:px-6 lg:px-8 animate-fade-in">
        <div className="absolute top-1/4 right-5 h-80 w-80 rounded-full bg-slate-500/5 blur-[120px] -z-10" />
        <div className="absolute bottom-12 left-8 h-96 w-96 rounded-full bg-blue-500/3 blur-[140px] -z-10" />

        <div className="mx-auto max-w-4xl space-y-10">
          
          {/* Header block */}
          <div className="text-center space-y-3">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Welkom op het <span className="text-slate-900">Klant Portaal</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 text-slate-600 max-w-xl mx-auto leading-relaxed">
              Log in om uw actieve huurcontracten te beheren, transportstatussen te volgen, live BMWT-certificaten te downloaden en facturen in te zien.
            </p>
          </div>

          <div className="flex justify-center items-start">

            {/* Password reset form (when reset_token is in URL) */}
            {resetToken && !resetSuccess && (
              <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-6 sm:p-8 rounded-2xl space-y-5">
                <h2 className="font-display text-base font-extrabold text-slate-900">Nieuw Wachtwoord Instellen</h2>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Nieuw Wachtwoord</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-slate-400 shadow-sm">
                      <Lock className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimaal 8 tekens"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
                      />
                    </div>
                  </div>
                  {resetError && <p className="text-xs text-rose-600 font-semibold">{resetError}</p>}
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
                  >
                    {isResettingPassword ? "Opslaan..." : "Wachtwoord Opslaan"}
                  </button>
                </form>
              </div>
            )}

            {resetSuccess && (
              <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-8 rounded-2xl text-center space-y-4">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
                <h2 className="font-display text-base font-extrabold text-slate-900">Wachtwoord Gewijzigd!</h2>
                <p className="text-xs text-slate-500">U kunt nu inloggen met uw nieuwe wachtwoord.</p>
                <button onClick={() => setResetSuccess(false)} className="text-xs text-slate-600 underline underline-offset-2 bg-transparent border-none cursor-pointer">
                  Naar inloggen
                </button>
              </div>
            )}

            {/* Login form */}
            {!resetToken && !resetSuccess && (
            <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-6 sm:p-8 rounded-2xl space-y-6">
              <div className="flex border-b border-slate-200 pb-1">
                <button
                  onClick={() => { setIsRegistering(false); setLoginError(null); setRegError(null); }}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    !isRegistering ? "text-slate-900 border-slate-800" : "text-slate-500 hover:text-slate-700 border-transparent"
                  }`}
                >
                  Regulier Inloggen
                </button>
                <button
                  onClick={() => { setIsRegistering(true); setLoginError(null); setRegError(null); }}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    isRegistering ? "text-slate-900 border-slate-800" : "text-slate-500 hover:text-slate-700 border-transparent"
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
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-slate-400 transition-colors shadow-sm">
                      <Mail className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="bijv. jan@devriesschilderwerken.nl"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Beveiligd Wachtwoord</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-slate-400 transition-colors shadow-sm">
                      <Lock className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
                      />
                    </div>
                  </div>


                  {loginError && (
                    <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{loginError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all shadow-md hover:scale-[1.01] active:opacity-95 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
                  >
                    {isAuthLoading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Bezig met inloggen...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Beveiligd Inloggen</span>
                      </>
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setForgotSent(false); setForgotError(null); setForgotEmail(loginEmail); }}
                      className="text-[11px] text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>

                  {isForgotPassword && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3"
                    >
                      {!forgotSent ? (
                        <>
                          <p className="text-[11px] text-slate-700 font-semibold">Voer uw e-mailadres in om een resetlink te ontvangen.</p>
                          <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-slate-400 shadow-sm">
                            <Mail className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                            <input
                              type="email"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              placeholder="uw@emailadres.nl"
                              className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
                            />
                          </div>
                          {forgotError && <p className="text-[11px] text-rose-600 font-semibold">{forgotError}</p>}
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={handleForgotPassword}
                              disabled={isSendingReset || !forgotEmail.trim()}
                              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
                            >
                              {isSendingReset ? "Verzenden..." : "Resetlink Sturen"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsForgotPassword(false)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
                            >
                              Annuleren
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-2">
                          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                          <p className="text-xs text-slate-700 font-semibold">Controleer uw inbox!</p>
                          <p className="text-[11px] text-slate-500">Als het e-mailadres bekend is, ontvangt u een resetlink.</p>
                          <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setForgotSent(false); }}
                            className="text-[11px] text-slate-600 underline underline-offset-2 bg-transparent border-none cursor-pointer"
                          >
                            Terug naar inloggen
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {resendEmailAddress && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 border border-amber-200/85 rounded-2xl p-4 mt-3 space-y-2.5 text-left border-dashed"
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
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 h-10 placeholder-slate-400 font-medium shadow-sm transition-colors"
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
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Beveiligd Wachtwoord</label>
                    <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-slate-400 transition-colors shadow-sm">
                      <Lock className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 8 tekens, 1 letter, 1 cijfer"
                        className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
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
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Bedrijfsnaam</label>
                    <input
                      type="text"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      placeholder="Zelfstandige of B.V."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 h-10 placeholder-slate-400 shadow-sm transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block font-semibold">Vakgebied / Profiel</label>
                    <select
                      value={regProfile}
                      onChange={(e) => setRegProfile(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 h-10 cursor-pointer shadow-sm font-bold"
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

                  {/* GDPR consent checkboxes */}
                  <div className="space-y-3 pt-1">
                    <label className={`flex items-start gap-2.5 cursor-pointer group rounded-xl p-2.5 transition-colors ${regPrivacyAccepted ? "bg-emerald-50/70 border border-emerald-200/70" : "bg-slate-50 border border-slate-200 hover:border-slate-300"}`}>
                      <input
                        type="checkbox"
                        checked={regPrivacyAccepted}
                        onChange={(e) => setRegPrivacyAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-orange-500 shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-700 leading-relaxed">
                        <span className="font-bold">Verplicht</span> — Ik ga akkoord met de{" "}
                        <a href="/privacy" target="_blank" rel="noopener" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">privacyverklaring</a>
                        {" "}en{" "}
                        <a href="/voorwaarden" target="_blank" rel="noopener" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">algemene voorwaarden</a>
                        {" "}van MB Hoogwerkers B.V.
                      </span>
                    </label>

                    <label className={`flex items-start gap-2.5 cursor-pointer group rounded-xl p-2.5 transition-colors ${regMarketingConsent ? "bg-blue-50/60 border border-blue-200/60" : "bg-slate-50 border border-slate-100 hover:border-slate-200"}`}>
                      <input
                        type="checkbox"
                        checked={regMarketingConsent}
                        onChange={(e) => setRegMarketingConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-orange-500 shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-600 leading-relaxed">
                        <span className="font-semibold">Optioneel</span> — Ja, ik ontvang graag aanbiedingen, kortingsacties en nieuws van MB Hoogwerkers via e-mail. Ik kan mij altijd afmelden.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!regPrivacyAccepted}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-1.5 border-none"
                  >
                    <UserPlus className="h-4 w-4 text-emerald-300" />
                    <span>Account aanmaken</span>
                  </button>

                  {regError && (
                    <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{regError}</p>
                  )}
                </form>
              )}
            </div>
            )}

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
      <div className="absolute top-1/4 right-5 h-80 w-80 rounded-full bg-slate-500/5 blur-[120px] -z-10" />
      <div className="absolute bottom-12 left-8 h-96 w-96 rounded-full bg-blue-500/3 blur-[140px] -z-10" />

      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Core Customer profile header and logout control (Isolates single user perfectly) */}
        <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 right-0 h-32 w-32 bg-slate-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="h-16 w-16 rounded-2xl object-cover border-2 border-slate-300 shadow-inner"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-slate-600 to-slate-700 text-white font-black text-xl flex items-center justify-center border-2 border-slate-300 shadow-md uppercase select-none font-display">
                  {currentUser.name.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center text-[8px] font-bold text-white">✓</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-black text-slate-900 break-words">{currentUser.name}</h2>
                <span className="text-[9px] font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                  Actieve Klant (Sessie)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center space-x-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{currentUser.companyName || "Particulier"}</span>
                <span className="text-slate-300">•</span>
                <span className="text-teal-700 font-extrabold">{currentUser.profileType}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2.5 text-xs bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 font-mono">
              <span className="text-slate-500 font-bold">Eerdere huren:</span>
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
                <p className="text-xs text-slate-500 text-slate-500 mt-0.5">Mijn huidige reserveringen gesorteerd op datum.</p>
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
                      activeFilter === f.id ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-800"
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
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-wider">Geen reserveringen gevonden</h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm font-semibold">
                      {activeFilter === "all"
                        ? "U heeft nog geen bestellingen geplaatst. Bekijk ons aanbod en plan uw eerste huur."
                        : `Geen bestellingen in dit filter. Kies 'Alle' om alles te zien.`}
                    </p>
                  </div>
                  {activeFilter === "all" && setActiveTab && (
                    <button
                      onClick={() => setActiveTab("catalog")}
                      className="mt-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
                    >
                      Bekijk ons aanbod →
                    </button>
                  )}
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const stars = ratings[o.id] || 0;
                  return (
                    <div
                      key={o.id}
                      className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl space-y-4 transition-all duration-300 hover:border-slate-300 hover:shadow-md relative overflow-hidden"
                    >
                      {o.status === "Onderweg" && (
                        <div className="absolute top-0 right-0 h-1 border-b border-t-0 border-orange-400 w-full animate-pulse bg-orange-100" />
                      )}

                      <div className="flex flex-col sm:flex-row justify-between gap-3.5 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] font-extrabold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                              {o.id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">Besteld op {new Date(o.createdAt).toLocaleDateString("nl-NL")}</span>
                          </div>
                          <h4 className="font-display font-black text-sm sm:text-base text-slate-900 mt-1.5 text-sans">
                            {o.machineName}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`inline-block text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                            o.status === "In behandeling" 
                              ? "bg-amber-50 text-amber-700 border-amber-200" 
                              : o.status === "Goedgekeurd"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : o.status === "Onderweg"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {o.status}
                          </span>
                        </div>
                      </div>

                      {/* Info details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase tracking-wider">Huurperiode</span>
                          <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
                            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span>{o.startDate} t/m {o.endDate}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Totaal: {o.rentalDays} {o.rentalDays === 1 ? 'dag' : 'dagen'}</span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase tracking-wider">Hub Logistiek</span>
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
                          <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase tracking-wider">Kostenoverzicht</span>
                          <div className="text-sm font-mono font-black text-teal-700">
                            €{o.totalAmount.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Inclusief 21% BTW & logistiek</span>
                        </div>
                      </div>

                      {/* Stepper tracking */}
                      <div className="bg-slate-50 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-100">
                        
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
                                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                                    step.active ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-400"
                                  }`}>
                                    {step.active ? "✓" : idx + 1}
                                  </div>
                                  <span className={`hidden sm:inline text-[10px] font-black uppercase ${step.active ? "text-emerald-700 font-extrabold" : "text-slate-400"}`}>
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
                            className="flex items-center space-x-1 font-black text-[10px] bg-white hover:bg-slate-50 transition-colors text-slate-700 px-3 py-2 rounded-lg border border-slate-200 shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-600" />
                            <span>Factuur PDF</span>
                          </button>

                          {/* WhatsApp quick action — context-aware per status */}
                          {o.status === "In behandeling" && (
                            <a
                              href={buildWhatsAppPaymentLinkUrl(o.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 font-black text-[10px] bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1a9b4b] px-3 py-2 rounded-lg border border-[#25D366]/30 shadow-sm no-underline transition-colors whitespace-nowrap"
                              title="Vraag uw betaallink op via WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Betaallink</span>
                            </a>
                          )}
                          {(o.status === "Goedgekeurd" || o.status === "Onderweg") && (
                            <a
                              href={buildWhatsAppOrderStatusUrl(o.id, o.machineName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 font-black text-[10px] bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1a9b4b] px-3 py-2 rounded-lg border border-[#25D366]/30 shadow-sm no-underline transition-colors whitespace-nowrap"
                              title="Vraag de status op via WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Status</span>
                            </a>
                          )}

                          {o.status === "In behandeling" && (
                            <button
                              disabled={cancellingOrderId === o.id}
                              onClick={() => setCancelModalOrderId(o.id)}
                              className="flex items-center space-x-1 font-black text-[10px] bg-white hover:bg-rose-50 transition-colors text-rose-600 hover:text-rose-700 px-3 py-2 rounded-lg border border-rose-200 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
                                  className="p-1.5 hover:scale-110 active:scale-90 transition-transform text-slate-300"
                                >
                                  <Star className={`h-4 w-4 ${
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
            <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl space-y-4">
              <h4 className="font-display font-black text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <User className="h-4 w-4 text-slate-600" />
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
                    placeholder="bijv. Jan de Vries"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Telefoonnummer</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
                    placeholder="bijv. +31 6 12345678"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Bedrijfsnaam (Optioneel)</label>
                  <input
                    type="text"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
                    placeholder="bijv. De Vries Schilderwerken B.V."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Sectorklasse / Profiel</label>
                  <select
                    value={profileSector}
                    onChange={(e) => setProfileSector(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 resize-none font-sans"
                    placeholder="bijv. Keizersgracht 420, Amsterdam"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Profielafbeelding URL (Optioneel)</label>
                  <input
                    type="text"
                    value={profileAvatarUrl}
                    onChange={(e) => setProfileAvatarUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
                    placeholder="Laat leeg voor initialen badge"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold cursor-pointer border-none shadow-sm transition-colors text-center"
                >
                  Profiel Opslaan
                </button>
              </form>
            </div>

            {/* Live Updates Preferences */}
            <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl space-y-4">
              <h4 className="font-display font-black text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <BellRing className="h-4 w-4 text-emerald-600" />
                <span>Mijn Notificaties</span>
              </h4>
              <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                Kies of u e-mails ontvangt bij statuswijzigingen van uw boeking en een herinnering vlak voor levering. Uw orderbevestiging ontvangt u altijd.
              </p>

              <div className="space-y-3.5 pt-2 border-t border-slate-100">

                {/* Email toggle */}
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-xs font-black block text-slate-700 group-hover:text-slate-900 transition-colors animate-fade-in">E-mail Notificaties</span>
                    <span className="text-[9.5px] text-slate-500">Statusupdates & leveringsherinneringen in inbox</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentUser?.emailOptIn !== false}
                    onChange={async (e) => {
                      const ok = await updateEmailOptIn(e.target.checked);
                      onTriggerNotification(
                        ok ? "Voorkeuren Gewijzigd" : "Bijwerken mislukt",
                        ok
                          ? `E-mailmeldingen zijn ${e.target.checked ? 'geactiveerd' : 'gedeactiveerd'}.`
                          : "Kon uw voorkeur niet opslaan. Probeer het opnieuw.",
                        ok ? "info" : "warning"
                      );
                    }}
                    className="h-4 w-4 accent-orange-500 rounded border-slate-300 text-orange-500 bg-white"
                  />
                </label>

              </div>
            </div>

          </div>

        </section>



        {/* WhatsApp Help Banner */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 transition-all text-left gap-4 shadow-sm">
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
            href={buildWhatsAppLogisticsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-98 shadow-sm cursor-pointer whitespace-nowrap border-none"
          >
            <span>Stuur een Bericht</span>
            <span>💬</span>
          </a>
        </div>

      </div>

      {/* Cancellation confirmation modal */}
      <AnimatePresence>
        {cancelModalOrderId && (
          <motion.div
            key="cancel-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setCancelModalOrderId(null)}
          >
            <motion.div
              key="cancel-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm text-slate-900">Bestelling annuleren?</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Weet u zeker dat u bestelling <span className="font-mono font-bold text-slate-700">{cancelModalOrderId}</span> wilt annuleren?
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold text-amber-800">Annuleringsbeleid</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Gratis annuleren tot <strong>48 uur vóór de startdatum</strong>. Bij annulering binnen 48 uur kunnen kosten in rekening worden gebracht. Neem contact op via WhatsApp voor meer informatie.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCancelModalOrderId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Nee, terug
                </button>
                <button
                  onClick={() => handleCancelOrder(cancelModalOrderId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Ja, annuleren
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
