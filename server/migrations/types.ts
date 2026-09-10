import type pg from 'pg';

export interface Migration {
  version: number;
  name: string;
  up: (client: pg.PoolClient | pg.Pool) => Promise<void>;
  down: (client: pg.PoolClient | pg.Pool) => Promise<void>;
}

export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: Date;
  checksum: string;
}

export interface MigrationResult {
  version: number;
  name: string;
  action: 'applied' | 'reverted' | 'skipped';
}
