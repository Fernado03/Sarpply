---
project: Sarpply
pronunciation: "Supply" (Sarawak + Supply)
pillar: 01_BMC_and_VPC
version: 1.1-MVP
stage: Zero-Code WhatsApp + Google Sheets Pilot
beachhead_location: Premier 101 + Gala City, Kuching, Sarawak
wholesaler_hub: Pending Industrial Estate, Kuching
target_customer: Independent Kopitiam & Food Court Hawker Stalls
operating_unit: One Route = 2 adjacent Clusters, 12-14 Stalls, 2 Sorties
supersedes: v1.0 (8-stall single-drop model, RM 250 AOV, 6-8% savings, 40-batch city math)
---

# Sarpply — Pillar 1: Business Model Canvas (BMC) & Value Proposition Canvas (VPC)

> **Terminology.** This document uses the canonical vocabulary in the root `GLOSSARY.md`: **Stall** (buyer), **Wholesaler** (supplier), **Bundle** (what Sarpply sells), **Master Carton** (what Sarpply buys), **Cluster** (6–7 Stalls), **Route** (2 Clusters, 2 Sorties, one shift). See also `docs/adr/` for the decisions behind v1.1.

## 1. Executive Summary
**Sarpply** (pronounced *"Supply"*) is a hyper-local B2B group-purchasing and last-mile aggregation platform in Kuching, Sarawak. Sarpply pools weekly Preorders for universal back-of-house consumables (takeaway packaging, plastic bags, and commercial kitchen staples) across independent hawker Stalls operating under the same kopitiam or food court roof.

Consolidating fragmented Bundle orders into Master Carton quantities unlocks factory-tier Wholesaler pricing. Because a Route's demand is pooled **before** cartons are rounded up, two adjacent Clusters buy together but are delivered separately: procurement is one Wholesaler PO, fulfilment is two Sorties (`ADR-0016`).

**The operating unit is a Route, not a Cluster.** A single 8-stall Cluster cannot pay for a shift — see §4.

---

## 2. Business Model Canvas (BMC)

| Building Block | MVP Execution (Weeks 1–4: Zero-Code) | Future Agent/Platform Integration (Phase 2+) |
| :--- | :--- | :--- |
| **Customer Segments** | **Primary:** Independent food & beverage Stall operators inside high-density Kuching food courts, starting with **Premier 101** and **Gala City** (40+ Stalls each within a 200 m radius). | Expand to secondary Clusters (Tabuan Jaya, Stutong, MetroCity Matang) and street kiosk Clusters. |
| **Value Propositions** | 1. **Lower Procurement Costs:** Save **4.8%–13.3% per SKU (8.75% blended)** vs. street retail cash-and-carry, without meeting a Wholesaler's 10–20 Master Carton MOQ.<br>2. **Zero Storage Strain:** Buy 6–12 Bundles **in total per week** — typically 1–5 of any one SKU — at Master Carton pricing, fitting an 8×8 ft stall.<br>3. **Time Recovery:** Free stall-side delivery every Thursday afternoon removes the mid-afternoon supply run between the lunch rush and the dinner shift. | Automated weekly restock predictions from measured Stall consumption, plus verified-Stall credit terms. |
| **Channels** | **Onboarding:** In-person off-peak Stall visits (2:15 PM – 4:00 PM) with physical packaging samples.<br>**Ordering:** WhatsApp — free text or voice note, never a form. Every voice-derived order is read back for confirmation before it commits (`ADR-0014`). | Automated WhatsApp Cloud API bot + lightweight Stall web dashboard. |
| **Customer Relationships** | High-trust neighbourhood clustering. Founder-led deliveries in Weeks 1–2 to cement rapport; peer reinforcement within the same building. | Automated order confirmations, attested-payment receipts, and loyalty tiers for consecutive weekly participation. |
| **Revenue Streams** | **Wholesale Margin Spread:** ~**9.7% blended** spread between Wholesaler Master Carton cost and the Pool Price charged per Bundle (range 7.9%–11.5% by SKU; `03_Unit_Economics.md`). | Tiered Wholesaler rebates, sponsored SKU placements, and express mid-week top-up fees. |
| **Key Resources** | 1. Negotiated Master Carton price tiers with Pending Industrial Estate Wholesalers.<br>2. WhatsApp Business + Master Google Sheet Aggregator.<br>3. **One fold-flat MPV** (Myvi/Alza/Avanza) — the payload ceiling that sets Route size (`ADR-0015`). | Order-aggregation engine, Route routing, and a localised SKU synonym database. |
| **Key Activities** | 1. Tuesday 14:00 Price Lock check, then order broadcast.<br>2. Wednesday 12:00 Cutoff, aggregation, and Wholesaler PO.<br>3. Thursday: **two collection-and-delivery Sorties** per Route, one per Cluster (6–7 Stalls each). | Automated PO generation, pool progress tracking, and multi-Route runner dispatch. |
| **Key Partners** | 1. Packaging & consumable Wholesalers in **Pending Industrial Estate** and **Demak Laut**.<br>2. Local part-time Runner (student or gig driver) on a fixed Thursday shift. | Manufacturers, Sarawak digital ecosystem partners (TEGAS, SDEC), and an eventual acquiring bank for dynamic DuitNow. |
| **Cost Structure** | **Zero fixed warehouse or software overhead.**<br>Variable only: Wholesaler COGS (~90% of GMV) + **RM 42.50 per Sortie, RM 85 per Route shift**. A hired van at ~RM 150/shift is **not** in the model — it consumes 59% of a Route's gross profit (`ADR-0015`). | Cloud hosting, WhatsApp per-conversation fees, and acquiring fees only once dynamic DuitNow is justified. |

---

## 3. Value Proposition Canvas (VPC)

### A. Customer Profile: Premier 101 / Gala City Hawker Stall Operator
* **Customer Jobs-to-be-Done:**
  * Keep daily takeaway packaging (*tapau* boxes, plastic bags, *kertas bungkus*) and washing consumables continuously stocked.
  * Protect razor-thin food margins against rising packaging costs without raising menu prices.
  * Rest and prep between the lunch rush (ends ~2:00 PM) and the dinner shift (starts ~5:00 PM).
* **Customer Pains:**
  * **High Loose-Bundle Prices:** Buying 1–2 Bundles at a cash-and-carry shop costs **4.8%–13.3% more per SKU** than Sarpply's Pool Price. The penalty is real but uneven: 13.3% on dishwashing liquid, only 4.8% on condensed creamer.
  * **Impossible Wholesale MOQs:** Wholesalers require 10–20 Master Cartons for free delivery, straining daily cash flow.
  * **Severe Space Constraints:** An 8×8 ft Stall cannot store 500–2,000 takeaway containers at once.
  * **Time Poverty:** Driving out in traffic during the 2:00 PM–4:00 PM break to lug boxes in the heat is exhausting.
* **Customer Gains:**
  * Master Carton pricing while ordering **6–12 Bundles in total** per week — usually 1–5 Bundles of any single SKU.
  * Zero upfront payment (cash or DuitNow QR at stall-side handover), with a WhatsApp receipt naming the amount and method recorded.
  * Predictable Thursday restock at the Stall counter.

### B. Value Map: Sarpply Solution
* **Products & Services:**
  * Weekly Kopitiam Group Buying Pool covering the **"Golden 6"** universal back-of-house SKUs.
  * Consolidated Master Carton procurement with two scheduled Sorties per Route.
* **Pain Relievers:**
  * **Virtual Scale:** Combines 12–14 Stalls across two adjacent Clusters into one institutional buyer account, bypassing individual MOQs and clearing the per-shift floor.
  * **Micro-Lot Fulfilment:** Splits Master Cartons at the back of the vehicle into Stall-sized Bundles.
  * **Attested Payment on Handover:** Cash or static DuitNow QR at the counter, receipt echoed to the Stall's phone (`ADR-0012`). No acquirer fees, no prepayment.
* **Gain Creators:**
  * 4.8%–13.3% cost reduction on non-recipe consumables with zero impact on food taste or recipes.
  * Reclaims 1–2 hours of weekly personal time.

---

## 4. Where the Money Actually Is
Eight Stalls at realistic baskets do **not** pay for a shift. The Route that does:

| Measure | 8-Stall Cluster (old v1.0) | **12-Stall Route** (2 × 6, Myvi) | **14-Stall Route** (2 × 7, Avanza-class) |
| :--- | ---: | ---: | ---: |
| GMV per shift | RM 1,466.20 | RM 2,123.80 | **RM 2,603.60** |
| Realized GP (accrual) | RM 143.50 | RM 210.70 | **RM 253.40** |
| Runner payout | RM 45.00 (1 trip) | RM 85.00 (2 Sorties) | **RM 85.00** (2 Sorties) |
| **Net Contribution Margin** | **RM 98.50** ✗ | RM 125.70 | **RM 168.40** ✓ |
| Master Cartons / physical boxes | 14 | 19 / 28 | **22 / 31** |
| Packed volume per sortie | — | 770 L peak | 869 L / 778 L |
| Gate (≥ RM 1,500 GMV, ≥ RM 150 GP) | ✗ fails by RM 6.50 | ✓ | ✓ |

Four structural consequences, all verified in `03_Unit_Economics.md`:

1. **A Cluster is not a viable unit.** The 8-Stall Cluster fails the RM 1,500 GMV / RM 150 GP gate before the Runner is paid. A Route of 12–14 Stalls clears it.
2. **The vehicle is a hard constraint, and volume — not weight — binds.** 22 Master Cartons weigh only ~365 kg but pack to **1,318 L**, split into Sorties of **869 L and 778 L** — the heavier one exceeds an 800 L Myvi (`ADR-0015`). The 14-Stall Route therefore needs an Avanza-class vehicle; the 12-Stall Route fits a Myvi at ~770 L per Sortie, with 30 L to spare.
3. **Procurement pools at Route level, fulfilment splits at Cluster level.** One PO, two sorties. Pooling the two Clusters saved 2 Master Cartons / RM 258 per week versus buying per Cluster, and cut steady Buffer Stock from 30 bundles to 10.
4. **Rounding is a working-capital sawtooth.** Week 1 buys RM 2,484 of cartons for RM 2,603.60 of GMV; the RM 133.80 difference sits in the boot as Buffer Stock. Budget for the **worst** week (RM 2,484), not the average. At 12 Stalls it is worse still: cash out RM 2,182 against RM 2,123.80 of GMV — a **negative** first-week spread.

---

## 5. Commercial Gate Before Phase 2
No Phase 2 engineering spend until Phase 1 records, for **two consecutive weeks**, a Route at **≥ RM 1,500 GMV and ≥ RM 150 Realized GP**, with per-Stall per-SKU quantities captured from real Preorders (`ADR-0009`). Realized GP is measured on **Delivered Bundles**, not orders — a gate measured on forecast passes on paper while the Runner comes home short (`ADR-0010`).

---

## 6. Coding Agent Reference: Core Catalog Schema (`skus`)
The MVP restricts inventory strictly to **non-perishable, fully fungible back-of-house consumables** with high overlap across noodle, rice, burger, and beverage Stalls.

> **Phase 2 note.** `wholesaler_carton_cost` and `pool_bundle_price` below are **seed values only**. From Phase 2 they live in `wholesaler_prices` (`ADR-0008`) and `pool_prices`, each with a validity window; a Batch snapshots the price in force at its Cutoff into `route_batch_prices` (`ADR-0002`). There is no `current_buffer_bundles` column — Buffer Stock is derived from `stock_movements` (`ADR-0007`).

```json
[
  {
    "sku_code": "A1",
    "name_en": "PP Microwave Box 650ml Rectangular + Lid",
    "name_bm": "Bekas Tapau Microwave PP 650ml (Segi Empat)",
    "name_zh": "650ml 塑料打包盒 (四方)",
    "bundle_unit_name": "Bundle (50 sets)",
    "bundles_per_master_carton": 10,
    "physical_boxes_per_carton": 2,
    "carton_geometric_liters": 105.80,
    "brand": null,
    "is_brand_fungible": true,
    "est_wholesaler_carton_cost_myr": 135.00,
    "est_wholesaler_bundle_cost_myr": 13.50,
    "seed_pool_bundle_price_myr": 15.00,
    "street_retail_bundle_price_myr": 16.50,
    "fungibility_score": "HIGH",
    "payload_note": "Containers and lids ship as two cartons; 2 physical boxes per price unit. UNVERIFIED for Kuching — confirm with Wholesaler (Pillar 2, Script A, Question 1)."
  },
  {
    "sku_code": "A2",
    "name_en": "PP Microwave Box 750ml Large + Lid",
    "name_bm": "Bekas Tapau Microwave PP 750ml (Besar)",
    "name_zh": "750ml 大号打包盒",
    "bundle_unit_name": "Bundle (50 sets)",
    "bundles_per_master_carton": 10,
    "physical_boxes_per_carton": 2,
    "carton_geometric_liters": 105.90,
    "brand": null,
    "is_brand_fungible": true,
    "est_wholesaler_carton_cost_myr": 148.00,
    "est_wholesaler_bundle_cost_myr": 14.80,
    "seed_pool_bundle_price_myr": 16.50,
    "street_retail_bundle_price_myr": 18.00,
    "fungibility_score": "HIGH",
    "payload_note": "Same two-carton basis as A1. UNVERIFIED for Kuching."
  },
  {
    "sku_code": "B1",
    "name_en": "Brown Waxed Paper (Kertas Bungkus Large)",
    "name_bm": "Kertas Bungkus Coklat (Saiz Besar)",
    "name_zh": "大号打包油纸",
    "bundle_unit_name": "Pack (250 sheets)",
    "bundles_per_master_carton": 12,
    "physical_boxes_per_carton": 1,
    "carton_geometric_liters": 14.00,
    "brand": null,
    "is_brand_fungible": true,
    "est_wholesaler_carton_cost_myr": 102.00,
    "est_wholesaler_bundle_cost_myr": 8.50,
    "seed_pool_bundle_price_myr": 9.50,
    "street_retail_bundle_price_myr": 10.80,
    "fungibility_score": "HIGH",
    "payload_note": "Carton dimensions ESTIMATED — no publisher data found. Lowest-confidence row in the payload model."
  },
  {
    "sku_code": "C1",
    "name_en": "HM Singlet Plastic Bag (Size 9x11)",
    "name_bm": "Plastik Tapau Tangkai HM (Saiz 9x11)",
    "name_zh": "9x11 手提塑胶袋",
    "bundle_unit_name": "Bundle (5 packs)",
    "bundles_per_master_carton": 10,
    "physical_boxes_per_carton": 1,
    "carton_geometric_liters": 33.70,
    "brand": null,
    "is_brand_fungible": true,
    "est_wholesaler_carton_cost_myr": 110.00,
    "est_wholesaler_bundle_cost_myr": 11.00,
    "seed_pool_bundle_price_myr": 12.20,
    "street_retail_bundle_price_myr": 13.50,
    "fungibility_score": "HIGH",
    "payload_note": "Carton dimensions ESTIMATED — no publisher data found."
  },
  {
    "sku_code": "D1",
    "name_en": "Sweetened Condensed Creamer 500g",
    "name_bm": "Susu Krimer Manis 500g",
    "name_zh": "500g 炼奶 (茶水档专用)",
    "bundle_unit_name": "Half-Carton (24 tins)",
    "bundles_per_master_carton": 2,
    "physical_boxes_per_carton": 1,
    "carton_geometric_liters": 28.60,
    "brand": "TBC at supplier lock-in",
    "is_brand_fungible": false,
    "est_wholesaler_carton_cost_myr": 128.00,
    "est_wholesaler_bundle_cost_myr": 64.00,
    "seed_pool_bundle_price_myr": 69.50,
    "street_retail_bundle_price_myr": 73.00,
    "fungibility_score": "MEDIUM_HIGH",
    "payload_note": "The only branded line: a drink Stall that insists on a specific tin brand is not served by a substitute. Thinnest margin (7.9%) and smallest saving (4.8%) in the catalogue."
  },
  {
    "sku_code": "E1",
    "name_en": "Commercial Dishwashing Liquid 5L",
    "name_bm": "Sabun Cuci Pinggan Pekat 5L",
    "name_zh": "5L 大桶洗碗精",
    "bundle_unit_name": "Bottle (5L)",
    "bundles_per_master_carton": 4,
    "physical_boxes_per_carton": 1,
    "carton_geometric_liters": 30.50,
    "brand": null,
    "is_brand_fungible": true,
    "est_wholesaler_carton_cost_myr": 46.00,
    "est_wholesaler_bundle_cost_myr": 11.50,
    "seed_pool_bundle_price_myr": 13.00,
    "street_retail_bundle_price_myr": 15.00,
    "fungibility_score": "HIGH",
    "payload_note": "Only SKU with fully published carton dimensions (1*4, 40*25*30.5 cm). Densest carton in the catalogue at ~702 kg/m3 — the best payload filler."
  }
]
```
