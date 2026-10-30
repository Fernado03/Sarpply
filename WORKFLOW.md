# Sarpply — Skills Workflow Tracker

Human-facing checklist for the Matt Pocock skill flow. The issue tracker owns the work; this file owns **which step we are on**.

Last updated: 2026-10-30

Legend: `✅` done · `👉` current · `⬜` not started · `⏭` not applicable

---

## Current position

```text
✅ setup → ✅ grill-with-docs → ✅ to-spec → ✅ to-tickets → 👉 implement (#3 ✅, #4 ✅, #5 ✅, #6 ✅, #7 ✅; next #8) → ⬜ code-review → ⬜ pr → ⬜ retro
```

- **Done:** setup, grilling, spec ([#2](https://github.com/Fernado03/Sarpply/issues/2)), tickets ([#3](https://github.com/Fernado03/Sarpply/issues/3)–[#17](https://github.com/Fernado03/Sarpply/issues/17)), ticket review and remediation (§3a, §3b), ticket #3 walking skeleton (§4a), ticket #4 text intake (§4b), ticket #5 Cutoff (§4c), ticket #6 WhatsApp transport (§4d), ticket #7 purchase and receipt (§4e).
- **Now:** `/implement #8` (Delivery) or `/implement #12` (gate warning before Cutoff) — both are unblocked. #9 needs #8; #10 needs #7 and #8; #11 needs #7, #8 and #9.
- **After that:** the rest of the graph; `/pr`, `/retro` at the end.

---

## ✅ 0. Setup — `/setup-matt-pocock-skills`

- Ran once, 2026-10-27.
- Evidence: `AGENTS.md` has the `## Agent skills` block; `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md` exist; GitHub labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` exist.
- Do not re-run unless switching issue tracker, labels, or doc layout.

## ✅ 1. Grill — `/grill-with-docs`

- 2026-10-27, two sessions: `01a17bd3` (start) and `01a17bd5` (main, 29 rounds of decisions).
- What it produced:
  - `GLOSSARY.md` — domain vocabulary (`Route`, `Stall`, `Runner`, `Bundle`, `Buffer Stock`, `Trust Tier`, …).
  - `docs/adr/0001`–`0017` — hard-to-reverse decisions.
  - Ten pillar docs rewritten against measured Phase 1 data (commits `1c4fb38`, `ecd18a5`, `c49b357`, `312b30c`).
- Gate it passed: shared understanding confirmed; no open frontier before the spec.
- Do not re-run for new implementation questions. Sharpen terms through `/domain-modeling`; the grill is for the idea.

## ✅ 2. Spec — `/to-spec`

- Artifacts:
  - `docs/02_product_eng/11_Phase_2_Spec.md` — commit `08691b1` ("Add Phase 2 spec built on measured Phase 1 economics").
  - Issue **#2** "Phase 2: Sarpply Operations Ledger", label `ready-for-agent`, created 2026-10-28 11:31Z.
- Seams agreed in the spec's **Testing Decisions**: the PostgreSQL interface is the one test seam; a second narrow seam exists for text-order parsing only.
- **Invocation note (resolves the doubt):** `to-spec` is user-invoked (`disable-model-invocation: true`), so an agent **cannot** fire it automatically. The timeline is:
  - 11:20Z — you instructed: *"build the Phase 2 spec using these measured numbers"* in plain language.
  - 11:30Z — the agent committed the spec.
  - 11:31Z — the agent published issue #2.
  - 11:35Z — you typed `/skill:to-spec`; the agent answered that the spec was already finished and published, so it did not re-run.

  Outcome is valid: the artifact has the template, the `ready-for-agent` label, and agreed seams. The label on the invocation differs; the phase is complete.
- **Rule:** `/to-spec` runs **once per idea**. Re-running it forks the source of truth. To make the skill own the artifact next time, type `/to-spec` *before* asking for a spec.

---

## ✅ 3. Tickets — `/to-tickets 2`

- **Approved:** 2026-10-29, after the breakdown quiz. The 15-ticket breakdown, blocking edges and combined prefactor/skeleton ticket 01 were confirmed.
- **Published:** 15 sub-issues of [#2](https://github.com/Fernado03/Sarpply/issues/2), each labelled `ready-for-agent`, with **native GitHub blocking edges**.
- **Parent:** #2 stays open and unmodified.

| # | Ticket | Blocked by |
|---|---|---|
| [#3](https://github.com/Fernado03/Sarpply/issues/3) | Walking skeleton: PostgreSQL ledger, console shell, real-database tests | None |
| [#4](https://github.com/Fernado03/Sarpply/issues/4) | Text order intake: parse, review, commit Preorders | #3 |
| [#5](https://github.com/Fernado03/Sarpply/issues/5) | Cutoff: freeze the Route Batch and lock prices automatically | #3 |
| [#6](https://github.com/Fernado03/Sarpply/issues/6) | WhatsApp transport: inbound webhook, outbound messages, Tuesday broadcast | #3 |
| [#7](https://github.com/Fernado03/Sarpply/issues/7) | Purchase: Wholesaler PO, received cartons, Buffer Stock, capacity, cash | #4, #5 |
| [#8](https://github.com/Fernado03/Sarpply/issues/8) | Delivery: record Delivered Bundles, attest payment, echo a receipt | #4, #6, #7 |
| [#9](https://github.com/Fernado03/Sarpply/issues/9) | Spot Sales and Provisional Stalls | #8 |
| [#10](https://github.com/Fernado03/Sarpply/issues/10) | Shortfall rationing by Trust Tier | #7, #8 |
| [#11](https://github.com/Fernado03/Sarpply/issues/11) | Reconcile: three margin figures, identity, gate verdict | #7, #8, #9 |
| [#12](https://github.com/Fernado03/Sarpply/issues/12) | Gate warning before Cutoff | #5, #6 |
| [#13](https://github.com/Fernado03/Sarpply/issues/13) | Runner least privilege: shift-scoped access | #8 |
| [#14](https://github.com/Fernado03/Sarpply/issues/14) | Audited corrections before reconciliation | #8, #11 |
| [#15](https://github.com/Fernado03/Sarpply/issues/15) | Voice orders: draft, read-back, explicit confirmation | #4, #5, #6 |
| [#16](https://github.com/Fernado03/Sarpply/issues/16) | Voice note retention: delete seven days after reconciliation | #11, #15 |
| [#17](https://github.com/Fernado03/Sarpply/issues/17) | Founder console: one screen, per-Stall GMV, phone-first | #8, #11 |

**Frontier:** #3 is the only unblocked ticket. After #3, #4, #5 and #6 are available in parallel. The core economic path is #3 → #4 → #5 → #7 → #8 → #9 → #11; the voice branch is #15 → #16.

**Breakdown check (confirmed at approval):**

- Each ticket is a **vertical slice** through database, console and test, not a layer.
- Each ticket fits **one fresh context window**.
- Blocking edges are real: a ticket depends only on tickets that genuinely gate it.
- Prefactoring comes first: #3 lands the verified schema, seed and real-database harness.
- All 46 user stories are mapped; the seven required tests land at the agreed seams.
- No ticket invents scope: Stall app, speech recognition, DuitNow reconciliation, multi-Route scheduling, perishables, warehouse, credit, payroll and website remain out.

**Do not triage** these tickets. `/triage` is only for issues you did not create.

### ✅ 3a. Review — independent ticket review, 2026-10-29

A read-only review agent audited #3–#17 against the spec, Pillar 9, the ADRs and the agreed seams. Verdict: **NEEDS CHANGES** — the graph was right, the ticket contracts were not. **All findings have since been applied to the ticket bodies** (see §3b).

**Passed:** parent #2 unmodified (same body, labels, timestamps); 15 genuine sub-issues; `ready-for-agent` on all; no cycles; #3 the only frontier ticket; #4/#5/#6 open after it. Domain checks pass: 0.92 / 980 L / 979.9 L fit, one Sortie at nine Stalls, `PROVISIONAL_SPOT`, payment and fulfilment orthogonal, no ASR, no DuitNow callbacks, seven-day retention, no `PREPAY_REQUIRED` / `basket_tier`, no out-of-scope build.

**Blocking — the five that gate implementation:**

1. **Buffer Stock has no cost basis, and reconciliation cannot fail closed** (#3, #7, #11, #14). `stock_movements` stores quantity, not cost, so "closing Buffer at cost", the identity residual, headroom and the verdict are uncomputable; `fn_reconcile_batch` only flips a status. **Fix direction:** an explicit valuation rule with cost stored on receipt and compensating movements; views/functions for opening and closing Buffer at cost, cash, residual, headroom and verdict; reconciliation refuses a non-zero residual; stock and frozen prices reject UPDATE/DELETE.
2. **Four schema families the tickets assume but Pillar 9 lacks** (#3, #4, #5, #6, #8, #14, #15, #16). No source-channel column, no voice draft/transcript/audio/read-back model, no inbound/outbound message tables with provider-message uniqueness, no cutoff transition log, no audit log, no retention-deletion log. **Fix direction:** #3 owns the complete lifecycle schema, not just the source channel; #6 and #15 fixtures are explicit injected data with no ASR.
3. **Cutoff semantics are underspecified and two tickets contradict each other** (#5, #14). `fn_freeze_prices` never checks the batch is due, never selects the price valid at the cutoff instant, never sets `unit_price_locked`, and nothing forbids editing the snapshot. #5 forbids post-cutoff order changes; #14 permits them. **Fix direction:** define the price source and cutoff timing, add the transition log and a freeze rule with negative tests; adopt the ADR-consistent choice that #14 corrects received, delivered and attestation only — never an ordered quantity.
4. **Runner security has no session model** (#3, #8, #9, #13). No runner or shift-session table, no batch-scoped read policy, no column grants, no test path for `auth.jwt()`. **Fix direction:** add the runner/session model and a Supabase-specific migration using column grants plus security-definer operations; keep plain PostgreSQL for domain tests and add a separate Supabase RLS test.
5. **Payment and cash semantics are wrong in the published views** (#8, #11). `collected_myr` counts a delivered `UNPAID` order as cash; `PAID_DUITNOW` requires a proof URL but not the required reference; no atomic handover operation exists, so retry-safe receipts are unimplementable. **Fix direction:** require both reference and proof, count only `PAID_CASH`/`PAID_DUITNOW` as collected, expose one atomic handover operation that writes delivery, payment, stock and one receipt event, and store an internal audit result for phone-less Provisional Stalls instead of demanding a WhatsApp echo that ADR-0012 already accepts cannot be sent.

**Major — fix before the owning ticket is claimed:**

- **#3, #7:** the Pillar 9 seed inserts no `route_batch`, and `route_batches` has no vehicle column. "#3 loads the seeded Route Batch" cannot pass, and the chosen Vehicle is not a per-batch fact. Seed a B01-style batch (one Sortie, RM 42.50, cutoff, vehicle), add the per-batch vehicle fact, derive the Sortie count from the capacity plan, and persist a deterministic whole-carton allocation across Sorties.
- **#8, #10, #13:** `fn_record_delivery` never checks available stock, so a direct call bypasses Trust-Tier allocation and can overdraw; its `DEL:<order>` key also leaves a stale movement when a delivered count changes. Route every delivery through one stock-aware allocating operation that rejects overdraw.
- **#12:** Stage 1 must warn before the Tuesday broadcast, but it is blocked by #11 (post-delivery reconciliation) and claims to use "frozen costs" that do not exist until Cutoff. Remove #11 as a blocker; add #6 or fold Stage 1 into it. Stage 1 projects from the price in force; Stage 2 uses the cutoff snapshot.
- **#3, #11:** no ticket owns importing the B01/B02 workbook fixtures, and no ticket owns the six-case rejection matrix as a database test. Give fixture loading to #3 and golden replays plus multi-batch identity to #11; add one database rejection matrix.
- **#9:** Spot Sale creation has no retry-safe event key and writes a `DELIVERY` movement instead of `SPOT_SALE`.

**Minor — correct before agents follow the graph:**

- #3 says the parser seam "arrives in ticket 02" — it is **#4**. #5 says corrections "arrive in ticket 12" — it is **#14**.
- #3 and #17 both claim the phone Founder console; #17 alone should own the metrics, per-Stall GMV and 56 px checks.
- #6's in-memory WhatsApp fake is an adapter contract test, not a new business-logic seam.
- #15 should state exact-token matching and name `"ok kot"` as non-committing.

**Top three changes before implementation:** repair the database foundation (#3/#7/#11); write the lifecycle rules as database contracts (#4/#5/#8/#10/#14/#15); finish the integration and security edges (#6/#12/#13/#16/#17).

Full report: `history://TicketReview`. The review was read-only; no ticket was touched during it.

### ✅ 3b. Findings applied — 2026-10-29

Every finding above was applied to the ticket bodies in place. Issue numbers, titles, labels and parent links are unchanged, so the graph is stable. One edge was re-pointed.

| Finding | Applied to | What changed |
|---|---|---|
| 1. Buffer cost basis; reconcile must fail closed | #3, #7, #11, #14 | `stock_movements` carries unit cost and one documented valuation rule; receipt and compensating movements write it; opening/closing Buffer at cost, cash, residual, headroom and verdict come from database objects; reconciliation refuses a non-zero residual and cannot reach `RECONCILED`; stock ledger and price snapshot reject UPDATE/DELETE. |
| 2. Missing schema families | #3 | #3 now owns the full lifecycle schema: cost on the ledger, order source channel (`TEXT`/`VOICE`/`STALL`), voice draft with transcript/audio/read-back/confirmation events, provider-keyed inbound and outbound messages, transition log with unique key, correction audit, retention log, runner session. |
| 3. Cutoff semantics; correction contradiction | #5, #14 | Cutoff refuses a batch that is not due or not open, selects the price whose validity window contains the cutoff instant, writes the snapshot and the locked unit price, and freezes Ordered Bundles. #14 now states that an Ordered Bundle is never correctable after Cutoff — corrections cover received, delivered, attestation and PO lines only. |
| 4. Runner security model | #13 | Runner session carries batch, shift window and expiry; column grants and batch-scoped policies; no write to Ordered Bundles, price, snapshot or stock; void and re-attest refused; Spot Sale and Provisional Stall creation allowed; domain tests against plain PostgreSQL, Supabase JWT tested separately. |
| 5. Payment and cash semantics | #8, #11 | `PAID_DUITNOW` requires both reference and proof; collected cash counts only `PAID_CASH` and `PAID_DUITNOW`; handover is one atomic operation writing delivery, payment, stock and exactly one queued receipt; phone-less Provisional Stalls record an internal audit result instead of an impossible echo. |
| 6. Seed batch, per-batch Vehicle, carton allocation | #3, #7 | #3 seeds one open B01-style batch with cutoff, one Sortie, RM 42.50 and a Vehicle, and loads the Phase 1 fixtures. #7 confirms the batch Vehicle and routes received time; cartons round once at Route level then allocate as whole cartons by one documented rule. |
| 7. Stock overdraw and bypass | #8, #10 | Handover and allocation go through one stock-aware operation that locks balances and refuses overdraw; allocation is the only path to a short delivery; direct calls cannot skip the tier order. |
| 8. Gate warning timing and edge | #12 + edge | Stage 1 projects from the price in force before the Tuesday broadcast; Stage 2 uses the frozen snapshot at Cutoff. **Edge changed:** #12's blocker #11 removed, #6 added. |
| 9. Fixtures and rejection matrix ownership | #3, #11 | #3 loads the checked-in B01/B02 workbook fixtures; #11 owns the golden replays, the three-batch sell-down with a price change, and the six-case negative SQL matrix. |
| 10. Spot Sale idempotency | #9 | Caller-supplied event key makes creation retry-safe; the movement is `SPOT_SALE`, not `DELIVERY`; one Stall, one order, one movement per key. |
| Minor: stale references | #3, #4, #5 | Numeric ticket references removed from the bodies; #3 names **#4** for the parser seam and #5 names the audited corrections ticket by name. |
| Minor: console ownership | #3, #17 | #3 is the shell and renderer only; #17 owns the metric set, the per-Stall GMV view and the 56 px / text-plus-colour checks. |
| Minor: WhatsApp fake seam | #6 | The fake is stated as an adapter contract test only — signature, idempotency, send failure, retry — never a seam for business logic. |
| Minor: confirmation tokens | #15 | Exact-token matching after trim and case-fold; `"ok kot"`, `"ya ya"` with more text, and an affirmative inside a longer sentence all route to the Founder queue instead of committing. |

**Edge audit after fixes:** unchanged except #12, now blocked by #5 and #6. No cycles. #3 remains the only frontier ticket; #4/#5/#6 open after it.

**Verification:** 15 sub-issues of #2; every blocker set matches the intended graph; all 15 carry exactly `ready-for-agent`; parent #2 body, labels and `updated_at` untouched.

## 👉 4. Implement — `/implement` or `/implement-spec`

| Mode | Command | How it runs | Use when |
|---|---|---|---|
| Per ticket | `/implement #<n>` | One ticket, `/clear` between tickets, blockers first | You want control; one context per ticket |
| Whole spec | `/implement-spec 2` | Task graph → background implementer subagents on the frontier → integration branch → one review | You want the build orchestrated |

Both drive `/tdd` (red → green, one vertical slice at a time) and finish with `/code-review`.

Per-ticket loop:

- [ ] Pick the first frontier ticket (all blockers closed).
- [ ] `/clear` — the previous ticket's context is disposable.
- [ ] `/implement #<n>`.
- [ ] Tests written at the pre-agreed seams only; red before green.
- [ ] `/code-review` against a fixed point (the ticketing commit or `main`).
- [ ] Commit; close the ticket the way the tracker closes work.
- [ ] Update this file's arrow.

### ✅ 4a. Ticket #3 — walking skeleton, 2026-10-30

- **Closed:** [#3](https://github.com/Fernado03/Sarpply/issues/3) on 2026-10-30 with the evidence comment.
- **Commits:** `95fe0e8` (implementation), `775b016` (review fixes). Branch `main`.
- **Stack chosen in this ticket:** Next.js 16 + TypeScript console, plain SQL migrations, `pg`, Vitest, embedded PostgreSQL 16 by default; `DATABASE_URL` / `TEST_DATABASE_URL` override for an existing server (required on an elevated Windows shell, where PostgreSQL refuses to start).
- **Schema:** Pillar 9 tables plus `stock_movements.unit_cost_myr`, order source channel, voice draft/lines/events, provider-keyed inbound/outbound messages, batch transition log, correction audit, retention log, runner sessions, per-batch Vehicle and `stalls.stall_code`. RLS stays deferred to #13.
- **Valuation:** moving weighted-average cost, recorded on every movement by `fn_post_stock_movement` under a row lock; documented as `docs/adr/0018-buffer-stock-valued-at-weighted-average-cost.md`.
- **Seed and fixtures:** Route, nine Stalls, Golden 6, Myvi, one open B01-style batch (cutoff 2026-11-04 12:00 MYT, one Sortie, RM 42.50, Vehicle), plus B01/B02 orders, POs, deliveries and price snapshots read from `Sarpply_Phase_1_Tracking_Sheet_Master.xlsx`.
- **Evidence:** `npm run db:reset` → 3 Route Batches, 10 Stalls, 6 SKUs, 31 Stall Orders; `npm test` → 14 passed against real PostgreSQL 16; `npm run typecheck` clean; `npm run build` clean; console checked in Chromium at 360 px (scrollWidth 360) showing `OPEN FOR ORDERS` and `Collect Preorders until Cutoff`.
- **Numbers:** B01 13 cartons / 18 boxes / 901.5 L / Forecast GP 173.00 / Realized GP 167.00 / buffer 183.00; B02 Realized GP 187.50 / buffer 37.50; identity residual 0.00 on both; Net Cash −58.50 and +290.50.
- **Review:** Standards — 2 judgement calls (duplicated `CEIL` expression fixed in `0006_aggregation_cleanup.sql`; primitive cost value left). Spec — 2 findings (identity/Net Cash not published; valuation in application code), both fixed in `775b016`.
- **Next:** `/clear`, then `/implement #4` (text intake), or #5/#6 — all now unblocked.

### ✅ 4b. Ticket #4 — text order intake, 2026-10-30

- **Closed:** [#4](https://github.com/Fernado03/Sarpply/issues/4) on 2026-10-30 with the evidence comment.
- **Commits:** `41ccad7` (implementation).
- **Parser seam:** `src/lib/order-text.ts` is pure — no database, no network. It accepts exactly the Golden 6 (`GOLDEN_SIX_SKU_CODES`) and quantities of at least one; Malay, English and Chinese numerals, `x` and unit markers, mixed prose and multi-SKU segments (`A1 x 3 C1 2`) parse; a segment with no SKU or a conflicting quantity stays blank.
- **Database:** `0007_text_order_intake.sql` adds `text_order_drafts`, `text_order_draft_lines`, `fn_create_text_draft`, `fn_update_text_draft_lines` and `fn_commit_text_draft`. Intake and commit refuse a closed batch or a passed Cutoff; commit writes `PREORDER` rows with source `TEXT` and the Pool Price in force at commit time, sums duplicate SKUs, and updates the Stall's Preorder while the batch is open.
- **Console:** paste-and-parse form, persisted unconfirmed drafts with per-line SKU/quantity editing, and commit; `src/app/actions.ts`, `src/lib/intake.ts`, `src/app/page.tsx`, styles.
- **Evidence:** `npm test` 33 passed (15 parser, 4 intake, 14 existing); `npm run typecheck` clean; `npm run build` clean. Browser smoke at 390 px and 360 px (scrollWidth 360 = clientWidth 360): `A1 x 3, 2 kotak C1, 五箱 D1` → A1 3, C1 2, D1 5; C1 edited to 4 before commit; S01 rows stored source `TEXT` at 15.00 / 13.50 / 21.00. An unresolved `the usual 2` line was refused with "every draft line needs an active SKU and a quantity before commit", then corrected and committed. `A1 x 3 C1 2` parsed to 3 and 2 without commas.
- **Review:** Standards — 0 hard violations; 2 judgement calls (draft line shape deduplicated with `Pick`, vertical-slice file spread accepted). Spec — 3 findings: the Golden 6 set pinned and multi-SKU quantities paired, both fixed in `41ccad7`; the residual-word blank line was not actioned because a segment with a recognised SKU is not a parse gap, `rawText` retains the full segment, and an over-eager blank would block commit with no dismiss affordance.
- **Next:** `/implement #5` (Cutoff) or #6 (WhatsApp); #7 needs #5.

### ✅ 4c. Ticket #5 — Cutoff, 2026-10-30

- **Closed:** [#5](https://github.com/Fernado03/Sarpply/issues/5) on 2026-10-30 with the evidence comment.
- **Commits:** `5d4fe41` (implementation), `ff8ff1f` (review fixes). Branch `main`.
- **Database:** `db/migrations/0008_cutoff.sql` adds `fn_freeze_prices`, `fn_fire_due_cutoffs`, `dispatch_policy`, `fn_po_not_before`, the Preorder freeze triggers, the early-PO guard and `v_batch_missing_preorders`.
  - Cutoff refuses a batch that is not due (`p_now < cutoff_at`) or not open.
  - The snapshot takes the Pool Price whose validity window contains the cutoff instant and the Wholesaler price that Pool Price was quoted against (ADR-0008), not the open row.
  - The batch row lock plus `UNIQUE (route_batch_id, transition_type)` make a retry a no-op; `fired_at` is recorded.
  - Preorder `ordered_bundles` and `unit_price_locked` reject UPDATE and DELETE once the batch leaves `OPEN_FOR_ORDERS`; the snapshot was already append-only (0003).
  - `fn_po_not_before` opens the PO window at cutoff + `cutoff_to_po_minutes`; the trigger refuses an earlier `submitted_at`. `dispatch_policy` checks poll ≤ 15 min and gap ≥ 30 min.
- **Dispatcher:** `scripts/dispatch.ts` (`npm run dispatch`, `--once` for a single poll) reads the interval from `dispatch_policy` and fires due Cutoffs. The console runs a catch-up poll on load, so a missed tick cannot leave a stale open batch.
- **Console:** shows batch state, cutoff and fired-at time, frozen carton/pool price per SKU, and the Stalls with no Preorder after Cutoff. Frozen prices render as a phone-first list (360 px: `scrollWidth` 360).
- **Evidence:** `npm test` 42 passed (8 cutoff, 34 existing) against real PostgreSQL 16; `npm run typecheck` clean; `npm run build` not rerun (no route change); `npm run db:reset` clean. Dispatcher smoke: seed cutoff moved into the past, `npm run dispatch -- --once` fired once → `CLOSED_AT_CUTOFF`, 6 snapshot rows, one `CUTOFF_FIRED`. Console catch-up smoke: after reset, cutoff moved into the past, page load closed the batch and wrote exactly one transition and 6 snapshot rows. Browser at 390 px and 360 px showed `CLOSED AT CUTOFF`, six frozen prices, and all nine Stalls with no Preorder.
- **Review:** Standards — 0 hard violations; 3 judgement calls (cross-file cutoff split, singleton boolean key, test-helper overlap), none actioned. Spec — 2 findings: the PO gap was stored but unused, and the Pool/Wholesaler snapshot paired independent rows. Both fixed in `ff8ff1f`: `fn_po_not_before` + trigger with a +29/−+30 test, and the snapshot now follows `pool_prices.wholesaler_price_id` (a competing primary quote test pins it).
- **Next:** `/clear`, then `/implement #6` (WhatsApp) or #7 (Purchase) — both unblocked. #12 unlocks once #6 lands; #8 needs #6 and #7.

### ✅ 4d. Ticket #6 — WhatsApp transport, 2026-10-30

- **Closed:** [#6](https://github.com/Fernado03/Sarpply/issues/6) on 2026-10-30 with the evidence comment.
- **Commits:** `89fb68b` (implementation), `6919a47` (review fixes). Branch `main`.
- **Port and adapters:** `src/lib/messaging/` holds one `MessagingPort`, an in-memory `FakeMessagingAdapter` (unique provider ids, one-shot or permanent failure injection) and a `CloudApiMessagingAdapter` (Graph API text send, digits-only recipient, provider errors surfaced). `WHATSAPP_PROVIDER=fake|cloud` selects the adapter; cloud requires `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
- **Inbound webhook:** `src/app/api/whatsapp/webhook/route.ts` verifies Meta's `X-Hub-Signature-256` HMAC over the raw body with `WHATSAPP_APP_SECRET`; missing or forged signatures return 401. The subscription handshake compares `WHATSAPP_VERIFY_TOKEN` and returns 403 otherwise. `fn_store_inbound_message` (0009) keys on the provider message id, matches the sender's phone digits to a Stall and the current open batch, and stores text or audio metadata (`message_type`, media id/mime/duration, voice flag). No audio is transcribed and no order or voice draft is written.
- **Broadcast:** `fn_queue_broadcast` builds Script B from the Pool Prices in force, derives the cutoff and delivery weekday/time from the batch, includes the seven-day voice-note line, and inserts one `QUEUED` row per active Stall under a per-batch/stall dedupe key; a second run queues nothing. `fn_pending_outbound_messages`, `fn_mark_outbound_sent` and `fn_mark_outbound_failed` update the same row, so a retry cannot create a second message row.
- **Console:** message log for the batch (outbound status, provider result, failure reason, expandable body; inbound text and voice metadata) plus queue/send and retry-failed actions. Rendered at 390 px.
- **Evidence:** `npm test` 62 passed (20 new) against real PostgreSQL 16; `npm run typecheck` and `npm run build` clean. Adapter tests cover signature accept/reject, fake failure-once/always, Cloud request shape and error mapping, config selection and payload parsing. Database/webhook tests cover signed acceptance, unsigned/forged 401, redelivery one row, voice metadata with unchanged order/draft counts, Script B price/retention/timing content, queue idempotency, provisional-Stall exclusion, closed-batch refusal, and failure recorded then retried on the same row. HTTP smoke: signed 200, unsigned/forged 401, handshake 200/403, two signed posts stored two rows. Console showed 9 sent, inbound text plus voice note, and `tutup pada (Rabu, 12:00)` / `hari Khamis petang` from the seeded batch.
- **Review:** Standards — 2 hard violations, 1 judgement call. Broadcast timing was hardcoded; fixed in `6919a47` so the cutoff day/time and delivery day come from the batch. Voice-note deletion is **#16** (blocked by #11 and #15), not this ticket: #6 stores metadata only. Concurrent double-send is a residual risk accepted for the single-writer console. Spec — 3 findings, none required a code change: the `(N bungkus)` labels match Script B and the SKU bundle counts; the fake injects send failure/retry while every assertion reads database state (the ticket's own delivery acceptance); at-least-once provider duplication is documented in `README.md` because the Cloud API has no idempotency key for a text send.
- **Next:** `/clear`, then `/implement #7` (Purchase) or #12 (gate warning) — both unblocked. #8 needs #6 and #7.

### ✅ 4e. Ticket #7 — purchase and receipt, 2026-10-30

- **Closed:** [#7](https://github.com/Fernado03/Sarpply/issues/7) on 2026-10-30 with the evidence comment.
- **Commits:** `90e5665` (implementation), `db9cacc` (review fixes). Branch `main`.
- **Purchase plan:** `v_purchase_plan` publishes per SKU Ordered Bundles, Buffer Stock on hand, Route cartons, physical boxes, geometric litres, frozen carton cost and cash. `v_purchase_plan_total` publishes the batch totals so the console never re-adds money. B01 still shows 13 cartons, 18 boxes, 901.5 L geometric, 979.9 L packed, and fits the 980 L Myvi at 0.92.
- **Allocation:** `v_sortie_carton_allocation` rounds once at Route level, then splits whole cartons by largest remainder proportional to each Sortie's Ordered Bundles, ties to the lower `trip_number`. `v_sortie_load` checks the allocated cartons against the batch Vehicle; `packed_liters_shared` is retired. Rule recorded in `docs/adr/0019-route-cartons-allocated-by-largest-remainder.md`.
- **Vehicle:** `fn_confirm_batch_vehicle` only runs after Cutoff, records `route_batches.vehicle_confirmed_at`, and makes the choice final. Re-confirming a different Vehicle is refused.
- **Wholesaler PO:** `fn_submit_wholesaler_po` refuses an open book, an unconfirmed Vehicle, the 30-minute gap, a Sortie over capacity, an empty plan, and a Wholesaler that did not quote the frozen prices. Lines come from `v_purchase_plan`; a trigger enforces that the frozen carton cost, not the live price, is used. A retry returns the same PO.
- **Receipt:** `fn_receive_po` is one operation: writes every PO line, records `received_at`, derives `cash_required_myr` from cartons received, and posts one immutable `PURCHASE_RECEIPT` movement per line at the frozen cost (`PO:<po>:<sku>`). Same counts return 0 movements; different counts are refused. Short receipts remain visible and are never auto-corrected.
- **Cost precision:** `stock_movements.unit_cost_myr` is now `NUMERIC(12,6)` and the weighted average rounds to six decimals, so a carton cost that does not divide evenly (RM 100 / 12) still values at the cent. `ADR-0018` records why.
- **Console:** purchase table, copyable purchase list, Sortie fit badges, Vehicle confirmation, PO submission, explicit receipt counts (empty, not pre-filled with ordered), shortfall notice, and cash from received. The received time is the receipt operation's `NOW()`, recorded on the PO.
- **Evidence:** `npm test` 72 passed (10 new purchase tests at the PostgreSQL seam); `npm run typecheck` and `npm run build` clean. Browser smoke at 360 px (`scrollWidth` 360 = `innerWidth`): 13 cartons, 18 boxes, 901.50 L, Sortie 1 at 979.9 / 980 L fits; Vehicle confirmed; PO submitted; A1 received 2 of 3 with the rest full → cash RM 1,538.00 and `Short receipt: A1 short 1` visible.
- **Review:** Standards — 2 must-fix (cent precision, PO Wholesaler vs frozen snapshot) and 1 should-fix (stale `v_sortie_load` guide) fixed; 1 judgement call (duplicate totals) fixed through `v_purchase_plan_total`. Spec — retry buffer drift, hidden short receipts, early Vehicle confirmation/re-basing and non-divisible cost precision fixed; received time is recorded by the operation rather than typed.
- **Next:** `/clear`, then `/implement #8` (Delivery) or `/implement #12` (gate warning) — both unblocked. #9 needs #8; #10 needs #7 and #8; #11 needs #7, #8 and #9.

## ⬜ 5. Review — `/code-review`

- Runs inside `/implement`; can also be typed on its own.
- Needs a **fixed point**: a commit, tag, branch, or `HEAD~N`. It refuses an empty diff.
- Two separate reports, never merged:
  - **Standards** — repo standards plus Fowler smell baseline.
  - **Spec** — does the diff implement the originating issue/spec?
- Do not rerank across axes; a change can pass one and fail the other.

## ⬜ 6. PR — `/pr`

- Model-invoked: the agent reaches for it when writing a PR body.
- Body shape: **Summary** (smallest visual that makes the change clear) · **Evidence** (before/after) · **Merge Danger** (one-way or two-way door + blast radius).

## ⬜ 7. Retro — `/retro`

- Run **before clearing** the session it reviews.
- Improves the **environment**, not the code: navigation pointers, automated checks, coding standards, steering files, tooling.
- Mechanical mistakes → deterministic checks. Judgement calls → `CODING_STANDARDS.md`.

---

## Reference — all 27 skills

### Typed (16) — only you can fire these

| Command | Use when |
|---|---|
| `/setup-matt-pocock-skills` | Once per repo; tracker, labels, doc layout |
| `/ask-matt` | Router: which skill fits this situation |
| `/grill-with-docs` | Sharpen an idea in a repo; writes `GLOSSARY.md` + ADRs |
| `/grill-me` | Same interview, no repo / no paper trail |
| `/to-spec` | Synthesize the settled thread into a spec issue; once per idea |
| `/to-tickets` | Split a spec/plan into tracer tickets with blocking edges |
| `/implement` | Build one ticket (or a small spec) with `tdd` + `code-review` |
| `/implement-spec` | Build the whole spec on an integration branch via subagents |
| `/triage` | Move **inbound** issues through triage roles into agent briefs |
| `/wayfinder` | Huge foggy effort: map of decision tickets, decisions not deliverables |
| `/improve-codebase-architecture` | Survey deepening opportunities as an HTML report, then grill one |
| `/retro` | Turn a session into environment improvements |
| `/handoff` | Portable session summary; only for a new harness/directory/person |
| `/teach` | Multi-session learning workspace |
| `/to-questionnaire` | The missing knowledge is in someone else's head |
| `/wait-what` | Re-pitch a message that did not land |

### Reached (11) — the agent pulls these, or you can type them

| Skill | Use when |
|---|---|
| `grilling` | The interview primitive behind the grill commands and triage/wayfinder |
| `domain-modeling` | Challenge terms, update `GLOSSARY.md`, offer an ADR |
| `codebase-design` | Deep-module vocabulary: module, interface, depth, seam, adapter |
| `tdd` | Red-green at pre-agreed seams, one vertical slice at a time |
| `code-review` | Two-axis review of a diff since a fixed point |
| `diagnosing-bugs` | Hard bug: build a red-capable loop first, no loop no theory |
| `research` | Background agent, primary sources, cited Markdown |
| `prototype` | One design question answered with throwaway code |
| `pr` | Shape the PR body |
| `wizard` | Interactive bash script for human-only steps |
| `writing-for-agents` | Writing skills, `AGENTS.md`, or agent-consumed docs |

### Off-spine rules

- **`/triage`** — inbound issues only; never your own tickets, never `/to-tickets` output.
- **`/wayfinder`** — when the map clears, hand off to `/to-spec`; never straight to `/implement`.
- **`/prototype`** — keep the artifact as a `prototype/<name>` branch and point the ticket at it.
- **`/research`** — feeds `/grill-with-docs`; it does not replace the interview.
- **`/diagnosing-bugs`** — no reproduction loop, no hypothesis phase.

---

## Rules that keep the flow clean

1. Setup runs **once per repo**.
2. Keep grilling → spec → tickets in **one unbroken window**.
3. `/to-spec` runs **once per idea**.
4. Tickets are a **graph**, worked from the frontier, blockers first.
5. Never triage your own tickets.
6. Agree test seams **before** the first test; `/tdd` refuses unconfirmed seams.
7. **Red before green**, one vertical slice at a time; no horizontal test batches.
8. `/implement` per ticket, `/clear` between tickets.
9. `/code-review` at a **fixed point**, two axes reported separately.
10. `/retro` edits the environment, not the code.

## Phase boundaries

At the end of each phase, ask in order; first yes wins:

1. **Continue** — the next phase needs this context as a primary source.
2. **`/clear`** — this context is disposable. Cheapest move; not terminal.
3. **`/handoff`** — something must travel (new harness, directory, person, mid-phase fork).
4. **Subagent** — the task is tightly scoped and AFK.
5. **`/compact`** — same harness/directory, you must stay in the loop.

Never compact mid-phase. Every move except Continue turns a primary source into a lossy summary.

---

## How to update this file

1. Move the `👉` to the step you are about to run.
2. When the step completes, replace `👉` with `✅` and add its artifact (commit, issue, branch).
3. Leave evidence, not summaries: commit SHAs, issue numbers, file paths.
4. Add a line to the run log when a step runs more than once (e.g. a second `/to-tickets` round).

## Run log

| Date | Step | Command | Outcome | Evidence |
|---|---|---|---|---|
| 2026-10-27 | Setup | `/setup-matt-pocock-skills` | Config written | `AGENTS.md`, `docs/agents/*`, labels |
| 2026-10-27 | Grill | `/grill-with-docs` | Domain model settled | `GLOSSARY.md`, ADRs 0001–0017, pillar docs |
| 2026-10-28 | Spec | `/to-spec` (typed after publication) | Spec published | `08691b1`, issue #2 |
| 2026-10-29 | Tickets | `/to-tickets 2` | 15 sub-issues published with native blocking edges; parent #2 unchanged | Issues [#3](https://github.com/Fernado03/Sarpply/issues/3)–[#17](https://github.com/Fernado03/Sarpply/issues/17); frontier #3 |
| 2026-10-29 | Ticket review | `reviewer` subagent (read-only) | NEEDS CHANGES; graph sound, contracts incomplete; 5 blocking, 5 major, 4 minor findings | `WORKFLOW.md` §3a; `history://TicketReview` |
| 2026-10-29 | Ticket remediation | Applied in place, #3–#17 | All 14 findings applied to ticket bodies; #12 blocker changed from #11 to #6; graph reverified | `WORKFLOW.md` §3b; issues #3–#17 |
| 2026-10-30 | Implement #3 | `/implement 3` | Walking skeleton landed; issue #3 closed | `95fe0e8`, `775b016`; 14 tests at the database seam |
| 2026-10-30 | Code review #3 | `/code-review d594a85` | Standards 2 judgement calls; Spec 2 findings (identity, valuation in app code); both Spec findings fixed | `775b016` |
| 2026-10-30 | Implement #4 | `/implement 4` | Text intake landed; issue #4 closed | `41ccad7`; 33 tests at the parser and database seams |
| 2026-10-30 | Implement #5 | `/implement 5` | Cutoff landed; issue #5 closed | `5d4fe41`, `ff8ff1f`; 42 tests at the database seam |
| 2026-10-30 | Code review #5 | `/code-review a186064` | Standards 0 hard violations, 3 judgement calls; Spec 2 findings (PO gap unused, price pairing); both fixed | `ff8ff1f` |
| 2026-10-30 | Implement #6 | `/implement 6` | WhatsApp transport landed; issue #6 closed | `89fb68b`, `6919a47`; 62 tests at the adapter and database seams |
| 2026-10-30 | Code review #6 | `/code-review 969d3bf` | Standards 2 hard (timing fixed; retention deferred to #16), 1 judgement; Spec 3 (labels verified, fake seam accepted, at-least-once documented) | `6919a47` |
| 2026-10-30 | Implement #7 | `/implement 7` | Purchase plan, Wholesaler PO, receipt and console landed; issue #7 closed | `90e5665`, `db9cacc`; 72 tests at the database seam |
| 2026-10-30 | Code review #7 | `/code-review 203d269` | Standards 2 must (cent precision, supplier mismatch), 1 should (stale guide), 1 judgement (totals); Spec 4 code findings (retry buffer, short defaults, Vehicle re-basing, cost precision); all code findings fixed | `db9cacc`; `ADR-0018`/`0019`; `v_purchase_plan_total` |
