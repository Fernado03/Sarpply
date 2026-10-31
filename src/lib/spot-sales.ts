import { pool } from './db';

export interface SpotSaleView {
  stallOrderId: string;
  stallCode: string;
  stallName: string;
  onboardingStatus: string;
  hasPhone: boolean;
  cluster: string;
  skuCode: string;
  nameEn: string;
  deliveredBundles: number;
  unitPrice: string;
  paymentStatus: string;
  runner: string | null;
  handoverId: string;
  totalMyr: string;
  outboundMessageId: string | null;
  receiptStatus: string | null;
  receiptFailure: string | null;
  receiptBody: string | null;
  createdAt: string;
}

export interface ProvisionalLeadView {
  stallId: string;
  stallCode: string;
  stallName: string;
  cluster: string;
  spotOrders: number;
  deliveredBundles: number;
  boughtMyr: string;
  lastBoughtAt: string;
}

export interface SpotSaleInput {
  routeBatchId: string;
  eventKey: string;
  skuCode: string;
  deliveredBundles: number;
  paymentStatus: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  attestedBy: string | null;
  stallId: string | null;
  provisionalLabel: string | null;
}

export async function loadSpotSales(routeBatchId: string): Promise<SpotSaleView[]> {
  const { rows } = await pool.query<SpotSaleView>(
    `SELECT stall_order_id AS "stallOrderId",
            stall_code AS "stallCode",
            stall_name AS "stallName",
            onboarding_status AS "onboardingStatus",
            has_phone AS "hasPhone",
            cluster_name AS cluster,
            sku_code AS "skuCode",
            name_en AS "nameEn",
            delivered_bundles AS "deliveredBundles",
            unit_price_locked::text AS "unitPrice",
            payment_status AS "paymentStatus",
            runner_identity AS runner,
            handover_id AS "handoverId",
            total_myr::text AS "totalMyr",
            outbound_message_id AS "outboundMessageId",
            receipt_status AS "receiptStatus",
            receipt_failure AS "receiptFailure",
            receipt_body AS "receiptBody",
            TO_CHAR(created_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI')
              AS "createdAt"
     FROM v_spot_sale
     WHERE route_batch_id = $1
     ORDER BY created_at, stall_code`,
    [routeBatchId],
  );
  return rows;
}

export async function loadProvisionalLeads(
  routeBatchId: string,
): Promise<ProvisionalLeadView[]> {
  const { rows } = await pool.query<ProvisionalLeadView>(
    `SELECT stall_id AS "stallId",
            stall_code AS "stallCode",
            stall_name AS "stallName",
            cluster_name AS cluster,
            spot_orders AS "spotOrders",
            delivered_bundles AS "deliveredBundles",
            bought_myr::text AS "boughtMyr",
            TO_CHAR(last_bought_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI')
              AS "lastBoughtAt"
     FROM v_provisional_spot_leads
     WHERE route_batch_id = $1
     ORDER BY bought_myr DESC, stall_code`,
    [routeBatchId],
  );
  return rows;
}

export async function createSpotSale(
  input: SpotSaleInput,
): Promise<{ stallOrderId: string; outboundMessageId: string | null; created: boolean }> {
  const { rows } = await pool.query<{
    stallOrderId: string;
    outboundMessageId: string | null;
    created: boolean;
  }>(
    `SELECT stall_order_id AS "stallOrderId",
            outbound_message_id AS "outboundMessageId",
            created
       FROM fn_create_spot_sale($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.routeBatchId,
      input.eventKey,
      input.skuCode,
      input.deliveredBundles,
      input.paymentStatus,
      input.paymentReference,
      input.paymentProofUrl,
      input.attestedBy,
      input.stallId,
      input.provisionalLabel,
    ],
  );
  return rows[0];
}
