import { createServer } from 'node:net';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { migrate, seed, startDatabaseServer, withClient } from '../scripts/lib/database';
import { loadPhase1Fixtures } from '../scripts/lib/fixtures';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Optional local override; the embedded server is the default.
}

async function freePort(): Promise<number> {
  const server = createServer();
  const listening = Promise.withResolvers<void>();
  server.once('error', listening.reject);
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  const address = server.address();
  const closed = Promise.withResolvers<void>();
  server.close((error) => (error ? closed.reject(error) : closed.resolve()));
  await closed.promise;
  if (!address || typeof address === 'string') throw new Error('could not allocate a port');
  return address.port;
}

export default async function setup(): Promise<() => Promise<void>> {
  const connectionFile = path.join(process.cwd(), '.pg', 'test-connection.json');
  await rm(path.join(process.cwd(), '.pg', 'test'), { recursive: true, force: true });
  await mkdir(path.dirname(connectionFile), { recursive: true });

  const server = await startDatabaseServer({
    databaseDir: path.join(process.cwd(), '.pg', 'test'),
    port: await freePort(),
    persistent: false,
    database: 'sarpply_test',
    externalUrl: process.env.TEST_DATABASE_URL,
  });

  try {
    await server.reset();
    await withClient(server, async (client) => {
      await migrate(client);
      await seed(client);
      await loadPhase1Fixtures(client);
    });
    await writeFile(connectionFile, JSON.stringify({ connectionString: server.url }));
  } catch (error) {
    await server.stop();
    throw error;
  }

  return async () => {
    await server.stop();
    await rm(connectionFile, { force: true });
  };
}
