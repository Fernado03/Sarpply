---
project: Sarpply
pronunciation: "Supply" (Sarawak + Supply)
pillar: 05_PRD
version: 1.1-MVP-to-Phase2
beachhead_location: Premier 101 + Gala City, Kuching, Sarawak
supplier_hub: Pending Industrial Estate & Demak Laut, Kuching
target_customer: Independent Kopitiam & Food Court Hawker Stalls
operating_unit: Route (2 Clusters, 12-14 Stalls, 2 Sorties)
supersedes: v1.0 (8-stall cluster, RM 250 AOV, 6-8% savings, single-drop fulfilment, real-time DuitNow reconciliation)
---

# Sarpply — Pillar 5: Product Requirements Document (PRD)

> **Terminology.** `GLOSSARY.md` is authoritative: **Stall** (buyer), **Wholesaler** (supplier), **Bundle** (sell unit), **Master Carton** (buy unit), **Cluster** (6–7 Stalls), **Route** (2 Clusters), **Sortie** (one delivery pass), **Route Batch** (one week's cycle). Decisions are recorded in `docs/adr/`.

## 1. Product Vision

**Sarpply** aggregates weekly **Preorders** of universal back-of-house consumables — takeaway packaging, plastic bags, kitchen staples — across independent hawker **Stalls**, consolidates them into **Master Carton** quantities, and delivers **Bundles** stall-side once a week.

Two facts define the product:

1. **A single Cluster cannot pay for a shift.** 8 Stalls yield RM 1,466.20 GMV and RM 143.50 GP, below the RM 1,500 / RM 150 gate. The operating unit is a **Route** of 12–14 Stalls across two Clusters.
2. **A Route does not fit one vehicle trip.** 22 Master Cartons pack to 1,318 L; the fleet tops out at ~1,000 L. Fulfilment is **two Sorties** (`ADR-0016`).

The product roadmap bridges a **Zero-Code MVP (Weeks 1–4)** — WhatsApp Business plus a Google Sheets aggregator — and a **Phase 2 platform** (WhatsApp Cloud API, Supabase/PostgreSQL, Founder Admin Console, Runner web app). Phase 2 does not start until the commercial gate is cleared (`ADR-0009`).

---

## 2. Personas

| Persona | Context | Pains | Needs from the system |
| :--- | :--- | :--- | :--- |
| **1. Stall Operator** (primary) | Independent F&B operator in an 8×8 ft stall inside Premier 101 or Gala City. Peak shifts 7:00–13:30 and 17:30–20:30; break 14:00–17:00. | Pays **4.8%–13.3%** more for loose Bundles at cash-and-carry. Cannot meet 10–20 Master Carton MOQs. Storage for 500–2,000 boxes is impossible. Loses the afternoon break to a supply run. | Save 4.8%–13.3% while ordering **6–12 Bundles in total** per week. Zero prepayment. Predictable Thursday handover. Order by text or voice note — never a form. |
| **2. Founder / Operator** (admin) | Negotiates Wholesaler pricing, runs the broadcast, cuts off orders, submits the PO, reconciles. Drives Weeks 1–2, then deploys a Runner. | Manual entry errors on colloquial replies; miscounting carton rounding against Buffer Stock; cash leakage at handover; **no payment feed to reconcile against**. | Automated SKU extraction; one-click carton calculation net of Buffer Stock; a sortie load check that refuses to overfill the vehicle; a read-back loop that prevents a misheard voice order from becoming a PO. |
| **3. Runner** (logistics) | Student or gig driver with an Avanza-class MPV or Myvi-class hatchback. Works a **2.75-hour** Thursday shift across **two Sorties**. | Ambiguous delivery lists; carrying cash; unclear authority. | Ordered sortie manifest by Stall; **shift-scoped, least-privilege** access; a receipt echo that proves what was recorded (`ADR-0012`). |
| **4. Wholesaler** (supply) | Packaging/dry-goods distributor in Pending Industrial Estate or Demak Laut, 12–15 min from the Clusters. | Small walk-in buyers; credit risk. | One consolidated PO per Route per week, ~19–22 Master Cartons, self-pickup, instant DuitNow on collection. |

---

## 3. Functional Requirements

Priority: **P0** = required for Phase 2 launch; **P1** = next; **P2** = later.

### Epic 1 — Stalls, Clusters, Routes

* **FR-1.1 (Route and Cluster structure — P0):** Group Stalls into **Clusters** (6–7 Stalls) assigned to a **Route**; each Cluster carries a `trip_number` naming the Sortie that serves it. Route carries `cutoff_day/time`, `delivery_day/time` and `sortie_count`.
* **FR-1.2 (Off-peak onboarding — P0):** Register a Stall during the field window **14:15–16:00 MYT** via a QR code on the laminated Pool Price Card that opens a pre-filled WhatsApp opt-in.
* **FR-1.3 (Stall profile — P0):** Store `stall_number`, `stall_name`, `whatsapp_phone`, `written_language` (`ms-MY` | `en` | `zh-CN`), `trust_tier`.
* **FR-1.4 (Trust tiers — P0):** `ANCHOR_PRIORITY` (rank 1), `COD_APPROVED` (2), `PROVISIONAL` (3), `SUSPENDED`. Drives shortfall rationing only — **there is no prepayment flow**, so no tier requires prepayment.
* **FR-1.5 (Provisional Stalls — P1):** A Spot Sale to an unregistered buyer creates a Stall with `onboarding_status = 'PROVISIONAL_SPOT'` and no phone number (`ADR-0013`). `stall_orders.stall_id` is never null.

### Epic 2 — Broadcast and Order Ingestion

* **FR-2.1 (Broadcast — P0):** At `cutoff_day − 22 h` (Tuesday 14:00), transition the Route Batch to `OPEN_FOR_ORDERS` and send Script B with the week's locked Pool Prices.
* **FR-2.2 (Text order parsing — P0):** Parse structured replies (`"A1 x 3, C1 x 2"`) by regex, then a synonym pass, then an LLM fallback returning strict JSON with `needs_clarification`.
* **FR-2.3 (Voice orders — P0):** Accept voice notes. **No transcription may create or modify a committed order.** A voice note produces an `UNCONFIRMED_VOICE_DRAFT`, a one-line read-back in the Stall's `written_language`, and an entry in the Founder's audio queue (`ADR-0014`, `ADR-0004`).
* **FR-2.4 (Read-back confirmation — P0):** A draft commits only on an affirmative token — `OK`, `YA`, `YES`, `1`, `好`, `对` — or manual Founder approval. Anything ambiguous expires uncommitted.
* **FR-2.5 (Cutoff — P0):** At Wednesday 12:00, freeze `ordered_bundles` and the price snapshot. Aggregation reads **Ordered Bundles and nothing else** (`ADR-0002`).

### Epic 3 — Aggregation, Buffer Stock, Wholesaler PO

* **FR-3.1 (Carton calculation — P0):** Per Route and SKU: `C = max(0, ceil((Q − S_prev) / M))`, where `Q` is Ordered Bundles at Cutoff and `S_prev` is the Buffer Stock balance **derived from the ledger** — never a stored counter (`ADR-0007`).
* **FR-3.2 (Physical box count — P0):** Track both price units and **physical boxes**: `A1`/`A2` ship as two cartons (bodies + lids) until the Wholesaler proves otherwise. `physical_boxes_per_carton` defaults to 2 for `A1`/`A2`, 1 for the rest.
* **FR-3.3 (Sortie capacity guard — P0):** Refuse to publish a Route whose per-Sortie load exceeds the assigned vehicle: `SUM(cartons × carton_geometric_liters) / 0.80 ≤ vehicles.max_cargo_liters` (`ADR-0015`, `ADR-0016`).
* **FR-3.4 (PO generation — P0):** Produce a Wholesaler PO at Wednesday 12:30 with carton counts and cash required, carrying `cartons_ordered` per line.
* **FR-3.5 (Receipt of goods — P0):** At pickup, record `cartons_received` per PO line. The stock ledger writes from **received**, not ordered; a shortfall is a ledger fact, not an edit (`ADR-0011`).
* **FR-3.6 (Shortfall rationing — P1):** Allocate a shortfall by trust tier then order time, and notify affected Stalls before the Sortie departs.
* **FR-3.7 (Dual-Wholesaler quotes — P1):** Keep secondary quotes for all six SKUs; switching supplier changes the price snapshot and must be recorded as a new price row (`ADR-0008`).

### Epic 4 — Fulfilment and Money

* **FR-4.1 (Sortie manifest — P0):** Generate a per-Sortie manifest grouping Bundles by Stall, with a running packed-volume total.
* **FR-4.2 (Delivery recording — P0):** Record `delivered_bundles` per order — `fulfilment_status ∈ {PENDING, DELIVERED, PARTIAL, UNCOLLECTED}`. This is **orthogonal** to payment (`ADR-0002`).
* **FR-4.3 (Attested payment — P0):** Record `payment_status ∈ {UNPAID, PAID_CASH, PAID_DUITNOW, VOIDED}` plus `payment_reference`, `payment_attested_at`, `attested_by`, and for DuitNow a `payment_proof_url`. There is **no automatic payment reconciliation** (`ADR-0001`).
* **FR-4.4 (Receipt echo — P0):** Every handover sends the Stall a WhatsApp receipt naming the amount and the recorded method, so a wrong attestation surfaces the same afternoon (`ADR-0012`).
* **FR-4.5 (Spot Sales — P0):** Record a Spot Sale as a **new order row** with `order_type = 'SPOT'`. Never a status mutation on a Preorder (`ADR-0002`).
* **FR-4.6 (Three margin figures — P0):** Report **Forecast GP** (ordered, at Cutoff), **Realized GP** (delivered + spot), and **Net Batch Cash Flow** (cash basis). The gate is judged on Realized GP (`ADR-0010`).

---

## 4. Catalogue: the Golden 6

Non-perishable, fungible, high-overlap across noodle, rice, burger and drink Stalls.

| SKU | Product | Bundle | Bundles/MC | Boxes/MC | Litres/MC | Carton cost | Pool price | Street | Saving | Margin |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SKU | Item | Pack | Bundles/MC | Boxes/MC | Litres/MC | Carton Cost | Pool Price | Margin |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A1** | PP cup 22 oz + flat lid | 10 bundles × 100 pcs | 10 | **2** | **92.50** | RM 135.00 | **RM 15.00** | 10.0% |
| **A2** | PP cup 16 oz + dome lid | 10 bundles × 100 pcs | 10 | **2** | **84.00** | RM 120.00 | **RM 13.50** | 11.1% |
| **B1** | 750 ml rectangular food container + lid | 10 bundles × 50 pcs | 10 | 1 | 76.00 | RM 110.00 | **RM 12.50** | 12.0% |
| **C1** | Kraft brown lunch box | 12 bundles × 50 pcs | 12 | 1 | 68.50 | RM 144.00 | **RM 13.50** | 11.1% |
| **D1** | Evaporated / condensed milk | 8 bundles × 6 tins | 8 | 1 | 28.00 | RM 160.00 | **RM 21.00** | 4.8% |
| **E1** | Singlet oxo-bag + straw | 10 bundles | 10 | 1 | 35.00 | RM 90.00 | **RM 10.50** | 14.3% |

**Every figure above is measured** from Batch 1 and Batch 2 supplier invoices and field measurement, replacing the v1.1 seed table. Street-retail and stall-saving columns are dropped: only one saving has been measured (`C1` at RM 0.50, 3.7%) and quoting unmeasured savings to Stalls is a credibility risk.

**`A1`/`A2` ship as two physical boxes per price unit** — bodies and lids are not nested. Confirmed in the field, and it is why they carry the largest volume per Master Carton.

**Out of scope (MVP):** perishables and recipe-specific ingredients; subsidised cooking oil and flour (2%–4% margin, heavy); any warehouse lease.

---

## 5. Success Metrics

| Metric | Target | Why this number |
| :--- | :--- | :--- |
| **Realized GP per Route shift** | **≥ RM 150** | The commercial gate. Measured: RM 167.00 (B01), RM 187.50 (B02). |
| **GMV per Route shift** | **≥ RM 1,500** | Same gate. Measured: RM 1,657.00 (B01), RM 1,896.00 (B02). |
| **Gate headroom** | **≥ RM 25 of GP** | Measured headroom is RM 17.00 and RM 37.50 — a 1.1% Wholesaler rise erases the first. |
| **Stalls per Route** | **9 (measured floor) – 10 (vehicle ceiling)** | Below 9 the gate fails; above 10 needs a second Sortie. |
| **Stalls per Cluster** | 5 (Myvi) | Measured: 9 Stalls across two Clusters, one Sortie. |
| **Penetration** | 20% of a ~65-Stall catchment, or 30–35% of one 40-Stall zone | See Pillar 2 §1.1. The v1.0 "20% of 40" was arithmetically impossible. |
| **Net Contribution Margin** | **RM 134.75 – RM 145.00** | Measured, after one RM 42.50 Runner. |
| **`D1` resilience** | Route still clears RM 150 GP with `D1 = 0` | RM 209.40. The least reliable SKU cannot sink a shift. |
| **Voice drafts** | ~10–14 clips/week, < 90 s Founder review | The real cost of the read-back policy. |

**Cluster Preorder Penetration** (active Stalls with ≥1 delivered Preorder in the trailing 4 batches ÷ `total_addressable_stalls`) and **Spot-Only Buyers** (funnel) are tracked as separate numbers — never blended.
