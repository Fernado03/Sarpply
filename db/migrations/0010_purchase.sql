-- 0010_purchase.sql — the purchase list, the Route-level carton plan and the
-- Sortie allocation that decides whether the Vehicle can carry the load.

-- ─── The purchase list, per SKU, at the frozen cost ────────────────────────
-- Ordered Bundles net of Buffer Stock (v_route_batch_aggregation already
-- does the netting), priced from the Cutoff snapshot, never the live price.
CREATE OR REPLACE VIEW v_purchase_plan AS
SELECT a.route_batch_id,
       a.sku_code,
       s.name_en,
       s.bundle_unit_name,
       s.bundles_per_master_carton,
       a.q_ordered AS ordered_bundles,
       a.s_prev    AS buffer_bundles,
       a.c_cartons AS cartons,
       a.physical_boxes,
       a.geometric_liters,
       a.locked_carton_cost,
       (a.c_cartons * a.locked_carton_cost)::NUMERIC(12,2) AS cash_myr
FROM v_route_batch_aggregation a
JOIN skus s ON s.sku_code = a.sku_code;

-- ─── Purchase list totals, so the console never re-adds money ──────────────
CREATE OR REPLACE VIEW v_purchase_plan_total AS
SELECT route_batch_id,
       COALESCE(SUM(cartons), 0)::INT AS cartons,
       COALESCE(SUM(physical_boxes), 0)::INT AS physical_boxes,
       COALESCE(SUM(geometric_liters), 0)::NUMERIC(12,2) AS geometric_liters,
       COALESCE(SUM(cash_myr), 0)::NUMERIC(12,2) AS cash_myr
FROM v_purchase_plan
GROUP BY route_batch_id;

-- ─── Carton allocation across Sorties ──────────────────────────────────────
-- Cartons are rounded ONCE at Route level (v_route_batch_aggregation), then
-- split across Sorties as whole cartons by largest remainder:
--
--   1. each Sortie takes FLOOR(cartons × its Ordered Bundles / Route demand);
--   2. the leftover cartons go one each to the Sorties with the largest
--      fractional remainder;
--   3. a remainder tie goes to the lower trip_number.
--
-- Whole cartons are never re-rounded per Sortie: rounding each trip
-- separately can invent a carton the Route does not buy and reject a load
-- that actually fits. A Sortie with no demand receives no cartons.
CREATE OR REPLACE VIEW v_sortie_carton_allocation AS
WITH demand AS (
  SELECT b.id AS route_batch_id,
         c.trip_number,
         o.sku_code,
         SUM(o.ordered_bundles)::INT AS q_bundles
  FROM route_batches b
  JOIN routes r   ON r.id = b.route_id
  JOIN clusters c ON c.route_id = r.id
  JOIN stalls st  ON st.cluster_id = c.id
  JOIN stall_orders o
    ON o.stall_id = st.id
   AND o.route_batch_id = b.id
   AND o.order_type = 'PREORDER'
  GROUP BY b.id, c.trip_number, o.sku_code
),
totals AS (
  SELECT route_batch_id, sku_code, SUM(q_bundles)::INT AS q_total
  FROM demand
  GROUP BY route_batch_id, sku_code
),
plan AS (
  SELECT route_batch_id, sku_code, c_cartons
  FROM v_route_batch_aggregation
  WHERE c_cartons > 0
),
shares AS (
  SELECT d.route_batch_id,
         d.sku_code,
         d.trip_number,
         p.c_cartons,
         d.q_bundles::NUMERIC * p.c_cartons / t.q_total AS share,
         FLOOR(d.q_bundles::NUMERIC * p.c_cartons / t.q_total)::INT AS base_cartons
  FROM demand d
  JOIN totals t
    ON t.route_batch_id = d.route_batch_id
   AND t.sku_code = d.sku_code
  JOIN plan p
    ON p.route_batch_id = d.route_batch_id
   AND p.sku_code = d.sku_code
),
ranked AS (
  SELECT s.route_batch_id,
         s.sku_code,
         s.trip_number,
         s.base_cartons,
         s.share - s.base_cartons AS remainder,
         s.c_cartons
           - SUM(s.base_cartons) OVER (PARTITION BY s.route_batch_id, s.sku_code)
           AS leftover,
         ROW_NUMBER() OVER (
           PARTITION BY s.route_batch_id, s.sku_code
           ORDER BY (s.share - s.base_cartons) DESC, s.trip_number
         ) AS remainder_rank
  FROM shares s
)
SELECT route_batch_id,
       sku_code,
       trip_number,
       (base_cartons
          + CASE WHEN remainder_rank <= leftover THEN 1 ELSE 0 END)::INT AS cartons
FROM ranked;

-- ─── Sortie volume check from the allocation ───────────────────────────────
-- Packed volume uses whole allocated cartons and the batch Vehicle's measured
-- packing efficiency. This replaces the per-Cluster rounding that could
-- reject a load that fits.
DROP VIEW IF EXISTS v_sortie_load;

CREATE VIEW v_sortie_load AS
WITH per_sortie AS (
  SELECT a.route_batch_id,
         a.trip_number,
         SUM(a.cartons)::INT AS cartons,
         SUM(a.cartons * s.carton_geometric_liters)::NUMERIC AS geometric_liters
  FROM v_sortie_carton_allocation a
  JOIN skus s ON s.sku_code = a.sku_code
  GROUP BY a.route_batch_id, a.trip_number
)
SELECT p.route_batch_id,
       p.trip_number,
       p.cartons,
       ROUND(p.geometric_liters / v.packing_efficiency, 1) AS packed_liters,
       v.max_cargo_liters,
       v.packing_efficiency,
       (p.geometric_liters / v.packing_efficiency) <= v.max_cargo_liters AS fits
FROM per_sortie p
JOIN route_batches b ON b.id = p.route_batch_id
JOIN vehicles v      ON v.id = b.vehicle_id;

-- ─── The batch records the Vehicle the Founder confirms ────────────────────
ALTER TABLE route_batches ADD COLUMN vehicle_confirmed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION fn_confirm_batch_vehicle(
  p_route_batch_id UUID,
  p_vehicle_id     UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_batch RECORD;
BEGIN
  SELECT * INTO v_batch
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_batch.status = 'OPEN_FOR_ORDERS' THEN
    RAISE EXCEPTION 'confirm the Vehicle after Cutoff'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.status <> 'CLOSED_AT_CUTOFF' THEN
    RAISE EXCEPTION 'the Vehicle is fixed once the Wholesaler PO is submitted'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.vehicle_confirmed_at IS NOT NULL THEN
    IF v_batch.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
      RAISE EXCEPTION 'the Vehicle is already confirmed for this Route Batch'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vehicles WHERE id = p_vehicle_id) THEN
    RAISE EXCEPTION 'unknown Vehicle %', p_vehicle_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE route_batches
     SET vehicle_id = p_vehicle_id,
         vehicle_confirmed_at = NOW()
   WHERE id = p_route_batch_id;
END;
$$;

-- ─── A PO line may only carry the Cutoff snapshot's carton cost ────────────
CREATE OR REPLACE FUNCTION assert_po_line_frozen_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_batch UUID;
  v_cost  NUMERIC(10,2);
BEGIN
  SELECT route_batch_id INTO v_batch
    FROM wholesaler_pos
   WHERE id = NEW.po_id;

  SELECT locked_carton_cost INTO v_cost
    FROM route_batch_prices
   WHERE route_batch_id = v_batch
     AND sku_code = NEW.sku_code;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'no frozen carton cost for SKU % on this Route Batch', NEW.sku_code
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.carton_cost IS DISTINCT FROM v_cost THEN
    RAISE EXCEPTION 'Wholesaler PO lines must use the frozen carton cost %, not %',
      v_cost, NEW.carton_cost
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER wholesaler_po_lines_frozen_cost
  BEFORE INSERT OR UPDATE ON wholesaler_po_lines
  FOR EACH ROW EXECUTE FUNCTION assert_po_line_frozen_cost();

-- ─── Raise the one Wholesaler PO for the Route Batch ───────────────────────
-- Refuses an open book, an unconfirmed Vehicle, a PO inside the Cutoff gap, a
-- Sortie the Vehicle cannot carry and an empty plan. Retrying returns the
-- same PO instead of raising a second one.
CREATE OR REPLACE FUNCTION fn_submit_wholesaler_po(
  p_route_batch_id UUID,
  p_wholesaler_id  UUID,
  p_now            TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_batch       RECORD;
  v_po          UUID;
  v_wholesaler  UUID;
  v_bad         RECORD;
  v_lines       INT;
  v_quoted_by   VARCHAR(120);
BEGIN
  SELECT * INTO v_batch
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id, wholesaler_id INTO v_po, v_wholesaler
    FROM wholesaler_pos
   WHERE route_batch_id = p_route_batch_id;
  IF FOUND THEN
    IF v_wholesaler IS DISTINCT FROM p_wholesaler_id THEN
      RAISE EXCEPTION 'this Route Batch already has a Wholesaler PO from another Wholesaler'
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN v_po;
  END IF;

  IF v_batch.status = 'OPEN_FOR_ORDERS' THEN
    RAISE EXCEPTION 'Cutoff has not fired; the Wholesaler PO cannot be raised'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.status <> 'CLOSED_AT_CUTOFF' THEN
    RAISE EXCEPTION 'Route Batch is % and cannot take a Wholesaler PO', v_batch.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_batch.vehicle_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'confirm the Vehicle before submitting the Wholesaler PO'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_now < fn_po_not_before(p_route_batch_id) THEN
    RAISE EXCEPTION 'Wholesaler PO may not be submitted before %',
      fn_po_not_before(p_route_batch_id)
      USING ERRCODE = 'check_violation';
  END IF;

  -- The frozen costs name their Wholesaler (ADR-0008). A PO cannot select a
  -- different supplier and keep those prices.
  SELECT w.name INTO v_quoted_by
    FROM v_purchase_plan p
    JOIN route_batch_prices rbp
      ON rbp.route_batch_id = p.route_batch_id
     AND rbp.sku_code = p.sku_code
    JOIN wholesaler_prices wp ON wp.id = rbp.wholesaler_price_id
    JOIN wholesalers w ON w.id = wp.wholesaler_id
   WHERE p.route_batch_id = p_route_batch_id
     AND p.cartons > 0
     AND wp.wholesaler_id <> p_wholesaler_id
   ORDER BY w.name
   LIMIT 1;
  IF v_quoted_by IS NOT NULL THEN
    RAISE EXCEPTION 'the frozen prices for this Route Batch were quoted by %, not the selected Wholesaler',
      v_quoted_by
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_bad
    FROM v_sortie_load
   WHERE route_batch_id = p_route_batch_id
     AND NOT fits
   ORDER BY trip_number
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Sortie % needs % L, exceeding the Vehicle''s % L capacity',
      v_bad.trip_number, v_bad.packed_liters, v_bad.max_cargo_liters
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_lines
    FROM v_purchase_plan
   WHERE route_batch_id = p_route_batch_id
     AND cartons > 0;
  IF v_lines = 0 THEN
    RAISE EXCEPTION 'there are no Master Cartons to order for this Route Batch'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO wholesaler_pos (route_batch_id, wholesaler_id, submitted_at)
  VALUES (p_route_batch_id, p_wholesaler_id, p_now)
  RETURNING id INTO v_po;

  INSERT INTO wholesaler_po_lines (po_id, sku_code, cartons_ordered, carton_cost)
  SELECT v_po, sku_code, cartons, locked_carton_cost
  FROM v_purchase_plan
  WHERE route_batch_id = p_route_batch_id
    AND cartons > 0;

  UPDATE route_batches
     SET status = 'PO_SUBMITTED'
   WHERE id = p_route_batch_id;

  INSERT INTO route_batch_transitions (route_batch_id, transition_type, fired_at)
  VALUES (p_route_batch_id, 'PO_SUBMITTED', p_now)
  ON CONFLICT (route_batch_id, transition_type) DO NOTHING;

  RETURN v_po;
END;
$$;

-- ─── Record what actually arrived at the loading bay ───────────────────────
-- One operation: writes every PO line, derives cash from cartons received,
-- records the received time on the PO and posts one immutable receipt
-- movement per line at the invoice cost per Bundle (ADR-0018). A retry with
-- the same counts returns 0 and writes nothing; a different count is refused.
CREATE OR REPLACE FUNCTION fn_receive_po(
  p_po          UUID,
  p_lines       JSONB,
  p_received_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_batch_id     UUID;
  v_received_at  TIMESTAMPTZ;
  v_status       VARCHAR(24);
  v_vehicle_id   UUID;
  v_vehicle_confirmed_at TIMESTAMPTZ;
  v_supplied     INT;
  v_po_lines     INT;
  v_line         RECORD;
  v_written      INT := 0;
BEGIN
  SELECT p.route_batch_id, p.received_at
    INTO v_batch_id, v_received_at
    FROM wholesaler_pos p
   WHERE p.id = p_po
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Wholesaler PO %', p_po
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT b.status, b.vehicle_id, b.vehicle_confirmed_at
    INTO v_status, v_vehicle_id, v_vehicle_confirmed_at
    FROM route_batches b
   WHERE b.id = v_batch_id
     FOR UPDATE;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'the receipt must be a JSON array of PO lines'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_supplied
    FROM jsonb_array_elements(p_lines) x;
  SELECT COUNT(*) INTO v_po_lines
    FROM wholesaler_po_lines l
   WHERE l.po_id = p_po;

  IF v_supplied <> v_po_lines THEN
    RAISE EXCEPTION 'the receipt must list every PO line exactly once'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) x
     WHERE jsonb_typeof(x) <> 'object'
        OR (x->>'skuCode') IS NULL
        OR (x->>'cartonsReceived') IS NULL
        OR (x->>'cartonsReceived') !~ '^[0-9]+$'
        OR NOT EXISTS (
             SELECT 1
               FROM wholesaler_po_lines l
              WHERE l.po_id = p_po
                AND l.sku_code = x->>'skuCode'
           )
  ) THEN
    RAISE EXCEPTION 'the receipt contains an unknown or incomplete PO line'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) x
     GROUP BY x->>'skuCode'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'the receipt lists a SKU more than once'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) x
      JOIN wholesaler_po_lines l
        ON l.po_id = p_po
       AND l.sku_code = x->>'skuCode'
     WHERE (x->>'cartonsReceived')::INT > l.cartons_ordered
  ) THEN
    RAISE EXCEPTION 'received cartons cannot exceed cartons ordered'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_received_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM wholesaler_po_lines l
        LEFT JOIN (
          SELECT x->>'skuCode' AS sku_code,
                 (x->>'cartonsReceived')::INT AS cartons
            FROM jsonb_array_elements(p_lines) x
        ) r ON r.sku_code = l.sku_code
       WHERE l.po_id = p_po
         AND (r.sku_code IS NULL OR r.cartons IS DISTINCT FROM l.cartons_received)
    ) THEN
      RAISE EXCEPTION 'the Wholesaler PO receipt is immutable; received cartons cannot change'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN 0;
  END IF;

  IF v_status <> 'PO_SUBMITTED' THEN
    RAISE EXCEPTION 'Route Batch is % and cannot receive goods', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_vehicle_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'confirm the Vehicle before receiving cartons'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE wholesaler_po_lines l
     SET cartons_received = r.cartons
    FROM (
      SELECT x->>'skuCode' AS sku_code,
             (x->>'cartonsReceived')::INT AS cartons
        FROM jsonb_array_elements(p_lines) x
    ) r
   WHERE l.po_id = p_po
     AND l.sku_code = r.sku_code;

  UPDATE wholesaler_pos
     SET received_at = p_received_at,
         cash_required_myr = (
           SELECT SUM(COALESCE(l.cartons_received, 0) * l.carton_cost)
             FROM wholesaler_po_lines l
            WHERE l.po_id = p_po
         )::NUMERIC(12,2)
   WHERE id = p_po;

  FOR v_line IN
    SELECT l.sku_code,
           l.cartons_received,
           l.carton_cost,
           sk.bundles_per_master_carton
      FROM wholesaler_po_lines l
      JOIN skus sk ON sk.sku_code = l.sku_code
     WHERE l.po_id = p_po
       AND l.cartons_received > 0
     ORDER BY l.sku_code
  LOOP
    v_written := v_written + fn_post_stock_movement(
      p_sku_code => v_line.sku_code,
      p_vehicle_id => v_vehicle_id,
      p_quantity_bundles => v_line.cartons_received * v_line.bundles_per_master_carton,
      p_movement_type => 'PURCHASE_RECEIPT',
      p_idempotency_key => format('PO:%s:%s', p_po, v_line.sku_code),
      p_unit_cost_myr => ROUND(
        v_line.carton_cost / v_line.bundles_per_master_carton, 6
      ),
      p_route_batch_id => v_batch_id,
      p_occurred_at => p_received_at
    );
  END LOOP;

  UPDATE route_batches
     SET status = 'GOODS_RECEIVED'
   WHERE id = v_batch_id;

  INSERT INTO route_batch_transitions (route_batch_id, transition_type, fired_at)
  VALUES (v_batch_id, 'GOODS_RECEIVED', p_received_at)
  ON CONFLICT (route_batch_id, transition_type) DO NOTHING;

  RETURN v_written;
END;
$$;
