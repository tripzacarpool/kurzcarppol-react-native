const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = isWindows ? 'node.exe' : 'node';

const requireProdEnv =
  process.env.REQUIRE_PROD_ENV === 'true' || process.env.NODE_ENV === 'production';

const run = (label, command, args, options = {}) => {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });

  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
};

const isMissing = (value) => !value || value.trim() === '';
const looksPlaceholder = (value) =>
  !value ||
  /your_|placeholder|example\.com|localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(value);

const assertEnv = (key, { publicKey = false, allowTest = false } = {}) => {
  const value = process.env[key];
  if (isMissing(value)) {
    throw new Error(`Missing required deployment env: ${key}`);
  }
  if (looksPlaceholder(value)) {
    throw new Error(`Deployment env ${key} still looks like a placeholder/local value`);
  }
  if (!allowTest && /(^pk_test_|^sk_test_|^rzp_test_)/i.test(value)) {
    throw new Error(`Deployment env ${key} is a test key`);
  }
  if (publicKey && !/^https?:\/\//i.test(value) && key.includes('URL')) {
    throw new Error(`Deployment env ${key} must be a URL`);
  }
};

const checkFrontendProdEnv = () => {
  assertEnv('EXPO_PUBLIC_API_URL', { publicKey: true });
  assertEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  assertEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', { allowTest: true });
  assertEnv('EXPO_PUBLIC_RAZORPAY_KEY_ID');

  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (socketUrl && looksPlaceholder(socketUrl)) {
    throw new Error('Deployment env EXPO_PUBLIC_SOCKET_URL still looks local/placeholder');
  }
};

const checkBackendProdEnv = () => {
  assertEnv('MONGODB_URI');
  assertEnv('CLERK_SECRET_KEY');
  assertEnv('CLERK_PUBLISHABLE_KEY');
  assertEnv('RAZORPAY_KEY_ID');
  assertEnv('RAZORPAY_KEY_SECRET');
  assertEnv('ALLOWED_ORIGINS');

  const allowedOrigins = process.env.ALLOWED_ORIGINS || '';
  if (allowedOrigins.includes('*')) {
    throw new Error('Deployment env ALLOWED_ORIGINS must not contain *');
  }

  const optionalUrls = ['REDIS_URL', 'MATCHING_SERVICE_URL'];
  for (const key of optionalUrls) {
    if (process.env[key] && looksPlaceholder(process.env[key])) {
      throw new Error(`Deployment env ${key} still looks local/placeholder`);
    }
  }
};

try {
  run('Frontend lint', npmCmd, ['run', 'lint']);
  run('Frontend typecheck', nodeCmd, [
    '--max-old-space-size=8192',
    './node_modules/typescript/bin/tsc',
    '--noEmit',
  ]);
  run('Backend check', npmCmd, ['--prefix', 'backend', 'run', 'check']);
  run('Matching service compile', npmCmd, ['run', 'matching:check']);

  if (requireProdEnv) {
    console.log('\n==> Production environment validation');
    checkFrontendProdEnv();
    checkBackendProdEnv();
    run('Backend production env validation', npmCmd, ['--prefix', 'backend', 'run', 'check:env'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });
  } else {
    console.log('\n==> Production environment validation skipped');
    console.log('Set REQUIRE_PROD_ENV=true to enforce production env before staging/prod deploy.');
  }

  console.log('\nDeployment readiness checks passed.');
} catch (error) {
  console.error(`\nDeployment readiness failed: ${error.message}`);
  process.exit(1);
}
