import { describe, it, expect } from "vitest";
import {
  buildUnpaidReleaseWhere,
  startOfUtcDay,
  UNPAID_RELEASE_HOURS,
  PAYMENT_REMINDER_HOURS
} from "../../server/services/orderMaintenance";

// Dit is de enige plek in de applicatie die uit zichzelf klantorders annuleert,
// en die draait ongezien terwijl er niemand meekijkt. De voorwaarden hieronder
// zijn dus geen implementatiedetail maar het contract: elke versoepeling ervan
// vernietigt echte boekingen.
describe("buildUnpaidReleaseWhere", () => {
  const now = new Date("2026-08-10T09:00:00.000Z");
  const where = buildUnpaidReleaseWhere(now);

  it("only ever touches unpaid requests that are still awaiting handling", () => {
    // Een goedgekeurde of al betaalde order mag nooit in de selectie vallen.
    expect(where.status).toBe("In behandeling");
    expect(where.paymentStatus).toBe("awaiting");
  });

  it("excludes pay-on-location orders, including legacy rows with a null method", () => {
    // "Op locatie" is per definitie onbetaald tot ophalen/levering. De null-tak
    // is essentieel: Prisma's `not` laat NULL-rijen buiten de match, dus zonder
    // die tak zouden juist de legacy orders (van vóór paymentMethod) hier
    // ongemerkt uit vallen — of erger, bij een omgekeerde fout, wél vervallen.
    const [onLocationClause] = where.AND;
    expect(onLocationClause.OR).toEqual(
      expect.arrayContaining([
        { paymentMethod: null },
        { paymentMethod: { not: "on_location" } }
      ])
    );
  });

  it("releases on whichever clock expires first: 72h since the request, or the start date passing", () => {
    const [, timingClause] = where.AND;
    const [byAge, byStartDate] = timingClause.OR as any[];

    // 72 uur ná het plaatsen van de aanvraag — niet ná de startdatum. Dat is het
    // hele punt: een boeking die op 27 juli voor 12 augustus wordt geplaatst en
    // nooit betaald wordt, blokkeerde anders ruim twee weken de agenda.
    expect(byAge.createdAt.lte.getTime()).toBe(
      now.getTime() - UNPAID_RELEASE_HOURS * 60 * 60 * 1000
    );

    // Tweede klok vangt de kortetermijnboeking af (vandaag geplaatst voor
    // morgen), die anders pas ver ná de huurperiode zou vervallen.
    expect(byStartDate.startDate.lt.getTime()).toBe(startOfUtcDay(now).getTime());
  });

  it("gives the customer a reminder window before anything expires", () => {
    // De herinnering moet vóór het vervallen vallen, anders vervalt een aanvraag
    // zonder dat de klant ooit gewaarschuwd is.
    expect(PAYMENT_REMINDER_HOURS).toBeLessThan(UNPAID_RELEASE_HOURS);
  });
});

describe("startOfUtcDay", () => {
  it("collapses any time of day onto UTC midnight", () => {
    expect(startOfUtcDay(new Date("2026-08-10T23:59:59.999Z")).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z"
    );
    expect(startOfUtcDay(new Date("2026-08-10T00:00:00.000Z")).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z"
    );
  });
});
