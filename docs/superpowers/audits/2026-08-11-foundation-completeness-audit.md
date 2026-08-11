# Foundation Completeness Audit

> **Purpose:** Determine readiness of `worktree-mishran-foundation` branch to be extended by the Mishran mobile apps plan (`2026-08-11-mishran-mobile-apps-v1.md`). Mobile plan was parked based on this audit.

**Date:** 2026-08-11
**Auditor:** Claude (Explore subagent) for Ravi
**Base branch:** `main` @ 7ad88bc
**Foundation HEAD:** `9ba1fd1` (22 commits ahead of main)
**Uncommitted in worktree:** `messages/{en,hi,kn}.json`, `scripts/seed.ts` modified; `components/stories/`, `tests/e2e/stories.spec.ts` untracked (in-progress stories work).

## Summary Verdict

**~87% complete.** 21/24 tasks DONE, 2 PARTIAL, 1 UNKNOWN, 3 MISSING.

Core infrastructure (Payload + MongoDB + i18n + themes + API conventions + test runners) is in place. Mobile Phase 0 can extend this cleanly once the gaps below are closed and the branch merges to main.

## Status Matrix

| # | Task | Status | Evidence |
|---|---|---|---|
| 0 | Tooling (Vitest/Playwright/Lighthouse) | DONE | `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json` |
| 1 | Theme collapse → 4 locked | DONE | `lib/themes.ts` with `VALID_THEMES` |
| 2 | Locale trim → en/hi/kn | DONE | `i18n/routing.ts`, `messages/*.json` |
| 3 | Hreflang alternates | DONE | `lib/seo.ts::buildAlternates`, emitted in `[locale]/layout.tsx` |
| 4 | Payload install + Mongo adapter | DONE | `payload.config.ts`, admin mounted at `/admin` |
| 5 | Brand collections (5) | DONE | Stories, Karigars, Farms, Packaging, Occasions |
| 6 | Product collections (5) + seed | DONE | seed in `scripts/seed.ts` |
| 7 | Payload globals (5) | DONE | Brand, Nav, Theme, Analytics, Store |
| 8 | Leads + Drafts collections + TTL | DONE | TTL via `mongooseAdapter.afterOpenConnection` hook |
| 9 | `/api/leads` (POST + Resend) | DONE | |
| 10 | `/api/drafts` (POST/GET/PUT, 30d TTL) | DONE | |
| 11 | `/api/search` (cross-collection) | DONE | |
| 12 | Layout shell (SiteHeader/Footer/BrandBar) | DONE | |
| 13 | Brand-home (hero, portals, pillars) | DONE | |
| 14 | Vertical landings (mithai/qsr/snacks/merch) | DONE | |
| 15 | Sample PDPs per vertical | DONE | |
| 16 | Lead forms (weddings + corporate) | DONE | |
| 17 | Stories hub | **PARTIAL** | Route exists; `components/stories/` is untracked WIP |
| 18 | Analytics helper (`lib/analytics.ts`) | **UNKNOWN / MISSING** | File absent; references in config only |
| 19 | SEO scaffold (sitemap/robots/schema.org) | **PARTIAL** | Only hreflang done; sitemap + robots + JSON-LD missing |
| 20 | Commerce stubs (cart/checkout/account/track) | DONE | Routes present as stubs |
| 21 | ISR revalidation webhook | **MISSING** | `app/api/revalidate/route.ts` absent |
| 22 | Vercel deploy config | **MISSING** | No `vercel.json`, no env var docs |
| 23 | Final CI gates (E2E + Lighthouse + axe) | **MISSING** | Configs exist; not wired to run as gates |

## Gaps That Block Mobile Phase 0

Mobile plan Phase 0 introduces auth, order/payment/catalog/delivery APIs against the foundation. Three foundation gaps will surface immediately:

1. **ISR revalidation webhook missing** — mobile backend will mutate order/catalog state; without `/api/revalidate`, the Next.js cache serves stale data to web. Mobile plan assumes this exists.
2. **Analytics helper missing** — mobile plan's `AnalyticsService` adapter expects a backend event sink. Web GA4/Meta Pixel helper is the obvious reference impl. Currently absent.
3. **Idempotency pattern absent** — mobile plan mandates `Idempotency-Key` on all mutating endpoints. Foundation has no precedent for this. Not a blocker (mobile introduces the pattern), but flagged so mobile plan doesn't get pushback in review for "inventing" it.

## Gaps That Block Production (Not Mobile)

These block foundation's own production ship, not mobile work:

- Final CI gates (Playwright E2E, Lighthouse ≥90, axe) not running as merge gates
- Vercel deploy config + Atlas MongoDB provisioning
- Sitemap.xml + robots.txt + schema.org JSON-LD
- Stories hub component (in-progress, uncommitted)

## Recommended Next Session

1. Commit stories WIP in foundation worktree (or finish and commit).
2. SDD against foundation plan tasks 18-23 above (6 tasks, ~1-2 sessions).
3. Spec compliance review + whole-branch code review.
4. Merge `worktree-mishran-foundation` → `main`.
5. Branch `worktree-mishran-mobile` from new main, dispatch mobile plan Task 1.

## Mobile Plan Reference

The mobile plan extends these specific foundation pieces (do not regress during foundation finish work):

- `payload.config.ts` + collections pattern
- `lib/seo.ts`, `lib/themes.ts` conventions for new `lib/*` modules
- `/api/*` route conventions (POST/GET/PUT shapes, Resend email pattern)
- `mongooseAdapter.afterOpenConnection` lifecycle hook (mobile uses for TTL on `notifications_seen`)
- Vitest config + test file layout

## Files Referenced

- Plan: `docs/superpowers/plans/2026-08-10-mishran-foundation-phase.md` (~2893 lines)
- Spec: `docs/superpowers/specs/2026-08-10-mishran-digital-flagship-design.md`
- Mobile plan (parked): `docs/superpowers/plans/2026-08-11-mishran-mobile-apps-v1.md`
- Mobile spec (parked): `docs/superpowers/specs/2026-08-11-mishran-mobile-apps-design.md`
