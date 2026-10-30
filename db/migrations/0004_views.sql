-- 0004_views.sql — derived reads. No buffer balance, GP or identity is stored.

-- ─── Current Buffer Stock balance and value at cost ────────────────────────
-- Valuation rule (ADR-0018): every movement carries the unit cost applied at
-- posting. Receipts carry the invoice cost; outbound movements carry the
-- weighted average of the balance before them. Value is therefore
-- SUM(quantity × unit_cost) and can always be rebuilt from the ledger.
CREATE OR REPLACE VIEW v_buffer_balance AS
SELECT sku_code,
       vehicle_id,
       SUM(quantity_bundles)::INT AS bundles_on_hand,
       SUM(quantity_bundles * unit_cost_myr)::NUMERIC(12,2) AS value_at_cost_myr
FROM stock_movements
GROUP BY sku_code, vehicle_id;

-- ─── Per-batch opening and closing Buffer Stock, in bundles and at cost ────
-- Opening is every movement on the batch's Vehicle that belongs to an
-- earlier batch (by cutoff) plus unattributed movements before this cutoff.
-- Later batches are excluded, so a historical replay is not polluted by
-- movements that had not happened yet.
CREATE OR REPLACE VIEW v_batch_buffer AS
WITH movements AS (
  SELECT m.sku_code, m.vehicle_id, m.route_batch_id, m.quantity_bundles,
         m.unit_cost_myr, m.occurred_at, rb.cutoff_at AS owning_cutoff
  FROM stock_movements m
  LEFT JOIN route_batches rb ON rb.id = m.route_batch_id
),
opening AS (
  SELECT b.id AS route_batch_id, m.sku_code,
         SUM(m.quantity_bundles)::INT AS bundles,
         SUM(m.quantity_bundles * m.unit_cost_myr)::NUMERIC(12,2) AS cost_myr
  FROM route_batches b
  JOIN movements m
    ON m.vehicle_id = b.vehicle_id
   AND m.route_batch_id IS DISTINCT FROM b.id
   AND (
         (m.route_batch_id IS NULL AND m.occurred_at < b.cutoff_at)
      OR (m.route_batch_id IS NOT NULL AND m.owning_cutoff < b.cutoff_at)
   )
  GROUP BY b.id, m.sku_code
),
in_batch AS (
  SELECT route_batch_id, sku_code,
         SUM(quantity_bundles)::INT AS bundles,
         SUM(quantity_bundles * unit_cost_myr)::NUMERIC(12,2) AS cost_myr
  FROM stock_movements
  WHERE route_batch_id IS NOT NULL
  GROUP BY route_batch_id, sku_code
)
SELECT b.id AS route_batch_id,
       b.vehicle_id,
       sk.sku_code,
       COALESCE(o.bundles, 0)::INT AS opening_bundles,
       COALESCE(o.cost_myr, 0)::NUMERIC(12,2) AS opening_cost_myr,
       (COALESCE(o.bundles, 0) + COALESCE(i.bundles, 0))::INT AS closing_bundles,
       (COALESCE(o.cost_myr, 0) + COALESCE(i.cost_myr, 0))::NUMERIC(12,2) AS closing_cost_myr
FROM route_batches b
JOIN skus sk ON sk.is_active
LEFT JOIN opening o  ON o.route_batch_id = b.id AND o.sku_code = sk.sku_code
LEFT JOIN in_batch i ON i.route_batch_id = b.id AND i.sku_code = sk.sku_code;

-- ─── Aggregation: cartons to buy, boxes, volume, cash ──────────────────────
CREATE OR REPLACE VIEW v_route_batch_aggregation AS
WITH ordered AS (
  SELECT o.route_batch_id, o.sku_code, SUM(o.ordered_bundles)::INT AS q_ordered
  FROM stall_orders o
  WHERE o.order_type = 'PREORDER'
  GROUP BY o.route_batch_id, o.sku_code
)
SELECT
  b.id                        AS route_batch_id,
  sk.sku_code,
  COALESCE(o.q_ordered, 0)    AS q_ordered,
  bb.opening_bundles          AS s_prev,
  (CASE WHEN COALESCE(o.q_ordered, 0) - bb.opening_bundles <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered, 0) - bb.opening_bundles)::NUMERIC
                  / sk.bundles_per_master_carton)::INT
   END)                       AS c_cartons,
  (CASE WHEN COALESCE(o.q_ordered, 0) - bb.opening_bundles <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered, 0) - bb.opening_bundles)::NUMERIC
                  / sk.bundles_per_master_carton)::INT
   END) * sk.physical_boxes_per_carton AS physical_boxes,
  (CASE WHEN COALESCE(o.q_ordered, 0) - bb.opening_bundles <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered, 0) - bb.opening_bundles)::NUMERIC
                  / sk.bundles_per_master_carton)::INT
   END)::NUMERIC * sk.carton_geometric_liters AS geometric_liters,
  rbp.locked_carton_cost,
  rbp.locked_pool_bundle_price
FROM route_batches b
JOIN v_batch_buffer bb ON bb.route_batch_id = b.id
JOIN skus sk           ON sk.sku_code = bb.sku_code
LEFT JOIN ordered o    ON o.route_batch_id = b.id AND o.sku_code = sk.sku_code
LEFT JOIN route_batch_prices rbp
       ON rbp.route_batch_id = b.id AND rbp.sku_code = sk.sku_code;

-- ─── Sortie volume check, per batch Vehicle ────────────────────────────────
CREATE OR REPLACE VIEW v_sortie_load AS
WITH cluster_demand AS (
  SELECT b.id AS route_batch_id, c.trip_number, o.sku_code,
         SUM(o.ordered_bundles)::INT AS q_bundles
  FROM route_batches b
  JOIN routes r  ON r.id = b.route_id
  JOIN clusters c ON c.route_id = r.id
  JOIN stalls st  ON st.cluster_id = c.id
  JOIN stall_orders o ON o.stall_id = st.id AND o.route_batch_id = b.id
  WHERE o.order_type = 'PREORDER'
  GROUP BY b.id, c.trip_number, o.sku_code
), per_cluster AS (
  SELECT cd.route_batch_id, cd.trip_number, cd.sku_code, cd.q_bundles,
         CEIL(cd.q_bundles::NUMERIC / sk.bundles_per_master_carton)::INT AS c_cartons,
         sk.carton_geometric_liters,
         sk.bundles_per_master_carton
  FROM cluster_demand cd
  JOIN skus sk USING (sku_code)
)
SELECT pc.route_batch_id,
       pc.trip_number,
       ROUND(SUM(pc.c_cartons * pc.carton_geometric_liters) / v.packing_efficiency, 1) AS packed_liters,
       ROUND(SUM(pc.q_bundles::NUMERIC / pc.bundles_per_master_carton
                 * pc.carton_geometric_liters) / v.packing_efficiency, 1) AS packed_liters_shared,
       v.max_cargo_liters,
       (SUM(pc.c_cartons * pc.carton_geometric_liters) / v.packing_efficiency) <= v.max_cargo_liters AS fits
FROM per_cluster pc
JOIN route_batches b ON b.id = pc.route_batch_id
JOIN vehicles v      ON v.id = b.vehicle_id
GROUP BY pc.route_batch_id, pc.trip_number, v.max_cargo_liters, v.packing_efficiency;

-- ─── Three margin figures ──────────────────────────────────────────────────
-- Forecast GP is the cutoff snapshot on Ordered Bundles. Realized GP is
-- revenue minus the ledger cost of the Bundles that actually moved, which is
-- what keeps the reconciliation identity solvable when costs change.
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
                  ELSE 0 END)::NUMERIC(12,2) AS collected_myr
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
       b.runner_cost_myr
FROM route_batches b
LEFT JOIN revenue r        ON r.route_batch_id = b.id
LEFT JOIN delivered_cost d ON d.route_batch_id = b.id;
