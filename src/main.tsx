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
