# Hero Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static kaju-katli still life in `BrandHero` with a rotating carousel of curated products, mixed across all 5 product collections, with autoplay + manual controls + reduced-motion support.

**Architecture:** A new Payload global `home-hero` holds an array of polymorphic product relationships. Server component `BrandHero` reads the global, resolves each row to a flat `Slide` (with media URL, name, optional price, locale-aware PDP path), and hands them to a new client component `HeroRotator` which owns carousel state, autoplay timer, and accessibility wiring. Empty global → BrandHero falls back to the current static layout.

**Tech Stack:** Next.js 16 App Router (React 19) · Payload 3.x with MongoDB · next-intl · Vitest · Playwright.

## Global Constraints

- **Theme system:** No new colors. Slides render via existing CSS tokens (`bg-card`, `border-card`, `text-primary`, `text-heading`, `text-muted`). Slide chrome must look correct on all 8 themes.
- **i18n:** All new copy via next-intl message keys in `messages/{en,hi,kn}.json` — no hard-coded English in components.
- **Link:** Use `Link` from `@/i18n/navigation`, never `next/link` directly (auto-prefixes locale).
- **Image:** `next/image` with `fill` + `sizes`. Priority only on first slide.
- **Cart integration:** Slide's "Add to cart" reuses `useCart().addItem({id, name, priceLabel, image})` — shape must match `CartItem` minus `quantity`.
- **No new dependencies.** Use React 19 + Next.js built-ins only.
- **Collection slugs are stable contracts:** `mithai-products`, `qsr-menu-items`, `snack-products`, `merch-products`, `gift-boxes`. Reference these strings verbatim.
- **Price field inconsistency:** Only `mithai-products.displayPrice` and `merch-products.price` exist. QSR/snacks/gift-boxes have no price field. `Slide.priceLabel` is optional; card renders price only when present.
- **Empty global fallback:** When the global has 0 valid slides, `BrandHero` must render the current static layout (kaju-katli still life) without throwing or logging warnings.
- **Tests gate CI:** `npm run lint && npx tsc --noEmit && npm run test:unit && npm run build` must stay green.

---

## File Structure

| File | Role | Status |
|---|---|---|
| `globals/HomeHero.ts` | Payload global config — `slides` array with polymorphic relationship | new |
| `payload.config.ts` | Register `HomeHero` global | modified |
| `lib/home-hero.ts` | Server resolver: reads global, resolves polymorphic products, filters invalid, returns `Slide[]` | new |
| `components/home/use-prefers-reduced-motion.ts` | Client hook for `prefers-reduced-motion` media query | new |
| `components/home/HeroRotator.tsx` | Client component — carousel state, autoplay, controls | new |
| `components/home/BrandHero.tsx` | Server component — reads global, calls resolver, falls back to static on empty | modified |
| `messages/{en,hi,kn}.json` | New message keys for hero card CTAs, prev/next labels | modified |
| `tests/unit/home-hero-resolver.test.ts` | Unit tests for `lib/home-hero.ts` | new |
| `tests/unit/use-prefers-reduced-motion.test.ts` | Unit tests for the hook | new |
| `tests/unit/hero-rotator.test.tsx` | Unit tests for the carousel component | new |
| `tests/e2e/home-hero.spec.ts` | E2E: carousel renders, controls work, add-to-cart works | new |

---

## Task 1: HomeHero Payload Global

**Files:**
- Create: `globals/HomeHero.ts`
- Modify: `payload.config.ts` (register the global)
- Test: `tests/unit/home-hero-global.test.ts`

**Interfaces:**
- Consumes: existing collection slugs (`mithai-products`, `qsr-menu-items`, `snack-products`, `merch-products`, `gift-boxes`)
- Produces: a registered Payload global at slug `home-hero` with an array field `slides[].product` (polymorphic relationship) and `slides[].captionOverride` (text)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/home-hero-global.test.ts
import { describe, it, expect } from "vitest";
import { HomeHero } from "@/globals/HomeHero";

describe("HomeHero global", () => {
  it("uses slug home-hero", () => {
    expect(HomeHero.slug).toBe("home-hero");
  });

  it("is publicly readable", () => {
    expect(HomeHero.access?.read).toBeTypeOf("function");
    // read must return true for anon
    expect((HomeHero.access as any).read({ req: {} } as any)).toBe(true);
  });

  it("has slides array field with polymorphic product relationship", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    );
    expect(slidesField).toBeDefined();
    expect(slidesField.type).toBe("array");

    const productField = slidesField.fields.find(
      (f: any) => f.name === "product"
    );
    expect(productField.type).toBe("relationship");
    expect(productField.relationTo).toEqual([
      "mithai-products",
      "qsr-menu-items",
      "snack-products",
      "merch-products",
      "gift-boxes",
    ]);
    expect(productField.required).toBe(true);
  });

  it("has optional captionOverride per slide", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    );
    const captionField = slidesField.fields.find(
      (f: any) => f.name === "captionOverride"
    );
    expect(captionField.type).toBe("text");
    expect(captionField.required).toBeFalsy();
  });

  it("caps slides at 12 rows", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    ) as any;
    expect(slidesField.maxRows).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/home-hero-global.test.ts`
Expected: FAIL — module `@/globals/HomeHero` not found.

- [ ] **Step 3: Implement HomeHero global**

```ts
// globals/HomeHero.ts
// Curated slides for the brand home hero carousel. Editor picks products
// from any of the 5 product collections, drag-reorders, optionally
// overrides the caption per slide. Empty global → BrandHero falls back
// to static kaju-katli still life (see lib/home-hero.ts).
import type { GlobalConfig } from "payload";

export const HomeHero: GlobalConfig = {
  slug: "home-hero",
  label: "Home Hero",
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "slides",
      type: "array",
      label: "Hero slides",
      minRows: 0,
      maxRows: 12,
      labels: {
        singular: "Slide",
        plural: "Slides",
      },
      fields: [
        {
          name: "product",
          type: "relationship",
          relationTo: [
            "mithai-products",
            "qsr-menu-items",
            "snack-products",
            "merch-products",
            "gift-boxes",
          ],
          required: true,
          admin: {
            description: "Pick from any product collection.",
          },
        },
        {
          name: "captionOverride",
          type: "text",
          admin: {
            description: "Optional. Defaults to the product name.",
          },
        },
      ],
      admin: {
        description: "Drag rows to reorder. First row renders first on home.",
      },
    },
  ],
};
```

- [ ] **Step 4: Register in payload.config.ts**

Modify `payload.config.ts`. Add the import after the existing globals import block (around line 38):

```ts
import { HomeHero } from "./globals/HomeHero";
```

Add to the `globals` array (around line 84-90):

```ts
  globals: [
    BrandSettings,
    NavSettings,
    ThemeSettings,
    AnalyticsSettings,
    StoreSettings,
    HomeHero,
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/home-hero-global.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Run full lint + tsc + unit to confirm no regressions**

Run: `npm run lint && npx tsc --noEmit && npm run test:unit`
Expected: all clean, no new failures.

- [ ] **Step 7: Commit**

```bash
git add globals/HomeHero.ts payload.config.ts tests/unit/home-hero-global.test.ts
git commit -m "feat(payload): add HomeHero global for curated hero slides"
```

---

## Task 2: Server Slide Resolver (`lib/home-hero.ts`)

**Files:**
- Create: `lib/home-hero.ts`
- Test: `tests/unit/home-hero-resolver.test.ts`

**Interfaces:**
- Consumes: `getPayload` from `@/lib/payload-client`, Payload polymorphic relationship shape (`{relationTo, value}`).
- Produces:
  - `Slide` type (exported)
  - `resolveHomeHeroSlides(): Promise<Slide[]>` — reads `home-hero` global, resolves polymorphic refs, filters invalid, returns flat slides. Returns `[]` on any error or empty.

```ts
// Slide shape — flat, client-safe, no Payload internals.
type Slide = {
  id: string;            // product doc id (string)
  collection: string;    // source collection slug
  name: string;          // captionOverride || product.name
  priceLabel?: string;   // undefined for collections without price
  image: string;         // resolved media URL
  imageAlt: string;      // for <Image alt="">
  href: string;          // locale-aware PDP path, e.g. "/mithai/kaju-katli"
};
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/home-hero-resolver.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveHomeHeroSlides } from "@/lib/home-hero";

// Mock payload-client so we control findGlobal + findByID behaviour.
vi.mock("@/lib/payload-client", () => ({
  getPayload: vi.fn(),
}));

import { getPayload } from "@/lib/payload-client";

type MockPayload = {
  findGlobal: ReturnType<typeof vi.fn>;
  findByID: ReturnType<typeof vi.fn>;
};

function mockPayload(overrides: Partial<MockPayload> = {}): MockPayload {
  return {
    findGlobal: vi.fn(),
    findByID: vi.fn(),
    ...overrides,
  };
}

describe("resolveHomeHeroSlides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when global is empty", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({ slides: [] }),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("returns empty array when global has no slides field", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({}),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("resolves mithai product with array images field", async () => {
    const mithaiDoc = {
      id: "mithai-1",
      name: "Kaju Katli",
      slug: "kaju-katli",
      displayPrice: "₹800 / 500g",
      images: [
        {
          image: {
            url: "https://cdn.test/kaju.jpg",
            alt: "Kaju Katli",
          },
        },
      ],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: {
                relationTo: "mithai-products",
                value: "mithai-1",
              },
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(mithaiDoc),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual({
      id: "mithai-1",
      collection: "mithai-products",
      name: "Kaju Katli",
      priceLabel: "₹800 / 500g",
      image: "https://cdn.test/kaju.jpg",
      imageAlt: "Kaju Katli",
      href: "/mithai/kaju-katli",
    });
  });

  it("resolves qsr product with single image field and no price", async () => {
    const qsrDoc = {
      id: "qsr-1",
      name: "Masala Chai",
      slug: "masala-chai",
      image: { url: "https://cdn.test/chai.jpg", alt: "Chai" },
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: {
                relationTo: "qsr-menu-items",
                value: "qsr-1",
              },
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(qsrDoc),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual({
      id: "qsr-1",
      collection: "qsr-menu-items",
      name: "Masala Chai",
      priceLabel: undefined,
      image: "https://cdn.test/chai.jpg",
      imageAlt: "Chai",
      href: "/qsr/masala-chai",
    });
  });

  it("uses captionOverride when present", async () => {
    const doc = {
      id: "m1",
      name: "Original Name",
      slug: "orig",
      images: [{ image: { url: "u", alt: "alt" } }],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: { relationTo: "mithai-products", value: "m1" },
              captionOverride: "Hero Copy",
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(doc),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides[0].name).toBe("Hero Copy");
  });

  it("skips slides when product fetch throws", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            { product: { relationTo: "mithai-products", value: "x" } },
            { product: { relationTo: "mithai-products", value: "y" } },
          ],
        }),
        findByID: vi.fn()
          .mockRejectedValueOnce(new Error("deleted"))
          .mockResolvedValueOnce({
            id: "y",
            name: "OK",
            slug: "ok",
            images: [{ image: { url: "u", alt: "alt" } }],
            _status: "published",
          }),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0].id).toBe("y");
  });

  it("skips slides when product has no image", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "qsr-menu-items", value: "q1" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "q1",
          name: "No Image Item",
          slug: "noimg",
          image: undefined,
          _status: "published",
        }),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("skips draft products", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "mithai-products", value: "d" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "d",
          name: "Draft",
          slug: "draft",
          images: [{ image: { url: "u", alt: "alt" } }],
          _status: "draft",
        }),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("returns empty when findGlobal throws", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockRejectedValue(new Error("DB down")),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/home-hero-resolver.test.ts`
Expected: FAIL — module `@/lib/home-hero` not found.

- [ ] **Step 3: Implement the resolver**

```ts
// lib/home-hero.ts
// Server-only. Reads the `home-hero` Payload global, resolves each
// polymorphic relationship into a flat Slide shape that the client
// HeroRotator can render without knowing anything about Payload.
//
// Image field shape differs per collection:
//   - mithai-products, snack-products, merch-products, gift-boxes:
//     `images: [{image: {url, alt}}]` (array, take [0])
//   - qsr-menu-items: `image: {url, alt}` (single)
//
// Price field differs per collection:
//   - mithai-products.displayPrice (string)
//   - merch-products.price (string)
//   - qsr-menu-items / snack-products / gift-boxes: undefined
//
// href is built from collection slug prefix + product.slug:
//   mithai-products -> /mithai/<slug>
//   qsr-menu-items  -> /qsr/<slug>
//   snack-products  -> /snacks/<slug>
//   merch-products  -> /merch/<slug>
//   gift-boxes      -> /build-a-gift/<slug>   (gift-boxes are showcased
//                                                inside build-a-gift flow)
//
// Any error → empty array. BrandHero falls back to static layout.
import { getPayload } from "@/lib/payload-client";

export type Slide = {
  id: string;
  collection: string;
  name: string;
  priceLabel?: string;
  image: string;
  imageAlt: string;
  href: string;
};

type PolymorphicRef = {
  relationTo: string;
  value: string;
};

type GlobalRow = {
  product?: PolymorphicRef;
  captionOverride?: string;
};

const HREF_PREFIX: Record<string, string> = {
  "mithai-products": "/mithai",
  "qsr-menu-items": "/qsr",
  "snack-products": "/snacks",
  "merch-products": "/merch",
  "gift-boxes": "/build-a-gift",
};

function readImageAndAlt(doc: any, collection: string): {url: string; alt: string} | null {
  if (collection === "qsr-menu-items") {
    const img = doc.image;
    if (!img?.url) return null;
    return { url: img.url, alt: img.alt || doc.name || "" };
  }
  const arr = Array.isArray(doc.images) ? doc.images : [];
  const first = arr[0]?.image;
  if (!first?.url) return null;
  return { url: first.url, alt: first.alt || doc.name || "" };
}

function readPriceLabel(doc: any, collection: string): string | undefined {
  if (collection === "mithai-products") return doc.displayPrice || undefined;
  if (collection === "merch-products") return doc.price || undefined;
  return undefined;
}

async function resolveOne(
  payload: any,
  row: GlobalRow
): Promise<Slide | null> {
  if (!row.product?.relationTo || !row.product?.value) return null;
  const { relationTo: collection, value: id } = row.product;

  let doc: any;
  try {
    doc = await payload.findByID({ collection: collection, id });
  } catch {
    return null;
  }
  if (!doc || doc._status === "draft") return null;

  const media = readImageAndAlt(doc, collection);
  if (!media) return null;

  const prefix = HREF_PREFIX[collection];
  if (!prefix || !doc.slug) return null;

  return {
    id: String(doc.id ?? id),
    collection,
    name: row.captionOverride?.trim() || String(doc.name ?? ""),
    priceLabel: readPriceLabel(doc, collection),
    image: media.url,
    imageAlt: media.alt,
    href: `${prefix}/${doc.slug}`,
  };
}

export async function resolveHomeHeroSlides(): Promise<Slide[]> {
  let payload: any;
  try {
    payload = await getPayload();
  } catch {
    return [];
  }

  let global: { slides?: GlobalRow[] };
  try {
    global = await payload.findGlobal({ slug: "home-hero" });
  } catch {
    return [];
  }

  const rows = Array.isArray(global?.slides) ? global.slides : [];
  if (rows.length === 0) return [];

  const settled = await Promise.all(
    rows.map((row) => resolveOne(payload, row))
  );
  return settled.filter((s): s is Slide => s !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/home-hero-resolver.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Run full lint + tsc**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/home-hero.ts tests/unit/home-hero-resolver.test.ts
git commit -m "feat(home-hero): server resolver for curated slides"
```

---

## Task 3: `usePrefersReducedMotion` Hook

**Files:**
- Create: `components/home/use-prefers-reduced-motion.ts`
- Test: `tests/unit/use-prefers-reduced-motion.test.ts`

**Interfaces:**
- Produces: `usePrefersReducedMotion(): boolean` — returns `false` during SSR/first paint (so server and first client render match), then subscribes to `matchMedia` updates and returns the live value.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/use-prefers-reduced-motion.test.ts
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, act} from "@testing-library/react";
import {usePrefersReducedMotion} from "@/components/home/use-prefers-reduced-motion";

describe("usePrefersReducedMotion", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns false during initial render (SSR-safe)", () => {
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const {result} = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("subscribes to changes and flips to true when matchMedia fires", () => {
    let listener: ((e: {matches: boolean}) => void) | null = null;
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      addEventListener: vi.fn((_: string, cb: any) => { listener = cb; }),
      removeEventListener: vi.fn(),
    });
    const {result} = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      listener?.({matches: true});
    });
    expect(result.current).toBe(true);

    act(() => {
      listener?.({matches: false});
    });
    expect(result.current).toBe(false);
  });

  it("returns true on subsequent render when matchMedia already matches", () => {
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const {result, rerender} = renderHook(() => usePrefersReducedMotion());
    // Initial render is false (SSR-safe). After mount effect, hook reads
    // matchMedia.matches and re-renders.
    rerender();
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-prefers-reduced-motion.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Install testing-library if missing**

Run: `npm ls @testing-library/react 2>&1 | head -3`
If not installed: `npm install -D @testing-library/react`
Confirm `package.json` has it before proceeding.

- [ ] **Step 4: Implement the hook**

```ts
// components/home/use-prefers-reduced-motion.ts
// SSR-safe subscription to prefers-reduced-motion. Returns false on the
// server and the first client render so the markup matches; re-renders
// with the real value once mounted.
"use client";

import {useEffect, useState} from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return reduced;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-prefers-reduced-motion.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add components/home/use-prefers-reduced-motion.ts tests/unit/use-prefers-reduced-motion.test.ts
git commit -m "feat(home-hero): usePrefersReducedMotion hook"
```

---

## Task 4: `HeroRotator` Client Component

**Files:**
- Create: `components/home/HeroRotator.tsx`
- Test: `tests/unit/hero-rotator.test.tsx`

**Interfaces:**
- Consumes: `Slide` from `@/lib/home-hero`, `useCart` from `@/context/CartContext`, `usePrefersReducedMotion` from `./use-prefers-reduced-motion`, `Link` from `@/i18n/navigation`, `track` from `@/lib/analytics`, `useTranslations` from `next-intl`.
- Produces: `<HeroRotator slides={Slide[]} />` — renders carousel, autoplay, controls, add-to-cart. Returns `null` if `slides.length === 0`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/hero-rotator.test.tsx
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, act} from "@testing-library/react";
import {HeroRotator} from "@/components/home/HeroRotator";
import type {Slide} from "@/lib/home-hero";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      "HeroRotator.view": "View",
      "HeroRotator.addToCart": "Add to cart",
      "HeroRotator.added": "Added",
      "HeroRotator.previous": "Previous slide",
      "HeroRotator.next": "Next slide",
      "HeroRotator.dotLabel": "Go to slide",
    };
    return dict[key] ?? key;
  },
}));

// Mock Link — render as anchor with href prop.
vi.mock("@/i18n/navigation", () => ({
  Link: ({href, children, ...rest}: any) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

// Mock useCart
const addItemMock = vi.fn();
vi.mock("@/context/CartContext", () => ({
  useCart: () => ({addItem: addItemMock}),
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

// Mock usePrefersReducedMotion — controllable per test.
let mockReduced = false;
vi.mock("@/components/home/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => mockReduced,
}));

const slides: Slide[] = [
  {
    id: "1",
    collection: "mithai-products",
    name: "Kaju Katli",
    priceLabel: "₹800",
    image: "/kaju.jpg",
    imageAlt: "Kaju Katli",
    href: "/mithai/kaju-katli",
  },
  {
    id: "2",
    collection: "qsr-menu-items",
    name: "Masala Chai",
    priceLabel: undefined,
    image: "/chai.jpg",
    imageAlt: "Chai",
    href: "/qsr/masala-chai",
  },
];

describe("HeroRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReduced = false;
    addItemMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when slides is empty", () => {
    const {container} = render(<HeroRotator slides={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders first slide on mount", () => {
    render(<HeroRotator slides={slides} />);
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    expect(screen.getByText("₹800")).toBeVisible();
    // Second slide content present in DOM but visually hidden via CSS class.
    expect(screen.getByText("Masala Chai")).toBeInTheDocument();
  });

  it("hides price when priceLabel is undefined", () => {
    render(<HeroRotator slides={slides} />);
    // Slide 2 has no price. After advancing, price should not render.
    expect(screen.getAllByText("₹800").length).toBe(1);
  });

  it("advances to next slide every 5 seconds", () => {
    render(<HeroRotator slides={slides} />);
    // Slide 1 active
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    // Advance 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Now slide 2 should be the visible one — check via aria-current on dot
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("wraps from last slide back to first", () => {
    render(<HeroRotator slides={slides} />);
    act(() => {
      vi.advanceTimersByTime(5000); // 0 -> 1
    });
    act(() => {
      vi.advanceTimersByTime(5000); // 1 -> 0
    });
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("pauses autoplay on mouse enter and resumes on mouse leave", () => {
    render(<HeroRotator slides={slides} />);
    const region = screen.getByRole("group", {name: /featured products/i});

    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    // Should not have advanced
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    fireEvent.mouseLeave(region);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("respects prefers-reduced-motion: no autoplay", () => {
    mockReduced = true;
    render(<HeroRotator slides={slides} />);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Next advances to next slide", () => {
    render(<HeroRotator slides={slides} />);
    fireEvent.click(screen.getByRole("button", {name: /Next slide/i}));
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Previous wraps from first to last", () => {
    render(<HeroRotator slides={slides} />);
    fireEvent.click(screen.getByRole("button", {name: /Previous slide/i}));
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking dot jumps to that slide", () => {
    render(<HeroRotator slides={slides} />);
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    fireEvent.click(dots[1]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Add to cart calls addItem with slide shape", () => {
    render(<HeroRotator slides={slides} />);
    const btns = screen.getAllByRole("button", {name: /Add to cart/i});
    fireEvent.click(btns[0]);
    expect(addItemMock).toHaveBeenCalledWith({
      id: "1",
      name: "Kaju Katli",
      priceLabel: "₹800",
      image: "/kaju.jpg",
    });
  });

  it("View link points to PDP href", () => {
    render(<HeroRotator slides={slides} />);
    const viewLinks = screen.getAllByRole("link", {name: /^View$/i});
    expect(viewLinks[0]).toHaveAttribute("href", "/mithai/kaju-katli");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hero-rotator.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HeroRotator**

```tsx
// components/home/HeroRotator.tsx
// Client carousel for the brand home hero. Receives resolved Slide[]
// from the server BrandHero and owns carousel state + autoplay. Pauses
// on hover, focus, and off-screen. Honors prefers-reduced-motion.
"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {usePrefersReducedMotion} from "./use-prefers-reduced-motion";
import type {Slide} from "@/lib/home-hero";

const AUTOPLAY_MS = 5000;

type Props = {
  slides: Slide[];
};

export function HeroRotator({slides}: Props) {
  const t = useTranslations();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const {addItem} = useCart();

  // Wrap clamp helper.
  const clamp = useCallback(
    (n: number) => (slides.length <= 1 ? 0 : (n + slides.length) % slides.length),
    [slides.length]
  );

  const go = useCallback(
    (next: number) => {
      setActive((current) => {
        const target = clamp(next);
        if (target !== current) {
          track("hero_slide_view", {index: target, total: slides.length});
        }
        return target;
      });
    },
    [clamp, slides.length]
  );

  const goPrev = useCallback(() => go(active - 1), [active, go]);
  const goNext = useCallback(() => go(active + 1), [active, go]);

  // Autoplay timer. Reset when active changes, paused, reducedMotion, or
  // slides count changes.
  useEffect(() => {
    if (reducedMotion || paused || slides.length <= 1) return;
    const id = setInterval(() => {
      setActive((current) => clamp(current + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reducedMotion, paused, slides.length, clamp]);

  // Pause when the region is scrolled off-screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = regionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      {threshold: 0}
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (slides.length === 0) return null;

  return (
    <div
      ref={regionRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={t("HeroRotator.regionLabel")}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        // Only resume when focus leaves the carousel entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      {/* Slides — render all, toggle visibility via CSS to keep image cache warm. */}
      <div className="relative">
        {slides.map((slide, i) => {
          const isActive = i === active;
          return (
            <div
              key={`${slide.collection}:${slide.id}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={!isActive}
              className={
                isActive
                  ? "block"
                  : "absolute inset-0 pointer-events-none opacity-0"
              }
            >
              <div className="overflow-hidden rounded-[1.6rem] border border-gold/40 bg-bg-card shadow-card">
                <div className="relative aspect-[4/5] w-full bg-bg-accent">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1024px) 28rem, 100vw - 2rem"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  <h2 className="line-clamp-2 font-display text-base font-semibold leading-tight text-text-heading sm:text-lg">
                    {slide.name}
                  </h2>
                  {slide.priceLabel && (
                    <p className="text-sm font-medium text-text-muted">
                      {slide.priceLabel}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={slide.href}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-text-light transition hover:bg-primary-hover"
                    >
                      {t("HeroRotator.view")}
                    </Link>
                    <AddToCartButton slide={slide} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls — arrows + dots. */}
      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            aria-label={t("HeroRotator.previous")}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition hover:border-primary/60 hover:text-primary sm:inline-flex"
          >
            <span aria-hidden="true">←</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`${t("HeroRotator.dotLabel")} ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={
                  i === active
                    ? "h-2 w-6 rounded-full bg-primary transition"
                    : "h-2 w-2 rounded-full bg-border-input transition hover:bg-primary/60"
                }
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label={t("HeroRotator.next")}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition hover:border-primary/60 hover:text-primary sm:inline-flex"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Inline client button so each slide's add-to-cart is independent. Reuses
// the project's AddToCartButton visual style (gold border, uppercase
// tracking) but smaller for the hero card.
function AddToCartButton({slide}: {slide: Slide}) {
  const t = useTranslations();
  const {addItem} = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          id: slide.id,
          name: slide.name,
          priceLabel: slide.priceLabel ?? "",
          image: slide.image,
        });
        setAdded(true);
        track("hero_add_to_cart", {id: slide.id, name: slide.name});
        window.setTimeout(() => setAdded(false), 1800);
      }}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-bg-control px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-bg-accent"
    >
      <span aria-hidden="true" className="text-gold">
        {added ? "✓" : "+"}
      </span>
      <span>{added ? t("HeroRotator.added") : t("HeroRotator.addToCart")}</span>
    </button>
  );
}

export default HeroRotator;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hero-rotator.test.tsx`
Expected: PASS — all tests green.

- [ ] **Step 5: Run full lint + tsc**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/home/HeroRotator.tsx tests/unit/hero-rotator.test.tsx
git commit -m "feat(home-hero): HeroRotator client component"
```

---

## Task 5: BrandHero Integration + i18n Strings

**Files:**
- Modify: `components/home/BrandHero.tsx`
- Modify: `messages/en.json`, `messages/hi.json`, `messages/kn.json`
- No new test — Task 6 covers E2E.

**Interfaces:**
- Consumes: `resolveHomeHeroSlides` from `@/lib/home-hero`, `HeroRotator` from `./HeroRotator`.
- Produces: `BrandHero` server component that renders `<HeroRotator>` when slides exist, else falls back to the existing static kaju-katli figure.

- [ ] **Step 1: Add i18n strings to `messages/en.json`**

Open `messages/en.json`. Find an existing top-level `Home` section (or add one). Add these keys inside it (preserve existing keys):

```json
{
  "Home": {
    "HeroRotator": {
      "regionLabel": "Featured products",
      "view": "View",
      "addToCart": "Add to cart",
      "added": "Added",
      "previous": "Previous slide",
      "next": "Next slide",
      "dotLabel": "Go to slide"
    }
  }
}
```

- [ ] **Step 2: Add the same keys to `messages/hi.json`**

```json
{
  "Home": {
    "HeroRotator": {
      "regionLabel": "चुने हुए उत्पाद",
      "view": "देखें",
      "addToCart": "कार्ट में डालें",
      "added": "जोड़ा गया",
      "previous": "पिछला स्लाइड",
      "next": "अगला स्लाइड",
      "dotLabel": "स्लाइड पर जाएँ"
    }
  }
}
```

- [ ] **Step 3: Add the same keys to `messages/kn.json`**

```json
{
  "Home": {
    "HeroRotator": {
      "regionLabel": "ಆಯ್ದ ಉತ್ಪನ್ನಗಳು",
      "view": "ನೋಡಿ",
      "addToCart": "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ",
      "added": "ಸೇರಿಸಲಾಗಿದೆ",
      "previous": "ಹಿಂದಿನ ಸ್ಲೈಡ್",
      "next": "ಮುಂದಿನ ಸ್ಲೈಡ್",
      "dotLabel": "ಸ್ಲೈಡ್‌ಗೆ ಹೋಗಿ"
    }
  }
}
```

- [ ] **Step 4: Modify `BrandHero.tsx`**

Replace the file with this version. Key changes from current:
1. Calls `resolveHomeHeroSlides()` alongside `readBrandSettings()`.
2. Right column conditionally renders `<HeroRotator>` if slides.length > 0, else the existing static kaju-katli `<figure>`.
3. Mobile: right column no longer hidden on `<lg` when slides exist — it stacks below. Static fallback keeps `hidden lg:block` to preserve current behavior.

```tsx
// components/home/BrandHero.tsx
// Cinematic hero for the Mishran brand home. Server component — reads
// `brand-settings` from Payload for brandName / positioning / heroCopy,
// resolves curated slides from the `home-hero` global, and renders the
// HeroRotator when slides exist. Empty global → static kaju-katli
// still life (original behaviour).

import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {resolveHomeHeroSlides} from "@/lib/home-hero";
import {HeroRotator} from "./HeroRotator";

type BrandGlobal = {
  brandName?: string;
  tagline?: string;
  positioning?: string;
  heroCopy?: string;
};

async function readBrandSettings(): Promise<BrandGlobal | null> {
  try {
    const payload = await getPayload();
    const global = (await payload.findGlobal({
      slug: "brand-settings",
    })) as BrandGlobal;
    return global ?? null;
  } catch {
    return null;
  }
}

export async function BrandHero() {
  const [t, brand, slides] = await Promise.all([
    getTranslations("Home"),
    readBrandSettings(),
    resolveHomeHeroSlides(),
  ]);

  const brandName = brand?.brandName?.trim() || "Mishran";
  const positioning = brand?.positioning?.trim();
  const hasSlides = slides.length > 0;

  return (
    <section
      aria-labelledby="brand-hero-heading"
      className="relative overflow-hidden border-b border-border-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-bg-accent/80 via-bg-accent/30 to-transparent" />
        <div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-stretch gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-28 lg:px-8">
        {/* Editorial left column — unchanged. */}
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light"
            >
              {brandName.slice(0, 2)}
            </span>
            <span className="h-px flex-1 max-w-[6rem] bg-gradient-to-r from-primary/60 to-transparent" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              {t("heroEyebrow")}
            </span>
          </div>

          <h1
            id="brand-hero-heading"
            className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-light leading-[0.95] tracking-tight text-text-primary"
          >
            <span className="block">{t("heroHeadlineLine1")}</span>
            <span className="mt-1 block">
              <span className="italic text-primary">{brandName}</span>
              <span className="text-text-heading">.</span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-text-info sm:text-lg">
            {positioning || t("heroSubhead")}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/mithai"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-text-light shadow-md transition hover:bg-primary-hover hover:shadow-lg"
            >
              {t("ctaExploreMithai")}
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </Link>
            <Link
              href="/build-a-gift"
              className="inline-flex items-center gap-2 border-b border-primary/40 pb-1 text-sm font-semibold text-primary transition hover:border-primary/80"
            >
              {t("ctaBuildGift")}
            </Link>
          </div>
        </div>

        {/* Right column — rotator when slides exist, else static fallback. */}
        {hasSlides ? (
          <div className="relative lg:ml-auto lg:max-w-md">
            <HeroRotator slides={slides} />
          </div>
        ) : (
          <div className="relative hidden lg:block">
            <figure className="relative ml-auto h-full w-full max-w-md">
              <div className="absolute inset-0 rounded-[2rem] border border-gold/40 bg-bg-card/60 shadow-card" />
              <div className="relative m-3 overflow-hidden rounded-[1.6rem]">
                <div className="relative aspect-[4/5] w-full bg-bg-accent">
                  <Image
                    src="/images/kaju-katli.jpg"
                    alt={t("heroInsetAlt")}
                    fill
                    priority
                    sizes="(min-width: 1024px) 28rem, 0px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-darker/40 via-transparent to-transparent" />
                </div>
              </div>

              <figcaption className="absolute -bottom-4 -left-4 max-w-[15rem] rounded-2xl border border-border-card bg-bg-page/95 px-4 py-3 shadow-card backdrop-blur">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                  {t("heroInsetLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-text-heading">
                  {t("heroInsetTitle")}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t("heroInsetMeta")}
                </p>
              </figcaption>
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}

export default BrandHero;
```

- [ ] **Step 5: Run lint + tsc + unit**

Run: `npm run lint && npx tsc --noEmit && npm run test:unit`
Expected: clean, all unit green.

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: clean. `/[locale]` route still listed as dynamic (Payload-bound).

- [ ] **Step 7: Commit**

```bash
git add components/home/BrandHero.tsx messages/en.json messages/hi.json messages/kn.json
git commit -m "feat(home-hero): wire BrandHero to HeroRotator with static fallback"
```

---

## Task 6: E2E Test

**Files:**
- Create: `tests/e2e/home-hero.spec.ts`

**Interfaces:**
- Consumes: running dev/server with seeded `home-hero` global. The test assumes at least 1 slide resolves. If the global is empty in CI, the test is skipped (we test both branches: empty → static, populated → carousel).

- [ ] **Step 1: Write the E2E test**

```ts
// tests/e2e/home-hero.spec.ts
import {test, expect} from "@playwright/test";

// Home hero should render at least a heading (current behaviour) and,
// when the home-hero Payload global has slides, a carousel.
test.describe("home hero", () => {
  test("renders the brand heading", async ({page}) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", {name: /Mishran/i}).first()
    ).toBeVisible();
  });

  test("carousel present when home-hero global has slides", async ({page}) => {
    await page.goto("/en");

    // Either carousel or static figure — both are valid.
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const isCarouselVisible = await carousel.isVisible().catch(() => false);

    if (isCarouselVisible) {
      // At least one slide.
      await expect(carousel.getByRole("group", {name: /1 \//})).toBeVisible();
      // View + Add to cart buttons on the active slide.
      await expect(carousel.getByRole("link", {name: /^View$/i}).first()).toBeVisible();
      await expect(
        carousel.getByRole("button", {name: /Add to cart/i}).first()
      ).toBeVisible();
    } else {
      // Static fallback must render the kaju-katli figure caption.
      await expect(page.getByText(/Mishran Heritage/i)).toBeVisible();
    }
  });

  test("add-to-cart on hero bumps cart badge", async ({page}) => {
    await page.goto("/en");
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const isCarouselVisible = await carousel.isVisible().catch(() => false);
    test.skip(!isCarouselVisible, "home-hero global is empty — skipping");

    const badgeBefore = await page
      .getByRole("link", {name: /cart/i})
      .filter({hasText: /\d/})
      .count();

    await carousel.getByRole("button", {name: /Add to cart/i}).first().click();

    // Cart badge should appear or increment.
    await expect(
      page.getByRole("link", {name: /cart/i}).filter({hasText: /\d/})
    ).toHaveCount(Math.min(badgeBefore + 1, 1));
  });

  test("next button advances carousel", async ({page}) => {
    await page.goto("/en");
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const isCarouselVisible = await carousel.isVisible().catch(() => false);
    test.skip(!isCarouselVisible, "home-hero global is empty — skipping");

    const firstDot = carousel.getByRole("button", {name: /Go to slide 1/i});
    const secondDot = carousel.getByRole("button", {name: /Go to slide 2/i});
    const hasSecond = await secondDot.count();

    test.skip(!hasSecond, "only one slide — nothing to advance to");

    await expect(firstDot).toHaveAttribute("aria-current", "true");
    await carousel.getByRole("button", {name: /Next slide/i}).click();
    await expect(secondDot).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Run E2E against seeded dev DB**

Run: `npm run dev &` (if not already running).
Then: `npx playwright test tests/e2e/home-hero.spec.ts --project=chromrome`
Expected: all tests pass or skip cleanly. No failures.

- [ ] **Step 3: Stop dev server, run full CI suite**

Run: `npm run lint && npx tsc --noEmit && npm run test:unit && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/home-hero.spec.ts
git commit -m "test(home-hero): E2E coverage for carousel + add-to-cart"
```

---

## Self-Review Notes

### Spec coverage check

| Spec section | Task |
|---|---|
| Data layer (HomeHero global) | Task 1 |
| BrandHero server reads global | Task 5 |
| HeroRotator client component | Task 4 |
| usePrefersReducedMotion hook | Task 3 |
| Slide composition (image + name + price + View + Add to cart) | Task 4 |
| Behavior table (autoplay, hover/focus pause, off-screen pause, reduced-motion, prev/next/dots) | Task 4 |
| Mobile stack layout | Task 5 (BrandHero: removed `hidden lg:block` for slides case) |
| Edge cases (empty global, deleted products, drafts, missing images, errors) | Task 2 (resolver) + Task 5 (fallback) |
| Accessibility (carousel/slide roles, aria-live, aria-current, focus management) | Task 4 |
| Unit tests | Tasks 1, 2, 3, 4 |
| E2E tests | Task 6 |

All spec sections covered.

### Placeholder scan

No TBD / TODO / "handle errors appropriately" in the plan. Each step has concrete code.

### Type consistency check

- `Slide` type defined in Task 2, used by Tasks 4 and 5 with same shape (`id`, `collection`, `name`, `priceLabel?`, `image`, `imageAlt`, `href`).
- `addItem` call in Task 4 passes `{id, name, priceLabel, image}` — matches `CartItem` minus `quantity` (existing contract).
- `usePrefersReducedMotion()` returns `boolean` consistently in Task 3 (definition) and Task 4 (consumer).
- `resolveHomeHeroSlides()` returns `Promise<Slide[]>` in Task 2 (definition) and Task 5 (consumer).
