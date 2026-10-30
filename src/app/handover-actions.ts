'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deliverOutboundMessage } from '@/lib/broadcast';
import { pool } from '@/lib/db';
import { loadStallPreorderLines, recordStallHandover } from '@/lib/handover';
import { createMessagingPort } from '@/lib/messaging';
import { failure, field } from './form';

const PAYMENT_STATUSES: Record<string, true> = {
  UNPAID: true,
  PAID_CASH: true,
  PAID_DUITNOW: true,
};

function wholeBundles(value: string): number {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error('Delivered Bundles must be whole numbers of zero or more.');
  }
  return Number(text);
}

export async function confirmHandover(formData: FormData): Promise<void> {
  let error: string | null = null;
  let created = false;
  let sendError: string | null = null;
  try {
    const routeBatchId = field(formData, 'batchId');
    const stallId = field(formData, 'stallId');
    const paymentStatus = field(formData, 'paymentStatus').trim().toUpperCase();
    const paymentReference = field(formData, 'paymentReference').trim() || null;
    const paymentProofUrl = field(formData, 'paymentProofUrl').trim() || null;
    const attestedBy = field(formData, 'attestedBy').trim() || null;

    if (!routeBatchId) throw new Error('Missing Route Batch.');
    if (!stallId) throw new Error('Missing Stall.');
    if (!PAYMENT_STATUSES[paymentStatus]) {
      throw new Error('Choose UNPAID, Cash or DuitNow.');
    }
    if (paymentStatus === 'PAID_DUITNOW' && (!paymentReference || !paymentProofUrl)) {
      throw new Error('DuitNow needs both a payment reference and a proof link.');
    }

    const lines = (await loadStallPreorderLines(routeBatchId, stallId)).map((line) => ({
      stallOrderId: line.orderId,
      deliveredBundles: wholeBundles(field(formData, `delivered-${line.orderId}`)),
    }));
    if (lines.length === 0) throw new Error('This Stall has no Preorder to hand over.');

    const result = await recordStallHandover({
      routeBatchId,
      stallId,
      lines,
      paymentStatus,
      paymentReference,
      paymentProofUrl,
      attestedBy,
    });
    created = result.created;

    // The handover and its receipt are already committed. Send only this
    // handover's receipt; a failure leaves that row for the receipt button.
    if (result.outboundMessageId) {
      try {
        const outcome = await deliverOutboundMessage(
          pool,
          result.outboundMessageId,
          createMessagingPort(),
        );
        if (outcome === 'failed') {
          sendError = 'the provider refused it; retry from the Stall card.';
        }
      } catch (caught) {
        sendError = failure(caught);
      }
    }
  } catch (caught) {
    error = failure(caught);
  }

  if (error) redirect(`/?handoverError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  const params = new URLSearchParams({
    notice: 'handover',
    created: created ? '1' : '0',
  });
  if (sendError) params.set('handoverSendError', sendError);
  redirect(`/?${params.toString()}`);
}

export async function sendHandoverReceipt(formData: FormData): Promise<void> {
  let error: string | null = null;
  let outcome: 'sent' | 'failed' | 'missing' = 'missing';
  try {
    const messageId = field(formData, 'messageId');
    if (!messageId) throw new Error('Missing receipt message.');
    outcome = await deliverOutboundMessage(pool, messageId, createMessagingPort());
  } catch (caught) {
    error = failure(caught);
  }

  if (error) redirect(`/?receiptError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect(`/?notice=receipt&receipt=${outcome}`);
}
