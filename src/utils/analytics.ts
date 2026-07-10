/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Microsoft Clarity loader, decoupled from cookie consent. Only injects when a
// project ID is configured (VITE_CLARITY_ID) and is idempotent — safe to call
// on every load and again right after the visitor accepts cookies.
// NOTE (KVKK/GDPR): this must only run after explicit consent — see CookieBanner.

let loaded = false;

export function loadClarity(): void {
  if (loaded || typeof window === "undefined") return;
  const id = import.meta.env.VITE_CLARITY_ID;
  if (!id) return;
  loaded = true;
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

// Google Analytics 4 (gtag.js) — same consent-gated, idempotent pattern as
// Clarity above. No-op unless VITE_GA_MEASUREMENT_ID is configured.
// NOTE (KVKK/GDPR): this must only run after explicit consent — see CookieBanner.
let gaLoaded = false;

export function loadGoogleAnalytics(): void {
  if (gaLoaded || typeof window === "undefined") return;
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!id) return;
  gaLoaded = true;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) { w.dataLayer.push(args); };
  w.gtag("js", new Date());
  w.gtag("config", id);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
}
