# Sortie count follows from Route size, not the other way round

**Status: amended by Phase 1 measurement.** The original decision fixed **two Sorties per Route shift**, one per Cluster, because a 14-Stall Route could not fit one vehicle. The measured Route is **9 Stalls** and is fulfilled in **one Sortie**. Two Sorties remains the correct answer at 12–14 Stalls; it is not a universal rule.

A Route is fulfilled in `n` Sorties from **one** Wholesaler pickup. Procurement always pools at Route level — one Wholesaler PO, one Buffer Stock ledger — and the physical movement then splits by Cluster.

## Measured

Batch 1: 9 Stalls, 13 cartons, **1 Sortie**, Runner **RM 42.50**, shift **3.20 h**.
Batch 2: 9 Stalls, 12 cartons, **1 Sortie**, Runner **RM 42.50**, shift **2.50 h**.

The single Sortie is what makes the measured economics work. At RM 85.00 of Runner cost, Batch 1's Realized GP of RM 167.00 would leave RM 82.00 — and the gate at RM 150 becomes unreachable at 9 Stalls.

## Considered Options

- **One Sortie at 9 Stalls** — RM 42.50, fits a Myvi at 980 L packed. **Accepted at the measured Route size.**
- **Two Sorties at 12–14 Stalls** — RM 85.00, net RM 125.70–168.40 on the modelled baskets. Still correct if the Route grows, but requires a vehicle decision first.
- **One Sortie, hired van** — ~RM 150/shift against RM 177.25 gross profit, leaving RM 27.25. Rejected: it consumes 85% of the margin.
- **One Sortie, shrink to 8 Stalls** — fits, but RM 1,466.20 GMV / RM 143.50 GP fails the gate. Rejected.
- **Fixed two Sorties regardless of size** — rejected after measurement: it would have cost RM 42.50 per shift for a second trip that never happened.

## Consequences

**The Runner is paid per Sortie (RM 42.50), and `sortie_count` is a per-batch fact, not a route constant.** The schema already stores it this way; what changes is that the seed sets `routes.sortie_count = 1` and the Myvi, not 2 and the Avanza.

Sortie count is now an **output** of the capacity check in `ADR-0015`, not an input. A Route grows until the cartons no longer fit one vehicle, and only then does a second Sortie appear.

A Cluster carries a `trip_number` naming the Sortie that serves it. At 9 Stalls both Clusters share Sortie 1, so `trip_number` is 1 for both — which is the degenerate case and must not be treated as an error.

**Never hard-code 1 or 2.** The measured business is one Sortie today and two Sorties at 11+ Stalls, and the difference is RM 42.50 of margin per shift — more than the entire gate headroom.
