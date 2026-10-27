---
project: Sarpply
pillar: 06_TRD
version: 1.1-MVP-to-Phase2
stack_mvp: WhatsApp Business App + Google Sheets Aggregator + Static DuitNow QR
stack_phase2: WhatsApp Cloud API + Supabase (PostgreSQL/Edge Functions) + Next.js Admin/Runner web + LLM fallback parser
timezone: Asia/Kuching (MYT / UTC+8)
supersedes: v1.0 (hardcoded per-state cron jobs, single-trip fulfilment, current_buffer_bundles counter, real-time DuitNow)
---

# Sarpply — Pillar 6: Technical Requirements Document (TRD)

> **Terminology** is defined in `GLOSSARY.md`. This document obeys the ADRs; where it appears to contradict one, the ADR wins.

## 1. Architecture

### 1.1 Phase 1 — Zero-code pilot (Weeks 1–4)

* **Messaging:** WhatsApp Business app, broadcast lists and quick replies (Scripts B/C/D).
* **Compute/storage:** Google Sheets workbook — `SKU_Master`, `Stall_Orders`, `Wholesaler_Aggregator`, `Buffer_Ledger`.
* **Payment:** static corporate DuitNow QR on a laminated card, plus cash. **No acquiring fee, no webhook, no transaction feed** (`ADR-0001`).

The pilot must record **`delivered_*` alongside `ordered_*`** from Batch #1. A pilot that logs only what was ordered cannot produce Realized GP, and the gate would then be measured on forecasts (`ADR-0010`).

### 1.2 Phase 2 — Platform

```
                 ┌──────────────────────────────────────────┐
   Stalls ──────▶│ WhatsApp Cloud API webhook               │
   (text/voice)  │  ├─ Tier 1  regex                        │
                 │  ├─ Tier 2  synonym pass                 │
                 │  └─ Tier 3  LLM → strict JSON            │
                 │  └─ VOICE → draft + read-back (never     │
                 │            auto-commits; ADR-0014)       │
                 └────────────────┬─────────────────────────┘
                                  ▼
                 ┌──────────────────────────────────────────┐
                 │ Supabase / PostgreSQL                    │
                 │  routes · clusters · stalls · skus       │
                 │  route_batches · stall_orders            │
                 │  stock_movements (immutable ledger)      │
                 │  vehicles · wholesaler_po_lines          │
                 └───────┬──────────────────────┬───────────┘
                         ▼                      ▼
              ┌────────────────────┐  ┌──────────────────────┐
              │ Founder Console    │  │ Runner web app       │
              │ · margin guards    │  │ · sortie manifest    │
              │ · PO + cash forecast│ │ · attest payment     │
              │ · voice audio queue│  │ · receipt echo       │
              │ · sortie load check│  │ · shift-scoped auth  │
              └────────────────────┘  └──────────────────────┘
```

**Two architectural rules that are not negotiable:**

1. **Buffer Stock is a ledger, not a counter.** `stock_movements` is append-only with idempotency keys; balance is a derived view (`ADR-0007`).
2. **Timing is data, not cron.** A single dispatcher polls every 15 minutes and fires due transitions read from `routes` (`ADR-0005`).

---

## 2. Order ingestion

### 2.1 Tier 1 — regex (text only)

```regex
/\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g
```

Group 1 → upper-cased `sku_code`, validated against the active catalogue. Group 2 → `ordered_bundles ≥ 1`.

### 2.2 Tier 2 — synonym pass

Token map per `05_PRD.md` §4 / `02_Go_To_Market_Strategy.md` §5. Handles `"bekas kecil 3 bundle"`, `"pakai plastik 9x11 dua"`, `"小盒 3"`. Hokkien tokens are matched **on the transcript**, never used to select an ASR model.

### 2.3 Tier 3 — LLM fallback

Input: message + synonym dictionary. Output: strict JSON only.

```json
{ "orders": [{ "sku_code": "A1", "bundles_ordered": 3 }], "needs_clarification": false }
```

`"Bagi bekas tapau 3 bundle"` (no size) must return `needs_clarification: true` and trigger the A1/A2 prompt. The model may never invent a quantity.

### 2.4 Voice path — a different pipeline, deliberately

| Step | Behaviour |
| :--- | :--- |
| 1 | Voice note received → stored, transcribed |
| 2 | Creates `UNCONFIRMED_VOICE_DRAFT`. **Does not touch `stall_orders`.** |
| 3 | One-line read-back in the Stall's `written_language` (Script D) |
| 4 | Draft appears in the Founder audio queue (~10–14 clips/week, < 90 s total) |
| 5 | Commits **only** on affirmative token (`OK`/`YA`/`YES`/`1`/`好`/`对`) or Founder approval |
| 6 | Unconfirmed drafts expire at Cutoff without committing |

**Why:** published Hokkien ASR reaches 96.6% character error rate — unusable for quantity capture — and no commercial provider ships a real Hokkien locale (`docs/02_product_eng/asr-feasibility-kuching.md`). An unreviewed transcription writing to the table a Wholesaler PO is built from is a RM 135-per-carton error class. Read-back costs one message.

### 2.5 Idempotency

Text orders upsert on `(route_batch_id, stall_id, sku_code, order_type)`. Voice drafts carry a `source_message_id` unique key so a redelivered webhook cannot create a second draft.

---

## 3. Money and stock

### 3.1 Carton calculation

$$C_{r,i} = \max\left(0,\ \left\lceil \frac{Q_{r,i} - S_{i,\text{prev}}}{M_i} \right\rceil\right)$$

$Q_{r,i}$ = Ordered Bundles for the Route at Cutoff. $S_{i,\text{prev}}$ = ledger balance. $M_i$ = `bundles_per_master_carton`.

### 3.2 Buffer Stock (derived)

$$S_{i,\text{end}} = S_{i,\text{prev}} + \text{received}_{r,i} \cdot M_i - \sum_{s \in r} \text{delivered}_{s,i}$$

Note **received**, not calculated: a Wholesaler shortfall must flow through, not be papered over (`ADR-0011`).

### 3.3 Three margin figures

| Figure | Formula | Use |
| :--- | :--- | :--- |
| **Forecast GP** | `Σ ordered × (locked_price − locked_cost)` | Expectation, known at Cutoff |
| **Realized GP** | `Σ delivered × (locked_price − locked_cost)` **+ Spot Sales** | **The gate** |
| **Net Batch Cash Flow** | `collected − cartons_received × carton_cost − sortie_count × runner_rate` | Float planning |

Identity: `Realized GP − closing Buffer Stock at cost = Net Batch Cash Flow`. Any report violating it has a ledger bug (`ADR-0010`).

### 3.4 Sortie capacity

$$\sum_{i \in \text{sortie}} \frac{C_i \cdot L_i}{0.80} \le V_{\max}$$

$L_i$ = `carton_geometric_liters`, $V_{\max}$ = `vehicles.max_cargo_liters` (Myvi 800, Avanza 1000). **This is a hard publish-time guard, not a warning** (`ADR-0016`).

### 3.5 Two-stage margin guard

| Stage | When | Check |
| :--- | :--- | :--- |
| **Stage 1** | Tue 13:30, before broadcast | Projected GP per Route at last week's mix ≥ RM 150; else `ADMIN_PRICING_ALERT` |
| **Stage 2** | Wed 12:00, at Cutoff | Real mix projected GP ≥ RM 150; else flag before the PO goes out |

The gate breaks at **+4.16%** carton cost, so a 5% Wholesaler move must be caught before the broadcast, not at pickup.

---

## 4. State machine and the dispatcher

### 4.1 States

`OPEN_FOR_ORDERS → CLOSED_AT_CUTOFF → PO_SUBMITTED → GOODS_RECEIVED → IN_TRANSIT (per Sortie) → DELIVERED → RECONCILED`, plus `CANCELLED_LOW_VOLUME`.

`CANCELLED_LOW_VOLUME` exists **only** for demand reasons. There is no stock-risk reason to cancel: the goods are non-perishable, and a Wholesaler is contacted on Wednesday with 48.5 hours of notice.

`POOL_OPEN`, `COLLECTING_ORDERS`, `POOL_LOCKED`, `WHOLESALER_PICKUP`, `CROSS_DOCK_SORT`, `STALL_DELIVERY` and `BATCH_RECONCILED` are deleted — they encoded a single-Cluster rhythm and duplicated states that are orthogonal.

### 4.2 Dispatcher

One job, every 15 minutes, `Asia/Kuching`:

```text
for each route where a transition is due (comparing now() against routes.*):
    if not already fired for this (route_batch, transition):
        fire; record (route_batch_id, transition, fired_at) with a UNIQUE key
```

Every firing is recorded and idempotent, so a crash-loop cannot re-broadcast or re-submit a PO. A transition may fire up to 15 minutes late — acceptable across a 22-hour ordering window, unacceptable in the 30-minute `CLOSED_AT_CUTOFF → PO_SUBMITTED` gap, which is why the dispatcher interval must be **≤ 15 min and the gap ≥ 30 min** (`ADR-0005`).

There is **no hardcoded cron table**. The old v1.0 table (`0 14 * * 2` … `30 15 * * 4`) hardcoded one Route's Thursday into the deployment; onboarding a Route with a Monday cutoff would have required a code change.

| Transition | Offset from Cutoff | Owner |
| :--- | :--- | :--- |
| `OPEN_FOR_ORDERS` | −22 h (Tue 14:00) | dispatcher → broadcast |
| `CLOSED_AT_CUTOFF` | 0 (Wed 12:00) | dispatcher; freeze orders + prices |
| `PO_SUBMITTED` | +30 min | Founder approves PO |
| `GOODS_RECEIVED` | +47.25 h (Thu 13:15) | Runner records `cartons_received` |
| `DELIVERED` | +47.5 h → +51.8 h (2 Sorties) | Runner per Stall |
| `RECONCILED` | +52 h (Thu 16:00) | Founder |

---

## 5. Security and financial control

* **Least privilege** (`ADR-0012`): a Runner session is shift-scoped. The Runner may set `delivered_bundles`, `fulfilment_status`, `payment_status`, and record Spot Sales. The Runner **may not** change a Preorder quantity, `unit_price_locked`, a past batch, or void a payment.
* **`PAID_DUITNOW` requires `payment_proof_url`** — enforced by constraint.
* **No Wholesaler cash in Runner hands.** The Founder pays the Wholesaler by DuitNow once the Runner confirms the carton count at the loading bay.
* **Receipt echo on every handover**, naming amount and recorded method. This is the audit mechanism; a static QR has no other one.
* **RLS**: if the frontmatter claims row-level security, policies must actually exist. v1.0 claimed RLS and defined zero policies.

---

## 6. Known gaps to close before Phase 2 code

| Gap | Owner | Blocking? |
| :--- | :--- | :--- |
| `A1`/`A2` nested vs separate lid cartons | Founder → Wholesaler (Script A Q1) | **Yes** — changes vehicle choice |
| Petrol included in RM 42.50/sortie? | Founder → Runner hiring | No, but affects net |
| ~~Voice-note retention/PDPA policy~~ | **Resolved** — 7 days after reconciliation (`ADR-0017`) | Closed |
| Stage 1 / Stage 2 threshold values | Founder | No — defaults above |
