// tests/unit/analytics-wiring.test.ts
// Regression guard: asserts the `track()` helper from @/lib/analytics is
// imported by at least N source files across the app and components trees.
//
// Context: the Phase 0 final review found that lib/analytics.ts exported
// `track()` but no component actually called it — the 14 custom events
// (lead_submitted, product_viewed, add_to_cart, etc.) never fired even
// though the GA4 + Meta Pixel bootstrap loaded fine. This test makes a
// silent regression impossible: if the import count drops below the
// threshold, the test fails with a clear message naming the offending
// directories.

// @vitest-environment node

import {describe, it, expect} from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MIN_CALL_SITE_COUNT = 4;

// Recursively collect files matching a set of extensions under a root dir,
// skipping node_modules and hidden dirs (.next, .git, etc.).
function walk(root: string, exts: string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  const stack: string[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      if (entry.name.startsWith(".")) continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
        out.push(full);
      }
    }
  }
  return out;
}

function findCallSites(): string[] {
  const roots = [
    path.join(REPO_ROOT, "components"),
    path.join(REPO_ROOT, "app"),
  ];
  const exts = [".tsx", ".ts"];
  const files = roots.flatMap((r) => walk(r, exts));
  const matches: string[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (content.includes('"@/lib/analytics"') || content.includes("'@/lib/analytics'")) {
      matches.push(file);
    }
  }
  return matches;
}

describe("analytics wiring regression guard", () => {
  it("`track` is imported by at least N source files", () => {
    const sites = findCallSites();
    const rel = sites.map((p) => path.relative(REPO_ROOT, p)).sort();
    console.log(`[analytics-wiring] found ${sites.length} import site(s):\n${rel.map((p) => `  - ${p}`).join("\n")}`);
    expect(
      sites.length,
      `Expected at least ${MIN_CALL_SITE_COUNT} source files to import from "@/lib/analytics", ` +
        `but found ${sites.length}:\n${rel.map((p) => `  - ${p}`).join("\n")}\n` +
        `If you removed an analytics call site, either restore it or lower MIN_CALL_SITE_COUNT with a justification.`
    ).toBeGreaterThanOrEqual(MIN_CALL_SITE_COUNT);
  });
});
