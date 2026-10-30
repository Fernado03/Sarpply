import { describe, expect, it } from 'vitest';
import { query } from './helpers';

describe('Phase 1 workbook fixtures', () => {
  it('replays B01 to the measured carton plan', async () => {
    const [plan] = await query<{
      cartons: string;
      boxes: string;
      liters: string;
    }>(`SELECT SUM(c_cartons)::text AS cartons,
              SUM(physical_boxes)::text AS boxes,
              SUM(geometric_liters)::text AS liters
       FROM v_route_batch_aggregation a
       JOIN route_batches b ON b.id = a.route_batch_id
       WHERE b.delivery_date = DATE '2026-10-15'`);

    expect(plan).toEqual({ cartons: '13', boxes: '18', liters: '901.50' });
  });

  it('accepts the measured 979.9 L B01 Sortie against the 980 L Myvi', async () => {
    const [load] = await query<{ packed_liters: string; max_cargo_liters: number; fits: boolean }>(
      `SELECT v.packed_liters::text, v.max_cargo_liters, v.fits
       FROM v_sortie_load v
       JOIN route_batches b ON b.id = v.route_batch_id
       WHERE b.delivery_date = DATE '2026-10-15'`,
    );

    expect(load).toEqual({ packed_liters: '979.9', max_cargo_liters: 980, fits: true });
  });

  it('values Buffer Stock at cost across the two batches', async () => {
    const rows = await query<{
      delivery_date: string;
      opening: string;
      closing: string;
    }>(`SELECT b.delivery_date::text,
              SUM(v.opening_cost_myr)::text AS opening,
              SUM(v.closing_cost_myr)::text AS closing
       FROM v_batch_buffer v
       JOIN route_batches b ON b.id = v.route_batch_id
       WHERE b.delivery_date IN (DATE '2026-10-15', DATE '2026-10-22')
       GROUP BY b.delivery_date
       ORDER BY b.delivery_date`);

    expect(rows).toEqual([
      { delivery_date: '2026-10-15', opening: '0.00', closing: '183.00' },
      { delivery_date: '2026-10-22', opening: '183.00', closing: '37.50' },
    ]);
  });

  it('publishes the measured B01 and B02 margins', async () => {
    const rows = await query<{
      delivery_date: string;
      forecast: string;
      realized: string;
      gmv: string;
    }>(`SELECT b.delivery_date::text,
              p.forecast_gp_myr::text AS forecast,
              p.realized_gp_myr::text AS realized,
              p.gmv_delivered_myr::text AS gmv
       FROM v_route_batch_pnl p
       JOIN route_batches b ON b.id = p.route_batch_id
       WHERE b.delivery_date IN (DATE '2026-10-15', DATE '2026-10-22')
       ORDER BY b.delivery_date`);

    expect(rows).toEqual([
      { delivery_date: '2026-10-15', forecast: '173.00', realized: '167.00', gmv: '1657.00' },
      { delivery_date: '2026-10-22', forecast: '190.50', realized: '187.50', gmv: '1896.00' },
    ]);
  });

  it('stamps a source channel on every order row', async () => {
    const rows = await query<{ source_channel: string; count: string }>(
      `SELECT source_channel, COUNT(*)::text AS count
       FROM stall_orders GROUP BY source_channel ORDER BY source_channel`,
    );
    expect(rows).toEqual([
      { source_channel: 'STALL', count: '1' },
      { source_channel: 'TEXT', count: '26' },
      { source_channel: 'VOICE', count: '4' },
    ]);
  });

  it('loads both workbook batches with their POs', async () => {
    const rows = await query<{ delivery_date: string; lines: string; orders: string }>(
      `SELECT b.delivery_date::text,
              (SELECT COUNT(*) FROM wholesaler_po_lines l
               JOIN wholesaler_pos p ON p.id = l.po_id
               WHERE p.route_batch_id = b.id)::text AS lines,
              (SELECT COUNT(*) FROM stall_orders o WHERE o.route_batch_id = b.id)::text AS orders
       FROM route_batches b
       WHERE b.delivery_date IN (DATE '2026-10-15', DATE '2026-10-22')
       ORDER BY b.delivery_date`,
    );

    expect(rows).toEqual([
      { delivery_date: '2026-10-15', lines: '6', orders: '15' },
      { delivery_date: '2026-10-22', lines: '6', orders: '16' },
    ]);
  });
});
