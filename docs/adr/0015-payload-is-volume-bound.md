# Payload is volume-bound, and one MPV trip cannot carry a gate-clearing Route

A Route's Master Cartons are limited by cargo **volume**, not weight — 22 cartons weigh ~365 kg against a 450–550 kg MPV payload, but need **1.32 m³** of space at 100 % geometric fill (**1.65 m³ at 80 %**, the realistic packing efficiency). Every documented folded-seat volume in the intended fleet (Alza 498 L with the third row folded, Myvi 800 L with the rear bench folded, Avanza ~1,000 L only with both rear rows down) is below what a Route that clears the RM 150 gross-profit gate requires in a single trip. **A Route shift is therefore two sorties, one per Cluster.**

## Considered Options

- **8 stalls in one Myvi trip** — RM 1,466 GMV / RM 143.50 GP, which fails the gate, and still needs 1,230 L at 80 % fill once `A1`/`A2` lids are counted as the separate cartons they are.
- **12–14 stalls in one trip** — clears the gate at RM 211–253 GP, but needs 1,230–1,318 L geometric, i.e. 1.5–1.6 m³ at 80 %. A hired van at ~RM 150 a shift consumes 59 %–61 % of the Route's gross profit.
- **Two sorties in one existing MPV** — 770 L peak (12-Stall, Myvi), or 869 L + 778 L (14-Stall, Avanza-class). Adds ~1 h and RM 85 of Runner cost, and lands at **RM 125.70–168.40** net.
- **A1/A2 delivered on a separate day** — splits the basket and removes the anchor SKUs that drive adoption.

## Consequences

**Locked as Option 3: two sorties, one per Cluster, in the existing vehicle.** Procurement still pools at Route level (one PO), because rounding across two Clusters saves 3 Master Cartons / RM 347 per week.

The consequence is a hard capacity rule the app must enforce: `SUM(cartons × carton_geometric_liters) / 0.80 ≤ vehicles.max_cargo_liters`. A 14-Stall Route's cartons split 11 / 11 into **869 L and 778 L packed**; the heavier Sortie exceeds a Myvi's 800 L, so that Route requires Avanza-class. A 12-Stall Route's 19 cartons balance to **770 L and 768 L** and fit a Myvi with barely 30 L to spare. Per-Cluster rounding, which assigns each Sortie its own Cluster's cartons, is worse: a 7-Stall Cluster rounds to 12 price units and **911 L**, which fits nothing in the fleet — so the app must allocate cartons across Sorties rather than assume Cluster independence.

Exora folded-seat volume could not be sourced and is treated as **unquantified**, not assumed adequate.

The `A1`/`A2` figures assume containers and lids ship in **two separate cartons** (54.0 L body + 51.8 L lids = 105.8 L per price unit, an **1.63×** understatement versus the nested 64.8 L). This is unverified for the Kuching Wholesaler and is Question 1 on Script A. If they nest, every Route gains one trip's worth of headroom — 22 cartons would drop to ~17 physical boxes and the 14-Stall Route would fit a Myvi. That single answer can halve the vehicle requirement, which is why it must be asked before any vehicle is chosen.
