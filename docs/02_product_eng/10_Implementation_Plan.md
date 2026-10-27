---
project: Sarpply
pillar: 10_Implementation_Plan
version: 1.0-MVP-to-Scale
timeline: 16-Week Phased Execution Roadmap
---

# Sarpply — Pillar 10: Phased Implementation & Rollout Plan

## 1. Execution Roadmap Overview

Sarpply follows a disciplined **Zero-Code Validation First, Automation Second** trajectory. No custom software is deployed during the first 4 weeks until the Premier 101 beachhead unit economics (8 stalls, RM 2,000 GMV, 9.4%–7.75% Net Contribution Margin) are validated on the ground.

| Phase | Timeframe | Operational Focus | Technical Deliverable | Target Economics |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0: Pre-Launch Setup** | Days 1–5 | Lock in Pending Industrial Estate suppliers & onboard first 8 Premier 101 stalls during 2:15 PM–4:00 PM breaks. | WhatsApp Business Catalog + Laminated Bilingual Pool Price Card + Master Google Sheet. | RM 0 fixed burn. |
| **Phase 1A: Founder-Driven Pilot** | Weeks 1–2 | Execute first 2 Tuesday-to-Thursday batch loops with founder driving cross-dock delivery. | Validate Google Sheets `Wholesaler_Aggregator` formulas and DuitNow QR stall collection. | 1 Cluster • RM 2,000/wk GMV • RM 188/batch NCM (9.4%). |
| **Phase 1B: MPV Runner Handover** | Weeks 3–4 | Transition Thursday 1:30 PM–3:30 PM shift to part-time MPV runner at flat RM 45 payout. | Laminated Corporate DuitNow QR Card + Zero-Leakage Runner SOP. | 1 Cluster • RM 2,000/wk GMV • RM 155/batch NCM (7.75%). |
| **Phase 2: Automated Platform Build** | Weeks 5–8 | Replace manual WhatsApp entry & Google Sheets with automated webhook + Supabase DB. | Deploy PostgreSQL schema, Regex + Trilingual LLM Parser, Admin Console, and Runner Web App. | 3 Clusters (Premier 101, Tabuan Jaya, Stutong). |
| **Phase 3: Kuching 10-Cluster Scale** | Weeks 9–16 | Replicate across 10 high-density Kuching commercial zones (40 batches/month). | Multi-cluster runner dispatch routing, automated restock predictions, and verified stall credit tiers. | 10 Clusters • RM 80,000/mo GMV • RM 6,200/mo Net Profit. |

---

## 2. Step-by-Step Phase Breakdown

### Phase 0: Pre-Launch Setup & Field Onboarding (Days 1–5)

1. **Days 1–2 (Pending Wholesaler Lock-In):**
   * Send `Script A` via WhatsApp to 3 packaging and commercial consumable wholesalers in **Pending Industrial Estate** and **Demak Laut**.
   * Lock in Master Carton self-pickup pricing for the **Golden 6 SKUs** (`A1` RM 135, `A2` RM 148, `B1` RM 102, `C1` RM 110, `D1` RM 128, `E1` RM 46) and establish dual-supplier redundancy.
2. **Day 2 (Zero-Code Tooling Setup):**
   * Configure WhatsApp Business Profile (`Sarpply Kuching`), create the `Premier 101 Pool` Broadcast List, and print 20 laminated A5 **1-Page Bilingual Pool Price Cards** and 2 **Corporate DuitNow QR Cards**.
   * Build the Google Sheets Master Workbook with `SKU_Master`, `Vendor_Orders`, and `Wholesaler_Aggregator` tabs using the `SUMIF`, `CEILING`, and `VLOOKUP` formulas.
3. **Days 3–5 (Off-Peak Walk-In Onboarding at Premier 101):**
   * Visit **Premier 101 / Jalan Tun Jugah** strictly between **14:15 and 16:00 MYT** carrying a physical sample of SKU `A1` (650ml PP box).
   * Secure the anchor stall (`Stall #3` or the kopitiam drink stall for `D1`), then onboard 7 neighboring stalls into the WhatsApp Broadcast List.

---

### Phase 1: Zero-Code WhatsApp + Google Sheets Pilot (Weeks 1–4)

1. **Weeks 1–2 (Founder-Driven Validation Batches #1 & #2):**
   * **Tuesday 14:00:** Send `Script B` ("Pool Open") broadcast to Premier 101 hawkers.
   * **Tue 14:00 – Wed 12:00:** Log incoming replies into the `Vendor_Orders` sheet tab.
   * **Wednesday 12:00 – 12:30:** Lock pool, run `Wholesaler_Aggregator` to calculate Master Cartons ($C_{b,i}$), send `Script C` confirmation receipts to stalls, and submit the consolidated PO to the Pending wholesaler.
   * **Thursday 13:30 – 15:30:** Founder drives to Pending Industrial Estate (~15 km round-trip, RM 12 petrol cost), picks up Master Cartons, parks at Premier 101 loading zone at 14:15 to break cartons and mark stall numbers on bundles with a black marker, delivers via trolley at 14:30, collects DuitNow QR/Cash, and sells or logs any leftover buffer bundles at 15:30.
2. **Weeks 3–4 (Part-Time MPV Runner Transition Batches #3 & #4):**
   * Recruit 1 part-time student/gig driver (UNIMAS/Swinburne/Politeknik) with a Perodua Alza, Proton Exora, Avanza, or fold-flat Myvi for a fixed 2-hour Thursday shift (13:30–15:30 MYT) at a flat **RM 45.00** payout.
   * Enforce Zero-Leakage Financial Control: Founder transfers wholesale payment via DuitNow once the runner confirms carton counts at Pending; runner collects vendor payments at Premier 101 using the laminated Corporate DuitNow QR Card.

---

### Phase 2: Automated Agent & Web Platform Engineering (Weeks 5–8)

* **Week 5 (Database & Core API):**
  * Provision Supabase project and run the DDL and seed scripts from `09_Backend_Schema.md` (`clusters`, `vendors`, `skus`, `pool_batches`, `vendor_orders`, `v_wholesaler_aggregator`, `fn_reconcile_batch`).
* **Week 6 (WhatsApp Cloud API & Hybrid Order Parser):**
  * Connect Meta WhatsApp Cloud API webhook to Supabase Edge Functions.
  * Implement the Tier 1 Regex Parser (`/\b([A-Ea-e][1-9])\s*(?:x|X|\*|-|:)?\s*(\d+)\b/g`) and Tier 2 LLM Fallback Parser with the Trilingual Synonym Dictionary (English, BM/Sarawak Malay, Mandarin/Kuching Hokkien).
* **Week 7 (Admin Console & Mobile Runner Web App):**
  * Build the Founder Admin Console (automated Tuesday/Wednesday broadcast cron triggers, Master Carton PO generator, and P&L tracker) and the Mobile Runner Checklist App (Pending pickup count verification, car-boot sorting guide, and stall payment status toggles).
* **Week 8 (Parallel Shadow Testing & Cutover):**
  * Run Batch #8 in Premier 101 with the automated webhook and Supabase database running in parallel with the Google Sheet, then retire manual sheet entry and launch Cluster #2 (**Tabuan Jaya**) and Cluster #3 (**Stutong**).

---

### Phase 3: Kuching 10-Cluster Expansion (Weeks 9–16)

* Roll out the standardized off-peak onboarding and weekly Thursday delivery cadence across all 10 target Kuching commercial clusters:
  1. **Premier 101 / Jalan Tun Jugah** (Beachhead)
  2. **Tabuan Jaya**
  3. **Stutong**
  4. **Gala City**
  5. **MetroCity Matang**
  6. **Satok**
  7. **Batu Kawa**
  8. **3rd Mile**
  9. **7th Mile**
  10. **BDC**
* Layer in Phase 2+ monetization and retention features: automated weekly restock predictions based on historical stall consumption, loyalty tier discounts for consecutive weekly pool participation, tiered supplier rebates, and instant digital credit terms for verified stalls.
