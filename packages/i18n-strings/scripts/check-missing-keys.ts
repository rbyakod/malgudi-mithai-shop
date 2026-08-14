import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.cwd();
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'package.json');
if (!files.includes('en.json')) {
  console.error('en.json missing — required as source of truth.');
  process.exit(1);
}
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
const enKeys = new Set(Object.keys(en));

let failed = false;
for (const f of files) {
  if (f === 'en.json') continue;
  const loc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const locKeys = new Set(Object.keys(loc));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`✗ ${f}:`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
  } else {
    console.log(`✓ ${f}: ${locKeys.size} keys match en.json`);
  }
}
if (failed) process.exit(1);
