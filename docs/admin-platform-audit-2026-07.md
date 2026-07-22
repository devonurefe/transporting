# HuurGo Admin Platform — Operations, Rental Workflow & Business Logic Audit

**Scope:** full audit of the admin console and the backend rental logic that supports it (`src/components/admin/*`, `server/routes/*`, `prisma/schema.prisma`). No code was changed as part of this document.

**Method:** grounded in the actual implementation, not a generic template. Every claim below cites the file it comes from. Where the ideal-system checklist in the brief doesn't exist in this codebase, that's called out explicitly as a gap rather than assumed.

---

## 1. Current Architecture Map

```
Admin Console (13 lazy-loaded panels, src/components/admin/)
├── Dashboard          AdminDashboard.tsx       KPIs, revenue chart, fleet mix, utilization
├── Orders             AdminOrders.tsx          List/filter/status/cancel/edit, invoice print
├── Machines           AdminMachines.tsx        Edit existing machines (prices, images, flat rates)
├── Add Machine        AdminAddMachine.tsx      Create new machine
├── Calendar            AdminCalendar.tsx        Block/unblock dates (manual, single reason field)
├── Planning            AdminPlanning.tsx        Read-only departures/returns timeline
├── Customers           AdminCustomers.tsx       Paginated list, order history, lifetime value
├── Logs                AdminLogs.tsx            Real audit trail (GET /api/admin/audit-logs)
├── Diagnostics         AdminDiagnostics.tsx     System health / DB latency probe
├── Customizer          AdminCustomizer.tsx      Site config, campaign rules, categories
├── Content             AdminContent.tsx         FAQ, USPs, hours, transport fees, SEO, legal pages
├── Beheerders (Users)  AdminUsers.tsx           2FA, admin account create/disable/reset
└── Accounting          AdminAccounting.tsx      Revenue reporting + CSV export

Shared: AdminStatusBadge, AdminConfirmDialog, AdminAvailabilityWidget,
        AdminOrderFormModal, AdminRentalTimeline, AdminCampaignRules,
        AdminBlog (Kenniscentrum/SEO — not in the brief's taxonomy, exists in practice)
```

There is **no separate module** for: Companies, Delivery (as an operational entity distinct from Order.deliveryType), Pickup, Maintenance, Damage, Invoices (invoice is a derived print view, not a stored entity), Payments (payment is two fields on Order, no ledger), Discounts (folded into Pricing/Customizer), Reports (folded into Accounting + Dashboard). This isn't necessarily wrong for a single-depot business this size, but it means several of the brief's "modules" are actually *fields on Order/Machine* rather than first-class systems — see §13 for where that stops being adequate.

**Ideal vs. actual, module by module:**

| Brief's module | Actual state | Verdict |
|---|---|---|
| Reservations | `AdminOrders.tsx` + `server/routes/orders.ts` — full CRUD, status machine, PATCH-based reschedule | Solid |
| Equipment | `AdminMachines.tsx` / `AdminAddMachine.tsx`, `Machine` model | Present but data model is catalog-oriented, not fleet-oriented (§4) |
| Categories | `AdminCustomizer.tsx`, `Category` model | Present, thin (label/desc/heights/price strings) |
| Customers | `AdminCustomers.tsx`, `Customer` model | Present, individual-only (§10) |
| Companies | **Absent** — `Customer.companyName` is a free-text string | Missing module |
| Availability | `src/utils/availability.ts` + calendar/blocked-dates | Solid for a single-location fleet (§5) |
| Delivery / Pickup | `Order.deliveryType/deliveryAddress/deliveryTimeSlot` + `AdminPlanning.tsx` (read-only) | Data exists, no operational workflow (§8) |
| Maintenance | `BlockedDate.reason` free text, one preset ("Planmatig Onderhoud / Keuring") | Not a real module (§9) |
| Damage | **Absent entirely** | Missing module (§9) |
| Pricing | `src/utils/pricing.ts` / `server/utils/orderPricing.ts` | Genuinely strong — single authoritative source (§6) |
| Discounts | `SiteConfig.campaignRules` + per-machine percent/flat fields | Present, sitewide/per-SKU only, no per-customer or coupon codes |
| Invoices | `src/utils/invoice.ts` — generated HTML at print time | Not a stored/numbered ledger entity beyond `Order.invoiceNumber` + `InvoiceCounter` |
| Payments | `Order.paymentStatus` (`awaiting`/`paid`/`refunded`), no gateway integration | Manual/WhatsApp-driven, no payment record history |
| Employees | `Admin` model, single flat role | No differentiation (§11) |
| Notifications | `Notification` Prisma model — **unused**, confirmed dead by its own schema comment (`prisma/schema.prisma:301-314`) | Documented-dead, not a real feature |
| Reports | `AdminAccounting.tsx` (revenue + CSV) | Narrow — revenue only, no ops reports |
| Audit logs | `AuditLog` model + `AdminLogs.tsx` | Genuinely strong (§14 calls out why) |

---

## 2. Current Workflow Map

```
Customer                          System                              Admin
────────                          ──────                              ─────
Browse catalog → cart
Select dates ────────────────► checkAvailability() (client)
                                (src/utils/availability.ts)
Fill delivery + details
Submit ──────────────────────► POST /api/orders
                                serializable tx, re-checks availability
                                server-side, mirrors pricing exactly
                                (server/routes/orders.ts:~450-670)
                                status = "In behandeling"
                                paymentStatus = "awaiting"
                                                                   ◄── order appears in AdminOrders
"WhatsApp me for iDEAL link" ─► WhatsApp (outside the system)
                                                                   Admin sends Tikkie/iDEAL manually
Customer pays ───────────────► (no gateway webhook — no system event)
                                                                   Admin marks paymentStatus = "paid"
                                                                       (manual field flip, no reconciliation)
                                                                   Admin sets status → "Goedgekeurd"
                                                                       (blocked server-side unless paid,
                                                                        orders.ts:1221)
                                                                   AdminPlanning shows it in tomorrow's
                                                                       departures (read-only)
                                                                   Admin manually sets status → "Onderweg"
Equipment used on site
                                                                   Admin manually sets status → "Voltooid"
                                                                       (terminal — no return inspection step)
```

The gap in this diagram is structural, not cosmetic: **every transition from "paid" onward is a manual admin click with no supporting operational data** (no delivery confirmation, no driver, no signature, no return photos, no inspection). The state machine enforces *order* — which values one can move to next — but nothing enforces that the real-world event the label implies (equipment actually left the depot, actually came back, actually got inspected) happened.

---

## 3. Rental Lifecycle State Machine

### What actually exists

`server/routes/orders.ts:1191-1197`:

```ts
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  "In behandeling": ["Goedgekeurd", "Geannuleerd"],
  "Goedgekeurd":    ["Onderweg", "Geannuleerd"],
  "Onderweg":       ["Voltooid"],
  "Voltooid":       [],
  "Geannuleerd":    []
};
```

This is a real, server-enforced state machine — not just a UI dropdown. Good foundation: illegal transitions are already rejected with a 400 (`orders.ts:1213-1218`), and `Goedgekeurd` is additionally gated on `paymentStatus === "paid"` (`orders.ts:1221-1225`). There's also a cron-driven auto-cancel for stale unpaid `In behandeling` orders whose `startDate` has passed (`orders.ts:1284-1303`), so dead bookings don't permanently occupy calendar slots.

Mapped to the brief's 5-state names: `In behandeling` = PENDING/AWAITING_PAYMENT (conflated), `Goedgekeurd` = CONFIRMED, `Onderweg` = OUT_FOR_DELIVERY *and* ACTIVE (conflated), `Voltooid` = COMPLETED, `Geannuleerd` = CANCELLED.

### Answering the brief's illegal-transition questions against the real code

- **Can a cancelled reservation become active?** No — `Geannuleerd` maps to `[]` in the transition table. Correctly blocked.
- **Can an already-rented machine be booked?** No for the same physical slot — `assertMachineAvailableInTx` re-runs availability inside the serializable transaction on both create and PATCH (`orders.ts:807-809`), closing the race window the CLAUDE.md notes as a deliberate fix. Correct.
- **Can a returned machine be rented before inspection?** **Not applicable — there is no inspection state.** `Voltooid` is reached directly from `Onderweg` with a single admin click. Nothing in `availability.ts` or the Order model distinguishes "physically back at the depot, condition unverified" from "closed out." A damaged or dirty machine and a perfect one are indistinguishable to the availability engine the instant an admin clicks "Voltooid" — see §5 and §9.
- **Can a reservation be deleted after payment?** There is no delete endpoint for `Order` in `orders.ts` at all — only PATCH (edit) and the status-transition PUT, both of which explicitly refuse once `status` is `Geannuleerd`/`Voltooid` (`orders.ts:704-706`). So: correctly impossible, but by omission of a delete route rather than by an explicit authorization rule — worth confirming that's intentional rather than incidental.

### Gaps against the brief's proposed richer state list

Missing states that would materially improve the system, in order of what they'd actually fix:

1. **No `RETURNED` / `INSPECTION_REQUIRED` split.** This is the single biggest lifecycle gap. `Onderweg → Voltooid` skips the physical-return-and-check step entirely. A machine that comes back damaged still becomes instantly available for the next customer once `Voltooid` fires, because `checkAvailability()` only looks at `status !== "Geannuleerd"` (`availability.ts:59`) — it has no concept of "returned but not yet cleared." Damage discovered at return time currently has nowhere to attach itself before the slot reopens.
2. **No `OVERDUE`.** `Onderweg` has no expected-return check against `endDate`. Nothing flags a rental still `Onderweg` past its `endDate` — the closest existing signal is the *unrelated* "stale unpaid `In behandeling`" flag AdminOrders shows for bookings >48h old (per CLAUDE.md's audit-hardening note), which is a different problem (payment, not return).
3. **`AWAITING_PAYMENT` and `PENDING` are the same state** (`In behandeling` covers both "just submitted" and "payment requested via WhatsApp, waiting"). Fine operationally today since payment is 100% manual/WhatsApp-driven, but it means the dashboard's "pending" KPI (`AdminDashboard.tsx:283`, `byStatus["In behandeling"]`) can't distinguish "needs admin attention now" from "waiting on customer."
4. **`OUT_FOR_DELIVERY` and `ACTIVE` are the same state** (`Onderweg`). A multi-day rental where delivery already happened and the customer is mid-use looks identical in the system to a rental that hasn't left the depot yet. `AdminPlanning.tsx`'s departure/return timeline works around this by deriving "departing"/"returning" groups from `startDate`/`endDate` directly rather than from `status` — which works, but means the status field itself is not the source of truth for where the equipment physically is.

---

## 4. Equipment Data Model Audit

`Machine` (`prisma/schema.prisma:10-57`) has ~35 fields, and essentially all of them are **pricing and catalog-display** fields (`oneDayPrice`…`monthlyPrice`, `imageUrl`, `description`, `suitableFor`, `crossSellAddons`). This is a well-built *e-commerce product* model. It is not a *fleet asset* model, and the two are different things once you have real machines with real serial numbers, real inspection certificates, and real repair histories.

**Present:** `height`, `reach`, `weight`, `powerType`, `stockQuantity` (int, default 1), `bufferDays` (int, default 0), `isActive`/`deletedAt` (soft-delete), `specs` (loose `Json?`).

**Absent, checked directly against the brief's field list:**

| Missing field | Why it matters |
|---|---|
| Serial number / asset tag | `stockQuantity` is a bare count of interchangeable units — there is no way to say "unit #2 of the JLG 1230 is out for repair" without either (a) reducing `stockQuantity` for *every* unit of that model, over-blocking capacity, or (b) manually adding a `BlockedDate` on the shared `Machine.id`, which also blocks all units, not just the broken one. See §5. |
| Registration/kenteken number | Needed for trailer-towed and road-legal units; not modeled anywhere. |
| Working height vs. platform height | Only a single `height` field exists — catalog copy conflates the two informally in `description`/`specs` (unstructured `Json`), not queryable. |
| Machine dimensions (width/length/transport height) | Not modeled — relevant for delivery-vehicle/route planning, currently absent from the system entirely (§8). |
| Indoor/outdoor suitability, terrain type | `suitableFor` exists but is a loose `Json` array used for catalog filtering copy, not a structured indoor/outdoor/terrain flag. |
| Certification / inspection date / next inspection date | **Completely absent.** For rental lifting equipment this is normally a legal/insurance requirement (periodic keuring). Nothing in `Machine` or any other model tracks it, and nothing blocks booking a machine whose certificate has lapsed. |
| Purchase date, depreciation | Absent — not necessarily needed for an ops app, but relevant if Accounting is ever asked for fleet-value reporting. |
| Machine-level `status` enum (available / in_repair / retired / damaged) | Absent. The only lifecycle signal on a machine is `isActive` (boolean, catalog visibility) and `deletedAt` (soft delete). Neither expresses "temporarily out of service." |
| Documents (manuals, certificates as files) | Absent. |
| Maintenance history, damage history as structured, queryable records | Absent — see §9, this is the largest single gap in the whole system. |

**Data-model risk already present:** `specs: Json?` and `additionalImages: Json?` are unstructured — fine for flexible catalog copy, but it means nothing about "specs" is validatable or reportable (you can't query "all machines with terrain wheels" — it's opaque JSON per row).

**Scalability note:** `stockQuantity` as an integer works for the current "several identical units of the same catalog SKU" model and the `someUnitAvailable()` helper (`availability.ts:122-134`) is a reasonable design for that — but it caps out the moment the business needs to track individual units differently (different purchase dates, different wear, different certification expiry per physical unit). That's the point at which `Machine` needs to split into `MachineModel` (catalog/pricing, what exists today) + `MachineUnit` (physical asset, serial number, status, certification) — flagged as P2 in the roadmap, not urgent today given current scale, but worth planning before it becomes a rewrite under pressure.

---

## 5. Availability Engine Audit

`src/utils/availability.ts` is used both client-side (booking flow) and, per CLAUDE.md, mirrored server-side inside the order transaction (`assertMachineAvailableInTx`) — this dual-check-with-shared-logic pattern is exactly right for preventing double-booking races, and CLAUDE.md documents that serializable transactions specifically close this gap.

**Mechanism, read directly from the code:**
- Overlap check excludes cancelled orders (`o.status === "Geannuleerd"` skipped, `availability.ts:59`) — correct.
- `bufferDays` extends each order's *end* by `bufferDays × 86_400_000 ms` before overlap comparison (`availability.ts:56, 61`) — this is the delivery/pickup/turnaround buffer mechanism, and it's day-granular, applied uniformly per machine (not separately configurable for "time to prep for delivery" vs. "time to inspect after return").
- Capacity (not just binary overlap) is handled by walking each day in the requested range and counting concurrent orders against `stockQuantity` (`availability.ts:65-83`) — correctly avoids the naive bug of treating stock>1 as "any overlap = blocked."
- Blocked dates are checked via an O(1) `Map` lookup per day (`availability.ts:85-105`) — a real perf fix, not incidental; CLAUDE.md's changelog confirms this replaced an O(n²) scan.
- `someUnitAvailable()` extends this to "multiple physical units of the same model" by checking if *any* unit clears (`availability.ts:122-134`).

**Against the brief's six scenarios:**

1. **Monday–Wednesday booking, then a Tuesday–Thursday attempt on the same machine** → correctly rejected; overlap math is date-range intersection, not exact-match.
2. **Two identical machines** → handled via `stockQuantity`/`someUnitAvailable`, *not* via two distinct machine rows with individual identity. This is the same limitation as §4: the system can say "yes, one of N units is free" but never "which specific unit." For availability math alone this is sufficient; it stops being sufficient the moment maintenance/damage needs to pull one specific physical unit out of rotation (see below).
3. **Machine under maintenance** → works today only as a manual `BlockedDate` row with a preset "Planmatig Onderhoud / Keuring" reason (`AdminCalendar.tsx:36`). Since `BlockedDate` is keyed on `machineId` (the shared catalog row), blocking one physical unit for maintenance blocks *all* units of that model from that date — there's no way to block "just unit #2." At `stockQuantity: 1` this is a non-issue; it becomes a real correctness gap for any machine with `stockQuantity > 1`.
4. **Late return** → **not handled by the availability engine at all.** `checkAvailability()` has no concept of "actual return happened late" — it only ever reasons about `Order.endDate` as declared at booking time, and the order's `status` (not `endDate`) is what an admin manually advances. If a rental physically overruns, nothing in `availability.ts`, `orders.ts`, or the `Order` model detects or flags it (there's no `OVERDUE` state — §3), and the *next* customer's booking for that machine, if their start date falls before the late admin ever manually intervenes, would be checked against the stale `endDate`, not reality. This is a genuine double-booking exposure in the late-return case specifically, not covered by the otherwise-solid overlap logic.
5. **Cancellation** → correctly frees the slot immediately — cancelled orders are filtered out of every availability query (`availability.ts:59`), so re-booking works as expected the instant `status` flips to `Geannuleerd`.
6. **Partial-day / multi-day** → the engine is date (day-granularity) based throughout; there is no time-of-day/hour concept anywhere (`deliveryTimeSlot` is a customer preference string, not used in overlap math). For a same-day two-slot use case (return at 09:00, redeliver at 14:00) the system cannot express that — it would show the machine as unavailable for that whole day, which is conservative-safe but not necessarily what ops wants.

**Bottom line:** the *overlap/capacity* math is genuinely well-built and battle-tested (serializable-transaction race fix, O(1) blocked-date lookups, correct stock-aware concurrency counting). The gaps are all at the edges the math was never asked to cover: individual-unit identity, actual-vs-planned return time, and time-of-day granularity.

---

## 6. Pricing Engine Audit

This is the strongest-architected subsystem in the codebase, and CLAUDE.md's own "CRITICAL" framing for it is earned — worth stating plainly rather than manufacturing findings to fill a template section.

**Single authoritative source, genuinely enforced:**
- Tier/flat-rate logic (`tierPrice`, `isWeekendPackage`, `hasSundayBlock`) lives in `src/utils/pricing.ts` and is **mirrored, not reimplemented**, in `server/utils/orderPricing.ts` — CLAUDE.md flags explicitly that any divergence causes real order failures ("Totaalbedrag klopt niet"), which is a strong forcing function keeping the two in sync (a test — `src/__tests__/orderPricing.test.ts` — covers the server side directly).
- VAT is computed in exactly one function, server-side only: `computeVatAndTotal()` (`server/utils/orderPricing.ts:270-274`), hardcoded 21% NL rate, 2-decimal rounding. The frontend does not independently compute VAT for authoritative totals — checked directly, `src/utils/pricing.ts` has no VAT/BTW math at all, only pre-VAT price assembly. This is the right shape: one number, computed once, on the server, echoed to the client for display.
- Transport/add-on fees go through a second, deliberately separate mirror pair (`getTransportFees()`/`getGlobalAddons()` client-side, `resolveFees()` server-side) rather than being duplicated inline — CLAUDE.md documents this was a conscious refactor ("never read a raw `siteConfig.transportFees.x` value directly in a component").
- Order creation and order edit (`PATCH /:id`) both **recompute price server-side from the machine + campaign rules + fees**, never trust a client-submitted total outright (`orders.ts:475`, `:638`, `:804`) — `driverCost` from the client is explicitly rejected if non-zero (`orders.ts:459-462`), closing an obvious total-manipulation vector.

**Where the brief's suspicions don't hold, checked directly:**
- *"Frontend calculates price differently from backend"* — no; frontend calculation exists only for instant UI feedback pre-submit, and is discarded in favor of the server recompute at persist time.
- *"Prices are hardcoded"* — machine prices are admin-editable (`AdminMachines.tsx`/`AdminAddMachine.tsx`), transport fees are admin-editable (`AdminContent.tsx` → Tarieven), only the 21% VAT rate itself is a code constant — reasonable, since NL statutory VAT isn't a per-tenant business decision.
- *"Discounts can be manipulated"* — discount rules (`campaignRules`) are sanitized/validated server-side on write (CLAUDE.md: "POST payload validated/sanitized") and applied inside the same server-authoritative `computeOrderSubtotal` path, not client-supplied.

**Actual gaps, smaller than the brief implies:**
- **No customer-specific or company-specific pricing.** Every discount mechanism (`weeklyDiscountPercent`, `campaignDiscountPercent`, `campaignRules`) is either per-machine or sitewide — there is no concept of a negotiated rate for a specific repeat customer or company account. For a B2B-leaning rental business this is a real limitation once volume customers start asking for standing rates (see §10).
- **No coupon/promo-code entry point.** Discounts are admin-authored rules, not customer-redeemable codes — a legitimate product-scope choice, not a bug, but worth naming since the brief asks about it explicitly.
- **No late-return or damage-charge computation path at all** — because there's no state that represents "returned late" or "damaged" to price against (§3, §9). If/when those states are added, they'll need their own server-authoritative pricing functions following the exact same mirror-discipline pattern already established — that's a template to reuse, not a gap in the existing design.

---

## 7. Reservation Workflow Audit

Checked `AdminOrders.tsx` + `orders.ts` against the brief's admin-capability checklist:

| Capability | Present? | Where |
|---|---|---|
| View all bookings | Yes | `AdminOrders.tsx`, paginated |
| Filter by date/status/machine/customer | Yes | list + `setOrdersFilter` wiring from Dashboard drill-downs |
| Search by booking number | Yes | order `id` is a searchable crypto ID (`HWH-XXXXXXXX`) |
| Open booking detail | Yes | `AdminOrderFormModal.tsx` |
| Change status | Yes, server-validated against `VALID_STATUS_TRANSITIONS` | §3 |
| Reschedule | Yes | `PATCH /:id` recomputes price + re-checks availability excluding itself (`orders.ts:698-820`) |
| Cancel | Yes, correctly for both `In behandeling` and `Goedgekeurd` | `AdminOrders.tsx:1297` (button gated to those two statuses) via `handleUpdateStatus` → `PUT /:id/status`, checked against `VALID_STATUS_TRANSITIONS` |
| Assign equipment | **Partially** — booking is against a `Machine` (model/SKU), not a specific physical unit, so "assign equipment" collapses into "which unit" being implicit, not an explicit admin action (§4/§5) |
| Assign driver | **No** — `driverCost` exists on `Order` but is hardcoded to `0` and never editable (`orders.ts:459-462, 521, 666, 815`); there is no driver entity or assignment UI anywhere |
| Add internal notes / customer notes | **No dedicated notes field on `Order`** — the closest things are `poNumber` (a reference field, not free notes) and the WhatsApp-driven proposed-reschedule fields (`proposedStartDate/proposedEndDate/proposedAt`). There is no admin-only internal-notes textarea on an order. |
| View payment status | Yes | `Order.paymentStatus` shown via `AdminStatusBadge`-adjacent UI |
| View timeline | Partially | `AdminRentalTimeline.tsx` exists; order-level event history is only as rich as what `AuditLog` captured for that entity, not a purpose-built timeline object |
| View audit history | Yes | `AdminLogs.tsx` filterable by entity/action, real DB-backed |

**Worth noting — two intentionally different cancel paths exist, correctly scoped:** there's a separate, more restrictive `PUT /api/orders/:id/cancel` endpoint (`orders.ts:914-927`) that customers use for self-service cancellation of their own booking, hard-gated to `status === "In behandeling"` only. The *admin* cancel button in `AdminOrders.tsx` doesn't call that endpoint — it calls the general `handleUpdateStatus` → `PUT /:id/status`, gated in the UI to show for `In behandeling` **and** `Goedgekeurd` (`AdminOrders.tsx:1291-1307`, with an explicit code comment confirming this mirrors `VALID_STATUS_TRANSITIONS`). This is the right shape: a customer can self-cancel only before anything's been approved, while an admin can still cancel a confirmed-but-not-yet-dispatched (`Goedgekeurd`) booking. Once an order reaches `Onderweg` (dispatched), neither path allows cancellation — at that point the equipment is physically in the customer's hands, so "cancel" stops being the correct action; this is a reasonable, deliberate boundary, not a gap.

---

## 8. Delivery & Logistics Audit

**What exists:** `Order.deliveryType` (self_pickup / delivery_by_us / trailer_rental / trailer_drop_return per the enum-migration doc), `deliveryAddress`, `deliveryTimeSlot`, `trailerDays`. `AdminPlanning.tsx` renders a **read-only** daily timeline grouping orders into "departing today/tomorrow" and "returning today/tomorrow" (`AdminPlanning.tsx:33-100`), derived from `startDate`/`endDate`, with a click-through to the order detail.

**What the brief asks for that doesn't exist, checked directly:**
- Delivery zones / distance calculation — absent; `deliveryAddress` is free text with no geocoding or zone lookup, and the flat `deliveryFee` (admin-editable, `SiteConfig.transportFees`) doesn't vary by distance.
- Driver assignment — absent (confirmed above, `driverCost` is dead-weight-zero).
- Route planning — absent.
- Delivery status as its own field — absent; delivery/pickup completion is inferred only from the coarse `Onderweg`/`Voltooid` order status, not tracked per-leg (a trailer_drop_return has an implicit two-leg journey — drop and later return — with no separate status for each leg).
- Proof of delivery, customer signature, photos at delivery, damage documentation at handover — **entirely absent.** No file/photo storage hook exists for delivery events anywhere in `orders.ts` or the `Order` model.

**Assessment:** this is the least-built operational module relative to what a physical-equipment rental business typically needs day-to-day. It's currently a *reporting view* over order dates, not a logistics tool — fine for a single-vehicle, low-volume operation where the owner just needs "what leaves today," which appears to be the actual current scale, but it will not scale to multiple drivers/vehicles without real additions (§16/§17).

---

## 9. Maintenance & Damage Audit

**Maintenance:** exists only as a `BlockedDate` row with `reason` free text, one admin-UI preset value ("Planmatig Onderhoud / Keuring" — `AdminCalendar.tsx:36`). There is:
- No maintenance schedule (no recurring/interval-based due dates).
- No inspection-date or next-inspection-date field on `Machine` (§4).
- No cost tracking for a maintenance event.
- No history — once a `BlockedDate` row's date passes, it's just a past calendar entry with a string reason, not a queryable maintenance record ("show me all maintenance events for machine X in the last year" is not answerable from the data model as it stands).
- No link between "why a machine is currently unavailable" and structured reporting — Accounting/Dashboard cannot report "days lost to maintenance" because that's indistinguishable from any other blocked-date reason string.

**Damage:** **does not exist as a concept anywhere in the schema or the admin UI.** There is no `DamageReport` model, no photo-upload hook tied to a return event, no repair-cost field, no linkage from a damage event to the order/customer that caused it, and — most importantly per §3 — **no mechanism that prevents a damaged machine from being rebooked**, because there is no "damaged" state for a machine or a rental to be in. The moment an order hits `Voltooid`, the machine is fully available again regardless of physical condition.

**This is the single highest-risk gap in the whole audit** (flagged P0 in §17): a physical-equipment rental business that has no system-level way to pull a damaged unit out of rotation is one missed verbal handoff away from renting broken/unsafe lifting equipment to the next customer. Today this entirely depends on an admin remembering to manually create a `BlockedDate` with a maintenance-style reason after every return — there is no prompt, no required step, and no enforcement.

---

## 10. Customer & Company (CRM) Audit

`Customer` model (`prisma/schema.prisma:79-101`): email/password, name, phone, `profile` (a free string used for the Dashboard's "Schilder/Hovenier/Glazenwasser/Aannemer/Particulier" bucketing via substring matching — `AdminDashboard.tsx:88-95`, itself a bit fragile since it's keyword-matching a free-text field rather than an enum), `companyName` (string), `address` (string), plus solid auth-security fields (lockout, token version, verification).

**Confirmed absent, checked against `AdminCustomers.tsx` and the schema directly:**
- No separate `Company` entity — `companyName` is just a label on an individual `Customer` row, so there's no way to have multiple people/logins under one company account, no shared company order history, no company-level billing address distinct from the individual's.
- No VAT/KvK number field on `Customer` (only exists at the site-operator level, `SiteConfig.kvkNumber/btwNumber`, for HuurGo's own invoicing — not for B2B customers who'd need their VAT number on an invoice for their own bookkeeping).
- No credit limit / payment-terms field — consistent with the fact there's no invoicing-on-account flow at all (CLAUDE.md: no deposit, WhatsApp-driven payment).
- No structured customer tags — `profile` is the closest thing and it's a single free-text field, not a tag set.
- Rental history and lifetime value **are** present and computed correctly (`AdminCustomers.tsx` per CLAUDE.md's panel description) — this part is solid.
- No internal admin-only notes field on `Customer` (mirrors the same gap found on `Order` in §7).

**Assessment:** adequate for the current individual/sole-trader customer base implied by the `profile` categories (painters, gardeners, window cleaners, contractors — all sole-trader-shaped professions). Becomes a real limitation the moment a genuine multi-seat company account (e.g., a construction firm with several site managers each booking equipment under one account) needs to exist — there's no data model for that today.

---

## 11. Roles & Permissions Audit

This is the most clear-cut, unambiguous gap in the system, and it's explicitly a **documented design decision**, not an oversight — CLAUDE.md states it directly: *"All admins share one role (`'admin'`) — no role hierarchy."* Verified in code:

- `Admin.role` (`prisma/schema.prisma:108`) defaults to `"admin"` and nothing in `server/routes/admins.ts` or `AdminUsers.tsx` sets or reads any other value.
- `requireAdmin` middleware (`server/middleware/auth.ts:42-51`) checks exactly one condition: `req.user.role !== "admin"`. There is no second tier.
- Every one of the 13 admin panels and every mutation endpoint is reachable by any authenticated admin. A driver-equivalent user (if one existed) would have full access to Accounting, Beheerders (create/disable other admins), and Site Content — there's no way today to grant someone "can update order status and view Planning" without also granting "can see revenue and disable other admins' accounts."

**Compensating controls that do exist** (per CLAUDE.md, confirmed real, not hypothetical): short 12h JWT expiry for admins, DB-backed token-version revocation, self-service 2FA (TOTP, AES-256-GCM at rest), DB-backed lockout (5 attempts/15 min), and — importantly — **every admin mutation is captured in `AuditLog`** regardless of who did it, so post-hoc accountability exists even without preventive access control.

### Recommended role matrix (target state, not current)

| Capability | Super Admin | Manager | Operations | Sales | Finance | Driver | Maintenance | Read-only |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View dashboard/reports | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ |
| Create/edit orders | ✓ | ✓ | ✓ | ✓ | – | – | – | – |
| Change order status | ✓ | ✓ | ✓ | – | – | Delivery/return legs only | – | – |
| Cancel confirmed orders | ✓ | ✓ | – | – | – | – | – | – |
| Edit machine pricing | ✓ | ✓ | – | – | – | – | – | – |
| Edit machine catalog (non-price) | ✓ | ✓ | ✓ | – | – | – | – | – |
| Block dates / maintenance | ✓ | ✓ | ✓ | – | – | – | ✓ | – |
| Log damage / repair | ✓ | ✓ | ✓ | – | – | – | ✓ | – |
| View/edit customers | ✓ | ✓ | ✓ | ✓ | ✓ (billing only) | – | – | – |
| Manage discounts/campaigns | ✓ | ✓ | – | – | – | – | – | – |
| Site content/SEO | ✓ | ✓ | – | – | – | – | – | – |
| Create/disable admin users | ✓ | – | – | – | – | – | – | – |
| Export financials/CSV | ✓ | ✓ | – | – | ✓ | – | – | – |
| View audit logs | ✓ | ✓ | – | – | – | – | – | – |

This is worth treating as a genuine roadmap item once the admin headcount grows past "one or two trusted owners" — today, with a small trusted team, the single-role model is a reasonable and honest tradeoff (not every small business needs RBAC on day one), but it should not be load-bearing if the team grows or a driver/subcontractor ever needs system access.

---

## 12. Dashboard Audit

**Currently shown** (`AdminDashboard.tsx`, verified against the actual `useMemo` blocks): total revenue + paid revenue (server-aggregated, correctly avoiding the pagination under-count bug that would otherwise hit a >100-order store — `AdminDashboard.tsx:35-46`), active rentals (`Goedgekeurd`+`Onderweg` count), pending count (`In behandeling`), 6-month revenue trend, fleet composition by category, customer-profile revenue breakdown (painter/gardener/window-cleaner/contractor/individual), 90-day machine utilization (days rented / 90 × 100%, top 10).

This is a genuinely useful, non-vanity KPI set — utilization-by-machine and profile-revenue-breakdown in particular are operationally actionable, not decorative.

**Missing, evaluated against what the data model can *actually* support today (not the brief's full wishlist, since some of it requires states that don't exist yet):**

| Brief's suggested KPI | Can it be built today? |
|---|---|
| Today's deliveries / today's pickups | Data exists (`AdminPlanning.tsx` already computes this) — just not surfaced as a Dashboard tile, it's siloed in its own panel. Cheap win. |
| Active rentals | Already present. |
| Overdue rentals | **Cannot be built without an `OVERDUE` state or an `endDate`-vs-today comparison against `Onderweg` orders** (§3) — currently no query for this exists anywhere in the codebase. |
| Available machines (right now) | Not directly surfaced — computable from `stockQuantity` minus active-order concurrency per machine, but no such tile exists today. |
| Machines in maintenance | **Cannot be built** — no structured maintenance state exists to count (§9); would require counting `BlockedDate` rows with maintenance-flavored reasons, which is a heuristic on free text, not a real query. |
| Revenue today / this month | Partially — 6-month trend exists, a literal "today" tile doesn't but is a trivial addition given the data's already aggregated server-side. |
| Upcoming reservations | Not on Dashboard (exists implicitly in AdminOrders' filterable list). |
| Utilization rate | Already present, well-built. |
| Most rented equipment | Derivable from the existing utilization computation (already sorts by days), not currently surfaced as its own tile but nearly free to add. |
| Revenue by category | Fleet composition by category exists (counts); revenue-by-category specifically does not (only revenue-by-customer-profile does). |
| Cancellation rate | Not shown — trivially computable (`Geannuleerd` count / total) from data already in the store, cheap addition. |

**Assessment:** the existing dashboard reflects real engineering care (server-side aggregation to fix a pagination bug is not something you do for a vanity dashboard). The missing tiles split cleanly into "cheap, data already exists" (today's deliveries, cancellation rate, revenue-by-category, most-rented) versus "needs a lifecycle gap closed first" (overdue rentals, machines in maintenance) — see roadmap.

---

## 13. Missing Features (Consolidated)

Pulling together everything found above, ranked by how structurally deep the gap is (not yet priority-ranked — see §17 for that):

1. Damage tracking (§9) — no model, no workflow, no block-on-damage.
2. Structured maintenance (§9) — free-text blocked-date reason only.
3. Return/inspection lifecycle step (§3) — `Voltooid` is one click from `Onderweg`.
4. Overdue-rental detection (§3, §12).
5. Individual physical-unit identity within a `stockQuantity` pool (§4, §5).
6. Driver assignment / delivery operations (§8) — `driverCost` is vestigial.
7. Delivery proof (signature/photos) (§8).
8. Company/multi-user account model (§10).
9. Role-based access control beyond the single flat `admin` role (§11) — explicitly a known, documented tradeoff, not a surprise.
10. Order-level internal notes field (§7).
11. Machine-level operational status (available/in-repair/retired) distinct from catalog `isActive` (§4).
12. Certification/inspection-date tracking on machines (§4) — notable given the equipment category (aerial lifts) typically has real legal inspection requirements.

---

## 14. Dangerous Business Logic

Most of what a first-pass audit would normally flag here (client-trusted totals, missing server-side re-validation on edit, race conditions on double-booking, unbounded audit-log growth, secrets in plaintext) has **already been addressed** in this codebase — worth stating plainly since a reflexive "here's what's dangerous" section would otherwise misrepresent a system that's had real security attention:

- Serializable transactions close the double-booking race (`assertMachineAvailableInTx`, both create and PATCH paths).
- Client-submitted totals are never trusted — recomputed server-side every time (§6).
- `driverCost` client input is explicitly rejected if non-zero rather than silently ignored (`orders.ts:459-462`) — a deliberate anti-tampering check, not an oversight.
- Reset/verification tokens are sha256-hashed at rest, not stored plaintext.
- Audit log retention is bounded (180-day prune) rather than growing forever.

**What genuinely remains dangerous, given everything above:**

1. **Damage/condition has zero enforcement power over availability** (§9) — this is the one finding in this entire audit that rises to a genuine safety concern rather than a data-completeness one, because the equipment category is aerial/lifting platforms. A silent gap here isn't just a UX inconvenience, it's an equipment-safety exposure.
2. **Late returns are invisible to the availability engine** (§5, scenario 4) — the specific sequence "rental physically overruns → next customer's booking window starts before an admin manually notices and blocks the date → double-booked machine" is not prevented by anything in the current design, because overlap math trusts `endDate` as declared, not as fulfilled.
3. **Payment confirmation is a single manual boolean flip** (`paymentStatus = "paid"`) with no reconciliation against an actual payment record — this is a known, accepted tradeoff for a WhatsApp/Tikkie-driven small business (not a bug), but it means the `Goedgekeurd` gate (§3) is only as reliable as the admin's diligence in checking the actual bank/Tikkie app before clicking the button. No system-level evidence trail ties a specific `paid` flip to a specific payment.

---

## 15. Data Integrity Risks

1. **`stockQuantity` vs. individual-unit reality** (§4/§5) — the model can go inconsistent the moment two units of the same machine diverge in condition (one damaged, one fine) since only one shared `BlockedDate`/`isActive` surface exists per catalog row.
2. **`profile` as a matched free-text field, not an enum** (`AdminDashboard.tsx:88-95`) — the profile-revenue breakdown does substring matching (`.includes("schilder")` etc.) against free text, so a typo or an unlisted profession silently falls into the `Particulier` bucket rather than erroring — a quiet miscategorization risk in a KPI that's presumably used for actual business decisions (which trade to market to).
3. **`BlockedDate.reason` free text used as a de facto categorical field** (§9) for maintenance vs. other blocks — any future report that needs to distinguish "days lost to maintenance" from "days blocked for other reasons" is querying unstructured strings, not a category.
4. **`specs`/`additionalImages` as loose `Json?`** (§4) — no schema validation on write beyond whatever the admin form happens to enforce client-side; a future direct-DB edit or API misuse could store malformed JSON that only surfaces as a rendering bug later, not a write-time error.
5. **`Notification` model is dead code with no reader/writer** (`prisma/schema.prisma:301-314`, self-documented as unused) — not a risk today, but a trap for a future contributor who might build against it assuming it's live, or assume in-app notifications exist when they don't.
6. **`menuAdvisorLabel` on `SiteConfig`** — same pattern, explicitly commented as a legacy/unused column kept only to avoid a destructive `db push`. Both of these point to a broader small risk: the "kept but dead" columns are correctly commented today, but nothing *enforces* that discipline going forward as the schema accumulates more of them (see the `docs/P0-schema-migratie-plan.md` already in this repo, which is the right long-term fix — moving off `db push` onto real migrations — but is explicitly not yet executed).

---

## 16. Recommended Admin Information Architecture

Target structure — additions marked **NEW**, existing panels kept as-is unless noted:

```
Dashboard
├── Today's Ops (NEW tile group: deliveries, pickups, overdue, machines in maintenance)
├── Revenue & Utilization (existing — keep as-is, it's good)

Reservations (rename from "Orders" once lifecycle states are richer)
├── List / filter / detail (existing)
├── Return & Inspection (NEW — the Voltooid gate, §3/§9)
└── Overdue (NEW filtered view once OVERDUE state exists)

Fleet (rename from "Machines" — reflects unit-level tracking once added)
├── Catalog (existing AdminMachines/AdminAddMachine — pricing/marketing fields)
├── Units (NEW — per-serial-number status, only needed once stockQuantity > 1 units
│         need independent tracking; not urgent at current fleet size)
├── Maintenance (NEW — structured, replacing the BlockedDate-reason workaround)
└── Damage (NEW — the highest-priority addition in this whole audit, §9)

Availability / Calendar (existing — keep)

Logistics (rename/expand from "Planning")
├── Departures/Returns (existing, unchanged)
├── Driver Assignment (NEW, only if/when a second driver exists — not urgent solo)
└── Delivery Proof (NEW — signature/photo capture)

Customers
├── Individuals (existing AdminCustomers)
└── Companies (NEW — only once real multi-seat B2B accounts are needed, §10)

Pricing & Discounts (rename from split Customizer/Content pricing bits into one place —
                      today it's correctly *implemented* as one source but *presented*
                      across Customizer/Content/Machines, which is a minor navigation gap)

Invoices & Payments (NEW as a real module — currently invoice is print-only,
                      payment is a boolean; not urgent while WhatsApp/Tikkie
                      manual flow works, but worth a ledger if volume grows)

Content (existing AdminContent — keep)
Accounting / Reports (expand — add ops reports beyond revenue, §12)
Beheerders / Users (existing — add role field once RBAC is built, §11)
Logs (existing — keep, it's solid)
Diagnostics (existing — keep)
```

The guiding principle: **don't restructure navigation ahead of the underlying data model.** Several of the "NEW" panels above (Damage, Maintenance, Units) are only worth building as dedicated panels once the schema behind them exists — building the UI first would just be a form over nothing.

---

## 17. Prioritized Implementation Roadmap

**P0 — Business-critical**

- **Damage tracking + block-on-damage.** Add a `DamageReport` model (order/machine/customer linkage, description, photos, repair cost, resolved flag) and a machine-level "unavailable due to damage" mechanism that the availability engine actually respects — right now this is the one gap in the whole audit with real safety exposure given the equipment category (§9, §14.1).
- **Return/inspection step before a rental fully closes.** Split `Voltooid` into `RETURNED` (physically back, unverified) → `INSPECTION_REQUIRED` → `Voltooid`/`DAMAGE_REPORTED`, so the availability engine has a real signal to hold the slot rather than "one manual click closes everything" (§3, ties directly into the Damage item above — they should ship together).

**P1 — High operational impact**

- **Overdue-rental detection.** Add an `OVERDUE` check (cron or on-read) comparing `Onderweg` orders' `endDate` against now, surfaced on Dashboard and Planning (§3, §12, §14.2 — this is also what closes the late-return double-booking exposure once combined with the availability engine actually consulting it).
- **Structured maintenance module**, replacing the `BlockedDate.reason` free-text workaround — a real `MaintenanceEvent` model with scheduled/completed dates and cost, reportable (§9).
- **Machine-level operational status** (available/in_repair/retired) distinct from `isActive` (catalog visibility) — needed as the foundation both the Damage and Maintenance items above sit on top of (§4).
- **Dashboard cheap wins**: today's deliveries/pickups (data already exists in `AdminPlanning`, just needs a tile), cancellation rate, revenue-by-category, most-rented-equipment tile (§12 — all computable from existing data with no schema change).

**P2 — Important improvements**

- **Individual physical-unit identity** for machines with `stockQuantity > 1` (serial number, per-unit status) — only urgent once the fleet has enough duplicate-model units that "which specific one" starts mattering operationally (§4, §5).
- **Order-level internal notes field** — cheap schema addition, clear operational value (§7, §10).
- **Company/multi-user CRM model** — build when a real multi-seat B2B customer actually needs it, not speculatively (§10).
- **Driver assignment + delivery proof (signature/photo)** — build once there's more than one driver/vehicle in rotation; today's solo-operator reality doesn't need it yet (§8).
- **Role-based access control** beyond the flat `admin` role — build when the admin headcount grows past a small trusted circle; today's compensating controls (short JWT expiry, 2FA, full audit trail) are a reasonable stand-in (§11).

**P3 — Future enhancement**

- Certification/inspection-date tracking on machines, with a booking-time block if lapsed — valuable once the business wants system-enforced compliance rather than manual awareness (§4).
- Delivery-zone/distance-based fee calculation, route planning (§8).
- Customer/company-specific negotiated pricing (§6, §10).
- Payment-gateway integration replacing the manual WhatsApp/Tikkie + boolean-flip flow, once volume justifies it (§14.3).
- `Machine`/`MachineUnit` schema split (§4) — the deeper structural version of the P2 unit-identity item, appropriate once fleet scale actually demands it rather than ahead of need.
- Complete the schema-hardening migration already scoped in `docs/P0-schema-migratie-plan.md` (Float→Decimal, String→enum via `prisma migrate`) — listed here as P3 only relative to *this* audit's operational findings; that document itself frames it as P0 for data-correctness reasons, and the two priority scales shouldn't be conflated.

---

## Summary

The parts of this system that have had focused engineering attention — pricing (§6), availability/double-booking prevention (§5), audit logging (§14), and dashboard aggregation correctness (§12) — are genuinely well-built, with evidence of real bugs having been found and fixed (the pagination under-count, the O(n²) blocked-date scan, the double-booking race). The parts that haven't been built yet are consistently the ones outside the booking-and-payment core: what happens to a *physical machine* after it comes back (§3, §9), who's allowed to do what inside the admin console (§11), and the operational logistics of actually getting equipment to and from a job site (§8). None of that is a surprise for a system that grew around "get bookings and payment working correctly first" — but the damage/inspection gap specifically (§9, §14.1) is the one item in this audit that should not wait for a natural growth trigger, given the equipment category.
