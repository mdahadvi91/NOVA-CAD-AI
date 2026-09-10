import type { Migration } from './types.js';

export const migration001: Migration = {
  version: 1,
  name: '001_initial_schema',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        tier VARCHAR(32) NOT NULL DEFAULT 'free',
        subscription_status VARCHAR(32) NOT NULL DEFAULT 'none',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        ai_credits_remaining INTEGER NOT NULL DEFAULT 50,
        ai_credits_total INTEGER NOT NULL DEFAULT 50,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verification_token VARCHAR(128),
        verification_token_expires TIMESTAMPTZ,
        reset_password_token VARCHAR(128),
        reset_password_expires TIMESTAMPTZ,
        password_changed_at TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(64) PRIMARY KEY,
        owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        units VARCHAR(16) NOT NULL DEFAULT 'mm',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        drawing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        current_version_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_versions (
        id VARCHAR(64) PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        description TEXT NOT NULL DEFAULT '',
        drawing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'USD',
        status VARCHAR(32) NOT NULL DEFAULT 'succeeded',
        provider VARCHAR(32) NOT NULL DEFAULT 'stripe',
        stripe_payment_intent_id VARCHAR(255),
        stripe_invoice_id VARCHAR(255),
        tier_granted VARCHAR(32),
        credits_granted INTEGER NOT NULL DEFAULT 0,
        receipt_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
        feature VARCHAR(64) NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        credits_consumed INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        action VARCHAR(64) NOT NULL,
        ip_address VARCHAR(64),
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMPTZ
      );
    `);
  },
  down: async (client) => {
    await client.query(`
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS email_verification_tokens CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS ai_usage_logs CASCADE;
      DROP TABLE IF EXISTS payment_transactions CASCADE;
      DROP TABLE IF EXISTS project_versions CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
  },
};
