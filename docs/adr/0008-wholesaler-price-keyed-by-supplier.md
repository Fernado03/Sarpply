# Wholesaler price is data, keyed by Wholesaler and SKU with a validity window

`wholesalers` and `wholesaler_prices (wholesaler_id, sku_code, carton_cost, valid_from, valid_to, is_primary)` replace the single frozen `skus.wholesaler_carton_cost` number, and a Wholesaler PO is one record per `(route, wholesaler, delivery_date)` aggregating Master Cartons across every Cluster on the Route. A price column on the SKU was rejected because it cannot represent dual-supplier fallback at all: with one number per SKU, "route this line to the secondary wholesaler" has nowhere to be recorded, and no historical margin can be measured once the number is overwritten.

## Considered Options

- **`skus.wholesaler_carton_cost` + `skus.secondary_carton_cost`** — rejected: it hardcodes exactly two suppliers and still loses price history.
- **Purchase price only on the PO line** — rejected: there is nothing to quote against at cutoff, when the PO has not been raised yet.

## Consequences

Dual-supplier fallback becomes a data lookup rather than an operational promise, and quoted margin spread becomes measurable against the price in force on the cutoff date. Two suppliers, or five, cost the same.
