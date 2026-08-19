#!/usr/bin/env bash
# scripts/warm-image-cache.sh — populate the nginx image cache after a deploy.
#
# Why: nginx fronts the app and disk-caches /_next/image + /api/media/file
# (see /etc/nginx/conf.d/mishran-image-cache.conf on the VPS). That cache
# survives app restarts, but the FIRST request for each image×width still
# hits the cold sharp optimizer (~0.7–1s each; the /mithai hub fires ~90
# concurrently). This script pre-fetches every catalog media URL at the
# widths the storefront actually requests, so the first real visitor after
# a deploy gets disk hits instead of a broken-image burst.
#
# Runs ON the VPS (needs curl + python3 only). Safe to re-run: already-warm
# entries are HITs and cost milliseconds.
set -euo pipefail

BASE="${1:-https://mishran.pranavb.com}"
PARALLEL="${PARALLEL:-6}"
# Must mirror the default next/image loader's query order (?url=&w=&q=)
# byte-for-byte — nginx cache keys include the raw query string, so a
# different order or encoding would warm entries nothing ever hits.
WIDTHS=(384 640 750 828 1080 1200)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Media paths appear backslash-escaped (\/) inside the RSC payload of the
# hub and home pages. Unescape FIRST, then extract with a strict filename
# class — regex-then-unescape leaves a trailing backslash from the escaped
# quote after each path, which poisons every warmed URL.
for path in /en /en/mithai /en/snacks /en/merch /en/qsr /en/gifts /en/occasions; do
  curl -s --max-time 60 "$BASE$path"
done | python3 -c '
import re, sys
html = sys.stdin.read().replace("\\/", "/")
for m in sorted(set(re.findall(r"/api/media/file/[A-Za-z0-9._%()-]+", html))):
    print(m)
' > "$tmp/media"

count="$(wc -l < "$tmp/media" | tr -d ' ')"
echo "media urls: $count (from $BASE)"

# Optimizer URLs in exact loader order (url, w, q), plus plain media GETs
# (the mobile apps fetch media directly).
: > "$tmp/urls"
while IFS= read -r media; do
  media="/${media#/}"
  enc="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$media")"
  for w in "${WIDTHS[@]}"; do
    printf '%s/_next/image?url=%s&w=%s&q=75\n' "$BASE" "$enc" "$w" >> "$tmp/urls"
  done
  printf '%s/%s\n' "$BASE" "$media" >> "$tmp/urls"
done < "$tmp/media"

total="$(wc -l < "$tmp/urls" | tr -d ' ')"
echo "warming $total urls (parallel=$PARALLEL)…"
# --location: the media route can 308-normalize; follow so the final 200
# is what gets cached. Per-URL failures print XXX instead of aborting xargs.
xargs -P "$PARALLEL" -I{} sh -c 'curl -s -L --max-time 90 -o /dev/null -w "%{http_code}\n" "$1" || echo XXX' _ {} < "$tmp/urls" \
  | sort | uniq -c | sort -rn
echo "warm complete."
