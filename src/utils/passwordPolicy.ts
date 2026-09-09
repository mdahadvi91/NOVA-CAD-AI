export interface PasswordCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 4
  strengthLabel: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: PasswordCheck[];
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

  // Check common compromised dictionary passwords
  const lowerPwd = pwd.toLowerCase();
  const isCommon = COMMON_COMPROMISED_PASSWORDS.has(lowerPwd);

  // Check repeating characters (e.g. aaaaa or 1111)
  const hasRepeatingChars = /(.)\1{3,}/.test(pwd);

  // Check if password contains email username or user name
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

  const checks: PasswordCheck[] = [
    {
      id: 'length',
      label: 'At least 12 characters long',
      passed: hasMinLength && hasMaxLength,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      passed: hasUppercase,
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      passed: hasLowercase,
    },
    {
      id: 'digit',
      label: 'At least one number (0-9)',
      passed: hasDigit,
    },
    {
      id: 'special',
      label: 'At least one special symbol (!@#$%^&*)',
      passed: hasSpecial,
    },
    {
      id: 'not-compromised',
      label: 'Not a common or repetitive password',
      passed: !isCommon && !hasRepeatingChars && !containsUserInfo,
    },
  ];

  // Calculate score (0 to 4)
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

  let strengthLabel: PasswordValidationResult['strengthLabel'] = 'Very Weak';
  if (score === 1) strengthLabel = 'Weak';
  else if (score === 2) strengthLabel = 'Fair';
  else if (score === 3) strengthLabel = 'Good';
  else if (score === 4) strengthLabel = 'Strong';

  if (!hasMinLength) {
    feedback.push('Password must be at least 12 characters.');
  }
  if (!hasUppercase) {
    feedback.push('Include at least one uppercase letter.');
  }
  if (!hasLowercase) {
    feedback.push('Include at least one lowercase letter.');
  }
  if (!hasDigit) {
    feedback.push('Include at least one numeric digit.');
  }
  if (!hasSpecial) {
    feedback.push('Include at least one symbol or special character.');
  }
  if (isCommon) {
    feedback.push('This password is too common or easily guessed.');
  }
  if (hasRepeatingChars) {
    feedback.push('Avoid repeating characters in sequence.');
  }
  if (containsUserInfo) {
    feedback.push('Password cannot contain your name or email.');
  }

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

  return {
    isValid,
    score,
    strengthLabel,
    checks,
    feedback,
  };
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // RFC 5322 compliant regex for web applications
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 254;
}
