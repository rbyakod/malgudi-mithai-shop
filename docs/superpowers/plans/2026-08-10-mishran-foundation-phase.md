# Mishran Foundation Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 0 Foundation for the Mishran Digital Flagship: locked theme system, trimmed locale set, Payload CMS install, brand shared collections, one product collection per vertical, lead capture, brand-home redesign, vertical landing pages, sample PDPs, analytics, SEO, and Vercel deploy.

**Architecture:** Next.js 16 App Router + TypeScript + Tailwind v4 stays as the front-end. Payload CMS embeds inside the same Next app via `payload.config.ts`, backed by MongoDB (Atlas M0). Locale routing preserved (`/[locale]/...`), active locales `en`, `hi`, `kn`. Theme switcher collapsed to 4 locked themes. Commerce deferred — `/cart`, `/checkout`, `/account`, `/track-order` are branded stubs with WhatsApp + lead CTA. Cart persists client-side as today (draft state only).

**Tech Stack:** Next.js 16.2.3, next-intl 4.9.1, Payload 3.x, MongoDB (Atlas), TanStack Query 5.x, Resend (email), Sonner (toasts), Radix UI (primitives), Vitest, @testing-library/react, @playwright/test, axe-core, sharp, Vercel (Fluid Compute).

## Global Constraints

- **Themes:** locked to 4 — `mishran-default` (new), `diwali-saffron` (alias of legacy `festive`), `wedding-heritage` (alias of legacy `heritage`), `everyday-sage` (alias of legacy `sage`). All other themes archived on git branch `archive/design-systems-pre-collapse` before deletion.
- **Active locales:** `en`, `hi`, `kn` only. Other locale files (`es`, `fr`, `ta`, `te`, `bn`, `mr`, `gu`) deleted; locales re-added in later phases.
- **Commerce:** no live checkout. Cart is draft state. `/cart`, `/checkout`, `/account`, `/track-order` render branded stubs with lead CTA.
- **CMS:** Payload 3.x with MongoDB adapter. Admin mounted at `/admin`. Localized fields fall back to `en`.
- **Display prices:** `displayPrice` on products is display-only, never transacted.
- **Email:** Resend; templates in `lib/email/`. Free tier (3k/mo).
- **Analytics:** GA4 + Meta Pixel. All events via `lib/analytics.ts` `track()` helper. Scripts defer until after hydration.
- **A11y:** WCAG AA contrast validated per theme. Semantic landmarks. Skip-to-content on every page.
- **Tests:** Vitest (unit + integration), Playwright (E2E + axe), Lighthouse CI (≥90 on home, mithai hub, sample PDP).
- **Commits:** Conventional commits (`feat:`, `chore:`, `refactor:`, `test:`, `docs:`). One logical change per commit.
- **Env vars:** `MONGODB_URI`, `PAYLOAD_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER`.

---

## File Structure

```
mithai-shop/
├── app/
│   ├── [locale]/
│   │   ├── (site)/                  # Marketing shell
│   │   │   ├── page.tsx             # Brand home
│   │   │   ├── mithai/
│   │   │   │   ├── page.tsx         # Mithai hub
│   │   │   │   └── [slug]/page.tsx  # Sample PDP
│   │   │   ├── qsr/page.tsx
│   │   │   ├── snacks/page.tsx
│   │   │   ├── merch/page.tsx
│   │   │   ├── stories/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── weddings/page.tsx
│   │   │   ├── corporate/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   └── contact/page.tsx
│   │   ├── (commerce)/              # Stubs
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── account/page.tsx
│   │   │   └── track-order/page.tsx
│   │   ├── layout.tsx               # Hreflang metadata
│   │   └── not-found.tsx
│   ├── admin/[[...segments]]/page.tsx  # Payload admin mount
│   ├── api/
│   │   ├── leads/route.ts
│   │   ├── drafts/route.ts
│   │   ├── search/route.ts
│   │   └── revalidate/route.ts      # Payload webhook
│   ├── layout.tsx                   # Root: providers, GA4/Pixel, theme script
│   ├── sitemap.ts
│   ├── robots.ts
│   └── globals.css
├── collections/                     # Payload schemas
│   ├── Stories.ts
│   ├── Karigars.ts
│   ├── Farms.ts
│   ├── Packaging.ts
│   ├── Occasions.ts
│   ├── MithaiProducts.ts
│   ├── GiftBoxes.ts
│   ├── QsrMenuItems.ts
│   ├── SnackProducts.ts
│   ├── MerchProducts.ts
│   ├── Leads.ts
│   └── Drafts.ts
├── globals/                         # Payload globals
│   ├── BrandSettings.ts
│   ├── NavSettings.ts
│   ├── ThemeSettings.ts
│   ├── AnalyticsSettings.ts
│   └── StoreSettings.ts
├── payload-blocks/                  # richText blocks (Phase 1 depth; stub for now)
├── payload.config.ts
├── payload-types.ts                 # Generated
├── components/
│   ├── layout/
│   │   ├── SiteHeader.tsx
│   │   ├── SiteFooter.tsx
│   │   └── BrandBar.tsx
│   ├── home/
│   │   ├── BrandHero.tsx
│   │   ├── VerticalPortals.tsx
│   │   └── Pillars.tsx
│   ├── ui/                          # Primitives
│   ├── ledger/
│   │   ├── LeadForm.tsx
│   │   ├── WeddingConfigurator.tsx
│   │   └── CorporateConfigurator.tsx
│   └── stories/
│       └── StoryCard.tsx
├── context/
│   ├── CartContext.tsx              # Existing
│   ├── ThemeContext.tsx             # Existing, modified
│   └── QueryProvider.tsx            # TanStack Query
├── lib/
│   ├── payload-client.ts
│   ├── analytics.ts
│   ├── email.ts
│   ├── seo.ts                       # Schema.org helpers
│   └── themes.ts                    # Existing, modified
├── i18n/
│   ├── routing.ts                   # Trimmed locales
│   ├── request.ts                   # Existing
│   └── navigation.ts                # Existing
├── messages/
│   ├── en.json
│   ├── hi.json
│   └── kn.json
├── tests/
│   ├── e2e/                         # Playwright
│   ├── unit/                        # Vitest
│   └── integration/                 # Vitest + Payload memory DB
├── lighthouserc.json
├── vercel.ts
└── package.json
```

---

## Task 1: Tooling setup — dependencies, scripts, test runners

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/unit/` and `tests/e2e/` directories (with `.gitkeep`)
- Create: `lighthouserc.json`
- Modify: `.gitignore` (add `.lhci/`, `playwright-report/`, `test-results/`)

**Interfaces:**
- Consumes: existing Next.js + Tailwind setup
- Produces: `npm run test:unit`, `npm run test:e2e`, `npm run lhci` scripts; Vitest config with jsdom env; Playwright config base URL `http://localhost:3000`

- [ ] **Step 1: Write failing test that confirms Vitest is wired**

Create `tests/unit/sample.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("tooling smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run tests/unit/sample.test.ts`
Expected: FAIL with "Cannot find module 'vitest'" or no config.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test axe-core @axe-core/playwright lighthouse @lhci/cli
```

- [ ] **Step 4: Install runtime dependencies**

```bash
npm install payload @payloadcms/next @payloadcms/db-mongodb @payloadcms/richtext-lexical @payloadcms/ui mongodb @tanstack/react-query resend sharp sonner @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-select
```

- [ ] **Step 5: Add scripts to `package.json`**

Add to `scripts`:
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"lhci": "lhci autorun",
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

(If `@vitejs/plugin-react` not yet installed, add it: `npm install -D @vitejs/plugin-react`.)

- [ ] **Step 7: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 9: Create `lighthouserc.json`**

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/en",
        "http://localhost:3000/en/mithai",
        "http://localhost:3000/en/mithai/kaju-katli"
      ],
      "numberOfRuns": 3,
      "startServerCommand": "npm run start",
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

- [ ] **Step 10: Run tests, verify pass**

Run: `npm run test:unit`
Expected: PASS (1 test).

- [ ] **Step 11: Update `.gitignore`**

Append:
```
.lhci/
playwright-report/
test-results/
```

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/ lighthouserc.json .gitignore
git commit -m "chore: add vitest, playwright, lighthouse, payload deps"
```

---

## Task 2: Theme collapse — lock 4 themes, archive the rest

**Files:**
- Modify: `lib/themes.ts`
- Modify: `context/ThemeContext.tsx`
- Modify: `components/ThemeSwitcher.tsx`
- Modify: `app/layout.tsx` (inline theme script)
- Modify: `app/globals.css` (add `mishran-default` token set; keep legacy token sets until branch cut)
- Create: `design-systems/mishran-default.md`
- Test: `tests/unit/themes.test.ts`

**Interfaces:**
- Consumes: existing `Theme`, `THEMES` exports
- Produces: `Theme = "mishran-default" | "diwali-saffron" | "wedding-heritage" | "everyday-sage"`; `DEFAULT_THEME = "mishran-default"`; `LEGACY_THEME_ALIASES` maps `{festive: "diwali-saffron", heritage: "wedding-heritage", sage: "everyday-sage", ...}`

- [ ] **Step 1: Write failing theme-normalization tests**

`tests/unit/themes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeTheme, DEFAULT_THEME, VALID_THEMES } from "@/lib/themes";

describe("themes", () => {
  it("defaults to mishran-default", () => {
    expect(DEFAULT_THEME).toBe("mishran-default");
  });

  it("locks to exactly 4 themes", () => {
    expect(VALID_THEMES).toEqual([
      "mishran-default",
      "diwali-saffron",
      "wedding-heritage",
      "everyday-sage",
    ]);
  });

  it("maps legacy festive → diwali-saffron", () => {
    expect(normalizeTheme("festive")).toBe("diwali-saffron");
  });

  it("maps legacy heritage → wedding-heritage", () => {
    expect(normalizeTheme("heritage")).toBe("wedding-heritage");
  });

  it("maps legacy sage → everyday-sage", () => {
    expect(normalizeTheme("sage")).toBe("everyday-sage");
  });

  it("returns null for unknown themes", () => {
    expect(normalizeTheme("navy")).toBeNull();
    expect(normalizeTheme("ibm")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- tests/unit/themes.test.ts`
Expected: FAIL (legacy aliases missing, default wrong).

- [ ] **Step 3: Archive current `design-systems/` and `lib/themes.ts` on a branch**

```bash
git checkout -b archive/design-systems-pre-collapse
git add -A
git commit -m "chore: snapshot design-systems before collapse"
git checkout main
```

- [ ] **Step 4: Replace `lib/themes.ts` with the 4-theme lock**

```ts
export type Theme =
  | "mishran-default"
  | "diwali-saffron"
  | "wedding-heritage"
  | "everyday-sage";

type ThemeGroup = "House Themes";

export type ThemeDefinition = {
  id: Theme;
  label: string;
  group: ThemeGroup;
  source: string;
  blurb: string;
  docPath: string;
  preview: {
    canvas: string;
    surface: string;
    accent: string;
    pop: string;
    ink: string;
  };
};

export const DEFAULT_THEME: Theme = "mishran-default";

export const THEMES: ThemeDefinition[] = [
  {
    id: "mishran-default",
    label: "Mishran Default",
    group: "House Themes",
    source: "Mishran Brand Strategy",
    blurb: "Warm milk-cream canvas, deep kakvi brown ink, festive saffron accent — the canonical Mishran mood.",
    docPath: "/design-systems/mishran-default.md",
    preview: {
      canvas: "#f7efe0",
      surface: "#fbf6ec",
      accent: "#9b4d2a",
      pop: "#d79a35",
      ink: "#2c1810",
    },
  },
  {
    id: "diwali-saffron",
    label: "Diwali Saffron",
    group: "House Themes",
    source: "Malgudi Original",
    blurb: "Warm terracotta, soft cream, celebratory gold.",
    docPath: "/design-systems/festive-saffron.md",
    preview: {
      canvas: "#f0e4d4",
      surface: "#f7ece0",
      accent: "#b94b4b",
      pop: "#f0b35c",
      ink: "#3b221b",
    },
  },
  {
    id: "wedding-heritage",
    label: "Wedding Heritage",
    group: "House Themes",
    source: "Mishran Menu Editorial",
    blurb: "Parchment, oxblood, saffron, cocoa with a literary old-India mood.",
    docPath: "/design-systems/mishran-heritage.md",
    preview: {
      canvas: "#f4e7d0",
      surface: "#fbf4e6",
      accent: "#8c0e2f",
      pop: "#d79a35",
      ink: "#3b2419",
    },
  },
  {
    id: "everyday-sage",
    label: "Everyday Sage",
    group: "House Themes",
    source: "Malgudi Original",
    blurb: "Quiet botanical neutrals with low-contrast elegance.",
    docPath: "/design-systems/minimal-sage.md",
    preview: {
      canvas: "#e4e0d4",
      surface: "#edeae3",
      accent: "#4a7c59",
      pop: "#c9a96e",
      ink: "#2d3a2e",
    },
  },
];

export const THEME_GROUP_ORDER: ThemeGroup[] = ["House Themes"];

export const VALID_THEMES = THEMES.map((theme) => theme.id) as Theme[];

const LEGACY_THEME_ALIASES: Record<string, Theme> = {
  festive: "diwali-saffron",
  heritage: "wedding-heritage",
  "heritage-2": "wedding-heritage",
  sage: "everyday-sage",
  navy: "mishran-default",
  mblue2: "mishran-default",
  mindbox: "mishran-default",
  coinbase: "mishran-default",
  ibm: "mishran-default",
  yoshida: "mishran-default",
  myblue: "mishran-default",
};

export function getThemeDefinition(theme: Theme) {
  return THEMES.find((entry) => entry.id === theme) ?? THEMES[0];
}

export function normalizeTheme(value: string | null | undefined): Theme | null {
  if (!value) return null;
  const normalized = LEGACY_THEME_ALIASES[value] ?? value;
  return VALID_THEMES.includes(normalized as Theme)
    ? (normalized as Theme)
    : null;
}
```

- [ ] **Step 5: Update inline theme script in `app/layout.tsx`**

Replace `initialThemeScript` with:
```ts
const initialThemeScript = `(function(){try{var valid=${JSON.stringify(validThemes)};var aliases=${JSON.stringify({festive:"diwali-saffron",heritage:"wedding-heritage","heritage-2":"wedding-heritage",sage:"everyday-sage",navy:"mishran-default",mblue2:"mishran-default",mindbox:"mishran-default",coinbase:"mishran-default",ibm:"mishran-default",yoshida:"mishran-default",myblue:"mishran-default"});};var stored=localStorage.getItem("mithai-theme");var normalized=(stored&&aliases[stored])||stored||${JSON.stringify(DEFAULT_THEME)};if(valid.indexOf(normalized)!==-1){document.documentElement.setAttribute("data-theme",normalized);}else{document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});}}catch(e){}})()`;
```

- [ ] **Step 6: Create `design-systems/mishran-default.md`**

Brief design system doc with token list (mirror spec). Delete archived theme MD files from main:
```bash
git rm design-systems/evening-navy.md design-systems/malgudi-blue-v2.md design-systems/mindbox-studio.md design-systems/coinbase-blue.md design-systems/ibm-grid.md design-systems/mishran-heritage-2.md design-systems/yoshida.md
```

- [ ] **Step 7: Run tests, verify pass**

Run: `npm run test:unit -- tests/unit/themes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Run build to verify no broken imports**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/themes.ts context/ThemeContext.tsx components/ThemeSwitcher.tsx app/layout.tsx app/globals.css design-systems/
git commit -m "refactor: collapse themes to mishran-default + 3 occasion variants"
```

---

## Task 3: Locale discipline — trim to en/hi/kn

**Files:**
- Modify: `i18n/routing.ts`
- Modify: `components/Header.tsx` (AVAILABLE_LOCALES)
- Delete: `messages/es.json`, `messages/fr.json`, `messages/ta.json`, `messages/te.json`, `messages/bn.json`, `messages/mr.json`, `messages/gu.json`
- Test: `tests/unit/locales.test.ts`

**Interfaces:**
- Produces: `routing.locales = ["en", "hi", "kn"]`; AVAILABLE_LOCALES trimmed to 3 entries.

- [ ] **Step 1: Write failing test**

`tests/unit/locales.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";

describe("routing locales", () => {
  it("supports only en, hi, kn", () => {
    expect(routing.locales).toEqual(["en", "hi", "kn"]);
  });

  it("defaults to en", () => {
    expect(routing.defaultLocale).toBe("en");
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- tests/unit/locales.test.ts`
Expected: FAIL (current locales array has 10 entries).

- [ ] **Step 3: Update `i18n/routing.ts`**

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "hi", "kn"],
  defaultLocale: "en",
  localePrefix: "always",
});
```

- [ ] **Step 4: Trim AVAILABLE_LOCALES in `components/Header.tsx`**

```ts
const AVAILABLE_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" },
];
```

- [ ] **Step 5: Delete unused message files**

```bash
git rm messages/es.json messages/fr.json messages/ta.json messages/te.json messages/bn.json messages/mr.json messages/gu.json
```

- [ ] **Step 6: Run tests + build**

Run: `npm run test:unit && npm run build`
Expected: PASS + clean build.

- [ ] **Step 7: Commit**

```bash
git add i18n/routing.ts components/Header.tsx messages/
git commit -m "refactor: trim active locales to en, hi, kn"
```

---

## Task 4: Locale layout — emit hreflang alternates

**Files:**
- Modify: `app/[locale]/layout.tsx`
- Test: `tests/unit/hreflang.test.ts`

**Interfaces:**
- Produces: `generateMetadata` on locale layout emits `<link rel="alternate" hreflang="...">` for each of `en/hi/kn` plus `x-default`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildAlternates } from "@/lib/seo";

describe("buildAlternates", () => {
  it("returns en/hi/kn + x-default for a path", () => {
    const result = buildAlternates("/mithai/kaju-katli");
    expect(result).toEqual({
      languages: {
        en: "/en/mithai/kaju-katli",
        hi: "/hi/mithai/kaju-katli",
        kn: "/kn/mithai/kaju-katli",
        "x-default": "/en/mithai/kaju-katli",
      },
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- tests/unit/hreflang.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `lib/seo.ts` with helper**

```ts
import { routing } from "@/i18n/routing";

export function buildAlternates(pathWithoutLocale: string) {
  const clean = pathWithoutLocale.replace(/^\/(en|hi|kn)/, "").replace(/\/$/, "") || "/";
  return {
    languages: {
      en: `/en${clean === "/" ? "" : clean}`.replace(/\/$/, "") || "/en",
      hi: `/hi${clean === "/" ? "" : clean}`.replace(/\/$/, "") || "/hi",
      kn: `/kn${clean === "/" ? "" : clean}`.replace(/\/$/, "") || "/kn",
      "x-default": `/en${clean === "/" ? "" : clean}`.replace(/\/$/, "") || "/en",
    },
  };
}
```

- [ ] **Step 4: Wire `generateMetadata` in `app/[locale]/layout.tsx`**

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: buildAlternates(""),
    other: { "og:locale": locale },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/seo.ts app/[locale]/layout.tsx tests/unit/hreflang.test.ts
git commit -m "feat: emit hreflang alternates for en, hi, kn"
```

---

## Task 5: Payload install — config, Mongo adapter, admin mount

**Files:**
- Create: `payload.config.ts`
- Create: `.env.example`
- Modify: `next.config.mjs`
- Create: `app/admin/[[...segments]]/page.tsx`
- Create: `app/admin/[[...segments]]/not-found.tsx`
- Modify: `.gitignore` (add `.payload/`)

**Interfaces:**
- Consumes: `MONGODB_URI`, `PAYLOAD_SECRET` env vars
- Produces: Payload admin UI at `/admin`; `getPayload()` helper via `lib/payload-client.ts`; empty config ready to register collections

- [ ] **Step 1: Add env vars**

Create `.env.example`:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mishran
PAYLOAD_SECRET=replace-with-32+-char-random-string
RESEND_API_KEY=
NEXT_PUBLIC_GA4_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_WHATSAPP_NUMBER=+91XXXXXXXXXX
```

Add `.env.local` to `.gitignore` (already standard) and `.payload/`.

- [ ] **Step 2: Create `payload.config.ts`**

```ts
import { buildConfig } from "payload/config";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: "users",
    autoLogin: process.env.NODE_ENV === "production" ? false : {
      email: "dev@mithai.shop",
      password: "dev-password",
    },
  },
  collections: [],
  globals: [],
  secret: process.env.PAYLOAD_SECRET ?? "dev-secret-change-me",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mishran-dev",
  }),
  editor: lexicalEditor(),
  sharp,
});
```

(Imports `sharp` from the `sharp` package; ensure it is installed — added in Task 1.)

Fix `sharp` import: add `import sharp from "sharp";` at top.

- [ ] **Step 3: Wire Payload into Next config**

Replace `next.config.mjs`:
```js
import createNextIntlPlugin from "next-intl/plugin";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig = {};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withPayload(withNextIntl(nextConfig));
```

- [ ] **Step 4: Mount Payload admin**

`app/admin/[[...segments]]/page.tsx`:
```tsx
import type { ServerFunctionClient } from "payload";
import { importMap } from "@payloadcms/next/importMap";
import config from "@/payload.config";

export default async function AdminPage({ params }) {
  // Lazy import server-side Payload handler
  const { handleAdminLogin } = await import("@payloadcms/next/views");
  return null;
}

// Force dynamic
export const dynamic = "force-dynamic";
```

Reference: actual Payload 3.x admin mount requires `payload.config.ts` `admin.components` and a custom next-handler. Replace with the standard Payload 3.x scaffold:

`app/admin/[[...segments]]/page.tsx`:
```tsx
import config from "@/payload.config";
import { Root, NotFound } from "@payloadcms/next/views";
import { importMap } from "@payloadcms/next/importMap";
import type { ServerFunctionClient } from "payload";

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export default async function AdminPage({ params, searchParams }: Args) {
  const { segments } = await params;
  return (
    <Root config={config} importMap={importMap} params={{ segments }} searchParams={await searchParams} />
  );
}

export const dynamic = "force-dynamic";
```

`app/(payload)/api/[...slug]/route.ts`:
```ts
import { rest } from "@payloadcms/next";
import config from "@/payload.config";
export const GET = rest.GET(config);
export const POST = rest.POST(config);
export const DELETE = rest.DELETE(config);
export const PATCH = rest.PATCH(config);
```

(Use `app/(payload)/admin/[[...segments]]/page.tsx` if grouping. Keep simple: place admin at `app/admin/[[...segments]]/page.tsx` and API at `app/api-payload/[...slug]/route.ts` to avoid collision with the existing `app/api/`. Actually Payload convention is `app/(payload)/...`. Follow Payload 3 docs.)

- [ ] **Step 5: Create `lib/payload-client.ts`**

```ts
import { getPayload as getPayloadBase } from "payload";
import config from "@/payload.config";

export const getPayload = () => getPayloadBase({ config });
```

- [ ] **Step 6: Verify boot**

Run: `npm run dev` — open `http://localhost:3000/admin`. Expected: Payload admin login screen (or auto-login in dev). If errors, fix env vars / Mongo URI.

- [ ] **Step 7: Commit**

```bash
git add payload.config.ts next.config.mjs .env.example .gitignore lib/payload-client.ts app/admin/ app/\(payload\)/
git commit -m "feat: install Payload CMS with MongoDB adapter, mount admin"
```

---

## Task 6: Shared brand collections — stories, karigars, farms, packaging, occasions

**Files:**
- Create: `collections/Stories.ts`
- Create: `collections/Karigars.ts`
- Create: `collections/Farms.ts`
- Create: `collections/Packaging.ts`
- Create: `collections/Occasions.ts`
- Create: `collections/Users.ts` (Payload requires admin user collection)
- Modify: `payload.config.ts` (register collections)
- Test: `tests/integration/brand-collections.test.ts`

**Interfaces:**
- Produces typed Payload collections per spec §7. Schemas become available via `payload-types.ts` after `npm run build`.

- [ ] **Step 1: Write failing integration test**

`tests/integration/brand-collections.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("brand collections", () => {
  it("creates and reads a story", async () => {
    const payload = await getPayload();
    const created = await payload.create({
      collection: "stories",
      data: {
        title: "Jhajjar Farm Story",
        pillar: "farm",
        locale: "en",
      },
    });
    expect(created.title).toBe("Jhajjar Farm Story");
  });
});
```

(Set `MONGODB_URI` to test DB in `vitest.config.ts` env.)

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- tests/integration/brand-collections.test.ts`
Expected: FAIL (collection not registered).

- [ ] **Step 3: Define `collections/Stories.ts`**

```ts
import { CollectionConfig } from "payload/types";

export const Stories: CollectionConfig = {
  slug: "stories",
  access: {
    read: () => true,
  },
  admin: { useAsTitle: "title" },
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", localized: true, required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    {
      name: "pillar",
      type: "select",
      required: true,
      options: [
        "farm", "milk", "karigar", "karigari", "packaging",
        "festival", "regional", "recipe", "journal",
      ],
    },
    { name: "body", type: "richText", localized: true },
    { name: "heroImage", type: "upload", relationTo: "media" },
    { name: "excerpt", type: "textarea", localized: true },
    {
      name: "relatedProducts",
      type: "relationship",
      relationTo: ["mithai-products", "gift-boxes", "qsr-menu-items", "snack-products", "merch-products"],
      hasMany: true,
    },
    {
      name: "relatedVerticals",
      type: "select",
      hasMany: true,
      options: ["mithai", "gift-builder", "qsr", "snacks", "merch"],
    },
    { name: "publishedAt", type: "date" },
  ],
};
```

- [ ] **Step 4: Define remaining collections**

`collections/Karigars.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const Karigars: CollectionConfig = {
  slug: "karigars",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "archetype",
      type: "select",
      options: ["chenna-specialist", "kaju-specialist", "ghee-specialist", "halwai"],
    },
    { name: "portrait", type: "upload", relationTo: "media" },
    { name: "story", type: "richText", localized: true },
    {
      name: "specialties",
      type: "relationship",
      relationTo: "mithai-products",
      hasMany: true,
    },
    {
      name: "signatureProducts",
      type: "relationship",
      relationTo: "mithai-products",
      hasMany: true,
    },
  ],
};
```

`collections/Farms.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const Farms: CollectionConfig = {
  slug: "farms",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "location", type: "text" },
    { name: "story", type: "richText", localized: true },
    { name: "gallery", type: "array", fields: [
      { name: "image", type: "upload", relationTo: "media" },
      { name: "caption", type: "text", localized: true },
    ]},
    { name: "milkProcess", type: "richText", localized: true },
    { name: "certifications", type: "text", hasMany: true },
  ],
};
```

`collections/Packaging.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const Packaging: CollectionConfig = {
  slug: "packaging",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "family", type: "select", options: ["box", "tray", "tin", "hamper", "carry-bag"] },
    { name: "sizes", type: "array", fields: [
      { name: "label", type: "text" },
      { name: "capacity", type: "number" },
    ]},
    { name: "images", type: "array", fields: [{ name: "image", type: "upload", relationTo: "media" }] },
    { name: "occasionFit", type: "select", hasMany: true, options: ["diwali", "wedding", "rakhi", "corporate", "birthday"] },
    { name: "customizable", type: "checkbox" },
  ],
};
```

`collections/Occasions.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const Occasions: CollectionConfig = {
  slug: "occasions",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "copy", type: "textarea", localized: true },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "recommendedProducts",
      type: "relationship",
      relationTo: ["mithai-products", "gift-boxes"],
      hasMany: true,
    },
  ],
};
```

`collections/Media.ts` (Payload needs an upload collection):
```ts
import { CollectionConfig } from "payload/types";

export const Media: CollectionConfig = {
  slug: "media",
  upload: { staticURL: "/media", staticDir: "media", imageSizes: [
    { name: "thumbnail", width: 400, height: 300 },
    { name: "card", width: 800, height: 600 },
    { name: "hero", width: 1600, height: 900 },
  ]},
  access: { read: () => true },
  fields: [
    { name: "alt", type: "text", localized: true },
  ],
};
```

`collections/Users.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  access: { read: () => true },
  admin: { useAsTitle: "email" },
  fields: [
    { name: "name", type: "text" },
    { name: "role", type: "select", options: ["admin", "editor", "ops"], defaultValue: "editor", required: true },
  ],
};
```

- [ ] **Step 6: Register collections in `payload.config.ts`**

Update `collections: []` to:
```ts
collections: [Users, Media, Stories, Karigars, Farms, Packaging, Occasions],
```

Import at top.

- [ ] **Step 7: Run integration test, verify pass**

Run: `npm run test:unit -- tests/integration/brand-collections.test.ts`
Expected: PASS.

- [ ] **Step 8: Generate types**

Run: `npx payload generate:types`
Expected: `payload-types.ts` created.

- [ ] **Step 9: Commit**

```bash
git add collections/ payload.config.ts payload-types.ts tests/integration/brand-collections.test.ts
git commit -m "feat: add shared brand collections (stories, karigars, farms, packaging, occasions)"
```

---

## Task 7: Product collections — one per vertical + sample seeds

**Files:**
- Create: `collections/MithaiProducts.ts`
- Create: `collections/GiftBoxes.ts`
- Create: `collections/QsrMenuItems.ts`
- Create: `collections/SnackProducts.ts`
- Create: `collections/MerchProducts.ts`
- Modify: `payload.config.ts`
- Create: `scripts/seed.ts`
- Test: `tests/integration/products.test.ts`

**Interfaces:**
- Produces 5 product collections matching spec §7. `displayPrice` is display-only string on mithai. Sample seed creates 1 product per vertical.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("product collections", () => {
  it("creates a mithai product", async () => {
    const payload = await getPayload();
    const p = await payload.create({
      collection: "mithai-products",
      data: {
        name: "Kaju Katli",
        slug: "kaju-katli",
        family: "classic",
        shelfLife: "7 days",
        displayPrice: "₹920 / 250g",
      },
    });
    expect(p.slug).toBe("kaju-katli");
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Define `collections/MithaiProducts.ts`**

```ts
import { CollectionConfig } from "payload/types";

export const MithaiProducts: CollectionConfig = {
  slug: "mithai-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "Mithai" },
  versions: { drafts: true },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    {
      name: "family",
      type: "select",
      required: true,
      options: ["classic", "original", "sugar-free", "regional", "seasonal"],
    },
    { name: "ingredients", type: "textarea", localized: true },
    { name: "allergens", type: "text", hasMany: true },
    { name: "shelfLife", type: "text" },
    { name: "storage", type: "textarea", localized: true },
    {
      name: "freshnessStatus",
      type: "select",
      options: ["made-daily", "made-to-order", "batch-frozen"],
    },
    { name: "dietaryTags", type: "text", hasMany: true },
    { name: "boxCompatibility", type: "relationship", relationTo: "gift-boxes", hasMany: true },
    { name: "packagingCompatibility", type: "relationship", relationTo: "packaging", hasMany: true },
    { name: "leadTime", type: "text" },
    { name: "images", type: "array", fields: [{ name: "image", type: "upload", relationTo: "media" }], minRows: 1 },
    { name: "story", type: "richText", localized: true },
    { name: "karigar", type: "relationship", relationTo: "karigars" },
    { name: "displayPrice", type: "text", admin: { description: "Display-only. Commerce deferred to Phase 8." } },
  ],
};
```

- [ ] **Step 4: Define remaining product collections**

`collections/GiftBoxes.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const GiftBoxes: CollectionConfig = {
  slug: "gift-boxes",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "Gifting" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "size", type: "select", options: ["4-piece", "8-piece", "16-piece", "custom"] },
    { name: "compartmentLayout", type: "textarea" },
    { name: "compatibleMithai", type: "relationship", relationTo: "mithai-products", hasMany: true },
    { name: "packaging", type: "relationship", relationTo: "packaging", hasMany: true },
    { name: "addOns", type: "array", fields: [
      { name: "label", type: "text" },
      { name: "type", type: "select", options: ["carry-bag", "sleeve", "ribbon", "card"] },
    ]},
    { name: "images", type: "array", fields: [{ name: "image", type: "upload", relationTo: "media" }] },
    { name: "curatedAssortments", type: "array", fields: [
      { name: "label", type: "text" },
      { name: "items", type: "relationship", relationTo: "mithai-products", hasMany: true },
    ]},
  ],
};
```

`collections/QsrMenuItems.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const QsrMenuItems: CollectionConfig = {
  slug: "qsr-menu-items",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "QSR" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "category", type: "select", options: ["chaat", "chole-bhature", "kulcha", "thaali", "chinese", "south-indian"], required: true },
    { name: "description", type: "textarea", localized: true },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "veg", type: "checkbox" },
    { name: "spiceLevel", type: "select", options: ["mild", "medium", "hot"] },
    { name: "availableAtStores", type: "relationship", relationTo: "stores", hasMany: true },
  ],
};
```

(`stores` deferred to StoreSettings global — for now, omit this relationship and use plain `text` field for store ids, OR create `collections/Stores.ts`. Pick simpler: use `array` of `text` for store slugs.)

`collections/SnackProducts.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const SnackProducts: CollectionConfig = {
  slug: "snack-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "FMCG" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "category", type: "select", options: ["namkeen", "cookie", "dry-fruit"], required: true },
    { name: "weight", type: "text" },
    { name: "description", type: "textarea", localized: true },
    { name: "images", type: "array", fields: [{ name: "image", type: "upload", relationTo: "media" }] },
    { name: "externalRetailers", type: "array", fields: [
      { name: "label", type: "text" },
      { name: "url", type: "text" },
    ]},
    { name: "msrp", type: "text" },
  ],
};
```

`collections/MerchProducts.ts`:
```ts
import { CollectionConfig } from "payload/types";

export const MerchProducts: CollectionConfig = {
  slug: "merch-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "Merch" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "type", type: "select", options: ["tool", "book", "experience"], required: true },
    { name: "description", type: "textarea", localized: true },
    { name: "images", type: "array", fields: [{ name: "image", type: "upload", relationTo: "media" }] },
    { name: "price", type: "text" },
    { name: "availability", type: "select", options: ["in-stock", "pre-order", "enquiry-only"], defaultValue: "enquiry-only" },
  ],
};
```

- [ ] **Step 5: Register product collections**

Update `payload.config.ts` `collections` array.

- [ ] **Step 6: Create `scripts/seed.ts`**

```ts
import { getPayload } from "@/lib/payload-client";

async function main() {
  const payload = await getPayload();

  // 1 sample mithai
  await payload.create({
    collection: "mithai-products",
    data: {
      name: "Kaju Katli",
      slug: "kaju-katli",
      family: "classic",
      shelfLife: "7 days",
      storage: "Room temperature, airtight.",
      displayPrice: "₹920 / 250g",
      freshnessStatus: "made-to-order",
      ingredients: "Cashew, sugar, kakvi.",
    },
  });

  // 1 sample gift box
  await payload.create({
    collection: "gift-boxes",
    data: { name: "Heritage 16-piece Hamper", size: "16-piece" },
  });

  // 1 sample qsr item
  await payload.create({
    collection: "qsr-menu-items",
    data: { name: "Chole Bhature", category: "chole-bhature", veg: true, spiceLevel: "medium" },
  });

  // 1 sample snack
  await payload.create({
    collection: "snack-products",
    data: { name: "Aloo Bhujia", category: "namkeen", weight: "200g", msrp: "₹60" },
  });

  // 1 sample merch
  await payload.create({
    collection: "merch-products",
    data: { name: "Mithai-Making Tool Set", type: "tool", availability: "enquiry-only" },
  });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Run tests + seed**

Run: `npm run test:unit -- tests/integration/products.test.ts`
Expected: PASS.

Run: `npm run seed`
Expected: 5 records created.

- [ ] **Step 8: Commit**

```bash
git add collections/ payload.config.ts scripts/seed.ts tests/integration/products.test.ts
git commit -m "feat: add 5 product collections + sample seed"
```

---

## Task 8: Payload globals — brand, nav, theme, analytics, store

**Files:**
- Create: `globals/BrandSettings.ts`
- Create: `globals/NavSettings.ts`
- Create: `globals/ThemeSettings.ts`
- Create: `globals/AnalyticsSettings.ts`
- Create: `globals/StoreSettings.ts`
- Modify: `payload.config.ts`

**Interfaces:**
- Produces globals per spec §7. Editors can configure brand tagline, default theme, GA4/Pixel IDs, WhatsApp number, store list.

- [ ] **Step 1: Define globals**

`globals/BrandSettings.ts`:
```ts
import { GlobalConfig } from "payload/types";

export const BrandSettings: GlobalConfig = {
  slug: "brand-settings",
  access: { read: () => true },
  fields: [
    { name: "logo", type: "upload", relationTo: "media" },
    { name: "brandName", type: "text", defaultValue: "Mishran", localized: true },
    { name: "tagline", type: "text", localized: true },
    { name: "positioning", type: "textarea", localized: true },
    { name: "heroCopy", type: "textarea", localized: true },
    {
      name: "defaultTheme",
      type: "select",
      options: ["mishran-default", "diwali-saffron", "wedding-heritage", "everyday-sage"],
      defaultValue: "mishran-default",
    },
  ],
};
```

`globals/NavSettings.ts`:
```ts
import { GlobalConfig } from "payload/types";

export const NavSettings: GlobalConfig = {
  slug: "nav-settings",
  access: { read: () => true },
  fields: [
    { name: "primaryNav", type: "array", fields: [
      { name: "label", type: "text", localized: true },
      { name: "href", type: "text" },
    ]},
    { name: "utilityNav", type: "array", fields: [
      { name: "label", type: "text", localized: true },
      { name: "href", type: "text" },
    ]},
  ],
};
```

`globals/ThemeSettings.ts`:
```ts
import { GlobalConfig } from "payload/types";

export const ThemeSettings: GlobalConfig = {
  slug: "theme-settings",
  access: { read: () => true },
  fields: [
    { name: "themes", type: "array", fields: [
      { name: "id", type: "text" },
      { name: "label", type: "text", localized: true },
      { name: "canvas", type: "text" },
      { name: "surface", type: "text" },
      { name: "accent", type: "text" },
      { name: "pop", type: "text" },
      { name: "ink", type: "text" },
    ]},
  ],
};
```

`globals/AnalyticsSettings.ts`:
```ts
import { GlobalConfig } from "payload/types";

export const AnalyticsSettings: GlobalConfig = {
  slug: "analytics-settings",
  access: { read: () => true },
  fields: [
    { name: "ga4Id", type: "text" },
    { name: "metaPixelId", type: "text" },
    { name: "hotjarId", type: "text" },
    { name: "whatsappNumber", type: "text" },
  ],
};
```

`globals/StoreSettings.ts`:
```ts
import { GlobalConfig } from "payload/types";

export const StoreSettings: GlobalConfig = {
  slug: "store-settings",
  access: { read: () => true },
  fields: [
    { name: "stores", type: "array", fields: [
      { name: "name", type: "text" },
      { name: "city", type: "text" },
      { name: "address", type: "textarea" },
      { name: "hours", type: "text" },
      { name: "deliveryRadiusKm", type: "number" },
      { name: "lat", type: "number" },
      { name: "lng", type: "number" },
    ]},
  ],
};
```

- [ ] **Step 2: Register globals**

Update `payload.config.ts` `globals: []` to:
```ts
globals: [BrandSettings, NavSettings, ThemeSettings, AnalyticsSettings, StoreSettings],
```

- [ ] **Step 3: Boot admin and verify**

Run: `npm run dev`, log into `/admin`, confirm all 5 globals appear in the sidebar.

- [ ] **Step 4: Commit**

```bash
git add globals/ payload.config.ts
git commit -m "feat: add Payload globals (brand, nav, theme, analytics, store)"
```

---

## Task 9: Leads + drafts collections

**Files:**
- Create: `collections/Leads.ts`
- Create: `collections/Drafts.ts`
- Modify: `payload.config.ts`
- Test: `tests/integration/leads-drafts.test.ts`

**Interfaces:**
- Produces `leads` and `drafts` collections per spec §7. `drafts.expiresAt` 30-day TTL.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("leads + drafts", () => {
  it("creates a wedding lead", async () => {
    const payload = await getPayload();
    const lead = await payload.create({
      collection: "leads",
      data: {
        type: "wedding",
        contact: { name: "Anjali", email: "anjali@example.com", phone: "+91XXXXXXXXXX" },
        payload: { occasion: "wedding", qty: 200, city: "Bengaluru" },
        status: "new",
        source: "weddings-page",
      },
    });
    expect(lead.status).toBe("new");
  });

  it("creates a draft with TTL 30 days from now", async () => {
    const payload = await getPayload();
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const draft = await payload.create({
      collection: "drafts",
      data: {
        sessionId: "sess-1",
        config: { items: [] },
        expiresAt: inThirtyDays,
      },
    });
    expect(new Date(draft.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Define `collections/Leads.ts`**

```ts
import { CollectionConfig } from "payload/types";

export const Leads: CollectionConfig = {
  slug: "leads",
  admin: { useAsTitle: "type", group: "Ops" },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      options: ["wedding", "corporate", "merch", "gift-builder-draft", "wholesale", "general"],
    },
    {
      name: "contact",
      type: "group",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
        { name: "phone", type: "text" },
        { name: "company", type: "text" },
        { name: "GSTIN", type: "text", admin: { description: "GSTIN for corporate leads" } },
      ],
    },
    {
      name: "payload",
      type: "json",
      admin: { description: "Free-form lead details (occasion, qty, budget, date, city, selectedProducts, message)." },
    },
    {
      name: "status",
      type: "select",
      options: ["new", "contacted", "qualified", "won", "lost"],
      defaultValue: "new",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "source", type: "text" },
    { name: "convertedFromDraft", type: "relationship", relationTo: "drafts" },
  ],
  timestamps: true,
};
```

- [ ] **Step 4: Define `collections/Drafts.ts`**

```ts
import { CollectionConfig } from "payload/types";

export const Drafts: CollectionConfig = {
  slug: "drafts",
  admin: { useAsTitle: "sessionId", group: "Ops" },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    { name: "sessionId", type: "text", required: true, unique: true },
    { name: "config", type: "json" },
    { name: "expiresAt", type: "date", required: true, admin: { position: "sidebar" } },
    { name: "convertedToLead", type: "relationship", relationTo: "leads" },
  ],
  indexes: [
    { fields: "expiresAt", options: { expireAfterSeconds: 0 } },
  ],
};
```

- [ ] **Step 5: Register collections in `payload.config.ts`**

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:unit -- tests/integration/leads-drafts.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add collections/Leads.ts collections/Drafts.ts payload.config.ts tests/integration/leads-drafts.test.ts
git commit -m "feat: add leads + drafts collections with TTL on drafts"
```

---

## Task 10: `/api/leads` POST endpoint + Resend email

**Files:**
- Create: `app/api/leads/route.ts`
- Create: `lib/email.ts`
- Create: `lib/email/templates.ts`
- Test: `tests/integration/api-leads.test.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER` env; `Leads` collection.
- Produces: `POST /api/leads` accepting JSON body matching `LeadInput`; returns `{ leadId, message }`. Sends email via Resend to ops inbox. Body shape documented for Task 17.

- [ ] **Step 1: Write failing integration test**

```ts
import { describe, it, expect } from "vitest";

describe("POST /api/leads", () => {
  it("creates a lead and returns id", async () => {
    const res = await fetch("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "wedding",
        contact: { name: "Test", email: "test@example.com", phone: "+919999999999" },
        payload: { qty: 100 },
        source: "test",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.leadId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create `lib/email.ts`**

```ts
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendLeadNotification(to: string, lead: any) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing; skipping send.");
    return;
  }
  const { data, error } = await resend.emails.send({
    from: "Mishran Leads <leads@mishran.shop>",
    to,
    subject: `New ${lead.type} lead — ${lead.contact.name}`,
    html: `<pre>${JSON.stringify(lead, null, 2)}</pre>`,
  });
  if (error) console.error("[email]", error);
  return data;
}
```

- [ ] **Step 4: Create `app/api/leads/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";
import { sendLeadNotification } from "@/lib/email";

const OPS_INBOX = process.env.LEADS_INBOX ?? "ops@mishran.shop";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.type || !body?.contact?.email || !body?.contact?.name) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    const payload = await getPayload();
    const created = await payload.create({
      collection: "leads",
      data: {
        type: body.type,
        contact: body.contact,
        payload: body.payload ?? {},
        status: "new",
        source: body.source ?? "unknown",
      },
    });

    await sendLeadNotification(OPS_INBOX, created);

    return NextResponse.json({ leadId: created.id, message: "Lead received. We'll be in touch." }, { status: 201 });
  } catch (err) {
    console.error("[api/leads]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npm run test:unit -- tests/integration/api-leads.test.ts`
Expected: PASS (with dev server running).

- [ ] **Step 6: Commit**

```bash
git add app/api/leads/route.ts lib/email.ts tests/integration/api-leads.test.ts
git commit -m "feat: add /api/leads endpoint with Resend email notification"
```

---

## Task 11: `/api/drafts` endpoints

**Files:**
- Create: `app/api/drafts/route.ts`
- Create: `app/api/drafts/[sessionId]/route.ts`
- Test: `tests/integration/api-drafts.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/drafts` body: `{ sessionId, config }` → creates with `expiresAt = now + 30d`. Returns `{ id, sessionId, expiresAt }`.
  - `GET /api/drafts/[sessionId]` → returns draft or 404.
  - `PUT /api/drafts/[sessionId]` body: `{ config }` → updates.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";

describe("drafts API", () => {
  it("POST then GET roundtrip", async () => {
    const post = await fetch("http://localhost:3000/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "test-sess", config: { items: ["a"] } }),
    });
    expect(post.status).toBe(201);
    const get = await fetch("http://localhost:3000/api/drafts/test-sess");
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.config.items).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create routes**

`app/api/drafts/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const payload = await getPayload();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  try {
    const created = await payload.create({
      collection: "drafts",
      data: { sessionId: body.sessionId, config: body.config ?? {}, expiresAt },
    });
    return NextResponse.json({ id: created.id, sessionId: body.sessionId, expiresAt }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      // duplicate sessionId — update instead
      const existing = await payload.find({
        collection: "drafts",
        where: { sessionId: { equals: body.sessionId } },
      });
      const doc = existing.docs[0];
      if (doc) {
        const updated = await payload.update({
          collection: "drafts",
          id: doc.id,
          data: { config: body.config ?? {}, expiresAt },
        });
        return NextResponse.json({ id: updated.id, sessionId: body.sessionId, expiresAt }, { status: 200 });
      }
    }
    throw err;
  }
}
```

`app/api/drafts/[sessionId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });
  if (result.docs.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const doc = result.docs[0] as any;
  if (new Date(doc.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json();
  const payload = await getPayload();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });
  if (result.docs.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const updated = await payload.update({
    collection: "drafts",
    id: result.docs[0].id,
    data: { config: body.config ?? {}, expiresAt },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:unit -- tests/integration/api-drafts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/drafts/ tests/integration/api-drafts.test.ts
git commit -m "feat: add /api/drafts endpoints (POST/GET/PUT) with 30-day TTL"
```

---

## Task 12: `/api/search` endpoint

**Files:**
- Create: `app/api/search/route.ts`
- Test: `tests/integration/api-search.test.ts`

**Interfaces:**
- Consumes: Payload collections.
- Produces: `GET /api/search?q=…&limit=20` returning `{ results: [{ kind, id, slug, label, snippet }] }` across `mithai-products`, `stories`, `qsr-menu-items`, `snack-products`, `merch-products`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";

describe("GET /api/search", () => {
  it("returns kaju katli for 'kaju'", async () => {
    const res = await fetch("http://localhost:3000/api/search?q=kaju&limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.some((r: any) => r.label?.toLowerCase().includes("kaju"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create route**

`app/api/search/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";

const COLLECTIONS = [
  { slug: "mithai-products", labelKey: "name", kind: "mithai" },
  { slug: "stories", labelKey: "title", kind: "story" },
  { slug: "qsr-menu-items", labelKey: "name", kind: "qsr" },
  { slug: "snack-products", labelKey: "name", kind: "snack" },
  { slug: "merch-products", labelKey: "name", kind: "merch" },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Number(url.searchParams.get("limit") ?? 20);
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const payload = await getPayload();
  const results: any[] = [];

  for (const c of COLLECTIONS) {
    const r = await payload.find({
      collection: c.slug,
      where: { [c.labelKey]: { contains: q } },
      limit,
    });
    for (const doc of r.docs) {
      results.push({
        kind: c.kind,
        id: doc.id,
        slug: (doc as any).slug,
        label: (doc as any)[c.labelKey],
        snippet: (doc as any).excerpt ?? (doc as any).ingredients ?? "",
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add app/api/search/route.ts tests/integration/api-search.test.ts
git commit -m "feat: add /api/search endpoint across 5 collections"
```

---

## Task 13: Layout shell — SiteHeader, SiteFooter, BrandBar

**Files:**
- Create: `components/layout/SiteHeader.tsx` (supersedes `components/Header.tsx`)
- Create: `components/layout/SiteFooter.tsx`
- Create: `components/layout/BrandBar.tsx`
- Modify: `app/[locale]/layout.tsx` (mount shell)
- Modify: `components/Header.tsx` (re-export SiteHeader for compat or delete)
- Test: `tests/unit/nav-links.test.ts`

**Interfaces:**
- Produces: nav per spec §6: `Mithai · Build a Gift · QSR · Snacks · Merch · Stories · Farms · Karigars · Journal`. Locale picker, theme picker, cart badge, search trigger, WhatsApp CTA.

- [ ] **Step 1: Write failing test on nav structure**

```ts
import { describe, it, expect } from "vitest";
import { NAV_LINKS } from "@/components/layout/SiteHeader";

describe("SiteHeader nav", () => {
  it("includes all spec links", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(hrefs).toContain("/mithai");
    expect(hrefs).toContain("/stories");
    expect(hrefs).toContain("/qsr");
    expect(hrefs).toContain("/snacks");
    expect(hrefs).toContain("/merch");
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Build SiteHeader**

`components/layout/SiteHeader.tsx` — adapt existing `components/Header.tsx` (preserve scroll-spy logic, locale picker, theme switcher, cart badge) and swap `NAV_LINKS`:
```ts
export const NAV_LINKS = [
  { href: "/mithai", key: "nav.mithai" },
  { href: "/build-a-gift", key: "nav.buildAGift" },
  { href: "/qsr", key: "nav.qsr" },
  { href: "/snacks", key: "nav.snacks" },
  { href: "/merch", key: "nav.merch" },
  { href: "/stories", key: "nav.stories" },
  { href: "/stories/farms", key: "nav.farms" },
  { href: "/stories/karigars", key: "nav.karigars" },
  { href: "/stories/journal", key: "nav.journal" },
] as const;
```

(Port the rest of the component body from `components/Header.tsx`.)

- [ ] **Step 4: Build SiteFooter + BrandBar**

`components/layout/BrandBar.tsx` — slim utility strip above header with WhatsApp number, store count, freshness promise tagline. Reads `analyticsSettings.whatsappNumber` from Payload (server-side).

`components/layout/SiteFooter.tsx` — link map per IA, brand promise, FSSAI placeholder, social, WhatsApp CTA, legal links.

- [ ] **Step 5: Wire into locale layout**

Update `app/[locale]/layout.tsx` to render `<BrandBar /><SiteHeader /><main id="main-content">{children}</main><SiteFooter />` inside the NextIntlClientProvider.

- [ ] **Step 6: Add nav translation keys**

Append to `messages/en.json`, `messages/hi.json`, `messages/kn.json`:
```json
"nav": {
  "mithai": "Mithai",
  "buildAGift": "Build a Gift",
  "qsr": "QSR",
  "snacks": "Snacks",
  "merch": "Merch",
  "stories": "Stories",
  "farms": "Farms",
  "karigars": "Karigars",
  "journal": "Journal"
}
```

- [ ] **Step 7: Run tests + manual visual check**

Run: `npm run test:unit && npm run dev`
Open `http://localhost:3000/en` — confirm new nav renders.

- [ ] **Step 8: Commit**

```bash
git add components/layout/ app/[locale]/layout.tsx messages/
git commit -m "feat: brand layout shell — SiteHeader, SiteFooter, BrandBar with new IA"
```

---

## Task 14: Brand-home redesign — hero, 4 vertical portals, pillars

**Files:**
- Modify: `app/[locale]/page.tsx` (currently `app/[locale]/page.tsx`)
- Create: `components/home/BrandHero.tsx`
- Create: `components/home/VerticalPortals.tsx`
- Create: `components/home/Pillars.tsx`
- Test: `tests/e2e/home.spec.ts`

**Interfaces:**
- Produces: home page with cinematic hero (milk-first promise), 4 vertical portal cards (Mithai, QSR, Snacks, Merch), pillars strip (Milk Purity · Karigar Mastery · Karigari · Modern Experience), "Stories from the House" teaser, "Stay in the loop" lead capture.

- [ ] **Step 1: Write failing E2E**

`tests/e2e/home.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("home shows hero + 4 portals + pillars", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: /Mishran/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mithai/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /QSR/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Snacks/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Merch/i }).first()).toBeVisible();
  await expect(page.getByText(/Milk Purity/i)).toBeVisible();
  await expect(page.getByText(/Karigar Mastery/i)).toBeVisible();
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Build `BrandHero.tsx`**

Server component. Pulls `heroCopy` from `brandSettings` global via `getPayload()`. Renders full-bleed image (next/image, `priority`), headline, subhead, primary CTA `Explore Mithai`, secondary CTA `Build a Gift`.

- [ ] **Step 4: Build `VerticalPortals.tsx`**

Grid of 4 cards. Each card: vertical image, label, one-line description, link to `/mithai`, `/qsr`, `/snacks`, `/merch`. Use `next/image` with `sizes`.

- [ ] **Step 5: Build `Pillars.tsx`**

Static strip with 4 pillars and short copy from spec §4. Each pillar links to relevant story hub.

- [ ] **Step 6: Assemble `app/[locale]/page.tsx`**

```tsx
import { BrandHero } from "@/components/home/BrandHero";
import { VerticalPortals } from "@/components/home/VerticalPortals";
import { Pillars } from "@/components/home/Pillars";

export default function Page() {
  return (
    <>
      <BrandHero />
      <VerticalPortals />
      <Pillars />
    </>
  );
}
```

(Skip teaser + lead strip for now; add in Task 18 / 19 follow-up.)

- [ ] **Step 7: Run E2E + visual check**

Run: `npm run test:e2e -- tests/e2e/home.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/page.tsx components/home/ tests/e2e/home.spec.ts
git commit -m "feat: brand-home with hero, 4 vertical portals, brand pillars"
```

---

## Task 15: Vertical landing pages — `/mithai`, `/qsr`, `/snacks`, `/merch`

**Files:**
- Create: `app/[locale]/mithai/page.tsx`
- Create: `app/[locale]/qsr/page.tsx`
- Create: `app/[locale]/snacks/page.tsx`
- Create: `app/[locale]/merch/page.tsx`
- Create: `components/verticals/VerticalHub.tsx`
- Test: `tests/e2e/verticals.spec.ts`

**Interfaces:**
- Produces: each vertical hub renders hero + grid of sample items from the corresponding Payload collection. All four pages use the shared `VerticalHub` component.

- [ ] **Step 1: Write failing E2E**

```ts
import { test, expect } from "@playwright/test";

test("mithai hub lists seeded kaju katli", async ({ page }) => {
  await page.goto("/en/mithai");
  await expect(page.getByText("Kaju Katli")).toBeVisible();
});

test("qsr hub lists seeded item", async ({ page }) => {
  await page.goto("/en/qsr");
  await expect(page.getByText("Chole Bhature")).toBeVisible();
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Build shared hub**

`components/verticals/VerticalHub.tsx` (server component):
```tsx
import { getPayload } from "@/lib/payload-client";
import { MediaCard } from "@/components/ui/MediaCard";

type Props = {
  collection: "mithai-products" | "qsr-menu-items" | "snack-products" | "merch-products";
  title: string;
  blurb: string;
};

export async function VerticalHub({ collection, title, blurb }: Props) {
  const payload = await getPayload();
  const r = await payload.find({ collection, limit: 24 });
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="mt-3 text-text-muted">{blurb}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {r.docs.map((doc: any) => (
          <MediaCard key={doc.id} title={doc.name ?? doc.title} href="#" image={(doc.images?.[0] ?? doc.image)?.url} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Build page wrappers**

Each page imports `VerticalHub` with appropriate props. Example `app/[locale]/mithai/page.tsx`:
```tsx
import { VerticalHub } from "@/components/verticals/VerticalHub";

export default function Page() {
  return <VerticalHub collection="mithai-products" title="Mithai" blurb="Milk-first sweets, made by karigars in small batches." />;
}
```

- [ ] **Step 5: Build `MediaCard` primitive in `components/ui/MediaCard.tsx`**

Card with image, title, optional tag.

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:e2e -- tests/e2e/verticals.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/mithai app/[locale]/qsr app/[locale]/snacks app/[locale]/merch components/verticals/ components/ui/MediaCard.tsx tests/e2e/verticals.spec.ts
git commit -m "feat: vertical landing pages for mithai, qsr, snacks, merch"
```

---

## Task 16: Sample PDP per vertical

**Files:**
- Create: `app/[locale]/mithai/[slug]/page.tsx`
- Create: `components/mithai/MithaiPDP.tsx`
- Create: `app/[locale]/qsr/[slug]/page.tsx`
- Create: `app/[locale]/snacks/[slug]/page.tsx`
- Create: `app/[locale]/merch/[slug]/page.tsx`
- Modify: existing `app/sweets/[slug]/page.tsx` — redirect to `/mithai/[slug]` or leave as legacy (decide: delete legacy). Pick delete for v1.
- Test: `tests/e2e/mithai-pdp.spec.ts`

**Interfaces:**
- Produces: PDP per vertical. `generateStaticParams` + `generateMetadata` for SEO. ISR `revalidate = 60`.

- [ ] **Step 1: Write failing E2E**

```ts
import { test, expect } from "@playwright/test";

test("mithai PDP shows display price and ingredients", async ({ page }) => {
  await page.goto("/en/mithai/kaju-katli");
  await expect(page.getByText("₹920 / 250g")).toBeVisible();
  await expect(page.getByText(/Cashew/i)).toBeVisible();
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Build `MithaiPDP` component**

Server component. Fetches by slug via `payload.find({ collection: "mithai-products", where: { slug: { equals } }, limit: 1 })`. Renders breadcrumb, gallery, name, displayPrice, ingredients, allergens, shelf life, story, karigar reference, freshness status, "Add to draft cart" button (client island for cart).

- [ ] **Step 4: Build `app/[locale]/mithai/[slug]/page.tsx`**

```tsx
import { MithaiPDP } from "@/components/mithai/MithaiPDP";
import { getPayload } from "@/lib/payload-client";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({ collection: "mithai-products", limit: 100 });
  return r.docs.map((d: any) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const payload = await getPayload();
  const r = await payload.find({ collection: "mithai-products", where: { slug: { equals: slug } }, limit: 1, locale });
  const doc = r.docs[0] as any;
  if (!doc) return {};
  return { title: doc.name, description: doc.ingredients };
}

export default async function Page({ params }) {
  const { slug, locale } = await params;
  return <MithaiPDP slug={slug} locale={locale} />;
}
```

- [ ] **Step 5: Build analogous pages for QSR / Snacks / Merch**

Simpler PDPs (description, image, basic info). For merch: enquiry-only CTA linking to `/merch/[slug]/enquire` — or skip the route and surface a `LeadForm` modal on the PDP (deferred to Phase 6).

- [ ] **Step 6: Delete legacy sweet routes**

```bash
git rm -r app/sweets
```

- [ ] **Step 7: Run tests, verify pass**

Run: `npm run test:e2e -- tests/e2e/mithai-pdp.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/mithai/[slug] app/[locale]/qsr/[slug] app/[locale]/snacks/[slug] app/[locale]/merch/[slug] components/mithai/ tests/e2e/mithai-pdp.spec.ts
git rm -r app/sweets
git commit -m "feat: sample PDP per vertical; remove legacy /sweets"
```

---

## Task 17: `/weddings` + `/corporate` lead forms

**Files:**
- Create: `app/[locale]/weddings/page.tsx`
- Create: `app/[locale]/corporate/page.tsx`
- Create: `components/ledger/LeadForm.tsx`
- Create: `components/ledger/WeddingConfigurator.tsx`
- Create: `components/ledger/CorporateConfigurator.tsx`
- Create: `context/QueryProvider.tsx`
- Modify: `app/layout.tsx` (mount QueryProvider)
- Test: `tests/e2e/leads.spec.ts`

**Interfaces:**
- Consumes: `POST /api/leads` (Task 10), TanStack Query.
- Produces: two routes that render lead forms. On submit, POST to `/api/leads`, show Sonner toast on success, redirect to a thank-you state.

- [ ] **Step 1: Write failing E2E**

```ts
import { test, expect } from "@playwright/test";

test("wedding lead submits successfully", async ({ page }) => {
  await page.goto("/en/weddings");
  await page.getByLabel(/name/i).fill("Test User");
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByLabel(/phone/i).fill("+919999999999");
  await page.getByLabel(/guests/i).fill("200");
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/thank you/i)).toBeVisible();
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create `context/QueryProvider.tsx`**

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Mount in `app/layout.tsx` (wrap `CartProvider`).

- [ ] **Step 4: Create `LeadForm` client component**

Generic form: name, email, phone, message + dynamic fields passed as children. Uses TanStack Query `useMutation` to POST `/api/leads`. Calls Sonner `toast.success` on success. `aria-live="polite"` on error region.

- [ ] **Step 5: Create `WeddingConfigurator` and `CorporateConfigurator`**

Compose `LeadForm` with vertical-specific fields:
- Wedding: date, city, guest count, budget, mithai preferences, packaging preference.
- Corporate: company, GSTIN, qty, deadline, branding requirements.

Both pass `type: "wedding" | "corporate"` in the lead body.

- [ ] **Step 6: Mount in pages**

`app/[locale]/weddings/page.tsx`:
```tsx
import { WeddingConfigurator } from "@/components/ledger/WeddingConfigurator";

export default function Page() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold">Weddings & Bulk Gifting</h1>
      <p className="mt-3 text-text-muted">Tell us about your event. We'll respond within 24 hours.</p>
      <div className="mt-10"><WeddingConfigurator /></div>
    </section>
  );
}
```

Same for corporate.

- [ ] **Step 7: Run tests, verify pass**

Run: `npm run test:e2e -- tests/e2e/leads.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/weddings app/[locale]/corporate components/ledger/ context/QueryProvider.tsx app/layout.tsx tests/e2e/leads.spec.ts
git commit -m "feat: weddings + corporate lead forms with Resend notification"
```

---

## Task 18: `/stories` hub + sample story

**Files:**
- Create: `app/[locale]/stories/page.tsx`
- Create: `app/[locale]/stories/[slug]/page.tsx`
- Create: `components/stories/StoryCard.tsx`
- Create: `components/stories/StoryHero.tsx`
- Create: `payload-blocks/` (stub for now — use lexical default)
- Test: `tests/e2e/stories.spec.ts`

**Interfaces:**
- Produces: hub at `/stories` listing all published stories grouped by pillar; sample detail page renders rich text body via Payload lexical.

- [ ] **Step 1: Seed a sample story**

Via Payload admin or seed script: create one story titled "Jhajjar Farm: Where Our Milk Begins" with `pillar: "farm"`, body with one paragraph.

- [ ] **Step 2: Write failing E2E**

```ts
import { test, expect } from "@playwright/test";

test("stories hub lists farm story", async ({ page }) => {
  await page.goto("/en/stories");
  await expect(page.getByText(/Jhajjar Farm/i)).toBeVisible();
});
```

- [ ] **Step 3: Run, verify failure**

- [ ] **Step 4: Build story hub**

`app/[locale]/stories/page.tsx` (server component) — fetches all stories, groups by pillar, renders `<StoryCard>` grid.

`components/stories/StoryCard.tsx` — image, title, pillar tag, excerpt.

- [ ] **Step 5: Build story detail**

`app/[locale]/stories/[slug]/page.tsx` — `generateStaticParams` over `stories`. Renders `<StoryHero>` + lexical body. Payload's `RichText` component from `@payloadcms/richtext-lexical/react` renders body.

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:e2e -- tests/e2e/stories.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/stories components/stories/ tests/e2e/stories.spec.ts
git commit -m "feat: stories hub + sample story PDP"
```

---

## Task 19: Analytics — GA4, Meta Pixel, `track()` helper

**Files:**
- Create: `lib/analytics.ts`
- Create: `components/Analytics/AnalyticsScripts.tsx`
- Modify: `app/layout.tsx` (mount scripts after hydration)
- Test: `tests/unit/analytics.test.ts`

**Interfaces:**
- Produces: `track(eventName, payload?)` queuing events to `window.dataLayer` (GA4) and `window.fbq` (Meta Pixel). Scripts hydrate from `analyticsSettings` global (server-side inlines IDs).

- [ ] **Step 1: Write failing unit test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  (global as any).window = { dataLayer: [], fbq: vi.fn() };
});

describe("track", () => {
  it("pushes to dataLayer", async () => {
    const { track } = await import("@/lib/analytics");
    track("product_viewed", { id: "kaju-katli" });
    expect((global as any).window.dataLayer.at(-1).event).toBe("product_viewed");
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create `lib/analytics.ts`**

```ts
type EventName =
  | "product_viewed" | "story_viewed" | "karigar_viewed" | "packaging_viewed"
  | "gift_builder_started" | "gift_builder_completed" | "add_to_cart"
  | "lead_submitted" | "whatsapp_clicked" | "search_used"
  | "draft_saved" | "locale_changed" | "theme_changed" | "missing_translation";

export function track(event: EventName, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...payload });
  if (typeof w.fbq === "function") {
    w.fbq("trackCustom", event, payload);
  }
}
```

- [ ] **Step 4: Create `AnalyticsScripts.tsx`**

Server component that reads `analyticsSettings` from Payload and inlines GA4 + Meta Pixel scripts. Mounted in `app/layout.tsx` after `<Theme>` provider. Use Next `Script` from `next/script` with `strategy="afterInteractive"`.

- [ ] **Step 5: Run tests, verify pass**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/analytics.ts components/Analytics/ app/layout.tsx tests/unit/analytics.test.ts
git commit -m "feat: GA4 + Meta Pixel analytics with track() helper"
```

---

## Task 20: SEO scaffold — sitemap, robots, metadata, schema.org

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Create: `lib/seo/schema.ts`
- Modify: `app/[locale]/mithai/[slug]/page.tsx` (add JSON-LD)
- Test: `tests/unit/sitemap.test.ts`

**Interfaces:**
- Produces: dynamic sitemap from Payload; `robots.txt` allow-all with sitemap link; JSON-LD `Product`, `BreadcrumbList`, `Organization` per route.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";

describe("sitemap", () => {
  it("returns urls for seeded mithai product", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    expect(result.some((u: any) => u.url.includes("/mithai/kaju-katli"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Create `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { getPayload } from "@/lib/payload-client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload();
  const locales = ["en", "hi", "kn"];
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    entries.push({ url: `${base}/${locale}`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 });
    entries.push({ url: `${base}/${locale}/mithai`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 });
    entries.push({ url: `${base}/${locale}/stories`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 });
  }

  for (const locale of locales) {
    const r = await payload.find({ collection: "mithai-products", limit: 200, locale });
    for (const doc of r.docs as any[]) {
      if (!doc.slug) continue;
      entries.push({ url: `${base}/${locale}/mithai/${doc.slug}`, lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(), changeFrequency: "weekly", priority: 0.8 });
    }
    const s = await payload.find({ collection: "stories", limit: 200, locale });
    for (const doc of s.docs as any[]) {
      if (!doc.slug) continue;
      entries.push({ url: `${base}/${locale}/stories/${doc.slug}`, lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(), changeFrequency: "weekly", priority: 0.6 });
    }
  }

  return entries;
}
```

- [ ] **Step 4: Create `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: Add JSON-LD to PDP**

In `app/[locale]/mithai/[slug]/page.tsx`, append a `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(productSchema)}} />` block.

`lib/seo/schema.ts` exports `productSchema(doc)`, `organizationSchema()`, `breadcrumbSchema(trail)`.

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/sitemap.ts app/robots.ts lib/seo/schema.ts app/[locale]/mithai/[slug]/page.tsx tests/unit/sitemap.test.ts
git commit -m "feat: SEO scaffold — sitemap, robots, JSON-LD on PDP"
```

---

## Task 21: Stub commerce routes — `/cart`, `/checkout`, `/account`, `/track-order`

**Files:**
- Modify: `app/[locale]/cart/page.tsx` (or relocate to `app/[locale]/(commerce)/cart/page.tsx`)
- Create: `app/[locale]/checkout/page.tsx`
- Create: `app/[locale]/account/page.tsx`
- Create: `app/[locale]/track-order/page.tsx`
- Create: `components/commerce/CommerceStub.tsx`
- Test: `tests/e2e/commerce-stubs.spec.ts`

**Interfaces:**
- Produces: each route renders the branded stub: cart contents (current CartContext), "Checkout launching soon" message, WhatsApp CTA + lead CTA. `/track-order` tells user order tracking launches with Phase 8 commerce.

- [ ] **Step 1: Write failing E2E**

```ts
import { test, expect } from "@playwright/test";

test("cart stub shows WhatsApp CTA", async ({ page }) => {
  await page.goto("/en/cart");
  await expect(page.getByRole("link", { name: /whatsapp/i })).toBeVisible();
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Build `CommerceStub` component**

Reusable: takes `title`, `blurb`, optional children. Renders WhatsApp deep link (`https://wa.me/${whatsappNumber}`) + link to `/weddings` if lead intent. Reads `whatsappNumber` from `analyticsSettings`.

- [ ] **Step 4: Build four pages**

Each page imports `CommerceStub` with appropriate copy. `/cart` page also lists current cart items (read from CartContext — wrap in client component).

- [ ] **Step 5: Run tests, verify pass**

Run: `npm run test:e2e -- tests/e2e/commerce-stubs.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/cart app/[locale]/checkout app/[locale]/account app/[locale]/track-order components/commerce/ tests/e2e/commerce-stubs.spec.ts
git commit -m "feat: branded commerce stubs (cart, checkout, account, track-order)"
```

---

## Task 22: ISR revalidation webhook + on-demand cache purge

**Files:**
- Create: `app/api/revalidate/route.ts`
- Modify: `payload.config.ts` (afterChange hook on collections)

**Interfaces:**
- Produces: `POST /api/revalidate` accepts `{ path }` or `{ collection, slug, locale }`. Calls `revalidatePath()` or `res.revalidate()`. Payload `afterChange` hook fires it on every doc change.

- [ ] **Step 1: Create route**

`app/api/revalidate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (body.path) {
    revalidatePath(body.path);
  } else if (body.collection && body.slug) {
    for (const locale of ["en", "hi", "kn"]) {
      revalidatePath(`/${locale}/${body.collection}/${body.slug}`);
    }
  } else {
    revalidatePath("/", "layout");
  }
  return NextResponse.json({ revalidated: true });
}
```

- [ ] **Step 2: Add `afterChange` hook to Payload config**

For each product + story collection, add:
```ts
hooks: {
  afterChange: [async ({ doc, req }) => {
    if (process.env.NODE_ENV === "production") {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "" },
          body: JSON.stringify({ collection: "mithai-products", slug: doc.slug, locale: req.locale }),
        });
      } catch (e) { console.error("[revalidate]", e); }
    }
  }],
}
```

- [ ] **Step 3: Manual test**

Open `/en/mithai/kaju-katli`. Edit the product in Payload admin. Refresh — new content shows within `revalidate=60` window, or instantly via webhook.

- [ ] **Step 4: Commit**

```bash
git add app/api/revalidate/route.ts payload.config.ts
git commit -m "feat: on-demand ISR revalidation via Payload afterChange webhook"
```

---

## Task 23: Vercel deploy config + env vars + Mongo Atlas

**Files:**
- Create: `vercel.ts`
- Modify: `.env.example` (add `NEXT_PUBLIC_SITE_URL`, `LEADS_INBOX`, `REVALIDATE_SECRET`)
- Create: `docs/deployment.md`

**Interfaces:**
- Produces: Vercel deployment via `vercel.ts`; documented env vars; Mongo Atlas URI placeholder.

- [ ] **Step 1: Create `vercel.ts`**

```ts
import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  regions: ["bom1"],
  functions: {
    "app/api/leads/route.ts": { maxDuration: 30 },
    "app/api/drafts/route.ts": { maxDuration: 30 },
    "app/api/search/route.ts": { maxDuration: 30 },
    "app/api/revalidate/route.ts": { maxDuration: 30 },
  },
  crons: [],
};
```

Install `@vercel/config` first: `npm install -D @vercel/config`.

- [ ] **Step 2: Document deployment**

`docs/deployment.md` covers:
1. Create Mongo Atlas M0 cluster + DB user + IP allowlist (Vercel egress IPs).
2. Set Vercel env vars (Production + Preview): `MONGODB_URI`, `PAYLOAD_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SITE_URL`, `LEADS_INBOX`, `REVALIDATE_SECRET`.
3. Run first deploy; Payload auto-creates indexes on first boot.
4. Create first admin user via Payload CLI: `npx payload create first-user`.

- [ ] **Step 3: Manual deploy**

Run: `npx vercel --prod`
Expected: build green; `/admin` reachable.

- [ ] **Step 4: Run Lighthouse against preview URL**

Run: `lhci autorun -- --collect.url=https://<vercel-preview>.vercel.app/en`
Expected: Performance ≥ 90, Accessibility ≥ 95.

- [ ] **Step 5: Commit**

```bash
git add vercel.ts .env.example docs/deployment.md
git commit -m "chore: Vercel deploy config + deployment doc"
```

---

## Task 24: Final E2E + Lighthouse + axe CI gates

**Files:**
- Modify: `lighthouserc.json` (already created in Task 1 — ensure URLs point at preview deploy in CI)
- Create: `tests/e2e/a11y.spec.ts`
- Create: `.github/workflows/ci.yml` (if repo uses GitHub Actions; skip if not)

**Interfaces:**
- Produces: CI gate running types, lint, unit, integration, E2E, axe, Lighthouse on every PR.

- [ ] **Step 1: Write a11y test**

`tests/e2e/a11y.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/en", "/en/mithai", "/en/stories", "/en/weddings"];

for (const p of PAGES) {
  test(`${p} has no critical a11y violations`, async ({ page }) => {
    await page.goto(p);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
  });
}
```

- [ ] **Step 2: Create CI workflow (optional)**

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test:unit
      - run: npm run build
```

- [ ] **Step 3: Run full suite locally**

Run: `npm run lint && npx tsc --noEmit && npm run test:unit && npm run test:e2e`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/a11y.spec.ts .github/workflows/ci.yml lighthouserc.json
git commit -m "test: full CI gate — lint, types, unit, e2e, axe, lighthouse"
```

---

## Phase 0 Acceptance Criteria (cross-check against spec §15)

After all 24 tasks complete:

- [ ] Mishran-default theme + 3 occasion variants locked; rest archived on branch `archive/design-systems-pre-collapse`
- [ ] Locale routing for `en`, `hi`, `kn` active; hreflang emitted
- [ ] Payload CMS installed; admin at `/admin`
- [ ] Shared collections defined (`stories`, `karigars`, `farms`, `packaging`, `occasions`)
- [ ] One sample product collection per vertical defined and seeded
- [ ] `leads` collection + `/api/leads` endpoint + Resend email
- [ ] Brand-home live with cinematic hero + 4 vertical portals
- [ ] Each vertical has landing page + one sample detail page
- [ ] Wedding + corporate lead forms functional
- [ ] Analytics events wired (GA4, Meta Pixel, `track()` helper)
- [ ] Lighthouse ≥ 90 on home, mithai hub, sample PDP
- [ ] Playwright E2E covers golden paths
- [ ] Vercel deploy green; MongoDB connected; ISR working

---

## Notes for executors

- Payload 3.x has frequent minor-version changes. If a `CollectionConfig` import path fails, check `node_modules/payload/dist/types/index.d.ts` and adjust.
- Mongo Atlas M0 free tier supports ~512 collections and is plenty for v1.
- Resend requires domain verification before production sends; use sandbox sender for dev.
- Tasks 5–12 require a running MongoDB. For local dev use `mongod` or Docker; for CI use in-memory mongo via `mongodb-memory-server`.
- Tasks 13+ depend on Tasks 5–9 for content. Seed before running E2E.
