// Cutoff dispatcher — one poll loop, reading the interval from the database
// (ADR-0005). `npm run dispatch` keeps it running; `--once` fires due Cutoffs
// and exits, which is handy when the console should catch up immediately.
import { Pool } from 'pg';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Optional local override; the embedded development server is the default.
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/sarpply',
});

async function pollIntervalMinutes(): Promise<number> {
  const { rows } = await pool.query<{ poll_interval_minutes: number }>(
    'SELECT poll_interval_minutes FROM dispatch_policy',
  );
  return rows[0].poll_interval_minutes;
}

async function fireDueCutoffs(): Promise<number> {
  const { rows } = await pool.query<{ route_batch_id: string; fired_at: Date }>(
    'SELECT route_batch_id, fired_at FROM fn_fire_due_cutoffs()',
  );
  for (const row of rows) {
    console.log(`CUTOFF_FIRED ${row.route_batch_id} at ${row.fired_at.toISOString()}`);
  }
  return rows.length;
}

async function main(): Promise<void> {
  const interval = await pollIntervalMinutes();
  await fireDueCutoffs();

  if (process.argv.includes('--once')) {
    await pool.end();
    return;
  }

  console.log(`Cutoff dispatcher polling every ${interval} minutes.`);
  const timer = setInterval(() => {
    fireDueCutoffs().catch((error: unknown) => {
      console.error('Cutoff dispatch failed:', error instanceof Error ? error.message : error);
    });
  }, interval * 60_000);

  const stop = async (): Promise<void> => {
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
