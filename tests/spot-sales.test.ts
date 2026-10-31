import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { expectRejectedIn, withTransaction } from './helpers';

interface SpotSaleOptions {
  reference?: string | null;
  proof?: string | null;
  attestedBy?: string | null;
  stallId?: string | null;
  label?: string | null;
  handedAt?: string;
}

interface SpotSaleResult {
  stall_order_id: string;
  stall_id: string;
  handover_id: string;
  outbound_message_id: string | null;
  created: boolean;
}

const HANDED_AT = '2027-03-04T15:00:00+08';

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

async function createSpotSale(
  db: Client,
  routeBatchId: string,
  eventKey: string,
  skuCode: string,
  deliveredBundles: number,
  paymentStatus: string,
  options: SpotSaleOptions = {},
): Promise<SpotSaleResult> {
  const { rows } = await db.query<SpotSaleResult>(
    `SELECT stall_order_id, stall_id, handover_id, outbound_message_id, created
       FROM fn_create_spot_sale($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      routeBatchId,
      eventKey,
      skuCode,
      deliveredBundles,
      paymentStatus,
      options.reference ?? null,
      options.proof ?? null,
      options.attestedBy ?? null,
      options.stallId ?? null,
      options.label ?? null,
      options.handedAt ?? HANDED_AT,
    ],
  );
  return rows[0];
}

async function createSpotSaleSql(
  db: Client,
  routeBatchId: string,
  eventKey: string,
  skuCode: string,
  deliveredBundles: number,
  paymentStatus: string,
  options: SpotSaleOptions = {},
): Promise<Error> {
  return expectRejectedIn(
    db,
    `SELECT stall_order_id FROM fn_create_spot_sale(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      routeBatchId,
      eventKey,
      skuCode,
      deliveredBundles,
      paymentStatus,
      options.reference ?? null,
      options.proof ?? null,
      options.attestedBy ?? null,
      options.stallId ?? null,
      options.label ?? null,
      options.handedAt ?? HANDED_AT,
    ],
  );
}

describe('Spot Sale', () => {
  it('records a walk-up sale as a SPOT order, prices it frozen and retries once', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-03-04');
      const preorderId = await createPreorder(db, batchId, 'S01', 'A1', 5, '15.00');
      await receiveStock(db, batchId, 'A1', 10, '13.50');
      await insertPriceSnapshot(db, batchId, 'A1');
      const sessionId = await createRunnerSession(db, batchId);

      const before = (await db.query<{
        ordered_bundles: number;
        unit_price_locked: string;
      }>(
        `SELECT ordered_bundles, unit_price_locked::text AS unit_price_locked
           FROM stall_orders WHERE id = $1`,
        [preorderId],
      )).rows[0];

      const sale = await createSpotSale(db, batchId, 'walk-up-1', 'A1', 2, 'PAID_CASH', {
        label: 'Ah Hock Walk-up',
        attestedBy: sessionId,
      });
      expect(sale.created).toBe(true);
      expect(sale.outbound_message_id).toBeNull();

      const stall = (await db.query<{
        stall_code: string;
        stall_name: string;
        whatsapp_phone: string | null;
        onboarding_status: string;
        is_active: boolean;
      }>(
        `SELECT stall_code, stall_name, whatsapp_phone, onboarding_status, is_active
           FROM stalls WHERE id = $1`,
        [sale.stall_id],
      )).rows[0];
      expect(stall).toEqual({
        stall_code: expect.stringMatching(/^SPOT-[0-9A-F]{5}$/),
        stall_name: 'Ah Hock Walk-up',
        whatsapp_phone: null,
        onboarding_status: 'PROVISIONAL_SPOT',
        is_active: true,
      });

      const order = (await db.query<{
        id: string;
        stall_id: string;
        order_type: string;
        source_channel: string;
        ordered_bundles: number;
        delivered_bundles: number;
        unit_price_locked: string;
        payment_status: string;
        fulfilment_status: string;
        attested_by: string | null;
      }>(
        `SELECT id, stall_id, order_type, source_channel, ordered_bundles,
                delivered_bundles, unit_price_locked::text AS unit_price_locked,
                payment_status, fulfilment_status, attested_by
           FROM stall_orders WHERE id = $1`,
        [sale.stall_order_id],
      )).rows[0];
      expect(order).toEqual({
        id: sale.stall_order_id,
        stall_id: sale.stall_id,
        order_type: 'SPOT',
        source_channel: 'STALL',
        ordered_bundles: 2,
        delivered_bundles: 2,
        unit_price_locked: '15.00',
        payment_status: 'PAID_CASH',
        fulfilment_status: 'DELIVERED',
        attested_by: sessionId,
      });

      const movement = (await db.query<{
        sku_code: string;
        quantity_bundles: number;
        unit_cost_myr: string;
        movement_type: string;
        idempotency_key: string;
      }>(
        `SELECT sku_code, quantity_bundles, unit_cost_myr::text AS unit_cost_myr,
                movement_type, idempotency_key
           FROM stock_movements
          WHERE stall_order_id = $1`,
        [sale.stall_order_id],
      )).rows[0];
      expect(movement).toEqual({
        sku_code: 'A1',
        quantity_bundles: -2,
        unit_cost_myr: '13.500000',
        movement_type: 'SPOT_SALE',
        idempotency_key: 'SPOT:walk-up-1',
      });

      const handover = (await db.query<{
        handover_type: string;
        dedupe_key: string;
        total_myr: string;
        payment_status: string;
        outbound_message_id: string | null;
      }>(
        `SELECT handover_type, dedupe_key, total_myr::text AS total_myr,
                payment_status, outbound_message_id
           FROM stall_handovers WHERE id = $1`,
        [sale.handover_id],
      )).rows[0];
      expect(handover).toEqual({
        handover_type: 'SPOT',
        dedupe_key: 'SPOT:walk-up-1',
        total_myr: '30.00',
        payment_status: 'PAID_CASH',
        outbound_message_id: null,
      });

      const after = (await db.query<{
        ordered_bundles: number;
        unit_price_locked: string;
      }>(
        `SELECT ordered_bundles, unit_price_locked::text AS unit_price_locked
           FROM stall_orders WHERE id = $1`,
        [preorderId],
      )).rows[0];
      expect(after).toEqual(before);

      const pnl = (await db.query<{
        forecast_gp: string;
        realized_gp: string;
        gmv: string;
      }>(
        `SELECT forecast_gp_myr::text AS forecast_gp,
                realized_gp_myr::text AS realized_gp,
                gmv_delivered_myr::text AS gmv
           FROM v_route_batch_pnl WHERE route_batch_id = $1`,
        [batchId],
      )).rows[0];
      expect(pnl).toEqual({ forecast_gp: '7.50', realized_gp: '3.00', gmv: '30.00' });

      const retry = await createSpotSale(db, batchId, 'walk-up-1', 'A1', 2, 'PAID_CASH', {
        label: 'Ah Hock Walk-up',
        attestedBy: sessionId,
      });
      expect(retry).toEqual({ ...sale, created: false });

      const counts = (await db.query<{
        orders: string;
        handovers: string;
        movements: string;
        provisional: string;
      }>(
        `SELECT (SELECT COUNT(*) FROM stall_orders
                  WHERE route_batch_id = $1 AND order_type = 'SPOT')::text AS orders,
                (SELECT COUNT(*) FROM stall_handovers
                  WHERE route_batch_id = $1)::text AS handovers,
                (SELECT COUNT(*) FROM stock_movements
                  WHERE route_batch_id = $1 AND movement_type = 'SPOT_SALE')::text
                  AS movements,
                (SELECT COUNT(*) FROM stalls
                  WHERE stall_name = 'Ah Hock Walk-up')::text AS provisional`,
        [batchId],
      )).rows[0];
      expect(counts).toEqual({ orders: '1', handovers: '1', movements: '1', provisional: '1' });

      const changed = await createSpotSaleSql(
        db,
        batchId,
        'walk-up-1',
        'A1',
        3,
        'PAID_CASH',
        { label: 'Ah Hock Walk-up', attestedBy: sessionId },
      );
      expect(changed.message).toContain('already recorded');
    });
  });

  it('echoes a receipt for a registered Stall and keeps the provisional buyer silent', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-03-11');
      await receiveStock(db, batchId, 'A1', 10, '13.50');
      await insertPriceSnapshot(db, batchId, 'A1');
      const sessionId = await createRunnerSession(db, batchId);
      const s02 = await stallIdOf(db, 'S02');

      const sale = await createSpotSale(db, batchId, 'walk-up-2', 'A1', 3, 'PAID_CASH', {
        stallId: s02,
        attestedBy: sessionId,
      });
      expect(sale.stall_id).toBe(s02);
      expect(sale.outbound_message_id).not.toBeNull();

      const message = (await db.query<{
        to_phone: string;
        status: string;
        body: string;
        dedupe_key: string;
      }>(
        `SELECT to_phone, status, body, dedupe_key
           FROM outbound_messages WHERE id = $1`,
        [sale.outbound_message_id],
      )).rows[0];
      expect(message.to_phone).toBe('+60198765432');
      expect(message.status).toBe('QUEUED');
      expect(message.dedupe_key).toBe('spot:walk-up-2');
      expect(message.body).toContain('TOTAL: RM 45.00');

      const order = (await db.query<{ ordered_bundles: number; delivered_bundles: number }>(
        'SELECT ordered_bundles, delivered_bundles FROM stall_orders WHERE id = $1',
        [sale.stall_order_id],
      )).rows[0];
      expect(order).toEqual({ ordered_bundles: 3, delivered_bundles: 3 });

      const provisional = (await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM stalls
          WHERE stall_code LIKE 'SPOT-%'`,
      )).rows[0];
      expect(provisional.count).toBe('0');
    });
  });

  it('lists Provisional Stalls that bought but never Preordered', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-03-18');
      await receiveStock(db, batchId, 'A1', 10, '13.50');
      await insertPriceSnapshot(db, batchId, 'A1');
      const sessionId = await createRunnerSession(db, batchId);

      const sale = await createSpotSale(db, batchId, 'walk-up-3', 'A1', 2, 'PAID_CASH', {
        label: 'Kak Timah Walk-up',
        attestedBy: sessionId,
      });

      const leads = (await db.query<{
        stall_id: string;
        stall_code: string;
        stall_name: string;
        spot_orders: number;
        delivered_bundles: number;
        bought_myr: string;
      }>(
        `SELECT stall_id, stall_code, stall_name, spot_orders,
                delivered_bundles, bought_myr::text AS bought_myr
           FROM v_provisional_spot_leads WHERE route_batch_id = $1`,
        [batchId],
      )).rows;
      expect(leads).toEqual([
        {
          stall_id: sale.stall_id,
          stall_code: expect.stringMatching(/^SPOT-/),
          stall_name: 'Kak Timah Walk-up',
          spot_orders: 1,
          delivered_bundles: 2,
          bought_myr: '30.00',
        },
      ]);

      const messages = (await db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM outbound_messages WHERE stall_id = $1',
        [sale.stall_id],
      )).rows[0];
      expect(messages.count).toBe('0');
    });
  });

  it('refuses an early sale, a missing price, overdraw and an incomplete attestation', async () => {
    await withTransaction(async (db) => {
      const earlyBatch = await createBatch(db, '2027-03-25', 'PO_SUBMITTED');
      const earlySession = await createRunnerSession(db, earlyBatch);
      const early = await createSpotSaleSql(db, earlyBatch, 'early-1', 'A1', 1, 'PAID_CASH', {
        label: 'Early Walk-up',
        attestedBy: earlySession,
      });
      expect(early.message).toContain('cannot record a Spot Sale');

      const batchId = await createBatch(db, '2027-04-01');
      const sessionId = await createRunnerSession(db, batchId);

      const noPrice = await createSpotSaleSql(db, batchId, 'no-price', 'A1', 1, 'PAID_CASH', {
        label: 'Walk-up',
        attestedBy: sessionId,
      });
      expect(noPrice.message).toContain('no frozen price');

      await insertPriceSnapshot(db, batchId, 'A1');

      const noStock = await createSpotSaleSql(db, batchId, 'no-stock', 'A1', 1, 'PAID_CASH', {
        label: 'Walk-up',
        attestedBy: sessionId,
      });
      expect(noStock.message).toContain('cannot sell 1 Bundles of A1');

      const noAttester = await createSpotSaleSql(db, batchId, 'no-attester', 'A1', 1, 'PAID_CASH', {
        label: 'Walk-up',
      });
      expect(noAttester.message).toContain('needs the attesting Runner session');

      const expired = (await db.query<{ id: string }>(
        `INSERT INTO runner_sessions
           (runner_identity, route_batch_id, shift_starts_at, shift_ends_at, expires_at)
         VALUES ('Expired Runner', $1, NOW() - INTERVAL '8 hours',
                 NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour')
         RETURNING id`,
        [batchId],
      )).rows[0].id;
      const expiredSale = await createSpotSaleSql(
        db,
        batchId,
        'expired',
        'A1',
        1,
        'PAID_CASH',
        { label: 'Walk-up', attestedBy: expired },
      );
      expect(expiredSale.message).toContain('has expired');

      const noReference = await createSpotSaleSql(
        db,
        batchId,
        'duitnow',
        'A1',
        1,
        'PAID_DUITNOW',
        { proof: 'https://proof.example/1', label: 'Walk-up', attestedBy: sessionId },
      );
      expect(noReference.message).toContain('requires both a payment reference and a proof link');

      const noBuyer = await createSpotSaleSql(
        db,
        batchId,
        'no-buyer',
        'A1',
        1,
        'PAID_CASH',
        { attestedBy: sessionId },
      );
      expect(noBuyer.message).toContain('needs a Stall or a provisional label');

      const noPhoneActive = await expectRejectedIn(
        db,
        `INSERT INTO stalls
           (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
            written_language, trust_tier, onboarding_status)
         SELECT 'P77', c.id, 'GC-P77', 'Phone-less Active', NULL,
                'ms-MY', 'PROVISIONAL', 'ACTIVE'
         FROM clusters c WHERE c.name = 'Gala City'`,
      );
      expect(noPhoneActive.message).toContain('check constraint');
    });
  });
});
