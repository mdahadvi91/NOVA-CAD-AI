import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class MemoryRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();

  constructor() {
    // Periodically sweep expired keys every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  public check(key: string, max: number, windowMs: number): { allowed: boolean; remaining: number; retryAfter: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: max - 1, retryAfter: Math.ceil(windowMs / 1000) };
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    record.count++;
    return { allowed: true, remaining: max - record.count, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  public getStatus(key: string, max: number, windowMs: number): { isBlocked: boolean; remaining: number; retryAfter: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      return { isBlocked: false, remaining: max, retryAfter: 0 };
    }

    if (record.count >= max) {
      return { isBlocked: true, remaining: 0, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
    }

    return { isBlocked: false, remaining: max - record.count, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  public reset(key: string): void {
    this.store.delete(key);
  }
}

export const rateLimiterStore = new MemoryRateLimiter();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// 1. Generic Rate Limiting Middleware Factory
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  prefix: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const key = `${options.prefix}:${ip}`;
    const result = rateLimiterStore.check(key, options.max, options.windowMs);

    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      res.status(429).json({
        error: options.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  };
}

// 2. Specific Rate Limiters
export const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 6, // 6 registrations per IP
  message: 'Too many registration attempts from this IP address. Please try again in 15 minutes.',
  prefix: 'reg',
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 4, // 4 reset requests per IP
  message: 'Too many password reset requests. Please wait 15 minutes before requesting again.',
  prefix: 'reset',
});

export const emailVerificationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many verification attempts. Please wait 15 minutes before trying again.',
  prefix: 'verify',
});

// 3. Brute-Force Login Throttling Tracker
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getLoginKey(req: Request, email?: string): string {
  const ip = getClientIp(req);
  const normalizedEmail = (email || '').toLowerCase().trim();
  return `login:${ip}:${normalizedEmail}`;
}

export function checkLoginLockout(req: Request, email: string): { isLocked: boolean; remaining: number; retryAfterSeconds: number } {
  const key = getLoginKey(req, email);
  const status = rateLimiterStore.getStatus(key, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_WINDOW_MS);
  return {
    isLocked: status.isBlocked,
    remaining: status.remaining,
    retryAfterSeconds: status.retryAfter,
  };
}

export function recordFailedLogin(req: Request, email: string): { isLocked: boolean; remaining: number; retryAfterSeconds: number } {
  const key = getLoginKey(req, email);
  const result = rateLimiterStore.check(key, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_WINDOW_MS);
  return {
    isLocked: !result.allowed,
    remaining: Math.max(0, result.remaining),
    retryAfterSeconds: result.retryAfter,
  };
}

export function recordSuccessfulLogin(req: Request, email: string): void {
  const key = getLoginKey(req, email);
  rateLimiterStore.reset(key);
}
