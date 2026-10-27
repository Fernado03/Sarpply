---
project: Sarpply
pillar: 06_TRD
version: 1.0-MVP-to-Phase2
stack_mvp: WhatsApp Business App + Google Sheets Aggregator + DuitNow QR
stack_phase2: WhatsApp Cloud API + Supabase (PostgreSQL/Edge Functions) + Next.js Web Portal + LLM Fallback Parser
timezone: Asia/Kuching (MYT / UTC+8)
---

# Sarpply — Pillar 6: Technical Requirements Document (TRD)

## 1. System Architecture Evolution

### 1.1 Phase 1: Zero-Code Pilot Stack (Weeks 1–4)

* **Messaging Layer:** WhatsApp Business Mobile/Desktop App utilizing Broadcast Lists and Quick Replies (`Script A`, `Script B`, `Script C`).
* **Compute & Storage Layer:** Google Sheets Master Workbook containing three relational tabs: `SKU_Master`, `Vendor_Orders`, and `Wholesaler_Aggregator`.
* **Payment Layer:** Static Corporate DuitNow QR code printed on a laminated card + physical Cash on Delivery (COD).

### 1.2 Phase 2: Automated Agent & Platform Stack (Week 5+)

```
+-----------------------------------------------------------------------+
|                    HAWKER STALLS (Premier 101, etc.)                  |
|         WhatsApp Client (EN / BM / Sarawak Malay / ZH / Hokkien)      |
+-----------------------------------+-----------------------------------+
                                    |
                                    v (HTTPS Webhook / Meta Graph API)
+-----------------------------------------------------------------------+
|                SUPABASE EDGE FUNCTIONS / API GATEWAY                  |
|  +-----------------------------+   +-------------------------------+  |
|  |  1. Fast Regex Order Parser |-->| 2. LLM Synonym Fallback Agent |  |
|  |  /\b([A-Ea-e][1-9])...      |   | (Trilingual Dictionary JSON)  |  |
|  +-----------------------------+   +-------------------------------+  |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                   SUPABASE POSTGRESQL DATABASE                        |
|  Tables: clusters | vendors | skus | pool_batches | vendor_orders     |
|  Engine: Master Carton Ceiling & Carryover Buffer Reconciliation      |
+-----------------+-----------------------------------+-----------------+
                  |                                   |
                  v                                   v
+-----------------------------------+   +-------------------------------+
|    FOUNDER / ADMIN WEB CONSOLE    |   |   MPV RUNNER MOBILE WEB APP   |
| - Wednesday 12:00 Cutoff Trigger  |   | - Pending Pickup Verification |
| - Wholesaler PO PDF/WA Generator  |   | - Boot Cross-Dock Sort List   |
| - DuitNow Transfer Authorization  |   | - Stall Delivery & QR Toggles |
+-----------------------------------+   +-------------------------------+
```

---

## 2. Hybrid WhatsApp Order Parsing Engine (Phase 2 Spec)

When a registered vendor sends a WhatsApp text reply while their cluster's batch status is `POOL_OPEN` or `COLLECTING_ORDERS`, the webhook processor executes a two-tier extraction pipeline:

### 2.1 Tier 1: Deterministic Regex Pass (< 5ms latency)

Executes against structured alphanumeric inputs such as `"A1 x 3, C1 x 2"` or `"a1 3, b1 2"`:

```regex
/\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g
```

* **Capture Group 1:** Uppercase normalized `sku_code` (validated against active catalog codes `A1`, `A2`, `B1`, `C1`, `D1`, `E1`).
* **Capture Group 2:** Positive integer `bundles_ordered` ($\ge 1$).

### 2.2 Tier 2: Trilingual LLM Fallback Pass (< 1,500ms latency)

If Tier 1 returns zero matches on natural-language inputs (e.g., *"Boss bagi bekas kecil 3 bundle dengan plastik 2"* or *"小盒 3, 塑胶袋 2"*), the webhook invokes a lightweight LLM prompt injected with the **Trilingual Synonym Dictionary**:

* **Canonical Token Mapping Rules:**
  * `A1` $\leftarrow$ EN: `a1`, `650ml`, `small box`, `normal box`, `mee box` | BM: `bekas kecil`, `bekas biasa`, `tapau 650`, `kotak mee` | ZH/Hokkien: `小盒`, `普通打包盒`, `面盒`, `650盒`, `tah-pau-ah`.
  * `A2` $\leftarrow$ EN: `a2`, `750ml`, `big box`, `large box`, `rice box` | BM: `bekas besar`, `tapau besar`, `tapau 750`, `kotak nasi` | ZH/Hokkien: `大盒`, `大号打包盒`, `饭盒`, `750盒`.
  * `B1` $\leftarrow$ EN: `b1`, `brown paper`, `wax paper`, `wrapper` | BM: `kertas bungkus`, `kertas coklat`, `kertas minyak`, `kertas nasi` | ZH/Hokkien: `油纸`, `打包纸`, `饭纸`, `brown paper`.
  * `C1` $\leftarrow$ EN: `c1`, `plastic bag`, `singlet bag`, `9x11` | BM: `plastik tapau`, `plastik tangkai`, `plastik 9x11`, `beg plastik` | ZH/Hokkien: `塑胶袋`, `手提袋`, `打包袋`, `9x11袋`.
  * `D1` $\leftarrow$ EN: `d1`, `creamer`, `condensed milk`, `milk tin` | BM: `susu manis`, `krimer`, `susu tin`, `susu pekat` | ZH/Hokkien: `炼奶`, `甜奶`, `奶水`, `茶水奶`.
  * `E1` $\leftarrow$ EN: `e1`, `dish soap`, `detergent`, `5l soap` | BM: `sabun pinggan`, `sabun cuci`, `sabun 5l`, `pencuci pinggan` | ZH/Hokkien: `洗碗精`, `洗碗水`, `大桶肥皂`.

* **Strict Output Schema:**

```json
{
  "orders": [
    { "sku_code": "A1", "bundles_ordered": 3 },
    { "sku_code": "C1", "bundles_ordered": 2 }
  ],
  "needs_clarification": false
}
```

* **Ambiguity Handling:** If a vendor writes *"Bagi bekas tapau 3 bundle"* without specifying size (`650ml` vs `750ml`), the LLM sets `"needs_clarification": true` and triggers an automated bilingual reply asking the vendor to choose `A1` (650ml) or `A2` (750ml).

---

## 3. Core Mathematical & Aggregation Specifications

For any weekly pool batch $b$ and SKU $i \in \{\text{A1, A2, B1, C1, D1, E1}\}$:

1. **Total Vendor Bundles Ordered ($Q_{b,i}$):**

$$Q_{b,i} = \sum_{v=1}^{n} q_{b,i,v}$$

where $q_{b,i,v}$ is the bundle quantity of SKU $i$ ordered by vendor $v$ in batch $b$.

2. **Master Cartons to Purchase from Wholesaler ($C_{b,i}$):**

$$C_{b,i} = \max\left(0, \left\lceil \frac{Q_{b,i} - S_{i,\text{prev}}}{M_i} \right\rceil\right)$$

where $M_i$ is `bundles_per_carton` (`bundles_per_master_carton`) and $S_{i,\text{prev}}$ is the carryover buffer stock (`current_buffer_bundles`) held in the vehicle boot from the prior batch.

3. **Ending Buffer Stock ($S_{b,i,\text{end}}$):**

$$S_{b,i,\text{end}} = (C_{b,i} \times M_i) + S_{i,\text{prev}} - Q_{b,i}$$

Updated into `skus.current_buffer_bundles` upon batch reconciliation on Thursday at 15:30 MYT.

4. **Batch Net Contribution Margin ($\text{NCM}_b$):**

$$\text{NCM}_b = \sum_{i} \left( Q_{b,i} \times (P_{i,\text{pool}} - \text{Cost}_{i,\text{bundle}}) \right) - L_b$$

where $\text{Cost}_{i,\text{bundle}} = \frac{\text{wholesaler\_carton\_cost}_i}{M_i}$ and $L_b$ is the batch logistics cost (`RM 12.00` when `dispatch_mode = 'FOUNDER'`, or `RM 45.00` when `dispatch_mode = 'RUNNER'`).

---

## 4. Scheduled Cron Jobs & State Machine Transitions

All cron schedules execute in `Asia/Kuching` (`UTC+8`):

| Cron Expression (MYT) | Target State | Automated System Task |
| :--- | :--- | :--- |
| `0 14 * * 2` (Tue 14:00) | `POOL_OPEN` | Create new `pool_batches` record for upcoming Thursday; send WhatsApp Broadcast (`Script B`) to cluster vendors. |
| `1 14 * * 2` (Tue 14:01) | `COLLECTING_ORDERS` | Open webhook listener to accept/upsert vendor order lines until Wednesday 12:00. |
| `0 12 * * 3` (Wed 12:00) | `POOL_LOCKED` | Reject late order mutations without admin override; compute $Q_{b,i}$ and $C_{b,i}$ across all 6 SKUs. |
| `30 12 * * 3` (Wed 12:30) | `PO_SUBMITTED` | Dispatch WhatsApp Confirmation Receipts (`Script C`) to ordering stalls; transmit consolidated Master Carton PO to Pending wholesaler. |
| `30 13 * * 4` (Thu 13:30) | `WHOLESALER_PICKUP` | Unlock Runner Pickup Checklist; prompt founder to release DuitNow payment to wholesaler upon carton count confirmation. |
| `15 14 * * 4` (Thu 14:15) | `CROSS_DOCK_SORT` | Render car-boot bundle-splitting manifest sorted by `stall_number`. |
| `30 14 * * 4` (Thu 14:30) | `STALL_DELIVERY` | Enable stall-side handover tracking and `PAID_DUITNOW` / `PAID_CASH` status toggles. |
| `30 15 * * 4` (Thu 15:30) | `BATCH_RECONCILED` | Finalize payment totals, deduct cash collected from runner's RM 45 payout (or verify transfer), and update `current_buffer_bundles` ($S_{b,i,\text{end}}$). |

---

## 5. Security, Financial Controls & Reliability

* **Zero-Leakage Runner Protocol:** Runners never handle wholesale purchase cash. The founder pays the Pending wholesaler directly via online banking/DuitNow only after the runner verifies the physical Master Carton count at the loading bay. For vendor collections, runners present a laminated **Sarpply Corporate DuitNow QR Card** tied directly to the founder's corporate bank account; any physical cash collected is offset against the runner's RM 45.00 shift payout or transferred immediately at 15:30 MYT reconciliation.
* **Order Upsert Idempotency:** If a vendor sends a second message before Wednesday 12:00 PM (e.g., updating `A1` from 2 bundles to 3 bundles), the webhook parser upserts on `(batch_id, vendor_id, sku_code)` and sends an updated confirmation preview so duplicate lines are never double-counted.
