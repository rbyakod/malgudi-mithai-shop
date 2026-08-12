#!/usr/bin/env bash
# Extract Mishran logo SVGs from the source PDF.
# Run once after cloning, or when the source PDF changes.
set -euo pipefail

SRC_PDF="${1:-$HOME/Downloads/Mishran Final Logo + Crest.pdf}"
OUT_DIR="$(git rev-parse --show-toplevel)/public/admin"
mkdir -p "$OUT_DIR"

if [[ ! -f "$SRC_PDF" ]]; then
  echo "Source PDF not found: $SRC_PDF" >&2
  echo "Pass the path as first argument." >&2
  exit 1
fi

# Page 1 = wordmark; Page 2 = crest
pdf2svg "$SRC_PDF" "$OUT_DIR/mishran-wordmark.svg" 1
pdf2svg "$SRC_PDF" "$OUT_DIR/mishran-crest.svg" 2

# PNG fallbacks at 192 / 512 from page 2 (crest)
pdftoppm -png -r 200 -f 2 -l 2 "$SRC_PDF" "$OUT_DIR/crest-tmp"
mv "$OUT_DIR/crest-tmp-2.png" "$OUT_DIR/mishran-crest-192.png"

pdftoppm -png -r 400 -f 2 -l 2 "$SRC_PDF" "$OUT_DIR/crest-tmp"
mv "$OUT_DIR/crest-tmp-2.png" "$OUT_DIR/mishran-crest-512.png"

rm -f "$OUT_DIR/crest-tmp-"*.png

# Favicon: convert 512 PNG to multi-size ICO via ImageMagick (already on macOS dev machines via brew)
if command -v magick >/dev/null 2>&1; then
  magick "$OUT_DIR/mishran-crest-512.png" -define icon:auto-resize=16,32,48 "$OUT_DIR/favicon.ico"
elif command -v convert >/dev/null 2>&1; then
  convert "$OUT_DIR/mishran-crest-512.png" -define icon:auto-resize=16,32,48 "$OUT_DIR/favicon.ico"
else
  echo "ImageMagick not found — favicon.ico skipped. Install via: brew install imagemagick" >&2
fi

echo "Logos extracted to $OUT_DIR"
