# Route, not Cluster, is the unit of delivery and purchase

A Route is two adjacent Clusters served in a single shift by one Vehicle. Master Cartons are bought, Wholesaler POs are raised, Buffer Stock is held, and the commercial gate is measured per Route, while Stalls still belong to a Cluster. A Cluster-only model was rejected on measured arithmetic: an 8-stall Cluster at realistic basket tiers yields RM 1,466 GMV and RM 143.50 gross profit, which fails the RM 1,500 / RM 150 gate before the Runner is paid, and reaching the gate inside a single kopitiam would require 12–14 of its 40 stalls rather than the validated ~20%.

## Consequences

Rounding across two Clusters cancels their fractional cartons before ceiling: the same demand buys **22 Master Cartons at Route level versus 24 bought per Cluster**, saving RM 258 of cash per week (`A2` and `C1` each round up once instead of twice) and cutting steady-state Buffer Stock from **30 Bundles to 10**. The saving grows with Cluster count, not with Route size — it is two fractional cartons per extra boundary.

Procurement and cash pool at Route level, but **fulfilment splits by Cluster**: a Route is served in two **Sorties**, because 22 Master Cartons in one load exceed every vehicle in the fleet (`ADR-0015`). Each Cluster therefore carries a `trip_number` naming the sortie that serves it. One Wholesaler PO, one set of Buffer Stock, two delivery passes — the Route is one commercial unit with two physical movements.
