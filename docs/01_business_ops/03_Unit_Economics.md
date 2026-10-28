---
project: Sarpply
pillar: 03_Unit_Economics
version: 2.0-MEASURED
currency: MYR
operating_unit: Route (9 Stalls measured, 1 sortie per shift)
measured_batches: B01 2026-10-15, B02 2026-10-22
target_route_gmv_myr: 1776.50
target_route_realized_gp_myr: 177.25
runner_cost_per_sortie_myr: 42.50
supersedes: v1.1-MVP (12-14 Stalls, 2 sorties, modelled baskets, seed prices)
---

# Sarpply — Pillar 3: Unit Economics & Pricing Engine

> **Terminology.** `GLOSSARY.md` is canonical: **Stall** (buyer), **Wholesaler** (supplier), **Bundle** (sell unit), **Master Carton** (buy unit), **Cluster** (~6–7 Stalls), **Route** (the paid operating unit), **Buffer Stock** (leftover bundles carried at cost), **Realized GP** (margin on Delivered Bundles).

> **Status.** Every figure in §2–§6 is now **measured** from two live Route shifts, not modelled. Where a number is still an estimate it is labelled `[EST]`. The v1.1 figures are kept only where they are still the best available, and each survivor is marked.

## 1. Thesis

Traditional B2B grocery distribution fails at the micro-Stall level because delivering heavy, price-controlled staples across scattered streets costs RM 80–110 in multi-drop transport, wiping out a 6% spread.

**Sarpply survives on two multipliers, and only two:**

1. **Density.** 9 Stalls in two Clusters 6–8 minutes apart, cleared in a single 2.5–3.2 hour shift, **one Sortie**.
2. **Spread on light, high-value consumables.** Packaging and back-of-house consumables carry a **4.8%–14.3%** margin per SKU, blended **9.9%** measured, at only **825–902 L** per Route.

**What two weeks of trading changed:**

| Modelled (v1.1) | Measured | Consequence |
| :--- | :--- | :--- |
| 12–14 Stalls | **9 Stalls** | Smaller Route than designed |
| 2 sorties, RM 85.00 Runner | **1 sortie, RM 42.50** | Logistics halved |
| GMV RM 2,603.60 | **RM 1,657 → RM 1,896** | 73% of modelled volume |
| Realized GP RM 253.40 | **RM 167.00 → RM 187.50** | 74% of modelled profit |
| Gate headroom +4.16% | **+1.14% → +2.19%** | **The margin is far thinner than designed** |
| Packing factor 80% | **92%** | Vehicle model overestimated volume 15% |
| 22 cartons / 1,318 L | **13 → 12 cartons / 902 → 826 L** | Fits one Myvi |
| Tier baskets T1/T2/T3 | **RM 50 – RM 348 per Stall** | Basket spread is far wider than three tiers |

The last row of that table is the finding that governs Phase 2. The Route clears `ADR-0009`, but on a **1.1% cushion**.

---

## 2. SKU Margin Table — Measured (Batch 1 and Batch 2)

| SKU | Item | Bundles / Carton | **Carton Cost** | **Cost/Bundle** | **Pool Price** | **GP/Bundle** | **Margin** |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A1** | 22oz PP Cups + Flat Lids | 10 | RM 135.00 | RM 13.50 | **RM 15.00** | RM 1.50 | 10.0% |
| **A2** | 16oz PP Cups + Dome Lids | 10 | RM 120.00 | RM 12.00 | **RM 13.50** | RM 1.50 | 11.1% |
| **B1** | 750ml Rect. Food Container + Lids | 10 | RM 110.00 | RM 11.00 | **RM 12.50** | RM 1.50 | 12.0% |
| **C1** | Kraft Brown Lunch Box | 12 | RM 144.00 | RM 12.00 | **RM 13.50** | RM 1.50 | 11.1% |
| **D1** | Evaporated / Condensed Milk | 8 | RM 160.00 | RM 20.00 | **RM 21.00** | RM 1.00 | **4.8%** |
| **E1** | Takeaway Singlet Oxo-Bag + Straw | 10 | RM 90.00 | RM 9.00 | **RM 10.50** | RM 1.50 | **14.3%** |

**Five of six SKUs are priced to exactly RM 1.50 GP per Bundle.** That is a pricing *policy*, applied deliberately, not six independent market outcomes. It is defensible — it is simple to explain to a Stall and simple to compute — but it means the catalogue has **no margin headroom anywhere except `E1`**.

**`E1` is the only high-margin line** (14.3%) and the only one with room to absorb a Wholesaler increase. `D1` at 4.8% is the lowest, and it is also the highest-revenue line per Bundle (RM 21.00), so a 4.8% margin on it drags the blend down every time a drink Stall orders.

**`D1` is not the basket anchor it was modelled as.** v1.1 treated `D1` as a RM 69.50 Bundle with 2 per carton. Measured, it is **RM 21.00 with 8 per carton** — a commodity line, not a high-value one. The field note confirms it still opens doors ("D1 remains the #1 door-opener for drink stalls"), but it earns RM 1.00 per Bundle against RM 1.50 for everything else.

**Measured stall saving is known for one SKU only.** S03 reported `C1` at RM 13.50 is **RM 0.50 cheaper** than their existing supplier — a **3.7%** saving, and they still bought, citing doorstep delivery as the reason. Every other saving figure in v1.1 was modelled and is now unverified. **Do not quote saving percentages to Stalls until they are measured per SKU.**

Prices live in `wholesaler_prices` and `pool_prices` with validity windows, snapshotted per batch into `route_batch_prices` at Cutoff (`ADR-0008`, `ADR-0002`).

---

## 3. Basket Spread — Measured, Not Three Tiers

v1.1 assumed three tidy tiers (RM 78.90 / RM 164.40 / RM 315.40). Two weeks of trading produced a **continuous spread**, not three clusters:

| Batch | Delivered GMV per Stall, descending | Mean |
| :--- | :--- | ---: |
| **B01** | 285 · 276 · 228 · 218 · 188 · 152 · 135 · 125 · 50 | **RM 184.11** |
| **B02** | 348 · 298 · 270 · 260 · 228 · 162 · 152 · 75 · 75 · 27 | **RM 189.60** |

* **Range: RM 50 to RM 348.** A 7× spread between the smallest and largest Stall.
* **Mean RM 186.86**, against a modelled Tier 2 of RM 164.40.
* **Mean GP per Stall RM 18.66**, which is the number every Route-sizing decision now rests on.

**Do not build a tier system into Phase 2.** The measured data does not support three discrete tiers, and a `basket_tier` enum in the schema would force every Stall into a bucket the data says does not exist. Store `ordered_bundles` per SKU; derive everything else from that. The `basket_tier` column in the Phase 1 workbook is retained as a *forecasting aid only* and must not be promoted to a schema constraint.

**The bottom of the spread is a real business problem.** Two Stalls in B02 delivered only RM 75, and one B01 Stall delivered RM 50. Those Stalls consume a stop, a parking slot, and a share of the shift for 5% of the Route's GMV. A minimum viable basket is a Phase 2 *commercial* decision, not a software one — but the system must surface per-Stall GMV so the Founder can see who is below the line.

> **v1.0 said "RM 250 AOV". v1.1 said three tiers. Both are deleted.** The measured mean is **RM 186.86** and the distribution is continuous.

---

## 4. Route P&L — Measured

Two live shifts, both **one Sortie**, both clearing the `ADR-0009` gate.

| Line | **B01 · 2026-10-15** | **B02 · 2026-10-22** |
| :--- | ---: | ---: |
| Stalls with a Preorder | 9 | 9 |
| Spot sales | 0 | 1 (RM 27.00) |
| Bundles delivered | 116 | 131 |
| **GMV delivered** | **RM 1,657.00** | **RM 1,896.00** |
| Wholesaler COGS (cash out) | RM 1,673.00 | RM 1,563.00 |
| **Realized GP** | **RM 167.00** (10.08%) | **RM 187.50** (9.89%) |
| Runner (1 Sortie) | (RM 42.50) | (RM 42.50) |
| **Net Contribution Margin** | **RM 124.50** | **RM 145.00** |
| Closing Buffer Stock at cost | RM 183.00 | RM 37.50 |
| **Net Batch Cash Flow** | **−RM 58.50** | **+RM 290.50** |
| Master Cartons / physical boxes | 13 / 18 | 12 / 17 |
| Geometric volume | 901.5 L | 825.5 L |
| Shift duration | 3.20 h | 2.50 h |
| Gate (≥ RM 1,500 GMV, ≥ RM 150 GP) | ✓ | ✓ |

**The reference Route is 9 Stalls, 12–13 Master Cartons, one Sortie, RM 42.50 of Runner cost.** Every downstream number in this pillar now derives from that, not from the 14-Stall Route.

### 4.1 One Sortie, and the Myvi is the real ceiling

B01 loaded **13 cartons / 901.5 L** into a Myvi with the rear seats flat **and the front passenger seat occupied**. B02 loaded **12 cartons / 825.5 L** and fit cleanly.

**Practical Myvi capacity is ~900 L geometric, not the modelled 1,280 L.** At the 92% packing efficiency measured (§4.2), 13 cartons is the ceiling for a single Sortie.

**9 Stalls is therefore the Myvi ceiling, and it is also where the gate barely passes.** These two limits meet almost exactly:

| Stalls | GMV `[EST]` | Realized GP `[EST]` | NCM | Cartons | Volume | Myvi |
| ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| 9 (measured) | RM 1,776 | RM 177 | RM 135 | 12–13 | 826–902 L | ✓ at the limit |
| 10 | RM 1,974 | RM 197 | RM 154 | 15 | ~1,040 L | ✗ second Sortie |
| 12 | RM 2,369 | RM 236 | RM 194 | 19 | ~1,318 L | ✗ second Sortie |

**This is the central Phase 2 tension.** A 9-Stall Route fits one Myvi Sortie but leaves only 1.1% of cost headroom (§6). A 12-Stall Route is comfortable on margin but needs a second Sortie at RM 42.50, or an Avanza-class vehicle. `ADR-0016`'s two-Sortie design remains correct — it is simply **not needed at 9 Stalls**, and Phase 2 must not hard-code either one.

### 4.2 The packing factor was wrong by 15%

The model divides geometric volume by **0.80** to estimate packed volume. The field note records 901.5 L geometric packing to **~980 L** — an efficiency of **92%**.

| Cartons | Geometric | Modelled packed (÷0.80) | Observed packed (92%) |
| ---: | ---: | ---: | ---: |
| 13 (B01) | 901.5 L | **1,127 L** — impossible in a Myvi | **980 L** — matches the field note |
| 12 (B02) | 825.5 L | 1,032 L | 897 L |

The modelled formula would have **rejected a load that actually fit**, and would have forced a second Sortie that was not needed. Phase 2 must use a **configurable `packing_efficiency`** on the vehicle, defaulting to `0.92`, not a hard-coded `0.80`. Two observations is thin evidence; the constant is provisional until a third shift confirms it.

Weight remains a non-issue. **Do not plan vehicles by weight.**

### 4.3 Three margin figures — do not conflate them

`ADR-0010` requires three distinct numbers, because the same batch has three different truths:

| Figure | Basis | B01 | B02 | Purpose |
| :--- | :--- | ---: | ---: | :--- |
| **Forecast GP** | Ordered bundles, at Cutoff | RM 167.00 | RM 187.50 | What you *expect*; known Wednesday noon |
| **Realized GP** | **Delivered** bundles only | RM 167.00 | RM 187.50 | **The gate metric.** Accrual, not cash |
| **Net Batch Cash Flow** | Cash in − cash out − Runner | **−RM 58.50** | **+RM 290.50** | What hits the bank this week |

The identity that ties them:

```
Realized GP − (closing Buffer at cost − opening Buffer at cost) − Sortie cost = Net Batch Cash Flow
```

**B01**, opening buffer zero:

```
167.00 − (183.00 − 0) − 42.50 = −RM 58.50
```

**B02**, starting with RM 183.00 of carried stock:

```
187.50 − (37.50 − 183.00) − 42.50 = 187.50 + 145.50 − 42.50 = +RM 290.50
```

**B02's cash is nearly double its profit, and that is not growth.** It sold down RM 145.50 of stock it had already paid for in B01. The cash is real, the profit is RM 187.50, and only the second number is a run-rate.

Both batches were verified against PostgreSQL 16.2 with the identity holding at `0.000000`. The schema's `v_route_batch_pnl` remains the authority; this table is its output.

---

## 5. Working Capital: The Sawtooth

Sarpply pays the Wholesaler on Thursday collection and collects from Stalls on Thursday handover. But it buys **whole Master Cartons** while selling **partial cartons**, so leftover bundles accumulate as Buffer Stock and unwind later.

**Measured, two weeks:**

| Batch | Cartons | Cash out | Buffer at cost | Net cash @ RM 42.50 |
| :--- | ---: | ---: | ---: | ---: |
| B01 | 13 | RM 1,673.00 | RM 183.00 | **−RM 58.50** |
| B02 | 12 | RM 1,563.00 | RM 37.50 | **+RM 290.50** |

**Week 1 is a genuine cash loss.** B01 spent RM 1,673.00 to collect RM 1,657.00, then paid the Runner. The Founder is down RM 58.50 on the first Thursday. **This is the sawtooth working as designed** — the money is in the boot as Buffer Stock, and it comes back when the next batch sells it.

**Buffer Stock is now measured at RM 183.00 after Batch 1**, against RM 133.80 modelled. The buffer is the single largest source of cash volatility in the business and it moves by more than the entire weekly profit.

**Founder operating rule:** hold **RM 2,600** of float before Week 1. Worst observed cash-out is RM 1,673.00, so there is comfortable headroom today — but the ceiling exists to stop carton volumes growing faster than the float, and the v1.1 warning stands: **do not raise carton volumes without raising this ceiling first.**

**`max_intraday_po_cash_myr = 2600`** is retained unchanged.

---

## 6. Sensitivity: The Gate Breaks at +1.1%

This is the most important number in the document.

The gate needs Realized GP ≥ RM 150. Measured GP is RM 167.00 (B01) and RM 187.50 (B02). The headroom is **RM 17.00** and **RM 37.50** — against delivery costs of RM 1,490.00 and RM 1,708.50.

| Batch | Realized GP | Headroom to gate | Delivery cost at cost | **Gate dies at** |
| :--- | ---: | ---: | ---: | ---: |
| **B01** | RM 167.00 | RM 17.00 | RM 1,490.00 | **+1.14%** |
| **B02** | RM 187.50 | RM 37.50 | RM 1,708.50 | **+2.19%** |

**A 1.14% Wholesaler price increase erases Batch 1's entire gate margin.** That is roughly **RM 1.54 on a RM 135.00 `A1` carton**. The v1.1 claim of a 4.16% cushion was correct for a 14-Stall Route; at 9 Stalls the cushion is a quarter of that.

**This is not a software problem, but it is a software requirement.** Phase 2 must:

1. Store every Wholesaler price with a validity window (`wholesaler_prices`) — never a mutable single value.
2. Snapshot the price into `route_batch_prices` at Cutoff (`ADR-0008`).
3. Compute headroom-to-gate as a **first-class output of reconciliation**, not a spreadsheet afterthought.
4. Warn before a batch when the gate headroom falls below a configured floor.

**The response to a price rise is volume, not price.** Stalls are already close to their incumbent suppliers (§2), so raising Pool Prices is the weaker lever. Adding 2–3 Stalls moves GP by RM 37–56, which is more than the entire measured gate headroom.

| Carton cost move | B01 Realized GP | Verdict |
| :--- | ---: | :--- |
| Baseline | RM 167.00 | ✓ |
| **+1.14%** | **RM 150.00** | ✓ at the edge |
| +2% | RM 137.20 | ✗ fails |
| +5% | RM 92.50 | ✗ fails badly |

**Route sizing is now a margin decision, not a volume decision.** 9 Stalls is the minimum that passes; 11–12 gives a cushion worth roughly RM 40–75 of GP, at the cost of a second Sortie or a larger vehicle.

---

## 7. City Scaling (5 Routes, Kuching)

5 Routes × 4.333 weeks = **21.67 shifts/month**.

Measured mean Route: GMV **RM 1,776.50**, Realized GP **RM 177.25**, Runner **RM 42.50**.

| | GMV/mo | Realized GP/mo | Logistics/mo | **Net/mo** | Annual |
| :--- | ---: | ---: | ---: | ---: | ---: |
| **5 × 9-Stall Routes** (measured) | RM 38,488 | RM 3,840 | (RM 921) | **RM 2,919** | RM 35,028 |
| **5 × 12-Stall Routes** `[EST]` | RM 51,336 | RM 5,114 | (RM 921) | **RM 4,192** | RM 50,304 |

To reach the old **RM 6,200/month** claim needs **46.0 shifts ≈ 10.6 Routes** at the measured basket — about **96 Stalls**. That is a Phase 3 target.

These are **contribution** figures. They exclude the Founder's time, phone/data, the float, and any software cost.

**Note the direction of travel.** v1.1 projected RM 3,648/month on 5 × 14-Stall Routes. The measured 9-Stall Route produces **RM 2,919/month** — RM 729 less per month, because the Route is smaller and the packing factor was optimistic. Scaling the business now depends on **adding Stalls per Route up to the vehicle limit**, not on adding Routes, because the Runner cost is per shift and is already halved.

---

## 8. Coding Agent Reference: Formulas

For Route $r$, SKU $i$, Stall $s$:

**1. Ordered bundles at Cutoff** — frozen; aggregation reads this and only this (`ADR-0002`):
$$Q_{r,i} = \sum_{s \in r} q_{s,i}$$

**2. Master Cartons to purchase** — Route-level pooling, not per-Cluster (`ADR-0006`):
$$C_{r,i} = \left\lceil \frac{\max(0, Q_{r,i} - S_{i,\text{prev}})}{M_i} \right\rceil$$

**3. Ending Buffer Stock** — derived, never stored (`ADR-0007`):
$$S_{i,\text{end}} = S_{i,\text{prev}} + C_{r,i} \cdot M_i - \sum_{s \in r} \text{delivered}_{s,i}$$

**4. Realized GP** — on **delivered** bundles, at the price locked in `route_batch_prices`:
$$\text{GP}_r = \sum_i \left[ \text{delivered}_{r,i} \cdot (P_{r,i,\text{locked}} - \text{Cost}_{r,i,\text{locked}}) \right]$$

**5. Net Contribution Margin** — one Sortie at the measured Route size:
$$\text{NCM}_r = \text{GP}_r - (n_{\text{sorties}} \times 42.50)$$

**6. Gate headroom** — the number Phase 2 exists to protect:
$$H_r = \frac{\text{GP}_r - 150}{\text{COGS}_{\text{delivered}}}$$

Measured: $H_{B01} = 1.14\%$, $H_{B02} = 2.19\%$.

**7. Sortie capacity constraint** — `packing_efficiency` measured at **0.92**, not 0.80 (`ADR-0015`):
$$\sum_{i \in \text{sortie}} \frac{C_{i} \cdot L_i}{\varepsilon} \le V_{\max}, \quad \varepsilon = 0.92$$

Where $L_i$ = `carton_geometric_liters` and $V_{\max}$ = `vehicles.max_cargo_liters` (800 for Myvi, 1,000 for Avanza). At $\varepsilon = 0.92$, 13 cartons of `A1`/`A2`/`B1`/`C1`/`D1`/`E1` occupy 980 L and fit a Myvi; at $\varepsilon = 0.80$ they occupy 1,127 L and do not. **The model must not reject loads that reality accepts.**

---

## 9. Google Sheets → Phase 1 Workbook

`10a_Phase_1_Tracking_Sheet.md` describes the instrument; the live workbook is `Sarpply_Phase_1_Tracking_Sheet_Master.xlsx`. Both are **superseded by Phase 2** and kept only as the historical record of the gate measurement.

Both share one structural defect that Phase 2 must not reproduce: **the SKU cost lives in a single global table with no batch dimension.** In the workbook, `2_Orders` reads cost from `0_SKU` while `4_Batch_PnL` reads it from `3_PO`. They agree only because the values happen to match. Perturbing one SKU's carton cost by RM 8 in Batch 2 alone drives the identity check to **+16.00** — a false alarm that looks exactly like a ledger bug.

Worse, updating `0_SKU` for a new batch **retroactively rewrites the previous batch's GP**, violating `ADR-0008`. This is precisely why `route_batch_prices` exists: prices are per batch, immutable after Cutoff, and never a single mutable row.
