import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { expectRejected, expectRejectedIn, query, withTransaction } from './helpers';

const A1_BUNDLES_PER_CARTON = 10;

interface BatchSpec {
  deliveryDate: string;
  poolPrice: number;
  cartonCost: number;
  orderedBundles: number;
  deliveredBundles: number;
  receivedBundles: number;
  cartonsReceived: number;
  paymentStatus?: 'PAID_CASH' | 'PAID_DUITNOW' | 'UNPAID';
  runnerCost?: number;
}

// A synthetic DELIVERED batch with one A1 Preorder, a frozen price, one PO
// line whose received cartons set the cash, and the matching ledger
// movements. Everything is inserted through the public tables/functions.
async function createDeliveredBatch(client: Client, spec: BatchSpec): Promise<string> {
  const paymentStatus = spec.paymentStatus ?? 'PAID_CASH';
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO route_batches
       (route_id, vehicle_id, delivery_date, status, sortie_count, runner_cost_myr,
        cutoff_at, opened_at)
     SELECT r.id, v.id, $1, 'DELIVERED', 1, $2,
            (($1::date - 1)::timestamp + time '12:00') AT TIME ZONE 'Asia/Kuching',
            (($1::date - 8)::timestamp + time '00:00') AT TIME ZONE 'Asia/Kuching'
     FROM routes r
     JOIN vehicles v ON v.label = 'Avanza'
     WHERE r.name = 'Premier 101 + Gala City'
     RETURNING id`,
    [spec.deliveryDate, spec.runnerCost ?? 0],
  );
  const batchId = inserted.rows[0].id;

  await client.query(
    `INSERT INTO route_batch_prices
       (route_batch_id, sku_code, wholesaler_price_id,
        locked_carton_cost, locked_pool_bundle_price)
     SELECT $1, 'A1', wp.id, $2, $3
     FROM wholesaler_prices wp
     WHERE wp.sku_code = 'A1' AND wp.valid_to IS NULL`,
    [batchId, spec.cartonCost, spec.poolPrice],
  );

  const po = await client.query<{ id: string }>(
    `INSERT INTO wholesaler_pos (route_batch_id, wholesaler_id, received_at)
     SELECT $1, w.id,
            ($2::date::timestamp + time '07:30') AT TIME ZONE 'Asia/Kuching'
     FROM wholesalers w
     WHERE w.name = 'Pending Packaging Supplies'
     RETURNING id`,
    [batchId, spec.deliveryDate],
  );

  await client.query(
    `INSERT INTO wholesaler_po_lines
       (po_id, sku_code, cartons_ordered, cartons_received, carton_cost)
     VALUES ($1, 'A1', $2, $2, $3)`,
    [po.rows[0].id, spec.cartonsReceived, spec.cartonCost],
  );

  await client.query(
    `INSERT INTO stall_orders
       (route_batch_id, stall_id, sku_code, order_type, source_channel,
        ordered_bundles, delivered_bundles, unit_price_locked,
        payment_status, fulfilment_status, payment_attested_at)
     SELECT $1, s.id, 'A1', 'PREORDER', 'TEXT', $2, $3, $4, $5::varchar,
            CASE WHEN $3 = 0 THEN 'UNCOLLECTED'
                 WHEN $3 = $2 THEN 'DELIVERED'
                 ELSE 'PARTIAL' END,
            CASE WHEN $5::varchar = 'UNPAID' THEN NULL ELSE NOW() END
     FROM stalls s
     WHERE s.stall_code = 'S01'`,
    [batchId, spec.orderedBundles, spec.deliveredBundles, spec.poolPrice, paymentStatus],
  );

  if (spec.receivedBundles > 0) {
    await client.query(
      `SELECT fn_post_stock_movement(
         p_sku_code => 'A1',
         p_vehicle_id => (SELECT vehicle_id FROM route_batches WHERE id = $1),
         p_quantity_bundles => $2,
         p_movement_type => 'PURCHASE_RECEIPT',
         p_idempotency_key => $3,
         p_unit_cost_myr => $4,
         p_route_batch_id => $1,
         p_occurred_at => ($5::date::timestamp + time '07:45') AT TIME ZONE 'Asia/Kuching'
       )`,
      [
        batchId,
        spec.receivedBundles,
        `TEST:RECON:${batchId}:RECEIPT`,
        spec.cartonCost / A1_BUNDLES_PER_CARTON,
        spec.deliveryDate,
      ],
    );
  }

  if (spec.deliveredBundles > 0) {
    await client.query(
      `SELECT fn_post_stock_movement(
         p_sku_code => 'A1',
         p_vehicle_id => (SELECT vehicle_id FROM route_batches WHERE id = $1),
         p_quantity_bundles => $2,
         p_movement_type => 'DELIVERY',
         p_idempotency_key => $3,
         p_route_batch_id => $1,
         p_occurred_at => ($4::date::timestamp + time '15:00') AT TIME ZONE 'Asia/Kuching'
       )`,
      [
        batchId,
        -spec.deliveredBundles,
        `TEST:RECON:${batchId}:DELIVERY`,
        spec.deliveryDate,
      ],
    );
  }

  return batchId;
}

interface ReconciliationRow {
  delivery_date: string;
  status: string;
  forecast: string;
  realized: string;
  gmv: string;
  opening: string;
  closing: string;
  sortie: string;
  collected: string;
  cash_paid: string;
  delivered_cost: string;
  net_cash: string;
  residual: string;
  headroom: string | null;
  verdict: string;
}

const RECONCILIATION_COLUMNS = `
  b.delivery_date::text AS delivery_date,
  r.status,
  r.forecast_gp_myr::text AS forecast,
  r.realized_gp_myr::text AS realized,
  r.gmv_delivered_myr::text AS gmv,
  r.opening_buffer_cost_myr::text AS opening,
  r.closing_buffer_cost_myr::text AS closing,
  r.sortie_cost_myr::text AS sortie,
  r.collected_myr::text AS collected,
  r.cash_paid_myr::text AS cash_paid,
  r.delivered_cost_myr::text AS delivered_cost,
  r.net_batch_cash_flow_myr::text AS net_cash,
  r.identity_residual_myr::text AS residual,
  r.headroom_pct::text AS headroom,
  r.gate_verdict AS verdict`;

async function reconciliationFor(client: Client, batchId: string): Promise<ReconciliationRow> {
  const result = await client.query<ReconciliationRow>(
    `SELECT ${RECONCILIATION_COLUMNS}
     FROM v_route_batch_reconciliation r
     JOIN route_batches b ON b.id = r.route_batch_id
     WHERE r.route_batch_id = $1`,
    [batchId],
  );
  return result.rows[0];
}

async function reconciliationOn(deliveryDate: string): Promise<ReconciliationRow> {
  const rows = await query<ReconciliationRow>(
    `SELECT ${RECONCILIATION_COLUMNS}
     FROM v_route_batch_reconciliation r
     JOIN route_batches b ON b.id = r.route_batch_id
     WHERE b.delivery_date = $1`,
    [deliveryDate],
  );
  return rows[0];
}

describe('golden replays against the Phase 1 fixtures', () => {
  it('replays B01 to the measured reconciliation figures', async () => {
    expect(await reconciliationOn('2026-10-15')).toEqual({
      delivery_date: '2026-10-15',
      status: 'RECONCILED',
      forecast: '173.00',
      realized: '167.00',
      gmv: '1657.00',
      opening: '0.00',
      closing: '183.00',
      sortie: '42.50',
      collected: '1657.00',
      cash_paid: '1673.00',
      delivered_cost: '1490.00',
      net_cash: '-58.50',
      residual: '0.000000',
      headroom: '1.14',
      verdict: 'PASS',
    });
  });

  it('replays B02 to the measured reconciliation figures', async () => {
    expect(await reconciliationOn('2026-10-22')).toEqual({
      delivery_date: '2026-10-22',
      status: 'RECONCILED',
      forecast: '190.50',
      realized: '187.50',
      gmv: '1896.00',
      opening: '183.00',
      closing: '37.50',
      sortie: '42.50',
      collected: '1896.00',
      cash_paid: '1563.00',
      delivered_cost: '1708.50',
      net_cash: '290.50',
      residual: '0.000000',
      headroom: '2.19',
      verdict: 'PASS',
    });
  });
});

describe('multi-batch identity', () => {
  it('carries Buffer Stock at its posted cost across three batches and a price change', async () => {
    await withTransaction(async (client) => {
      const build = await createDeliveredBatch(client, {
        deliveryDate: '2027-05-06',
        poolPrice: 15,
        cartonCost: 130,
        orderedBundles: 6,
        deliveredBundles: 6,
        receivedBundles: 10,
        cartonsReceived: 1,
        runnerCost: 42.5,
      });
      const priceChange = await createDeliveredBatch(client, {
        deliveryDate: '2027-05-13',
        poolPrice: 15,
        cartonCost: 140,
        orderedBundles: 8,
        deliveredBundles: 8,
        receivedBundles: 10,
        cartonsReceived: 1,
        runnerCost: 42.5,
      });
      const sellDown = await createDeliveredBatch(client, {
        deliveryDate: '2027-05-20',
        poolPrice: 15,
        cartonCost: 140,
        orderedBundles: 6,
        deliveredBundles: 6,
        receivedBundles: 0,
        cartonsReceived: 0,
        runnerCost: 42.5,
      });

      const batches: ReconciliationRow[] = [];
      for (const batchId of [build, priceChange, sellDown]) {
        batches.push(await reconciliationFor(client, batchId));
      }

      expect(batches.map((row) => row.residual)).toEqual([
        '0.000000',
        '0.000000',
        '0.000000',
      ]);
      expect(batches.map((row) => row.net_cash)).toEqual(['-82.50', '-62.50', '47.50']);

      // A week that sells down last week's stock opens at last week's cost.
      expect(batches[1].opening).toBe(batches[0].closing);
      expect(batches[2].opening).toBe(batches[1].closing);

      const buffer = await client.query<{
        route_batch_id: string;
        opening_bundles: number;
        closing_bundles: number;
      }>(
        `SELECT route_batch_id, opening_bundles, closing_bundles
         FROM v_batch_buffer
         WHERE sku_code = 'A1' AND route_batch_id = ANY($1::uuid[])
         ORDER BY route_batch_id`,
        [[build, priceChange, sellDown]],
      );
      const byBatch = new Map(buffer.rows.map((row) => [row.route_batch_id, row]));
      const sold = byBatch.get(sellDown)!;
      expect(sold.opening_bundles).toBeGreaterThan(0);
      expect(sold.closing_bundles).toBe(0);
      expect(sold.closing_bundles).toBe(sold.opening_bundles - 6);
    });
  });
});

describe('reconciliation is idempotent', () => {
  it('adds no stock movements and leaves the buffer unchanged when re-run', async () => {
    await withTransaction(async (client) => {
      const batchId = await createDeliveredBatch(client, {
        deliveryDate: '2027-06-03',
        poolPrice: 15,
        cartonCost: 130,
        orderedBundles: 10,
        deliveredBundles: 10,
        receivedBundles: 10,
        cartonsReceived: 1,
        runnerCost: 42.5,
      });

      const before = await client.query<{ movements: string; closing: string }>(
        `SELECT (SELECT COUNT(*)::text FROM stock_movements) AS movements,
                (SELECT SUM(closing_cost_myr)::text FROM v_batch_buffer
                  WHERE route_batch_id = $1) AS closing`,
        [batchId],
      );

      const first = await client.query<{ status: string }>(
        'SELECT status FROM fn_reconcile_batch($1)',
        [batchId],
      );
      const second = await client.query<{ status: string }>(
        'SELECT status FROM fn_reconcile_batch($1)',
        [batchId],
      );

      expect(first.rows[0].status).toBe('RECONCILED');
      expect(second.rows[0].status).toBe('RECONCILED');

      const after = await client.query<{ movements: string; closing: string; transitions: string }>(
        `SELECT (SELECT COUNT(*)::text FROM stock_movements) AS movements,
                (SELECT SUM(closing_cost_myr)::text FROM v_batch_buffer
                  WHERE route_batch_id = $1) AS closing,
                (SELECT COUNT(*)::text FROM route_batch_transitions
                  WHERE route_batch_id = $1 AND transition_type = 'RECONCILED') AS transitions`,
        [batchId],
      );
      expect(after.rows[0]).toEqual({
        movements: before.rows[0].movements,
        closing: before.rows[0].closing,
        transitions: '1',
      });
    });
  });
});

describe('reconciliation fails closed', () => {
  it('refuses a non-zero identity residual and leaves the batch DELIVERED', async () => {
    await withTransaction(async (client) => {
      // Ten Bundles delivered but never collected: Realized GP is accrued,
      // cash is not, so the identity leaves RM 150.00 unexplained.
      const batchId = await createDeliveredBatch(client, {
        deliveryDate: '2027-06-10',
        poolPrice: 15,
        cartonCost: 130,
        orderedBundles: 10,
        deliveredBundles: 10,
        receivedBundles: 10,
        cartonsReceived: 1,
        paymentStatus: 'UNPAID',
      });

      const rejection = await expectRejectedIn(
        client,
        'SELECT fn_reconcile_batch($1)',
        [batchId],
      );
      expect(rejection.message).toContain('identity residual');
      expect(rejection.message).toContain('150.000000');

      const state = await client.query<{ status: string; transitions: string }>(
        `SELECT b.status,
                (SELECT COUNT(*)::text FROM route_batch_transitions t
                  WHERE t.route_batch_id = b.id AND t.transition_type = 'RECONCILED')
                  AS transitions
         FROM route_batches b WHERE b.id = $1`,
        [batchId],
      );
      expect(state.rows[0]).toEqual({ status: 'DELIVERED', transitions: '0' });
    });
  });
});

describe('the gate verdict', () => {
  it('judges on Delivered Bundles, naming a volume failure when GMV is short', async () => {
    await withTransaction(async (client) => {
      // Ten Bundles ordered would clear RM 1,500 GMV at RM 500 each; the two
      // actually delivered do not. Forecast-based verdicts pass this batch.
      const batchId = await createDeliveredBatch(client, {
        deliveryDate: '2027-06-17',
        poolPrice: 500,
        cartonCost: 100,
        orderedBundles: 10,
        deliveredBundles: 2,
        receivedBundles: 10,
        cartonsReceived: 1,
      });

      const row = await reconciliationFor(client, batchId);
      expect(row.gmv).toBe('1000.00');
      expect(row.realized).toBe('980.00');
      expect(row.verdict).toBe('FAIL_VOLUME');
    });
  });

  it('names a margin failure when GMV clears but Realized GP is short', async () => {
    await withTransaction(async (client) => {
      const batchId = await createDeliveredBatch(client, {
        deliveryDate: '2027-06-24',
        poolPrice: 15,
        cartonCost: 140,
        orderedBundles: 100,
        deliveredBundles: 100,
        receivedBundles: 100,
        cartonsReceived: 10,
      });

      const row = await reconciliationFor(client, batchId);
      expect(row.gmv).toBe('1500.00');
      expect(row.realized).toBe('100.00');
      expect(row.verdict).toBe('FAIL_MARGIN');
    });
  });

  it('reports no headroom when delivered cost is zero', async () => {
    const row = await reconciliationOn('2026-11-05');
    expect(row.delivered_cost).toBe('0.00');
    expect(row.headroom).toBeNull();
    expect(row.verdict).toBe('FAIL_BOTH');
  });
});

describe('a price change after Cutoff does not move Realized GP', () => {
  it('reads the frozen snapshot, never the live Wholesaler or Pool price', async () => {
    await withTransaction(async (client) => {
      const before = await client.query<{ realized: string }>(
        `SELECT r.realized_gp_myr::text AS realized
         FROM v_route_batch_reconciliation r
         JOIN route_batches b ON b.id = r.route_batch_id
         WHERE b.delivery_date = DATE '2026-10-15'`,
      );

      await client.query(
        `UPDATE wholesaler_prices SET carton_cost = 999
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );
      await client.query(
        `UPDATE pool_prices SET pool_bundle_price = 99
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );

      const after = await client.query<{ realized: string }>(
        `SELECT r.realized_gp_myr::text AS realized
         FROM v_route_batch_reconciliation r
         JOIN route_batches b ON b.id = r.route_batch_id
         WHERE b.delivery_date = DATE '2026-10-15'`,
      );

      expect(after.rows[0].realized).toBe(before.rows[0].realized);
    });
  });
});

describe('the required constraints are refused by the database', () => {
  it('refuses DuitNow without a reference', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stall_orders
         (route_batch_id, stall_id, sku_code, order_type, source_channel,
          ordered_bundles, unit_price_locked, payment_status, payment_proof_url)
       SELECT b.id, s.id, 'A1', 'PREORDER', 'TEXT', 1, 15, 'PAID_DUITNOW',
              'https://proof.example/1'
       FROM route_batches b, stalls s
       WHERE b.delivery_date = DATE '2026-11-05' AND s.stall_code = 'S01'`,
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses DuitNow without a proof link', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stall_orders
         (route_batch_id, stall_id, sku_code, order_type, source_channel,
          ordered_bundles, unit_price_locked, payment_status, payment_reference)
       SELECT b.id, s.id, 'A1', 'PREORDER', 'TEXT', 1, 15, 'PAID_DUITNOW', 'DUIT-1'
       FROM route_batches b, stalls s
       WHERE b.delivery_date = DATE '2026-11-05' AND s.stall_code = 'S01'`,
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses a delivered count greater than the order', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stall_orders
         (route_batch_id, stall_id, sku_code, order_type, source_channel,
          ordered_bundles, delivered_bundles, unit_price_locked, fulfilment_status)
       SELECT b.id, s.id, 'A1', 'PREORDER', 'TEXT', 1, 2, 15, 'DELIVERED'
       FROM route_batches b, stalls s
       WHERE b.delivery_date = DATE '2026-11-05' AND s.stall_code = 'S01'`,
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses an active Stall with no phone', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stalls
         (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
          onboarding_status)
       SELECT $1, c.id, $2, 'No Phone Stall', NULL, 'ACTIVE'
       FROM clusters c LIMIT 1`,
      [`X${randomUUID().slice(0, 7)}`, randomUUID().slice(0, 8)],
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses an invalid Trust Tier', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stalls
         (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone, trust_tier)
       SELECT $1, c.id, $2, 'Bad Tier Stall', '+60120000000', 'PREPAY_REQUIRED'
       FROM clusters c LIMIT 1`,
      [`Y${randomUUID().slice(0, 7)}`, randomUUID().slice(0, 8)],
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses a fulfilment status inconsistent with the bundle counts', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stall_orders
         (route_batch_id, stall_id, sku_code, order_type, source_channel,
          ordered_bundles, delivered_bundles, unit_price_locked, fulfilment_status)
       SELECT b.id, s.id, 'A1', 'PREORDER', 'TEXT', 2, 1, 15, 'DELIVERED'
       FROM route_batches b, stalls s
       WHERE b.delivery_date = DATE '2026-11-05' AND s.stall_code = 'S01'`,
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses an unsupported written language', async () => {
    const rejection = await expectRejected(
      `INSERT INTO stalls
         (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
          written_language)
       SELECT $1, c.id, $2, 'Bad Language Stall', '+60120000001', 'fr'
       FROM clusters c LIMIT 1`,
      [`Z${randomUUID().slice(0, 7)}`, randomUUID().slice(0, 8)],
    );
    expect(rejection.message).toContain('check constraint');
  });

  it('refuses UPDATE and DELETE on the stock ledger', async () => {
    const update = await expectRejected(
      `UPDATE stock_movements SET note = 'tampered'
       WHERE id = (SELECT MIN(id) FROM stock_movements)`,
    );
    expect(update.message).toContain('append-only');

    const remove = await expectRejected(
      `DELETE FROM stock_movements WHERE id = (SELECT MIN(id) FROM stock_movements)`,
    );
    expect(remove.message).toContain('append-only');
  });

  it('refuses UPDATE and DELETE on the price snapshot', async () => {
    const update = await expectRejected(
      `UPDATE route_batch_prices SET locked_carton_cost = 1
       WHERE route_batch_id = (SELECT id FROM route_batches WHERE delivery_date = DATE '2026-10-15')
         AND sku_code = 'A1'`,
    );
    expect(update.message).toContain('append-only');

    const remove = await expectRejected(
      `DELETE FROM route_batch_prices
       WHERE route_batch_id = (SELECT id FROM route_batches WHERE delivery_date = DATE '2026-10-15')
         AND sku_code = 'A1'`,
    );
    expect(remove.message).toContain('append-only');
  });
});
