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
| `npm run lhci` | Lighthouse CI (local) |

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

## Plan + ledger

- Plan: `docs/superpowers/plans/2026-08-10-mishran-foundation-phase.md`
- Spec: `docs/superpowers/specs/` (search mishran)
- Progress ledger: `.superpowers/sdd/progress.md` (gitignored — see task lines for per-task notes)

## Branches

- `main` — production. Squash-merged from PRs.
- Feature branches: `<kind>/<slug>` (e.g. `fix/script-tag-warning`).
