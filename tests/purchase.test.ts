import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { expectRejectedIn, query, withTransaction } from './helpers';

interface PurchaseLine {
  sku_code: string;
  ordered_bundles: number;
  buffer_bundles: number;
  cartons: number;
  physical_boxes: number;
  geometric_liters: string;
  locked_carton_cost: string | null;
  cash_myr: string | null;
}

describe('Purchase plan', () => {
  it('publishes the B01 purchase list net of Buffer Stock at the frozen cost', async () => {
    const rows = await query<PurchaseLine>(
      `SELECT p.sku_code,
              p.ordered_bundles,
              p.buffer_bundles,
              p.cartons,
              p.physical_boxes,
              p.geometric_liters::text AS geometric_liters,
              p.locked_carton_cost::text AS locked_carton_cost,
              p.cash_myr::text AS cash_myr
       FROM v_purchase_plan p
       JOIN route_batches b ON b.id = p.route_batch_id
       WHERE b.delivery_date = DATE '2026-10-15'
       ORDER BY p.sku_code`,
    );

    expect(rows).toEqual([
      {
        sku_code: 'A1',
        ordered_bundles: 28,
        buffer_bundles: 0,
        cartons: 3,
        physical_boxes: 6,
        geometric_liters: '277.50',
        locked_carton_cost: '135.00',
        cash_myr: '405.00',
      },
      {
        sku_code: 'A2',
        ordered_bundles: 18,
        buffer_bundles: 0,
        cartons: 2,
        physical_boxes: 4,
        geometric_liters: '168.00',
        locked_carton_cost: '120.00',
        cash_myr: '240.00',
      },
      {
        sku_code: 'B1',
        ordered_bundles: 30,
        buffer_bundles: 0,
        cartons: 3,
        physical_boxes: 3,
        geometric_liters: '228.00',
        locked_carton_cost: '110.00',
        cash_myr: '330.00',
      },
      {
        sku_code: 'C1',
        ordered_bundles: 20,
        buffer_bundles: 0,
        cartons: 2,
        physical_boxes: 2,
        geometric_liters: '137.00',
        locked_carton_cost: '144.00',
        cash_myr: '288.00',
      },
      {
        sku_code: 'D1',
        ordered_bundles: 14,
        buffer_bundles: 0,
        cartons: 2,
        physical_boxes: 2,
        geometric_liters: '56.00',
        locked_carton_cost: '160.00',
        cash_myr: '320.00',
      },
      {
        sku_code: 'E1',
        ordered_bundles: 10,
        buffer_bundles: 0,
        cartons: 1,
        physical_boxes: 1,
        geometric_liters: '35.00',
        locked_carton_cost: '90.00',
        cash_myr: '90.00',
      },
    ]);
  });
});

async function createBatch(
  db: Client,
  deliveryDate: string,
  cutoffAt: string,
  sortieCount = 1,
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
     VALUES ($1, $2, $3, 'OPEN_FOR_ORDERS', $4, 42.50, $5, NOW())
     RETURNING id`,
    [route.id, vehicle.id, deliveryDate, sortieCount, cutoffAt],
  );
  return rows[0].id;
}

async function placePreorder(
  db: Client,
  batchId: string,
  stallCode: string,
  skuCode: string,
  bundles: number,
): Promise<void> {
  await db.query(
    `INSERT INTO stall_orders
       (route_batch_id, stall_id, sku_code, order_type, source_channel,
        ordered_bundles, unit_price_locked)
     SELECT $1, st.id, $2, 'PREORDER', 'TEXT', $3, 15.00
     FROM stalls st
     WHERE st.stall_code = $4`,
    [batchId, skuCode, bundles, stallCode],
  );
}

async function freeze(db: Client, batchId: string, at: string): Promise<void> {
  await db.query('SELECT fn_freeze_prices($1, $2)', [batchId, at]);
}

describe('Route cartons allocated across Sorties', () => {
  it('splits whole cartons by largest remainder without re-rounding a Sortie', async () => {
    await withTransaction(async (db) => {
      await db.query(
        `UPDATE clusters SET trip_number = 2
         WHERE name = 'Gala City'`,
      );
      const batchId = await createBatch(db, '2027-09-16', '2027-09-15T12:00:00+08', 2);
      await placePreorder(db, batchId, 'S01', 'A1', 45);
      await placePreorder(db, batchId, 'S06', 'A1', 45);
      await freeze(db, batchId, '2027-09-15T12:01:00+08');

      const allocation = await db.query<{ trip_number: number; cartons: number }>(
        `SELECT trip_number, cartons
         FROM v_sortie_carton_allocation
         WHERE route_batch_id = $1
         ORDER BY trip_number`,
        [batchId],
      );
      expect(allocation.rows).toEqual([
        { trip_number: 1, cartons: 5 },
        { trip_number: 2, cartons: 4 },
      ]);

      const [plan] = (
        await db.query<{ cartons: number }>(
          'SELECT SUM(cartons)::int AS cartons FROM v_purchase_plan WHERE route_batch_id = $1',
          [batchId],
        )
      ).rows;
      expect(plan.cartons).toBe(9);

      const loads = await db.query<{
        trip_number: number;
        cartons: number;
        packed_liters: string;
        max_cargo_liters: number;
        fits: boolean;
      }>(
        `SELECT trip_number, cartons, packed_liters::text, max_cargo_liters, fits
         FROM v_sortie_load
         WHERE route_batch_id = $1
         ORDER BY trip_number`,
        [batchId],
      );
      expect(loads.rows).toEqual([
        { trip_number: 1, cartons: 5, packed_liters: '502.7', max_cargo_liters: 980, fits: true },
        { trip_number: 2, cartons: 4, packed_liters: '402.2', max_cargo_liters: 980, fits: true },
      ]);
    });
  });

  it('nets Buffer Stock out of the carton plan before allocating', async () => {
    await withTransaction(async (db) => {
      const [vehicle] = (
        await db.query<{ id: string }>("SELECT id FROM vehicles WHERE label = 'Myvi'")
      ).rows;
      await db.query(
        `SELECT fn_post_stock_movement(
           p_sku_code => 'A1',
           p_vehicle_id => $1,
           p_quantity_bundles => 10,
           p_movement_type => 'PURCHASE_RECEIPT',
           p_idempotency_key => 'TEST:BUFFER:A1',
           p_unit_cost_myr => 13.50,
           p_occurred_at => '2026-09-01T08:00:00+08'
         )`,
        [vehicle.id],
      );

      const batchId = await createBatch(db, '2026-09-17', '2026-09-16T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 15);
      await placePreorder(db, batchId, 'S06', 'A1', 10);

      const [line] = (
        await db.query<{
          ordered_bundles: number;
          buffer_bundles: number;
          cartons: number;
        }>(
          `SELECT ordered_bundles, buffer_bundles, cartons
           FROM v_purchase_plan
           WHERE route_batch_id = $1 AND sku_code = 'A1'`,
          [batchId],
        )
      ).rows;

      expect(line).toEqual({ ordered_bundles: 25, buffer_bundles: 10, cartons: 2 });
    });
  });
});

async function confirmVehicle(db: Client, batchId: string, vehicleLabel: string): Promise<void> {
  await db.query(
    `SELECT fn_confirm_batch_vehicle(
       $1,
       (SELECT id FROM vehicles WHERE label = $2)
     )`,
    [batchId, vehicleLabel],
  );
}

async function submitPo(
  db: Client,
  batchId: string,
  at: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT fn_submit_wholesaler_po(
       $1,
       (SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'),
       $2
     ) AS id`,
    [batchId, at],
  );
  return rows[0].id;
}

describe('Wholesaler PO submission', () => {
  it('refuses the PO until Cutoff, Vehicle confirmation and the 30-minute gap are satisfied', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2027-11-11', '2027-11-10T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 10);

      const beforeCutoff = await expectRejectedIn(
        db,
        `SELECT fn_submit_wholesaler_po(
           $1, (SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'), $2
         )`,
        [batchId, '2027-11-10T12:31:00+08'],
      );
      expect(beforeCutoff.message).toContain('Cutoff has not fired');

      await freeze(db, batchId, '2027-11-10T12:01:00+08');

      const unconfirmed = await expectRejectedIn(
        db,
        `SELECT fn_submit_wholesaler_po(
           $1, (SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'), $2
         )`,
        [batchId, '2027-11-10T12:31:00+08'],
      );
      expect(unconfirmed.message).toContain('confirm the Vehicle');

      await confirmVehicle(db, batchId, 'Myvi');

      const tooEarly = await expectRejectedIn(
        db,
        `SELECT fn_submit_wholesaler_po(
           $1, (SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'), $2
         )`,
        [batchId, '2027-11-10T12:29:00+08'],
      );
      expect(tooEarly.message).toContain('may not be submitted before');

      const poId = await submitPo(db, batchId, '2027-11-10T12:30:00+08');
      expect(poId).toBeTruthy();
    });
  });

  it('refuses a plan that exceeds the Vehicle and accepts one that fits', async () => {
    await withTransaction(async (db) => {
      const tooBig = await createBatch(db, '2027-12-09', '2027-12-08T12:00:00+08');
      await placePreorder(db, tooBig, 'S01', 'A1', 100);
      await freeze(db, tooBig, '2027-12-08T12:01:00+08');
      await confirmVehicle(db, tooBig, 'Myvi');

      const refused = await expectRejectedIn(
        db,
        `SELECT fn_submit_wholesaler_po(
           $1, (SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'), $2
         )`,
        [tooBig, '2027-12-08T12:31:00+08'],
      );
      expect(refused.message).toContain('Sortie 1 needs');
      expect(refused.message).toContain('exceeding the Vehicle');

      const [stillOpen] = (
        await db.query<{ status: string }>(
          'SELECT status FROM route_batches WHERE id = $1',
          [tooBig],
        )
      ).rows;
      expect(stillOpen.status).toBe('CLOSED_AT_CUTOFF');
      const noPo = await db.query(
        'SELECT 1 FROM wholesaler_pos WHERE route_batch_id = $1',
        [tooBig],
      );
      expect(noPo.rowCount).toBe(0);

      const fits = await createBatch(db, '2027-12-16', '2027-12-15T12:00:00+08');
      await placePreorder(db, fits, 'S01', 'A1', 10);
      await freeze(db, fits, '2027-12-15T12:01:00+08');
      await confirmVehicle(db, fits, 'Myvi');

      const poId = await submitPo(db, fits, '2027-12-15T12:31:00+08');
      const [po] = (
        await db.query<{ status: string; submitted_at: string }>(
          `SELECT b.status,
                  TO_CHAR(p.submitted_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') AS submitted_at
           FROM wholesaler_pos p
           JOIN route_batches b ON b.id = p.route_batch_id
           WHERE p.id = $1`,
          [poId],
        )
      ).rows;
      expect(po).toEqual({ status: 'PO_SUBMITTED', submitted_at: '2027-12-15 12:31' });

      const lines = await db.query<{ sku_code: string; cartons_ordered: number; carton_cost: string }>(
        `SELECT sku_code, cartons_ordered, carton_cost::text AS carton_cost
         FROM wholesaler_po_lines WHERE po_id = $1 ORDER BY sku_code`,
        [poId],
      );
      expect(lines.rows).toEqual([
        { sku_code: 'A1', cartons_ordered: 1, carton_cost: '135.00' },
      ]);
    });
  });

  it('uses the frozen carton cost and returns the same PO on retry', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2028-01-13', '2028-01-12T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 10);
      await freeze(db, batchId, '2028-01-12T12:01:00+08');

      await db.query(
        `UPDATE wholesaler_prices SET carton_cost = 999.00
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );
      await db.query(
        `UPDATE pool_prices SET pool_bundle_price = 999.00
         WHERE sku_code = 'A1' AND valid_to IS NULL`,
      );

      await confirmVehicle(db, batchId, 'Myvi');
      const poId = await submitPo(db, batchId, '2028-01-12T12:31:00+08');
      const retry = await submitPo(db, batchId, '2028-01-12T12:35:00+08');
      expect(retry).toBe(poId);

      const [line] = (
        await db.query<{ carton_cost: string }>(
          'SELECT carton_cost::text AS carton_cost FROM wholesaler_po_lines WHERE po_id = $1',
          [poId],
        )
      ).rows;
      expect(line.carton_cost).toBe('135.00');

      const pos = await db.query('SELECT 1 FROM wholesaler_pos WHERE route_batch_id = $1', [
        batchId,
      ]);
      expect(pos.rowCount).toBe(1);
      const transitions = await db.query(
        `SELECT 1 FROM route_batch_transitions
         WHERE route_batch_id = $1 AND transition_type = 'PO_SUBMITTED'`,
        [batchId],
      );
      expect(transitions.rowCount).toBe(1);

      const liveCost = await expectRejectedIn(
        db,
        `INSERT INTO wholesaler_po_lines
           (po_id, sku_code, cartons_ordered, carton_cost)
         VALUES ($1, 'A1', 1, 999.00)`,
        [poId],
      );
      expect(liveCost.message).toContain('frozen carton cost');
    });
  });

  it('fixes the Vehicle once the PO is submitted', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2028-01-20', '2028-01-19T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 10);
      await freeze(db, batchId, '2028-01-19T12:01:00+08');
      await confirmVehicle(db, batchId, 'Myvi');

      const [recorded] = (
        await db.query<{ label: string; confirmed: boolean }>(
          `SELECT v.label, b.vehicle_confirmed_at IS NOT NULL AS confirmed
           FROM route_batches b JOIN vehicles v ON v.id = b.vehicle_id
           WHERE b.id = $1`,
          [batchId],
        )
      ).rows;
      expect(recorded).toEqual({ label: 'Myvi', confirmed: true });

      await submitPo(db, batchId, '2028-01-19T12:31:00+08');

      const changed = await expectRejectedIn(
        db,
        `SELECT fn_confirm_batch_vehicle(
           $1, (SELECT id FROM vehicles WHERE label = 'Alza')
         )`,
        [batchId],
      );
      expect(changed.message).toContain('fixed once the Wholesaler PO is submitted');
    });
  });
});

interface ReceiptLine {
  skuCode: string;
  cartonsReceived: number;
}

async function receivePo(
  db: Client,
  poId: string,
  lines: ReceiptLine[],
  at: string,
): Promise<number> {
  const { rows } = await db.query<{ written: number }>(
    'SELECT fn_receive_po($1, $2::jsonb, $3) AS written',
    [poId, JSON.stringify(lines), at],
  );
  return rows[0].written;
}

describe('Wholesaler PO receipt', () => {
  it('records a short receipt, derives cash from received and writes one immutable movement per line', async () => {
    await withTransaction(async (db) => {
      const batchId = await createBatch(db, '2028-02-10', '2028-02-09T12:00:00+08');
      await placePreorder(db, batchId, 'S01', 'A1', 10);
      await placePreorder(db, batchId, 'S02', 'C1', 12);
      await freeze(db, batchId, '2028-02-09T12:01:00+08');
      await confirmVehicle(db, batchId, 'Myvi');
      const poId = await submitPo(db, batchId, '2028-02-09T12:31:00+08');

      const receivedAt = '2028-02-10T07:30:00+08';
      const written = await receivePo(
        db,
        poId,
        [
          { skuCode: 'A1', cartonsReceived: 1 },
          { skuCode: 'C1', cartonsReceived: 0 },
        ],
        receivedAt,
      );
      expect(written).toBe(1);

      const [po] = (
        await db.query<{
          cash_required: string;
          received_exactly: boolean;
          received_at: string;
          vehicle: string;
          status: string;
        }>(
          `SELECT p.cash_required_myr::text AS cash_required,
                  p.received_at = $2::timestamptz AS received_exactly,
                  p.received_at::text AS received_at,
                  v.label AS vehicle,
                  b.status
           FROM wholesaler_pos p
           JOIN route_batches b ON b.id = p.route_batch_id
           JOIN vehicles v ON v.id = b.vehicle_id
           WHERE p.id = $1`,
          [poId, receivedAt],
        )
      ).rows;
      expect(po.cash_required).toBe('135.00');
      expect(po.received_exactly).toBe(true);
      expect(po.vehicle).toBe('Myvi');
      expect(po.status).toBe('GOODS_RECEIVED');

      const lines = await db.query<{
        sku_code: string;
        cartons_ordered: number;
        cartons_received: number;
        short: number;
      }>(
        `SELECT sku_code, cartons_ordered, cartons_received,
                cartons_ordered - cartons_received AS short
         FROM wholesaler_po_lines
         WHERE po_id = $1
         ORDER BY sku_code`,
        [poId],
      );
      expect(lines.rows).toEqual([
        { sku_code: 'A1', cartons_ordered: 1, cartons_received: 1, short: 0 },
        { sku_code: 'C1', cartons_ordered: 1, cartons_received: 0, short: 1 },
      ]);

      const movements = await db.query<{
        sku_code: string;
        quantity_bundles: number;
        unit_cost: string;
        movement_type: string;
        idempotency_key: string;
        route_batch_id: string;
      }>(
        `SELECT sku_code, quantity_bundles, unit_cost_myr::text AS unit_cost,
                movement_type, idempotency_key, route_batch_id
         FROM stock_movements
         WHERE route_batch_id = $1
         ORDER BY sku_code`,
        [batchId],
      );
      expect(movements.rows).toEqual([
        {
          sku_code: 'A1',
          quantity_bundles: 10,
          unit_cost: '13.50',
          movement_type: 'PURCHASE_RECEIPT',
          idempotency_key: `PO:${poId}:A1`,
          route_batch_id: batchId,
        },
      ]);

      const [transition] = (
        await db.query<{ fired_exactly: boolean }>(
          `SELECT fired_at = $2::timestamptz AS fired_exactly
           FROM route_batch_transitions
           WHERE route_batch_id = $1 AND transition_type = 'GOODS_RECEIVED'`,
          [batchId, receivedAt],
        )
      ).rows;
      expect(transition.fired_exactly).toBe(true);

      // Re-running the same receipt is a no-op: no movement, no cash change.
      expect(
        await receivePo(
          db,
          poId,
          [
            { skuCode: 'A1', cartonsReceived: 1 },
            { skuCode: 'C1', cartonsReceived: 0 },
          ],
          '2028-02-10T08:00:00+08',
        ),
      ).toBe(0);
      const afterRetry = await db.query(
        'SELECT 1 FROM stock_movements WHERE route_batch_id = $1',
        [batchId],
      );
      expect(afterRetry.rowCount).toBe(1);
      const [cash] = (
        await db.query<{ cash_required: string; received_at: string }>(
          `SELECT cash_required_myr::text AS cash_required, received_at::text AS received_at
           FROM wholesaler_pos WHERE id = $1`,
          [poId],
        )
      ).rows;
      expect(cash).toEqual({ cash_required: '135.00', received_at: po.received_at });

      // A different count is refused, never silently absorbed.
      const changed = await expectRejectedIn(
        db,
        'SELECT fn_receive_po($1, $2::jsonb, $3)',
        [
          poId,
          JSON.stringify([
            { skuCode: 'A1', cartonsReceived: 0 },
            { skuCode: 'C1', cartonsReceived: 1 },
          ]),
          '2028-02-10T08:05:00+08',
        ],
      );
      expect(changed.message).toContain('immutable');
    });
  });
});
