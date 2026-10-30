-- 0007_text_order_intake.sql — pasted WhatsApp text becomes a persisted draft,
-- and only an explicit commit writes Preorders (ADR-0004).
--
-- Pricing rule shared with Cutoff: a committed line records the Pool Price in
-- force at commit time in `stall_orders.unit_price_locked`. Cutoff later
-- replaces it with the batch's frozen snapshot (#5).

CREATE TABLE text_order_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_batch_id  UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  stall_id        UUID NOT NULL REFERENCES stalls(id) ON DELETE RESTRICT,
  body            TEXT NOT NULL CHECK (btrim(body) <> ''),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at    TIMESTAMPTZ
);

CREATE INDEX idx_text_order_drafts_open
  ON text_order_drafts (route_batch_id, stall_id)
  WHERE committed_at IS NULL;

-- A parse gap is a row with a NULL SKU or quantity, never a dropped line.
CREATE TABLE text_order_draft_lines (
  draft_id         UUID NOT NULL REFERENCES text_order_drafts(id) ON DELETE CASCADE,
  line_no          SMALLINT NOT NULL CHECK (line_no > 0),
  sku_code         VARCHAR(10) REFERENCES skus(sku_code) ON DELETE RESTRICT,
  ordered_bundles  INT CHECK (ordered_bundles IS NULL OR ordered_bundles > 0),
  raw_text         TEXT NOT NULL,
  PRIMARY KEY (draft_id, line_no)
);

-- ─── Create a draft from a pasted message and its parsed lines ─────────────
-- Intake is only legal while the batch is open and before its Cutoff. The
-- raw body is retained: it is the only evidence of what the Stall asked for.
CREATE OR REPLACE FUNCTION fn_create_text_draft(
  p_route_batch_id UUID,
  p_stall_id       UUID,
  p_body           TEXT,
  p_lines          JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id       UUID;
  v_status   VARCHAR(24);
  v_cutoff   TIMESTAMPTZ;
  v_route_id UUID;
  v_line     RECORD;
  v_line_no  SMALLINT := 0;
BEGIN
  SELECT status, cutoff_at, route_id
    INTO v_status, v_cutoff, v_route_id
    FROM route_batches
   WHERE id = p_route_batch_id
     FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown Route Batch %', p_route_batch_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_status <> 'OPEN_FOR_ORDERS' THEN
    RAISE EXCEPTION 'Route Batch is not open for orders'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOW() >= v_cutoff THEN
    RAISE EXCEPTION 'Cutoff has passed; no Preorders may be drafted'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'the pasted message is empty'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM stalls st
      JOIN clusters c ON c.id = st.cluster_id
     WHERE st.id = p_stall_id
       AND c.route_id = v_route_id
       AND st.onboarding_status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Stall % is not an active Stall on this Route', p_stall_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'a draft needs at least one parsed line'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO text_order_drafts (route_batch_id, stall_id, body)
  VALUES (p_route_batch_id, p_stall_id, p_body)
  RETURNING id INTO v_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO text_order_draft_lines
      (draft_id, line_no, sku_code, ordered_bundles, raw_text)
    VALUES (
      v_id,
      v_line_no,
      UPPER(NULLIF(v_line.value->>'skuCode', '')),
      NULLIF(v_line.value->>'orderedBundles', '')::INT,
      COALESCE(v_line.value->>'rawText', '')
    );
  END LOOP;

  RETURN v_id;
END;
$$;

-- ─── Correct a draft line before commit ────────────────────────────────────
-- Every line must be sent; a committed draft can no longer be edited.
CREATE OR REPLACE FUNCTION fn_update_text_draft_lines(
  p_draft_id UUID,
  p_lines    JSONB
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_line  RECORD;
  v_count INT := 0;
BEGIN
  PERFORM 1
    FROM text_order_drafts
   WHERE id = p_draft_id AND committed_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM text_order_drafts WHERE id = p_draft_id) THEN
      RAISE EXCEPTION 'draft % is already committed', p_draft_id
        USING ERRCODE = 'check_violation';
    END IF;
    RAISE EXCEPTION 'unknown text draft %', p_draft_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) <> (
       SELECT COUNT(*) FROM text_order_draft_lines WHERE draft_id = p_draft_id
     ) THEN
    RAISE EXCEPTION 'every draft line must be sent when editing a draft'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    UPDATE text_order_draft_lines
       SET sku_code = UPPER(NULLIF(v_line.value->>'skuCode', '')),
           ordered_bundles = NULLIF(v_line.value->>'orderedBundles', '')::INT
     WHERE draft_id = p_draft_id
       AND line_no = (v_line.value->>'lineNo')::SMALLINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'draft % has no line %', p_draft_id, v_line.value->>'lineNo'
        USING ERRCODE = 'check_violation';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── Commit a draft: write the Preorders, then mark the draft committed ───
-- Idempotent: a second call returns 0 and writes nothing. Duplicate SKUs in
-- one draft sum; a later draft updates the Stall's Preorder while the batch is
-- still open, and Cutoff freezes it afterwards (ADR-0002).
CREATE OR REPLACE FUNCTION fn_commit_text_draft(
  p_draft_id UUID
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_draft   RECORD;
  v_line    RECORD;
  v_today   DATE;
  v_price   NUMERIC(10,2);
  v_written INT := 0;
BEGIN
  SELECT * INTO v_draft
    FROM text_order_drafts
   WHERE id = p_draft_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown text draft %', p_draft_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_draft.committed_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  PERFORM 1
    FROM route_batches b
   WHERE b.id = v_draft.route_batch_id
     AND b.status = 'OPEN_FOR_ORDERS'
     AND NOW() < b.cutoff_at
     FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route Batch is not open for Preorders'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM text_order_draft_lines WHERE draft_id = p_draft_id
  ) THEN
    RAISE EXCEPTION 'the draft has no lines'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM text_order_draft_lines l
      LEFT JOIN skus sk ON sk.sku_code = l.sku_code AND sk.is_active
     WHERE l.draft_id = p_draft_id
       AND (l.sku_code IS NULL OR l.ordered_bundles IS NULL OR sk.sku_code IS NULL)
  ) THEN
    RAISE EXCEPTION 'every draft line needs an active SKU and a quantity before commit'
      USING ERRCODE = 'check_violation';
  END IF;

  v_today := (NOW() AT TIME ZONE 'Asia/Kuching')::DATE;

  FOR v_line IN
    SELECT sku_code, SUM(ordered_bundles)::INT AS bundles
      FROM text_order_draft_lines
     WHERE draft_id = p_draft_id
     GROUP BY sku_code
     ORDER BY sku_code
  LOOP
    SELECT pp.pool_bundle_price
      INTO v_price
      FROM pool_prices pp
     WHERE pp.sku_code = v_line.sku_code
       AND pp.valid_from <= v_today
       AND (pp.valid_to IS NULL OR pp.valid_to >= v_today)
     ORDER BY pp.valid_from DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'no Pool Price is in force for SKU %', v_line.sku_code
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO stall_orders
      (route_batch_id, stall_id, sku_code, order_type, source_channel,
       ordered_bundles, unit_price_locked)
    VALUES
      (v_draft.route_batch_id, v_draft.stall_id, v_line.sku_code, 'PREORDER', 'TEXT',
       v_line.bundles, v_price)
    ON CONFLICT (route_batch_id, stall_id, sku_code) WHERE order_type = 'PREORDER'
    DO UPDATE SET ordered_bundles = EXCLUDED.ordered_bundles,
                  unit_price_locked = EXCLUDED.unit_price_locked,
                  updated_at = NOW();
    v_written := v_written + 1;
  END LOOP;

  UPDATE text_order_drafts
     SET committed_at = NOW()
   WHERE id = p_draft_id;

  RETURN v_written;
END;
$$;
