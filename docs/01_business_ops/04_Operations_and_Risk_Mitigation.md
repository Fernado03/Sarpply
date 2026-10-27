---
project: Sarpply
pillar: 04_Operations_and_Risk_Mitigation
version: 1.1-MVP
fulfillment_model: Zero-Inventory Cross-Docking
payment_terms_stall: Cash or Static DuitNow QR at handover (Runner-Attested)
payment_terms_wholesaler: Instant DuitNow on pickup
shift_shape: One Route shift = 2 sorties, 2.75 h
cutoff_to_handover_hours: 48.5
supersedes: v1.0 (POOL_OPEN/COLLECTING_ORDERS states, single 14:30 drop, RM 45/trip, 8-stall cluster)
---

# Sarpply — Pillar 4: Operations, Risk Mitigation & System Architecture

> **Terminology.** `GLOSSARY.md` is canonical. A **Route** is served in one Thursday **shift** comprising two **sorties**, one per **Cluster**. A **Cutoff** freezes orders; a **Runner** executes handovers and **attests** payment.

## 1. The Thursday Shift: Two Sorties

The Route cannot be delivered in one pass — 1,318 L of cartons, i.e. 869 L packed on the heavier of its two Sorties, against an 800 L Myvi ceiling (`ADR-0016`). So the shift is **two collection-and-delivery Sorties from the same Wholesaler pickup**, each serving one Cluster.

| Day & Time (MYT) | State | Action | Owner |
| :--- | :--- | :--- | :--- |
| **Tue 14:00** | `OPEN_FOR_ORDERS` | Broadcast (`Script B`) with this week's locked Pool Prices. | Founder / Bot |
| Tue 14:00 – Wed 12:00 | `OPEN_FOR_ORDERS` | Collect free-text and voice orders. Voice gets a read-back (`Script D`); nothing commits without it. | Founder / Bot |
| **Wed 12:00** | `CLOSED_AT_CUTOFF` | Orders frozen into `ordered_bundles`. Compute Master Cartons, run the **Stage 2 margin guard** on the actual basket mix. | System |
| **Wed 12:30** | `PO_SUBMITTED` | Send confirmations (`Script C`); submit consolidated PO to the Wholesaler. | Founder / Bot |
| Wed 12:30 – Thu 13:15 | *awaiting goods* | Wholesaler packs. **Any shortfall is learned only now** — see §4. | Wholesaler |
| **Thu 13:15** | `GOODS_RECEIVED` | Collect, count `cartons_received`, and pay the Wholesaler by DuitNow. Load Sortie 1. | Runner |
| **Thu 13:30 – 14:25** | *(Sortie 1 of `DELIVERED`)* | Cluster A: handover, attest payments, echo receipts. Return to pickup point. | Runner |
| **Thu 14:40** | *(reload)* | Load Sortie 2 from the same pickup point. | Runner |
| **Thu 14:55 – 15:50** | *(Sortie 2 of `DELIVERED`)* | Cluster B: handover, attest payments, echo receipts. | Runner |
| **Thu 16:00** | `RECONCILED` | Ledger closes (Buffer Stock is derived, not written), attested payments confirmed, Runner paid. | Founder |

**Timing facts, not assumptions:**

* **Cutoff → first handover is 48.5 hours** (Wed 12:00 → Thu 13:30). The Wholesaler needs all of it.
* **Physical custody of goods is ~2 hours**, not a day: pickup 13:15 → second sortie ends 15:50.
* **The shift is 2.75 hours**, not the 2 hours v1.0 budgeted. The Runner payout (RM 85) reflects two sorties, not one.
* **There is no intermediate ordering state.** Orders are open from broadcast to Cutoff; `POOL_OPEN`/`COLLECTING_ORDERS` were one state with two names (`ADR-0005`). The full state list is in `06_TRD.md` §4.1.

### 1.1 Sortie capacity is enforced in software

The app must refuse to publish a Route whose sorties exceed the vehicle (`ADR-0015`):

```sql
SELECT clusters.trip_number,
       SUM(skus.carton_geometric_liters * cartons) / 0.80 AS packed_liters
FROM clusters JOIN ...
GROUP BY clusters.trip_number
-- each row must be <= vehicles.max_cargo_liters (Myvi 800, Avanza 1000)
```

If a Cluster grows to 7 Stalls and only a Myvi is available, the app must **split into 3 sorties or decline the Stall** — not silently overfill the boot.

---

## 2. Founder-to-Runner Transition

### Phase 1: Weeks 1–2 (Founder-Driven)
* Builds rapport with Premier 101 Stalls, verifies parking and trolley paths, and — critically — **absorbs the negative cash weeks** while Buffer Stock accumulates (`03_Unit_Economics.md` §5, Working Capital).
* **Buffer Stock selling:** leftover bundles are offered at Pool Price to nearby Stalls during the walk-through. This is a **Spot Sale**, recorded as a new order row with a trust-tier tag, not a status change on an existing Preorder (`ADR-0013`).

### Phase 2: Week 3+ (Runner SOP)
* **Profile:** Local student (UNIMAS / Swinburne / Politeknik) or gig driver with an **Avanza-class or Myvi** vehicle.
* **Compensation:** **RM 42.50 per sortie, RM 85.00 per Route shift**, paid after reconciliation. Petrol is the Runner's cost — confirm this explicitly during hiring, because at ~30 km round trip it is ~RM 8–10 and the difference between a good and a bad gig for them.
* **Least privilege** (`ADR-0012`): the Runner session is **shift-scoped** and can:
  * Mark a bundle `DELIVERED` / `PARTIAL` / `UNCOLLECTED`
  * Attest payment: `PAID_CASH` or `PAID_DUITNOW` (+ `payment_reference`, `payment_attested_at`)
  * Record a Spot Sale **only** for an existing Stall or a `PROVISIONAL_SPOT` Stall

  The Runner **cannot** alter a Preorder quantity, change `unit_price_locked`, void a payment, or edit a past batch.
* **Zero-leakage control:**
  1. Founder pays the Wholesaler directly by DuitNow once the Runner confirms the carton count at the loading bay. **The Runner never carries Wholesaler cash.**
  2. Stalls pay by cash or by scanning the **static corporate DuitNow QR** (Sarpply's own account — zero acquiring fees; `ADR-0001`).
  3. **Every handover echoes a WhatsApp receipt naming the amount and the recorded method.** A `PAID_DUITNOW` attestation requires a `payment_proof_url`. The receipt is the audit trail — if the Stall's reply contradicts it, the Founder sees it the same afternoon.

---

## 3. Payment Realities (this changed)

There is **no live payment reconciliation**. A static DuitNow QR produces no webhook, no callback, and no per-transaction feed. Every payment is **Runner-Attested**: a human looked at a phone screen or took notes, and recorded what happened.

Consequences the operating plan must accept:

* Attestation is only as good as the Runner. The receipt echo exists to make a wrong attestation **visible within minutes**, not to prevent it.
* Cash and DuitNow are indistinguishable in the bank feed. Any claim of "automatic reconciliation" against a static QR is false and was removed from these docs.
* **Dynamic merchant QR is a Phase 3 decision**, gated on volume that justifies an acquirer fee (typically ~0.5%–1%). At 9.73% GP, a 1% acquiring fee would consume ~10% of gross profit.

---

## 4. Risk Matrix

| # | Risk | Why it happens | Structural mitigation | Residual |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Wholesaler shortfall discovered at pickup** | PO submitted Wed 12:30; the Wholesaler only confirms stock on Thursday. Sarpply learns at 13:15 that it has 8 of 10 cartons. | `wholesaler_po_lines` carries `cartons_ordered` **and** `cartons_received`. Stock ledger writes from *received*. Ration by trust tier: `ANCHOR_PRIORITY` → `COD_APPROVED` → `PROVISIONAL`, then by order time (`ADR-0011`). Never silently short-change a Stall. | **High.** The Stall is told at 13:30 that its order is short. There is no earlier warning in the model — ask the Wholesaler for a Wednesday-evening stock confirmation, and if refused, treat it as a known cost. |
| **2** | **Rounding leaves Buffer Stock** | 6 bundles ordered against a 10-bundle carton. | Non-perishable SKUs only; carry forward. Structural leftover ≤ `M_i − 1` bundles per SKU (max 11 for `B1`), tracked in an immutable ledger. | **Low.** But it is cash, and it made the 12-Stall Route cash-negative in Week 1. |
| **3** | **Stall cancels at handover** | Stall closes unexpectedly. | Universal SKUs (`A1`, `B1`, `C1` used by ~90% of Stalls) — offer to a neighbour as a **Spot Sale**, or carry to next week. Zero spoilage. | **Low.** |
| **4** | **Payment friction** | A new platform asking for RM 250 upfront. | **Zero prepayment.** Pay on handover by cash or DuitNow QR. Peer reputation inside one building. | **Low** for cash-at-handover; **real** for the attested-DuitNow gap (§3). |
| **5** | **Vehicle overload** | A 14-Stall Route's heavier Sortie packs to **869 L**; a Myvi holds ~800 L. A 6-Stall Sortie fits at 779 L. | Sortie capacity check (§1.1). A 14-Stall Route needs Avanza-class; a 12-Stall Route fits a Myvi. | **Medium.** This is now a *planned* constraint, not a surprise. |
| **6** | **Margin compression** | Wholesaler raises carton cost 5%. | Gate breaks at **+4.16%**. Price lock at Cutoff; Stage 1/Stage 2 margin guards alert before broadcast and at Cutoff. | **High.** There is no pricing power to absorb it — the Pool Price is anchored to street retail. |
| **7** | **`D1` brand substitution** | The only branded SKU; a drink Stall wants a specific tin. | `D1` basket is otherwise resilient — `D1 = 0` still passes the RM 150 GP gate (RM 209.40). Never promise a specific brand until locked. | **Low.** |
| **8** | **Voice order misheard** | Hokkien ASR at 96.6% CER plus accents. | No ASR output commits an order. Read-back in the Stall's `written_language`; commit only on `OK` / `YA` / `YES` / `1` / `好` / `对`, or Founder verification. Drafts queue in the Admin Console. | **Low**, but ~10–14 clips/week (~90 s) of Founder time is the real cost (`ADR-0014`). |
| **9** | **Wholesaler out of stock (structural)** | Single source in Pending. | Pre-verified quotes from 2 Wholesalers in Pending / Demak Laut. | **Medium.** Switching mid-week breaks the price lock; treat as batch-cancelling, not batch-saving. |
| **10** | **Cash float insufficient** | Worst week needs RM 2,484; Founder holds RM 2,000. | `max_intraday_po_cash_myr = 2600`. Hold RM 2,600 before Week 1. | **High if unplanned**, trivial if planned. |

---

## 5. Coding Agent Reference: Schema Corrections

**The v1.0 schema in this pillar contained defects that would have been built into Phase 2.** They are corrected as follows; the authoritative schema lives in `docs/02_product_eng/09_Backend_Schema.md`.

| v1.0 defect | Correction |
| :--- | :--- |
| `clusters.cutoff_day` / `delivery_day` | Moved to **`routes`**. A Cluster is geography; a Route schedules it (`ADR-0006`). |
| `vendors` table | Renamed **`stalls`**. `pool_batches` → **`route_batches`**. `vendor_orders` → **`stall_orders`**. |
| `skus.current_buffer_bundles` | **Deleted.** Buffer is derived from immutable `stock_movements`, never stored (`ADR-0007`). |
| `stall_orders.payment_status = 'PENDING_COD'` | Replaced by `payment_status ∈ {UNPAID, PAID_CASH, PAID_DUITNOW, VOIDED}` **plus** an orthogonal `fulfilment_status`. Two axes, not one. |
| `pool_batches.logistics_cost DEFAULT 12.00` | `route_batches` carries `sortie_count`; logistics is `sortie_count × runner_rate`, never a constant. |
| `bundles_ordered` only | Needs **`ordered_bundles`** (frozen at Cutoff) *and* **`delivered_bundles`**. GP is computed on the latter (`ADR-0002`, `ADR-0010`). |
| No `physical_boxes_per_carton` | Added. `A1`/`A2` ship as two physical cartons per price unit until the Wholesaler proves otherwise (`ADR-0015`). |
| No sortie capacity data | Added `carton_geometric_liters`, `vehicles.max_cargo_liters`, `clusters.trip_number`. |

### 5.1 Minimum viable schema for the pilot

```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  cutoff_day VARCHAR(15) NOT NULL DEFAULT 'WEDNESDAY',
  cutoff_time TIME NOT NULL DEFAULT '12:00:00',
  delivery_day VARCHAR(15) NOT NULL DEFAULT 'THURSDAY',
  sortie_count INT NOT NULL DEFAULT 2,
  runner_rate_per_sortie NUMERIC(10,2) NOT NULL DEFAULT 42.50
);

CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id),
  name VARCHAR(100) NOT NULL,          -- 'Premier 101', 'Gala City'
  trip_number INT NOT NULL DEFAULT 1,  -- which sortie serves this Cluster
  total_addressable_stalls INT
);

CREATE TABLE stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES clusters(id),
  stall_name VARCHAR(120) NOT NULL,
  stall_number VARCHAR(50),
  whatsapp_phone VARCHAR(30) UNIQUE,
  written_language VARCHAR(10) NOT NULL DEFAULT 'ms-MY',  -- ms-MY | en | zh-CN
  trust_tier VARCHAR(20) NOT NULL DEFAULT 'PROVISIONAL',
  onboarding_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  CHECK (onboarding_status = 'PROVISIONAL_SPOT' OR whatsapp_phone IS NOT NULL)
);

CREATE TABLE skus (
  sku_code VARCHAR(10) PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_bm  VARCHAR(150) NOT NULL,
  name_zh  VARCHAR(150),
  bundles_per_master_carton INT NOT NULL,
  physical_boxes_per_carton INT NOT NULL DEFAULT 1,
  carton_geometric_liters NUMERIC(6,2) NOT NULL
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(60) NOT NULL,
  max_cargo_liters INT NOT NULL
);
```

### 5.2 Payment attestation fields

```sql
ALTER TABLE stall_orders
  ADD COLUMN ordered_bundles   INT NOT NULL CHECK (ordered_bundles > 0),
  ADD COLUMN delivered_bundles INT NOT NULL DEFAULT 0
      CHECK (delivered_bundles >= 0 AND delivered_bundles <= ordered_bundles),
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
      CHECK (payment_status IN ('UNPAID','PAID_CASH','PAID_DUITNOW','VOIDED')),
  ADD COLUMN fulfilment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
      CHECK (fulfilment_status IN ('PENDING','DELIVERED','PARTIAL','UNCOLLECTED')),
  ADD COLUMN payment_reference    VARCHAR(80),
  ADD COLUMN payment_proof_url    TEXT,
  ADD COLUMN payment_attested_at  TIMESTAMPTZ,
  ADD COLUMN attested_by          UUID REFERENCES auth.users(id),
  ADD COLUMN unit_price_locked    NUMERIC(10,2) NOT NULL;
```

**Constraint the app must enforce, not hope for:** `payment_status = 'PAID_DUITNOW'` requires `payment_proof_url IS NOT NULL AND attested_by IS NOT NULL`.

---

## 6. Parser Specification (unchanged in intent, changed in safety)

1. **Regex fast path** for `"A1 x 3, C1 x 2"` / `"a1 3, b1 2"`:
   ```regex
   /\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g
   ```
2. **Synonym pass** against the dictionary in `02_Go_To_Market_Strategy.md` §5 — handles `"bekas kecil 3 bundle"`, `"pakai plastik 9x11 dua"`.
3. **LLM fallback** returning strict JSON: `{"orders":[{"sku_code":"A1","bundles_ordered":3}],"needs_clarification":false}`
4. **Voice path — different rule.** A transcription is never an order. It becomes `UNCONFIRMED_VOICE_DRAFT` and triggers a read-back. Commit requires an affirmative token or Founder review (`ADR-0014`).

> The v1.0 spec sent colloquial text straight to an LLM that returned an order dict. Combined with a 96.6%-CER ASR, that writes wrong quantities into a table that a Wholesaler PO is built from. Step 4 is not optional.
