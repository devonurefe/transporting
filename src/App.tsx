/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Loader2, MessageCircle, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactModal from "./components/ContactModal";
import PWAInstallBanner from "./components/PWAInstallBanner";
import ToastNotification from "./components/ToastNotification";
import CookieBanner from "./components/CookieBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { clearChunkReloadFlag } from "./utils/chunkError";
import { Machine, Order, OrderStatus, AppNotification, UserProfile, CartItem } from "./types";
import { useAuthStore } from "./store/authStore";
import { useAppStore } from "./store/appStore";
import { buildWhatsAppGeneralUrl, buildWhatsAppOrderStatusUrl, buildWhatsAppPaymentLinkUrl, buildWhatsAppAdviceUrl, getWhatsAppNumber } from "./utils/whatsapp";
import { useModalA11y } from "./hooks/useModalA11y";

// Escape </script> inside JSON-LD so an admin-supplied string cannot break out of the script tag.
// JSON.stringify does not escape angle brackets by default; this plugs the gap.
const safeJsonLd = (obj: unknown): string =>
  JSON.stringify(obj).replace(/<\/script>/gi, "<\\/script>");

function NotFoundPage({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <p className="text-7xl font-black text-slate-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Pagina niet gevonden</h1>
      <p className="text-slate-500 mb-8 max-w-sm">
        De pagina die u zoekt bestaat niet of is verplaatst.
      </p>
      <button
        type="button"
        onClick={() => setActiveTab("home")}
        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors cursor-pointer"
      >
        Terug naar home
      </button>
    </div>
  );
}

// Stable session ID — used to scope idempotency keys to one page session.
// A network-timeout retry within the same session reuses this ID; a fresh page load generates a new one.
const SESSION_ID = crypto.randomUUID();

// Dynamic Code Splitting (React.lazy)
const HomeSection = lazy(() => import("./components/HomeSection"));
const CatalogSection = lazy(() => import("./components/CatalogSection"));
const BookingSection = lazy(() => import("./components/BookingSection"));
const MachineDetailPage = lazy(() => import("./components/MachineDetailPage"));
const CityLandingPage = lazy(() => import("./components/CityLandingPage"));
const FaqSection = lazy(() => import("./components/FaqSection"));
const AdminSection = lazy(() => import("./components/AdminSection"));
const MyOrdersSection = lazy(() => import("./components/MyOrdersSection"));
const AdviesSection = lazy(() => import("./components/AdviesSection"));
const KenniscentrumSection = lazy(() => import("./components/KenniscentrumSection"));
const BlogArticlePage = lazy(() => import("./components/BlogArticlePage"));
const LegalPage = lazy(() => import("./components/LegalPage"));
const AboutSection = lazy(() => import("./components/AboutSection"));

// Premium Loading Indicator Component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-3">
      <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
      <span className="text-sm text-slate-400 font-medium">Laden...</span>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname === "/" ? "home" : location.pathname.substring(1);

  // Search parameters — persisted in the catalog URL (?cat=…&q=…) so filters
  // survive refresh and can be shared. Initialised from the current URL.
  const initialFilters = (() => {
    const params = new URLSearchParams(window.location.search);
    return { q: params.get("q") ?? "", cat: params.get("cat") ?? "all" };
  })();
  const [searchQuery, setSearchQuery] = useState(initialFilters.q);
  const [selectedCategory, setSelectedCategory] = useState(initialFilters.cat);

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

  // A successful mount proves the current build's chunks loaded fine, so clear
  // the one-shot auto-reload flag — the next deploy's chunk error can retry too.
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);

  // selectedCategory/searchQuery only seed from the URL on App's initial mount
  // (see initialFilters above) — a client-side Link straight into
  // "/catalog?cat=…" from another page (e.g. the assortiment/category links on
  // AboutSection or a city landing page) doesn't remount App, so without this,
  // the mirror effect below would immediately push the *stale* pre-navigation
  // state back into the URL and silently strip the incoming ?cat=. Detect a
  // fresh entry into /catalog from elsewhere and adopt that URL's filters.
  const prevPathRef = useRef(location.pathname);
  const skipNextUrlMirrorRef = useRef(false);
  useEffect(() => {
    const enteringCatalog = location.pathname === "/catalog" && prevPathRef.current !== "/catalog";
    prevPathRef.current = location.pathname;
    if (enteringCatalog) {
      const params = new URLSearchParams(location.search);
      skipNextUrlMirrorRef.current = true;
      setSearchQuery(params.get("q") ?? "");
      setSelectedCategory(params.get("cat") ?? "all");
    }
  }, [location.pathname, location.search]);

  // Mirror the active catalog filters into the URL query string (replace, so we
  // don't spam browser history) so a refresh or shared link restores them.
  useEffect(() => {
    if (activeTab !== "catalog") return;
    if (skipNextUrlMirrorRef.current) { skipNextUrlMirrorRef.current = false; return; }
    const params = new URLSearchParams(location.search);
    if (searchQuery) params.set("q", searchQuery); else params.delete("q");
    if (selectedCategory && selectedCategory !== "all") params.set("cat", selectedCategory); else params.delete("cat");
    const next = params.toString();
    const current = location.search.replace(/^\?/, "");
    if (next !== current) {
      navigate({ pathname: "/catalog", search: next ? `?${next}` : "" }, { replace: true });
    }
  }, [searchQuery, selectedCategory, activeTab, location.search, navigate]);

  // Warm the most-linked lazy chunks (catalog + booking + FAQ) so nav clicks open
  // instantly instead of waiting on a Suspense spinner. Wait for the window `load`
  // event first: requestIdleCallback fires as soon as the main thread is idle — which
  // happens while the LCP hero is still downloading — so warming earlier steals
  // bandwidth from the hero and hurts LCP on slow connections.
  useEffect(() => {
    const warm = () => {
      import("./components/CatalogSection");
      import("./components/BookingSection");
      import("./components/FaqSection");
    };
    let cancelFn: (() => void) | null = null;
    const schedule = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cic) {
        const id = ric(warm, { timeout: 3000 });
        cancelFn = () => cic(id);
      } else {
        const id = window.setTimeout(warm, 2000);
        cancelFn = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
      cancelFn = () => window.removeEventListener("load", schedule);
    }
    return () => { cancelFn?.(); };
  }, []);

  // SEO: per-route title, meta description and canonical (SPA fallback)
  useEffect(() => {
    // Machine pages (/hoogwerker/:id), city pages (/hoogwerker-huren/:stad),
    // Kenniscentrum, About, the legal pages and the advisor tool all set their
    // own title/description via their own effect; let those components own the
    // head. Missing a route here doesn't just skip a title update — this effect
    // still runs on every route change and falls back to seo["/"], so on a
    // client-side navigation the home title would win the effect-ordering race
    // and silently overwrite whatever the page component just set (About,
    // Privacy, Voorwaarden and the advisor tool were missing from this list).
    if (
      location.pathname.startsWith("/hoogwerker/") ||
      location.pathname.startsWith("/hoogwerker-huren/") ||
      location.pathname.startsWith("/kenniscentrum") ||
      location.pathname === "/over-ons" ||
      location.pathname === "/privacy" ||
      location.pathname === "/voorwaarden" ||
      location.pathname === "/adviestool"
    ) return;
    const seo: Record<string, { title: string; desc: string; noindex?: boolean }> = {
      "/": {
        title: "huurgo — Hoogwerkers Huren | Leiden, Den Haag, Alphen a/d Rijn",
        desc: "Hoogwerker huren v.a. €49/dag. Schaarlift, rupshoogwerker & ladderlift. Bezorging in Leiden, Den Haag & Alphen a/d Rijn. Geen borg — ook voor particulieren & ZZP.",
      },
      "/catalog": {
        title: "Hoogwerker Huren — Schaarliften, Rupshoogwerkers & Meer | huurgo",
        desc: "Bekijk alle hoogwerkers: schaarliften 6–10m, rupshoogwerkers, ladderliften & meer. Direct huren v.a. €49/dag. ZZP & particulier welkom. Heel Zuid-Holland.",
      },
      "/booking": {
        title: "Online Reserveren — Snel & Eenvoudig | huurgo",
        desc: "Reserveer uw hoogwerker in 3 stappen. Kies uw data, ontvang direct de prijs en bevestig via WhatsApp met iDEAL betaallink. Geen borg vereist.",
      },
      "/veelgestelde-vragen": {
        title: "Veelgestelde vragen — Hoogwerker huren | huurgo",
        desc: "Antwoorden op veelgestelde vragen over hoogwerker huren: kosten, bezorging, borg, certificaten en betaling. Persoonlijk advies via WhatsApp.",
      },
      "/orders": {
        title: "Mijn Reserveringen | huurgo",
        desc: "Beheer uw huurcontracten, volg de status en download facturen.",
        noindex: true,
      },
      "/admin": { title: "Beheer | huurgo", desc: "", noindex: true },
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
    let pulseTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setFabPulse(prev => {
        if (!prev) {
          pulseTimeout = setTimeout(() => setFabPulse(false), 900);
          return true;
        }
        return prev;
      });
    }, 15000);
    return () => {
      clearInterval(interval);
      if (pulseTimeout) clearTimeout(pulseTimeout);
    };
  }, []);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [replaceCartMachine, setReplaceCartMachine] = useState<Machine | null>(null);
  const replaceDialogRef = useModalA11y<HTMLDivElement>(!!replaceCartMachine, () => setReplaceCartMachine(null));
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
          pastRentalsCount: 0,
          emailOptIn: storeUser.emailOptIn !== false
        });
        setIsAdminMode(false);
      }
    } else if (authChecked) {
      // Auth check is complete and confirmed no user — safe to clear admin mode
      setCurrentUser(null);
      setIsAdminMode(false);
      // Guests default to excl. BTW (lower, more attractive price); VAT is added at checkout.
      setVatDisplay("excl");
      localStorage.setItem("hwh_vat_display", "excl");
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
  const [systemLogs, setSystemLogs] = useState<any[]>([]);

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

  // Real review aggregate for SEO structured data — never hard-code ratings (Google
  // treats unverifiable aggregateRating as spam). Only emitted when count > 0.
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  useEffect(() => {
    fetch("/api/orders/ratings/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.count === "number") setRatingSummary(d); })
      .catch(() => {});
  }, []);

  const addToCart = useAppStore((state) => state.addToCart);
  const removeFromCart = useAppStore((state) => state.removeFromCart);
  const updateCartItemDates = useAppStore((state) => state.updateCartItemDates);
  const clearCart = useAppStore((state) => state.clearCart);

  const addMachine = useAppStore((state) => state.addMachine);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const fetchBlockedDates = useAppStore((state) => state.fetchBlockedDates);

  const getAuthHeaders = (): Record<string, string> => {
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

  // Guest order rating — detect ?rate=ORDER_ID&email=EMAIL from the "Voltooid" status email link
  const [guestRatingData, setGuestRatingData] = useState<{ orderId: string; email: string } | null>(null);
  const [guestRatingStars, setGuestRatingStars] = useState(0);
  const [guestRatingDone, setGuestRatingDone] = useState(false);
  const [guestRatingLoading, setGuestRatingLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rate = params.get("rate");
    const email = params.get("email");
    if (rate && email) {
      setGuestRatingData({ orderId: rate, email });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGuestRatingSubmit = useCallback(async () => {
    if (!guestRatingData || guestRatingStars === 0) return;
    setGuestRatingLoading(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(guestRatingData.orderId)}/rating/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestRatingData.email, rating: guestRatingStars })
      });
      if (res.ok) {
        setGuestRatingDone(true);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerNotification("Fout", (err as { error?: string }).error || "Beoordeling kon niet worden opgeslagen.", "warning", false);
        setGuestRatingData(null);
      }
    } catch {
      triggerNotification("Fout", "Kon de beoordeling niet verzenden.", "warning", false);
      setGuestRatingData(null);
    } finally {
      setGuestRatingLoading(false);
    }
  }, [guestRatingData, guestRatingStars, triggerNotification]);

  // Triggered when search is executed from landing hero (category cards, deals
  // carousel, "Bekijk alles", etc. — anything that calls onSearch on HomeSection).
  const handleLandingPageSearch = (query: string, category: string) => {
    setSearchQuery(query);
    // "schaarlift" on homepage = all scissor lifts group in catalog
    const mapped = category === "schaarlift" ? "schaarlift-group" : (category || "all");
    setSelectedCategory(mapped);
    // Must carry cat/q in the navigate() call itself, not just via the state
    // setters above — the "fresh entry into /catalog" effect below re-derives
    // selectedCategory/searchQuery from the URL on every navigation that lands
    // here from another route, so a bare navigate("/catalog") with no query
    // string was overwriting the category we just set back to "all", making
    // every homepage category card show the full, unfiltered assortment.
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (mapped !== "all") params.set("cat", mapped);
    const search = params.toString();
    navigate(search ? `/catalog?${search}` : "/catalog");
  };

  // Replaces the cart with the chosen machine and moves to the booking flow.
  const proceedWithBooking = (machine: Machine) => {
    setSelectedMachine(machine);
    clearCart();
    // No default date range — the calendar starts empty so the customer picks
    // their own period instead of seeing a pre-filled price for dates they
    // never chose.
    addToCart(machine, "", "");
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
    // Idempotency key: scoped to this session + machine + dates so a network-timeout retry
    // returns the same order instead of creating a duplicate.
    const idempotencyKey = `${SESSION_ID}-${orderData.machineId}-${orderData.startDate}-${orderData.endDate}`;
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
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
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
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
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">

      {/* JSON-LD Structured Data for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": ["LocalBusiness", "RentalService", "Organization"],
            "name": `${siteConfig.siteName || "huurgo"} — Hoogwerkers Verhuur`,
            "legalName": siteConfig.companyLegalName || "MB Hoogwerkers B.V.",
            "description": "Snel en eenvoudig hoogwerkers huren bij huurgo. Schaarlift, spinhoogwerker en aanhangerhoogwerker voor ZZP'ers en particulieren.",
            "url": window.location.origin,
            "logo": `${window.location.origin}/og-image.png`,
            "telephone": siteConfig.contactPhone || "+31715428114",
            "email": siteConfig.contactEmail || "info@huurgo.nl",
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
            // Only include a rating when real customer reviews exist (avoids
            // Google structured-data spam penalties for invented ratings).
            ...(ratingSummary.count > 0 ? {
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": ratingSummary.average.toFixed(1),
                "reviewCount": String(ratingSummary.count),
                "bestRating": "5",
                "worstRating": "1"
              }
            } : {})
          })
        }}
      />

      {/* FAQ JSON-LD lives server-side only (server.ts metaForRequest), gated to
          /veelgestelde-vragen and built from the same live siteConfig.faqItems
          via resolveFaqItems there. This client-rendered copy used to run
          unconditionally on every route (home, /admin, /booking, city pages,
          blog — none of which show FAQ content), which is exactly the kind of
          structured-data/visible-content mismatch Google's guidelines warn
          about, and duplicated the server one on the actual FAQ page itself. */}

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
          {/* No route-level exit/enter animation: an exit fade (AnimatePresence
              mode="wait") blocked every tab switch for ~0.6s before content
              appeared. Navigation must feel instant. */}
          <Routes location={location}>
            <Route path="/" element={
              <HomeSection
                onSearch={handleLandingPageSearch}
                setActiveTab={setActiveTab}
                siteConfig={siteConfig}
                customCategories={customCategories}
              />
            } />

            <Route path="/catalog" element={
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
            } />

            <Route path="/hoogwerker/:id" element={
              <MachineDetailPage onSelectMachineForBooking={handleSelectMachineForBooking} />
            } />

            <Route path="/hoogwerker-huren/:stad" element={
              <CityLandingPage onSelectMachineForBooking={handleSelectMachineForBooking} />
            } />

            <Route path="/veelgestelde-vragen" element={<FaqSection />} />

            <Route path="/over-ons" element={<AboutSection />} />

            <Route path="/privacy" element={<LegalPage slug="privacy" title="Privacybeleid" />} />

            <Route path="/voorwaarden" element={<LegalPage slug="voorwaarden" title="Algemene voorwaarden" />} />

            <Route path="/kenniscentrum" element={<KenniscentrumSection setActiveTab={setActiveTab} />} />

            <Route path="/kenniscentrum/:slug" element={<BlogArticlePage setActiveTab={setActiveTab} />} />

            <Route path="/adviestool" element={<AdviesSection />} />

            <Route path="/booking" element={
              // Checkout is the revenue-critical path — same local recovery as
              // /admin below, instead of only the app-wide boundary in main.tsx
              // (whose fallback blanks the entire app, header/footer included,
              // for a render error anywhere in this multi-step flow).
              <ErrorBoundary>
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
              </ErrorBoundary>
            } />

            <Route path="/orders" element={
              <MyOrdersSection
                orders={orders}
                onTriggerNotification={triggerNotification}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                onAddSystemLog={handleAddSystemLog}
                setActiveTab={setActiveTab}
              />
            } />

            <Route path="/admin" element={
              <ErrorBoundary>
                <AdminSection
                  isAdminMode={isAdminMode}
                  setIsAdminMode={setIsAdminMode}
                  systemLogs={systemLogs}
                  onAddSystemLog={handleAddSystemLog}
                />
              </ErrorBoundary>
            } />

            <Route path="*" element={<NotFoundPage setActiveTab={setActiveTab} />} />
          </Routes>
        </Suspense>
      </main>

      {/* Bottom Footer block — hidden in the admin console so it stays a
          self-contained dashboard (the public marketing footer shouldn't
          bleed in below the admin panels). */}
      {!location.pathname.startsWith("/admin") && (
        <Footer
          siteName={siteConfig.siteName}
          setActiveTab={setActiveTab}
          setShowContactModal={setShowContactModal}
        />
      )}

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
              ref={replaceDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Winkelwagen vervangen"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm outline-none"
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

      {/* GUEST ORDER RATING MODAL — opened via ?rate=ORDER_ID&email=EMAIL from completion email */}
      <AnimatePresence>
        {guestRatingData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={() => { setGuestRatingData(null); setGuestRatingDone(false); setGuestRatingStars(0); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Beoordeel uw huurervaring"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              {guestRatingDone ? (
                <>
                  <div className="text-center text-4xl mb-3">⭐</div>
                  <h3 className="text-lg font-black text-slate-900 mb-2 text-center">Bedankt voor uw beoordeling!</h3>
                  <p className="text-sm text-slate-500 mb-6 text-center leading-relaxed">
                    Uw feedback helpt ons de service te verbeteren.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setGuestRatingData(null); setGuestRatingDone(false); setGuestRatingStars(0); }}
                    className="w-full px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors cursor-pointer"
                  >
                    Sluiten
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-black text-slate-900 mb-1">Uw huurervaring</h3>
                  <p className="text-xs text-slate-500 mb-5">
                    Reservering <span className="font-mono font-bold">{guestRatingData.orderId}</span> — klik op een ster om te beoordelen
                  </p>
                  <div className="flex justify-center gap-1 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setGuestRatingStars(star)}
                        className="p-1 hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                      >
                        <Star className={`h-8 w-8 ${star <= guestRatingStars ? "text-amber-500 fill-amber-500" : "text-slate-200"}`} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setGuestRatingData(null); setGuestRatingStars(0); }}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      disabled={guestRatingStars === 0 || guestRatingLoading}
                      onClick={handleGuestRatingSubmit}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold transition-colors cursor-pointer"
                    >
                      {guestRatingLoading ? "Laden..." : "Versturen"}
                    </button>
                  </div>
                </>
              )}
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
          <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-6 right-4 md:right-6 z-[51] flex flex-col items-end gap-2">
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64 space-y-1.5"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1 pb-1">Stuur ons een bericht</p>
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
                  {
                    icon: "💬",
                    label: "Overig",
                    sub: "Iets anders? Stuur ons gewoon een bericht",
                    url: `https://wa.me/${getWhatsAppNumber()}`,
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
                      <p className="text-[10px] text-slate-500 leading-tight truncate">{item.sub}</p>
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
              className={`relative flex items-center justify-center h-11 w-11 md:h-14 md:w-14 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer border-none shadow-emerald-500/25 ${fabOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-[#25D366] hover:bg-[#1da851]"}`}
              title="Hulp nodig? Chat via WhatsApp"
              aria-label={fabOpen ? "WhatsApp menu sluiten" : "Hulp nodig? Chat via WhatsApp"}
              aria-expanded={fabOpen}
            >
              <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
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
