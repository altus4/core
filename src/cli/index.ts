import fs from 'fs';
import type { Pool } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import path from 'path';

/**
 * Runtime flags parsed from CLI arguments.
 * - `path`: directory containing migration files (defaults to `migrations`).
 * - `database`: optional DB name to override environment variable.
 * - `step`: used both as a boolean (one-step behaviour) or a numeric count.
 * - `pretend`: when true, SQL is printed instead of executed.
 * - `seed`: run SQL files from <path>/seeds after migrating.
 * - `force`: allow destructive operations in production.
 * - `file`: for running/rolling back a single migration file by base name.
 * - `batch`: numeric batch id for targeted rollback.
 * - `dropViews`: when doing a fresh, also drop views.
 */
type Flags = {
  path: string;
  database?: string;
  step?: boolean | number;
  pretend?: boolean;
  seed?: boolean;
  force?: boolean;
  file?: string;
  batch?: number;
  dropViews?: boolean;
};

type Command =
  | 'migrate'
  | 'migrate:run'
  | 'migrate:install'
  | 'migrate:status'
  | 'migrate:rollback'
  | 'migrate:reset'
  | 'migrate:refresh'
  | 'migrate:fresh'
  | 'migrate:up'
  | 'migrate:down';

// Table used to track applied migrations. Can be overridden via env.
const MIGRATIONS_TABLE = process.env.MIGRATIONS_TABLE || 'migrations';

/**
 * Lightweight console output helper that avoids extra logging machinery.
 * Using process.stdout.write keeps output predictable for CLI consumers.
 */
function println(msg = ''): void {
  process.stdout.write(`${String(msg)}\n`);
}

/**
 * Print an error message to stderr and exit the process with non-zero code.
 * The function never returns (return type `never`) so callers can rely on
 * process termination in error paths.
 */
function die(msg: string, code = 1): never {
  // Keep plain error output; throw to ensure non-zero exit in async
  // eslint-disable-next-line no-console
  console.error(`Error: ${msg}`);
  process.exit(code);
}

/**
 * Detect whether the CLI is running in a production environment.
 * Respects APP_ENV first, then NODE_ENV, and defaults to 'development'.
 */
function isProduction(): boolean {
  const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  return env === 'production';
}

/**
 * Prevent destructive operations from running in production unless `--force`
 * is passed. This is a safety guard for commands like `fresh` and `reset`.
 */
function guardProduction(action: string, flags: Flags): void {
  if (isProduction() && !flags.force) {
    die(`Refusing to ${action} in production without --force (APP_ENV=production).`);
  }
}

/**
 * Resolve a user-supplied migrations directory to an absolute path.
 * If not provided, defaults to <cwd>/migrations. Accepts absolute paths
 * unchanged.
 */
function resolveMigrationsPath(p?: string): string {
  const raw = p && p.trim().length > 0 ? p : 'migrations';
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.resolve(process.cwd(), raw);
}

/**
 * Natural sort comparator so migration filenames like `2` and `10` sort
 * in human-friendly numeric order.
 */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * List all `.up.sql` migration files in the directory in natural order.
 * Returns absolute file paths. If the directory doesn't exist, returns an
 * empty array (caller will handle 'nothing to do').
 */
function listUpFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.up.sql'))
    .sort(naturalSort)
    .map(f => path.join(migrationsDir, f));
}

/**
 * Build the path for a `.down.sql` file given the migration base name.
 */
function downFileFor(migrationsDir: string, name: string): string {
  return path.join(migrationsDir, `${name}.down.sql`);
}

/**
 * Return the migration base name (filename without `.up.sql`).
 * Example: `/.../001_create_users_table.up.sql` -> `001_create_users_table`.
 */
function baseNameNoExtUp(filePath: string): string {
  return path.basename(filePath).replace(/\.up\.sql$/i, '');
}

/**
 * Read SQL file content as UTF-8 string. Synchronous read is fine for a
 * CLI tool where we perform IO serially.
 */
function readSql(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * When `--pretend` is passed, show the SQL that would be executed instead
 * of running it. For file sources we show the first 120 lines to avoid
 * spamming very large SQL files.
 */
function printPretendSql(source: 'file' | 'inline', value: string): void {
  if (source === 'file') {
    println(`[pretend] < ${value}`);
    const content = fs.readFileSync(value, 'utf8');
    const lines = content.split(/\r?\n/);
    const head = lines.slice(0, 120);
    head.forEach(l => println(`    ${l}`));
    if (lines.length > 120) {
      println('    ... (truncated)');
    }
  } else {
    println(`[pretend] ${value}`);
  }
}

/**
 * Verify that basic DB connection settings are present either via env or
 * via flags. This does not test connectivity - callers should use
 * `canConnect` when needed.
 */
function ensureDbConfig(flags: Flags): void {
  const DB_HOST = process.env.DB_HOST || 'localhost';
  const DB_USER = process.env.DB_USERNAME || 'root';
  const DB_NAME = flags.database || process.env.DB_DATABASE || 'altus4';
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    die('Missing DB config. Set DB_HOST, DB_USERNAME, DB_DATABASE (see .env).');
  }
}

/**
 * Create a mysql2 connection pool using environment variables with small
 * sensible defaults. Supports connecting via a unix socket if DB_SOCKET is
 * set (common in Docker/dev setups).
 */
function poolFromEnv(flags: Flags): Pool {
  const useSocket = !!process.env.DB_SOCKET;
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || undefined;
  const database = flags.database || process.env.DB_DATABASE || 'altus4';

  return createPool({
    host: useSocket ? undefined : host === 'localhost' ? '127.0.0.1' : host,
    port: useSocket ? undefined : port,
    user,
    password,
    database,
    socketPath: useSocket ? process.env.DB_SOCKET : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    multipleStatements: true,
    charset: 'utf8mb4_general_ci',
  });
}

/**
 * Quick connectivity check that runs a tiny SELECT. Returns true when the
 * pool can successfully execute a query. Used to decide whether to show
 * full status (db-backed) or only the file list when DB is down.
 */
async function canConnect(pool: Pool): Promise<boolean> {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return Boolean(rows);
  } catch {
    return false;
  }
}

/**
 * Minimal SQL escaping for single-quoted string literals used here when
 * constructing simple queries for the migrations table. This is not a
 * full SQL sanitizer; avoid building arbitrary queries with it.
 */
function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Ensure the migrations table exists. The table is lightweight and tracks
 * migration name, batch, and timestamp. This function is idempotent.
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  const sql = `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration VARCHAR(255) NOT NULL,
    batch INT NOT NULL,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

/**
 * Read the current maximum batch id from the migrations table. Returns 0
 * if there are no applied migrations.
 */
async function currentBatch(pool: Pool): Promise<number> {
  const [rows] = await pool.query(
    `SELECT COALESCE(MAX(batch),0) AS b FROM \`${MIGRATIONS_TABLE}\``
  );
  const r = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : { b: 0 };
  return Number(r.b || 0);
}

/**
 * Return an ordered list of applied migration names (by insertion id). The
 * values are the base filenames (without extension) that were recorded.
 */
async function listApplied(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query(`SELECT migration FROM \`${MIGRATIONS_TABLE}\` ORDER BY id`);
  if (!Array.isArray(rows)) {
    return [];
  }
  return (rows as any[]).map(r => String(r.migration));
}

/**
 * Record a migration as applied by inserting a row into the migrations
 * table. `name` should be the base filename used by the up/down files.
 */
async function recordMigration(pool: Pool, name: string, batch: number): Promise<void> {
  await pool.query(
    `INSERT INTO \`${MIGRATIONS_TABLE}\` (migration, batch) VALUES ('${sqlEscape(name)}', ${batch})`
  );
}

/**
 * Remove a single migration record (used when rolling back). LIMIT 1 is
 * used to avoid accidentally removing multiple rows if duplicates exist.
 */
async function deleteMigrationRecord(pool: Pool, name: string): Promise<void> {
  await pool.query(
    `DELETE FROM \`${MIGRATIONS_TABLE}\` WHERE migration='${sqlEscape(name)}' LIMIT 1`
  );
}

/**
 * Execute the SQL contained in a file via the given connection pool.
 * When `pretend` is true the SQL is printed instead of run.
 */
async function runSqlFile(pool: Pool, filePath: string, pretend?: boolean): Promise<void> {
  if (pretend) {
    printPretendSql('file', filePath);
    return;
  }
  const content = readSql(filePath);
  await pool.query(content);
}

/**
 * CLI command: ensure the migrations table exists. This is safe to run
 * multiple times.
 */
async function cmdInstall(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  println(`Migrations table ensured in database '${process.env.DB_DATABASE || ''}'.`);
}

/**
 * CLI command: show migration status. If the DB is reachable we show which
 * files have been applied and their batch numbers. When the DB is
 * unreachable we only list migration files on disk.
 */
async function cmdStatus(pool: Pool, flags: Flags): Promise<void> {
  const dir = resolveMigrationsPath(flags.path);
  println(`Migration status for ${process.env.DB_DATABASE || ''} (path: ${dir})`);
  println('Migration                                         Ran?     Batch');
  println('---------                                         -----    -----');
  if (await canConnect(pool)) {
    await ensureMigrationsTable(pool);
    const applied = new Set(await listApplied(pool));
    for (const f of listUpFiles(dir)) {
      const name = baseNameNoExtUp(f);
      if (applied.has(name)) {
        // Get batch
        const [rows] = await pool.query(
          `SELECT COUNT(*) AS c, COALESCE(MAX(batch),0) AS b FROM \`${MIGRATIONS_TABLE}\` WHERE migration='${sqlEscape(
            name
          )}'`
        );
        const r = Array.isArray(rows) && rows.length ? (rows[0] as any) : { c: 0, b: 0 };
        println(`${name.padEnd(50)}  ${'yes'.padEnd(7)}  ${String(r.b)}`);
      } else {
        println(`${name.padEnd(50)}  ${'no'.padEnd(7)}  -`);
      }
    }
  } else {
    for (const f of listUpFiles(dir)) {
      const name = baseNameNoExtUp(f);
      println(`${name.padEnd(50)}  ${'unknown'.padEnd(7)}  ?`);
    }
    println('(Database unreachable: showing file list only)');
  }
}

/**
 * CLI command: apply outstanding migrations.
 * Behavior notes:
 * - If `--step` is true we increment the batch for each file (legacy
 *   step-based behaviour). If `--step` is omitted we group all applied
 *   migrations into the same new batch.
 * - When `--pretend` is provided we will print SQL rather than execute it.
 * - After successful migration, if `--seed` is set we'll run seed files.
 */
async function cmdMigrate(pool: Pool, flags: Flags): Promise<void> {
  ensureDbConfig(flags);
  guardProduction('run migrations', flags);
  await ensureMigrationsTable(pool);

  const dir = resolveMigrationsPath(flags.path);
  const applied = new Set(await listApplied(pool));
  const nextBatchBase = (await currentBatch(pool)) + 1;

  let any = false;
  for (const f of listUpFiles(dir)) {
    const name = baseNameNoExtUp(f);
    if (applied.has(name)) {
      continue;
    }

    any = true;
    const batch = flags.step === true ? (await currentBatch(pool)) + 1 : nextBatchBase;
    println(`Migrating: ${name} (batch ${batch})`);
    await runSqlFile(pool, f, flags.pretend);
    if (!flags.pretend) {
      await recordMigration(pool, name, batch);
    }
  }

  if (!any) {
    println('Nothing to migrate.');
  } else {
    println('Migrations completed.');
  }

  if (flags.seed) {
    await runSeedsIfAny(pool, dir, flags.pretend);
  }
}

/**
 * Pick which migrations to rollback based on flags.
 * - `--batch n` will target all migrations from that batch (in reverse id order)
 * - `--step n` will target the last `n` migrations (by id desc)
 * - default: rollback the most recent batch
 */
async function pickRollbackTargets(pool: Pool, flags: Flags): Promise<string[]> {
  if (typeof flags.batch === 'number') {
    const [rows] = await pool.query(
      `SELECT migration FROM \`${MIGRATIONS_TABLE}\` WHERE batch=${flags.batch} ORDER BY id DESC`
    );
    return Array.isArray(rows) ? (rows as any[]).map(r => String(r.migration)) : [];
  }
  if (typeof flags.step === 'number') {
    const [rows] = await pool.query(
      `SELECT migration FROM \`${MIGRATIONS_TABLE}\` ORDER BY id DESC LIMIT ${flags.step}`
    );
    return Array.isArray(rows) ? (rows as any[]).map(r => String(r.migration)) : [];
  }
  const [rows] = await pool.query(
    `SELECT migration FROM \`${MIGRATIONS_TABLE}\` WHERE batch=(SELECT COALESCE(MAX(batch),0) FROM \`${MIGRATIONS_TABLE}\`) ORDER BY id DESC`
  );
  return Array.isArray(rows) ? (rows as any[]).map(r => String(r.migration)) : [];
}

/**
 * CLI command: rollback migrations selected by `pickRollbackTargets`.
 * Ensures the down file exists for each migration and executes it. When
 * `--pretend` is set the SQL is printed instead of executed.
 */
async function cmdRollback(pool: Pool, flags: Flags): Promise<void> {
  ensureDbConfig(flags);
  guardProduction('rollback migrations', flags);
  await ensureMigrationsTable(pool);

  const dir = resolveMigrationsPath(flags.path);
  const targets = await pickRollbackTargets(pool, flags);
  if (!targets.length) {
    println('Nothing to rollback.');
    return;
  }
  for (const name of targets) {
    const file = downFileFor(dir, name);
    if (!fs.existsSync(file)) {
      die(`Down file not found for ${name} at ${file}`);
    }
    println(`Rolling back: ${name}`);
    await runSqlFile(pool, file, flags.pretend);
    if (!flags.pretend) {
      await deleteMigrationRecord(pool, name);
    }
  }
  println('Rollback completed.');
}

/**
 * CLI command: rollback all applied migrations in reverse order (id
 * descending). This walks every recorded migration and executes its down
 * file. Useful for clearing all schema changes back to an empty DB.
 */
async function cmdReset(pool: Pool, flags: Flags): Promise<void> {
  ensureDbConfig(flags);
  guardProduction('reset migrations', flags);
  await ensureMigrationsTable(pool);
  const dir = resolveMigrationsPath(flags.path);
  const [rows] = await pool.query(`SELECT migration FROM \`${MIGRATIONS_TABLE}\` ORDER BY id DESC`);
  const all = Array.isArray(rows) ? (rows as any[]).map(r => String(r.migration)) : [];
  if (!all.length) {
    println('Nothing to reset.');
    return;
  }
  for (const name of all) {
    const file = downFileFor(dir, name);
    if (!fs.existsSync(file)) {
      die(`Down file not found for ${name} at ${file}`);
    }
    println(`Reverting: ${name}`);
    await runSqlFile(pool, file, flags.pretend);
    if (!flags.pretend) {
      await deleteMigrationRecord(pool, name);
    }
  }
  println('Reset completed.');
}

/**
 * Drop all tables in the current database except the migrations table.
 * Optionally drop views too. `pretend` will print the DROP statements
 * instead of executing them. Foreign key checks are temporarily disabled
 * while dropping to avoid ordering issues.
 */
async function dropAllTables(pool: Pool, dropViews: boolean, pretend?: boolean): Promise<void> {
  const [tablesRows] = await pool.query("SHOW FULL TABLES WHERE Table_type='BASE TABLE'");
  const tableNames = Array.isArray(tablesRows)
    ? (tablesRows as any[]).map(r => Object.values(r)[0] as string)
    : [];
  if (!pretend) {
    await pool.query('SET FOREIGN_KEY_CHECKS=0');
  }
  for (const t of tableNames) {
    if (t === MIGRATIONS_TABLE) {
      continue;
    }
    const sql = `DROP TABLE IF EXISTS \`${t}\``;
    if (pretend) {
      printPretendSql('inline', sql);
    } else {
      await pool.query(sql);
    }
  }
  if (dropViews) {
    const [viewRows] = await pool.query("SHOW FULL TABLES WHERE Table_type='VIEW'");
    const viewNames = Array.isArray(viewRows)
      ? (viewRows as any[]).map(r => Object.values(r)[0] as string)
      : [];
    for (const v of viewNames) {
      const sql = `DROP VIEW IF EXISTS \`${v}\``;
      if (pretend) {
        printPretendSql('inline', sql);
      } else {
        await pool.query(sql);
      }
    }
  }
  if (!pretend) {
    await pool.query('SET FOREIGN_KEY_CHECKS=1');
  }
}

/**
 * Run SQL seed files from the `seeds` subdirectory of the migrations
 * directory. Files are executed in natural sorted order. If no seeds
 * directory exists we skip silently with a message.
 */
async function runSeedsIfAny(pool: Pool, dir: string, pretend?: boolean): Promise<void> {
  const seedsDir = path.join(dir, 'seeds');
  if (!fs.existsSync(seedsDir)) {
    println(`Seed directory not found (${seedsDir}). Skipping seeds.`);
    return;
  }
  println(`Running seeds in ${seedsDir}`);
  const files = fs
    .readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(naturalSort)
    .map(f => path.join(seedsDir, f));
  for (const f of files) {
    println(`Seeding: ${path.basename(f)}`);
    await runSqlFile(pool, f, pretend);
  }
}

/**
 * CLI command: reset then migrate. Useful when you want a clean run of all
 * migrations from scratch.
 */
async function cmdRefresh(pool: Pool, flags: Flags): Promise<void> {
  await cmdReset(pool, flags);
  await cmdMigrate(pool, flags);
}

/**
 * CLI command: drop all tables (and optionally views) and re-run
 * migrations. This is destructive and guarded in production.
 */
async function cmdFresh(pool: Pool, flags: Flags): Promise<void> {
  ensureDbConfig(flags);
  guardProduction('drop all tables', flags);
  await ensureMigrationsTable(pool);
  await dropAllTables(pool, !!flags.dropViews, flags.pretend);
  if (!flags.pretend) {
    await pool.query(`TRUNCATE TABLE \`${MIGRATIONS_TABLE}\``);
  }
  await cmdMigrate(pool, flags);
}

/**
 * CLI command: run a single migration `--file <name>.up.sql` if it hasn't
 * already been applied. Records the migration in the migrations table.
 */
async function cmdUpOne(pool: Pool, flags: Flags): Promise<void> {
  ensureDbConfig(flags);
  const dir = resolveMigrationsPath(flags.path);
  const name = flags.file;
  if (!name) {
    die('--file <name> is required (e.g., 001_create_users_table)');
  }
  const file = path.join(dir, `${name}.up.sql`);
  if (!fs.existsSync(file)) {
    die(`File not found: ${file}`);
  }
  await ensureMigrationsTable(pool);
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM \`${MIGRATIONS_TABLE}\` WHERE migration='${sqlEscape(name)}'`
  );
  const r = Array.isArray(rows) && rows.length ? (rows[0] as any) : { c: 0 };
  if (Number(r.c || 0) > 0) {
    println(`Already migrated: ${name}`);
    return;
  }
  const b = (await currentBatch(pool)) + 1;
  println(`Migrating: ${name} (batch ${b})`);
  await runSqlFile(pool, file, flags.pretend);
  if (!flags.pretend) {
    await recordMigration(pool, name, b);
  }
}

/**
 * CLI command: rollback a single named migration `--file <name>.down.sql` if
 * provided; otherwise perform the normal rollback flow (default 1 step).
 */
async function cmdDownOneOrRollback(pool: Pool, flags: Flags): Promise<void> {
  const dir = resolveMigrationsPath(flags.path);
  const name = flags.file;
  await ensureMigrationsTable(pool);
  if (!name) {
    // default to 1 step
    if (typeof flags.step !== 'number') {
      flags.step = 1;
    }
    await cmdRollback(pool, flags);
    return;
  }
  const file = path.join(dir, `${name}.down.sql`);
  if (!fs.existsSync(file)) {
    die(`File not found: ${file}`);
  }
  println(`Rolling back: ${name}`);
  await runSqlFile(pool, file, flags.pretend);
  if (!flags.pretend) {
    await deleteMigrationRecord(pool, name);
  }
}

/**
 * Print help text for the CLI and exit. This is intentionally minimal and
 * designed to be shown when no arguments are provided or `-h`/`--help` is
 * requested.
 */
function printHelp(): void {
  const lines = [
    'Usage: altus <command> [options]',
    '',
    'Commands',
    '  migrate            Run outstanding migrations',
    '  migrate:install    Create the migrations table if missing',
    '  migrate:status     Show applied and pending migrations',
    '  migrate:rollback   Rollback the last batch (default), or by steps/batch',
    '  migrate:reset      Rollback all migrations',
    '  migrate:refresh    Reset and re-run all migrations',
    '  migrate:fresh      Drop all tables and re-run migrations',
    '  migrate:up         Run a specific migration file',
    '  migrate:down       Rollback last migration or a specific file',
    '',
    'Options',
    '  --path <dir>       Directory containing migrations (default: migrations)',
    '  --database <name>  Database name (overrides DB_DATABASE)',
    '  --step [n]         For migrate: assign new batch per file; for rollback: number of steps',
    '  --pretend          Show SQL without executing',
    '  --seed             Run SQL seeds in <path>/seeds',
    '  --force            Allow running in production (APP_ENV=production)',
    '  --file <name>      For up/down: base name of migration file',
    '  --batch <n>        For rollback: rollback only the given batch',
    '  --drop-views       For fresh: also drop database views',
  ];
  println(lines.join('\n'));
}

function parseArgs(argv: string[]): { cmd: Command | null; flags: Flags } {
  const args = [...argv];
  const cmd = (args.shift() as Command | undefined) || null;
  const flags: Flags = { path: 'migrations' };

  const next = () => {
    if (!args.length) {
      die('Missing value for flag');
    }
    return args.shift() as string;
  };

  while (args.length) {
    const a = args.shift() as string;
    switch (a) {
      case '--path':
        flags.path = next();
        break;
      case '--database':
        flags.database = next();
        break;
      case '--step': {
        // Optional value: if next starts with '-', treat as boolean true
        const peek = args[0];
        if (peek && !peek.startsWith('-')) {
          const v = Number(next());
          if (!Number.isFinite(v) || v <= 0) {
            die('--step requires a positive number');
          }
          flags.step = v;
        } else {
          flags.step = true;
        }
        break;
      }
      case '--pretend':
        flags.pretend = true;
        break;
      case '--seed':
        flags.seed = true;
        break;
      case '--force':
        flags.force = true;
        break;
      case '--file':
        flags.file = next();
        break;
      case '--batch': {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) {
          die('--batch requires a positive number');
        }
        flags.batch = v;
        break;
      }
      case '--drop-views':
        flags.dropViews = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        die(`Unknown option: ${a}`);
    }
  }

  return { cmd, flags };
}

async function main(): Promise<void> {
  // Ensure env variables from .env are loaded when run directly (ts-node/nodemon dev)
  // In production, bin shim already loads dotenv before running dist file.
  if (!process.env.DB_HOST && fs.existsSync(path.resolve(process.cwd(), '.env'))) {
    // lazy import to avoid a hard dependency if not needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
  }

  const [, , ...argv] = process.argv;
  if (!argv.length) {
    printHelp();
    process.exit(1);
  }
  const { cmd, flags } = parseArgs(argv);
  if (!cmd) {
    printHelp();
    process.exit(1);
  }

  ensureDbConfig(flags);
  const pool = poolFromEnv(flags);
  try {
    switch (cmd) {
      case 'migrate':
      case 'migrate:run':
        await cmdInstall(pool);
        await cmdMigrate(pool, flags);
        break;
      case 'migrate:install':
        await cmdInstall(pool);
        break;
      case 'migrate:status':
        await cmdStatus(pool, flags);
        break;
      case 'migrate:rollback':
        await cmdRollback(pool, flags);
        break;
      case 'migrate:reset':
        await cmdReset(pool, flags);
        break;
      case 'migrate:refresh':
        await cmdRefresh(pool, flags);
        break;
      case 'migrate:fresh':
        await cmdFresh(pool, flags);
        break;
      case 'migrate:up':
        await cmdUpOne(pool, flags);
        break;
      case 'migrate:down':
        await cmdDownOneOrRollback(pool, flags);
        break;
      default:
        printHelp();
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// Export selected helpers for testing and programmatic usage.
export {
  cmdDownOneOrRollback,
  cmdFresh,
  cmdInstall,
  cmdMigrate,
  cmdRefresh,
  cmdReset,
  cmdRollback,
  cmdStatus,
  cmdUpOne,
  listUpFiles,
  parseArgs,
  poolFromEnv,
  resolveMigrationsPath,
  runSqlFile,
};

// Only run the CLI main function when this module is executed directly
// (i.e., `node dist/src/cli/index.js`) so importing the module in tests
// doesn't start the CLI automatically.
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
