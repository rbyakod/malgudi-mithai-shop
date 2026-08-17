import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadCountries, foldName } from '../scripts/countries';

const countries = loadCountries();

describe('countries.json contract', () => {
  it('has ≥200 rows', () => {
    expect(countries.length).toBeGreaterThanOrEqual(200);
  });

  it('row 0 is India/91 — the app default', () => {
    expect(countries[0]).toEqual({ iso2: 'IN', name: 'India', dialCode: '91' });
  });

  it('rows after 0 are A–Z by folded name', () => {
    const rest = countries.slice(1).map((c) => foldName(c.name));
    const sorted = [...rest].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(rest).toEqual(sorted);
  });

  it('iso2 codes are unique, 2 uppercase letters', () => {
    const iso2s = countries.map((c) => c.iso2);
    expect(new Set(iso2s).size).toBe(iso2s.length);
    for (const iso2 of iso2s) expect(iso2).toMatch(/^[A-Z]{2}$/);
  });

  it('dial codes are 1–4 digits, no +, first digit 1–9', () => {
    for (const c of countries) expect(c.dialCode).toMatch(/^[1-9]\d{0,3}$/);
  });

  it('every iso2 letter pair yields a valid regional-indicator flag offset', () => {
    // The generated flagEmoji math (0x1F1E6 + letter - 'A') assumes A–Z.
    for (const c of countries) {
      for (const ch of c.iso2) {
        const code = ch.charCodeAt(0);
        expect(code).toBeGreaterThanOrEqual(0x41);
        expect(code).toBeLessThanOrEqual(0x5a);
      }
    }
  });
});

describe('codegen', () => {
  // Snapshot the committed generated/ tree, re-run both generators, and
  // require byte-identical output: proves determinism AND that the committed
  // files are fresh (root `pnpm codegen` must produce no diff).
  function snapshot(dir: string, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        Object.assign(out, snapshot(full, `${prefix}${entry}/`));
      } else {
        out[`${prefix}${entry}`] = readFileSync(full, 'utf8');
      }
    }
    return out;
  }

  it('output is deterministic and committed files are fresh', () => {
    const genDir = join(process.cwd(), 'generated');
    const before = snapshot(genDir);
    expect(Object.keys(before).length).toBeGreaterThan(0);

    execFileSync('pnpm', ['exec', 'tsx', 'scripts/codegen-kotlin.ts'], { stdio: 'pipe' });
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/codegen-swift.ts'], { stdio: 'pipe' });
    const after = snapshot(genDir);

    expect(after).toEqual(before);
  }, 60_000);

  it('generated Kotlin and Swift contain the default + US/AE rows', () => {
    const kotlin = readFileSync(
      join(process.cwd(), 'generated/kotlin/com/mishran/app/ui/auth/Countries.kt'),
      'utf8',
    );
    expect(kotlin).toContain('object Countries');
    expect(kotlin).toContain('CountryCode(iso2 = "IN", name = "India", dialCode = "91")');
    expect(kotlin).toContain('CountryCode(iso2 = "US", name = "United States", dialCode = "1")');
    expect(kotlin).toContain('CountryCode(iso2 = "AE", name = "United Arab Emirates", dialCode = "971")');

    const swift = readFileSync(join(process.cwd(), 'generated/swift/MishranCountries.swift'), 'utf8');
    expect(swift).toContain('enum CountryCodes');
    expect(swift).toContain('.init(iso2: "IN", name: "India", dialCode: "91")');
    expect(swift).toContain('.init(iso2: "US", name: "United States", dialCode: "1")');
    expect(swift).toContain('.init(iso2: "AE", name: "United Arab Emirates", dialCode: "971")');
  });
});
