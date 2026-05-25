#!/usr/bin/env bash
# Verifica build Next.js antes de subir o PM2
set -euo pipefail
cd "$(dirname "$0")/.."

DISK_FILE=$(ls .next/static/chunks/webpack-*.js 2>/dev/null | head -1 || true)
if [ -z "$DISK_FILE" ]; then
  echo "ERRO — .next/static/chunks/webpack-*.js não encontrado. Rode npm run build"
  exit 1
fi

DISK_HASH=$(basename "$DISK_FILE")
BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo "?")

echo "BUILD_ID:    $BUILD_ID"
echo "Chunk disco: $DISK_HASH"
echo ""
echo "Após pm2 start, confira se bate:"
echo '  curl -s http://127.0.0.1:3015/ | grep -oE "webpack-[a-f0-9]+\.js" | head -1'
echo ""
echo "Se o curl mostrar hash DIFERENTE do disco, pare o PM2, rm -rf .next, build de novo."
