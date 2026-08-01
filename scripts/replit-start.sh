#!/usr/bin/env bash
set -euo pipefail

echo "[Guestbook] Stopping stale preview processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true

rm -rf dist .expo

echo "[Guestbook] Installing dependencies..."
npm install

echo "[Guestbook] Building web preview..."
npx expo export --platform web --clear

if [ ! -f dist/index.html ]; then
  echo "[Guestbook] ERROR: dist/index.html was not created."
  exit 1
fi

echo "[Guestbook] Serving static preview on port 5000 with caching disabled..."
exec npx --yes serve -s dist -l tcp://0.0.0.0:5000 -c 0
