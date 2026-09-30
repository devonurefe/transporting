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

// Who physically moves the machine. Only "delivery_by_us" puts our own
// driver on the road (deliver on startDate, collect on endDate). Self-pickup
// and trailer rental both mean the customer comes to the depot and handles
// transport themselves — for a trailer we only have to have it ready.
export type TransportSide = "ours" | "customer";

export function transportSide(o: { deliveryType?: string | null }): TransportSide {
  return o.deliveryType === "delivery_by_us" ? "ours" : "customer";
}

export function splitByTransport<T extends { deliveryType?: string | null }>(orders: T[]): { ours: T[]; customer: T[] } {
  const ours: T[] = [];
  const customer: T[] = [];
  for (const o of orders) (transportSide(o) === "ours" ? ours : customer).push(o);
  return { ours, customer };
}
