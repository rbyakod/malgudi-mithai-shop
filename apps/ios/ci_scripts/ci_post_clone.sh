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
