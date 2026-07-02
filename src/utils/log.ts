/**
 * Dev-only console helpers — stil in productiebuilds.
 * Gebruik console.error rechtstreeks voor echte fouten die ook in
 * productie zichtbaar moeten blijven.
 */
export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) console.warn(...args);
}
