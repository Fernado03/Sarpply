'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  commitTextDraft,
  createTextDraft,
  draftLineNumbers,
  saveDraftLines,
} from '@/lib/intake';
import { broadcastBatch, deliverPendingMessages } from '@/lib/broadcast';
import { pool } from '@/lib/db';
import { createMessagingPort } from '@/lib/messaging';
import { parseOrderText } from '@/lib/order-text';

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function failure(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}

function skuOrNull(value: string): string | null {
  const skuCode = value.trim().toUpperCase();
  return skuCode === '' ? null : skuCode;
}

function quantityOrNull(value: string): number | null {
  const text = value.trim();
  if (text === '') return null;
  const quantity = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('Quantities must be whole Bundles of at least one.');
  }
  return quantity;
}

export async function saveTextDraft(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const routeBatchId = field(formData, 'batchId');
    const stallId = field(formData, 'stallId');
    const body = field(formData, 'body').trim();
    if (!stallId) throw new Error('Choose the Stall that sent the message.');
    if (!body) throw new Error('Paste the Stall’s message first.');
    const lines = parseOrderText(body);
    if (lines.length === 0) throw new Error('The message contained nothing to parse.');
    await createTextDraft(routeBatchId, stallId, body, lines);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?intakeError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=saved');
}

export async function commitDraft(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const draftId = field(formData, 'draftId');
    if (!draftId) throw new Error('Missing draft.');
    const lines = (await draftLineNumbers(draftId)).map((lineNo) => ({
      lineNo,
      skuCode: skuOrNull(field(formData, `sku-${lineNo}`)),
      orderedBundles: quantityOrNull(field(formData, `bundles-${lineNo}`)),
    }));
    await saveDraftLines(draftId, lines);
    await commitTextDraft(draftId);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?intakeError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=committed');
}

async function runMessageAction(
  formData: FormData,
  deliver: (batchId: string) => Promise<{ sent: number; failed: number }>,
  notice: 'broadcast' | 'retried',
): Promise<void> {
  let error: string | null = null;
  let result = { sent: 0, failed: 0 };
  try {
    const batchId = field(formData, 'batchId');
    if (!batchId) throw new Error('Missing Route Batch.');
    result = await deliver(batchId);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?intakeError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect(`/?notice=${notice}&sent=${result.sent}&failed=${result.failed}`);
}

export async function sendBroadcast(formData: FormData): Promise<void> {
  return runMessageAction(
    formData,
    (batchId) => broadcastBatch(pool, batchId, createMessagingPort()),
    'broadcast',
  );
}

export async function retryMessages(formData: FormData): Promise<void> {
  return runMessageAction(
    formData,
    (batchId) => deliverPendingMessages(pool, batchId, createMessagingPort()),
    'retried',
  );
}
