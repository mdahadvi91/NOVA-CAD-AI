import crypto from 'crypto';
import type pg from 'pg';
import { migration001 } from './001_initial_schema.js';
import { migration002 } from './002_create_indexes.js';
import type { Migration, AppliedMigration, MigrationResult } from './types.js';

export const ALL_MIGRATIONS: Migration[] = [
  migration001,
  migration002,
];

export async function ensureMigrationTable(pool: pg.Pool): Promise<void> {
  const check = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations'"
  );
  if (check.rows.length === 0) {
    await pool.query(`
      CREATE TABLE schema_migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL,
        checksum VARCHAR(64) NOT NULL
      )
    `);
  }
}

export async function getAppliedMigrations(pool: pg.Pool): Promise<AppliedMigration[]> {
  await ensureMigrationTable(pool);
  const res = await pool.query(
    'SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version ASC'
  );
  return res.rows;
}

export async function applyMigrations(pool: pg.Pool): Promise<MigrationResult[]> {
  await ensureMigrationTable(pool);
  const applied = await getAppliedMigrations(pool);
  const appliedVersions = new Set(applied.map((m) => m.version));

  const pending = ALL_MIGRATIONS.filter((m) => !appliedVersions.has(m.version)).sort(
    (a, b) => a.version - b.version
  );

  const results: MigrationResult[] = [];

  for (const migration of pending) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await migration.up(client);

      const checksum = crypto
        .createHash('sha256')
        .update(`${migration.version}_${migration.name}`)
        .digest('hex');

      await client.query(
        'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)',
        [migration.version, migration.name, checksum]
      );

      await client.query('COMMIT');
      results.push({
        version: migration.version,
        name: migration.name,
        action: 'applied',
      });
      console.log(`✅ [MIGRATION] Applied v${migration.version}: ${migration.name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ [MIGRATION FAILED] v${migration.version}: ${migration.name}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  return results;
}

export async function rollbackMigration(pool: pg.Pool): Promise<MigrationResult | null> {
  await ensureMigrationTable(pool);
  const applied = await getAppliedMigrations(pool);
  if (applied.length === 0) {
    return null;
  }

  const latestApplied = applied[applied.length - 1];
  const migrationToRollback = ALL_MIGRATIONS.find((m) => m.version === latestApplied.version);

  if (!migrationToRollback) {
    throw new Error(
      `Cannot rollback version ${latestApplied.version}: Migration definition not found.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await migrationToRollback.down(client);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [
      migrationToRollback.version,
    ]);
    await client.query('COMMIT');

    console.log(`⏪ [MIGRATION] Rolled back v${migrationToRollback.version}: ${migrationToRollback.name}`);
    return {
      version: migrationToRollback.version,
      name: migrationToRollback.name,
      action: 'reverted',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(
      `❌ [MIGRATION ROLLBACK FAILED] v${migrationToRollback.version}: ${migrationToRollback.name}`,
      err
    );
    throw err;
  } finally {
    client.release();
  }
}
