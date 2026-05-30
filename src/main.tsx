import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign HMR / WebSocket connection errors in sandboxed environments
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason);
    if (msg.includes("websocket") || msg.includes("WebSocket") || msg.includes("vite")) {
      event.preventDefault();
      event.stopPropagation();
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
