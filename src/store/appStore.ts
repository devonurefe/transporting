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

  campaignRules: CampaignRule[];
  updateCampaignRules: (rules: CampaignRule[]) => void;
}

const defaultCategories: Category[] = [
  { id: "schaarlift", label: "Schaarlift", listLabel: "Schaarliften", desc: "Ideaal voor loodsen, schilder- en rechtlijnig montagewerk.", heights: "8m - 14m", price: "v.a. €120/dag" },
  { id: "knikarm", label: "Knikarmhoogwerker", listLabel: "Knikarmhoogwerkers", desc: "Uiterst flexibel om over vaste obstakels heen te reiken.", heights: "12m - 20m", price: "v.a. €210/dag" },
  { id: "telescoop", label: "Telescoophoogwerker", listLabel: "Telescoophoogwerkers", desc: "Gigantisch bereik op ruw bouwterrein.", heights: "16m - 40m", price: "v.a. €340/dag" },
  { id: "auto", label: "Autohoogwerker", listLabel: "Autohoogwerkers", desc: "Zelf rijden met B-rijbewijs. Snel op locatie operationeel.", heights: "18m - 24m", price: "v.a. €250/dag" },
  { id: "spin", label: "Spinhoogwerker", listLabel: "Spinhoogwerkers", desc: "Kruipt door binnendeuren en over zachte grasvelden.", heights: "12m - 22m", price: "v.a. €180/dag" },
  { id: "klussensets", label: "Kluspakket", listLabel: "Kluspakketten", desc: "Kant-en-klaar editie voor schilder, zonnepaneel of snoeiwerk.", heights: "10m - 26m", price: "v.a. €110/dag" },
  { id: "aanhanger", label: "Aanhangerhoogwerker", listLabel: "Aanhangerhoogwerkers", desc: "Eenvoudig te transporteren en direct achter de auto te koppelen.", heights: "12m - 17m", price: "v.a. €95/dag" }
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
    siteName: "HoogwerkerHub",
    heroTagline: "Smart Verhuur van Hoogwerkers in Nederland",
    heroTitle: "Uitzonderlijk bereik. Volledig ontzorgd.",
    heroSubtitle: "Van schilderwerk binnen tot zware industriebouw buiten; HoogwerkerHub levert direct de juiste machines op locatie.",
    menuHomeLabel: "Home",
    menuCatalogLabel: "Catalog",
    menuAdvisorLabel: "Adviseur",
    menuOrdersLabel: "Contact",
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
      if (res.ok) set({ machines: await res.json() });
    } catch (e) {
      console.warn("Machines fetch failed, using fallback in appStore.");
    }
  },

  fetchOrders: async () => {
    try {
      const res = await fetch("/api/orders", {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        set({ orders: await res.json() });
      } else if (res.status === 401 || res.status === 403) {
        set({ orders: [] });
      }
    } catch (e) {
      console.warn("Orders fetch failed.");
    }
  },

  fetchCategories: async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) set({ customCategories: await res.json() });
    } catch (e) {
      console.warn("Categories fetch failed.");
    }
  },

  fetchSiteConfig: async () => {
    try {
      const res = await fetch("/api/site-config");
      if (res.ok) set({ siteConfig: await res.json() });
    } catch (e) {
      console.warn("Site config fetch failed.");
    }
  },

  fetchBlockedDates: async () => {
    try {
      const res = await fetch("/api/blocked-dates");
      if (res.ok) set({ blockedDates: await res.json() });
    } catch (e) {
      console.warn("Blocked dates fetch failed.");
    }
  },

  fetchAllData: async () => {
    set({ isLoading: true });
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
      }
    } catch (e) {
      console.error(e);
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
      }
    } catch (e) {
      console.error(e);
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
      }
    } catch (e) {
      console.error(e);
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

  updateCampaignRules: (rules) => {
    try {
      localStorage.setItem("hwh_campaign_rules", JSON.stringify(rules));
    } catch (e) {
      console.warn("Failed to save campaign rules to localStorage");
    }
    set({ campaignRules: rules });
  }
}));

