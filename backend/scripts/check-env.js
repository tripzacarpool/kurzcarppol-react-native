import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const envModuleUrl = pathToFileURL(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src/config/env.js'),
).toString();

const originalEnv = { ...process.env };

const applyEnv = (values) => {
  process.env = { ...originalEnv };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const validateWithEnv = async (name, values) => {
  applyEnv(values);
  const { validateRequiredEnv } = await import(`${envModuleUrl}?case=${name}`);
  validateRequiredEnv();
};

try {
  await validateWithEnv('missing-dev', {
    NODE_ENV: 'development',
    MONGODB_URI: undefined,
  });
  console.error('Expected development env validation to require MONGODB_URI');
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENV_VALIDATION_FAILED' || !error.message.includes('MONGODB_URI')) {
    console.error('Unexpected development env validation result');
    console.error(error);
    process.exit(1);
  }
}

try {
  await validateWithEnv('production-ok', {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://localhost:27017/tripza',
    CLERK_SECRET_KEY: 'sk_test_placeholder',
    CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
    RAZORPAY_KEY_ID: 'rzp_test_placeholder',
    RAZORPAY_KEY_SECRET: 'secret_placeholder',
    ALLOWED_ORIGINS: 'https://example.com',
    PORT: '5000',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX: '300',
    MATCHING_SERVICE_TIMEOUT_MS: '1500',
    MONGODB_MAX_POOL_SIZE: '10',
    MONGODB_MIN_POOL_SIZE: '2',
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: '10000',
    MONGODB_SOCKET_TIMEOUT_MS: '45000',
  });
} catch (error) {
  console.error('Expected complete production env validation to pass');
  console.error(error);
  process.exit(1);
}

try {
  await validateWithEnv('production-wildcard-origin', {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://localhost:27017/tripza',
    CLERK_SECRET_KEY: 'sk_test_placeholder',
    CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
    RAZORPAY_KEY_ID: 'rzp_test_placeholder',
    RAZORPAY_KEY_SECRET: 'secret_placeholder',
    ALLOWED_ORIGINS: '*',
  });
  console.error('Expected production env validation to reject wildcard origin');
  process.exit(1);
} catch (error) {
  if (
    error.code !== 'ENV_VALIDATION_FAILED' ||
    !error.message.includes('ALLOWED_ORIGINS must not contain *')
  ) {
    console.error('Unexpected wildcard origin validation result');
    console.error(error);
    process.exit(1);
  }
}

try {
  await validateWithEnv('invalid-origin', {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://localhost:27017/tripza',
    ALLOWED_ORIGINS: 'not-a-url',
  });
  console.error('Expected env validation to reject invalid origin');
  process.exit(1);
} catch (error) {
  if (
    error.code !== 'ENV_VALIDATION_FAILED' ||
    !error.message.includes('ALLOWED_ORIGINS contains invalid origin')
  ) {
    console.error('Unexpected invalid origin validation result');
    console.error(error);
    process.exit(1);
  }
}

try {
  await validateWithEnv('matching-required-missing-url', {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://localhost:27017/tripza',
    MATCHING_SERVICE_REQUIRED: 'true',
    MATCHING_SERVICE_URL: undefined,
  });
  console.error('Expected env validation to require matching service URL');
  process.exit(1);
} catch (error) {
  if (
    error.code !== 'ENV_VALIDATION_FAILED' ||
    !error.message.includes('MATCHING_SERVICE_URL is required')
  ) {
    console.error('Unexpected matching service required validation result');
    console.error(error);
    process.exit(1);
  }
} finally {
  process.env = originalEnv;
}

console.log('Backend env validation smoke passed');
