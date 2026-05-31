const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendRoot = path.join(root, 'backend');
const backendSrc = path.join(root, 'backend', 'src');

const readFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !['node_modules', '__pycache__', '.venv'].includes(entry.name)
    ) {
      return readFiles(fullPath);
    }
    if (entry.isDirectory()) return [];
    return entry.isFile() && fullPath.endsWith('.js') ? [fullPath] : [];
  });
};

const relative = (file) => path.relative(root, file).replace(/\\/g, '/');
const failures = [];

const assertNoMatch = (file, pattern, message) => {
  const text = fs.readFileSync(file, 'utf8');
  if (pattern.test(text)) {
    failures.push(`${relative(file)}: ${message}`);
  }
};

for (const file of readFiles(backendSrc)) {
  const rel = relative(file);

  if (
    (rel.includes('/services/') ||
      rel.includes('/jobs/')) &&
    !rel.endsWith('/routes/index.js')
  ) {
    assertNoMatch(
      file,
      /from ['"].*controllers\/|from ['"]\.\.\/controllers|import\(['"].*controllers\//,
      'infrastructure/service modules must not import HTTP controllers',
    );
  }

  if (rel.includes('/services/') || rel.includes('/jobs/')) {
    assertNoMatch(
      file,
      /from ['"].*(realtime\/socket|socket\.io)|from ['"]socket\.io['"]/,
      'services/jobs must use realtimeBus instead of realtime transport',
    );
  }

  if (rel.includes('/controllers/') && !rel.endsWith('/healthController.js')) {
    assertNoMatch(
      file,
      /from ['"].*(config\/models|models\/)|from ['"]mongoose['"]|from ['"]expo-server-sdk['"]|shared\/events\/event(Bus|Types)/,
      'controllers must not own models, SDK clients, or event bus contracts',
    );
    assertNoMatch(
      file,
      /const getClerkUserId|function getClerkUserId|getClerkUserId\s*=/,
      'controllers must use middleware/clerkAuth.js for Clerk user extraction',
    );
  }

  if (
    rel.includes('/controllers/') &&
    !rel.endsWith('/healthController.js')
  ) {
    assertNoMatch(
      file,
      /from ['"].*(realtime\/|pushNotificationService)|getRealtimeServer|sendPushTo(Token|Users|UsersByRole)/,
      'controllers must delegate realtime and push side effects to services',
    );
  }

  if (!rel.endsWith('/config/env.js') && !rel.endsWith('/loadEnv.js')) {
    assertNoMatch(
      file,
      /process\.env/,
      'runtime configuration must be read through config/env.js',
    );
  }

  assertNoMatch(
    file,
    /rzp_test_|key_secret:\s*['"][^'"]+|RAZORPAY_KEY_SECRET\s*\|\|/,
    'payment credentials must be environment-only with no fallback secrets',
  );

  assertNoMatch(
    file,
    /Access-Control-Allow-Origin['"],\s*['"]\*|origin:\s*['"]\*['"]/,
    'wildcard CORS must not be reintroduced',
  );
}

for (const file of readFiles(backendRoot)) {
  const rel = relative(file);
  if (
    rel.endsWith('/src/config/env.js') ||
    rel.endsWith('/src/loadEnv.js') ||
    rel.endsWith('/scripts/check-env.js') ||
    rel.endsWith('/scripts/smoke-error-handler.js')
  ) {
    continue;
  }

  assertNoMatch(
    file,
    /process\.env/,
    'backend modules and maintenance scripts must read runtime configuration through config/env.js',
  );

  assertNoMatch(
    file,
    /mongodb:\/\/localhost|MONGODB_URI\s*\|\|/,
    'maintenance scripts must not define local MongoDB fallback URIs',
  );
}

if (failures.length > 0) {
  console.error('Backend architecture guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Backend architecture guard passed');
