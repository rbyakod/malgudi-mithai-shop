#!/usr/bin/env bash
# scripts/deploy-vps.sh — one-command deploy to the self-hosted VPS.
#
# Run from anywhere in the repo on the Mac:
#   bash scripts/deploy-vps.sh
#
# What it does:
#   1. Local: verify origin/main on GitHub is up to date with local main.
#   2. VPS (as mithai): git pull → pnpm install → pnpm build.
#   3. VPS (as root): systemctl restart mithai-shop.
#   4. VPS: health check on http://127.0.0.1:3000/en.
#   5. VPS: warm the nginx image cache in the background
#      (scripts/warm-image-cache.sh — see docs/deployment.md §8).
#
# Safety: the service is only restarted after a successful build, so a failed
# build leaves the currently-running version serving untouched.
#
# Override the target with DEPLOY_SSH (default root@2.24.221.70):
#   DEPLOY_SSH=ubuntu@2.24.221.70 bash scripts/deploy-vps.sh
set -euo pipefail

DEPLOY_SSH="${DEPLOY_SSH:-root@2.24.221.70}"
APP_DIR="/opt/mithai-shop"
SERVICE="mithai-shop"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mDEPLOY FAILED: %s\033[0m\n' "$*" >&2; exit 1; }

step "1/5 Checking local main is pushed to origin"
git fetch origin main --quiet
LOCAL="$(git rev-parse main)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" != "$REMOTE" ]; then
  die "local main ($LOCAL) != origin/main ($REMOTE). Push first (or commit your changes)."
fi
echo "main @ ${REMOTE:0:7} — GitHub is current."

step "2/5 VPS: git pull + pnpm install + pnpm build (as mithai)"
# NOTE: the remote command MUST stay on one line. `sudo -iu` over ssh
# collapses embedded newlines to spaces, which turns a multi-line
# `bash -c '...'` script into `set -euo pipefail cd ... && ...` — i.e. a
# single `set` invocation that silently exits 0 without running anything.
# That made deploys no-op while still reporting success.
ssh "$DEPLOY_SSH" "sudo -iu mithai bash -c 'set -euo pipefail; cd $APP_DIR && git pull origin main && pnpm install --frozen-lockfile && pnpm build'" || die "pull/install/build failed on the VPS — the running service was NOT touched."

# The pull can also no-op silently on a dirty checkout (local changes block
# the merge). Verify the deployed commit actually matches local main.
DEPLOYED="$(ssh "$DEPLOY_SSH" "sudo -iu mithai bash -c 'cd $APP_DIR && git rev-parse HEAD'")"
if [ "$DEPLOYED" != "$LOCAL" ]; then
  die "VPS is at ${DEPLOYED:0:7}, expected ${LOCAL:0:7}. The pull did not apply — check for a dirty checkout: ssh $DEPLOY_SSH \"sudo -iu mithai git -C $APP_DIR status\""
fi
echo "VPS at ${DEPLOYED:0:7} — matches local main."

step "3/5 VPS: restart $SERVICE"
# sudo -n so non-root SSH targets (e.g. the hermes-vps alias) work too.
ssh "$DEPLOY_SSH" "sudo -n systemctl restart $SERVICE"
sleep 3
ssh "$DEPLOY_SSH" "systemctl is-active $SERVICE" || die "service not active after restart — check: ssh $DEPLOY_SSH 'journalctl -u $SERVICE -n 50 --no-pager'"

step "4/5 VPS: health check"
CODE="$(ssh "$DEPLOY_SSH" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/en")"
if [ "$CODE" != "200" ]; then
  die "health check returned HTTP $CODE (expected 200). Check: ssh $DEPLOY_SSH 'journalctl -u $SERVICE -n 50 --no-pager'"
fi
echo "HTTP 200 from http://127.0.0.1:3000/en — deploy complete."

step "5/5 VPS: warm nginx image cache (background)"
# Populates /var/cache/nginx/nextimg so the first visitors after the restart
# don't hit a cold sharp optimizer (see docs/deployment.md §8). Backgrounded:
# a cold warm takes a few minutes and must not block the deploy.
ssh "$DEPLOY_SSH" "sudo -iu mithai bash -c 'cd $APP_DIR && nohup bash scripts/warm-image-cache.sh >/tmp/warm-image-cache.log 2>&1 & echo warm-started'" || echo "WARN: warm start failed — run manually: ssh $DEPLOY_SSH 'sudo -iu mithai bash -c \"cd $APP_DIR && bash scripts/warm-image-cache.sh\"'"
