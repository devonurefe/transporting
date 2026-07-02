/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

// Lichtgewicht toast-systeem voor het adminpaneel — vervangt native alert(),
// dat de UI blokkeert en niet bij de huisstijl past. Aanroepbaar vanuit elke
// module via showAdminToast(); AdminToastHost wordt één keer gemount in
// AdminSection.

type ToastType = "success" | "error" | "info";

interface AdminToast {
  id: number;
  type: ToastType;
  message: string;
}

interface AdminToastState {
  toasts: AdminToast[];
  push: (message: string, type: ToastType) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 4500;
let nextId = 1;

const useAdminToastStore = create<AdminToastState>((set) => ({
  toasts: [],
  push: (message, type) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type, message }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function showAdminToast(message: string, type: ToastType = "info"): void {
  useAdminToastStore.getState().push(message, type);
}

const STYLE: Record<ToastType, { wrap: string; icon: string }> = {
  success: { wrap: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-600" },
  error: { wrap: "border-rose-200 bg-rose-50 text-rose-900", icon: "text-rose-600" },
  info: { wrap: "border-slate-200 bg-white text-slate-800", icon: "text-slate-500" },
};

const ICON: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function AdminToastHost() {
  const toasts = useAdminToastStore((s) => s.toasts);
  const dismiss = useAdminToastStore((s) => s.dismiss);
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICON[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border shadow-lg px-3.5 py-3 ${STYLE[t.type].wrap}`}
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${STYLE[t.type].icon}`} />
              <p className="text-xs font-semibold leading-snug flex-1 break-words">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Sluiten"
                className="shrink-0 text-current/50 hover:text-current transition-colors cursor-pointer bg-transparent border-none p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
