/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { checkAvailability, someUnitAvailable } from "../utils/availability";

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

  describe("stockQuantity (multiple physical units on one machine row)", () => {
    // Three orders all covering the same overlapping window on "lift-stock"
    const stockOrders = [
      { id: "A", machineId: "lift-stock", startDate: "2026-07-10", endDate: "2026-07-20" },
      { id: "B", machineId: "lift-stock", startDate: "2026-07-10", endDate: "2026-07-20" },
      { id: "C", machineId: "lift-stock", startDate: "2026-07-10", endDate: "2026-07-20" },
    ];

    it("rejects a 4th overlapping booking once stock=3 is fully booked", () => {
      const result = checkAvailability(
        "lift-stock", "2026-07-12", "2026-07-15",
        stockOrders, [], "2026-07-01", 0, 3
      );
      expect(result.available).toBe(false);
      expect(result.overlap).toBe(true);
    });

    it("allows a booking when only 2 of the 3 stock units are actually busy that day", () => {
      const twoOrders = stockOrders.slice(0, 2);
      const result = checkAvailability(
        "lift-stock", "2026-07-12", "2026-07-15",
        twoOrders, [], "2026-07-01", 0, 3
      );
      expect(result.available).toBe(true);
    });

    it("accepts the 5th concurrent booking at stock=5, rejects the 6th", () => {
      const fourOrders = [0, 1, 2, 3].map(i => ({
        id: `stock5-${i}`, machineId: "lift-5", startDate: "2026-08-01", endDate: "2026-08-10"
      }));
      const withFour = checkAvailability("lift-5", "2026-08-03", "2026-08-05", fourOrders, [], "2026-07-01", 0, 5);
      expect(withFour.available).toBe(true);

      const fiveOrders = [...fourOrders, { id: "stock5-4", machineId: "lift-5", startDate: "2026-08-01", endDate: "2026-08-10" }];
      const withFive = checkAvailability("lift-5", "2026-08-03", "2026-08-05", fiveOrders, [], "2026-07-01", 0, 5);
      expect(withFive.available).toBe(false);
    });

    it("does not falsely exhaust stock from back-to-back (non-concurrent) orders", () => {
      // Order A: days 1-3, Order B: days 4-6 — never active on the same day,
      // so a wide request spanning 1-6 must stay available at stockQuantity=2
      const backToBack = [
        { id: "seq-A", machineId: "lift-seq", startDate: "2026-09-01", endDate: "2026-09-03" },
        { id: "seq-B", machineId: "lift-seq", startDate: "2026-09-04", endDate: "2026-09-06" },
      ];
      const result = checkAvailability("lift-seq", "2026-09-01", "2026-09-06", backToBack, [], "2026-08-01", 0, 2);
      expect(result.available).toBe(true);
    });

    it("defaults to stockQuantity=1 (identical to pre-existing overlap behavior) when omitted", () => {
      const result = checkAvailability(
        "lift-1", "2026-06-11", "2026-06-14",
        mockOrders, mockBlockedDates, "2026-06-05"
      );
      expect(result.available).toBe(false);
      expect(result.overlap).toBe(true);
    });
  });
});

describe("someUnitAvailable", () => {
  it("returns true when at least one sibling unit still has capacity", () => {
    const orders = [
      { id: "1", machineId: "unit-a", startDate: "2026-07-01", endDate: "2026-07-05" },
    ];
    const result = someUnitAvailable(
      [{ id: "unit-a", stockQuantity: 1 }, { id: "unit-b", stockQuantity: 1 }],
      "2026-07-02", "2026-07-03", orders, [], "2026-06-01"
    );
    expect(result).toBe(true);
  });

  it("returns false only once every unit's own stock is exhausted", () => {
    const orders = [
      { id: "1", machineId: "unit-c", startDate: "2026-07-01", endDate: "2026-07-05" },
      { id: "2", machineId: "unit-c", startDate: "2026-07-01", endDate: "2026-07-05" },
    ];
    const stillFree = someUnitAvailable(
      [{ id: "unit-c", stockQuantity: 3 }],
      "2026-07-02", "2026-07-03", orders, [], "2026-06-01"
    );
    expect(stillFree).toBe(true);

    const thirdOrder = [...orders, { id: "3", machineId: "unit-c", startDate: "2026-07-01", endDate: "2026-07-05" }];
    const exhausted = someUnitAvailable(
      [{ id: "unit-c", stockQuantity: 3 }],
      "2026-07-02", "2026-07-03", thirdOrder, [], "2026-06-01"
    );
    expect(exhausted).toBe(false);
  });

  it("defaults each unit's stockQuantity to 1 when not provided", () => {
    const orders = [
      { id: "1", machineId: "unit-d", startDate: "2026-07-01", endDate: "2026-07-05" },
    ];
    const result = someUnitAvailable(
      [{ id: "unit-d" }],
      "2026-07-02", "2026-07-03", orders, [], "2026-06-01"
    );
    expect(result).toBe(false);
  });

  // Regression: DateRangeCalendar.tsx called someUnitAvailable() without a
  // bufferDays argument (silently defaulting to 0), so a machine's own booking
  // calendar coloured the day right after an existing order as "available",
  // while BookingSection.tsx's checkAvailability (which does pass
  // machine.bufferDays) then rejected that exact same day as booked at
  // submit time — calendar shows green, booking says "Niet beschikbaar".
  it("with bufferDays omitted (defaults to 0), the day right after a booking reads available", () => {
    const orders = [{ id: "1", machineId: "unit-buf", startDate: "2026-07-20", endDate: "2026-07-22" }];
    const dayAfter = someUnitAvailable([{ id: "unit-buf" }], "2026-07-23", "2026-07-23", orders, [], "2026-06-01");
    expect(dayAfter).toBe(true);
  });

  it("with the machine's real bufferDays passed, that same day is correctly blocked", () => {
    const orders = [{ id: "1", machineId: "unit-buf", startDate: "2026-07-20", endDate: "2026-07-22" }];
    const dayAfter = someUnitAvailable([{ id: "unit-buf" }], "2026-07-23", "2026-07-23", orders, [], "2026-06-01", 1);
    expect(dayAfter).toBe(false);
  });

  it("a 5-day range starting the buffer day is rejected — the calendar/booking-step mismatch from the bug report", () => {
    // Mirrors the reported case: a booking ends 2026-07-22, machine has a 1-day
    // maintenance buffer, customer picks 2026-07-23 – 2026-07-27 (5 days).
    const orders = [{ id: "1", machineId: "bravi-leonardo", startDate: "2026-07-20", endDate: "2026-07-22" }];
    const withoutBuffer = someUnitAvailable([{ id: "bravi-leonardo" }], "2026-07-23", "2026-07-27", orders, [], "2026-06-01");
    expect(withoutBuffer).toBe(true); // what the calendar wrongly showed before the fix

    const withBuffer = someUnitAvailable([{ id: "bravi-leonardo" }], "2026-07-23", "2026-07-27", orders, [], "2026-06-01", 1);
    expect(withBuffer).toBe(false); // what checkAvailability correctly rejects at submit time
  });
});
