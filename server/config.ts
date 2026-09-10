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

export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validates the runtime environment on server boot.
 * Prevents silent startup in production if critical secrets or database configurations are missing.
 */
export function validateAndGetConfig(customEnv?: Record<string, string | undefined>): AppConfig {
  if (cachedConfig && !customEnv) {
    return cachedConfig;
  }

  const env = customEnv || process.env;
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const appUrl = env.APP_URL || 'http://localhost:3000';
  let appSecret = env.APP_SECRET;
  let databaseUrl = env.DATABASE_URL;

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
      errors.push('CRITICAL: DATABASE_URL environment variable is mandatory in production.');
    } else if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
      errors.push('CRITICAL: Localhost database fallback is strictly forbidden in production.');
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

  const resolvedConfig: AppConfig = {
    isProduction,
    appSecret: appSecret!,
    appUrl,
    databaseUrl: databaseUrl!,
    nodeEnv,
  };

  if (!customEnv) {
    cachedConfig = resolvedConfig;
  }

  return resolvedConfig;
}
