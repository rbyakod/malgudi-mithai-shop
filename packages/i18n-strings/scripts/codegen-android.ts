import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

const cwd = process.cwd();
const files = readdirSync(cwd).filter((f) => f.endsWith('.json') && f !== 'package.json');

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

function toAndroidResourceName(key: string): string {
  return key.replace(/\./g, '_');
}

for (const f of files) {
  const locale = f.replace('.json', '');
  const values: Record<string, string> = JSON.parse(readFileSync(join(cwd, f), 'utf8'));
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
  for (const [key, value] of Object.entries(values)) {
    xml += `  <string name="${toAndroidResourceName(key)}">${escapeXml(value)}</string>\n`;
  }
  xml += '</resources>\n';

  const outDir = locale === 'en'
    ? join(cwd, 'generated', 'android', 'values')
    : join(cwd, 'generated', 'android', `values-${locale}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'strings.xml'), xml, 'utf8');
  console.log(`✓ ${locale} → ${outDir}`);
}
