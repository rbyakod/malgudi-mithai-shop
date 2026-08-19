# Mishran Admin Console — UX/UI Audit

**Date:** 2026-08-18 · **Target:** `https://mishran.pranavb.com/admin` (Payload 3.87.1)
**Scope:** Full walkthrough — login, dashboard, all major collections and globals, edit forms, mobile.
**Lenses applied:** taste · impeccable · hallmark · ux-ui-max-pro (applied manually; the named
skills are not installed in this workspace).

> Audited live with owner-provided credentials, read-only. No data was modified.
> Credentials are not stored in this document.

---

## 0. Summary & scorecard

The admin has **good bones and a broken skin**. The cream Mishran theme applies to the
page canvas, but a token gap leaves every control, border, and table header on Payload's
default gray — that mixture of warm cream and unstyled gray is precisely the "dull and
pale" impression. On top of that sit four live defects (a 405-ing widget, eleven hydration
errors, a blank admin screen, a stray field leaking into every form), a 36-link sidebar
with slug-derived labels, and flat 20–26-field forms with raw API names ("Totals > Total
In Paise").

| Lens | Score | One-line verdict |
|---|---|---|
| Visual taste | 4/10 | Cream canvas + gray controls = washed-out; brand dies at the chrome |
| Craft ("impeccable") | 3/10 | 405 widget, blank screen, hydration errors visible on every page |
| Distinctiveness ("hallmark") | 5/10 | Custom widgets and wordmark exist; the default shell drowns them |
| Workflow & IA ("ux-ui-max-pro") | 4/10 | 36 flat links, jargon labels, paise fields, no task-oriented paths |
| Trust & reliability | 3/10 | Console errors on load undermine confidence in the tool |
| **Overall** | **3.8/10** | A weekend of P0s moves this to 7+ — the foundation is worth it |

**Highest-leverage single fix:** close the theme token gap
(`--theme-elevation-0/150` + `--color-base-*`) in `custom.scss`. One CSS block recolors
every input, border, and table header across the whole admin. See §2.

---

## 1. Method & evidence

- **Live traversal** (Playwright, 1440×900 + 390×844): login → dashboard → 13 admin
  routes → mobile drawer. 16 screenshots captured; DOM facts (columns, field labels,
  computed styles, console errors) dumped per screen.
- **Code-level theme analysis:** `app/(payload)/admin/custom.scss` vs
  `@payloadcms/ui/dist/scss/colors.scss` (v3.87.1) to trace every token to its consumer.
- **Safety:** login used a fail-fast shape check before submitting (Payload locks the
  account after 5 attempts); 3 successful logins total, all read-only.
- DOM facts are authoritative where screenshots were ambiguous; no findings below rest on
  a screenshot alone.

---

## 2. The "dull and pale" root cause — theme token gap

**What's working:** `body[data-admin-theme="mishran-admin"]` applies — live-computed
`bodyBg rgb(247,239,224)` (the cream), body text `rgb(42,26,14)`, and elevation-50 is
correctly overridden to `#f7efe0`.

**What's broken:** Payload's component library does not read "background" for most
chrome — it reads a ladder of elevation tokens, and `custom.scss` overrides only
`--theme-elevation-50…900`. It never touches:

- `--theme-elevation-0` (input/card fills)
- `--theme-elevation-150` — **the border color** (`--theme-border-color` aliases it)
- the entire `--color-base-*` layer that the ladder is built from

Live-computed proof:

| Token | Value on `:root` | Value on `body[data-admin-theme]` |
|---|---|---|
| `--theme-elevation-50` | `#f5f5f5` | `#f7efe0` ✔ overridden |
| `--theme-elevation-150` | `#ddd` | `#ddd` ✘ **not overridden** |
| text-input border (computed) | — | `rgb(221,221,221)` = `#ddd` |

So: cream canvas, white inputs with **default gray hairline borders**, gray 13px table
headers, gray rules — a warm page wearing gray accessories. That dissonance *is* the pale.

### The fix (one block in `custom.scss`)

```scss
body[data-admin-theme] {
  // close the ladder: the two missing rungs + the base layer it is built from
  --theme-elevation-0:   #fffdf8; // inputs, sticky headers on cream
  --theme-elevation-150: #e6d9bd; // ALL borders — the #ddd culprit
  --color-base-0:   #fffdf8;
  --color-base-100: #f7efe0;
  --color-base-150: #e6d9bd;
  // …mirror the same warm ramp for 200–900 that the existing overrides use
}
```

Verify with the ramp already in the file (elevation-50…900) so rungs stay monotonic, then
re-check computed borders in DevTools. Both alternate themes (`mishran-midnight`,
`mishran-monsoon`) need the same two rungs + base layer.

---

## 3. Live defects (P0 — fix regardless of design work)

| # | Defect | Live evidence | Fix direction |
|---|---|---|---|
| D1 | **Recent-leads widget 405s** | `"Couldn't load leads. Error: 405 Method Not Allowed on /leads?limit=5&sort=-createdAt&depth=0"` — the REST base is `/api/…`, the widget calls the page route | Point the fetch at `/api/leads?…` (or use the Local API since the widget is server-rendered) |
| D2 | **11 hydration errors on every page** | `Minified React error #418` (text/HTML mismatch) ×11 in one session | Typically a date/relative-time rendered differently server vs client — audit the four dashboard widgets first |
| D3 | **Serviceable Pincodes admin is a blank screen** | Correct camelCase route `/admin/collections/serviceablePincodes` renders an **empty `<main>`** — no list, no "Create New" | Debug the view config; likely a broken `admin` block or access function on that collection |
| D4 | **"Admin theme" field leaks into every form** | The label appears at the end of *all 5* dumped forms (order edit, theme/brand settings, home hero) — the settingsMenu component is rendering as a pseudo-field | Move the switcher out of `settingsMenu` (e.g. `afterNavLinks` in the sidebar, or the account view); verify slot behavior in 3.87 |
| D5 | **Browser title is "Dashboard - Payload"** | `document.title` on every screen | `admin.meta.titleSuffix: " — Mishran"` in `payload.config.ts` |
| D6 | **Theme switcher undiscoverable** | The only "theme" affordance found is the Theme Settings global link | Ships with D4's relocation |

---

## 4. Information architecture — 36 links, six groups, slug-speak

The sidebar exposes **36 destinations** in groups `01 Brand · 02 Products · 03 Catalog
Ops · 04 Storefront · 05 Settings` plus an unnumbered commerce cluster. Three problems:

1. **Slug-derived labels.** "Qsr Menu Items", "Otp Requests", "Packagings",
   "Serviceable Pincodes", "Wallet Passes" — the collection slug with a space and a
   capital. `labels: {singular, plural}` exists for exactly this.
2. **System tables sit next to merchandising.** Cart Drafts, Otp Requests, Security
   Events, Snapshots, Devices are operational exhaust — an owner should never scroll past
   them daily. `admin.hidden: true` (or a collapsed "System" group) removes them from
   sight without removing the data.
3. **No task entry points.** The nav answers "which table?" — never "fulfill today's
   orders", "moderate reviews", "reconcile COD cash".

**Proposed labels:**

| Current | Proposed |
|---|---|
| Qsr Menu Items | QSR Menu |
| Snack Products / Merch Products | Snacks · Merch (or fold under "Catalog") |
| Otp Requests | hidden (system) |
| Cart Drafts, Security Events, Snapshots, Devices | hidden (system) |
| Serviceable Pincodes | Delivery Areas |
| Wallet Passes | Wallet Passes (Apple) — or hidden until public |

---

## 5. Forms & workflows — raw fields, no shape

**Product edit:** one flat column of ~20 labels — Name, Slug, Family, Ingredients,
Allergens, Shelf Life, Storage, Freshness Status, Dietary Tags, Box Compatibility,
Packaging Compatibility, Lead Time, **three upload fields all labeled just "Image"**,
Story, Karigar, Display Price, Featured, Weight. No tabs, no sections, no descriptions.

**Order edit:** 26 flat labels including `Customer Id`, `Product Id`, `Price In Paise`,
`Items Total In Paise`, `Delivery Fee In Paise`, `Taxes In Paise`, `Discount In Paise`,
`Total In Paise`, `Razorpay Order Id`, `Cart Snapshot Id` — and the stray `Admin theme`
(D4). Tabs: none.

**Globals** (Theme Settings, Brand Settings, Home Hero): same story — Home Hero is an
autoplay-interval field plus five identical `Product + Caption Override` pairs with no
thumbnails, no reorder, no preview.

Fixes, in impact order:

1. **Tabs/named groups** on product (Content · Sourcing · Logistics · Media) and order
   (Items · Totals · Payment · Fulfillment).
2. **Human labels + `admin.description`** on every field: "Price (₹)" not
   `Price In Paise`; "Razorpay order" not `Razorpay Order Id`.
3. **Rupee-display components** for money fields (store paise, display ₹).
4. **Named uploads**: "Hero image", "Gallery image 2", "Packaging photo" — not 3× "Image".
5. **Relationship fields with searchable select + secondary display** (customer name, not
   raw id).

---

## 6. Lists & tables — data without affordances

- **Orders list** columns: `ID · Customer Id · Status · Payment Method · Totals > Total
  In Paise · Created At`. An id and a paise integer where a name and ₹ belong.
- **Mithai list**: `Name · Slug · Family · Ingredients` — **no thumbnail, no price** for a
  visual catalog of 91 sweets.
- **Media library**: a text table of `File Name · Alt · Updated At · Created At` — the
  brand's food photography has no grid view.
- Customers (`Phone · Name · Locale · Created At`) and Coupons (`Code · Discount Type ·
  Value · Active · Used Count · Active To`) are the same gray grid.

Fixes: curated `defaultColumns` per collection (thumbnail + display price + freshness
pill for mithai; customer name + ₹ total + status pill for orders), a media grid view,
status rendered as colored pills, and saved filter presets ("New orders today", "Pending
COD", "Low freshness stock").

---

## 7. Dashboard — four good widgets drowning in 92 cards

The custom grid (Recent leads · Mithai freshness · Pending stories · Catalog counts) is
the right instinct — freshness ("Made daily 11 · Made to order 8 · Batch frozen 1") and
catalog counts (Mithai 91 · QSR 33 · Snacks 39 · Merch 1 · Gift Boxes 23) are genuinely
useful. But below them sit **92 default collection cards**, and the leads widget is a 405
(D1). No orders, no revenue, no imagery.

An owner's dashboard should answer the day in one glance: **orders to fulfill · revenue
today/this week · COD cash to reconcile · reviews awaiting moderation · freshness
alerts**. All five are derivable from data that already exists.

---

## 8. Login & brand moments

The login screen (vision critique + DOM): muted palette, small wordmark, technical
tone — "Mishran editor console" reads internal, not boutique. High-impact moves:
warm ivory card on a deeper maroon field, serif display lockup with tagline hierarchy, a
gold rule/divider, tactile focus and hover states. The custom wordmark/crest graphics
already exist — they're just under-dressed.

Empty states ("No pending drafts. Start a new story →") are friendly — keep that voice
everywhere.

---

## 9. Mobile (390px)

The shell survives: nav collapses to a drawer, widgets stack. But 92 cards make the
dashboard an endless scroll, and no owner task (check today's orders, reconcile COD) is
reachable in under a minute. Post-P1 (ops dashboard + hidden system cards), consider a
deliberate "owner mobile" surface: today's orders + COD tally + review queue.

---

## 10. Accessibility & trust

- Hydration errors (D2) are robustness bugs with a11y echoes — mismatched text nodes.
- Gray-on-cream table headers at 13px sit near the contrast edge; warm token fix (§2)
  should re-check `--theme-elevation-600+` text tokens for ≥4.5:1.
- Focus states exist but are default; brand the ring in gold.

---

## 11. Roadmap — missing features & manageability

### P0 — Fix & align (days)

1. Theme token block (§2) — both remaining themes too.
2. D1–D6 defect list (§3).
3. Label pass + hide system collections (§4).
4. `titleSuffix`; wordmark in the nav header.

### P1 — Manageability (weeks)

1. **Ops dashboard** — orders-to-fulfill, revenue today/week, COD pending reconciliation,
   unmoderated reviews, freshness/low-batch alerts. ✅ shipped in the overhaul (§13).
2. **Order console depth** — formatted ₹, customer name, item summary; status/payment/date
   filters; packing-slip print; refund/capture hooks. ✅ shipped (console in B13;
   packing slip #126 + refunds #130 in §15).
3. **Product list upgrade** — thumbnail + price + freshness pills, curated columns.
   ✅ shipped in the overhaul (§13).
4. **Bulk ops + CSV import/export** — bulk publish/feature; pincode import (the collection
   is currently blank in admin — D3 — and pincodes are exactly CSV-shaped data).
   ◐ CSV both ways shipped (#128 export, #129 pincode import, §15); bulk
   publish/feature still open.
5. **Drafts & live preview** for catalog edits. ◐ drafts + autosave on all five product
   collections (#131, §15); live preview still open.
6. **Home Hero curation UX** — drag-reorder, per-slide thumbnails, preview link,
   ≥1-slide validation. ◐ thumbnails + preview link shipped (#127, §15);
   drag-reorder ships free with the array field; ≥1-slide validation still open.
7. **Customer 360** — orders, addresses, last-seen on one panel.
8. **Media governance** — grid view, alt-text completion score, usage backlinks.
9. **Localization completeness** — locale switcher on content edit (hi/kn exist).

### P2 — Delight (quarter)

1. Command palette (⌘K) + global search across products/orders/customers.
2. Scheduled publishing & seasonal windows.
3. Roles & audit log (staff vs owner; change history).
4. Autosave + unsaved-changes guard. ◐ autosave shipped on products (#131, §15 —
   Payload hides the redundant Save-Draft button); unsaved-changes guard already
   ships free via the native LeaveWithoutSaving modal on Cancel (§14 D8).
5. In-admin storefront preview (device-frame toggle).

### Quick wins (≤1 hour each)

`titleSuffix` · D1 fetch path · hide 5 system collections · label pass on the 6 worst
names · orders `defaultColumns` · `--theme-elevation-150` override.

---

## 12. Appendix — evidence log

- Console: 11× React #418; no other page errors.
- Computed styles: `bodyBg rgb(247,239,224)`; `rootElevation50 #f5f5f5`;
  `bodyElevation150 #ddd`; text-input border `rgb(221,221,221)`;
  `data-admin-theme="mishran-admin"` present.
- Title: `Dashboard - Payload`. Sidebar: 36 links; groups 01–05 + commerce cluster.
- Widgets: leads = 405 text; freshness = Made daily 11 / Made to order 8 / Batch frozen 1;
  stories = none pending; catalog = Mithai 91 / QSR 33 / Snacks 39 / Merch 1 / Gift Boxes 23.
- Default collection cards: 92.
- Pincodes: empty `<main>` at `/admin/collections/serviceablePincodes`.
- Screens captured (16): login, dashboard, mithai list/edit, orders list/edit, theme /
  brand / home-hero globals, media, customers, account, coupons, pincodes, mobile ×2.

---

## 13. Implementation status — 2026-08-18 overhaul

Shipped in the "Big admin overhaul" (all verified on a local dev build before deploy):

### Theme (§2) — fixed

`--theme-elevation-0/150` now resolve to theme tokens, and each theme ships a complete
`--color-base-0…1000` ladder so every aliased rung re-themes. All three themes
(cream / midnight / monsoon) covered.

### Defects (§3)

| ID | Status | Notes |
|----|--------|-------|
| D1 leads 405 | **Fixed** | Concrete route wraps Payload's `REST_GET` with synthetic catch-all params (`{slug: ["leads"]}`). A bare re-export of the catch-all 404s — the REST handler derives the collection from route params, not the URL. Anonymous GET now 403s (correct), authenticated GET 200s with docs. |
| D2 hydration #418 | **Upstream — verdict recorded** | Payload's own Theme provider writes `data-theme` on `<html>` during hydration (`@payloadcms/ui/dist/providers/Theme/index.js:27`). Reproduces on stock screens (login, create-first-user) with zero Mishran widgets mounted. React recovers by client-rendering; no user-visible breakage. Not fixable from userland. |
| D3 pincodes blank | **Not reproduced post-overhaul** | Page renders fully with the new config (labels + defaultColumns). Note: Payload admin has no `<main>` element at all — the audit's "empty `<main>`" observation reflected the pre-overhaul prod state, not a config bug. |
| D4 theme field leaking into forms | **Fixed** | Switcher moved from `settingsMenu` to `afterNavLinks` (sidebar). Verified: 0 instances inside edit forms, exactly 1 in the sidebar on every screen. |
| D5 title suffix | **Fixed** | `meta.titleSuffix: " — Mishran"` — every admin page now reads e.g. "Mithai — Mishran". |
| D6 switcher discoverability | **Fixed** | Same relocation as D4 — visible on every admin screen, in the sidebar. |

### IA (§4) — done

Human labels on all awkward collections (QSR menu item, Snacks, Merch, Packaging,
Delivery Areas, Wallet Passes, Order/Payment…); 5 system collections hidden
(Cart Drafts, Drafts, OTP Requests, Security Events, Devices, Snapshots);
commerce collections grouped under "06 Commerce".

### Forms (§5) — done

Mithai and Orders restructured into **unnamed tabs** (Details / Content / Media /
Sourcing / Logistics; Order / Items / Totals / Payment & delivery). Unnamed tabs keep
field paths flat, so API contracts, seeds, and mobile clients are untouched. Money
fields keep their `*InPaise` names but carry human labels; the Totals tab notes the
paise storage convention.

### Lists (§6) — done

Curated `defaultColumns` for Mithai, Orders, Payments, Delivery Areas. Three new cells:
`RupeeCell` (₹ with Indian digit grouping, paise-aware decimals), `OrderStatusCell`
(12-status tone-mapped pill), `FreshnessCell` (storefront vocabulary pill).

### Dashboard (§7) — done

"Shop overview" heading + `OpsPulse` KPI strip above the existing 2×2 editorial grid:
**To fulfill** (confirmed→out-for-delivery), **COD cash to collect**, **Paid today**,
**Paid this week**, **Reviews to moderate** — each tile deep-links to a pre-filtered
list and degrades independently to "—" if its query fails.

### Login (§8) — done

Boutique restyle: cream card with gold hairline border, crest in a gradient square,
gold eyebrow ("Mishran Sweets & Snacks"), "Welcome back" headline + one line of copy.

### Verification

Unit + integration suites green (90 admin/leads tests incl. 14 new cell tests);
`pnpm build` green; local dev probe pass confirmed every widget, tab set, pill, and
title suffix renders; authenticated `GET /api/leads` → 200.

### Not in this pass (see §11 roadmap)

CSV import/export, drafts & live preview, customer 360, media governance, localization
switcher, command palette, scheduled publishing, roles & audit log. These remain the
P1/P2 backlog.

## 14. Post-deploy follow-ups — 2026-08-19

Follow-ups from live use after the overhaul shipped (commits `4abf17b` + the
thumbnail fix).

### Sidebar visibility & Mishran theme (§4 polish)

- Group titles are now **bolder and larger** (px-based — the admin root computes
  rem ~25% smaller than the storefront, so rem-scaled admin type renders tiny).
- The persistent rail (≥1441px viewports) carries the Mishran maroon with the
  cream/gold accents. Below 1441px Payload swaps to an off-canvas drawer, which
  was the "white/invisible sidebar" red herring during verification — probe the
  admin at ≥1441px wide or you are not looking at the rail.
- The active-route marker styles the **current** nav entry via a
  `div.nav__link` tag selector in unlayered `custom.scss`: Payload renders the
  current route as a `<div>`, not an `<a>`, so no class or aria hook
  distinguishes it.

### D7 — list thumbnails 400 on bare media IDs — fixed

Product rows in list views arrive from a `depth=0` query (Payload's design for
list performance), so `images[0].image` is a bare media ID string, never a
populated doc. The custom product cells passed that string straight to
`next/image`, producing `/_next/image?url=<24-hex>&w=96&q=75` → instant 400
for every row (514 logged on prod nginx in one afternoon). Fix, contained in
the cell layer:

- `pickImage` now classifies strings: URL-looking values pass through; bare
  IDs render `<MediaThumb>` (`components/payload-admin/cells/MediaThumb.tsx`).
- `MediaThumb` subscribes to a module-level store (`mediaResolver.ts`) that
  **batches** every pending ID on the page into one
  `GET /api/media?where[id][in]=…&depth=0` call (40 ms coalescing window,
  50-ID batches, stable snapshots via `useSyncExternalStore`). Rows show the
  styled fallback until the batch lands, then swap to a real 48px thumbnail.
  A failed lookup keeps the fallback; nothing ever 400s.
- Covered by 4 new unit tests (fallback→resolve swap, failed lookup,
  URL-string passthrough, single-field shape) — payload-admin suite 92/92.

### Storefront reliability landed in the same window

- **Cinematic hero autoplay**: a resting cursor no longer pauses the rotation
  (hover-pause now applies to the framed hero only); keyboard focus still
  pauses and reduced-motion is honored.
- **nginx image cache on the VPS** (`/_next/image` + `/api/media/file/`,
  30-day disk cache, ~8.6× faster repeat loads) plus a post-deploy warm step
  (`scripts/warm-image-cache.sh`, runs as step 5/5 of `scripts/deploy-vps.sh`)
  — this is what ended the broken-image burst on product pages after each
  deploy. Ops notes in `docs/deployment.md` §8.

### D8 — no Cancel on any edit view — fixed

Every create/edit form had Save/Publish but no way to back out (browser-back
or URL editing was the only escape). Fix: one shared component injected from
a single place in the config — no per-collection edits.

- `components/payload-admin/actions/CancelAction.tsx` renders a secondary
  **Cancel** link-button via `beforeDocumentControls`, the slot Payload
  renders **first in the DocumentControls row — immediately left of
  Save/Publish — on both create and edit views**.
- Injection is central (`payload.config.ts`): two typed helpers map over the
  collections and globals arrays. **The slot key differs by entity type** —
  collections use `admin.components.edit.beforeDocumentControls`, globals
  use `admin.components.elements.beforeDocumentControls` (Payload has no
  `components.edit` on globals; wrong key = silent no-render). Future
  entities inherit Cancel automatically.
- Targets: collection → its list; global → dashboard (a global's route *is*
  its edit view). Relationship "create new" drawers are excluded via
  `useEditDepth() > 1` — the drawer has its own close control.
- **Known gap — `/admin/account` has no Cancel.** Payload's AccountView
  renders `EditView → DefaultEditView` without `renderDocumentSlots`, so it
  never consumes `beforeDocumentControls` (verified against 3.87.1
  internals; the slot has exactly one consumer). Wiring Cancel there would
  mean replacing the entire account view via
  `admin.components.views.account` — disproportionate for a profile form,
  and stock Payload offers no back-out there either. Left as-is.
- **Dirty-form protection is free**: Cancel is a real `<a>` (Payload
  `Button el="link"`), so the native `LeaveWithoutSaving` guard — a
  capture-phase document click listener — opens the styled "Leave anyway /
  Stay on this page" modal before navigating away from a modified or invalid
  form. No custom confirm code.
- Covered by 4 unit tests (`tests/unit/payload-admin/CancelAction.test.tsx`,
  the suite's first `@payloadcms/ui` mock) + 2 e2e tests in
  `tests/e2e/admin-aesthetics.spec.ts` (clean back-out; dirty-form modal).

### D9 — breadcrumb home crumb unreadable — fixed

The first breadcrumb step (back to the dashboard) is a hardcoded icon-only
link Payload clamps to 18×18 (`step-nav__home`) — the Mishran crest at 18px
was effectively invisible. It now renders as a visible chip matching the
owner's reference: cream pill, brown rounded-square badge with a white "M",
label **"Admin home"**.

- **Pure CSS** in unlayered `custom.scss` (same cascade mechanism as the
  `.nav` block — outranks Payload's `@layer payload-default`): `::before`
  draws the badge, `::after` the label, `width/height: auto` beats the fixed
  18px box (both viewport breakpoints). Styling the class covers both
  variants — the `<a>` on sub-pages and the `<div>` on the dashboard root.
- `admin.components.graphics.Icon` was deliberately **left as CrestIcon**:
  that slot also feeds Payload's OG-image route (satori render) — replacing
  the component with a text chip would leak into OG rendering.
- The crest `<span>` inside the crumb is visually hidden but kept in the
  a11y tree (it carries the "Dashboard" tooltip). Type is px-based per the
  admin rem landmine; colors come from `--t-*` tokens so the chip re-skins
  in all three admin themes.
- e2e guard: computed `::after` content === "Admin home" and chip width
  > 60px in `admin-aesthetics.spec.ts`.

### D10 — near-black form fields on the light canvas — fixed

After the white-canvas commits, every create/edit form still rendered
near-black inputs with dark typed text (owner screenshots of
`/admin/collections/users/create`). Root cause was **two stacked
mechanisms**, both verified against Payload 3.87.1 internals:

1. **Payload's native dark mode was active on `html`.** The config left
   `admin.theme` at its default `'all'`, so `html[data-theme]` followed
   the 365-day `payload-theme` cookie or the OS `Sec-CH-Prefers-Color-Scheme`
   header (an evening dark-mode Mac is enough). Under
   `html[data-theme='dark']` Payload inverts its elevation ladder to
   near-black rungs.
2. **The input token is resolved and frozen on `html`.** All field
   styling funnels through the `formInput` mixin consuming
   `--theme-input-bg` — declared only on `:root` as
   `var(--theme-elevation-0)`. CSS `var()` substitution happens on the
   *declaring* element, so the value froze at `html` against the dark
   ladder. The repo's `body[data-admin-theme]` elevation overrides sit
   one level *below* that resolution point — they repaint anything that
   resolves at the element (typed text, hence dark-on-dark) but can
   never flow into `--theme-input-bg`.

Fix (two prongs, `payload.config.ts` + one `custom.scss` section):

- **Lock the native theme**: `admin.theme: "light"` short-circuits
  `getRequestTheme` before cookie/header (`@payloadcms/next/dist/utilities/getRequestTheme.js:8`),
  so `html[data-theme='light']` is always rendered and the stock
  light/dark toggle disappears — the Mishran sidebar switcher is the
  single source of admin theming now. This also unfreezes drawers and
  the doc-header (they follow `--theme-bg`, resolved on `html`).
- **Re-declare the input token cluster on `body[data-admin-theme]`**
  (custom properties inherit, so a body-level declaration beats the
  html-inherited value for the whole subtree): cream `--theme-input-bg
  #fdf8ed` plus warm-tan border rungs `-150/-250`, hover `-300`,
  focus/placeholder `-400`, panels/stripes `-50/-100`, and
  `--theme-border-color` (html-frozen otherwise — radio borders,
  toasts). Values are literals so **all three admin themes get
  identical Mishran forms**; themes differ only in rail + accents,
  matching the already-forced white canvas. Filled text is
  `#2a1a0e` on `#fdf8ed` (~13:1).
- Polish on top: a house-gold focus ring (`formInput` does border-only
  focus with `outline: 0`), restored borders on the list search pill and
  drawer combobox (Payload strips them — they vanished on white), and
  espresso text on selected react-select options (cream-on-cream fill
  would read washed).
- Covers every `formInput` consumer in one block: text/email/password/
  number/slug/point inputs, textareas, select + relationship controls
  and their open menus and option states, date picker input + calendar
  sheet, code field, checkboxes/radios, popups, toasts, where-builder
  conditions, block/items-drawer searches, upload filename rows, table
  striping, disabled fills. Left as-is deliberately: Monaco's internal
  chrome, black box-shadows (fine on light).
- e2e guard in `admin-aesthetics.spec.ts`: input computed bg
  `rgb(253, 248, 237)`, filled text `rgb(42, 26, 14)`, select control
  same cream, `html[data-theme="light"]`.
- Verified beyond the e2e: a settle-aware probe (poll `getComputedStyle`
  until stable, mirroring `toHaveCSS`) reads exact cream + espresso on
  the create form across **all three themes** and the list search pill,
  7/7. Note for future probing: one-shot style reads catch fields
  mid-mount-transition and return interpolated values with fractional
  alphas — poll to settle, don't trust a single read.
- Owner note: any browser still holding a stale `payload-theme=dark`
  cookie is harmless now (config wins server-side), but a hard refresh
  clears the old dark CSS from cache.

## 15. Ops console wave — 2026-08-19 (#126–#131)

Second roadmap wave, executed off §11. All staff-gated routes follow the
console pattern (`getPayloadAdminUser` → 401 → client surfaces a
sign-in-at-`/admin` hint). Unit tests per feature; gates green.

| # | Feature (§11 item) | Status | Notes |
|---|--------------------|--------|-------|
| 126 | Packing-slip print (P1.2) | **Shipped** | `GET /api/staff/orders/:id/packing-slip` projects order + items (depth 1) into a print-shaped doc; `components/admin/PackingSlip.tsx` renders a print-optimized sheet (short id `#last-6`, line totals, ₹ totals, COD/online badge, delivery address) from the console's Slip button and the board's "Packing slip" action. `window.print()` with a print stylesheet; fetch state keyed by order id (switching orders mid-flight never shows stale data). 8 unit tests. |
| 127 | Home Hero per-slide thumbnails + preview (P1.6) | **Shipped** | Each slide row renders a live `SlidePreview` (48px product thumb via the D7 `MediaThumb`/mediaResolver batch machinery + product name + vertical label); `HomeHero` global gains `admin.preview` so Payload's stock **Preview** button opens the storefront home for the locale. Reuses `pickImage` (now exported). Remaining from P1.6: ≥1-slide validation (currently an empty slides array renders the fallback hero — acceptable since the global ships populated). |
| 128 | Orders CSV export (P1.4) | **Shipped** | "Export CSV" on the all-orders console walks every page of the **current filters** through the staff feed and downloads `mishran-orders-<from>-<to>.csv` (RFC 4180 quoting, ₹ money, UTC timestamps). Capped at 5000 rows — larger sets are told to narrow dates (deliberate: no unbounded browser-driven walks). 5 unit tests on the mapper. |
| 129 | Pincode CSV import (P1.4) | **Shipped** | `/staff/pincodes` console: paste CSV or pick a file → "Validate only" (dry run) or "Import". Header aliases (`pin`/`pin code`, `sla`/`days`, `enabled`), BOM/CRLF tolerance, 6-digit pincode + city/state validation, tier map (fresh/perishable→fresh, else shelf), last-wins dedup, per-line error surfacing. Upserts by pincode via one batched existence query; 2000-row cap. 11 unit tests. The raw collection list stays for spot edits. |
| 130 | Ops-initiated refunds (P1.2) | **Shipped** | `POST /api/staff/orders/:id/refund` refunds through the `PaymentService` adapter (provider-swap-safe, fake in tests). Full remainder by default; `amountInPaise` for partials. Guards: COD → 409 (cash settles offline), no captured payment → 409, over-remainder → 409. Payments doc accumulates `refundedInPaise` + a `refunds[]` audit row (provider id, amount, reason, who, when); order `paymentStatus` follows. **Provider-first ordering**: if the provider refund lands but local bookkeeping fails, the error names the provider refund id for manual reconcile — the refund is never retried. Fulfillment status untouched (that's the transition route's job). Refund button on prepaid rows with paid/partially_refunded status. 7 unit tests. |
| 131 | Drafts + autosave on products (P1.5, partial) | **Shipped** | All five product collections (Mithai, Snacks, QSR, Merch, Gift Boxes) carry `versions: { drafts: { autosave: { interval: 1200 } } }`. Edits autosave as drafts; **Publish is explicit**; the stock "Save Draft" button hides as redundant. Storefront/mobile reads are unchanged — `find()` defaults to published, and existing prod docs without `_status` remain visible (`$ne: 'draft'` matches missing field). Seeds verified safe: Payload's create defaults to published when `draft` isn't requested (create.js). Note: *live preview* from P1.5 is not part of this — the admin `preview` seam exists only on Home Hero so far. |

Known gap recorded: `components/admin/OrdersTable.tsx` still trips react-hooks
v6's `set-state-in-effect` under a direct `eslint` run (mount effect calls
`load(false)` → synchronous `setLoading`). Pre-existing on HEAD, not part of
this wave's diffs; the repo gate (`pnpm lint`) doesn't run that rule. Parked
with #123's eslint debt.
