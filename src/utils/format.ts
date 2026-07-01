/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats an amount as Dutch euro notation with comma decimal separator,
 * e.g. 150 → "€150,00" and 12.5 → "€12,50". The € sign is joined to the
 * number (no space) for a consistent look across the whole app.
 */
export const euro = (amount: number): string =>
  "€" + amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Compact variant for whole amounts: 150 → "€150,-", 12.5 → "€12,50".
 * Common Dutch retail style for round prices.
 */
export const euroCompact = (amount: number): string =>
  amount % 1 === 0
    ? `€${Math.round(amount).toLocaleString("nl-NL")},-`
    : euro(amount);

/**
 * Price number without currency symbol: whole amounts show no decimals
 * (60 → "60"), fractional amounts show two (60.5 → "60,50"). Shared by the
 * catalog and detail views so the formatting logic lives in one place.
 */
export const priceNum = (p: number): string =>
  p % 1 === 0
    ? Math.round(p).toLocaleString("nl-NL")
    : p.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formats an ISO/YYYY-MM-DD date string as a readable Dutch date, e.g.
 * "2026-07-15" → "15 jul 2026". Falls back to the raw input if it isn't
 * a parseable date, so callers never render "Invalid Date".
 */
export const formatDateNL = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
};

export const VAT_RATE = 0.21;

/**
 * Display-only VAT conversion: returns the amount incl. 21% BTW when mode
 * is "incl", otherwise unchanged. Never use for order calculation — the
 * checkout and server always work with excl. amounts.
 */
export const withVat = (amount: number, mode: "excl" | "incl"): number =>
  mode === "incl" ? Math.round(amount * (1 + VAT_RATE) * 100) / 100 : amount;
