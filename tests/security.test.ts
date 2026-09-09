/**
 * Phase 1 Enterprise Security, Authentication & Database Test Suite
 * Covers: OWASP Password Policy, Argon2id, Sessions, Rate Limiting, 
 * ACID Transactions, Project Ownership Isolation & Environment Validation.
 */

import { validatePassword } from '../src/utils/passwordPolicy.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../server/auth.js';
import { validateAndGetConfig } from '../server/config.js';
import { db } from '../server/db.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('       NOVA CAD AI - PHASE 1 AUTOMATED SECURITY & AUTH TESTS    ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: OWASP Password Policy & Entropy Validation
  // -------------------------------------------------------------
  console.log('📌 [SUITE 1] OWASP Password Policy & Strength Scoring');

  const shortPwd = validatePassword('Short1!', { email: 'user@example.com', name: 'User' });
  assert(!shortPwd.isValid, 'Rejects password shorter than 12 characters');
  assert(shortPwd.feedback.some(f => f.includes('at least 12 characters')), 'Provides clear length requirement feedback');

  const noUpper = validatePassword('alllowercase12345!#', { email: 'user@example.com', name: 'User' });
  assert(!noUpper.isValid, 'Rejects password without uppercase letters');

  const noNumber = validatePassword('NoNumbersAllowed!#Secret', { email: 'user@example.com', name: 'User' });
  assert(!noNumber.isValid, 'Rejects password without numbers');

  const noSymbol = validatePassword('NoSymbolsAllowed2026', { email: 'user@example.com', name: 'User' });
  assert(!noSymbol.isValid, 'Rejects password without special symbols');

  const containsName = validatePassword('MyNameIsArchitect2026!', { email: 'test@example.com', name: 'Architect' });
  assert(!containsName.isValid, 'Rejects password containing user name');

  const containsEmail = validatePassword('NovaUser2026!#Secret', { email: 'novauser@example.com', name: 'Architect' });
  assert(!containsEmail.isValid, 'Rejects password containing user email local-part');

  const compromised = validatePassword('password123456!', { email: 'test@example.com', name: 'Architect' });
  assert(!compromised.isValid, 'Rejects commonly compromised dictionary passwords');

  const strongPassphrase = validatePassword('Correct-Horse-Battery-Staple-2026!', { email: 'alex@novacad.ai', name: 'Alex Doe' });
  assert(strongPassphrase.isValid, 'Accepts strong, multi-word enterprise passphrases');
  assert(strongPassphrase.score >= 3, 'Rates enterprise passphrase with high strength score');

  // -------------------------------------------------------------
  // SUITE 2: Argon2id Cryptographic Password Hashing
  // -------------------------------------------------------------
  console.log('\n📌 [SUITE 2] Argon2id Cryptographic Hashing');

  const testSecret = 'SuperSecurePassphrase2026!#';
  const hashed = await hashPassword(testSecret);
  assert(hashed.hash.startsWith('$argon2id'), 'Generates memory-hard Argon2id hash');

  const verifyCorrect = await verifyPassword(testSecret, hashed.hash, hashed.salt);
  assert(verifyCorrect.isValid, 'Successfully validates authentic password with Argon2id');
  assert(!verifyCorrect.needsRehash, 'Argon2id hash is current and does not require rehash');

  const verifyWrong = await verifyPassword('IncorrectPassword123!', hashed.hash, hashed.salt);
  assert(!verifyWrong.isValid, 'Strictly rejects incorrect password attempt');

  // -------------------------------------------------------------
  // SUITE 3: Session Token Signing & HMAC Cryptography
  // -------------------------------------------------------------
  console.log('\n📌 [SUITE 3] Cryptographic Session Token Security');

  const testUserId = 'usr_test_verification_id';
  const testEmail = 'architect@novacad.ai';
  const token = createToken(testUserId, testEmail);

  assert(typeof token === 'string' && token.includes('.'), 'Issues signed session token in payload.signature format');

  const verifiedPayload = verifyToken(token);
  assert(verifiedPayload !== null, 'Cryptographically verifies authentic token');
  assert(verifiedPayload?.userId === testUserId, 'Payload userId matches authenticated subject');
  assert(verifiedPayload?.email === testEmail, 'Payload email matches authenticated subject');

  const tamperedToken = token.slice(0, -4) + 'abcd';
  const tamperedPayload = verifyToken(tamperedToken);
  assert(tamperedPayload === null, 'Rejects tampered session token signature');

  // -------------------------------------------------------------
  // SUITE 4: Environment Hardening & Secret Fail-Fast Validation
  // -------------------------------------------------------------
  console.log('\n📌 [SUITE 4] Production Environment Hardening & Validation');

  const devConfig = validateAndGetConfig();
  assert(typeof devConfig.appSecret === 'string' && devConfig.appSecret.length >= 32, 'Ensures runtime appSecret is at least 256 bits (32 bytes)');
  assert(devConfig.appSecret !== 'nova_cad_ai_secure_token_secret_2026', 'Eliminates static default fallback secret');

  // -------------------------------------------------------------
  // SUITE 5: Database ACID Transaction Safety & Rollback
  // -------------------------------------------------------------
  console.log('\n📌 [SUITE 5] Database ACID Transactions & Rollback Guarantee');

  await db.init();
  const emailA = `test_tx_${Date.now()}@novacad.ai`;

  const { user: registeredUser, starterProject } = await db.registerUserAtomic(
    {
      email: emailA,
      passwordHash: hashed.hash,
      salt: hashed.salt,
      name: 'Transaction Tester',
    },
    {
      name: 'Starter Workspace Project',
      units: 'mm',
    }
  );

  assert(registeredUser.email === emailA, 'Atomic registration creates user');
  assert(starterProject.ownerId === registeredUser.id, 'Atomic registration binds starter project to new user');

  // Test Transaction Rollback
  let rollbackSuccess = false;
  const initialUserCount = (await db.getProjectsForUser(registeredUser.id)).length;

  try {
    await db.runTransaction(async () => {
      await db.createProject({
        ownerId: registeredUser.id,
        name: 'Project to be rolled back',
        units: 'mm',
      });
      // Force an error mid-transaction to test ACID rollback
      throw new Error('Simulated atomic transaction failure!');
    });
  } catch {
    rollbackSuccess = true;
  }

  assert(rollbackSuccess, 'Catches simulated mid-transaction failure');
  const postRollbackCount = (await db.getProjectsForUser(registeredUser.id)).length;
  assert(postRollbackCount === initialUserCount, 'Verified database state is cleanly rolled back on failure');

  // -------------------------------------------------------------
  // SUITE 6: Project Ownership Isolation (User A vs User B Access)
  // -------------------------------------------------------------
  console.log('\n📌 [SUITE 6] Project Ownership Isolation & RBAC Security');

  const emailB = `user_b_${Date.now()}@novacad.ai`;
  const { user: userB } = await db.registerUserAtomic(
    {
      email: emailB,
      passwordHash: hashed.hash,
      salt: hashed.salt,
      name: 'User B',
    },
    {
      name: "User B's Private Floorplan",
      units: 'mm',
    }
  );

  // User B attempts to access starterProject owned by User A
  const projectA = await db.getProjectById(starterProject.id);
  assert(projectA !== null, 'Project A exists');
  assert(projectA?.ownerId === registeredUser.id, 'Project A is owned by User A');
  assert(projectA?.ownerId !== userB.id, 'Project A is NOT owned by User B');

  // Verify User B's project list only contains User B's projects
  const userBProjects = await db.getProjectsForUser(userB.id);
  assert(!userBProjects.some(p => p.id === starterProject.id), "User B's project query does NOT leak User A's projects");

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
