-- 0012_spot_sales.sql — a walk-up sale is its own order, never an edit of a
-- Preorder (ADR-0002, ADR-0013).
--
-- The Runner supplies an event key. One call creates at most one Provisional
-- Stall, one SPOT order, one SPOT_SALE movement and one audit handover; a
-- retry with the same key returns the original sale. A phone-less Stall gets
-- no receipt echo, so the handover row is the internal audit result ADR-0012
-- accepts as the residual gap.

CREATE SEQUENCE spot_stall_code_seq;

-- ─── One retry-safe walk-up sale ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_spot_sale(
  p_route_batch_id     UUID,
  p_event_key          VARCHAR(160),
  p_sku_code           VARCHAR(10),
  p_delivered_bundles  INT,
  p_payment_status     VARCHAR(16),
  p_payment_reference  VARCHAR(80) DEFAULT NULL,
  p_payment_proof_url  TEXT DEFAULT NULL,
  p_attested_by        UUID DEFAULT NULL,
  p_stall_id           UUID DEFAULT NULL,
  p_provisional_label  VARCHAR(120) DEFAULT NULL,
  p_handed_at          TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  stall_order_id      UUID,
  stall_id            UUID,
  handover_id         UUID,
  outbound_message_id UUID,
  created             BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
  v_batch          RECORD;
  v_stall          RECORD;
  v_existing       RECORD;
  v_payment_status VARCHAR(16);
  v_key            VARCHAR(160);
  v_label          VARCHAR(120);
  v_cluster_id     UUID;
  v_stall_code     VARCHAR(10);
  v_unit_price     NUMERIC(10,2);
  v_total          NUMERIC(12,2);
  v_on_hand        INT;
  v_order_id       UUID;
  v_handover_id    UUID;
  v_outbound_id    UUID;
  v_body           TEXT;
  v_written        INT;
BEGIN
  p_event_key := btrim(COALESCE(p_event_key, ''));
  IF p_event_key = '' THEN
    RAISE EXCEPTION 'a Spot Sale needs a caller-supplied event key'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_delivered_bundles IS NULL OR p_delivered_bundles < 1 THEN
    RAISE EXCEPTION 'a Spot Sale needs at least one delivered Bundle'
      USING ERRCODE = 'check_violation';
  END IF;

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

  -- Concurrent retries of the same key queue behind this lock; the second one
  -- then sees the handover the first one wrote.
  PERFORM pg_advisory_xact_lock(hashtext('SPOT:' || p_event_key));

  SELECT * INTO v_batch
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── A retry returns the original sale, never a second one ─────────────
  v_key := format('SPOT:%s', p_event_key);
  SELECT h.id            AS handover_id,
         h.route_batch_id,
         h.stall_id,
         h.total_myr,
         h.payment_status,
         h.payment_reference,
         h.payment_proof_url,
         h.attested_by,
         h.outbound_message_id,
         l.stall_order_id,
         l.delivered_bundles,
         o.sku_code
    INTO v_existing
    FROM stall_handovers h
    JOIN stall_handover_lines l ON l.handover_id = h.id
    JOIN stall_orders o ON o.id = l.stall_order_id
   WHERE h.dedupe_key = v_key;

  IF FOUND THEN
    IF v_existing.route_batch_id <> p_route_batch_id THEN
      RAISE EXCEPTION 'event key % belongs to a different Route Batch', p_event_key
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_existing.sku_code IS DISTINCT FROM p_sku_code
       OR v_existing.delivered_bundles IS DISTINCT FROM p_delivered_bundles
       OR v_existing.payment_status IS DISTINCT FROM v_payment_status
       OR v_existing.payment_reference IS DISTINCT FROM p_payment_reference
       OR v_existing.payment_proof_url IS DISTINCT FROM p_payment_proof_url
       OR (p_stall_id IS NOT NULL AND v_existing.stall_id <> p_stall_id)
       OR (p_attested_by IS NOT NULL
           AND v_existing.attested_by IS DISTINCT FROM p_attested_by) THEN
      RAISE EXCEPTION 'event key % is already recorded with a different sale; use an audited correction',
        p_event_key
        USING ERRCODE = 'check_violation';
    END IF;

    stall_order_id := v_existing.stall_order_id;
    stall_id := v_existing.stall_id;
    handover_id := v_existing.handover_id;
    outbound_message_id := v_existing.outbound_message_id;
    created := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_batch.status NOT IN ('GOODS_RECEIVED','DELIVERED') THEN
    RAISE EXCEPTION 'Route Batch is % and cannot record a Spot Sale', v_batch.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── The buyer: an existing Stall, or a new Provisional Stall ──────────
  IF p_stall_id IS NOT NULL AND btrim(COALESCE(p_provisional_label, '')) <> '' THEN
    RAISE EXCEPTION 'choose an existing Stall or a provisional label, not both'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_stall_id IS NOT NULL THEN
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
    IF v_stall.onboarding_status NOT IN ('ACTIVE','PROVISIONAL_SPOT')
       OR NOT v_stall.is_active THEN
      RAISE EXCEPTION 'Stall % is not active for a Spot Sale', v_stall.stall_code
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_stall.onboarding_status = 'ACTIVE' AND v_stall.whatsapp_phone IS NULL THEN
      RAISE EXCEPTION 'an active Stall without a phone cannot receive a Spot Sale'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_label := btrim(COALESCE(p_provisional_label, ''));
    IF v_label = '' THEN
      RAISE EXCEPTION 'a Spot Sale needs a Stall or a provisional label'
        USING ERRCODE = 'check_violation';
    END IF;
    IF char_length(v_label) > 120 THEN
      RAISE EXCEPTION 'the provisional label must be 120 characters or fewer'
        USING ERRCODE = 'check_violation';
    END IF;

    -- shortcut: a walk-up Stall attaches to the Route's first Cluster; add a
    -- Cluster choice when per-Cluster walk-up reporting exists.
    SELECT c.id INTO v_cluster_id
      FROM clusters c
     WHERE c.route_id = v_batch.route_id
     ORDER BY c.name, c.id
     LIMIT 1;
    IF v_cluster_id IS NULL THEN
      RAISE EXCEPTION 'Route has no Cluster to attach a Provisional Stall to'
        USING ERRCODE = 'check_violation';
    END IF;

    v_stall_code := 'SPOT-' || upper(lpad(to_hex(nextval('spot_stall_code_seq')), 5, '0'));
    INSERT INTO stalls
      (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
       written_language, trust_tier, onboarding_status)
    VALUES
      (v_stall_code, v_cluster_id, v_stall_code, v_label, NULL,
       'ms-MY', 'PROVISIONAL', 'PROVISIONAL_SPOT')
    RETURNING * INTO v_stall;
  END IF;

  -- ── The attesting Runner and the frozen price ─────────────────────────
  IF p_attested_by IS NULL THEN
    RAISE EXCEPTION 'a Spot Sale needs the attesting Runner session'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM runner_sessions rs
     WHERE rs.id = p_attested_by
       AND rs.route_batch_id = p_route_batch_id
  ) THEN
    RAISE EXCEPTION 'the attesting Runner session is not assigned to this Route Batch'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM runner_sessions rs
     WHERE rs.id = p_attested_by
       AND rs.expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'the attesting Runner session has expired'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT rbp.locked_pool_bundle_price INTO v_unit_price
    FROM route_batch_prices rbp
   WHERE rbp.route_batch_id = p_route_batch_id
     AND rbp.sku_code = p_sku_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no frozen price is in force for SKU % on this Route Batch', p_sku_code
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── The Vehicle must hold the goods being sold ────────────────────────
  PERFORM pg_advisory_xact_lock(
    hashtext(p_sku_code || ':' || v_batch.vehicle_id::text));
  PERFORM 1
    FROM stock_movements m
   WHERE m.sku_code = p_sku_code
     AND m.vehicle_id = v_batch.vehicle_id
   FOR UPDATE;
  SELECT COALESCE(SUM(m.quantity_bundles), 0)
    INTO v_on_hand
    FROM stock_movements m
   WHERE m.sku_code = p_sku_code
     AND m.vehicle_id = v_batch.vehicle_id;
  IF v_on_hand < p_delivered_bundles THEN
    RAISE EXCEPTION 'cannot sell % Bundles of %: only % on hand in the Vehicle',
      p_delivered_bundles, p_sku_code, v_on_hand
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── The sale: one order row, right-sized to what was delivered ────────
  v_total := (p_delivered_bundles * v_unit_price)::NUMERIC(12,2);

  INSERT INTO stall_orders
    (route_batch_id, stall_id, sku_code, order_type, source_channel,
     ordered_bundles, delivered_bundles, unit_price_locked,
     payment_status, payment_reference, payment_proof_url,
     payment_attested_at, attested_by, fulfilment_status)
  VALUES
    (p_route_batch_id, v_stall.id, p_sku_code, 'SPOT', 'STALL',
     p_delivered_bundles, p_delivered_bundles, v_unit_price,
     v_payment_status, p_payment_reference, p_payment_proof_url,
     p_handed_at, p_attested_by, 'DELIVERED')
  RETURNING id INTO v_order_id;

  -- A registered Stall still gets the one-line receipt; a Provisional Stall
  -- has no phone, so the handover row below is its audit result.
  IF v_stall.whatsapp_phone IS NOT NULL THEN
    v_body := format($receipt$
🧾 SARPPLY — RESIT JUALAN
%s · %s · %s

%s × %s = RM %s

TOTAL: RM %s
Bayaran: %s
$receipt$,
      v_stall.stall_code,
      v_stall.stall_name,
      to_char(p_handed_at AT TIME ZONE 'Asia/Kuching', 'DD Mon YYYY'),
      p_sku_code,
      p_delivered_bundles,
      to_char(v_total, 'FM9999990.00'),
      to_char(v_total, 'FM9999990.00'),
      CASE v_payment_status
        WHEN 'PAID_CASH' THEN 'TUNAI'
        WHEN 'PAID_DUITNOW' THEN format('DUITNOW (%s)', p_payment_reference)
        ELSE 'BELUM DIBAYAR'
      END);

    INSERT INTO outbound_messages
      (to_phone, body, status, dedupe_key, route_batch_id, stall_id)
    VALUES
      (v_stall.whatsapp_phone, v_body, 'QUEUED', format('spot:%s', p_event_key),
       p_route_batch_id, v_stall.id)
    RETURNING id INTO v_outbound_id;
  END IF;

  INSERT INTO stall_handovers
    (route_batch_id, stall_id, handover_type, dedupe_key, total_myr,
     payment_status, payment_reference, payment_proof_url, attested_at,
     attested_by, outbound_message_id, handed_at)
  VALUES
    (p_route_batch_id, v_stall.id, 'SPOT', v_key, v_total,
     v_payment_status, p_payment_reference, p_payment_proof_url, p_handed_at,
     p_attested_by, v_outbound_id, p_handed_at)
  RETURNING id INTO v_handover_id;

  INSERT INTO stall_handover_lines
    (handover_id, stall_order_id, delivered_bundles, unit_price_locked)
  VALUES
    (v_handover_id, v_order_id, p_delivered_bundles, v_unit_price);

  v_written := fn_post_stock_movement(
    p_sku_code => p_sku_code,
    p_vehicle_id => v_batch.vehicle_id,
    p_quantity_bundles => -p_delivered_bundles,
    p_movement_type => 'SPOT_SALE',
    p_idempotency_key => v_key,
    p_route_batch_id => p_route_batch_id,
    p_stall_order_id => v_order_id,
    p_occurred_at => p_handed_at
  );
  IF v_written <> 1 THEN
    RAISE EXCEPTION 'stock was already posted for event key %', p_event_key
      USING ERRCODE = 'check_violation';
  END IF;

  stall_order_id := v_order_id;
  stall_id := v_stall.id;
  handover_id := v_handover_id;
  outbound_message_id := v_outbound_id;
  created := TRUE;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ─── The Spot Sale read model ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_spot_sale AS
SELECT o.id                    AS stall_order_id,
       o.route_batch_id,
       o.stall_id,
       st.stall_code,
       st.stall_name,
       st.onboarding_status,
       st.whatsapp_phone IS NOT NULL AS has_phone,
       c.name                  AS cluster_name,
       o.sku_code,
       sk.name_en,
       o.delivered_bundles,
       o.unit_price_locked,
       o.payment_status,
       o.payment_reference,
       o.payment_proof_url,
       rs.runner_identity,
       h.id                    AS handover_id,
       h.total_myr,
       h.outbound_message_id,
       om.status               AS receipt_status,
       om.failure_reason       AS receipt_failure,
       om.body                 AS receipt_body,
       COALESCE(h.handed_at, o.created_at) AS created_at
FROM stall_orders o
JOIN stalls st ON st.id = o.stall_id
JOIN clusters c ON c.id = st.cluster_id
JOIN skus sk ON sk.sku_code = o.sku_code
LEFT JOIN stall_handover_lines l ON l.stall_order_id = o.id
LEFT JOIN stall_handovers h ON h.id = l.handover_id
LEFT JOIN runner_sessions rs ON rs.id = o.attested_by
LEFT JOIN outbound_messages om ON om.id = h.outbound_message_id
WHERE o.order_type = 'SPOT';

-- ─── Provisional buyers who did not Preorder: the warm onboarding list ────
CREATE OR REPLACE VIEW v_provisional_spot_leads AS
SELECT b.id                    AS route_batch_id,
       st.id                   AS stall_id,
       st.stall_code,
       st.stall_name,
       c.name                  AS cluster_name,
       COUNT(o.id)::INT        AS spot_orders,
       SUM(o.delivered_bundles)::INT AS delivered_bundles,
       SUM(o.delivered_bundles * o.unit_price_locked)::NUMERIC(12,2) AS bought_myr,
       MAX(o.created_at)       AS last_bought_at
FROM route_batches b
JOIN routes r ON r.id = b.route_id
JOIN clusters c ON c.route_id = r.id
JOIN stalls st ON st.cluster_id = c.id
JOIN stall_orders o
  ON o.route_batch_id = b.id
 AND o.stall_id = st.id
 AND o.order_type = 'SPOT'
WHERE st.onboarding_status = 'PROVISIONAL_SPOT'
  AND o.payment_status IN ('PAID_CASH','PAID_DUITNOW')
  AND NOT EXISTS (
    SELECT 1
      FROM stall_orders p
     WHERE p.route_batch_id = b.id
       AND p.stall_id = st.id
       AND p.order_type = 'PREORDER'
  )
GROUP BY b.id, st.id, st.stall_code, st.stall_name, c.name;
