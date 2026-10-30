import type { QueryResultRow } from 'pg';
import { Pool } from 'pg';

const globalForDatabase = globalThis as unknown as { sarpplyPool?: Pool };

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export const pool =
  globalForDatabase.sarpplyPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/sarpply',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.sarpplyPool = pool;
}
