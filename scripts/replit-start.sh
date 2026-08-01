#!/usr/bin/env bash
set -euo pipefail

echo "[Guestbook] Stopping stale preview processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
pkill -f "serve-preview.cjs" 2>/dev/null || true

rm -rf dist .expo

echo "[Guestbook] Installing dependencies..."
npm install

echo "[Guestbook] Building web preview..."
npx expo export --platform web --clear

if [ ! -f dist/index.html ]; then
  echo "[Guestbook] ERROR: dist/index.html was not created."
  exit 1
fi

echo "[Guestbook] Starting no-cache preview server on port 5000..."
exec node scripts/serve-preview.cjs
