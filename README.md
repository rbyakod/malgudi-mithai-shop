# Mishran — Digital Flagship Storefront

Modern Indian mithai brand storefront on Next.js 16 App Router + Payload CMS 3.87 + MongoDB.

**Stack:** Next.js 16.2 · Payload CMS 3.87 · MongoDB · next-intl (en/hi/kn) · Tailwind v4 · Resend · Vercel.

## Documentation (open these in your browser)

After cloning, open any of these HTML docs directly in a browser — no server required:

- **[docs/cofounder-guide.html](docs/cofounder-guide.html)** — plain-English guide for non-tech co-founders. Start here if you're new.
- **[docs/Current-Functionality-README.html](docs/Current-Functionality-README.html)** — every feature shipped, what it does, how it works under the hood.
- **[docs/vercel-deployment.html](docs/vercel-deployment.html)** — first-time Vercel + MongoDB Atlas setup recipe.
- **[docs/developer-workflow.html](docs/developer-workflow.html)** — how to push updates from a Mac to production Vercel (daily cycle, previews, rollback).
- **[docs/deployment.md](docs/deployment.md)** — operator runbook (Markdown source for the Vercel deployment recipe).

## Quick start (local dev)

Requires Node 22 + a local MongoDB (`brew services start mongodb-community`).

```bash
npm install
cp .env.example .env.local   # then edit values
npm run seed
npm run dev                  # http://localhost:3000
```

## Common scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run the built app |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E + axe a11y |
| `npm run seed` | Seed sample content into MongoDB |
| `npm run seed:catalog` | Repopulate the golden catalog test data (see below) |
| `npm run seed:branding` | Apply branding one-offs (brand-settings global + demo QSR image) |
| `npm run lhci` | Lighthouse CI (local) |

## Golden test data (catalog seed)

The committed catalog JSONs in `scripts/seed-data/` are the **golden test
data** — real product data scraped from public storefronts (Bikanervala,
Haldiram's, Anand Sweets) plus freely-licensed Wikimedia Commons dish
photos. They are checked into Git, so a fresh checkout can always
repopulate an identical catalog.

| File | Collection | Count |
| --- | --- | --- |
| `mithai-catalog.json` | `mithai-products` | 76 (classic 20 · original 20 · regional 13 · seasonal 11 · sugar-free 12) |
| `snacks-catalog.json` | `snack-products` | 24 (namkeen 14 · cookie 6 · dry-fruit 4) |
| `qsr-catalog.json` | `qsr-menu-items` | 20 (thaali 18 · chole-bhature 2) |
| `gift-catalog.json` | `gift-boxes` | 22 |

### Repopulate

```bash
pnpm seed                # base sample content (users, stories, …)
pnpm seed:catalog        # golden catalog data (all four collections)
pnpm seed:branding       # branding one-offs (brand-settings global,
                         #   sun-logo media, demo Chole Bhature image)
```

Run all three, in that order, for a full dev-DB restore from a fresh
database.

- Requires a running MongoDB and `.env` (the script reads
  `DATABASE_URI` etc. via `node --env-file=.env`).
- **Idempotent**: mithai upserts by `slug`, the other collections by
  `name`, media by `alt` — re-running never duplicates; it updates
  fields in place and reuses uploaded images.
- Image bytes are fetched at seed time from the original CDN/Wikimedia
  URLs (nothing binary is committed) and stored in Payload `media`.

### Verify

- API: `GET /api/mithai-products?limit=1` → `totalDocs: 76` (likewise
  `snack-products` 24, `qsr-menu-items`, `gift-boxes`).
- Web: `/en/mithai`, `/en/snacks`, `/en/qsr`, `/en/build-a-gift`.

### Refresh / provenance

- `build-catalog.py` and `build-sections.py` in the same directory built
  these JSONs from scraped source data (not committed — the JSONs are
  the source of truth). Regenerating requires re-scraping.
- **Licensing caveat**: scraped copy and storefront product images are
  for local dev/testing only — not licensed for production use.
  Wikimedia-sourced QSR dish photos are freely licensed; provenance is
  recorded per item in the `source`/`sourceUrl` fields.

## Project structure (top-level)

```
app/                  Next.js App Router routes (locale-prefixed: /[locale]/…)
collections/          Payload CMS collection configs
globals/              Payload CMS global configs
components/           React components (home, layout, commerce, ledger, analytics)
context/              Client-side React contexts (cart, theme, query)
lib/                  Pure modules (analytics, payload-client, revalidate-api, whatsapp, slugify, themes)
messages/             next-intl translation files (en, hi, kn)
scripts/              Seed + utility scripts
tests/                Vitest unit + integration, Playwright E2E
docs/                 HTML + Markdown documentation
vercel.ts             Vercel project config (framework, region bom1, maxDuration)
payload.config.ts     Payload CMS root config
```

## Admin & media reliability pass (2026-08-19)

Follow-ups from live use, shipped in `4abf17b` + the thumbnail fix:

- **Admin list thumbnails fixed** — list rows arrive at `depth=0` (bare media
  IDs); the product cells previously fed those IDs to `next/image`, 400-ing
  every thumbnail. New `MediaThumb` + batched `mediaResolver` resolve IDs via
  one `GET /api/media` call per page (see `docs/admin-audit.md` §14 / D7).
- **Admin sidebar visibility** — bolder/larger section titles and the Mishran
  maroon theme on the persistent rail, with a gold active-route marker.
- **Cinematic hero autoplay** — a resting cursor no longer pauses rotation;
  framed hero keeps hover-pause, reduced-motion still honored.
- **VPS image cache** — nginx now disk-caches `/_next/image` and media files
  (30-day TTL, ~8.6× faster repeat loads) and deploys warm the cache
  automatically (`scripts/warm-image-cache.sh`), ending the broken-image
  burst on product pages after each deploy (`docs/deployment.md` §8).

## Plan + ledger

- Plan: `docs/superpowers/plans/2026-08-10-mishran-foundation-phase.md`
- Spec: `docs/superpowers/specs/` (search mishran)
- Progress ledger: `.superpowers/sdd/progress.md` (gitignored — see task lines for per-task notes)

## Branches

- `main` — production. Squash-merged from PRs.
- Feature branches: `<kind>/<slug>` (e.g. `fix/script-tag-warning`).
