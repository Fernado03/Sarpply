import { afterAll, describe, expect, it } from 'vitest';
import { expectRejected, query } from './helpers';

interface DraftLineInput {
  rawText: string;
  skuCode: string | null;
  orderedBundles: number | null;
}

async function createOpenBatch(deliveryDate: string, cutoffAt: string): Promise<string> {
  const [route] = await query<{ id: string }>(
    "SELECT id FROM routes WHERE name = 'Premier 101 + Gala City'",
  );
  const [vehicle] = await query<{ id: string }>("SELECT id FROM vehicles WHERE label = 'Myvi'");
  const [batch] = await query<{ id: string }>(
    `INSERT INTO route_batches
       (route_id, vehicle_id, delivery_date, status, sortie_count, runner_cost_myr, cutoff_at, opened_at)
     VALUES ($1, $2, $3, 'OPEN_FOR_ORDERS', 1, 42.50, $4, NOW())
     RETURNING id`,
    [route.id, vehicle.id, deliveryDate, cutoffAt],
  );
  return batch.id;
}

async function stallId(stallCode: string): Promise<string> {
  const [stall] = await query<{ id: string }>('SELECT id FROM stalls WHERE stall_code = $1', [
    stallCode,
  ]);
  return stall.id;
}

async function createDraft(
  batchId: string,
  stall: string,
  body: string,
  lines: DraftLineInput[],
): Promise<string> {
  const [draft] = await query<{ id: string }>(
    'SELECT fn_create_text_draft($1, $2, $3, $4::jsonb) AS id',
    [batchId, stall, body, JSON.stringify(lines)],
  );
  return draft.id;
}

interface OrderRow {
  sku_code: string;
  order_type: string;
  source_channel: string;
  ordered_bundles: number;
  unit_price: string;
}

async function orders(batchId: string): Promise<OrderRow[]> {
  return query<OrderRow>(
    `SELECT sku_code, order_type, source_channel, ordered_bundles,
            unit_price_locked::text AS unit_price
     FROM stall_orders WHERE route_batch_id = $1 ORDER BY sku_code`,
    [batchId],
  );
}

afterAll(async () => {
  await query("DELETE FROM route_batches WHERE delivery_date >= DATE '2099-01-01'");
});

describe('text order intake', () => {
  it('commits parsed draft lines as TEXT Preorders at the Pool Price in force', async () => {
    const batchId = await createOpenBatch('2099-01-07', '2099-01-06T12:00:00+08');
    const draftId = await createDraft(batchId, await stallId('S01'), 'A1 x 3, C1 2', [
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'C1 2', skuCode: 'C1', orderedBundles: 2 },
    ]);

    expect(await orders(batchId)).toEqual([]);

    const [result] = await query<{ written: number }>(
      'SELECT fn_commit_text_draft($1) AS written',
      [draftId],
    );
    expect(result.written).toBe(2);

    expect(await orders(batchId)).toEqual([
      {
        sku_code: 'A1',
        order_type: 'PREORDER',
        source_channel: 'TEXT',
        ordered_bundles: 3,
        unit_price: '15.00',
      },
      {
        sku_code: 'C1',
        order_type: 'PREORDER',
        source_channel: 'TEXT',
        ordered_bundles: 2,
        unit_price: '13.50',
      },
    ]);
  });

  it('refuses an unresolved draft, then commits the corrected lines', async () => {
    const batchId = await createOpenBatch('2099-01-14', '2099-01-13T12:00:00+08');
    const draftId = await createDraft(batchId, await stallId('S02'), 'A1 x 3, the usual 2', [
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'the usual 2', skuCode: null, orderedBundles: null },
    ]);

    const rejection = await expectRejected('SELECT fn_commit_text_draft($1)', [draftId]);
    expect(rejection.message).toContain('every draft line');
    expect(await orders(batchId)).toEqual([]);

    const corrected = [
      { lineNo: 1, skuCode: 'A1', orderedBundles: 5 },
      { lineNo: 2, skuCode: 'C1', orderedBundles: 2 },
    ];
    const [edited] = await query<{ edited: number }>(
      'SELECT fn_update_text_draft_lines($1, $2::jsonb) AS edited',
      [draftId, JSON.stringify(corrected)],
    );
    expect(edited.edited).toBe(2);

    await query('SELECT fn_commit_text_draft($1)', [draftId]);
    expect((await orders(batchId)).map((order) => [order.sku_code, order.ordered_bundles])).toEqual([
      ['A1', 5],
      ['C1', 2],
    ]);
  });

  it('refuses a commit once the batch Cutoff has passed', async () => {
    const batchId = await createOpenBatch('2099-01-21', '2099-01-20T12:00:00+08');
    const draftId = await createDraft(batchId, await stallId('S03'), 'A1 x 1', [
      { rawText: 'A1 x 1', skuCode: 'A1', orderedBundles: 1 },
    ]);

    await query(
      "UPDATE route_batches SET cutoff_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
      [batchId],
    );

    const rejection = await expectRejected('SELECT fn_commit_text_draft($1)', [draftId]);
    expect(rejection.message).toContain('not open for Preorders');
    expect(await orders(batchId)).toEqual([]);

    const lateDraft = await expectRejected(
      'SELECT fn_create_text_draft($1, $2, $3, $4::jsonb)',
      [
        batchId,
        await stallId('S03'),
        'C1 2',
        JSON.stringify([{ rawText: 'C1 2', skuCode: 'C1', orderedBundles: 2 }]),
      ],
    );
    expect(lateDraft.message).toContain('Cutoff has passed');
  });

  it('keeps the committed price when the live Pool Price later changes', async () => {
    const firstBatch = await createOpenBatch('2099-01-28', '2099-01-27T12:00:00+08');
    const firstDraft = await createDraft(firstBatch, await stallId('S04'), 'D1 x 2', [
      { rawText: 'D1 x 2', skuCode: 'D1', orderedBundles: 2 },
    ]);
    await query('SELECT fn_commit_text_draft($1)', [firstDraft]);

    try {
      await query(
        "UPDATE pool_prices SET pool_bundle_price = 99.00 WHERE sku_code = 'D1' AND valid_to IS NULL",
      );

      const secondBatch = await createOpenBatch('2099-02-04', '2099-02-03T12:00:00+08');
      const secondDraft = await createDraft(secondBatch, await stallId('S04'), 'D1 x 2', [
        { rawText: 'D1 x 2', skuCode: 'D1', orderedBundles: 2 },
      ]);
      await query('SELECT fn_commit_text_draft($1)', [secondDraft]);

      expect((await orders(secondBatch))[0].unit_price).toBe('99.00');
      expect((await orders(firstBatch))[0].unit_price).toBe('21.00');
    } finally {
      await query(
        "UPDATE pool_prices SET pool_bundle_price = 21.00 WHERE sku_code = 'D1' AND valid_to IS NULL",
      );
    }
  });
});
