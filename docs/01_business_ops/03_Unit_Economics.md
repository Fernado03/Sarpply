---
project: Sarpply
pillar: 03_Unit_Economics
version: 1.0-MVP
currency: MYR
target_cluster_size: 8
target_batch_gmv_myr: 2000.00
delivery_model_weeks_1_2: Founder-Driven (Cost Absorbed / Reinvested)
delivery_model_week_3_plus: Part-Time MPV Runner (Flat RM 45.00/trip)
---

# Sarpply — Pillar 3: Unit Economics & Pricing Engine Architecture

## 1. Executive Unit Economics Thesis
Traditional B2B grocery models fail at the micro-vendor level because delivering heavy, price-controlled staples (e.g., subsidized cooking oil and flour with 2%–4% margins) across 5 scattered residential streets costs RM 80–RM 110 in multi-drop lorry transport—wiping out a 6% gross spread.

**Sarpply solves this through two structural multipliers:**
1. **Cluster Density (8 Stalls = 1 Drop-Off):** Aggregating 8 hawker stalls inside **Premier 101** compresses delivery distance to a single carpark drop-off, reducing last-mile transport cost to **RM 35–RM 45** per batch.
2. **High-Spread, Low-Weight Consumables:** Packaging and commercial back-of-house consumables carry a **15%–20% wholesale spread** between Master Carton pricing and loose-bundle cash-and-carry pricing, while weighing only **120 kg–180 kg per RM 2,000 batch** (easily fitting inside a standard MPV or compact van).

---

## 2. SKU-Level Margin Breakdown

| SKU Code | Item Description | Wholesaler Master Carton Cost | Wholesaler Cost / Bundle | **Sarpply Pool Price / Bundle** | Street Retail Price / Bundle | **Hawker Savings (%)** | **Sarpply Gross Margin (%)** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A1** | PP Box 650ml (50 sets) | RM 135.00 (10 bdl) | RM 13.50 | **RM 15.00** | RM 16.50 | **9.1%** | **10.0%** (RM 1.50) |
| **A2** | PP Box 750ml (50 sets) | RM 148.00 (10 bdl) | RM 14.80 | **RM 16.50** | RM 18.00 | **8.3%** | **10.3%** (RM 1.70) |
| **B1** | Brown Paper Large (250 pcs) | RM 102.00 (12 pk) | RM 8.50 | **RM 9.50** | RM 10.80 | **12.0%** | **10.5%** (RM 1.00) |
| **C1** | Singlet Bag 9x11 (5 pk) | RM 110.00 (10 bdl) | RM 11.00 | **RM 12.20** | RM 13.50 | **9.6%** | **9.8%** (RM 1.20) |
| **D1** | Sweetened Creamer (24 tins) | RM 128.00 (2x24) | RM 64.00 | **RM 69.50** | RM 73.00 | **4.8%** | **7.9%** (RM 5.50) |
| **E1** | Dishwashing Liquid (5L) | RM 46.00 (4 btl) | RM 11.50 | **RM 13.00** | RM 15.00 | **13.3%** | **11.5%** (RM 1.50) |

---

## 3. Single-Batch P&L: Weeks 1–2 (Founder-Driven) vs. Week 3+ (Part-Time Runner)

* **Baseline Assumptions (Premier 101 Weekly Pool):**
  * Participating Stalls: **8 stalls**
  * Average Order Value (AOV) per Stall: **RM 250.00**
  * Total Weekly Batch GMV: **RM 2,000.00**
  * Blended Gross Margin: **10.0% (RM 200.00)**

| P&L Line Item | Phase 1: Weeks 1–2 (Founder-Driven MVP) | Phase 2: Week 3+ (Part-Time MPV Runner) | Notes & Operational Basis |
| :--- | :--- | :--- | :--- |
| **Gross Merchandise Value (GMV)** | **RM 2,000.00** | **RM 2,000.00** | 8 stalls × RM 250 average weekly order |
| **Less: Wholesale COGS (~90%)** | (RM 1,800.00) | (RM 1,800.00) | Paid to Pending Industrial Estate wholesaler |
| **Gross Profit (10.0% Spread)** | **RM 200.00** | **RM 200.00** | Captured via Master Carton tier spread |
| **Less: Last-Mile Runner Payout** | RM 0.00 | (RM 45.00) | Fixed 2-hr Thursday shift (1:30 PM–3:30 PM) |
| **Less: Founder Petrol / Misc** | (RM 12.00) | RM 0.00 | Round-trip Pending -> Premier 101 (~15 km) |
| **Net Contribution Margin (MYR)** | **RM 188.00** | **RM 155.00** | Positive unit economics from Batch #1 |
| **Net Contribution Margin (%)** | **9.4%** | **7.75%** | Zero warehouse or software burn |

### City-Wide Scaling Projection (10 Commercial Clusters in Kuching)
Once replicated across 10 high-density Kuching zones (e.g., Premier 101, Tabuan Jaya, Stutong, Gala City, MetroCity Matang, Satok, Batu Kawa, 3rd Mile, 7th Mile, BDC) running 1 batch per week:
* **Monthly GMV (40 Batches):** **RM 80,000.00**
* **Monthly Runner Payouts created for Local Drivers:** **RM 1,800.00** (40 two-hour shifts)
* **Monthly Net Contribution Profit to Sarpply:** **RM 6,200.00**

---

## 4. Coding Agent Reference: Aggregation & Financial Formulas

### A. Mathematical Specification
For any batch $b$ and SKU $i$:
1. **Total Vendor Bundles Ordered ($Q_{b,i}$):**
   $$Q_{b,i} = \sum_{v=1}^{n} q_{b,i,v}$$
   where $q_{b,i,v}$ is the bundle quantity of SKU $i$ ordered by vendor $v$ in batch $b$.

2. **Master Cartons to Purchase from Wholesaler ($C_{b,i}$):**
   $$C_{b,i} = \lceil \frac{Q_{b,i} - S_{i,\text{prev}}}{M_i} \rceil$$
   where $M_i$ is `bundles_per_master_carton` and $S_{i,\text{prev}}$ is any carryover buffer stock in the vehicle boot from the prior week.

3. **Ending Buffer Stock ($S_{b,i,\text{end}}$):**
   $$S_{b,i,\text{end}} = (C_{b,i} \times M_i) + S_{i,\text{prev}} - Q_{b,i}$$

4. **Batch Net Contribution Margin ($\text{NCM}_b$):**
   $$\text{NCM}_b = \sum_{i} \left( Q_{b,i} \times (P_{i,\text{pool}} - Cost_{i,\text{bundle}}) \right) - L_b$$
   where $L_b$ is the logistics dispatch cost (`RM 12.00` if `dispatch_mode == 'FOUNDER'`, or `RM 45.00` if `dispatch_mode == 'RUNNER'`).

### B. Google Sheets MVP Formula Implementation (`Wholesaler_Aggregator` Tab)
```text
# Column B (Total Bundles Ordered for SKU in A2):
=SUMIF(Vendor_Orders!D:D, A2, Vendor_Orders!E:E)

# Column D (Master Cartons to Buy, accounting for Carryover Buffer in C2 and Carton Size in E2):
=MAX(0, CEILING((B2 - C2) / E2, 1))

# Column F (New Carryover Buffer Stock after Thursday Delivery):
=(D2 * E2) + C2 - B2

# Column G (Cash Needed for Wholesaler Pickup):
=D2 * VLOOKUP(A2, SKU_Master!A:F, 5, FALSE)
```
