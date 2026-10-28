# Sarpply — Skills Workflow Tracker

Human-facing checklist for the Matt Pocock skill flow. The issue tracker owns the work; this file owns **which step we are on**.

Last updated: 2026-10-28

Legend: `✅` done · `👉` current · `⬜` not started · `⏭` not applicable

---

## Current position

```text
✅ setup → ✅ grill-with-docs → ✅ to-spec → 👉 to-tickets → ⬜ implement → ⬜ code-review → ⬜ pr → ⬜ retro
```

- **Done:** setup, grilling, spec ([#2](https://github.com/Fernado03/Sarpply/issues/2)).
- **Now:** `/to-tickets 2` — split the spec into tracer-bullet tickets with blocking edges.
- **After that:** `/implement #<ticket>` per ticket with `/clear` between, **or** `/implement-spec 2`.

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

## 👉 3. Tickets — `/to-tickets 2`

Type:

```text
/to-tickets 2
```

- **Requires:** issue #2, plus your approval of the proposed breakdown.
- **Produces:** one sub-issue per tracer bullet, in dependency order, each labelled `ready-for-agent`, with **native GitHub blocking links**; parent #2 stays open and unmodified.
- **Before you approve the breakdown, check:**
  - Each ticket is a **vertical slice** — schema + function + view + console + test, demoable alone — not a layer.
  - Each ticket fits **one fresh context window**.
  - Blocking edges are real: a ticket depends only on tickets that genuinely gate it.
  - Prefactoring (if any) comes first.
  - Nothing in the spec's 46 user stories is silently dropped; no ticket invents scope.
- **Done when:** #2 has sub-issues, every ticket has its blockers set, and the frontier (unblocked, unassigned tickets) is visible in GitHub's UI.
- **Do not triage** these tickets. `/triage` is only for issues you did not create.

## ⬜ 4. Implement — `/implement` or `/implement-spec`

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
| — | Tickets | `/to-tickets 2` | **pending** | — |
