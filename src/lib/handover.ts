import { pool } from './db';

export interface HandoverLineView {
  orderId: string;
  stallId: string;
  skuCode: string;
  nameEn: string;
  bundleUnitName: string;
  orderedBundles: number;
  deliveredBundles: number;
  unitPrice: string;
  fulfilmentStatus: string;
  paymentStatus: string;
}

export interface HandoverStallView {
  stallId: string;
  stallCode: string;
  stallName: string;
  cluster: string;
  hasPhone: boolean;
  handoverId: string | null;
  orderedTotalMyr: string;
  handedOverTotalMyr: string;
  recordedTotalMyr: string | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  attestedAt: string | null;
  runner: string | null;
  receiptStatus: string | null;
  receiptFailure: string | null;
  receiptBody: string | null;
  outboundMessageId: string | null;
  lines: HandoverLineView[];
}

export interface RunnerSessionView {
  id: string;
  identity: string;
}

export interface HandoverView {
  stalls: HandoverStallView[];
  runners: RunnerSessionView[];
}

export interface HandoverOrderLine {
  orderId: string;
  skuCode: string;
  orderedBundles: number;
}

export interface RecordedLine {
  stallOrderId: string;
  deliveredBundles: number;
}

export interface HandoverInput {
  routeBatchId: string;
  stallId: string;
  lines: RecordedLine[];
  paymentStatus: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  attestedBy: string | null;
}

export async function loadHandover(routeBatchId: string): Promise<HandoverView> {
  const stalls = await pool.query<Omit<HandoverStallView, 'lines'>>(
    `SELECT stall_id AS "stallId",
            stall_code AS "stallCode",
            stall_name AS "stallName",
            cluster_name AS cluster,
            has_phone AS "hasPhone",
            handover_id AS "handoverId",
            ordered_total_myr::text AS "orderedTotalMyr",
            handed_over_total_myr::text AS "handedOverTotalMyr",
            recorded_total_myr::text AS "recordedTotalMyr",
            payment_status AS "paymentStatus",
            payment_reference AS "paymentReference",
            payment_proof_url AS "paymentProofUrl",
            TO_CHAR(attested_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI')
              AS "attestedAt",
            runner_identity AS runner,
            receipt_status AS "receiptStatus",
            receipt_failure AS "receiptFailure",
            receipt_body AS "receiptBody",
            outbound_message_id AS "outboundMessageId"
     FROM v_stall_handover
     WHERE route_batch_id = $1
     ORDER BY cluster_name, stall_code`,
    [routeBatchId],
  );

  const lines = await pool.query<HandoverLineView>(
    `SELECT o.id AS "orderId",
            o.stall_id AS "stallId",
            o.sku_code AS "skuCode",
            s.name_en AS "nameEn",
            s.bundle_unit_name AS "bundleUnitName",
            o.ordered_bundles AS "orderedBundles",
            o.delivered_bundles AS "deliveredBundles",
            o.unit_price_locked::text AS "unitPrice",
            o.fulfilment_status AS "fulfilmentStatus",
            o.payment_status AS "paymentStatus"
     FROM stall_orders o
     JOIN skus s ON s.sku_code = o.sku_code
     WHERE o.route_batch_id = $1
       AND o.order_type = 'PREORDER'
     ORDER BY o.stall_id, o.sku_code`,
    [routeBatchId],
  );

  const runners = await pool.query<RunnerSessionView>(
    `SELECT id, runner_identity AS identity
     FROM runner_sessions
     WHERE route_batch_id = $1
     ORDER BY runner_identity, id`,
    [routeBatchId],
  );

  const linesByStall = new Map<string, HandoverLineView[]>();
  for (const line of lines.rows) {
    const group = linesByStall.get(line.stallId);
    if (group) group.push(line);
    else linesByStall.set(line.stallId, [line]);
  }

  return {
    stalls: stalls.rows.map((stall) => ({
      ...stall,
      lines: linesByStall.get(stall.stallId) ?? [],
    })),
    runners: runners.rows,
  };
}

export async function loadStallPreorderLines(
  routeBatchId: string,
  stallId: string,
): Promise<HandoverOrderLine[]> {
  const { rows } = await pool.query<HandoverOrderLine>(
    `SELECT id AS "orderId",
            sku_code AS "skuCode",
            ordered_bundles AS "orderedBundles"
     FROM stall_orders
     WHERE route_batch_id = $1
       AND stall_id = $2
       AND order_type = 'PREORDER'
     ORDER BY sku_code`,
    [routeBatchId, stallId],
  );
  return rows;
}

export async function recordStallHandover(
  input: HandoverInput,
): Promise<{ handoverId: string; outboundMessageId: string | null; created: boolean }> {
  const { rows } = await pool.query<{
    handoverId: string;
    outboundMessageId: string | null;
    created: boolean;
  }>(
    `SELECT handover_id AS "handoverId",
            outbound_message_id AS "outboundMessageId",
            created
       FROM fn_record_stall_handover($1, $2, $3::jsonb, $4, $5, $6, $7)`,
    [
      input.routeBatchId,
      input.stallId,
      JSON.stringify(input.lines),
      input.paymentStatus,
      input.paymentReference,
      input.paymentProofUrl,
      input.attestedBy,
    ],
  );
  return rows[0];
}

export function receiptLabel(
  stall: Pick<HandoverStallView, 'hasPhone' | 'receiptStatus'>,
): string {
  if (!stall.hasPhone) return 'No message (no phone)';
  switch (stall.receiptStatus) {
    case 'SENT':
      return 'Sent';
    case 'QUEUED':
      return 'Queued';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Not queued';
  }
}
