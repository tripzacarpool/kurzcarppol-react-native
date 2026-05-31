/**
 * Clerk Authentication Error Handler
 *
 * Provides user-friendly error messages for Clerk API errors
 * Handles specific error codes like form_password_pwned, weak_password, etc.
 */

export interface ClerkError {
  message?: string;
  code?: string;
  errors?: Array<{
    code: string;
    message: string;
    meta?: Record<string, any>;
  }>;
  response?: {
    data?: {
      error?: string;
      errors?: Array<{
        code: string;
        message: string;
      }>;
    };
  };
  status?: number;
}

export interface ParsedClerkError {
  errorCode: string;
  userMessage: string;
  technicalMessage: string;
  isRetryable: boolean;
  fieldName?: string;
}

/**
 * Maps Clerk error codes to user-friendly messages
 */
const ERROR_CODE_MAP: Record<
  string,
  (meta?: Record<string, any>) => { message: string; isRetryable: boolean }
> = {
  // Password errors
  form_password_pwned: () => ({
    message:
      'This password was found in a known data breach. For your security, please choose a different password. Consider using a password manager to generate a strong, unique password.',
    isRetryable: true,
  }),

  form_password_weak: () => ({
    message:
      'Your password is too weak. Please use at least 8 characters with a mix of uppercase, lowercase, numbers, and symbols.',
    isRetryable: true,
  }),

  form_password_too_common: () => ({
    message:
      'This password is too common. Please choose a more unique password that includes numbers and special characters.',
    isRetryable: true,
  }),

  form_password_invalid: () => ({
    message:
      'Password does not meet security requirements. Please use a combination of uppercase, lowercase, numbers, and symbols.',
    isRetryable: true,
  }),

  form_password_size_range: () => ({
    message: 'Password must be between 8 and 128 characters long.',
    isRetryable: true,
  }),

  // Email errors
  form_email_invalid: () => ({
    message: 'Please enter a valid email address.',
    isRetryable: true,
  }),

  form_email_exists: () => ({
    message:
      'This email is already registered. Please sign in or use a different email.',
    isRetryable: false,
  }),

  email_exists: () => ({
    message:
      'This email is already registered. Please sign in or use a different email.',
    isRetryable: false,
  }),

  // Session errors
  session_exists: () => ({
    message: 'You are already signed in. Redirecting to dashboard...',
    isRetryable: false,
  }),

  // Rate limiting
  rate_limit_exceeded: () => ({
    message:
      'Too many attempts. Please wait a few minutes before trying again.',
    isRetryable: true,
  }),

  // Verification errors
  verification_expired: () => ({
    message: 'Your verification code has expired. Please request a new one.',
    isRetryable: true,
  }),

  verification_invalid: () => ({
    message: 'Invalid verification code. Please check and try again.',
    isRetryable: true,
  }),

  // Form submission errors
  form_identifier_invalid: () => ({
    message: 'Please enter a valid email address or username.',
    isRetryable: true,
  }),

  form_param_format_invalid: () => ({
    message:
      'One or more fields contain invalid values. Please check and try again.',
    isRetryable: true,
  }),

  // OAuth errors
  oauth_provider_not_enabled: () => ({
    message: 'This sign-in method is not available. Please try another method.',
    isRetryable: false,
  }),

  // Generic/Unknown errors
  unknown: () => ({
    message: 'An error occurred during authentication. Please try again.',
    isRetryable: true,
  }),
};

/**
 * Parse Clerk error and return structured information
 * @param error - The error object from Clerk
 * @returns ParsedClerkError with user-friendly message
 */
export function parseClerkError(error: ClerkError): ParsedClerkError {
  // Extract error code and message from various possible locations
  const errorCode = error?.errors?.[0]?.code || error?.code || 'unknown';
  const errorMetadata = error?.errors?.[0]?.meta;
  const technicalMessage =
    error?.errors?.[0]?.message ||
    error?.message ||
    error?.response?.data?.error ||
    'Unknown error occurred';

  // Get mapped message or use technical message as fallback
  const mapping = ERROR_CODE_MAP[errorCode] || ERROR_CODE_MAP.unknown;
  const { message: userMessage, isRetryable } = mapping(errorMetadata);

  // Extract field name if available
  const fieldName = errorMetadata?.param_name || 'form';

  return {
    errorCode,
    userMessage,
    technicalMessage,
    isRetryable,
    fieldName,
  };
}

/**
 * Format Clerk error for display to user
 * @param error - The error object from Clerk
 * @returns User-friendly error message
 */
export function formatClerkError(error: ClerkError): string {
  const parsed = parseClerkError(error);
  return parsed.userMessage;
}

/**
 * Check if error is a password-related error
 */
export function isPasswordError(error: ClerkError): boolean {
  const errorCode = error?.errors?.[0]?.code || error?.code || '';
  return errorCode.startsWith('form_password_');
}

/**
 * Check if error is retryable (user can fix and retry)
 */
export function isRetryableError(error: ClerkError): boolean {
  const parsed = parseClerkError(error);
  return parsed.isRetryable;
}

/**
 * Get password strength recommendations
 */
export function getPasswordStrengthTips(): string[] {
  return [
    '✓ Use at least 8 characters (preferably 12+)',
    '✓ Include uppercase letters (A-Z)',
    '✓ Include lowercase letters (a-z)',
    '✓ Include numbers (0-9)',
    '✓ Include special characters (!@#$%^&*)',
    '✓ Avoid common words and phrases',
    '✓ Avoid using personal information',
    '✓ Use a password manager to generate strong passwords',
  ];
}

/**
 * Handle specific error codes with custom logic
 */
export function handleSpecialCases(error: ClerkError): {
  shouldSignOut: boolean;
  redirectPath?: string;
} {
  const errorCode = error?.errors?.[0]?.code || error?.code;

  // Check if we need to sign out
  if (errorCode === 'session_exists') {
    return { shouldSignOut: false, redirectPath: '/(tabs)' };
  }

  // Email conflict - may need to sign out
  if (errorCode === 'email_exists' || errorCode === 'form_email_exists') {
    return { shouldSignOut: false, redirectPath: '/(auth)/login' };
  }

  return { shouldSignOut: false };
}
