import { Pool } from 'pg';

const globalForDatabase = globalThis as unknown as { sarpplyPool?: Pool };

export const pool =
  globalForDatabase.sarpplyPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/sarpply',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.sarpplyPool = pool;
}
