/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats an amount as Dutch euro notation with comma decimal separator,
 * e.g. 150 → "€ 150,00" and 12.5 → "€ 12,50".
 */
export const euro = (amount: number): string =>
  "€ " + amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Compact variant for whole amounts: 150 → "€ 150,-", 12.5 → "€ 12,50".
 * Common Dutch retail style for round prices.
 */
export const euroCompact = (amount: number): string =>
  amount % 1 === 0
    ? `€ ${Math.round(amount).toLocaleString("nl-NL")},-`
    : euro(amount);

export const VAT_RATE = 0.21;

/**
 * Display-only VAT conversion: returns the amount incl. 21% BTW when mode
 * is "incl", otherwise unchanged. Never use for order calculation — the
 * checkout and server always work with excl. amounts.
 */
export const withVat = (amount: number, mode: "excl" | "incl"): number =>
  mode === "incl" ? Math.round(amount * (1 + VAT_RATE) * 100) / 100 : amount;
