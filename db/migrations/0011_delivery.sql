-- 0011_delivery.sql — one handover per Stall per Route Batch.
--
-- The handover is the only path that writes Delivered Bundles. It locks the
-- batch and the SKU balances, refuses overdraw, writes the signed movements,
-- records the payment attestation and queues exactly one receipt in the same
-- transaction. A retry with the same counts is a no-op; a different count or
-- attestation is refused, because changing a handover is a correction (#14),
-- not a second delivery.

-- ─── The handover event, one per Stall order book ─────────────────────────
CREATE TABLE stall_handovers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_batch_id      UUID NOT NULL REFERENCES route_batches(id) ON DELETE RESTRICT,
  stall_id            UUID NOT NULL REFERENCES stalls(id) ON DELETE RESTRICT,
  -- PREORDER now; a Spot Sale can own its own event without sharing this key.
  handover_type       VARCHAR(12) NOT NULL DEFAULT 'PREORDER'
                        CHECK (handover_type IN ('PREORDER','SPOT')),
  dedupe_key          VARCHAR(160) NOT NULL UNIQUE,
  total_myr           NUMERIC(12,2) NOT NULL CHECK (total_myr >= 0),
  payment_status      VARCHAR(16) NOT NULL
                        CHECK (payment_status IN ('UNPAID','PAID_CASH','PAID_DUITNOW')),
  payment_reference   VARCHAR(80),
  payment_proof_url   TEXT,
  attested_at         TIMESTAMPTZ NOT NULL,
  attested_by         UUID,
  -- NULL when the Stall has no phone: the row is the internal audit result
  -- and no WhatsApp receipt exists (ADR-0012, ADR-0013).
  outbound_message_id UUID UNIQUE REFERENCES outbound_messages(id) ON DELETE RESTRICT,
  handed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (payment_status <> 'PAID_DUITNOW'
         OR (payment_reference IS NOT NULL AND payment_proof_url IS NOT NULL))
);

CREATE UNIQUE INDEX uq_stall_handover_preorder
  ON stall_handovers (route_batch_id, stall_id)
  WHERE handover_type = 'PREORDER';

CREATE INDEX idx_stall_handovers_batch_stall
  ON stall_handovers (route_batch_id, stall_id);

-- ─── The immutable line snapshot behind the total and the receipt ─────────
-- Delivered Bundles and the locked price are copied at handover time, so the
-- receipt and the audit trail survive a later audited correction.
CREATE TABLE stall_handover_lines (
  handover_id       UUID NOT NULL REFERENCES stall_handovers(id) ON DELETE CASCADE,
  stall_order_id    UUID NOT NULL UNIQUE REFERENCES stall_orders(id) ON DELETE RESTRICT,
  delivered_bundles INT NOT NULL CHECK (delivered_bundles >= 0),
  unit_price_locked NUMERIC(10,2) NOT NULL CHECK (unit_price_locked > 0),
  PRIMARY KEY (handover_id, stall_order_id)
);

CREATE TRIGGER stall_handovers_no_update
  BEFORE UPDATE ON stall_handovers
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER stall_handovers_no_delete
  BEFORE DELETE ON stall_handovers
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER stall_handover_lines_no_update
  BEFORE UPDATE ON stall_handover_lines
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER stall_handover_lines_no_delete
  BEFORE DELETE ON stall_handover_lines
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

-- ─── Record one Stall handover and queue its receipt ──────────────────────
-- p_lines is a JSON array of {stallOrderId, deliveredBundles}; it must list
-- every Preorder line for the Stall exactly once. The operation is atomic:
-- a refusal anywhere leaves no order, movement or message behind.
CREATE OR REPLACE FUNCTION fn_record_stall_handover(
  p_route_batch_id   UUID,
  p_stall_id         UUID,
  p_lines            JSONB,
  p_payment_status   VARCHAR(16),
  p_payment_reference VARCHAR(80) DEFAULT NULL,
  p_payment_proof_url TEXT DEFAULT NULL,
  p_attested_by      UUID DEFAULT NULL,
  p_handed_at        TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (handover_id UUID, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_batch            RECORD;
  v_stall            RECORD;
  v_payment_status   VARCHAR(16);
  v_key              VARCHAR(160);
  v_existing_id      UUID;
  v_existing         RECORD;
  v_line             RECORD;
  v_on_hand          INT;
  v_total            NUMERIC(12,2);
  v_written          INT;
  v_receipt_lines    TEXT;
  v_payment_label    TEXT;
  v_body             TEXT;
  v_outbound_id      UUID;
  v_handover_id      UUID;
BEGIN
  p_handed_at := COALESCE(p_handed_at, NOW());

  SELECT * INTO v_batch
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT st.*
    INTO v_stall
    FROM stalls st
    JOIN clusters c ON c.id = st.cluster_id
   WHERE st.id = p_stall_id
     AND c.route_id = v_batch.route_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stall % does not belong to this Route Batch', p_stall_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Payment attestation ────────────────────────────────────────────────
  v_payment_status := upper(btrim(COALESCE(p_payment_status, '')));
  IF v_payment_status NOT IN ('UNPAID','PAID_CASH','PAID_DUITNOW') THEN
    RAISE EXCEPTION 'payment must be UNPAID, PAID_CASH or PAID_DUITNOW; VOIDED is a correction'
      USING ERRCODE = 'check_violation';
  END IF;
  p_payment_reference := NULLIF(btrim(p_payment_reference), '');
  p_payment_proof_url := NULLIF(btrim(p_payment_proof_url), '');
  IF v_payment_status = 'PAID_DUITNOW'
     AND (p_payment_reference IS NULL OR p_payment_proof_url IS NULL) THEN
    RAISE EXCEPTION 'PAID_DUITNOW requires both a payment reference and a proof link'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_attested_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM runner_sessions rs
     WHERE rs.id = p_attested_by
       AND rs.route_batch_id = p_route_batch_id
  ) THEN
    RAISE EXCEPTION 'the attesting Runner session is not assigned to this Route Batch'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Shape and completeness of the delivered lines ──────────────────────
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'the handover must be a JSON array of delivered lines'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) x
     WHERE jsonb_typeof(x) <> 'object'
        OR (x->>'stallOrderId') IS NULL
        OR (x->>'stallOrderId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (x->>'deliveredBundles') IS NULL
        OR (x->>'deliveredBundles') !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'the handover contains an unknown or incomplete delivered line'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) x
     GROUP BY x->>'stallOrderId'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'the handover lists an order more than once'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (
    SELECT COUNT(*)
      FROM stall_orders o
     WHERE o.route_batch_id = p_route_batch_id
       AND o.stall_id = p_stall_id
       AND o.order_type = 'PREORDER'
  ) = 0 THEN
    RAISE EXCEPTION 'this Stall has no Preorder to hand over'
      USING ERRCODE = 'check_violation';
  END IF;

  IF jsonb_array_length(p_lines) <> (
    SELECT COUNT(*)
      FROM stall_orders o
     WHERE o.route_batch_id = p_route_batch_id
       AND o.stall_id = p_stall_id
       AND o.order_type = 'PREORDER'
  ) THEN
    RAISE EXCEPTION 'the handover must list every Preorder line for this Stall exactly once'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_lines)
             AS x("stallOrderId" UUID, "deliveredBundles" INT)
      LEFT JOIN stall_orders o ON o.id = x."stallOrderId"
     WHERE o.id IS NULL
        OR o.route_batch_id <> p_route_batch_id
        OR o.stall_id <> p_stall_id
        OR o.order_type <> 'PREORDER'
        OR x."deliveredBundles" > o.ordered_bundles
  ) THEN
    RAISE EXCEPTION 'the handover contains an order that is not a Preorder for this Stall, or delivers more than ordered'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Retry of an already-recorded handover ──────────────────────────────
  v_key := format('PREORDER:%s:%s', p_route_batch_id, p_stall_id);
  SELECT h.id INTO v_existing_id
    FROM stall_handovers h
   WHERE h.dedupe_key = v_key;

  IF v_existing_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM stall_handovers h
     WHERE h.id = v_existing_id;

    IF v_existing.payment_status IS DISTINCT FROM v_payment_status
       OR v_existing.payment_reference IS DISTINCT FROM p_payment_reference
       OR v_existing.payment_proof_url IS DISTINCT FROM p_payment_proof_url THEN
      RAISE EXCEPTION 'the handover is already recorded with a different payment attestation; use an audited correction'
        USING ERRCODE = 'check_violation';
    END IF;

    IF (SELECT COUNT(*) FROM stall_handover_lines l WHERE l.handover_id = v_existing_id)
       <> jsonb_array_length(p_lines) THEN
      RAISE EXCEPTION 'the handover is already recorded with a different set of delivered lines; use an audited correction'
        USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM jsonb_to_recordset(p_lines)
               AS x("stallOrderId" UUID, "deliveredBundles" INT)
        LEFT JOIN stall_handover_lines l
          ON l.handover_id = v_existing_id
         AND l.stall_order_id = x."stallOrderId"
       WHERE l.stall_order_id IS NULL
          OR l.delivered_bundles IS DISTINCT FROM x."deliveredBundles"
    ) THEN
      RAISE EXCEPTION 'the handover is already recorded with different delivered Bundles; use an audited correction'
        USING ERRCODE = 'check_violation';
    END IF;

    handover_id := v_existing_id;
    created := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── First handover: the goods must be on the Vehicle ───────────────────
  IF v_batch.status <> 'GOODS_RECEIVED' THEN
    RAISE EXCEPTION 'Route Batch is % and cannot record a handover', v_batch.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM stall_orders o
     WHERE o.route_batch_id = p_route_batch_id
       AND o.stall_id = p_stall_id
       AND o.order_type = 'PREORDER'
       AND o.fulfilment_status <> 'PENDING'
  ) THEN
    RAISE EXCEPTION 'this Stall already has recorded deliveries; use an audited correction'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_line IN
    SELECT x."stallOrderId" AS stall_order_id,
           x."deliveredBundles" AS delivered_bundles,
           o.sku_code
      FROM jsonb_to_recordset(p_lines)
             AS x("stallOrderId" UUID, "deliveredBundles" INT)
      JOIN stall_orders o ON o.id = x."stallOrderId"
     ORDER BY o.sku_code
  LOOP
    IF v_line.delivered_bundles > 0 THEN
      PERFORM 1
        FROM stock_movements m
       WHERE m.sku_code = v_line.sku_code
         AND m.vehicle_id = v_batch.vehicle_id
       FOR UPDATE;

      SELECT COALESCE(SUM(m.quantity_bundles), 0)
        INTO v_on_hand
        FROM stock_movements m
       WHERE m.sku_code = v_line.sku_code
         AND m.vehicle_id = v_batch.vehicle_id;

      IF v_on_hand < v_line.delivered_bundles THEN
        RAISE EXCEPTION 'cannot deliver % Bundles of %: only % on hand in the Vehicle',
          v_line.delivered_bundles, v_line.sku_code, v_on_hand
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(x."deliveredBundles" * o.unit_price_locked), 0)::NUMERIC(12,2)
    INTO v_total
    FROM jsonb_to_recordset(p_lines)
           AS x("stallOrderId" UUID, "deliveredBundles" INT)
    JOIN stall_orders o ON o.id = x."stallOrderId";

  -- ── Build the receipt before inserting, so one transaction owns it ─────
  IF v_stall.whatsapp_phone IS NOT NULL THEN
    SELECT string_agg(
             format('%s × %s = RM %s',
                    o.sku_code,
                    x."deliveredBundles",
                    to_char(x."deliveredBundles" * o.unit_price_locked,
                            'FM9999990.00')),
             E'\n' ORDER BY o.sku_code)
      INTO v_receipt_lines
      FROM jsonb_to_recordset(p_lines)
             AS x("stallOrderId" UUID, "deliveredBundles" INT)
      JOIN stall_orders o ON o.id = x."stallOrderId"
     WHERE x."deliveredBundles" > 0;

    v_payment_label := CASE v_payment_status
      WHEN 'PAID_CASH' THEN 'TUNAI'
      WHEN 'PAID_DUITNOW' THEN format('DUITNOW (%s)', p_payment_reference)
      ELSE 'BELUM DIBAYAR'
    END;

    v_body := format($receipt$
🧾 SARPPLY — RESIT SERAHAN
%s · %s · %s

%s

TOTAL: RM %s
Bayaran: %s
$receipt$,
      v_stall.stall_code,
      v_stall.stall_name,
      to_char(p_handed_at AT TIME ZONE 'Asia/Kuching', 'DD Mon YYYY'),
      COALESCE(v_receipt_lines, 'Tiada bundle dihantar.'),
      to_char(v_total, 'FM9999990.00'),
      v_payment_label);

    INSERT INTO outbound_messages
      (to_phone, body, status, dedupe_key, route_batch_id, stall_id)
    VALUES
      (v_stall.whatsapp_phone, v_body, 'QUEUED', format('handover:%s', v_key),
       p_route_batch_id, p_stall_id)
    RETURNING id INTO v_outbound_id;
  END IF;

  INSERT INTO stall_handovers
    (route_batch_id, stall_id, handover_type, dedupe_key, total_myr,
     payment_status, payment_reference, payment_proof_url, attested_at,
     attested_by, outbound_message_id, handed_at)
  VALUES
    (p_route_batch_id, p_stall_id, 'PREORDER', v_key, v_total,
     v_payment_status, p_payment_reference, p_payment_proof_url, p_handed_at,
     p_attested_by, v_outbound_id, p_handed_at)
  RETURNING id INTO v_handover_id;

  INSERT INTO stall_handover_lines
    (handover_id, stall_order_id, delivered_bundles, unit_price_locked)
  SELECT v_handover_id, o.id, x."deliveredBundles", o.unit_price_locked
    FROM jsonb_to_recordset(p_lines)
           AS x("stallOrderId" UUID, "deliveredBundles" INT)
    JOIN stall_orders o ON o.id = x."stallOrderId";

  UPDATE stall_orders o
     SET delivered_bundles = x."deliveredBundles",
         fulfilment_status = CASE
           WHEN x."deliveredBundles" = 0 THEN 'UNCOLLECTED'
           WHEN x."deliveredBundles" = o.ordered_bundles THEN 'DELIVERED'
           ELSE 'PARTIAL'
         END,
         payment_status = v_payment_status,
         payment_reference = p_payment_reference,
         payment_proof_url = p_payment_proof_url,
         payment_attested_at = p_handed_at,
         attested_by = p_attested_by,
         updated_at = p_handed_at
    FROM jsonb_to_recordset(p_lines)
           AS x("stallOrderId" UUID, "deliveredBundles" INT)
   WHERE o.id = x."stallOrderId";

  FOR v_line IN
    SELECT o.id AS stall_order_id,
           o.sku_code,
           x."deliveredBundles" AS delivered_bundles
      FROM jsonb_to_recordset(p_lines)
             AS x("stallOrderId" UUID, "deliveredBundles" INT)
      JOIN stall_orders o ON o.id = x."stallOrderId"
     ORDER BY o.sku_code
  LOOP
    IF v_line.delivered_bundles > 0 THEN
      v_written := fn_post_stock_movement(
        p_sku_code => v_line.sku_code,
        p_vehicle_id => v_batch.vehicle_id,
        p_quantity_bundles => -v_line.delivered_bundles,
        p_movement_type => 'DELIVERY',
        p_idempotency_key => format('HANDOVER:%s', v_line.stall_order_id),
        p_route_batch_id => p_route_batch_id,
        p_stall_order_id => v_line.stall_order_id,
        p_occurred_at => p_handed_at
      );
      IF v_written <> 1 THEN
        RAISE EXCEPTION 'stock was already posted for order %', v_line.stall_order_id
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;

  -- Every Preorder on the Route has now been handed over; the batch moves to
  -- DELIVERED and #11 can reconcile it.
  IF NOT EXISTS (
    SELECT 1
      FROM stall_orders o
     WHERE o.route_batch_id = p_route_batch_id
       AND o.order_type = 'PREORDER'
       AND o.fulfilment_status = 'PENDING'
  ) THEN
    UPDATE route_batches
       SET status = 'DELIVERED'
     WHERE id = p_route_batch_id;

    INSERT INTO route_batch_transitions
      (route_batch_id, transition_type, fired_at)
    VALUES
      (p_route_batch_id, 'DELIVERED', p_handed_at)
    ON CONFLICT (route_batch_id, transition_type) DO NOTHING;
  END IF;

  handover_id := v_handover_id;
  created := TRUE;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ─── Per-Stall totals, before and after handover ──────────────────────────
CREATE OR REPLACE VIEW v_stall_handover_total AS
SELECT o.route_batch_id,
       o.stall_id,
       SUM(o.ordered_bundles * o.unit_price_locked)::NUMERIC(12,2)
         AS ordered_total_myr,
       SUM(o.delivered_bundles * o.unit_price_locked)::NUMERIC(12,2)
         AS handed_over_total_myr
FROM stall_orders o
WHERE o.order_type = 'PREORDER'
GROUP BY o.route_batch_id, o.stall_id;

-- ─── The handover screen's read model ─────────────────────────────────────
CREATE OR REPLACE VIEW v_stall_handover AS
SELECT b.id AS route_batch_id,
       st.id AS stall_id,
       st.stall_code,
       st.stall_name,
       c.name AS cluster_name,
       st.whatsapp_phone IS NOT NULL AS has_phone,
       h.id AS handover_id,
       t.ordered_total_myr,
       t.handed_over_total_myr,
       h.total_myr AS recorded_total_myr,
       h.payment_status,
       h.payment_reference,
       h.payment_proof_url,
       h.attested_at,
       h.attested_by,
       rs.runner_identity,
       om.status AS receipt_status,
       om.failure_reason AS receipt_failure,
       om.body AS receipt_body,
       h.outbound_message_id,
       (h.id IS NULL) AS awaiting_handover
FROM route_batches b
JOIN v_stall_handover_total t ON t.route_batch_id = b.id
JOIN stalls st ON st.id = t.stall_id
JOIN clusters c ON c.id = st.cluster_id
LEFT JOIN stall_handovers h
  ON h.route_batch_id = b.id
 AND h.stall_id = st.id
 AND h.handover_type = 'PREORDER'
LEFT JOIN runner_sessions rs ON rs.id = h.attested_by
LEFT JOIN outbound_messages om ON om.id = h.outbound_message_id;

-- ─── Delivered unpaid goods are not collected cash ────────────────────────
-- The column is appended so the existing PnL columns keep their order.
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
       COALESCE(r.uncollected_goods_myr, 0)::NUMERIC(12,2) AS uncollected_goods_myr
FROM route_batches b
LEFT JOIN revenue r        ON r.route_batch_id = b.id
LEFT JOIN delivered_cost d ON d.route_batch_id = b.id;
