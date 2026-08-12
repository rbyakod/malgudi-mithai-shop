// Vitest setup for integration tests.
// Vitest does not auto-load .env.local (it loads .env, .env.test, .env.[mode]
// via Vite's loadEnv — .env.local is included, but only when Vite's CWD env
// resolution picks it up; in CI or unusual CWDs that fails silently). To make
// MONGODB_URI reliably available to Payload, read .env.local explicitly and
// fall back to the local dev MongoDB URI.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  if (process.env.MONGODB_URI) return;
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^"|"$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local missing — fall back to local dev DB so the test still runs.
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/mishran-dev";
  }
}

loadEnvLocal();
