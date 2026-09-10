/**
 * Runtime Verification Test Suite
 * Fully tests the HTTP server, cookie-based auth architecture,
 * PostgreSQL session lifecycle, production fail-fast checks, and user data isolation.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import { db } from '../server/db.js';
import authRouter from '../server/routes/auth.js';
import projectRouter from '../server/routes/projects.js';
import { getPostgresPool, resetPostgresPool } from '../server/postgresManager.js';
import type { Server } from 'http';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
  }
}

export async function runLifecycleTests(): Promise<boolean> {
  console.log('\n======================================================');
  console.log('    RUNTIME VERIFICATION & SECURITY ACCEPTANCE SUITE  ');
  console.log('======================================================\n');

  // ==========================================
  // GATE 1: Production Fail-Fast Validation
  // ==========================================
  console.log('--- GATE 1: Production DB Fail-Fast Verification ---');
  {
    const originalEnv = process.env.NODE_ENV;
    const originalDbUrl = process.env.DATABASE_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      resetPostgresPool();

      let caughtMissing = false;
      try {
        getPostgresPool();
      } catch (err: unknown) {
        caughtMissing = true;
        assert(
          err instanceof Error && err.message.includes('[SECURITY FATAL]'),
          'Missing DATABASE_URL in production throws [SECURITY FATAL] error'
        );
      }
      assert(caughtMissing, 'Production server strictly fails fast when DATABASE_URL is missing');

      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/proddb';
      resetPostgresPool();
      let caughtLocalhost = false;
      try {
        getPostgresPool();
      } catch (err: unknown) {
        caughtLocalhost = true;
        assert(
          err instanceof Error && err.message.includes('[SECURITY FATAL]'),
          'DATABASE_URL pointing to localhost in production is rejected'
        );
      }
      assert(caughtLocalhost, 'Production server strictly forbids localhost DB fallback');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalDbUrl) {
        process.env.DATABASE_URL = originalDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
      resetPostgresPool();
    }
  }

  // ==========================================
  // GATE 2: Server & Cookie Setup
  // ==========================================
  console.log('\n--- GATE 2: Full-Stack Cookie & Auth Architecture ---');
  await db.init();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectRouter);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address() as { port: number; address: string };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Register User A
    const userAEmail = `architect.a.${Date.now()}@novacad.ai`;
    const userAPassword = 'SecurePassword123!#A';

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        name: 'Architect A',
        password: userAPassword,
        confirmPassword: userAPassword,
      }),
    });

    const regData = await regRes.json();

    assert(regRes.status === 201, 'User A registration returns HTTP 201');
    assert(regData.user && regData.user.email === userAEmail, 'User A object returned in response');
    assert(!regData.token, 'Response body DOES NOT contain token');
    assert(!regData.sessionId, 'Response body DOES NOT contain sessionId');
    assert(!regData.devVerificationToken, 'Response body DOES NOT contain devVerificationToken');

    // Verify HttpOnly cookie
    const setCookieHeader = regRes.headers.get('set-cookie');
    assert(Boolean(setCookieHeader), 'set-cookie header present in response');
    const sessionCookieStr = setCookieHeader || '';
    assert(sessionCookieStr.includes('session_id='), 'Cookie name is session_id');
    assert(sessionCookieStr.toLowerCase().includes('httponly'), 'Cookie has HttpOnly flag set');
    assert(sessionCookieStr.toLowerCase().includes('samesite=lax'), 'Cookie has SameSite=Lax set');

    // Extract raw cookie for subsequent requests
    const userACookie = sessionCookieStr.split(';')[0];

    // 2. Authenticated /me endpoint
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userACookie },
    });
    const meData = await meRes.json();

    assert(meRes.status === 200, 'GET /api/auth/me with session cookie returns 200 OK');
    assert(meData.user.email === userAEmail, 'Returned authenticated user matches User A');
    assert(!meData.user.passwordHash, 'Password hash is NEVER leaked in user response');

    // 3. Unauthenticated /me endpoint
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert(unauthRes.status === 401, 'GET /api/auth/me without cookie is rejected with 401');

    // ==========================================
    // GATE 3: Project CRUD & User Isolation
    // ==========================================
    console.log('\n--- GATE 3: Project CRUD & Multi-Tenant User Isolation ---');

    // User A creates Project
    const createProjRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({
        name: "User A's Skyscraper Blueprint",
        description: 'Primary structural foundation blueprint',
        units: 'mm',
      }),
    });

    const createProjData = await createProjRes.json();
    assert(createProjRes.status === 201, "User A creates project successfully (201)");
    const userAProjectId = createProjData.project?.id;
    assert(Boolean(userAProjectId), 'Project ID generated');

    // User A reads projects
    const userAProjectsRes = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: userACookie },
    });
    const userAProjectsData = await userAProjectsRes.json();
    const userAProjects = userAProjectsData.projects;

    assert(userAProjectsRes.status === 200, 'User A retrieves their projects');
    assert(
      Array.isArray(userAProjects) && userAProjects.some((p: { id: string }) => p.id === userAProjectId),
      "User A project list contains User A's project"
    );

    // User B registers
    const userBEmail = `architect.b.${Date.now()}@novacad.ai`;
    const userBPassword = 'SecurePassword123!#B';

    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userBEmail,
        name: 'Architect B',
        password: userBPassword,
        confirmPassword: userBPassword,
      }),
    });

    assert(regBRes.status === 201, 'User B registration returns 201');
    const userBCookie = (regBRes.headers.get('set-cookie') || '').split(';')[0];

    // User B lists projects -> MUST NOT SEE USER A's PROJECT
    const userBProjectsRes = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: userBCookie },
    });
    const userBProjectsData = await userBProjectsRes.json();
    const userBProjects = userBProjectsData.projects;

    assert(Array.isArray(userBProjects), "User B projects is an array");
    const leakedProject = userBProjects.find((p: { id: string }) => p.id === userAProjectId);
    assert(!leakedProject, "Zero Data Leak: User B cannot see User A's project in project list");

    // User B attempts to directly access User A's project -> MUST BE FORBIDDEN
    const userBAccessRes = await fetch(`${baseUrl}/api/projects/${userAProjectId}`, {
      headers: { Cookie: userBCookie },
    });

    assert(
      userBAccessRes.status === 404 || userBAccessRes.status === 403,
      "Strict Permission Gate: User B direct GET on User A's project is rejected (404/403)"
    );

    // User B attempts to overwrite User A's project
    const userBUpdateRes = await fetch(`${baseUrl}/api/projects/${userAProjectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userBCookie,
      },
      body: JSON.stringify({
        name: 'Hacked Title',
      }),
    });

    assert(
      userBUpdateRes.status === 404 || userBUpdateRes.status === 403,
      "Strict Permission Gate: User B mutation attempt on User A's project is rejected (404/403)"
    );

    // ==========================================
    // GATE 4: Password Reset & Session Invalidation
    // ==========================================
    console.log('\n--- GATE 4: Password Reset & Session Invalidation ---');

    // Request password reset
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail }),
    });
    const forgotData = await forgotRes.json();

    assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returns 200 OK');
    assert(!forgotData.devResetToken, 'Forgot password response DOES NOT leak devResetToken');

    // Create known token to execute reset in DB directly
    const rawResetToken = 'KnownTestResetToken1234567890123456';
    const rawHash = (await import('crypto')).default.createHash('sha256').update(rawResetToken).digest('hex');
    const pgPool = getPostgresPool();
    await pgPool.query(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      ['reset-test-id', regData.user.id, rawHash, new Date(Date.now() + 3600000)]
    );

    const newPassword = 'BrandNewPassword456!#A';
    const applyResetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword,
      }),
    });

    assert(applyResetRes.status === 200, 'Password reset applies successfully (200)');

    // Verify prior session was invalidated
    const invalidatedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userACookie },
    });

    assert(invalidatedRes.status === 401, 'Old session cookie is strictly invalidated after password reset');

    // Login with old password must fail
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password: userAPassword }),
    });
    assert(oldLoginRes.status === 401, 'Login with old password fails');

    // Login with new password must succeed and set new session cookie
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password: newPassword }),
    });
    const newLoginData = await newLoginRes.json();

    assert(newLoginRes.status === 200, 'Login with new password succeeds (200)');
    assert(!newLoginData.token, 'New login body does not contain token');
    assert(!newLoginData.sessionId, 'New login body does not contain sessionId');

    const newSessionCookie = (newLoginRes.headers.get('set-cookie') || '').split(';')[0];

    // ==========================================
    // GATE 5: Logout & Session Deletion
    // ==========================================
    console.log('\n--- GATE 5: Logout & Session Destruction ---');

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: newSessionCookie },
    });

    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds (200)');
    const logoutCookieHeader = logoutRes.headers.get('set-cookie') || '';
    assert(
      logoutCookieHeader.includes('Expires=') || logoutCookieHeader.includes('Max-Age=0'),
      'Logout clears cookie with expiration'
    );

    // Subsequent check with logged-out cookie
    const postLogoutRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: newSessionCookie },
    });

    assert(postLogoutRes.status === 401, 'Logged out session cookie is rejected (401)');
  } finally {
    server.close();
  }

  console.log(`\nRuntime Verification Results: Passed=${passed}, Failed=${failed}\n`);
  return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLifecycleTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
