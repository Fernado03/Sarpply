---
project: Sarpply
pillar: 08_Appflow
version: 1.1-MVP-to-Phase2
operational_cadence: Weekly Tuesday-to-Thursday loop
operating_unit: Route (2 Clusters, 12-14 Stalls, 2 Sorties)
supersedes: v1.0 (8-state single-cluster machine, single 14:30 drop, RM 45 payout)
---

# Sarpply — Pillar 8: Application & Operational Flows

> Terminology per `GLOSSARY.md`. Times are MYT. A **Route** runs **two Sorties**; a Stall belongs to exactly one Cluster and therefore one Sortie.

## 1. Batch lifecycle

### 1.1 Why the state machine shrank

v1.0 had eight states and one linear path. Three of those states were artifacts of a single-Cluster Thursday, and two more were **not states at all** — payment and fulfilment are independent axes (`ADR-0002`). A batch where payment is `PAID_CASH` and fulfilment is `PARTIAL` cannot be expressed in one enum.

Current model:

```
[TUESDAY 14:00]
        │
        ▼
┌────────────────────┐
│ OPEN_FOR_ORDERS    │──▶ Script B broadcast, prices locked for the week
└─────────┬──────────┘
          │  (22 h of collection; text + voice-with-read-back)
          ▼
[WEDNESDAY 12:00]
┌────────────────────┐
│ CLOSED_AT_CUTOFF   │──▶ ordered_bundles frozen; Stage-2 margin guard;
└─────────┬──────────┘    Buffer Stock read from ledger
          │  (+30 min)
          ▼
┌────────────────────┐
│ PO_SUBMITTED       │──▶ Script C receipts; Wholesaler PO with cartons_ordered
└─────────┬──────────┘
          │  (+47 h 15 min — the Wholesaler packs)
          ▼
[THURSDAY 13:15]
┌────────────────────┐
│ GOODS_RECEIVED     │──▶ Runner counts; cartons_received recorded per line;
└─────────┬──────────┘    shortfall alerts Founder (never silently edited)
          │
          ├──────────────▶ SORTIE 1 (Premier 101) 13:30–14:25
          │                     │
          │                     ▼ (returns to pickup point 14:40)
          └──────────────▶ SORTIE 2 (Gala City)   14:55–15:50
                                │
                                ▼
[THURSDAY 16:00]
┌────────────────────┐
│ RECONCILED         │──▶ Attested payments settled, receipts confirmed,
└────────────────────┘    ledger closed, Runner paid RM 85
```

**Two orthogonal statuses, per order:**

| Axis | Values | Meaning |
| :--- | :--- | :--- |
| `payment_status` | `UNPAID`, `PAID_CASH`, `PAID_DUITNOW`, `VOIDED` | What happened to the money |
| `fulfilment_status` | `PENDING`, `DELIVERED`, `PARTIAL`, `UNCOLLECTED` | What happened to the goods |

A Spot Sale is a **new row** (`order_type = 'SPOT'`), not a status change. An uncollected Preorder is `fulfilment_status = UNCOLLECTED`; its Bundles return to Buffer Stock and may be sold later as a separate Spot Sale row.

---

## 2. Flow A — Off-peak onboarding

1. **Timing gate.** Only 14:15–16:00 MYT. Never 07:00–13:30 or 17:30–20:30.
2. **Anchor first.** Approach the drink Stall (`D1` anchor) or a known-friendly Stall, not a random one.
3. **Physical pitch.** Hand over an `A1` sample and the Pool Price Card. Lead with the saving on the SKU they buy most, not with a percentage range.
4. **QR opt-in.** Stall scans the card; a pre-filled WhatsApp message opens.
5. **Registration.** Create the `stalls` row with `cluster_id`, `stall_number`, `stall_name`, `whatsapp_phone`, `written_language`, `trust_tier = 'COD_APPROVED'`.
6. **Cascade.** Tell the neighbours the anchor has joined.
7. **Cluster completeness rule.** Do not open Cluster B until Cluster A holds **6 committed Stalls**. A half-filled Cluster still costs a full Sortie.

---

## 3. Flow B — Order ingestion

```
Stall sends a WhatsApp message or voice note
            │
            ▼
Is the Route Batch OPEN_FOR_ORDERS?
   ├── NO ──▶ "Pool minggu ni dah tutup (Rabu 12 tengah hari).
   │           Order masuk pool Khamis depan."
   └── YES
        │
        ├── TEXT ──▶ Tier 1 regex
        │              ├── match ──▶ validate SKU ∈ Golden 6, qty ≥ 1
        │              │              └──▶ upsert stall_orders
        │              └── no match ─▶ Tier 2 synonyms ─▶ Tier 3 LLM
        │                                  └── needs_clarification
        │                                        └──▶ clarifying prompt
        │
        └── VOICE ──▶ transcribe ──▶ UNCONFIRMED_VOICE_DRAFT
                                       │
                                       ├──▶ Script D read-back to the Stall
                                       └──▶ Founder audio queue
                                              │
                              affirmative token? ◀──┘
                                 ├── YES ──▶ commit to stall_orders
                                 └── NO / silent ──▶ expires at Cutoff
```

**The voice branch never writes to `stall_orders` before step 5 of the read-back** (`ADR-0014`). This is the single most important control in the product: a 96.6%-CER transcript feeding a Wholesaler PO is a RM 135-per-carton mistake.

### 3.1 What happens at Cutoff to unconfirmed drafts

Every `UNCONFIRMED_VOICE_DRAFT` is expired, and the Founder sees a summary: *"3 drafts expired unconfirmed — Stall #07, #12, #15."* Those Stalls are **not** in the batch. They are called before the next broadcast, not silently dropped.

---

## 4. Flow C — Aggregation and PO

1. Read `Q` = Ordered Bundles per SKU for the Route (never per Cluster).
2. Read `S_prev` from the **ledger view** (`stock_movements`), not a counter.
3. Compute `C = max(0, ceil((Q − S_prev) / M))`.
4. Compute physical boxes: `C × physical_boxes_per_carton` (`A1`/`A2` = 2).
5. Compute per-Sortie volume: `Σ C × L / 0.80`. **If any Sortie exceeds `max_cargo_liters`, the app blocks PO submission** and asks the Founder to split the Cluster or switch vehicle.
6. Run the Stage-2 margin guard. If projected Realized GP < RM 150, warn loudly — the PO may still go out, but the Founder must consciously accept a below-gate week.
7. Emit PO with `cartons_ordered`; cash required = `Σ C × carton_cost`.

---

## 5. Flow D — Thursday execution

### 5.1 Pickup (13:15)

Runner counts physical boxes against the PO. `cartons_received` is recorded **per line**. The Founder releases DuitNow payment only after this count. If received < ordered, step 5.2 changes.

### 5.2 Shortfall (only if `cartons_received < cartons_ordered`)

1. Ledger writes from **received**.
2. Allocate by trust tier: `ANCHOR_PRIORITY` → `COD_APPROVED` → `PROVISIONAL`, then by order timestamp (`ADR-0011`).
3. Notify affected Stalls **before the Sortie departs** — at 13:30, not at the door.
4. Affected orders become `fulfilment_status = PARTIAL` with reduced `delivered_bundles`.

### 5.3 Sorties

| | Sortie 1 | Sortie 2 |
| :--- | :--- | :--- |
| Cluster | Premier 101 | Gala City |
| Pickup | 13:15 | 14:40 |
| Handover | 13:30–14:25 | 14:55–15:50 |
| Typical load | 869 L · 11 cartons · 7 Stalls | 778 L · 11 cartons · 7 Stalls |

Break cartons in the boot, mark Stall numbers, deliver, attest payment, send receipt. Return to the pickup point between Sorties to load the second batch — Buffer Stock stays in the vehicle throughout (`ADR-0003`).

### 5.4 Reconciliation (16:00)

1. Close the ledger: `S_end = S_prev + received × M − Σ delivered`.
2. Confirm every handover produced a receipt echo.
3. Record any uncollected Bundles as Buffer Stock (not as a loss).
4. Pay the Runner RM 85 (2 × RM 42.50).
5. Publish Forecast GP, Realized GP and Net Batch Cash Flow. **If the identity `Realized GP − Buffer at cost = Net Cash` fails, stop and fix the ledger before the next batch.**

---

## 6. Flow E — Exceptions

| Exception | Detection | Response |
| :--- | :--- | :--- |
| **Rounding leaves a surplus** | `S_end > 0` after delivery | Ledger credit. Offer to a neighbour as a Spot Sale; otherwise carry. Never discard — the goods are non-perishable. |
| **Stall closed at handover** | Runner taps `UNCOLLECTED` | Bundles return to Buffer Stock. Not a write-off. The Stall keeps its Preorder record; credit is not assumed. |
| **Cash short / DuitNow unproven** | Receipt echo unanswered, or no `payment_proof_url` | Order stays `UNPAID`; Founder follows up same day. Never mark paid on the Runner's word alone. |
| **Wholesaler out of stock** | At pickup | Shortfall path (§5.2). Switching Wholesaler mid-week breaks the price snapshot — treat as a new price row or as a cancelled batch, never as a silent substitution. |
| **Voice draft misread** | Stall replies anything other than an affirmative token | Draft does not commit; Founder calls. |
| **Sortie overload** | Computed at PO time | Blocked before submission. |

---

## 7. Flow F — The Standby Path (Phase 1 only)

Weeks 1–2 are run by the Founder with no software. The sheet must still capture, per Stall and SKU: `ordered`, `delivered`, `payment_method`, `payment_reference`. Without `delivered`, the gate cannot be computed on Realized GP and the whole Phase 2 trigger is void (`ADR-0009`).
