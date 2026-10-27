# Three margin figures, never one: Forecast GP, Realized GP and Net Batch Cash Flow

`v_batch_pnl_summary` reports Forecast GP at Cutoff (Preorder Ordered Bundles × (locked price − bundle unit cost)), Realized GP at reconciliation (Delivered Bundles, including Spot Sales, × (locked price − bundle unit cost)), and Net Batch Cash Flow (money collected − cartons received × carton cost − logistics). Realized GP is the figure the Phase 1 gate is judged on. A single gross-profit number was rejected because bundle cost is accrual while carton cash-out is not: at Route scale a week's cartons cost RM 2,484 to buy while its Bundles earn RM 253.40 of accrual margin against RM 119.60 of cash spread, the difference being RM 133.80 of Buffer Stock at cost.

## Consequences

Budgeting, float sizing and reconciliation read Net Batch Cash Flow; pricing, gate and Route quality read Realized GP; cutoff decisions read Forecast GP. The three reconcile by construction — Realized GP minus ending Buffer Stock at cost equals cash spread — so any report where that identity fails has a ledger bug. A reader comparing Realized GP to a bank balance will otherwise conclude the business is losing money it is not losing.
