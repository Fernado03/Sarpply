import { verifyCloudSignature, verifyWebhookToken } from './cloud';
import type { StoredInboundMessage } from './store';
import { parseCloudWebhook, type InboundMessageRecord } from './webhook-payload';

export interface WhatsAppWebhookDependencies {
  appSecret: string | null;
  verifyToken: string | null;
  store: (message: InboundMessageRecord) => Promise<StoredInboundMessage>;
}

export interface WhatsAppWebhookHandlers {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

function challengeAnswer(request: Request, verifyToken: string | null): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || challenge === null || !verifyWebhookToken(token, verifyToken)) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Signature verification and storage are dependencies so the same handler
 * can be exercised against the real database in tests. The route module wires
 * them to the environment and the application pool.
 */
export function createWhatsAppWebhook(
  dependencies: WhatsAppWebhookDependencies,
): WhatsAppWebhookHandlers {
  return {
    async GET(request: Request): Promise<Response> {
      return challengeAnswer(request, dependencies.verifyToken);
    },

    async POST(request: Request): Promise<Response> {
      const rawBody = await request.text();
      const signature = request.headers.get('x-hub-signature-256');

      if (!verifyCloudSignature(rawBody, signature, dependencies.appSecret)) {
        return new Response('Unauthorized', { status: 401 });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      const messages = parseCloudWebhook(payload);
      try {
        for (const message of messages) {
          await dependencies.store(message);
        }
      } catch {
        return new Response('Could not store the message', { status: 500 });
      }

      return Response.json({ received: messages.length });
    },
  };
}
