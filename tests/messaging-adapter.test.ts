import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  CloudApiMessagingAdapter,
  FakeMessagingAdapter,
  MessagingError,
  createMessagingPort,
  parseCloudWebhook,
  verifyCloudSignature,
  verifyWebhookToken,
} from '../src/lib/messaging';

const SECRET = 'test-app-secret';

function signature(body: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

function messageEnvelope(id: string, from: string, body: string): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: { messages: [{ id, from, timestamp: '1761798000', type: 'text', text: { body } }] },
          },
        ],
      },
    ],
  });
}

describe('in-memory fake adapter contract', () => {
  it('records sent messages and returns distinct provider ids', async () => {
    const fake = new FakeMessagingAdapter();
    const first = await fake.send({ id: 'm1', toPhone: '+60123', body: 'one' });
    const second = await fake.send({ id: 'm2', toPhone: '+60124', body: 'two' });

    expect(first.providerMessageId).not.toBe(second.providerMessageId);
    expect(fake.sent).toEqual([
      { id: 'm1', toPhone: '+60123', body: 'one' },
      { id: 'm2', toPhone: '+60124', body: 'two' },
    ]);
  });

  it('fails the configured number once and then succeeds', async () => {
    const fake = new FakeMessagingAdapter({ failOnceFor: ['+60123'] });
    const message = { id: 'm1', toPhone: '+60123', body: 'one' };

    await expect(fake.send(message)).rejects.toBeInstanceOf(MessagingError);
    await expect(fake.send(message)).resolves.toMatchObject({
      providerMessageId: expect.any(String),
    });
    expect(fake.sent).toHaveLength(1);
  });

  it('keeps failing a number configured to always fail', async () => {
    const fake = new FakeMessagingAdapter({ alwaysFailFor: ['+60123'] });
    const message = { id: 'm1', toPhone: '+60123', body: 'one' };

    await expect(fake.send(message)).rejects.toBeInstanceOf(MessagingError);
    await expect(fake.send(message)).rejects.toBeInstanceOf(MessagingError);
    expect(fake.sent).toHaveLength(0);
  });
});

describe('Cloud API adapter contract', () => {
  it('posts a text message to the configured phone number id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ messages: [{ id: 'wamid.out-1' }] }),
    );
    const adapter = new CloudApiMessagingAdapter({
      accessToken: 'token-123',
      phoneNumberId: 'phone-456',
      graphVersion: 'v23.0',
      fetch: fetchMock,
    });

    const result = await adapter.send({
      id: 'm1',
      toPhone: '+60 12-345 6789',
      body: 'Hello',
    });

    expect(result.providerMessageId).toBe('wamid.out-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v23.0/phone-456/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '60123456789',
      type: 'text',
      text: { body: 'Hello', preview_url: false },
    });
  });

  it('turns a provider error into a MessagingError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: { message: 'invalid token' } }, { status: 401 }));
    const adapter = new CloudApiMessagingAdapter({
      accessToken: 'bad',
      phoneNumberId: 'phone',
      fetch: fetchMock,
    });

    await expect(
      adapter.send({ id: 'm1', toPhone: '+60123', body: 'Hello' }),
    ).rejects.toThrow('invalid token');
  });

  it('refuses a success response without a provider message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ messages: [] }));
    const adapter = new CloudApiMessagingAdapter({
      accessToken: 'token',
      phoneNumberId: 'phone',
      fetch: fetchMock,
    });

    await expect(
      adapter.send({ id: 'm1', toPhone: '+60123', body: 'Hello' }),
    ).rejects.toThrow('no message id');
  });

  it('selects the adapter from configuration', () => {
    expect(createMessagingPort({ WHATSAPP_PROVIDER: 'fake' }).name).toBe('fake');
    expect(createMessagingPort({}).name).toBe('fake');
    expect(
      createMessagingPort({
        WHATSAPP_PROVIDER: 'cloud',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: 'phone',
      }).name,
    ).toBe('cloud');
    expect(() => createMessagingPort({ WHATSAPP_PROVIDER: 'cloud' })).toThrow(
      'WHATSAPP_ACCESS_TOKEN',
    );
    expect(() => createMessagingPort({ WHATSAPP_PROVIDER: 'carrier-pigeon' })).toThrow(
      'unknown WHATSAPP_PROVIDER',
    );
  });
});

describe('webhook signature verification', () => {
  it('accepts the app-secret HMAC over the raw body', () => {
    const body = messageEnvelope('wamid.1', '60123', 'A1 x 3');
    expect(verifyCloudSignature(body, signature(body), SECRET)).toBe(true);
  });

  it('rejects a missing, malformed or forged signature', () => {
    const body = messageEnvelope('wamid.1', '60123', 'A1 x 3');
    expect(verifyCloudSignature(body, null, SECRET)).toBe(false);
    expect(verifyCloudSignature(body, 'sha1=abc', SECRET)).toBe(false);
    expect(verifyCloudSignature(body, 'sha256=zzzz', SECRET)).toBe(false);
    expect(verifyCloudSignature(body, signature(body, 'wrong-secret'), SECRET)).toBe(false);
    expect(verifyCloudSignature(body, signature(body), null)).toBe(false);
    expect(
      verifyCloudSignature(body, signature(body), SECRET.replace('secret', 'SECRET')),
    ).toBe(false);
  });

  it('compares the subscription token without echoing it', () => {
    expect(verifyWebhookToken('token', 'token')).toBe(true);
    expect(verifyWebhookToken('nope', 'token')).toBe(false);
    expect(verifyWebhookToken(null, 'token')).toBe(false);
    expect(verifyWebhookToken('token', null)).toBe(false);
  });
});

describe('Cloud API webhook payload parsing', () => {
  it('extracts text messages and ignores status-only changes', () => {
    const messages = parseCloudWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.TEXT',
                    from: '60128812341',
                    timestamp: '1761798000',
                    type: 'text',
                    text: { body: 'A1 x 3' },
                  },
                ],
              },
            },
            { value: { statuses: [{ id: 'wamid.SENT', status: 'delivered' }] } },
          ],
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      providerMessageId: 'wamid.TEXT',
      fromPhone: '60128812341',
      body: 'A1 x 3',
      messageType: 'TEXT',
      isVoiceNote: false,
      receivedAt: new Date(1761798000 * 1000),
    });
  });

  it('keeps voice-note metadata and never a transcript', () => {
    const messages = parseCloudWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.VOICE',
                    from: '60198765432',
                    type: 'audio',
                    audio: {
                      id: 'media-1',
                      mime_type: 'audio/ogg; codecs=opus',
                      voice: true,
                      duration_seconds: 4,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(messages[0]).toMatchObject({
      body: null,
      messageType: 'AUDIO',
      mediaId: 'media-1',
      mediaMimeType: 'audio/ogg; codecs=opus',
      mediaDurationSeconds: 4,
      isVoiceNote: true,
    });
    expect(messages[0].raw).toMatchObject({
      audio: { id: 'media-1', voice: true },
    });
  });

  it('skips entries without a provider id or sender', () => {
    expect(parseCloudWebhook({})).toEqual([]);
    expect(
      parseCloudWebhook({
        entry: [{ changes: [{ value: { messages: [{ type: 'text' }] } }] }],
      }),
    ).toEqual([]);
  });
});
