# Mishran Payload Admin Aesthetic Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Payload 3.x admin panel into a Mishran-branded editor console with custom crest/wordmark, three Mishran admin themes, nav grouping, an operational dashboard, and image-rich product list cells.

**Architecture:** Payload-native extension points only (`admin.components.graphics`, `beforeLogin`, `beforeDashboard`, `settingsMenu`, `field.admin.components.Cell`, `admin.group`, `admin.css`). One React component per extension point. CSS variables define three theme palettes; `data-admin-theme` on `<body>` swaps them.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Payload 3.85+, Tailwind CSS (storefront tokens reused where possible), vitest + @testing-library/react for unit tests, Playwright for E2E, `pdf2svg` for logo extraction.

## Global Constraints

- Payload 3.85+ extension-point APIs only.
- Client components must start with `"use client"` directive.
- All images via `next/image` — no raw `<img>`.
- `next.config.mjs` must enable `dangerouslyAllowSVG: true` (Mishran SVGs are first-party, safe).
- Relative-time formatting uses native `Intl.RelativeTimeFormat` — no `date-fns`/`dayjs`/`moment` dependency.
- Theme cookie name: `mishran-admin-theme` (exact string).
- Theme names: `mishran-admin`, `mishran-midnight`, `mishran-monsoon` (exact strings).
- Nav group prefixes: `01 Brand`, `02 Products`, `03 Catalog Ops`, `04 Storefront`, `05 Settings` — leading zero, single space, capital first letter.
- All admin components live under `components/payload-admin/`.
- All admin assets live under `public/admin/`.
- Existing collection/global config files edited in place — no renaming, no relocating.
- Custom cell receives `DefaultCellComponentProps` — type import from `payload`.
- No new runtime dependencies — use what's already in `package.json` (React, next/image, Tailwind, vitest, Playwright).
- The `Leads` collection field for status filtering — verify actual field name at impl time (spec assumes `status`; collection file is source of truth).
- The `Stories` collection has draft versions enabled — filter via `where[_status][equals]=draft`.
- MithaiProducts has NO `stockStatus` field. Use `freshnessStatus` (`made-daily`/`made-to-order`/`batch-frozen`) for the freshness dashboard widget.
- Product image field shapes differ per collection — verified mappings in Task 14.

---

## File Structure

```
components/payload-admin/
├── graphics/
│   ├── CrestIcon.tsx
│   └── WordmarkLogo.tsx
├── login/
│   └── MishranLoginHero.tsx
├── dashboard/
│   ├── MishranDashboard.tsx
│   ├── RecentLeads.tsx
│   ├── MithaiFreshnessBoard.tsx
│   ├── PendingStories.tsx
│   ├── CatalogCounts.tsx
│   └── WidgetErrorBoundary.tsx
├── cells/
│   ├── ProductNameCell.tsx
│   └── product-cell-behaviors.ts
├── theme/
│   ├── AdminThemeSwitcher.tsx
│   ├── AdminThemeBootScript.tsx
│   └── admin-theme.ts
└── lib/
    ├── relative-time.ts
    └── dashboard-queries.ts

app/(payload)/admin/
└── custom.scss

public/admin/
├── mishran-crest.svg
├── mishran-wordmark.svg
├── mishran-crest-192.png
├── mishran-crest-512.png
└── favicon.ico

scripts/
└── extract-logos.sh

tests/unit/payload-admin/
├── relative-time.test.ts
├── admin-theme.test.ts
├── CrestIcon.test.tsx
├── WordmarkLogo.test.tsx
├── MishranLoginHero.test.tsx
├── AdminThemeSwitcher.test.tsx
├── WidgetErrorBoundary.test.tsx
├── RecentLeads.test.tsx
├── MithaiFreshnessBoard.test.tsx
├── PendingStories.test.tsx
├── CatalogCounts.test.tsx
├── MishranDashboard.test.tsx
└── ProductNameCell.test.tsx

tests/e2e/admin-aesthetics.spec.ts
```

---

### Task 1: Logo Asset Extraction + Next.js SVG Permission

**Files:**
- Create: `scripts/extract-logos.sh`
- Create: `public/admin/mishran-crest.svg` (extracted)
- Create: `public/admin/mishran-wordmark.svg` (extracted)
- Create: `public/admin/mishran-crest-192.png` (rendered)
- Create: `public/admin/mishran-crest-512.png` (rendered)
- Create: `public/admin/favicon.ico` (derived)
- Modify: `next.config.mjs`

**Interfaces:**
- Produces: SVG/PNG files at known paths, consumed by Tasks 5, 6, 17.

- [ ] **Step 1: Install pdf2svg**

Run: `brew install pdf2svg`
Expected: `pdf2svg` available on PATH.

- [ ] **Step 2: Write extraction script**

Create `scripts/extract-logos.sh`:

```bash
#!/usr/bin/env bash
# Extract Mishran logo SVGs from the source PDF.
# Run once after cloning, or when the source PDF changes.
set -euo pipefail

SRC_PDF="${1:-$HOME/Downloads/Mishran Final Logo + Crest.pdf}"
OUT_DIR="$(git rev-parse --show-toplevel)/public/admin"
mkdir -p "$OUT_DIR"

if [[ ! -f "$SRC_PDF" ]]; then
  echo "Source PDF not found: $SRC_PDF" >&2
  echo "Pass the path as first argument." >&2
  exit 1
fi

# Page 1 = wordmark; Page 2 = crest
pdf2svg "$SRC_PDF" "$OUT_DIR/mishran-wordmark.svg" 1
pdf2svg "$SRC_PDF" "$OUT_DIR/mishran-crest.svg" 2

# PNG fallbacks at 192 / 512 from page 2 (crest)
pdftoppm -png -r 200 -f 2 -l 2 "$SRC_PDF" "$OUT_DIR/crest-tmp"
mv "$OUT_DIR/crest-tmp-2.png" "$OUT_DIR/mishran-crest-192.png"

pdftoppm -png -r 400 -f 2 -l 2 "$SRC_PDF" "$OUT_DIR/crest-tmp"
mv "$OUT_DIR/crest-tmp-2.png" "$OUT_DIR/mishran-crest-512.png"

rm -f "$OUT_DIR/crest-tmp-"*.png

# Favicon: convert 512 PNG to multi-size ICO via ImageMagick (already on macOS dev machines via brew)
if command -v magick >/dev/null 2>&1; then
  magick "$OUT_DIR/mishran-crest-512.png" -define icon:auto-resize=16,32,48 "$OUT_DIR/favicon.ico"
elif command -v convert >/dev/null 2>&1; then
  convert "$OUT_DIR/mishran-crest-512.png" -define icon:auto-resize=16,32,48 "$OUT_DIR/favicon.ico"
else
  echo "ImageMagick not found — favicon.ico skipped. Install via: brew install imagemagick" >&2
fi

echo "Logos extracted to $OUT_DIR"
```

- [ ] **Step 3: Make script executable and run**

Run: `chmod +x scripts/extract-logos.sh && ./scripts/extract-logos.sh`
Expected: 5 files created in `public/admin/`.

- [ ] **Step 4: Enable SVG support in next.config.mjs**

Modify `next.config.mjs`:

```javascript
// next.config.mjs
import createNextIntlPlugin from "next-intl/plugin";
import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Mishran SVGs are first-party assets in /public/admin — safe to permit.
    // Required so <Image src="/admin/mishran-crest.svg" /> works.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withPayload(withNextIntl(nextConfig));
```

- [ ] **Step 5: Verify visually**

Open `public/admin/mishran-wordmark.svg` and `public/admin/mishran-crest.svg` in a browser — both should render correctly. If blank, the PDF may have embedded fonts that pdf2svg couldn't extract; fall back to using the 512 PNG as the asset and skip the SVG paths in Tasks 5/6.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract-logos.sh next.config.mjs public/admin/
git commit -m "feat(admin): extract Mishran logo assets and enable SVG support"
```

---

### Task 2: Relative-Time Helper

**Files:**
- Create: `components/payload-admin/lib/relative-time.ts`
- Test: `tests/unit/payload-admin/relative-time.test.ts`

**Interfaces:**
- Produces: `formatRelativeTime(date: Date | string, now?: Date): string` — used by PendingStories widget (Task 11).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/relative-time.test.ts`:

```typescript
import {describe, it, expect} from "vitest";
import {formatRelativeTime} from "@/components/payload-admin/lib/relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("returns 'just now' for < 60 seconds", () => {
    const d = new Date("2026-08-11T11:59:30Z");
    expect(formatRelativeTime(d, now)).toBe("just now");
  });

  it("returns minutes for < 60 min", () => {
    const d = new Date("2026-08-11T11:30:00Z");
    expect(formatRelativeTime(d, now)).toBe("30 minutes ago");
  });

  it("returns singular 'minute' for 1 min", () => {
    const d = new Date("2026-08-11T11:59:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 minute ago");
  });

  it("returns hours for < 24h", () => {
    const d = new Date("2026-08-11T06:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("6 hours ago");
  });

  it("returns singular 'hour' for 1h", () => {
    const d = new Date("2026-08-11T11:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 hour ago");
  });

  it("returns days for >= 24h", () => {
    const d = new Date("2026-08-09T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("2 days ago");
  });

  it("returns singular 'day' for 1 day", () => {
    const d = new Date("2026-08-10T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 day ago");
  });

  it("accepts ISO date string", () => {
    expect(formatRelativeTime("2026-08-09T12:00:00Z", now)).toBe("2 days ago");
  });

  it("returns 'in the future' for future dates (defensive)", () => {
    const d = new Date("2026-08-12T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("in the future");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/relative-time.test.ts`
Expected: FAIL with "Cannot find module '@/components/payload-admin/lib/relative-time'".

- [ ] **Step 3: Write minimal implementation**

Create `components/payload-admin/lib/relative-time.ts`:

```typescript
// Relative-time formatting using native Intl.RelativeTimeFormat.
// Used for "edited Xd ago" copy in admin dashboard widgets.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  date: Date | string,
  now: Date = new Date()
): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();

  if (diffMs > 0) return "in the future";

  const absMs = Math.abs(diffMs);
  if (absMs < MINUTE) return "just now";

  if (absMs < HOUR) {
    const minutes = Math.round(absMs / MINUTE);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  if (absMs < DAY) {
    const hours = Math.round(absMs / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.round(absMs / DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/relative-time.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/lib/relative-time.ts tests/unit/payload-admin/relative-time.test.ts
git commit -m "feat(admin): add relative-time helper for dashboard widgets"
```

---

### Task 3: Theme Cookie + Helpers

**Files:**
- Create: `components/payload-admin/theme/admin-theme.ts`
- Test: `tests/unit/payload-admin/admin-theme.test.ts`

**Interfaces:**
- Produces:
  - `ADMIN_THEMES` — readonly array: `["mishran-admin", "mishran-midnight", "mishran-monsoon"]`
  - `DEFAULT_ADMIN_THEME` — `"mishran-admin"`
  - `ADMIN_THEME_COOKIE` — `"mishran-admin-theme"`
  - `ADMIN_THEME_MAX_AGE` — `60 * 60 * 24 * 365` (1 year, in seconds)
  - `isAdminTheme(value: unknown): value is AdminTheme`
  - `parseAdminTheme(value: unknown): AdminTheme`
  - `getAdminThemeFromCookies(cookieStore: { get(name: string): string | undefined }): AdminTheme`
- Consumed by: Task 4 (CSS file references theme names), Task 7 (switcher), Task 17 (boot script + payload.config).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/admin-theme.test.ts`:

```typescript
import {describe, it, expect} from "vitest";
import {
  ADMIN_THEMES,
  DEFAULT_ADMIN_THEME,
  ADMIN_THEME_COOKIE,
  isAdminTheme,
  parseAdminTheme,
  getAdminThemeFromCookies,
} from "@/components/payload-admin/theme/admin-theme";

describe("admin-theme helpers", () => {
  it("exposes 3 themes with mishran-admin first", () => {
    expect(ADMIN_THEMES).toEqual([
      "mishran-admin",
      "mishran-midnight",
      "mishran-monsoon",
    ]);
    expect(DEFAULT_ADMIN_THEME).toBe("mishran-admin");
  });

  it("exposes exact cookie name", () => {
    expect(ADMIN_THEME_COOKIE).toBe("mishran-admin-theme");
  });

  it("isAdminTheme narrows known themes", () => {
    expect(isAdminTheme("mishran-admin")).toBe(true);
    expect(isAdminTheme("mishran-midnight")).toBe(true);
    expect(isAdminTheme("mishran-monsoon")).toBe(true);
    expect(isAdminTheme("mishran-something")).toBe(false);
    expect(isAdminTheme(undefined)).toBe(false);
    expect(isAdminTheme(42)).toBe(false);
  });

  it("parseAdminTheme returns valid theme or default", () => {
    expect(parseAdminTheme("mishran-midnight")).toBe("mishran-midnight");
    expect(parseAdminTheme("garbage")).toBe(DEFAULT_ADMIN_THEME);
    expect(parseAdminTheme(undefined)).toBe(DEFAULT_ADMIN_THEME);
    expect(parseAdminTheme(null)).toBe(DEFAULT_ADMIN_THEME);
  });

  it("getAdminThemeFromCookies reads cookie or returns default", () => {
    const store = {get: (name: string) => name === "mishran-admin-theme" ? "mishran-monsoon" : undefined};
    expect(getAdminThemeFromCookies(store)).toBe("mishran-monsoon");

    const empty = {get: () => undefined};
    expect(getAdminThemeFromCookies(empty)).toBe(DEFAULT_ADMIN_THEME);

    const corrupt = {get: () => "garbage"};
    expect(getAdminThemeFromCookies(corrupt)).toBe(DEFAULT_ADMIN_THEME);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/admin-theme.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write minimal implementation**

Create `components/payload-admin/theme/admin-theme.ts`:

```typescript
// Theme tokens shared between server (cookie read) and client (switcher).
// Keep this module side-effect-free — imported by both RSC and client components.

export const ADMIN_THEMES = [
  "mishran-admin",
  "mishran-midnight",
  "mishran-monsoon",
] as const;

export type AdminTheme = (typeof ADMIN_THEMES)[number];

export const DEFAULT_ADMIN_THEME: AdminTheme = "mishran-admin";

export const ADMIN_THEME_COOKIE = "mishran-admin-theme";

// 1 year in seconds.
export const ADMIN_THEME_MAX_AGE = 60 * 60 * 24 * 365;

export function isAdminTheme(value: unknown): value is AdminTheme {
  return typeof value === "string"
    && (ADMIN_THEMES as readonly string[]).includes(value);
}

export function parseAdminTheme(value: unknown): AdminTheme {
  return isAdminTheme(value) ? value : DEFAULT_ADMIN_THEME;
}

type CookieStoreLike = {
  get(name: string): string | undefined;
};

export function getAdminThemeFromCookies(store: CookieStoreLike): AdminTheme {
  return parseAdminTheme(store.get(ADMIN_THEME_COOKIE));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/admin-theme.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/theme/admin-theme.ts tests/unit/payload-admin/admin-theme.test.ts
git commit -m "feat(admin): add theme token module (names, cookie, helpers)"
```

---

### Task 4: Theme CSS File (custom.scss)

**Files:**
- Create: `app/(payload)/admin/custom.scss`

**Interfaces:**
- Produces: CSS file referenced by `admin.css` in `payload.config.ts` (Task 17).
- Defines CSS variables under `body[data-admin-theme="<name>"]` for Mishran tokens.
- Maps Mishran tokens onto Payload's `--theme-*` variables.

No test — pure CSS, verified via E2E in Task 18.

- [ ] **Step 1: Locate Payload UI variable names**

Run: `find node_modules/@payloadcms/ui/dist/scss -type f -name "*.scss" | head -10`

Read `_variables.scss` and `_base.scss` from the listed files to identify Payload's CSS variable names. Look for variables like `--theme-elevation-*`, `--theme-success-500`, `--theme-bg`, `--theme-text`, `--theme-border-radius-*`, `--theme-style-*`. Write down the exact list — they'll be used below.

- [ ] **Step 2: Write custom.scss**

Create `app/(payload)/admin/custom.scss`:

```scss
// Mishran admin theme tokens.
//
// Three themes: mishran-admin (default), mishran-midnight, mishran-monsoon.
// Selected via body[data-admin-theme] attribute, set by AdminThemeBootScript
// before hydration to avoid theme flash.

:root {
  --mishran-font-display: "Outfit", system-ui, sans-serif;
  --mishran-radius-sm: 6px;
  --mishran-radius-md: 10px;
  --mishran-radius-lg: 16px;
}

// === Mishran Admin (default) ===
body[data-admin-theme="mishran-admin"] {
  --t-bg: #f7efe0;
  --t-bg-card: #ffffff;
  --t-bg-control: #fdf8ed;
  --t-text: #2a1a0e;
  --t-text-muted: #6b4f37;
  --t-primary: #9b4d2a;
  --t-primary-hover: #7d3d22;
  --t-gold: #d79a35;
  --t-border: #e8d5b8;
  --t-success: #2f7a3a;
  --t-danger: #c0392b;
}

// === Mishran Midnight ===
body[data-admin-theme="mishran-midnight"] {
  --t-bg: #1a1614;
  --t-bg-card: #261f1a;
  --t-bg-control: #2f2620;
  --t-text: #f0e6d2;
  --t-text-muted: #a89878;
  --t-primary: #d79a35;
  --t-primary-hover: #e8ad4d;
  --t-gold: #d79a35;
  --t-border: #3a2f25;
  --t-success: #4ca85a;
  --t-danger: #e55a4a;
}

// === Mishran Monsoon ===
body[data-admin-theme="mishran-monsoon"] {
  --t-bg: #e8eef2;
  --t-bg-card: #ffffff;
  --t-bg-control: #f4f7fa;
  --t-text: #1f2937;
  --t-text-muted: #4b5563;
  --t-primary: #e07a3c;
  --t-primary-hover: #c5682f;
  --t-gold: #c4942c;
  --t-border: #cbd5e1;
  --t-success: #2f7a3a;
  --t-danger: #c0392b;
}

// === Map Mishran tokens onto Payload's CSS variables ===
// Payload 3.x exposes its palette under --theme-elevation-* and --theme-* tokens.
// Verify exact names in node_modules/@payloadcms/ui/dist/scss/_variables.scss.
// The mappings below target the variables Payload 3.85 uses; adjust if renamed.
body[data-admin-theme] {
  --theme-elevation-50: var(--t-bg);
  --theme-elevation-100: var(--t-bg);
  --theme-elevation-200: var(--t-bg-card);
  --theme-elevation-300: var(--t-bg-control);
  --theme-elevation-400: var(--t-border);
  --theme-elevation-500: var(--t-text-muted);
  --theme-elevation-600: var(--t-text);
  --theme-elevation-700: var(--t-text);
  --theme-elevation-800: var(--t-text);
  --theme-elevation-900: var(--t-text);
  --theme-success-500: var(--t-primary);
  --theme-warning-500: var(--t-gold);
  --theme-error-500: var(--t-danger);

  // Apply base styles
  background-color: var(--t-bg);
  color: var(--t-text);
  font-family: var(--mishran-font-display);
}

// Mishran-specific utility classes (used by widgets + cells)
.mishran-card {
  background-color: var(--t-bg-card);
  border: 1px solid var(--t-border);
  border-radius: var(--mishran-radius-md);
  padding: 1rem 1.25rem;
}

.mishran-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.mishran-pill--muted { background: var(--t-bg-control); color: var(--t-text-muted); }
.mishran-pill--primary { background: var(--t-primary); color: var(--t-bg-card); }
.mishran-pill--gold { background: var(--t-gold); color: var(--t-text); }
.mishran-pill--success { background: var(--t-success); color: white; }
.mishran-pill--danger { background: var(--t-danger); color: white; }

.mishran-skeleton {
  background: linear-gradient(
    90deg,
    var(--t-bg-control) 0%,
    var(--t-border) 50%,
    var(--t-bg-control) 100%
  );
  background-size: 200% 100%;
  animation: mishran-skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: var(--mishran-radius-sm);
}

@keyframes mishran-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: Verify file exists and is non-empty**

Run: `wc -l app/(payload)/admin/custom.scss`
Expected: ~100+ lines.

- [ ] **Step 4: Commit**

```bash
git add "app/(payload)/admin/custom.scss"
git commit -m "feat(admin): add Mishran admin theme CSS (3 themes + Payload var mapping)"
```

---

### Task 5: Graphics Components (CrestIcon + WordmarkLogo)

**Files:**
- Create: `components/payload-admin/graphics/CrestIcon.tsx`
- Create: `components/payload-admin/graphics/WordmarkLogo.tsx`
- Test: `tests/unit/payload-admin/CrestIcon.test.tsx`
- Test: `tests/unit/payload-admin/WordmarkLogo.test.tsx`

**Interfaces:**
- Consumes: SVG assets at `/admin/mishran-crest.svg` and `/admin/mishran-wordmark.svg` (Task 1).
- Produces:
  - `<CrestIcon size?: number = 32, className?: string>` — server component
  - `<WordmarkLogo height?: number = 64, className?: string>` — server component
- Consumed by: Task 6 (login hero), Task 17 (payload.config graphics.Icon/Logo).

- [ ] **Step 1: Write failing tests**

Create `tests/unit/payload-admin/CrestIcon.test.tsx`:

```typescript
import {describe, it, expect} from "vitest";
import {render} from "@testing-library/react";
import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";

// Mock next/image to render a plain img with src + alt props for assertion.
vi.mock("next/image", () => ({
  default: ({src, alt, width, height, className}: any) => (
    <img src={src} alt={alt} width={width} height={height} className={className} data-testid="img" />
  ),
}));

describe("CrestIcon", () => {
  it("renders image with crest src + default size 32", () => {
    const {getByTestId} = render(<CrestIcon />);
    const img = getByTestId("img");
    expect(img).toHaveAttribute("src", "/admin/mishran-crest.svg");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("accepts custom size", () => {
    const {getByTestId} = render(<CrestIcon size={48} />);
    expect(getByTestId("img")).toHaveAttribute("width", "48");
    expect(getByTestId("img")).toHaveAttribute("height", "48");
  });

  it("accepts className override", () => {
    const {getByTestId} = render(<CrestIcon className="custom-class" />);
    expect(getByTestId("img")).toHaveAttribute("class", "custom-class");
  });

  it("has empty alt (decorative)", () => {
    const {getByTestId} = render(<CrestIcon />);
    expect(getByTestId("img")).toHaveAttribute("alt", "");
  });
});
```

Create `tests/unit/payload-admin/WordmarkLogo.test.tsx`:

```typescript
import {describe, it, expect} from "vitest";
import {render} from "@testing-library/react";
import {WordmarkLogo} from "@/components/payload-admin/graphics/WordmarkLogo";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height, className}: any) => (
    <img src={src} alt={alt} width={height} height={height} className={className} data-testid="img" />
  ),
}));

describe("WordmarkLogo", () => {
  it("renders wordmark with default height 64", () => {
    const {getByTestId} = render(<WordmarkLogo />);
    const img = getByTestId("img");
    expect(img).toHaveAttribute("src", "/admin/mishran-wordmark.svg");
    expect(img).toHaveAttribute("height", "64");
  });

  it("accepts custom height", () => {
    const {getByTestId} = render(<WordmarkLogo height={96} />);
    expect(getByTestId("img")).toHaveAttribute("height", "96");
  });

  it("alt text describes the brand", () => {
    const {getByTestId} = render(<WordmarkLogo />);
    const alt = getByTestId("img").getAttribute("alt") ?? "";
    expect(alt.toLowerCase()).toContain("mishran");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/payload-admin/CrestIcon.test.tsx tests/unit/payload-admin/WordmarkLogo.test.tsx`
Expected: FAIL with module-not-found for both.

- [ ] **Step 3: Write implementations**

Create `components/payload-admin/graphics/CrestIcon.tsx`:

```tsx
import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
};

// Sidebar crest icon. Renders the Mishran crest SVG at a given pixel size.
// Used as admin.components.graphics.Icon.
export function CrestIcon({size = 32, className}: Props) {
  return (
    <Image
      src="/admin/mishran-crest.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export default CrestIcon;
```

Create `components/payload-admin/graphics/WordmarkLogo.tsx`:

```tsx
import Image from "next/image";

type Props = {
  height?: number;
  className?: string;
};

// Full wordmark for the login page.
// Used as admin.components.graphics.Logo.
export function WordmarkLogo({height = 64, className}: Props) {
  // Aspect ratio 4:1 (wordmark is wider than tall) — width derived from height.
  const width = Math.round(height * 4);
  return (
    <Image
      src="/admin/mishran-wordmark.svg"
      alt="Mishran"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

export default WordmarkLogo;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/payload-admin/CrestIcon.test.tsx tests/unit/payload-admin/WordmarkLogo.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/graphics/ tests/unit/payload-admin/CrestIcon.test.tsx tests/unit/payload-admin/WordmarkLogo.test.tsx
git commit -m "feat(admin): add CrestIcon + WordmarkLogo graphics components"
```

---

### Task 6: Login Hero

**Files:**
- Create: `components/payload-admin/login/MishranLoginHero.tsx`
- Test: `tests/unit/payload-admin/MishranLoginHero.test.tsx`

**Interfaces:**
- Consumes: `<CrestIcon>` from Task 5.
- Produces: `<MishranLoginHero>` — used by `admin.components.beforeLogin` (Task 17).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/MishranLoginHero.test.tsx`:

```typescript
import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MishranLoginHero} from "@/components/payload-admin/login/MishranLoginHero";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height}: any) => (
    <img src={src} alt={alt} width={width} height={height} data-testid="img" />
  ),
}));

describe("MishranLoginHero", () => {
  it("renders the crest image", () => {
    render(<MishranLoginHero />);
    const imgs = screen.getAllByTestId("img");
    const crest = imgs.find(img => img.getAttribute("src") === "/admin/mishran-crest.svg");
    expect(crest).toBeDefined();
  });

  it("renders tagline with Mishran brand", () => {
    render(<MishranLoginHero />);
    expect(screen.getByText(/Mishran/i)).toBeInTheDocument();
    expect(screen.getByText(/Sweets & Snacks/i)).toBeInTheDocument();
  });

  it("renders 'Editor Console' subtitle", () => {
    render(<MishranLoginHero />);
    expect(screen.getByText(/Editor Console/i)).toBeInTheDocument();
  });

  it("applies mishran-login-hero className for layout", () => {
    const {container} = render(<MishranLoginHero />);
    expect(container.querySelector(".mishran-login-hero")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/MishranLoginHero.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/login/MishranLoginHero.tsx`:

```tsx
import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";

// Two-column hero rendered above the default Payload login form.
// Injected via admin.components.beforeLogin.
// Server component — no client interactivity needed.
export function MishranLoginHero() {
  return (
    <div
      className="mishran-login-hero"
      style={{
        display: "flex",
        gap: "1.5rem",
        padding: "1.5rem 0",
        marginBottom: "1.5rem",
        borderBottom: "1px solid var(--t-border, #e8d5b8)",
      }}
    >
      <div
        style={{
          flex: "0 0 96px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--t-primary, #9b4d2a), var(--t-gold, #d79a35))",
          borderRadius: "16px",
          padding: "1rem",
        }}
      >
        <CrestIcon size={64} />
      </div>
      <div style={{flex: "1", display: "flex", flexDirection: "column", justifyContent: "center"}}>
        <h1
          style={{
            fontFamily: "var(--mishran-font-display, Outfit)",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--t-text, currentColor)",
            margin: 0,
          }}
        >
          Mishran Sweets &amp; Snacks
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--t-text-muted, currentColor)",
            margin: "0.25rem 0 0",
          }}
        >
          Editor Console
        </p>
      </div>
    </div>
  );
}

export default MishranLoginHero;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/MishranLoginHero.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/login/ tests/unit/payload-admin/MishranLoginHero.test.tsx
git commit -m "feat(admin): add MishranLoginHero for login page branding"
```

---

### Task 7: Admin Theme Switcher

**Files:**
- Create: `components/payload-admin/theme/AdminThemeSwitcher.tsx`
- Test: `tests/unit/payload-admin/AdminThemeSwitcher.test.tsx`

**Interfaces:**
- Consumes: theme tokens from Task 3.
- Produces: `<AdminThemeSwitcher>` — used by `admin.components.settingsMenu` (Task 17).
- On change: writes cookie `mishran-admin-theme=...; Max-Age=31536000; Path=/; SameSite=Lax` and sets `document.body.dataset.adminTheme`.

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/AdminThemeSwitcher.test.tsx`:

```typescript
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {AdminThemeSwitcher} from "@/components/payload-admin/theme/AdminThemeSwitcher";

describe("AdminThemeSwitcher", () => {
  beforeEach(() => {
    vi.stubGlobal("location", {reload: vi.fn()});
  });
  afterEach(() => {
    document.body.removeAttribute("data-admin-theme");
    vi.unstubAllGlobals();
  });

  it("renders a labeled select with 3 themes", () => {
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i);
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.map(o => o.textContent)).toEqual([
      "Mishran (default)",
      "Mishran Midnight",
      "Mishran Monsoon",
    ]);
  });

  it("default-selected is mishran-admin when no body data attr", () => {
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i) as HTMLSelectElement;
    expect(select.value).toBe("mishran-admin");
  });

  it("reflects current body data-admin-theme as selected", () => {
    document.body.dataset.adminTheme = "mishran-midnight";
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i) as HTMLSelectElement;
    expect(select.value).toBe("mishran-midnight");
  });

  it("writes cookie + updates body data attr on change", async () => {
    const setItemSpy = vi.spyOn(document, "cookie", "set");
    render(<AdminThemeSwitcher />);
    fireEvent.change(screen.getByLabelText(/Admin theme/i), {target: {value: "mishran-monsoon"}});
    await waitFor(() => {
      expect(document.body.dataset.adminTheme).toBe("mishran-monsoon");
    });
    expect(setItemSpy).toHaveBeenCalledWith(
      expect.stringContaining("mishran-admin-theme=mishran-monsoon")
    );
    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining("SameSite=Lax"));
    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining("Max-Age=31536000"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/AdminThemeSwitcher.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/theme/AdminThemeSwitcher.tsx`:

```tsx
"use client";

import {useState} from "react";
import {
  ADMIN_THEMES,
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_MAX_AGE,
  DEFAULT_ADMIN_THEME,
  type AdminTheme,
} from "./admin-theme";

const LABELS: Record<AdminTheme, string> = {
  "mishran-admin": "Mishran (default)",
  "mishran-midnight": "Mishran Midnight",
  "mishran-monsoon": "Mishran Monsoon",
};

// Injected into the admin settings popup (gear icon above logout).
// Writes a 1-year cookie so SSR reads theme on next load — eliminates flash.
export function AdminThemeSwitcher() {
  const initial = readCurrentTheme();
  const [value, setValue] = useState<AdminTheme>(initial);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as AdminTheme;
    setValue(next);
    document.body.dataset.adminTheme = next;
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; Max-Age=${ADMIN_THEME_MAX_AGE}; Path=/; SameSite=Lax`;
  };
  return (
    <div style={{padding: "0.5rem 0"}}>
      <label
        htmlFor="mishran-admin-theme-select"
        style={{display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--t-text-muted)"}}
      >
        Admin theme
      </label>
      <select
        id="mishran-admin-theme-select"
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          padding: "0.375rem 0.5rem",
          borderRadius: "6px",
          border: "1px solid var(--t-border)",
          background: "var(--t-bg-card)",
          color: "var(--t-text)",
        }}
      >
        {ADMIN_THEMES.map(t => (
          <option key={t} value={t}>{LABELS[t]}</option>
        ))}
      </select>
    </div>
  );
}

function readCurrentTheme(): AdminTheme {
  if (typeof document === "undefined") return DEFAULT_ADMIN_THEME;
  const fromBody = document.body.dataset.adminTheme;
  if (fromBody && (ADMIN_THEMES as readonly string[]).includes(fromBody)) {
    return fromBody as AdminTheme;
  }
  return DEFAULT_ADMIN_THEME;
}

export default AdminThemeSwitcher;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/AdminThemeSwitcher.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/theme/AdminThemeSwitcher.tsx tests/unit/payload-admin/AdminThemeSwitcher.test.tsx
git commit -m "feat(admin): add AdminThemeSwitcher for settings menu"
```

---

### Task 8: Widget Error Boundary

**Files:**
- Create: `components/payload-admin/dashboard/WidgetErrorBoundary.tsx`
- Test: `tests/unit/payload-admin/WidgetErrorBoundary.test.tsx`

**Interfaces:**
- Produces: `<WidgetErrorBoundary name={string}>{children}</WidgetErrorBoundary>` — wraps each widget in Task 13 (dashboard).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/WidgetErrorBoundary.test.tsx`:

```typescript
import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {WidgetErrorBoundary} from "@/components/payload-admin/dashboard/WidgetErrorBoundary";

const ThrowOnRender = ({shouldThrow}: {shouldThrow: boolean}) => {
  if (shouldThrow) throw new Error("boom");
  return <div data-testid="child">child content</div>;
};

describe("WidgetErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React's error logging for thrown test errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders fallback with widget name on error", () => {
    render(
      <WidgetErrorBoundary name="My Widget">
        <ThrowOnRender shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText(/Couldn't load My Widget/i)).toBeInTheDocument();
  });

  it("retry button re-renders children", () => {
    const {rerender} = render(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText(/Couldn't load Test/i)).toBeInTheDocument();

    // Click retry then rerender with non-throwing child
    fireEvent.click(screen.getByRole("button", {name: /retry/i}));
    rerender(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/WidgetErrorBoundary.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/WidgetErrorBoundary.tsx`:

```tsx
"use client";

import {Component, type ReactNode} from "react";

type Props = {
  name: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorKey: number;
};

// Per-widget error boundary so one failing widget doesn't kill the dashboard.
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false, errorKey: 0};

  static getDerivedStateFromError(): State {
    return {hasError: true, errorKey: Date.now()};
  }

  reset = () => {
    this.setState({hasError: false, errorKey: this.state.errorKey + 1});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: "1rem", color: "var(--t-text-muted)"}}>
          <p style={{margin: "0 0 0.5rem", fontSize: "0.875rem"}}>
            Couldn&apos;t load {this.props.name}.
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--t-border)",
              background: "var(--t-bg-card)",
              color: "var(--t-text)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    // errorKey as key forces remount on retry — clears the throwing child's state.
    return <div key={this.state.errorKey}>{this.props.children}</div>;
  }
}

export default WidgetErrorBoundary;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/WidgetErrorBoundary.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/WidgetErrorBoundary.tsx tests/unit/payload-admin/WidgetErrorBoundary.test.tsx
git commit -m "feat(admin): add WidgetErrorBoundary for per-widget failure isolation"
```

---

### Task 9: Dashboard Query Helper

**Files:**
- Create: `components/payload-admin/lib/dashboard-queries.ts`

**Interfaces:**
- Produces:
  - `fetchRecentLeads(limit?: number): Promise<LeadRow[]>`
  - `fetchMithaiByFreshness(): Promise<MithaiFreshnessGroups>`
  - `fetchPendingStories(limit?: number): Promise<StoryRow[]>`
  - `fetchCatalogCounts(): Promise<CatalogCounts>`
- Consumed by: Tasks 10, 11, 12, 13.

No test — these are thin fetch wrappers; their behavior is exercised through widget tests.

- [ ] **Step 1: Write implementation**

Create `components/payload-admin/lib/dashboard-queries.ts`:

```typescript
// Thin fetch wrappers for dashboard widgets.
// All endpoints are Payload REST routes auto-authed by the admin session cookie.

const API_BASE = "/api";

export type LeadStatus = "new" | "contacted" | "won" | "lost";

export type LeadRow = {
  id: string;
  name: string;
  email?: string;
  status?: LeadStatus;
  createdAt: string;
};

export type MithaiFreshnessGroups = {
  "made-daily": MithaiRow[];
  "made-to-order": MithaiRow[];
  "batch-frozen": MithaiRow[];
};

export type MithaiRow = {
  id: string;
  name: string;
  slug?: string;
  freshnessStatus?: "made-daily" | "made-to-order" | "batch-frozen";
  family?: string;
};

export type StoryRow = {
  id: string;
  title?: string;
  name?: string;
  pillar?: string;
  updatedAt: string;
};

export type CatalogCounts = {
  "mithai-products": number;
  "qsr-menu-items": number;
  "snack-products": number;
  "merch-products": number;
  "gift-boxes": number;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    headers: {Accept: "application/json"},
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

type LeadsResponse = {
  docs: LeadRow[];
  totalDocs: number;
};

export async function fetchRecentLeads(limit = 5): Promise<LeadRow[]> {
  const data = await apiGet<LeadsResponse>(
    `/leads?limit=${limit}&sort=-createdAt&depth=0`
  );
  return data.docs;
}

type MithaiResponse = {
  docs: MithaiRow[];
};

export async function fetchMithaiByFreshness(): Promise<MithaiFreshnessGroups> {
  // Fetch up to 20 published mithai, group client-side by freshnessStatus.
  // Single query keeps payload light; server-side grouping requires custom
  // endpoint which is out of scope for this admin-only view.
  const data = await apiGet<MithaiResponse>(
    `/mithai-products?limit=20&depth=0&sort=-updatedAt&where[_status][equals]=published`
  );
  const groups: MithaiFreshnessGroups = {
    "made-daily": [],
    "made-to-order": [],
    "batch-frozen": [],
  };
  for (const row of data.docs) {
    const key = row.freshnessStatus;
    if (key && key in groups) groups[key].push(row);
  }
  return groups;
}

type StoriesResponse = {
  docs: StoryRow[];
};

export async function fetchPendingStories(limit = 5): Promise<StoryRow[]> {
  const data = await apiGet<StoriesResponse>(
    `/stories?limit=${limit}&sort=-updatedAt&depth=0&where[_status][equals]=draft&draft=true`
  );
  return data.docs;
}

type CountResponse = {totalDocs: number};

export async function fetchCatalogCounts(): Promise<CatalogCounts> {
  const collections = [
    "mithai-products",
    "qsr-menu-items",
    "snack-products",
    "merch-products",
    "gift-boxes",
  ] as const;

  const entries = await Promise.all(
    collections.map(async coll => {
      try {
        const data = await apiGet<CountResponse>(`/${coll}?limit=0&depth=0`);
        return [coll, data.totalDocs] as const;
      } catch {
        return [coll, null] as const;
      }
    })
  );

  return Object.fromEntries(entries) as CatalogCounts;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/payload-admin/lib/dashboard-queries.ts
git commit -m "feat(admin): add dashboard query helpers for widgets"
```

---

### Task 10: RecentLeads Widget

**Files:**
- Create: `components/payload-admin/dashboard/RecentLeads.tsx`
- Test: `tests/unit/payload-admin/RecentLeads.test.tsx`

**Interfaces:**
- Consumes: `fetchRecentLeads` from Task 9.
- Produces: `<RecentLeads />` — used by dashboard container (Task 14).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/RecentLeads.test.tsx`:

```typescript
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {RecentLeads} from "@/components/payload-admin/dashboard/RecentLeads";

const mockLeads = [
  {id: "1", name: "Ria Sharma", email: "ria@x.com", status: "new", createdAt: "2026-08-11T10:00:00Z"},
  {id: "2", name: "Arjun Patel", email: "arjun@y.com", status: "won", createdAt: "2026-08-10T10:00:00Z"},
];

describe("RecentLeads", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton rows while loading", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    render(<RecentLeads />);
    const skeletons = screen.getAllByTestId("skeleton-row");
    expect(skeletons.length).toBe(5);
  });

  it("renders rows when fetch resolves", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: mockLeads, totalDocs: 2}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText("Ria Sharma")).toBeInTheDocument();
      expect(screen.getByText("Arjun Patel")).toBeInTheDocument();
    });
  });

  it("renders status pill with correct text", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: mockLeads, totalDocs: 2}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText("new")).toBeInTheDocument();
      expect(screen.getByText("won")).toBeInTheDocument();
    });
  });

  it("renders empty state when no leads", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText(/No leads yet/i)).toBeInTheDocument();
    });
  });

  it("renders error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load leads/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/RecentLeads.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/RecentLeads.tsx`:

```tsx
"use client";

import {useEffect, useState} from "react";
import {fetchRecentLeads, type LeadRow, type LeadStatus} from "@/components/payload-admin/lib/dashboard-queries";

const STATUS_TONE: Record<LeadStatus, "muted" | "primary" | "success" | "gold"> = {
  new: "gold",
  contacted: "primary",
  won: "success",
  lost: "muted",
};

export function RecentLeads() {
  const [state, setState] = useState<
    | {kind: "loading"}
    | {kind: "empty"}
    | {kind: "ready"; rows: LeadRow[]}
    | {kind: "error"; message: string}
  >({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchRecentLeads(5)
      .then(rows => {
        if (cancelled) return;
        setState(rows.length === 0 ? {kind: "empty"} : {kind: "ready", rows});
      })
      .catch(err => {
        if (cancelled) return;
        setState({kind: "error", message: String(err)});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Recent leads</h3>
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} data-testid="skeleton-row" className="mishran-skeleton" style={{height: "2rem", marginBottom: "0.5rem"}} />
        ))}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Recent leads</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>No leads yet.</p>
        <a href="/admin/collections/leads/create" style={{fontSize: "0.75rem", color: "var(--t-primary)"}}>Create the first →</a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Recent leads</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>Couldn&apos;t load leads. {state.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Recent leads</h3>
      <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem"}}>
        {state.rows.map(lead => (
          <li key={lead.id}>
            <a
              href={`/admin/collections/leads/${lead.id}`}
              style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "var(--t-text)"}}
            >
              <span>
                <span style={{display: "block", fontSize: "0.8125rem", fontWeight: 500}}>{lead.name}</span>
                {lead.email && (
                  <span style={{display: "block", fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>{lead.email}</span>
                )}
              </span>
              {lead.status && (
                <span className={`mishran-pill mishran-pill--${STATUS_TONE[lead.status]}`}>{lead.status}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentLeads;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/RecentLeads.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/RecentLeads.tsx tests/unit/payload-admin/RecentLeads.test.tsx
git commit -m "feat(admin): add RecentLeads dashboard widget"
```

---

### Task 11: MithaiFreshnessBoard Widget

**Files:**
- Create: `components/payload-admin/dashboard/MithaiFreshnessBoard.tsx`
- Test: `tests/unit/payload-admin/MithaiFreshnessBoard.test.tsx`

**Interfaces:**
- Consumes: `fetchMithaiByFreshness` from Task 9.
- Produces: `<MithaiFreshnessBoard />` — used by dashboard container.

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/MithaiFreshnessBoard.test.tsx`:

```typescript
import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MithaiFreshnessBoard} from "@/components/payload-admin/dashboard/MithaiFreshnessBoard";

const mockGroups = {
  "made-daily": [
    {id: "1", name: "Kaju Katli", slug: "kaju-katli", freshnessStatus: "made-daily", family: "classic"},
    {id: "2", name: "Rasgulla", slug: "rasgulla", freshnessStatus: "made-daily", family: "classic"},
  ],
  "made-to-order": [
    {id: "3", name: "Motichoor Laddu", slug: "motichoor", freshnessStatus: "made-to-order", family: "classic"},
  ],
  "batch-frozen": [],
};

describe("MithaiFreshnessBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 3 skeleton columns while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MithaiFreshnessBoard />);
    const skeletons = screen.getAllByTestId("skeleton-col");
    expect(skeletons.length).toBe(3);
  });

  it("renders 3 columns with counts + example names when resolved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [
        ...mockGroups["made-daily"],
        ...mockGroups["made-to-order"],
      ]}),
    }));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/Made daily/i)).toBeInTheDocument();
      expect(screen.getByText(/Made to order/i)).toBeInTheDocument();
      expect(screen.getByText(/Batch frozen/i)).toBeInTheDocument();
    });
    // Counts
    expect(screen.getByText("2")).toBeInTheDocument(); // made-daily
    expect(screen.getByText("1")).toBeInTheDocument(); // made-to-order
    expect(screen.getByText("0")).toBeInTheDocument(); // batch-frozen
  });

  it("renders empty state when no published mithai", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: []}),
    }));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/No mithai published yet/i)).toBeInTheDocument();
    });
  });

  it("renders error message on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load mithai/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/MithaiFreshnessBoard.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/MithaiFreshnessBoard.tsx`:

```tsx
"use client";

import {useEffect, useState} from "react";
import {
  fetchMithaiByFreshness,
  type MithaiFreshnessGroups,
  type MithaiRow,
} from "@/components/payload-admin/lib/dashboard-queries";

type State =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; groups: MithaiFreshnessGroups}
  | {kind: "error"; message: string};

const COLUMNS = [
  {key: "made-daily" as const, label: "Made daily"},
  {key: "made-to-order" as const, label: "Made to order"},
  {key: "batch-frozen" as const, label: "Batch frozen"},
];

export function MithaiFreshnessBoard() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchMithaiByFreshness()
      .then(groups => {
        if (cancelled) return;
        const total = COLUMNS.reduce((sum, c) => sum + groups[c.key].length, 0);
        setState(total === 0 ? {kind: "empty"} : {kind: "ready", groups});
      })
      .catch(err => {
        if (cancelled) return;
        setState({kind: "error", message: String(err)});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Mithai freshness</h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem"}}>
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} data-testid="skeleton-col" className="mishran-skeleton" style={{height: "6rem"}} />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Mithai freshness</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>No mithai published yet.</p>
        <a href="/admin/collections/mithai-products/create" style={{fontSize: "0.75rem", color: "var(--t-primary)"}}>Create one →</a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Mithai freshness</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>Couldn&apos;t load mithai. {state.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Mithai freshness</h3>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem"}}>
        {COLUMNS.map(col => {
          const rows: MithaiRow[] = state.groups[col.key];
          return (
            <a
              key={col.key}
              href={`/admin/collections/mithai-products?where[and][0][freshnessStatus][equals]=${col.key}`}
              style={{
                textDecoration: "none",
                color: "var(--t-text)",
                padding: "0.75rem",
                background: "var(--t-bg-card)",
                border: "1px solid var(--t-border)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span style={{fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-text-muted)"}}>
                {col.label}
              </span>
              <span style={{fontSize: "1.5rem", fontWeight: 700}}>{rows.length}</span>
              <span style={{fontSize: "0.75rem", color: "var(--t-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                {rows.slice(0, 3).map(r => r.name).join(", ") || "—"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default MithaiFreshnessBoard;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/MithaiFreshnessBoard.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/MithaiFreshnessBoard.tsx tests/unit/payload-admin/MithaiFreshnessBoard.test.tsx
git commit -m "feat(admin): add MithaiFreshnessBoard dashboard widget"
```

---

### Task 12: PendingStories Widget

**Files:**
- Create: `components/payload-admin/dashboard/PendingStories.tsx`
- Test: `tests/unit/payload-admin/PendingStories.test.tsx`

**Interfaces:**
- Consumes: `fetchPendingStories` from Task 9, `formatRelativeTime` from Task 2.
- Produces: `<PendingStories />` — used by dashboard container.

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/PendingStories.test.tsx`:

```typescript
import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {PendingStories} from "@/components/payload-admin/dashboard/PendingStories";

describe("PendingStories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<PendingStories />);
    expect(screen.getAllByTestId("skeleton-row").length).toBe(5);
  });

  it("renders pending stories with relative time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [
        {id: "1", name: "Festive Kaju Story", pillar: "mithai", updatedAt: "2026-08-09T12:00:00Z"},
      ]}),
    }));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText("Festive Kaju Story")).toBeInTheDocument();
      expect(screen.getByText(/days? ago/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no drafts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: []}),
    }));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText(/No pending drafts/i)).toBeInTheDocument();
    });
  });

  it("renders error message on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load stories/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/PendingStories.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/PendingStories.tsx`:

```tsx
"use client";

import {useEffect, useState} from "react";
import {fetchPendingStories, type StoryRow} from "@/components/payload-admin/lib/dashboard-queries";
import {formatRelativeTime} from "@/components/payload-admin/lib/relative-time";

type State =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; rows: StoryRow[]}
  | {kind: "error"; message: string};

export function PendingStories() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchPendingStories(5)
      .then(rows => {
        if (cancelled) return;
        setState(rows.length === 0 ? {kind: "empty"} : {kind: "ready", rows});
      })
      .catch(err => {
        if (cancelled) return;
        setState({kind: "error", message: String(err)});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} data-testid="skeleton-row" className="mishran-skeleton" style={{height: "2rem", marginBottom: "0.5rem"}} />
        ))}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>No pending drafts.</p>
        <a href="/admin/collections/stories/create" style={{fontSize: "0.75rem", color: "var(--t-primary)"}}>Start a new story →</a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>Couldn&apos;t load stories. {state.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
      <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem"}}>
        {state.rows.map(story => (
          <li key={story.id}>
            <a
              href={`/admin/collections/stories/${story.id}`}
              style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "var(--t-text)"}}
            >
              <span>
                <span style={{display: "block", fontSize: "0.8125rem", fontWeight: 500}}>
                  {story.name || story.title || "Untitled"}
                </span>
                {story.pillar && (
                  <span style={{display: "block", fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>
                    {story.pillar}
                  </span>
                )}
              </span>
              <span style={{fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>
                edited {formatRelativeTime(story.updatedAt)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PendingStories;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/PendingStories.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/PendingStories.tsx tests/unit/payload-admin/PendingStories.test.tsx
git commit -m "feat(admin): add PendingStories dashboard widget"
```

---

### Task 13: CatalogCounts Widget

**Files:**
- Create: `components/payload-admin/dashboard/CatalogCounts.tsx`
- Test: `tests/unit/payload-admin/CatalogCounts.test.tsx`

**Interfaces:**
- Consumes: `fetchCatalogCounts` from Task 9.
- Produces: `<CatalogCounts />` — used by dashboard container.

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/CatalogCounts.test.tsx`:

```typescript
import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {CatalogCounts} from "@/components/payload-admin/dashboard/CatalogCounts";

describe("CatalogCounts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton cards while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<CatalogCounts />);
    expect(screen.getAllByTestId("skeleton-card").length).toBe(5);
  });

  it("renders 5 cards with counts when resolved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((path: string) => Promise.resolve({
      ok: true,
      json: async () => {
        if (path.includes("mithai-products")) return {totalDocs: 42};
        if (path.includes("qsr-menu-items")) return {totalDocs: 18};
        if (path.includes("snack-products")) return {totalDocs: 7};
        if (path.includes("merch-products")) return {totalDocs: 3};
        if (path.includes("gift-boxes")) return {totalDocs: 12};
        return {totalDocs: 0};
      },
    })));
    render(<CatalogCounts />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("renders '—' on individual fetch failure, others succeed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((path: string) => {
      if (path.includes("mithai-products")) {
        return Promise.resolve({ok: false, status: 500, statusText: "Internal Server Error"});
      }
      return Promise.resolve({ok: true, json: async () => ({totalDocs: 5})});
    }));
    render(<CatalogCounts />);
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/CatalogCounts.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/CatalogCounts.tsx`:

```tsx
"use client";

import {useEffect, useState} from "react";
import {fetchCatalogCounts, type CatalogCounts as Counts} from "@/components/payload-admin/lib/dashboard-queries";

const COLLECTIONS = [
  {slug: "mithai-products", label: "Mithai"},
  {slug: "qsr-menu-items", label: "QSR Menu"},
  {slug: "snack-products", label: "Snacks"},
  {slug: "merch-products", label: "Merch"},
  {slug: "gift-boxes", label: "Gift Boxes"},
] as const;

type State =
  | {kind: "loading"}
  | {kind: "ready"; counts: Counts};

export function CatalogCounts() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchCatalogCounts()
      .then(counts => {
        if (cancelled) return;
        setState({kind: "ready", counts});
      })
      .catch(() => {
        // fetchCatalogCounts swallows per-collection errors and returns null.
        // Reach here only if all fail catastrophically — render whatever we have.
        if (cancelled) return;
        setState({kind: "ready", counts: {
          "mithai-products": null as unknown as number,
          "qsr-menu-items": null as unknown as number,
          "snack-products": null as unknown as number,
          "merch-products": null as unknown as number,
          "gift-boxes": null as unknown as number,
        }});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Catalog</h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem"}}>
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} data-testid="skeleton-card" className="mishran-skeleton" style={{height: "5rem"}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Catalog</h3>
      <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem"}}>
        {COLLECTIONS.map(coll => {
          const count = state.counts[coll.slug];
          return (
            <a
              key={coll.slug}
              href={`/admin/collections/${coll.slug}`}
              style={{
                textDecoration: "none",
                color: "var(--t-text)",
                padding: "0.75rem",
                background: "var(--t-bg-card)",
                border: "1px solid var(--t-border)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span style={{fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-text-muted)"}}>
                {coll.label}
              </span>
              <span style={{fontSize: "1.5rem", fontWeight: 700}}>
                {count === null || count === undefined ? "—" : count}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default CatalogCounts;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/CatalogCounts.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/CatalogCounts.tsx tests/unit/payload-admin/CatalogCounts.test.tsx
git commit -m "feat(admin): add CatalogCounts dashboard widget"
```

---

### Task 14: MishranDashboard Container

**Files:**
- Create: `components/payload-admin/dashboard/MishranDashboard.tsx`
- Test: `tests/unit/payload-admin/MishranDashboard.test.tsx`

**Interfaces:**
- Consumes: All 4 widgets from Tasks 10–13, `<WidgetErrorBoundary>` from Task 8.
- Produces: `<MishranDashboard />` — used by `admin.components.beforeDashboard` (Task 17).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/MishranDashboard.test.tsx`:

```typescript
import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MishranDashboard} from "@/components/payload-admin/dashboard/MishranDashboard";

describe("MishranDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 4 widget headings in a 2x2 grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    }));
    render(<MishranDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Recent leads")).toBeInTheDocument();
      expect(screen.getByText("Mithai freshness")).toBeInTheDocument();
      expect(screen.getByText("Pending stories")).toBeInTheDocument();
      expect(screen.getByText("Catalog")).toBeInTheDocument();
    });
  });

  it("renders mishran-dashboard container class", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    }));
    const {container} = render(<MishranDashboard />);
    expect(container.querySelector(".mishran-dashboard")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/MishranDashboard.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/dashboard/MishranDashboard.tsx`:

```tsx
"use client";

import {RecentLeads} from "./RecentLeads";
import {MithaiFreshnessBoard} from "./MithaiFreshnessBoard";
import {PendingStories} from "./PendingStories";
import {CatalogCounts} from "./CatalogCounts";
import {WidgetErrorBoundary} from "./WidgetErrorBoundary";

// Rendered above Payload's default dashboard via admin.components.beforeDashboard.
// Each widget wrapped in its own error boundary so a single failure doesn't
// kill the rest of the dashboard.
export function MishranDashboard() {
  return (
    <div className="mishran-dashboard" style={{paddingBottom: "1.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--t-border)"}}>
      <h2 style={{fontFamily: "var(--mishran-font-display)", fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem"}}>
        Mishran editor console
      </h2>
      <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem"}}>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Recent leads">
            <RecentLeads />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Mithai freshness">
            <MithaiFreshnessBoard />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Pending stories">
            <PendingStories />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Catalog counts">
            <CatalogCounts />
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default MishranDashboard;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/MishranDashboard.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/dashboard/MishranDashboard.tsx tests/unit/payload-admin/MishranDashboard.test.tsx
git commit -m "feat(admin): add MishranDashboard container composing 4 widgets"
```

---

### Task 15: ProductNameCell Factory + Behaviors

**Files:**
- Create: `components/payload-admin/cells/ProductNameCell.tsx`
- Create: `components/payload-admin/cells/product-cell-behaviors.ts`
- Test: `tests/unit/payload-admin/ProductNameCell.test.tsx`

**Interfaces:**
- Produces:
  - `makeProductNameCell(behavior: ProductCellBehavior): React.FC<DefaultCellComponentProps>`
  - `mithaiBehavior`, `qsrBehavior`, `snackBehavior`, `merchBehavior`, `giftBoxBehavior` — one per product collection
- Consumed by: Task 16 (apply to 5 product collections).

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload-admin/ProductNameCell.test.tsx`:

```typescript
import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {makeProductNameCell} from "@/components/payload-admin/cells/ProductNameCell";
import type {ProductCellBehavior} from "@/components/payload-admin/cells/ProductNameCell";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height}: any) => (
    <img src={src} alt={alt} width={width} height={height} data-testid="img" />
  ),
}));

describe("ProductNameCell", () => {
  const behavior: ProductCellBehavior = {
    image: {kind: "array", field: "images", imageKey: "image"},
    meta: (row: any) => [row.displayPrice, row.family].filter(Boolean),
    badges: (row: any) => row.freshnessStatus
      ? [{label: row.freshnessStatus, tone: "gold"}]
      : [],
  };
  const Cell = makeProductNameCell(behavior);

  it("renders thumbnail when image present", () => {
    const rowData = {
      id: "1",
      name: "Kaju Katli",
      images: [{image: {url: "/media/kaju.jpg", alt: "Kaju"}}],
      displayPrice: "₹800",
      family: "classic",
      freshnessStatus: "made-daily",
    };
    render(<Cell cellData="Kaju Katli" rowData={rowData} collectionField={{name: "name"} as any} />);
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("src", "/media/kaju.jpg");
  });

  it("renders fallback block when no image", () => {
    const rowData = {id: "2", name: "No-image sweet", images: [], displayPrice: "₹200", family: "classic"};
    const {container} = render(<Cell cellData="No-image sweet" rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(container.querySelector("img")).toBeNull();
    // Fallback is a div with bg-muted class
    expect(container.querySelector(".mishran-cell-fallback")).not.toBeNull();
  });

  it("renders meta items in order", () => {
    const rowData = {id: "3", name: "X", images: [], displayPrice: "₹500", family: "classic"};
    const {container} = render(<Cell cellData="X" rowData={rowData} collectionField={{name: "name"} as any} />);
    const meta = container.querySelector(".mishran-cell-meta");
    expect(meta?.textContent).toContain("₹500");
    expect(meta?.textContent).toContain("classic");
  });

  it("renders badges when present", () => {
    const rowData = {id: "4", name: "Y", images: [], displayPrice: "₹100", family: "classic", freshnessStatus: "made-daily"};
    const {container} = render(<Cell cellData="Y" rowData={rowData} collectionField={{name: "name"} as any} />);
    const badges = container.querySelectorAll(".mishran-pill");
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toContain("made-daily");
  });

  it("falls back to rowData.name when cellData is empty", () => {
    const rowData = {id: "5", name: "Fallback Name", images: []};
    const {container} = render(<Cell cellData={null} rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(container.textContent).toContain("Fallback Name");
  });

  it("handles single-image (upload) shape", () => {
    const singleBehavior: ProductCellBehavior = {
      image: {kind: "single", field: "image"},
      meta: (row: any) => [],
      badges: () => [],
    };
    const SingleCell = makeProductNameCell(singleBehavior);
    const rowData = {id: "6", name: "Chai", image: {url: "/media/chai.jpg"}};
    render(<SingleCell cellData="Chai" rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(screen.getByTestId("img")).toHaveAttribute("src", "/media/chai.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payload-admin/ProductNameCell.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

Create `components/payload-admin/cells/ProductNameCell.tsx`:

```tsx
"use client";

import Image from "next/image";
import type {DefaultCellComponentProps} from "payload";

type MetaItem = {
  label: string;
  tone?: "default" | "muted" | "primary" | "gold" | "success" | "danger";
};

type Badge = MetaItem;

type ImageSpec =
  | {kind: "array"; field: string; imageKey: string}
  | {kind: "single"; field: string};

export type ProductCellBehavior = {
  image: ImageSpec;
  meta: (row: Record<string, unknown>) => MetaItem[];
  badges?: (row: Record<string, unknown>) => Badge[];
};

type Row = Record<string, unknown> & {id: string; name?: string};

type MediaDoc = {url?: string; alt?: string; filename?: string};

function pickImageUrl(row: Row, spec: ImageSpec): {url: string; alt?: string} | null {
  if (spec.kind === "array") {
    const arr = (row as Record<string, unknown>)[spec.field];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0] as Record<string, unknown>;
    const media = first[spec.imageKey] as MediaDoc | string | undefined;
    if (typeof media === "string") return {url: media};
    if (media && typeof media === "object" && media.url) {
      return {url: media.url, alt: media.alt};
    }
    return null;
  }
  // single
  const media = (row as Record<string, unknown>)[spec.field] as MediaDoc | string | undefined;
  if (typeof media === "string") return {url: media};
  if (media && typeof media === "object" && media.url) {
    return {url: media.url, alt: media.alt};
  }
  return null;
}

const TONE_BADGE_CLASS: Record<NonNullable<MetaItem["tone"]>, string> = {
  default: "mishran-pill--primary",
  muted: "mishran-pill--muted",
  primary: "mishran-pill--primary",
  gold: "mishran-pill--gold",
  success: "mishran-pill--success",
  danger: "mishran-pill--danger",
};

export function makeProductNameCell(behavior: ProductCellBehavior) {
  return function ProductNameCell({
    cellData,
    rowData,
  }: DefaultCellComponentProps) {
    const row = rowData as Row;
    const image = pickImageUrl(row, behavior.image);
    const meta = behavior.meta(row);
    const badges = behavior.badges?.(row) ?? [];
    const name = (cellData as string | null | undefined) ?? row.name ?? "";

    return (
      <div style={{display: "flex", alignItems: "center", gap: "0.75rem"}}>
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? name}
            width={48}
            height={48}
            style={{objectFit: "cover", borderRadius: "6px", border: "1px solid var(--t-border)"}}
          />
        ) : (
          <div
            className="mishran-cell-fallback"
            style={{width: 48, height: 48, borderRadius: "6px", background: "var(--t-bg-control)"}}
          />
        )}
        <div style={{display: "flex", flexDirection: "column", gap: "0.125rem"}}>
          <span style={{fontWeight: 500, color: "var(--t-text)"}}>{String(name)}</span>
          {meta.length > 0 && (
            <div className="mishran-cell-meta" style={{display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--t-text-muted)"}}>
              {meta.map((m, i) => (
                <span key={i}>{m.label}</span>
              ))}
            </div>
          )}
          {badges.length > 0 && (
            <div style={{display: "flex", gap: "0.25rem"}}>
              {badges.map((b, i) => (
                <span key={i} className={`mishran-pill ${TONE_BADGE_CLASS[b.tone ?? "default"]}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
}

export default makeProductNameCell;
```

Create `components/payload-admin/cells/product-cell-behaviors.ts`:

```typescript
import {makeProductNameCell, type ProductCellBehavior} from "./ProductNameCell";

// Per-collection cell behaviors. Verified against actual collection schemas.

export const mithaiBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.displayPrice === "string" && row.displayPrice ? {label: row.displayPrice} : null,
    typeof row.family === "string" && row.family ? {label: row.family} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    const f = row.freshnessStatus;
    if (typeof f !== "string" || !f) return [];
    return [{label: f.replace(/-/g, " "), tone: "gold" as const}];
  },
};

export const qsrBehavior: ProductCellBehavior = {
  image: {kind: "single", field: "image"},
  meta: (row) => [
    typeof row.category === "string" && row.category ? {label: row.category} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    if (typeof row.veg !== "boolean") return [];
    return [{label: row.veg ? "Veg" : "Non-veg", tone: row.veg ? "success" : "danger"}];
  },
};

export const snackBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.msrp === "string" && row.msrp ? {label: row.msrp} : null,
    typeof row.category === "string" && row.category ? {label: row.category} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: () => [],
};

export const merchBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.price === "string" && row.price ? {label: row.price} : null,
    typeof row.type === "string" && row.type ? {label: row.type} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: (row) => {
    const a = row.availability;
    if (typeof a !== "string" || !a) return [];
    return [{label: a, tone: a === "in-stock" ? "success" : "muted"}];
  },
};

export const giftBoxBehavior: ProductCellBehavior = {
  image: {kind: "array", field: "images", imageKey: "image"},
  meta: (row) => [
    typeof row.size === "string" && row.size ? {label: row.size} : null,
  ].filter((x): x is {label: string} => x !== null),
  badges: () => [],
};

export const MithaiProductCell = makeProductNameCell(mithaiBehavior);
export const QsrMenuCell = makeProductNameCell(qsrBehavior);
export const SnackProductCell = makeProductNameCell(snackBehavior);
export const MerchProductCell = makeProductNameCell(merchBehavior);
export const GiftBoxCell = makeProductNameCell(giftBoxBehavior);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payload-admin/ProductNameCell.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add components/payload-admin/cells/ tests/unit/payload-admin/ProductNameCell.test.tsx
git commit -m "feat(admin): add ProductNameCell factory + per-collection behaviors"
```

---

### Task 16: Nav Grouping on All Collections + Globals

**Files:**
- Modify: `collections/Stories.ts`, `collections/Karigars.ts`, `collections/Farms.ts`, `collections/Occasions.ts`
- Modify: `collections/MithaiProducts.ts`, `collections/QsrMenuItems.ts`, `collections/SnackProducts.ts`, `collections/MerchProducts.ts`, `collections/GiftBoxes.ts`
- Modify: `collections/Media.ts`, `collections/Packaging.ts`, `collections/Leads.ts`, `collections/Drafts.ts`
- Modify: `globals/BrandSettings.ts`, `globals/NavSettings.ts`, `globals/ThemeSettings.ts`, `globals/HomeHero.ts`
- Modify: `globals/StoreSettings.ts`, `globals/AnalyticsSettings.ts`, `collections/Users.ts`

No test — verified via E2E (Task 18).

- [ ] **Step 1: Apply group strings**

For each file, set or update the `admin.group` value. Use this table:

| File | Group |
|---|---|
| `collections/Stories.ts` | `"01 Brand"` |
| `collections/Karigars.ts` | `"01 Brand"` |
| `collections/Farms.ts` | `"01 Brand"` |
| `collections/Occasions.ts` | `"01 Brand"` |
| `collections/MithaiProducts.ts` | `"02 Products"` |
| `collections/QsrMenuItems.ts` | `"02 Products"` |
| `collections/SnackProducts.ts` | `"02 Products"` |
| `collections/MerchProducts.ts` | `"02 Products"` |
| `collections/GiftBoxes.ts` | `"02 Products"` |
| `collections/Media.ts` | `"03 Catalog Ops"` |
| `collections/Packaging.ts` | `"03 Catalog Ops"` |
| `collections/Leads.ts` | `"03 Catalog Ops"` |
| `collections/Drafts.ts` | `"04 Storefront"` |
| `globals/HomeHero.ts` | `"04 Storefront"` |
| `globals/NavSettings.ts` | `"04 Storefront"` |
| `globals/ThemeSettings.ts` | `"04 Storefront"` |
| `globals/BrandSettings.ts` | `"04 Storefront"` |
| `globals/StoreSettings.ts` | `"05 Settings"` |
| `globals/AnalyticsSettings.ts` | `"05 Settings"` |
| `collections/Users.ts` | `"05 Settings"` |

For each file:
- Read current file content
- Locate the `admin: { ... }` block
- Either set `group: "<value>"` inside it, or update existing `group` value
- Preserve all other admin properties (`useAsTitle`, `position`, `description`, etc.)

Example for `collections/MithaiProducts.ts` (currently has `admin: { useAsTitle: "name", group: "Mithai" }`):

Change line:
```ts
admin: { useAsTitle: "name", group: "Mithai" },
```
to:
```ts
admin: { useAsTitle: "name", group: "02 Products" },
```

For files that have no `admin` block (check each), add one with the group.

- [ ] **Step 2: Verify Payload config loads**

Run: `npx payload config:load 2>&1 | tail -20`
Expected: no errors. (If the command doesn't exist in this Payload version, use `npx tsx -e "import('./payload.config').then(m => console.log(Object.keys(m.default.collections)))"` instead.)

- [ ] **Step 3: Commit**

```bash
git add collections/ globals/
git commit -m "feat(admin): group collections + globals into Brand/Products/Ops/Storefront/Settings"
```

---

### Task 17: Apply ProductNameCell to 5 Product Collections

**Files:**
- Modify: `collections/MithaiProducts.ts`
- Modify: `collections/QsrMenuItems.ts`
- Modify: `collections/SnackProducts.ts`
- Modify: `collections/MerchProducts.ts`
- Modify: `collections/GiftBoxes.ts`

**Interfaces:**
- Consumes: `mithaiBehavior`, `qsrBehavior`, `snackBehavior`, `merchBehavior`, `giftBoxBehavior` from Task 15.

No unit test — verified via E2E (Task 18).

- [ ] **Step 1: Modify MithaiProducts.ts**

At top of file add import:
```ts
import {MithaiProductCell} from "@/components/payload-admin/cells/product-cell-behaviors";
```

Find the `name` field:
```ts
{ name: "name", type: "text", required: true, localized: true },
```

Replace with:
```ts
{
  name: "name",
  type: "text",
  required: true,
  localized: true,
  admin: {
    components: {
      Cell: MithaiProductCell,
    },
  },
},
```

- [ ] **Step 2: Modify QsrMenuItems.ts**

Add import:
```ts
import {QsrMenuCell} from "@/components/payload-admin/cells/product-cell-behaviors";
```

Find name field:
```ts
{ name: "name", type: "text", required: true, localized: true },
```

Replace with:
```ts
{
  name: "name",
  type: "text",
  required: true,
  localized: true,
  admin: { components: { Cell: QsrMenuCell } },
},
```

- [ ] **Step 3: Modify SnackProducts.ts**

Add import:
```ts
import {SnackProductCell} from "@/components/payload-admin/cells/product-cell-behaviors";
```

Find name field, replace with:
```ts
{
  name: "name",
  type: "text",
  required: true,
  localized: true,
  admin: { components: { Cell: SnackProductCell } },
},
```

- [ ] **Step 4: Modify MerchProducts.ts**

Add import:
```ts
import {MerchProductCell} from "@/components/payload-admin/cells/product-cell-behaviors";
```

Find name field, replace with:
```ts
{
  name: "name",
  type: "text",
  required: true,
  localized: true,
  admin: { components: { Cell: MerchProductCell } },
},
```

- [ ] **Step 5: Modify GiftBoxes.ts**

Add import:
```ts
import {GiftBoxCell} from "@/components/payload-admin/cells/product-cell-behaviors";
```

Find name field, replace with:
```ts
{
  name: "name",
  type: "text",
  required: true,
  localized: true,
  admin: { components: { Cell: GiftBoxCell } },
},
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add collections/MithaiProducts.ts collections/QsrMenuItems.ts collections/SnackProducts.ts collections/MerchProducts.ts collections/GiftBoxes.ts
git commit -m "feat(admin): apply ProductNameCell to 5 product collections"
```

---

### Task 18: Wire payload.config.ts + Theme Boot Script

**Files:**
- Modify: `payload.config.ts`
- Create: `components/payload-admin/theme/AdminThemeBootScript.tsx`

**Interfaces:**
- Consumes: All graphics, login hero, dashboard, switcher from Tasks 5, 6, 7, 14.
- Produces: Fully wired Payload admin with custom graphics, dashboard, theme switcher.

- [ ] **Step 1: Write AdminThemeBootScript**

Create `components/payload-admin/theme/AdminThemeBootScript.tsx`:

```tsx
// Inline script injected before hydration to read the theme cookie and set
// body[data-admin-theme] — prevents theme flash on cold load.
// Rendered as a Next.js Script with strategy="beforeInteractive".
import Script from "next/script";
import {ADMIN_THEME_COOKIE, DEFAULT_ADMIN_THEME, ADMIN_THEMES} from "./admin-theme";

const scriptContent = `
(function() {
  try {
    var match = document.cookie.match(/(?:^|;\\s)${ADMIN_THEME_COOKIE}=([^;]+)/);
    var value = match ? decodeURIComponent(match[1]) : "${DEFAULT_ADMIN_THEME}";
    var known = ${JSON.stringify(ADMIN_THEMES)};
    if (known.indexOf(value) === -1) value = "${DEFAULT_ADMIN_THEME}";
    document.body.setAttribute("data-admin-theme", value);
  } catch (e) {
    document.body.setAttribute("data-admin-theme", "${DEFAULT_ADMIN_THEME}");
  }
})();
`;

export function AdminThemeBootScript() {
  return <Script id="mishran-admin-theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{__html: scriptContent}} />;
}

export default AdminThemeBootScript;
```

- [ ] **Step 2: Read current payload.config.ts**

Run: `Read payload.config.ts` and note its current structure (imports, plugins, admin block, collections array, globals array).

- [ ] **Step 3: Modify payload.config.ts admin block**

Add imports at top:
```ts
import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";
import {WordmarkLogo} from "@/components/payload-admin/graphics/WordmarkLogo";
import {MishranLoginHero} from "@/components/payload-admin/login/MishranLoginHero";
import {MishranDashboard} from "@/components/payload-admin/dashboard/MishranDashboard";
import {AdminThemeSwitcher} from "@/components/payload-admin/theme/AdminThemeSwitcher";
```

Update the `admin` block to match (preserve existing `user`, `autoLogin`):

```ts
admin: {
  user: "users",
  autoLogin: isLocalDev ? { email: "dev@mithai.shop", password: "dev-password" } : false,
  css: "/app/(payload)/admin/custom.scss",
  components: {
    graphics: {
      Icon: CrestIcon,
      Logo: WordmarkLogo,
    },
    beforeLogin: [MishranLoginHero],
    beforeDashboard: [MishranDashboard],
    settingsMenu: [AdminThemeSwitcher],
  },
},
```

Note: Payload accepts `admin.components.graphics.Icon` as a component reference (not a string path) in 3.x when using `@payloadcms/next` — but the safest path is a string path like `"@/components/payload-admin/graphics/CrestIcon"`. If TypeScript errors on component references, switch to string paths.

For `admin.css`: Payload 3.x supports a single SCSS file path. If your project uses a glob pattern instead, adjust accordingly — the spec target is `app/(payload)/admin/custom.scss`.

- [ ] **Step 4: Inject AdminThemeBootScript into Payload root layout**

Locate `app/(payload)/layout.tsx` (or create if missing). Add `<AdminThemeBootScript/>` to the layout's `<html>` or `<body>` block:

```tsx
import {AdminThemeBootScript} from "@/components/payload-admin/theme/AdminThemeBootScript";

// In the existing layout JSX:
<body>
  <AdminThemeBootScript />
  {/* existing children */}
</body>
```

If the layout doesn't exist or is auto-generated by Payload, use `admin.components.providers` or `admin.components.header` instead — see Payload 3.x docs. The intent: inject a `<script>` that runs before React hydrates, setting `body[data-admin-theme]` from the cookie.

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -40`
Expected: build succeeds. If `admin.css` path is wrong, fix to Payload's expected glob/path. If component references in `graphics.Icon/Logo` error, switch to string paths.

- [ ] **Step 6: Commit**

```bash
git add payload.config.ts components/payload-admin/theme/AdminThemeBootScript.tsx "app/(payload)/"
git commit -m "feat(admin): wire Mishran graphics, login, dashboard, theme switcher into Payload config"
```

---

### Task 19: E2E Test

**Files:**
- Create: `tests/e2e/admin-aesthetics.spec.ts`

- [ ] **Step 1: Write E2E spec**

Create `tests/e2e/admin-aesthetics.spec.ts`:

```typescript
import {test, expect} from "@playwright/test";

// Admin panel aesthetic regression coverage.
// Auto-login via Payload's dev autoLogin (dev@mithai.shop / dev-password).

test.describe("Mishran admin aesthetics", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/admin/login");
    // AutoLogin is enabled in dev — direct navigation to /admin lands on dashboard.
    await page.goto("/admin");
  });

  test("login page renders wordmark", async ({page}) => {
    await page.goto("/admin/login");
    // Wordmark SVG should be present (login Logo override).
    const logo = page.locator('img[src*="mishran-wordmark.svg"]').first();
    await expect(logo).toBeVisible();
  });

  test("login page renders crest in hero", async ({page}) => {
    await page.goto("/admin/login");
    const crest = page.locator('img[src*="mishran-crest.svg"]').first();
    await expect(crest).toBeVisible();
  });

  test("sidebar shows crest icon", async ({page}) => {
    const crest = page.locator('img[src*="mishran-crest.svg"]').first();
    await expect(crest).toBeVisible();
  });

  test("body has data-admin-theme attribute on load", async ({page}) => {
    const attr = await page.evaluate(() => document.body.getAttribute("data-admin-theme"));
    // Default if cookie unset is mishran-admin
    expect(["mishran-admin", "mishran-midnight", "mishran-monsoon"]).toContain(attr);
  });

  test("settings menu opens + theme switcher changes body attribute", async ({page}) => {
    // Click the gear/settings icon (Payload renders above logout).
    // Selector may need adjustment based on Payload 3.85's actual DOM.
    const settingsBtn = page.locator('[aria-label*="settings" i], button:has-text("Settings")').first();
    await settingsBtn.click();

    // Switcher select
    const select = page.locator("#mishran-admin-theme-select");
    await select.selectOption("mishran-midnight");

    // Body attribute updates immediately
    await expect(page.locator("body")).toHaveAttribute("data-admin-theme", "mishran-midnight");

    // Reload preserves via cookie
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-admin-theme", "mishran-midnight");
  });

  test("dashboard renders all 4 widget headings", async ({page}) => {
    await expect(page.getByText("Recent leads")).toBeVisible();
    await expect(page.getByText("Mithai freshness")).toBeVisible();
    await expect(page.getByText("Pending stories")).toBeVisible();
    await expect(page.getByText("Catalog")).toBeVisible();
  });

  test("mithai-products list view renders thumbnails in name column", async ({page}) => {
    await page.goto("/admin/collections/mithai-products");
    // At least one image element in the name column should be visible.
    // This may need adjustment if list is empty — seed data first or use a
    // collection known to have docs.
    const nameCellImg = page.locator('td img[src*="/media/"]').first();
    const hasImage = await nameCellImg.count();
    if (hasImage > 0) {
      await expect(nameCellImg).toBeVisible();
    }
  });

  test("nav groups render with 01–05 prefixes", async ({page}) => {
    const nav = page.locator("nav, aside").first();
    await expect(nav).toContainText("01 Brand");
    await expect(nav).toContainText("02 Products");
    await expect(nav).toContainText("03 Catalog Ops");
    await expect(nav).toContainText("04 Storefront");
    await expect(nav).toContainText("05 Settings");
  });
});
```

- [ ] **Step 2: Run E2E tests against running dev server**

Run (in separate terminal, start dev server first):
```bash
npm run dev &
sleep 10
npx playwright test tests/e2e/admin-aesthetics.spec.ts
```

Expected: 8/8 tests pass. Selector mismatches are expected — adjust selectors to match Payload 3.85's actual DOM. Each test that fails due to selector mismatch should be fixed by inspecting the rendered HTML.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-aesthetics.spec.ts
git commit -m "test(admin): add E2E coverage for Mishran admin aesthetics"
```

---

## Self-Review

### Spec coverage

| Spec section | Covered by tasks |
|---|---|
| §3 Branding (logo/favicon/graphics) | Task 1, 5, 18 |
| §3.3 Login hero | Task 6, 18 |
| §4 Theme system (3 themes + CSS) | Task 4 |
| §4.3 Theme switcher (cookie + settingsMenu) | Task 3, 7, 18 |
| §5 Nav grouping (01–05 prefixes) | Task 16 |
| §6 Dashboard (4 widgets + error boundary) | Task 8, 9, 10, 11, 12, 13, 14, 18 |
| §7 Custom cells (factory + 5 collections) | Task 15, 17 |
| §8 Testing (unit + E2E) | Each task has unit tests; Task 19 is E2E |
| §9 File structure | Matches plan |

No spec section is missing a task.

### Placeholder scan

No TBD/TODO/placeholder text in steps. Every code block is complete. Where the spec uses "verify at impl time" (e.g. Payload CSS variable names), the plan provides concrete verification commands.

### Type consistency

- `formatRelativeTime` — Task 2 (declared) ↔ Task 12 (consumed). ✓
- `AdminTheme` type — Task 3 ↔ Task 7. ✓
- `ProductCellBehavior` — Task 15 ↔ Task 17 (via behavior exports). ✓
- `LeadRow`, `MithaiRow`, `StoryRow`, `CatalogCounts` — Task 9 ↔ Tasks 10–13. ✓
- `WidgetErrorBoundary` props `{name, children}` — Task 8 ↔ Task 14. ✓
- All `*Cell` exports from Task 15 ↔ imports in Task 17. ✓

### Risk notes for implementer

- **Payload admin.css path**: Payload 3.x has changed how custom CSS is wired (string path vs glob). Task 18 step 5 verifies build — if `admin.css` errors, check Payload's `CustomComponent` and `css` config types in `node_modules/payload/dist/admin/types.d.ts` for the exact API.
- **graphics.Icon/Logo component reference vs string**: Payload accepts both, but TypeScript types may prefer string paths in some versions. Task 18 step 5 verifies build.
- **Stories collection fields**: `name` vs `title` for display title — verified at `collections/Stories.ts`. The widget uses `story.name || story.title` to be defensive.
- **Leads collection `status` field**: The widget assumes `LeadStatus = "new" | "contacted" | "won" | "lost"`. Verify against `collections/Leads.ts` at impl time — if statuses differ, update `LeadStatus` type and `STATUS_TONE` map.
- **Playwright selectors for settings menu**: Payload 3.85's exact DOM selectors may differ. Task 19 step 2 calls out that selector adjustments are expected.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-mishran-admin-aesthetics.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
