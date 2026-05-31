import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profile?: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { email: string; password?: string; name: string; phone?: string; profile?: string }) => Promise<boolean>;
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

  clearError: () => set({ error: null }),

  logout: () => {
    localStorage.removeItem("hwh_token");
    localStorage.removeItem("hwh_admin_mode");
    set({ token: null, user: null, isAuthenticated: false, isAdmin: false });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Inloggen mislukt");
      }

      localStorage.setItem("hwh_token", data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAdmin: data.user.role === "admin",
        isLoading: false
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null });
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

      localStorage.setItem("hwh_token", data.token);
      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true,
        isAdmin: false,
        isLoading: false
      });
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
  }
}));
