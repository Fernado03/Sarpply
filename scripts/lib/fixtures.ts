import { readFileSync } from 'node:fs';
import path from 'node:path';
import { read, utils } from '@e965/xlsx';
import type { Client } from 'pg';

const WORKBOOK = path.join(
  process.cwd(),
  'docs',
  '01_business_ops',
  'Sarpply_Phase_1_Tracking_Sheet_Master.xlsx',
);
const ROUTE_NAME = 'Premier 101 + Gala City';
const FIXTURE_BATCHES = ['B01', 'B02'];
const RUNNER_COST_MYR = 42.5;

type Cell = string | number | Date | null;
type Row = Record<string, Cell>;

interface OrderFixture {
  batchId: string;
  deliveryDate: string;
  stallCode: string;
  skuCode: string;
  orderType: 'PREORDER' | 'SPOT';
  ordered: number;
  delivered: number;
  unitPrice: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  paymentReference: string | null;
  sourceChannel: 'TEXT' | 'VOICE' | 'STALL';
  notes: string | null;
}

interface PoFixture {
  batchId: string;
  skuCode: string;
  cartonsOrdered: number;
  cartonsReceived: number;
  cartonCost: number;
}

const sheets = new Map<string, Row[]>();

function readSheet(sheet: string): Row[] {
  const cached = sheets.get(sheet);
  if (cached) return cached;

  const workbook = read(readFileSync(WORKBOOK), { type: 'buffer', cellDates: true });
  const worksheet = workbook.Sheets[sheet];
  if (!worksheet) throw new Error(`workbook sheet ${sheet} is missing`);
  const rows = utils.sheet_to_json<Row>(worksheet, { defval: null });
  sheets.set(sheet, rows);
  return rows;
}

function text(value: Cell, field: string): string {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  throw new Error(`fixture field ${field} is blank`);
}

function nullableText(value: Cell): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result === '' ? null : result;
}

function number(value: Cell, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new Error(`fixture field ${field} is not a number: ${String(value)}`);
}

function dateOnly(value: Cell, field: string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const result = text(value, field).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`fixture field ${field} is not a date: ${result}`);
  }
  return result;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function atMyTime(date: string, time: string): string {
  return `${date}T${time}+08:00`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sourceChannel(source: string): 'TEXT' | 'VOICE' | 'STALL' {
  switch (source) {
    case 'TEXT':
      return 'TEXT';
    case 'VOICE_CONFIRMED':
    case 'VOICE_FOUNDER':
      return 'VOICE';
    case 'SPOT':
      return 'STALL';
    default:
      throw new Error(`unknown order source ${source}`);
  }
}

function readOrders(): OrderFixture[] {
  return readSheet('2_Orders')
    .filter((row) => FIXTURE_BATCHES.includes(text(row.batch_id, 'batch_id')))
    .map((row) => ({
      batchId: text(row.batch_id, 'batch_id'),
      deliveryDate: dateOnly(row.delivery_date, 'delivery_date'),
      stallCode: text(row.stall_id, 'stall_id'),
      skuCode: text(row.sku_code, 'sku_code'),
      orderType: text(row.order_type, 'order_type') as 'PREORDER' | 'SPOT',
      ordered: number(row.ordered_bundles, 'ordered_bundles'),
      delivered: number(row.delivered_bundles, 'delivered_bundles'),
      unitPrice: number(row.unit_price, 'unit_price'),
      paymentStatus: text(row.payment_status, 'payment_status'),
      fulfilmentStatus: text(row.fulfilment_status, 'fulfilment_status'),
      paymentReference: nullableText(row.payment_reference),
      sourceChannel: sourceChannel(text(row.source, 'source')),
      notes: nullableText(row.notes),
    }));
}

function readPo(): PoFixture[] {
  return readSheet('3_PO')
    .filter((row) => FIXTURE_BATCHES.includes(text(row.batch_id, 'batch_id')))
    .map((row) => ({
      batchId: text(row.batch_id, 'batch_id'),
      skuCode: text(row.sku_code, 'sku_code'),
      cartonsOrdered: number(row.cartons_ordered, 'cartons_ordered'),
      cartonsReceived: number(row.cartons_received, 'cartons_received'),
      cartonCost: number(row.carton_cost, 'carton_cost'),
    }));
}

async function ensureFixtureStalls(client: Client): Promise<Map<string, string>> {
  const clusters = await client.query<{ id: string; name: string }>(
    `SELECT c.id, c.name
     FROM clusters c
     JOIN routes r ON r.id = c.route_id
     WHERE r.name = $1`,
    [ROUTE_NAME],
  );
  const clusterIds = new Map(clusters.rows.map((row) => [row.name, row.id]));

  for (const row of readSheet('1_Stalls')) {
    const code = text(row.stall_id, 'stall_id');
    const existing = await client.query('SELECT 1 FROM stalls WHERE stall_code = $1', [code]);
    if (existing.rowCount === 1) continue;

    const clusterName = text(row.cluster, 'cluster');
    const clusterId = clusterIds.get(clusterName);
    if (!clusterId) throw new Error(`fixture cluster ${clusterName} is not seeded`);
    const phone = nullableText(row.whatsapp_phone);

    await client.query(
      `INSERT INTO stalls
         (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
          written_language, trust_tier, onboarding_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        code,
        clusterId,
        text(row.stall_number, 'stall_number'),
        text(row.stall_name, 'stall_name'),
        phone,
        text(row.written_language, 'written_language'),
        text(row.trust_tier, 'trust_tier'),
        phone ? 'ACTIVE' : 'PROVISIONAL_SPOT',
      ],
    );
  }

  const stalls = await client.query<{ id: string; stall_code: string }>(
    'SELECT id, stall_code FROM stalls',
  );
  return new Map(stalls.rows.map((row) => [row.stall_code, row.id]));
}

export async function loadPhase1Fixtures(client: Client): Promise<void> {
  const orders = readOrders();
  const poLines = readPo();
  const stallIds = await ensureFixtureStalls(client);

  const route = await client.query<{ id: string }>('SELECT id FROM routes WHERE name = $1', [ROUTE_NAME]);
  const vehicle = await client.query<{ id: string }>("SELECT id FROM vehicles WHERE label = 'Myvi'");
  const routeId = route.rows[0]?.id;
  const vehicleId = vehicle.rows[0]?.id;
  if (!routeId || !vehicleId) throw new Error('seeded Route or Myvi Vehicle is missing');

  const skus = await client.query<{ sku_code: string; bundles_per_master_carton: number }>(
    'SELECT sku_code, bundles_per_master_carton FROM skus',
  );
  const bundlesPerCarton = new Map(
    skus.rows.map((row) => [row.sku_code, row.bundles_per_master_carton]),
  );

  const wholesaler = await client.query<{ id: string }>(
    "SELECT id FROM wholesalers WHERE name = 'Pending Packaging Supplies'",
  );
  const wholesalerId = wholesaler.rows[0]?.id;
  if (!wholesalerId) throw new Error('seeded Wholesaler is missing');

  const balances = new Map<string, { bundles: number; cost: number }>();

  for (const batchId of FIXTURE_BATCHES) {
    const batchOrders = orders.filter((order) => order.batchId === batchId);
    const batchPo = poLines.filter((line) => line.batchId === batchId);
    if (batchOrders.length === 0 || batchPo.length === 0) {
      throw new Error(`fixture batch ${batchId} is incomplete`);
    }

    const deliveryDate = batchOrders[0].deliveryDate;
    const cutoffDate = addDays(deliveryDate, -1);
    const insertedBatch = await client.query<{ id: string }>(
      `INSERT INTO route_batches
         (route_id, vehicle_id, delivery_date, status, sortie_count, runner_cost_myr,
          cutoff_at, opened_at, reconciled_at)
       VALUES ($1, $2, $3, 'RECONCILED', 1, $4, $5, $6, $7)
       RETURNING id`,
      [
        routeId,
        vehicleId,
        deliveryDate,
        RUNNER_COST_MYR,
        atMyTime(cutoffDate, '12:00:00'),
        atMyTime(addDays(cutoffDate, -7), '00:00:00'),
        atMyTime(deliveryDate, '18:00:00'),
      ],
    );
    const batchUuid = insertedBatch.rows[0].id;

    for (const line of batchPo) {
      await client.query(
        `INSERT INTO route_batch_prices
           (route_batch_id, sku_code, wholesaler_price_id,
            locked_carton_cost, locked_pool_bundle_price)
         SELECT $1::uuid, $2::varchar, wp.id, $3::numeric, pp.pool_bundle_price
         FROM wholesaler_prices wp
         JOIN pool_prices pp ON pp.sku_code = wp.sku_code AND pp.valid_to IS NULL
         WHERE wp.sku_code = $2 AND wp.valid_to IS NULL`,
        [batchUuid, line.skuCode, line.cartonCost],
      );
    }

    const cashRequired = batchPo.reduce(
      (total, line) => total + line.cartonsReceived * line.cartonCost,
      0,
    );
    const insertedPo = await client.query<{ id: string }>(
      `INSERT INTO wholesaler_pos
         (route_batch_id, wholesaler_id, submitted_at, received_at, cash_required_myr)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        batchUuid,
        wholesalerId,
        atMyTime(cutoffDate, '13:00:00'),
        atMyTime(deliveryDate, '07:30:00'),
        round2(cashRequired),
      ],
    );
    const poId = insertedPo.rows[0].id;

    for (const line of batchPo) {
      await client.query(
        `INSERT INTO wholesaler_po_lines
           (po_id, sku_code, cartons_ordered, cartons_received, carton_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [poId, line.skuCode, line.cartonsOrdered, line.cartonsReceived, line.cartonCost],
      );
    }

    const orderIds = new Map<string, string>();
    for (const order of batchOrders) {
      const stallId = stallIds.get(order.stallCode);
      if (!stallId) throw new Error(`fixture Stall ${order.stallCode} is missing`);
      const paid = order.paymentStatus === 'PAID_CASH' || order.paymentStatus === 'PAID_DUITNOW';
      const proofUrl =
        order.paymentStatus === 'PAID_DUITNOW'
          ? `https://fixtures.sarpply.local/${batchId}/${order.stallCode}/${order.paymentReference}`
          : null;

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO stall_orders
           (route_batch_id, stall_id, sku_code, order_type, source_channel,
            ordered_bundles, delivered_bundles, unit_price_locked,
            payment_status, fulfilment_status, payment_reference, payment_proof_url,
            payment_attested_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          batchUuid,
          stallId,
          order.skuCode,
          order.orderType,
          order.sourceChannel,
          order.ordered,
          order.delivered,
          order.unitPrice,
          order.paymentStatus,
          order.fulfilmentStatus,
          order.paymentReference,
          proofUrl,
          paid ? atMyTime(deliveryDate, '15:00:00') : null,
          order.notes,
        ],
      );
      orderIds.set(`${order.stallCode}:${order.skuCode}`, inserted.rows[0].id);
    }

    // Receipts first: stock is in the Vehicle before any handover.
    for (const line of batchPo) {
      if (line.cartonsReceived === 0) continue;
      const perCarton = bundlesPerCarton.get(line.skuCode);
      if (!perCarton) throw new Error(`fixture SKU ${line.skuCode} is not seeded`);
      const bundles = line.cartonsReceived * perCarton;
      const unitCost = round2(line.cartonCost / perCarton);
      await client.query(
        `INSERT INTO stock_movements
           (sku_code, vehicle_id, quantity_bundles, unit_cost_myr, movement_type,
            route_batch_id, idempotency_key, occurred_at)
         VALUES ($1, $2, $3, $4, 'PURCHASE_RECEIPT', $5, $6, $7)`,
        [
          line.skuCode,
          vehicleId,
          bundles,
          unitCost,
          batchUuid,
          `FIXTURE:${batchId}:${line.skuCode}:RECEIPT`,
          atMyTime(deliveryDate, '07:45:00'),
        ],
      );
      const balance = balances.get(line.skuCode) ?? { bundles: 0, cost: 0 };
      balances.set(line.skuCode, {
        bundles: balance.bundles + bundles,
        cost: balance.cost + bundles * unitCost,
      });
    }

    // Then deliveries, in stable Stall/SKU order, at the weighted average.
    const sortedOrders = [...batchOrders].sort((a, b) =>
      `${a.stallCode}:${a.skuCode}`.localeCompare(`${b.stallCode}:${b.skuCode}`),
    );
    for (const order of sortedOrders) {
      if (order.delivered === 0) continue;
      const balance = balances.get(order.skuCode);
      if (!balance || balance.bundles < order.delivered) {
        throw new Error(
          `fixture batch ${batchId} has no stock for ${order.stallCode} ${order.skuCode}`,
        );
      }
      const unitCost = round2(balance.cost / balance.bundles);
      const orderId = orderIds.get(`${order.stallCode}:${order.skuCode}`);
      if (!orderId) throw new Error(`fixture order id missing for ${order.stallCode}`);

      await client.query(
        `INSERT INTO stock_movements
           (sku_code, vehicle_id, quantity_bundles, unit_cost_myr, movement_type,
            route_batch_id, stall_order_id, idempotency_key, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.skuCode,
          vehicleId,
          -order.delivered,
          unitCost,
          order.orderType === 'SPOT' ? 'SPOT_SALE' : 'DELIVERY',
          batchUuid,
          orderId,
          `FIXTURE:${batchId}:${orderId}`,
          atMyTime(deliveryDate, '15:00:00'),
        ],
      );

      const remaining = balance.bundles - order.delivered;
      balances.set(order.skuCode, {
        bundles: remaining,
        cost: remaining === 0 ? 0 : balance.cost - order.delivered * unitCost,
      });
    }
  }
}
