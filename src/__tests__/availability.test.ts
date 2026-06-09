/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { checkAvailability } from "../utils/availability";

describe("checkAvailability", () => {
  const mockOrders = [
    {
      id: "HWH-1234",
      machineId: "lift-1",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
    },
    {
      id: "HWH-5678",
      machineId: "lift-1",
      startDate: new Date("2026-06-20"),
      endDate: new Date("2026-06-25"),
    }
  ];

  const mockBlockedDates = [
    {
      machineId: "lift-1",
      date: "2026-06-08",
      reason: "Onderhoud",
    },
    {
      machineId: "lift-1",
      date: new Date("2026-06-09"),
      reason: "Inspectie",
    }
  ];

  it("should return available when dates are clear", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-16",
      "2026-06-19",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(true);
    expect(result.overlap).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("should fail when end date is before start date", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-16",
      "2026-06-15",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(false);
    expect(result.reason).toBe("De retourdatum moet na de begindatum liggen.");
  });

  it("should fail when start date is in the past", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-04",
      "2026-06-06",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(false);
    expect(result.reason).toBe("De begindatum kan niet in het verleden liggen.");
  });

  it("should detect order overlap when request fully overlaps an order", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-11",
      "2026-06-14",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(false);
    expect(result.overlap).toBe(true);
    expect(result.reason).toContain("Niet beschikbaar");
  });

  it("should detect order overlap when request starts inside an order", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-14",
      "2026-06-18",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(false);
    expect(result.overlap).toBe(true);
  });

  it("should detect blocked dates", () => {
    const result = checkAvailability(
      "lift-1",
      "2026-06-07",
      "2026-06-09",
      mockOrders,
      mockBlockedDates,
      "2026-06-05"
    );
    expect(result.available).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("Onderhoud");
  });
});
