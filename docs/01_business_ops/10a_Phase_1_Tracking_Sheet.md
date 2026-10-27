---
project: Sarpply
pillar: 10a_Phase_1_Tracking_Sheet
version: 1.0
purpose: Collect exactly the data the Phase 2 gate needs, and nothing else
duration: 2 consecutive trading weeks
gate: >= RM 1,500 GMV and >= RM 150 Realized GP per Route shift, both weeks
---

# Phase 1 Tracking Sheet — Specification

> This is the working instrument for the two weeks before any code is written. It is not a product spec. Its only job is to produce the two numbers in `ADR-0009` from real Stalls instead of assumed baskets.

## 1. The one rule

**Record what was delivered, not what was ordered.**

Every row must carry `delivered` alongside `ordered`. A sheet that logs only orders cannot compute Realized GP, and the gate would be measured on forecasts — the exact failure `ADR-0010` exists to prevent. If you fill in one extra column this week, make it `delivered`.

---

## 2. Workbook structure

Six tabs. Three are inputs you type into; three are computed and must never be edited by hand.

| Tab | Type | Purpose |
| :--- | :--- | :--- |
| `1_Stalls` | input | The register: who, which Cluster, trust tier, language |
| `2_Orders` | input | One row per Stall × SKU per batch: ordered, delivered, price, payment |
| `3_PO` | input | What you actually bought and paid at the Wholesaler |
| `4_Batch_PnL` | computed | GMV, GP, buffer, cash — per batch |
| `5_Gate` | computed | The verdict, per week |
| `6_Observations` | input | The judgement calls no formula captures |

---

## 3. `1_Stalls`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `stall_id` | text | `S01`, `S02`… stable, never reused |
| `stall_name` | text | As the signboard reads |
| `cluster` | enum | `Premier 101` / `Gala City` |
| `stall_number` | text | Physical unit number — this is what the Runner hunts for |
| `whatsapp_phone` | text | Blank only for `PROVISIONAL_SPOT` |
| `written_language` | enum | `ms-MY` / `en` / `zh-CN` |
| `trust_tier` | enum | `ANCHOR_PRIORITY` / `COD_APPROVED` / `PROVISIONAL` / `SUSPENDED` |
| `basket_tier` | enum | `T1` / `T2` / `T3` — **observed**, not assumed |
| `onboarding_date` | date | |
| `is_active` | boolean | Set false when a Stall stops ordering |

`basket_tier` is the single most valuable field in the whole workbook. Tiers T1/T2/T3 in the docs are **guesses**; after two weeks this column replaces them with observed reality.

---

## 4. `2_Orders` — one row per Stall per SKU per batch

| Column | Type | Notes |
| :--- | :--- | :--- |
| `batch_id` | text | `B01`, `B02`… |
| `delivery_date` | date | The Thursday |
| `stall_id` | text | → `1_Stalls` |
| `sku_code` | enum | `A1` `A2` `B1` `C1` `D1` `E1` |
| `order_type` | enum | `PREORDER` / `SPOT` |
| **`ordered_bundles`** | int | What they asked for |
| **`delivered_bundles`** | int | **What they actually got** |
| `unit_price` | currency | The Pool Price charged, locked at cutoff |
| `payment_status` | enum | `UNPAID` / `PAID_CASH` / `PAID_DUITNOW` / `VOIDED` |
| `fulfilment_status` | enum | `PENDING` / `DELIVERED` / `PARTIAL` / `UNCOLLECTED` |
| `payment_reference` | text | Last 4 digits of the DuitNow ref, or blank for cash |
| `source` | enum | `TEXT` / `VOICE_CONFIRMED` / `VOICE_FOUNDER` / `SPOT` |
| `notes` | text | Free text |

`source` exists to answer one question the docs cannot: **does anyone actually use voice, and do they confirm the read-back?** If `VOICE_CONFIRMED` is near zero after two weeks, `ADR-0014` needs revisiting before code.

---

## 5. `3_PO` — one row per SKU per batch

| Column | Type | Notes |
| :--- | :--- | :--- |
| `batch_id` | text | |
| `sku_code` | enum | |
| `cartons_ordered` | int | |
| **`cartons_received`** | int | **Count at the loading bay, before paying** |
| `carton_cost` | currency | Actual supplier price — **not** the sheet's seed RM 135 etc. |
| `carton_geometric_liters` | number | **Measured**, not estimated |
| `physical_boxes_per_carton` | int | 2 for `A1`/`A2` if lids are separate |
| `cash_paid` | currency | `cartons_received × carton_cost` |

`cartons_received` and `carton_cost` are the two fields that make the whole model falsifiable. If the supplier charges RM 141 instead of RM 135, the gate margin moves by 4.2% — the difference between passing and failing.

---

## 6. `4_Batch_PnL` — computed per batch

| Field | Formula |
| :--- | :--- |
| `gmv_delivered` | `SUMIFS(2_Orders!unit_price × delivered_bundles, batch)` |
| `cogs_cash` | `SUMIFS(3_PO!cartons_received × carton_cost, batch)` |
| `realized_gp` | `SUMIFS((unit_price − carton_cost ÷ bundles_per_carton) × delivered_bundles, batch)` |
| `opening_buffer_cost` | previous batch's `closing_buffer_cost` (0 for B01) |
| `closing_buffer_cost` | `opening_buffer_cost + received_at_cost − delivered_at_cost` |
| `net_cash` | `cash_collected − cogs_cash − runner_paid` |
| `identity_check` | `realized_gp − (closing − opening) − runner_paid − net_cash` → **must be ≈ 0** |

### The identity, stated correctly

```
Realized GP − (closing buffer at cost − opening buffer at cost) − runner paid = Net Cash
```

**The runner term is inside the identity, not outside it.** `Net Cash` already has the Runner deducted, so the left side must deduct it too. Omit it and every batch reads exactly RM 42.50–85.00 wrong — a discrepancy small enough to look like a rounding error and large enough to hide a real one. This was caught by running the formulas against three simulated batches, not by reading them.

It simplifies to `GP − closing buffer − runner = Net Cash` **only in Batch 1**, where opening stock is zero. Every later batch carries stock in, and a week that sells down its buffer will show more cash than it earned. That is not a bug; it is last week's cash arriving late.

If `identity_check` is more than RM 0.05 off, stop and find the error before the next batch. It means `delivered` and the ledger disagree.

---

## 7. `5_Gate` — the verdict

One row per batch, and the decision at the end.

| Field | Rule |
| :--- | :--- |
| `gmv_pass` | `gmv_delivered >= 1500` |
| `gp_pass` | `realized_gp >= 150` |
| `batch_pass` | both true |
| `stalls_active` | count of Stalls with ≥1 delivered Preorder that batch |

**The gate is cleared only if `batch_pass` is TRUE for two consecutive batches.**

| Result | Action |
| :--- | :--- |
| Both batches pass | Proceed to Phase 2 (`/to-spec`) |
| GMV fails, GP passes | Volume problem — recruit Stalls, don't build |
| GP fails, GMV passes | Margin problem — renegotiate cost, don't build |
| Both fail | The model needs revisiting before any code |

### 7.1 Expected minimum Stall count

From the verified basket arithmetic, **GMV is the binding constraint, not GP** — it fails first and stays failing.

| Stalls (1 drink anchor) | GMV | Realized GP | Gate |
| ---: | ---: | ---: | :--- |
| 8 | RM 1,466.20 | RM 143.50 | ✗ both |
| **9** | RM 1,630.60 | RM 160.30 | ✓ first passing count |
| 12 | RM 2,123.80 | RM 210.70 | ✓ |
| 14 | RM 2,452.60 | RM 244.30 | ✓ |

**Do not read a failure at 6–8 Stalls as a failed business.** It is a failed *week*. Nine Stalls is the threshold, and a first week of 6–8 is normal.

---

## 8. `6_Observations` — the things numbers don't say

Free text, one row per batch. These decide more than the arithmetic does:

| Question | Why it matters |
| :--- | :--- |
| How many Stalls did you approach, and how many said yes? | Conversion rate. If it is 1 in 10, 14 Stalls is 140 conversations |
| Which SKU did each Stall ask for first? | Tell the Anchor pitch from the actual first ask |
| Did any Stall object to the price? Which SKU? | Tests whether 4.8% on `D1` is too thin to sell |
| How many voice notes arrived, and how many confirmed? | `ADR-0014` viability |
| Did cartons fit the vehicle? Measured litres vs estimated? | Validates `ADR-0015` |
| Did the supplier have everything on Thursday? | Shortfall frequency (`ADR-0011`) |
| What took longer than expected? | Real shift duration vs the modelled 2.75 h |
| Did any Stall pay late or not at all? | Trust-tier calibration |

---

## 9. Sheets formulas

Paste into `4_Batch_PnL`, batch in `$A2`.

```text
# GMV actually delivered
=SUMIFS('2_Orders'!$J:$J, '2_Orders'!$A:$A, $A2)   # where J = unit_price * delivered

# Cash paid at the Wholesaler
=SUMIFS('3_PO'!$H:$H, '3_PO'!$A:$A, $A2)

# Realized GP (accrual, delivered only)
=SUMIFS('2_Orders'!$K:$K, '2_Orders'!$A:$A, $A2)   # where K = (price - cost/bundle) * delivered

# Closing buffer at cost  (opening + received - delivered, all at cost)
=D2 + SUMIFS('3_PO'!$G:$G,'3_PO'!$A:$A,$A2) - SUMIFS('2_Orders'!$L:$L,'2_Orders'!$A:$A,$A2)

# Identity check — must be ~0
=C2 - (E2 - D2) - G2 - F2      # GP - (close-open) - runner - net
```

Add two helper columns in `2_Orders` rather than doing arithmetic inline:

```text
J (revenue)   = unit_price * delivered_bundles
K (gp)        = (unit_price - VLOOKUP(sku_code, '0_SKU', 3, FALSE)) * delivered_bundles
L (cost)      = VLOOKUP(sku_code, '0_SKU', 3, FALSE) * delivered_bundles
```

A hidden `0_SKU` tab holds `sku_code`, `bundles_per_master_carton`, `cost_per_bundle`. **`cost_per_bundle` must be updated from real supplier invoices after Batch 1**, not left at the seed values.

---

## 10. What to do with it after two weeks

1. Fill `5_Gate`. Read the verdict.
2. Replace the assumed Tier 1/2/3 baskets in `03_Unit_Economics.md` with observed `basket_tier` counts.
3. Replace seed carton costs with the real ones from `3_PO`.
4. Patch the affected figures — vehicle class, sortie volumes, net margin, break-even.
5. **Then** run `/to-spec` on measured numbers, not modelled ones.

If the gate fails, that is a result, not a setback. It cost two Thursdays and produced a fact. Building Phase 2 first would have cost a month and produced a guess.
