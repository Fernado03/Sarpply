import { describe, expect, it } from 'vitest';
import { query } from './helpers';

describe('seeded walking skeleton', () => {
  it('opens one Route Batch with the measured Myvi load and Runner cost', async () => {
    const [batch] = await query<{
      status: string;
      delivery_date: string;
      cutoff_ok: boolean;
      sortie_count: number;
      runner_cost_myr: string;
      vehicle: string;
      route: string;
    }>(`SELECT b.status,
              b.delivery_date::text,
              b.cutoff_at = TIMESTAMPTZ '2026-11-04 12:00:00+08' AS cutoff_ok,
              b.sortie_count,
              b.runner_cost_myr::text,
              v.label AS vehicle,
              r.name AS route
       FROM route_batches b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN routes r ON r.id = b.route_id
       WHERE b.status = 'OPEN_FOR_ORDERS'`);

    expect(batch).toMatchObject({
      status: 'OPEN_FOR_ORDERS',
      delivery_date: '2026-11-05',
      sortie_count: 1,
      runner_cost_myr: '42.50',
      vehicle: 'Myvi',
      route: 'Premier 101 + Gala City',
      cutoff_ok: true,
    });
  });

  it('seeds nine active Stalls across both Clusters and the Golden 6 catalogue', async () => {
    const [stalls] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM stalls
       WHERE onboarding_status = 'ACTIVE' AND is_active`,
    );
    expect(stalls.count).toBe('9');

    const clusters = await query<{ name: string; stalls: string }>(
      `SELECT c.name, COUNT(st.id)::text AS stalls
       FROM clusters c JOIN stalls st ON st.cluster_id = c.id
       WHERE st.onboarding_status = 'ACTIVE'
       GROUP BY c.name ORDER BY c.name`,
    );
    expect(clusters).toEqual([
      { name: 'Gala City', stalls: '4' },
      { name: 'Premier 101', stalls: '5' },
    ]);

    const [skus] = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM skus');
    expect(skus.count).toBe('6');
  });

  it('records the OPENED transition for the open batch', async () => {
    const rows = await query<{ transition_type: string }>(
      `SELECT t.transition_type
       FROM route_batch_transitions t
       JOIN route_batches b ON b.id = t.route_batch_id
       WHERE b.delivery_date = DATE '2026-11-05'`,
    );
    expect(rows.map((row) => row.transition_type)).toEqual(['OPENED']);
  });
});
