/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Browsers phrase a failed dynamic import() (stale index.html referencing a JS
// chunk hash that no longer exists after a new deploy) differently:
// Chrome: "Failed to fetch dynamically imported module: ..."
// Firefox: "error loading dynamically imported module"
// Safari: "Importing a module script failed."
// Webpack-era bundlers: "Loading chunk N failed" / ChunkLoadError
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /not a valid JavaScript MIME type/i,
  /Loading chunk \d+ failed/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return name === "ChunkLoadError" || CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export const CHUNK_RELOAD_STORAGE_KEY = "chunk_reload";

/** Reloads the page once per session to pick up the new deploy. Returns false if already tried. */
export function tryAutoReloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)) return false;
  window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, "1");
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
}
