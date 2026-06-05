const parseList = (value, fallback = []) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;

const isValidOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isPm2Run: process.env.pm_id !== undefined,
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB || 'tripzaapp',
  mongodbMaxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
  mongodbMinPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),
  mongodbServerSelectionTimeoutMs: Number(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000,
  ),
  mongodbSocketTimeoutMs: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
  allowedOrigins: parseList(rawAllowedOrigins, [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ]),
  hasExplicitAllowedOrigins: Boolean(rawAllowedOrigins),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  trustProxy: process.env.TRUST_PROXY === 'true',
  enableBackgroundTasks: process.env.ENABLE_BACKGROUND_TASKS !== 'false',
  serverShutdownTimeoutMs: Number(process.env.SERVER_SHUTDOWN_TIMEOUT_MS || 10000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  kafkaBrokers: parseList(process.env.KAFKA_BROKERS),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'tripza-api',
  kafkaHealthTimeoutMs: Number(process.env.KAFKA_HEALTH_TIMEOUT_MS || 8000),
  eventBusStrict: process.env.EVENT_BUS_STRICT === 'true',
  eventBusConnectTimeoutMs: Number(process.env.EVENT_BUS_CONNECT_TIMEOUT_MS || 1500),
  redisUrl: process.env.REDIS_URL,
  matchingServiceUrl: process.env.MATCHING_SERVICE_URL,
  matchingServiceRequired: process.env.MATCHING_SERVICE_REQUIRED === 'true',
  matchingServiceTimeoutMs: Number(process.env.MATCHING_SERVICE_TIMEOUT_MS || 1500),
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  approvalPendingWindowMinutes:
    process.env.NODE_ENV === 'production'
      ? 5
      : Number(process.env.APPROVAL_PENDING_WINDOW_MINUTES || 30),
};

export const isDevelopment = env.nodeEnv === 'development';
export const isProduction = env.nodeEnv === 'production';

export function validateRequiredEnv() {
  const missing = [];
  const invalid = [];

  if (!env.mongodbUri) {
    missing.push('MONGODB_URI');
  }

  if (isProduction) {
    if (!env.clerkSecretKey) missing.push('CLERK_SECRET_KEY');
    if (!env.clerkPublishableKey) missing.push('CLERK_PUBLISHABLE_KEY');
    if (!env.razorpayKeyId) missing.push('RAZORPAY_KEY_ID');
    if (!env.razorpayKeySecret) missing.push('RAZORPAY_KEY_SECRET');
    if (!env.hasExplicitAllowedOrigins) missing.push('ALLOWED_ORIGINS');
    if (env.allowedOrigins.includes('*')) {
      invalid.push('ALLOWED_ORIGINS must not contain * in production');
    }
  }

  const invalidOrigins = env.allowedOrigins.filter(
    (origin) => origin !== '*' && !isValidOrigin(origin),
  );
  if (invalidOrigins.length > 0) {
    invalid.push(`ALLOWED_ORIGINS contains invalid origin(s): ${invalidOrigins.join(', ')}`);
  }

  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    invalid.push('PORT must be a valid TCP port');
  }

  if (
    !Number.isFinite(env.rateLimitWindowMs) ||
    env.rateLimitWindowMs < 1000
  ) {
    invalid.push('RATE_LIMIT_WINDOW_MS must be at least 1000');
  }

  if (!Number.isFinite(env.rateLimitMax) || env.rateLimitMax < 1) {
    invalid.push('RATE_LIMIT_MAX must be at least 1');
  }

  if (
    !Number.isFinite(env.serverShutdownTimeoutMs) ||
    env.serverShutdownTimeoutMs < 1000
  ) {
    invalid.push('SERVER_SHUTDOWN_TIMEOUT_MS must be at least 1000');
  }

  if (
    !Number.isFinite(env.matchingServiceTimeoutMs) ||
    env.matchingServiceTimeoutMs < 100
  ) {
    invalid.push('MATCHING_SERVICE_TIMEOUT_MS must be at least 100');
  }

  if (env.matchingServiceRequired && !env.matchingServiceUrl) {
    invalid.push('MATCHING_SERVICE_URL is required when MATCHING_SERVICE_REQUIRED=true');
  }

  if (!Number.isFinite(env.mongodbMaxPoolSize) || env.mongodbMaxPoolSize < 1) {
    invalid.push('MONGODB_MAX_POOL_SIZE must be at least 1');
  }

  if (!Number.isFinite(env.mongodbMinPoolSize) || env.mongodbMinPoolSize < 0) {
    invalid.push('MONGODB_MIN_POOL_SIZE must be at least 0');
  }

  if (env.mongodbMinPoolSize > env.mongodbMaxPoolSize) {
    invalid.push('MONGODB_MIN_POOL_SIZE must be less than or equal to MONGODB_MAX_POOL_SIZE');
  }

  if (
    !Number.isFinite(env.mongodbServerSelectionTimeoutMs) ||
    env.mongodbServerSelectionTimeoutMs < 1000
  ) {
    invalid.push('MONGODB_SERVER_SELECTION_TIMEOUT_MS must be at least 1000');
  }

  if (
    !Number.isFinite(env.mongodbSocketTimeoutMs) ||
    env.mongodbSocketTimeoutMs < 1000
  ) {
    invalid.push('MONGODB_SOCKET_TIMEOUT_MS must be at least 1000');
  }

  if (
    !Number.isFinite(env.approvalPendingWindowMinutes) ||
    env.approvalPendingWindowMinutes < 1
  ) {
    invalid.push('APPROVAL_PENDING_WINDOW_MINUTES must be at least 1');
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
    error.code = 'ENV_VALIDATION_FAILED';
    throw error;
  }

  if (invalid.length > 0) {
    const error = new Error(`Invalid environment: ${invalid.join('; ')}`);
    error.code = 'ENV_VALIDATION_FAILED';
    throw error;
  }
}
