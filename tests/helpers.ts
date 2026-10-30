import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

interface ConnectionFile {
  connectionString: string;
}

function testConnectionString(): string {
  const file = path.join(process.cwd(), '.pg', 'test-connection.json');
  const { connectionString } = JSON.parse(readFileSync(file, 'utf8')) as ConnectionFile;
  return connectionString;
}

export async function query<T extends object>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: testConnectionString() });
  await client.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function expectRejected(sql: string, params: unknown[] = []): Promise<Error> {
  const client = new Client({ connectionString: testConnectionString() });
  await client.connect();
  let rejection: Error | undefined;
  try {
    await client.query(sql, params);
  } catch (error) {
    rejection = error as Error;
  } finally {
    await client.end();
  }
  if (!rejection) throw new Error(`the database accepted: ${sql}`);
  return rejection;
}
