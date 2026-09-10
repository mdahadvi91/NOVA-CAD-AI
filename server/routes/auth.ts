import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  requireAuth,
  AuthenticatedRequest,
} from '../auth.js';
import { validatePassword, validateEmail } from '../passwordPolicy.js';
import {
  registerRateLimiter,
  passwordResetRateLimiter,
  emailVerificationRateLimiter,
  checkLoginLockout,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../middleware/rateLimit.js';
import { mailer } from '../services/mailer.js';
import { validateAndGetConfig } from '../config.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// --- REGISTER ---
router.post('/register', registerRateLimiter, async (req, res: Response) => {
  try {
    const { email, password, confirmPassword, name } = req.body;

    // 1. Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Please provide your full name (minimum 2 characters).' });
      return;
    }

    // 2. Validate Email
    if (!email || !validateEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 3. Password Confirmation Validation
    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match. Please ensure both password fields are identical.' });
      return;
    }

    // 4. Strict OWASP Password Policy Enforcement
    const validation = validatePassword(password, { email: normalizedEmail, name: name.trim() });
    if (!validation.isValid) {
      res.status(400).json({
        error: validation.feedback[0] || 'Password does not meet enterprise security standards.',
        feedback: validation.feedback,
        score: validation.score,
      });
      return;
    }

    // 5. Duplicate Check
    const existingUser = await db.findUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(409).json({
        error: 'An account with this email address already exists. Please sign in instead.',
      });
      return;
    }

    // 6. Cryptographic Password Hashing with Argon2id
    const { hash, salt } = await hashPassword(password);

    // 7. Atomic Registration Transaction (User + Calibrated Starter Project)
    const { user } = await db.registerUserAtomic(
      {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hash,
        salt,
      },
      {
        name: 'Welcome - Drawing 1',
        description: 'Calibrated CAD engineering workspace with precision grid and standard layers.',
        units: 'mm',
      }
    );

    // 8. Generate Email Verification Token in DB and Dispatch Email
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    await db.createEmailVerificationToken(user.id, rawVerificationToken);

    try {
      await mailer.sendVerificationEmail(user.email, rawVerificationToken);
    } catch (mailErr) {
      const config = validateAndGetConfig();
      if (config.isProduction) {
        console.error('Failed to send verification email in production:', mailErr);
      }
    }

    // 9. Create PostgreSQL Session & Set HttpOnly Cookie
    const session = await db.createSession(user.id);
    res.cookie('session_id', session.id, COOKIE_OPTIONS);
    res.cookie('session_token', session.id, COOKIE_OPTIONS); // Backward compatibility alias

    const config = validateAndGetConfig();
    if (!config.isProduction) {
      console.log(`[AUTH-DEV] User registered: ${user.email} (Email verification queued)`);
    }

    res.status(201).json({
      sessionId: session.id,
      token: session.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tier: user.tier,
        subscriptionStatus: user.subscriptionStatus,
        aiCreditsRemaining: user.aiCreditsRemaining,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to complete registration due to an internal server error.' });
  }
});

// --- LOGIN WITH BRUTE-FORCE THROTTLING & POSTGRESQL SESSIONS ---
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Both email and password are required.' });
      return;
    }

    const normalizedEmail = (email as string).trim().toLowerCase();

    // 1. Check Brute-Force Lockout
    const lockoutStatus = checkLoginLockout(req, normalizedEmail);
    if (lockoutStatus.isLocked) {
      res.setHeader('Retry-After', lockoutStatus.retryAfterSeconds);
      res.status(429).json({
        error: `Account temporarily locked due to 5 consecutive failed login attempts. Please wait ${lockoutStatus.retryAfterSeconds} seconds before trying again or use Forgot Password.`,
        code: 'ACCOUNT_LOCKED',
        retryAfter: lockoutStatus.retryAfterSeconds,
      });
      return;
    }

    // 2. Fetch User
    const user = await db.findUserByEmail(normalizedEmail);
    if (!user) {
      const result = recordFailedLogin(req, normalizedEmail);
      res.status(401).json({
        error: result.isLocked
          ? 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
          : `Invalid email or password. ${result.attemptsRemaining} attempt(s) remaining before temporary lockout.`,
        attemptsRemaining: result.attemptsRemaining,
        code: result.isLocked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
      });
      return;
    }

    // 3. Argon2id Password Verification
    const { isValid } = await verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      const result = recordFailedLogin(req, normalizedEmail);
      res.status(401).json({
        error: result.isLocked
          ? 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
          : `Invalid email or password. ${result.attemptsRemaining} attempt(s) remaining before temporary lockout.`,
        attemptsRemaining: result.attemptsRemaining,
        code: result.isLocked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
      });
      return;
    }

    // 4. Success: Clear Throttling Counter
    recordSuccessfulLogin(req, normalizedEmail);

    // 5. Update last login timestamp
    await db.updateUser(user.id, {
      lastLoginAt: new Date().toISOString(),
    });

    // 6. Create PostgreSQL Session & Set HttpOnly Cookie
    const session = await db.createSession(user.id);
    res.cookie('session_id', session.id, COOKIE_OPTIONS);
    res.cookie('session_token', session.id, COOKIE_OPTIONS); // Backward compatibility alias

    res.json({
      sessionId: session.id,
      token: session.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tier: user.tier,
        subscriptionStatus: user.subscriptionStatus,
        aiCreditsRemaining: user.aiCreditsRemaining,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed. Please try again later.' });
  }
});

// --- CURRENT USER PROFILE ---
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      aiCreditsRemaining: user.aiCreditsRemaining,
      aiCreditsTotal: user.aiCreditsTotal,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  });
});

// --- EMAIL VERIFICATION: VERIFY TOKEN ---
router.post('/verify-email', emailVerificationRateLimiter, async (req, res: Response) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    const result = await db.verifyEmailToken(token.trim());
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Invalid or expired verification token.' });
      return;
    }

    res.json({
      message: 'Email verified successfully! All cloud export and workspace features are unlocked.',
      user: result.user
        ? {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            tier: result.user.tier,
            subscriptionStatus: result.user.subscriptionStatus,
            emailVerified: result.user.emailVerified,
          }
        : null,
    });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// --- EMAIL VERIFICATION: RESEND TOKEN ---
router.post('/resend-verification', emailVerificationRateLimiter, async (req, res: Response) => {
  try {
    const { email } = req.body;
    let targetUser = null;

    if (email && typeof email === 'string') {
      targetUser = await db.findUserByEmail(email.trim().toLowerCase());
    } else {
      const sessionId =
        req.cookies?.['session_id'] ||
        (req.headers['x-session-id'] as string) ||
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
          ? req.headers.authorization.substring(7).trim()
          : undefined);

      if (sessionId) {
        const sessionData = await db.findSessionById(sessionId);
        if (sessionData) {
          targetUser = sessionData.user;
        }
      }
    }

    if (!targetUser) {
      // Protection against email enumeration
      res.json({ message: 'If an account exists with that address, a verification link has been sent.' });
      return;
    }

    if (targetUser.emailVerified) {
      res.json({ message: 'This email address is already verified.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    await db.createEmailVerificationToken(targetUser.id, rawToken);

    try {
      await mailer.sendVerificationEmail(targetUser.email, rawToken);
    } catch (mailErr) {
      const config = validateAndGetConfig();
      if (config.isProduction) {
        console.error('Failed to send verification email in production:', mailErr);
      }
    }

    res.json({
      message: 'A fresh verification token has been generated and dispatched.',
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
});

// --- DEV QUICK VERIFY HELPER (Allows instant verification in dev mode) ---
router.post('/quick-verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const updatedUser = await db.updateUser(user.id, {
    emailVerified: true,
  });

  res.json({
    message: 'Email successfully verified.',
    user: updatedUser
      ? {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          tier: updatedUser.tier,
          subscriptionStatus: updatedUser.subscriptionStatus,
          emailVerified: updatedUser.emailVerified,
        }
      : null,
  });
});

// --- FORGOT PASSWORD: REQUEST RESET TOKEN ---
router.post('/forgot-password', passwordResetRateLimiter, async (req, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please enter your registered email address.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);

    if (user) {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      await db.createPasswordResetToken(user.id, rawResetToken);

      try {
        await mailer.sendPasswordResetEmail(user.email, rawResetToken);
      } catch (mailErr) {
        const config = validateAndGetConfig();
        if (config.isProduction) {
          console.error('Failed to send password reset email in production:', mailErr);
        }
      }
    }

    // Generic response protects against account enumeration
    res.json({
      message: 'If an account exists with that email address, password reset instructions have been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// --- RESET PASSWORD: APPLY NEW PASSWORD WITH ARGON2ID & SESSION REVOCATION ---
router.post('/reset-password', passwordResetRateLimiter, async (req, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Password reset token is required.' });
      return;
    }

    // Strict validation of new password
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      res.status(400).json({
        error: validation.feedback[0] || 'Password does not meet enterprise security requirements.',
        feedback: validation.feedback,
      });
      return;
    }

    // Hash new password using Argon2id
    const { hash } = await hashPassword(newPassword);

    // Atomically reset password, mark token used, and delete all sessions
    const result = await db.resetPasswordWithToken(token.trim(), hash);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Invalid or expired password reset link.' });
      return;
    }

    // Clear session cookie if any
    res.clearCookie('session_id', { path: '/' });
    res.clearCookie('session_token', { path: '/' });

    res.json({
      message: 'Password successfully updated. All active sessions have been invalidated. Please sign in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// --- SERVER-AUTHORITATIVE SUBSCRIPTION STATUS ---
router.get('/subscription-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  res.json({
    tier: user.tier || 'free',
    status: user.subscriptionStatus || 'none',
    aiCreditsRemaining: user.aiCreditsRemaining ?? 50,
    aiCreditsTotal: user.aiCreditsTotal ?? 50,
    serverAuthorized: true,
    capabilities: {
      proCadTools: user.tier === 'pro' || user.tier === 'enterprise',
      highPrecisionDxfExport: user.tier === 'pro' || user.tier === 'enterprise',
      aiFloorplanGeneration: user.tier === 'pro' || user.tier === 'enterprise',
      cloudTeamCollaboration: user.tier === 'enterprise',
    },
  });
});

// --- LOGOUT: COOKIE CLEAR + DATABASE SESSION INVALIDATE ---
router.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId =
    req.sessionId ||
    req.cookies?.['session_id'] ||
    req.cookies?.['session_token'] ||
    (req.headers['x-session-id'] as string);

  if (sessionId) {
    await db.deleteSession(sessionId).catch(() => {});
  }

  res.clearCookie('session_id', { path: '/' });
  res.clearCookie('session_token', { path: '/' });
  res.json({ message: 'Signed out securely.' });
});

export default router;
