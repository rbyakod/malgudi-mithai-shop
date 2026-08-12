import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Web's Tailwind v4 config exposes CSS variables via @theme in app/globals.css.
// This script reads the resolved CSS variable values and writes tokens.json.
//
// Source of truth: This file holds the canonical brand tokens for v1.
// - Web Tailwind v4 reads brand colors from `@theme` blocks in app/globals.css
//   which are kept in sync with this file. Future task will add a codegen step
//   that emits the @theme block from tokens.json so the source-of-truth becomes
//   single-direction (tokens.json -> CSS).
// - Repo also has 8+ theme palettes in lib/themes.ts (mishran-default,
//   wedding-heritage, diwali-saffron, etc.). Multi-theme support is a follow-up:
//   tokens.json shape will grow a `themes` array. For v1 we ship a single
//   canonical brand palette (wine/saffron/cream) consumed by the Android/iOS
//   native apps.

const tokens = {
  color: {
    brand: {
      wine: '#8b1e3f',
      wineDark: '#6b1730',
      saffron: '#e76f51',
      gold: '#c9a55c',
      cream: '#fafaf7',
    },
    neutral: {
      50: '#fafaf7',
      100: '#f3f0e8',
      200: '#e5e5dd',
      400: '#9a9a8e',
      500: '#5a5a5a',
      700: '#3a3a3a',
      900: '#1a1a1a',
    },
    state: {
      success: '#2d6a4f',
      warning: '#d4a017',
      error: '#9d1c1c',
    },
  },
  radius: { sm: '4px', md: '8px', lg: '12px', xl: '20px', full: '9999px' },
  spacing: {
    xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px',
  },
  typography: {
    heading: {
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    },
    body: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, serif',
      lineHeight: '1.7',
      sizes: { sm: 12, md: 14, lg: 16, xl: 18, xxl: 24, display: 32 },
    },
  },
};

const outPath = join(process.cwd(), 'tokens.json');
writeFileSync(outPath, JSON.stringify(tokens, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${outPath}`);
