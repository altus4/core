import type { Pool } from 'mysql2/promise';
import mysql from 'mysql2/promise';

type RefreshOptions = {
  database?: string;
  ignoreTables?: string[];
};

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'altus4_test',
    connectionLimit: 5,
    multipleStatements: true,
  });
  return pool;
}

export async function refreshDatabase(opts: RefreshOptions = {}): Promise<void> {
  const p = await getPool();
  const [rows] = await p.query(
    `SELECT TABLE_NAME AS name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?`,
    [opts.database || process.env.DB_DATABASE || 'altus4_test']
  );
  const ignore = new Set((opts.ignoreTables || []).map(t => t.toLowerCase()));
  const tables = (rows as any[])
    .map(r => String(r.name))
    .filter(name => !ignore.has(name.toLowerCase()));

  if (tables.length === 0) {
    return;
  }

  const statements = [
    'SET FOREIGN_KEY_CHECKS=0',
    ...tables.map(t => `TRUNCATE TABLE \`${t}\``),
    'SET FOREIGN_KEY_CHECKS=1',
  ].join(';');

  await p.query(statements);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
