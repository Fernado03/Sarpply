# Buffer Stock is a derived balance over an immutable stock ledger

Every Bundle that enters or leaves Sarpply's control is a row in `stock_movements` with a signed quantity, a movement type, and a unique idempotency key; the current buffer balance per SKU is a view over that ledger, and there is no mutable `current_buffer_bundles` column anywhere. A mutable counter updated by a reconciliation procedure was rejected because it is the most corruption-prone figure in the system: it is global, written procedurally, has no history, and one bad reconcile silently misprices every future batch.

## Considered Options

- **Mutable counter on `skus`, updated by `fn_reconcile_batch`** — the original design. Rejected: unauditable, and a re-run double-applies.
- **Per-batch snapshot table** — rejected: cannot answer "where did this Bundle go" when the counts disagree.

## Consequences

Reconciliation becomes idempotent by construction: the unique idempotency key (`PICKUP:<route_batch>:<sku>` or `DELIVERY:<stall_order>`) makes a repeated run a no-op rather than double-counting. Physical count drift is corrected by `MANUAL_ADJUSTMENT` rows that are visible forever, instead of by overwriting a total. Ledger and view partition by Route/Vehicle, which is the only level at which a Bundle's physical location is known (`ADR-0003`).
