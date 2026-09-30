/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// "YYYY-MM-DD" for the viewer's LOCAL calendar day. Never use
// `new Date().toISOString().split("T")[0]` for "today" in the admin: that is
// the UTC day, which in NL (UTC+1/+2) is still yesterday between 00:00 and
// 01:00/02:00 — today/tomorrow/overdue filters then point at the wrong day.
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Local "today" shifted by n days (n may be negative).
export function localDateStrOffset(n: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
  return localDateStr(d);
}

// First and last day of the previous calendar month, local. Built from
// (year, month, day) directly — `setMonth(m - 1)` on the 29th–31st rolls
// over into the current month (e.g. 31 Oct → "31 Sep" → 1 Oct).
export function previousMonthRange(from: Date = new Date()): { from: string; to: string } {
  const first = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  const last = new Date(from.getFullYear(), from.getMonth(), 0);
  return { from: localDateStr(first), to: localDateStr(last) };
}
