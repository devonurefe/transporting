import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profile?: string;
  companyName?: string;
  address?: string;
  avatarUrl?: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  isUnverified: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { email: string; password?: string; name: string; phone?: string; profile?: string }) => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
  updateProfile: (data: { name: string; phone?: string; profile?: string; companyName?: string; address?: string; avatarUrl?: string }) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("hwh_token"),
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  error: null,
  isUnverified: false,

  clearError: () => set({ error: null, isUnverified: false }),

  logout: () => {
    localStorage.removeItem("hwh_token");
    localStorage.removeItem("hwh_admin_mode");
    set({ token: null, user: null, isAuthenticated: false, isAdmin: false, isUnverified: false });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null, isUnverified: false });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.unverified) {
          set({ isUnverified: true, error: data.error, isLoading: false });
        } else {
          set({ error: data.error || "Inloggen mislukt", isLoading: false });
        }
        return false;
      }

      localStorage.setItem("hwh_token", data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAdmin: data.user.role === "admin",
        isLoading: false,
        isUnverified: false
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null, isUnverified: false });
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registratie mislukt");
      }

      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  resendVerification: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kan verificatiemail niet verzenden.");
      }

      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isAuthenticated: false, user: null, isAdmin: false });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Sessie verlopen");
      }

      const data = await res.json();
      set({
        user: data.user,
        isAuthenticated: true,
        isAdmin: data.user.role === "admin",
        isLoading: false
      });
    } catch (err) {
      localStorage.removeItem("hwh_token");
      set({ token: null, user: null, isAuthenticated: false, isAdmin: false, isLoading: false });
    }
  },

  updateProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    try {
      const token = get().token;
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(profileData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Profiel bijwerken mislukt");
      }

      set({
        user: data.user,
        isLoading: false
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  }
}));
