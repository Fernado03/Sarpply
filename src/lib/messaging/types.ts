export interface OutboundEnvelope {
  id: string;
  toPhone: string;
  body: string;
}

export interface SendResult {
  providerMessageId: string;
}

export interface MessagingPort {
  readonly name: string;
  send(message: OutboundEnvelope): Promise<SendResult>;
}

export class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingError';
  }
}
