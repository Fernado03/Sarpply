---
project: Sarpply
pillar: 08_Appflow
version: 1.0-MVP-to-Phase2
operational_cadence: Weekly Tuesday-to-Thursday Loop
---

# Sarpply — Pillar 8: Application & Operational Flows (Appflow)

## 1. Master Weekly Batch State Machine

Every cluster operates on a deterministic 8-state weekly lifecycle:

```
[TUESDAY 14:00]
   │
   ▼
┌─────────────────────┐
│     1. POOL_OPEN    │ ──> Dispatches Bilingual WhatsApp Broadcast (Script B)
└──────────┬──────────┘     to all active stalls in Premier 101.
           │
           ▼ (Tue 14:00 – Wed 12:00)
┌─────────────────────┐
│ 2. COLLECTING_ORDERS│ ──> Hawkers reply via WhatsApp. System parses via
└──────────┬──────────┘     Fast Regex -> Trilingual LLM Fallback -> Upserts DB.
           │
           ▼ [WEDNESDAY 12:00 CUTOFF]
┌─────────────────────┐
│   3. POOL_LOCKED    │ ──> Freezes order quantities; runs Wholesaler_Aggregator
└──────────┬──────────┘     formula to calculate Master Cartons (C_b,i).
           │
           ▼ [WEDNESDAY 12:30]
┌─────────────────────┐
│  4. PO_SUBMITTED    │ ──> Sends itemized receipts (Script C) to stalls; sends
└──────────┬──────────┘     consolidated Master Carton PO to Pending wholesaler.
           │
           ▼ [THURSDAY 13:30]
┌─────────────────────┐
│ 5. WHOLESALER_PICKUP│ ──> Founder/Runner arrives at Pending Industrial Estate;
└──────────┬──────────┘     verifies carton count; Founder pays via DuitNow.
           │
           ▼ [THURSDAY 14:15]
┌─────────────────────┐
│ 6. CROSS_DOCK_SORT  │ ──> Parks at Premier 101 loading zone; breaks Master Cartons
└──────────┬──────────┘     in car boot; writes stall numbers on bundles with marker.
           │
           ▼ [THURSDAY 14:30]
┌─────────────────────┐
│  7. STALL_DELIVERY  │ ──> Pushes trolley to stalls; hands over bundles; collects
└──────────┬──────────┘     DuitNow QR scan or Cash on Delivery (COD).
           │
           ▼ [THURSDAY 15:30]
┌─────────────────────┐
│ 8. BATCH_RECONCILED │ ──> Reconciles DuitNow/Cash, settles RM 45 runner payout,
└─────────────────────┘     and logs surplus bundles into carryover buffer stock.
```

---

## 2. Detailed Sub-Flows

### 2.1 Flow A: Off-Peak Hawker Walk-In Onboarding (Days 3–5 / Ongoing)

1. **Timing Gate Check:** Field agent verifies current time is strictly within **14:15 – 16:00 MYT** (never during 7:00 AM–1:30 PM or 5:30 PM–8:30 PM peak cooking shifts).
2. **Anchor Stall Selection:** Agent approaches the kopitiam drink stall (high velocity for SKU `D1` Sweetened Creamer) or a friendly anchor stall (`Stall #3`) first.
3. **Physical Pitch & Price Comparison:** Agent hands the hawker a physical sample of SKU `A1` (650ml PP microwave box) and the laminated **1-Page Bilingual Pool Price Card**, highlighting RM 15.00 pool pricing vs. RM 16.50 street retail (saving 9.1% with zero MOQ and free Thursday 2:30 PM stall-side delivery).
4. **WhatsApp QR Opt-In:** Hawker scans the WhatsApp Business QR code on the card.
5. **Database Registration:** System creates a `vendors` record linked to the `Premier 101 / Jalan Tun Jugah` cluster with `stall_number`, `stall_name`, `whatsapp_phone`, `preferred_language`, and `trust_tier = 'COD_APPROVED'`.
6. **Neighboring Stall Cascade:** Agent walks to the adjacent 7 stalls inside Premier 101 and pitches: *"Stall #3 is already in this Thursday's Premier 101 pool—join together so everyone gets the Master Carton discount"*.

---

### 2.2 Flow B: Conversational Order Ingestion & Hybrid Parsing Flow

```
Hawker Sends WhatsApp Message
             │
             ▼
Is Cluster Batch in POOL_OPEN / COLLECTING_ORDERS?
   ├── NO ──> Reply: "Pool minggu ini dah tutup (Rabu 12pm). Order masuk pool minggu depan!"
   └── YES
        │
        ▼
Run Tier 1 Regex: /\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g
   ├── MATCH FOUND (e.g., "A1 x 3, C1 x 2")
   │        │
   │        ▼
   │   Validate SKU in [A1, A2, B1, C1, D1, E1] & Qty > 0
   │        │
   └── NO MATCH (e.g., "Boss bagi bekas kecil 3 dengan plastik 2")
            │
            ▼
       Invoke Tier 2 LLM Parser + Trilingual Synonym Dictionary
            │
            ├── needs_clarification == true
            │     └──> Send Bilingual Clarification Prompt (e.g., A1 650ml vs A2 750ml?)
            │
            └── needs_clarification == false
                  │
                  ▼
       Upsert `vendor_orders` rows with `unit_price_locked = skus.pool_bundle_price`
                  │
                  ▼
       Send Instant Provisional Order Acknowledgment via WhatsApp
```

*Flow references:* Implements the two-step regex and trilingual LLM parser specification.

---

### 2.3 Flow C: Exception & Risk Handling Flows (Thursday Fulfillment)

1. **Exception 1: Pool Shortage on a Single SKU (e.g., Stalls order 6 bundles of `A1`, Carton size = 10)**
   * System calculates $C_{b,\text{A1}} = \lceil (6 - 0) / 10 \rceil = 1$ Master Carton (RM 135.00).
   * Founder/Runner delivers 6 bundles (RM 90.00 revenue) and either sells the remaining 4 bundles on the spot to adjacent Premier 101 stalls during the Thursday walk-through at RM 15.00/bundle, or stores the 4 non-perishable bundles in the car boot as carryover buffer ($S_{b,\text{A1},\text{end}} = 4$) for next Tuesday's pool.
2. **Exception 2: Unexpected Stall Closure on Thursday at 14:30 MYT**
   * If Stall #4 is closed during the Thursday 2:30 PM delivery window, the runner marks the order as uncollected.
   * Because all 6 SKUs are 100% universal consumables used by 90% of stalls in Premier 101, the runner offers the uncollected bundles to neighboring stalls on the spot or retains them in the vehicle buffer stock for the following week with zero spoilage.
3. **Exception 3: Primary Wholesaler Out-of-Stock on Wednesday at 12:30 MYT**
   * If the primary Pending Industrial Estate supplier is out of stock on any SKU when the PO is submitted on Wednesday, the operator routes that SKU's Master Carton order to the pre-verified secondary wholesaler in Pending or Demak Laut.
