import { newDb, DataType } from 'pg-mem';
import {
  ensureMigrationTable,
  getAppliedMigrations,
  applyMigrations,
  rollbackMigration,
  ALL_MIGRATIONS,
} from '../server/migrations/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

export async function runMigrationTests(): Promise<boolean> {
  console.log('\n======================================================');
  console.log('   POSTGRESQL MIGRATION ENGINE VERIFICATION SUITE');
  console.log('======================================================\n');

  // Create clean isolated in-memory PostgreSQL instance
  const memDb = newDb();
  memDb.public.registerFunction({
    name: 'version',
    args: [],
    returns: DataType.text,
    implementation: () => 'PostgreSQL 15.0 (pg-mem test engine)',
  });
  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  try {
    // 1. Ensure migration tracking table
    await ensureMigrationTable(pool);
    const initialApplied = await getAppliedMigrations(pool);
    assert(initialApplied.length === 0, 'Initial database has 0 applied migrations');

    // 2. Apply all pending migrations (v1 and v2)
    const appliedResults = await applyMigrations(pool);
    assert(appliedResults.length === 2, 'Applied exactly 2 migrations (v1 and v2)');
    assert(appliedResults[0].version === 1, 'First applied migration is v1 (001_initial_schema)');
    assert(appliedResults[1].version === 2, 'Second applied migration is v2 (002_create_indexes)');

    // Verify schema_migrations state
    const afterApply = await getAppliedMigrations(pool);
    assert(afterApply.length === 2, 'schema_migrations table has 2 recorded migrations');
    assert(afterApply[0].name === '001_initial_schema', 'v1 name recorded correctly');
    assert(afterApply[1].name === '002_create_indexes', 'v2 name recorded correctly');
    assert(afterApply[0].checksum.length === 64, 'v1 has valid sha256 checksum');

    // Verify core tables exist and are queryable
    const userTableCheck = await pool.query('SELECT COUNT(*) FROM users');
    assert(userTableCheck.rows.length === 1, "Table 'users' exists and is queryable");

    const projectsTableCheck = await pool.query('SELECT COUNT(*) FROM projects');
    assert(projectsTableCheck.rows.length === 1, "Table 'projects' exists and is queryable");

    const sessionsTableCheck = await pool.query('SELECT COUNT(*) FROM sessions');
    assert(sessionsTableCheck.rows.length === 1, "Table 'sessions' exists and is queryable");

    // 3. Test REPEAT / IDEMPOTENCY: calling applyMigrations again does nothing
    const repeatResults = await applyMigrations(pool);
    assert(repeatResults.length === 0, 'Repeating applyMigrations is strictly idempotent (0 new migrations applied)');
    const afterRepeat = await getAppliedMigrations(pool);
    assert(afterRepeat.length === 2, 'schema_migrations count remains stable at 2');

    // 4. Test ROLLBACK: rollback latest migration (v2)
    const rollbackResult = await rollbackMigration(pool);
    assert(rollbackResult !== null && rollbackResult.version === 2, 'Successfully rolled back v2 (002_create_indexes)');
    assert(rollbackResult?.action === 'reverted', 'Rollback action marked as reverted');

    const afterRollback = await getAppliedMigrations(pool);
    assert(afterRollback.length === 1, 'schema_migrations now contains exactly 1 migration (v1)');
    assert(afterRollback[0].version === 1, 'Only v1 remains applied');

    // Verify users table still exists after v2 rollback
    const userTableCheckAfterRollback = await pool.query('SELECT COUNT(*) FROM users');
    assert(userTableCheckAfterRollback.rows.length === 1, "Table 'users' intact after v2 rollback");

    // 5. Test RE-APPLICATION: apply pending migrations again (should re-apply v2)
    const reapplyResults = await applyMigrations(pool);
    assert(reapplyResults.length === 1, 'Re-applying migrations applies pending v2');
    assert(reapplyResults[0].version === 2, 'Re-applied migration is v2');

    const finalApplied = await getAppliedMigrations(pool);
    assert(finalApplied.length === 2, 'Database is once again fully migrated to v2');

  } catch (err) {
    failed++;
    console.error('Migration test fatal error:', err);
  }

  console.log(`\nMigration Engine Results: Passed=${passed}, Failed=${failed}\n`);
  return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrationTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
