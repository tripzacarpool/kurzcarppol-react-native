const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');

const copyRouteIndex = (htmlFile) => {
  const relativeFile = path.relative(distDir, htmlFile);
  const parsed = path.parse(relativeFile);

  if (parsed.name === 'index') return false;
  if (parsed.name === '_sitemap') return false;
  if (parsed.name === '+not-found') return false;

  const routeDir = path.join(distDir, parsed.dir, parsed.name);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(htmlFile, path.join(routeDir, 'index.html'));
  return true;
};

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      copied += walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      copied += copyRouteIndex(fullPath) ? 1 : 0;
    }
  }

  return copied;
};

if (!fs.existsSync(distDir)) {
  throw new Error(`Expo web export directory not found: ${distDir}`);
}

const copied = walk(distDir);
console.log(`Prepared ${copied} Amplify deep-link route index files.`);
