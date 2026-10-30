'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  confirmBatchVehicle,
  loadPoLines,
  receiveWholesalerPo,
  submitWholesalerPo,
  type ReceiptLine,
} from '@/lib/purchase';
import { failure, field } from './form';

function wholeCartons(value: string): number {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error('Received cartons must be whole numbers of zero or more.');
  }
  return Number(text);
}

export async function confirmVehicle(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const batchId = field(formData, 'batchId');
    const vehicleId = field(formData, 'vehicleId');
    if (!batchId) throw new Error('Missing Route Batch.');
    if (!vehicleId) throw new Error('Choose the Vehicle.');
    await confirmBatchVehicle(batchId, vehicleId);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?purchaseError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=vehicle');
}

export async function submitPurchaseOrder(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const batchId = field(formData, 'batchId');
    const wholesalerId = field(formData, 'wholesalerId');
    if (!batchId) throw new Error('Missing Route Batch.');
    if (!wholesalerId) throw new Error('Choose the Wholesaler.');
    await submitWholesalerPo(batchId, wholesalerId);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?purchaseError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=po');
}

export async function receivePurchaseOrder(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const poId = field(formData, 'poId');
    if (!poId) throw new Error('Missing Wholesaler PO.');
    const lines: ReceiptLine[] = (await loadPoLines(poId)).map((line) => ({
      skuCode: line.skuCode,
      cartonsReceived: wholeCartons(field(formData, `received-${line.skuCode}`)),
    }));
    await receiveWholesalerPo(poId, lines);
  } catch (caught) {
    error = failure(caught);
  }
  if (error) redirect(`/?purchaseError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=received');
}
