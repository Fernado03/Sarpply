# Batch timing is data, driven by a polling dispatcher, not hardcoded crons

Every Route carries its own `cutoff_day`, `cutoff_time`, `delivery_day` and `delivery_time`, and a single dispatcher runs every 15 minutes in `Asia/Kuching`, reading those columns and firing whichever transitions have come due. Per-state cron expressions in the TRD were rejected: they hardcode one Route's Wednesday-and-Thursday rhythm into the deployment, so onboarding a Route with a Monday cutoff means editing and redeploying code, and a missed or duplicated firing has no record to inspect.

## Consequences

A transition can fire up to 15 minutes late, which is acceptable against a 22-hour ordering window but not for the 30-minute gap between `CLOSED_AT_CUTOFF` and `PO_SUBMITTED`. Each firing must therefore be recorded and made idempotent, so a re-run after a crash does not re-send a broadcast or re-place a Wholesaler PO.
