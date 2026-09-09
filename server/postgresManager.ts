import pg from 'pg';
import { execSync } from 'child_process';
import { validateAndGetConfig } from './config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function ensurePostgresRunning(): void {
  // If custom external database URL is specified (e.g. AWS RDS, GCP Cloud SQL, Supabase, Neon), don't manage local process
  const config = validateAndGetConfig();
  if (config.databaseUrl && !config.databaseUrl.includes('127.0.0.1') && !config.databaseUrl.includes('localhost')) {
    return;
  }

  try {
    execSync('/usr/bin/pg_isready -h 127.0.0.1 -p 5432', { stdio: 'ignore' });
    return;
  } catch {
    // Needs to start local PostgreSQL
  }

  try {
    execSync('mkdir -p /var/run/postgresql && chown -R postgres:postgres /var/run/postgresql 2>/dev/null || true');
    execSync('mkdir -p /tmp/pgdata && chown -R postgres:postgres /tmp/pgdata 2>/dev/null || true');

    try {
      execSync('test -f /tmp/pgdata/PG_VERSION', { stdio: 'ignore' });
    } catch {
      execSync('su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D /tmp/pgdata --auth=trust"', { stdio: 'ignore' });
    }

    execSync('su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /tmp/pgdata -l /tmp/pgdata/logfile start"', { stdio: 'ignore' });

    let attempts = 0;
    while (attempts < 10) {
      try {
        execSync('/usr/bin/pg_isready -h 127.0.0.1 -p 5432', { stdio: 'ignore' });
        break;
      } catch {
        attempts++;
        execSync('sleep 1');
      }
    }

    // Ensure novacad database exists
    execSync('su - postgres -c "/usr/bin/psql -h 127.0.0.1 -U postgres -tc \\"SELECT 1 FROM pg_database WHERE datname = \'novacad\'\\" | grep -q 1 || su - postgres -c \\"/usr/bin/psql -h 127.0.0.1 -U postgres -c \'CREATE DATABASE novacad;\'\\""', { stdio: 'ignore' });
    console.log('✅ [POSTGRESQL] Dedicated PostgreSQL server is active and database "novacad" is ready.');
  } catch (err) {
    console.warn('PostgreSQL manager notice:', err);
  }
}

export function getPostgresPool(): pg.Pool {
  if (!pool) {
    ensurePostgresRunning();
    const config = validateAndGetConfig();
    pool = new Pool({
      connectionString: config.databaseUrl || 'postgresql://postgres@127.0.0.1:5432/novacad',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}
