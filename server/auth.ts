import argon2 from 'argon2';
import { Request, Response, NextFunction } from 'express';
import { db, User } from './db.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

/**
 * OWASP-compliant password hashing using Argon2id with modern work factors
 * Memory: 64MB (65536 KB), Time: 3 passes, Parallelism: 4 threads
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  return { hash, salt: 'argon2id' };
}

/**
 * Password verification supporting Argon2id with strict matching
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  _salt?: string
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  try {
    if (storedHash && storedHash.startsWith('$argon2')) {
      const isValid = await argon2.verify(storedHash, password);
      return { isValid, needsRehash: false };
    }

    return { isValid: false, needsRehash: false };
  } catch (err) {
    console.error('Password verification error:', err);
    return { isValid: false, needsRehash: false };
  }
}

/**
 * Authentication Middleware
 * Strictly enforces HttpOnly session_id cookie -> PostgreSQL session -> User
 * Alternate transports (x-session-id headers, Authorization Bearer) are strictly forbidden.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId: string | undefined = req.cookies?.['session_id'];

  if (!sessionId) {
    res.status(401).json({
      error: 'Authentication required. Please sign in.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const sessionData = await db.findSessionById(sessionId);
  if (!sessionData) {
    res.status(401).json({
      error: 'Invalid or expired session. Please sign in again.',
      code: 'INVALID_SESSION',
    });
    return;
  }

  req.user = sessionData.user;
  req.sessionId = sessionData.session.id;
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
