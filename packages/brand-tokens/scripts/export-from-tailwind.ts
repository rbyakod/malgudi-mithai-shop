import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Source-of-truth for v1. Web Tailwind v4 @theme reverse-flow is a tracked
// follow-up (not yet implemented). See lib/themes.ts for theme list.
//
// Canonical brand palette mirrors `mishran-default` (DEFAULT_THEME in
// lib/themes.ts): kakvi brown accent + festive saffron gold pop on warm
// milk-cream canvas. The repo ships 8+ theme palettes in lib/themes.ts
// (mishran-default, wedding-heritage, diwali-saffron, etc.); multi-theme
// support is a follow-up — tokens.json shape will grow a `themes` array.
// For v1 we ship a single canonical brand palette consumed by Android/iOS.

const tokens = {
  color: {
    brand: {
      canvas: '#f7efe0',  // warm milk-cream background (mishran-default)
      surface: '#fbf6ec', // lighter surface
      accent: '#9b4d2a',  // kakvi brown — primary brand
      pop: '#d79a35',     // festive saffron gold — secondary
      ink: '#2c1810',     // deep kakvi brown — text
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
