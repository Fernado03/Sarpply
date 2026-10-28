# Phase 2 Spec — Sarpply Operations Ledger

**Status:** draft for review · **Gate:** cleared (`ADR-0009`) on measured data, 2026-10-15 and 2026-10-22
**Supersedes:** the Google Sheets workbook `Sarpply_Phase_1_Tracking_Sheet_Master.xlsx`

---

## Problem Statement

The Founder runs a Route of 9 Stalls with one Runner, and the business now clears its own commercial gate. But the only system of record is a spreadsheet that cannot be trusted with money.

Two weeks of live trading exposed why. The workbook holds one global cost per SKU (`0_SKU`) and a separate carton cost per purchase order (`3_PO`). They agree today only because both were typed from the same invoice. Perturbing one SKU by RM 8 in Batch 2 alone drives the workbook's own identity check to **+16.00** — a false alarm indistinguishable from a real ledger error. Worse, correcting `0_SKU` for a new batch silently rewrites the *previous* batch's gross profit, so last week's gate result changes after the fact.

That matters more than it sounds, because the margin is thin. Batch 1 cleared the RM 150 gate by **RM 17.00**, and a **1.14%** Wholesaler price rise erases it — about RM 1.54 on a RM 135.00 Master Carton. The Founder needs to know, before a cutoff rather than after a Thursday, that the week is about to fail.

Three other failures are structural rather than arithmetical:

- **Buffer Stock is a paste-as-values cell.** It is the only carryover between batches, it moved by RM 145.50 in one week, and it moves more than the weekly profit.
- **Nothing enforces the order lifecycle.** A delivery can be recorded for a Stall that never ordered; a DuitNow payment can exist with no proof; a Stall can be delivered more than it ordered.
- **The gate itself is a hand-copied number.** The verdict that authorises engineering is computed by a formula a human can overwrite.

The Founder is the only operator. There is no team, no support desk, and no second pair of eyes.

## Solution

A single-writer operations ledger for one Route, backed by PostgreSQL, with a small operator console the Founder drives on a phone or laptop during the shift.

The ledger is the product. Every rule that decides money lives in the database as a constraint, a function or a view — not in application code and not in a spreadsheet — so that the same question asked from the console, from a report, or from a future integration returns the same answer.

Five operations cover the week:

1. **Intake** — record Stall orders as they arrive by WhatsApp, in free text or voice, and turn them into ordered Bundles.
2. **Cutoff** — freeze the week: snapshot the prices in force, compute the Master Carton plan net of Buffer Stock, lock the order book.
3. **Purchase** — raise one Wholesaler PO, then record what actually arrived at the loading bay.
4. **Deliver** — record delivered Bundles per Stall and the payment attestation, and echo a receipt.
5. **Reconcile** — publish Forecast GP, Realized GP and Net Batch Cash Flow, prove the identity holds, and report gate headroom.

Phase 2 does **not** replace WhatsApp, does not talk to Stalls directly, and does not attempt speech recognition.

## User Stories

### Order intake

1. As the Founder, I want to paste a Stall's WhatsApp reply as raw text, so that I do not retype orders into cells during a busy shift.
2. As the Founder, I want a pasted message parsed into draft order lines with the SKU code and quantity I can see and correct, so that a parse failure never becomes a wrong delivery.
3. As the Founder, I want the parser to accept mixed text in Malay, English and Chinese, so that a Stall writing "A1 x 3, C1 2" and one writing "3 kotak A1" both work.
4. As the Founder, I want an unrecognised word to leave a blank line for me to fill rather than silently discarding it, so that orders are never lost to a parse gap.
5. As the Founder, I want to attach a voice note to a Stall's order and have the order stay in an unconfirmed draft state until I read it back, so that no automated transcription can ever commit an order (`ADR-0014`).
6. As the Founder, I want the read-back rendered in the Stall's `written_language`, so that the confirmation is actually readable by them.
7. As the Founder, I want an order to commit only when the Stall replies with an explicit confirmation token or I approve it myself, so that silence is never consent.
8. As the Founder, I want to see which orders are still unconfirmed as cutoff approaches, so that I can chase them before the book locks.
9. As the Founder, I want Spot Sales recorded as their own orders, so that a walk-up sale never mutates a Preorder that has already been priced.
10. As the Founder, I want to record a Spot Sale without a phone number, so that a walk-up Stall can buy without becoming a registered Stall first.
11. As the Founder, I want to right-size a Stall's order at the stall when they have less cash than they ordered, so that a partial sale is recorded honestly instead of being faked as a short delivery.
12. As the Founder, I want each order line to record whether it came from text, voice or the stall, so that after a month I can tell whether voice ordering is worth building for.

### Cutoff and pricing

13. As the Founder, I want cutoff to fire automatically when the Route's cut-off day and time pass, so that I do not have to remember to press a button.
14. As the Founder, I want cutoff to be safe to trigger twice, so that a retry cannot double-price or double-order anything.
15. As the Founder, I want every price locked at cutoff and immutable afterwards, so that correcting a supplier price next week cannot rewrite last week's gross profit (`ADR-0008`).
16. As the Founder, I want the batch's Master Carton plan computed net of the Buffer Stock I already hold, so that I buy the shortfall rather than the whole week's demand again.
17. As the Founder, I want to see the carton plan as a purchase list I can hand to the Wholesaler, so that I do not recompute by hand.
18. As the Founder, I want to know the cash I must bring to the loading bay before I leave, so that I do not arrive short.
19. As the Founder, I want to see which Stalls have not ordered by cutoff, so that I can decide whether to call them.

### Purchase and receipt

20. As the Founder, I want to record cartons ordered and cartons actually received as separate numbers per SKU, so that a short Wholesaler delivery is visible rather than absorbed (`ADR-0011`).
21. As the Founder, I want the PO's cash figure derived from what I received, not what I ordered, so that the cash I hand over matches the goods in the vehicle.
22. As the Founder, I want received cartons added to the Buffer Stock ledger as an immutable movement, so that stock and money can never drift apart (`ADR-0007`).
23. As the Founder, I want to record which vehicle carried the batch, so that stock ownership is attributed to a vehicle and not to a warehouse I do not have (`ADR-0003`).
24. As the Founder, I want the system to refuse a purchase plan that does not fit the chosen vehicle, so that I do not discover the overflow at the loading bay.
25. As the Founder, I want the capacity check to use measured packing efficiency, so that it does not reject a load that in reality fits (measured: 980 L into a 980 L Myvi).

### Delivery and payment

26. As the Runner, I want to record delivered Bundles per Stall and nothing else, so that I cannot alter what was ordered or at what price (`ADR-0012`).
27. As the Runner, I want to mark a Stall's payment as cash, DuitNow or unpaid, so that the attestation is captured at the point of handover.
28. As the Runner, I want DuitNow payments to require a reference and a proof link, so that an unattested digital payment cannot be recorded as paid (`ADR-0001`).
29. As the Runner, I want the system to refuse a delivery larger than the order, so that a typo cannot inflate delivered GMV.
30. As the Runner, I want to send a Stall a receipt echo of what was delivered and what was paid, so that the Stall has a record and the Founder has an audit trail.
31. As the Founder, I want a Stall partially delivered because of a shortfall to be recorded as partial, not as delivered, so that Realized GP reflects Bundles that actually changed hands (`ADR-0010`).
32. As the Founder, I want uncollected orders to be recordable, so that a Stall who did not open is not counted as a sale.
33. As the Founder, I want the shortage to be allocated by Trust Tier when stock runs out, so that the decision is a rule rather than an argument at the stall (`ADR-0011`).

### Reconciliation and the gate

34. As the Founder, I want Forecast GP, Realized GP and Net Batch Cash Flow published as three separate numbers, so that I stop conflating profit with cash.
35. As the Founder, I want the identity check to run on every reconciliation and fail loudly, so that a ledger bug is caught the week it happens (`ADR-0010`).
36. As the Founder, I want the identity to hold across weeks with carried Buffer Stock, so that a week selling down last week's stock is not reported as new profit.
37. As the Founder, I want to see gate headroom in percent of delivery cost, so that I know how much Wholesaler increase the batch can absorb.
38. As the Founder, I want a warning before cutoff when headroom falls below a configured floor, so that I can add volume or renegotiate before the week fails.
39. As the Founder, I want the gate verdict computed from delivered Bundles and never from forecasts, so that the Phase 2 decision rests on measured economics (`ADR-0009`).
40. As the Founder, I want the verdict to distinguish a volume failure from a margin failure, so that I know whether to recruit Stalls or renegotiate cost.
41. As the Founder, I want the full audit trail retained — every price, receipt and attestation — so that I can reconstruct any week months later.
42. As the Founder, I want voice notes deleted seven days after reconciliation, so that I hold the minimum personal data necessary (`ADR-0017`).

### Operator surface

43. As the Founder, I want a single screen showing the batch's state and the next action, so that I do not hunt through tabs mid-shift.
44. As the Founder, I want the console to work on a phone at a loading bay, so that it is usable one-handed while carrying cartons.
45. As the Founder, I want to correct a mistaken entry before reconciliation and have it audited, so that a typo is fixable but never silent.
46. As the Founder, I want the per-Stall GMV visible, so that I can see which Stalls are below the line that makes their stop worth taking.

## Implementation Decisions

### The database is the system of record

Every rule that decides money lives in PostgreSQL: constraints, `fn_freeze_prices`, `fn_receive_po`, `fn_record_delivery`, `fn_reconcile_batch`, and the `v_*` views. Application code orchestrates and renders; it never recomputes GP, buffer balances or the identity.

This is the direct answer to the workbook's failure mode. A spreadsheet can hold two disagreeing copies of a cost; a schema with one `route_batch_prices` row per SKU per batch cannot.

### Prices are per batch, never global

`wholesaler_prices` and `pool_prices` carry validity windows. At cutoff, `fn_freeze_prices` copies the prices in force into `route_batch_prices`, which is append-only. Nothing reads a live price when computing a past batch's margin.

**Explicitly rejected:** a single mutable `skus.carton_cost`. That is the defect being replaced.

### Three margin figures, one identity

Forecast GP (ordered), Realized GP (delivered, including Spot Sales), and Net Batch Cash Flow (cash). They reconcile by:

```
Realized GP − (closing Buffer at cost − opening Buffer at cost) − Sortie cost = Net Batch Cash Flow
```

Both terms are load-bearing. The Runner is already deducted from cash and must be deducted on the left; the opening Buffer must be subtracted because a sell-down week legitimately shows more cash than profit. Reconciliation publishes the residual as a first-class number that must read zero to the cent.

### Gate headroom is a product feature

`headroom = (Realized GP − 150) / cost of delivered Bundles`.

Two weeks of data put that at 1.14% and 2.19%. A number with that little slack decides whether the business continues, so it belongs in the console next to the GP, with a configurable warning floor, not in a spreadsheet cell.

### Vehicle capacity is measured, and configurable

`vehicles.packing_efficiency` defaults to **0.92** and `vehicles.max_cargo_liters` for the Myvi is **980**, reflecting the loading configuration actually used (rear bench folded and front passenger seat occupied). The v1.1 constant of 0.80 overstated packed volume by 15% and would have rejected a load that fit.

`sorties` are not a table: a batch has `sortie_count`, and each Cluster names the Sortie that serves it via `trip_number`. Several Clusters may share one Sortie — at 9 Stalls both do — and `UNIQUE (route_id, trip_number)` must not be reintroduced.

### Order lifecycle is enforced, not documented

`ordered_bundles` is frozen after cutoff. The Runner may change only `delivered_bundles`, `fulfilment_status`, `payment_status`, `payment_reference`, `payment_proof_url`, `payment_attested_at` and `attested_by`. Enforced by column-level grants rather than a self-referencing row policy.

`payment_status` and `fulfilment_status` are orthogonal (`ADR-0002`). `order_type` distinguishes Preorder from Spot; a Spot Sale is a new row, never a mutation.

### Voice never commits an order

Inbound voice produces `UNCONFIRMED_VOICE_DRAFT`. A read-back in the Stall's `written_language` must be confirmed by an explicit token (`OK`, `YA`, `YES`, `1`, `好`, `对`) or Founder approval. No automatic transcription commits anything (`ADR-0014`).

Measured reality: three voice orders in two weeks, two of which needed a phone call in week 1. Phase 2 builds the draft-and-confirm state machine but not the speech recognition.

### Inventory is an append-only ledger

`stock_movements` is append-only with an `idempotency_key`. Balances are a derived view (`v_buffer_balance`), never a stored column (`ADR-0007`). Every function that writes stock must be safe to re-run.

### Trust Tier, not prepayment

`ANCHOR_PRIORITY` → `COD_APPROVED` → `PROVISIONAL`, plus `SUSPENDED`. There is no `PREPAY_REQUIRED` and no prepayment flow. Shortfalls are rationed down the tier order (`ADR-0011`).

### Scaffolding to delete

`basket_tier` is not modelled. Measured baskets run RM 50–348 continuously; three tiers do not exist. Store quantities, derive everything else.

## Testing Decisions

### One seam: the database

The highest available seam is the PostgreSQL interface itself. Tests call the functions and read the views; nothing tests a Python helper that recomputes SQL logic, because a passing test on the copy says nothing about the original.

A second narrow seam exists for text-order parsing only: a pure function from raw message to candidate order lines, with no database and no network. That seam is justified because the parser has genuine edge cases (Malay, Chinese and English numerals; SKU codes embedded in prose) and no external dependency.

Application code above the database is not unit-tested. It is a renderer.

### What makes a good test here

Test **external behaviour of a batch**: given these orders, this receipt and these deliveries, the published GP, buffer and cash must equal these numbers. Do not test that a function calls another function, that a column exists, or that a view returns a column with the right name.

### Required tests

1. **Golden replay.** Two tests, one per measured batch. Replaying B01 from the workbook must yield exactly 13 cartons, 18 boxes, 901.5 L, Forecast GP RM 173.00, Realized GP RM 167.00, buffer RM 183.00, Net Batch Cash Flow −RM 58.50 and identity 0.000000. B02 must yield RM 1,896.00 / RM 187.50 / RM 37.50 / +RM 290.50. These are the regression tests for the entire economic model.
2. **Multi-batch identity, including a sell-down.** Three or more batches where the buffer is built and then drawn down. This is the test that caught the original identity defect, and it passes trivially on a single batch.
3. **Price immutability.** Freeze a batch, then change the Wholesaler price. The batch's Realized GP must not move.
4. **Idempotency.** `fn_receive_po`, `fn_record_delivery` and `fn_reconcile_batch` re-run must produce zero extra movements and an unchanged buffer.
5. **Constraint rejection.** DuitNow without proof; delivered greater than ordered; an active Stall with no phone; an invalid Trust Tier; an inconsistent `fulfilment_status`; an unsupported `written_language`. Each must be refused by the database, not by the UI.
6. **Sortie capacity.** A batch whose cartons exceed the vehicle must be refused; the measured B01 load of 979.9 L against a 980 L Myvi must be accepted.
7. **Shortfall rationing.** Stock short of total demand must allocate by Trust Tier and produce a `PARTIAL` order for the lowest tier.

### Prior art

The schema document's validation record is the template: execute the DDL, replay a batch, and assert the published figures. It already reproduces Batch 1 to the cent against PostgreSQL 16.2, so the harness exists.

## Out of Scope

- **A Stall-facing app or catalogue.** Stalls order by WhatsApp. A catalogue is a different business (`ADR-0004`).
- **Speech recognition or a voice bot.** Three voice orders in two weeks, two needing a human call. Not worth building.
- **DuitNow transaction reconciliation.** A static QR produces no transaction feed. Payment is Runner-Attested, and no feature may imply otherwise (`ADR-0001`).
- **Multi-Route scheduling, route optimisation, or a second Runner.**
- **Perishables, chilled goods, or anything requiring cold chain.**
- **A warehouse.** Buffer Stock is owned per vehicle (`ADR-0003`).
- **Customer credit terms, invoicing, or accounts receivable.**
- **Payroll, tax, or accounting export.**
- **A public website or marketing surface.**

## Further Notes

**The margin is the feature.** At 1.14% headroom, the difference between a business that continues and one that does not is whether a cost change is seen before cutoff. Any implementation decision that makes cost visibility slower is the wrong decision, even if it is simpler.

**Everything here is calibrated to 9 Stalls and one Sortie.** The schema already parameterises `sortie_count`, `packing_efficiency` and vehicle capacity, so growth to 11–12 Stalls should be a data change, not a code change. If it turns out to require a code change, that is a design failure to fix then, not to pre-build for now.

**Two observations is thin evidence.** The 0.92 packing efficiency and the 980 L Myvi capacity come from two shifts. Both are stored as data precisely so that the third and fourth measurements can correct them without a deployment.

**The workbook is retained, not deleted.** `Sarpply_Phase_1_Tracking_Sheet_Master.xlsx` is the primary source for the gate measurement, including the supplier invoices. It stays in the repository as the historical record of how Phase 2 was authorised.
