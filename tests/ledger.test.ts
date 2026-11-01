import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { expectRejected, query } from './helpers';

describe('ledger posting contract', () => {
  it('refuses an outbound movement larger than the balance', async () => {
    const [vehicle] = await query<{ id: string }>("SELECT id FROM vehicles WHERE label = 'Myvi'");
    const rejection = await expectRejected(
      `SELECT fn_post_stock_movement(
         p_sku_code => 'A1',
         p_vehicle_id => $1,
         p_quantity_bundles => -99999,
         p_movement_type => 'DAMAGE_WRITE_OFF',
         p_idempotency_key => 'TEST:OVERDRAW'
       )`,
      [vehicle.id],
    );
    expect(rejection.message).toContain('cannot post');
  });
});

describe('provider message idempotency', () => {
  it('stores a redelivered provider message once', async () => {
    const providerMessageId = `wamid.test.${randomUUID()}`;
    const insert = `INSERT INTO inbound_messages
        (provider_message_id, from_phone, body)
      VALUES ($1, '+60128812341', 'A1 x 3')
      ON CONFLICT (provider_message_id) DO NOTHING`;

    await query(insert, [providerMessageId]);
    await query(insert, [providerMessageId]);

    const rows = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM inbound_messages WHERE provider_message_id = $1',
      [providerMessageId],
    );
    expect(rows[0].count).toBe('1');

    await query('DELETE FROM inbound_messages WHERE provider_message_id = $1', [providerMessageId]);
  });
});
