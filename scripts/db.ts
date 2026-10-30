import { Client } from 'pg';
import { DEV_DATABASE } from './lib/config';
import { migrate, seed, startDatabaseServer, withClient } from './lib/database';
import { loadPhase1Fixtures } from './lib/fixtures';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No local overrides: the embedded PostgreSQL path is the default.
}

async function prepareDatabase(client: Client): Promise<void> {
  await migrate(client);
  await seed(client);
  await loadPhase1Fixtures(client);
}

async function reset(): Promise<void> {
  const server = await startDatabaseServer({
    databaseDir: DEV_DATABASE.databaseDir,
    port: DEV_DATABASE.port,
    persistent: true,
    database: DEV_DATABASE.database,
    externalUrl: process.env.DATABASE_URL,
  });
  try {
    await server.reset();
    const counts = await withClient(server, async (client) => {
      await prepareDatabase(client);
      return client.query<{ batches: string; stalls: string; skus: string; orders: string }>(
        `SELECT
           (SELECT COUNT(*) FROM route_batches) AS batches,
           (SELECT COUNT(*) FROM stalls) AS stalls,
           (SELECT COUNT(*) FROM skus) AS skus,
           (SELECT COUNT(*) FROM stall_orders) AS orders`,
      );
    });
    const row = counts.rows[0];
    console.log(
      `Database ready: ${row.batches} Route Batches, ${row.stalls} Stalls, ` +
        `${row.skus} SKUs, ${row.orders} Stall Orders.`,
    );
    console.log(`DATABASE_URL=${server.url}`);
  } finally {
    await server.stop();
  }
}

async function dev(): Promise<void> {
  const server = await startDatabaseServer({
    databaseDir: DEV_DATABASE.databaseDir,
    port: DEV_DATABASE.port,
    persistent: true,
    database: DEV_DATABASE.database,
    externalUrl: process.env.DATABASE_URL,
  });
  const schemaPresent = await withClient(server, async (client) => {
    const { rows } = await client.query<{ present: string | null }>(
      "SELECT to_regclass('public.stock_movements')::text AS present",
    );
    return rows[0].present !== null;
  });

  if (!schemaPresent) {
    await server.reset();
    await withClient(server, prepareDatabase);
  }

  console.log(`DATABASE_URL=${server.url}`);
  if (process.env.DATABASE_URL) {
    console.log('Using the external PostgreSQL from DATABASE_URL.');
    return;
  }

  console.log('PostgreSQL is running. Press Ctrl+C to stop.');
  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await new Promise(() => {});
}

const command = process.argv[2] ?? 'reset';
const commands: Record<string, () => Promise<void>> = { reset, dev };
const run = commands[command];

if (!run) {
  console.error(`Unknown command "${command}". Use: reset | dev`);
  process.exit(1);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
