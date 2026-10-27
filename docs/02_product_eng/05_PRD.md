---
project: Sarpply
pronunciation: "Supply" (Sarawak + Supply)
pillar: 05_PRD
version: 1.0-MVP-to-Phase2
beachhead_location: Premier 101 / Jalan Tun Jugah, Kuching, Sarawak
supplier_hub: Pending Industrial Estate & Demak Laut, Kuching
target_customer: Independent Kopitiam & Food Court Hawker Stalls
---

# Sarpply — Pillar 5: Product Requirements Document (PRD)

## 1. Executive Summary & Product Vision

**Sarpply** (pronounced *"Supply"*) is a hyper-local B2B group-purchasing and last-mile aggregation platform operating in Kuching, Sarawak. The platform aggregates fragmented weekly orders of universal back-of-house consumables—specifically takeaway packaging, plastic bags, and commercial kitchen staples—across independent hawker stalls situated under the same kopitiam or food court roof. By consolidating loose-bundle stall orders into institutional Master Carton quantities, Sarpply unlocks factory-tier wholesale pricing from Pending Industrial Estate suppliers and fulfills orders in a single weekly drop.

The product roadmap bridges a **Zero-Code MVP (Weeks 1–4)** built on WhatsApp Business and a Google Sheets Master Aggregator with a **Phase 2 Automated Platform** powered by the WhatsApp Cloud API, a trilingual natural-language order parser, a Supabase/PostgreSQL backend, and a lightweight vendor/runner web interface.

---

## 2. Target User Personas

| Persona | Profile & Operational Context | Core Pains | Core Gains & System Needs |
| :--- | :--- | :--- | :--- |
| **1. Hawker Stall Operator (Primary Customer)** | Independent F&B operator running an 8x8ft stall inside high-density Kuching food courts, starting with **Premier 101 / Jalan Tun Jugah** (40+ stalls within a 200m radius). Works peak shifts (7:00 AM–1:30 PM and 5:30 PM–8:30 PM) with an afternoon break from 2:00 PM–5:00 PM. | Paying 10%–15% extra at retail cash-and-carry shops for 1–2 loose bundles; unable to meet 10–20 Master Carton wholesaler MOQs (~RM 300–RM 500+) due to cash-flow and 8x8ft storage limits; losing afternoon rest breaks driving in traffic to buy supplies. | Save 6%–8% vs. retail prices while buying 1–3 bundles per week; zero upfront prepayment anxiety via Cash or DuitNow QR on delivery; predictable Thursday 2:30 PM stall-side drop-off; effortless WhatsApp ordering in English, Bahasa Melayu, Sarawak Malay, Mandarin, or Kuching Hokkien. |
| **2. Founder / Pool Operator (Admin)** | Manages supplier negotiations, weekly Tuesday broadcasts, Wednesday order cutoff aggregation, PO submission, and batch reconciliation. Drives deliveries in Weeks 1–2 before delegating to runners in Week 3+. | Manual entry errors when parsing colloquial WhatsApp replies; miscalculating Master Carton rounding against carryover car-boot buffer stock; risk of cash leakage during runner handovers. | Automated SKU extraction from WhatsApp messages; one-click Master Carton PO calculation accounting for buffer inventory; real-time DuitNow QR reconciliation. |
| **3. Part-Time MPV Runner (Logistics Partner)** | Local Kuching university student (UNIMAS, Swinburne, Politeknik) or gig worker driving a Perodua Alza, Proton Exora, Avanza, or fold-flat Myvi. Works a fixed 2-hour Thursday shift (1:30 PM–3:30 PM) for a flat RM 45.00 payout. | Complex multi-stop navigation or carrying large amounts of cash float. | Single-stop cluster unloading at Premier 101 (~120 kg–180 kg batch weight); clear stall-by-stall bundle sorting checklist; zero-cash-float pickup (founder pays wholesaler directly via DuitNow). |
| **4. Pending Wholesaler (Supply Partner)** | Packaging and dry-goods distributor in **Pending Industrial Estate** or **Demak Laut** (12–15 minutes / 6–8 km from Premier 101). | Dealing with small loose-bundle walk-in buyers or credit default risks. | Consolidated Wednesday morning POs for ~15–25 Master Cartons per week; self-pickup by Sarpply on Thursday at 1:30 PM with instant DuitNow/Cash payment on collection. |

---

## 3. Functional Requirements & Feature Matrix

### 3.1 Epic 1: Vendor Onboarding & Cluster Management

* **FR-1.1 (Cluster Definition — P0):** System shall organize vendors into geographic kopitiam/commercial clusters (starting with `Premier 101 / Jalan Tun Jugah`), configuring cluster-specific cutoff days/times (`WEDNESDAY 12:00:00`) and delivery windows (`THURSDAY 14:30:00`).
* **FR-1.2 (Off-Peak Field Onboarding — P0):** Support rapid stall registration during the strict off-peak field window (**14:15 – 16:00 MYT**) via a laminated 1-Page Bilingual Pool Price Card QR scan that pre-populates a WhatsApp opt-in message.
* **FR-1.3 (Vendor Profile & Trust Tier — P0):** Store `stall_number`, `stall_name`, `whatsapp_phone`, `preferred_language` (`en`, `ms-MY`, `zh-CN`), and `trust_tier` (defaulting to `COD_APPROVED`).

### 3.2 Epic 2: Weekly Pool Broadcast & Conversational Order Ingestion

* **FR-2.1 (Scheduled Pool Open Broadcast — P0):** Every Tuesday at 14:00 MYT, transition batch status to `POOL_OPEN` and dispatch the bilingual catalog broadcast (`Script B`) to all active vendors in the cluster.
* **FR-2.2 (Fast Regex Order Parsing — P0):** Automatically parse structured WhatsApp replies (e.g., `"A1 x 3, C1 x 2"`) into discrete `vendor_orders` line items using pattern matching.
* **FR-2.3 (Trilingual NLP Fallback — P1 / Phase 2):** When standard regex fails on colloquial replies (e.g., *"Boss bagi bekas kecil 3 bundle dengan plastik 2"*), route the message through an LLM parser mapped to the Trilingual Synonym Dictionary (English, BM/Sarawak Malay, Mandarin/Kuching Hokkien) to output structured JSON or flag `needs_clarification`.
* **FR-2.4 (Automated Cutoff & Confirmation Receipt — P0):** Every Wednesday at 12:00 MYT, lock the pool (`POOL_LOCKED`), freeze unit prices (`unit_price_locked`), and dispatch itemized WhatsApp receipts (`Script C`) by 12:30 MYT showing total payable via Cash or DuitNow QR.

### 3.3 Epic 3: Master Carton Aggregation, Buffer Stock & Wholesaler PO

* **FR-3.1 (Master Carton Ceiling Engine — P0):** Calculate total bundles ordered per SKU across the cluster, subtract available vehicle-boot carryover buffer stock ($S_{i,\text{prev}}$), and round up to whole Master Cartons ($C_{b,i}$) based on each SKU's `bundles_per_carton` ratio.
* **FR-3.2 (Consolidated Wholesaler PO Generation — P0):** Generate a formatted Master Carton Purchase Order by Wednesday 12:30 MYT (`PO_SUBMITTED`) with exact carton counts and total wholesale cash/DuitNow required for Thursday 13:30 MYT pickup.
* **FR-3.3 (Dual-Supplier Fallback — P1):** Maintain secondary supplier price quotes in Pending/Demak Laut to re-route POs immediately if the primary wholesaler is out of stock on any Golden 6 SKU.

### 3.4 Epic 4: Cross-Dock Fulfillment & Zero-Leakage Reconciliation

* **FR-4.1 (Cross-Dock Sorting Manifest — P0):** Generate a Thursday 14:15 MYT car-boot sorting sheet instructing the founder/runner how to break Master Cartons and label individual bundles by `stall_number` with a black marker.
* **FR-4.2 (Stall-Side Handover & Payment Logging — P0):** Track stall-by-stall delivery at 14:30 MYT, updating each order's `payment_status` from `PENDING_COD` to `PAID_DUITNOW` (via the laminated Corporate DuitNow QR Card) or `PAID_CASH`.
* **FR-4.3 (Buffer Inventory & Spot-Sale Reconciliation — P0):** At Thursday 15:30 MYT (`BATCH_RECONCILED`), log any unallocated or uncollected bundles into `current_buffer_bundles` ($S_{b,i,\text{end}}$) or record on-the-spot buffer sales to neighboring stalls at pool prices.

---

## 4. Core Catalog Requirements ("The Golden 6" SKUs)

To eliminate spoilage Risk and guarantee cross-stall fungibility, the MVP catalog is strictly restricted to six non-perishable back-of-house SKUs:

| SKU Code | Product Name (EN / BM / ZH) | Vendor Unit | Bundles / Master Carton | Wholesaler Carton Cost | Wholesaler Cost / Bundle | Sarpply Pool Price | Street Retail Price | Hawker Savings | Sarpply Gross Margin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`A1`** | PP Microwave Box 650ml Rectangular + Lid / *Bekas Tapau Microwave PP 650ml (Segi Empat)* / *650ml 塑料打包盒 (四方)* | Bundle (50 sets) | 10 | RM 135.00 | RM 13.50 | **RM 15.00** | RM 16.50 | 9.1% | 10.0% (RM 1.50) |
| **`A2`** | PP Microwave Box 750ml Large + Lid / *Bekas Tapau Microwave PP 750ml (Besar)* / *750ml 大号打包盒* | Bundle (50 sets) | 10 | RM 148.00 | RM 14.80 | **RM 16.50** | RM 18.00 | 8.3% | 10.3% (RM 1.70) |
| **`B1`** | Brown Waxed Paper (Kertas Bungkus Large) / *Kertas Bungkus Coklat (Saiz Besar)* / *大号打包油纸* | Pack (250 sheets) | 12 | RM 102.00 | RM 8.50 | **RM 9.50** | RM 10.80 | 12.0% | 10.5% (RM 1.00) |
| **`C1`** | HM Singlet Plastic Bag (Size 9x11) / *Plastik Tapau Tangkai HM (Saiz 9x11)* / *9x11 手提塑胶袋* | Bundle (5 packs) | 10 | RM 110.00 | RM 11.00 | **RM 12.20** | RM 13.50 | 9.6% | 9.8% (RM 1.20) |
| **`D1`** | Sweetened Condensed Creamer 500g / *Susu Krimer Manis 500g* / *500g 炼奶 (茶水档专用)* | Half-Carton (24 tins) | 2 | RM 128.00 | RM 64.00 | **RM 69.50** | RM 73.00 | 4.8% | 7.9% (RM 5.50) |
| **`E1`** | Commercial Dishwashing Liquid 5L / *Sabun Cuci Pinggan Pekat 5L* / *5L 大桶洗碗精* | Bottle (5L) | 4 | RM 46.00 | RM 11.50 | **RM 13.00** | RM 15.00 | 13.3% | 11.5% (RM 1.50) |

---

## 5. Success Metrics (KPIs) & Scope Boundaries

* **Cluster Density Target:** 8 participating stalls per weekly batch inside Premier 101 (~20% penetration of the 40+ stalls in the zone).
* **Batch GMV & AOV Target:** RM 250.00 Average Order Value (AOV) per stall, generating RM 2,000.00 weekly GMV per cluster.
* **Unit Profitability Target:** 10.0% blended gross margin (RM 200.00 gross profit per batch), delivering RM 188.00 (9.4%) Net Contribution Margin in Weeks 1–2 (Founder-Driven) and RM 155.00 (7.75%) in Week 3+ (Runner-Driven).
* **Strict Non-Goals (Out of Scope for MVP):**
  * **No Perishable or Recipe-Specific Ingredients:** Avoid fresh produce, meats, or specialty sauces that impact secret stall recipes or risk spoilage.
  * **No Low-Margin Price-Controlled Heavy Staples:** Exclude subsidized cooking oil and flour with 2%–4% margins that require heavy multi-drop lorry transport.
  * **No Fixed Warehouse Lease:** All fulfillment operates via zero-inventory vehicle-boot cross-docking.
