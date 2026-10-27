---
project: Sarpply
pillar: 10_Implementation_Plan
version: 1.1-MVP-to-Phase2
timeline: Gate-driven, not calendar-driven
gate: >= RM 1,500 GMV and >= RM 150 Realized GP per Route shift, 2 consecutive weeks
supersedes: v1.0 (16-week calendar, 8-stall cluster, RM 2,000/wk, RM 45/trip, RM 6,200/mo)
---

# Sarpply — Pillar 10: Implementation & Rollout

> Terminology per `GLOSSARY.md`. Times are MYT.

## 1. The plan is gated, not dated

v1.0 was a 16-week calendar: build the platform in Week 5 regardless of whether the business worked. That is the single most expensive mistake available here, because Phase 2 is built to operate a model whose inputs — basket size, drink-anchor volume, Cluster conversion — were invented.

**Phase 2 starts only when a Route has cleared the gate for two consecutive weeks** (`ADR-0009`):

> **≥ RM 1,500 GMV and ≥ RM 150 Realized GP per Route shift, two weeks running.**

Realized GP, not forecast. Measured on **Delivered Bundles**, so a shortfall cannot hide (`ADR-0010`).

| Phase | Entry condition | Duration | Economics target |
| :--- | :--- | :--- | :--- |
| **0 — Setup** | None | 5 days | RM 0 fixed burn |
| **1A — Founder pilot** | Supplier prices locked | ≥ 2 weeks | 12–14 Stalls, RM 2,123.80–2,603.60 GMV |
| **1B — Runner pilot** | 1A complete; gate visible | ≥ 2 weeks | RM 125.70–168.40 net |
| **★ GATE** | **2 consecutive weeks ≥ gate** | — | Decision point |
| **2 — Platform build** | Gate cleared | 4 weeks | Make the manual work disappear |
| **3 — Scale** | Phase 2 stable for 4 weeks | ongoing | 5 Routes ≈ RM 3,648/mo |

If the gate never clears, **Phase 2 never starts** and the Founder has lost nothing but time. That is the correct outcome of a failed experiment.

---

## 2. Phase 0 — Setup (Days 1–5)

### Days 1–2: Wholesaler lock-in

Send **Script A** to three Wholesalers in Pending Industrial Estate and Demak Laut. Ask all six price questions **and Question 1**:

> *"500 sets tu datang dalam SATU karton, atau DUA karton berasingan (satu tapak, satu penutup)?"*

**This is the load-bearing unknown in the whole model.** It decides whether a Route is 22 or 32 physical boxes, and therefore whether a Myvi can serve it at all (`ADR-0015`). One phone call. Do it before buying anything.

Record `carton_cost`, carton dimensions, and `bundles_per_master_carton` per SKU. Dimensions for `B1`, `C1`, `D1` are currently **estimates** (`carton-payload-estimates.md`); get real ones.

### Day 2: Tooling

* WhatsApp Business profile, broadcast list per Cluster.
* Google Sheets workbook with four tabs: `SKU_Master`, `Stall_Orders`, `Wholesaler_Aggregator`, `Buffer_Ledger`.
* Print 20 Pool Price Cards (Script/§2.1 of Pillar 7) and 2 payment cards.
* **`Stall_Orders` must have `delivered` and `payment_method` columns from Batch #1.** A sheet that records only orders cannot compute Realized GP, and the gate becomes unmeasurable.

### Days 3–5: Onboarding

Visit strictly **14:15–16:00**. Anchor the drink Stall first. **Do not open Cluster B until Cluster A holds 6 committed Stalls** — a half-empty Cluster still costs a full Sortie.

Target for Phase 1A: **6 Stalls in Premier 101 + 6–7 in Gala City**.

---

## 3. Phase 1A — Founder pilot (Weeks 1–2)

The Founder drives, and must personally experience the two things that will decide whether this business works:

1. **The negative cash weeks.** Week 1 at 12 Stalls: cash out RM 2,182 against RM 2,123.80 GMV — a **negative RM 58.20** spread, and −RM 143.20 after the Runner. That money is in the boot, not lost, but it leaves the bank account. Hold **RM 2,600** of float.

2. **The read-back loop.** Log every voice order, send the read-back, and record whether the Stall confirmed. If Stalls ignore read-backs, the voice channel is dead and `ADR-0014` needs revisiting before code, not after.

Weekly rhythm per Pillar 4 §1. Record in the sheet: `ordered`, `delivered`, `payment_method`, `payment_reference`, and Buffer Stock at cost.

---

## 4. Phase 1B — Runner pilot (Weeks 3–4)

Recruit one Runner with an **Avanza-class vehicle** (a Myvi works only for a 12-Stall Route with 6-Stall Clusters). Pay **RM 42.50 per Sortie, RM 85 per shift**, and **state explicitly whether petrol is included** — at ~30 km this is RM 8–10 and the difference between a viable gig and a bad one.

Train on three rules only:

1. Count cartons at pickup before the Founder pays. If short, say so immediately.
2. Never change a quantity or a price. Record what happened.
3. Every handover ends with a receipt echo. `PAID_DUITNOW` needs a proof photo.

Run the real Sortie times: 13:15 pickup → 13:30–14:25 Sortie 1 → 14:40 reload → 14:55–15:50 Sortie 2 → 16:00 reconcile.

---

## 5. ★ The Gate Decision

At the end of Week 4, read the sheet:

| Result | Action |
| :--- | :--- |
| **Both weeks ≥ RM 1,500 GMV and ≥ RM 150 Realized GP** | Proceed to Phase 2. |
| GMV clears but GP does not | **Margin problem.** Re-negotiate carton costs or drop the thinnest SKUs. Do not build software. |
| GP clears but GMV does not | Volume problem. Recruit more Stalls before automating. |
| Neither | The model does not work as designed. Revisit the Route size or the beachhead. Building Phase 2 here would automate a loss. |

Record the decision and its evidence in an ADR. Do not proceed on optimism.

---

## 6. Phase 2 — Platform (4 weeks, after the gate)

Full specification in `06_TRD.md` and `09_Backend_Schema.md`; the schema is verified executable against PostgreSQL 16.

| Week | Deliverable |
| :--- | :--- |
| **1** | Supabase project; run the DDL, views, functions, RLS and seed from Pillar 9 **verbatim** — it is tested. |
| **2** | WhatsApp Cloud API webhook; text pipeline (regex → synonyms → LLM). Voice pipeline **behind the read-back gate** with the Founder audio queue. |
| **3** | Founder Console (aggregation, sortie load guard, margin guard, voice queue) and Runner app (sortie selector, pickup count, manifest, handover, receipt echo). |
| **4** | Parallel run: one Route on paper and software simultaneously. Compare Realized GP both ways. Cut over only when they agree to the cent. |

**Build order is non-negotiable:** ledger and aggregation first, messaging second, UI third. The messaging layer is the most visible and the least dangerous; the ledger is invisible and decides whether the P&L is true.

---

## 7. Phase 3 — Scale

5 Routes × 4.333 weeks = **21.67 shifts/month**:

| | GMV/mo | GP/mo | Logistics | **Net/mo** |
| :--- | ---: | ---: | ---: | ---: |
| 5 × 14-Stall Routes | RM 56,407 | RM 5,490 | RM 1,842 | **RM 3,648** |

The old "RM 6,200/month" needs **~37 shifts ≈ 8.5 Routes** — roughly every food court in Kuching. That is a Phase 3 target, not a Phase 2 claim.

Scale rule: **do not add a Route until the existing ones have cleared the gate for four consecutive weeks.** Each Route carries its own working-capital float; four failing Routes is a cash problem before it is a growth problem.

---

## 8. What must be true before writing any Phase 2 code

| # | Unknown | Why it blocks |
| :--- | :--- | :--- |
| 1 | `A1`/`A2` nested or separate cartons | Changes vehicle class and payload model |
| 2 | Real carton dimensions for `B1`, `C1`, `D1` | Sortie capacity check is only as good as `carton_geometric_liters` |
| 3 | Petrol inside RM 42.50 | Determines real net margin |
| 4 | ~~Voice-note retention policy~~ | **Resolved** — deleted 7 days after reconciliation, disclosed weekly (`ADR-0017`) |
| 5 | Gate cleared twice | `ADR-0009` |
| 6 | Prepayment flow | Not needed — none exists. Do not build one. |

Items 1–3 are phone calls — someone else's knowledge, not a design decision. Item 5 is two weeks of real trading. Item 6 is a decision already made (don't). That leaves **three calls and two weeks** between these documents and a defensible build.
