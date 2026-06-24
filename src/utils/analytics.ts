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
