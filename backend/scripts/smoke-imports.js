import { readdir } from 'fs/promises';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const backendRoot = resolve(import.meta.dirname, '..');
const srcRoot = resolve(backendRoot, 'src');
const excluded = new Set([
  resolve(srcRoot, 'server.js'),
  resolve(srcRoot, 'loadEnv.js'),
]);

async function listJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = (await listJsFiles(srcRoot)).filter((file) => !excluded.has(file));
const failures = [];

for (const file of files) {
  try {
    await import(pathToFileURL(file).toString());
  } catch (error) {
    failures.push({
      file: file.replace(`${backendRoot}\\`, '').replace(/\\/g, '/'),
      error,
    });
  }
}

if (failures.length > 0) {
  console.error('Backend module import smoke failed:');
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.error.message}`);
  }
  process.exit(1);
}

console.log(`Backend module import smoke passed (${files.length} modules)`);
