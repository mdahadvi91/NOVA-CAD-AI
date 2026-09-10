import type { Migration } from './types.js';

export const migration002: Migration = {
  version: 2,
  name: '002_create_indexes',
  up: async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_verification_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_tokens_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_password_tokens_user ON password_reset_tokens(user_id);
    `);
  },
  down: async (client) => {
    await client.query(`
      DROP INDEX IF EXISTS idx_password_tokens_user;
      DROP INDEX IF EXISTS idx_password_tokens_hash;
      DROP INDEX IF EXISTS idx_email_tokens_user;
      DROP INDEX IF EXISTS idx_email_tokens_hash;
      DROP INDEX IF EXISTS idx_sessions_expires;
      DROP INDEX IF EXISTS idx_sessions_user;
      DROP INDEX IF EXISTS idx_payments_user;
      DROP INDEX IF EXISTS idx_project_versions_project;
      DROP INDEX IF EXISTS idx_projects_owner;
      DROP INDEX IF EXISTS idx_users_email;
    `);
  },
};
