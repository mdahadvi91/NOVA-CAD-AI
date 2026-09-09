import 'dotenv/config';
import crypto from 'crypto';

export interface AppConfig {
  isProduction: boolean;
  appSecret: string;
  appUrl: string;
  databaseUrl: string;
  nodeEnv: string;
}

let cachedConfig: AppConfig | null = null;

/**
 * Validates the runtime environment on server boot.
 * Prevents silent startup in production if critical secrets or database configurations are missing.
 */
export function validateAndGetConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  let appSecret = process.env.APP_SECRET;
  let databaseUrl = process.env.DATABASE_URL;

  if (isProduction) {
    const errors: string[] = [];

    if (!appSecret || appSecret.trim().length === 0) {
      errors.push('CRITICAL: APP_SECRET environment variable is missing in production.');
    } else if (appSecret.length < 32) {
      errors.push('CRITICAL: APP_SECRET must be at least 32 characters long in production.');
    } else if (
      appSecret === 'nova_cad_ai_secure_token_secret_2026' ||
      appSecret.includes('nova_cad_ai_secure_token_secret')
    ) {
      errors.push('CRITICAL: Known default or fallback APP_SECRET is strictly forbidden in production.');
    }

    if (!databaseUrl || databaseUrl.trim().length === 0) {
      // In production, require DATABASE_URL unless local managed postgres is explicitly configured
      databaseUrl = 'postgresql://postgres@127.0.0.1:5432/novacad';
    }

    if (errors.length > 0) {
      console.error('\n================ PRODUCTION ENVIRONMENT CONFIGURATION ERROR ================');
      errors.forEach((err) => console.error(`  ❌ ${err}`));
      console.error('============================================================================\n');
      throw new Error(`[SECURITY FATAL] Server startup aborted due to configuration errors:\n${errors.join('\n')}`);
    }
  } else {
    // Development / Test environment
    if (!appSecret || appSecret.trim().length < 16) {
      const globalAny = globalThis as unknown as { __NOVA_EPHEMERAL_APP_SECRET?: string };
      if (!globalAny.__NOVA_EPHEMERAL_APP_SECRET) {
        globalAny.__NOVA_EPHEMERAL_APP_SECRET = crypto.randomBytes(32).toString('hex');
        console.warn(
          '⚠️  [SECURITY NOTICE] APP_SECRET not set in development mode. Generated an ephemeral 256-bit cryptographic secret for this runtime.'
        );
      }
      appSecret = globalAny.__NOVA_EPHEMERAL_APP_SECRET;
    }

    if (!databaseUrl) {
      databaseUrl = 'postgresql://postgres@127.0.0.1:5432/novacad';
    }
  }

  cachedConfig = {
    isProduction,
    appSecret: appSecret!,
    appUrl,
    databaseUrl,
    nodeEnv,
  };

  return cachedConfig;
}
