# Wholesaler shortfall is rationed by Trust Tier, then order time

When `cartons_received` is less than `cartons_ordered` at the 13:30 pickup and Buffer Stock cannot cover the gap, remaining Bundles are allocated across Preorders by Trust Tier first and order creation time second, and affected Stalls are marked `PARTIAL` or `UNCOLLECTED` with `delivered_bundles` recording the truth. First-come-first-served alone was rejected because it lets a Stall that pays late outrank one that has paid reliably for ten weeks, and ad-hoc judgement was rejected because the decision happens in a wholesaler's loading bay with a driver waiting and no time to deliberate.

## Consequences

Trust Tier now carries a real consequence, so it must be maintainable by the Founder rather than decorative. The 60-minute gap between pickup and stall delivery means a shortfall has no time for a secondary-supplier run unless the Runner calls it immediately on counting, so `cartons_received` entry must be a blocking step before the DuitNow transfer is released. Rationing reduces the week's Realized GP, never its Forecast GP, and a Stall shorted twice in a row is the clearest possible signal its tier or its Preorder needs attention.
