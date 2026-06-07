/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimpleOrder {
  id: string;
  machineId: string;
  startDate: string | Date;
  endDate: string | Date;
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
  todayStr?: string
) {
  if (!start || !end) return { available: true, blocked: false, overlap: false, reason: "" };

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

  // Check overlaps with orders
  const overlaps = orders.filter(o => {
    if (o.machineId !== machineId) return false;
    const orderStart = new Date(o.startDate).getTime();
    const orderEnd = new Date(o.endDate).getTime();
    return (requestedStart <= orderEnd && requestedEnd >= orderStart);
  });

  if (overlaps.length > 0) {
    return { available: false, blocked: false, overlap: true, reason: "Niet beschikbaar — al geboekt voor (een deel van) deze periode. Kies andere datums." };
  }

  // Check manual blocked dates
  const sDate = new Date(start);
  const eDate = new Date(end);
  let curr = new Date(sDate);
  let safetyCounter = 0;
  while (curr <= eDate && safetyCounter < 1000) {
    safetyCounter++;
    const currStr = curr.toISOString().split('T')[0];
    const blockedMatch = blockedDates.find(b => {
      const bDateStr = typeof b.date === 'string' ? b.date : b.date.toISOString().split('T')[0];
      return b.machineId === machineId && bDateStr === currStr;
    });
    if (blockedMatch) {
      return { available: false, blocked: true, overlap: false, reason: blockedMatch.reason || "Planning gesloten door beheerder" };
    }
    curr.setDate(curr.getDate() + 1);
  }

  return { available: true, blocked: false, overlap: false, reason: "" };
}
