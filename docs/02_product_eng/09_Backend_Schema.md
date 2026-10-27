---
project: Sarpply
pillar: 09_Backend_Schema
version: 1.0-Production
database: PostgreSQL 15+ / Supabase
features: DDL, Seed Catalog, Aggregation Views, Reconciliation Stored Procedures, RLS
---

# Sarpply — Pillar 9: Production Backend Schema & SQL Logic

## 1. Entity-Relationship Diagram (ERD)

```
+-------------------+       1:N       +-------------------+
|     clusters      |----------------<|      vendors      |
|-------------------|                 |-------------------|
| id (PK)           |                 | id (PK)           |
| name              |                 | cluster_id (FK)   |
| cutoff_day        |                 | stall_number      |
| cutoff_time       |                 | stall_name        |
| delivery_day      |                 | whatsapp_phone    |
| delivery_time     |                 | preferred_language|
+---------+---------+                 | trust_tier        |
          |                           +---------+---------+
          | 1:N                                 |
          v                                     | 1:N
+-------------------+                           |
|   pool_batches    |                           |
|-------------------|                           |
| id (PK)           |                           |
| cluster_id (FK)   |                           |
| delivery_date     |                           |
| status            |                           |
| dispatch_mode     |                           |
| logistics_cost    |                           |
+---------+---------+                           |
          |                                     |
          | 1:N                                 |
          v                                     v
+-------------------------------------------------+
|                  vendor_orders                  |
|-------------------------------------------------|
| id (PK)                                         |
| batch_id (FK -> pool_batches.id)                |
| vendor_id (FK -> vendors.id)                    |
| sku_code (FK -> skus.sku_code)                  |
| bundles_ordered                                 |
| unit_price_locked                               |
| payment_status                                  |
| created_at                                      |
+------------------------+------------------------+
                         | N:1
                         v
+-------------------------------------------------+
|                      skus                       |
|-------------------------------------------------|
| sku_code (PK)                                   |
| name_en / name_bm / name_zh                     |
| vendor_unit_name                                |
| bundles_per_carton                              |
| wholesaler_carton_cost                          |
| pool_bundle_price                               |
| street_retail_bundle_price                      |
| fungibility_score                               |
| current_buffer_bundles                          |
+-------------------------------------------------+
```

---

## 2. Core PostgreSQL / Supabase DDL

This schema preserves the exact table and column specifications from `04_Operations_and_Risk_Mitigation.md` and `01_BMC_and_VPC.md` while adding integrity constraints, indexes, and aggregation views:

```sql
-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CLUSTERS TABLE
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'Premier 101 / Jalan Tun Jugah'
  cutoff_day VARCHAR(15) DEFAULT 'WEDNESDAY',
  cutoff_time TIME DEFAULT '12:00:00',
  delivery_day VARCHAR(15) DEFAULT 'THURSDAY',
  delivery_time TIME DEFAULT '14:30:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VENDORS TABLE
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
  stall_number VARCHAR(50) NOT NULL,
  stall_name VARCHAR(120) NOT NULL,
  whatsapp_phone VARCHAR(30) UNIQUE NOT NULL,
  preferred_language VARCHAR(10) DEFAULT 'ms-MY'
    CHECK (preferred_language IN ('en', 'ms-MY', 'zh-CN', 'nan-TW-kuching-hokkien')),
  trust_tier VARCHAR(20) DEFAULT 'COD_APPROVED'
    CHECK (trust_tier IN ('COD_APPROVED', 'PREPAY_REQUIRED', 'CREDIT_VERIFIED')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cluster_id, stall_number)
);

-- 3. SKUS TABLE (The "Golden 6" Catalog)
CREATE TABLE skus (
  sku_code VARCHAR(10) PRIMARY KEY, -- 'A1', 'A2', 'B1', 'C1', 'D1', 'E1'
  name_en VARCHAR(150) NOT NULL,
  name_bm VARCHAR(150) NOT NULL,
  name_zh VARCHAR(150),
  vendor_unit_name VARCHAR(60) NOT NULL,
  bundles_per_carton INT NOT NULL CHECK (bundles_per_carton > 0),
  wholesaler_carton_cost NUMERIC(10,2) NOT NULL CHECK (wholesaler_carton_cost >= 0),
  pool_bundle_price NUMERIC(10,2) NOT NULL CHECK (pool_bundle_price >= 0),
  street_retail_bundle_price NUMERIC(10,2) NOT NULL CHECK (street_retail_bundle_price >= 0),
  fungibility_score VARCHAR(20) DEFAULT 'HIGH',
  current_buffer_bundles INT NOT NULL DEFAULT 0 CHECK (current_buffer_bundles >= 0)
);

-- 4. POOL BATCHES TABLE
CREATE TABLE pool_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
  delivery_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'POOL_OPEN'
    CHECK (status IN (
      'POOL_OPEN',
      'COLLECTING_ORDERS',
      'POOL_LOCKED',
      'PO_SUBMITTED',
      'WHOLESALER_PICKUP',
      'CROSS_DOCK_SORT',
      'STALL_DELIVERY',
      'BATCH_RECONCILED'
    )),
  dispatch_mode VARCHAR(20) NOT NULL DEFAULT 'FOUNDER'
    CHECK (dispatch_mode IN ('FOUNDER', 'RUNNER')),
  logistics_cost NUMERIC(10,2) NOT NULL DEFAULT 12.00, -- RM 12.00 (FOUNDER) or RM 45.00 (RUNNER)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reconciled_at TIMESTAMPTZ,
  UNIQUE (cluster_id, delivery_date)
);

-- 5. VENDOR ORDERS TABLE
CREATE TABLE vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES pool_batches(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  sku_code VARCHAR(10) NOT NULL REFERENCES skus(sku_code) ON DELETE RESTRICT,
  bundles_ordered INT NOT NULL CHECK (bundles_ordered > 0),
  unit_price_locked NUMERIC(10,2) NOT NULL CHECK (unit_price_locked >= 0),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_COD'
    CHECK (payment_status IN ('PENDING_COD', 'PAID_DUITNOW', 'PAID_CASH', 'UNCOLLECTED_BUFFER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure idempotent upsert per vendor per SKU within a single weekly batch
  UNIQUE (batch_id, vendor_id, sku_code)
);

-- Indexes for high-speed webhook lookups and batch aggregation
CREATE INDEX idx_vendors_whatsapp ON vendors(whatsapp_phone);
CREATE INDEX idx_pool_batches_cluster_status ON pool_batches(cluster_id, status);
CREATE INDEX idx_vendor_orders_batch_sku ON vendor_orders(batch_id, sku_code);
```

---

## 3. Seed Data: Kuching Clusters & Golden 6 SKUs

```sql
-- Seed Beachhead & Expansion Clusters in Kuching
INSERT INTO clusters (name, cutoff_day, cutoff_time, delivery_day, delivery_time)
VALUES
  ('Premier 101 / Jalan Tun Jugah', 'WEDNESDAY', '12:00:00', 'THURSDAY', '14:30:00');

-- Seed the Golden 6 Universal Back-of-House SKUs
INSERT INTO skus (
  sku_code, name_en, name_bm, name_zh, vendor_unit_name,
  bundles_per_carton, wholesaler_carton_cost, pool_bundle_price,
  street_retail_bundle_price, fungibility_score, current_buffer_bundles
) VALUES
  ('A1', 'PP Microwave Box 650ml Rectangular + Lid', 'Bekas Tapau Microwave PP 650ml (Segi Empat)', '650ml 塑料打包盒 (四方)', 'Bundle (50 sets)', 10, 135.00, 15.00, 16.50, 'HIGH', 0),
  ('A2', 'PP Microwave Box 750ml Large + Lid', 'Bekas Tapau Microwave PP 750ml (Besar)', '750ml 大号打包盒', 'Bundle (50 sets)', 10, 148.00, 16.50, 18.00, 'HIGH', 0),
  ('B1', 'Brown Waxed Paper (Kertas Bungkus Large)', 'Kertas Bungkus Coklat (Saiz Besar)', '大号打包油纸', 'Pack (250 sheets)', 12, 102.00, 9.50, 10.80, 'HIGH', 0),
  ('C1', 'HM Singlet Plastic Bag (Size 9x11)', 'Plastik Tapau Tangkai HM (Saiz 9x11)', '9x11 手提塑胶袋', 'Bundle (5 packs)', 10, 110.00, 12.20, 13.50, 'HIGH', 0),
  ('D1', 'Sweetened Condensed Creamer 500g', 'Susu Krimer Manis 500g', '500g 炼奶 (茶水档专用)', 'Half-Carton (24 tins)', 2, 128.00, 69.50, 73.00, 'MEDIUM_HIGH', 0),
  ('E1', 'Commercial Dishwashing Liquid 5L', 'Sabun Cuci Pinggan Pekat 5L', '5L 大桶洗碗精', 'Bottle (5L)', 4, 46.00, 13.00, 15.00, 'HIGH', 0);
```

*Seed data references:* Exact SKU codes, trilingual names, unit names, carton ratios, costs, pool prices, and retail prices from Pillar 1 & Pillar 3.

---

## 4. Analytical Views & Stored Procedures (Aggregation Engine)

### 4.1 View: `v_wholesaler_aggregator` (Replaces Google Sheets Tab)

Implements $Q_{b,i}$, $C_{b,i}$, $S_{b,i,\text{end}}$, and wholesale cash needed per SKU for any batch:

```sql
CREATE OR REPLACE VIEW v_wholesaler_aggregator AS
SELECT
  pb.id AS batch_id,
  pb.delivery_date,
  pb.status AS batch_status,
  s.sku_code,
  s.name_en,
  s.name_bm,
  s.bundles_per_carton AS m_i,
  s.current_buffer_bundles AS s_prev,
  COALESCE(SUM(vo.bundles_ordered), 0)::INT AS q_total_bundles_ordered,
  -- Master Cartons to Buy: MAX(0, CEIL((Q_b,i - S_prev) / M_i))
  GREATEST(
    0,
    CEIL(
      (COALESCE(SUM(vo.bundles_ordered), 0)::NUMERIC - s.current_buffer_bundles::NUMERIC)
      / s.bundles_per_carton::NUMERIC
    )
  )::INT AS c_master_cartons_to_buy,
  -- Ending Buffer Stock: (C_b,i * M_i) + S_prev - Q_b,i
  (
    GREATEST(
      0,
      CEIL(
        (COALESCE(SUM(vo.bundles_ordered), 0)::NUMERIC - s.current_buffer_bundles::NUMERIC)
        / s.bundles_per_carton::NUMERIC
      )
    )::INT * s.bundles_per_carton
    + s.current_buffer_bundles
    - COALESCE(SUM(vo.bundles_ordered), 0)::INT
  ) AS s_ending_buffer_bundles,
  -- Cash Needed for Wholesaler Pickup
  (
    GREATEST(
      0,
      CEIL(
        (COALESCE(SUM(vo.bundles_ordered), 0)::NUMERIC - s.current_buffer_bundles::NUMERIC)
        / s.bundles_per_carton::NUMERIC
      )
    ) * s.wholesaler_carton_cost
  )::NUMERIC(10,2) AS wholesaler_cash_needed_myr,
  -- Gross Spread Earned on SKU
  (
    COALESCE(SUM(vo.bundles_ordered), 0)::NUMERIC
    * (s.pool_bundle_price - (s.wholesaler_carton_cost / s.bundles_per_carton))
  )::NUMERIC(10,2) AS gross_profit_myr
FROM pool_batches pb
CROSS JOIN skus s
LEFT JOIN vendor_orders vo
  ON vo.batch_id = pb.id
  AND vo.sku_code = s.sku_code
  AND vo.payment_status != 'UNCOLLECTED_BUFFER'
GROUP BY
  pb.id, pb.delivery_date, pb.status,
  s.sku_code, s.name_en, s.name_bm,
  s.bundles_per_carton, s.current_buffer_bundles,
  s.wholesaler_carton_cost, s.pool_bundle_price;
```

### 4.2 View: `v_batch_pnl_summary` (Batch Net Contribution Margin $\text{NCM}_b$)

```sql
CREATE OR REPLACE VIEW v_batch_pnl_summary AS
SELECT
  va.batch_id,
  va.delivery_date,
  pb.dispatch_mode,
  SUM(va.q_total_bundles_ordered * s.pool_bundle_price)::NUMERIC(10,2) AS batch_gmv_myr,
  SUM(va.wholesaler_cash_needed_myr)::NUMERIC(10,2) AS total_wholesaler_po_cash_myr,
  SUM(va.gross_profit_myr)::NUMERIC(10,2) AS gross_profit_myr,
  pb.logistics_cost AS logistics_cost_myr,
  (SUM(va.gross_profit_myr) - pb.logistics_cost)::NUMERIC(10,2) AS net_contribution_margin_myr
FROM v_wholesaler_aggregator va
JOIN pool_batches pb ON pb.id = va.batch_id
JOIN skus s ON s.sku_code = va.sku_code
GROUP BY va.batch_id, va.delivery_date, pb.dispatch_mode, pb.logistics_cost;
```

### 4.3 Stored Procedure: `fn_reconcile_batch` (Thursday 15:30 MYT)

Atomically updates `skus.current_buffer_bundles` to $S_{b,i,\text{end}}$ and marks the batch `BATCH_RECONCILED`:

```sql
CREATE OR REPLACE FUNCTION fn_reconcile_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT sku_code, s_ending_buffer_bundles
    FROM v_wholesaler_aggregator
    WHERE batch_id = p_batch_id
  LOOP
    UPDATE skus
    SET current_buffer_bundles = rec.s_ending_buffer_bundles
    WHERE sku_code = rec.sku_code;
  END LOOP;

  UPDATE pool_batches
  SET status = 'BATCH_RECONCILED',
      reconciled_at = NOW()
  WHERE id = p_batch_id;
END;
$$;
```
