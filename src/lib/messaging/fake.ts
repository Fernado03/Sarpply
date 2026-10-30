import { randomUUID } from 'node:crypto';
import { MessagingError, type MessagingPort, type OutboundEnvelope, type SendResult } from './types';

export interface FakeMessagingOptions {
  /** Each phone in this list fails its next send, then succeeds. */
  failOnceFor?: string[];
  /** Each phone in this list fails every send. */
  alwaysFailFor?: string[];
}

/**
 * In-memory adapter for adapter-contract tests only. It is deliberately not a
 * seam for business rules: those run against PostgreSQL.
 */
export class FakeMessagingAdapter implements MessagingPort {
  readonly name = 'fake';
  readonly sent: OutboundEnvelope[] = [];

  private sequence = 0;
  private readonly remainingFailures = new Map<string, number>();

  constructor(options: FakeMessagingOptions = {}) {
    for (const phone of options.failOnceFor ?? []) {
      this.remainingFailures.set(phone, 1);
    }
    for (const phone of options.alwaysFailFor ?? []) {
      this.remainingFailures.set(phone, Number.POSITIVE_INFINITY);
    }
  }

  async send(message: OutboundEnvelope): Promise<SendResult> {
    const failures = this.remainingFailures.get(message.toPhone) ?? 0;
    if (failures > 0) {
      if (Number.isFinite(failures)) {
        this.remainingFailures.set(message.toPhone, failures - 1);
      }
      throw new MessagingError(`fake adapter: send to ${message.toPhone} failed`);
    }

    this.sent.push(message);
    this.sequence += 1;
    return { providerMessageId: `fake-${this.sequence}-${randomUUID()}` };
  }
}
