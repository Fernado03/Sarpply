# Ordered Bundles freeze at Cutoff; payment, fulfilment and Spot Sales are separate facts

`stall_orders.ordered_bundles` is fixed when the batch's Cutoff passes and is what Master Carton aggregation always reads; `delivered_bundles` is a separate column filled in on delivery day. Payment and fulfilment are recorded on two orthogonal axes — `payment_status` ∈ `UNPAID | PAID_CASH | PAID_DUITNOW | VOIDED` and `fulfilment_status` ∈ `PENDING | DELIVERED | PARTIAL | UNCOLLECTED` — rather than one enum that mixed them. A Bundle sold on delivery day to a Stall that did not Preorder it is a new order row with `order_type = 'SPOT'`, not a status mutation on the uncollected order, because it has a different buyer, quantity and payment.

## Considered Options

- **Single status enum including `UNCOLLECTED_BUFFER`** (the original schema) — rejected: it cannot express "uncollected, then bought by the neighbouring stall", and it silently rewrote the purchase order after the cartons were bought.
- **Deleting uncollected rows** — rejected: destroys the record of what was committed and why stock moved.

## Consequences

Aggregation views must never filter on `payment_status` or `fulfilment_status`: a Stall going uncollected on Thursday must not shrink Wednesday's cartons-to-buy. An uncollected Preorder closes as `UNCOLLECTED` + `VOIDED` with `delivered_bundles = 0`, and its Bundles fall back into Buffer Stock or out via a Spot Sale.
