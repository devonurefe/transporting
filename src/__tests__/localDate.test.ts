import { describe, it, expect } from "vitest";
import { localDateStr, localDateStrOffset, localDayOfWeek, localTodayAsDate, previousMonthRange } from "../utils/localDate";

// All inputs are explicit UTC instants so the tests don't depend on the
// machine's timezone — the helpers must always answer in Europe/Amsterdam.
const utc = (iso: string) => new Date(iso);

describe("localDate (Europe/Amsterdam)", () => {
  it("uses the NL day, not the UTC day, just after NL midnight", () => {
    // 22:30 UTC on 1 Oct = 00:30 CEST on 2 Oct
    expect(localDateStr(utc("2026-10-01T22:30:00Z"))).toBe("2026-10-02");
    // 23:30 UTC on 5 Jan = 00:30 CET on 6 Jan
    expect(localDateStr(utc("2026-01-05T23:30:00Z"))).toBe("2026-01-06");
  });

  it("uses the NL day, not the viewer's (e.g. Istanbul) day", () => {
    // 21:30 UTC = 00:30 in Istanbul (next day) but still 23:30 in NL
    expect(localDateStr(utc("2026-10-01T21:30:00Z"))).toBe("2026-10-01");
  });

  it("offsets across month and year boundaries", () => {
    expect(localDateStrOffset(1, utc("2026-10-31T12:00:00Z"))).toBe("2026-11-01");
    expect(localDateStrOffset(-1, utc("2027-01-01T12:00:00Z"))).toBe("2026-12-31");
  });

  it("day of week follows the NL day", () => {
    // Sun 4 Oct 2026, 22:30 UTC = Mon 5 Oct 00:30 CEST
    expect(localDayOfWeek(utc("2026-10-04T22:30:00Z"))).toBe(1);
  });

  it("localTodayAsDate carries the NL Y/M/D", () => {
    const d = localTodayAsDate(utc("2026-10-01T22:30:00Z"));
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 2]);
  });

  it("previous month never rolls into the current month on the 31st", () => {
    expect(previousMonthRange(utc("2026-10-31T12:00:00Z"))).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(previousMonthRange(utc("2026-03-31T12:00:00Z"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousMonthRange(utc("2027-01-15T12:00:00Z"))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});
