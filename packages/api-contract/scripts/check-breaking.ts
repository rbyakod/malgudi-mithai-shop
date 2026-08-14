import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const mainPath = join(cwd, 'openapi.yaml');
const cachedPath = join(cwd, '.openapi.main.yaml');

if (!existsSync(cachedPath)) {
  console.log('No cached main spec — skipping diff (first run).');
  process.exit(0);
}

try {
  execSync(`oasdiff breaking ${cachedPath} ${mainPath}`, { stdio: 'inherit', cwd });
  console.log('✓ No breaking changes detected.');
} catch {
  console.error('✗ Breaking changes detected. Bump /v2/* or mark x-backward-compatible.');
  process.exit(1);
}
