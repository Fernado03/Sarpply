---
project: Sarpply
pillar: 03_Unit_Economics
version: 1.1-MVP
currency: MYR
operating_unit: Route (2 Clusters, 12-14 Stalls, 2 sorties per shift)
target_route_gmv_myr: 2603.60
target_route_realized_gp_myr: 253.40
runner_cost_per_sortie_myr: 42.50
supersedes: v1.0 (8-stall cluster, RM 250 AOV, RM 2,000 batch, 15-20% spread, RM 45/trip, RM 6,200/mo)
---

# Sarpply — Pillar 3: Unit Economics & Pricing Engine

> **Terminology.** `GLOSSARY.md` is canonical: **Stall** (buyer), **Wholesaler** (supplier), **Bundle** (sell unit), **Master Carton** (buy unit), **Cluster** (~6–7 Stalls), **Route** (2 Clusters, the paid operating unit), **Buffer Stock** (leftover bundles carried at cost), **Realized GP** (margin on Delivered Bundles).

## 1. Thesis

Traditional B2B grocery distribution fails at the micro-Stall level because delivering heavy, price-controlled staples (subsidised cooking oil, flour — 2%–4% margins) across scattered streets costs RM 80–110 in multi-drop transport, wiping out a 6% spread.

**Sarpply survives on two multipliers, and only two:**

1. **Density.** 12–14 Stalls in two Clusters 6–8 minutes apart, cleared in a single 3-hour shift.
2. **Spread on light, high-value consumables.** Packaging and back-of-house consumables carry a **7.9%–11.5%** margin (blended **9.73%**), at only **291–365 kg per Route**.

**What v1.0 got wrong, corrected here.** v1.0 claimed a "15%–20% wholesale spread", "RM 35–45" logistics, "120–180 kg per RM 2,000 batch", a 6-month path to "RM 6,200/month" on 40 batches, and an 8-Stall "single drop-off" cluster. Every one of those numbers was wrong:

| v1.0 claim | Verified figure | Where it breaks |
| :--- | :--- | :--- |
| 15%–20% gross spread | **9.73% blended** (range 7.9%–11.5%) | Gate needs 5.76% of GMV; the cushion is thinner than stated |
| 6%–8% hawker savings | **4.8%–13.3%**, 8.75% blended | `D1` at 4.8% is barely a reason to switch |
| RM 35–45 logistics per batch | **RM 85.00** (2 sorties × RM 42.50) | 2× the assumed cost |
| 120–180 kg per batch | **291 kg** (12-Stall) / **365 kg** (14-Stall) | Payload is volume-bound, not weight-bound |
| RM 6,200/month | **RM 3,648/month** | RM 6,200 needs ~37 shifts ≈ 8.5 Routes, not 5 |
| 8 Stalls = viable batch | **Fails the gate** (GP RM 143.50) | Cluster is not the operating unit; Route is |

---

## 2. SKU Margin Table (Golden 6)

| SKU | Item | Carton Cost | Cost/Bundle | **Pool Price** | Street Retail | **Stall Saving** | **Margin** |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A1** | PP Box 650 ml (50 sets) | RM 135.00 / 10 | RM 13.50 | **RM 15.00** | RM 16.50 | 9.1% | 10.0% (RM 1.50) |
| **A2** | PP Box 750 ml (50 sets) | RM 148.00 / 10 | RM 14.80 | **RM 16.50** | RM 18.00 | 8.3% | 10.3% (RM 1.70) |
| **B1** | Brown Paper Large (250 pcs) | RM 102.00 / 12 | RM 8.50 | **RM 9.50** | RM 10.80 | 12.0% | 10.5% (RM 1.00) |
| **C1** | Singlet Bag 9×11 (5 pk) | RM 110.00 / 10 | RM 11.00 | **RM 12.20** | RM 13.50 | 9.6% | 9.8% (RM 1.20) |
| **D1** | Sweetened Creamer (24 tins) | RM 128.00 / 2 | RM 64.00 | **RM 69.50** | RM 73.00 | 4.8% | 7.9% (RM 5.50) |
| **E1** | Dishwashing Liquid 5 L | RM 46.00 / 4 | RM 11.50 | **RM 13.00** | RM 15.00 | 13.3% | 11.5% (RM 1.50) |

**`D1` is the margin trap.** It carries the largest absolute GP per unit (RM 5.50) but the thinnest percentage margin and the weakest saving. A stall can price-check `D1` against any sundry shop and see only 4.8%. Treat it as a basket anchor (drink Stalls order it weekly and reliably), never as the profit driver.

**Every price above is a seed value.** From Phase 2 they live in `wholesaler_prices` and `pool_prices` with validity windows, and each batch snapshots the price in force at Cutoff into `route_batch_prices` (`ADR-0008`, `ADR-0002`).

---

## 3. Basket Tiers

Three observed Stall baskets. Each Stall sits in exactly one tier, per week.

| Tier | Who | Composition | Bundles | **GMV** | **GP** |
| :--- | :--- | :--- | ---: | ---: | ---: |
| **Tier 1** | Small stall, partial adoption | A1×3, B1×1, C1×2 | 6 | **RM 78.90** | **RM 7.90** |
| **Tier 2** | Full-adoption food stall | A1×5, A2×2, B1×2, C1×2, E1×1 | 12 | **RM 164.40** | **RM 16.80** |
| **Tier 3** | Drink Stall (anchor) | D1×4, C1×2, E1×1 | 7 | **RM 315.40** | **RM 25.90** |

**"1–3 Bundles per SKU per week" is the conservative framing, and the arithmetic is looser than it.** A Tier 2 Stall orders **12 bundles in total** across five SKUs, peaking at **A1 × 5** — twice the top of the stated range. The constraint that actually matters is the *total*: 6–12 bundles per Stall per week fits an 8×8 ft stall. Where "1–3" is used in outbound copy it is a sales simplification, not a system constraint, and it understates `A1` by 40%.

Do not write `1–3` into code, validation, or the UI as a maximum. If a Stall orders 5 `A1`, that is a normal Tier 2 week, not an error.

Rounding waste stays bounded regardless, at `M_i − 1` bundles per SKU.

> **v1.0 said "RM 250 AOV".** No tier produces that. Tier 2 — the modal full-adoption food Stall — is **RM 164.40**. The RM 250 figure inflated every downstream number in v1.0 and is deleted.

---

## 4. Route P&L

Two fleet scenarios, both fulfilled in **two Sorties** (`ADR-0016`). Both clear the gate. **The 12-Stall Route fits a Myvi; the 14-Stall Route does not.**

| Line | **12-Stall Route** (2 × 6, Myvi) | **14-Stall Route** (2 × 7, Avanza-class) |
| :--- | ---: | ---: |
| Stalls / composition | 12 (1 × T3 + 11 × T2) | 14 (2 × T3 + 12 × T2) |
| Bundles delivered | 139 | 158 |
| **GMV** | **RM 2,123.80** | **RM 2,603.60** |
| Wholesaler COGS (cash out) | RM 2,182.00 | RM 2,484.00 |
| **Realized GP (accrual)** | **RM 210.70** (9.92%) | **RM 253.40** (9.73%) |
| Runner (2 sorties × RM 42.50) | (RM 85.00) | (RM 85.00) |
| **Net Contribution Margin** | **RM 125.70** | **RM 168.40** |
| Master Cartons / physical boxes | 19 PU / 28 boxes | 22 PU / 31 boxes |
| Geometric volume / per Sortie @80% | 1,230 L / **770 L peak** | 1,318 L / **869 L + 778 L** (avg 824) |
| Payload weight | 291 kg | 365 kg |
| Gate (≥ RM 1,500 GMV, ≥ RM 150 GP) | ✓ | ✓ |

> **Why 14 Stalls is the target mix.** A 14-Stall Route can be composed of two Tier-3 anchors (GP **RM 253.40**) or one (GP **RM 244.30**). The two-anchor mix is the better Route — higher GP *and* lower volume (824 L vs 863 L), because `D1` is dense and the mix needs fewer of the bulky `A1` cartons. The second drink Stall is worth ~RM 9 GP and ~39 L.

### 4.1 The vehicle is the binding constraint

**The 14-Stall Route requires an Avanza** (both rows folded, ~1,000 L) or equivalent: its heavier Sortie packs to 869 L, over the Myvi's 800 L. The 12-Stall Route fits a Myvi at 769 L per sortie — but with **31 L of headroom**, so any Stall upgrading from Tier 1 to Tier 2 breaks it. Plan for the Avanza-class vehicle; the Myvi is the fallback, not the target (`ADR-0015`).

Sortie loads depend on **how cartons are allocated**, not just on how many Stalls a Cluster holds. Two worked cases:

* **12-Stall Route, Myvi** — **19** cartons, best balanced split 10 / 9, giving **770 L and 768 L packed**. Inside 800 L, but only just: a single Stall upgrading its basket pushes it over.
* **14-Stall Route** — **22** cartons split 11 / 11, giving **869 L and 778 L packed**. The heavier Sortie exceeds 800 L, so it needs an Avanza-class vehicle.

The **824 L** figure quoted elsewhere is the *average* of the 14-Stall Route's two Sorties, never the load of either. This is exactly the kind of number that gets copied into a plan and quietly becomes wrong: `09_Backend_Schema.md` §9 records the executed test that produced these figures, and the app must compute them per batch rather than quote a constant.

Weight is a non-issue: 365 kg against a ~500 kg MPV payload. **Do not plan vehicles by weight.**

### 4.2 Two trips, not a hired van

A hired van at ~RM 150/shift consumes **59%** of a Route's RM 253.40 gross profit, leaving RM 103.40 — below what the Founder nets on the 12-Stall Myvi Route. Two sorties at RM 42.50 each is cheaper *and* preserves the vehicle already on hand.

### 4.3 Three margin figures — do not conflate them

`ADR-0010` requires three distinct numbers, because the same batch has three different truths:

| Figure | Basis | 14-Stall value | Purpose |
| :--- | :--- | ---: | :--- |
| **Forecast GP** | Ordered bundles, at Cutoff | RM 253.40 (if fully delivered) | The number you *expect*; already known Wednesday noon |
| **Realized GP** | **Delivered** bundles only | RM 253.40 → lower if short | **The gate metric.** Accrual, not cash |
| **Net Batch Cash Flow** | Cash in − cash out − Runner | RM 34.60 (week 1) | What actually hits the bank this week |

The identity that ties them:

```
Realized GP − (closing Buffer at cost − opening Buffer at cost) − Sortie cost = Net Batch Cash Flow
```

**Week 1**, where the opening buffer is zero and the Runner is paid once, this simplifies to:

```
RM 253.40 − RM 133.80 − RM 85.00 = RM 34.60
```

The earlier draft of this section omitted the Runner term and printed RM 119.60, which is GP net of Buffer Stock but **before** the Runner was paid. The corrected Week-1 net cash is **RM 34.60**.

**Week 2 onward it does not.** Starting with RM 133.80 of carried stock, a week that sells down the buffer shows a *higher* cash figure than its GP:

```
GP 210.70 − (close 144.80 − open 268.90) − 85.00 = 210.70 + 124.10 − 85.00 = RM 249.80
```

That is the 12-Stall Route selling down last week's surplus. It looks like a good week, and it is — but part of it is the previous week's cash arriving late, not new profit.

This is not an error term. It is the price of rounding Master Cartons up, and the **change** in buffer is what separates accrual profit from cash. A batch can show a healthy Realized GP and a negative cash week — the 12-Stall Route does exactly that in Week 1 (§5) — and a week showing strong cash can be selling its own stock.

---

## 5. Working Capital: The Sawtooth

Sarpply pays the Wholesaler on Thursday collection (cash/DuitNow) and collects from Stalls on Thursday handover. But it must buy **whole Master Cartons** while selling **partial cartons**, so leftover bundles accumulate as Buffer Stock and then unwind.

**14-Stall Route, 12 weeks simulated:**

| Week | Cartons | Cash out | Buffer (bundles) | Buffer at cost | Net cash @ RM 85 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 22 | RM 2,484.00 | 10 | RM 133.80 | RM 34.60 |
| 2 | 20 | RM 2,290.00 | 6 | RM 73.60 | RM 228.60 |
| 3 | 22 | RM 2,484.00 | 16 | RM 207.40 | RM 34.60 |
| 5 | 20 | RM 2,226.00 | 2 | RM 23.00 | RM 292.60 |
| 10 | 19 | RM 2,180.00 | 0 | RM 0.00 | RM 338.60 |

* **Worst-week cash requirement: RM 2,484.00.** Not the RM 2,000 v1.0 assumed.
* **Worst-week net cash: RM 34.60.** Some weeks earn almost nothing after the Runner is paid, because the cash went into the boot.
* **12-week cumulative: RM 1,947.20**, against RM 3,040.80 of Realized GP — the RM 1,093.60 difference is Buffer Stock sitting in the vehicle.

**The 12-Stall Route is worse, and must be disclosed:**

* Week 1 cash out **RM 2,182.00** against **RM 2,123.80** GMV → **negative RM 58.20 cash spread**, and **−RM 143.20** after the Runner. The Founder tops up from personal funds for the first 2–3 weeks.
* 12-week cumulative only **RM 1,397.60** — average **RM 116.47/shift**, because a 12-Stall Route rounds up more wastefully relative to its sales.

**Founder operating rule:** hold **RM 2,600** of float before Week 1, and expect the first three Thursdays to feel like they are losing money. They are — the money is in the boot, and it comes back in weeks 4–10.

**`max_intraday_po_cash_myr = 2600`** leaves only **RM 116** of headroom over the worst observed week. Do not raise carton volumes without raising this ceiling first.

---

## 6. Sensitivity: The Gate Breaks at +4.2%

The gate needs Realized GP ≥ RM 150 on a 14-Stall Route.

| Carton cost move | Realized GP | Net @ RM 85 | Verdict |
| :--- | ---: | ---: | :--- |
| Baseline | RM 253.40 | RM 168.40 | ✓ |
| **+4.16%** | **RM 150.07** | RM 65.07 | ✓ **at the edge** |
| +5% | RM 129.20 | RM 44.20 | ✗ fails |
| +10% | RM 5.00 | −RM 80.00 | ✗ catastrophic |

**A 4.2% Wholesaler price increase deletes the entire gate margin.** There is no comfortable buffer. This is why `ADR-0008` keys prices by Wholesaler and `ADR-0002` freezes them at Cutoff — a mid-week cost move discovered at Thursday pickup would be absorbed directly by Sarpply.

**`D1` stress test (the unreliable line):**

| Scenario | GMV | Realized GP | Net @ RM 85 | Gate |
| :--- | ---: | ---: | ---: | :--- |
| 14-Stall, `D1` present | RM 2,603.60 | RM 253.40 | RM 168.40 | ✓ |
| 14-Stall, **`D1 = 0`** | RM 2,047.60 | RM 209.40 | RM 124.40 | ✓ GP passes |
| 12-Stall, **`D1 = 0`** | RM 1,845.80 | RM 188.70 | RM 103.70 | ✓ GP passes |

**Losing the drink anchor entirely still clears the RM 150 GP gate** — GMV drops 21% but GP only drops 17%, because `D1` has the worst margin in the catalogue. The Route survives its least reliable SKU, which is the right risk posture: one Stall category cannot sink a shift.

---

## 7. City Scaling (5 Routes, Kuching)

5 Routes × 4.333 weeks = **21.67 shifts/month** — not the 40 batches v1.0 assumed (40 would need ~9 Routes, roughly every food court in Kuching).

| | GMV/mo | Realized GP/mo | Logistics/mo | **Net/mo** | Annual |
| :--- | ---: | ---: | ---: | ---: | ---: |
| **5 × 14-Stall Routes** | RM 56,407 | RM 5,490 | (RM 1,842) | **RM 3,648** | RM 43,781 |
| **5 × 12-Stall Routes** | RM 46,012 | RM 4,565 | (RM 1,842) | **RM 2,723** | RM 32,679 |

To reach the old **RM 6,200/month** claim requires **37 shifts ≈ 8.5 Routes** — about 105–120 Stalls. That is a Phase 3 target, not a Phase 2 plan.

These are **contribution** figures. They exclude the Founder's time, phone/data, the `GLOSSARY.md`-mandated float, and any software cost. They are the number that must survive before Phase 2 engineering starts.

---

## 8. Coding Agent Reference: Formulas

For Route $r$, SKU $i$, Stall $s$:

**1. Ordered bundles at Cutoff** — frozen; aggregation reads this and only this (`ADR-0002`):
$$Q_{r,i} = \sum_{s \in r} q_{s,i}$$

**2. Master Cartons to purchase** — Route-level pooling, not per-Cluster. Pooling both Clusters' demand saved **2 Master Cartons / RM 258 per week** on the 14-Stall reference (`ADR-0006`), because `A2` and `C1` each round up once across the Route instead of once per Cluster:
$$C_{r,i} = \left\lceil \frac{\max(0, Q_{r,i} - S_{i,\text{prev}})}{M_i} \right\rceil$$

**3. Ending Buffer Stock** — derived, never stored (`ADR-0007`):
$$S_{i,\text{end}} = S_{i,\text{prev}} + C_{r,i} \cdot M_i - \sum_{s \in r} \text{delivered}_{s,i}$$

**4. Realized GP** — on **delivered** bundles, at the price locked in `route_batch_prices`:
$$\text{GP}_r = \sum_i \left[ \text{delivered}_{r,i} \cdot (P_{r,i,\text{locked}} - \text{Cost}_{r,i,\text{locked}}) \right]$$

**5. Net Contribution Margin:**
$$\text{NCM}_r = \text{GP}_r - (n_{\text{sorties}} \times 42.50)$$

**6. Sortie capacity constraint** — enforced, not advisory (`ADR-0015`):
$$\sum_{i \in \text{sortie}} \frac{C_{i} \cdot L_i}{0.80} \le V_{\max}$$

Where $L_i$ = `carton_geometric_liters` and $V_{\max}$ = `vehicles.max_cargo_liters` (800 for Myvi, 1,000 for Avanza).

---

## 9. Google Sheets MVP Formulas (`Wholesaler_Aggregator` tab)

```text
# B: Total bundles ordered for this SKU this week (frozen at Cutoff)
=SUMIF(Stall_Orders!D:D, A2, Stall_Orders!E:E)

# D: Master Cartons to buy, net of carryover buffer (C) and carton size (E)
=MAX(0, CEILING((B2 - C2) / E2, 1))

# F: New carryover buffer after Thursday delivery
=(D2 * E2) + C2 - B2

# G: Cash needed at Wholesaler pickup
=D2 * VLOOKUP(A2, SKU_Master!A:H, 5, FALSE)

# H: Physical boxes to load (A1/A2 = 2 boxes per price unit)
=D2 * VLOOKUP(A2, SKU_Master!A:H, 7, FALSE)

# I: Sortie load check — must be <= 800 (Myvi) or 1000 (Avanza)
=SUMPRODUCT(D2:D7 * VLOOKUP(A2:A7, SKU_Master!A:H, 8, FALSE)) / 0.80
```

`C` (buffer) must be pasted as values each week — it is the *only* carryover between batches, and it is the field that makes Week 1's cash position look like a loss.
