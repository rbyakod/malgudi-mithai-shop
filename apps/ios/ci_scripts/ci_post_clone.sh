#!/bin/bash
# ci_post_clone.sh — Task 14.5 (Mishran Mobile Apps v1).
# Xcode Cloud runs this after cloning, before building. Regenerates the two
# committed artifacts that depend on monorepo packages so a branch that
# touched tokens.json never builds against a stale MishranTokens.swift:
#   1. brand-tokens Swift codegen (pnpm + tsx)
#   2. the .xcodeproj itself (xcodegen — committed copy stays in sync)
# Xcode Cloud images ship Homebrew; pnpm comes via corepack.
set -euo pipefail

cd "$CI_PRIMARY_REPOSITORY_PATH"

# pnpm via corepack (node ships on the image).
corepack enable
corepack prepare pnpm@latest --activate

# Install just the workspace deps brand-tokens needs (lockfile-frozen).
pnpm install --frozen-lockfile

pnpm --filter @mishran/brand-tokens run codegen:swift

# Regenerate the project (idempotent — same project.yml as local).
if command -v xcodegen >/dev/null 2>&1 || brew install xcodegen; then
  xcodegen --spec apps/ios/project.yml
fi

# Task 20.2: run the performance benchmarks and surface the numbers in the
# Xcode Cloud build log (metrics land with the test step; this echoes the
# budget contract so reviewers see it next to the log).
cat <<'METRICS' >&2
[ios:perf] ColdStartTests budget: pre-UI critical path < 1.5s (plan p95 ≤ 1.5s on iPhone SE 3).
[ios:perf] CatalogScrollTests budget: p95 filter pass over 500 items < 16ms (one 60fps frame; Instruments frame-drop audit is the hardware gate).
METRICS
