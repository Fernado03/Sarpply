import { pool } from './db';

export interface BatchView {
  id: string;
  status: string;
  deliveryDate: string;
  cutoffAt: string;
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

export interface ConsoleView {
  batch: BatchView;
  stalls: StallView[];
  orders: OrderView[];
  catalogue: CatalogueView[];
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
  const batchResult = await pool.query<BatchView>(
    `SELECT b.id,
            b.status,
            b.delivery_date::text AS "deliveryDate",
            TO_CHAR(b.cutoff_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI') AS "cutoffAt",
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

  return {
    batch,
    stalls: stallsResult.rows,
    orders: ordersResult.rows,
    catalogue: catalogueResult.rows,
  };
}
