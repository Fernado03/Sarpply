---
project: Sarpply
pillar: 04_Operations_and_Risk_Mitigation
version: 1.0-MVP
fulfillment_model: Zero-Inventory Cross-Docking
payment_terms_vendor: COD or DuitNow QR on Stall-Side Handover
payment_terms_wholesaler: Instant DuitNow Transfer on Pickup
---

# Sarpply — Pillar 4: Operations, Risk Mitigation & System Architecture

## 1. Weekly Operational State Machine (The Tuesday–Thursday Loop)

Sarpply operates on a **Fixed Weekly Cutoff Schedule** rather than open-ended order pooling. This eliminates vendor waiting anxiety and guarantees predictable delivery windows.

| Day & Time (MYT) | System State | Operational Action | Owner |
| :--- | :--- | :--- | :--- |
| **Tuesday 14:00** | `POOL_OPEN` | Trigger WhatsApp Broadcast (`Script B`) to Premier 101 vendor list. | Founder / Bot |
| **Tue 14:00 – Wed 12:00** | `COLLECTING_ORDERS` | Log incoming WhatsApp replies (`"A1 x 3, C1 x 2"`) into `Vendor_Orders` table/sheet. | Founder / Parser |
| **Wednesday 12:00** | `POOL_LOCKED` | Cutoff window closes. Run `Wholesaler_Aggregator` to compute Master Cartons ($C_{b,i}$). | System / Sheet |
| **Wednesday 12:30** | `PO_SUBMITTED` | Send itemized confirmation receipts (`Script C`) to stalls; send Master Carton PO to Pending wholesaler. | Founder / Bot |
| **Thursday 13:30** | `WHOLESALER_PICKUP` | Pick up pre-packed Master Cartons at Pending Industrial Estate; pay wholesaler via DuitNow. | Founder (Wk 1–2) / Runner (Wk 3+) |
| **Thursday 14:15** | `CROSS_DOCK_SORT` | Park at Premier 101 loading zone; break Master Cartons in car boot; mark stall numbers on bundles with black marker. | Founder / Runner |
| **Thursday 14:30** | `STALL_DELIVERY` | Push trolley through Premier 101; hand bundles to stalls; collect Cash or DuitNow QR scan. | Founder / Runner |
| **Thursday 15:30** | `BATCH_RECONCILED` | Reconcile payments received + log any surplus bundles ($S_{b,i,\text{end}}$) into buffer stock. | Founder |

---

## 2. Founder-to-Runner Transition Plan

### Phase 1: Weeks 1–2 (Founder-Driven Validation)
* **Why Founder Drives First:** Builds personal rapport with Premier 101 hawkers, verifies exact parking/trolley unloading paths, and ensures zero friction during the first two collections.
* **Buffer Stock Sales:** If rounding up a Master Carton leaves 3 surplus bundles of `A1` in the car boot, the founder offers them on the spot to neighboring stalls at the RM 15.00 pool price.

### Phase 2: Week 3+ (Part-Time MPV Runner SOP)
* **Driver Profile:** Local Kuching university student (UNIMAS/Swinburne/Politeknik) or gig driver with a Perodua Alza, Proton Exora, Avanza, or fold-flat Myvi.
* **Compensation:** Flat **RM 45.00** for a fixed 2-hour shift (Thursday 1:30 PM – 3:30 PM), paid immediately after batch reconciliation.
* **Zero-Leakage Financial Control:**
  1. **Wholesaler Payment:** Founder pays the Pending wholesaler directly via online banking/DuitNow once the runner confirms carton count at the loading bay.
  2. **Vendor Payment:** Runner carries a laminated **Sarpply Corporate DuitNow QR Card** linked directly to the founder's bank account. Stalls scanning QR pay Sarpply directly; any cash collected is deducted from the runner's RM 45 payout or transferred upon completion.

---

## 3. Risk Mitigation Matrix

| Operational Risk | Why It Happens in B2B Pools | Sarpply Structural Mitigation |
| :--- | :--- | :--- |
| **1. Pool Shortage (MOQ Not Met on 1 SKU)** | Stalls only order 6 bundles of `A1`, while a Master Carton contains 10 bundles. | **Fungible Micro-Buffer:** Buy 1 full Master Carton (RM 135). Deliver 6 bundles (RM 90 revenue) and keep 4 non-perishable bundles in the car boot—or sell them on the spot to adjacent stalls during the Thursday walk-through. |
| **2. Last-Minute Stall Cancellation** | Stall #4 closes unexpectedly on Thursday afternoon and doesn't take their 3 bundles of boxes. | **100% Universal SKUs:** Because `A1`, `B1`, and `C1` are generic consumables used by 90% of stalls in Premier 101, any uncollected bundle is either absorbed by a neighboring stall immediately or carried into the next Tuesday pool with zero spoilage. |
| **3. Payment Friction / Scam Fear** | Hawkers refuse to transfer RM 250 upfront via WhatsApp to a new platform. | **Pay-on-Drop (DuitNow QR / COD):** Zero upfront prepayment required for standard orders. Coupled with intra-kopitiam peer reputation (all 8 stalls operate under one roof), default rates remain near zero. |
| **4. Wholesaler Out-of-Stock** | Primary Pending supplier runs out of 650ml PP boxes on Wednesday afternoon. | **Dual-Supplier Redundancy:** Maintain pre-verified carton quotes from 2 packaging wholesalers in Pending/Demak Laut for the exact same 6 generic SKUs. |

---

## 4. Coding Agent Reference: Database Schema & Webhook Architecture

When migrating from Google Sheets to a production backend (PostgreSQL / Supabase + WhatsApp Cloud API), implement the following relational schema and parser rules:

### A. Relational Database Schema (SQL / Supabase)
```sql
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- e.g., 'Premier 101 / Jalan Tun Jugah'
  cutoff_day VARCHAR(15) DEFAULT 'WEDNESDAY',
  cutoff_time TIME DEFAULT '12:00:00',
  delivery_day VARCHAR(15) DEFAULT 'THURSDAY',
  delivery_time TIME DEFAULT '14:30:00'
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id),
  stall_number VARCHAR(50) NOT NULL,
  stall_name VARCHAR(120) NOT NULL,
  whatsapp_phone VARCHAR(30) UNIQUE NOT NULL,
  preferred_language VARCHAR(10) DEFAULT 'ms-MY', -- 'en', 'ms-MY', 'zh-CN'
  trust_tier VARCHAR(20) DEFAULT 'COD_APPROVED'
);

CREATE TABLE skus (
  sku_code VARCHAR(10) PRIMARY KEY, -- 'A1', 'A2', 'B1', 'C1', 'D1', 'E1'
  name_en VARCHAR(150) NOT NULL,
  name_bm VARCHAR(150) NOT NULL,
  name_zh VARCHAR(150),
  bundles_per_carton INT NOT NULL,
  wholesaler_carton_cost NUMERIC(10,2) NOT NULL,
  pool_bundle_price NUMERIC(10,2) NOT NULL,
  current_buffer_bundles INT DEFAULT 0
);

CREATE TABLE pool_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id),
  delivery_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'POOL_OPEN', -- 'POOL_OPEN', 'POOL_LOCKED', 'PO_SUBMITTED', 'DELIVERED'
  dispatch_mode VARCHAR(20) DEFAULT 'FOUNDER', -- 'FOUNDER' or 'RUNNER'
  logistics_cost NUMERIC(10,2) DEFAULT 12.00
);

CREATE TABLE vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES pool_batches(id),
  vendor_id UUID REFERENCES vendors(id),
  sku_code VARCHAR(10) REFERENCES skus(sku_code),
  bundles_ordered INT NOT NULL CHECK (bundles_ordered > 0),
  unit_price_locked NUMERIC(10,2) NOT NULL,
  payment_status VARCHAR(30) DEFAULT 'PENDING_COD', -- 'PENDING_COD', 'PAID_DUITNOW', 'PAID_CASH'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### B. Order Parser Regex & LLM Fallback Spec (For WhatsApp Webhook)
1. **Fast Regex Pass (Handles standard replies like `"A1 x 3, C1 x 2"` or `"a1 3, b1 2"`):**
   ```regex
   /\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g
   ```
   * Capture Group 1: Uppercase `sku_code` (`A1`)
   * Capture Group 2: Integer `bundles_ordered` (`3`)
2. **Natural Language Fallback (If Regex returns empty on colloquial messages like `"Boss bagi bekas kecil 3 bundle dengan plastik 2"`):**
   * Pass message + the Trilingual Synonym Dictionary (from `02_Go_To_Market_Strategy.md`) to a lightweight LLM prompt returning strict JSON:
     `{"orders": [{"sku_code": "A1", "bundles_ordered": 3}, {"sku_code": "C1", "bundles_ordered": 2}], "needs_clarification": false}`
