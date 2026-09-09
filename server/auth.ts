import crypto from 'crypto';
import argon2 from 'argon2';
import { Request, Response, NextFunction } from 'express';
import { db, User } from './db.js';
import { validateAndGetConfig } from './config.js';

function getAppSecret(): string {
  return validateAndGetConfig().appSecret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * OWASP-compliant password hashing using Argon2id with modern work factors
 * Memory: 64MB (65536 KB), Time: 3 passes, Parallelism: 4 threads
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    // Argon2 hashes embed the salt in the encoded string ($argon2id$v=19$m=65536,t=3,p=4$...)
    return { hash, salt: 'argon2id_embedded' };
  } catch (err) {
    console.warn('Argon2 failed, falling back to scrypt:', err);
    // Secure fallback using Node's crypto.scrypt
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return { hash: `scrypt$${derivedKey.toString('hex')}`, salt };
  }
}

/**
 * Password verification supporting Argon2id with backward compatibility for legacy PBKDF2
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt?: string
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  try {
    if (storedHash.startsWith('$argon2')) {
      const isValid = await argon2.verify(storedHash, password);
      return { isValid, needsRehash: false };
    }

    if (storedHash.startsWith('scrypt$')) {
      const actualHash = storedHash.replace('scrypt$', '');
      const derivedKey = crypto.scryptSync(password, salt || '', 64, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      });
      const isValid = crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), derivedKey);
      return { isValid, needsRehash: true }; // Upgrade to Argon2id upon login
    }

    // Legacy PBKDF2 check for backward compatibility
    if (salt) {
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const isValid = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
      return { isValid, needsRehash: true }; // Upgrade to Argon2id upon login
    }

    return { isValid: false, needsRehash: false };
  } catch (err) {
    console.error('Password verification error:', err);
    return { isValid: false, needsRehash: false };
  }
}

export function createToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days expiration
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAppSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getAppSecret())
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Authentication Middleware
 * Validates session either from Authorization: Bearer header OR secure HttpOnly cookie
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies['session_token']) {
    token = req.cookies['session_token'];
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Invalid or expired session. Please sign in again.',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  const user = await db.findUserById(payload.userId);
  if (!user) {
    res.status(401).json({
      error: 'User account not found or has been revoked.',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * Server-Side Subscription Authorization Middleware
 * Strictly prevents DevTools client-side spoofing by checking DB status directly
 */
export function requireTier(minimumTier: 'pro' | 'enterprise') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
      return;
    }

    const tierRank: Record<'free' | 'pro' | 'enterprise', number> = {
      free: 0,
      pro: 1,
      enterprise: 2,
    };

    const userRank = tierRank[user.tier || 'free'] || 0;
    const requiredRank = tierRank[minimumTier] || 1;

    // Subscription status must be active or trialing
    const validStatuses = ['active', 'trialing'];
    const hasValidSubscription = user.subscriptionStatus ? validStatuses.includes(user.subscriptionStatus) : false;

    if (userRank < requiredRank || !hasValidSubscription) {
      res.status(403).json({
        error: `This capability requires an active ${minimumTier.toUpperCase()} subscription. Upgrade your plan to access this feature.`,
        code: 'SUBSCRIPTION_REQUIRED',
        currentTier: user.tier || 'free',
        requiredTier: minimumTier,
      });
      return;
    }

    next();
  };
}

/**
 * Require Verified Email for sensitive operations
 */
export function requireVerifiedEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({
      error: 'Please verify your email address before performing this action.',
      code: 'EMAIL_VERIFICATION_REQUIRED',
    });
    return;
  }

  next();
}
