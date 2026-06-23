/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";

/**
 * Canonical production domain. Matches the static tags in index.html.
 */
export const SEO_BASE_URL = "https://huurgo.nl";

export interface SeoOptions {
  /** Full <title> text. */
  title: string;
  /** Meta description (≤ ~160 chars ideal). */
  description?: string;
  /** Canonical path, e.g. "/hoogwerker-huren/leiden". Defaults to "/". */
  path?: string;
  /** Optional JSON-LD structured data object (injected + removed on unmount). */
  jsonLd?: Record<string, unknown>;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Client-side SEO for a SPA route: sets title, description, canonical and
 * Open Graph / Twitter tags, and optionally injects JSON-LD structured data.
 * Googlebot renders JS, so these dynamic tags are indexed. The JSON-LD script
 * is removed on unmount so structured data never leaks to the next route.
 */
export function useSeo({ title, description, path = "/", jsonLd }: SeoOptions) {
  // Serialise jsonLd for a stable effect dependency.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const url = `${SEO_BASE_URL}${path}`;
    document.title = title;
    if (description) upsertMeta("name", "description", description);
    upsertCanonical(url);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "twitter:title", title);
    upsertMeta("property", "twitter:url", url);
    if (description) {
      upsertMeta("property", "og:description", description);
      upsertMeta("property", "twitter:description", description);
    }

    let script: HTMLScriptElement | null = null;
    if (jsonLdKey) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = jsonLdKey;
      document.head.appendChild(script);
    }

    return () => {
      script?.remove();
    };
  }, [title, description, path, jsonLdKey]);
}
