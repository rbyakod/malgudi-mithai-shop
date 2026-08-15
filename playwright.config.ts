import { defineConfig, devices } from "@playwright/test";

// PORT lets `PORT=3100 npx playwright test` avoid clobbering (or borrowing)
// an unrelated dev server on 3000 — reuseExistingServer would happily test
// whatever process owns the port otherwise.

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["list"]],
  use: {
    baseURL: `http://localhost:${process.env.PORT ?? "3000"}`,
    trace: "on-first-retry",
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
