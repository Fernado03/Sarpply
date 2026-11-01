'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { failure, field } from './form';

export async function reconcileBatch(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const batchId = field(formData, 'batchId');
    if (!batchId) throw new Error('Missing Route Batch.');
    await pool.query('SELECT fn_reconcile_batch($1)', [batchId]);
  } catch (caught) {
    error = failure(caught);
  }

  if (error) redirect(`/?reconcileError=${encodeURIComponent(error)}`);
  revalidatePath('/');
  redirect('/?notice=reconciled');
}
