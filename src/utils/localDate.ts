/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Calendar-day helpers pinned to the business timezone (Europe/Amsterdam),
// NOT the viewer's browser timezone. The depot, deliveries and the 07:00
// reminder cron all run on NL time, so an admin opening the panel from
// abroad (e.g. Turkey, UTC+3) must still see NL's "today".
//
// Never use `new Date().toISOString().split("T")[0]` for "today" in the
// admin: that is the UTC day — still yesterday in NL between 00:00 and
// 01:00/02:00.
export const BUSINESS_TZ = "Europe/Amsterdam";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ymdParts(at: Date): { y: number; m: number; d: number } {
  const parts = ymdFormatter.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function keyFromUtc(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" of the NL calendar day that the instant `at` falls on.
export function localDateStr(at: Date = new Date()): string {
  const { y, m, d } = ymdParts(at);
  return keyFromUtc(new Date(Date.UTC(y, m - 1, d)));
}

// NL "today" shifted by n calendar days (n may be negative).
export function localDateStrOffset(n: number, at: Date = new Date()): string {
  const { y, m, d } = ymdParts(at);
  return keyFromUtc(new Date(Date.UTC(y, m - 1, d + n)));
}

// Day of week of NL "today": 0 = Sunday … 6 = Saturday.
export function localDayOfWeek(at: Date = new Date()): number {
  const { y, m, d } = ymdParts(at);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// A browser-local Date at midnight whose Y/M/D is NL's "today". For UI code
// that walks days with setDate()/getDay()/toLocaleDateString() — those then
// operate on the NL calendar day regardless of the viewer's timezone.
export function localTodayAsDate(at: Date = new Date()): Date {
  const { y, m, d } = ymdParts(at);
  return new Date(y, m - 1, d);
}

// First and last day of the previous NL calendar month. Built from
// (year, month, day) directly — `setMonth(m - 1)` on the 29th–31st rolls
// over into the current month (e.g. 31 Oct → "31 Sep" → 1 Oct).
export function previousMonthRange(at: Date = new Date()): { from: string; to: string } {
  const { y, m } = ymdParts(at);
  return {
    from: keyFromUtc(new Date(Date.UTC(y, m - 2, 1))),
    to: keyFromUtc(new Date(Date.UTC(y, m - 1, 0))),
  };
}
