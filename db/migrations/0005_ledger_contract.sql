-- 0005_ledger_contract.sql — the write path enforces ADR-0018, and the
-- reconciliation identity is published as a database view.

-- ─── Post one ledger movement ──────────────────────────────────────────────
-- Positive movements carry the caller's unit cost (invoice cost per Bundle).
-- Negative movements carry the moving weighted-average cost of the balance
-- before them, computed here under a row lock. A duplicate idempotency key
-- returns 0 and writes nothing.
CREATE OR REPLACE FUNCTION fn_post_stock_movement(
  p_sku_code        VARCHAR(10),
  p_vehicle_id      UUID,
  p_quantity_bundles INT,
  p_movement_type   VARCHAR(24),
  p_idempotency_key VARCHAR(160),
  p_unit_cost_myr   NUMERIC DEFAULT NULL,
  p_route_batch_id  UUID DEFAULT NULL,
  p_stall_order_id  UUID DEFAULT NULL,
  p_occurred_at     TIMESTAMPTZ DEFAULT NOW(),
  p_note            TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_on_hand   INT;
  v_value     NUMERIC;
  v_unit_cost NUMERIC;
  v_inserted  INT;
BEGIN
  IF p_quantity_bundles = 0 THEN
    RAISE EXCEPTION 'stock movement quantity must be non-zero'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM stock_movements WHERE idempotency_key = p_idempotency_key) THEN
    RETURN 0;
  END IF;

  -- Serialise postings for this SKU in this Vehicle.
  PERFORM 1
  FROM stock_movements
  WHERE sku_code = p_sku_code AND vehicle_id = p_vehicle_id
  FOR UPDATE;

  IF p_quantity_bundles > 0 THEN
    IF p_unit_cost_myr IS NULL OR p_unit_cost_myr <= 0 THEN
      RAISE EXCEPTION 'positive movements require a unit cost'
        USING ERRCODE = 'check_violation';
    END IF;
    v_unit_cost := p_unit_cost_myr;
  ELSE
    SELECT COALESCE(SUM(quantity_bundles), 0),
           COALESCE(SUM(quantity_bundles * unit_cost_myr), 0)
      INTO v_on_hand, v_value
      FROM stock_movements
     WHERE sku_code = p_sku_code AND vehicle_id = p_vehicle_id;

    IF v_on_hand + p_quantity_bundles < 0 THEN
      RAISE EXCEPTION 'cannot post % Bundles against a balance of %', p_quantity_bundles, v_on_hand
        USING ERRCODE = 'check_violation';
    END IF;
    v_unit_cost := ROUND(v_value / NULLIF(v_on_hand, 0), 6);
  END IF;

  INSERT INTO stock_movements
    (sku_code, vehicle_id, quantity_bundles, unit_cost_myr, movement_type,
     route_batch_id, stall_order_id, idempotency_key, occurred_at, note)
  VALUES
    (p_sku_code, p_vehicle_id, p_quantity_bundles, v_unit_cost, p_movement_type,
     p_route_batch_id, p_stall_order_id, p_idempotency_key, p_occurred_at, p_note)
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ─── Net Batch Cash Flow and the reconciliation identity ──────────────────
-- Realized GP − (closing Buffer at cost − opening Buffer at cost) − Runner
--   = Net Batch Cash Flow, where Net Cash is collected − cartons paid − Runner.
-- The residual must be zero to the cent before a batch may be reconciled.
CREATE OR REPLACE VIEW v_route_batch_identity AS
WITH buffer AS (
  SELECT v.route_batch_id,
         SUM(v.opening_cost_myr)::NUMERIC(12,2) AS opening_cost_myr,
         SUM(v.closing_cost_myr)::NUMERIC(12,2) AS closing_cost_myr
  FROM v_batch_buffer v
  GROUP BY v.route_batch_id
),
cash AS (
  SELECT p.route_batch_id,
         SUM(COALESCE(l.cartons_received, 0) * l.carton_cost)::NUMERIC(12,2) AS cash_paid_myr
  FROM wholesaler_pos p
  JOIN wholesaler_po_lines l ON l.po_id = p.id
  GROUP BY p.route_batch_id
)
SELECT p.route_batch_id,
       p.delivery_date,
       p.realized_gp_myr,
       COALESCE(b.opening_cost_myr, 0)::NUMERIC(12,2) AS opening_buffer_cost_myr,
       COALESCE(b.closing_cost_myr, 0)::NUMERIC(12,2) AS closing_buffer_cost_myr,
       p.runner_cost_myr,
       p.collected_myr,
       COALESCE(c.cash_paid_myr, 0)::NUMERIC(12,2) AS cash_paid_myr,
       (p.collected_myr - COALESCE(c.cash_paid_myr, 0) - p.runner_cost_myr)::NUMERIC(12,2)
         AS net_batch_cash_flow_myr,
       (p.realized_gp_myr
          - (COALESCE(b.closing_cost_myr, 0) - COALESCE(b.opening_cost_myr, 0))
          - p.runner_cost_myr
          - (p.collected_myr - COALESCE(c.cash_paid_myr, 0) - p.runner_cost_myr)
       )::NUMERIC(12,2) AS identity_residual_myr
FROM v_route_batch_pnl p
LEFT JOIN buffer b ON b.route_batch_id = p.route_batch_id
LEFT JOIN cash c   ON c.route_batch_id = p.route_batch_id;
