-- 0009_whatsapp_transport.sql — WhatsApp is a transport, not a business rule.
-- Inbound messages are stored once per provider id; the broadcast is queued
-- before sending and retried on the same row. No audio is transcribed and no
-- order is created here (ADR-0004, ADR-0014).

-- ─── Inbound voice-note metadata, queryable without opening `raw` ──────────
ALTER TABLE inbound_messages
  ADD COLUMN message_type VARCHAR(16) NOT NULL DEFAULT 'TEXT'
    CHECK (message_type IN ('TEXT','AUDIO','OTHER')),
  ADD COLUMN media_id VARCHAR(200),
  ADD COLUMN media_mime_type VARCHAR(100),
  ADD COLUMN media_duration_seconds INT
    CHECK (media_duration_seconds IS NULL OR media_duration_seconds >= 0),
  ADD COLUMN is_voice_note BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_inbound_messages_batch
  ON inbound_messages (route_batch_id, received_at);

CREATE INDEX idx_outbound_messages_batch
  ON outbound_messages (route_batch_id, queued_at);

CREATE INDEX idx_outbound_messages_undelivered
  ON outbound_messages (route_batch_id)
  WHERE status <> 'SENT';

-- ─── Store one inbound webhook message, exactly once ──────────────────────
-- The provider id is the idempotency key. A redelivery returns the existing
-- row and writes nothing. The sender's phone is matched on digits so the
-- Cloud API's `601…` and the Stall's `+601…` are the same Stall.
CREATE OR REPLACE FUNCTION fn_store_inbound_message(
  p_provider_message_id    VARCHAR(160),
  p_from_phone             VARCHAR(30),
  p_body                   TEXT DEFAULT NULL,
  p_raw                    JSONB DEFAULT NULL,
  p_message_type           VARCHAR(16) DEFAULT 'TEXT',
  p_media_id               VARCHAR(200) DEFAULT NULL,
  p_media_mime_type        VARCHAR(100) DEFAULT NULL,
  p_media_duration_seconds INT DEFAULT NULL,
  p_is_voice_note          BOOLEAN DEFAULT FALSE,
  p_received_at            TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (message_id UUID, created BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_id       UUID;
  v_stall_id UUID;
  v_batch_id UUID;
  v_type     VARCHAR(16);
BEGIN
  IF p_provider_message_id IS NULL OR btrim(p_provider_message_id) = '' THEN
    RAISE EXCEPTION 'an inbound message needs its provider message id'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_from_phone IS NULL OR regexp_replace(p_from_phone, '\D', '', 'g') = '' THEN
    RAISE EXCEPTION 'an inbound message needs the sender phone'
      USING ERRCODE = 'check_violation';
  END IF;

  v_type := COALESCE(p_message_type, 'TEXT');

  SELECT st.id INTO v_stall_id
    FROM stalls st
   WHERE st.whatsapp_phone IS NOT NULL
     AND regexp_replace(st.whatsapp_phone, '\D', '', 'g')
         = regexp_replace(p_from_phone, '\D', '', 'g')
   LIMIT 1;

  IF v_stall_id IS NOT NULL THEN
    SELECT b.id INTO v_batch_id
      FROM stalls st
      JOIN clusters c      ON c.id = st.cluster_id
      JOIN route_batches b ON b.route_id = c.route_id
     WHERE st.id = v_stall_id
       AND b.status = 'OPEN_FOR_ORDERS'
     ORDER BY b.cutoff_at DESC
     LIMIT 1;
  END IF;

  INSERT INTO inbound_messages
    (provider_message_id, from_phone, body, route_batch_id, stall_id,
     received_at, raw, message_type, media_id, media_mime_type,
     media_duration_seconds, is_voice_note)
  VALUES
    (p_provider_message_id, p_from_phone, p_body, v_batch_id, v_stall_id,
     COALESCE(p_received_at, NOW()), p_raw, v_type, p_media_id,
     p_media_mime_type, p_media_duration_seconds, COALESCE(p_is_voice_note, FALSE))
  ON CONFLICT (provider_message_id) DO NOTHING
  RETURNING inbound_messages.id INTO v_id;

  IF v_id IS NULL THEN
    SELECT im.id INTO v_id
      FROM inbound_messages im
     WHERE im.provider_message_id = p_provider_message_id;
    message_id := v_id;
    created := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  message_id := v_id;
  created := TRUE;
  RETURN NEXT;
END;
$$;

-- ─── Queue Script B for every active Stall on the Route, once ─────────────
-- The body is built here so the Pool Prices in it are the ones in force when
-- the broadcast runs, not a copy that can drift. The seven-day voice-note
-- disclosure travels in the same message (ADR-0017).
CREATE OR REPLACE FUNCTION fn_queue_broadcast(
  p_route_batch_id UUID
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_batch        RECORD;
  v_today        DATE;
  v_prices       TEXT;
  v_active_count INT;
  v_priced_count INT;
  v_missing      VARCHAR(10);
  v_body         TEXT;
  v_inserted     INT;
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
    RAISE EXCEPTION 'the broadcast belongs to an open Route Batch'
      USING ERRCODE = 'check_violation';
  END IF;

  v_today := (NOW() AT TIME ZONE 'Asia/Kuching')::DATE;

  SELECT COUNT(*) INTO v_active_count FROM skus WHERE is_active;
  SELECT COUNT(*) INTO v_priced_count
    FROM skus sk
   WHERE sk.is_active
     AND EXISTS (
       SELECT 1
         FROM pool_prices pp
        WHERE pp.sku_code = sk.sku_code
          AND pp.valid_from <= v_today
          AND (pp.valid_to IS NULL OR pp.valid_to >= v_today)
     );

  IF v_active_count = 0 OR v_priced_count <> v_active_count THEN
    SELECT sk.sku_code INTO v_missing
      FROM skus sk
     WHERE sk.is_active
       AND NOT EXISTS (
         SELECT 1
           FROM pool_prices pp
          WHERE pp.sku_code = sk.sku_code
            AND pp.valid_from <= v_today
            AND (pp.valid_to IS NULL OR pp.valid_to >= v_today)
       )
     ORDER BY sk.sku_code
     LIMIT 1;
    RAISE EXCEPTION 'no Pool Price is in force for SKU %', v_missing
      USING ERRCODE = 'check_violation';
  END IF;

  WITH current_prices AS (
    SELECT DISTINCT ON (pp.sku_code)
           pp.sku_code, pp.pool_bundle_price
      FROM pool_prices pp
     WHERE pp.valid_from <= v_today
       AND (pp.valid_to IS NULL OR pp.valid_to >= v_today)
     ORDER BY pp.sku_code, pp.valid_from DESC, pp.id
  )
  SELECT string_agg(
           format('[%s] %s (%s bungkus)  = RM %s',
                  sk.sku_code,
                  sk.name_bm,
                  sk.bundles_per_master_carton,
                  to_char(cp.pool_bundle_price, 'FM999990.00')),
           E'\n' ORDER BY sk.sku_code)
    INTO v_prices
    FROM skus sk
    JOIN current_prices cp ON cp.sku_code = sk.sku_code
   WHERE sk.is_active;

  v_body := btrim(format($script$
📦 SARPPLY: POOL BORONG MINGGU NI DAH BUKA! 📦

Hi Boss! Order berkumpulan minggu ni dibuka sekarang, tutup esok
(Rabu, 12:00 tengah hari).

✅ Harga karton — beli 1 bundle pun dapat harga borong
✅ Hantar terus ke gerai hari Khamis petang, PERCUMA
✅ Bayar cash atau scan DuitNow QR masa barang sampai saja
✅ Tak perlu bayar apa-apa hari ni

HARGA POOL MINGGU NI:
%s

👇 Cara order: balas mesej ni dengan kod & kuantiti saja.
Contoh: "A1 x 3, C1 x 2, E1 x 1"
Atau hantar voice note — kami akan baca balik untuk confirm.
🔒 Voice note disimpan 7 hari sahaja untuk semakan pesanan, lepas tu dipadam.
$script$, v_prices), E' \t\n\r');

  INSERT INTO outbound_messages
    (to_phone, body, status, dedupe_key, route_batch_id, stall_id)
  SELECT st.whatsapp_phone,
         v_body,
         'QUEUED',
         format('broadcast:%s:%s', p_route_batch_id, st.id),
         p_route_batch_id,
         st.id
    FROM stalls st
    JOIN clusters c ON c.id = st.cluster_id
   WHERE c.route_id = v_batch.route_id
     AND st.onboarding_status = 'ACTIVE'
     AND st.is_active
     AND st.whatsapp_phone IS NOT NULL
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted;
END;
$$;

-- ─── What still needs sending, including a previous failure ───────────────
CREATE OR REPLACE FUNCTION fn_pending_outbound_messages(
  p_route_batch_id UUID
) RETURNS TABLE (
  id      UUID,
  to_phone VARCHAR(30),
  body    TEXT,
  status  VARCHAR(12)
) LANGUAGE sql STABLE AS $$
  SELECT m.id, m.to_phone, m.body, m.status
    FROM outbound_messages m
   WHERE m.route_batch_id = p_route_batch_id
     AND m.status <> 'SENT'
   ORDER BY m.queued_at, m.id;
$$;

-- ─── Record the provider result on the queued row ─────────────────────────
-- Success or failure updates the same row, so a retry never creates a second
-- message. A row already SENT cannot be failed by a late retry.
CREATE OR REPLACE FUNCTION fn_mark_outbound_sent(
  p_id                  UUID,
  p_provider_message_id VARCHAR(160)
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_updated INT;
BEGIN
  IF p_provider_message_id IS NULL OR btrim(p_provider_message_id) = '' THEN
    RAISE EXCEPTION 'a sent message needs the provider message id'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE outbound_messages
     SET status = 'SENT',
         provider_message_id = p_provider_message_id,
         sent_at = NOW(),
         failure_reason = NULL
   WHERE id = p_id
     AND status IN ('QUEUED','FAILED');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION fn_mark_outbound_failed(
  p_id     UUID,
  p_reason TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE outbound_messages
     SET status = 'FAILED',
         failure_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'send failed')
   WHERE id = p_id
     AND status IN ('QUEUED','FAILED');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;
