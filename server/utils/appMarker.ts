// Interne vlaggen en tellers van de applicatie: markers van eenmalige
// datamigraties ("deze is al gedraaid") en de laatst gedraaide dagelijkse cron.
//
// Deze woonden in InvoiceCounter — de tabel met de wettelijk verplichte,
// doorlopende factuurreeks. Dat werkte, omdat alles op id opzoekt, maar het
// maakte van de gevoeligste tabel van de applicatie een kladblok: naast de rij
// "default" stonden er acht migratievlaggen én een datum (20260803) in de kolom
// die daar "laatste factuurnummer" betekent. Eén deleteMany, findFirst zonder
// where of max(lastNumber) had de factuurreeks kunnen laten springen.
//
// ── Waarom lezen uit BEIDE tabellen ────────────────────────────────────────
// Een verdwenen marker is niet onschuldig: dan draait een eenmalige migratie
// opnieuw, en migration-nifty-hinowa-prices-2026-07 zet dan prijzen terug die de
// beheerder daarna met de hand heeft aangepast. hasMarker kijkt daarom eerst in
// AppMarker en daarna nog in de oude InvoiceCounter-rijen. Mislukt de overzetting
// hieronder om welke reden dan ook, dan blijft de oude rij staan en wordt de
// migratie nog steeds overgeslagen — de veilige kant.

import { prisma } from "../../prisma/client.js";

/** Is deze marker gezet? Kijkt ook in de oude InvoiceCounter-locatie. */
export async function hasMarker(id: string): Promise<boolean> {
  const [current, legacy] = await Promise.all([
    prisma.appMarker.findUnique({ where: { id }, select: { id: true } }),
    prisma.invoiceCounter.findUnique({ where: { id }, select: { id: true } })
  ]);
  return Boolean(current || legacy);
}

/** De waarde van een marker, of null als hij niet bestaat. Idem: beide locaties. */
export async function getMarkerValue(id: string): Promise<number | null> {
  const current = await prisma.appMarker.findUnique({ where: { id }, select: { value: true } });
  if (current) return current.value;
  const legacy = await prisma.invoiceCounter.findUnique({ where: { id }, select: { lastNumber: true } });
  return legacy?.lastNumber ?? null;
}

/** Zet (of werkt bij) een marker. Schrijft altijd naar de nieuwe tabel. */
export async function setMarker(id: string, value = 1): Promise<void> {
  await prisma.appMarker.upsert({
    where: { id },
    create: { id, value },
    update: { value }
  });
}

/**
 * Verhuist bestaande markers uit InvoiceCounter naar AppMarker. Idempotent, en
 * veilig af te breken: een oude rij wordt pas verwijderd nadat de nieuwe
 * aantoonbaar bestaat. Alles behalve "default" — dat ís de factuurteller.
 *
 * Gooit nooit; kan dit niet, dan blijven de oude rijen staan en blijft hasMarker
 * ze gewoon vinden.
 */
export async function migrateLegacyMarkers(): Promise<number> {
  try {
    const legacy = await prisma.invoiceCounter.findMany({ where: { id: { not: "default" } } });
    if (legacy.length === 0) return 0;

    let moved = 0;
    for (const row of legacy) {
      await prisma.appMarker.upsert({
        where: { id: row.id },
        create: { id: row.id, value: row.lastNumber },
        update: {} // een al verhuisde marker nooit overschrijven
      });
      // Pas weghalen nadat de nieuwe rij er echt staat.
      const confirmed = await prisma.appMarker.findUnique({ where: { id: row.id }, select: { id: true } });
      if (confirmed) {
        await prisma.invoiceCounter.delete({ where: { id: row.id } });
        moved++;
      }
    }
    if (moved > 0) {
      console.log(`[Marker] ${moved} marker(s) verhuisd van InvoiceCounter naar AppMarker.`);
    }
    return moved;
  } catch (err) {
    console.warn("[Marker] Kon markers niet verhuizen (oude locatie blijft geldig):", err instanceof Error ? err.message : err);
    return 0;
  }
}
