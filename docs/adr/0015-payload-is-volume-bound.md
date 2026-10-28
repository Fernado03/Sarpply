# Payload is volume-bound, and vehicle class is decided by Stall count

**Status: amended by Phase 1 measurement.** The original decision assumed a 14-Stall Route and concluded no single MPV trip could carry a gate-clearing load. The measured Route is **9 Stalls**, which fits **one Myvi trip**. The reasoning about volume still holds; the conclusion drawn from it did not.

A Route's Master Cartons are limited by cargo **volume**, not weight — 13 cartons weigh ~150 kg against a 450–550 kg MPV payload. The constraint is litres.

## Measured

Batch 1 loaded **13 Master Cartons / 18 physical boxes / 901.5 L geometric** into a Myvi with the rear bench folded **and the front passenger seat occupied**. Batch 2 loaded **12 cartons / 17 boxes / 825.5 L** and fit cleanly.

**The packing efficiency is 0.92, not 0.80.** The field record shows 901.5 L geometric occupying ~980 L. The original 0.80 divisor would have computed **1,127 L** for that same load and rejected it as impossible — it would have forced a second Sortie that the business did not need and could not afford at RM 42.50.

| Load | Geometric | At 0.80 (modelled) | At 0.92 (measured) |
| :--- | ---: | ---: | ---: |
| B01, 13 cartons | 901.5 L | 1,127 L — rejected | **980 L — fit** |
| B02, 12 cartons | 825.5 L | 1,032 L — rejected | 897 L — fit |

## Considered Options

- **One Myvi trip at 9 Stalls** — 12–13 cartons, 826–902 L geometric, 980 L packed. Clears the gate at RM 167–188 GP. **Accepted.**
- **One Myvi trip at 12–14 Stalls** — needs 1,230–1,318 L geometric. Does not fit. Rejected.
- **A hired van** — ~RM 150/shift against RM 177.25 of measured gross profit. Rejected: it consumes 85% of the margin.
- **Delivering `A1`/`A2` on a separate day** — splits the basket and removes the anchor SKUs. Rejected.

## Consequences

The capacity rule the app enforces is:

```
SUM(cartons × carton_geometric_liters) / packing_efficiency ≤ vehicles.max_cargo_liters
```

`packing_efficiency` is a **column on `vehicles`, defaulting to 0.92** — never a constant in application code. Two observations is thin evidence, and the whole point of the correction is that a hard-coded divisor was wrong by 15%.

**9 Stalls is the Myvi ceiling, and it is also the gate floor.** The two limits meet almost exactly, which is the defining constraint of Phase 2. A tenth Stall needs a second Sortie (adds RM 42.50) or an Avanza-class vehicle.

**`A1`/`A2` ship as two separate boxes** — bodies and lids do not nest. This was the open question that could have halved the vehicle requirement; it is now answered, and it does not.

Weight remains a non-issue. Do not plan vehicles by weight.
