/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * De catalogus toont één kaart per model; de losse exemplaren heten
 * "… (Unit 2)" en zijn per definitie identiek. De kalender rekende al op
 * modelniveau — een dag is groen zodra één unit vrij is — maar de boeking bleef
 * hangen aan de unit waar de cataloguskaart toevallig naar wees. Stond die vol
 * en de andere leeg, dan zag de klant een groene, aanklikbare datum en kreeg hij
 * er direct onder "niet beschikbaar" op, terwijl de machine er wél stond. Van de
 * 11 fysieke units waren er zo maar 5 online te boeken.
 *
 * findAvailableUnit geeft nu terug wélke unit de periode kan draaien, zodat de
 * selectie daarheen kan wisselen.
 */
import { describe, it, expect } from "vitest";
import { findAvailableUnit, someUnitAvailable, SimpleOrder } from "../utils/availability";

const TODAY = "2026-08-01";
const units = [
  { id: "nifty-120-1" },
  { id: "nifty-120-2" },
  { id: "nifty-120-3" }
];

const booked = (machineId: string, startDate: string, endDate: string): SimpleOrder => ({
  id: `o-${machineId}-${startDate}`,
  machineId,
  startDate,
  endDate,
  status: "Goedgekeurd"
});

describe("findAvailableUnit", () => {
  it("geeft de eerste unit als alles vrij is", () => {
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", [], [], TODAY)?.id).toBe("nifty-120-1");
  });

  it("wijkt uit naar unit 2 wanneer unit 1 bezet is — dít is de bug", () => {
    const orders = [booked("nifty-120-1", "2026-08-10", "2026-08-12")];
    // De kalender toonde de dag groen (er ís een vrije unit)…
    expect(someUnitAvailable(units, "2026-08-10", "2026-08-12", orders, [], TODAY)).toBe(true);
    // …en dít is de unit waar de boeking heen moet.
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", orders, [], TODAY)?.id).toBe("nifty-120-2");
  });

  it("slaat door naar unit 3 wanneer 1 en 2 bezet zijn", () => {
    const orders = [
      booked("nifty-120-1", "2026-08-10", "2026-08-12"),
      booked("nifty-120-2", "2026-08-11", "2026-08-15")
    ];
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", orders, [], TODAY)?.id).toBe("nifty-120-3");
  });

  it("geeft null wanneer élke unit bezet is", () => {
    const orders = [
      booked("nifty-120-1", "2026-08-10", "2026-08-12"),
      booked("nifty-120-2", "2026-08-10", "2026-08-12"),
      booked("nifty-120-3", "2026-08-10", "2026-08-12")
    ];
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", orders, [], TODAY)).toBeNull();
    expect(someUnitAvailable(units, "2026-08-10", "2026-08-12", orders, [], TODAY)).toBe(false);
  });

  it("een geannuleerde boeking bezet niets", () => {
    const orders: SimpleOrder[] = [
      { ...booked("nifty-120-1", "2026-08-10", "2026-08-12"), status: "Geannuleerd" }
    ];
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", orders, [], TODAY)?.id).toBe("nifty-120-1");
  });

  it("slaat een operationeel geblokkeerde unit over (schade/onderhoud/afgevoerd)", () => {
    const withBlocked = [
      { id: "nifty-120-1", operationallyBlocked: true },
      { id: "nifty-120-2" }
    ];
    expect(findAvailableUnit(withBlocked, "2026-08-10", "2026-08-12", [], [], TODAY)?.id).toBe("nifty-120-2");
  });

  it("respecteert een geblokkeerde datum per unit", () => {
    const blocked = [{ machineId: "nifty-120-1", date: "2026-08-11" }];
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-12", [], blocked, TODAY)?.id).toBe("nifty-120-2");
  });

  it("houdt rekening met bufferDays, net als de kalender en de server", () => {
    // Unit 1 komt 9 aug terug; met 1 buffer-dag is 10 aug nog bezet.
    const orders = [booked("nifty-120-1", "2026-08-05", "2026-08-09")];
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-10", orders, [], TODAY, 1)?.id).toBe("nifty-120-2");
    expect(findAvailableUnit(units, "2026-08-10", "2026-08-10", orders, [], TODAY, 0)?.id).toBe("nifty-120-1");
  });

  it("een model met één unit gedraagt zich onveranderd", () => {
    const single = [{ id: "dingli-6m" }];
    expect(findAvailableUnit(single, "2026-08-10", "2026-08-12", [], [], TODAY)?.id).toBe("dingli-6m");
    const orders = [booked("dingli-6m", "2026-08-10", "2026-08-12")];
    expect(findAvailableUnit(single, "2026-08-10", "2026-08-12", orders, [], TODAY)).toBeNull();
  });

  it("stockQuantity > 1 laat meerdere gelijktijdige boekingen op dezelfde unit toe", () => {
    const pooled = [{ id: "pool", stockQuantity: 2 }];
    const one = [booked("pool", "2026-08-10", "2026-08-12")];
    expect(findAvailableUnit(pooled, "2026-08-10", "2026-08-12", one, [], TODAY)?.id).toBe("pool");
    const two = [...one, booked("pool", "2026-08-10", "2026-08-12")];
    expect(findAvailableUnit(pooled, "2026-08-10", "2026-08-12", two, [], TODAY)).toBeNull();
  });
});
