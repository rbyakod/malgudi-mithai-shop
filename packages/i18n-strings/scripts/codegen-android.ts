import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

const cwd = process.cwd();
const files = readdirSync(cwd).filter((f) => f.endsWith('.json') && f !== 'package.json');

function escapeXml(s: string): string {
  // XML entities are NOT enough for Android: the resource merger decodes
  // them back to raw characters before aapt2 runs, and aapt2 then rejects
  // unescaped ' (and bare " toggles quoting). Emit Android escapes for
  // those two; XML entities for < > &.
  return s
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

function toAndroidResourceName(key: string): string {
  return key.replace(/\./g, '_');
}

// JSON sources use ICU-style `{token}` placeholders (matching the web's
// next-intl messages). Android needs positional `%1$s` format args for
// `stringResource(R.string.x, args…)` to work. Convert in emission order;
// the token NAME is not carried (Android formats positionally), so the
// JSON author must keep argument order stable. Stray `%` in placeholder-
// free strings is escaped so aapt2 doesn't see a dangling format spec.
function toAndroidFormat(s: string): string {
  let i = 0;
  const converted = s.replace(/\{[^}]+\}/g, () => `%${++i}$s`);
  return i === 0 ? converted.replace(/%/g, '%%') : converted;
}

for (const f of files) {
  const locale = f.replace('.json', '');
  const values: Record<string, string> = JSON.parse(readFileSync(join(cwd, f), 'utf8'));
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
  for (const [key, value] of Object.entries(values)) {
    xml += `  <string name="${toAndroidResourceName(key)}">${escapeXml(toAndroidFormat(value))}</string>\n`;
  }
  xml += '</resources>\n';

  const outDir = locale === 'en'
    ? join(cwd, 'generated', 'android', 'values')
    : join(cwd, 'generated', 'android', `values-${locale}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'strings.xml'), xml, 'utf8');
  console.log(`✓ ${locale} → ${outDir}`);
}
