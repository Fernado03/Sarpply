export const DEV_DATABASE = {
  databaseDir: '.pg/dev',
  port: 55432,
  database: 'sarpply',
} as const;

export function connectionString(port: number, database: string): string {
  return `postgres://postgres:postgres@127.0.0.1:${port}/${database}`;
}
