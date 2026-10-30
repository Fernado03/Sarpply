import { appStore } from '@/lib/messaging/store';
import { createWhatsAppWebhook } from '@/lib/messaging/webhook';

export const runtime = 'nodejs';

const handlers = createWhatsAppWebhook({
  appSecret: process.env.WHATSAPP_APP_SECRET ?? null,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? null,
  store: appStore,
});

export async function GET(request: Request): Promise<Response> {
  return handlers.GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return handlers.POST(request);
}
