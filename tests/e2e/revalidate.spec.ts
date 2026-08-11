// tests/e2e/revalidate.spec.ts
// On-demand ISR revalidation webhook (Task 22).
// Verifies POST /api/revalidate:
//   1. Accepts {path} and returns {revalidated: true} with 200.
//   2. Accepts {collection, slug} and purges the per-locale PDP paths.
//   3. Returns 200 (with full-layout purge) when called with an empty body.
//   4. Returns 401 when REVALIDATE_SECRET is set and the request is missing
//      or has the wrong x-revalidate-secret header.
//
// Auth gate is env-driven. The dev server is started by Playwright's
// webServer config with REVALIDATE_SECRET=dev-revalidate-secret (see
// .env.local). Happy-path tests read the secret from process.env at runtime
// and send it as x-revalidate-secret. The auth tests verify the gate
// rejects wrong/missing headers.

import {test, expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

// Read REVALIDATE_SECRET from .env.local so the test stays in sync with
// whatever the dev server is using. Playwright's test process doesn't load
// .env.local automatically; we parse it explicitly. Falls back to env if
// present (CI overrides).
function loadSecret(): string | undefined {
  if (process.env.REVALIDATE_SECRET) return process.env.REVALIDATE_SECRET;
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const m = txt.match(/^REVALIDATE_SECRET=(.+)$/m);
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

const SECRET = loadSecret();
const authHeaders: Record<string, string> = SECRET
  ? {"x-revalidate-secret": SECRET}
  : {};

test("POST /api/revalidate with {path} returns 200 + revalidated:true", async ({request}) => {
  const res = await request.post("/api/revalidate", {
    headers: authHeaders,
    data: {path: "/en"},
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.revalidated).toBe(true);
});

test("POST /api/revalidate with {collection, slug} returns 200", async ({request}) => {
  const res = await request.post("/api/revalidate", {
    headers: authHeaders,
    data: {collection: "mithai-products", slug: "kaju-katli"},
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.revalidated).toBe(true);
});

test("POST /api/revalidate with empty body still returns 200 (layout fallback)", async ({request}) => {
  const res = await request.post("/api/revalidate", {
    headers: authHeaders,
    data: {},
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.revalidated).toBe(true);
});

test("POST /api/revalidate rejects wrong secret with 401 when secret is set", async ({request}) => {
  test.skip(!SECRET, "REVALIDATE_SECRET not set — auth gate is open");

  const res = await request.post("/api/revalidate", {
    headers: {"x-revalidate-secret": "wrong-secret"},
    data: {path: "/en"},
  });
  expect(res.status()).toBe(401);
});

test("POST /api/revalidate rejects missing secret with 401 when secret is set", async ({request}) => {
  test.skip(!SECRET, "REVALIDATE_SECRET not set — auth gate is open");

  const res = await request.post("/api/revalidate", {
    data: {path: "/en"},
  });
  expect(res.status()).toBe(401);
});
