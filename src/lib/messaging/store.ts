import type { QueryResultRow } from 'pg';
import { pool } from '../db';
import type { InboundMessageRecord } from './webhook-payload';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface StoredInboundMessage {
  id: string;
  created: boolean;
}

/** Persist one webhook message; a provider-id redelivery writes nothing. */
export async function storeInboundMessage(
  db: Queryable,
  message: InboundMessageRecord,
): Promise<StoredInboundMessage> {
  const { rows } = await db.query<{ id: string; created: boolean }>(
    `SELECT message_id AS id, created
       FROM fn_store_inbound_message($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)`,
    [
      message.providerMessageId,
      message.fromPhone,
      message.body,
      JSON.stringify(message.raw ?? null),
      message.messageType,
      message.mediaId,
      message.mediaMimeType,
      message.mediaDurationSeconds,
      message.isVoiceNote,
      message.receivedAt,
    ],
  );
  return rows[0];
}

export function appStore(message: InboundMessageRecord): Promise<StoredInboundMessage> {
  return storeInboundMessage(pool, message);
}
