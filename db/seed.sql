-- seed.sql — the operating Route, the Golden 6, and one open Route Batch.
-- Deterministic: fixed dates, no NOW() in business facts.

INSERT INTO vehicles (label, max_cargo_liters, max_payload_kg, packing_efficiency) VALUES
  ('Myvi',   980, 500, 0.92),
  ('Alza',   498, 500, 0.92),
  ('Avanza', 1000, 550, 0.92);

INSERT INTO routes (name, cutoff_day, cutoff_time, delivery_day, sortie_count,
                    runner_rate_per_sortie, vehicle_id)
SELECT 'Premier 101 + Gala City', 'WEDNESDAY', '12:00:00', 'THURSDAY', 1, 42.50, id
FROM vehicles WHERE label = 'Myvi';

INSERT INTO clusters (route_id, name, trip_number, total_addressable_stalls)
SELECT r.id, 'Premier 101', 1, 26 FROM routes r WHERE r.name = 'Premier 101 + Gala City'
UNION ALL
SELECT r.id, 'Gala City', 1, 26 FROM routes r WHERE r.name = 'Premier 101 + Gala City';

INSERT INTO stalls (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
                    written_language, trust_tier, onboarding_status)
SELECT v.stall_code, c.id, v.stall_number, v.stall_name, v.phone,
       v.lang, v.tier, 'ACTIVE'
FROM (VALUES
  ('S01','Premier 101','P101-01','Ah Seng Teh C Peng Special','+60128812341','zh-CN','ANCHOR_PRIORITY'),
  ('S02','Premier 101','P101-08','Kak Nor Nasi Lemak & Laksa','+60198765432','ms-MY','COD_APPROVED'),
  ('S03','Premier 101','P101-12','Uncle Wong Kolo Mee','+60168551122','zh-CN','COD_APPROVED'),
  ('S04','Premier 101','P101-15','Borneo Shake & Juice','+60138009988','en','COD_APPROVED'),
  ('S05','Premier 101','P101-22','Abang Zul Burger & Oblong','+60178443321','ms-MY','PROVISIONAL'),
  ('S06','Gala City','GC-03','Gala Haus Bubble Tea','+601123456789','zh-CN','ANCHOR_PRIORITY'),
  ('S07','Gala City','GC-09','Golden Wok Char Kuey Teow','+60148227766','zh-CN','COD_APPROVED'),
  ('S08','Gala City','GC-14','Dapur Maksu Ayam Gepuk','+60198112233','ms-MY','COD_APPROVED'),
  ('S09','Gala City','GC-19','Kopi & Toast Corner','+60168990011','en','COD_APPROVED')
) AS v(stall_code, cluster_name, stall_number, stall_name, phone, lang, tier)
JOIN clusters c ON c.name = v.cluster_name
JOIN routes r ON r.id = c.route_id AND r.name = 'Premier 101 + Gala City';

INSERT INTO skus (sku_code, name_en, name_bm, name_zh, bundle_unit_name,
                  bundles_per_master_carton, physical_boxes_per_carton,
                  carton_geometric_liters, carton_gross_kg, is_brand_fungible) VALUES
  ('A1','PP Cup 22oz + Flat Lid','Bekas Tapau 22oz + Penutup Rata','22oz 打包杯','Bundle (100 pcs)',10,2,92.50,15.0,TRUE),
  ('A2','PP Cup 16oz + Dome Lid','Bekas Tapau 16oz + Penutup Dome','16oz 打包杯','Bundle (100 pcs)',10,2,84.00,13.0,TRUE),
  ('B1','750ml Rectangular Food Container + Lid','Bekas Makanan 750ml','750ml 打包盒','Bundle (50 pcs)',10,1,76.00,9.0,TRUE),
  ('C1','Kraft Brown Lunch Box','Kotak Makanan Kertas','牛皮午餐盒','Bundle (50 pcs)',12,1,68.50,8.0,TRUE),
  ('D1','Evaporated / Condensed Milk','Susu Sejat / Pekat','炼奶','Bundle (6 tins)',8,1,28.00,18.0,FALSE),
  ('E1','Singlet Oxo-Bag + Straw','Beg Plastik Tapau + Straw','打包袋 + 吸管','Bundle (10 pk)',10,1,35.00,12.0,TRUE);

INSERT INTO wholesalers (name, area) VALUES
  ('Pending Packaging Supplies','Pending Industrial Estate');

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
JOIN (VALUES ('A1',15.00),('A2',13.50),('B1',12.50),
             ('C1',13.50),('D1',21.00),('E1',10.50))
     AS v(sku,pool) ON v.sku = wp.sku_code
WHERE wp.is_primary;

-- One open B01-style batch: the console's current week.
-- Delivery Thursday 2026-11-05, Cutoff Wednesday 2026-11-04 12:00 MYT.
INSERT INTO route_batches (route_id, vehicle_id, delivery_date, status, sortie_count,
                           runner_cost_myr, cutoff_at, opened_at)
SELECT r.id, v.id, DATE '2026-11-05', 'OPEN_FOR_ORDERS', 1, 42.50,
       TIMESTAMPTZ '2026-11-04 12:00:00+08', TIMESTAMPTZ '2026-10-29 00:00:00+08'
FROM routes r
JOIN vehicles v ON v.label = 'Myvi'
WHERE r.name = 'Premier 101 + Gala City';

INSERT INTO route_batch_transitions (route_batch_id, transition_type, fired_at)
SELECT id, 'OPENED', opened_at FROM route_batches
WHERE delivery_date = DATE '2026-11-05';
