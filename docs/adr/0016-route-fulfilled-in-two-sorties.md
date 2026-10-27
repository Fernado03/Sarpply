# A Route shift is two Sorties, one per Cluster

A Route is fulfilled in **two collection-and-delivery Sorties** from one Wholesaler pickup, one per Cluster, rather than a single delivery pass. Procurement still pools at Route level — one Wholesaler PO, one Buffer Stock — but the physical movement splits because a gate-clearing Route's 22 Master Cartons pack to **1,318 L geometric**, which is **824 L per Sortie at 80 % fill on average, but 869 L and 778 L in the real 11/11 carton split**, and no vehicle in the intended fleet carries the whole load in one trip (`ADR-0015`).

## Considered Options

- **One Sortie, hired van** — ~RM 150/shift, 59 % of the Route's RM 253.40 gross profit, leaving RM 103.40 net. Rejected: it pays more for the same goods movement than the alternative and puts a recurring RM 150 line on a business with no pricing power.
- **One Sortie, shrink the Route to 8 Stalls** — fits a Myvi in one trip but fails the RM 1,500 / RM 150 gate at RM 1,466.20 GMV and RM 143.50 GP. Rejected: it deletes the business model to save a trip.
- **Two Sorties, existing MPV** — RM 85 per shift (2 × RM 42.50), net RM 125.70 (12 Stalls, Myvi) to RM 168.40 (14 Stalls, Avanza-class). Accepted.

## Consequences

The Runner is paid **per Sortie (RM 42.50)**, not per shift, so the cost scales honestly if a Route ever needs three. A shift is **2.75 hours**, not the 2 hours previously budgeted.

Sortie capacity becomes a hard constraint the app must enforce — `SUM(cartons × carton_geometric_liters) / 0.80 ≤ vehicles.max_cargo_liters` — and a Cluster carries a `trip_number` naming the Sortie that serves it. A Myvi serves a 12-Stall Route whose 19 cartons balance to 770 L / 768 L — with only 30 L to spare. A 14-Stall Route's 22 cartons split 11/11 into 869 L / 778 L, and the heavier Sortie needs Avanza-class. A Cluster that grows past its vehicle must be split into a third Sortie or closed to new Stalls, never silently overfilled.

The two Clusters need not be served in a fixed order, but they must share one pickup, because Buffer Stock is held per Vehicle and re-splitting it across vehicles would break the ledger's per-vehicle ownership rule (`ADR-0003`).
