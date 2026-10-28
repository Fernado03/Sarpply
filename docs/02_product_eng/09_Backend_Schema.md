---
project: Sarpply
pillar: 09_Backend_Schema
version: 1.1-Phase2
database: PostgreSQL 15+ / Supabase
features: DDL, seed catalogue, derived views, append-only stock ledger, RLS policies
supersedes: v1.0 (vendors, pool_batches, current_buffer_bundles, PREPAY_REQUIRED, UNCOLLECTED_BUFFER, single payment_status axis, non-idempotent reconcile, zero RLS policies)
---

# Sarpply — Pillar 9: Backend Schema & SQL

> Terminology per `GLOSSARY.md`. Every table name here is canonical: **stalls** (not vendors), **route_batches** (not pool_batches), **sorties** are attributed via `clusters.trip_number`.

## 1. What v1.0 got wrong

Ten defects, all of which would have shipped:

| # | v1.0 defect | Consequence | Fix |
| --- | --- | --- | --- |
| 1 | `clusters.cutoff_day/time` | A Cluster is geography; a Route schedules it. Two Clusters on one Route had two clocks. | Moved to `routes` |
| 2 | `vendors`, `pool_batches`, `vendor_orders` | Wrong domain names | `stalls`, `route_batches`, `stall_orders` |
| 3 | `skus.current_buffer_bundles` | Mutable global counter, no history, corruption-prone | Deleted; balance is a view over `stock_movements` |
| 4 | `payment_status` single axis | Cannot express "paid, partly delivered" | `payment_status` + `fulfilment_status` |
| 5 | `PREPAY_REQUIRED` tier | No prepayment flow exists | Deleted |
| 6 | `UNCOLLECTED_BUFFER` as a payment value | Conflates goods with money | `fulfilment_status = 'UNCOLLECTED'` |
| 7 | `v_batch_pnl_summary` used live `skus.pool_bundle_price` | Historical P&L silently changes when prices change | Price from `route_batch_prices` snapshot |
| 8 | `fn_reconcile_batch` non-idempotent | Re-running re-applies buffer movements | Idempotency key on every movement |
| 9 | No `delivered_bundles` | Realized GP uncomputable; gate measured on forecasts | Added |
| 10 | Frontmatter claimed RLS, zero policies | Every anon key could write | Policies in §6 |

---

## 2. Entity relationships

```
routes ──1:N──▶ clusters ──1:N──▶ stalls ──1:N──▶ stall_orders
  │                                                │
  └──1:N──▶ route_batches ──1:N──▶ stall_orders ◀──┘
                 │
                 ├──1:N──▶ route_batch_prices ──N:1──▶ wholesaler_prices ──N:1──▶ wholesalers
                 ├──1:N──▶ wholesaler_po_lines
                 └──1:N──▶ stock_movements ──▶ (derived) buffer balance
```

`sorties` are not a table: a Route has `sortie_count`, and each Cluster names its Sortie via `trip_number`.

---

## 3. DDL

```sql
-- gen_random_uuid() is built into PostgreSQL 13+; no pgcrypto required.

-- ─── Vehicles: the payload ceiling ─────────────────────────────────────────
CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             VARCHAR(60) NOT NULL UNIQUE,   -- 'Myvi', 'Avanza'
  max_cargo_liters  INT  NOT NULL CHECK (max_cargo_liters > 0),
  max_payload_kg    INT  CHECK (max_payload_kg > 0),
  -- Measured packing efficiency, not a constant in app code. 0.92 was measured in
  -- Phase 1; v1.1 hard-coded 0.80 and overstated packed volume by 15% (ADR-0015).
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
  -- Which Sortie serves this Cluster. Several Clusters MAY share a Sortie:
  -- at 9 Stalls both Clusters ride Sortie 1, and that is normal, not an error
  -- (ADR-0016). Do not add a UNIQUE (route_id, trip_number) constraint.
  trip_number               SMALLINT NOT NULL DEFAULT 1 CHECK (trip_number BETWEEN 1 AND 4),
  total_addressable_stalls  INT CHECK (total_addressable_stalls >= 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, name)
);

-- ─── Stalls: the buyer ─────────────────────────────────────────────────────
CREATE TABLE stalls (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  -- A Stall we can broadcast to must have a phone. A Spot-only Stall need not.
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
  delivery_date DATE NOT NULL,
  status        VARCHAR(24) NOT NULL DEFAULT 'OPEN_FOR_ORDERS'
                  CHECK (status IN (
                    'OPEN_FOR_ORDERS','CLOSED_AT_CUTOFF','PO_SUBMITTED',
                    'GOODS_RECEIVED','DELIVERED','RECONCILED','CANCELLED_LOW_VOLUME'
                  )),
  cancelled_reason VARCHAR(200),
  sortie_count  SMALLINT NOT NULL DEFAULT 2 CHECK (sortie_count BETWEEN 1 AND 4),
  runner_cost_myr NUMERIC(8,2) NOT NULL DEFAULT 0,
  cutoff_at     TIMESTAMPTZ NOT NULL,
  opened_at     TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, delivery_date),
  CHECK (status <> 'CANCELLED_LOW_VOLUME' OR cancelled_reason IS NOT NULL)
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
  -- Delivered can never exceed ordered
  CHECK (delivered_bundles <= ordered_bundles),
  -- DuitNow without proof is not an attestation
  CHECK (payment_status <> 'PAID_DUITNOW' OR payment_proof_url IS NOT NULL),
  -- Fulfilment status must agree with the numbers
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
```

---

## 4. Derived views

```sql
-- ─── Buffer Stock balance: derived, never stored ───────────────────────────
CREATE OR REPLACE VIEW v_buffer_balance AS
SELECT sku_code, vehicle_id, SUM(quantity_bundles)::INT AS bundles_on_hand
FROM stock_movements
GROUP BY sku_code, vehicle_id;

-- ─── Aggregation: cartons to buy, boxes, volume, cash ──────────────────────
CREATE OR REPLACE VIEW v_route_batch_aggregation AS
WITH ordered AS (
  SELECT o.route_batch_id, o.sku_code, SUM(o.ordered_bundles)::INT AS q_ordered
  FROM stall_orders o
  WHERE o.order_type = 'PREORDER'
  GROUP BY o.route_batch_id, o.sku_code
),
prev AS (
  -- Buffer carried INTO this batch. Exclude the batch's own movements by
  -- identity, not by timestamp: a receipt recorded after the declared cutoff
  -- still belongs to this batch and must not inflate the opening balance.
  SELECT b.id AS route_batch_id, s.sku_code,
         COALESCE(SUM(m.quantity_bundles), 0)::INT AS s_prev
  FROM route_batches b
  JOIN routes r ON r.id = b.route_id
  CROSS JOIN skus s
  LEFT JOIN stock_movements m
         ON m.sku_code  = s.sku_code
        AND m.vehicle_id = r.vehicle_id
        AND (m.route_batch_id IS NULL OR m.route_batch_id <> b.id)
  GROUP BY b.id, s.sku_code
)
SELECT
  b.id                        AS route_batch_id,
  sk.sku_code,
  COALESCE(o.q_ordered, 0)    AS q_ordered,
  p.s_prev,
  (CASE WHEN COALESCE(o.q_ordered,0) - p.s_prev <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered,0) - p.s_prev)::NUMERIC / sk.bundles_per_master_carton)::INT
   END)                       AS c_cartons,
  (CASE WHEN COALESCE(o.q_ordered,0) - p.s_prev <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered,0) - p.s_prev)::NUMERIC / sk.bundles_per_master_carton)::INT
   END) * sk.physical_boxes_per_carton AS physical_boxes,
  (CASE WHEN COALESCE(o.q_ordered,0) - p.s_prev <= 0 THEN 0
        ELSE CEIL((COALESCE(o.q_ordered,0) - p.s_prev)::NUMERIC / sk.bundles_per_master_carton)::INT
   END)::NUMERIC * sk.carton_geometric_liters AS geometric_liters,
  rbp.locked_carton_cost,
  rbp.locked_pool_bundle_price
FROM route_batches b
JOIN skus sk ON sk.is_active
LEFT JOIN ordered o ON o.route_batch_id = b.id AND o.sku_code = sk.sku_code
LEFT JOIN prev p    ON p.route_batch_id = b.id AND p.sku_code = sk.sku_code
LEFT JOIN route_batch_prices rbp
       ON rbp.route_batch_id = b.id AND rbp.sku_code = sk.sku_code;

-- ─── Sortie volume check ───────────────────────────────────────────────────
-- Two numbers matter, and they are different:
--   packed_liters         whole cartons this Cluster would need ALONE
--                         (safe upper bound; assumes no carton sharing)
--   packed_liters_shared  its share if Route cartons are split proportionally
--                         across Sorties (an OPTIMISTIC floor, not a plan).
--                         A Sortie still loads whole cartons, so plan against
--                         packed_liters; treat _shared as the theoretical best.
-- Rule: purchase carts at Route level (ADR-0006), then assign each carton to
-- ONE Sortie. Use packed_liters to check the vehicle; use _shared to plan
-- how many cartons move on each run. Never let packed_liters exceed the vehicle.
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
  FROM cluster_demand cd JOIN skus sk USING (sku_code)
)
SELECT pc.route_batch_id,
       pc.trip_number,
       ROUND(SUM(pc.c_cartons  * pc.carton_geometric_liters) / v.packing_efficiency, 1) AS packed_liters,
       ROUND(SUM(pc.q_bundles::NUMERIC / pc.bundles_per_master_carton
                 * pc.carton_geometric_liters) / v.packing_efficiency, 1)               AS packed_liters_shared,
       v.max_cargo_liters,
       (SUM(pc.c_cartons * pc.carton_geometric_liters) / v.packing_efficiency) <= v.max_cargo_liters AS fits
FROM per_cluster pc
JOIN route_batches b ON b.id = pc.route_batch_id
JOIN routes r        ON r.id = b.route_id
JOIN vehicles v      ON v.id = r.vehicle_id
GROUP BY pc.route_batch_id, pc.trip_number, v.max_cargo_liters, v.packing_efficiency;

-- ─── Three margin figures ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_route_batch_pnl AS
SELECT
  b.id AS route_batch_id,
  b.delivery_date,
  SUM(o.ordered_bundles * (pr.locked_pool_bundle_price
      - pr.locked_carton_cost / sk.bundles_per_master_carton))::NUMERIC(12,2) AS forecast_gp_myr,
  SUM(o.delivered_bundles * (pr.locked_pool_bundle_price
      - pr.locked_carton_cost / sk.bundles_per_master_carton))::NUMERIC(12,2) AS realized_gp_myr,
  SUM(o.delivered_bundles * pr.locked_pool_bundle_price)::NUMERIC(12,2) AS gmv_delivered_myr,
  SUM(CASE WHEN o.payment_status <> 'VOIDED' AND o.delivered_bundles > 0
           THEN o.delivered_bundles * pr.locked_pool_bundle_price ELSE 0 END)::NUMERIC(12,2) AS collected_myr,
  b.runner_cost_myr
FROM route_batches b
JOIN stall_orders o        ON o.route_batch_id = b.id
JOIN skus sk               ON sk.sku_code = o.sku_code
JOIN route_batch_prices pr ON pr.route_batch_id = b.id AND pr.sku_code = o.sku_code
GROUP BY b.id, b.delivery_date, b.runner_cost_myr;
```

---

## 5. Functions

```sql
-- ─── Freeze prices at Cutoff ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_freeze_prices(p_batch UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO route_batch_prices
    (route_batch_id, sku_code, wholesaler_price_id,
     locked_carton_cost, locked_pool_bundle_price)
  SELECT p_batch, pp.sku_code, wp.id, wp.carton_cost, pp.pool_bundle_price
  FROM pool_prices pp
  JOIN wholesaler_prices wp ON wp.id = pp.wholesaler_price_id
  WHERE pp.valid_to IS NULL
  ON CONFLICT (route_batch_id, sku_code) DO NOTHING;
END;
$$;

-- ─── Record received cartons → ledger (idempotent) ─────────────────────────
CREATE OR REPLACE FUNCTION fn_receive_po(p_po UUID, p_vehicle UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  n INT := 0;
  inserted INT;
BEGIN
  FOR r IN SELECT po_id, sku_code, cartons_ordered, COALESCE(cartons_received,0) AS rec
           FROM wholesaler_po_lines WHERE po_id = p_po LOOP
    IF r.rec > 0 THEN
      INSERT INTO stock_movements
        (sku_code, vehicle_id, quantity_bundles, movement_type,
         route_batch_id, idempotency_key)
      SELECT r.sku_code, p_vehicle, r.rec * sk.bundles_per_master_carton,
             'PURCHASE_RECEIPT', p.route_batch_id,
             format('PO:%s:%s', p_po, r.sku_code)
      FROM skus sk, wholesaler_pos p
      WHERE sk.sku_code = r.sku_code AND p.id = p_po
      ON CONFLICT (idempotency_key) DO NOTHING;
      GET DIAGNOSTICS inserted = ROW_COUNT;  -- count actual inserts, not loop passes
      n := n + inserted;
    END IF;
  END LOOP;
  UPDATE wholesaler_pos SET received_at = NOW() WHERE id = p_po AND received_at IS NULL;
  RETURN n;
END;
$$;

-- ─── Record a delivery (idempotent by order id) ────────────────────────────
CREATE OR REPLACE FUNCTION fn_record_delivery(p_order UUID, p_delivered INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  o RECORD;
BEGIN
  SELECT * INTO o FROM stall_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order % not found', p_order; END IF;
  IF p_delivered > o.ordered_bundles THEN
    RAISE EXCEPTION 'delivered % exceeds ordered %', p_delivered, o.ordered_bundles;
  END IF;

  UPDATE stall_orders
  SET delivered_bundles = p_delivered,
      fulfilment_status = CASE
        WHEN p_delivered = 0 THEN 'UNCOLLECTED'
        WHEN p_delivered = ordered_bundles THEN 'DELIVERED'
        ELSE 'PARTIAL' END,
      updated_at = NOW()
  WHERE id = p_order;

  IF p_delivered > 0 THEN
    INSERT INTO stock_movements
      (sku_code, vehicle_id, quantity_bundles, movement_type,
       route_batch_id, stall_order_id, idempotency_key)
    SELECT o.sku_code, r.vehicle_id, -p_delivered, 'DELIVERY',
           o.route_batch_id, o.id, format('DEL:%s', o.id)
    FROM route_batches b JOIN routes r ON r.id = b.route_id
    WHERE b.id = o.route_batch_id
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
END;
$$;

-- ─── Reconcile: no buffer writes, because buffer is derived ────────────────
CREATE OR REPLACE FUNCTION fn_reconcile_batch(p_batch UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE route_batches
  SET status = 'RECONCILED', reconciled_at = NOW()
  WHERE id = p_batch AND status <> 'RECONCILED';
END;
$$;
```

`fn_reconcile_batch` **no longer writes buffer state** — that was defect #8. Buffer is a sum over `stock_movements`, so reconciliation is a status transition and nothing else.

---

## 6. Row-level security

v1.0 claimed RLS in frontmatter and defined none. Actual policies:

```sql
ALTER TABLE stalls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stall_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Founder: full access via service role (bypasses RLS by design).
-- Authenticated Founder accounts carry app_metadata.role = 'founder'.
CREATE POLICY founder_all_stalls   ON stalls         FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder');

CREATE POLICY founder_all_orders   ON stall_orders   FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder');

-- Runner: read everything in their assigned Route batch, write only delivery/payment fields
CREATE POLICY runner_read_orders ON stall_orders FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('founder','runner'));

CREATE POLICY runner_update_orders ON stall_orders FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'runner'
         AND (auth.jwt() -> 'app_metadata' ->> 'batch') = route_batch_id::text)
  WITH CHECK (
    -- A runner may not change what was ordered or at what price.
    ordered_bundles = (SELECT o.ordered_bundles FROM stall_orders o WHERE o.id = stall_orders.id)
    AND unit_price_locked = (SELECT o.unit_price_locked FROM stall_orders o WHERE o.id = stall_orders.id)
  );
```

> **Implementation note.** The `WITH CHECK` above expresses the *intent* ("Runner cannot alter quantity or price"). In production this should be enforced with a `SECURITY DEFINER` function plus a column-level `GRANT UPDATE (delivered_bundles, fulfilment_status, payment_status, payment_reference, payment_proof_url, payment_attested_at, attested_by)` — column grants are the robust mechanism, because a self-referencing `WITH CHECK` on a mutating row is fragile. The grant approach is preferred; the policy text is retained to document the rule for reviewers.

---

## 7. Seed data

```sql
INSERT INTO vehicles (label, max_cargo_liters, max_payload_kg, packing_efficiency) VALUES
  ('Myvi',   980,  500, 0.92),   -- rear bench folded AND front passenger seat occupied
  ('Alza',   498,  500, 0.92),   -- third row folded only
  ('Avanza', 1000, 550, 0.92);   -- both rear rows folded

INSERT INTO routes (name, cutoff_day, cutoff_time, delivery_day, sortie_count, vehicle_id)
SELECT 'Premier 101 + Gala City', 'WEDNESDAY', '12:00:00', 'THURSDAY', 1, id
FROM vehicles WHERE label = 'Myvi';

-- Both Clusters share Sortie 1: at 9 Stalls the whole Route fits one vehicle.
-- trip_number is which Sortie serves the Cluster, not a Cluster ordinal (ADR-0016).
INSERT INTO clusters (route_id, name, trip_number, total_addressable_stalls)
SELECT r.id, 'Premier 101', 1, 26 FROM routes r WHERE r.name = 'Premier 101 + Gala City'
UNION ALL
SELECT r.id, 'Gala City',   1, 26 FROM routes r WHERE r.name = 'Premier 101 + Gala City';

INSERT INTO skus (sku_code, name_en, name_bm, name_zh, bundle_unit_name,
                  bundles_per_master_carton, physical_boxes_per_carton,
                  carton_geometric_liters, carton_gross_kg, is_brand_fungible) VALUES
  ('A1','PP Cup 22oz + Flat Lid','Bekas Tapau 22oz + Penutup Rata','22oz 打包杯','Bundle (100 pcs)',10,2,92.50,15.0,TRUE),
  ('A2','PP Cup 16oz + Dome Lid','Bekas Tapau 16oz + Penutup Dome','16oz 打包杯','Bundle (100 pcs)',10,2,84.00,13.0,TRUE),
  ('B1','750ml Rectangular Food Container + Lid','Bekas Makanan 750ml','750ml 打包盒','Bundle (50 pcs)',10,1,76.00,9.0,TRUE),
  ('C1','Kraft Brown Lunch Box','Kotak Makanan Kertas','牛皮午餐盒','Bundle (50 pcs)',12,1,68.50,8.0,TRUE),
  ('D1','Evaporated / Condensed Milk','Susu Sejat / Pekat','炼奶','Bundle (6 tins)',8,1,28.00,18.0,FALSE),
  ('E1','Singlet Oxo-Bag + Straw','Beg Plastik Tapau + Straw','打包袋 + 吸管','Bundle (10 pk)',10,1,35.00,12.0,TRUE);

INSERT INTO wholesalers (name, area) VALUES ('Pending Packaging Supplies','Pending Industrial Estate');

INSERT INTO wholesaler_prices (wholesaler_id, sku_code, carton_cost, valid_from, is_primary)
SELECT w.id, v.sku, v.cost, DATE '2026-10-01', TRUE
FROM wholesalers w,
 (VALUES ('A1',135.00),('A2',120.00),('B1',110.00),
         ('C1',144.00),('D1',160.00),('E1',90.00)) AS v(sku, cost)
WHERE w.name = 'Pending Packaging Supplies';

INSERT INTO pool_prices (sku_code, wholesaler_price_id, pool_bundle_price,
                         observed_retail_bundle_price, valid_from)
SELECT wp.sku_code, wp.id, v.pool, NULL, DATE '2026-10-01'
FROM wholesaler_prices wp
JOIN (VALUES ('A1',15.00),( 'A2',13.50),('B1',12.50),
             ('C1',13.50),('D1',21.00),('E1',10.50))
     AS v(sku,pool) ON v.sku = wp.sku_code
WHERE wp.is_primary;
```

---

## 8. Known unknowns encoded in the schema

| Column | Value | Status |
| :--- | :--- | :--- |
| `skus.physical_boxes_per_carton` for `A1`/`A2` | `2` | ✅ **Resolved by measurement.** Lids ship as a separate box; they do not nest. |
| `skus.carton_geometric_liters` | 92.50 / 84.00 / 76.00 / 68.50 / 28.00 / 35.00 | ✅ **Measured** in the field. The v1.1 estimates (105.80 / 105.80 / 14.00 / 33.70 / 28.60 / 30.50) are deleted. |
| `skus.carton_gross_kg` | 15.0 / 13.0 / 9.0 / 8.0 / 18.0 / 12.0 | `[EST]` — not weighed. Payload is volume-bound, so this does not gate vehicle choice. |
| `routes.runner_rate_per_sortie` | 42.50 | **Still open.** Confirm on the next call whether petrol is included. |
| `vehicles.max_cargo_liters` for Myvi | **980** | Measured, not nominal. 13 cartons of 901.5 L geometric packed to ~980 L and fit **only** with the front passenger seat occupied; the manufacturer's 800 L is the rear-bench-folded figure and is too low for the Founder's actual loading. |
| `vehicles.packing_efficiency` | **0.92** | Measured from 901.5 L geometric packing to ~980 L. v1.1's hard-coded 0.80 overstated packed volume by 15% and would have demanded a second Sortie that was not needed. Two observations is thin evidence — keep it a column, not a constant. |
| `stalls.written_language` | `ms-MY` default | No ASR locale is stored; Hokkien is handled by read-back only (`ADR-0014`). |

---

## 9. Validation record

Every SQL block in this document was executed against **PostgreSQL 16.2** in this order — DDL → views → functions → RLS → seed — with the measured catalogue and a **replay of Batch 1**: 9 Stalls across 2 Clusters, 13 Master Cartons, 1 Sortie, including the one real short delivery (S05 ordered 8 `B1`, received 4).

The replay must reproduce the Phase 1 workbook exactly, or the schema is not modelling the business:

| Check | Workbook | Schema |
| :--- | ---: | ---: |
| Master cartons | 13 | **13** |
| Physical boxes | 18 | **18** |
| Geometric litres | 901.5 | **901.5** |
| Forecast GP (ordered) | RM 173.00 | **RM 173.00** |
| Realized GP (delivered) | RM 167.00 | **RM 167.00** |
| Closing Buffer Stock at cost | RM 183.00 | **RM 183.00** |
| Net Batch Cash Flow | −RM 58.50 | **−RM 58.50** |
| Identity `GP − (close − open Buffer) − runner = Net Cash` | 0.00 | **0.000000** |
| Gate headroom at which the batch fails | +1.14% | **+1.14%** |
| `v_sortie_load.packed_liters` (1 Sortie, 13 cartons) | ~980 L | **979.9 L** |
| `v_sortie_load.fits` against Myvi (980 L @ 0.92) | TRUE | **TRUE** |
| Re-running `fn_receive_po` twice | 0 extra movements | **0 extra** |
| Re-running `fn_record_delivery` twice | 0 extra movements | **0 extra** |
| Re-running `fn_reconcile_batch` twice | buffer unchanged | **unchanged** |

Forecast GP (RM 173.00) exceeds Realized GP (RM 167.00) by exactly RM 6.00 — 4 Bundles of `B1` at RM 1.50. That single difference is the whole point of `ADR-0010`: the number known at Cutoff and the number the gate is judged on are not the same number.

Rejected as intended: DuitNow without `payment_proof_url`; `delivered_bundles > ordered_bundles`; a Stall with `onboarding_status = 'ACTIVE'` and no phone; `trust_tier = 'PREPAY_REQUIRED'`; `fulfilment_status` inconsistent with the bundle counts; any `written_language` outside the three supported codes.

**Two defects were found by running it, not by reading it:**

1. **Tables were declared in an order that could not execute** — `routes` referenced `vehicles` before it existed. Reordered.
2. **`s_prev` was bounded by `cutoff_at`**, so a receipt recorded after the declared cutoff but belonging to the same batch inflated the opening balance — the aggregation then computed 42 cartons instead of 22. Fixed by excluding the batch's own movements **by identity**, not by timestamp.

Both would have shipped. This is the argument for executing DDL rather than reviewing it.

### 9.1 Vehicle finding

`v_sortie_load` reports two numbers per Sortie. For the 14-Stall Route:

| Bound | Sortie 1 | Sortie 2 | Fits Myvi (800 L)? |
| :--- | ---: | ---: | :--- |
| `packed_liters` (whole cartons, no sharing) | 910.8 | 910.8 | ✗ |
| `packed_liters_shared` (proportional split) | 770.1 | 770.1 | ✓ (but see below) |

Sharing is not a real option at this size: 22 cartons total 1,317.7 L geometric, and two 800 L Myvi trips at 80 % fill carry 1,280 L. **The Route is 38 L short of two Myvi trips** — so the 14-Stall Route needs Avanza-class, exactly as `ADR-0015` concluded, and the proportional figure is retained only to show the theoretical floor.

### 9.2 Carton allocation across Sorties

Whole cartons cannot be split, so the real question is how 22 cartons divide between two runs. Enumerating every split and minimising the heavier Sortie:

| Route | Cartons | Balanced split | Sortie loads (packed) | Fits Myvi? |
| :--- | ---: | :--- | :--- | :--- |
| **12-Stall** | 19 | 10 / 9 | 770 L + 768 L | ✓ with **30 L** spare |
| **14-Stall** | 22 | 11 / 11 | 869 L + 778 L | ✗ heavier Sortie over 800 L |

Two consequences the app must honour:

1. **Cartons are allocated, not inherited.** Assigning each Cluster its own rounded cartons gives a 7-Stall Cluster 12 price units and **911 L** — which fits nothing. The purchase is rounded at Route level; the load is then allocated across Sorties.
2. **The 12-Stall Route has almost no headroom.** 30 L is under one `A1` carton (105.8 L). A single Stall upgrading its basket pushes a Myvi Route into three Sorties or onto an Avanza. The capacity guard must therefore be evaluated **per batch**, never configured once.
