/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = "huurgo-cache-v5";
const OFFLINE_URL = "/offline.html";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/placeholder-machine.webp"
];

// Install: pre-cache offline fallback and shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate strategy for static resources, network-first for API requests
self.addEventListener("fetch", (event) => {
  // Only handle HTTP/HTTPS requests (avoid chrome-extension:// etc)
  if (!event.request.url.startsWith("http")) return;

  const url = new URL(event.request.url);

  // For API endpoints, we always prioritize network
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Offline API behavior can return custom JSON or offline mock data if needed
          return new Response(JSON.stringify({ error: "Offline mode. Systeemverbinding onderbroken." }), {
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  // For page navigations (HTML): network-first, so a new deploy shows up
  // immediately. Fall back to the cached shell only when offline. Avoids the
  // "stale screen for one extra reload" problem of stale-while-revalidate.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // For hashed assets and images: Stale-While-Revalidate (filenames change per
  // build, so serving cached-first here is safe and fast).
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Navigation requests never reach this branch (handled and returned
          // above at line ~68-81), so this only ever runs for hashed JS/CSS
          // assets and images. A transient fetch failure here (flaky network,
          // or the browser aborting an in-flight lazy-load fetch when the user
          // scrolls fast) used to resolve to `undefined`, which the browser
          // treats as a hard network error for that request — for an <img>
          // this showed as a randomly broken/missing image that only "fixed
          // itself" on a fresh reload once the transient condition had passed.
          // Degrade image requests to the pre-cached placeholder instead so a
          // network hiccup never surfaces as a broken image.
          if (event.request.destination === "image") {
            return caches.match("/placeholder-machine.webp");
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
