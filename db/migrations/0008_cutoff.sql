-- 0008_cutoff.sql — Cutoff freezes the week exactly once (ADR-0002, ADR-0005).
--
-- One dispatcher, polling at most every 15 minutes, asks for due Cutoffs. The
-- firing writes the price snapshot, reprices every Preorder from it, closes
-- the order book and records one transition. The batch row lock plus the
-- transition's UNIQUE key make a retry a no-op rather than a second pricing.

-- ─── Dispatcher policy: interval ≤ 15 min, Cutoff-to-PO gap ≥ 30 min ──────
CREATE TABLE dispatch_policy (
  singleton             BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  poll_interval_minutes SMALLINT NOT NULL DEFAULT 15
                          CHECK (poll_interval_minutes BETWEEN 1 AND 15),
  cutoff_to_po_minutes  SMALLINT NOT NULL DEFAULT 30
                          CHECK (cutoff_to_po_minutes >= 30)
);

INSERT INTO dispatch_policy DEFAULT VALUES;

-- ─── Freeze one Route Batch ────────────────────────────────────────────────
-- The price is the row whose validity window contains the cutoff INSTANT —
-- not the row that happens to be open when the dispatcher gets around to it.
-- Validity windows are calendar dates in Asia/Kuching.
CREATE OR REPLACE FUNCTION fn_freeze_prices(
  p_route_batch_id UUID,
  p_now            TIMESTAMPTZ DEFAULT NOW()
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_batch       RECORD;
  v_cutoff_date DATE;
  v_unpriced    VARCHAR(10);
  v_inserted    INT := 0;
BEGIN
  SELECT * INTO v_batch
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_batch.status <> 'OPEN_FOR_ORDERS' THEN
    RAISE EXCEPTION 'Route Batch is not open; Cutoff has already fired'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_now < v_batch.cutoff_at THEN
    RAISE EXCEPTION 'Route Batch Cutoff is not due until %', v_batch.cutoff_at
      USING ERRCODE = 'check_violation';
  END IF;

  v_cutoff_date := (v_batch.cutoff_at AT TIME ZONE 'Asia/Kuching')::DATE;

  INSERT INTO route_batch_prices
    (route_batch_id, sku_code, wholesaler_price_id,
     locked_carton_cost, locked_pool_bundle_price)
  SELECT p_route_batch_id, pp.sku_code, wp.id, wp.carton_cost, pp.pool_bundle_price
  FROM (
    SELECT DISTINCT ON (pool.sku_code)
           pool.sku_code, pool.pool_bundle_price
    FROM pool_prices pool
    WHERE pool.valid_from <= v_cutoff_date
      AND (pool.valid_to IS NULL OR pool.valid_to >= v_cutoff_date)
    ORDER BY pool.sku_code, pool.valid_from DESC, pool.id
  ) pp
  JOIN LATERAL (
    SELECT price.id, price.carton_cost
    FROM wholesaler_prices price
    WHERE price.sku_code = pp.sku_code
      AND price.valid_from <= v_cutoff_date
      AND (price.valid_to IS NULL OR price.valid_to >= v_cutoff_date)
    ORDER BY price.is_primary DESC, price.valid_from DESC, price.id
    LIMIT 1
  ) wp ON TRUE
  JOIN skus sk ON sk.sku_code = pp.sku_code AND sk.is_active
  ON CONFLICT (route_batch_id, sku_code) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- An ordered SKU with no price in force would leave a Preorder unpriced and
  -- a margin uncomputable; fail closed instead of freezing a partial book.
  SELECT o.sku_code INTO v_unpriced
    FROM stall_orders o
   WHERE o.route_batch_id = p_route_batch_id
     AND o.order_type = 'PREORDER'
     AND NOT EXISTS (
       SELECT 1
         FROM route_batch_prices rbp
        WHERE rbp.route_batch_id = p_route_batch_id
          AND rbp.sku_code = o.sku_code
     )
   ORDER BY o.sku_code
   LIMIT 1;
  IF v_unpriced IS NOT NULL THEN
    RAISE EXCEPTION 'no price is in force for SKU % at the Cutoff instant', v_unpriced
      USING ERRCODE = 'check_violation';
  END IF;

  -- The batch is still OPEN here, so the freeze trigger permits the reprice.
  UPDATE stall_orders o
     SET unit_price_locked = rbp.locked_pool_bundle_price,
         updated_at = NOW()
    FROM route_batch_prices rbp
   WHERE o.route_batch_id = p_route_batch_id
     AND o.sku_code = rbp.sku_code
     AND o.order_type = 'PREORDER'
     AND o.unit_price_locked IS DISTINCT FROM rbp.locked_pool_bundle_price;

  UPDATE route_batches
     SET status = 'CLOSED_AT_CUTOFF'
   WHERE id = p_route_batch_id;

  INSERT INTO route_batch_transitions
    (route_batch_id, transition_type, fired_at)
  VALUES
    (p_route_batch_id, 'CUTOFF_FIRED', p_now)
  ON CONFLICT (route_batch_id, transition_type) DO NOTHING;

  RETURN v_inserted;
END;
$$;

-- ─── Fire every Cutoff that is due ────────────────────────────────────────
-- SKIP LOCKED lets a second dispatcher pass over a batch already being
-- frozen. Each returned row is one firing; a retry finds none.
CREATE OR REPLACE FUNCTION fn_fire_due_cutoffs(
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (route_batch_id UUID, fired_at TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT b.id
      FROM route_batches b
     WHERE b.status = 'OPEN_FOR_ORDERS'
       AND b.cutoff_at <= p_now
     ORDER BY b.cutoff_at, b.id
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM fn_freeze_prices(v_id, p_now);
    route_batch_id := v_id;
    fired_at := p_now;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ─── Ordered Bundles and their locked price stop moving after Cutoff ──────
-- The snapshot is already append-only (0003). This covers the other half:
-- the order book itself. A Spot Sale is a new row, never a Preorder edit
-- (ADR-0002).
CREATE OR REPLACE FUNCTION reject_frozen_preorder_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_status VARCHAR(24);
BEGIN
  IF OLD.order_type <> 'PREORDER' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT b.status INTO v_status
    FROM route_batches b
   WHERE b.id = OLD.route_batch_id;

  -- The parent is already gone when this delete is the CASCADE of a batch
  -- delete; the batch itself is the thing being removed, not an order edit.
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_status IS DISTINCT FROM 'OPEN_FOR_ORDERS' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Ordered Bundles are frozen at Cutoff; a Preorder cannot be deleted'
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.ordered_bundles IS DISTINCT FROM OLD.ordered_bundles
       OR NEW.unit_price_locked IS DISTINCT FROM OLD.unit_price_locked THEN
      RAISE EXCEPTION 'Ordered Bundles and their locked unit price are frozen at Cutoff'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stall_orders_no_frozen_update
  BEFORE UPDATE ON stall_orders
  FOR EACH ROW EXECUTE FUNCTION reject_frozen_preorder_mutation();

CREATE TRIGGER stall_orders_no_frozen_delete
  BEFORE DELETE ON stall_orders
  FOR EACH ROW EXECUTE FUNCTION reject_frozen_preorder_mutation();

-- ─── Who did not order before the book locked ─────────────────────────────
CREATE OR REPLACE VIEW v_batch_missing_preorders AS
SELECT b.id       AS route_batch_id,
       st.id      AS stall_id,
       st.stall_code,
       st.stall_name,
       c.name     AS cluster_name
FROM route_batches b
JOIN routes r   ON r.id = b.route_id
JOIN clusters c ON c.route_id = r.id
JOIN stalls st  ON st.cluster_id = c.id
WHERE st.onboarding_status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1
      FROM stall_orders o
     WHERE o.route_batch_id = b.id
       AND o.stall_id = st.id
       AND o.order_type = 'PREORDER'
  );
