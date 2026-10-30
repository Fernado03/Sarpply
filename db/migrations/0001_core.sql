-- 0001_core.sql — Pillar 9 ledger, extended with the per-batch Vehicle and
-- a unit cost on every stock movement (ADR-0018).

-- ─── Vehicles: the payload ceiling ─────────────────────────────────────────
CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             VARCHAR(60) NOT NULL UNIQUE,
  max_cargo_liters  INT  NOT NULL CHECK (max_cargo_liters > 0),
  max_payload_kg    INT  CHECK (max_payload_kg > 0),
  packing_efficiency NUMERIC(4,3) NOT NULL DEFAULT 0.92
       CHECK (packing_efficiency > 0 AND packing_efficiency <= 1)
);

-- ─── Routes: the operating unit ────────────────────────────────────────────
CREATE TABLE routes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(120) NOT NULL UNIQUE,
  cutoff_day          VARCHAR(12)  NOT NULL DEFAULT 'WEDNESDAY',
  cutoff_time         TIME         NOT NULL DEFAULT '12:00:00',
  delivery_day        VARCHAR(12)  NOT NULL DEFAULT 'THURSDAY',
  sortie_count        SMALLINT     NOT NULL DEFAULT 2 CHECK (sortie_count BETWEEN 1 AND 4),
  runner_rate_per_sortie NUMERIC(6,2) NOT NULL DEFAULT 42.50 CHECK (runner_rate_per_sortie > 0),
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Clusters: geography, assigned to a Sortie ────────────────────────────
CREATE TABLE clusters (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id                  UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  name                      VARCHAR(100) NOT NULL,
  -- Which Sortie serves this Cluster. Several Clusters MAY share a Sortie
  -- (ADR-0016); do not add UNIQUE (route_id, trip_number).
  trip_number               SMALLINT NOT NULL DEFAULT 1 CHECK (trip_number BETWEEN 1 AND 4),
  total_addressable_stalls  INT CHECK (total_addressable_stalls >= 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, name)
);

-- ─── Stalls: the buyer ─────────────────────────────────────────────────────
CREATE TABLE stalls (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable business key from the tracking sheet: S01, S02, … never reused.
  stall_code        VARCHAR(10) NOT NULL UNIQUE,
  cluster_id        UUID NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
  stall_number      VARCHAR(50)  NOT NULL,
  stall_name        VARCHAR(120) NOT NULL,
  whatsapp_phone    VARCHAR(30)  UNIQUE,
  written_language  VARCHAR(10)  NOT NULL DEFAULT 'ms-MY'
                      CHECK (written_language IN ('ms-MY', 'en', 'zh-CN')),
  trust_tier        VARCHAR(20)  NOT NULL DEFAULT 'PROVISIONAL'
                      CHECK (trust_tier IN ('ANCHOR_PRIORITY','COD_APPROVED','PROVISIONAL','SUSPENDED')),
  onboarding_status VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (onboarding_status IN ('ACTIVE','PROVISIONAL_SPOT','INACTIVE')),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (cluster_id, stall_number),
  CHECK (onboarding_status = 'PROVISIONAL_SPOT' OR whatsapp_phone IS NOT NULL)
);

-- ─── Catalogue ─────────────────────────────────────────────────────────────
CREATE TABLE skus (
  sku_code                  VARCHAR(10) PRIMARY KEY,
  name_en                   VARCHAR(150) NOT NULL,
  name_bm                   VARCHAR(150) NOT NULL,
  name_zh                   VARCHAR(150),
  bundle_unit_name          VARCHAR(60)  NOT NULL,
  bundles_per_master_carton INT          NOT NULL CHECK (bundles_per_master_carton > 0),
  physical_boxes_per_carton INT          NOT NULL DEFAULT 1 CHECK (physical_boxes_per_carton >= 1),
  carton_geometric_liters   NUMERIC(6,2) NOT NULL CHECK (carton_geometric_liters > 0),
  carton_gross_kg           NUMERIC(6,2) CHECK (carton_gross_kg > 0),
  brand                     VARCHAR(80),
  is_brand_fungible         BOOLEAN NOT NULL DEFAULT TRUE,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Wholesalers and their price history ───────────────────────────────────
CREATE TABLE wholesalers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL UNIQUE,
  area          VARCHAR(80),
  whatsapp_phone VARCHAR(30),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE wholesaler_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID NOT NULL REFERENCES wholesalers(id) ON DELETE RESTRICT,
  sku_code      VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  carton_cost   NUMERIC(10,2) NOT NULL CHECK (carton_cost > 0),
  valid_from    DATE NOT NULL,
  valid_to      DATE,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX uq_wholesaler_price_open
  ON wholesaler_prices (wholesaler_id, sku_code)
  WHERE valid_to IS NULL;

-- ─── Pool prices (sell side), per SKU, time-boxed ──────────────────────────
CREATE TABLE pool_prices (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code                      VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  wholesaler_price_id           UUID NOT NULL REFERENCES wholesaler_prices(id) ON DELETE RESTRICT,
  pool_bundle_price             NUMERIC(10,2) NOT NULL CHECK (pool_bundle_price > 0),
  observed_retail_bundle_price  NUMERIC(10,2) CHECK (observed_retail_bundle_price > 0),
  valid_from                    DATE NOT NULL,
  valid_to                      DATE,
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX uq_pool_price_open ON pool_prices (sku_code) WHERE valid_to IS NULL;

-- ─── Route batches ─────────────────────────────────────────────────────────
CREATE TABLE route_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id      UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  -- The Vehicle selected for this batch. Stock is owned per Vehicle
  -- (ADR-0003), so the fact belongs to the batch, not only to the Route.
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  delivery_date DATE NOT NULL,
  status        VARCHAR(24) NOT NULL DEFAULT 'OPEN_FOR_ORDERS'
                  CHECK (status IN (
                    'OPEN_FOR_ORDERS','CLOSED_AT_CUTOFF','PO_SUBMITTED',
                    'GOODS_RECEIVED','DELIVERED','RECONCILED','CANCELLED_LOW_VOLUME'
                  )),
  cancelled_reason VARCHAR(200),
  sortie_count  SMALLINT NOT NULL DEFAULT 2 CHECK (sortie_count BETWEEN 1 AND 4),
  runner_cost_myr NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (runner_cost_myr >= 0),
  cutoff_at     TIMESTAMPTZ NOT NULL,
  opened_at     TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, delivery_date),
  CHECK (status <> 'CANCELLED_LOW_VOLUME' OR cancelled_reason IS NOT NULL)
);

-- ─── Batch transition log: one row per batch and transition type ──────────
CREATE TABLE route_batch_transitions (
  id              BIGSERIAL PRIMARY KEY,
  route_batch_id  UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  transition_type VARCHAR(32) NOT NULL
                    CHECK (transition_type IN (
                      'OPENED','CUTOFF_FIRED','PO_SUBMITTED','GOODS_RECEIVED',
                      'DELIVERED','RECONCILED','CANCELLED_LOW_VOLUME'
                    )),
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_batch_id, transition_type)
);

-- ─── Price snapshot, frozen at Cutoff ──────────────────────────────────────
CREATE TABLE route_batch_prices (
  route_batch_id        UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  sku_code              VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  wholesaler_price_id   UUID NOT NULL REFERENCES wholesaler_prices(id) ON DELETE RESTRICT,
  locked_carton_cost    NUMERIC(10,2) NOT NULL CHECK (locked_carton_cost > 0),
  locked_pool_bundle_price NUMERIC(10,2) NOT NULL CHECK (locked_pool_bundle_price > 0),
  PRIMARY KEY (route_batch_id, sku_code)
);

-- ─── Orders: two orthogonal axes ───────────────────────────────────────────
CREATE TABLE stall_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_batch_id     UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  stall_id           UUID NOT NULL REFERENCES stalls(id) ON DELETE RESTRICT,
  sku_code           VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  order_type         VARCHAR(10) NOT NULL DEFAULT 'PREORDER'
                       CHECK (order_type IN ('PREORDER','SPOT')),
  -- How the order reached the ledger: typed text, a confirmed voice order,
  -- or a sale recorded at the stall. Stored on every row.
  source_channel     VARCHAR(8) NOT NULL
                       CHECK (source_channel IN ('TEXT','VOICE','STALL')),
  ordered_bundles    INT  NOT NULL CHECK (ordered_bundles > 0),
  delivered_bundles  INT  NOT NULL DEFAULT 0
                       CHECK (delivered_bundles >= 0),
  unit_price_locked  NUMERIC(10,2) NOT NULL CHECK (unit_price_locked > 0),
  payment_status     VARCHAR(16) NOT NULL DEFAULT 'UNPAID'
                       CHECK (payment_status IN ('UNPAID','PAID_CASH','PAID_DUITNOW','VOIDED')),
  fulfilment_status  VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                       CHECK (fulfilment_status IN ('PENDING','DELIVERED','PARTIAL','UNCOLLECTED')),
  payment_reference  VARCHAR(80),
  payment_proof_url  TEXT,
  payment_attested_at TIMESTAMPTZ,
  attested_by        UUID,
  source_message_id  VARCHAR(120),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (delivered_bundles <= ordered_bundles),
  -- A DuitNow attestation carries both the reference and the proof (ADR-0001).
  CHECK (payment_status <> 'PAID_DUITNOW'
         OR (payment_reference IS NOT NULL AND payment_proof_url IS NOT NULL)),
  CHECK (
    (fulfilment_status = 'PENDING'     AND delivered_bundles = 0)
    OR (fulfilment_status = 'DELIVERED'  AND delivered_bundles = ordered_bundles)
    OR (fulfilment_status = 'PARTIAL'    AND delivered_bundles > 0 AND delivered_bundles < ordered_bundles)
    OR (fulfilment_status = 'UNCOLLECTED' AND delivered_bundles = 0)
  )
);
CREATE UNIQUE INDEX uq_stall_order_preorder
  ON stall_orders (route_batch_id, stall_id, sku_code)
  WHERE order_type = 'PREORDER';
CREATE UNIQUE INDEX uq_stall_order_spot_msg
  ON stall_orders (source_message_id)
  WHERE source_message_id IS NOT NULL;

-- ─── Wholesaler PO ─────────────────────────────────────────────────────────
CREATE TABLE wholesaler_pos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_batch_id  UUID NOT NULL UNIQUE REFERENCES route_batches(id) ON DELETE CASCADE,
  wholesaler_id   UUID NOT NULL REFERENCES wholesalers(id) ON DELETE RESTRICT,
  submitted_at    TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  cash_required_myr NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wholesaler_po_lines (
  po_id             UUID NOT NULL REFERENCES wholesaler_pos(id) ON DELETE CASCADE,
  sku_code          VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  cartons_ordered   INT NOT NULL CHECK (cartons_ordered >= 0),
  cartons_received  INT CHECK (cartons_received >= 0),
  carton_cost       NUMERIC(10,2) NOT NULL CHECK (carton_cost > 0),
  PRIMARY KEY (po_id, sku_code),
  CHECK (cartons_received IS NULL OR cartons_received <= cartons_ordered)
);

-- ─── Append-only stock ledger ──────────────────────────────────────────────
CREATE TABLE stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  sku_code        VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  quantity_bundles INT NOT NULL CHECK (quantity_bundles <> 0),
  -- Unit cost per Bundle at the moment of posting. Receipts carry the
  -- invoice cost; outbound movements carry the weighted-average cost of the
  -- balance before them (ADR-0018). Never NULL: buffer value must be
  -- computable from the ledger alone.
  unit_cost_myr   NUMERIC(10,2) NOT NULL CHECK (unit_cost_myr > 0),
  movement_type   VARCHAR(24) NOT NULL
                    CHECK (movement_type IN (
                      'PURCHASE_RECEIPT','DELIVERY','SPOT_SALE',
                      'UNCOLLECTED_RETURN','DAMAGE_WRITE_OFF','MANUAL_ADJUSTMENT'
                    )),
  route_batch_id  UUID REFERENCES route_batches(id) ON DELETE RESTRICT,
  stall_order_id  UUID REFERENCES stall_orders(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  note            TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_movements_sku_vehicle ON stock_movements (sku_code, vehicle_id);
CREATE INDEX idx_stock_movements_batch ON stock_movements (route_batch_id);
