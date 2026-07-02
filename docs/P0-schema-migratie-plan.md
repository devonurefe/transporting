# P0 — Schema-hardening migratieplan (Float→Decimal, String→enum)

> **Status:** voorbereiding — nog niet uitgevoerd. Vereist een geplande
> onderhoudswindow + verse DB-backup. Dit document beschrijft de veilige
> uitvoering; er verandert nog geen code aan de applicatie.

## Waarom

Twee schemabeslissingen vormen een correctheidsrisico voor een factuur-app:

1. **Geldbedragen als `Float`.** Alle prijzen/bedragen zijn `Float`
   (`prisma/schema.prisma`): `Machine.pricePerDay/weekendPrice/weeklyPrice/…`
   en `Order.machinePrice/subtotal/transportCost/driverCost/vatAmount/totalAmount`.
   Floating-point afronding kan centen doen afwijken; de code compenseert nu
   overal met `Math.round(x*100)/100`. `Decimal` is het correcte type.
2. **Status/enum-velden als vrije `String`.** `Order.status`,
   `Order.paymentStatus`, `Order.deliveryType` en `Machine.category` zijn vrije
   strings; geldige waarden worden alleen in applicatiecode afgedwongen
   (`server/routes/orders.ts`). Prisma-enums maken ongeldige waarden op
   DB-niveau onmogelijk.

## Waarom dit NIET zomaar via `prisma db push` kan

De deploy draait bij containerstart `prisma db push` (geen migratiehistorie).
`db push` past het live schema aan zónder gecontroleerde, terugdraaibare
migratiestap:

- **Float→Decimal** is een kolomtype-wijziging op bestaande data. Postgres kan
  `double precision` → `numeric` casten, maar `db push` genereert dat impliciet
  en zonder review/rollback. Bij grote tabellen kan dit de tabel herschrijven en
  kort locken.
- **String→enum** vereist eerst het aanmaken van het enum-type én dat álle
  bestaande rijwaarden exact in de enum passen. Eén afwijkende waarde (bv. een
  oude order met een verouderde `deliveryType`) laat de cast falen — en `db push`
  kan dan destructief willen "resetten".

Daarom: **eerst overstappen op `prisma migrate` (gecontroleerde, versiebeheerde
migraties), pas daarna de typewijzigingen.**

## Voorwaarden (vóór welke wijziging dan ook)

1. **Verse DB-backup** op de VPS:
   `docker compose exec -T postgres pg_dump -U huurgo huurgo > backup-$(date +%F).sql`
   en verifieer dat het bestand niet leeg is.
2. **Onderhoudswindow** (lage-verkeersmoment) + korte aankondiging.
3. **Rollback klaar:** het image van de vorige release blijft in GHCR; DB-restore
   via `psql < backup.sql` op een teruggezette lege DB indien nodig.
4. **Data-sanering vooraf** (kritiek voor de enum-stap): controleer dat er geen
   rijen met ongeldige enum-waarden bestaan.

```sql
-- Moet 0 rijen geven vóór de enum-migratie:
SELECT DISTINCT "deliveryType" FROM "Order"
  WHERE "deliveryType" NOT IN ('self_pickup','delivery_by_us','trailer_rental','trailer_drop_return');
SELECT DISTINCT "status" FROM "Order"
  WHERE "status" NOT IN ('In behandeling','Goedgekeurd','Onderweg','Voltooid','Geannuleerd');
SELECT DISTINCT "paymentStatus" FROM "Order"
  WHERE "paymentStatus" NOT IN ('awaiting','paid','refunded');
SELECT DISTINCT category FROM "Machine" WHERE category NOT IN (/* geldige category-ids */);
```
Ongeldige rijen eerst handmatig corrigeren (of via een data-fix-migratie).

## Fase 1 — Overstap naar `prisma migrate` (zonder typewijziging)

Doel: migratiehistorie invoeren met het **huidige** schema als baseline, zodat
volgende wijzigingen gecontroleerd en terugdraaibaar zijn. Geen datawijziging.

1. Genereer een baseline-migratie uit het huidige schema:
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0000_baseline/migration.sql`
   (of `prisma migrate dev --name baseline` tegen een lokale kloon).
2. Markeer de live DB als "al op baseline":
   `npx prisma migrate resolve --applied 0000_baseline` (draait tegen de live DB,
   past niets aan — registreert alleen dat de baseline al bestaat).
3. **Deploy-flow omzetten** van `prisma db push` naar `prisma migrate deploy`:
   - `package.json` `start`-script: `prisma migrate deploy` i.p.v. `prisma db push`.
   - `Dockerfile`/README/CLAUDE.md bijwerken.
   - `applyDataMigrations` in `server.ts` (~180 regels, gebruikt `InvoiceCounter`
     als migratie-marker) kan gefaseerd naar echte migraties; voorlopig laten
     staan (idempotent), later opruimen.
4. Verifieer op een **kloon van de productie-DB** dat `migrate deploy` een no-op
   is (baseline al toegepast) en de app normaal start.

**Deze fase is op zichzelf mergebaar en laag-risico** (geen schema/datawijziging,
alleen een gecontroleerd deploy-mechanisme). Aanrader om als aparte PR te doen.

## Fase 2 — Float → Decimal

Na Fase 1, in een aparte migratie:

1. Schema: alle geld-`Float` → `Decimal @db.Decimal(10, 2)` (bv. `pricePerDay`,
   `weekendPrice`, `weeklyPrice`, `monthlyPrice`, `twoDayPrice`, `oneDayPrice`,
   `campaignDiscountAmount`, en alle `Order`-bedragen). **Let op:** `height`,
   `reach`, `weight` en de `…DiscountPercent`-velden zijn géén geld → `Float`
   laten of apart beoordelen.
2. `prisma migrate dev --name money-to-decimal` genereert een `ALTER COLUMN … TYPE
   numeric(10,2) USING (…::numeric)`. Review de gegenereerde SQL handmatig.
3. **Code-impact:** Prisma levert `Decimal`-bedragen dan als `Prisma.Decimal`
   (niet `number`). Frontend/serverberekeningen die `number` verwachten moeten
   `.toNumber()`/`Number(x)` gebruiken, of we serialiseren in de API-laag naar
   `number` zodat de client ongewijzigd blijft. Dit raakt o.a.
   `server/routes/orders.ts` (prijsspiegel), `src/utils/pricing.ts` en de
   invoice/CSV-export. Zorg dat de **API-integratietests uit item #6 hier al
   bestaan** vóór deze stap — dan is regressie meteen zichtbaar.
4. Test op een productie-kloon: bedragen exact gelijk vóór/na, factuur- en
   CSV-export ongewijzigd.

## Fase 3 — String → enum

1. Voeg Prisma-enums toe: `OrderStatus` (In behandeling/Goedgekeurd/Onderweg/
   Voltooid/Geannuleerd — let op: waarden met spaties → gebruik `@map`),
   `PaymentStatus` (awaiting/paid/refunded), `DeliveryType`
   (self_pickup/delivery_by_us/trailer_rental/trailer_drop_return). `category`
   kan enum worden of een echte FK naar `Category` (voorkeur: FK, want categorieën
   zijn beheerbaar).
2. Migratie: enum-type aanmaken en kolom casten
   (`ALTER COLUMN … TYPE "OrderStatus" USING "status"::"OrderStatus"`). Faalt als
   er ongeldige waarden zijn → daarom de sanering in "Voorwaarden".
3. Code-impact: de `VALID_*`-constanten in `orders.ts` worden overbodig (enum
   dwingt af), maar de leesbare foutmeldingen behouden. `src/types.ts` enums
   uitlijnen met de Prisma-enums.

## Volgorde & mergestrategie

```
Fase 1 (migrate-adoptie)      → aparte PR, laag risico, eerst mergen
  └─ #6 API-integratietests   → moet vóór Fase 2 bestaan (regressienet)
Fase 2 (Float→Decimal)        → aparte PR, onderhoudswindow + backup
Fase 3 (String→enum)          → aparte PR, onderhoudswindow + backup + sanering
```

Elke fase is los mergebaar en los terugdraaibaar. Nooit Fase 2/3 zonder een
verse backup en een geverifieerde restore-procedure.

## Verificatie per fase

- **Lokaal:** `docker compose up postgres` (of lokale Postgres), `prisma migrate
  deploy`, `npm run lint && npm run test`, en de order-flow end-to-end (aanmaken,
  prijsvalidatie, statusovergangen) — bij voorkeur via de #6-integratietests.
- **Op een productie-kloon:** restore de backup naar een wegwerp-DB, draai de
  migratie, en vergelijk een steekproef van bedragen/orders vóór en na.
- **Live:** binnen de window deployen, `/api/health` groen, een testorder
  aanmaken en een bestaande factuur printen ter controle.
