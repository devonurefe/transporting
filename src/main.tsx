import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign HMR / WebSocket errors; auto-reload on chunk load failures
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason);
    if (msg.includes("websocket") || msg.includes("WebSocket") || msg.includes("vite")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Chunk load failures after a new deploy — just reload once
    if (
      msg.includes("not a valid JavaScript MIME type") ||
      msg.includes("Failed to fetch dynamically imported") ||
      msg.includes("ChunkLoadError") ||
      event?.reason?.name === "ChunkLoadError"
    ) {
      event.preventDefault();
      const reloaded = sessionStorage.getItem("chunk_reload");
      if (!reloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
      }
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event?.message || "";
    if (msg.includes("websocket") || msg.includes("WebSocket") || msg.includes("vite")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Microsoft Clarity (heatmaps / session insights) — only injected when a project
// ID is configured, so dev/CI stay clean and no tracking ships by default.
// NOTE (KVKK/GDPR): EU visitors generally require cookie consent before tracking.
// There is no consent banner yet — enable VITE_CLARITY_ID only once consent is in place.
const CLARITY_ID = (import.meta as any).env?.VITE_CLARITY_ID;
if (typeof window !== "undefined" && CLARITY_ID) {
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);

if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log("Unregistered development service worker");
        });
      }
    });
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).then(() => console.log("Cleared cache:", key));
      });
    });
  }
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => console.log("Service Worker registered:", reg.scope))
      .catch((err) => console.error("Service Worker registration failed:", err));
  });
}
