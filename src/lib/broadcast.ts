import type { Queryable } from './db';
import type { MessagingPort } from './messaging/types';

interface PendingMessage {
  id: string;
  to_phone: string;
  body: string;
  status: string;
}

export interface BroadcastResult {
  queued: number;
  sent: number;
  failed: number;
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'send failed';
}

/** Queue Script B for the batch; a retry queues nothing new. */
export async function queueBroadcast(db: Queryable, routeBatchId: string): Promise<number> {
  const { rows } = await db.query<{ queued: number }>(
    'SELECT fn_queue_broadcast($1) AS queued',
    [routeBatchId],
  );
  return rows[0].queued;
}

export async function pendingMessages(
  db: Queryable,
  routeBatchId: string,
): Promise<PendingMessage[]> {
  const { rows } = await db.query<PendingMessage>(
    `SELECT id, to_phone, body, status
       FROM fn_pending_outbound_messages($1)`,
    [routeBatchId],
  );
  return rows;
}

/**
 * Send one still-pending row through the port and record the provider result
 * on that row. A failure leaves the same row FAILED, so a retry updates it
 * instead of creating a second message.
 */
async function deliverOne(
  db: Queryable,
  message: PendingMessage,
  port: MessagingPort,
): Promise<'sent' | 'failed'> {
  let providerMessageId: string;
  try {
    const result = await port.send({
      id: message.id,
      toPhone: message.to_phone,
      body: message.body,
    });
    providerMessageId = result.providerMessageId;
  } catch (error) {
    await db.query('SELECT fn_mark_outbound_failed($1, $2)', [
      message.id,
      failureText(error),
    ]);
    return 'failed';
  }

  await db.query('SELECT fn_mark_outbound_sent($1, $2)', [
    message.id,
    providerMessageId,
  ]);
  return 'sent';
}

/**
 * Send every still-pending row through the port and record the provider
 * result on that row. A failure leaves the same row FAILED, so a retry
 * updates it instead of creating a second message.
 */
export async function deliverPendingMessages(
  db: Queryable,
  routeBatchId: string,
  port: MessagingPort,
): Promise<Omit<BroadcastResult, 'queued'>> {
  const pending = await pendingMessages(db, routeBatchId);
  let sent = 0;
  let failed = 0;

  for (const message of pending) {
    if ((await deliverOne(db, message, port)) === 'sent') sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}

/** Send exactly one queued or failed row; a sent or missing row is a no-op. */
export async function deliverOutboundMessage(
  db: Queryable,
  messageId: string,
  port: MessagingPort,
): Promise<'sent' | 'failed' | 'missing'> {
  const { rows } = await db.query<PendingMessage>(
    `SELECT id, to_phone, body, status
       FROM outbound_messages
      WHERE id = $1`,
    [messageId],
  );
  const message = rows[0];
  if (!message || message.status === 'SENT') return 'missing';
  return deliverOne(db, message, port);
}

export async function broadcastBatch(
  db: Queryable,
  routeBatchId: string,
  port: MessagingPort,
): Promise<BroadcastResult> {
  const queued = await queueBroadcast(db, routeBatchId);
  const delivery = await deliverPendingMessages(db, routeBatchId, port);
  return { queued, ...delivery };
}
