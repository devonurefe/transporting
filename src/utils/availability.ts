/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimpleOrder {
  id: string;
  machineId: string;
  startDate: string | Date;
  endDate: string | Date;
  status?: string;
}

export interface SimpleBlockedDate {
  machineId: string;
  date: string | Date;
  reason?: string;
}

/**
 * Checks if a machine is available for booking during the requested dates.
 * Matches client-side validation logic.
 */
export function checkAvailability(
  machineId: string,
  start: string,
  end: string,
  orders: SimpleOrder[],
  blockedDates: SimpleBlockedDate[],
  todayStr?: string,
  bufferDays: number = 0
) {
  if (!start || !end) return { available: false, blocked: false, overlap: false, reason: "Selecteer een begin- en einddatum." };

  const requestedStart = new Date(start).getTime();
  const requestedEnd = new Date(end).getTime();
  
  const resolvedTodayStr = todayStr || new Date().toISOString().split('T')[0];
  const todayTime = new Date(resolvedTodayStr).getTime();

  if (requestedStart > requestedEnd) {
    return { available: false, blocked: false, overlap: false, reason: "De retourdatum moet na de begindatum liggen." };
  }

  if (requestedStart < todayTime) {
    return { available: false, blocked: false, overlap: false, reason: "De begindatum kan niet in het verleden liggen." };
  }

  // Check overlaps with active orders (skip cancelled)
  // bufferDays extends the order's end date to block maintenance/charging time
  const bufferMs = bufferDays * 86_400_000;
  const overlaps = orders.filter(o => {
    if (o.machineId !== machineId) return false;
    if (o.status === "Geannuleerd") return false;
    const orderStart = new Date(o.startDate).getTime();
    const orderEnd = new Date(o.endDate).getTime() + bufferMs;
    return (requestedStart <= orderEnd && requestedEnd >= orderStart);
  });

  if (overlaps.length > 0) {
    return { available: false, blocked: false, overlap: true, reason: "Niet beschikbaar — al geboekt voor (een deel van) deze periode. Kies andere datums." };
  }

  // Build a Set for O(1) blocked-date lookups (avoids O(n²) find() inside loop)
  const machineBlockedDates = blockedDates.filter(b => b.machineId === machineId);
  const blockedDateReasonMap = new Map<string, string>();
  for (const b of machineBlockedDates) {
    const key = typeof b.date === "string" ? b.date.split("T")[0] : b.date.toISOString().split("T")[0];
    blockedDateReasonMap.set(key, b.reason || "Planning gesloten door beheerder");
  }

  const sDate = new Date(start);
  const eDate = new Date(end);
  let curr = new Date(sDate);
  let safetyCounter = 0;
  while (curr <= eDate && safetyCounter < 1000) {
    safetyCounter++;
    const currStr = curr.toISOString().split("T")[0];
    const reason = blockedDateReasonMap.get(currStr);
    if (reason !== undefined) {
      return { available: false, blocked: true, overlap: false, reason };
    }
    curr.setDate(curr.getDate() + 1);
  }

  return { available: true, blocked: false, overlap: false, reason: "" };
}

/**
 * Model-level availability across multiple physical units of the same model.
 * Returns true when AT LEAST ONE unit is free for the entire requested range —
 * a day/period is only "vol" when every unit is booked or blocked. The customer
 * never sees stock counts; the system simply checks if any unit can take the job.
 */
export function someUnitAvailable(
  unitIds: string[],
  start: string,
  end: string,
  orders: SimpleOrder[],
  blockedDates: SimpleBlockedDate[],
  todayStr?: string,
  bufferDays: number = 0
): boolean {
  return unitIds.some(
    (id) => checkAvailability(id, start, end, orders, blockedDates, todayStr, bufferDays).available
  );
}
