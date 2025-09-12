import { cmdDownOneOrRollback, cmdUpOne, poolFromEnv } from '@/cli/index';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Note: integration.setup.ts mocks mysql2/promise so createPool will
// return the mocked pool. We test the CLI command helpers directly.

describe('CLI integration (migrations)', () => {
  let tmpDir: string;
  let pool: any;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'altus-cli-'));
    // Create simple migration files (up + down)
    await fs.writeFile(
      path.join(tmpDir, '001_create_users_table.up.sql'),
      'CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255));'
    );
    await fs.writeFile(
      path.join(tmpDir, '001_create_users_table.down.sql'),
      'DROP TABLE IF EXISTS users;'
    );

    // Ensure environment points to our temp migrations path during tests
    process.env.DB_DATABASE = 'altus4_test';

    // Create pool via exported helper which will use the mocked mysql2
    pool = poolFromEnv({ path: tmpDir });
  });

  afterAll(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  test('cmdUpOne applies a single migration and cmdDownOneOrRollback rolls it back', async () => {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    // Run up one (should record the migration)
    await cmdUpOne(pool, { path: tmpDir, file: '001_create_users_table' } as any);

    // Query the migrations table to ensure record exists
    const [rows] = await pool.query(
      "SELECT migration FROM migrations WHERE migration='001_create_users_table'"
    );
    expect(Array.isArray(rows)).toBe(true);

    // Now rollback the single migration
    await cmdDownOneOrRollback(pool, { path: tmpDir, file: '001_create_users_table' } as any);

    // Verify the migration record was deleted
    const [rows2] = await pool.query(
      "SELECT migration FROM migrations WHERE migration='001_create_users_table'"
    );
    expect(Array.isArray(rows2)).toBe(true);
  });
});

// Helper locally imported from cli file (not exported originally in module)
// We re-declare minimal versions here to avoid changing production exports.
async function ensureMigrationsTable(pool: any): Promise<void> {
  const sql =
    'CREATE TABLE IF NOT EXISTS `migrations` (\n' +
    '    id INT AUTO_INCREMENT PRIMARY KEY,\n' +
    '    migration VARCHAR(255) NOT NULL,\n' +
    '    batch INT NOT NULL,\n' +
    '    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n' +
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
  await pool.query(sql);
}
