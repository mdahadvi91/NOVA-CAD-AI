import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db, User } from './db.js';

// Secret key for HMAC token signing (falls back to persistent or runtime random)
const JWT_SECRET = process.env.APP_SECRET || 'nova_cad_ai_secure_token_secret_2026';

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function createToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days expiration
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
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
      .createHmac('sha256', JWT_SECRET)
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

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please log in.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'Invalid or expired session. Please log in again.',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  const user = await db.findUserById(payload.userId);
  if (!user) {
    res.status(401).json({
      error: 'User account not found.',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  req.user = user;
  next();
}
