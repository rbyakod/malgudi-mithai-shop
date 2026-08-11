# Mishran Digital Flagship — Umbrella PRD and Foundation Design

**Status:** Spec (brainstorming output, awaiting user review)
**Date:** 2026-08-10
**Sources:**
- `Mishran Digital Flagship PRD v1.0` (HTML, July 2026)
- `Mishran Brand Strategy Summary Draft 1.0` (PDF)
- `PersonaPlex / Jarvis Agent Integration Guide` (HTML, NVIDIA Moshi)

---

## 1. Executive Summary

Mishran is positioned as the modern house of traditional mithai — built on milk-first purity, karigar mastery, karigari technique, and modern professionalism. The brand operates four business lines (Mithai & Gifting, QSR restaurant, FMCG snacks, and Merch & museum) that share a common trust story but serve distinct buyer journeys.

This umbrella PRD defines a digital flagship experience on the existing Next.js App Router codebase that:

1. Establishes a unified brand spine across all four verticals.
2. Treats commerce as deferred (Shopify migration planned for a later phase). v1 is storytelling + lead generation.
3. Ships a foundation phase with a thin slice across all four verticals, followed by per-vertical depth sub-projects.
4. Uses Payload CMS (free, self-hostable, Next-native) for editorial and structured content.
5. Locks the theme system to one Mishran-default identity plus 2–3 occasion variants.

The PersonaPlex/Jarvis voice-agent guide is recognized as Phase 9 (AI concierge) and is out of scope for this spec.

---

## 2. Goals and Non-Goals

### Goals

| Area | Goal |
|---|---|
| Brand | Make the four pillars (milk purity, karigar mastery, karigari, modern professionalism) visible across every vertical and route. |
| Storytelling | Build an editorial engine (Payload CMS) that scales across journal, festivals, regional stories, and craft education. |
| Lead generation | Convert high-intent buyers (wedding, corporate, merch, gift-builder drafts) into Payload `leads` routed to operations. |
| Differentiation | Ship the gift-builder as a signature product experience, even in non-transactional form. |
| Foundation | Establish theme, IA, i18n, analytics, content framework, and admin tooling that subsequent sub-projects build on. |
| Operations | Surface real constraints (freshness, shelf life, packaging compatibility, MOQ, lead times) honestly. |

### Non-Goals (v1)

- No live checkout, payment, or GST invoice generation. Commerce deferred to Shopify phase.
- No corporate procurement portal, AR packaging preview, rewards, subscriptions, or referrals.
- No voice concierge (PersonaPlex). Out of scope until Phase 9.
- No multi-address bulk upload for corporate orders.
- No customer accounts, order history, or saved-address functionality.
- Not every vertical reaches full depth in the foundation phase — only thin slices.

---

## 3. Audience and Use Cases

| Audience | Primary need | Experience requirement |
|---|---|---|
| Everyday premium buyer | Fresh mithai for home, hosting, table | Fast discovery, freshness signals, easy add-to-cart (draft), delivery clarity |
| Gift buyer | Thoughtful, polished, personalized box | Gift-builder canvas, packaging preview, scheduling intent capture |
| Wedding buyer | Bulk gifting for invitations, favours, return gifts | Dedicated wedding configurator, MOQ, lead-time transparency, consultative lead form |
| Corporate buyer | GST-friendly, branded, repeat orders | Corporate lead form with GST fields, sample request, account-manager handoff |
| Health-conscious buyer | Sugar-free without compromise | Sugar-free collection, dietary filters, ingredient clarity |
| Discovery-led buyer | Regional mithai, modern originals | Regional collections, Mishran Originals, editorial storytelling |
| QSR customer | Chaat, thaali, South Indian, Chinese nearby | Menu browsing, store finder, pickup intent |
| FMCG customer | Namkeens, cookies, dry fruits via retail | Retailer redirect (Amazon, Instamart, Blinkit), subscription intent |
| Merch customer | Collectibles, books, experience-store events | Enquiry-first storefront, pre-order flow where applicable |

---

## 4. Brand Strategy → Design Principles

Carried directly from the Brand Strategy PDF into design rules:

1. **Milk-First Purity** — every mithai PDP and the home page surface the Jhajjar farm story and freshness promise with sensory, specific language.
2. **The Karigar & His Mastery** — karigar archetype profiles (Chenna, Kaju, Ghee specialists) are first-class content, not a footer link.
3. **Karigari — Technique Driven by Tradition** — technique glossary (`resham jaisa syrup`, `rabri ki lehr`, `thad padhna`, etc.) appears on relevant product and story pages.
4. **Modern Experience** — site performance, accessibility, and clarity are non-negotiable. Heritage does not excuse friction.
5. **Copy principle** — warm, specific, sensory. Avoid generic claims ("premium quality") unless immediately backed by proof (farm milk, small batches, karigar skill).

---

## 5. Architecture Overview

```
mishran-shop/  (current Next.js App Router repo)
├── app/[locale]/              # Routes (i18n)
│   ├── (site)/                # Marketing shell: home, verticals, stories
│   ├── (commerce)/            # Stubbed: /cart, /checkout (lead-capture CTA)
│   ├── (ledger)/              # Wedding, corporate, merch enquiry flows
│   └── admin/                 # Payload admin UI mount
├── payload.config.ts          # Payload CMS config (collections, globals, access)
├── payload-blocks/            # Reusable richText content blocks
├── collections/               # Payload schemas
├── components/                # Next components
├── context/                   # CartContext (existing), DraftContext (new)
├── i18n/ messages/            # next-intl strings
├── design-systems/            # Mishran-default + 3 occasion variants (locked)
└── lib/                       # payload client, analytics, helpers
```

**Key architectural moves:**

1. **Next.js remains the front-end.** No Shopify in v1. Commerce stubs capture intent.
2. **Payload CMS embeds in the same Next app** via `payload.config.ts`. MongoDB backing (Atlas M0 free or self-hosted Docker). Single Vercel deploy.
3. **Locale routing preserved** (`/[locale]/...`). Defaults to `en`; ships `hi`, `kn` at launch; `ta`, `te`, `bn`, `mr`, `gu`, `pa`, `es`, `fr` later.
4. **Theme switcher collapsed** to 4 options: Mishran-default + Diwali Saffron + Wedding Heritage + Everyday Sage. Existing switcher UI kept; options trimmed; remaining design-system files archived on a branch.
5. **Brand spine** — shared Payload collections (`stories`, `karigars`, `farms`, `packaging`, `occasions`) referenced across all four verticals so brand content is not duplicated.

---

## 6. Information Architecture & Routes

**Primary nav:**

```
Mishran  |  Mithai  ·  Build a Gift  ·  QSR  ·  Snacks  ·  Merch
         |  Stories  ·  Farms  ·  Karigars  ·  Journal
         |  [search]  [locale]  [theme]  [cart]
```

**Route map:**

```
/[locale]
├── /                        # Brand home — cinematic, 4 vertical portals
├── /mithai                  # Vertical hub
│   ├── /classics
│   ├── /originals
│   ├── /sugar-free
│   ├── /regional
│   ├── /seasonal
│   ├── /search
│   └── /[slug]              # PDP
├── /build-a-gift            # Gift-builder canvas (draft save + lead convert)
├── /gift-boxes              # Curated ready-to-gift boxes showcase
├── /qsr                     # QSR hub
│   ├── /menu
│   ├── /[category]          # chaat / thaali / south-indian / chinese / chole-bhature / kulcha
│   └── /stores
├── /snacks                  # FMCG hub
│   ├── /namkeens
│   ├── /cookies
│   ├── /dry-fruits
│   └── /[slug]
├── /merch                   # Merch & museum hub
│   ├── /tools
│   ├── /book
│   └── /experience-store
├── /weddings                # Consultative configurator + lead form
├── /corporate               # Consultative configurator + lead form (GST)
├── /stories
│   ├── /farms
│   ├── /milk
│   ├── /karigars
│   ├── /karigari
│   ├── /packaging
│   └── /journal/[slug]
├── /stores                  # Store locator
├── /track-order             # Stub (future Shopify)
├── /cart                    # Stub: "Checkout launching soon" + lead CTA
├── /checkout                # Stub
├── /account                 # Stub
├── /contact
├── /about                   # Brand strategy summary, mission, promise
└── /legal/[policy]          # Terms, privacy, refund, shipping, FSSAI
```

Route groups: `(site)` marketing shell, `(commerce)` stubs, `(ledger)` lead-gen flows.

---

## 7. Data Model — Payload Collections

### Shared brand collections

| Collection | Purpose | Key fields |
|---|---|---|
| `stories` | Editorial: journal, festivals, regional, recipes | `title`, `pillar` (farm/milk/karigar/karigari/packaging/festival/regional/recipe), `body` (richText), `heroImage`, `relatedProducts[]`, `relatedVerticals[]`, `locale` |
| `karigars` | Karigar archetype profiles | `name`, `archetype` (chenna/kaju/ghee specialist), `specialties[]`, `portrait`, `story`, `signatureProducts[]` |
| `farms` | Farm stories + supply chain | `name`, `location`, `story`, `gallery[]`, `milkProcess`, `certifications[]` |
| `packaging` | Packaging families | `name`, `family`, `sizes[]`, `compatibleMithai[]`, `images[]`, `occasionFit[]`, `customizable` |
| `occasions` | Birthday, wedding, Diwali, Rakhi, corporate | `name`, `copy`, `image`, `recommendedProducts[]` |

### Per-vertical product collections

| Collection | Key fields |
|---|---|
| `mithai-products` | `name`, `slug`, `family` (classic/original/sugarFree/regional/seasonal), `ingredients`, `allergens`, `shelfLife`, `storage`, `freshnessStatus`, `dietaryTags[]`, `boxCompatibility[]`, `packagingCompatibility[]`, `leadTime`, `images[]`, `story`, `karigar` (rel), `displayPrice` (display-only; not transacted in v1) |
| `gift-boxes` | `name`, `size` (4/8/16-piece), `compartmentLayout`, `compatibleMithai[]`, `packaging[]`, `addOns[]` (carry-bag/sleeve/ribbon/card), `images[]`, `curatedAssortments[]` |
| `qsr-menu-items` | `name`, `category` (chaat/chole-bhature/kulcha/thaali/chinese/south-indian), `description`, `availableAtStores[]`, `image`, `veg`, `spiceLevel` |
| `snack-products` | `name`, `category` (namkeen/cookie/dry-fruit), `weight`, `description`, `images[]`, `externalRetailers[]` (Amazon/Instamart/Blinkit URLs), `msrp` |
| `merch-products` | `name`, `type` (tool/book/experience), `description`, `images[]`, `price`, `availability` (in-stock/pre-order/enquiry-only) |

### Lead-capture collections

| Collection | Purpose | Key fields |
|---|---|---|
| `leads` | All consultative enquiries | `type` (wedding/corporate/merch/gift-builder-draft/wholesale), `contact` (name, email, phone, company, GSTIN), `payload` (JSON: occasion, qty, budget, date, city, selectedProducts, message), `status`, `createdAt`, `source` |
| `drafts` | Saved gift-builder configurations | `sessionId`, `config` (JSON), `expiresAt` (TTL 30 days), `convertedToLeadId` |

### Globals

- `brandSettings` — logo, tagline, positioning, hero copy, default theme
- `navSettings` — primary nav structure, utility nav links
- `themeSettings` — palettes for default + occasion variants
- `analyticsSettings` — GA4 id, Meta pixel, Hotjar, WhatsApp number
- `storeSettings` — locations, hours, delivery radius

**i18n:** Payload `localized: true` on text fields. Editors write per-locale content. Fallback chain: requested locale → `en`.

**Legacy theme transition:** Existing `data-theme` values not in the locked set (`mishran-default`, `diwali-saffron`, `wedding-heritage`, `everyday-sage`) silently fall back to `mishran-default` on next page load. The ThemeSwitcher UI exposes only the 4 locked options. Removed design-system files preserved on git branch `archive/design-systems-pre-collapse` before deletion from main.

---

## 8. Component Architecture

Three layers:

**Layer 1 — Layout shell** (`components/layout/`):

- `SiteHeader` — sticky, nav, locale picker, theme picker (4 options), cart badge
- `SiteFooter` — link map, brand promise, social, WhatsApp CTA, FSSAI, legal
- `BrandBar` — top utility strip
- `PageBackground` — themed backdrop (existing, refactored)
- `LocaleRouter`

**Layer 2 — Content blocks** (`payload-blocks/`):

Editors compose stories from these richText blocks:

`HeroBlock`, `StoryBlock`, `ProductCarouselBlock`, `PillarBlock`, `FreshnessBlock`, `PackagingGalleryBlock`, `GiftBuilderEmbedBlock`, `TestimonialBlock`, `CTABlock`, `WeddingLeadBlock`, `CorporateLeadBlock`, `StoryListBlock`, `KarigarArchetypeBlock`, `MapBlock`, `FAQBlock`.

**Layer 3 — UI primitives** (`components/ui/`):

`Button`, `IconButton`, `Link`, `Badge`, `Tag`, `Pill`, `Card`, `MediaCard`, `ProductCard`, `StoryCard`, `Modal`, `Drawer`, `Popover` (Radix-based), `FormRow`, `Input`, `Select`, `TextArea`, `Checkbox`, `Breadcrumbs`, `Pagination`, `Tabs`, `ThemeSwitcher` (existing, trimmed), `LocaleSwitcher`.

**Vertical-specific components:**

- `mithai/` — `MithaiCard`, `FamilyFilter`, `MithaiPDP`
- `gift-builder/` — `BoxCanvas`, `CompartmentGrid`, `AddOnPicker`, `PricePreview`, `DraftSaveBar`
- `qsr/` — `MenuItemCard`, `StoreCard`, `StoreFinder`
- `snacks/` — `SnackCard`, `RetailerRedirect`
- `merch/` — `MerchCard`, `EnquiryButton`
- `stories/` — `StoryHero`, `PillarNav`, `KarigarPortrait`, `TimelineBlock`, `GlossaryTerm`
- `ledger/` — `LeadForm`, `WeddingConfigurator`, `CorporateConfigurator`, `GSTFields`

**State management:**

- React Context for cart + draft state (no Redux)
- TanStack Query for Payload data fetching
- `next-intl` for UI strings
- Theme via `data-theme` attribute on `<html>`

---

## 9. Data Flow

**Read paths:**

```
[Browser]
   │
   ▼
[Next.js Server Component / Route Handler]
   │
   ├──[next-intl]──▶ messages/{locale}.json         (UI strings)
   ├──[Payload server-side]──▶ MongoDB              (products, stories, etc.)
   └──[TanStack Query hydrate]──▶ client cache
```

Server Components fetch; Client Components receive hydrated props. Client-side Payload calls restricted to live search and gift-builder draft saves.

**Write paths:**

1. **Lead capture:**
   ```
   Client form → POST /api/leads → Payload leads.create()
        → email notification (Resend)
        → optional webhook to CRM (future)
        → return lead id + confirmation
   ```

2. **Draft autosave:**
   ```
   Client state → debounce 2s → POST/PUT /api/drafts
        → Payload drafts.create/update
        → draftId stored in localStorage
   ```

3. **Admin edits:** Editor → `/admin` → Payload Local API → MongoDB.

**Search:** Payload full-text across `mithai-products`, `stories`, `qsr-menu-items`, `snack-products`, `merch-products`. Client instant-search hits `/api/search?q=…`.

**Theming flow:** Default theme from `themeSettings` global → client reads localStorage override → sets `data-theme` on `<html>`. Inline script in layout reads localStorage before hydration to prevent flash.

**Locale flow:** `[locale]` segment enforces routing. Middleware negotiates locale. Payload content fetched with `locale=` param, fallback to `en`.

**Analytics events** (per PRD §15):

`product_viewed`, `story_viewed`, `karigar_viewed`, `packaging_viewed`, `gift_builder_started`, `gift_builder_completed`, `add_to_cart` (draft), `lead_submitted`, `whatsapp_clicked`, `search_used`, `draft_saved`, `locale_changed`, `theme_changed`, `missing_translation`.

Emitted through `lib/analytics.ts` to GA4 + Meta Pixel dataLayers.

---

## 10. Error Handling, Performance, Accessibility, SEO

### Error handling

| Layer | Strategy |
|---|---|
| Route errors | Next `error.tsx` + `not-found.tsx` per locale. Branded pages with search + WhatsApp CTA. |
| Payload fetch failures | Server Components catch → null + fallback block. Route does not crash. |
| Form submission failures | Toast (Sonner) + inline error + retry. Input preserved. |
| Draft save failures | Queue in localStorage, retry next visit. Subtle "draft unsaved" badge. |
| Locale fallback | Missing translation → fall back to `en`; log `missing_translation` event. |
| Image load failures | `<Image>` onError → blurhash placeholder. |
| Payload admin unreachable | Maintenance page; site serves from ISR cache. |

### Performance targets

- LCP < 2.0s on mobile 4G (key landing pages)
- CLS < 0.1, INP < 200ms
- Lighthouse Performance ≥ 90 (home, mithai hub, PDP)
- TBT < 200ms

### Performance tactics

- `next/image` everywhere; AVIF/WebP auto; `sizes` + `priority` for LCP only
- ISR: `revalidate = 60` on product/story routes; on-demand revalidate via Payload `afterChange` webhook
- Self-host fonts (single weight family); no Google Fonts CDN
- Tree-shake Payload admin out of public bundle
- Defer analytics until after hydration
- Lazy-mount gift-builder canvas (heavy)

### Accessibility (WCAG AA)

- Semantic landmarks (`header`, `nav`, `main`, `footer`, `aside`)
- Skip-to-content link on every page
- Keyboard-navigable gift-builder (arrow keys move compartment focus, Enter selects)
- All tags have text labels; never icon-only
- Theme palettes validated for AA contrast before locking
- Form errors announced via `aria-live="polite"`
- Respect `prefers-reduced-motion` for hero video and transitions
- All images meaningful alt; decorative `alt=""`
- Locale switch announced to AT

### SEO

- Metadata API per route (`generateMetadata`)
- Schema.org: `Product`, `Offer` (`priceSpecification`), `BreadcrumbList`, `FAQPage`, `Organization`, `LocalBusiness` (stores), `Article` (journal)
- Sitemap auto-generated from Payload collections (`app/sitemap.ts`)
- `robots.txt` allow-all in v1
- Indexable collection pages: classics, originals, sugar-free, regional, gift-boxes, journal/festivals
- Canonical URLs per locale; `hreflang` alternates for all enabled locales
- No client-only routes for indexable content

---

## 11. Testing Strategy

| Layer | Tooling | Coverage targets |
|---|---|---|
| Unit | Vitest | Cart math, draft expiry, locale fallback, pricing display |
| Component | React Testing Library | Form validation, gift-builder capacity logic, theme + locale switchers |
| Integration | Vitest + Payload memory DB | Lead submission, draft save, ISR revalidation webhook |
| E2E | Playwright | Home → mithai → PDP; gift-builder; wedding lead; search; locale switch |
| Visual | Playwright screenshot diffs (CI) | Home, mithai hub, PDP, gift-builder, story — for each theme |
| A11y | axe-core in Playwright | Every page passes WCAG AA |
| Perf | Lighthouse CI | Home + PDP + mithai hub ≥ 90 |
| Type | `tsc --noEmit` | 0 errors |
| Lint | ESLint (existing) | 0 errors |

**CI gates:** types + lint + unit + integration on every PR. E2E + Lighthouse on staging deploys.

---

## 12. Roadmap (Umbrella)

| Phase | Sub-project | Outcome |
|---|---|---|
| **0 — Foundation** | Theme unification, IA, i18n, Payload install, story framework, analytics, thin-slice routes for all 4 verticals | Site live; every vertical has landing + sample detail page; lead forms work |
| 1 | Mithai & Gifting flagship depth | Full mithai catalog, PDP system, gift-builder canvas v1, packaging showcase |
| 2 | Wedding configurator | Wedding configurator + lead routing |
| 3 | Corporate configurator | GST fields, sample request, account routing |
| 4 | QSR depth | Full menu, store finder, pickup lead |
| 5 | FMCG depth | Snack catalog, retailer redirect, subscribe-to-stock |
| 6 | Merch & museum depth | Collectibles, book pre-order, experience-store enquiries |
| 7 | Journal & content engine | Editorial workflow, festival campaigns, regional language expansion |
| 8 (future) | Commerce migration | Shopify headless; transactions enabled |
| 9 (future) | AI concierge | Text-based concierge; voice via PersonaPlex later |

The first implementation plan (next skill: writing-plans) covers **Phase 0 — Foundation** only.

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Four-vertical scope balloons | Foundation ships thin slices only. Each depth phase = separate sub-plan. |
| Payload runtime cost | Mongo Atlas M0 (free) + Vercel hobby for v1; documented upgrade path. |
| Theme collapse breaks existing references | Audit `design-systems/*.md` usage before deletion; archive branch. |
| Multi-locale content entry overhead | Ship with EN + minimal HI + KN. Fallback chain. |
| Gift-builder canvas is heavy | Lazy-load; static preview until user interacts. |
| Lead routing unclear | Capture everything to `leads` with `status = new`; ops triages in Payload admin. |
| Asset delivery (photography/copy) gates vertical depth | Each depth phase gated on asset availability. |
| Free email tier exhaustion | Start with Resend (3k/mo); upgrade before wedding season. |

---

## 14. Open Decisions (parked, not blocking v1)

- Final product lists per vertical (founders/ops)
- Photography asset delivery schedule
- Final MOQ + lead times per packaging family
- Delivery radius + windows (operations)
- CRM target (Zoho/HubSpot/Freshsales)
- Razorpay vs deferred Shopify checkout
- Voice concierge scope (Phase 9)

---

## 15. Foundation Phase — Acceptance Criteria

- [ ] Mishran-default theme + 3 occasion variants locked; rest archived on branch
- [ ] Locale routing for `en`, `hi`, `kn` active; hreflang emitted
- [ ] Payload CMS installed; admin at `/admin`
- [ ] Shared collections defined (`stories`, `karigars`, `farms`, `packaging`, `occasions`)
- [ ] One sample product collection per vertical defined
- [ ] `leads` collection + `/api/leads` endpoint + email notification
- [ ] Brand-home live with cinematic hero + 4 vertical portals
- [ ] Each vertical has landing page + one sample detail page
- [ ] Wedding + corporate lead forms functional
- [ ] Analytics events wired (GA4, Meta Pixel)
- [ ] Lighthouse ≥ 90 on home, mithai hub, sample PDP
- [ ] Playwright E2E covers golden paths
- [ ] Vercel deploy green; MongoDB connected; ISR working

---

## 16. Source Document Reconciliation

| Source | How it informs this spec |
|---|---|
| **Mishran Brand Strategy PDF** | Brand pillars, master narrative, brand polarity, content universe (origin/craft/milk/karigar/technique stories), karigar archetypes, social-content framing — all carried into shared collections and storytelling framework. |
| **Mishran Digital Flagship PRD v1.0** | Homepage requirements, gift-builder flow, wedding + corporate flows, packaging requirements, analytics events, performance/SEO/a11y targets — all preserved. Shopify-specific sections reinterpreted as "future commerce phase" per platform decision. |
| **PersonaPlex / Jarvis Guide** | Recognized but out of scope. Will inform Phase 9 (AI concierge). Voice integration explicitly deferred. |

**Conflicts resolved during brainstorming:**

- PRD specified Shopify; user chose Next.js marketing + lead-gen only (commerce deferred).
- Brand strategy covers four business lines; PRD narrowed to mithai+gifting; user chose all four as first-class verticals.
- Repo ships ~7 themes; brand strategy argues for one identity; user chose one default + 2–3 occasion variants.
- PRD asks for heavy editorial; user chose Payload CMS (free, self-hostable, Next-native).
- PersonaPlex/Jarvis not in PRD; user chose to drop from v1.
