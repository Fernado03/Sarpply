import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { expectRejectedIn, query, withTransaction } from './helpers';

interface DeliveredLine {
  stallOrderId: string;
  deliveredBundles: number;
}

interface HandoverOptions {
  reference?: string | null;
  proof?: string | null;
  attestedBy?: string | null;
  handedAt?: string;
}

const HANDED_AT = '2027-01-14T15:00:00+08';

async function vehicleOf(db: Client, routeBatchId: string): Promise<string> {
  const { rows } = await db.query<{ vehicle_id: string }>(
    'SELECT vehicle_id FROM route_batches WHERE id = $1',
    [routeBatchId],
  );
  return rows[0].vehicle_id;
}

async function createBatch(
  db: Client,
  deliveryDate: string,
  status = 'GOODS_RECEIVED',
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO route_batches
       (route_id, vehicle_id, delivery_date, status, sortie_count, runner_cost_myr,
        cutoff_at, opened_at, vehicle_confirmed_at)
     SELECT r.id, v.id, $1, $2, 1, 42.50,
            ($1::date + TIME '12:00') AT TIME ZONE 'Asia/Kuching',
            (($1::date - 7) + TIME '00:00') AT TIME ZONE 'Asia/Kuching',
            NOW()
     FROM routes r, vehicles v
     WHERE r.name = 'Premier 101 + Gala City' AND v.label = 'Alza'
     RETURNING id`,
    [deliveryDate, status],
  );
  return rows[0].id;
}

async function stallIdOf(db: Client, stallCode: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM stalls WHERE stall_code = $1',
    [stallCode],
  );
  return rows[0].id;
}

async function createPreorder(
  db: Client,
  routeBatchId: string,
  stallCode: string,
  skuCode: string,
  orderedBundles: number,
  unitPrice: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO stall_orders
       (route_batch_id, stall_id, sku_code, order_type, source_channel,
        ordered_bundles, unit_price_locked)
     SELECT $1, st.id, $2, 'PREORDER', 'TEXT', $3, $4
     FROM stalls st
     WHERE st.stall_code = $5
     RETURNING id`,
    [routeBatchId, skuCode, orderedBundles, unitPrice, stallCode],
  );
  return rows[0].id;
}

async function receiveStock(
  db: Client,
  routeBatchId: string,
  skuCode: string,
  bundles: number,
  unitCost: string,
): Promise<void> {
  await db.query(
    `SELECT fn_post_stock_movement(
       p_sku_code => $1,
       p_vehicle_id => $2,
       p_quantity_bundles => $3,
       p_movement_type => 'PURCHASE_RECEIPT',
       p_idempotency_key => $4,
       p_unit_cost_myr => $5,
       p_route_batch_id => $6
     )`,
    [
      skuCode,
      await vehicleOf(db, routeBatchId),
      bundles,
      `TEST:${routeBatchId}:${skuCode}:RECEIPT`,
      unitCost,
      routeBatchId,
    ],
  );
}

async function createRunnerSession(db: Client, routeBatchId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO runner_sessions
       (runner_identity, route_batch_id, shift_starts_at, shift_ends_at, expires_at)
     VALUES ('Test Runner', $1, NOW(), NOW() + INTERVAL '4 hours', NOW() + INTERVAL '4 hours')
     RETURNING id`,
    [routeBatchId],
  );
  return rows[0].id;
}

async function recordHandover(
  db: Client,
  routeBatchId: string,
  stallId: string,
  lines: DeliveredLine[],
  paymentStatus: string,
  options: HandoverOptions = {},
): Promise<{ handover_id: string; outbound_message_id: string | null; created: boolean }> {
  const { rows } = await db.query<{
    handover_id: string;
    outbound_message_id: string | null;
    created: boolean;
  }>(
    `SELECT handover_id, outbound_message_id, created
       FROM fn_record_stall_handover($1, $2, $3::jsonb, $4, $5, $6, $7, $8)`,
    [
      routeBatchId,
      stallId,
      JSON.stringify(lines),
      paymentStatus,
      options.reference ?? null,
      options.proof ?? null,
      options.attestedBy ?? null,
      options.handedAt ?? HANDED_AT,
    ],
  );
  return rows[0];
}

async function recordHandoverSql(
  db: Client,
  routeBatchId: string,
  stallId: string,
  lines: DeliveredLine[],
  paymentStatus: string,
  options: HandoverOptions = {},
): Promise<Error> {
  return expectRejectedIn(
    db,
    `SELECT handover_id, created
       FROM fn_record_stall_handover($1, $2, $3::jsonb, $4, $5, $6, $7, $8)`,
    [
      routeBatchId,
      stallId,
      JSON.stringify(lines),
      paymentStatus,
      options.reference ?? null,
      options.proof ?? null,
      options.attestedBy ?? null,
      options.handedAt ?? HANDED_AT,
    ],
  );
}

async function insertPriceSnapshot(
  db: Client,
  routeBatchId: string,
  skuCode: string,
): Promise<void> {
  await db.query(
    `INSERT INTO route_batch_prices
       (route_batch_id, sku_code, wholesaler_price_id,
        locked_carton_cost, locked_pool_bundle_price)
     SELECT $1, wp.sku_code, wp.id, wp.carton_cost, pp.pool_bundle_price
     FROM wholesaler_prices wp
     JOIN pool_prices pp ON pp.sku_code = wp.sku_code AND pp.valid_to IS NULL
     WHERE wp.sku_code = $2 AND wp.valid_to IS NULL`,
    [routeBatchId, skuCode],
  );
}

async function createProvisionalStall(db: Client): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO stalls
       (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
        written_language, trust_tier, onboarding_status)
     SELECT 'P99', c.id, 'GC-P99', 'Walk-up Stall', NULL,
            'ms-MY', 'PROVISIONAL', 'PROVISIONAL_SPOT'
     FROM clusters c
     WHERE c.name = 'Gala City'
     RETURNING id`,
  );
  return rows[0].id;
}

describe('Stall handover', () => {
  it('records a partial handover, posts signed movement and queues one receipt', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-01-14');
      const stallId = await stallIdOf(db, 'S01');
      const a1 = await createPreorder(db, batchId, 'S01', 'A1', 5, '15.00');
      const c1 = await createPreorder(db, batchId, 'S01', 'C1', 2, '13.50');
      await receiveStock(db, batchId, 'A1', 10, '13.50');
      await receiveStock(db, batchId, 'C1', 10, '12.00');
      const sessionId = await createRunnerSession(db, batchId);

      const missingAttester = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        {},
      );
      expect(missingAttester.message).toContain('needs the attesting Runner session');

      const expired = await db.query<{ id: string }>(
        `INSERT INTO runner_sessions
           (runner_identity, route_batch_id, shift_starts_at, shift_ends_at, expires_at)
         VALUES ('Expired Runner', $1, NOW() - INTERVAL '8 hours',
                 NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour')
         RETURNING id`,
        [batchId],
      );
      const expiredAttester = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: expired.rows[0].id },
      );
      expect(expiredAttester.message).toContain('has expired');

      const first = await recordHandover(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(first.created).toBe(true);
      expect(first.outbound_message_id).not.toBeNull();

      const orders = await db.query<{
        sku_code: string;
        ordered_bundles: number;
        delivered_bundles: number;
        unit_price_locked: string;
        fulfilment_status: string;
        payment_status: string;
        payment_reference: string | null;
        payment_proof_url: string | null;
        attested: boolean;
        attested_by: string | null;
      }>(
        `SELECT sku_code, ordered_bundles, delivered_bundles,
                unit_price_locked::text AS unit_price_locked,
                fulfilment_status, payment_status, payment_reference,
                payment_proof_url, payment_attested_at IS NOT NULL AS attested,
                attested_by
           FROM stall_orders
          WHERE route_batch_id = $1
          ORDER BY sku_code`,
        [batchId],
      );
      expect(orders.rows).toEqual([
        {
          sku_code: 'A1',
          ordered_bundles: 5,
          delivered_bundles: 3,
          unit_price_locked: '15.00',
          fulfilment_status: 'PARTIAL',
          payment_status: 'PAID_CASH',
          payment_reference: null,
          payment_proof_url: null,
          attested: true,
          attested_by: sessionId,
        },
        {
          sku_code: 'C1',
          ordered_bundles: 2,
          delivered_bundles: 2,
          unit_price_locked: '13.50',
          fulfilment_status: 'DELIVERED',
          payment_status: 'PAID_CASH',
          payment_reference: null,
          payment_proof_url: null,
          attested: true,
          attested_by: sessionId,
        },
      ]);

      const movements = await db.query<{
        sku_code: string;
        quantity_bundles: number;
        movement_type: string;
        idempotency_key: string;
      }>(
        `SELECT sku_code, quantity_bundles, movement_type, idempotency_key
           FROM stock_movements
          WHERE route_batch_id = $1 AND movement_type = 'DELIVERY'
          ORDER BY sku_code`,
        [batchId],
      );
      expect(movements.rows).toEqual([
        {
          sku_code: 'A1',
          quantity_bundles: -3,
          movement_type: 'DELIVERY',
          idempotency_key: `HANDOVER:${a1}`,
        },
        {
          sku_code: 'C1',
          quantity_bundles: -2,
          movement_type: 'DELIVERY',
          idempotency_key: `HANDOVER:${c1}`,
        },
      ]);

      const handover = (await db.query<{
        id: string;
        total_myr: string;
        payment_status: string;
        outbound_message_id: string;
      }>(
        `SELECT id, total_myr::text AS total_myr, payment_status,
                outbound_message_id
           FROM stall_handovers
          WHERE route_batch_id = $1`,
        [batchId],
      )).rows[0];
      expect(handover.total_myr).toBe('72.00');
      expect(handover.payment_status).toBe('PAID_CASH');
      expect(handover.outbound_message_id).not.toBeNull();

      const messages = await db.query<{
        to_phone: string;
        status: string;
        body: string;
        dedupe_key: string;
      }>(
        `SELECT to_phone, status, body, dedupe_key
           FROM outbound_messages
          WHERE route_batch_id = $1`,
        [batchId],
      );
      expect(messages.rows).toHaveLength(1);
      expect(messages.rows[0].status).toBe('QUEUED');
      expect(messages.rows[0].to_phone).toBe('+60128812341');
      expect(messages.rows[0].dedupe_key).toBe(
        `handover:PREORDER:${batchId}:${stallId}`,
      );
      expect(messages.rows[0].body).toContain('TOTAL: RM 72.00');
      expect(messages.rows[0].body).toContain('Bayaran: TUNAI');

      const batch = (await db.query<{ status: string }>(
        'SELECT status FROM route_batches WHERE id = $1',
        [batchId],
      )).rows[0];
      expect(batch.status).toBe('DELIVERED');

      const retry = await recordHandover(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(retry).toEqual({
        handover_id: handover.id,
        outbound_message_id: handover.outbound_message_id,
        created: false,
      });

      const retryWithoutSession = await recordHandover(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
      );
      expect(retryWithoutSession).toEqual({
        handover_id: handover.id,
        outbound_message_id: handover.outbound_message_id,
        created: false,
      });

      const otherSession = await createRunnerSession(db, batchId);
      const changedAttester = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 3 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: otherSession },
      );
      expect(changedAttester.message).toContain(
        'already attested by a different Runner session',
      );

      const counts = (await db.query<{ movements: string; messages: string }>(
        `SELECT (SELECT COUNT(*) FROM stock_movements
                  WHERE route_batch_id = $1 AND movement_type = 'DELIVERY')::text AS movements,
                (SELECT COUNT(*) FROM outbound_messages
                  WHERE route_batch_id = $1)::text AS messages`,
        [batchId],
      )).rows[0];
      expect(counts).toEqual({ movements: '2', messages: '1' });

      const changed = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [
          { stallOrderId: a1, deliveredBundles: 4 },
          { stallOrderId: c1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(changed.message).toContain('already recorded');
    });
  });

  it('refuses more than ordered, more than on hand and an incomplete attestation', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-01-21');
      const stallId = await stallIdOf(db, 'S02');
      const a1 = await createPreorder(db, batchId, 'S02', 'A1', 5, '15.00');
      const sessionId = await createRunnerSession(db, batchId);
      await receiveStock(db, batchId, 'A1', 2, '13.50');

      const overOrder = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 6 }],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(overOrder.message).toContain('more than ordered');

      const overStock = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 5 }],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(overStock.message).toContain('cannot deliver 5 Bundles of A1');

      const noReference = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'PAID_DUITNOW',
        { proof: 'https://proof.example/1', attestedBy: sessionId },
      );
      expect(noReference.message).toContain('requires both a payment reference and a proof link');

      const noProof = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'PAID_DUITNOW',
        { reference: 'DUIT-1', attestedBy: sessionId },
      );
      expect(noProof.message).toContain('requires both a payment reference and a proof link');

      const voided = await recordHandoverSql(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'VOIDED',
        { attestedBy: sessionId },
      );
      expect(voided.message).toContain('VOIDED is a correction');

      const accepted = await recordHandover(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'PAID_DUITNOW',
        {
          reference: 'DUIT-1',
          proof: 'https://proof.example/1',
          attestedBy: sessionId,
        },
      );
      expect(accepted.created).toBe(true);

      const order = (await db.query<{
        fulfilment_status: string;
        delivered_bundles: number;
        payment_reference: string;
        payment_proof_url: string;
      }>(
        `SELECT fulfilment_status, delivered_bundles, payment_reference, payment_proof_url
           FROM stall_orders WHERE id = $1`,
        [a1],
      )).rows[0];
      expect(order).toEqual({
        fulfilment_status: 'PARTIAL',
        delivered_bundles: 2,
        payment_reference: 'DUIT-1',
        payment_proof_url: 'https://proof.example/1',
      });
    });
  });

  it('records an uncollected order with no movement and keeps the buffer', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-01-28');
      const stallId = await stallIdOf(db, 'S03');
      const a1 = await createPreorder(db, batchId, 'S03', 'A1', 4, '15.00');
      const sessionId = await createRunnerSession(db, batchId);
      await receiveStock(db, batchId, 'A1', 4, '13.50');

      const before = (await db.query<{ bundles: number }>(
        `SELECT COALESCE(SUM(quantity_bundles), 0)::int AS bundles
           FROM stock_movements
          WHERE sku_code = 'A1' AND vehicle_id = $1`,
        [await vehicleOf(db, batchId)],
      )).rows[0];

      await recordHandover(
        db,
        batchId,
        stallId,
        [{ stallOrderId: a1, deliveredBundles: 0 }],
        'UNPAID',
        { attestedBy: sessionId },
      );

      const order = (await db.query<{
        fulfilment_status: string;
        delivered_bundles: number;
        payment_status: string;
      }>(
        `SELECT fulfilment_status, delivered_bundles, payment_status
           FROM stall_orders WHERE id = $1`,
        [a1],
      )).rows[0];
      expect(order).toEqual({
        fulfilment_status: 'UNCOLLECTED',
        delivered_bundles: 0,
        payment_status: 'UNPAID',
      });

      const after = (await db.query<{ bundles: number; deliveries: string }>(
        `SELECT COALESCE(SUM(quantity_bundles), 0)::int AS bundles,
                (SELECT COUNT(*) FROM stock_movements
                  WHERE route_batch_id = $2 AND movement_type = 'DELIVERY')::text AS deliveries
           FROM stock_movements
          WHERE sku_code = 'A1' AND vehicle_id = $1`,
        [await vehicleOf(db, batchId), batchId],
      )).rows[0];
      expect(after).toEqual({ bundles: before.bundles, deliveries: '0' });

      const message = (await db.query<{ body: string }>(
        `SELECT body FROM outbound_messages WHERE route_batch_id = $1`,
        [batchId],
      )).rows[0];
      expect(message.body).toContain('TOTAL: RM 0.00');
      expect(message.body).toContain('Bayaran: BELUM DIBAYAR');
    });
  });

  it('counts delivered unpaid goods separately from collected cash', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-02-04');
      const cashStall = await stallIdOf(db, 'S04');
      const unpaidStall = await stallIdOf(db, 'S05');
      const a1 = await createPreorder(db, batchId, 'S04', 'A1', 3, '15.00');
      const c1 = await createPreorder(db, batchId, 'S05', 'C1', 2, '13.50');
      await receiveStock(db, batchId, 'A1', 3, '13.50');
      await receiveStock(db, batchId, 'C1', 2, '12.00');
      await insertPriceSnapshot(db, batchId, 'A1');
      await insertPriceSnapshot(db, batchId, 'C1');
      const sessionId = await createRunnerSession(db, batchId);

      await recordHandover(
        db,
        batchId,
        cashStall,
        [{ stallOrderId: a1, deliveredBundles: 3 }],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      await recordHandover(
        db,
        batchId,
        unpaidStall,
        [{ stallOrderId: c1, deliveredBundles: 2 }],
        'UNPAID',
        { attestedBy: sessionId },
      );

      const pnl = (await db.query<{
        gmv: string;
        collected: string;
        uncollected: string;
      }>(
        `SELECT gmv_delivered_myr::text AS gmv,
                collected_myr::text AS collected,
                uncollected_goods_myr::text AS uncollected
           FROM v_route_batch_pnl
          WHERE route_batch_id = $1`,
        [batchId],
      )).rows[0];
      expect(pnl).toEqual({ gmv: '72.00', collected: '45.00', uncollected: '27.00' });
    });
  });

  it('records an internal audit result for a phone-less Provisional Stall', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-02-11');
      const provisionalStall = await createProvisionalStall(db);
      const a1 = await createPreorder(db, batchId, 'P99', 'A1', 2, '15.00');
      await receiveStock(db, batchId, 'A1', 2, '13.50');
      const sessionId = await createRunnerSession(db, batchId);

      await recordHandover(
        db,
        batchId,
        provisionalStall,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'PAID_CASH',
        { attestedBy: sessionId },
      );

      const row = (await db.query<{
        has_phone: boolean;
        awaiting_handover: boolean;
        recorded_total_myr: string;
        payment_status: string;
        receipt_status: string | null;
        receipt_body: string | null;
        outbound_message_id: string | null;
      }>(
        `SELECT has_phone, awaiting_handover, recorded_total_myr::text AS recorded_total_myr,
                payment_status, receipt_status, receipt_body, outbound_message_id
           FROM v_stall_handover
          WHERE route_batch_id = $1 AND stall_id = $2`,
        [batchId, provisionalStall],
      )).rows[0];
      expect(row).toEqual({
        has_phone: false,
        awaiting_handover: false,
        recorded_total_myr: '30.00',
        payment_status: 'PAID_CASH',
        receipt_status: null,
        receipt_body: null,
        outbound_message_id: null,
      });

      const messages = (await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM outbound_messages WHERE stall_id = $1`,
        [provisionalStall],
      )).rows[0];
      expect(messages.count).toBe('0');
    });
  });

  it('refuses a handover before goods are received and an incomplete line set', async () => {
    await withTransaction(async (db) => {
      const cutBatch = await createBatch(db, '2027-02-18', 'PO_SUBMITTED');
      const cutStall = await stallIdOf(db, 'S06');
      const a1 = await createPreorder(db, cutBatch, 'S06', 'A1', 2, '15.00');
      const c1 = await createPreorder(db, cutBatch, 'S06', 'C1', 1, '13.50');
      const sessionId = await createRunnerSession(db, cutBatch);

      const early = await recordHandoverSql(
        db,
        cutBatch,
        cutStall,
        [
          { stallOrderId: a1, deliveredBundles: 2 },
          { stallOrderId: c1, deliveredBundles: 1 },
        ],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(early.message).toContain('cannot record a handover');

      const incomplete = await recordHandoverSql(
        db,
        cutBatch,
        cutStall,
        [{ stallOrderId: a1, deliveredBundles: 2 }],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(incomplete.message).toContain('must list every Preorder line');

      const duplicate = await recordHandoverSql(
        db,
        cutBatch,
        cutStall,
        [
          { stallOrderId: a1, deliveredBundles: 2 },
          { stallOrderId: a1, deliveredBundles: 2 },
        ],
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(duplicate.message).toContain('more than once');
    });
  });
});
