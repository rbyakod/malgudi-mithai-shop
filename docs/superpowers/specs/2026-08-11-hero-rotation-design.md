# Hero Rotation — Curated Product Carousel on Brand Home

**Status:** Spec (brainstorming output, awaiting user review)
**Date:** 2026-08-11
**Sources:**
- Existing `BrandHero.tsx` (static kaju-katli still life)
- Payload polymorphic relationship capability
- Curated-list pattern from Mishran brand strategy

## Goal

Replace the static product inset in the brand home hero with a rotating carousel of curated products. Editor-controlled via a new Payload global, mixed across all product collections, with manual controls + autoplay.

## Non-goals

- Full-background image hero (rejected during brainstorm — clashes with type-led brand voice)
- Per-collection boolean flags for hero eligibility (rejected — global curated list gives tighter editorial control)
- Add-to-cart on every carousel variant (we keep two CTAs only: View + Add to cart)
- Multi-heros per page or per vertical landing (out of scope — this is the brand home only)
- Personalization / algorithmic selection (curated by editor, not by user behavior)

## Architecture

### Data layer

New Payload global `home-hero` (slug `home-hero`):

```ts
// globals/HomeHero.ts
fields: [
  {
    name: 'slides',
    type: 'array',
    label: 'Hero slides',
    minRows: 0,
    maxRows: 12,
    fields: [
      {
        name: 'product',
        type: 'relationship',
        relationTo: [
          'mithai-products',
          'qsr-menu-items',
          'snack-products',
          'merch-products',
          'gift-boxes',
        ],
        required: true,
        admin: { description: 'Pick from any product collection' },
      },
      {
        name: 'captionOverride',
        type: 'text',
        admin: {
          description: 'Optional. Defaults to the product name.',
        },
      },
    ],
    admin: {
      description: 'Drag rows to reorder. First row renders first on home.',
    },
  },
]
```

Empty global → `BrandHero` falls back to the current static kaju-katli still life. No throw, no warning.

### Components

**`components/home/BrandHero.tsx`** (server component, modified):
- Read `home-hero` global via `payload.findGlobal({slug: 'home-hero'})`.
- Resolve each slide's product; filter out:
  - Products that no longer exist (deleted).
  - Products with no image field (image is required for carousel).
  - Draft-only products (`_status: 'draft'`) when not in preview mode.
- Build a typed `Slide[]` array: `{id, name, priceLabel, image, href, captionOverride?}`.
- Pass `slides` to `<HeroRotator>`.
- Keep all current left-column editorial type (h1, eyebrow, subhead, primary/secondary CTAs). The right column becomes the rotator.

**`components/home/HeroRotator.tsx`** (client component, new):
- Props: `{slides: Slide[]}`.
- Owns `activeIndex` state.
- Autoplay timer: 5s interval, cleared on hover, focus-within, or when off-screen.
- Controls: prev/next arrow buttons + dot indicators.
- Reduced-motion: `const prefersReducedMotion = usePrefersReducedMotion()`. If true, no autoplay; manual controls still work.
- SSR/hydration-safe: first render shows slide 0 only (server-rendered markup), hydrates to full carousel.

**`components/home/usePrefersReducedMotion.ts`** (client hook, new):
- Reads `matchMedia('(prefers-reduced-motion: reduce)')` after mount.
- Subscribes to changes.
- Returns `boolean` (default `false` during SSR and first paint to match server).

### Slide composition

Each slide renders:

```
┌─────────────────────────────┐
│                             │
│   [Product image, 4:5]      │
│                             │
│                             │
├─────────────────────────────┤
│  Product name (or override) │
│  ₹priceLabel                │
│  [View] [Add to cart]       │
└─────────────────────────────┘
```

- Image: `next/image` with `fill` + `sizes` based on viewport (mobile: 100vw-2rem, desktop: 28rem). Priority only on slide 0.
- Name: `captionOverride || product.name`.
- Price: `product.priceLabel` (string, already localized).
- View: `<Link href={product.href}>` — locale-aware link to PDP.
- Add to cart: `<button>` calling `useCart().addItem({id, name, priceLabel, image})`.

### Behavior

| Event | Action |
|---|---|
| Page load | Slide 0 visible. Autoplay timer starts. |
| 5s elapsed | Crossfade to next slide. Wraps to 0 after last. |
| Mouse enter | Pause autoplay. |
| Mouse leave | Resume autoplay. |
| Focus within | Pause autoplay. |
| Blur within | Resume autoplay. |
| Slide off-screen (IntersectionObserver) | Pause autoplay (saves CPU). |
| Prev/Next click | Jump to slide, restart timer. |
| Dot click | Jump to slide, restart timer. |
| `prefers-reduced-motion: reduce` | No autoplay. Manual controls work. Crossfades become instant swaps. |

### Mobile (`<lg`)

- Stack layout: left column (type block) renders first, then rotator below.
- Rotator card max-width tightens from `max-w-md` (28rem) to `max-w-sm` (24rem).
- Arrows hide on `<sm` (640px) to save space; dots remain.
- Card slides vertically (`flex-col`) on mobile — image on top, name/price/CTAs below.

### Edge cases

1. **Empty `home-hero` global** → BrandHero renders current static layout (kaju-katli still life). No console warning.
2. **Global has slides but all products deleted** → same as empty.
3. **Some slides valid, some invalid** → filter invalid; render the valid ones. If 0 valid after filter → same as empty.
4. **Product has no image** → that slide filtered out at server time.
5. **Product is draft (`_status: 'draft'`)** → filtered out unless preview mode is active.
6. **Payload unreachable during build** → BrandHero's `findGlobal` is wrapped in try/catch, returns null → fallback to static.
7. **Rapid manual clicking** → timer resets on each click, no race conditions.
8. **Long product names** → CSS `line-clamp-2` on the name element.

### Accessibility

- Region: `<section aria-labelledby="brand-hero-heading">` (existing).
- Rotator: `<div role="group" aria-roledescription="carousel" aria-label="Featured products">`.
- Slide: `<div role="group" aria-roledescription="slide" aria-label="${i+1} of ${n}">`.
- Live region: `aria-live="polite"` on the slide container so screen readers announce slide changes (off when reduced-motion is active — instant swap is too chatty).
- Prev/Next: `<button aria-label="Previous slide">` / `"Next slide"`.
- Dots: `<button aria-label="Go to slide ${i+1}" aria-current={i === activeIndex}>`.
- Pause control: implicit via hover/focus; no visible pause button (autoplay is gentle enough that this is not needed).

### Testing

**Unit (`tests/unit/home-hero.test.ts`)**:
- `home-hero` global read returns expected slide list.
- Slide filtering: deleted products, missing images, drafts all excluded.
- Empty global → null/empty array (BrandHero falls back).

**Unit (`tests/unit/hero-rotator.test.tsx`)**:
- Renders first slide on mount.
- `act(() => advance timer 5s)` → activeIndex increments, wraps at end.
- `mouseEnter` → autoplay paused.
- `prefersReducedMotion = true` → autoplay never starts.
- Prev/Next clicks update index.
- Dot click updates index.

**E2E (`tests/e2e/home-hero.spec.ts`)**:
- Home page renders hero with `aria-roledescription="carousel"`.
- At least one slide has a "Add to cart" button.
- Click "Add to cart" → cart badge count increments.
- Click "View" → navigates to product PDP.
- Keyboard: Tab to Next button, Enter → slide changes.
- Reduced-motion simulation (emulateMedia) → no autoplay (activeIndex stays 0 until manual interaction).

### Type changes

`payload-types.ts` auto-regenerates when Payload boots next. Adds:
- `HomeHero` global type with `slides` array.
- Polymorphic relationship union across the 5 product collections.

New local type in `components/home/HeroRotator.tsx`:
```ts
// Resolved at the server layer in BrandHero before passing to the client
// rotator. Image is a URL string (already resolved from Payload media doc
// via the project's existing media-to-URL helper). Slide shape matches
// CartContext's CartItem minus quantity, so addItem accepts it directly.
type Slide = {
  id: string;
  name: string;
  priceLabel: string;
  image: string;        // resolved media URL
  href: string;         // locale-aware PDP path
  captionOverride?: string;
};
```

## Migration

- No data migration needed — new global is additive.
- No breaking changes to existing types or routes.
- `home-hero` global absent in current DB → BrandHero falls back to static layout immediately.

## Rollout

1. Implement schema + global.
2. Implement components.
3. Wire into `app/[locale]/page.tsx` (replace current BrandHero call site if signature changes — should not).
4. Tests green.
5. Ship behind no flag — empty global means current behavior, so safe to deploy before any slides are curated.
6. After deploy, Ravi curates initial 5–8 slides via `/admin/globals/home-hero`.

## Open questions

None. All clarified during brainstorm.

## Out-of-scope follow-ups

- Hero analytics: track `hero_slide_view` + `hero_slide_click` events.
- Per-locale slides (currently one global serves all locales).
- Slide-level CTA customization (e.g., "Pre-order" instead of "Add to cart").
- Video slides.
