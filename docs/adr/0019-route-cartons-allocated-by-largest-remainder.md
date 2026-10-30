# Route cartons are split across Sorties by largest remainder

**Status: accepted.** This is the only rule that turns the Route-level carton plan into Sortie
loads.

## Decision

Cartons are rounded **once**, at Route level, from Ordered Bundles net of Buffer Stock
(`v_route_batch_aggregation.c_cartons`). They are never re-rounded per Sortie.

`v_sortie_carton_allocation` splits each SKU's Route cartons across the Sorties that serve its
demand:

1. Each Sortie takes `FLOOR(cartons × that Sortie's Ordered Bundles / Route demand)`.
2. The leftover cartons go one each to the Sorties with the largest fractional remainder.
3. A remainder tie goes to the lower `trip_number`.

Every allocated quantity is a whole, non-negative carton, and the allocation always sums to the
Route plan. A Sortie with no demand for a SKU receives none.

`v_sortie_load` checks capacity from those allocated cartons:
`SUM(cartons × carton_geometric_liters) / vehicles.packing_efficiency` against
`vehicles.max_cargo_liters`. `fn_submit_wholesaler_po` refuses the Wholesaler PO while any Sortie
does not fit, before the PO is written.

## Why

Rounding each Sortie separately is not the same purchase. If two Sorties demand 45 Bundles of a
10-Bundle carton, the Route buys 9 cartons (`CEIL(90 / 10)`); per-Sortie rounding buys 10
(`5 + 5`), and the 10-carton load is 1,005.4 L packed — over the measured 980 L Myvi. The Route
would reject a load that actually fits and pay for a carton it does not need.

The measured B01 load is the regression: 13 cartons, 901.5 L geometric, 979.9 L packed at 0.92,
inside the 980 L Myvi. Largest remainder keeps that load at 13 cartons.

## Rejected

- **Per-Sortie rounding.** Overstates the purchase and can reject a load that fits, because
  `CEIL(a/n) + CEIL(b/n) > CEIL((a+b)/n)` whenever both parts have a remainder.
- **Proportional fractional cartons.** A carton cannot be split between two runs; the capacity
  check must use whole cartons that are actually loaded.
- **Balanced split ignoring demand (`10 / 9`).** Deterministic, but it moves cartons away from the
  Sortie whose Stalls ordered them, which only looks balanced when demand is equal.
- **Minimising the heavier Sortie by search.** Correct for one SKU, exponential across six SKUs
  and unnecessary at nine Stalls; the Route is the buying unit (`ADR-0006`), and the fit check is
  the guard.

## Consequences

- The allocation is derived, not stored. It changes only when the Route plan or the batch Vehicle
  changes — both of which are frozen or fixed before PO submission.
- `packed_liters_shared` is retired. The optimistic proportional figure was not a load plan, and
  the check must use the allocation.
- Capacity is evaluated per Route Batch against the batch's confirmed Vehicle, never configured
  once for the Route (`ADR-0015`).
- A Sortie's load can be cheaper to reason about than its demand: a trip may receive a carton for
  a SKU that a neighbouring trip also ordered, because the tie-break is part of the rule.
