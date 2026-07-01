/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

// Generic styled replacement for window.confirm() in the admin panel — mirrors
// the overlay/card pattern already used by AdminMachines' delete-machine modal.
export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = true,
}: AdminConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${danger ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">{message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`text-xs font-bold text-white px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none ${
                  danger ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-800 hover:bg-slate-900"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
