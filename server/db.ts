import crypto from 'crypto';
import type pg from 'pg';
import { getPostgresPool } from './postgresManager.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: 'user' | 'admin';
  tier: 'free' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UnitType = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  gridSnap: boolean;
  gridSize: number;
}

export interface DrawingData {
  objects: unknown[];
  layers: {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
  }[];
  viewState: ViewState;
  calibration: {
    originX: number;
    originY: number;
    scaleRefLength: number;
  };
}

export interface ProjectMetadata {
  description?: string;
  tags?: string[];
  gridSpacing?: number;
  snapTolerance?: number;
  defaultLayerId?: string;
  precision?: number;
  lastEditedBy?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  units: UnitType;
  status: 'active' | 'archived';
  metadata: ProjectMetadata;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string;
  drawingData: DrawingData;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  description: string;
  drawingData: DrawingData;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  provider: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  tierGranted?: string;
  creditsGranted: number;
  receiptUrl?: string;
  createdAt: string;
}

export interface AIUsageLog {
  id: string;
  userId: string;
  projectId?: string;
  feature: string;
  tokensUsed: number;
  creditsConsumed: number;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
  usedAt?: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
  usedAt?: string;
}

// Row Mappers to convert PostgreSQL snake_case to TypeScript camelCase
function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    salt: row.salt as string,
    name: row.name as string,
    role: (row.role as 'user' | 'admin') || 'user',
    tier: (row.tier as 'free' | 'pro' | 'enterprise') || 'free',
    subscriptionStatus:
      (row.subscription_status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'none') || 'none',
    stripeCustomerId: (row.stripe_customer_id as string) || undefined,
    stripeSubscriptionId: (row.stripe_subscription_id as string) || undefined,
    aiCreditsRemaining: Number(row.ai_credits_remaining ?? 50),
    aiCreditsTotal: Number(row.ai_credits_total ?? 50),
    emailVerified: Boolean(row.email_verified),
    verificationToken: (row.verification_token as string) || undefined,
    verificationTokenExpires: row.verification_token_expires
      ? new Date(row.verification_token_expires as string).toISOString()
      : undefined,
    resetPasswordToken: (row.reset_password_token as string) || undefined,
    resetPasswordExpires: row.reset_password_expires
      ? new Date(row.reset_password_expires as string).toISOString()
      : undefined,
    passwordChangedAt: row.password_changed_at
      ? new Date(row.password_changed_at as string).toISOString()
      : undefined,
    lastLoginAt: row.last_login_at
      ? new Date(row.last_login_at as string).toISOString()
      : undefined,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    units: (row.units as UnitType) || 'mm',
    status: (row.status as 'active' | 'archived') || 'active',
    metadata: (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) || {},
    drawingData:
      typeof row.drawing_data === 'string' ? JSON.parse(row.drawing_data) : row.drawing_data || {},
    currentVersionId: (row.current_version_id as string) || undefined,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapProjectVersionRow(row: Record<string, unknown>): ProjectVersion {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    version: Number(row.version),
    createdBy: (row.created_by as string) || '',
    description: (row.description as string) || '',
    drawingData:
      typeof row.drawing_data === 'string' ? JSON.parse(row.drawing_data) : row.drawing_data || {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export class Database {
  private pool: pg.Pool | null = null;
  private isInitialized = false;

  private getPool(): pg.Pool {
    if (!this.pool) {
      this.pool = getPostgresPool();
    }
    return this.pool;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    const pool = this.getPool();

    // DDL Migration execution in PostgreSQL
    await pool.query(`
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

    // Clean up any historical demo accounts if present
    await pool.query("DELETE FROM users WHERE email = 'demo@novacad.ai' OR id = 'usr_demo_nova'");

    this.isInitialized = true;
    console.log('✅ [POSTGRESQL] Schema initialized & validated. Zero demo accounts present.');
  }

  /**
   * ACID-compliant transaction manager with automatic BEGIN, COMMIT, and ROLLBACK in PostgreSQL
   */
  public async runTransaction<T>(operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    await this.init();
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Atomic User Registration with Starter CAD Project in PostgreSQL
   * Guaranteed all-or-nothing atomicity.
   */
  public async registerUserAtomic(
    userData: {
      email: string;
      passwordHash: string;
      salt: string;
      name: string;
      verificationToken?: string;
      verificationTokenExpires?: string;
    },
    starterProjectData: {
      name: string;
      description?: string;
      units?: UnitType;
    }
  ): Promise<{ user: User; starterProject: Project }> {
    return this.runTransaction(async (client) => {
      const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();
      const normalizedEmail = userData.email.trim().toLowerCase();

      const userInsert = await client.query(
        `INSERT INTO users (
          id, email, password_hash, salt, name, role, tier,
          subscription_status, ai_credits_remaining, ai_credits_total,
          email_verified, verification_token, verification_token_expires,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'user', 'free', 'none', 50, 50, FALSE, $6, $7, $8, $8)
        RETURNING *`,
        [
          userId,
          normalizedEmail,
          userData.passwordHash,
          userData.salt,
          userData.name.trim(),
          userData.verificationToken || null,
          userData.verificationTokenExpires || null,
          now,
        ]
      );

      const user = mapUserRow(userInsert.rows[0]);

      // Seed calibrated initial drawing
      const projectId = `prj_${crypto.randomBytes(8).toString('hex')}`;
      const versionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
      const initialDrawing: DrawingData = {
        objects: [],
        layers: [
          { id: 'layer_0', name: '0 - Standard', color: '#00e5ff', visible: true, locked: false },
          { id: 'layer_geom', name: 'A-GEOM', color: '#ffffff', visible: true, locked: false },
        ],
        viewState: {
          panX: 0,
          panY: 0,
          zoom: 1.0,
          gridVisible: true,
          gridSnap: true,
          gridSize: 20,
        },
        calibration: {
          originX: 0,
          originY: 0,
          scaleRefLength: 1000,
        },
      };

      const projectMetadata: ProjectMetadata = {
        gridSpacing: 20,
        snapTolerance: 10,
        precision: 2,
      };

      const projectInsert = await client.query(
        `INSERT INTO projects (
          id, owner_id, name, description, units, status,
          metadata, drawing_data, current_version_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $9)
        RETURNING *`,
        [
          projectId,
          user.id,
          starterProjectData.name,
          starterProjectData.description || 'Calibrated CAD engineering workspace with precision grid and standard layers.',
          starterProjectData.units || 'mm',
          JSON.stringify(projectMetadata),
          JSON.stringify(initialDrawing),
          versionId,
          now,
        ]
      );

      const starterProject = mapProjectRow(projectInsert.rows[0]);

      await client.query(
        `INSERT INTO project_versions (
          id, project_id, version, created_by, description, drawing_data, created_at
        ) VALUES ($1, $2, 1, $3, 'Initial Phase 1 Workspace Calibration', $4, $5)`,
        [versionId, projectId, user.id, JSON.stringify(initialDrawing), now]
      );

      return { user, starterProject };
    });
  }

  // --- USER METHODS ---
  public async findUserByEmail(email: string): Promise<User | null> {
    await this.init();
    const res = await this.getPool().query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [
      email.trim(),
    ]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  public async findUserById(id: string): Promise<User | null> {
    await this.init();
    const res = await this.getPool().query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  public async createUser(userData: {
    email: string;
    passwordHash: string;
    salt: string;
    name: string;
    verificationToken?: string;
    verificationTokenExpires?: string;
  }): Promise<User> {
    await this.init();
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const res = await this.getPool().query(
      `INSERT INTO users (
        id, email, password_hash, salt, name, role, tier,
        subscription_status, ai_credits_remaining, ai_credits_total,
        email_verified, verification_token, verification_token_expires,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'user', 'free', 'none', 50, 50, FALSE, $6, $7, $8, $8)
      RETURNING *`,
      [
        id,
        userData.email.trim().toLowerCase(),
        userData.passwordHash,
        userData.salt,
        userData.name.trim(),
        userData.verificationToken || null,
        userData.verificationTokenExpires || null,
        now,
      ]
    );
    return mapUserRow(res.rows[0]);
  }

  public async updateUser(userId: string, partial: Partial<User>): Promise<User | null> {
    await this.init();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (partial.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(partial.name.trim());
    }
    if (partial.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(partial.role);
    }
    if (partial.tier !== undefined) {
      fields.push(`tier = $${idx++}`);
      values.push(partial.tier);
    }
    if (partial.subscriptionStatus !== undefined) {
      fields.push(`subscription_status = $${idx++}`);
      values.push(partial.subscriptionStatus);
    }
    if (partial.stripeCustomerId !== undefined) {
      fields.push(`stripe_customer_id = $${idx++}`);
      values.push(partial.stripeCustomerId);
    }
    if (partial.stripeSubscriptionId !== undefined) {
      fields.push(`stripe_subscription_id = $${idx++}`);
      values.push(partial.stripeSubscriptionId);
    }
    if (partial.aiCreditsRemaining !== undefined) {
      fields.push(`ai_credits_remaining = $${idx++}`);
      values.push(partial.aiCreditsRemaining);
    }
    if (partial.aiCreditsTotal !== undefined) {
      fields.push(`ai_credits_total = $${idx++}`);
      values.push(partial.aiCreditsTotal);
    }
    if (partial.emailVerified !== undefined) {
      fields.push(`email_verified = $${idx++}`);
      values.push(partial.emailVerified);
    }
    if (partial.verificationToken !== undefined) {
      fields.push(`verification_token = $${idx++}`);
      values.push(partial.verificationToken);
    }
    if (partial.verificationTokenExpires !== undefined) {
      fields.push(`verification_token_expires = $${idx++}`);
      values.push(partial.verificationTokenExpires);
    }
    if (partial.resetPasswordToken !== undefined) {
      fields.push(`reset_password_token = $${idx++}`);
      values.push(partial.resetPasswordToken);
    }
    if (partial.resetPasswordExpires !== undefined) {
      fields.push(`reset_password_expires = $${idx++}`);
      values.push(partial.resetPasswordExpires);
    }
    if (partial.passwordChangedAt !== undefined) {
      fields.push(`password_changed_at = $${idx++}`);
      values.push(partial.passwordChangedAt);
    }
    if (partial.lastLoginAt !== undefined) {
      fields.push(`last_login_at = $${idx++}`);
      values.push(partial.lastLoginAt);
    }

    if (fields.length === 0) {
      return this.findUserById(userId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.getPool().query(query, values);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  public async findUserByVerificationToken(token: string): Promise<User | null> {
    await this.init();
    if (!token) return null;
    const res = await this.getPool().query(
      'SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()',
      [token]
    );
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  public async findUserByResetToken(token: string): Promise<User | null> {
    await this.init();
    if (!token) return null;
    const res = await this.getPool().query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [token]
    );
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  // --- SESSION METHODS ---
  public async createSession(userId: string, ttlMs: number = 7 * 24 * 60 * 60 * 1000): Promise<Session> {
    await this.init();
    const sessionId = `ses_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const now = new Date().toISOString();

    const res = await this.getPool().query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [sessionId, userId, expiresAt, now]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: new Date(row.last_used_at).toISOString(),
    };
  }

  public async findSessionById(sessionId: string): Promise<{ session: Session; user: User } | null> {
    await this.init();
    const res = await this.getPool().query(
      `SELECT s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at, s.last_used_at,
              u.*
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    // Update last_used_at asynchronously
    this.getPool().query('UPDATE sessions SET last_used_at = NOW() WHERE id = $1', [sessionId]).catch(() => {});

    return {
      session: {
        id: row.session_id,
        userId: row.user_id,
        expiresAt: new Date(row.expires_at).toISOString(),
        createdAt: new Date(row.session_created_at).toISOString(),
        lastUsedAt: new Date(row.last_used_at).toISOString(),
      },
      user: mapUserRow(row),
    };
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    await this.init();
    const res = await this.getPool().query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return (res.rowCount ?? 0) > 0;
  }

  public async deleteAllSessionsForUser(userId: string): Promise<void> {
    await this.init();
    await this.getPool().query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  // --- EMAIL VERIFICATION TOKEN METHODS ---
  public async createEmailVerificationToken(userId: string, rawToken: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.init();
    const id = `evt_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    await this.getPool().query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used, created_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW())`,
      [id, userId, tokenHash, expiresAt]
    );
  }

  public async verifyEmailToken(rawToken: string): Promise<{ success: boolean; user?: User; error?: string }> {
    await this.init();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    return this.runTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM email_verification_tokens WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash]
      );

      if (res.rows.length === 0) {
        return { success: false, error: 'Invalid email verification token.' };
      }

      const row = res.rows[0];
      if (row.used) {
        return { success: false, error: 'This verification token has already been used.' };
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return { success: false, error: 'Verification token has expired. Please request a new verification link.' };
      }

      // Mark used
      await client.query(
        `UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE id = $1`,
        [row.id]
      );

      // Mark user email verified
      const userRes = await client.query(
        `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [row.user_id]
      );

      return { success: true, user: mapUserRow(userRes.rows[0]) };
    });
  }

  // --- PASSWORD RESET TOKEN METHODS ---
  public async createPasswordResetToken(userId: string, rawToken: string, ttlMs: number = 60 * 60 * 1000): Promise<void> {
    await this.init();
    const id = `prt_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    await this.getPool().query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW())`,
      [id, userId, tokenHash, expiresAt]
    );
  }

  public async resetPasswordWithToken(rawToken: string, newPasswordHash: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    await this.init();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    return this.runTransaction(async (client) => {
      const res = await client.query(
        `SELECT * FROM password_reset_tokens WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash]
      );

      if (res.rows.length === 0) {
        return { success: false, error: 'Invalid or expired password reset link.' };
      }

      const row = res.rows[0];
      if (row.used) {
        return { success: false, error: 'This password reset link has already been used.' };
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return { success: false, error: 'Password reset link has expired. Please request a new one.' };
      }

      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE id = $1`,
        [row.id]
      );

      // Update password
      await client.query(
        `UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, row.user_id]
      );

      // Invalidate all existing sessions for this user!
      await client.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);

      return { success: true, userId: row.user_id };
    });
  }

  // --- PROJECT METHODS ---
  public async getProjectsForUser(userId: string): Promise<Project[]> {
    await this.init();
    const res = await this.getPool().query(
      "SELECT * FROM projects WHERE owner_id = $1 AND status != 'archived' ORDER BY updated_at DESC",
      [userId]
    );
    return res.rows.map(mapProjectRow);
  }

  public async getProjectById(projectId: string): Promise<Project | null> {
    await this.init();
    const res = await this.getPool().query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (res.rows.length === 0) return null;
    return mapProjectRow(res.rows[0]);
  }

  public async createProject(data: {
    ownerId: string;
    name: string;
    description?: string;
    units?: UnitType;
    metadata?: ProjectMetadata;
  }): Promise<Project> {
    return this.runTransaction(async (client) => {
      const id = `prj_${crypto.randomBytes(8).toString('hex')}`;
      const versionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();
      const units = data.units || 'mm';

      const defaultDrawingData: DrawingData = {
        objects: [],
        layers: [
          { id: 'layer_0', name: '0 - Standard', color: '#00e5ff', visible: true, locked: false },
          { id: 'layer_geom', name: 'A-GEOM', color: '#ffffff', visible: true, locked: false },
        ],
        viewState: {
          panX: 0,
          panY: 0,
          zoom: 1.0,
          gridVisible: true,
          gridSnap: true,
          gridSize: units === 'm' ? 1 : units === 'ft' ? 1 : 20,
        },
        calibration: {
          originX: 0,
          originY: 0,
          scaleRefLength: units === 'm' ? 10 : 1000,
        },
      };

      const meta: ProjectMetadata = {
        gridSpacing: units === 'm' ? 1 : 20,
        snapTolerance: 10,
        precision: 2,
        ...data.metadata,
      };

      const res = await client.query(
        `INSERT INTO projects (
          id, owner_id, name, description, units, status,
          metadata, drawing_data, current_version_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $9)
        RETURNING *`,
        [
          id,
          data.ownerId,
          data.name.trim(),
          data.description?.trim() || '',
          units,
          JSON.stringify(meta),
          JSON.stringify(defaultDrawingData),
          versionId,
          now,
        ]
      );

      await client.query(
        `INSERT INTO project_versions (
          id, project_id, version, created_by, description, drawing_data, created_at
        ) VALUES ($1, $2, 1, $3, 'Initial Project Creation', $4, $5)`,
        [versionId, id, data.ownerId, JSON.stringify(defaultDrawingData), now]
      );

      return mapProjectRow(res.rows[0]);
    });
  }

  public async updateProject(
    projectId: string,
    updates: {
      name?: string;
      description?: string;
      units?: UnitType;
      metadata?: ProjectMetadata;
      drawingData?: DrawingData;
    }
  ): Promise<Project | null> {
    await this.init();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name.trim());
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description.trim());
    }
    if (updates.units !== undefined) {
      fields.push(`units = $${idx++}`);
      values.push(updates.units);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.drawingData !== undefined) {
      fields.push(`drawing_data = $${idx++}`);
      values.push(JSON.stringify(updates.drawingData));
    }

    if (fields.length === 0) {
      return this.getProjectById(projectId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(projectId);

    const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.getPool().query(query, values);
    if (res.rows.length === 0) return null;
    return mapProjectRow(res.rows[0]);
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    await this.init();
    const res = await this.getPool().query('DELETE FROM projects WHERE id = $1', [projectId]);
    return (res.rowCount ?? 0) > 0;
  }

  public async duplicateProject(projectId: string, newOwnerId: string): Promise<Project | null> {
    const source = await this.getProjectById(projectId);
    if (!source) return null;

    return this.runTransaction(async (client) => {
      const newId = `prj_${crypto.randomBytes(8).toString('hex')}`;
      const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      const res = await client.query(
        `INSERT INTO projects (
          id, owner_id, name, description, units, status,
          metadata, drawing_data, current_version_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $9)
        RETURNING *`,
        [
          newId,
          newOwnerId,
          `${source.name} (Copy)`,
          source.description,
          source.units,
          JSON.stringify(source.metadata),
          JSON.stringify(source.drawingData),
          newVersionId,
          now,
        ]
      );

      await client.query(
        `INSERT INTO project_versions (
          id, project_id, version, created_by, description, drawing_data, created_at
        ) VALUES ($1, $2, 1, $3, $4, $5, $6)`,
        [
          newVersionId,
          newId,
          newOwnerId,
          `Duplicated from ${source.name}`,
          JSON.stringify(source.drawingData),
          now,
        ]
      );

      return mapProjectRow(res.rows[0]);
    });
  }

  public async saveProjectVersion(
    projectId: string,
    userId: string,
    drawingData: DrawingData,
    description = 'Manual save'
  ): Promise<{ project: Project; version: ProjectVersion } | null> {
    return this.runTransaction(async (client) => {
      const projectRes = await client.query('SELECT * FROM projects WHERE id = $1', [projectId]);
      if (projectRes.rows.length === 0) return null;

      const versionRes = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM project_versions WHERE project_id = $1',
        [projectId]
      );
      const nextVersion = Number(versionRes.rows[0].next_version || 1);

      const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO project_versions (
          id, project_id, version, created_by, description, drawing_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newVersionId, projectId, nextVersion, userId, description, JSON.stringify(drawingData), now]
      );

      const updatedProjectRes = await client.query(
        `UPDATE projects
         SET drawing_data = $1, current_version_id = $2, updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(drawingData), newVersionId, now, projectId]
      );

      const project = mapProjectRow(updatedProjectRes.rows[0]);
      const version: ProjectVersion = {
        id: newVersionId,
        projectId,
        version: nextVersion,
        createdBy: userId,
        description,
        drawingData,
        createdAt: now,
      };

      return { project, version };
    });
  }

  public async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    await this.init();
    const res = await this.getPool().query(
      'SELECT * FROM project_versions WHERE project_id = $1 ORDER BY version DESC',
      [projectId]
    );
    return res.rows.map(mapProjectVersionRow);
  }

  public async restoreProjectVersion(
    projectId: string,
    versionId: string,
    userId: string
  ): Promise<{ project: Project; version: ProjectVersion } | null> {
    return this.runTransaction(async (client) => {
      const versionRes = await client.query(
        'SELECT * FROM project_versions WHERE id = $1 AND project_id = $2',
        [versionId, projectId]
      );
      if (versionRes.rows.length === 0) return null;
      const targetVersion = mapProjectVersionRow(versionRes.rows[0]);

      // Create new version marking restoration
      const countRes = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM project_versions WHERE project_id = $1',
        [projectId]
      );
      const nextVersion = Number(countRes.rows[0].next_version || 1);
      const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();
      const description = `Restored from version ${targetVersion.version}`;

      await client.query(
        `INSERT INTO project_versions (
          id, project_id, version, created_by, description, drawing_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newVersionId, projectId, nextVersion, userId, description, JSON.stringify(targetVersion.drawingData), now]
      );

      const updatedProjectRes = await client.query(
        `UPDATE projects
         SET drawing_data = $1, current_version_id = $2, updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(targetVersion.drawingData), newVersionId, now, projectId]
      );

      return {
        project: mapProjectRow(updatedProjectRes.rows[0]),
        version: {
          id: newVersionId,
          projectId,
          version: nextVersion,
          createdBy: userId,
          description,
          drawingData: targetVersion.drawingData,
          createdAt: now,
        },
      };
    });
  }

  // --- PAYMENT & STRIPE TRANSACTION METHODS ---
  public async recordPayment(payment: {
    userId: string;
    amountCents: number;
    currency?: string;
    status?: 'succeeded' | 'pending' | 'failed' | 'refunded';
    provider?: string;
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
    tierGranted?: string;
    creditsGranted?: number;
    receiptUrl?: string;
  }): Promise<PaymentTransaction> {
    return this.runTransaction(async (client) => {
      const id = `tx_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      const res = await client.query(
        `INSERT INTO payment_transactions (
          id, user_id, amount_cents, currency, status, provider,
          stripe_payment_intent_id, stripe_invoice_id, tier_granted, credits_granted,
          receipt_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          id,
          payment.userId,
          payment.amountCents,
          payment.currency || 'USD',
          payment.status || 'succeeded',
          payment.provider || 'stripe',
          payment.stripePaymentIntentId || null,
          payment.stripeInvoiceId || null,
          payment.tierGranted || null,
          payment.creditsGranted || 0,
          payment.receiptUrl || null,
          now,
        ]
      );

      // If tier or credits granted, apply directly to user record atomically
      if (payment.tierGranted || (payment.creditsGranted && payment.creditsGranted > 0)) {
        await client.query(
          `UPDATE users
           SET tier = COALESCE($1, tier),
               subscription_status = 'active',
               ai_credits_remaining = ai_credits_remaining + $2,
               ai_credits_total = ai_credits_total + $2,
               updated_at = $3
           WHERE id = $4`,
          [payment.tierGranted || null, payment.creditsGranted || 0, now, payment.userId]
        );
      }

      const row = res.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        amountCents: Number(row.amount_cents),
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
        stripeInvoiceId: row.stripe_invoice_id || undefined,
        tierGranted: row.tier_granted || undefined,
        creditsGranted: Number(row.credits_granted),
        receiptUrl: row.receipt_url || undefined,
        createdAt: new Date(row.created_at).toISOString(),
      };
    });
  }

  public async getUserPayments(userId: string): Promise<PaymentTransaction[]> {
    await this.init();
    const res = await this.getPool().query(
      'SELECT * FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
      stripeInvoiceId: row.stripe_invoice_id || undefined,
      tierGranted: row.tier_granted || undefined,
      creditsGranted: Number(row.credits_granted),
      receiptUrl: row.receipt_url || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  // --- AI USAGE LOGGING ---
  public async logAiUsage(data: {
    userId: string;
    projectId?: string;
    feature: string;
    tokensUsed?: number;
    creditsConsumed?: number;
  }): Promise<void> {
    await this.init();
    const id = `ai_${crypto.randomBytes(8).toString('hex')}`;
    await this.getPool().query(
      `INSERT INTO ai_usage_logs (id, user_id, project_id, feature, tokens_used, credits_consumed)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        data.userId,
        data.projectId || null,
        data.feature,
        data.tokensUsed || 0,
        data.creditsConsumed || 1,
      ]
    );
  }
}

export const db = new Database();
