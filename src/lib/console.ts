import { pool } from './db';

export interface BatchView {
  id: string;
  status: string;
  deliveryDate: string;
  cutoffAt: string;
  cutoffFiredAt: string | null;
  routeName: string;
  vehicleLabel: string;
  sortieCount: number;
}

export interface StallView {
  id: string;
  cluster: string;
  stallCode: string;
  stallNumber: string;
  stallName: string;
  trustTier: string;
  writtenLanguage: string;
}

export interface OrderView {
  id: string;
  stallCode: string;
  stallName: string;
  skuCode: string;
  orderType: string;
  orderedBundles: number;
  deliveredBundles: number;
  unitPrice: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  sourceChannel: string;
}

export interface CatalogueView {
  skuCode: string;
  nameEn: string;
  nameBm: string;
  bundleUnitName: string;
  bundlesPerMasterCarton: number;
  poolBundlePrice: string | null;
}

export interface FrozenPriceView {
  skuCode: string;
  nameEn: string;
  bundleUnitName: string;
  cartonCost: string;
  poolBundlePrice: string;
}

export interface MissingStallView {
  stallCode: string;
  stallName: string;
  cluster: string;
}

export interface ConsoleView {
  batch: BatchView;
  stalls: StallView[];
  orders: OrderView[];
  catalogue: CatalogueView[];
  frozenPrices: FrozenPriceView[];
  missingPreorders: MissingStallView[];
}

const NEXT_ACTION: Record<string, string> = {
  OPEN_FOR_ORDERS: 'Collect Preorders until Cutoff',
  CLOSED_AT_CUTOFF: 'Raise the Wholesaler PO',
  PO_SUBMITTED: 'Receive cartons and record cash',
  GOODS_RECEIVED: 'Deliver the Route',
  DELIVERED: 'Reconcile the batch',
  RECONCILED: 'Batch reconciled',
  CANCELLED_LOW_VOLUME: 'Batch cancelled — low volume',
};

export function nextAction(status: string): string {
  return NEXT_ACTION[status] ?? 'Unknown batch state';
}

export function statusLabel(status: string): string {
  return status.toLowerCase().replaceAll('_', ' ');
}

export async function loadConsole(): Promise<ConsoleView | null> {
  // Cutoff is automatic. The dispatcher does this every 15 minutes; the
  // console catch-up keeps the screen honest if the dispatcher was down.
  await pool.query('SELECT fn_fire_due_cutoffs()');

  const batchResult = await pool.query<BatchView>(
    `SELECT b.id,
            b.status,
            b.delivery_date::text AS "deliveryDate",
            TO_CHAR(b.cutoff_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI') AS "cutoffAt",
            (SELECT TO_CHAR(t.fired_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI')
               FROM route_batch_transitions t
              WHERE t.route_batch_id = b.id
                AND t.transition_type = 'CUTOFF_FIRED') AS "cutoffFiredAt",
            r.name AS "routeName",
            v.label AS "vehicleLabel",
            b.sortie_count AS "sortieCount"
     FROM route_batches b
     JOIN routes r ON r.id = b.route_id
     JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.status IN (
       'OPEN_FOR_ORDERS','CLOSED_AT_CUTOFF','PO_SUBMITTED','GOODS_RECEIVED','DELIVERED'
     )
     ORDER BY b.delivery_date ASC
     LIMIT 1`,
  );
  const batch = batchResult.rows[0];
  if (!batch) return null;

  const stallsResult = await pool.query<StallView>(
    `SELECT st.id,
            c.name AS cluster,
            st.stall_code AS "stallCode",
            st.stall_number AS "stallNumber",
            st.stall_name AS "stallName",
            st.trust_tier AS "trustTier",
            st.written_language AS "writtenLanguage"
     FROM stalls st
     JOIN clusters c ON c.id = st.cluster_id
     WHERE c.route_id = (SELECT route_id FROM route_batches WHERE id = $1)
       AND st.onboarding_status = 'ACTIVE'
     ORDER BY c.name, st.stall_number`,
    [batch.id],
  );

  const ordersResult = await pool.query<OrderView>(
    `SELECT o.id,
            st.stall_code AS "stallCode",
            st.stall_name AS "stallName",
            o.sku_code AS "skuCode",
            o.order_type AS "orderType",
            o.ordered_bundles AS "orderedBundles",
            o.delivered_bundles AS "deliveredBundles",
            o.unit_price_locked::text AS "unitPrice",
            o.payment_status AS "paymentStatus",
            o.fulfilment_status AS "fulfilmentStatus",
            o.source_channel AS "sourceChannel"
     FROM stall_orders o
     JOIN stalls st ON st.id = o.stall_id
     WHERE o.route_batch_id = $1
     ORDER BY st.stall_code, o.sku_code`,
    [batch.id],
  );

  const catalogueResult = await pool.query<CatalogueView>(
    `SELECT s.sku_code AS "skuCode",
            s.name_en AS "nameEn",
            s.name_bm AS "nameBm",
            s.bundle_unit_name AS "bundleUnitName",
            s.bundles_per_master_carton AS "bundlesPerMasterCarton",
            pp.pool_bundle_price::text AS "poolBundlePrice"
     FROM skus s
     LEFT JOIN pool_prices pp ON pp.sku_code = s.sku_code AND pp.valid_to IS NULL
     WHERE s.is_active
     ORDER BY s.sku_code`,
  );

  const frozenResult = await pool.query<FrozenPriceView>(
    `SELECT rbp.sku_code AS "skuCode",
            s.name_en AS "nameEn",
            s.bundle_unit_name AS "bundleUnitName",
            rbp.locked_carton_cost::text AS "cartonCost",
            rbp.locked_pool_bundle_price::text AS "poolBundlePrice"
     FROM route_batch_prices rbp
     JOIN skus s ON s.sku_code = rbp.sku_code
     WHERE rbp.route_batch_id = $1
     ORDER BY rbp.sku_code`,
    [batch.id],
  );

  const missingResult = await pool.query<MissingStallView>(
    `SELECT stall_code AS "stallCode",
            stall_name AS "stallName",
            cluster_name AS cluster
     FROM v_batch_missing_preorders
     WHERE route_batch_id = $1
     ORDER BY cluster_name, stall_code`,
    [batch.id],
  );

  return {
    batch,
    stalls: stallsResult.rows,
    orders: ordersResult.rows,
    catalogue: catalogueResult.rows,
    frozenPrices: frozenResult.rows,
    missingPreorders: missingResult.rows,
  };
}
