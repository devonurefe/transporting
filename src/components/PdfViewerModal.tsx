/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { X, Download, ZoomIn, ZoomOut, ExternalLink, FileWarning } from "lucide-react";
import { motion } from "motion/react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Vite emits the worker as a hashed asset under /assets, so it loads same-origin
// and satisfies the CSP without needing an external CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfViewerModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Renders one PDF page onto its own canvas at the requested CSS width.
function PdfPage({ doc, pageNumber, cssWidth }: { doc: PDFDocumentProxy; pageNumber: number; cssWidth: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (cssWidth <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: cssWidth / unscaled.width });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cap the pixel ratio at 2: on a 3x phone screen a full-size datasheet page
      // can exceed mobile Safari's per-canvas memory ceiling, which makes it draw
      // nothing at all rather than erroring.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const renderTask = page.render({
        canvas,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      task = renderTask;
      await renderTask.promise;
    })().catch(() => {
      /* A cancelled render rejects by design — nothing to surface here. */
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, cssWidth]);

  return <canvas ref={canvasRef} className="block mx-auto bg-white shadow-sm rounded-sm" />;
}

/**
 * Full-screen PDF viewer for machine datasheets.
 *
 * Draws the document page by page onto canvases via pdf.js instead of handing the
 * URL to an <iframe>. iOS Safari very often renders an embedded PDF as a blank
 * white box — the file downloads fine, it just never paints — so the iframe
 * approach looked broken on exactly the devices most customers use. Canvas
 * rendering behaves identically everywhere and also sidesteps the frame-src /
 * X-Frame-Options gates entirely.
 */
export default function PdfViewerModal({ url, title = "Technische fiche", onClose }: PdfViewerModalProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track the available width so pages render to fit, and re-fit on rotation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.max(0, el.clientWidth - 24));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDoc(null);

    const task = pdfjsLib.getDocument({ url });
    task.promise
      .then((pdf) => {
        if (cancelled) return;
        setDoc(pdf);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      // Tears down the document and its worker — PDFDocumentProxy has no
      // destroy() of its own, teardown goes through the loading task.
      task.destroy();
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Stop the parent detail modal from closing at the same time.
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const pageWidth = baseWidth * zoom;

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
        className="flex-1 flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl mx-auto w-full max-w-3xl min-h-0"
      >
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-slate-200 shrink-0">
          <p className="font-display font-bold text-xs sm:text-sm text-slate-900 truncate">{title}</p>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.5) * 10) / 10))}
              disabled={zoom <= MIN_ZOOM || status !== "ready"}
              aria-label="Uitzoomen"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.5) * 10) / 10))}
              disabled={zoom >= MAX_ZOOM || status !== "ready"}
              aria-label="Inzoomen"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
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

        <div ref={scrollRef} className="flex-1 overflow-auto overscroll-contain bg-slate-100 p-3">
          {status === "loading" && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <span className="h-7 w-7 rounded-full border-2 border-slate-300 border-t-teal-600 animate-spin" />
              <p className="text-xs font-semibold">Technische fiche laden…</p>
            </div>
          )}

          {status === "error" && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <FileWarning className="h-8 w-8 text-amber-500" />
              <p className="text-xs text-slate-600 max-w-xs">
                De technische fiche kon hier niet worden weergegeven. Open het bestand in een nieuw tabblad.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Openen in nieuw tabblad
              </a>
            </div>
          )}

          {status === "ready" && doc && pageWidth > 0 && (
            <div className="space-y-3 w-fit mx-auto">
              {Array.from({ length: doc.numPages }, (_, i) => (
                <PdfPage key={i} doc={doc} pageNumber={i + 1} cssWidth={pageWidth} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
