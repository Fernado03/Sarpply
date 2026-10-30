# Sarpply — Skills Workflow Tracker

Human-facing checklist for the Matt Pocock skill flow. The issue tracker owns the work; this file owns **which step we are on**.

Last updated: 2026-10-29

Legend: `✅` done · `👉` current · `⬜` not started · `⏭` not applicable

---

## Current position

```text
✅ setup → ✅ grill-with-docs → ✅ to-spec → ✅ to-tickets → 👉 implement → ⬜ code-review → ⬜ pr → ⬜ retro
```

- **Done:** setup, grilling, spec ([#2](https://github.com/Fernado03/Sarpply/issues/2)), tickets ([#3](https://github.com/Fernado03/Sarpply/issues/3)–[#17](https://github.com/Fernado03/Sarpply/issues/17)), ticket review and remediation (§3a, §3b).
- **Now:** `/implement #3` — the only unblocked ticket.
- **After that:** `/clear`, then the next frontier ticket; then `/code-review`, `/pr`, `/retro`.

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
