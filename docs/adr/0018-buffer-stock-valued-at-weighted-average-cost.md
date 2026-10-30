# Buffer Stock is valued at moving weighted-average cost

**Status: accepted.** This is the single valuation rule the ledger uses.

## Decision

Every `stock_movements` row records `unit_cost_myr`, the cost of one Bundle at the moment the
movement was posted:

- **Purchases** carry the invoice cost divided by the Master Carton Ratio.
- **Outbound movements** (delivery, spot sale, write-off, manual adjustment) carry the moving
  weighted-average cost of the balance immediately before the movement:
  `SUM(quantity × unit_cost) / SUM(quantity)` over the `(sku_code, vehicle_id)` balance.
- Buffer value is `SUM(quantity_bundles × unit_cost_myr)`. Nothing stores a balance column.

The rule is applied by the operation that posts the movement, not by a view that re-derives cost
after the fact. `v_buffer_balance` and `v_batch_buffer` only aggregate what the ledger recorded.

## Why

The reconciliation identity is only solvable if the closing Buffer Stock cost is built from the
same postings as Realized GP. A per-batch cost rule would reprice Bundles drawn from an earlier
batch at the current week's cost, so a sell-down week would show profit that the stock did not
earn. `ADR-0010` already requires the identity to hold across weeks with carried stock.

## Rejected

- **Value at the batch's locked carton cost.** Simple, but restates old stock at this week's
  price; a price change then moves a margin the batch did not earn.
- **FIFO layers.** More faithful to physical flow, but needs lot tracking and a second table;
  Phase 2 buys one Wholesaler PO per batch and cannot distinguish layers in the vehicle.
- **A stored `current_buffer_bundles` or value column.** The v1.0 defect; history and audit are
  lost and the counter drifts from the ledger.

## Consequences

- Receipts and outbound movements must both be posted inside one transaction with the balance
  locked, so two concurrent movements cannot read the same average.
- A receipt changes the average for **future** outbound movements only. It does not revalue stock
  already recorded.
- `scripts/lib/fixtures.ts` posts B01 and B02 through this rule, which is why the B01 closing value is
  RM 183.00 and B02's is RM 37.50.
