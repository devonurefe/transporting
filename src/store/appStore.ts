import { create } from "zustand";
import { Machine, Order, OrderStatus, CartItem, CampaignRule } from "../types";
import { devWarn } from "../utils/log";
import type { AdvisorConfig } from "../utils/advisor";

interface Category {
  id: string;
  label: string;
  listLabel?: string;
  desc: string;
  heights: string;
  price: string;
  infoContent?: {
    useCases?: string[];
    advantages?: string[];
    notFor?: string[];
  };
}

interface SiteConfig {
  siteName: string;
  heroTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl?: string;
  menuHomeLabel: string;
  menuCatalogLabel: string;
  menuOrdersLabel: string;
  menuAdminLabel: string;
  contactEmail?: string;
  contactPhone?: string;
  companyAddress?: string;
  kvkNumber?: string;
  btwNumber?: string;
  companyLegalName?: string;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleReviews?: GoogleReview[] | null;
  advisorConfig?: AdvisorConfig | null;
  coffeeCornerEnabled?: boolean;
  coffeeCornerTitle?: string;
  coffeeCornerDescription?: string;
  coffeeCornerImageUrl?: string;
  coffeeCornerCtaLabel?: string;
  coffeeCornerCtaHref?: string;
  // Photo gallery: admin-editable homepage carousel of real company photos,
  // shown between Coffee Corner and the footer reviews. Off until an admin
  // fills in a title + at least one photo and enables it.
  galleryEnabled?: boolean;
  galleryTitle?: string;
  galleryDescription?: string;
  galleryImages?: string[];
  // Admin-beheerbare content (AdminContent). null/undefined = code-fallback.
  faqItems?: Array<{ q: string; a: string }> | null;
  uspItems?: Array<{ icon: string; title: string; text: string }> | null;
  openingHours?: { monFri?: string; sat?: string; sun?: string } | null;
  transportFees?: { deliveryFee?: number; trailerPerDay?: number } | null;
  globalAddons?: {
    safety?: { name?: string; pricePerWeek?: number };
    rijplaten?: { name?: string; pricePerWeek?: number };
  } | null;
  footerDescription?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  // Alleen aanwezig in het admin ?full=1 antwoord — de publieke feed stript ze
  privacyPolicy?: string | null;
  termsConditions?: string | null;
}

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  type: "artikel" | "handleiding";
  title: string;
  excerpt: string;
  category: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BlockedDate {
  id: string;
  machineId: string;
  date: string;
  reason: string;
}

interface AppState {
  machines: Machine[];
  orders: Order[];
  ordersPage: number;
  ordersTotalPages: number;
  ordersTotalCount: number;
  customCategories: Category[];
  siteConfig: SiteConfig;
  siteConfigLoaded: boolean;
  blockedDates: BlockedDate[];
  blogPosts: BlogPost[];
  cartItems: CartItem[];
  isLoading: boolean;
  error: string | null;

  // Fetch actions
  fetchMachines: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  loadMoreOrders: () => Promise<void>;
  loadAllOrders: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchSiteConfig: () => Promise<void>;
  fetchBlockedDates: () => Promise<void>;
  fetchCampaignRules: () => Promise<void>;
  fetchAllData: () => Promise<void>;

  // Catalog / Admin actions
  addMachine: (machData: Partial<Machine>) => Promise<boolean>;
  updateMachine: (id: string, machData: Partial<Machine>) => Promise<boolean>;
  deleteMachine: (id: string) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<true | false | string>;
  blockDate: (machineId: string, date: string, reason: string) => Promise<boolean>;
  unblockDate: (machineId: string, date: string) => Promise<boolean>;
  updateCategories: (categories: Category[]) => Promise<boolean>;
  updateSiteConfig: (config: Partial<SiteConfig>) => Promise<boolean>;

  // Kenniscentrum (blog / guides) actions
  fetchBlogPosts: () => Promise<void>;
  addBlogPost: (data: Partial<BlogPost>) => Promise<boolean>;
  updateBlogPost: (id: string, data: Partial<BlogPost>) => Promise<boolean>;
  deleteBlogPost: (id: string) => Promise<boolean>;
  toggleBlogPostPublished: (id: string) => Promise<boolean>;

  // Cart actions
  addToCart: (machine: Machine, startDate: string, endDate: string) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemDates: (itemId: string, startDate: string, endDate: string) => void;
  clearCart: () => void;
  clearError: () => void;

  campaignRules: CampaignRule[];
  updateCampaignRules: (rules: CampaignRule[]) => void;

  // Adviestool (product-finder) admin copy-overrides
  updateAdvisorConfig: (config: AdvisorConfig) => Promise<boolean>;

  // VAT display preference (display only — never affects calculation)
  vatDisplay: "excl" | "incl";
  setVatDisplay: (mode: "excl" | "incl") => void;
}

const defaultCategories: Category[] = [
  { id: "aanhanger", label: "\"Tow & Go\" Aanhangerhoogwerker", listLabel: "\"Tow & Go\" Aanhangerhoogwerkers", desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.", heights: "12m - 17m", price: "v.a. €80/dag" },
  { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.", heights: "15m - 17m", price: "v.a. €160/dag" },
  { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Verkrijgbaar in 6m, 8m en 10m werkhoogte. Past door standaard deuren.", heights: "6m - 10m", price: "v.a. €49/dag" },
  { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.", heights: "5m - 10m", price: "v.a. €75/dag" },
  { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.", heights: "18m - 21m", price: "v.a. €90/dag" },
  { id: "ecolift", label: "Pecolift", listLabel: "Pecolift", desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.", heights: "4.2m", price: "v.a. €45/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete kluspakketten speciaal samengesteld voor specifieke ZZP- en particuliere klussen.", heights: "4m - 21m", price: "v.a. €80/dag" }
];

const getAuthHeaders = (): Record<string, string> => {
  const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
  const token = isAdminMode
    ? localStorage.getItem("hwh_admin_token")
    : localStorage.getItem("hwh_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

// De navigatie heette jarenlang "Catalogus"; die string staat daardoor als
// menuCatalogLabel in bestaande databases/sessiecaches. Sinds de hernoeming
// naar de sectorterm "Assortiment" behandelen we dat oude default als
// "niet ingesteld", zodat de vertaling uit languageStore wint. Een bewust
// afwijkend admin-label (Customizer) blijft gewoon staan.
function normalizeSiteConfig<T extends { menuCatalogLabel?: string }>(config: T): T {
  if (config && (config.menuCatalogLabel === "Catalogus" || config.menuCatalogLabel === "Catalog")) {
    return { ...config, menuCatalogLabel: "" };
  }
  return config;
}

export const useAppStore = create<AppState>((set, get) => ({
  machines: [],
  orders: [],
  ordersPage: 1,
  ordersTotalPages: 1,
  ordersTotalCount: 0,
  customCategories: defaultCategories,
  // True once we have a real config — either a sessionStorage cache (returning
  // visitor) or a fresh API response. Gates the hero image so the old default
  // photo never flashes before the admin-configured one loads.
  siteConfigLoaded: (() => {
    try {
      return !!sessionStorage.getItem("hwh_site_config");
    } catch {
      return false;
    }
  })(),
  siteConfig: (() => {
    try {
      const cached = sessionStorage.getItem("hwh_site_config");
      if (cached) return normalizeSiteConfig(JSON.parse(cached));
    } catch { /* ignore */ }
    return {
      siteName: "huurgo",
      heroTagline: "Snel & Makkelijk Hoogwerkers Huren",
      heroTitle: "Wat heeft u nodig?",
      heroSubtitle: "MB Hoogwerkers verhuurt hoogwerkers, schaarliften en ladderliften aan ZZP'ers en particulieren. Geen gedoe, direct online geregeld.",
      heroImageUrl: "",
      menuHomeLabel: "Home",
      menuCatalogLabel: "Assortiment",
      menuOrdersLabel: "Mijn Account",
      menuAdminLabel: "Portaal"
    };
  })(),
  blockedDates: [],
  blogPosts: [],
  cartItems: (() => {
    try {
      const stored = localStorage.getItem("hwh_cart");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  })(),
  campaignRules: (() => {
    try {
      const stored = localStorage.getItem("hwh_campaign_rules");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      devWarn("Failed to load campaign rules from localStorage");
    }
    return [];
  })(),
  isLoading: false,
  error: null,
  // Always start excl. BTW on load (lower, more attractive price). App.tsx may
  // switch to incl. for logged-in consumers; VAT is always added at checkout.
  vatDisplay: "excl" as const,

  setVatDisplay: (mode) => {
    try { localStorage.setItem("hwh_vat_display", mode); } catch { /* ignore */ }
    set({ vatDisplay: mode });
  },

  fetchMachines: async () => {
    try {
      // Admins need the raw base64 image data (for editing); the public feed
      // returns lightweight binary-proxy image URLs instead. See toPublicMachine.
      const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
      const url = isAdminMode ? "/api/machines?full=1" : "/api/machines";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        set({ machines: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen machines." });
      }
    } catch (e: any) {
      devWarn("Machines fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen machines." });
    }
  },

  fetchOrders: async () => {
    const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
    const token = isAdminMode
      ? localStorage.getItem("hwh_admin_token")
      : localStorage.getItem("hwh_token");
    if (!token) {
      set({ orders: [], ordersPage: 1, ordersTotalPages: 1, ordersTotalCount: 0, error: null });
      return;
    }
    try {
      const isAdmin = localStorage.getItem("hwh_admin_mode") === "true";
      const url = isAdmin ? "/api/orders?limit=100&page=1" : "/api/orders?limit=500";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const totalPages = Number(res.headers.get("X-Total-Pages") || "1");
        const totalCount = Number(res.headers.get("X-Total-Count") || "0");
        set({ orders: await res.json(), ordersPage: 1, ordersTotalPages: totalPages, ordersTotalCount: totalCount, error: null });
      } else if (res.status === 401 || res.status === 403) {
        set({ orders: [], ordersPage: 1, ordersTotalPages: 1, ordersTotalCount: 0, error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen bestellingen." });
      }
    } catch (e: any) {
      devWarn("Orders fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen bestellingen." });
    }
  },

  loadMoreOrders: async () => {
    const { ordersPage, ordersTotalPages } = get();
    if (ordersPage >= ordersTotalPages) return;
    const nextPage = ordersPage + 1;
    try {
      const res = await fetch(`/api/orders?limit=100&page=${nextPage}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const newOrders = await res.json();
        set(state => ({ orders: [...state.orders, ...newOrders], ordersPage: nextPage }));
      }
    } catch (e: any) {
      devWarn("Load more orders failed.");
    }
  },

  // Haalt alle resterende orderpagina's op. Nodig zodra een admin-filter
  // actief is: filtering gebeurt client-side, dus zonder de volledige
  // dataset zijn oudere orders onvindbaar.
  loadAllOrders: async () => {
    const MAX_PAGES = 50; // veiligheidsgrens (50 × 100 orders)
    for (let i = 0; i < MAX_PAGES && get().ordersPage < get().ordersTotalPages; i++) {
      const before = get().ordersPage;
      await get().loadMoreOrders();
      if (get().ordersPage === before) break; // fetch mislukt — stop stil
    }
  },

  fetchCategories: async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        set({ customCategories: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen categorieën." });
      }
    } catch (e: any) {
      devWarn("Categories fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen categorieën." });
    }
  },

  fetchSiteConfig: async () => {
    try {
      // Admins need the raw base64 hero (for editing); the public feed returns
      // the binary-proxy hero URL instead. See the /site-hero-image endpoint.
      const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
      const url = isAdminMode ? "/api/site-config?full=1" : "/api/site-config";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = normalizeSiteConfig(await res.json());
        set({ siteConfig: data, siteConfigLoaded: true, error: null });
        try { sessionStorage.setItem("hwh_site_config", JSON.stringify(data)); } catch { /* quota exceeded — ignore */ }
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen site configuratie." });
      }
    } catch (e: any) {
      devWarn("Site config fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen site configuratie." });
    }
  },

  fetchBlockedDates: async () => {
    try {
      const res = await fetch("/api/blocked-dates");
      if (res.ok) {
        set({ blockedDates: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen geblokkeerde datums." });
      }
    } catch (e: any) {
      devWarn("Blocked dates fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen geblokkeerde datums." });
    }
  },

  fetchCampaignRules: async () => {
    try {
      const res = await fetch("/api/campaign-rules");
      if (res.ok) {
        const rules = await res.json();
        if (Array.isArray(rules)) {
          set({ campaignRules: rules });
          try { localStorage.setItem("hwh_campaign_rules", JSON.stringify(rules)); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      devWarn("Failed to fetch campaign rules from API, using local fallback.");
    }
  },

  fetchAllData: async () => {
    set({ isLoading: true, error: null });
    await Promise.all([
      get().fetchMachines(),
      get().fetchOrders(),
      get().fetchCategories(),
      get().fetchSiteConfig(),
      get().fetchBlockedDates(),
      get().fetchCampaignRules()
    ]);
    set({ isLoading: false });
  },

  addMachine: async (machData) => {
    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(machData)
      });
      if (res.ok) {
        await get().fetchMachines();
        return true;
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij toevoegen machine." });
      }
    } catch (e: any) {
      console.error(e);
      set({ error: e.message || "Netwerkfout bij toevoegen machine." });
    }
    return false;
  },

  updateMachine: async (id, machData) => {
    try {
      const res = await fetch(`/api/machines/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(machData)
      });
      if (res.ok) {
        await get().fetchMachines();
        return true;
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij bijwerken machine." });
      }
    } catch (e: any) {
      console.error(e);
      set({ error: e.message || "Netwerkfout bij bijwerken machine." });
    }
    return false;
  },

  deleteMachine: async (id) => {
    try {
      const res = await fetch(`/api/machines/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await get().fetchMachines();
        return true;
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij verwijderen machine." });
      }
    } catch (e: any) {
      console.error(e);
      set({ error: e.message || "Netwerkfout bij verwijderen machine." });
    }
    return false;
  },

  updateOrderStatus: async (orderId, status) => {
    // Remember original for rollback
    const originalStatus = get().orders.find(o => o.id === orderId)?.status;

    // Optimistic frontend update
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, status } : o)
    }));

    const rollback = () => {
      if (originalStatus) {
        set(state => ({
          orders: state.orders.map(o => o.id === orderId ? { ...o, status: originalStatus } : o)
        }));
      }
    };

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await get().fetchOrders();
        return true;
      }
      // API rejected — roll back optimistic update and surface the error
      const data = await res.json().catch(() => ({}));
      rollback();
      return data?.error || "Status bijwerken mislukt.";
    } catch (e) {
      console.error("Failed to persist order status update:", e);
      rollback();
    }
    return false;
  },

  blockDate: async (machineId, date, reason) => {
    try {
      const res = await fetch("/api/blocked-dates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ machineId, date, reason })
      });
      if (res.ok) {
        await get().fetchBlockedDates();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  unblockDate: async (machineId, date) => {
    try {
      const res = await fetch("/api/blocked-dates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ machineId, date, action: "unblock" })
      });
      if (res.ok) {
        await get().fetchBlockedDates();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  updateCategories: async (categories) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(categories)
      });
      if (res.ok) {
        await get().fetchCategories();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  updateSiteConfig: async (config) => {
    try {
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        await get().fetchSiteConfig();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  // Kenniscentrum (blog / guides) — admins get all posts (incl. drafts) via
  // ?all=1; the public feed returns only published posts.
  fetchBlogPosts: async () => {
    try {
      const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
      const url = isAdminMode ? "/api/blog-posts?all=1" : "/api/blog-posts";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        set({ blogPosts: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen artikelen." });
      }
    } catch (e: any) {
      devWarn("Blog posts fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen artikelen." });
    }
  },

  addBlogPost: async (data) => {
    try {
      const res = await fetch("/api/blog-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await get().fetchBlogPosts();
        return true;
      }
      const err = await res.json().catch(() => ({}));
      set({ error: err.error || "Fout bij toevoegen artikel." });
    } catch (e: any) {
      set({ error: e.message || "Netwerkfout bij toevoegen artikel." });
    }
    return false;
  },

  updateBlogPost: async (id, data) => {
    try {
      const res = await fetch(`/api/blog-posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await get().fetchBlogPosts();
        return true;
      }
      const err = await res.json().catch(() => ({}));
      set({ error: err.error || "Fout bij bijwerken artikel." });
    } catch (e: any) {
      set({ error: e.message || "Netwerkfout bij bijwerken artikel." });
    }
    return false;
  },

  deleteBlogPost: async (id) => {
    try {
      const res = await fetch(`/api/blog-posts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await get().fetchBlogPosts();
        return true;
      }
      const err = await res.json().catch(() => ({}));
      set({ error: err.error || "Fout bij verwijderen artikel." });
    } catch (e: any) {
      set({ error: e.message || "Netwerkfout bij verwijderen artikel." });
    }
    return false;
  },

  toggleBlogPostPublished: async (id) => {
    try {
      const res = await fetch(`/api/blog-posts/${id}/toggle-publish`, {
        method: "PATCH",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await get().fetchBlogPosts();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  // Cart actions implementation
  addToCart: (machine, startDate, endDate) => {
    set(state => {
      // Avoid duplicate machines in cart
      const exists = state.cartItems.some(item => item.machine.id === machine.id);
      if (exists) return {};
      
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        machine,
        startDate,
        endDate
      };
      const updated = [...state.cartItems, newItem];
      try { localStorage.setItem("hwh_cart", JSON.stringify(updated)); } catch { /* ignore */ }
      return { cartItems: updated };
    });
  },

  removeFromCart: (itemId) => {
    set(state => {
      const updated = state.cartItems.filter(item => item.id !== itemId);
      try { localStorage.setItem("hwh_cart", JSON.stringify(updated)); } catch { /* ignore */ }
      return { cartItems: updated };
    });
  },

  updateCartItemDates: (itemId, startDate, endDate) => {
    set(state => {
      const updated = state.cartItems.map(item =>
        item.id === itemId ? { ...item, startDate, endDate } : item
      );
      try { localStorage.setItem("hwh_cart", JSON.stringify(updated)); } catch { /* ignore */ }
      return { cartItems: updated };
    });
  },

  clearCart: () => {
    try { localStorage.removeItem("hwh_cart"); } catch { /* ignore */ }
    set({ cartItems: [] });
  },

  clearError: () => set({ error: null }),

  updateCampaignRules: (rules) => {
    // Optimistic update
    set({ campaignRules: rules });
    try { localStorage.setItem("hwh_campaign_rules", JSON.stringify(rules)); } catch { /* ignore */ }
    // Persist to DB
    fetch("/api/campaign-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(rules)
    }).then((res) => {
      if (res.ok) get().fetchCampaignRules();
    }).catch(() => devWarn("Failed to save campaign rules to DB, localStorage fallback active."));
  },

  updateAdvisorConfig: async (config) => {
    // Optimistic: reflect the new copy in the live siteConfig immediately.
    set(state => ({ siteConfig: { ...state.siteConfig, advisorConfig: config } }));
    try {
      const res = await fetch("/api/advisor-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        await get().fetchSiteConfig();
        return true;
      }
      const data = await res.json().catch(() => ({}));
      set({ error: data.error || "Kon adviestool niet opslaan." });
    } catch (e) {
      devWarn("Failed to save advisor config to DB.");
    }
    return false;
  }
}));

