-- 0013_reconcile.sql — reconciliation publishes the three margin figures,
-- Buffer Stock at cost, Sortie cost, gate headroom and the gate verdict.
-- fn_reconcile_batch refuses to close a batch whose identity residual is
-- not zero to the cent (ADR-0010).

DROP VIEW IF EXISTS v_route_batch_identity;

-- ─── One cost figure for Realized GP and reconciliation ───────────────────
-- Republished from 0011 with delivered_cost_myr appended, so the identity,
-- headroom and Realized GP cannot describe different costs.
CREATE OR REPLACE VIEW v_route_batch_pnl AS
WITH revenue AS (
  SELECT o.route_batch_id,
         SUM(CASE WHEN o.order_type = 'PREORDER'
                  THEN o.ordered_bundles * (pr.locked_pool_bundle_price
                       - pr.locked_carton_cost / sk.bundles_per_master_carton)
                  ELSE 0 END)::NUMERIC(12,2) AS forecast_gp_myr,
         SUM(o.delivered_bundles * pr.locked_pool_bundle_price)::NUMERIC(12,2) AS gmv_delivered_myr,
         SUM(CASE WHEN o.payment_status IN ('PAID_CASH','PAID_DUITNOW')
                   AND o.delivered_bundles > 0
                  THEN o.delivered_bundles * pr.locked_pool_bundle_price
                  ELSE 0 END)::NUMERIC(12,2) AS collected_myr,
         SUM(CASE WHEN o.payment_status NOT IN ('PAID_CASH','PAID_DUITNOW')
                   AND o.delivered_bundles > 0
                  THEN o.delivered_bundles * pr.locked_pool_bundle_price
                  ELSE 0 END)::NUMERIC(12,2) AS uncollected_goods_myr
  FROM stall_orders o
  JOIN skus sk               ON sk.sku_code = o.sku_code
  JOIN route_batch_prices pr ON pr.route_batch_id = o.route_batch_id
                            AND pr.sku_code = o.sku_code
  GROUP BY o.route_batch_id
),
delivered_cost AS (
  SELECT route_batch_id,
         SUM(-quantity_bundles * unit_cost_myr)::NUMERIC(12,2) AS cost_myr
  FROM stock_movements
  WHERE movement_type IN ('DELIVERY','SPOT_SALE')
    AND route_batch_id IS NOT NULL
  GROUP BY route_batch_id
)
SELECT b.id AS route_batch_id,
       b.delivery_date,
       COALESCE(r.forecast_gp_myr, 0)::NUMERIC(12,2) AS forecast_gp_myr,
       (COALESCE(r.gmv_delivered_myr, 0) - COALESCE(d.cost_myr, 0))::NUMERIC(12,2) AS realized_gp_myr,
       COALESCE(r.gmv_delivered_myr, 0)::NUMERIC(12,2) AS gmv_delivered_myr,
       COALESCE(r.collected_myr, 0)::NUMERIC(12,2) AS collected_myr,
       b.runner_cost_myr,
       COALESCE(r.uncollected_goods_myr, 0)::NUMERIC(12,2) AS uncollected_goods_myr,
       COALESCE(d.cost_myr, 0)::NUMERIC(12,2) AS delivered_cost_myr
FROM route_batches b
LEFT JOIN revenue r        ON r.route_batch_id = b.id
LEFT JOIN delivered_cost d ON d.route_batch_id = b.id;

-- ─── The reconciliation read model ────────────────────────────────────────
-- Forecast GP reads Ordered Bundles at the Cutoff snapshot. Realized GP
-- reads Delivered Bundles (Preorder and Spot) at the ledger cost that
-- actually moved, so a sell-down week is not reported as new profit. The
-- identity residual is zero to the cent when the ledger is sound.
CREATE OR REPLACE VIEW v_route_batch_reconciliation AS
WITH buffer AS (
  SELECT route_batch_id,
         SUM(opening_cost_myr) AS opening_cost_myr,
         SUM(closing_cost_myr) AS closing_cost_myr
  FROM v_batch_buffer
  GROUP BY route_batch_id
),
cash AS (
  SELECT p.route_batch_id,
         SUM(COALESCE(l.cartons_received, 0) * l.carton_cost) AS cash_paid_myr
  FROM wholesaler_pos p
  JOIN wholesaler_po_lines l ON l.po_id = p.id
  GROUP BY p.route_batch_id
),
figures AS (
  SELECT p.route_batch_id,
         p.delivery_date,
         b.status,
         p.forecast_gp_myr,
         p.realized_gp_myr,
         p.gmv_delivered_myr,
         1500.00::NUMERIC(12,2) AS gmv_threshold_myr,
         150.00::NUMERIC(12,2) AS gp_threshold_myr,
         p.collected_myr,
         p.runner_cost_myr AS sortie_cost_myr,
         COALESCE(buf.opening_cost_myr, 0)::NUMERIC(12,2) AS opening_buffer_cost_myr,
         COALESCE(buf.closing_cost_myr, 0)::NUMERIC(12,2) AS closing_buffer_cost_myr,
         COALESCE(c.cash_paid_myr, 0)::NUMERIC(12,2) AS cash_paid_myr,
         p.delivered_cost_myr,
         (p.collected_myr - COALESCE(c.cash_paid_myr, 0) - p.runner_cost_myr)::NUMERIC(12,2)
           AS net_batch_cash_flow_myr
  FROM v_route_batch_pnl p
  JOIN route_batches b ON b.id = p.route_batch_id
  LEFT JOIN buffer buf ON buf.route_batch_id = p.route_batch_id
  LEFT JOIN cash c ON c.route_batch_id = p.route_batch_id
)
SELECT route_batch_id,
       delivery_date,
       status,
       forecast_gp_myr,
       realized_gp_myr,
       gmv_delivered_myr,
       gmv_threshold_myr,
       gp_threshold_myr,
       opening_buffer_cost_myr,
       closing_buffer_cost_myr,
       sortie_cost_myr,
       collected_myr,
       cash_paid_myr,
       delivered_cost_myr,
       net_batch_cash_flow_myr,
       ROUND(realized_gp_myr
             - (closing_buffer_cost_myr - opening_buffer_cost_myr)
             - sortie_cost_myr
             - net_batch_cash_flow_myr, 2)::NUMERIC(12,6) AS identity_residual_myr,
       -- Percent of delivered cost: how far a Wholesaler rise can go before
       -- the RM 150 GP gate breaks. Zero delivered cost has no percentage.
       ROUND((realized_gp_myr - gp_threshold_myr) / NULLIF(delivered_cost_myr, 0) * 100, 2)
         AS headroom_pct,
       CASE
         WHEN gmv_delivered_myr >= gmv_threshold_myr
          AND realized_gp_myr >= gp_threshold_myr THEN 'PASS'
         WHEN gmv_delivered_myr < gmv_threshold_myr
          AND realized_gp_myr < gp_threshold_myr THEN 'FAIL_BOTH'
         WHEN gmv_delivered_myr < gmv_threshold_myr THEN 'FAIL_VOLUME'
         ELSE 'FAIL_MARGIN'
       END AS gate_verdict
FROM figures;

-- ─── Close a DELIVERED batch, but only with a zero residual ───────────────
-- RETURNS the reconciliation row. A retry on a reconciled batch is a no-op:
-- no transition, no movement, no buffer change.
CREATE OR REPLACE FUNCTION fn_reconcile_batch(p_route_batch_id UUID)
RETURNS v_route_batch_reconciliation LANGUAGE plpgsql AS $$
DECLARE
  v_status VARCHAR(24);
  v_row    v_route_batch_reconciliation;
BEGIN
  SELECT b.status INTO v_status
    FROM route_batches b
   WHERE b.id = p_route_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route Batch % does not exist', p_route_batch_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT * INTO v_row
    FROM v_route_batch_reconciliation
   WHERE route_batch_id = p_route_batch_id;

  IF v_status = 'RECONCILED' THEN
    RETURN v_row;
  END IF;

  IF v_status <> 'DELIVERED' THEN
    RAISE EXCEPTION 'only a DELIVERED Route Batch can be reconciled (batch is %)', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_row.identity_residual_myr <> 0 THEN
    RAISE EXCEPTION
      'reconciliation refused: identity residual is RM %; the batch stays unreconciled',
      v_row.identity_residual_myr
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE route_batches
     SET status = 'RECONCILED',
         reconciled_at = clock_timestamp()
   WHERE id = p_route_batch_id;

  INSERT INTO route_batch_transitions (route_batch_id, transition_type, fired_at)
  VALUES (p_route_batch_id, 'RECONCILED', clock_timestamp())
  ON CONFLICT (route_batch_id, transition_type) DO NOTHING;

  SELECT * INTO v_row
    FROM v_route_batch_reconciliation
   WHERE route_batch_id = p_route_batch_id;

  RETURN v_row;
END;
$$;
