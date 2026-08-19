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
   unmoderated reviews, freshness/low-batch alerts.
2. **Order console depth** — formatted ₹, customer name, item summary; status/payment/date
   filters; packing-slip print; refund/capture hooks.
3. **Product list upgrade** — thumbnail + price + freshness pills, curated columns.
4. **Bulk ops + CSV import/export** — bulk publish/feature; pincode import (the collection
   is currently blank in admin — D3 — and pincodes are exactly CSV-shaped data).
5. **Drafts & live preview** for catalog edits.
6. **Home Hero curation UX** — drag-reorder, per-slide thumbnails, preview link,
   ≥1-slide validation.
7. **Customer 360** — orders, addresses, last-seen on one panel.
8. **Media governance** — grid view, alt-text completion score, usage backlinks.
9. **Localization completeness** — locale switcher on content edit (hi/kn exist).

### P2 — Delight (quarter)

1. Command palette (⌘K) + global search across products/orders/customers.
2. Scheduled publishing & seasonal windows.
3. Roles & audit log (staff vs owner; change history).
4. Autosave + unsaved-changes guard.
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
