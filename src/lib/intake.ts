import { pool } from './db';
import type { ParsedOrderLine } from './order-text';

export interface DraftLineView {
  lineNo: number;
  rawText: string;
  skuCode: string | null;
  orderedBundles: number | null;
}

export interface DraftView {
  id: string;
  stallCode: string;
  stallName: string;
  body: string;
  createdAt: string;
  lines: DraftLineView[];
}

export type DraftLineEdit = Pick<
  DraftLineView,
  'lineNo' | 'skuCode' | 'orderedBundles'
>;

interface DraftRow {
  id: string;
  stallCode: string;
  stallName: string;
  body: string;
  createdAt: string;
}

interface DraftLineRow extends DraftLineView {
  draftId: string;
}

export async function createTextDraft(
  routeBatchId: string,
  stallId: string,
  body: string,
  lines: ParsedOrderLine[],
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT fn_create_text_draft($1, $2, $3, $4::jsonb) AS id',
    [routeBatchId, stallId, body, JSON.stringify(lines)],
  );
  return rows[0].id;
}

export async function loadOpenDrafts(routeBatchId: string): Promise<DraftView[]> {
  const drafts = await pool.query<DraftRow>(
    `SELECT d.id,
            st.stall_code AS "stallCode",
            st.stall_name AS "stallName",
            d.body,
            TO_CHAR(d.created_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI') AS "createdAt"
     FROM text_order_drafts d
     JOIN stalls st ON st.id = d.stall_id
     WHERE d.route_batch_id = $1 AND d.committed_at IS NULL
     ORDER BY d.created_at, d.id`,
    [routeBatchId],
  );

  if (drafts.rows.length === 0) return [];

  const lines = await pool.query<DraftLineRow>(
    `SELECT l.draft_id AS "draftId",
            l.line_no AS "lineNo",
            l.raw_text AS "rawText",
            l.sku_code AS "skuCode",
            l.ordered_bundles AS "orderedBundles"
     FROM text_order_draft_lines l
     JOIN text_order_drafts d ON d.id = l.draft_id
     WHERE d.route_batch_id = $1 AND d.committed_at IS NULL
     ORDER BY l.draft_id, l.line_no`,
    [routeBatchId],
  );

  const linesByDraft = new Map<string, DraftLineView[]>();
  for (const { draftId, ...line } of lines.rows) {
    linesByDraft.set(draftId, [...(linesByDraft.get(draftId) ?? []), line]);
  }

  return drafts.rows.map((draft) => ({
    ...draft,
    lines: linesByDraft.get(draft.id) ?? [],
  }));
}

export async function draftLineNumbers(draftId: string): Promise<number[]> {
  const { rows } = await pool.query<{ lineNo: number }>(
    'SELECT line_no AS "lineNo" FROM text_order_draft_lines WHERE draft_id = $1 ORDER BY line_no',
    [draftId],
  );
  return rows.map((row) => row.lineNo);
}

export async function saveDraftLines(
  draftId: string,
  lines: DraftLineEdit[],
): Promise<number> {
  const { rows } = await pool.query<{ edited: number }>(
    'SELECT fn_update_text_draft_lines($1, $2::jsonb) AS edited',
    [draftId, JSON.stringify(lines)],
  );
  return rows[0].edited;
}

export async function commitTextDraft(draftId: string): Promise<number> {
  const { rows } = await pool.query<{ written: number }>(
    'SELECT fn_commit_text_draft($1) AS written',
    [draftId],
  );
  return rows[0].written;
}
