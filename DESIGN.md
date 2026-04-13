# Malgudi Blue v2

## 1. Visual Theme & Atmosphere

Malgudi Blue v2 is a dark, flat, trust-heavy storefront theme for a premium mithai brand. It should feel structured, calm, and polished rather than glowing, futuristic, or dashboard-like. The page canvas is deep navy. Surfaces step up through controlled blue layers. Accent blue carries calls to action. Gold is used sparingly as a celebratory secondary accent, never as the dominant interface color.

This theme should preserve warmth in the product photography and copy while keeping the UI chrome cool, precise, and restrained.

### Key characteristics

- Deep navy full-page background
- Flat layered surfaces, not gradient-heavy panels
- Bright brand blue for primary actions and active states
- Restrained festive gold for badges, highlights, and special offers
- Clean sans-serif typography with strong hierarchy
- Crisp borders and low-noise separation between surfaces
- Soft but minimal shadows
- Very limited glow, blur, and decorative motion

## 2. Color Palette & Roles

### Core surfaces

- `bg-page`: `#041E42`
  - Full app background
- `bg-card`: `#0A2B57`
  - Primary card and panel surface
- `bg-accent`: `#12386D`
  - Raised surface, hero framing, subtle emphasis
- `bg-control`: `#163F78`
  - Inputs, pills, filters, secondary buttons
- `bg-darker`: `#021432`
  - Dense footer/banner areas, inverse controls, dark CTAs

### Primary action colors

- `primary`: `#0053E2`
  - Primary CTA, active links, selected filters, focus accents
- `primary-hover`: `#0043B8`
  - Hover and pressed CTA state

### Secondary accent

- `gold`: `#FFC220`
  - Festive highlight, “new” badges, select supporting actions
- `gold-hover`: `#E6AD10`
  - Hover state for gold accents

### Text colors

- `text-primary`: `#EDF5FF`
  - Main body text on dark surfaces
- `text-heading`: `#F8FBFF`
  - Headings and high-emphasis labels
- `text-secondary`: `#C8D8EE`
  - Secondary content
- `text-info`: `#A9C0E0`
  - Supporting text
- `text-muted`: `#8EABD0`
  - Metadata, helper labels, captions
- `text-breadcrumb`: `#6F8DB6`
  - Breadcrumb separators and low-emphasis navigation
- `text-on-gold`: `#041E42`
  - Text placed on gold fills

### Borders

- `border-card`: `#1C4B81`
  - Card and panel edge
- `border-input`: `#2C5F97`
  - Input outlines, pills, filters
- `border-image`: `#27558D`
  - Image frames and media wrappers

## 3. Typography Rules

### Font strategy

- Primary: `Geist Sans`, `Inter`, or a similarly neutral modern grotesk
- Monospace: `Geist Mono` only for code-like metadata if needed

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Hero Title | 44px-56px | 600-700 | 1.05-1.1 | -0.02em | Strong, compact |
| Section Title | 28px-36px | 600 | 1.1-1.2 | -0.01em | Clean and direct |
| Card Title | 16px-20px | 600 | 1.2-1.3 | normal | Tight, readable |
| Body | 14px-16px | 400-500 | 1.5-1.65 | normal | Default reading style |
| Small Meta | 11px-13px | 500 | 1.4-1.5 | normal | Pricing, shelf life, notes |
| Eyebrow Label | 10px-12px | 600 | 1.2-1.3 | 0.16em-0.22em | Uppercase only |
| Button Text | 11px-14px | 600 | 1.2-1.3 | 0.12em-0.18em | Uppercase on compact CTAs |

### Type behavior

- Headings should be bright and compact.
- Body text should stay slightly softer than headings.
- Avoid oversized editorial serif typography in this theme.
- Uppercase labels should be used for section markers, not for full paragraphs.

## 4. Component Stylings

### Header

- Sticky header may use `bg-page` with 80-90% opacity plus subtle blur.
- Bottom border should be visible and crisp.
- Brand mark can use solid `primary` fill.

### Buttons

- Primary button:
  - `primary` background
  - `text-heading` or `text-light` text
  - rounded pill or medium radius
  - minimal shadow
- Secondary button:
  - `bg-control` background
  - `border-input` border
  - `text-secondary` text
- Gold button:
  - reserved for limited highlights only
  - `gold` fill with `text-on-gold`

### Cards

- Default card uses `bg-card`
- Raised or featured card uses `bg-accent`
- Border is mandatory; shadow is optional and soft
- Do not rely on blur/glow to separate cards from the page

### Inputs and filters

- Inputs use `bg-control`
- Border should remain visible even in idle state
- Focus ring may use `primary` at low opacity
- Avoid white form fields in this theme

### Badges

- Default info badge: `bg-control` + `border-input`
- Primary badge: `primary` fill + light text
- Gold badge: `gold` fill + `text-on-gold`

### Hero section

- No loud gradient slab as the main hero identity
- Prefer flat framing with one elevated media card
- Product image remains the warmest part of the page
- Decorative effects should be minimal and optional

## 5. Layout Principles

- Use a clean content width with generous horizontal gutters
- Favor consistent vertical rhythm over dramatic asymmetry
- Main spacing scale should center around `4, 8, 12, 16, 24, 32, 48, 64`
- Use roomy section spacing but compact internal card spacing
- Keep the overall impression precise and composed

## 6. Depth & Elevation

- This theme is surface-led, not shadow-led
- Use borders first, color contrast second, shadow third
- Shadow system:
  - Resting card: `0 4px 14px rgba(0, 0, 0, 0.14)`
  - Hover card: `0 10px 24px rgba(0, 0, 0, 0.18)`
  - CTA shadow: very subtle only
- Avoid neon glow, oversized blur, or colorful shadows

## 7. Do's and Don'ts

### Do

- Use deep navy as the continuous canvas
- Keep blue surfaces flat and layered
- Use `primary` blue to direct action
- Use gold sparingly for festive emphasis
- Preserve warm product imagery against cool UI chrome
- Keep forms, cards, pills, and navigation on the same surface system

### Don't

- Do not use pale blue or white as the page background
- Do not copy MindBox-like glows, grids, or ambient orbs into this theme
- Do not overuse gold for large backgrounds
- Do not mix warm cream surfaces into the blue theme
- Do not introduce multiple competing accent colors

## 8. Responsive Behavior

- Mobile should preserve the same dark canvas and surface hierarchy
- Compact controls should remain comfortably tappable
- Header controls may collapse, but theme identity must remain intact
- Hero media should stack without becoming decorative clutter
- Card spacing should tighten slightly on small screens without changing the color hierarchy

## 9. Agent Prompt Guide

### Quick reference

- Page background: `#041E42`
- Card surface: `#0A2B57`
- Control surface: `#163F78`
- Primary CTA: `#0053E2`
- Secondary accent: `#FFC220`
- Main text: `#EDF5FF`
- Muted text: `#8EABD0`
- Border: `#1C4B81` to `#2C5F97`

### Prompt guidance

When generating UI for this project:

- Build a dark storefront with a full deep navy canvas and flat layered blue surfaces.
- Use bright blue for the main CTA and gold only for selective festive emphasis.
- Keep the interface polished and restrained rather than futuristic or glowy.
- Use warm product photography as contrast against the cool interface.
- Prefer clear hierarchy, visible borders, and minimal decorative effects.

## 10. Token Mapping For This Codebase

These map directly to the current site token model:

- `--t-bg-page` -> `#041E42`
- `--t-bg-card` -> `#0A2B57`
- `--t-bg-accent` -> `#12386D`
- `--t-bg-control` -> `#163F78`
- `--t-bg-dark` -> `#041E42`
- `--t-bg-darker` -> `#021432`
- `--t-primary` -> `#0053E2`
- `--t-primary-hover` -> `#0043B8`
- `--t-gold` -> `#FFC220`
- `--t-gold-hover` -> `#E6AD10`
- `--t-text-primary` -> `#EDF5FF`
- `--t-text-heading` -> `#F8FBFF`
- `--t-text-on-gold` -> `#041E42`
- `--t-text-secondary` -> `#C8D8EE`
- `--t-text-info` -> `#A9C0E0`
- `--t-text-muted` -> `#8EABD0`
- `--t-text-breadcrumb` -> `#6F8DB6`
- `--t-border-card` -> `#1C4B81`
- `--t-border-input` -> `#2C5F97`
- `--t-border-image` -> `#27558D`

## 11. How To Use DESIGN.md For Switchable Themes

Use one `DESIGN.md` as the active source of truth for one theme, then store each implementation as a named token set in code.

Recommended architecture:

1. Keep one root `DESIGN.md` for the active design direction you are currently building.
2. Store theme implementations in code as semantic token groups keyed by theme id such as `festive`, `mindbox`, `myblue`, `mblue2`, `coinbase`, or `ibm`.
3. If you want multiple design references, create a docs folder such as `design-systems/` and keep one markdown file per theme:
   - `design-systems/malgudi-blue-v2.md`
   - `design-systems/festive-saffron.md`
   - `design-systems/coinbase-inspired.md`
4. Each markdown file should describe:
   - mood
   - colors
   - typography
   - component rules
   - do/don't rules
5. Your actual switcher should not toggle markdown files at runtime. It should toggle prebuilt token sets in CSS or JS.
6. AI agents use the markdown to generate or revise the implementation, while the app uses theme ids and CSS variables to switch instantly.

### Rule of thumb

- `DESIGN.md` tells agents what to build.
- CSS variables and `data-theme` tell the app what to render.

