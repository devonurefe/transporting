import { create } from "zustand";
import { Machine, Order, CartItem, CampaignRule } from "../types";

interface Category {
  id: string;
  label: string;
  listLabel?: string;
  desc: string;
  heights: string;
  price: string;
}

interface SiteConfig {
  siteName: string;
  heroTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  menuHomeLabel: string;
  menuCatalogLabel: string;
  menuAdvisorLabel: string;
  menuOrdersLabel: string;
  menuAdminLabel: string;
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
  customCategories: Category[];
  siteConfig: SiteConfig;
  blockedDates: BlockedDate[];
  cartItems: CartItem[];
  isLoading: boolean;
  error: string | null;

  // Fetch actions
  fetchMachines: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchSiteConfig: () => Promise<void>;
  fetchBlockedDates: () => Promise<void>;
  fetchAllData: () => Promise<void>;

  // Catalog / Admin actions
  addMachine: (machData: Partial<Machine>) => Promise<boolean>;
  updateMachine: (id: string, machData: Partial<Machine>) => Promise<boolean>;
  deleteMachine: (id: string) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: string) => Promise<boolean>;
  blockDate: (machineId: string, date: string, reason: string) => Promise<boolean>;
  unblockDate: (machineId: string, date: string) => Promise<boolean>;
  updateCategories: (categories: Category[]) => Promise<boolean>;
  updateSiteConfig: (config: Partial<SiteConfig>) => Promise<boolean>;

  // Cart actions
  addToCart: (machine: Machine, startDate: string, endDate: string) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemDates: (itemId: string, startDate: string, endDate: string) => void;
  clearCart: () => void;
  clearError: () => void;

  campaignRules: CampaignRule[];
  updateCampaignRules: (rules: CampaignRule[]) => void;
}

const defaultCategories: Category[] = [
  { id: "aanhanger", label: "\"Toe & Go\" Aanhangerhoogwerker", listLabel: "\"Toe & Go\" Aanhangerhoogwerkers", desc: "De meest flexibele oplossing die transportkosten elimineert, ideaal voor elke ZZP'er met een trekhaak.", heights: "12m - 17m", price: "v.a. €80/dag" },
  { id: "spin", label: "Rupshoogwerker", listLabel: "Rupshoogwerkers", desc: "Ideaal voor kwetsbare ondergronden, smalle tuintoegangen en hoge gevelwerkzaamheden.", heights: "15m - 17m", price: "v.a. €160/dag" },
  { id: "schaarlift", label: "Schaarlift (8m)", listLabel: "Schaarliften (8m)", desc: "Ideaal voor binnen- en buitengebruik op vlakke ondergronden. Past door deuren.", heights: "8m", price: "v.a. €80/dag" },
  { id: "schaarlift-smal", label: "Smal Model Schaarlift (10m)", listLabel: "Schaarliften (10m smal)", desc: "Compacte en smalle schaarlift voor nauwe gangpaden en binnenruimtes tot 10 meter werkhoogte.", heights: "10m", price: "v.a. €95/dag" },
  { id: "mastlift", label: "Mastlift", listLabel: "Mastliften", desc: "Verticale mastliften voor snel, efficiënt en compact werk in magazijnen of kantoren.", heights: "5m - 10m", price: "v.a. €75/dag" },
  { id: "ladderlift", label: "Ladderlift", listLabel: "Ladderliften / Verhuisliften", desc: "Verhuis- en ladderliften voor veilig transport van zware meubels of bouwmaterialen direct via het raam.", heights: "18m - 21m", price: "v.a. €90/dag" },
  { id: "ecolift", label: "Ecolift", listLabel: "Ecolift", desc: "Milieuvriendelijk en veilig alternatief voor ladders. Geen batterijen of hydrauliek nodig.", heights: "4.2m", price: "v.a. €45/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Complete kluspakketten speciaal samengesteld voor specifieke ZZP- en particuliere klussen.", heights: "4m - 21m", price: "v.a. €80/dag" }
];

const getAuthHeaders = () => {
  const token = localStorage.getItem("hwh_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

export const useAppStore = create<AppState>((set, get) => ({
  machines: [],
  orders: [],
  customCategories: defaultCategories,
  siteConfig: {
    siteName: "HuurGo",
    heroTagline: "Snel & Makkelijk Hoogwerkers Huren",
    heroTitle: "Wat heeft u nodig?",
    heroSubtitle: "Kies uw categorie en huur direct. Simpel, snel, all-in.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalogus",
    menuAdvisorLabel: "AI Adviseur",
    menuOrdersLabel: "Mijn Account",
    menuAdminLabel: "Portaal"
  },
  blockedDates: [],
  cartItems: [],
  campaignRules: (() => {
    try {
      const stored = localStorage.getItem("hwh_campaign_rules");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load campaign rules from localStorage");
    }
    return [
      { id: "rule-1", name: "Schilder Lente Korting", scope: "role", scopeValue: "Schilder", discountPercent: 12, isActive: true },
      { id: "rule-2", name: "Magazijn Schaarlift Deal", scope: "category", scopeValue: "schaarlift", discountPercent: 10, isActive: true }
    ];
  })(),
  isLoading: false,
  error: null,

  fetchMachines: async () => {
    try {
      const res = await fetch("/api/machines");
      if (res.ok) {
        set({ machines: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen machines." });
      }
    } catch (e: any) {
      console.warn("Machines fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen machines." });
    }
  },

  fetchOrders: async () => {
    const token = localStorage.getItem("hwh_token");
    if (!token) {
      set({ orders: [], error: null });
      return;
    }
    try {
      const res = await fetch("/api/orders", {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        set({ orders: await res.json(), error: null });
      } else if (res.status === 401 || res.status === 403) {
        set({ orders: [], error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen bestellingen." });
      }
    } catch (e: any) {
      console.warn("Orders fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen bestellingen." });
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
      console.warn("Categories fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen categorieën." });
    }
  },

  fetchSiteConfig: async () => {
    try {
      const res = await fetch("/api/site-config");
      if (res.ok) {
        set({ siteConfig: await res.json(), error: null });
      } else {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error || "Fout bij ophalen site configuratie." });
      }
    } catch (e: any) {
      console.warn("Site config fetch failed.");
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
      console.warn("Blocked dates fetch failed.");
      set({ error: e.message || "Netwerkfout bij ophalen geblokkeerde datums." });
    }
  },

  fetchAllData: async () => {
    set({ isLoading: true, error: null });
    await Promise.all([
      get().fetchMachines(),
      get().fetchOrders(),
      get().fetchCategories(),
      get().fetchSiteConfig(),
      get().fetchBlockedDates()
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
    // Optimistic frontend update
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, status: status as any } : o)
    }));

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
    } catch (e) {
      console.error("Failed to persist order status update:", e);
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
      return { cartItems: [...state.cartItems, newItem] };
    });
  },

  removeFromCart: (itemId) => {
    set(state => ({
      cartItems: state.cartItems.filter(item => item.id !== itemId)
    }));
  },

  updateCartItemDates: (itemId, startDate, endDate) => {
    set(state => ({
      cartItems: state.cartItems.map(item => 
        item.id === itemId ? { ...item, startDate, endDate } : item
      )
    }));
  },

  clearCart: () => set({ cartItems: [] }),

  clearError: () => set({ error: null }),

  updateCampaignRules: (rules) => {
    try {
      localStorage.setItem("hwh_campaign_rules", JSON.stringify(rules));
    } catch (e) {
      console.warn("Failed to save campaign rules to localStorage");
    }
    set({ campaignRules: rules });
  }
}));

