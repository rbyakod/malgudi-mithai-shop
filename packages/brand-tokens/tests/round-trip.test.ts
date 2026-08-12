import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

// Use spawnSync with arg array — no shell interpolation. Static commands only,
// but defense-in-depth against future edits.
function runPnpm(cwd: string, args: string[]): void {
  const result = spawnSync('pnpm', args, { cwd, stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(
      `pnpm ${args.join(' ')} exited ${result.status}: ${result.stdout?.toString()} ${result.stderr?.toString()}`,
    );
  }
}

// Round-trip test: tokens.json -> export script -> tokens.json should be equal.
// Per Task 0.3 verification contract: "tokens.json -> codegen -> re-parse -> equals input".
const pkgRoot = resolve(__dirname, '..');

function parseTokens(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('brand-tokens round-trip', () => {
  it('re-running export script produces identical tokens.json', () => {
    const before = parseTokens(join(pkgRoot, 'tokens.json'));
    // Run export — overwrites tokens.json. Should be deterministic.
    runPnpm(pkgRoot, ['export']);
    const after = parseTokens(join(pkgRoot, 'tokens.json'));
    expect(after).toEqual(before);
  });

  it('tokens.json has expected brand color palette (mishran-default)', () => {
    const tokens = parseTokens(join(pkgRoot, 'tokens.json'));
    expect(tokens.color.brand.canvas).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.color.brand.surface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.color.brand.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.color.brand.pop).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.color.brand.ink).toMatch(/^#[0-9a-f]{6}$/i);
    // Canonical mishran-default values from lib/themes.ts
    expect(tokens.color.brand.canvas).toBe('#f7efe0');
    expect(tokens.color.brand.surface).toBe('#fbf6ec');
    expect(tokens.color.brand.accent).toBe('#9b4d2a');
    expect(tokens.color.brand.pop).toBe('#d79a35');
    expect(tokens.color.brand.ink).toBe('#2c1810');
  });

  it('tokens.json has radius, spacing, typography sections', () => {
    const tokens = parseTokens(join(pkgRoot, 'tokens.json'));
    expect(tokens.radius).toBeDefined();
    expect(tokens.spacing).toBeDefined();
    expect(tokens.typography).toBeDefined();
    expect(typeof tokens.typography.heading.fontFamily).toBe('string');
    expect(typeof tokens.typography.body.sizes.lg).toBe('number');
  });

  it('Kotlin codegen produces MishranTokens.kt', () => {
    runPnpm(pkgRoot, ['codegen:kotlin']);
    const ktPath = join(pkgRoot, 'generated', 'kotlin', 'com', 'mishran', 'app', 'ui', 'theme', 'MishranTokens.kt');
    expect(existsSync(ktPath)).toBe(true);
    const kt = readFileSync(ktPath, 'utf8');
    expect(kt).toContain('object MishranColors');
    expect(kt).toContain('object MishranRadii');
    expect(kt).toContain('object MishranSpacing');
    expect(kt).toContain('object MishranType');
    // Compose Color is opaque ARGB: starts 0xFF. accent #9b4d2a -> 0xFF9B4D2A
    expect(kt).toMatch(/Color\(0xFF9B4D2A\)/);
    expect(kt).toContain('BrandAccent');
    expect(kt).toContain('BrandInk');
    expect(kt).toContain('BrandCanvas');
    expect(kt).toContain('BrandSurface');
    expect(kt).toContain('BrandPop');
  });

  it('Swift codegen produces MishranTokens.swift', () => {
    runPnpm(pkgRoot, ['codegen:swift']);
    const swiftPath = join(pkgRoot, 'generated', 'swift', 'MishranTokens.swift');
    expect(existsSync(swiftPath)).toBe(true);
    const swift = readFileSync(swiftPath, 'utf8');
    expect(swift).toContain('extension Color');
    expect(swift).toContain('extension CGFloat');
    expect(swift).toContain('extension Font');
    expect(swift).toContain('static let mishranBrandAccent');
    expect(swift).toContain('static let mishranBrandInk');
    expect(swift).toContain('static let mishranBrandCanvas');
    expect(swift).toContain('static let mishranBrandSurface');
    expect(swift).toContain('static let mishranBrandPop');
  });
});
