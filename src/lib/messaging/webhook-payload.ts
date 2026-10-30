export type InboundMessageType = 'TEXT' | 'AUDIO' | 'OTHER';

export interface InboundMessageRecord {
  providerMessageId: string;
  fromPhone: string;
  body: string | null;
  messageType: InboundMessageType;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaDurationSeconds: number | null;
  isVoiceNote: boolean;
  receivedAt: Date | null;
  raw: unknown;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function property(value: object, key: string): unknown {
  return key in value ? Reflect.get(value, key) : undefined;
}

/**
 * Extract inbound messages from a Cloud API webhook payload. Status-only
 * changes and malformed entries are ignored. Audio is metadata only: no
 * transcription happens anywhere in this path (ADR-0014).
 */
export function parseCloudWebhook(payload: unknown): InboundMessageRecord[] {
  if (!payload || typeof payload !== 'object' || !('entry' in payload)) return [];

  const entries = payload.entry;
  if (!Array.isArray(entries)) return [];

  const messages: InboundMessageRecord[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !('changes' in entry)) continue;

    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (!change || typeof change !== 'object' || !('value' in change)) continue;

      const value = change.value;
      if (!value || typeof value !== 'object' || !('messages' in value)) continue;

      const inbound = value.messages;
      if (!Array.isArray(inbound)) continue;

      for (const message of inbound) {
        if (!message || typeof message !== 'object') continue;

        const providerMessageId = stringValue(property(message, 'id'));
        const fromPhone = stringValue(property(message, 'from'));
        if (!providerMessageId || !fromPhone) continue;

        const timestamp = numberValue(property(message, 'timestamp'));
        const receivedAt = timestamp === null ? null : new Date(timestamp * 1000);
        const type = property(message, 'type');

        if (type === 'text') {
          const text = property(message, 'text');
          const body =
            text && typeof text === 'object' ? stringValue(property(text, 'body')) : null;
          messages.push({
            providerMessageId,
            fromPhone,
            body,
            messageType: 'TEXT',
            mediaId: null,
            mediaMimeType: null,
            mediaDurationSeconds: null,
            isVoiceNote: false,
            receivedAt,
            raw: message,
          });
          continue;
        }

        if (type === 'audio') {
          const audio = property(message, 'audio');
          const media = audio && typeof audio === 'object' ? audio : null;
          messages.push({
            providerMessageId,
            fromPhone,
            body: null,
            messageType: 'AUDIO',
            mediaId: media ? stringValue(property(media, 'id')) : null,
            mediaMimeType: media ? stringValue(property(media, 'mime_type')) : null,
            mediaDurationSeconds: media
              ? numberValue(property(media, 'duration_seconds'))
              : null,
            isVoiceNote: media ? property(media, 'voice') === true : false,
            receivedAt,
            raw: message,
          });
          continue;
        }

        messages.push({
          providerMessageId,
          fromPhone,
          body: null,
          messageType: 'OTHER',
          mediaId: null,
          mediaMimeType: null,
          mediaDurationSeconds: null,
          isVoiceNote: false,
          receivedAt,
          raw: message,
        });
      }
    }
  }

  return messages;
}
