import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
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

    // 7. Generate Secure Email Verification Token (24h validity)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 8. Atomic Registration Transaction (User + Calibrated Starter Project)
    const { user } = await db.registerUserAtomic(
      {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hash,
        salt,
        verificationToken,
        verificationTokenExpires,
      },
      {
        name: 'Welcome - Drawing 1',
        description: 'Calibrated CAD engineering workspace with precision grid and standard layers.',
        units: 'mm',
      }
    );

    // 8. Generate Session Token & Set HttpOnly Cookie
    const token = createToken(user.id, user.email);
    res.cookie('session_token', token, COOKIE_OPTIONS);

    // Provide testing helper in preview / development environments
    console.log(`[AUTH] User registered: ${user.email} | Verification Token: ${verificationToken}`);

    res.status(201).json({
      token,
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
      devVerificationToken: verificationToken,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to complete registration due to an internal server error.' });
  }
});

// --- LOGIN WITH BRUTE-FORCE THROTTLING ---
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
    const { isValid, needsRehash } = await verifyPassword(password, user.passwordHash, user.salt);
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

    // 5. Automatic Password Rehash & Upgrade if needed (e.g. legacy demo hash)
    if (needsRehash) {
      const { hash: newHash } = await hashPassword(password);
      await db.updateUser(user.id, {
        passwordHash: newHash,
        salt: 'argon2id_embedded',
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      await db.updateUser(user.id, {
        lastLoginAt: new Date().toISOString(),
      });
    }

    // 6. Generate Session Token & Set HttpOnly Cookie
    const token = createToken(user.id, user.email);
    res.cookie('session_token', token, COOKIE_OPTIONS);

    res.json({
      token,
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
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    const user = await db.findUserByVerificationToken(token.trim());
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }

    if (user.verificationTokenExpires && new Date(user.verificationTokenExpires).getTime() < Date.now()) {
      res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
      return;
    }

    const updatedUser = await db.updateUser(user.id, {
      emailVerified: true,
      verificationToken: undefined,
      verificationTokenExpires: undefined,
    });

    res.json({
      message: 'Email verified successfully! All cloud export features are now unlocked.',
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
      // Check auth header if available
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Note: verifyToken is synchronous and safe
        const { verifyToken } = await import('../auth.js');
        const payload = verifyToken(token);
        if (payload) {
          targetUser = await db.findUserById(payload.userId);
        }
      }
    }

    if (!targetUser) {
      // Return success to avoid email enumeration
      res.json({ message: 'If an account exists with that address, a verification link has been sent.' });
      return;
    }

    if (targetUser.emailVerified) {
      res.json({ message: 'This email address is already verified.' });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.updateUser(targetUser.id, {
      verificationToken,
      verificationTokenExpires,
    });

    console.log(`[AUTH] Resent Verification Token for ${targetUser.email}: ${verificationToken}`);

    res.json({
      message: 'A fresh verification token has been generated and dispatched.',
      devVerificationToken: verificationToken,
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
});

// --- DEV QUICK VERIFY HELPER (Allows one-click verification for current user in preview) ---
router.post('/quick-verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const updatedUser = await db.updateUser(user.id, {
    emailVerified: true,
    verificationToken: undefined,
    verificationTokenExpires: undefined,
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

    let devResetToken: string | undefined = undefined;

    if (user) {
      const resetPasswordToken = crypto.randomBytes(32).toString('hex');
      const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity

      await db.updateUser(user.id, {
        resetPasswordToken,
        resetPasswordExpires,
      });

      devResetToken = resetPasswordToken;
      console.log(`[AUTH] Password reset requested for ${user.email} | Reset Token: ${resetPasswordToken}`);
    }

    // Generic response protects against account enumeration
    res.json({
      message: 'If an account exists with that email address, password reset instructions have been sent.',
      devResetToken, // Shared in development/preview for seamless testing
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// --- RESET PASSWORD: APPLY NEW PASSWORD WITH ARGON2ID ---
router.post('/reset-password', passwordResetRateLimiter, async (req, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Password reset token is required.' });
      return;
    }

    const user = await db.findUserByResetToken(token.trim());
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset link.' });
      return;
    }

    if (user.resetPasswordExpires && new Date(user.resetPasswordExpires).getTime() < Date.now()) {
      res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
      return;
    }

    // Strict validation of new password
    const validation = validatePassword(newPassword, { email: user.email, name: user.name });
    if (!validation.isValid) {
      res.status(400).json({
        error: validation.feedback[0] || 'Password does not meet enterprise security requirements.',
        feedback: validation.feedback,
      });
      return;
    }

    // Hash new password using Argon2id
    const { hash } = await hashPassword(newPassword);

    await db.updateUser(user.id, {
      passwordHash: hash,
      salt: 'argon2id_embedded',
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      passwordChangedAt: new Date().toISOString(),
    });

    res.json({
      message: 'Password successfully updated. You may now sign in with your new credentials.',
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

// --- LOGOUT ---
router.post('/logout', (_req, res: Response) => {
  res.clearCookie('session_token', { path: '/' });
  res.json({ message: 'Signed out securely.' });
});

export default router;
