import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  MessagingError,
  type MessagingPort,
  type OutboundEnvelope,
  type SendResult,
} from './types';

const GRAPH_HOST = 'https://graph.facebook.com';

export interface CloudApiConfig {
  accessToken: string;
  phoneNumberId: string;
  graphVersion?: string;
  fetch?: typeof fetch;
}

interface CloudSendResponse {
  messages?: { id?: string }[];
  error?: { message?: string };
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * WhatsApp Cloud API adapter. The port is the only thing the application
 * knows; provider request shape, auth and errors stop here.
 */
export class CloudApiMessagingAdapter implements MessagingPort {
  readonly name = 'cloud';

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CloudApiConfig) {
    this.fetchImpl = config.fetch ?? fetch;
  }

  async send(message: OutboundEnvelope): Promise<SendResult> {
    const version = this.config.graphVersion ?? 'v23.0';
    const url = `${GRAPH_HOST}/${version}/${this.config.phoneNumberId}/messages`;
    const to = digitsOnly(message.toPhone);
    if (to === '') {
      throw new MessagingError(`cannot send to an invalid phone: ${message.toPhone}`);
    }

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: message.body, preview_url: false },
      }),
    });

    let payload: CloudSendResponse = {};
    try {
      payload = (await response.json()) as CloudSendResponse;
    } catch {
      // A non-JSON error body still carries the HTTP status below.
    }

    if (!response.ok) {
      throw new MessagingError(
        payload.error?.message ?? `WhatsApp Cloud API returned ${response.status}`,
      );
    }

    const providerMessageId = payload.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new MessagingError('WhatsApp Cloud API returned no message id');
    }

    return { providerMessageId };
  }
}

/**
 * Meta signs the raw POST body with the app secret:
 * `X-Hub-Signature-256: sha256=<hex>`. Missing configuration or a missing
 * header is a rejection, never a pass.
 */
export function verifyCloudSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null,
): boolean {
  if (!appSecret || !signatureHeader) return false;

  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;

  const provided = signatureHeader.slice(prefix.length);
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(provided, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The subscription handshake compares the caller's token, never logs it. */
export function verifyWebhookToken(
  provided: string | null,
  expected: string | null,
): boolean {
  if (!provided || !expected) return false;
  const given = createHmac('sha256', 'verify-token').update(provided, 'utf8').digest();
  const wanted = createHmac('sha256', 'verify-token').update(expected, 'utf8').digest();
  return timingSafeEqual(given, wanted);
}
