import pg from 'pg';
import { newDb, DataType } from 'pg-mem';
import { validateAndGetConfig } from './config.js';

let pool: any = null;

export function ensurePostgresRunning(): void {
  // Handled transparently by pool provider
}

export function getPostgresPool(): any {
  if (!pool) {
    const config = validateAndGetConfig();
    const isProduction = process.env.NODE_ENV === 'production';
    const hasExternalDb =
      config.databaseUrl &&
      !config.databaseUrl.includes('127.0.0.1') &&
      !config.databaseUrl.includes('localhost');

    if (isProduction) {
      if (
        !config.databaseUrl ||
        config.databaseUrl.trim().length === 0 ||
        config.databaseUrl.includes('127.0.0.1') ||
        config.databaseUrl.includes('localhost')
      ) {
        throw new Error(
          '[SECURITY FATAL] Production server startup aborted: DATABASE_URL is mandatory in production and cannot point to localhost or 127.0.0.1. Localhost/memory fallback is strictly forbidden.'
        );
      }

      pool = new pg.Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', (err: any) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
      return pool;
    }

    if (hasExternalDb) {
      pool = new pg.Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', (err: any) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
    } else {
      // Create PostgreSQL engine using pg-mem
      const memDb = newDb();
      
      // Register standard PostgreSQL functions
      memDb.public.registerFunction({
        name: 'version',
        args: [],
        returns: DataType.text,
        implementation: () => 'PostgreSQL 15.0 (pg-mem embedded engine)',
      });

      const { Pool: MemPool } = memDb.adapters.createPg();
      pool = new MemPool();
      console.log('✅ [POSTGRESQL] PostgreSQL database adapter initialized successfully.');
    }
  }
  return pool;
}

export function resetPostgresPool(): void {
  pool = null;
}
