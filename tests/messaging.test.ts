import { createHmac } from 'node:crypto';
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { deliverPendingMessages } from '../src/lib/broadcast';
import { FakeMessagingAdapter } from '../src/lib/messaging/fake';
import { storeInboundMessage } from '../src/lib/messaging/store';
import { createWhatsAppWebhook } from '../src/lib/messaging/webhook';
import { expectRejectedIn, withTransaction } from './helpers';

const SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'test-verify-token';
const S02_PHONE = '+60198765432';

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

function payload(messages: unknown[]): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [{ field: 'messages', value: { messages } }],
      },
    ],
  });
}

function textMessage(id: string, from: string, body: string) {
  return { id, from, timestamp: '1761798000', type: 'text', text: { body } };
}

function postRequest(body: string, signature: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature) headers['x-hub-signature-256'] = signature;
  return new Request('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function webhook(db: Client) {
  return createWhatsAppWebhook({
    appSecret: SECRET,
    verifyToken: VERIFY_TOKEN,
    store: (message) => storeInboundMessage(db, message),
  });
}

async function seedBatchId(db: Client): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM route_batches WHERE delivery_date = DATE '2026-11-05'",
  );
  return rows[0].id;
}

async function createOpenBatch(
  db: Client,
  deliveryDate: string,
  cutoffAt: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO route_batches
       (route_id, vehicle_id, delivery_date, status, sortie_count,
        runner_cost_myr, cutoff_at, opened_at)
     SELECT r.id, v.id, $1, 'OPEN_FOR_ORDERS', 1, 42.50, $2, NOW()
       FROM routes r
       JOIN vehicles v ON v.label = 'Myvi'
      WHERE r.name = 'Premier 101 + Gala City'
     RETURNING id`,
    [deliveryDate, cutoffAt],
  );
  return rows[0].id;
}

interface OutboundRow {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  provider_message_id: string | null;
  failure_reason: string | null;
}

async function outbound(db: Client, batchId: string): Promise<OutboundRow[]> {
  const { rows } = await db.query<OutboundRow>(
    `SELECT id, to_phone, body, status, provider_message_id, failure_reason
       FROM outbound_messages
      WHERE route_batch_id = $1
      ORDER BY to_phone`,
    [batchId],
  );
  return rows;
}

describe('inbound webhook', () => {
  it('accepts a signed message and rejects an unsigned or forged one', async () => {
    await withTransaction(async (db) => {
      const batchId = await seedBatchId(db);
      const body = payload([textMessage('wamid.TEXT1', '60128812341', 'A1 x 3, C1 2')]);
      const handlers = webhook(db);

      const accepted = await handlers.POST(postRequest(body, sign(body)));
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual({ received: 1 });

      const unsigned = await handlers.POST(postRequest(body, null));
      expect(unsigned.status).toBe(401);

      const forged = await handlers.POST(postRequest(body, sign(body, 'not-the-secret')));
      expect(forged.status).toBe(401);

      const { rows } = await db.query<{
        stall_code: string;
        route_batch_id: string;
        body: string;
        message_type: string;
      }>(
        `SELECT st.stall_code, m.route_batch_id, m.body, m.message_type
           FROM inbound_messages m
           LEFT JOIN stalls st ON st.id = m.stall_id
          WHERE m.provider_message_id = 'wamid.TEXT1'`,
      );
      expect(rows).toEqual([
        {
          stall_code: 'S01',
          route_batch_id: batchId,
          body: 'A1 x 3, C1 2',
          message_type: 'TEXT',
        },
      ]);
    });
  });

  it('creates one row when the provider redelivers the same message', async () => {
    await withTransaction(async (db) => {
      const body = payload([textMessage('wamid.REDELIVER', '60128812341', 'A1 x 3')]);
      const handlers = webhook(db);

      expect((await handlers.POST(postRequest(body, sign(body)))).status).toBe(200);
      expect((await handlers.POST(postRequest(body, sign(body)))).status).toBe(200);

      const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM inbound_messages
          WHERE provider_message_id = 'wamid.REDELIVER'`,
      );
      expect(rows[0].count).toBe('1');
    });
  });

  it('stores voice-note metadata without transcribing or creating an order', async () => {
    await withTransaction(async (db) => {
      const batchId = await seedBatchId(db);
      const before = await db.query<{
        orders: string;
        voice_drafts: string;
        text_drafts: string;
      }>(
        `SELECT (SELECT COUNT(*) FROM stall_orders WHERE route_batch_id = $1)::text AS orders,
                (SELECT COUNT(*) FROM voice_order_drafts WHERE route_batch_id = $1)::text AS voice_drafts,
                (SELECT COUNT(*) FROM text_order_drafts WHERE route_batch_id = $1)::text AS text_drafts`,
        [batchId],
      );

      const body = payload([
        {
          id: 'wamid.VOICE1',
          from: '60198765432',
          timestamp: '1761798000',
          type: 'audio',
          audio: {
            id: 'media-1',
            mime_type: 'audio/ogg; codecs=opus',
            voice: true,
            duration_seconds: 4,
          },
        },
      ]);
      const handlers = webhook(db);
      expect((await handlers.POST(postRequest(body, sign(body)))).status).toBe(200);

      const { rows } = await db.query<{
        body: string | null;
        message_type: string;
        media_id: string;
        media_mime_type: string;
        media_duration_seconds: number;
        is_voice_note: boolean;
        stall_code: string | null;
      }>(
        `SELECT m.body, m.message_type, m.media_id, m.media_mime_type,
                m.media_duration_seconds, m.is_voice_note, st.stall_code
           FROM inbound_messages m
           LEFT JOIN stalls st ON st.id = m.stall_id
          WHERE m.provider_message_id = 'wamid.VOICE1'`,
      );
      expect(rows).toEqual([
        {
          body: null,
          message_type: 'AUDIO',
          media_id: 'media-1',
          media_mime_type: 'audio/ogg; codecs=opus',
          media_duration_seconds: 4,
          is_voice_note: true,
          stall_code: 'S02',
        },
      ]);

      const after = await db.query<{
        orders: string;
        voice_drafts: string;
        text_drafts: string;
      }>(
        `SELECT (SELECT COUNT(*) FROM stall_orders WHERE route_batch_id = $1)::text AS orders,
                (SELECT COUNT(*) FROM voice_order_drafts WHERE route_batch_id = $1)::text AS voice_drafts,
                (SELECT COUNT(*) FROM text_order_drafts WHERE route_batch_id = $1)::text AS text_drafts`,
        [batchId],
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  });

  it('answers the subscription handshake only for the configured token', async () => {
    await withTransaction(async (db) => {
      const handlers = webhook(db);
      const good = await handlers.GET(
        new Request(
          `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge-123`,
        ),
      );
      expect(good.status).toBe(200);
      expect(await good.text()).toBe('challenge-123');

      const bad = await handlers.GET(
        new Request(
          'http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123',
        ),
      );
      expect(bad.status).toBe(403);
    });
  });
});

describe('Tuesday broadcast', () => {
  it('queues Script B with the current Pool Prices once per Stall', async () => {
    await withTransaction(async (db) => {
      const batchId = await createOpenBatch(db, '2099-01-07', '2099-01-06T12:00:00+08');

      const first = await db.query<{ queued: number }>(
        'SELECT fn_queue_broadcast($1) AS queued',
        [batchId],
      );
      expect(first.rows[0].queued).toBe(9);

      const second = await db.query<{ queued: number }>(
        'SELECT fn_queue_broadcast($1) AS queued',
        [batchId],
      );
      expect(second.rows[0].queued).toBe(0);

      const messages = await outbound(db, batchId);
      expect(messages).toHaveLength(9);
      expect(new Set(messages.map((message) => message.to_phone)).size).toBe(9);
      for (const message of messages) {
        expect(message.status).toBe('QUEUED');
        expect(message.body.startsWith('📦 SARPPLY')).toBe(true);
        expect(message.body).toContain('SARPPLY: POOL BORONG MINGGU NI DAH BUKA');
        expect(message.body).toContain('[A1] Bekas Tapau 22oz + Penutup Rata (10 bungkus)');
        expect(message.body).toContain('= RM 15.00');
        expect(message.body).toContain('= RM 13.50');
        expect(message.body).toContain('= RM 10.50');
        expect(message.body).toContain(
          'Voice note disimpan 7 hari sahaja untuk semakan pesanan, lepas tu dipadam.',
        );
      }

      await db.query(
        `INSERT INTO stalls
           (stall_code, cluster_id, stall_number, stall_name, whatsapp_phone,
            trust_tier, onboarding_status)
         SELECT 'S99', c.id, 'P101-99', 'Walk-up Stall', '+60111119999',
                'PROVISIONAL', 'PROVISIONAL_SPOT'
           FROM clusters c
          WHERE c.name = 'Premier 101'`,
      );
      const third = await db.query<{ queued: number }>(
        'SELECT fn_queue_broadcast($1) AS queued',
        [batchId],
      );
      expect(third.rows[0].queued).toBe(0);
      expect(await outbound(db, batchId)).toHaveLength(9);
    });
  });

  it('refuses to broadcast for a batch that is no longer open', async () => {
    await withTransaction(async (db) => {
      const batchId = await createOpenBatch(db, '2099-01-14', '2099-01-13T12:00:00+08');
      await db.query(
        `UPDATE route_batches SET status = 'CLOSED_AT_CUTOFF' WHERE id = $1`,
        [batchId],
      );
      await expectRejectedIn(db, 'SELECT fn_queue_broadcast($1)', [batchId]);
    });
  });

  it('delivers through the fake adapter and retries a failure on the same row', async () => {
    await withTransaction(async (db) => {
      const batchId = await createOpenBatch(db, '2099-01-21', '2099-01-20T12:00:00+08');
      await db.query('SELECT fn_queue_broadcast($1)', [batchId]);

      const flaky = new FakeMessagingAdapter({ failOnceFor: [S02_PHONE] });
      const first = await deliverPendingMessages(db, batchId, flaky);
      expect(first).toEqual({ sent: 8, failed: 1 });

      const afterFailure = await outbound(db, batchId);
      expect(afterFailure).toHaveLength(9);
      const failed = afterFailure.filter((message) => message.status === 'FAILED');
      expect(failed).toHaveLength(1);
      expect(failed[0].to_phone).toBe(S02_PHONE);
      expect(failed[0].failure_reason).toContain('fake adapter');
      expect(afterFailure.filter((message) => message.status === 'SENT')).toHaveLength(8);

      const healthy = new FakeMessagingAdapter();
      const retry = await deliverPendingMessages(db, batchId, healthy);
      expect(retry).toEqual({ sent: 1, failed: 0 });
      expect(healthy.sent).toHaveLength(1);
      expect(healthy.sent[0].toPhone).toBe(S02_PHONE);

      const afterRetry = await outbound(db, batchId);
      expect(afterRetry).toHaveLength(9);
      expect(afterRetry.every((message) => message.status === 'SENT')).toBe(true);
      expect(afterRetry.every((message) => message.provider_message_id !== null)).toBe(true);
      expect(afterRetry.every((message) => message.failure_reason === null)).toBe(true);
      expect(new Set(afterRetry.map((message) => message.provider_message_id)).size).toBe(9);

      const again = await deliverPendingMessages(db, batchId, new FakeMessagingAdapter());
      expect(again).toEqual({ sent: 0, failed: 0 });
      expect(await outbound(db, batchId)).toHaveLength(9);
    });
  });
});
