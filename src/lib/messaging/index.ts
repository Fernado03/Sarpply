import { CloudApiMessagingAdapter } from './cloud';
import { FakeMessagingAdapter } from './fake';
import type { MessagingPort } from './types';

export type MessagingProvider = 'fake' | 'cloud';

export interface MessagingEnvironment {
  [key: string]: string | undefined;
  WHATSAPP_PROVIDER?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_VERSION?: string;
}

/**
 * The adapter is the only configuration-dependent part of messaging. The
 * default fake lets the console run without credentials; setting
 * `WHATSAPP_PROVIDER=cloud` selects the real adapter.
 */
export function createMessagingPort(
  env: MessagingEnvironment = process.env,
  fetchImpl?: typeof fetch,
): MessagingPort {
  const provider = (env.WHATSAPP_PROVIDER ?? 'fake').trim().toLowerCase();

  if (provider === 'fake') {
    return new FakeMessagingAdapter();
  }

  if (provider === 'cloud') {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'WHATSAPP_PROVIDER=cloud requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID',
      );
    }
    return new CloudApiMessagingAdapter({
      accessToken,
      phoneNumberId,
      graphVersion: env.WHATSAPP_GRAPH_VERSION?.trim() || undefined,
      fetch: fetchImpl,
    });
  }

  throw new Error(`unknown WHATSAPP_PROVIDER "${provider}"; use "fake" or "cloud"`);
}

export { CloudApiMessagingAdapter } from './cloud';
export { verifyCloudSignature, verifyWebhookToken } from './cloud';
export { FakeMessagingAdapter } from './fake';
export type { MessagingPort, OutboundEnvelope, SendResult } from './types';
export { MessagingError } from './types';
export { parseCloudWebhook } from './webhook-payload';
export type { InboundMessageRecord, InboundMessageType } from './webhook-payload';
