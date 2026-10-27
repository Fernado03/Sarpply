# Buffer Stock is owned at vehicle level, not per Cluster

Buffer Stock is a single pool per serving vehicle, shared across every Cluster that vehicle serves that week, and never partitioned by Cluster. Master Carton aggregation subtracts one global `S_prev` per SKU, and a leftover Bundle from a Premier 101 rounding can satisfy demand in Gala City on the same run. Per-Cluster buffers were rejected because the same Runner drives one vehicle across clusters, so per-cluster stock would be an accounting fiction that forces the Runner to sort identical bundles into separate piles in a car boot.

## Consequences

A Bundle's Cluster of origin is not tracked, so the P&L cannot attribute Buffer Stock cost to a Cluster. Storage mechanics for the buffer — stored counter versus derived from a movement ledger — are deliberately not decided here.
