# Mishran Payload Admin Aesthetic Overhaul — Design

**Date:** 2026-08-11
**Status:** Approved (pending spec review)
**Scope:** Full overhaul of Payload 3.x admin panel for Mishran brand — visual identity, theme switcher, nav grouping, custom dashboard widgets, custom list-view cells for product collections.
**Branch:** `worktree-mishran-foundation` → merge to `main`

---

## 1. Goal

Make the Payload admin panel feel like a Mishran-internal tool, not generic Payload. Specifically:

- Brand mark visible everywhere (sidebar crest, login wordmark).
- Mishran color palette applied by default; editors can switch between 3 admin-specific themes.
- Navigation grouped by domain (Brand / Products / Catalog Ops / Storefront / Settings).
- Dashboard surfaces operational signals (recent leads, low-stock mithai, pending stories, catalog counts) above Payload's default view.
- Product list views show image thumbnails + key metadata in the primary name cell.

Non-goals: full white-label URL (no `/manage` rename), admin-side i18n, role-specific dashboards, custom edit views (only list-view cells).

## 2. Approach Summary

**Payload-native extension points** — use `admin.components.*` and `admin.group` as designed. Minimal custom CSS; one custom React component per extension point.

- Branding: `admin.components.graphics.Icon` + `Logo`
- Login hero: `admin.components.beforeLogin`
- Theme switcher: `admin.components.settingsMenu`
- Dashboard widgets: `admin.components.beforeDashboard`
- Custom cells: `field.admin.components.Cell` on each product collection's `name` field
- Nav grouping: `admin.group` on every collection + global

**Why not couple to storefront themes:** storefront has 8 user-selectable themes defined in `app/globals.css`. Payload admin runs in a separate Next.js route segment `/(payload)` and does not inherit storefront theme state. Coupling would require syncing theme across route boundaries via cookies/localStorage — fragile, easy to break. Admin gets its own 3 themes.

## 3. Branding

### 3.1 Logo Assets

Source: `/Users/ravibyakod/Downloads/Mishran Final Logo + Crest.pdf` (Adobe Illustrator vector, 2 pages).

- **Page 1 — Wordmark:** "MISHRAN / ESTD 2025 / Sweets & Snacks" in gold serif (~#D4AF37) on white. No icon. Pure typography.
- **Page 2 — Crest:** Circular emblem — central stylized face (closed eyes, bindi, mustache), inner ring of lotus/petal motifs, outer thin gold ring (~#B8860B + white). No text.

**Conversion strategy:** install `pdf2svg` via brew, extract both pages to SVG.

```
brew install pdf2svg
pdf2svg "Mishran Final Logo + Crest.pdf" mishran-wordmark.svg 1
pdf2svg "Mishran Final Logo + Crest.pdf" mishran-crest.svg 2
```

Output files: `public/admin/mishran-wordmark.svg`, `public/admin/mishran-crest.svg`.

PNG fallbacks for favicon + legacy contexts (rendered at 200 DPI from PDF):
- `public/admin/mishran-crest-192.png`
- `public/admin/mishran-crest-512.png`
- `public/admin/favicon.ico` (multi-size: 16/32/48)

### 3.2 Graphics Components

`components/payload-admin/graphics/CrestIcon.tsx`:
```tsx
// Server component — inline SVG via <Image src="/admin/mishran-crest.svg" />.
// Props: size?: number (default 32), className?: string
// Used by admin.components.graphics.Icon
```

`components/payload-admin/graphics/WordmarkLogo.tsx`:
```tsx
// Server component — inline SVG via <Image src="/admin/mishran-wordmark.svg" />.
// Props: height?: number (default 64), className?: string
// Used by admin.components.graphics.Logo (login page)
```

### 3.3 Login Hero

`admin.components.beforeLogin` injects `<MishranLoginHero/>` above the default Payload login form.

Layout: two-column on `min-width: 1024px`, single-column below.

- Left column (40% width on desktop): crest centered on kakvi-brown gradient (`--t-primary` → `--t-gold`), tagline "Mishran Sweets & Snacks — Editor Console" below crest in cream.
- Right column (60%): default Payload login form, unchanged.

Mobile: hero stacks above login form, crest at 80px, no gradient (solid kakvi bg for perf).

## 4. Theme System

### 4.1 Three Admin Themes

Defined as CSS variable blocks scoped to `body[data-admin-theme="<name>"]`.

| Theme name | bg | text | primary | gold | border | font |
|---|---|---|---|---|---|---|
| `mishran-admin` (default) | `#f7efe0` cream | `#2a1a0e` kakvi-dark | `#9b4d2a` kakvi | `#d79a35` | `#e8d5b8` | Outfit |
| `mishran-midnight` | `#1a1614` near-black | `#f0e6d2` cream-light | `#d79a35` gold | `#d79a35` | `#3a2f25` | Outfit |
| `mishran-monsoon` | `#e8eef2` cool-gray | `#1f2937` slate | `#e07a3c` saffron | `#c4942c` deep gold | `#cbd5e1` | Outfit |

### 4.2 CSS Variable Plumbing

`app/(payload)/admin/custom.scss` (loaded via Payload `admin.css` config):

```scss
:root {
  --mishran-font-display: "Outfit", system-ui, sans-serif;
  --mishran-radius-sm: 6px;
  --mishran-radius-md: 10px;
  --mishran-radius-lg: 16px;
}

body[data-admin-theme="mishran-admin"] {
  --t-bg: #f7efe0;
  --t-text: #2a1a0e;
  --t-primary: #9b4d2a;
  --t-gold: #d79a35;
  --t-border: #e8d5b8;
  --t-text-muted: #6b4f37;
  --t-bg-card: #ffffff;
  --t-bg-control: #fdf8ed;
}

body[data-admin-theme="mishran-midnight"] { /* ... */ }
body[data-admin-theme="mishran-monsoon"] { /* ... */ }
```

Then map Mishran tokens onto Payload's own CSS variables so Payload's built-in components pick up Mishran colors:

```scss
:root {
  --theme-base: var(--t-primary);
  --theme-elevation-100: var(--t-bg-card);
  --theme-elevation-200: var(--t-bg);
  --theme-elevation-300: var(--t-bg);
  --theme-elevation-400: var(--t-border);
  --theme-elevation-500: var(--t-text-muted);
  --theme-elevation-600: var(--t-text);
  --theme-elevation-800: var(--t-text);
  --theme-elevation-900: var(--t-text);
  --theme-success-500: var(--t-primary);
  --theme-warning-500: var(--t-gold);
  --theme-error-500: #c0392b;
  --theme-graph-overlay-bg: var(--t-bg-card);
}
```

Payload 3.x exposes its theme via CSS variables under `--theme-*` (see `@payloadcms/ui`'s `@payloadcms/ui/dist/scss/_base.scss` and `_variables.scss`). The exact variable names to override (e.g. `--theme-elevation-100`, `--theme-success-500`, etc.) are verified at implementation time by reading those files. If names differ across Payload minor versions, the implementation plan documents the exact `@payloadcms/ui` version-pinned variable names. The intent is fixed (Mishran tokens → Payload tokens); the binding is impl-time.

### 4.3 Theme Switcher

`admin.components.settingsMenu` adds `<AdminThemeSwitcher/>` to the settings popup (gear icon above logout).

Behavior:
- Renders as a labeled dropdown: "Admin theme" with 3 options.
- On change: writes `localStorage["mishran:admin-theme"]`, sets `document.body.dataset.adminTheme`.
- On mount: reads localStorage (default `"mishran-admin"` if unset/invalid), sets `data-admin-theme` before React hydration if possible (via inline script in `app/(payload)/admin/layout.tsx` to prevent flash).
- Server-side: reads `cookies().get("mishran-admin-theme")` for SSR; client syncs cookie from localStorage on first mount.

**Cookie approach** preferred over localStorage-only because Payload admin SSR can read the cookie and set `data-admin-theme` on `<body>` server-side — eliminates theme flash entirely. localStorage is fallback for anon pre-login (no settings menu there, so this case is moot).

Decision: **cookie-based**, 1-year expiry, `sameSite=lax`, `path=/`.

## 5. Nav Grouping

### 5.1 Groups

| Order | Group label | Members |
|---|---|---|
| 1 | `01 Brand` | Stories, Karigars, Farms, Occasions |
| 2 | `02 Products` | MithaiProducts, QsrMenuItems, SnackProducts, MerchProducts, GiftBoxes |
| 3 | `03 Catalog Ops` | Media, Packaging |
| 4 | `04 Storefront` | HomeHero, NavSettings, ThemeSettings, BrandSettings |
| 5 | `05 Settings` | StoreSettings, AnalyticsSettings, Users |

Lead collection (`Leads`) and Drafts collection — currently flat. Lead belongs in **Catalog Ops** or its own group? Decision: Leads → `03 Catalog Ops` (sales-ops adjacent); Drafts → `04 Storefront` (editorial workflow).

### 5.2 Ordering

Payload 3 renders groups alphabetically. Prefix labels with `01 `–`05 ` to enforce order. Prefixes are visible in UI (accepted tradeoff; cleaner alternative requires custom `Nav` component override — out of scope).

### 5.3 Implementation

Each collection's `CollectionConfig` and each global's `GlobalConfig` gets:

```ts
admin: {
  group: "01 Brand",  // or whichever
}
```

No central registry — group strings are duplicated across configs. Acceptable per Payload idiom.

## 6. Custom Dashboard

### 6.1 Strategy

Inject custom dashboard via `admin.components.beforeDashboard`. Default Payload dashboard (recent activity, count summary) remains visible below.

Rationale: overriding `admin.components.views.dashboard` entirely loses Payload's built-ins and requires re-implementing version-warning / license banners. Injecting before is the documented escape hatch.

### 6.2 Widget Specs

Each widget is a client component that fetches from Payload REST API (`/api/<collection>?...`). Admin session cookie authenticates automatically.

#### 6.2.1 `<RecentLeads/>`

- **Fetch:** `GET /api/leads?limit=5&sort=-createdAt&depth=0`
- **Display:** list of 5 rows. Each row: name (link to `/admin/collections/leads/<id>`), email (muted), status pill (`new` gold, `contacted` primary, `won` green, `lost` gray).
- **Skeleton:** 5 rows of gray bars.
- **Empty:** "No leads yet" + link to `/admin/collections/leads/create`.

#### 6.2.2 `<MithaiFreshnessBoard/>`

- **Fetch:** `GET /api/mithai-products?where[status][equals]=draft&limit=0&depth=0` first (count), then for the list: `GET /api/mithai-products?limit=20&depth=1&sort=-updatedAt&where[_status][equals]=published`
- **Display:** groups products by `freshnessStatus` (`made-daily`, `made-to-order`, `batch-frozen`). Three columns: each shows count + 3 example names. Click column header → list view filtered by that status.
- **Skeleton:** 3 gray columns.
- **Empty:** "No mithai published yet" + link to create.

Renames from `<LowStockMithai/>` because `stockStatus` field does not exist on `mithai-products`. The actual operational signal is `freshnessStatus` (production cadence) — useful for editorial/ops review. True low-stock requires a Phase-8 commerce field, deferred to v2.

#### 6.2.3 `<PendingStories/>`

- **Fetch:** `GET /api/stories?where[_status][equals]=draft&limit=5&sort=-updatedAt`
- **Display:** list of 5 rows. Each: story title (link to `/admin/collections/stories/<id>`), pillar badge, "edited Xd ago" relative time.
- **Skeleton:** 5 rows.
- **Empty:** "No pending drafts" + link to create new story.

#### 6.2.4 `<CatalogCounts/>`

- **Fetch:** fan-out 5 parallel requests — `GET /api/<coll>?limit=0&depth=0` for each of `mithai-products`, `qsr-menu-items`, `snack-products`, `merch-products`, `gift-boxes`. Use `limit=0` to skip documents; Payload returns `totalDocs` in response.
- **Display:** grid of 5 cards. Each card: large number (total), collection label, link arrow to list view.
- **Skeleton:** 5 gray rectangles.
- **Error:** individual card shows "—" on failure.

### 6.3 Layout

Grid: 2 columns on desktop (`min-width: 1024px`), 1 column mobile. Order:
- Row 1: `<RecentLeads/>` | `<MithaiFreshnessBoard/>`
- Row 2: `<PendingStories/>` | `<CatalogCounts/>`

`<CatalogCounts/>` may span 2 columns if 5-card grid overflows; otherwise keep 4-card grid + 1 wrap.

### 6.4 Error Boundaries

Each widget wrapped in its own React error boundary (`<WidgetErrorBoundary/>`). Boundary renders a small "Couldn't load <widget name> — retry" card on error. One widget failing does not affect others.

## 7. Custom Cells

### 7.1 Strategy

Keep Payload's default list view (sorting, filtering, pagination intact). Override only the `name` field's `Cell` component on each product collection. The custom cell reads `rowData` to compose a thumbnail + meta line.

### 7.2 `<ProductNameCell/>`

Path: `components/payload-admin/cells/ProductNameCell.tsx`.

```tsx
"use client";
import type { DefaultCellComponentProps } from "payload";
import Image from "next/image";

type MetaItem = { label: string; tone?: "default" | "muted" | "primary" | "gold" | "danger" };

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  images?: { url: string; alt?: string }[] | null;  // varies by collection
  priceLabel?: string;
  category?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
};

type Behavior = {
  imageField: "images" | "image";  // which field on the row has the thumbnail
  meta: (row: ProductRow) => MetaItem[];
  badges?: (row: ProductRow) => MetaItem[];
};

export function makeProductNameCell(behavior: Behavior) {
  return function ProductNameCell({ cellData, rowData }: DefaultCellComponentProps) {
    const imageUrl = pickImage(rowData, behavior.imageField);
    const meta = behavior.meta(rowData);
    const badges = behavior.badges?.(rowData) ?? [];
    return (
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <Image src={imageUrl} alt={rowData.name ?? ""} width={48} height={48} className="rounded-md object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-md bg-bg-muted" />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-text">{cellData ?? rowData.name}</span>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {meta.map((m, i) => (
              <span key={i} className={toneClass(m.tone)}>{m.label}</span>
            ))}
            {badges.map((b, i) => (
              <span key={`b${i}`} className={`rounded-full px-2 py-0.5 text-xs ${badgeToneClass(b.tone)}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };
}
```

### 7.3 Per-Collection Behavior

Verified against actual collection schemas:

| Collection | Image field | Price field | Type field | Badges |
|---|---|---|---|---|
| MithaiProducts | `images[0].image` (array→upload) | `displayPrice` | `family` | `freshnessStatus` ("made-daily"/"made-to-order"/"batch-frozen") |
| QsrMenuItems | `image` (upload) | none — skip price meta | `category` | `veg` → green dot / red dot |
| SnackProducts | `images[0].image` | `msrp` | `category` | none |
| MerchProducts | `images[0].image` | `price` | `type` | `availability` if set |
| GiftBoxes | `images[0].image` | none — skip price meta | `size` | none |

List view fetches with `depth=1` by default — upload fields resolve to full Media doc objects with `url`. Cell reads `rowData.images[0].image.url` (array case) or `rowData.image.url` (single case).

Each collection's config file imports `makeProductNameCell` and assigns it to the `name` field. Per-collection behaviors (verified field names):

```ts
// collections/MithaiProducts.ts (existing file, modified)
import { makeProductNameCell } from "@/components/payload-admin/cells/ProductNameCell";

const mithaiBehavior: ProductCellBehavior = {
  image: { kind: "array", field: "images", imageKey: "image" },
  meta: (row) => [row.displayPrice, row.family].filter(Boolean),
  badges: (row) => row.freshnessStatus
    ? [{ label: row.freshnessStatus.replace(/-/g, " "), tone: "gold" }]
    : [],
};

// Similar behaviors for QsrMenuItems, SnackProducts, MerchProducts, GiftBoxes
// in their respective collection files.
```

## 8. Testing Strategy

### 8.1 Unit (vitest)

- `<AdminThemeSwitcher/>`:
  - Renders 3 options
  - Changing selection writes cookie + localStorage, updates body data attribute
  - Initial mount reads existing cookie
- `<MishranLoginHero/>`:
  - Renders crest + tagline
  - Hidden on mobile layout (CSS assert via class presence)
- `<RecentLeads/>`:
  - Skeleton while loading
  - Renders 5 rows on resolved fetch
  - Empty state on `totalDocs === 0`
  - Error boundary catches fetch rejection
- `<LowStockMithai/>`:
  - Skeleton while loading
  - Renders up to 10 rows
  - "Out" badge on out_of_stock
  - Empty state when no low/out stock
- `<PendingStories/>`:
  - Skeleton while loading
  - Renders up to 5 drafts
  - Relative time formatting ("edited 2d ago")
  - Empty state when no drafts
- `<CatalogCounts/>`:
  - 5 cards rendered on resolved fan-out
  - One card shows "—" if that collection's fetch fails (others unaffected)
- `<ProductNameCell/>`:
  - Renders image when present, fallback when absent
  - Renders meta items in order
  - Renders badges with correct tone classes
  - Falls back to `rowData.name` when `cellData` is empty
  - Per-collection behavior matrix (5 collections × representative rows)

### 8.2 E2E (Playwright)

- Login page:
  - Wordmark visible above login form
  - Crest visible on hero (desktop layout)
- Authenticated admin:
  - Sidebar crest icon visible (graphics.Icon override)
  - Settings menu opens → 3 admin themes listed
  - Click "Mishran Midnight" → body has `data-admin-theme="mishran-midnight"`; reload preserves via cookie
  - Dashboard: 4 widgets render (mock API via Playwright route interception)
  - `mithai-products` list view: thumbnails visible in name column
  - Nav groups render in order `01`–`05`

### 8.3 Manual

- Visual diff (screenshot) across 3 admin themes: login, dashboard, list view, edit view.
- Verify no theme flash on hard reload with cookie set.
- Verify default Payload features still work: search, create-new, version diff, autosave.

## 9. File Structure

```
components/payload-admin/
├── graphics/
│   ├── CrestIcon.tsx              # admin.components.graphics.Icon
│   └── WordmarkLogo.tsx           # admin.components.graphics.Logo
├── login/
│   └── MishranLoginHero.tsx       # admin.components.beforeLogin
├── dashboard/
│   ├── MishranDashboard.tsx       # container — grid layout
│   ├── RecentLeads.tsx
│   ├── MithaiFreshnessBoard.tsx
│   ├── PendingStories.tsx
│   ├── CatalogCounts.tsx
│   └── WidgetErrorBoundary.tsx
├── cells/
│   └── ProductNameCell.tsx        # makeProductNameCell factory
├── theme/
│   ├── AdminThemeSwitcher.tsx     # admin.components.settingsMenu
│   └── admin-theme.ts             # cookie + body data attribute helpers
└── lib/
    ├── dashboard-queries.ts       # typed fetch helpers
    └── product-cell-behaviors.ts  # per-collection behavior objects

app/(payload)/admin/
├── custom.scss                    # CSS var tokens, 3 theme blocks, Payload var overrides
└── layout.tsx                     # existing — may inject inline script for no-flash theme boot

public/admin/
├── mishran-crest.svg
├── mishran-wordmark.svg
├── mishran-crest-192.png
├── mishran-crest-512.png
└── favicon.ico

scripts/
└── extract-logos.sh               # pdf2svg wrapper — one-shot, committed

tests/unit/payload-admin/
├── AdminThemeSwitcher.test.tsx
├── MishranLoginHero.test.tsx
├── RecentLeads.test.tsx
├── LowStockMithai.test.tsx
├── PendingStories.test.tsx
├── CatalogCounts.test.tsx
├── ProductNameCell.test.tsx
└── WidgetErrorBoundary.test.tsx

tests/e2e/admin-aesthetics.spec.ts
```

## 10. payload.config.ts Wiring (Summary)

```ts
admin: {
  user: "users",
  autoLogin: isLocalDev ? { email: "dev@mithai.shop", password: "dev-password" } : false,
  css: "/app/(payload)/admin/custom.scss",
  components: {
    graphics: {
      Icon: "@/components/payload-admin/graphics/CrestIcon",
      Logo: "@/components/payload-admin/graphics/WordmarkLogo",
    },
    beforeLogin: ["@/components/payload-admin/login/MishranLoginHero"],
    beforeDashboard: ["@/components/payload-admin/dashboard/MishranDashboard"],
    settingsMenu: ["@/components/payload-admin/theme/AdminThemeSwitcher"],
  },
},
```

## 11. Global Constraints

- Payload 3.85+ APIs only. `admin.components.graphics.{Icon,Logo}`, `admin.components.{beforeLogin,beforeDashboard,settingsMenu}`, `admin.css`, `admin.group`, `field.admin.components.Cell` — all verified against v3.85 docs.
- All client components must start with `"use client"` directive.
- All image renders via `next/image` — never raw `<img>`.
- All SVGs sourced from `public/admin/` via `next/image`. SVGs require either `unoptimized` on the Image or `dangerouslyAllowSVG: true` in next.config — pick `dangerouslyAllowSVG: true` (Mishran SVGs are first-party, safe) so SVGs participate in the image optimizer pipeline for other formats.
- Relative time formatting uses native `Intl.RelativeTimeFormat` — no `date-fns`/`dayjs`/`moment` dependency. Wrap in `lib/relative-time.ts` for reuse.
- Existing collection/global config files must be edited in place — no renaming, no relocating.
- Custom cell receives `DefaultCellComponentProps` — type import from `payload`.
- Theme cookie name `mishran-admin-theme` — exact string.
- Theme names: `mishran-admin`, `mishran-midnight`, `mishran-monsoon` — exact strings.
- Nav group prefixes: `01 `, `02 `, `03 `, `04 `, `05 ` — leading zero, single space, capital first letter of group name.

## 12. Out of Scope (Deferred)

- White-label admin URL (`/admin` → `/manage`) — deferred to v2
- Custom Nav component (for unprefixed group ordering) — deferred
- Per-role dashboard variants — deferred until roles are defined
- Custom edit-view chrome — deferred (list-view cells only in v1)
- Admin-side i18n (Spanish/French/Indian language support in admin UI) — deferred, separate brainstorm
- Admin-side analytics integration (GA4 events for admin actions) — deferred
- Branding for outbound editor notification emails — deferred
