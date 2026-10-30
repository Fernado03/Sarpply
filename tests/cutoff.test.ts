import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { expectRejectedIn, withTransaction } from './helpers';

const SEED_DELIVERY_DATE = '2026-11-05';
const SEED_CUTOFF = '2026-11-04T12:00:00+08';

async function createBatch(
  db: Client,
  deliveryDate: string,
  cutoffAt: string,
  status = 'OPEN_FOR_ORDERS',
): Promise<string> {
  const [route] = (
    await db.query<{ id: string }>(
      "SELECT id FROM routes WHERE name = 'Premier 101 + Gala City'",
    )
  ).rows;
  const [vehicle] = (
    await db.query<{ id: string }>("SELECT id FROM vehicles WHERE label = 'Myvi'")
  ).rows;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO route_batches
       (route_id, vehicle_id, delivery_date, status, sortie_count, runner_cost_myr,
        cutoff_at, opened_at)
     VALUES ($1, $2, $3, $4, 1, 42.50, $5, NOW())
     RETURNING id`,
    [route.id, vehicle.id, deliveryDate, status, cutoffAt],
  );
  return rows[0].id;
}

async function placePreorder(
  db: Client,
  batchId: string,
  stallCode: string,
  skuCode: string,
  bundles: number,
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
    [batchId, skuCode, bundles, unitPrice, stallCode],
  );
  return rows[0].id;
}

async function freeze(db: Client, batchId: string, at: string): Promise<number> {
  const { rows } = await db.query<{ frozen: number }>(
    'SELECT fn_freeze_prices($1, $2) AS frozen',
    [batchId, at],
  );
  return rows[0].frozen;
}

interface FrozenPrice {
  sku_code: string;
  carton_cost: string;
  pool_bundle_price: string;
}

async function frozenPrices(db: Client, batchId: string): Promise<FrozenPrice[]> {
  const { rows } = await db.query<FrozenPrice>(
    `SELECT sku_code, locked_carton_cost::text AS carton_cost,
            locked_pool_bundle_price::text AS pool_bundle_price
     FROM route_batch_prices
     WHERE route_batch_id = $1
     ORDER BY sku_code`,
    [batchId],
  );
  return rows;
}

async function forecastGp(db: Client, batchId: string): Promise<string | null> {
  const { rows } = await db.query<{ gp: string | null }>(
    'SELECT forecast_gp_myr::text AS gp FROM v_route_batch_pnl WHERE route_batch_id = $1',
    [batchId],
  );
  return rows[0]?.gp ?? null;
}

// A1 is priced at 135.00 / 15.00 from 2026-10-01, then 150.00 / 16.50 for
// February–June 2027, then 170.00 / 18.00 from July 2027. A Cutoff in April
// must read the middle window even though July's row is the open one.
async function installHistoricalA1Prices(db: Client): Promise<void> {
  await db.query(
    `UPDATE wholesaler_prices SET valid_to = DATE '2027-01-31'
     WHERE sku_code = 'A1' AND valid_to IS NULL`,
  );
  await db.query(
    `INSERT INTO wholesaler_prices
       (wholesaler_id, sku_code, carton_cost, valid_from, valid_to, is_primary)
     SELECT w.id, 'A1', 150.00, DATE '2027-02-01', DATE '2027-06-30', FALSE
     FROM wholesalers w WHERE w.name = 'Pending Packaging Supplies'`,
  );
  // A competing primary quote in the same window: the Pool Price names the
  // 150.00 row as its cost basis, so that is the row Cutoff must snapshot.
  await db.query(
    `INSERT INTO wholesaler_prices
       (wholesaler_id, sku_code, carton_cost, valid_from, valid_to, is_primary)
     SELECT w.id, 'A1', 155.00, DATE '2027-02-01', DATE '2027-06-30', TRUE
     FROM wholesalers w WHERE w.name = 'Pending Packaging Supplies'`,
  );
  await db.query(
    `INSERT INTO wholesaler_prices
       (wholesaler_id, sku_code, carton_cost, valid_from, valid_to, is_primary)
     SELECT w.id, 'A1', 170.00, DATE '2027-07-01', NULL, TRUE
     FROM wholesalers w WHERE w.name = 'Pending Packaging Supplies'`,
  );

  await db.query(
    `UPDATE pool_prices SET valid_to = DATE '2027-01-31'
     WHERE sku_code = 'A1' AND valid_to IS NULL`,
  );
  await db.query(
    `INSERT INTO pool_prices
       (sku_code, wholesaler_price_id, pool_bundle_price, valid_from, valid_to)
     SELECT 'A1', wp.id, 16.50, DATE '2027-02-01', DATE '2027-06-30'
     FROM wholesaler_prices wp
     WHERE wp.sku_code = 'A1'
       AND wp.valid_from = DATE '2027-02-01'
       AND wp.carton_cost = 150.00`,
  );
  await db.query(
    `INSERT INTO pool_prices
       (sku_code, wholesaler_price_id, pool_bundle_price, valid_from, valid_to)
     SELECT 'A1', wp.id, 18.00, DATE '2027-07-01', NULL
     FROM wholesaler_prices wp
     WHERE wp.sku_code = 'A1' AND wp.valid_from = DATE '2027-07-01'`,
  );
}

describe('Cutoff dispatcher', () => {
  it('fires a due Cutoff and records it exactly once', async () => {
    await withTransaction(async (db) => {
      const [seed] = (
        await db.query<{ id: string; status: string }>(
          `SELECT id, status FROM route_batches WHERE delivery_date = DATE '${SEED_DELIVERY_DATE}'`,
        )
      ).rows;
      expect(seed.status).toBe('OPEN_FOR_ORDERS');

      const now = '2026-11-04T12:01:00+08';
      const first = await db.query<{ route_batch_id: string }>(
        'SELECT route_batch_id FROM fn_fire_due_cutoffs($1)',
        [now],
      );
      expect(first.rows).toEqual([{ route_batch_id: seed.id }]);

      const [closed] = (
        await db.query<{ status: string }>('SELECT status FROM route_batches WHERE id = $1', [
          seed.id,
        ])
      ).rows;
      expect(closed.status).toBe('CLOSED_AT_CUTOFF');

      const [transition] = (
        await db.query<{ fired_exactly: boolean }>(
          `SELECT fired_at = $2::timestamptz AS fired_exactly
           FROM route_batch_transitions
           WHERE route_batch_id = $1 AND transition_type = 'CUTOFF_FIRED'`,
          [seed.id, now],
        )
      ).rows;
      expect(transition.fired_exactly).toBe(true);

      expect(await frozenPrices(db, seed.id)).toHaveLength(6);

      const duplicate = await expectRejectedIn(
        db,
        `INSERT INTO route_batch_transitions (route_batch_id, transition_type)
         VALUES ($1, 'CUTOFF_FIRED')`,
        [seed.id],
      );
      expect(duplicate.message).toContain('duplicate key');

      const second = await db.query<{ route_batch_id: string }>(
        'SELECT route_batch_id FROM fn_fire_due_cutoffs($1)',
        [now],
      );
      expect(second.rows).toEqual([]);
      expect(await frozenPrices(db, seed.id)).toHaveLength(6);
    });
  });

  it('refuses a batch that is not due or no longer open', async () => {
    await withTransaction(async (db) => {
      const notDue = await createBatch(db, '2027-06-10', '2027-06-09T12:00:00+08');
      const early = await expectRejectedIn(db, 'SELECT fn_freeze_prices($1, $2)', [
        notDue,
        '2027-06-09T11:45:00+08',
      ]);
      expect(early.message).toContain('not due');

      const alreadyClosed = await createBatch(
        db,
        '2027-06-17',
        '2027-06-16T12:00:00+08',
        'CLOSED_AT_CUTOFF',
      );
      const late = await expectRejectedIn(db, 'SELECT fn_freeze_prices($1, $2)', [
        alreadyClosed,
        '2027-06-16T12:01:00+08',
      ]);
      expect(late.message).toContain('not open');
    });
  });
});

describe('Cutoff freezes prices and orders', () => {
  it('reads the price whose validity window contains the Cutoff instant', async () => {
    await withTransaction(async (db) => {
      await installHistoricalA1Prices(db);
      const batchId = await createBatch(db, '2027-04-16', '2027-04-15T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 5, '15.00');
      await placePreorder(db, batchId, 'S02', 'C1', 2, '12.50');

      expect(await frozenPrices(db, batchId)).toEqual([]);

      await freeze(db, batchId, '2027-04-15T12:05:00+08');

      const prices = await frozenPrices(db, batchId);
      expect(prices.find((row) => row.sku_code === 'A1')).toEqual({
        sku_code: 'A1',
        carton_cost: '150.00',
        pool_bundle_price: '16.50',
      });
      expect(prices.find((row) => row.sku_code === 'C1')).toMatchObject({
        carton_cost: '144.00',
        pool_bundle_price: '13.50',
      });

      const orders = await db.query<{ unit_price: string }>(
        `SELECT unit_price_locked::text AS unit_price
         FROM stall_orders WHERE route_batch_id = $1 ORDER BY sku_code`,
        [batchId],
      );
      expect(orders.rows.map((row) => row.unit_price)).toEqual(['16.50', '13.50']);

      const before = await forecastGp(db, batchId);
      expect(before).toBe('10.50');

      // A later supplier price change must not move the frozen batch.
      await db.query(
        `UPDATE wholesaler_prices SET carton_cost = 999.00
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );
      await db.query(
        `UPDATE pool_prices SET pool_bundle_price = 999.00
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );

      expect(await frozenPrices(db, batchId)).toEqual(prices);
      expect(await forecastGp(db, batchId)).toBe(before);
    });
  });

  it('refuses to change or delete a frozen Ordered Bundle', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-05-07', '2027-05-06T12:00:00+08');
      const orderId = await placePreorder(db, batchId, 'S03', 'A1', 3, '15.00');
      await freeze(db, batchId, '2027-05-06T12:01:00+08');

      const changed = await expectRejectedIn(
        db,
        'UPDATE stall_orders SET ordered_bundles = 4 WHERE id = $1',
        [orderId],
      );
      expect(changed.message).toContain('frozen');

      const repriced = await expectRejectedIn(
        db,
        'UPDATE stall_orders SET unit_price_locked = 1.00 WHERE id = $1',
        [orderId],
      );
      expect(repriced.message).toContain('frozen');

      const removed = await expectRejectedIn(
        db,
        'DELETE FROM stall_orders WHERE id = $1',
        [orderId],
      );
      expect(removed.message).toContain('frozen');
    });
  });

  it('refuses UPDATE and DELETE on the frozen price snapshot', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-05-14', '2027-05-13T12:00:00+08');
      await freeze(db, batchId, '2027-05-13T12:01:00+08');

      const changed = await expectRejectedIn(
        db,
        `UPDATE route_batch_prices SET locked_pool_bundle_price = 1.00
         WHERE route_batch_id = $1 AND sku_code = 'A1'`,
        [batchId],
      );
      expect(changed.message).toContain('append-only');

      const removed = await expectRejectedIn(
        db,
        `DELETE FROM route_batch_prices
         WHERE route_batch_id = $1 AND sku_code = 'A1'`,
        [batchId],
      );
      expect(removed.message).toContain('append-only');
    });
  });

  it('lists the Stalls that had no Preorder at Cutoff', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-05-21', '2027-05-20T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 2, '15.00');
      await freeze(db, batchId, '2027-05-20T12:01:00+08');

      const { rows } = await db.query<{ stall_code: string }>(
        `SELECT stall_code FROM v_batch_missing_preorders
         WHERE route_batch_id = $1 ORDER BY stall_code`,
        [batchId],
      );
      expect(rows.map((row) => row.stall_code)).toEqual([
        'S02',
        'S03',
        'S04',
        'S05',
        'S06',
        'S07',
        'S08',
        'S09',
      ]);
    });
  });

  it('refuses a Wholesaler PO inside the 30-minute gap after Cutoff', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-08-13', '2027-08-12T12:00:00+08');
      await freeze(db, batchId, '2027-08-12T12:01:00+08');

      const [opensAt] = (
        await db.query<{ exact: boolean }>(
          `SELECT fn_po_not_before($1) = TIMESTAMPTZ '2027-08-12 12:30:00+08' AS exact`,
          [batchId],
        )
      ).rows;
      expect(opensAt.exact).toBe(true);

      const [wholesaler] = (
        await db.query<{ id: string }>(
          "SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'",
        )
      ).rows;

      const early = await expectRejectedIn(
        db,
        `INSERT INTO wholesaler_pos (route_batch_id, wholesaler_id, submitted_at)
         VALUES ($1, $2, TIMESTAMPTZ '2027-08-12 12:29:00+08')`,
        [batchId, wholesaler.id],
      );
      expect(early.message).toContain('may not be submitted before');

      const accepted = await db.query(
        `INSERT INTO wholesaler_pos (route_batch_id, wholesaler_id, submitted_at)
         VALUES ($1, $2, TIMESTAMPTZ '2027-08-12 12:30:00+08')
         RETURNING id`,
        [batchId, wholesaler.id],
      );
      expect(accepted.rowCount).toBe(1);
    });
  });

  it('keeps the dispatcher at 15 minutes or faster and the PO gap at 30 minutes or more', async () => {
    await withTransaction(async (db) => {
      const [policy] = (
        await db.query<{ poll_interval_minutes: number; cutoff_to_po_minutes: number }>(
          'SELECT poll_interval_minutes, cutoff_to_po_minutes FROM dispatch_policy',
        )
      ).rows;
      expect(policy).toEqual({ poll_interval_minutes: 15, cutoff_to_po_minutes: 30 });

      const tooSlow = await expectRejectedIn(
        db,
        'UPDATE dispatch_policy SET poll_interval_minutes = 16',
      );
      expect(tooSlow.message).toContain('check');

      const tooTight = await expectRejectedIn(
        db,
        'UPDATE dispatch_policy SET cutoff_to_po_minutes = 29',
      );
      expect(tooTight.message).toContain('check');
    });
  });
});

describe('Cutoff seed state', () => {
  it('leaves the seeded week open with its Cutoff in the future', async () => {
    await withTransaction(async (db) => {
      const [seed] = (
        await db.query<{ status: string; cutoff_ok: boolean }>(
          `SELECT status, cutoff_at = $1::timestamptz AS cutoff_ok
           FROM route_batches WHERE delivery_date = DATE '${SEED_DELIVERY_DATE}'`,
          [SEED_CUTOFF],
        )
      ).rows;
      expect(seed).toEqual({ status: 'OPEN_FOR_ORDERS', cutoff_ok: true });
    });
  });
});
