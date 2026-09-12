#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/app/src/main/assets/game/pixi.min.js"
URL="https://cdn.jsdelivr.net/npm/pixi.js@8.20.1/dist/pixi.min.js"
echo "Vendoring PixiJS 8.20.1 -> $OUT"
curl -fL --retry 3 "$URL" -o "$OUT"
echo "bytes: $(wc -c < "$OUT")"
