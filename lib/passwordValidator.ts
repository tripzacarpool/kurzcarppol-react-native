/**
 * Password Validation Utilities
 *
 * Helps validate passwords locally before submission to Clerk
 * This provides better UX by catching weak passwords early
 */

export interface PasswordStrength {
  score: number; // 0-5
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
  isValid: boolean;
}

export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,
};

// Common weak passwords to check against
const COMMON_PASSWORDS = [
  'password',
  '12345678',
  'qwerty',
  'abc123',
  'password123',
  '123456',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'password1',
  'asdfgh',
  'passw0rd',
  'qwertyuiop',
  '1234567890',
  'iloveyou',
];

/**
 * Check if password is too common
 */
export function isCommonPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some(
    (common) => lowerPassword === common || lowerPassword.includes(common),
  );
}

/**
 * Validate password against security requirements
 */
export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (!password || password.length === 0) {
    return {
      score: 0,
      level: 'very-weak',
      feedback: ['Password is required'],
      isValid: false,
    };
  }

  if (password.length < PASSWORD_RULES.MIN_LENGTH) {
    feedback.push(
      `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters (current: ${password.length})`,
    );
  } else {
    score += 1;
  }

  if (password.length >= PASSWORD_RULES.MAX_LENGTH) {
    feedback.push(
      `Password cannot exceed ${PASSWORD_RULES.MAX_LENGTH} characters`,
    );
  } else if (password.length >= 12) {
    score += 0.5; // Bonus for longer password
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    feedback.push('Include uppercase letters (A-Z)');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    feedback.push('Include lowercase letters (a-z)');
  } else {
    score += 1;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    feedback.push('Include numbers (0-9)');
  } else {
    score += 1;
  }

  // Special character check
  if (!/ [!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Include special characters (!@#$%^&*)');
  } else {
    score += 1;
  }

  // Common password check
  if (isCommonPassword(password)) {
    feedback.push('This password is too common. Please use a unique password');
    score = Math.max(0, score - 2);
  }

  // No repeat characters (more than 3 in a row)
  if (/(.)\1{3,}/.test(password)) {
    feedback.push('Avoid repeating the same character more than 3 times');
    score = Math.max(0, score - 1);
  }

  // Determine level
  let level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  if (score < 1.5) {
    level = 'very-weak';
  } else if (score < 2.5) {
    level = 'weak';
  } else if (score < 3.5) {
    level = 'fair';
  } else if (score < 4.5) {
    level = 'good';
  } else {
    level = 'strong';
  }

  // Determine if valid (must have minimum all requirements)
  const isValid =
    password.length >= PASSWORD_RULES.MIN_LENGTH &&
    password.length <= PASSWORD_RULES.MAX_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    !/(.)\1{3,}/.test(password);

  return {
    score: Math.min(5, Math.max(0, score)),
    level,
    feedback: feedback.length > 0 ? feedback : ['✓ Password looks strong!'],
    isValid,
  };
}

/**
 * Get a visual representation of password strength
 */
export function getPasswordStrengthVisual(strength: PasswordStrength): string {
  const levelEmojis = {
    'very-weak': '🔴',
    weak: '🟠',
    fair: '🟡',
    good: '🟢',
    strong: '💚',
  };

  const bars =
    '█'.repeat(Math.round(strength.score)) +
    '░'.repeat(5 - Math.round(strength.score));
  return `${levelEmojis[strength.level]} ${bars} ${strength.level.toUpperCase()}`;
}

/**
 * Check if passwords match
 */
export function passwordsMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword && password.length > 0;
}

/**
 * Validate both password and confirmation
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string,
): { isValid: boolean; message: string } {
  if (!password || password.length === 0) {
    return { isValid: false, message: 'Password is required' };
  }

  if (!confirmPassword || confirmPassword.length === 0) {
    return { isValid: false, message: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match' };
  }

  const strength = validatePassword(password);
  if (!strength.isValid) {
    return { isValid: false, message: strength.feedback.join('\n') };
  }

  return { isValid: true, message: '' };
}

/**
 * Get all password validation tips
 */
export function getPasswordValidationTips(): string[] {
  return [
    '✓ Use at least 8 characters (preferably 12+)',
    '✓ Include uppercase letters (A-Z)',
    '✓ Include lowercase letters (a-z)',
    '✓ Include numbers (0-9)',
    '✓ Include special characters (!@#$%^&*)',
    '✓ Avoid passwords found in data breaches (Clerk checks this)',
    '✓ Avoid common words and phrases',
    '✓ Avoid using personal information (name, birthdate, etc)',
    '✓ Never reuse passwords across different services',
    '✓ Use a password manager to create and store strong passwords',
  ];
}
