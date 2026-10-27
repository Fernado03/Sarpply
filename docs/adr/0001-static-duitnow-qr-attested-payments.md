# Static DuitNow QR with Runner-attested payment capture

Status: accepted

Sarpply collects at the stall on delivery, through a printed corporate DuitNow QR card and cash. A static QR produces no settlement callback, so payment is recorded as a Runner attestation — `payment_status` of `PAID_CASH` or `PAID_DUITNOW`, an optional `payment_reference`, plus `payment_attested_at` and `attested_by` — and the Founder matches the day's attestations against the corporate bank statement at batch reconciliation. A merchant QR with per-transaction callbacks was rejected for Phase 1–2 because acquiring fees of 0.5%–1.0% of GMV would consume 5%–10% of a ~10% gross spread.

## Considered Options

- **Dynamic merchant DuitNow QR** — real callbacks, but acquiring fees and an onboarding contract. Deferred to a Phase 3 decision.
- **Prepayment before Cutoff** — removes collection risk, rejected on adoption grounds: Stalls will not transfer money up front to a new platform.
- **Cash only** — no fees, but pushes float and counting risk onto a Runner earning RM 45 a shift.

## Consequences

Every claim of "real-time DuitNow reconciliation" is removed from `05_PRD.md` and `06_TRD.md`. Payment truth stays a human assertion until the Founder's statement match, so a shortfall surfaces at reconciliation rather than at the stall counter.
