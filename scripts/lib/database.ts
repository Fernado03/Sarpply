import { existsSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

export interface DatabaseServer {
  readonly url: string;
  readonly database: string;
  client(): Client;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export interface EmbeddedOptions {
  databaseDir: string;
  port: number;
  persistent: boolean;
  database: string;
  externalUrl?: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function withRawClient<T>(client: Client, run: (client: Client) => Promise<T>): Promise<T> {
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

class EmbeddedServer implements DatabaseServer {
  readonly url: string;

  constructor(
    private readonly cluster: EmbeddedPostgres,
    readonly database: string,
    port: number,
  ) {
    this.url = `postgres://postgres:postgres@127.0.0.1:${port}/${database}`;
  }

  client(): Client {
    return this.cluster.getPgClient(this.database);
  }

  async reset(): Promise<void> {
    await withRawClient(this.cluster.getPgClient(), async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(this.database)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quoteIdentifier(this.database)}`);
    });
  }

  async stop(): Promise<void> {
    await this.cluster.stop();
  }
}

class ExternalServer implements DatabaseServer {
  readonly database: string;

  constructor(readonly url: string) {
    const parsed = new URL(url);
    this.database = decodeURIComponent(parsed.pathname.slice(1)) || 'postgres';
  }

  client(): Client {
    return new Client({ connectionString: this.url });
  }

  async reset(): Promise<void> {
    await withClient(this, async (client) => {
      await client.query('DROP SCHEMA public CASCADE');
      await client.query('CREATE SCHEMA public');
    });
  }

  async stop(): Promise<void> {}
}

export async function startDatabaseServer(options: EmbeddedOptions): Promise<DatabaseServer> {
  if (options.externalUrl) {
    return new ExternalServer(options.externalUrl);
  }

  if (!options.persistent) {
    await rm(options.databaseDir, { recursive: true, force: true });
  }

  const cluster = new EmbeddedPostgres({
    databaseDir: options.databaseDir,
    port: options.port,
    user: 'postgres',
    password: 'postgres',
    persistent: options.persistent,
    onLog: () => {},
    onError: () => {},
  });

  if (!existsSync(path.join(options.databaseDir, 'PG_VERSION'))) {
    await cluster.initialise();
  }
  await cluster.start();

  await withRawClient(cluster.getPgClient(), async (admin) => {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      options.database,
    ]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(options.database)}`);
    }
  });

  return new EmbeddedServer(cluster, options.database, options.port);
}

export async function withClient<T>(
  server: DatabaseServer,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return withRawClient(server.client(), run);
}

export async function migrate(client: Client): Promise<void> {
  const directory = path.join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(path.join(directory, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

export async function seed(client: Client): Promise<void> {
  const sql = await readFile(path.join(process.cwd(), 'db', 'seed.sql'), 'utf8');
  await client.query(sql);
}
