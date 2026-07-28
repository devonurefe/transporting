import { describe, it, expect } from "vitest";
import { normalizeRentalDate, computeRentalDays } from "../../server/utils/orderPricing";

// Regressie op een echte exploit in POST /api/orders: de route deed
// `new Date(orderData.startDate)` zonder normalisatie, waarna de tijd-van-dag
// doorwerkte in álle beschikbaarheidscontroles. Een verzoek met
// "2026-08-10T23:00:00.000Z" leverde exact dezelfde rentalDays (en dus dezelfde
// prijs, BTW en transportkosten) op als het eerlijke "2026-08-10", maar viel
// buiten de blocked-date-query (`date >= startDate`) en buiten de overlap-
// vergelijking met een bestaande boeking op die dag. Resultaat: boeken op een
// door de beheerder geblokkeerde dag, of dubbel boeken op stockQuantity 1.
describe("normalizeRentalDate", () => {
  const honestStart = new Date("2026-08-10");
  const honestEnd = new Date("2026-08-12");

  it("leaves an honest YYYY-MM-DD payload untouched", () => {
    expect(normalizeRentalDate(honestStart).toISOString()).toBe(honestStart.toISOString());
    expect(normalizeRentalDate(honestEnd).toISOString()).toBe(honestEnd.toISOString());
  });

  it("collapses a crafted datetime onto the same UTC midnight as the honest one", () => {
    const craftedStart = normalizeRentalDate(new Date("2026-08-10T23:00:00.000Z"));
    const craftedEnd = normalizeRentalDate(new Date("2026-08-12T00:00:00.000Z"));
    expect(craftedStart.getTime()).toBe(honestStart.getTime());
    expect(craftedEnd.getTime()).toBe(honestEnd.getTime());
  });

  it("does not change the billed day count, so pricing validation is unaffected", () => {
    // Dit is precies waarom de exploit onzichtbaar was: de prijs klopte.
    const crafted = { s: new Date("2026-08-10T23:00:00.000Z"), e: new Date("2026-08-12T00:00:00.000Z") };
    expect(computeRentalDays(crafted.s, crafted.e)).toBe(3);
    expect(computeRentalDays(normalizeRentalDate(crafted.s), normalizeRentalDate(crafted.e))).toBe(3);
    expect(computeRentalDays(honestStart, honestEnd)).toBe(3);
  });

  it("restores the blocked-date match that the raw datetime slipped past", () => {
    const blocked = new Date("2026-08-10"); // zoals opgeslagen: UTC-middernacht
    const rawStart = new Date("2026-08-10T23:00:00.000Z");
    // De Prisma-where is `date: { gte: startDate }` — met de ruwe datum viel de
    // geblokkeerde dag daar buiten.
    expect(blocked >= rawStart).toBe(false);
    expect(blocked >= normalizeRentalDate(rawStart)).toBe(true);
  });

  it("restores the overlap match with an existing single-day booking", () => {
    // Bestaande order 2026-08-10 t/m 2026-08-10, nieuwe aanvraag start 08-10.
    const existingEnd = new Date("2026-08-10");
    const rawStart = new Date("2026-08-10T23:00:00.000Z");
    // Overlap-conditie in assertMachineAvailableInTx: startDate <= existing.endDate
    expect(rawStart <= existingEnd).toBe(false);
    expect(normalizeRentalDate(rawStart) <= existingEnd).toBe(true);
  });

  it("keeps the weekday intact, so weekend/Sunday-block pricing is unchanged", () => {
    // 2026-08-10 is een maandag; normaliseren mag daar niets aan veranderen.
    expect(normalizeRentalDate(new Date("2026-08-10T23:00:00.000Z")).getUTCDay()).toBe(
      honestStart.getUTCDay()
    );
  });
});
