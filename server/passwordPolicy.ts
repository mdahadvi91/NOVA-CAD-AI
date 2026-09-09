export interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  feedback: string[];
}

const COMMON_COMPROMISED_PASSWORDS = new Set([
  'password1234',
  'password12345',
  '123456789012',
  'admin12345678',
  'qwerty123456',
  'letmein123456',
  'welcome123456',
  'novacad123456',
  'architect1234',
  'engineering12',
  'administrator',
  'iloveyou12345',
  'changeme12345',
  'passphrase123',
  'supersecret12',
]);

export function validatePassword(
  password: string,
  userContext?: { email?: string; name?: string }
): PasswordValidationResult {
  const pwd = password || '';
  const feedback: string[] = [];

  const hasMinLength = pwd.length >= 12;
  const hasMaxLength = pwd.length <= 128;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  const lowerPwd = pwd.toLowerCase();
  const isCommon = COMMON_COMPROMISED_PASSWORDS.has(lowerPwd);
  const hasRepeatingChars = /(.)\1{3,}/.test(pwd);

  let containsUserInfo = false;
  if (userContext?.email) {
    const emailPrefix = userContext.email.split('@')[0]?.toLowerCase();
    if (emailPrefix && emailPrefix.length >= 3 && lowerPwd.includes(emailPrefix)) {
      containsUserInfo = true;
    }
  }
  if (userContext?.name) {
    const nameParts = userContext.name.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length >= 3 && lowerPwd.includes(part)) {
        containsUserInfo = true;
        break;
      }
    }
  }

  let score = 0;
  if (hasMinLength) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasDigit && hasSpecial) score++;
  if (pwd.length >= 16 && !isCommon && !hasRepeatingChars && !containsUserInfo) score++;

  if (isCommon || hasRepeatingChars) {
    score = Math.min(score, 1);
  }
  if (!hasMinLength) {
    score = 0;
  }

  if (!hasMinLength) feedback.push('Password must be at least 12 characters.');
  if (pwd.length > 128) feedback.push('Password cannot exceed 128 characters.');
  if (!hasUppercase) feedback.push('Password must include at least one uppercase letter.');
  if (!hasLowercase) feedback.push('Password must include at least one lowercase letter.');
  if (!hasDigit) feedback.push('Password must include at least one number.');
  if (!hasSpecial) feedback.push('Password must include at least one special symbol.');
  if (isCommon) feedback.push('Password is too common or easily guessed.');
  if (hasRepeatingChars) feedback.push('Password cannot contain repetitive character sequences.');
  if (containsUserInfo) feedback.push('Password cannot contain your name or email.');

  const isValid =
    hasMinLength &&
    hasMaxLength &&
    hasUppercase &&
    hasLowercase &&
    hasDigit &&
    hasSpecial &&
    !isCommon &&
    !hasRepeatingChars &&
    !containsUserInfo;

  return { isValid, score, feedback };
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 254;
}
