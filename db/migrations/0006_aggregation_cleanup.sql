-- 0006_aggregation_cleanup.sql — compute the cartons needed once per row.

CREATE OR REPLACE VIEW v_route_batch_aggregation AS
WITH ordered AS (
  SELECT o.route_batch_id, o.sku_code, SUM(o.ordered_bundles)::INT AS q_ordered
  FROM stall_orders o
  WHERE o.order_type = 'PREORDER'
  GROUP BY o.route_batch_id, o.sku_code
),
plan AS (
  SELECT b.id AS route_batch_id,
         sk.sku_code,
         COALESCE(o.q_ordered, 0) AS q_ordered,
         bb.opening_bundles,
         sk.physical_boxes_per_carton,
         sk.carton_geometric_liters,
         rbp.locked_carton_cost,
         rbp.locked_pool_bundle_price,
         CASE
           WHEN COALESCE(o.q_ordered, 0) - bb.opening_bundles <= 0 THEN 0
           ELSE CEIL((COALESCE(o.q_ordered, 0) - bb.opening_bundles)::NUMERIC
                     / sk.bundles_per_master_carton)::INT
         END AS c_cartons
  FROM route_batches b
  JOIN v_batch_buffer bb ON bb.route_batch_id = b.id
  JOIN skus sk           ON sk.sku_code = bb.sku_code
  LEFT JOIN ordered o    ON o.route_batch_id = b.id AND o.sku_code = sk.sku_code
  LEFT JOIN route_batch_prices rbp
         ON rbp.route_batch_id = b.id AND rbp.sku_code = sk.sku_code
)
SELECT route_batch_id,
       sku_code,
       q_ordered,
       opening_bundles AS s_prev,
       c_cartons,
       c_cartons * physical_boxes_per_carton AS physical_boxes,
       c_cartons::NUMERIC * carton_geometric_liters AS geometric_liters,
       locked_carton_cost,
       locked_pool_bundle_price
FROM plan;
