/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

interface ToastNotificationProps {
  toast: {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning";
  } | null;
  onClose: () => void;
}

export default function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm sm:left-auto sm:right-4 sm:translate-x-0 sm:w-85 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl flex items-start space-x-2.5 sm:space-x-3 border-l-4 border-l-orange-400 z-50"
        >
          <div className="mt-0.5 shrink-0">
            {toast.type === "success" ? (
              <CheckCircle className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-emerald-400" />
            ) : toast.type === "warning" ? (
              <AlertTriangle className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-amber-400" />
            ) : (
              <Info className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-sky-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] sm:text-xs font-bold text-slate-100 leading-none">
              {toast.title}
            </h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 leading-snug break-words">
              {toast.message}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors shrink-0 border-none bg-transparent cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
