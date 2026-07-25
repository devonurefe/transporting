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
  bufferDays: number = 0,
  stockQuantity: number = 1,
  operationallyBlocked: boolean = false
) {
  if (!start || !end) return { available: false, blocked: false, overlap: false, reason: "Selecteer een begin- en einddatum." };

  // Retired, damaged, or under open maintenance — blocks every date, regardless
  // of order overlap/stock. See server/utils/machineStatus.ts (server mirror).
  // Reason deliberately says nothing about damage/maintenance — reads exactly
  // like an ordinary fully-booked machine to the customer; staff see the real
  // reason in the admin Bakım ve Hasar panel.
  if (operationallyBlocked) {
    return { available: false, blocked: true, overlap: false, reason: "Niet beschikbaar voor deze periode." };
  }

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

  // Capacity check against active orders (skip cancelled). bufferDays extends each
  // order's end date to block maintenance/charging time. Machines with stock > 1
  // can have multiple orders active on the same day — only reject once the number
  // of orders covering a given day reaches stockQuantity (a flat "any overlap"
  // count would be wrong: two non-cancelled orders can each touch the requested
  // range without ever being concurrently active on the same day).
  const bufferMs = bufferDays * 86_400_000;
  const candidateOrders = orders.filter(o => {
    if (o.machineId !== machineId) return false;
    if (o.status === "Geannuleerd") return false;
    const orderStart = new Date(o.startDate).getTime();
    const orderEnd = new Date(o.endDate).getTime() + bufferMs;
    return (requestedStart <= orderEnd && requestedEnd >= orderStart);
  });

  if (candidateOrders.length > 0) {
    const sDay = new Date(start);
    const eDay = new Date(end);
    let curr = new Date(sDay);
    let dayCounter = 0;
    while (curr <= eDay && dayCounter < 1000) {
      dayCounter++;
      const dayTime = curr.getTime();
      const concurrent = candidateOrders.filter(o => {
        const orderStart = new Date(o.startDate).getTime();
        const orderEnd = new Date(o.endDate).getTime() + bufferMs;
        return dayTime >= orderStart && dayTime <= orderEnd;
      }).length;
      if (concurrent >= stockQuantity) {
        return { available: false, blocked: false, overlap: true, reason: "Niet beschikbaar — al geboekt voor (een deel van) deze periode. Kies andere datums." };
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
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
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return { available: true, blocked: false, overlap: false, reason: "" };
}

export interface UnitAvailabilityInput {
  id: string;
  stockQuantity?: number; // physical units of this exact row available for overlapping bookings; default 1
  operationallyBlocked?: boolean; // retired / damaged / under open maintenance; default false
}

/**
 * Model-level availability across multiple physical units of the same model.
 * Returns true when AT LEAST ONE unit still has remaining capacity for the
 * entire requested range — a day/period is only "vol" when every unit is at
 * its stock limit or blocked. The customer never sees stock counts; the
 * system simply checks if any unit can take the job.
 */
export function someUnitAvailable(
  units: UnitAvailabilityInput[],
  start: string,
  end: string,
  orders: SimpleOrder[],
  blockedDates: SimpleBlockedDate[],
  todayStr?: string,
  bufferDays: number = 0
): boolean {
  return units.some(
    (u) => checkAvailability(u.id, start, end, orders, blockedDates, todayStr, bufferDays, u.stockQuantity ?? 1, u.operationallyBlocked ?? false).available
  );
}
