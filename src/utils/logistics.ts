/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared "today's departures/returns" grouping — used by AdminPlanning's day
// panels and AdminDashboard's KPI tile so the two never drift on which
// statuses count as active logistics.
export interface LogisticsOrder {
  status: string;
  startDate: string;
  endDate: string;
}

const ACTIVE_LOGISTICS_STATUSES = ["In behandeling", "Goedgekeurd", "Onderweg"];

export function getTodaysLogistics<T extends LogisticsOrder>(orders: T[], todayStr: string): { departing: T[]; returning: T[] } {
  const active = orders.filter((o) => ACTIVE_LOGISTICS_STATUSES.includes(o.status));
  return {
    departing: active.filter((o) => o.startDate === todayStr),
    returning: active.filter((o) => o.endDate === todayStr)
  };
}
