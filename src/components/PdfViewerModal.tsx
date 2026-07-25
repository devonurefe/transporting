/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, Download } from "lucide-react";
import { motion } from "motion/react";

export interface PdfViewerModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

// Reusable full-screen PDF viewer, used both by the admin (previewing an
// uploaded datasheet before saving, via a data: URL) and by the customer-facing
// MachineDetailModal (via the /machine-datasheet/:id proxy URL). Renders through
// an <iframe> so the browser's native PDF viewer handles scrolling/zoom/paging —
// no extra flip-book dependency needed.
export default function PdfViewerModal({ url, title = "Technische fiche", onClose }: PdfViewerModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl mx-auto w-full max-w-3xl"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
          <p className="font-display font-bold text-sm text-slate-900 truncate">{title}</p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              download
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Downloaden"
              aria-label="PDF downloaden"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Sluiten"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe src={url} title={title} className="flex-1 w-full bg-slate-100" />
      </motion.div>
    </div>
  );
}
