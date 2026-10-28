# Three margin figures, never one: Forecast GP, Realized GP and Net Batch Cash Flow

`v_batch_pnl_summary` reports Forecast GP at Cutoff (Preorder Ordered Bundles × (locked price − bundle unit cost)), Realized GP at reconciliation (Delivered Bundles, including Spot Sales, × (locked price − bundle unit cost)), and Net Batch Cash Flow (money collected − cartons received × carton cost − logistics). Realized GP is the figure the Phase 1 gate is judged on. A single gross-profit number was rejected because bundle cost is accrual while carton cash-out is not: Batch 1's cartons cost **RM 1,673.00** to buy while its Bundles earned **RM 167.00** of accrual margin against **−RM 58.50** of cash flow. The gap is RM 183.00 of Buffer Stock at cost plus the RM 42.50 Runner.

## Consequences

Budgeting, float sizing and reconciliation read Net Batch Cash Flow; pricing, gate and Route quality read Realized GP; cutoff decisions read Forecast GP. The three reconcile by construction:

```
Realized GP − (closing Buffer at cost − opening Buffer at cost) − Sortie cost = Net Batch Cash Flow
```

Both corrections matter and both were found by testing, not reading. Omitting the **Runner** term makes every batch read RM 42.50–85.00 wrong — small enough to look like rounding, large enough to hide a real error. Omitting the **opening** Buffer makes the identity hold only in Batch 1, then fail every later week, because a Route that sells down its buffer shows more cash than it earned.

Any report where that identity fails has a ledger bug. A reader comparing Realized GP to a bank balance will otherwise conclude the business is losing money it is not losing — Batch 2 shows **+RM 290.50** of cash against **RM 187.50** of profit, and the difference is Batch 1's stock finally being sold. A reader comparing Realized GP to a bank balance will otherwise conclude the business is losing money it is not losing.
