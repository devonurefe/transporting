import { describe, it, expect } from "vitest";
import { localDateStr, localDateStrOffset, previousMonthRange } from "../utils/localDate";

describe("localDate", () => {
  it("formats the local calendar day", () => {
    expect(localDateStr(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    expect(localDateStr(new Date(2026, 9, 2, 23, 59))).toBe("2026-10-02");
  });

  it("offsets across month and year boundaries", () => {
    expect(localDateStrOffset(1, new Date(2026, 9, 31, 12))).toBe("2026-11-01");
    expect(localDateStrOffset(-1, new Date(2027, 0, 1, 12))).toBe("2026-12-31");
  });

  it("previous month never rolls into the current month on the 31st", () => {
    expect(previousMonthRange(new Date(2026, 9, 31, 12))).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(previousMonthRange(new Date(2026, 2, 31, 12))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousMonthRange(new Date(2027, 0, 15, 12))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});
