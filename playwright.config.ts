import { defineConfig, devices } from "@playwright/test";

// PORT lets `PORT=3100 npx playwright test` avoid clobbering (or borrowing)
// an unrelated dev server on 3000 — reuseExistingServer would happily test
// whatever process owns the port otherwise.

// The sitewide consent banner (lib/consent.ts) would cover parts of the page in every test, so by
// default a visitor has already chosen "essential only". consent.spec.ts starts with no choice.
export const CONSENT_ESSENTIAL_ONLY_STATE = {
  cookies: [
    {
      name: "mishran_consent",
      value: encodeURIComponent(JSON.stringify({v: 1, analytics: false, assistant: false, ts: 0})),
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  use: {
    baseURL: `http://localhost:${process.env.PORT ?? "3000"}`,
    trace: "on-first-retry",
    storageState: CONSENT_ESSENTIAL_ONLY_STATE,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${process.env.PORT ?? 3000}`,
    url: `http://localhost:${process.env.PORT ?? "3000"}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
