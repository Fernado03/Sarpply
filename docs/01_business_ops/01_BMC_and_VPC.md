---
project: Sarpply
pronunciation: "Supply" (Sarawak + Supply)
pillar: 01_BMC_and_VPC
version: 1.0-MVP
stage: Zero-Code WhatsApp + Google Sheets Pilot
beachhead_location: Premier 101 / Jalan Tun Jugah, Kuching, Sarawak
supplier_hub: Pending Industrial Estate, Kuching
target_customer: Independent Kopitiam & Food Court Hawker Stalls
---

# Sarpply — Pillar 1: Business Model Canvas (BMC) & Value Proposition Canvas (VPC)

## 1. Executive Summary
**Sarpply** (pronounced *"Supply"*) is a hyper-local B2B group-purchasing and last-mile aggregation platform in Kuching, Sarawak. Sarpply pools weekly orders of universal back-of-house consumables (takeaway packaging, plastic bags, and commercial kitchen staples) across independent hawker stalls operating under the same kopitiam or food court roof. By consolidating fragmented bundle orders into Master Carton quantities, Sarpply unlocks factory-tier wholesale discounts from Pending Industrial Estate suppliers and delivers them in a single weekly drop.

---

## 2. Business Model Canvas (BMC)

| Building Block | MVP Execution (Weeks 1–4: Zero-Code) | Future Agent/Platform Integration (Phase 2+) |
| :--- | :--- | :--- |
| **Customer Segments** | **Primary:** Independent food & beverage stall operators (hawkers) inside high-density Kuching food courts, starting with **Premier 101 / Jalan Tun Jugah** (40+ stalls within a 200m radius). | Expand to secondary commercial clusters (Tabuan Jaya, Stutong, MetroCity Matang) and street kiosk clusters. |
| **Value Propositions** | 1. **Lower Procurement Costs:** Save 6%–8% vs. retail cash-and-carry prices without meeting 10–20 carton distributor MOQs.<br>2. **Zero Storage Strain:** Buy single-bundle quantities at Master Carton pricing (fits 8x8ft stalls).<br>3. **Time Recovery:** Free stall-side delivery every Thursday at 2:30 PM eliminates afternoon rest-break supply runs. | Automated weekly restock predictions based on historical stall consumption and instant digital credit terms for verified stalls. |
| **Channels** | **Onboarding:** In-person off-peak stall visits (2:15 PM – 4:00 PM) with physical packaging samples.<br>**Ordering:** WhatsApp Business Catalog & Weekly Broadcast Lists. | Automated WhatsApp Cloud API bot (supporting English, BM/Sarawak Malay, and Mandarin/Hokkien) + lightweight vendor web dashboard. |
| **Customer Relationships** | High-trust neighborhood clustering. Founder-led deliveries in Weeks 1–2 to cement rapport; peer-reinforced reliability within the same kopitiam building. | Automated order confirmations, digital DuitNow invoicing, and loyalty tier discounts for consecutive weekly pool participation. |
| **Revenue Streams** | **Wholesale Margin Spread:** 8%–11% net spread captured between Pending wholesaler Master Carton prices and the pooled bundle price charged to stalls. | Tiered supplier rebates, sponsored SKU placements for new packaging/condiment brands, and express mid-week top-up fees. |
| **Key Resources** | 1. Pre-negotiated Master Carton price tiers with Pending Industrial Estate packaging & dry-goods wholesalers.<br>2. WhatsApp Business + Master Google Sheet Aggregator.<br>3. Founder vehicle (Weeks 1–2) transitioning to part-time MPV runner network (Week 3+). | Proprietary order-aggregation engine, cluster routing algorithm, and localized SKU synonym database. |
| **Key Activities** | 1. Weekly Tuesday order broadcast & collection.<br>2. Wednesday morning Master Carton aggregation & wholesaler PO submission.<br>3. Thursday afternoon cross-dock pickup and single-stop kopitiam cluster drop-off. | Automated PO generation, dynamic pool progress tracking, and multi-cluster runner dispatch optimization. |
| **Key Partners** | 1. Packaging & commercial consumable wholesalers in **Pending Industrial Estate** and **Demak Laut**.<br>2. Local part-time MPV drivers (university students, gig workers) for fixed 2-hour Thursday shifts. | Commercial manufacturers, Sarawak digital ecosystem partners (TEGAS, SDEC), and payment gateway providers (DuitNow API). |
| **Cost Structure** | **Zero fixed warehouse or software overhead.**<br>Variable costs only: Wholesale COGS (~88%–90% of GMV) + Fixed single-zone delivery cost (RM 35–RM 45 per batch). | Cloud hosting, WhatsApp Business API per-conversation fees, and automated payment processing fees. |

---

## 3. Value Proposition Canvas (VPC)

### A. Customer Profile: Premier 101 Hawker Stall Operator
* **Customer Jobs-to-be-Done:**
  * Keep daily takeaway packaging (*tapau* boxes, plastic bags, *kertas bungkus*) and washing/cooking consumables continuously stocked.
  * Protect razor-thin food margins against rising ingredient and packaging costs without raising menu prices.
  * Rest and prep between the morning/lunch rush (ends ~2:00 PM) and the evening dinner shift (starts ~5:00 PM).
* **Customer Pains:**
  * **High Loose-Bundle Prices:** Buying 1–2 bundles at local cash-and-carry shops costs 10%–15% more than factory carton rates.
  * **Impossible Wholesale MOQs:** Wholesalers require 10–20 Master Cartons (~RM 300–RM 500+) for free delivery, straining daily cash flow.
  * **Severe Space Constraints:** An 8x8ft kopitiam stall cannot store 500–2,000 takeaway containers at once.
  * **Time Poverty:** Driving out in traffic during the 2:00 PM–4:00 PM break to lug boxes in the heat is exhausting.
* **Customer Gains:**
  * Factory-tier bulk pricing while ordering only 1–3 bundles per week.
  * Zero upfront payment anxiety (Pay via Cash or DuitNow QR upon physical stall-side delivery).
  * Predictable Thursday 2:30 PM restock right at their stall counter.

### B. Value Map: Sarpply Solution
* **Products & Services:**
  * Weekly Kopitiam Group Buying Pool covering the **"Golden 6" Universal Back-of-House SKUs**.
  * Consolidated Master Carton procurement and scheduled Thursday afternoon stall-side drop-off.
* **Pain Relievers:**
  * **Virtual Scale:** Combines 8 stalls inside Premier 101 into a single institutional buyer account to bypass individual MOQs.
  * **Micro-Lot Fulfillment:** Splits Master Cartons at the back of the delivery vehicle into stall-sized bundle orders.
  * **DuitNow/COD on Handover:** Eliminates scam fears and upfront working-capital lockups.
* **Gain Creators:**
  * Instant 6%–8% cost reduction on non-recipe consumables (zero impact on food taste or secret recipes).
  * Reclaims 1–2 hours of weekly personal rest time for stall owners.

---

## 4. Coding Agent Reference: Core Catalog Schema (`skus`)
The MVP restricts inventory strictly to **non-perishable, 100% fungible back-of-house consumables** with high overlap across noodle, rice, burger, and beverage stalls.

```json
[
  {
    "sku_code": "A1",
    "name_en": "PP Microwave Box 650ml Rectangular + Lid",
    "name_bm": "Bekas Tapau Microwave PP 650ml (Segi Empat)",
    "name_zh_hokkien": "650ml 塑料打包盒 (四方)",
    "vendor_unit_name": "Bundle (50 sets)",
    "bundles_per_master_carton": 10,
    "est_wholesaler_carton_cost_myr": 135.00,
    "est_wholesaler_bundle_cost_myr": 13.50,
    "sarpply_pool_bundle_price_myr": 15.00,
    "street_retail_bundle_price_myr": 16.50,
    "fungibility_score": "HIGH"
  },
  {
    "sku_code": "A2",
    "name_en": "PP Microwave Box 750ml Large + Lid",
    "name_bm": "Bekas Tapau Microwave PP 750ml (Besar)",
    "name_zh_hokkien": "750ml 大号打包盒",
    "vendor_unit_name": "Bundle (50 sets)",
    "bundles_per_master_carton": 10,
    "est_wholesaler_carton_cost_myr": 148.00,
    "est_wholesaler_bundle_cost_myr": 14.80,
    "sarpply_pool_bundle_price_myr": 16.50,
    "street_retail_bundle_price_myr": 18.00,
    "fungibility_score": "HIGH"
  },
  {
    "sku_code": "B1",
    "name_en": "Brown Waxed Paper (Kertas Bungkus Large)",
    "name_bm": "Kertas Bungkus Coklat (Saiz Besar)",
    "name_zh_hokkien": "大号打包油纸",
    "vendor_unit_name": "Pack (250 sheets)",
    "bundles_per_master_carton": 12,
    "est_wholesaler_carton_cost_myr": 102.00,
    "est_wholesaler_bundle_cost_myr": 8.50,
    "sarpply_pool_bundle_price_myr": 9.50,
    "street_retail_bundle_price_myr": 10.80,
    "fungibility_score": "HIGH"
  },
  {
    "sku_code": "C1",
    "name_en": "HM Singlet Plastic Bag (Size 9x11)",
    "name_bm": "Plastik Tapau Tangkai HM (Saiz 9x11)",
    "name_zh_hokkien": "9x11 手提塑胶袋",
    "vendor_unit_name": "Bundle (5 packs)",
    "bundles_per_master_carton": 10,
    "est_wholesaler_carton_cost_myr": 110.00,
    "est_wholesaler_bundle_cost_myr": 11.00,
    "sarpply_pool_bundle_price_myr": 12.20,
    "street_retail_bundle_price_myr": 13.50,
    "fungibility_score": "HIGH"
  },
  {
    "sku_code": "D1",
    "name_en": "Sweetened Condensed Creamer 500g",
    "name_bm": "Susu Krimer Manis 500g",
    "name_zh_hokkien": "500g 炼奶 (茶水档专用)",
    "vendor_unit_name": "Half-Carton (24 tins)",
    "bundles_per_master_carton": 2,
    "est_wholesaler_carton_cost_myr": 128.00,
    "est_wholesaler_bundle_cost_myr": 64.00,
    "sarpply_pool_bundle_price_myr": 69.50,
    "street_retail_bundle_price_myr": 73.00,
    "fungibility_score": "MEDIUM_HIGH"
  },
  {
    "sku_code": "E1",
    "name_en": "Commercial Dishwashing Liquid 5L",
    "name_bm": "Sabun Cuci Pinggan Pekat 5L",
    "name_zh_hokkien": "5L 大桶洗碗精",
    "vendor_unit_name": "Bottle (5L)",
    "bundles_per_master_carton": 4,
    "est_wholesaler_carton_cost_myr": 46.00,
    "est_wholesaler_bundle_cost_myr": 11.50,
    "sarpply_pool_bundle_price_myr": 13.00,
    "street_retail_bundle_price_myr": 15.00,
    "fungibility_score": "HIGH"
  }
]
```
