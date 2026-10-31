'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deliverOutboundMessage } from '@/lib/broadcast';
import { pool } from '@/lib/db';
import { createMessagingPort } from '@/lib/messaging';
import { createSpotSale } from '@/lib/spot-sales';
import { failure, field } from './form';

const PAYMENT_STATUSES: Record<string, true> = {
  UNPAID: true,
  PAID_CASH: true,
  PAID_DUITNOW: true,
};

function wholeBundles(value: string): number {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error('Delivered Bundles must be whole numbers of at least one.');
  }
  const bundles = Number(text);
  if (bundles < 1) throw new Error('A Spot Sale needs at least one delivered Bundle.');
  return bundles;
}

export async function recordSpotSale(formData: FormData): Promise<void> {
  let error: string | null = null;
  let created = false;
  let sendError: string | null = null;
  try {
    const routeBatchId = field(formData, 'batchId');
    const eventKey = field(formData, 'eventKey').trim();
    const buyer = field(formData, 'buyer').trim();
    const skuCode = field(formData, 'skuCode').trim().toUpperCase();
    const paymentStatus = field(formData, 'paymentStatus').trim().toUpperCase();
    const paymentReference = field(formData, 'paymentReference').trim() || null;
    const paymentProofUrl = field(formData, 'paymentProofUrl').trim() || null;
    const attestedBy = field(formData, 'attestedBy').trim() || null;

    if (!routeBatchId) throw new Error('Missing Route Batch.');
    if (!eventKey) throw new Error('Missing the Spot Sale event key.');
    if (!skuCode) throw new Error('Choose the SKU sold.');
    if (!PAYMENT_STATUSES[paymentStatus]) {
      throw new Error('Choose UNPAID, Cash or DuitNow.');
    }
    if (paymentStatus === 'PAID_DUITNOW' && (!paymentReference || !paymentProofUrl)) {
      throw new Error('DuitNow needs both a payment reference and a proof link.');
    }

    const stallId = buyer === 'NEW' ? null : buyer;
    const provisionalLabel =
      buyer === 'NEW' ? field(formData, 'provisionalLabel').trim() || null : null;
    if (buyer === 'NEW' && !provisionalLabel) {
      throw new Error('Name the walk-up buyer before recording the sale.');
    }

    const result = await createSpotSale({
      routeBatchId,
      eventKey,
      skuCode,
      deliveredBundles: wholeBundles(field(formData, 'deliveredBundles')),
      paymentStatus,
      paymentReference,
      paymentProofUrl,
      attestedBy,
      stallId,
      provisionalLabel,
    });
    created = result.created;

    if (result.outboundMessageId) {
      try {
        const outcome = await deliverOutboundMessage(
          pool,
          result.outboundMessageId,
          createMessagingPort(),
        );
        if (outcome === 'failed') {
          sendError = 'the provider refused it; retry from the sale card.';
        }
      } catch (caught) {
        sendError = failure(caught);
      }
    }
  } catch (caught) {
    error = failure(caught);
  }

  if (error) redirect(`/?spotError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  const params = new URLSearchParams({
    notice: 'spot',
    created: created ? '1' : '0',
  });
  if (sendError) params.set('spotSendError', sendError);
  redirect(`/?${params.toString()}`);
}
