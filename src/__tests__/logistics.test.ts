import { describe, it, expect } from "vitest";
import { getTodaysLogistics, splitByTransport, transportSide } from "../utils/logistics";

const o = (id: string, deliveryType: string, startDate: string, endDate: string, status = "Goedgekeurd") =>
  ({ id, deliveryType, startDate, endDate, status });

describe("transportSide", () => {
  it("only delivery_by_us is our own transport", () => {
    expect(transportSide({ deliveryType: "delivery_by_us" })).toBe("ours");
    expect(transportSide({ deliveryType: "self_pickup" })).toBe("customer");
    expect(transportSide({ deliveryType: "trailer_rental" })).toBe("customer");
    expect(transportSide({ deliveryType: undefined })).toBe("customer");
  });
});

describe("splitByTransport", () => {
  it("splits a day's departures into our trips and customer pickups", () => {
    const orders = [
      o("A", "delivery_by_us", "2026-10-01", "2026-10-03"),
      o("B", "self_pickup", "2026-10-01", "2026-10-02"),
      o("C", "trailer_rental", "2026-10-01", "2026-10-05"),
      o("D", "delivery_by_us", "2026-09-28", "2026-10-01"),
      o("E", "delivery_by_us", "2026-10-01", "2026-10-02", "Geannuleerd"),
    ];
    const { departing, returning } = getTodaysLogistics(orders, "2026-10-01");
    const dep = splitByTransport(departing);
    expect(dep.ours.map((x) => x.id)).toEqual(["A"]);
    expect(dep.customer.map((x) => x.id)).toEqual(["B", "C"]);
    const ret = splitByTransport(returning);
    expect(ret.ours.map((x) => x.id)).toEqual(["D"]);
    expect(ret.customer).toEqual([]);
  });
});
