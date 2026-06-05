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
          initial={{ opacity: 0, x: 100, y: 0, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed top-24 right-4 z-50 w-80 p-4 rounded-2xl glass-panel shadow-2xl flex items-start space-x-3 border-l-4 border-l-indigo-500"
        >
          <div className="mt-0.5 shrink-0">
            {toast.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-teal-400" />
            ) : toast.type === "warning" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Info className="h-5 w-5 text-blue-400" />
            )}
          </div>
          
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white leading-none">
              {toast.title}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              {toast.message}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-white transition-colors shrink-0 border-none bg-transparent cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
