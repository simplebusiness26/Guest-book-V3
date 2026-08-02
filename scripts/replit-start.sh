#!/usr/bin/env bash
set -euo pipefail

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
MESSAGE="$(git log -1 --pretty=%s 2>/dev/null || echo unknown)"

echo "[Guestbook] Building branch: ${BRANCH}"
echo "[Guestbook] Building commit: ${COMMIT} - ${MESSAGE}"

if ! grep -q 'HOME_LAYOUT_VERSION="compact-v2"' app/index.js 2>/dev/null; then
  echo "[Guestbook] ERROR: Expected compact-v2 home layout was not found. Pull the latest feature/events-mvp branch before running."
  exit 1
fi

echo "[Guestbook] Stopping stale preview processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
pkill -f "serve-preview.cjs" 2>/dev/null || true

rm -rf dist .expo node_modules/.cache

echo "[Guestbook] Installing dependencies..."
npm install

echo "[Guestbook] Building web preview from current source..."
npx expo export --platform web --clear

if [ ! -f dist/index.html ]; then
  echo "[Guestbook] ERROR: dist/index.html was not created."
  exit 1
fi

cat > dist/build-info.json <<EOF
{
  "branch": "${BRANCH}",
  "commit": "${COMMIT}",
  "message": "${MESSAGE}",
  "homeLayout": "compact-v2"
}
EOF

echo "[Guestbook] Preview build verified: ${BRANCH} @ ${COMMIT}"
echo "[Guestbook] Home layout verified: compact-v2"
echo "[Guestbook] Starting no-cache preview server on port 5000..."
exec node scripts/serve-preview.cjs
